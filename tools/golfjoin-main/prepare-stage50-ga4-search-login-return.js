"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage50-ga4/golfjoin-ga4-attribution-normalization-20260901-v50b");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage50-ga4/golfjoin-ga4-search-login-return-20260901-v50a/DEPLOY_golfjoin_main_ga4_search_login_return_66B3EF50.html"
);
const JAVASCRIPT_BUDGET = 216 * 1024;
const RESERVED_WORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "implements", "import", "in", "instanceof",
  "interface", "let", "new", "null", "package", "private", "protected", "public",
  "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "yield"
]);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const read = (target) => fs.readFileSync(target);

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
  if (!handlerNames.length) return "";
  return `\n;/* golfjoin-inline-handler-bridge */${handlerNames
    .map((name) => `typeof ${name}==="function"&&(window[${JSON.stringify(name)}]=${name});`)
    .join("")}\n`;
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const sourceManifest = JSON.parse(read(SOURCE_MANIFEST).toString("utf8"));
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => /^source\/scripts\/.+\.js$/.test(value));
  const rawJs = Buffer.concat(scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath))));
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v50b.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v50b.min.js" });

  [
    "G-LLY6DLP23E",
    "golfjoin_destination_search_open",
    "golfjoin_destination_search_submit",
    "destination_search",
    "select_item",
    "view_item",
    "golfjoin_login_required",
    "golfjoin_login_start",
    "golfjoin_login_return_complete",
    "return_action",
    "trackJoinLoginReturnComplete",
    "getRegionSearchGa4SourceArea",
    "source_area",
    "result_count_bucket",
    "singleRoomSurcharge"
  ].forEach((needle) => {
    if (!js.includes(Buffer.from(needle))) throw new Error(`ga4_contract_missing:${needle}`);
  });

  const assetRevision = `gha_${sha256(Buffer.concat([
    js,
    Buffer.from("\n--stage50b-ga4-attribution-normalization--\n")
  ])).slice(0, 24)}`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  const scriptPattern = /(<script\s+src=")https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[a-f0-9]+\/golfjoin-main\.js("\s+integrity=")[^"]+("[^>]*>)/;
  if (!scriptPattern.test(rollbackHtml.toString("utf8"))) throw new Error("rollback_javascript_asset_reference_missing");
  const deployHtml = Buffer.from(
    rollbackHtml.toString("utf8").replace(
      scriptPattern,
      `$1https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}$2${sriSha256(js)}$3`
    ),
    "utf8"
  );

  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_ga4_attribution_normalization_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    packageTest: "stage50b-ga4-attribution-normalization.test.js"
  };
  const buffers = { deployHtml, rollbackHtml, js: jsBrotli };
  buffers.packageTest = Buffer.from([
    '"use strict";',
    "",
    'const assert = require("node:assert/strict");',
    'const crypto = require("node:crypto");',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const test = require("node:test");',
    'const vm = require("node:vm");',
    'const zlib = require("node:zlib");',
    "",
    `const compressed = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.js)}));`,
    'const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");',
    'const js = zlib.brotliDecompressSync(compressed).toString("utf8");',
    "",
    'test("v50b Cloud Shell 압축 자산 해시가 일치한다", () => {',
    `  assert.equal(sha256(compressed), ${JSON.stringify(sha256(jsBrotli))});`,
    "});",
    "",
    'test("v50b JavaScript 문법과 검색 귀속 정규화 계약을 보존한다", () => {',
    '  new vm.Script(js, { filename: "golfjoin-main.v50b.js" });',
    '  ["golfjoin_destination_search_open", "golfjoin_destination_search_submit", "getRegionSearchGa4SourceArea", "destination_search", "select_item", "view_item", "result_count_bucket"].forEach((value) => assert.match(js, new RegExp(value)));',
    "});",
    "",
    'test("v50b 로그인 요구와 복귀 완료 추적을 유지한다", () => {',
    '  ["golfjoin_login_required", "golfjoin_login_start", "golfjoin_login_return_complete", "return_action", "trackJoinLoginReturnComplete"].forEach((value) => assert.match(js, new RegExp(value)));',
    '  assert.match(js, /source_area/);',
    "});",
    "",
    'test("v50b는 기존 내부 퍼널과 외화 싱글차지 안전 처리를 유지한다", () => {',
    '  ["golfjoin_apply_step_view", "golfjoin_create_step_view", "apply_step", "builder_step", "singleRoomSurcharge"].forEach((value) => assert.match(js, new RegExp(value)));',
    "});",
    ""
  ].join("\n"), "utf8");

  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "js"
      ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) }
      : {})
  ]));
  const manifest = {
    schema: "golfjoin-stage50b-ga4-attribution-normalization-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    cmsRevision: 29,
    assetRevision,
    analytics: { measurementId: "G-LLY6DLP23E", propertyId: "552152254" },
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      searchResultDetailSourceAreaPreserved: true,
      mdPickSearchResultDetailSourceAreaPreserved: true,
      loginReturnCompleteAdded: true,
      failedReturnExcluded: true,
      returnActionPreserved: true,
      loggedOutMemberStateOverridesStaleSession: true,
      mainSearchSourceAreaNormalized: true,
      piiAllowlistPreserved: true,
      v47aInternalFunnelsPreserved: true,
      v48aSingleRoomCurrencyPreserved: true,
      serverRedeployRequired: false,
      cssRedeployRequired: false,
      dashboardRedeployRequired: false,
      ga4CustomDefinitionsRequired: []
    },
    assets: { jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v50b GA4 회원상태·검색 출처 정규화",
    "",
    "이번 변경은 JavaScript와 ERP HTML만 교체합니다. 서버·CSS·관리자 대시보드는 배포하지 않습니다.",
    "",
    "## Cloud Shell 업로드 파일",
    "",
    `- ${names.js}`,
    `- ${names.packageTest}`,
    "",
    "## 검증·업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.js} ${names.packageTest}`,
    `node --test ${names.packageTest}`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"`,
    `curl -sSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## HTML 교체",
    "",
    `ERP 29번 HTML 전체를 \`${names.deployHtml}\` 내용으로 교체합니다.`,
    "",
    "## 운영 확인",
    "",
    "1. 로그아웃 상태에서 새 모임 만들기를 누르고 `golfjoin_login_required`의 `member_state=guest`를 확인합니다.",
    "2. 로그인 완료 뒤 `golfjoin_login_return_complete`, `return_action=builder`, `member_state=kakao`를 확인합니다.",
    "3. 메인 여행지 검색에서 `golfjoin_destination_search_open`과 `golfjoin_destination_search_submit`이 모두 `source_area=main`인지 확인합니다.",
    "4. 신규 GA4 맞춤 정의는 만들지 않습니다.",
    "",
    "## 복구",
    "",
    `문제가 있으면 ERP HTML을 \`${names.rollbackHtml}\` 내용으로 되돌립니다.`,
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(OUTPUT, { recursive: true });
  Object.entries(buffers).forEach(([key, buffer]) => fs.writeFileSync(path.join(OUTPUT, names[key]), buffer, { flag: "wx" }));
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ output: OUTPUT, manifest }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
