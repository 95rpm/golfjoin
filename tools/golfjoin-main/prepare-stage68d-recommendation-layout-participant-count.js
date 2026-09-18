"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const acorn = require("acorn");

const { assembleFromSource, splitMainHtml } = require("./source-bundle");
const { collectInlineHandlerNames, minifyJavaScript } = require("./prepare-stage13-brotli-js");

const ROOT = path.resolve(__dirname, "../..");
const MAIN_BASELINE = path.join(ROOT, "deploy/stage68-product-family-airpack/integrated-recommendation-20260915-v68b");
const ADMIN_BASELINE = path.join(ROOT, "deploy/stage68-product-family-airpack/recommendation-performance-hotfix-20260915-v68c");
const OUTPUT = path.join(ROOT, "deploy/stage68-product-family-airpack/recommendation-layout-participant-first-load-20260915-v68d");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sri = (value) => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;

function readVerified(root, fileName, expectedHash, label) {
  const value = fs.readFileSync(path.join(root, fileName));
  if (sha256(value) !== expectedHash) throw new Error(`${label}_hash_mismatch`);
  return value;
}

function replaceExact(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count !== 1) throw new Error(`${label}_count_invalid:${count}`);
  return source.replace(target, replacement);
}

function replaceAllRequired(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count < 1) throw new Error(`${label}_missing`);
  return source.split(target).join(replacement);
}

function getNamedFunctionSource(source, name) {
  const program = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  const node = program.body.find((item) => item.type === "FunctionDeclaration" && item.id?.name === name);
  if (!node) throw new Error(`function_missing:${name}`);
  return source.slice(node.start, node.end);
}

function verifyInlineScripts(html, label) {
  [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim())
    .forEach((source, index) => new vm.Script(source, { filename: `${label}-inline-${index + 1}.js` }));
}

function makeMainCloudTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.mainDeploy)}),rollback=read(${JSON.stringify(names.mainRollback)}),cssGz=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v68d 메인 배포 파일 해시와 JavaScript 문법이 유효하다",()=>{assert.deepEqual({html:hash(html),rollback:hash(rollback),css:hash(cssGz),js:hash(jsBr)},${JSON.stringify({ html: hashes.mainDeploy, rollback: hashes.mainRollback, css: hashes.css, js: hashes.js })});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v68d 월례회 인원은 임시 0보다 실제 권위 집계를 우선한다",()=>{assert.ok(js.includes("function getMonthlyCardParticipantCount("));assert.ok(js.includes("return getJoinAuthoritativeConfirmedCount("));assert.ok(!js.includes(".map(Number).find("))});\n`
    + `test("v68d 통합 추천일정 기간 전환 기능을 유지한다",()=>{for(const value of ["getAdminRecommendedFamilyOptions","getAdminRecommendedDetailFamilyPeriodOptions","selectDetailProductFamilyPeriod","productFamilyId","familyOptions"])assert.ok(js.includes(value),value)});\n`,
    "utf8"
  );
}

function makeAdminCloudTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.adminDeploy)}),rollback=read(${JSON.stringify(names.adminRollback)}),source=html.toString("utf8");\n`
    + `test("v68d 대시보드 배포·복구 해시가 일치한다",()=>assert.deepEqual({deploy:hash(html),rollback:hash(rollback)},${JSON.stringify({ deploy: hashes.adminDeploy, rollback: hashes.adminRollback })}));\n`
    + `test("v68d 대시보드 인라인 JavaScript 문법이 유효하다",()=>{const scripts=[...source.matchAll(/<script\\b(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(x=>x[1]).filter(Boolean);assert.equal(scripts.length,1);scripts.forEach(x=>assert.doesNotThrow(()=>new vm.Script(x)))});\n`
    + `test("v68d 기간 열은 두 열·두 행 안에 표시한다",()=>{for(const value of ["recommendation-period-list","grid-template-columns: repeat(2, minmax(0, 1fr))","renderRecommendationPeriodCell","labels.slice(0, 3)","labels.length - 3"])assert.ok(source.includes(value),value)});\n`
    + `test("v68d 일반·단체 라벨은 고정 헤더보다 아래에 쌓인다",()=>{assert.ok(/\\.recommendation-table > thead > tr > th\\s*\\{\\s*z-index:\\s*6/.test(source));assert.ok(/\\.recommendation-toggle-track\\s*\\{[\\s\\S]*?isolation:\\s*isolate/.test(source))});\n`
    + `test("v68d 추천일정 성능·통합 등록 기능을 유지한다",()=>{for(const value of ["추천 상품군 정보를 불러오고 있습니다","recommendation-calendar-months","registeredRulesByGroupKey","productFamilyId","familyOptionsJson"])assert.ok(source.includes(value),value)});\n`,
    "utf8"
  );
}

function makePackageTest(names, hashes, revision) {
  const expected = {
    mainDeploy: hashes.mainDeploy,
    mainRollback: hashes.mainRollback,
    css: hashes.css,
    js: hashes.js,
    mainCloudTest: hashes.mainCloudTest,
    adminDeploy: hashes.adminDeploy,
    adminRollback: hashes.adminRollback,
    adminCloudTest: hashes.adminCloudTest,
    firebase: hashes.firebase
  };
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `test("v68d 전체 산출물 해시가 일치한다",()=>{const actual={mainDeploy:hash(read(${JSON.stringify(names.mainDeploy)})),mainRollback:hash(read(${JSON.stringify(names.mainRollback)})),css:hash(read(${JSON.stringify(names.css)})),js:hash(read(${JSON.stringify(names.js)})),mainCloudTest:hash(read(${JSON.stringify(names.mainCloudTest)})),adminDeploy:hash(read(${JSON.stringify(names.adminDeploy)})),adminRollback:hash(read(${JSON.stringify(names.adminRollback)})),adminCloudTest:hash(read(${JSON.stringify(names.adminCloudTest)})),firebase:hash(read(${JSON.stringify(names.firebase)}))};assert.deepEqual(actual,${JSON.stringify(expected)})});\n`
    + `test("v68d 메인 HTML은 새 불변 자산과 SRI를 참조한다",()=>{const value=read(${JSON.stringify(names.mainDeploy)}).toString("utf8");assert.ok(value.includes(${JSON.stringify(revision)}));assert.ok(value.includes(${JSON.stringify(hashes.cssSri)}));assert.ok(value.includes(${JSON.stringify(hashes.jsSri)}))});\n`
    + `test("v68d 대시보드 HTML은 캐시 금지 설정과 함께 배포된다",()=>{const value=read(${JSON.stringify(names.firebase)}).toString("utf8");assert.ok(value.includes("private, no-store, max-age=0, must-revalidate"))});\n`
    + `test("v68d 압축 자산과 인라인 스크립트가 파싱된다",()=>{assert.doesNotThrow(()=>zlib.gunzipSync(read(${JSON.stringify(names.css)})));assert.doesNotThrow(()=>new vm.Script(zlib.brotliDecompressSync(read(${JSON.stringify(names.js)})).toString("utf8")));const html=read(${JSON.stringify(names.adminDeploy)}).toString("utf8");[...html.matchAll(/<script\\b(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(x=>x[1]).filter(Boolean).forEach(x=>assert.doesNotThrow(()=>new vm.Script(x)))});\n`,
    "utf8"
  );
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 68d - 추천일정 기간 배치·첫 진입 월례회 인원 보정\n\n`
    + `서버 함수는 변경하지 않습니다. 대시보드는 기간 열을 한 행에 두 개씩 최대 두 행으로 고정하고, 일반/단체 토글이 고정 헤더 위로 겹치지 않게 합니다. 메인은 첫 진입 때 임시 0명 값이 실제 59명 집계를 가리지 않도록 월례회 인원 판정을 권위 집계 함수로 통일합니다.\n\n`
    + `## 1. 대시보드 업로드·검증·배포\n\n/home/llno95ll/golfjoin-admin-hosting 에 다음 파일을 업로드합니다.\n\n- ${names.adminDeploy}\n- ${names.adminRollback}\n- ${names.adminCloudTest}\n- ${names.firebase}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/golfjoin-admin-hosting\nsha256sum ${names.adminDeploy} ${names.adminRollback} ${names.adminCloudTest} ${names.firebase}\nnode --test ${names.adminCloudTest}\ncp -f public/index.html BACKUP_pre_stage68d_admin_dashboard.html\ncp -f ${names.adminDeploy} public/index.html\ncp -f firebase.json BACKUP_pre_stage68d_firebase.json\ncp -f ${names.firebase} firebase.json\nsha256sum public/index.html firebase.json\nfirebase deploy --only hosting --project dashboad-golfjoin-secrettour\n\`\`\`\n\n`
    + `## 2. 메인 자산 업로드·검증\n\n/home/llno95ll/google-sheet-proxy-function 에 다음 파일을 업로드합니다.\n\n- ${names.mainDeploy}\n- ${names.mainRollback}\n- ${names.css}\n- ${names.js}\n- ${names.mainCloudTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.mainDeploy} ${names.mainRollback} ${names.css} ${names.js} ${names.mainCloudTest}\nnode --test ${names.mainCloudTest}\ngzip -t ${names.css}\nnode -e 'const fs=require("node:fs"),vm=require("node:vm"),z=require("node:zlib");new vm.Script(z.brotliDecompressSync(fs.readFileSync("${names.js}")).toString("utf8"));console.log("PASS: v68d 메인 JavaScript 문법 확인 완료")'\n\`\`\`\n\n`
    + `## 3. 메인 불변 자산 업로드\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\ncurl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\ncurl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n\`\`\`\n\n`
    + `${names.mainDeploy} 전체 내용으로 ERP 편집기의 골프조인 메인 HTML을 직접 교체합니다. 서버 함수 재배포는 하지 않습니다.\n\n`
    + `## 4. 운영 확인\n\n1. 추천일정에서 4개 기간이 2개씩 2행으로 보이고 기간 때문에 표 폭이 늘어나지 않는지 확인합니다.\n2. 표를 세로 스크롤해 일반/단체 문구가 헤더 위에 겹치지 않는지 확인합니다.\n3. 시크릿 창에서 골프조인 메인에 최초 접속하여 10월 월례회가 바로 59/60명으로 보이는지 확인합니다.\n4. 같은 화면을 새로고침해도 59/60명이 유지되는지 확인합니다.\n\n`
    + `## 5. 복구\n\n대시보드는 ${names.adminRollback}, 메인은 ${names.mainRollback}으로 복구합니다. 메인 자산은 불변 URL이므로 삭제하지 않고 HTML 참조만 이전 버전으로 되돌립니다.\n\n`
    + `- 대시보드 HTML SHA-256: ${hashes.adminDeploy}\n- 메인 HTML SHA-256: ${hashes.mainDeploy}\n- 메인 JS SHA-256: ${hashes.js}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const mainManifest = JSON.parse(fs.readFileSync(path.join(MAIN_BASELINE, "manifest.json"), "utf8"));
  const mainRollback = readVerified(MAIN_BASELINE, mainManifest.names.mainDeploy, mainManifest.hashes.mainDeploy, "main_baseline_html");
  const cssGzip = readVerified(MAIN_BASELINE, mainManifest.names.css, mainManifest.hashes.css, "main_baseline_css");
  const oldJsBrotli = readVerified(MAIN_BASELINE, mainManifest.names.js, mainManifest.hashes.js, "main_baseline_js");
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const parts = splitMainHtml(assembledHtml);
  const sourceJs = parts[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");
  const nextJsText = replaceExact(
    oldJs,
    getNamedFunctionSource(oldJs, "getMonthlyCardParticipantCount"),
    getNamedFunctionSource(minifiedSourceJs, "getMonthlyCardParticipantCount"),
    "monthly_participant_count"
  );
  new vm.Script(nextJsText, { filename: "golfjoin-main-v68d.js" });
  const js = Buffer.from(nextJsText, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");
  zlib.gunzipSync(cssGzip);

  const css = zlib.gunzipSync(cssGzip);
  const revision = `gha_${sha256(Buffer.concat([css, Buffer.from("\n--stage68d--\n"), js])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let mainDeployText = mainRollback.toString("utf8").split(mainManifest.assetRevision).join(revision);
  mainDeployText = replaceAllRequired(mainDeployText, mainManifest.hashes.cssSri, cssSri, "main_css_sri");
  mainDeployText = replaceAllRequired(mainDeployText, mainManifest.hashes.jsSri, jsSri, "main_js_sri");
  verifyInlineScripts(mainDeployText, "main");
  const mainDeploy = Buffer.from(mainDeployText, "utf8");

  const adminManifest = JSON.parse(fs.readFileSync(path.join(ADMIN_BASELINE, "manifest.json"), "utf8"));
  const adminRollback = readVerified(ADMIN_BASELINE, adminManifest.deploy, adminManifest.hashes.deploy, "admin_baseline_html");
  const firebase = readVerified(ADMIN_BASELINE, adminManifest.firebase, adminManifest.hashes.firebase, "firebase_config");
  const adminDeploy = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"));
  verifyInlineScripts(adminDeploy.toString("utf8"), "admin");

  const hashes = {
    mainDeploy: sha256(mainDeploy),
    mainRollback: sha256(mainRollback),
    css: sha256(cssGzip),
    js: sha256(jsBrotli),
    cssSri,
    jsSri,
    adminDeploy: sha256(adminDeploy),
    adminRollback: sha256(adminRollback),
    firebase: sha256(firebase)
  };
  const names = {
    mainDeploy: `DEPLOY_golfjoin_main_monthly_first_load_${hashes.mainDeploy.slice(0, 8).toUpperCase()}.html`,
    mainRollback: `ROLLBACK_golfjoin_main_${hashes.mainRollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    mainCloudTest: "stage68d-main-monthly-first-load.test.js",
    adminDeploy: `DEPLOY_golfjoin_admin_dashboard_${hashes.adminDeploy.slice(0, 8).toUpperCase()}.html`,
    adminRollback: `ROLLBACK_golfjoin_admin_dashboard_${hashes.adminRollback.slice(0, 8).toUpperCase()}.html`,
    adminCloudTest: "stage68d-dashboard-recommendation-layout.test.js",
    firebase: "stage68d-firebase.json",
    packageTest: "stage68d-recommendation-layout-participant-count-package.test.js"
  };
  const mainCloudTest = makeMainCloudTest(names, hashes);
  hashes.mainCloudTest = sha256(mainCloudTest);
  const adminCloudTest = makeAdminCloudTest(names, hashes);
  hashes.adminCloudTest = sha256(adminCloudTest);
  const packageTest = makePackageTest(names, hashes, revision);
  hashes.packageTest = sha256(packageTest);
  const runbook = Buffer.from(makeRunbook(names, hashes, revision), "utf8");

  const manifest = {
    schema: "golfjoin-recommendation-layout-participant-first-load-v1",
    version: "v68d",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    scope: "dashboard-and-main-assets-no-server",
    assetRevision: revision,
    behavior: {
      recommendationPeriodColumns: 2,
      recommendationPeriodRows: 2,
      recommendationPeriodVisibleLimit: 4,
      stickyHeaderAboveTypeToggle: true,
      monthlyCountUsesAuthoritativeMaximum: true,
      integratedRecommendationMaintained: true
    },
    names,
    hashes
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  new Map([
    [names.mainDeploy, mainDeploy],
    [names.mainRollback, mainRollback],
    [names.css, cssGzip],
    [names.js, jsBrotli],
    [names.mainCloudTest, mainCloudTest],
    [names.adminDeploy, adminDeploy],
    [names.adminRollback, adminRollback],
    [names.adminCloudTest, adminCloudTest],
    [names.firebase, firebase],
    [names.packageTest, packageTest],
    ["RUNBOOK.md", runbook],
    ["manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")]
  ]).forEach((value, name) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));

  fs.writeFileSync(path.join(ROOT, "golfjoin_main.html"), mainDeploy);
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, revision, names, hashes }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
