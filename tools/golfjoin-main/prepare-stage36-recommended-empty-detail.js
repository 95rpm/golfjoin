"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const outputArgument = process.argv.find((value) => value.startsWith("--output="));
const OUTPUT = outputArgument
  ? path.resolve(ROOT, outputArgument.slice("--output=".length))
  : path.join(
      ROOT,
      "deploy/stage36-recommended-schedule-detail/calendar-availability-cleanup-20260824-v36e"
    );
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage36-recommended-schedule-detail/calendar-availability-cleanup-20260824-v36e/DEPLOY_golfjoin_main_recommended_empty_airline_3A98D650.html"
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
  const css = read(path.join(SOURCE_ROOT, "source/styles/10-main.css"));
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v36e.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v36e.min.js" });

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
    deployHtml: `DEPLOY_golfjoin_main_recommended_empty_airline_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
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
    schema: "secret-golf-join-recommended-empty-airline-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    stagingEventPlanSeq: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      emptyAdminRecommendationParticipantUi: true,
      recommendationSparkleHtmlEntity: "&#x2728;",
      includedFlightAirlineNameBadge: true,
      unifiedRecommendationAndFlightChips: true,
      airlineImageSize: "15px",
      calendarAvailabilityDotOnly: true,
      calendarDesktopScrollbarEdgeAligned: true,
      calendarDesktopSelectedRightGap: "20px",
      calendarDesktopHolidayOffset: "5px",
      cardCategoryFontSize: "13px",
      serverRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { cssObjectName, jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v36e 참여 가능 캘린더·추천일정·통일 항공 칩",
    "",
    "## 체크리스트",
    "",
    "- [ ] CSS gzip·JS Brotli를 Cloud Shell 작업 폴더에 업로드하고 해시를 확인한다.",
    "- [ ] 신규 GCS 불변 경로에 두 자산을 업로드한다.",
    "- [ ] gzip·Brotli 응답 헤더를 확인한다.",
    "- [ ] 29번 테스트 페이지 HTML을 신규 HTML로 교체한다.",
    "- [ ] 참여자가 없는 관리자 추천일정 상세에서 마감·관심 뱃지와 스타일 칩은 유지되는지 확인한다.",
    "- [ ] 같은 화면에서 빈 참여자 아이콘·성별·적합도·이유는 보이지 않는지 확인한다.",
    "- [ ] 참여자가 있는 추천일정과 일반 일정은 기존 참여자 UI가 유지되는지 확인한다.",
    "- [ ] 추천일정 칩이 ✨추천일정으로 보이는지 확인한다.",
    "- [ ] 항공포함 상품은 15px 원형 항공사 로고 뒤에 실제 항공사명이 보이는지 확인한다.",
    "- [ ] 추천일정·항공포함·항공불포함 칩의 높이·흰 배경·보더·글자색이 동일한지 확인한다.",
    "- [ ] 항공사 정보가 없는 포함 상품은 항공포함, 불포함 상품은 항공불포함으로 보이는지 확인한다.",
    "- [ ] 참여 가능 캘린더에서 월례회·국내·해외 개수 뱃지가 사라지고 초록 원만 보이는지 확인한다.",
    "- [ ] PC 참여 가능 모달의 스크롤바가 모달 오른쪽 끝에 정렬되는지 확인한다.",
    "- [ ] PC 공휴일 라벨이 참여중 기간선에서 기존보다 5px 아래로 떨어지는지 확인한다.",
    "- [ ] PC·모바일 기본 화면·상품상세·스크롤과 콘솔 오류를 확인한다.",
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
