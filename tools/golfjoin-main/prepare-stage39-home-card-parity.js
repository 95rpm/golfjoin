"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage39-home-card-parity/login-public-cards-20260831-v39c");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage38-detail-match-reasons/match-reason-copy-20260828-v38a/DEPLOY_golfjoin_main_match_reasons_49175CEF.html"
);
const SOURCE_TEST = path.join(ROOT, "tests/unit/home-public-card-parity.test.js");
const JAVASCRIPT_BUDGET = 216 * 1024;
const ANALYTICS_SOURCE = "source/scripts/analytics/30-ga4-events.js";
const ANALYTICS_NOOP_BRIDGE = `
/* GA4 is intentionally not activated by the stage39 parity-only rollout. */
function trackGolfJoinGa4Event() {}
function getGolfJoinGa4Item(join = {}) {
  return {
    item_id: String(join.id || ""),
    item_name: String(join.title || ""),
    item_category: String(join.region || join.country || "")
  };
}
window.trackGolfJoinGa4Event = trackGolfJoinGa4Event;
window.getGolfJoinGa4Item = getGolfJoinGa4Item;
`;
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
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => (
    /^source\/scripts\/.+\.js$/.test(value) && value !== ANALYTICS_SOURCE
  ));
  const rawJs = Buffer.concat([
    Buffer.from(ANALYTICS_NOOP_BRIDGE, "utf8"),
    ...scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath)))
  ]);
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v39a.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v39a.min.js" });

  const assetRevision = `gha_${sha256(Buffer.concat([
    js,
    Buffer.from("\n--stage39-login-public-card-parity--\n")
  ])).slice(0, 24)}`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  const rollbackText = rollbackHtml.toString("utf8");
  const scriptPattern = /(<script\s+src=")https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[a-f0-9]+\/golfjoin-main\.js("\s+integrity=")[^"]+("[^>]*>)/;
  if (!scriptPattern.test(rollbackText)) throw new Error("rollback_javascript_asset_reference_missing");
  const deployText = rollbackText.replace(
    scriptPattern,
    `$1https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}$2${sriSha256(js)}$3`
  );
  const deployHtml = Buffer.from(deployText, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) {
    throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);
  }

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_home_card_parity_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    sourceTest: "home-public-card-parity.test.js"
  };
  const sourceTest = Buffer.from(
    read(SOURCE_TEST)
      .toString("utf8")
      .replace(
        'const ROOT = path.resolve(__dirname, "../..");',
        'const ROOT = path.resolve(__dirname, "../../..");'
      ),
    "utf8"
  );
  const buffers = { deployHtml, rollbackHtml, js: jsBrotli, sourceTest };
  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "js"
      ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) }
      : {})
  ]));

  const manifest = {
    schema: "golfjoin-stage39-home-card-parity-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    stagingEventPlanSeq: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      anonymousAndMemberUseSameReleaseV2: true,
      publicSectionsIgnoreMemberOwnershipFilters: true,
      publicScheduleMembershipSurvivesPrivateOverlay: true,
      privateOnlySchedulesExcludedFromPublicSections: true,
      cssRedeployRequired: false,
      sheetApiRedeployRequired: false,
      dashboardRedeployRequired: false,
      ga4TrackingActivatedByThisRelease: false
    },
    assets: { jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# 39단계 로그인·비로그인 공용 상품카드 통일",
    "",
    "이번 변경은 메인 JavaScript와 ERP HTML만 교체합니다. CSS, Sheet API, 관리자 대시보드는 재배포하지 않습니다.",
    "",
    "## 1. 업로드 파일",
    "",
    `- ${names.js}`,
    `- ${names.deployHtml}`,
    `- ${names.rollbackHtml}`,
    "",
    "## 2. GCS 불변 JavaScript 업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.js} ${names.deployHtml} ${names.rollbackHtml}`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type=\"application/javascript; charset=utf-8\" --content-encoding=br --cache-control=\"public, max-age=31536000, immutable\"`,
    "```",
    "",
    "## 3. 29번 테스트 페이지",
    "",
    `ERP 29번 HTML을 \`${names.deployHtml}\` 전체 내용으로 교체합니다.`,
    "",
    "1. 비로그인 상태에서 추천여행·취향맞춤·곧출발·해외BEST의 카드 ID와 순서를 기록합니다.",
    "2. 일반회원 로그인 후 같은 네 섹션의 카드 ID와 순서가 동일한지 확인합니다.",
    "3. 카카오회원 로그인 후에도 같은지 확인합니다.",
    "4. 로그인 상태의 나의모임·내예약·찜·상품상세 참여자 정보가 정상인지 확인합니다.",
    "5. 내가 생성·참여한 일정과 기간이 겹치는 카드도 공용 섹션에서는 그대로 보이는지 확인합니다.",
    "6. 참여 가능한 모임·여행지 검색·새 모임 만들기에서는 기존 일정 겹침 제한이 유지되는지 확인합니다.",
    "7. 콘솔 오류가 없으면 운영 ERP HTML도 같은 파일로 교체합니다.",
    "",
    "## 4. 복구",
    "",
    `ERP HTML을 \`${names.rollbackHtml}\`로 교체합니다. 신규 GCS 불변 JavaScript는 삭제하지 않아도 됩니다.`,
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
