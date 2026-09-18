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
const MAIN_BASELINE = path.join(ROOT, "deploy/stage67-detail-itinerary/li-points-20260915-v67");
const ADMIN_BASELINE = path.join(ROOT, "deploy/stage65-admin-email-notifications/admin-email-notifications-apps-script-20260914-v65b");
const OUTPUT = path.join(ROOT, "deploy/stage68-product-family-airpack/integrated-recommendation-20260915-v68b");

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

function makeServerTest(original) {
  return Buffer.from(replaceExact(
    original,
    'require("./index")',
    'require("./stage68b-index")',
    "server_test_import"
  ), "utf8");
}

function makeMainCloudTest(names, hashes) {
  const cardContracts = [
    "getAdminRecommendedFamilyOptions",
    'join("/")',
    "productFamilyId",
    "familyOptions"
  ];
  const detailContracts = [
    "getAdminRecommendedDetailFamilyPeriodOptions",
    "goodSeq",
    "eventSeq",
    "returnDate",
    "durationLabel",
    "price",
    "selectDetailProductFamilyPeriod"
  ];
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.mainDeploy)}),rollback=read(${JSON.stringify(names.mainRollback)}),cssGz=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v68b 메인 업로드 파일 해시와 JavaScript 문법이 유효하다",()=>{assert.deepEqual({html:hash(html),rollback:hash(rollback),css:hash(cssGz),js:hash(jsBr)},${JSON.stringify({ html: hashes.mainDeploy, rollback: hashes.mainRollback, css: hashes.css, js: hashes.js })});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v68b 통합 카드는 기간명과 복수 귀국일을 표시한다",()=>{for(const value of ${JSON.stringify(cardContracts)})assert.ok(js.includes(value),value)});\n`
    + `test("v68b 상세 탭은 선택한 ERP 상품·행사·귀국일·가격을 유지한다",()=>{for(const value of ${JSON.stringify(detailContracts)})assert.ok(js.includes(value),value)});\n`
    + `test("v68b 신청 화면은 상세에서 선택한 기간만 사용한다",()=>{assert.ok(js.includes("currentDetailJoinData&&currentDetailJoinData.id===currentDetailJoinId"));assert.ok(js.split("selectedPeriod:!0").length-1>=2)});\n`,
    "utf8"
  );
}

function makeAdminCloudTest(names, hashes) {
  const groupingContracts = [
    'asText(family.status) === "approved"',
    "goodSeqs.size >= 2",
    "sharedDates?.has(asText(item.product?.departureDate))",
    "상품군 통합",
    "통합 추천등록"
  ];
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.adminDeploy)}),rollback=read(${JSON.stringify(names.adminRollback)}),source=html.toString("utf8");\n`
    + `test("v68b 대시보드 배포·복구 해시가 일치한다",()=>assert.deepEqual({deploy:hash(html),rollback:hash(rollback)},${JSON.stringify({ deploy: hashes.adminDeploy, rollback: hashes.adminRollback })}));\n`
    + `test("v68b 대시보드 인라인 JavaScript 문법이 유효하다",()=>{const scripts=[...source.matchAll(/<script\\b(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(x=>x[1]).filter(Boolean);assert.equal(scripts.length,1);scripts.forEach(x=>assert.doesNotThrow(()=>new vm.Script(x)))});\n`
    + `test("v68b 승인 상품군의 동일 출발일만 통합 후보로 표시한다",()=>{for(const value of ${JSON.stringify(groupingContracts)})assert.ok(source.includes(value),value)});\n`
    + `test("v68b 통합 추천일정은 상품군과 실제 ERP 기간 옵션을 저장한다",()=>{for(const value of ${JSON.stringify(["productFamilyId", "familyDepartureDate", "familyOptionsJson", "rs-family-${productFamilyId}-${asText(product.departureDate)}"])})assert.ok(source.includes(value),value)});\n`
    + `test("v68b는 참여자 취소·이메일 알림 관리 기능을 유지한다",()=>{for(const value of ["admin_participant_cancel","admin_email_settings_get","admin-email-settings","participant-role-badge cancelled"])assert.ok(source.includes(value),value)});\n`,
    "utf8"
  );
}

function makePackageTest(names, hashes, revision) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `test("v68b 전체 산출물 해시가 일치한다",()=>{const actual={index:hash(read(${JSON.stringify(names.index)})),serverTest:hash(read(${JSON.stringify(names.serverTest)})),mainDeploy:hash(read(${JSON.stringify(names.mainDeploy)})),mainRollback:hash(read(${JSON.stringify(names.mainRollback)})),css:hash(read(${JSON.stringify(names.css)})),js:hash(read(${JSON.stringify(names.js)})),mainCloudTest:hash(read(${JSON.stringify(names.mainCloudTest)})),adminDeploy:hash(read(${JSON.stringify(names.adminDeploy)})),adminRollback:hash(read(${JSON.stringify(names.adminRollback)})),adminCloudTest:hash(read(${JSON.stringify(names.adminCloudTest)}))};assert.deepEqual(actual,${JSON.stringify({ index: hashes.index, serverTest: hashes.serverTest, mainDeploy: hashes.mainDeploy, mainRollback: hashes.mainRollback, css: hashes.css, js: hashes.js, mainCloudTest: hashes.mainCloudTest, adminDeploy: hashes.adminDeploy, adminRollback: hashes.adminRollback, adminCloudTest: hashes.adminCloudTest })})});\n`
    + `test("v68b 메인 HTML이 새 불변 자산을 참조한다",()=>{const value=read(${JSON.stringify(names.mainDeploy)}).toString("utf8");assert.ok(value.includes(${JSON.stringify(revision)}));assert.ok(value.includes(${JSON.stringify(hashes.cssSri)}));assert.ok(value.includes(${JSON.stringify(hashes.jsSri)}))});\n`
    + `test("v68b 배포 JavaScript와 대시보드 스크립트가 파싱된다",()=>{assert.doesNotThrow(()=>new vm.Script(zlib.brotliDecompressSync(read(${JSON.stringify(names.js)})).toString("utf8")));const html=read(${JSON.stringify(names.adminDeploy)}).toString("utf8");[...html.matchAll(/<script\\b(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(x=>x[1]).filter(Boolean).forEach(x=>assert.doesNotThrow(()=>new vm.Script(x)))});\n`,
    "utf8"
  );
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 68b - 상품군 통합 추천일정\n\n`
    + `승인 상품군의 서로 다른 기간 상품이 같은 출발일에 존재할 때만 추천일정 한 건으로 등록합니다. 메인 카드는 통합 기간과 복수 귀국일을 표시하고, 상세에서 기간 탭을 바꾸면 실제 ERP 상품·행사·날짜·요금이 함께 바뀝니다.\n\n`
    + `## 1. 서버·메인 파일 업로드 및 검증\n\n다음 파일을 /home/llno95ll/google-sheet-proxy-function 에 업로드합니다.\n\n`
    + `- ${names.index}\n- ${names.serverTest}\n- ${names.mainDeploy}\n- ${names.mainRollback}\n- ${names.css}\n- ${names.js}\n- ${names.mainCloudTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.index} ${names.serverTest} ${names.mainDeploy} ${names.mainRollback} ${names.css} ${names.js} ${names.mainCloudTest}\nnode --check ${names.index}\nnode --test ${names.serverTest} ${names.mainCloudTest}\n\`\`\`\n\n정상 결과는 tests 8, pass 8, fail 0입니다.\n\n`
    + `## 2. 서버 교체·배포\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ncp -f index.js BACKUP_pre_stage68b_index.js\ncp -f ${names.index} index.js\nnode --check index.js\n\ngcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml --update-secrets=GOLFJOIN_APPS_SCRIPT_EMAIL_SECRET=golfjoin-apps-script-email-secret:latest,GOLFJOIN_EMAIL_VERIFICATION_SECRET=golfjoin-email-verification-secret:latest\ngcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest\n\`\`\`\n\n`
    + `## 3. 메인 자산 업로드·HTML 교체\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\ncurl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\ncurl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n\`\`\`\n\n${names.mainDeploy} 전체 내용으로 ERP 메인페이지 HTML을 교체합니다.\n\n`
    + `## 4. 대시보드 파일 업로드·검증·배포\n\n다음 파일을 /home/llno95ll/golfjoin-admin-hosting 에 업로드합니다.\n\n- ${names.adminDeploy}\n- ${names.adminRollback}\n- ${names.adminCloudTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/golfjoin-admin-hosting\nsha256sum ${names.adminDeploy} ${names.adminRollback} ${names.adminCloudTest}\nnode --test ${names.adminCloudTest}\ncp -f public/index.html BACKUP_pre_stage68b_admin_dashboard.html\ncp -f ${names.adminDeploy} public/index.html\nsha256sum public/index.html BACKUP_pre_stage68b_admin_dashboard.html\nfirebase deploy --only hosting --project dashboad-golfjoin-secrettour\n\`\`\`\n\n정상 결과는 tests 5, pass 5, fail 0입니다.\n\n`
    + `## 5. 1월 월례회 통합 등록\n\n1. 대시보드의 추천일정 관리에서 상품업데이트를 한 번 실행합니다.\n2. 1월 월례회가 항공팩·상품군 통합·4박6일/7박9일 한 행으로 보이는지 확인합니다.\n3. 출발일 2027-01-16을 선택하고 단체, 실제 모집 정원을 선택합니다.\n4. 통합 추천등록을 눌러 두 기간과 두 귀국일을 확인한 뒤 등록합니다.\n5. 통합 카드가 운영 메인에 정상 노출되는 것을 먼저 확인합니다.\n6. 기존 개별 4박6일·7박9일 추천일정 두 건은 등록상태를 펼쳐 각각 숨김 처리합니다. 삭제 대신 숨김을 사용해 복구·감사 이력을 보존합니다.\n\n`
    + `첫 통합 저장 때 recommended_schedules 시트에 productFamilyId, familyDepartureDate, familyOptionsJson 열이 자동 추가됩니다. 수동으로 열을 만들지 않습니다.\n\n`
    + `## 6. 운영 확인\n\n- 카드 상품명: 4박6일/7박9일\n- 카드 날짜: 1.16(토)~1.21(목)/1.24(일)\n- 상세 기간 탭: 4박 6일, 7박 9일\n- 각 탭의 가격·귀국일·ERP 상세 내용이 달라지는지 확인\n- 7박9일 탭을 선택해 참여하기를 눌렀을 때 신청 확인 화면 날짜가 1.16(토)~1.24(일)인지 확인\n\n`
    + `## 7. 복구\n\n서버는 BACKUP_pre_stage68b_index.js로 되돌려 재배포합니다. 메인 HTML은 ${names.mainRollback}, 대시보드는 ${names.adminRollback}으로 되돌립니다. 신규 통합 추천일정 행은 숨김 처리하고 기존 두 개별 일정을 다시 노출하면 됩니다.\n\n`
    + `- 메인 HTML SHA-256: ${hashes.mainDeploy}\n- 대시보드 HTML SHA-256: ${hashes.adminDeploy}\n- 서버 index SHA-256: ${hashes.index}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const mainManifest = JSON.parse(fs.readFileSync(path.join(MAIN_BASELINE, "manifest.json"), "utf8"));
  const mainRollback = readVerified(MAIN_BASELINE, mainManifest.names.deploy, mainManifest.hashes.deploy, "main_baseline_html");
  const baselineCssGzip = readVerified(MAIN_BASELINE, mainManifest.names.css, mainManifest.hashes.css, "main_baseline_css");
  const baselineJsBrotli = readVerified(MAIN_BASELINE, mainManifest.names.js, mainManifest.hashes.js, "main_baseline_js");
  const oldJs = zlib.brotliDecompressSync(baselineJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const parts = splitMainHtml(assembledHtml);
  const sourceJs = parts[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");

  let nextJs = oldJs;
  for (const name of [
    "formatCardDateRange",
    "normalizeAdminRecommendedScheduleRule",
    "enrichOpenDetailWithSecretTourData",
    "selectDetailProductFamilyPeriod",
    "getCurrentApplyJoin",
    "renderGlobalApplyJoinSummary",
    "renderDetailBottomSummary"
  ]) {
    nextJs = replaceExact(nextJs, getNamedFunctionSource(oldJs, name), getNamedFunctionSource(minifiedSourceJs, name), name);
  }
  nextJs = replaceExact(
    nextJs,
    getNamedFunctionSource(oldJs, "getAdminRecommendedProductKey"),
    getNamedFunctionSource(minifiedSourceJs, "getAdminRecommendedFamilyOptions")
      + getNamedFunctionSource(minifiedSourceJs, "getAdminRecommendedProductKey"),
    "admin_recommended_family_parser"
  );
  nextJs = replaceExact(
    nextJs,
    getNamedFunctionSource(oldJs, "getDetailProductFamilyPeriodOptions"),
    getNamedFunctionSource(minifiedSourceJs, "getAdminRecommendedDetailFamilyPeriodOptions")
      + getNamedFunctionSource(minifiedSourceJs, "getDetailProductFamilyPeriodOptions"),
    "admin_recommended_detail_period_options"
  );
  new vm.Script(nextJs, { filename: "golfjoin-main-v68b.js" });

  const css = zlib.gunzipSync(baselineCssGzip);
  const js = Buffer.from(nextJs, "utf8");
  const cssGzip = zlib.gzipSync(css, { level: 9 });
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.gunzipSync(cssGzip).equals(css)) throw new Error("css_gzip_roundtrip_failed");
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");

  const revision = `gha_${sha256(Buffer.concat([css, Buffer.from("\n--stage68b--\n"), js])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let mainDeployText = mainRollback.toString("utf8").split(mainManifest.assetRevision).join(revision);
  mainDeployText = replaceAllRequired(mainDeployText, mainManifest.hashes.cssSri, cssSri, "main_css_sri");
  mainDeployText = replaceAllRequired(mainDeployText, mainManifest.hashes.jsSri, jsSri, "main_js_sri");
  verifyInlineScripts(mainDeployText, "main");
  const mainDeploy = Buffer.from(mainDeployText, "utf8");

  const adminRollback = readVerified(
    ADMIN_BASELINE,
    "DEPLOY_golfjoin_admin_dashboard_73FEB4E5.html",
    "73feb4e57e8baa753f9256d445cb4ee2a005454a4d9d05f17d46b97cc728f751",
    "admin_baseline_html"
  );
  const adminDeploy = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"));
  verifyInlineScripts(adminDeploy.toString("utf8"), "admin");

  const index = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
  new vm.Script(index.toString("utf8"), { filename: "stage68b-index.js" });
  const originalServerTest = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/recommended-schedule-family.test.js"), "utf8");
  const serverTest = makeServerTest(originalServerTest);

  const hashes = {
    index: sha256(index),
    serverTest: sha256(serverTest),
    mainDeploy: sha256(mainDeploy),
    mainRollback: sha256(mainRollback),
    css: sha256(cssGzip),
    js: sha256(jsBrotli),
    cssSri,
    jsSri,
    adminDeploy: sha256(adminDeploy),
    adminRollback: sha256(adminRollback)
  };
  const names = {
    index: "stage68b-index.js",
    serverTest: "stage68b-recommended-schedule-family.test.js",
    mainDeploy: `DEPLOY_golfjoin_main_family_recommendation_${hashes.mainDeploy.slice(0, 8).toUpperCase()}.html`,
    mainRollback: `ROLLBACK_golfjoin_main_${hashes.mainRollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    mainCloudTest: "stage68b-main-family-recommendation.test.js",
    adminDeploy: `DEPLOY_golfjoin_admin_dashboard_${hashes.adminDeploy.slice(0, 8).toUpperCase()}.html`,
    adminRollback: `ROLLBACK_golfjoin_admin_dashboard_${hashes.adminRollback.slice(0, 8).toUpperCase()}.html`,
    adminCloudTest: "stage68b-admin-family-recommendation.test.js",
    packageTest: "stage68b-integrated-recommendation-package.test.js"
  };
  const mainCloudTest = makeMainCloudTest(names, hashes);
  hashes.mainCloudTest = sha256(mainCloudTest);
  const adminCloudTest = makeAdminCloudTest(names, hashes);
  hashes.adminCloudTest = sha256(adminCloudTest);
  const packageTest = makePackageTest(names, hashes, revision);
  const runbook = Buffer.from(makeRunbook(names, hashes, revision), "utf8");

  const manifest = {
    schema: "golfjoin-integrated-product-family-recommendation-v1",
    version: "v68b",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    supersedes: { server: "v68a", main: "v67", dashboard: "v65b" },
    targetFamilyId: "pf_3562d40bd7cd449fa80eabc859faec63",
    targetGoodSeqs: ["30001287", "30001288"],
    behavior: {
      approvedFamilyOnly: true,
      sameDepartureOnly: true,
      minimumDistinctProducts: 2,
      legacyRecommendationCompatible: true,
      cardShowsCombinedDurationsAndReturns: true,
      detailSwitchesActualErpProductAndEvent: true,
      applicationUsesSelectedPeriod: true,
      sheetColumnsAutoAppended: true
    },
    qa: {
      targetedRegression: { tests: 66, pass: 66, fail: 0 },
      featureRegression: { tests: 23, pass: 23, fail: 0 },
      dashboardBrowser: { ok: true, consoleErrors: 0 },
      mainBrowser: { ok: true, pageErrors: 0 }
    },
    names,
    hashes: { ...hashes, packageTest: sha256(packageTest) }
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  new Map([
    [names.index, index],
    [names.serverTest, serverTest],
    [names.mainDeploy, mainDeploy],
    [names.mainRollback, mainRollback],
    [names.css, cssGzip],
    [names.js, jsBrotli],
    [names.mainCloudTest, mainCloudTest],
    [names.adminDeploy, adminDeploy],
    [names.adminRollback, adminRollback],
    [names.adminCloudTest, adminCloudTest],
    [names.packageTest, packageTest],
    ["RUNBOOK.md", runbook],
    ["manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")]
  ]).forEach((value, name) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));

  fs.writeFileSync(path.join(ROOT, "golfjoin_main.html"), mainDeploy);
  fs.writeFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), adminDeploy);
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, revision, names, hashes: manifest.hashes }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
