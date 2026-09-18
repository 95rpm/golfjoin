"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { buildExternalAssetBundle, sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(
  ROOT,
  "deploy/stage34-hero-banner-management/detail-bottom-typography-20260821-v34o"
);
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage34-hero-banner-management/dashboard-hero-banners-20260821-v34j/DEPLOY_golfjoin_main_banner_management_F6FE223D.html"
);
const JAVASCRIPT_BUDGET = 205 * 1024;
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
  return fs.readFileSync(path.isAbsolute(target) ? target : path.join(ROOT, target));
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
  new vm.Script(bridged, { filename: "golfjoin-main.v34n.source.js" });
  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v34n.min.js" });

  const identity = buildExternalAssetBundle({ mainHtmlPath: ROLLBACK_HTML });
  const css = identity.artifacts.css.buffer;
  const assetRevision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--golfjoin-delivery-gzip-css-brotli-js-v1--\n")
  ])).slice(0, 24)}`;
  const cssObjectName = `web/home-assets/${assetRevision}/golfjoin-main.css`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  const rollbackText = rollbackHtml.toString("utf8");
  const oldRevision = rollbackText.match(/gha_[a-f0-9]{24}/)?.[0];
  const oldCssSri = rollbackText.match(/golfjoin-main\.css" integrity="([^"]+)"/)?.[1];
  const oldJsSri = rollbackText.match(/golfjoin-main\.js" integrity="([^"]+)"/)?.[1];
  if (!oldRevision || !oldCssSri || !oldJsSri) throw new Error("rollback_asset_reference_missing");
  let deployText = rollbackText.split(oldRevision).join(assetRevision);
  deployText = deployText.split(oldCssSri).join(sriSha256(css));
  deployText = deployText.split(oldJsSri).join(sriSha256(js));
  const summaryStart = markup.indexOf('        <div class="detail-bottom-summary"');
  const summaryEnd = markup.indexOf('        <button type="button" class="button secondary detail-contact-button detail-phone-button"', summaryStart);
  if (summaryStart < 0 || summaryEnd <= summaryStart) throw new Error("detail_bottom_summary_source_missing");
  const summaryMarkup = markup.slice(summaryStart, summaryEnd);
  const detailPhoneButtonIndex = deployText.indexOf('        <button type="button" class="button secondary detail-contact-button detail-phone-button"');
  if (detailPhoneButtonIndex < 0 || deployText.includes('id="detailBottomSummary"')) {
    throw new Error("detail_bottom_summary_insertion_target_invalid");
  }
  deployText = `${deployText.slice(0, detailPhoneButtonIndex)}${summaryMarkup}${deployText.slice(detailPhoneButtonIndex)}`;
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

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_detail_bottom_summary_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`
  };
  const buffers = { deployHtml, rollbackHtml, css: cssGzip, js: jsBrotli };
  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "css"
      ? { contentEncoding: "gzip", objectName: cssObjectName }
      : key === "js" ? { contentEncoding: "br", objectName: jsObjectName } : {})
  ]));
  const manifest = {
    schema: "secret-golf-join-detail-bottom-summary-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    stagingEventPlanSeq: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      sharedDetailBottomPeriodAndPrice: true,
      finalQuoteUnitPricePriority: true,
      desktopAndMobile: true,
      builderSelectionPerformanceV34mPreserved: true,
      serverRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { cssObjectName, jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v34o 상품상세 하단 여행기간·요금 타이포그래피",
    "",
    "## 체크리스트",
    "",
    "- [ ] CSS gzip·JS Brotli를 Cloud Shell 작업 폴더에 업로드하고 해시를 확인한다.",
    "- [ ] 신규 GCS 불변 경로에 두 자산을 업로드한다.",
    "- [ ] gzip·Brotli 응답 헤더를 확인한다.",
    "- [ ] 29번 테스트 페이지 HTML을 신규 HTML로 교체한다.",
    "- [ ] PC·모바일에서 일반 상품, 상품군, 찜, 조인일정, 내예약, 새 모임 상품상세를 확인한다.",
    "- [ ] 하단 버튼 위 기간은 왼쪽, 요금은 오른쪽인지 확인한다.",
    "- [ ] 확정 견적 일정은 확정 1인 금액인지 확인한다.",
    "- [ ] 기존 버튼·날짜변경·참여·문의 동작과 콘솔 오류를 확인한다.",
    "- [ ] 모두 정상일 때 같은 HTML을 운영 페이지에 저장한다.",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"`,
    "```",
    "",
    `신규 HTML: ${names.deployHtml}`,
    `즉시 복구 HTML: ${names.rollbackHtml}`,
    "Sheet API·Aligo API·대시보드는 재배포하지 않습니다.",
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
