"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage42-soon-carousel/soon-best-swipe-20260831-v42d");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage41-ga4/golfjoin-ga4-final-audit-20260831-v41e/DEPLOY_golfjoin_main_ga4_tracking_AA8FA4D6.html"
);
const SOURCE_TEST = path.join(ROOT, "tests/unit/soon-mobile-carousel.test.js");
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
  new vm.Script(bridged, { filename: "golfjoin-main.v42d.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v42d.min.js" });

  if (!js.includes(Buffer.from("isHomeJoinCardRailKey"))) throw new Error("soon_carousel_rail_logic_missing");
  if (!js.includes(Buffer.from("data-slide-dots"))) throw new Error("slide_dots_missing");
  if (!css.includes(Buffer.from(".layout-soon .join-grid::after"))) throw new Error("soon_carousel_end_gutter_missing");
  if (!css.includes(Buffer.from("scroll-snap-align: center"))) throw new Error("soon_carousel_snap_missing");

  const assetRevision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--stage42-soon-best-swipe--\n")
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
  if (jsBrotli.length > JAVASCRIPT_BUDGET) {
    throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);
  }

  const sourceTest = read(SOURCE_TEST);
  const buffers = { deployHtml, rollbackHtml, css: cssGzip, js: jsBrotli, sourceTest };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_soon_carousel_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    sourceTest: "stage42-soon-mobile-carousel.test.js"
  };
  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "css"
      ? { contentEncoding: "gzip", objectName: cssObjectName, logicalSri: sriSha256(css) }
      : key === "js" ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) } : {})
  ]));

  const manifest = {
    schema: "golfjoin-stage42-soon-carousel-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    cmsRevision: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      soonMobileHorizontalSwipe: true,
      soonMobileAllFilteredCards: true,
      soonMobileSharedBestDots: true,
      soonMobileSharedBestEdgeGutters: true,
      soonCardInnerUiPreserved: true,
      soonDesktopGridAndMorePreserved: true,
      ga4V41ePreserved: true,
      serverRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { cssObjectName, jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v42d 곧 출발해요 모바일 스와이프 통일",
    "",
    "이번 변경은 메인 CSS·JavaScript와 ERP HTML만 교체합니다. Sheet API와 관리자 대시보드는 배포하지 않습니다.",
    "",
    "## 1. Cloud Shell 업로드 파일",
    "",
    `- ${names.css}`,
    `- ${names.js}`,
    "",
    "HTML은 Cloud Shell에 올리지 않고 ERP 편집기에서 직접 교체합니다.",
    "",
    "## 2. 해시 확인",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.css} ${names.js}`,
    "```",
    "",
    "## 3. GCS 불변 자산 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${cssObjectName} --if-generation-match=0 --content-type=\"text/css; charset=utf-8\" --content-encoding=gzip --cache-control=\"public, max-age=31536000, immutable\"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type=\"application/javascript; charset=utf-8\" --content-encoding=br --cache-control=\"public, max-age=31536000, immutable\"`,
    `curl -sSI -H \"Accept-Encoding: gzip\" https://storage.googleapis.com/golfjoin-bucket/${cssObjectName}`,
    `curl -sSI -H \"Accept-Encoding: br\" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 4. HTML 직접 교체",
    "",
    `ERP 29번 HTML 전체를 \`${names.deployHtml}\` 내용으로 교체합니다.`,
    "",
    "## 5. 확인",
    "",
    "1. 모바일에서 곧 출발해요의 각 기간 탭을 순서대로 누릅니다.",
    "2. 카드가 세로 목록이 아닌 가로 한 줄로 표시되고 손가락 스와이프가 되는지 확인합니다.",
    "3. 더보기 버튼이 없고 해당 탭의 모든 카드가 끝까지 이어지는지 확인합니다.",
    "4. 도트 모양·활성 이동이 해외골프 BEST와 동일한지 확인합니다.",
    "5. 첫 카드 시작 위치, 다음 카드 간격, 마지막 카드 뒤 여백이 해외골프 BEST와 같은지 확인합니다.",
    "6. 한 탭에서 두 번째 이후 카드로 이동한 뒤 다른 기간 탭을 누르면 첫 카드와 첫 도트에서 시작하는지 확인합니다.",
    "7. 카드 내부의 이미지·출발일·제목·가격·참여자 UI가 기존 곧 출발해요와 동일한지 확인합니다.",
    "8. PC에서는 기존 2열/4열 배열과 더보기 동작이 유지되는지 확인합니다.",
    "9. 콘솔 오류가 없으면 운영 HTML도 같은 파일로 교체합니다.",
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
