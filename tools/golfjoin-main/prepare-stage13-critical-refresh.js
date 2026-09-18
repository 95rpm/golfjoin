"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { buildCriticalHtml, revisionForCriticalCss } = require("./critical-css");
const { sha256 } = require("./external-assets");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

function assertInsideWorkspace(input, label) {
  const resolved = path.resolve(WORKSPACE_ROOT, input);
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
    if (name === "asset-root") options.assetRoot = value;
    else if (name === "critical-source") options.criticalSource = value;
    else if (name === "rollback") options.rollback = value;
    else if (name === "output") options.output = value;
    else throw new Error(`unknown_argument:${argument}`);
  }
  for (const required of ["assetRoot", "criticalSource", "rollback", "output"]) {
    if (!options[required]) throw new Error(`required_argument_missing:${required}`);
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function writeFile(outputRoot, fileName, buffer) {
  fs.writeFileSync(path.join(outputRoot, fileName), buffer, { flag: "wx" });
}

function verifyInlineScripts(html) {
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = pattern.exec(html))) {
    const source = match[1].trim();
    if (!source) continue;
    new vm.Script(source, { filename: `critical-refresh-inline-${count + 1}.js` });
    count += 1;
  }
  return count;
}

function verifyReusableCriticalCss(assetRoot, criticalSource, publication) {
  const oldCandidatePublication = readJson(path.join(criticalSource, "publication.json"));
  const oldAssetRoot = path.join(
    WORKSPACE_ROOT,
    "dist/golfjoin-main/external-assets",
    oldCandidatePublication.fullAssetRevision
  );
  const oldAssetPublication = readJson(path.join(oldAssetRoot, "publication.json"));
  const oldCssHash = oldAssetPublication.assets?.css?.sha256;
  const newCssHash = publication.assets?.css?.sha256;
  if (!oldCssHash || oldCssHash !== newCssHash) {
    throw new Error(`critical_css_reuse_source_changed:${oldCssHash || "missing"}:${newCssHash || "missing"}`);
  }
  const fullCss = fs.readFileSync(path.join(assetRoot, "golfjoin-main.css"));
  if (sha256(fullCss) !== newCssHash) throw new Error("critical_refresh_full_css_hash_mismatch");
  const criticalCss = fs.readFileSync(path.join(criticalSource, "critical.css"));
  if (sha256(criticalCss) !== oldCandidatePublication.criticalCssSha256) {
    throw new Error("critical_refresh_reused_css_hash_mismatch");
  }
  return { criticalCss, oldCandidatePublication, oldAssetPublication };
}

function prepareCriticalRefresh(rawOptions) {
  const options = {
    assetRoot: assertInsideWorkspace(rawOptions.assetRoot, "asset_root"),
    criticalSource: assertInsideWorkspace(rawOptions.criticalSource, "critical_source"),
    rollback: assertInsideWorkspace(rawOptions.rollback, "rollback"),
    output: assertInsideWorkspace(rawOptions.output, "output")
  };
  if (fs.existsSync(options.output)) throw new Error(`output_already_exists:${options.output}`);

  const publication = readJson(path.join(options.assetRoot, "publication.json"));
  if (publication.contentEncoding !== "gzip") throw new Error("critical_refresh_asset_not_gzip");
  const externalHtml = fs.readFileSync(path.join(options.assetRoot, "golfjoin_main_external.html"));
  const cssGzip = fs.readFileSync(path.join(options.assetRoot, "golfjoin-main.css.gz"));
  const jsGzip = fs.readFileSync(path.join(options.assetRoot, "golfjoin-main.js.gz"));
  const productionRollback = fs.readFileSync(options.rollback);
  const { criticalCss, oldCandidatePublication } = verifyReusableCriticalCss(
    options.assetRoot,
    options.criticalSource,
    publication
  );

  if (sha256(externalHtml) !== publication.candidateHtmlSha256) {
    throw new Error("critical_refresh_external_html_hash_mismatch");
  }
  if (sha256(cssGzip) !== publication.assets.css.encodedSha256) {
    throw new Error("critical_refresh_css_gzip_hash_mismatch");
  }
  if (sha256(jsGzip) !== publication.assets.js.encodedSha256) {
    throw new Error("critical_refresh_js_gzip_hash_mismatch");
  }

  const bundle = {
    artifacts: { html: { buffer: externalHtml } },
    publication: { assets: { css: publication.assets.css } }
  };
  const candidateHtml = buildCriticalHtml(bundle, criticalCss.toString("utf8"));
  const candidateHash = sha256(candidateHtml);
  const criticalRevision = revisionForCriticalCss(publication.assetRevision, criticalCss);
  const criticalGzipBytes = zlib.gzipSync(criticalCss, { level: 9, mtime: 0 }).length;
  if (criticalGzipBytes > 30 * 1024) throw new Error(`critical_css_budget_exceeded:${criticalGzipBytes}`);
  const inlineScriptCount = verifyInlineScripts(candidateHtml.toString("utf8"));

  const candidateRoot = path.join(WORKSPACE_ROOT, "dist/golfjoin-main/critical-css", criticalRevision);
  if (fs.existsSync(candidateRoot)) throw new Error(`candidate_already_exists:${candidateRoot}`);
  fs.mkdirSync(candidateRoot, { recursive: true });
  fs.writeFileSync(path.join(candidateRoot, "critical.css"), criticalCss);
  fs.writeFileSync(path.join(candidateRoot, "golfjoin_main_critical_candidate.html"), candidateHtml);
  fs.writeFileSync(path.join(candidateRoot, "golfjoin_main_gzip_rollback.html"), externalHtml);
  const candidatePublication = {
    schema: "secret-golf-join-critical-css-candidate-v1",
    generatedAt: new Date().toISOString(),
    criticalRevision,
    fullAssetRevision: publication.assetRevision,
    reusedFromCriticalRevision: oldCandidatePublication.criticalRevision,
    fullCssSha256: publication.assets.css.sha256,
    sourceHtmlSha256: publication.candidateHtmlSha256,
    candidateHtmlSha256: candidateHash,
    candidateHtmlBytes: candidateHtml.length,
    candidateHtmlGzipBytes: zlib.gzipSync(candidateHtml, { level: 9, mtime: 0 }).length,
    rollbackHtmlSha256: publication.candidateHtmlSha256,
    rollbackHtmlBytes: externalHtml.length,
    rollbackHtmlGzipBytes: zlib.gzipSync(externalHtml, { level: 9, mtime: 0 }).length,
    criticalCssBytes: criticalCss.length,
    criticalCssGzipBytes: criticalGzipBytes,
    criticalCssSha256: sha256(criticalCss),
    criticalCssBudgetBytes: 30 * 1024,
    criticalCssBudgetPassed: true,
    browserReadEnabled: false
  };
  fs.writeFileSync(
    path.join(candidateRoot, "publication.json"),
    `${JSON.stringify(candidatePublication, null, 2)}\n`,
    "utf8"
  );

  fs.mkdirSync(options.output, { recursive: true });
  const deployName = `DEPLOY_golfjoin_main_critical_${candidateHash.slice(0, 8).toUpperCase()}.html`;
  const rollbackHash = sha256(productionRollback);
  const rollbackName = `ROLLBACK_golfjoin_main_gzip_${rollbackHash.slice(0, 8).toUpperCase()}.html`;
  const criticalName = `AUDIT_critical_${sha256(criticalCss).slice(0, 8).toUpperCase()}.css`;
  const cssName = `UPLOAD_golfjoin-main_${publication.assets.css.encodedSha256.slice(0, 8).toUpperCase()}.css.gz`;
  const jsName = `UPLOAD_golfjoin-main_${publication.assets.js.encodedSha256.slice(0, 8).toUpperCase()}.js.gz`;
  const sourcePublication = fs.readFileSync(path.join(options.assetRoot, "publication.json"));
  const candidatePublicationBuffer = Buffer.from(`${JSON.stringify(candidatePublication, null, 2)}\n`, "utf8");

  writeFile(options.output, deployName, candidateHtml);
  writeFile(options.output, rollbackName, productionRollback);
  writeFile(options.output, criticalName, criticalCss);
  writeFile(options.output, cssName, cssGzip);
  writeFile(options.output, jsName, jsGzip);
  writeFile(options.output, "SOURCE_asset_publication.json", sourcePublication);
  writeFile(options.output, "SOURCE_critical_publication.json", candidatePublicationBuffer);

  const runbook = [
    "# Stage 13 Critical CSS 갱신 시험본",
    "",
    "## 무엇을 하는 파일인가",
    "내예약 출발일 분류 수정이 들어간 새 JavaScript를 gzip으로 올리고, 첫 화면용 CSS만 HTML에 먼저 넣어 빠르게 표시합니다.",
    "",
    "## 1. GCS 업로드",
    "Cloud Shell의 같은 폴더에 아래 CSS·JS gzip 파일을 업로드한 뒤 실행합니다.",
    "",
    "```bash",
    `gcloud storage cp ${cssName} gs://golfjoin-bucket/${publication.assets.css.objectName} --if-generation-match=0 --content-type=\"text/css; charset=utf-8\" --content-encoding=gzip --cache-control=\"${IMMUTABLE_CACHE_CONTROL}\"`,
    "",
    `gcloud storage cp ${jsName} gs://golfjoin-bucket/${publication.assets.js.objectName} --if-generation-match=0 --content-type=\"application/javascript; charset=utf-8\" --content-encoding=gzip --cache-control=\"${IMMUTABLE_CACHE_CONTROL}\"`,
    "```",
    "",
    "## 2. 18번 시험 페이지",
    `eventPlanSeq=18의 전체 HTML을 ${deployName} 내용으로 교체합니다. 운영 3번 페이지는 아직 수정하지 않습니다.`,
    "",
    "## 즉시 복구",
    `운영 전환 후 문제가 생겼을 때만 ${rollbackName} 전체 내용으로 되돌립니다. GCS 파일은 삭제하지 않습니다.`,
    ""
  ].join("\n");
  writeFile(options.output, "RUNBOOK.md", Buffer.from(runbook, "utf8"));

  const files = {
    deployHtml: fileRecord(deployName, candidateHtml),
    rollbackHtml: fileRecord(rollbackName, productionRollback),
    auditCriticalCss: fileRecord(criticalName, criticalCss),
    css: fileRecord(cssName, cssGzip, {
      logicalBytes: publication.assets.css.bytes,
      logicalSha256: publication.assets.css.sha256,
      sri: publication.assets.css.logicalSri,
      url: publication.assets.css.url,
      objectName: publication.assets.css.objectName,
      contentType: publication.assets.css.contentType,
      contentEncoding: "gzip",
      cacheControl: publication.assets.css.cacheControl
    }),
    js: fileRecord(jsName, jsGzip, {
      logicalBytes: publication.assets.js.bytes,
      logicalSha256: publication.assets.js.sha256,
      sri: publication.assets.js.logicalSri,
      url: publication.assets.js.url,
      objectName: publication.assets.js.objectName,
      contentType: publication.assets.js.contentType,
      contentEncoding: "gzip",
      cacheControl: publication.assets.js.cacheControl
    }),
    sourceAssetPublication: fileRecord("SOURCE_asset_publication.json", sourcePublication),
    sourceCriticalPublication: fileRecord("SOURCE_critical_publication.json", candidatePublicationBuffer),
    runbook: fileRecord("RUNBOOK.md", Buffer.from(runbook, "utf8"))
  };
  const manifest = {
    schema: "secret-golf-join-critical-css-refresh-deployment-v1",
    preparedAt: new Date().toISOString(),
    status: "ready-for-gcs-and-staging",
    stagingEventPlanSeq: 18,
    productionEventPlanSeq: 3,
    assetRevision: publication.assetRevision,
    criticalRevision,
    reusedCriticalRevision: oldCandidatePublication.criticalRevision,
    requiresGcsUpload: true,
    browserReadEnabled: false,
    criticalCssBudgetBytes: 30 * 1024,
    criticalCssGzipBytes: criticalGzipBytes,
    inlineScriptCount,
    performance: { status: "pending-staging-verification" },
    recoveryTargetMinutes: 5,
    files
  };
  fs.writeFileSync(path.join(options.output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { outputRoot: options.output, candidateRoot, manifest };
}

function main() {
  const result = prepareCriticalRefresh(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, prepareCriticalRefresh, verifyInlineScripts, verifyReusableCriticalCss };
