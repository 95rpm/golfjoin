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
const BASELINE = path.join(
  ROOT,
  "deploy/stage68-product-family-airpack/recommendation-layout-participant-first-load-20260915-v68d"
);
const OUTPUT = path.join(
  ROOT,
  "deploy/stage68-product-family-airpack/monthly-participant-hydration-hotfix-20260915-v68g"
);

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

function makeCloudTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.deploy)}),rollback=read(${JSON.stringify(names.rollback)}),cssGz=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v68g 배포 파일 해시와 JavaScript 문법이 유효하다",()=>{assert.deepEqual({html:hash(html),rollback:hash(rollback),css:hash(cssGz),js:hash(jsBr)},${JSON.stringify({ html: hashes.deploy, rollback: hashes.rollback, css: hashes.css, js: hashes.js })});assert.doesNotThrow(()=>new vm.Script(js));assert.doesNotThrow(()=>zlib.gunzipSync(cssGz))});\n`
    + `test("v68g 상품 메타 보정은 같은 추천일정의 참여 상태를 승계한다",()=>{for(const value of ["sourceApplicationId","erpProductId","erpEventSeq","participantSummary","lightSummary","confirmedCount","currentCount","participantCount","emptySlots"])assert.ok(js.includes(value),value)});\n`
    + `test("v68g 다른 상품·행사에는 과거 참여 상태를 승계하지 않는다",()=>{for(const value of ["sourceApplicationId","erpProductId","erpEventSeq"])assert.ok(js.includes(value),value)});\n`
    + `test("v68g 통합 추천일정 기간은 상품군 카탈로그의 실제 골프 요약을 사용한다",()=>{for(const value of ["golfJoinProductFamilyById.get","?.members","getDetailProductFamilyGolfSummary("])assert.ok(js.includes(value),value)});\n`
    + `test("v68g 숨김 일정 제거와 통합 추천일정 기능을 유지한다",()=>{for(const value of ["isTruthyDisplayRuleValue","reconcileAdminRecommendedProducts","productFamilyId","familyOptions","selectDetailProductFamilyPeriod"])assert.ok(js.includes(value),value)});\n`,
    "utf8"
  );
}

function makePackageTest(names, hashes, revision) {
  const expected = {
    deploy: hashes.deploy,
    rollback: hashes.rollback,
    css: hashes.css,
    js: hashes.js,
    cloudTest: hashes.cloudTest
  };
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `test("v68g 전체 산출물 해시가 일치한다",()=>assert.deepEqual({deploy:hash(read(${JSON.stringify(names.deploy)})),rollback:hash(read(${JSON.stringify(names.rollback)})),css:hash(read(${JSON.stringify(names.css)})),js:hash(read(${JSON.stringify(names.js)})),cloudTest:hash(read(${JSON.stringify(names.cloudTest)}))},${JSON.stringify(expected)}));\n`
    + `test("v68g HTML은 새 불변 자산과 SRI를 참조한다",()=>{const html=read(${JSON.stringify(names.deploy)}).toString("utf8");assert.ok(html.includes(${JSON.stringify(revision)}));assert.ok(html.includes(${JSON.stringify(hashes.cssSri)}));assert.ok(html.includes(${JSON.stringify(hashes.jsSri)}))});\n`
    + `test("v68g 압축 자산이 정상 해제·파싱된다",()=>{assert.doesNotThrow(()=>zlib.gunzipSync(read(${JSON.stringify(names.css)})));assert.doesNotThrow(()=>new vm.Script(zlib.brotliDecompressSync(read(${JSON.stringify(names.js)})).toString("utf8")))});\n`,
    "utf8"
  );
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 68g - 월례회 최초 인원 및 통합 기간 골프 요약 핫픽스\n\n`
    + `캐시 없는 최초 접속에서 추천 상품 이미지 보정이 끝날 때 이미 적용된 참여 요약을 지우던 경합을 수정합니다. 같은 추천일정 ID·ERP 상품·행사번호가 모두 일치할 때만 참여 요약과 잔여석을 승계합니다. 통합 추천일정 기간은 승인 상품군 카탈로그에 저장된 실제 골프 일정 요약을 사용합니다. 서버 함수와 CSS는 변경하지 않습니다.\n\n`
    + `## 업로드·검증\n\n/home/llno95ll/google-sheet-proxy-function 에 다음 파일을 업로드합니다.\n\n- ${names.deploy}\n- ${names.rollback}\n- ${names.css}\n- ${names.js}\n- ${names.cloudTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.deploy} ${names.rollback} ${names.css} ${names.js} ${names.cloudTest}\nnode --test ${names.cloudTest}\ngzip -t ${names.css}\nnode -e 'const fs=require("node:fs"),vm=require("node:vm"),z=require("node:zlib");new vm.Script(z.brotliDecompressSync(fs.readFileSync("${names.js}")).toString("utf8"));console.log("PASS: v68g 메인 JavaScript 확인 완료")'\n\`\`\`\n\n`
    + `## 불변 자산 업로드\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\n\`\`\`\n\n`
    + `${names.deploy} 전체 내용으로 ERP 편집기의 골프조인 메인 HTML을 직접 교체합니다. 서버 함수 재배포는 하지 않습니다.\n\n`
    + `## 운영 확인\n\n1. 시크릿 창 또는 사이트 데이터가 없는 새 브라우저에서 최초 접속합니다.\n2. 10월 월례회가 첫 화면부터 59/60명으로 유지되는지 확인합니다.\n3. 상품 이미지가 늦게 나타난 뒤에도 0/60명으로 되돌아가지 않는지 10초 이상 확인합니다.\n4. 1월 월례회는 통합 카드 한 건만 보이는지 확인합니다.\n\n`
    + `## 복구\n\n${names.rollback} 전체 내용으로 ERP 편집기 HTML을 되돌립니다. 새 자산은 불변 URL이므로 삭제하지 않습니다.\n\n`
    + `- 메인 HTML SHA-256: ${hashes.deploy}\n- 메인 JS SHA-256: ${hashes.js}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const manifest = JSON.parse(fs.readFileSync(path.join(BASELINE, "manifest.json"), "utf8"));
  const rollback = readVerified(BASELINE, manifest.names.mainDeploy, manifest.hashes.mainDeploy, "baseline_html");
  const cssGzip = readVerified(BASELINE, manifest.names.css, manifest.hashes.css, "baseline_css");
  const oldJsBrotli = readVerified(BASELINE, manifest.names.js, manifest.hashes.js, "baseline_js");
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const parts = splitMainHtml(assembledHtml);
  const sourceJs = parts[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");
  let nextJsText = replaceExact(
    oldJs,
    getNamedFunctionSource(oldJs, "applyAdminRecommendedScheduleRows"),
    getNamedFunctionSource(minifiedSourceJs, "applyAdminRecommendedScheduleRows"),
    "admin_recommended_participant_hydration"
  );
  nextJsText = replaceExact(
    nextJsText,
    getNamedFunctionSource(nextJsText, "getAdminRecommendedDetailFamilyPeriodOptions"),
    getNamedFunctionSource(minifiedSourceJs, "getAdminRecommendedDetailFamilyPeriodOptions"),
    "admin_recommended_family_golf_summary"
  );
  new vm.Script(nextJsText, { filename: "golfjoin-main-v68g.js" });
  const js = Buffer.from(nextJsText, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");
  const css = zlib.gunzipSync(cssGzip);

  const revision = `gha_${sha256(Buffer.concat([css, Buffer.from("\n--stage68g--\n"), js])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let deployText = rollback.toString("utf8").split(manifest.assetRevision).join(revision);
  deployText = replaceAllRequired(deployText, manifest.hashes.cssSri, cssSri, "css_sri");
  deployText = replaceAllRequired(deployText, manifest.hashes.jsSri, jsSri, "js_sri");
  verifyInlineScripts(deployText, "main");
  const deploy = Buffer.from(deployText, "utf8");

  const hashes = {
    deploy: sha256(deploy),
    rollback: sha256(rollback),
    css: sha256(cssGzip),
    js: sha256(jsBrotli),
    cssSri,
    jsSri
  };
  const names = {
    deploy: `DEPLOY_golfjoin_main_monthly_participant_hydration_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    cloudTest: "stage68g-main-monthly-participant-hydration.test.js",
    packageTest: "stage68g-monthly-participant-hydration-package.test.js"
  };
  const cloudTest = makeCloudTest(names, hashes);
  hashes.cloudTest = sha256(cloudTest);
  const packageTest = makePackageTest(names, hashes, revision);
  hashes.packageTest = sha256(packageTest);

  const outputManifest = {
    schema: "golfjoin-monthly-participant-hydration-hotfix-v1",
    version: "v68g",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    scope: "main-assets-no-server",
    assetRevision: revision,
    behavior: {
      preservesParticipantSummaryDuringProductHydration: true,
      requiresExactScheduleProductEventIdentity: true,
      removesHiddenLegacyRecommendationsWhenAuthoritativeRowsArrive: true,
      integratedRecommendationMaintained: true,
      integratedPeriodGolfSummaryUsesApprovedFamilyCatalog: true
    },
    names,
    hashes
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  [
    [names.deploy, deploy],
    [names.rollback, rollback],
    [names.css, cssGzip],
    [names.js, jsBrotli],
    [names.cloudTest, cloudTest],
    [names.packageTest, packageTest],
    ["RUNBOOK.md", Buffer.from(makeRunbook(names, hashes, revision), "utf8")],
    ["manifest.json", Buffer.from(`${JSON.stringify(outputManifest, null, 2)}\n`, "utf8")]
  ].forEach(([name, value]) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));

  fs.writeFileSync(path.join(ROOT, "golfjoin_main.html"), deploy);
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, revision, names, hashes }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
