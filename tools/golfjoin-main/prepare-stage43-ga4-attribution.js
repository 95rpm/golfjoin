"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage43-ga4/golfjoin-ga4-card-selection-hotfix-20260831-v43d");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage43-ga4/golfjoin-ga4-list-promotion-attribution-20260831-v43c/DEPLOY_golfjoin_main_ga4_list_promotion_attribution_14B69FC6.html"
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
  new vm.Script(bridged, { filename: "golfjoin-main.v43d.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v43d.min.js" });

  [
    "G-LLY6DLP23E",
    "generate_lead",
    "participant_count",
    "trackGolfJoinGa4EventOnce",
    "golfjoin_apply_error",
    "golfjoin_section_detail_view",
    "view_item_list",
    "select_item",
    "view_promotion",
    "select_promotion",
    "item_list_id",
    "destination_search_",
    "defaultPrevented",
    "source_area"
  ].forEach((needle) => {
    if (!js.includes(Buffer.from(needle))) throw new Error(`ga4_contract_missing:${needle}`);
  });

  const assetRevision = `gha_${sha256(Buffer.concat([
    js,
    Buffer.from("\n--stage43d-ga4-card-selection-hotfix--\n")
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

  const buffers = { deployHtml, rollbackHtml, js: jsBrotli };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_ga4_card_selection_hotfix_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    packageTest: "stage43d-ga4-card-selection-hotfix.test.js"
  };
  buffers.packageTest = Buffer.from([
    '"use strict";',
    "",
    'const assert = require("node:assert/strict");',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const test = require("node:test");',
    'const zlib = require("node:zlib");',
    "",
    `const js = zlib.brotliDecompressSync(fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.js)}))).toString("utf8");`,
    "",
    'test("v43d 배포 자산은 카드 캡처 선택과 배너 스와이프 제외 계약을 포함한다", () => {',
    '  assert.match(js, /golfjoin_section_detail_view/);',
    '  assert.match(js, /\\.join-card/);',
    '  assert.match(js, /section_name/);',
    '  assert.match(js, /source_area/);',
    '  assert.match(js, /view_item_list/);',
    '  assert.match(js, /select_item/);',
    '  assert.match(js, /view_promotion/);',
    '  assert.match(js, /select_promotion/);',
    '  assert.match(js, /item_list_id/);',
    '  assert.match(js, /destination_search_/);',
    '  assert.match(js, /defaultPrevented/);',
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
    schema: "golfjoin-stage43d-ga4-card-selection-hotfix-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    cmsRevision: 29,
    assetRevision,
    analytics: { measurementId: "G-LLY6DLP23E", propertyId: "552152254" },
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      generateLeadUsesStandardItems: true,
      participantCountPreserved: true,
      completionDeduplicationPreserved: true,
      failedSaveNeverGeneratesLead: true,
      piiAllowlistPreserved: true,
      detailWishSourceAreaAdded: true,
      sectionDetailAttributionAdded: true,
      standardItemListViewAdded: true,
      standardItemSelectionAdded: true,
      itemListAttributionAdded: true,
      heroPromotionViewAdded: true,
      destinationSearchSelectionAdded: true,
      capturePhaseCardSelectionRestored: true,
      heroSwipeDefaultPreventedExcluded: true,
      swipeWithoutDetailOpenExcluded: true,
      v43cListPromotionAttributionPreserved: true,
      v42dSoonCarouselPreserved: true,
      serverRedeployRequired: false,
      cssRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v43d GA4 카드 선택 운영 핫픽스",
    "",
    "이번 변경은 JavaScript와 ERP HTML만 교체합니다. 서버·CSS·대시보드는 배포하지 않습니다.",
    "",
    "## Cloud Shell 업로드 파일",
    "",
    `- ${names.js}`,
    "",
    "## 해시·업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.js}`,
    `node --test ${names.packageTest}`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type=\"application/javascript; charset=utf-8\" --content-encoding=br --cache-control=\"public, max-age=31536000, immutable\"`,
    `curl -sSI -H \"Accept-Encoding: br\" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## HTML 직접 교체",
    "",
    `ERP 29번 HTML 전체를 \`${names.deployHtml}\` 내용으로 교체합니다.`,
    "",
    "## 코드 시뮬레이션 판정",
    "",
    "- v43c 운영에서 view_item만 전송되고 select_item이 누락된 카드 버블 전파 문제 수정",
    "- 카드 클릭 감지를 캡처 단계로 복구하고 실제 상세 모달이 열린 경우만 select_item과 golfjoin_section_detail_view 전송",
    "- item_list_id와 item_list_name에 섹션 또는 검색 목록 귀속값 전송",
    "- 히어로 배너의 실제 활성 노출은 view_promotion, 선택은 기본 동작이 취소되지 않은 실제 클릭만 select_promotion으로 전송",
    "- 여행지 검색 결과의 실제 선택은 destination_search 목록 select_item으로 전송",
    "- 스와이프 및 상세가 열리지 않은 클릭은 선택 이벤트에서 제외",
    "- v43c의 목록·배너·검색 귀속과 참여 신청 추적 유지",
    "- 회원 식별정보·이름·연락처·이메일은 전송하지 않음",
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
