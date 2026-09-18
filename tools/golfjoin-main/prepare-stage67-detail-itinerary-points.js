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
const BASELINE = path.join(ROOT, "deploy/stage66-airpack-thumbnail/authoritative-age-composition-20260915-v66d");
const OUTPUT = path.join(ROOT, "deploy/stage67-detail-itinerary/li-points-20260915-v67");

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

function getCssRule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{[^}]*\\}`).exec(source);
  if (!match) throw new Error(`css_rule_missing:${selector}`);
  return match[0];
}

function verifyInlineScripts(html) {
  [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim())
    .forEach((source, index) => new vm.Script(source, { filename: `main-inline-${index + 1}.js` }));
}

function makeCloudTest(names, hashes, contracts) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),cssGz=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),meta=read(${JSON.stringify(names.meta)}),contractsFile=read(${JSON.stringify(names.contracts)}),schema=read(${JSON.stringify(names.schema)}),css=zlib.gunzipSync(cssGz).toString("utf8"),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v67 업로드 파일 해시와 JavaScript 문법이 유효하다",()=>{assert.deepEqual({css:hash(cssGz),js:hash(jsBr),meta:hash(meta),contracts:hash(contractsFile),schema:hash(schema)},${JSON.stringify({ css: hashes.css, js: hashes.js, meta: hashes.meta, contracts: hashes.contracts, schema: hashes.schema })});assert.doesNotThrow(()=>new vm.Script(js));assert.doesNotThrow(()=>new vm.Script(meta.toString("utf8")));assert.doesNotThrow(()=>new vm.Script(contractsFile.toString("utf8")))});\n`
    + `test("v67 일정은 원본 li points만 포인트 단위로 사용한다",()=>{for(const value of ${JSON.stringify(contracts.client)})assert.ok(js.includes(value),value);for(const value of ["및","__SCHEDULE_SLASH__"])assert.equal(${JSON.stringify(contracts.split)}.includes(value),false,value)});\n`
    + `test("v67 li 내부 br은 한 포인트 안의 줄바꿈으로 보존한다",()=>{assert.ok(js.includes(${JSON.stringify(contracts.parser)}));assert.match(css,/\\.detail-schedule-point\\s*\\{[^}]*white-space:\\s*pre-line;/s)});\n`
    + `test("v67 세로선은 늘어난 포인트 높이를 따라간다",()=>{assert.match(css,/\\.detail-schedule-point:not\\(:last-child\\)::after\\s*\\{[^}]*top:\\s*19px;[^}]*bottom:\\s*-14px;/s)});\n`
    + `test("v67 서버 스냅샷과 계약은 points 배열을 포함한다",()=>{assert.ok(meta.toString("utf8").includes("points: Array.isArray(item.points) ? item.points : []"));assert.equal(JSON.parse(schema).$defs.scheduleDay.properties.points.type,"array");assert.ok(contractsFile.toString("utf8").includes("day.points"))});\n`;
}

function makePackageTest(names, hashes, revision) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.deploy)}),rollback=read(${JSON.stringify(names.rollback)}),css=read(${JSON.stringify(names.css)}),js=read(${JSON.stringify(names.js)}),meta=read(${JSON.stringify(names.meta)}),contracts=read(${JSON.stringify(names.contracts)}),schema=read(${JSON.stringify(names.schema)}),serverTest=read(${JSON.stringify(names.serverTest)});\n`
    + `test("v67 산출물 해시가 일치한다",()=>{assert.deepEqual({deploy:hash(html),rollback:hash(rollback),css:hash(css),js:hash(js),meta:hash(meta),contracts:hash(contracts),schema:hash(schema),serverTest:hash(serverTest)},${JSON.stringify({ deploy: hashes.deploy, rollback: hashes.rollback, css: hashes.css, js: hashes.js, meta: hashes.meta, contracts: hashes.contracts, schema: hashes.schema, serverTest: hashes.serverTest })})});\n`
    + `test("v67 HTML과 배포 JavaScript 문법이 유효하다",()=>{const value=html.toString("utf8"),source=zlib.brotliDecompressSync(js).toString("utf8");assert.ok(value.includes(${JSON.stringify(revision)}));assert.ok(value.includes(${JSON.stringify(hashes.cssSri)}));assert.ok(value.includes(${JSON.stringify(hashes.jsSri)}));assert.doesNotThrow(()=>new vm.Script(source))});\n`
    + `test("v67은 v66d 전체 참여자 연령·잔여석 수정을 유지한다",()=>{const source=zlib.brotliDecompressSync(js).toString("utf8");for(const value of ["ageDecadeCounts","getJoinAuthoritativeConfirmedCount","중심 참여자 구성"])assert.ok(source.includes(value),value)});\n`
    + `test("v67 복구본은 운영 확인된 v66d이다",()=>assert.equal(hash(rollback),"c033a5c4a08a2da900d26e73de897cdf0dbb06e2d6695a97068b1710bc61aa76"));\n`;
}

function makeRunbook(names, hashes, revision) {
  const uploads = [names.meta, names.contracts, names.schema, names.serverTest, names.css, names.js, names.cloudTest];
  return `# Stage 67 - 상품상세 일정표 li 기준 분리\n\n`
    + `각 일차의 원본 <li> 하나를 detail-schedule-point 하나로 유지하고, <li> 내부 <br>만 같은 포인트 안에서 줄바꿈합니다. 쉼표·및·슬래시·가운데점은 더 이상 분리 기준이 아닙니다.\n\n`
    + `## 1. Cloud Shell 업로드·검증\n\n아래 7개 파일을 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다.\n\n${uploads.map((name) => `- ${name}`).join("\n")}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${uploads.join(" ")}\nnode --check ${names.meta}\nnode --check ${names.contracts}\nnode --test ${names.serverTest} ${names.cloudTest}\n\`\`\`\n\n정상 결과는 tests 10, pass 10, fail 0입니다.\n\n`
    + `## 2. 서버 모듈 교체·배포\n\n\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ncp -f product-detail-meta.js BACKUP_pre_stage67_product-detail-meta.js\ncp -f data-contracts.js BACKUP_pre_stage67_data-contracts.js\ncp -f contracts/product-detail-snapshot-v1.schema.json BACKUP_pre_stage67_product-detail-snapshot-v1.schema.json\ncp -f ${names.meta} product-detail-meta.js\ncp -f ${names.contracts} data-contracts.js\ncp -f ${names.schema} contracts/product-detail-snapshot-v1.schema.json\nnode --check product-detail-meta.js\nnode --check data-contracts.js\n\ngcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml --update-secrets=GOLFJOIN_APPS_SCRIPT_EMAIL_SECRET=golfjoin-apps-script-email-secret:latest,GOLFJOIN_EMAIL_VERIFICATION_SECRET=golfjoin-email-verification-secret:latest\ngcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest\n\`\`\`\n\n`
    + `## 3. 상품상세 스냅샷 재생성\n\n서버 배포 후 관리자 대시보드의 **추천일정 관리 > 상품업데이트**를 한 번 실행합니다. 이 단계가 새 points 배열을 포함한 상세 스냅샷을 발행합니다.\n\n`
    + `## 4. GCS 자산 업로드\n\n\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\ncurl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\ncurl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n\`\`\`\n\n`
    + `## 5. ERP HTML 교체\n\n${names.deploy} 전체 내용으로 메인페이지 HTML을 교체합니다.\n\n`
    + `## 6. 운영 확인\n\n1. 쉼표·및·슬래시·가운데점이 포함된 한 <li>가 하나의 점으로 표시되는지 확인합니다.\n2. <li> 내부 <br>만 같은 점 안에서 줄바꿈되는지 확인합니다.\n3. 줄바꿈 높이만큼 다음 점까지의 세로선이 이어지는지 확인합니다.\n\n`
    + `## 7. 복구\n\n서버 모듈은 BACKUP_pre_stage67_* 파일로 되돌린 후 재배포하고, HTML은 ${names.rollback}으로 되돌립니다. GCS 불변 객체는 삭제하지 않습니다.\n\n`
    + `- 배포 HTML SHA-256: ${hashes.deploy}\n- CSS SHA-256: ${hashes.css}\n- JS SHA-256: ${hashes.js}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(BASELINE, "manifest.json"), "utf8"));
  const rollback = readVerified(BASELINE, manifest.names.deploy, manifest.hashes.deploy, "baseline_html");
  const baselineCssGzip = readVerified(BASELINE, manifest.names.css, manifest.hashes.css, "baseline_css");
  const baselineJsBrotli = readVerified(BASELINE, manifest.names.js, manifest.hashes.js, "baseline_js");
  const oldCss = zlib.gunzipSync(baselineCssGzip).toString("utf8");
  const oldJs = zlib.brotliDecompressSync(baselineJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const parts = splitMainHtml(assembledHtml);
  const sourceCss = parts[1].toString("utf8");
  const sourceJs = parts[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");

  const oldSplit = getNamedFunctionSource(oldJs, "splitScheduleItems");
  const newScheduleHelpers = [
    "normalizeDetailSchedulePointText",
    "splitScheduleItems",
    "getDetailSchedulePoints"
  ].map((name) => getNamedFunctionSource(minifiedSourceJs, name)).join("");
  let nextJs = replaceExact(oldJs, oldSplit, newScheduleHelpers, "schedule_helpers");
  for (const name of ["renderDetailSchedule", "parseSecretTourSchedule", "validateGolfJoinPublicDetailSnapshot"]) {
    nextJs = replaceExact(nextJs, getNamedFunctionSource(oldJs, name), getNamedFunctionSource(minifiedSourceJs, name), name);
  }
  new vm.Script(nextJs, { filename: "golfjoin-main-v67.js" });

  const oldPointRule = getCssRule(oldCss, ".detail-schedule-point");
  const newPointRule = getCssRule(sourceCss, ".detail-schedule-point");
  const nextCss = replaceExact(oldCss, oldPointRule, newPointRule, "schedule_point_css");
  const css = Buffer.from(nextCss, "utf8");
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

  const revision = `gha_${sha256(Buffer.concat([css, Buffer.from("\n--stage67--\n"), js])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let deployText = rollback.toString("utf8").split(manifest.assetRevision).join(revision);
  deployText = replaceAllRequired(deployText, manifest.hashes.cssSri, cssSri, "html_css_sri");
  deployText = replaceAllRequired(deployText, manifest.hashes.jsSri, jsSri, "html_js_sri");
  verifyInlineScripts(deployText);
  const deploy = Buffer.from(deployText, "utf8");

  const meta = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/product-detail-meta.js"));
  const contracts = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/data-contracts.js"));
  const schema = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/contracts/product-detail-snapshot-v1.schema.json"));
  for (const [name, value] of [["meta", meta], ["contracts", contracts]]) {
    new vm.Script(value.toString("utf8"), { filename: `stage67-${name}.js` });
  }
  const originalServerTest = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/product-detail-meta.test.js"), "utf8");
  const stagedServerTest = Buffer.from(
    replaceExact(originalServerTest, 'require("./product-detail-meta")', 'require("./stage67-product-detail-meta")', "server_test_meta_import"),
    "utf8"
  );

  const hashes = {
    deploy: sha256(deploy),
    rollback: sha256(rollback),
    css: sha256(cssGzip),
    js: sha256(jsBrotli),
    meta: sha256(meta),
    contracts: sha256(contracts),
    schema: sha256(schema),
    serverTest: sha256(stagedServerTest),
    cssSri,
    jsSri
  };
  const names = {
    deploy: `DEPLOY_golfjoin_main_itinerary_li_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    meta: "stage67-product-detail-meta.js",
    contracts: "stage67-data-contracts.js",
    schema: "stage67-product-detail-snapshot-v1.schema.json",
    serverTest: "stage67-product-detail-meta.test.js",
    cloudTest: "stage67-itinerary-cloudshell.test.js",
    packageTest: "stage67-itinerary-package.test.js"
  };
  const functionContracts = {
    client: ["function getDetailSchedulePoints", ".points", "splitScheduleItems(e.content)"],
    split: getNamedFunctionSource(minifiedSourceJs, "splitScheduleItems"),
    parser: getNamedFunctionSource(minifiedSourceJs, "parseSecretTourSchedule")
  };
  const cloudTest = Buffer.from(makeCloudTest(names, hashes, functionContracts), "utf8");
  const packageTest = Buffer.from(makePackageTest(names, hashes, revision), "utf8");
  const runbook = Buffer.from(makeRunbook(names, hashes, revision), "utf8");
  const outputManifest = {
    schema: "golfjoin-detail-itinerary-li-points-v1",
    version: "v67",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    supersedes: "v66d",
    behavior: {
      onePointPerSourceListItem: true,
      punctuationSplittingRemoved: true,
      lineBreakInsidePointPreserved: true,
      verticalLineFollowsPointHeight: true,
      legacyContentRenderedAsSinglePoint: true
    },
    names,
    hashes
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  new Map([
    [names.deploy, deploy],
    [names.rollback, rollback],
    [names.css, cssGzip],
    [names.js, jsBrotli],
    [names.meta, meta],
    [names.contracts, contracts],
    [names.schema, schema],
    [names.serverTest, stagedServerTest],
    [names.cloudTest, cloudTest],
    [names.packageTest, packageTest],
    ["RUNBOOK.md", runbook]
  ]).forEach((value, name) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(outputManifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(ROOT, "golfjoin_main.html"), deploy);
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, revision, names, hashes }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
