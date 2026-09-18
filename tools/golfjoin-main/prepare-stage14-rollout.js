"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const {
  IMMUTABLE_CACHE_CONTROL,
  sha256,
  sriSha256
} = require("./external-assets");
const {
  BROTLI_QUALITY,
  JAVASCRIPT_BUDGET_BYTES,
  EXPECTED_TERSER_VERSION,
  collectInlineHandlerNames,
  minifyJavaScript,
  brotliCompressJavaScript
} = require("./prepare-stage13-brotli-js");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(WORKSPACE_ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST_PATH = path.join(SOURCE_ROOT, "source-manifest.json");
const DEFAULT_SOURCE_PACKAGE = path.join(
  WORKSPACE_ROOT,
  "deploy/stage14-rollout/home-data-v2-50pct-20260814"
);
const DEFAULT_OUTPUT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage14-rollout/home-data-v2-100pct-20260814"
);
const PREVIOUS_ROLLOUT_BASIS_POINTS = 5000;
const TARGET_ROLLOUT_BASIS_POINTS = 10000;
const ROLLOUT_SYMBOL = "GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS";

function assertInsideWorkspace(input, label) {
  const resolved = path.resolve(input);
  const relative = path.relative(WORKSPACE_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_workspace:${resolved}`);
  }
  return resolved;
}

function parseArgs(argv = []) {
  return argv.reduce((options, argument) => {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match) throw new Error(`unknown_argument:${argument}`);
    const [, name, value] = match;
    if (name === "source-package") options.sourcePackage = value;
    else if (name === "output") options.output = value;
    else if (name === "generated-at") options.generatedAt = value;
    else throw new Error(`unknown_argument:${argument}`);
    return options;
  }, {});
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
  if (sha256(buffer) !== String(record.sha256).toLowerCase()) {
    throw new Error(`${label}_hash_mismatch`);
  }
  return buffer;
}

function replaceExact(source, target, replacement, expectedCount, label) {
  const count = String(source).split(target).length - 1;
  if (count !== expectedCount) throw new Error(`${label}_count_invalid:${count}`);
  return String(source).split(target).join(replacement);
}

function replaceAllRequired(source, target, replacement, label) {
  const count = String(source).split(target).length - 1;
  if (!count) throw new Error(`${label}_missing`);
  return { value: String(source).split(target).join(replacement), count };
}

function collectSourceAssets(manifest = readJson(SOURCE_MANIFEST_PATH)) {
  const scriptPaths = manifest.sourceOrder.filter((relativePath) => (
    relativePath.startsWith("source/scripts/") && relativePath.endsWith(".js")
  ));
  if (!scriptPaths.length) throw new Error("source_scripts_missing");
  const cssPath = "source/styles/10-main.css";
  if (!manifest.sourceOrder.includes(cssPath)) throw new Error("source_css_missing");
  const js = Buffer.concat(scriptPaths.map((relativePath) => (
    fs.readFileSync(path.join(SOURCE_ROOT, relativePath))
  )));
  const css = fs.readFileSync(path.join(SOURCE_ROOT, cssPath));
  new vm.Script(js.toString("utf8"), { filename: "stage14-golfjoin-main.source.js" });
  return { manifest, js, css, scriptPaths };
}

function assertOnlyRolloutChanged(candidateJs, previousLogicalSha256) {
  const target = `const ${ROLLOUT_SYMBOL} = ${TARGET_ROLLOUT_BASIS_POINTS};`;
  const previous = `const ${ROLLOUT_SYMBOL} = ${PREVIOUS_ROLLOUT_BASIS_POINTS};`;
  const reconstructedPrevious = replaceExact(
    candidateJs.toString("utf8"),
    target,
    previous,
    1,
    "target_rollout"
  );
  const reconstructedBuffer = Buffer.from(reconstructedPrevious, "utf8");
  if (sha256(reconstructedBuffer) !== String(previousLogicalSha256).toLowerCase()) {
    throw new Error("source_changed_beyond_rollout_basis_points");
  }
  return reconstructedBuffer;
}

function verifyInlineScripts(html) {
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = pattern.exec(html))) {
    const source = match[1].trim();
    if (!source) continue;
    new vm.Script(source, { filename: `stage14-inline-${count + 1}.js` });
    count += 1;
  }
  return count;
}

function extractCriticalCss(html) {
  const match = String(html).match(/<style data-golfjoin-critical-css="([^"]+)">\n([\s\S]*?)<\/style>/);
  if (!match) throw new Error("critical_css_block_missing");
  return { marker: match[1], css: match[2] };
}

function publicUrl(objectName) {
  const encodedObject = objectName.split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/golfjoin-bucket/${encodedObject}`;
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

async function buildStage14Candidate(rawOptions = {}) {
  const sourcePackage = assertInsideWorkspace(
    rawOptions.sourcePackage || DEFAULT_SOURCE_PACKAGE,
    "source_package"
  );
  const generatedAt = String(rawOptions.generatedAt || new Date().toISOString());
  const sourcePackageManifestBuffer = fs.readFileSync(path.join(sourcePackage, "manifest.json"));
  const sourcePackageManifest = JSON.parse(sourcePackageManifestBuffer.toString("utf8"));
  if (sourcePackageManifest.status !== "production-deployed-verified") {
    throw new Error(`source_package_not_production_verified:${sourcePackageManifest.status || "missing"}`);
  }
  if (sourcePackageManifest.assetRevision !== "gha_a15f2d1627468db50f6191b4") {
    throw new Error(`unexpected_production_asset_revision:${sourcePackageManifest.assetRevision || "missing"}`);
  }
  if (sourcePackageManifest.files?.js?.contentEncoding !== "br"
    || sourcePackageManifest.files?.css?.contentEncoding !== "gzip") {
    throw new Error("source_package_encoding_invalid");
  }

  const sourceHtml = readVerifiedFile(sourcePackage, sourcePackageManifest.files.deployHtml, "source_html");
  const cssGzip = readVerifiedFile(sourcePackage, sourcePackageManifest.files.css, "source_css");
  const sourceAssets = collectSourceAssets();
  const cssRoundtrip = zlib.gunzipSync(cssGzip);
  if (!cssRoundtrip.equals(sourceAssets.css)) throw new Error("source_css_not_current_production");
  if (sha256(sourceAssets.css) !== sourcePackageManifest.files.css.logicalSha256) {
    throw new Error("source_css_logical_hash_mismatch");
  }
  assertOnlyRolloutChanged(
    sourceAssets.js,
    sourcePackageManifest.files.js.originalLogicalSha256
  );

  const sourceHtmlText = sourceHtml.toString("utf8");
  const inlineHandlerNames = collectInlineHandlerNames(sourceHtmlText, sourceAssets.js.toString("utf8"));
  if (!sameStringArray(inlineHandlerNames, sourcePackageManifest.minifier.inlineHandlerNames)) {
    throw new Error("inline_handler_surface_changed");
  }
  const minifiedJs = await minifyJavaScript(sourceAssets.js.toString("utf8"), {
    handlerNames: inlineHandlerNames
  });
  const jsBrotli = brotliCompressJavaScript(minifiedJs);
  if (!zlib.brotliDecompressSync(jsBrotli).equals(minifiedJs)) {
    throw new Error("javascript_brotli_roundtrip_failed");
  }
  if (jsBrotli.length > JAVASCRIPT_BUDGET_BYTES) {
    throw new Error(`javascript_brotli_budget_exceeded:${jsBrotli.length}`);
  }

  const revisionMaterial = Buffer.concat([
    sourceAssets.css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    minifiedJs,
    Buffer.from("\n--golfjoin-delivery-css-gzip-js-br-v1--\n")
  ]);
  const assetRevision = `gha_${sha256(revisionMaterial).slice(0, 24)}`;
  const objectPrefix = `web/home-assets/${assetRevision}`;
  const cssObjectName = `${objectPrefix}/golfjoin-main.css`;
  const jsObjectName = `${objectPrefix}/golfjoin-main.js`;
  const cssUrl = publicUrl(cssObjectName);
  const jsUrl = publicUrl(jsObjectName);
  const newJsSri = sriSha256(minifiedJs);
  const oldRevision = sourcePackageManifest.assetRevision;
  const oldJsSri = sourcePackageManifest.files.js.sri;

  const revisionReplacement = replaceAllRequired(
    sourceHtmlText,
    oldRevision,
    assetRevision,
    "source_asset_revision"
  );
  const candidateHtmlText = replaceExact(
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
  const oldCritical = extractCriticalCss(sourceHtmlText);
  const newCritical = extractCriticalCss(candidateHtmlText);
  if (oldCritical.marker !== newCritical.marker || oldCritical.css !== newCritical.css) {
    throw new Error("critical_css_changed");
  }
  const inlineScriptCount = verifyInlineScripts(candidateHtmlText);

  return {
    generatedAt,
    sourcePackage,
    sourcePackageManifest,
    sourcePackageManifestBuffer,
    sourceManifestBuffer: fs.readFileSync(SOURCE_MANIFEST_PATH),
    sourceHtml,
    css: sourceAssets.css,
    cssGzip,
    rawJs: sourceAssets.js,
    minifiedJs,
    jsBrotli,
    candidateHtml: Buffer.from(candidateHtmlText, "utf8"),
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
        logicalSri: sriSha256(sourceAssets.css)
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

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function buildStage14FullRolloutRunbook(candidate, fileNames) {
  const rollbackHash = candidate.sourcePackageManifest.files.deployHtml.sha256
    .slice(0, 8)
    .toUpperCase();
  return [
    "# 14단계 Release V2 비로그인 100% 전환",
    "",
    "현재 50% 운영본을 기준으로 비로그인 이용자의 Release V2 비율만 100%로 올립니다.",
    "로그인 이용자는 기존 회원 경로를 계속 사용하며, Legacy 코드와 원격 Gate OFF 복구 수단도 유지합니다.",
    `문제가 생기면 ${fileNames.rollbackHtml} 전체 내용으로 현재 운영 ${rollbackHash} 상태를 복구합니다.`,
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. GCS에 CSS gzip과 JavaScript Brotli를 업로드한다.",
    "- [ ] 2. HTTP 200, MIME, Content-Encoding, CORS, immutable 응답을 검사한다.",
    "- [ ] 3. eventPlanSeq 22에 후보 HTML을 저장한다.",
    "- [ ] 4. 비로그인 최고 유효 bucket 9999가 V2_RUNNING인지 확인한다.",
    "- [ ] 5. 로그인 이용자가 member_not_eligible이고 Release 요청을 만들지 않는지 확인한다.",
    "- [ ] 6. 원격 Gate OFF에서 비로그인도 LEGACY_READY로 즉시 복귀하는지 확인한다.",
    "- [ ] 7. PC와 모바일의 핵심 UI와 상품상세를 확인한다.",
    "- [ ] 8. 운영 HTML을 교체하고 같은 검사를 반복한다.",
    "",
    "## 1. GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${fileNames.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type=\"${candidate.assets.css.contentType}\" --content-encoding=gzip --cache-control=\"${IMMUTABLE_CACHE_CONTROL}\"`,
    "",
    `gcloud storage cp ${fileNames.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type=\"${candidate.assets.js.contentType}\" --content-encoding=br --cache-control=\"${IMMUTABLE_CACHE_CONTROL}\"`,
    "```",
    "",
    "## 2. 테스트 게시판",
    "",
    `eventPlanSeq 22의 전체 HTML을 ${fileNames.deployHtml} 내용으로 교체합니다.`,
    "비로그인 DevTools Console에서 최고 유효 bucket 9999를 고정하고 새로고침합니다.",
    "",
    "```javascript",
    "localStorage.setItem('golfjoin_home_data_v2_rollout_bucket_v1', '9999'); location.reload();",
    "```",
    "",
    "새로고침 후 다음 진단을 실행합니다.",
    "",
    "```javascript",
    "getGolfJoinHomeDataV2Diagnostics()",
    "// rolloutBasisPoints: 10000, rolloutEligible: true, state: 'V2_RUNNING', requestCount: 3",
    "```",
    "",
    "로그인 상태에서는 bucket 값과 무관하게 `reason: 'member_not_eligible'`이고 Release 요청이 없어야 합니다.",
    "100%에서는 유효 익명 bucket이 0~9999이므로 별도의 익명 미대상 bucket은 존재하지 않습니다.",
    "",
    "## 3. Release V2 즉시 중단",
    "",
    "화면은 정상이지만 V2 데이터 문제가 있으면 HTML 교체 전에 아래 명령으로 신규 데이터 읽기만 즉시 중단합니다.",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "node release-admin-cli.js gate-off --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "```",
    "",
    "## 4. HTML 복구",
    "",
    `외부 자산, SRI 또는 UI 문제가 있으면 ${fileNames.rollbackHtml} 전체 내용으로 복구합니다. GCS 불변 객체는 삭제하지 않습니다.`,
    ""
  ].join("\n");
}

function writeExclusive(root, fileName, buffer) {
  fs.writeFileSync(path.join(root, fileName), buffer, { flag: "wx" });
}

function buildRunbook(candidate, fileNames) {
  return [
    "# 14단계 Release V2 비로그인 50% 전환",
    "",
    "Legacy 경로는 하나도 삭제하지 않고 Release V2 대상 비율만 10%에서 50%로 바꾼 후보입니다.",
    `문제가 생기면 ${fileNames.rollbackHtml} 전체 내용으로 현재 운영 ${candidate.sourcePackageManifest.files.deployHtml.sha256.slice(0, 8).toUpperCase()} 상태를 복구합니다.`,
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. GCS에 CSS gzip과 JavaScript Brotli를 업로드한다.",
    "- [ ] 2. 원격 응답의 HTTP 200·MIME·Content-Encoding·CORS·immutable을 검사한다.",
    "- [ ] 3. eventPlanSeq 21에 후보 HTML을 저장한다.",
    "- [ ] 4. 비로그인 bucket 4999가 V2_RUNNING인지 확인한다.",
    "- [ ] 5. 비로그인 bucket 5000이 LEGACY_READY인지 확인한다.",
    "- [ ] 6. 로그인 사용자는 bucket 0이어도 member_not_eligible인지 확인한다.",
    "- [ ] 7. PC·모바일 핵심 UI를 확인한다.",
    "- [ ] 8. 운영 HTML을 교체하고 같은 검사를 반복한다.",
    "",
    "## 1. GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${fileNames.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type=\"${candidate.assets.css.contentType}\" --content-encoding=gzip --cache-control=\"${IMMUTABLE_CACHE_CONTROL}\"`,
    "",
    `gcloud storage cp ${fileNames.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type=\"${candidate.assets.js.contentType}\" --content-encoding=br --cache-control=\"${IMMUTABLE_CACHE_CONTROL}\"`,
    "```",
    "",
    "## 2. 테스트 게시판",
    "",
    `eventPlanSeq 21의 전체 HTML을 ${fileNames.deployHtml} 내용으로 교체합니다.`,
    "비로그인 DevTools Console에서 아래처럼 bucket 4999를 고정한 뒤 새로고침합니다.",
    "",
    "```javascript",
    "localStorage.setItem('golfjoin_home_data_v2_rollout_bucket_v1', '4999'); location.reload();",
    "```",
    "",
    "새로고침 후 Console에서 아래 결과를 확인합니다.",
    "",
    "```javascript",
    "getGolfJoinHomeDataV2Diagnostics()",
    "// rolloutBasisPoints: 5000, rolloutEligible: true, state: 'V2_RUNNING', requestCount: 3",
    "```",
    "",
    "그다음 bucket을 5000으로 바꾸고 새로고침합니다. `rolloutEligible: false`, `state: 'LEGACY_READY'`, `requestCount: 0`이어야 합니다.",
    "로그인 상태에서는 bucket 0이어도 `reason: 'member_not_eligible'`이며 Release 요청이 없어야 합니다.",
    "",
    "## 3. Release V2 즉시 중단",
    "",
    "화면은 정상인데 V2 데이터 문제가 있으면 HTML을 바꾸기 전에 아래 명령으로 신규 데이터 읽기만 즉시 끕니다.",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "node release-admin-cli.js gate-off --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "```",
    "",
    "## 4. HTML 복구",
    "",
    `외부 자산·SRI·UI 문제가 있으면 ${fileNames.rollbackHtml} 전체 내용으로 복구합니다. GCS 불변 객체는 삭제하지 않습니다.`,
    ""
  ].join("\n");
}

async function prepareStage14Package(rawOptions = {}) {
  const output = assertInsideWorkspace(rawOptions.output || DEFAULT_OUTPUT, "output");
  if (fs.existsSync(output)) throw new Error(`output_already_exists:${output}`);
  const candidate = await buildStage14Candidate(rawOptions);
  const deployHash = sha256(candidate.candidateHtml);
  const rollbackHash = sha256(candidate.sourceHtml);
  const cssEncodedHash = sha256(candidate.cssGzip);
  const jsEncodedHash = sha256(candidate.jsBrotli);
  const jsLogicalHash = sha256(candidate.minifiedJs);
  const fileNames = {
    deployHtml: `DEPLOY_golfjoin_main_home_data_v2_100pct_${deployHash.slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${rollbackHash.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${cssEncodedHash.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${jsEncodedHash.slice(0, 8).toUpperCase()}.js.br`,
    auditJs: `AUDIT_golfjoin-main_${jsLogicalHash.slice(0, 8).toUpperCase()}.min.js`
  };
  const runbook = Buffer.from(buildStage14FullRolloutRunbook(candidate, fileNames), "utf8");
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
      originalLogicalBytes: candidate.rawJs.length,
      originalLogicalSha256: sha256(candidate.rawJs),
      sri: candidate.assets.js.logicalSri,
      url: candidate.assets.js.url,
      objectName: candidate.assets.js.objectName,
      contentType: candidate.assets.js.contentType,
      contentEncoding: candidate.assets.js.contentEncoding,
      cacheControl: IMMUTABLE_CACHE_CONTROL
    }),
    auditJs: fileRecord(fileNames.auditJs, candidate.minifiedJs),
    sourceManifest: fileRecord("SOURCE_golfjoin-main_manifest.json", candidate.sourceManifestBuffer),
    sourcePackageManifest: fileRecord("SOURCE_production_package_manifest.json", candidate.sourcePackageManifestBuffer),
    runbook: fileRecord("RUNBOOK.md", runbook)
  };
  const manifest = {
    schema: "secret-golf-join-stage14-home-data-rollout-v1",
    preparedAt: candidate.generatedAt,
    status: "ready-for-local-verification",
    stagingEventPlanSeq: 22,
    productionEventPlanSeq: 3,
    sourceAssetRevision: candidate.sourcePackageManifest.assetRevision,
    assetRevision: candidate.assetRevision,
    sourceProductionHtmlSha256: sha256(candidate.sourceHtml),
    requiresGcsUpload: true,
    legacyCodeRemoved: false,
    rollout: {
      feature: "homeDataV2",
      audience: "anonymous-only",
      previousBasisPoints: PREVIOUS_ROLLOUT_BASIS_POINTS,
      targetBasisPoints: TARGET_ROLLOUT_BASIS_POINTS,
      previousPercent: 50,
      targetPercent: 100,
      remoteKillSwitch: "release-admin-cli.js gate-off"
    },
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
    delivery: { css: "gzip", javascript: "br", brotliQuality: BROTLI_QUALITY },
    javascriptBudgetBytes: JAVASCRIPT_BUDGET_BYTES,
    javascriptBrotliBytes: candidate.jsBrotli.length,
    javascriptBudgetPassed: candidate.jsBrotli.length <= JAVASCRIPT_BUDGET_BYTES,
    revisionOccurrenceCount: candidate.revisionOccurrenceCount,
    inlineScriptCount: candidate.inlineScriptCount,
    localVerification: { status: "pending" },
    remoteVerification: { status: "pending-gcs-upload" },
    stagingVerification: { status: "pending" },
    recoveryTargetMinutes: 5,
    files
  };

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.mkdirSync(output, { recursive: false });
  writeExclusive(output, fileNames.deployHtml, candidate.candidateHtml);
  writeExclusive(output, fileNames.rollbackHtml, candidate.sourceHtml);
  writeExclusive(output, fileNames.css, candidate.cssGzip);
  writeExclusive(output, fileNames.js, candidate.jsBrotli);
  writeExclusive(output, fileNames.auditJs, candidate.minifiedJs);
  writeExclusive(output, "SOURCE_golfjoin-main_manifest.json", candidate.sourceManifestBuffer);
  writeExclusive(output, "SOURCE_production_package_manifest.json", candidate.sourcePackageManifestBuffer);
  writeExclusive(output, "RUNBOOK.md", runbook);
  writeExclusive(output, "manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  return { outputRoot: output, manifest };
}

async function main() {
  const result = await prepareStage14Package(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  PREVIOUS_ROLLOUT_BASIS_POINTS,
  TARGET_ROLLOUT_BASIS_POINTS,
  ROLLOUT_SYMBOL,
  parseArgs,
  replaceExact,
  assertOnlyRolloutChanged,
  collectSourceAssets,
  buildStage14Candidate,
  prepareStage14Package
};
