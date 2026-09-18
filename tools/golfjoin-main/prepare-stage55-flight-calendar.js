"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage55-main/golfjoin-flight-calendar-normalization-20260902-v55c");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage50-ga4/golfjoin-ga4-attribution-normalization-20260901-v50b/DEPLOY_golfjoin_main_ga4_attribution_normalization_549DCF74.html"
);
const JAVASCRIPT_BUDGET = 220 * 1024;
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

function replaceAssetReference(html, assetName, objectName, integrity) {
  const pattern = new RegExp(
    `https://storage\\.googleapis\\.com/golfjoin-bucket/web/home-assets/gha_[a-f0-9]+/${assetName.replace(".", "\\.")}("\\s+integrity=")[^"]+`,
    "g"
  );
  const matches = html.match(pattern) || [];
  if (!matches.length) throw new Error(`${assetName}_asset_reference_missing`);
  return html.replace(
    pattern,
    `https://storage.googleapis.com/golfjoin-bucket/${objectName}$1${integrity}`
  );
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const sourceManifest = JSON.parse(read(SOURCE_MANIFEST).toString("utf8"));
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => /^source\/scripts\/.+\.js$/.test(value));
  const rawJs = Buffer.concat(scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath))));
  const css = read(path.join(SOURCE_ROOT, "source/styles/10-main.css"));
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v55c.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v55c.min.js" });

  [
    "getGoodsEventList.json",
    "depStartTime",
    "arrEndTime",
    "flightScheduleItems",
    "goodTransportSeq",
    "golfjoin_destination_search_open",
    "golfjoin_login_return_complete",
    "golfjoin_apply_step_view",
    "golfjoin_create_step_view",
    "singleRoomSurcharge"
  ].forEach((needle) => {
    if (!js.includes(Buffer.from(needle))) throw new Error(`javascript_contract_missing:${needle}`);
  });
  [
    ".calendar-today-label",
    ".builder-day.today .builder-day-today-label",
    "top: calc(50% + 0px)",
    "top: calc(50% + 18px)",
    "font-size: 14px"
  ].forEach((needle) => {
    if (!css.includes(Buffer.from(needle))) throw new Error(`calendar_css_contract_missing:${needle}`);
  });

  const assetRevision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--stage55c-flight-calendar-normalization--\n")
  ])).slice(0, 24)}`;
  const cssObjectName = `web/home-assets/${assetRevision}/golfjoin-main.css`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  let deployText = rollbackHtml.toString("utf8");
  deployText = replaceAssetReference(deployText, "golfjoin-main.css", cssObjectName, sriSha256(css));
  deployText = replaceAssetReference(deployText, "golfjoin-main.js", jsObjectName, sriSha256(js));
  const deployHtml = Buffer.from(deployText, "utf8");

  const cssGzip = zlib.gzipSync(css, { level: 9, mtime: 0 });
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_flight_calendar_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    packageTest: "stage55c-flight-calendar-normalization.test.js"
  };
  const buffers = { deployHtml, rollbackHtml, css: cssGzip, js: jsBrotli };
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
    'const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");',
    `const deploy = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.deployHtml)}));`,
    `const rollback = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.rollbackHtml)}));`,
    `const compressedCss = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.css)}));`,
    `const compressedJs = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.js)}));`,
    'const css = zlib.gunzipSync(compressedCss).toString("utf8");',
    'const js = zlib.brotliDecompressSync(compressedJs).toString("utf8");',
    "",
    'test("v55c 배포·복구·압축 자산 해시가 일치한다", () => {',
    `  assert.equal(sha256(deploy), ${JSON.stringify(sha256(deployHtml))});`,
    `  assert.equal(sha256(rollback), ${JSON.stringify(sha256(rollbackHtml))});`,
    `  assert.equal(sha256(compressedCss), ${JSON.stringify(sha256(cssGzip))});`,
    `  assert.equal(sha256(compressedJs), ${JSON.stringify(sha256(jsBrotli))});`,
    "});",
    "",
    'test("v55c JavaScript 문법과 행사 항공정보 우선 조회 계약을 포함한다", () => {',
    '  new vm.Script(js, { filename: "golfjoin-main.v55c.js" });',
    '  ["getGoodsEventList.json", "depStartTime", "depEndTime", "arrStartTime", "arrEndTime", "flightScheduleItems", "goodTransportSeq"].forEach((value) => assert.match(js, new RegExp(value)));',
    '  assert.match(js, /항공편 정보 확인 필요/);',
    "});",
    "",
    'test("v55c 참여가능 캘린더 TODAY를 다른 셀 구조에 맞춰 위로 보정한다", () => {',
    '  assert.ok(css.includes("@media (min-width: 641px)"));',
    '  assert.ok(css.includes(".calendar-today-label {"));',
    '  assert.ok(css.includes(".builder-day.today .builder-day-today-label"));',
    '  assert.ok(css.includes("top: calc(50% + 0px);"));',
    '  assert.ok(css.includes("top: calc(50% + 18px);"));',
    '  assert.ok(css.includes("font-size: 14px;"));',
    "});",
    "",
    'test("v55c는 기존 분석·내부 퍼널·싱글차지 계약을 유지한다", () => {',
    '  ["golfjoin_destination_search_open", "golfjoin_login_return_complete", "golfjoin_apply_step_view", "golfjoin_create_step_view", "singleRoomSurcharge"].forEach((value) => assert.match(js, new RegExp(value)));',
    "});",
    "",
    'test("v55c HTML은 신규 CSS·JS 불변 자산과 SRI를 참조한다", () => {',
    `  assert.match(deploy.toString("utf8"), /${assetRevision.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}/);`,
    `  assert.match(deploy.toString("utf8"), /${sriSha256(css).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}/);`,
    `  assert.match(deploy.toString("utf8"), /${sriSha256(js).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}/);`,
    "});",
    ""
  ].join("\n"), "utf8");

  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "css"
      ? { contentEncoding: "gzip", objectName: cssObjectName, logicalSri: sriSha256(css) }
      : key === "js" ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) } : {})
  ]));
  const manifest = {
    schema: "golfjoin-stage55c-flight-calendar-normalization-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    cmsRevision: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      eventFlightScheduleFallback: true,
      zeroTransportSeqRejected: true,
      pcTodayLabel14px: true,
      pcTodayLabelPositionUnified: true,
      todayOverridesHolidayLabel: true,
      serverRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { cssObjectName, jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v55c 항공팩 항공정보 + 참여가능 캘린더 TODAY 위치 보정",
    "",
    "이번 변경은 메인 CSS·JavaScript와 ERP HTML만 교체합니다. Sheet API와 관리자 대시보드는 배포하지 않습니다.",
    "",
    "## 1. Cloud Shell 업로드 파일",
    "",
    `- ${names.deployHtml}`,
    `- ${names.rollbackHtml}`,
    `- ${names.css}`,
    `- ${names.js}`,
    `- ${names.packageTest}`,
    "",
    "## 2. 해시·패키지 검사",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.deployHtml} ${names.rollbackHtml} ${names.css} ${names.js} ${names.packageTest}`,
    `node --test ${names.packageTest}`,
    "```",
    "",
    "## 3. GCS 불변 자산 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"`,
    `curl -sSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/${cssObjectName}`,
    `curl -sSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 4. HTML 교체",
    "",
    `ERP 29번 HTML 전체를 \`${names.deployHtml}\` 내용으로 교체합니다.`,
    "",
    "## 5. 운영 확인",
    "",
    "1. MD PICK의 문제 항공팩 상품을 열어 항공사·왕복 출도착 시간이 표시되는지 확인합니다.",
    "2. 상품상세 날짜변경, 참여가능한 모임, 새 모임 만들기 캘린더에서 PC TODAY가 모두 14px·같은 위치인지 확인합니다.",
    "3. 오늘이 공휴일인 날짜에는 공휴일명이 사라지고 TODAY만 표시되는지 확인합니다.",
    "4. 콘솔 오류가 없는지 확인합니다.",
    "",
    "## 6. 복구",
    "",
    `문제가 있으면 ERP HTML을 \`${names.rollbackHtml}\` 내용으로 되돌립니다. 신규 GCS 불변 자산은 삭제하지 않아도 됩니다.`,
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(OUTPUT, { recursive: true });
  Object.entries(buffers).forEach(([key, buffer]) => {
    fs.writeFileSync(path.join(OUTPUT, names[key]), buffer, { flag: "wx" });
  });
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ output: OUTPUT, manifest }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
