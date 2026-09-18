"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage38-detail-match-reasons/match-reason-copy-20260828-v38a");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage37-member-identity/contact-pending-birthdate-20260828-v37l/DEPLOY_golfjoin_main_pending_roster_521C0717.html"
);
const SOURCE_TEST = path.join(ROOT, "tests/unit/detail-participant-match-reason-copy.test.js");
const JAVASCRIPT_BUDGET = 215 * 1024;
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
  const css = read(path.join(SOURCE_ROOT, "source/styles/10-main.css"));
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v38.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v38.min.js" });

  const assetRevision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--stage38-detail-participant-match-reasons--\n")
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

  const sourceTest = Buffer.from(
    read(SOURCE_TEST)
      .toString("utf8")
      .replace(
        'path.join(__dirname, "../../src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js")',
        'path.join(__dirname, "../../../src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js")'
      ),
    "utf8"
  );
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_match_reasons_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    sourceTest: "detail-participant-match-reason-copy.test.js"
  };
  const buffers = { deployHtml, rollbackHtml, css: cssGzip, js: jsBrotli, sourceTest };
  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "css"
      ? { contentEncoding: "gzip", objectName: cssObjectName }
      : key === "js" ? { contentEncoding: "br", objectName: jsObjectName } : {})
  ]));

  const manifest = {
    schema: "golfjoin-stage38-detail-match-reasons-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    stagingEventPlanSeq: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      factualParticipantMatchReasons: true,
      sharedStyleBenefitCopy: true,
      participantAgeAndScoreCopy: true,
      monthlyRosterLimitedProfileFallback: true,
      maximumReasonCount: 3,
      serverRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { cssObjectName, jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# 38단계 상품상세 참여 매칭 이유 문구 보완",
    "",
    "이번 변경은 메인 프런트 자산과 ERP HTML만 교체합니다. Sheet API와 관리자 대시보드는 재배포하지 않습니다.",
    "",
    "## 1. 업로드 파일",
    "",
    `- ${names.css}`,
    `- ${names.js}`,
    `- ${names.deployHtml}`,
    `- ${names.rollbackHtml}`,
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.css} ${names.js} ${names.deployHtml} ${names.rollbackHtml}`,
    "```",
    "",
    "## 2. GCS 불변 자산 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"`,
    "```",
    "",
    "## 3. 29번 테스트 페이지",
    "",
    `ERP 29번 HTML을 \`${names.deployHtml}\` 전체 내용으로 교체합니다.`,
    "",
    "1. 로그인 후 참여자가 있는 일반 일정 상세를 엽니다.",
    "2. 공통 스타일·비슷한 연령·비슷한 타수가 실제 데이터에 따라 최대 3개까지 표시되는지 확인합니다.",
    "3. 관리자 명단만 있는 월례회에서는 연령대와 월례회 단체 일정 문구가 표시되는지 확인합니다.",
    "4. 참여자가 없는 관리자 추천일정은 기존처럼 적합도와 이유 영역이 숨겨지는지 확인합니다.",
    "5. PC와 모바일에서 문구 잘림·겹침 및 콘솔 오류가 없는지 확인합니다.",
    "6. 정상일 때 운영 ERP HTML도 같은 파일로 교체합니다.",
    "",
    "## 4. 복구",
    "",
    `ERP HTML을 \`${names.rollbackHtml}\`로 교체합니다. 신규 GCS 불변 자산은 삭제하지 않아도 됩니다.`,
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
