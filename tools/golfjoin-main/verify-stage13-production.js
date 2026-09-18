"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_PACKAGE_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage13-home-assets/production-hotfix2-20260813"
);
const MAIN_HTML_PATH = path.join(WORKSPACE_ROOT, "golfjoin_main.html");
const ORIGINS = ["https://www.secret-tour.com", "https://m.secret-tour.com"];
const SUPPORTED_SCHEMAS = new Set([
  "secret-golf-join-stage13-production-cutover-v1",
  "secret-golf-join-stage13-gzip-cutover-v1"
]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function assert(condition, code, details = {}) {
  if (!condition) {
    const error = new Error(code);
    error.details = details;
    throw error;
  }
}

function inspectFile(packageRoot, spec, role) {
  const filePath = path.join(packageRoot, spec.fileName);
  assert(fs.existsSync(filePath), "package_file_missing", { role, filePath });
  const buffer = fs.readFileSync(filePath);
  const actual = { bytes: buffer.length, sha256: sha256(buffer) };
  assert(actual.bytes === spec.bytes, "package_file_bytes_mismatch", { role, expected: spec.bytes, actual: actual.bytes });
  assert(actual.sha256 === spec.sha256, "package_file_hash_mismatch", { role, expected: spec.sha256, actual: actual.sha256 });
  return { role, filePath, buffer, ...actual };
}

function verifyLocalPackage(packageRoot = DEFAULT_PACKAGE_ROOT, options = {}) {
  const manifestPath = path.join(packageRoot, "manifest.json");
  assert(fs.existsSync(manifestPath), "cutover_manifest_missing", { manifestPath });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(SUPPORTED_SCHEMAS.has(manifest.schema), "cutover_manifest_schema_invalid");
  assert(/^gha_[a-f0-9]{24}$/.test(String(manifest.assetRevision || "")), "cutover_asset_revision_invalid");

  const inspected = {};
  for (const [role, spec] of Object.entries(manifest.files)) {
    inspected[role] = inspectFile(packageRoot, spec, role);
  }

  const deployHtml = inspected.deployHtml.buffer.toString("utf8");
  const rollbackHtml = inspected.rollbackHtml.buffer;
  const currentMainHtml = options.requireCurrentMain === false ? null : fs.readFileSync(MAIN_HTML_PATH);
  const css = manifest.files.css;
  const js = manifest.files.js;

  assert(count(deployHtml, css.url) === 1, "deploy_css_url_count_invalid", { count: count(deployHtml, css.url) });
  assert(count(deployHtml, js.url) === 1, "deploy_js_url_count_invalid", { count: count(deployHtml, js.url) });
  assert(deployHtml.includes(`integrity="${css.sri}"`), "deploy_css_sri_missing");
  assert(deployHtml.includes(`integrity="${js.sri}"`), "deploy_js_sri_missing");
  assert(
    /id="golfJoinExternalAssetFailureNotice"[^>]+display:none/.test(deployHtml),
    "deploy_failure_notice_not_hidden"
  );
  assert(deployHtml.includes('notice.style.display="flex"'), "deploy_failure_notice_reveal_missing");
  if (currentMainHtml) {
    assert(sha256(rollbackHtml) === sha256(currentMainHtml), "rollback_does_not_match_current_main", {
      rollback: sha256(rollbackHtml),
      currentMain: sha256(currentMainHtml)
    });
  }

  const publication = JSON.parse(inspected.sourcePublication.buffer.toString("utf8"));
  assert(publication.assetRevision === manifest.assetRevision, "source_publication_revision_mismatch");
  assert(publication.candidateHtmlSha256 === manifest.files.deployHtml.sha256, "source_publication_deploy_hash_mismatch");
  assert(publication.sourceHtmlSha256 === manifest.files.rollbackHtml.sha256, "source_publication_rollback_hash_mismatch");
  if (manifest.contentEncoding === "gzip") {
    assert(publication.contentEncoding === "gzip", "source_publication_encoding_mismatch");
    assert(css.contentEncoding === "gzip" && js.contentEncoding === "gzip", "manifest_asset_encoding_mismatch");
    assert(css.logicalSha256 === publication.assets.css.sha256, "manifest_css_logical_hash_mismatch");
    assert(js.logicalSha256 === publication.assets.js.sha256, "manifest_js_logical_hash_mismatch");
  }

  return {
    ok: true,
    packageRoot,
    assetRevision: manifest.assetRevision,
    productionPage: manifest.productionPage,
    recoveryTargetMinutes: manifest.recoveryTargetMinutes,
    files: Object.fromEntries(Object.entries(inspected).map(([role, file]) => [role, {
      fileName: path.basename(file.filePath),
      bytes: file.bytes,
      sha256: file.sha256
    }]))
  };
}

async function verifyRemoteAssets(packageRoot = DEFAULT_PACKAGE_ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  const results = [];

  for (const role of ["css", "js"]) {
    const spec = manifest.files[role];
    for (const origin of ORIGINS) {
      const response = await fetch(spec.url, {
        headers: { Origin: origin },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000)
      });
      assert(response.ok, "remote_asset_http_failed", { role, origin, status: response.status });
      const buffer = Buffer.from(await response.arrayBuffer());
      const actual = {
        role,
        origin,
        status: response.status,
        bytes: buffer.length,
        sha256: sha256(buffer),
        encodedBytes: Number(response.headers.get("content-length") || 0),
        contentEncoding: String(response.headers.get("content-encoding") || "identity").toLowerCase(),
        contentType: String(response.headers.get("content-type") || "").toLowerCase(),
        cacheControl: String(response.headers.get("cache-control") || "").toLowerCase(),
        allowOrigin: String(response.headers.get("access-control-allow-origin") || "")
      };
      const expectedLogicalBytes = Number(spec.logicalBytes || spec.bytes);
      const expectedLogicalSha256 = String(spec.logicalSha256 || spec.sha256);
      assert(actual.bytes === expectedLogicalBytes, "remote_asset_bytes_mismatch", { ...actual, expected: expectedLogicalBytes });
      assert(actual.sha256 === expectedLogicalSha256, "remote_asset_hash_mismatch", { ...actual, expected: expectedLogicalSha256 });
      if (spec.contentEncoding) {
        assert(actual.contentEncoding === spec.contentEncoding, "remote_asset_content_encoding_mismatch", actual);
        assert(actual.encodedBytes === spec.bytes, "remote_asset_encoded_bytes_mismatch", { ...actual, expected: spec.bytes });
      }
      assert(actual.contentType.startsWith(spec.contentType.toLowerCase()), "remote_asset_content_type_mismatch", actual);
      assert(actual.cacheControl === spec.cacheControl.toLowerCase(), "remote_asset_cache_control_mismatch", actual);
      assert(actual.allowOrigin === origin || actual.allowOrigin === "*", "remote_asset_cors_mismatch", actual);
      results.push(actual);
    }
  }
  return { ok: true, checkedAt: new Date().toISOString(), results };
}

async function main(argv = process.argv.slice(2)) {
  const packageArgument = argv.find((argument) => argument.startsWith("--package="));
  const packageRoot = packageArgument
    ? path.resolve(WORKSPACE_ROOT, packageArgument.slice("--package=".length))
    : DEFAULT_PACKAGE_ROOT;
  const packageRelative = path.relative(WORKSPACE_ROOT, packageRoot);
  assert(
    !packageRelative.startsWith("..") && !path.isAbsolute(packageRelative),
    "package_outside_workspace",
    { packageRoot }
  );
  const unknown = argv.filter((argument) => argument !== "--remote" && !argument.startsWith("--package="));
  assert(!unknown.length, "unknown_argument", { unknown });
  const local = verifyLocalPackage(packageRoot);
  const remote = argv.includes("--remote") ? await verifyRemoteAssets(packageRoot) : null;
  console.log(JSON.stringify({ command: "verify-stage13-production", ok: true, local, remote }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({
      command: "verify-stage13-production",
      ok: false,
      error: error.message,
      details: error.details || null
    }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_PACKAGE_ROOT,
  sha256,
  verifyLocalPackage,
  verifyRemoteAssets
};
