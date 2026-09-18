"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const BASE = path.join(ROOT, "deploy/stage57-ga4-insights");
const API_OUTPUT = path.join(BASE, "ga4-insight-reliability-api-20260902-v57a");
const ADMIN_OUTPUT = path.join(BASE, "ga4-insight-reliability-admin-20260902-v57b");
const MAIN_OUTPUT = path.join(BASE, "ga4-apply-complete-tracking-20260902-v57c");
const API_ROLLBACK = path.join(ROOT, "deploy/stage54-ga4-dashboard/ga4-analysis-readiness-api-20260901-v54a/DEPLOY_ga4-admin-analytics_382D554D.js");
const ADMIN_ROLLBACK = path.join(ROOT, "deploy/stage54-ga4-dashboard/ga4-analysis-readiness-admin-20260901-v54b/DEPLOY_golfjoin_admin_dashboard_161061C3.html");
const MAIN_ROLLBACK = path.join(ROOT, "deploy/stage56-kakao-signup/kakao-signup-latency-20260902-v56b/DEPLOY_golfjoin_main_kakao_signup_latency_349C7263.html");
const JAVASCRIPT_BUDGET = 220 * 1024;
const RESERVED_WORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for", "function", "if", "implements", "import", "in", "instanceof", "interface", "let", "new", "null", "package", "private", "protected", "public", "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield"
]);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const read = (target) => fs.readFileSync(target);

function ensureOutput(target) {
  if (fs.existsSync(target)) throw new Error(`output_exists:${target}`);
  fs.mkdirSync(target, { recursive: true });
}

function write(target, fileName, value) {
  fs.writeFileSync(path.join(target, fileName), value);
  return { fileName, bytes: value.length, sha256: sha256(value) };
}

function collectInlineHandlerNames(...sources) {
  const names = new Set();
  const attributePattern = /\bon[a-z]+\s*=\s*["']([\s\S]*?)["']/gi;
  const callPattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (const input of sources) {
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(String(input || "")))) {
      let callMatch;
      while ((callMatch = callPattern.exec(attributeMatch[1]))) {
        if (!RESERVED_WORDS.has(callMatch[1])) names.add(callMatch[1]);
      }
    }
  }
  return [...names].sort();
}

function buildInlineHandlerBridge(handlerNames) {
  return handlerNames.length
    ? `\n;/* golfjoin-inline-handler-bridge */${handlerNames.map((name) => `typeof ${name}==="function"&&(window[${JSON.stringify(name)}]=${name});`).join("")}\n`
    : "";
}

function replaceJavascriptReference(html, objectName, integrity) {
  const pattern = /(<script\s+src=")https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[a-f0-9]+\/golfjoin-main\.js("\s+integrity=")[^"]+("[^>]*>)/;
  if (!pattern.test(html)) throw new Error("rollback_javascript_asset_reference_missing");
  return html.replace(pattern, `$1https://storage.googleapis.com/golfjoin-bucket/${objectName}$2${integrity}$3`);
}

function buildApiPackage() {
  ensureOutput(API_OUTPUT);
  const deploy = read(path.join(ROOT, "server/google-sheet-proxy-function/ga4-admin-analytics.js"));
  const rollback = read(API_ROLLBACK);
  const deployHash = sha256(deploy);
  const rollbackHash = sha256(rollback);
  const deployName = `DEPLOY_ga4-admin-analytics_${deployHash.slice(0, 8).toUpperCase()}.js`;
  const rollbackName = `ROLLBACK_ga4-admin-analytics_${rollbackHash.slice(0, 8).toUpperCase()}.js`;
  const sourceTest = read(path.join(ROOT, "server/google-sheet-proxy-function/ga4-admin-analytics.test.js")).toString("utf8");
  const deployTest = Buffer.from(sourceTest.replace('require("./ga4-admin-analytics")', `require("./${path.basename(deployName, ".js")}")`), "utf8");
  const deployTestName = `DEPLOY_ga4-admin-analytics_${sha256(deployTest).slice(0, 8).toUpperCase()}.test.js`;
  const contractName = "stage57a-ga4-insight-reliability-api.test.js";
  const contract = Buffer.from(`"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");
const file=(name)=>fs.readFileSync(path.join(__dirname,name)),hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
const deploy=file(${JSON.stringify(deployName)}),rollback=file(${JSON.stringify(rollbackName)}),source=deploy.toString("utf8");
test("v57a 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v57a 서버 JavaScript 문법이 유효하다",()=>assert.doesNotThrow(()=>new vm.Script(source)));
test("v57a 역전된 독립 집계를 실행 가능한 인사이트에서 제외한다",()=>{for(const value of ["sequenceMismatch","nonMonotonic","non_monotonic_active_users","independent_event_reach","actionable"])assert.ok(source.includes(value),value);});
test("v57a 이전 기간과 상품 섹션 품질 플래그를 제공한다",()=>{assert.match(source,/comparisonAvailable/);assert.match(source,/\"new_schedule\"/);});
`, "utf8");
  const files = {
    deploy: write(API_OUTPUT, deployName, deploy),
    rollback: write(API_OUTPUT, rollbackName, rollback),
    deployTest: write(API_OUTPUT, deployTestName, deployTest),
    contract: write(API_OUTPUT, contractName, contract)
  };
  const runbook = Buffer.from([
    "# v57a GA4 인사이트 신뢰도 API", "", "## 배포", "", "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "cp -f ga4-admin-analytics.js BACKUP_pre_stage57a_ga4-admin-analytics.js",
    `sha256sum ${deployName} ${rollbackName} ${deployTestName} ${contractName}`,
    `node --test ${deployTestName} ${contractName}`,
    `cp -f ${deployName} ga4-admin-analytics.js`,
    "node --check ga4-admin-analytics.js",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "gcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest",
    "gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(state,updateTime,serviceConfig.revision,serviceConfig.uri)'",
    "gcloud run services describe golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(status.latestCreatedRevisionName,status.latestReadyRevisionName,status.traffic)'",
    "```", "", "## 즉시 복구", "", "```bash",
    `cp -f ${rollbackName} ga4-admin-analytics.js`,
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "```", ""
  ].join("\n"), "utf8");
  files.runbook = write(API_OUTPUT, "RUNBOOK.md", runbook);
  fs.writeFileSync(path.join(API_OUTPUT, "manifest.json"), JSON.stringify({ schema: "golfjoin-stage57a-ga4-insight-reliability-api-v1", status: "ready-for-deploy", features: { nonMonotonicGuard: true, comparisonAvailability: true, productSectionOnly: true }, files }, null, 2));
  return { output: API_OUTPUT, files };
}

function buildAdminPackage() {
  ensureOutput(ADMIN_OUTPUT);
  const deploy = read(path.join(ROOT, "golfjoin_admin_dashboard.html"));
  const rollback = read(ADMIN_ROLLBACK);
  const deployHash = sha256(deploy);
  const rollbackHash = sha256(rollback);
  const deployName = `DEPLOY_golfjoin_admin_dashboard_${deployHash.slice(0, 8).toUpperCase()}.html`;
  const rollbackName = `ROLLBACK_golfjoin_admin_dashboard_${rollbackHash.slice(0, 8).toUpperCase()}.html`;
  const testName = "stage57b-ga4-insight-reliability-admin.test.js";
  const contract = Buffer.from(`"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");
const file=(name)=>fs.readFileSync(path.join(__dirname,name)),hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
const deploy=file(${JSON.stringify(deployName)}),rollback=file(${JSON.stringify(rollbackName)}),html=deploy.toString("utf8");
test("v57b 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v57b 인라인 JavaScript 문법이 유효하다",()=>{const start=html.indexOf("<script>"),end=html.lastIndexOf("</script>");assert.ok(start>=0&&end>start);assert.doesNotThrow(()=>new vm.Script(html.slice(start+8,end)));});
test("v57b 역전 진단과 잘못된 자동 권고 차단을 표시한다",()=>{for(const value of ["순차 비교 불가","analytics-funnel-diagnostic","searchFunnel.actionable !== false","loginReturnFunnel.actionable !== false"])assert.ok(html.includes(value),value);});
test("v57b 비교 데이터가 없으면 배지와 표 열을 숨기고 상태를 안내한다",()=>{assert.ok(html.includes("data.comparisonAvailable === true"));assert.ok(html.includes("if (previous === 0) return null;"));assert.ok(html.includes('comparisonAvailable ? "<th>이전 기간</th>" : ""'));assert.ok(html.includes("이전 기간 데이터 없음"));});
test("v57b 상품이 아닌 새 일정 CTA를 섹션 성과에서 제외한다",()=>{assert.match(html,/function isAnalyticsProductSection/);assert.match(html,/\"new_schedule\"/);});
`, "utf8");
  const files = {
    deploy: write(ADMIN_OUTPUT, deployName, deploy),
    rollback: write(ADMIN_OUTPUT, rollbackName, rollback),
    test: write(ADMIN_OUTPUT, testName, contract)
  };
  const runbook = Buffer.from([
    "# v57b GA4 인사이트 신뢰도 관리자 화면", "", "## 배포", "", "```bash",
    "cd /home/llno95ll/golfjoin-admin-hosting",
    "cp -f public/index.html BACKUP_pre_stage57b_admin_dashboard.html",
    `sha256sum ${deployName} ${rollbackName} ${testName}`,
    `node --test ${testName}`,
    `cp -f ${deployName} public/index.html`,
    "firebase deploy --only hosting --project dashboad-golfjoin-secrettour",
    "```", "", "## 즉시 복구", "", "```bash",
    `cp -f ${rollbackName} public/index.html`,
    "firebase deploy --only hosting --project dashboad-golfjoin-secrettour",
    "```", ""
  ].join("\n"), "utf8");
  files.runbook = write(ADMIN_OUTPUT, "RUNBOOK.md", runbook);
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "manifest.json"), JSON.stringify({ schema: "golfjoin-stage57b-ga4-insight-reliability-admin-v1", status: "ready-for-deploy", features: { diagnosticCopy: true, comparisonUiGuard: true, productSectionUiGuard: true }, files }, null, 2));
  return { output: ADMIN_OUTPUT, files };
}

async function buildMainPackage() {
  ensureOutput(MAIN_OUTPUT);
  const sourceManifest = JSON.parse(read(SOURCE_MANIFEST).toString("utf8"));
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => /^source\/scripts\/.+\.js$/.test(value));
  const rawSource = Buffer.concat(scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath)))).toString("utf8");
  const completionIndex = rawSource.indexOf('trackGolfJoinApplyStep("complete"');
  const businessIndex = rawSource.indexOf('"golfjoin_apply_complete"', completionIndex);
  if (completionIndex < 0 || businessIndex <= completionIndex) throw new Error("apply_complete_step_contract_missing");
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawSource);
  const bridged = `${rawSource}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v57c.source.js" });
  const minified = await terser.minify(bridged, { compress: { passes: 2, toplevel: false }, mangle: { toplevel: false, reserved: handlerNames }, format: { comments: false } });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v57c.min.js" });
  for (const value of ["golfjoin_apply_step_view", "golfjoin_apply_complete", "complete", "member_kakao_signup_complete"]) {
    if (!js.includes(Buffer.from(value))) throw new Error(`javascript_contract_missing:${value}`);
  }
  const assetRevision = `gha_${sha256(Buffer.concat([js, Buffer.from("\n--stage57c-ga4-apply-complete--\n")])).slice(0, 24)}`;
  const objectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollback = read(MAIN_ROLLBACK);
  const deploy = Buffer.from(replaceJavascriptReference(rollback.toString("utf8"), objectName, sriSha256(js)), "utf8");
  const compressed = zlib.brotliCompressSync(js, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } });
  if (compressed.length > JAVASCRIPT_BUDGET) throw new Error(`javascript_budget_exceeded:${compressed.length}`);
  const deployName = `DEPLOY_golfjoin_main_ga4_apply_complete_${sha256(deploy).slice(0, 8).toUpperCase()}.html`;
  const rollbackName = `ROLLBACK_golfjoin_main_${sha256(rollback).slice(0, 8).toUpperCase()}.html`;
  const uploadName = `UPLOAD_golfjoin-main_${sha256(compressed).slice(0, 8).toUpperCase()}.js.br`;
  const testName = "stage57c-ga4-apply-complete-tracking.test.js";
  const contract = Buffer.from(`"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");
const file=(name)=>fs.readFileSync(path.join(__dirname,name)),hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
const deploy=file(${JSON.stringify(deployName)}),rollback=file(${JSON.stringify(rollbackName)}),compressed=file(${JSON.stringify(uploadName)}),js=zlib.brotliDecompressSync(compressed).toString("utf8");
test("v57c 배포·복구·자산 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(sha256(deploy))});assert.equal(hash(rollback),${JSON.stringify(sha256(rollback))});assert.equal(hash(compressed),${JSON.stringify(sha256(compressed))});});
test("v57c JavaScript 문법과 완료 단계 계약이 유효하다",()=>{assert.doesNotThrow(()=>new vm.Script(js));assert.match(js,/golfjoin_apply_step_view/);assert.match(js,/golfjoin_apply_complete/);});
test("v57c HTML은 신규 불변 JavaScript와 SRI를 참조한다",()=>{assert.match(deploy.toString("utf8"),/${assetRevision}/);assert.match(deploy.toString("utf8"),/integrity="sha256-/);});
`, "utf8");
  const files = {
    deploy: write(MAIN_OUTPUT, deployName, deploy),
    rollback: write(MAIN_OUTPUT, rollbackName, rollback),
    upload: { ...write(MAIN_OUTPUT, uploadName, compressed), contentEncoding: "br", objectName, logicalSri: sriSha256(js) },
    test: write(MAIN_OUTPUT, testName, contract)
  };
  const runbook = Buffer.from([
    "# v57c 참여 신청 완료 단계 추적", "", "HTML은 서버에 업로드하지 않고 ERP 편집기에서 배포 HTML 내용으로 직접 교체합니다.", "", "## GCS 자산 업로드", "", "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${uploadName} ${testName}`,
    `node --test ${testName}`,
    `gcloud storage cp ${uploadName} gs://golfjoin-bucket/${objectName} --if-generation-match=0 --content-type=\"application/javascript; charset=utf-8\" --content-encoding=br --cache-control=\"public, max-age=31536000, immutable\"`,
    `curl -sSI -H \"Accept-Encoding: br\" https://storage.googleapis.com/golfjoin-bucket/${objectName}`,
    "```", "", "## HTML 직접 교체", "",
    `ERP 편집기에서 ${deployName} 전체 내용을 메인페이지 HTML로 교체합니다.`, "",
    "## 즉시 복구", "",
    `${rollbackName} 전체 내용을 ERP 편집기에 다시 저장합니다.`, ""
  ].join("\n"), "utf8");
  files.runbook = write(MAIN_OUTPUT, "RUNBOOK.md", runbook);
  fs.writeFileSync(path.join(MAIN_OUTPUT, "manifest.json"), JSON.stringify({ schema: "golfjoin-stage57c-ga4-apply-complete-tracking-v1", status: "ready-for-deploy", assetRevision, javascriptBudget: { bytes: compressed.length, limitBytes: JAVASCRIPT_BUDGET, passed: true }, assets: { objectName }, features: { applyStepCompleteEvent: true, existingBusinessCompleteEventPreserved: true }, files }, null, 2));
  return { output: MAIN_OUTPUT, files, assetRevision, objectName, javascriptBytes: compressed.length };
}

async function main() {
  if (fs.existsSync(BASE)) throw new Error(`output_exists:${BASE}`);
  const api = buildApiPackage();
  const admin = buildAdminPackage();
  const mainPackage = await buildMainPackage();
  process.stdout.write(`${JSON.stringify({ api, admin, main: mainPackage }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
