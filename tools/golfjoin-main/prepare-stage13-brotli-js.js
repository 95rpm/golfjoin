"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const terser = require("terser");
const terserPackage = require("terser/package.json");
const { sha256, sriSha256, IMMUTABLE_CACHE_CONTROL } = require("./external-assets");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_SOURCE_PACKAGE = path.join(
  WORKSPACE_ROOT,
  "deploy/stage13-home-assets/production-critical-css-refresh-20260813"
);
const DEFAULT_OUTPUT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage13-home-assets/production-minified-brotli-bridged-20260813"
);
const JAVASCRIPT_BUDGET_BYTES = 200 * 1024;
const BROTLI_QUALITY = 11;
const EXPECTED_TERSER_VERSION = "5.50.0";
const JAVASCRIPT_RESERVED_WORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "implements", "import", "in", "instanceof",
  "interface", "let", "new", "null", "package", "private", "protected", "public",
  "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "yield"
]);

function assertInsideWorkspace(input, label) {
  const resolved = path.resolve(input);
  const relative = path.relative(WORKSPACE_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_workspace:${resolved}`);
  }
  return resolved;
}

function parseArgs(argv = []) {
  const options = {};
  for (const argument of argv) {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match) throw new Error(`unknown_argument:${argument}`);
    const [, name, value] = match;
    if (name === "source-package") options.sourcePackage = value;
    else if (name === "output") options.output = value;
    else if (name === "generated-at") options.generatedAt = value;
    else throw new Error(`unknown_argument:${argument}`);
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readVerifiedFile(root, record, label) {
  if (!record?.fileName || !record.sha256) throw new Error(`${label}_record_invalid`);
  const filePath = path.resolve(root, record.fileName);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_package:${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  if (sha256(buffer) !== record.sha256) throw new Error(`${label}_hash_mismatch`);
  return buffer;
}

function replaceExact(source, target, replacement, expectedCount, label) {
  if (!target) throw new Error(`${label}_target_missing`);
  const count = source.split(target).length - 1;
  if (count !== expectedCount) throw new Error(`${label}_count_invalid:${count}`);
  return source.split(target).join(replacement);
}

function replaceAllRequired(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (!count) throw new Error(`${label}_missing`);
  return { value: source.split(target).join(replacement), count };
}

function verifyInlineScripts(html) {
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = pattern.exec(html))) {
    const source = match[1].trim();
    if (!source) continue;
    new vm.Script(source, { filename: `brotli-candidate-inline-${count + 1}.js` });
    count += 1;
  }
  return count;
}

function extractCriticalCss(html) {
  const match = html.match(/<style data-golfjoin-critical-css="([^"]+)">\n([\s\S]*?)<\/style>/);
  if (!match) throw new Error("critical_css_block_missing");
  return { marker: match[1], css: match[2] };
}

function publicUrl(bucketName, objectName) {
  const encodedObject = objectName.split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${encodedObject}`;
}

function brotliCompressJavaScript(buffer) {
  return zlib.brotliCompressSync(buffer, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
}

function collectInlineHandlerNames(...sources) {
  const names = new Set();
  const attributePattern = /\bon[a-z]+\s*=\s*(?:\\?["'])([\s\S]*?)(?:\\?["'])/gi;
  const callPattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (const input of sources) {
    const source = String(input || "");
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(source))) {
      let callMatch;
      while ((callMatch = callPattern.exec(attributeMatch[1]))) {
        const name = callMatch[1];
        if (!JAVASCRIPT_RESERVED_WORDS.has(name)) names.add(name);
      }
    }
  }
  return [...names].sort();
}

function buildInlineHandlerBridge(handlerNames = []) {
  const statements = handlerNames.map((name) => (
    `typeof ${name}==="function"&&(window[${JSON.stringify(name)}]=${name});`
  ));
  return statements.length
    ? `\n;/* golfjoin-inline-handler-bridge */${statements.join("")}\n`
    : "";
}

async function minifyJavaScript(source, options = {}) {
  if (terserPackage.version !== EXPECTED_TERSER_VERSION) {
    throw new Error(`terser_version_invalid:${terserPackage.version}`);
  }
  new vm.Script(source, { filename: "golfjoin-main.source.js" });
  const handlerNames = [...new Set(options.handlerNames || [])].sort();
  const bridgedSource = `${source}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridgedSource, { filename: "golfjoin-main.bridged-source.js" });
  const result = await terser.minify(bridgedSource, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!result.code) throw new Error("terser_output_empty");
  const buffer = Buffer.from(result.code, "utf8");
  new vm.Script(result.code, { filename: "golfjoin-main.min.js" });
  return buffer;
}

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function writeExclusive(root, fileName, buffer) {
  fs.writeFileSync(path.join(root, fileName), buffer, { flag: "wx" });
}

async function buildBrotliCandidate(rawOptions = {}) {
  const sourcePackage = assertInsideWorkspace(
    rawOptions.sourcePackage || DEFAULT_SOURCE_PACKAGE,
    "source_package"
  );
  const generatedAt = String(rawOptions.generatedAt || new Date().toISOString());
  const sourceManifestBuffer = fs.readFileSync(path.join(sourcePackage, "manifest.json"));
  const sourceManifest = JSON.parse(sourceManifestBuffer.toString("utf8"));
  if (sourceManifest.status !== "production-deployed-verified") {
    throw new Error(`source_package_not_production_verified:${sourceManifest.status || "missing"}`);
  }
  if (!sourceManifest.assetRevision || !sourceManifest.files?.css || !sourceManifest.files?.js) {
    throw new Error("source_package_manifest_invalid");
  }
  if (sourceManifest.files.css.contentEncoding !== "gzip" || sourceManifest.files.js.contentEncoding !== "gzip") {
    throw new Error("source_package_encoding_invalid");
  }

  const sourceHtml = readVerifiedFile(sourcePackage, sourceManifest.files.deployHtml, "source_html");
  const cssGzip = readVerifiedFile(sourcePackage, sourceManifest.files.css, "source_css_gzip");
  const jsGzip = readVerifiedFile(sourcePackage, sourceManifest.files.js, "source_js_gzip");
  const css = zlib.gunzipSync(cssGzip);
  const js = zlib.gunzipSync(jsGzip);
  if (sha256(css) !== sourceManifest.files.css.logicalSha256) throw new Error("source_css_logical_hash_mismatch");
  if (sha256(js) !== sourceManifest.files.js.logicalSha256) throw new Error("source_js_logical_hash_mismatch");

  const sourceHtmlText = sourceHtml.toString("utf8");
  const inlineHandlerNames = collectInlineHandlerNames(sourceHtmlText, js.toString("utf8"));
  const minifiedJs = await minifyJavaScript(js.toString("utf8"), {
    handlerNames: inlineHandlerNames
  });
  const jsBrotli = brotliCompressJavaScript(minifiedJs);
  if (zlib.brotliDecompressSync(jsBrotli).compare(minifiedJs) !== 0) {
    throw new Error("javascript_brotli_roundtrip_failed");
  }
  if (jsBrotli.length > JAVASCRIPT_BUDGET_BYTES) {
    throw new Error(`javascript_brotli_budget_exceeded:${jsBrotli.length}`);
  }

  const revisionMaterial = Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    minifiedJs,
    Buffer.from("\n--golfjoin-delivery-css-gzip-js-br-v1--\n")
  ]);
  const assetRevision = `gha_${sha256(revisionMaterial).slice(0, 24)}`;
  const oldRevision = sourceManifest.assetRevision;
  const objectPrefix = `web/home-assets/${assetRevision}`;
  const cssObjectName = `${objectPrefix}/golfjoin-main.css`;
  const jsObjectName = `${objectPrefix}/golfjoin-main.js`;
  const cssUrl = publicUrl("golfjoin-bucket", cssObjectName);
  const jsUrl = publicUrl("golfjoin-bucket", jsObjectName);
  const oldJsSri = sourceManifest.files.js.sri;
  const newJsSri = sriSha256(minifiedJs);

  const sourceCritical = extractCriticalCss(sourceHtmlText);
  const revisionReplacement = replaceAllRequired(
    sourceHtmlText,
    oldRevision,
    assetRevision,
    "source_asset_revision"
  );
  let candidateHtmlText = replaceExact(
    revisionReplacement.value,
    oldJsSri,
    newJsSri,
    1,
    "javascript_sri"
  );
  if (candidateHtmlText.includes(oldRevision)) throw new Error("old_asset_revision_remains");
  if (!candidateHtmlText.includes(cssUrl) || !candidateHtmlText.includes(jsUrl)) {
    throw new Error("candidate_asset_urls_missing");
  }
  const candidateCritical = extractCriticalCss(candidateHtmlText);
  if (candidateCritical.marker !== sourceCritical.marker || candidateCritical.css !== sourceCritical.css) {
    throw new Error("critical_css_changed");
  }
  const inlineScriptCount = verifyInlineScripts(candidateHtmlText);
  const candidateHtml = Buffer.from(candidateHtmlText, "utf8");

  return {
    generatedAt,
    sourcePackage,
    sourceManifest,
    sourceManifestBuffer,
    sourceHtml,
    css,
    cssGzip,
    js,
    minifiedJs,
    jsBrotli,
    candidateHtml,
    assetRevision,
    revisionOccurrenceCount: revisionReplacement.count,
    inlineScriptCount,
    inlineHandlerNames,
    assets: {
      css: {
        objectName: cssObjectName,
        url: cssUrl,
        contentType: "text/css; charset=utf-8",
        contentEncoding: "gzip",
        logicalSri: sriSha256(css)
      },
      js: {
        objectName: jsObjectName,
        url: jsUrl,
        contentType: "application/javascript; charset=utf-8",
        contentEncoding: "br",
        logicalSri: newJsSri
      }
    }
  };
}

function buildRunbook(candidate, fileNames) {
  return [
    "# Stage 13 JavaScript 축소·Brotli 후보",
    "",
    "현재 운영 HTML은 변경하지 않은 채 18번 테스트 페이지에서 먼저 검증합니다.",
    `문제가 생기면 ${fileNames.rollbackHtml} 전체 내용으로 즉시 복구합니다.`,
    "",
    "## 1. GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${fileNames.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type=\"${candidate.assets.css.contentType}\" --content-encoding=gzip --cache-control=\"${IMMUTABLE_CACHE_CONTROL}\"`,
    "",
    `gcloud storage cp ${fileNames.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type=\"${candidate.assets.js.contentType}\" --content-encoding=br --cache-control=\"${IMMUTABLE_CACHE_CONTROL}\"`,
    "```",
    "",
    "## 2. 업로드 확인",
    "",
    "CSS 응답은 Content-Encoding: gzip, JS 응답은 Content-Encoding: br이어야 합니다.",
    "두 객체 모두 Cache-Control: public, max-age=31536000, immutable이어야 합니다.",
    "",
    "## 3. 18번 테스트 페이지",
    "",
    `eventPlanSeq=18의 전체 HTML을 ${fileNames.deployHtml} 내용으로 교체합니다.`,
    "PC 공개 상태와 모바일 로그인 상태에서 메인 카드, 나의 모임, 내예약, 상품상세, 기간 변경, 모달 닫기 후 스크롤을 확인합니다.",
    "Network에서 CSS 1개와 JS 1개가 각각 정상 응답하며 외부 자산 실패 표시가 없어야 합니다.",
    "",
    "## 4. 복구",
    "",
    `문제가 하나라도 있으면 운영 전환하지 말고 ${fileNames.rollbackHtml}을 사용합니다. GCS 객체는 삭제하지 않습니다.`,
    ""
  ].join("\n");
}

async function prepareBrotliPackage(rawOptions = {}) {
  const output = assertInsideWorkspace(rawOptions.output || DEFAULT_OUTPUT, "output");
  if (fs.existsSync(output)) throw new Error(`output_already_exists:${output}`);
  const candidate = await buildBrotliCandidate(rawOptions);
  const deployHash = sha256(candidate.candidateHtml);
  const rollbackHash = sha256(candidate.sourceHtml);
  const cssEncodedHash = sha256(candidate.cssGzip);
  const jsEncodedHash = sha256(candidate.jsBrotli);
  const jsLogicalHash = sha256(candidate.minifiedJs);
  const fileNames = {
    deployHtml: `DEPLOY_golfjoin_main_brotli_${deployHash.slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_critical_${rollbackHash.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${cssEncodedHash.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${jsEncodedHash.slice(0, 8).toUpperCase()}.js.br`,
    auditJs: `AUDIT_golfjoin-main_${jsLogicalHash.slice(0, 8).toUpperCase()}.min.js`
  };
  const runbook = Buffer.from(buildRunbook(candidate, fileNames), "utf8");
  const files = {
    deployHtml: fileRecord(fileNames.deployHtml, candidate.candidateHtml),
    rollbackHtml: fileRecord(fileNames.rollbackHtml, candidate.sourceHtml),
    css: fileRecord(fileNames.css, candidate.cssGzip, {
      logicalBytes: candidate.css.length,
      logicalSha256: sha256(candidate.css),
      sri: candidate.assets.css.logicalSri,
      url: candidate.assets.css.url,
      objectName: candidate.assets.css.objectName,
      contentType: candidate.assets.css.contentType,
      contentEncoding: candidate.assets.css.contentEncoding,
      cacheControl: IMMUTABLE_CACHE_CONTROL
    }),
    js: fileRecord(fileNames.js, candidate.jsBrotli, {
      logicalBytes: candidate.minifiedJs.length,
      logicalSha256: jsLogicalHash,
      originalLogicalBytes: candidate.js.length,
      originalLogicalSha256: sha256(candidate.js),
      sri: candidate.assets.js.logicalSri,
      url: candidate.assets.js.url,
      objectName: candidate.assets.js.objectName,
      contentType: candidate.assets.js.contentType,
      contentEncoding: candidate.assets.js.contentEncoding,
      cacheControl: IMMUTABLE_CACHE_CONTROL
    }),
    auditJs: fileRecord(fileNames.auditJs, candidate.minifiedJs),
    sourceManifest: fileRecord("SOURCE_production_manifest.json", candidate.sourceManifestBuffer),
    runbook: fileRecord("RUNBOOK.md", runbook)
  };
  const manifest = {
    schema: "secret-golf-join-minified-brotli-deployment-v1",
    preparedAt: candidate.generatedAt,
    status: "ready-for-local-verification",
    stagingEventPlanSeq: 18,
    productionEventPlanSeq: 3,
    sourceAssetRevision: candidate.sourceManifest.assetRevision,
    assetRevision: candidate.assetRevision,
    sourceProductionHtmlSha256: sha256(candidate.sourceHtml),
    requiresGcsUpload: true,
    browserReadEnabled: false,
    minifier: {
      name: "terser",
      version: EXPECTED_TERSER_VERSION,
      compressPasses: 2,
      mangle: true,
      topLevel: false,
      inlineHandlerBridge: true,
      inlineHandlerCount: candidate.inlineHandlerNames.length,
      inlineHandlerNames: candidate.inlineHandlerNames
    },
    delivery: {
      css: "gzip",
      javascript: "br",
      brotliQuality: BROTLI_QUALITY
    },
    javascriptBudgetBytes: JAVASCRIPT_BUDGET_BYTES,
    javascriptBrotliBytes: candidate.jsBrotli.length,
    javascriptBudgetPassed: candidate.jsBrotli.length <= JAVASCRIPT_BUDGET_BYTES,
    javascriptRawReductionBytes: candidate.js.length - candidate.minifiedJs.length,
    javascriptRawReductionPercent: Number(((1 - candidate.minifiedJs.length / candidate.js.length) * 100).toFixed(1)),
    revisionOccurrenceCount: candidate.revisionOccurrenceCount,
    inlineScriptCount: candidate.inlineScriptCount,
    stagingVerification: { status: "pending-gcs-upload" },
    recoveryTargetMinutes: 5,
    files
  };

  fs.mkdirSync(output, { recursive: false });
  writeExclusive(output, fileNames.deployHtml, candidate.candidateHtml);
  writeExclusive(output, fileNames.rollbackHtml, candidate.sourceHtml);
  writeExclusive(output, fileNames.css, candidate.cssGzip);
  writeExclusive(output, fileNames.js, candidate.jsBrotli);
  writeExclusive(output, fileNames.auditJs, candidate.minifiedJs);
  writeExclusive(output, "SOURCE_production_manifest.json", candidate.sourceManifestBuffer);
  writeExclusive(output, "RUNBOOK.md", runbook);
  writeExclusive(output, "manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  return { outputRoot: output, manifest };
}

async function main() {
  const result = await prepareBrotliPackage(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  BROTLI_QUALITY,
  JAVASCRIPT_BUDGET_BYTES,
  EXPECTED_TERSER_VERSION,
  parseArgs,
  replaceExact,
  replaceAllRequired,
  collectInlineHandlerNames,
  buildInlineHandlerBridge,
  minifyJavaScript,
  brotliCompressJavaScript,
  buildBrotliCandidate,
  prepareBrotliPackage
};
