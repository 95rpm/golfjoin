"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage47-ga4/golfjoin-ga4-internal-funnel-steps-20260901-v47a");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage43-ga4/golfjoin-ga4-card-selection-hotfix-20260831-v43d/DEPLOY_golfjoin_main_ga4_card_selection_hotfix_49DC9398.html"
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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function read(target) {
  return fs.readFileSync(target);
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
  new vm.Script(bridged, { filename: "golfjoin-main.v47a.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v47a.min.js" });

  [
    "G-LLY6DLP23E",
    "golfjoin_apply_step_view",
    "golfjoin_create_step_view",
    "apply_step",
    "builder_step",
    "form_view",
    "date_selection",
    "destination_selection",
    "participant_info",
    "review",
    "submit_start",
    "generate_lead",
    "participant_count",
    "trackGolfJoinGa4EventOnce"
  ].forEach((needle) => {
    if (!js.includes(Buffer.from(needle))) throw new Error(`ga4_contract_missing:${needle}`);
  });

  const assetRevision = `gha_${sha256(Buffer.concat([
    js,
    Buffer.from("\n--stage47a-ga4-internal-funnel-steps--\n")
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
    deployHtml: `DEPLOY_golfjoin_main_ga4_internal_funnel_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    packageTest: "stage47a-ga4-internal-funnel.test.js"
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
    'test("v47a Cloud Shell 압축 자산 해시가 일치한다", () => {',
    `  assert.equal(sha256(compressed), ${JSON.stringify(sha256(jsBrotli))});`,
    "});",
    "",
    'test("v47a JavaScript 문법과 내부 퍼널 계약을 보존한다", () => {',
    '  new vm.Script(js, { filename: "golfjoin-main.v47a.js" });',
    '  ["golfjoin_apply_step_view", "golfjoin_create_step_view", "apply_step", "builder_step", "form_view", "date_selection", "destination_selection", "participant_info", "review", "submit_start", "generate_lead"].forEach((value) => assert.match(js, new RegExp(value)));',
    "});",
    "",
    'test("v47a는 단계별 중복 방지와 기존 완료 이벤트를 함께 유지한다", () => {',
    '  assert.match(js, /golfJoinApplyGa4Steps/);',
    '  assert.match(js, /golfJoinBuilderGa4Steps/);',
    '  assert.match(js, /trackGolfJoinGa4EventOnce/);',
    '  assert.match(js, /participant_count/);',
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
    schema: "golfjoin-stage47a-ga4-internal-funnel-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    cmsRevision: 29,
    assetRevision,
    analytics: { measurementId: "G-LLY6DLP23E", propertyId: "552152254" },
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      joinApplySteps: ["form_view", "review", "submit_start", "complete"],
      newScheduleSteps: ["date_selection", "destination_selection", "participant_info", "review", "submit_start", "complete"],
      perModalStepDeduplication: true,
      completionEventsPreserved: true,
      piiAllowlistPreserved: true,
      serverRedeployRequired: false,
      cssRedeployRequired: false,
      dashboardRedeployRequired: false,
      ga4CustomDefinitionsRequired: ["apply_step", "builder_step"]
    },
    assets: { jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v47a GA4 참여 신청·새 모임 내부 퍼널 추적",
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
    "## 배포 뒤 맞춤 측정기준",
    "",
    "GA4 관리 > 데이터 표시 > 맞춤 정의에서 이벤트 범위 측정기준 2개를 추가합니다.",
    "",
    "- 참여 신청 단계 / apply_step",
    "- 새 모임 생성 단계 / builder_step",
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
