"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_PACKAGE_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage14-rollout/home-data-v2-100pct-20260814"
);
const ORIGINS = ["https://www.secret-tour.com", "https://m.secret-tour.com"];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assert(condition, code, details = {}) {
  if (condition) return;
  const error = new Error(code);
  error.details = details;
  throw error;
}

function inspectFile(packageRoot, spec, role) {
  const filePath = path.join(packageRoot, spec.fileName);
  assert(fs.existsSync(filePath), "package_file_missing", { role, filePath });
  const buffer = fs.readFileSync(filePath);
  assert(buffer.length === spec.bytes, "package_file_bytes_mismatch", {
    role,
    expected: spec.bytes,
    actual: buffer.length
  });
  assert(sha256(buffer) === spec.sha256, "package_file_hash_mismatch", {
    role,
    expected: spec.sha256,
    actual: sha256(buffer)
  });
  return buffer;
}

function readPackage(packageRoot = DEFAULT_PACKAGE_ROOT) {
  const resolved = path.resolve(packageRoot);
  const relative = path.relative(WORKSPACE_ROOT, resolved);
  assert(!relative.startsWith("..") && !path.isAbsolute(relative), "package_outside_workspace", { resolved });
  const manifestPath = path.join(resolved, "manifest.json");
  assert(fs.existsSync(manifestPath), "manifest_missing", { manifestPath });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(manifest.schema === "secret-golf-join-stage14-home-data-rollout-v1", "manifest_schema_invalid");
  assert(manifest.rollout?.targetBasisPoints === 10000, "rollout_target_invalid");
  assert(manifest.rollout?.audience === "anonymous-only", "rollout_audience_invalid");
  assert(manifest.legacyCodeRemoved === false, "legacy_removal_invalid");
  return { packageRoot: resolved, manifest };
}

function verifyLocalPackage(packageRoot = DEFAULT_PACKAGE_ROOT) {
  const loaded = readPackage(packageRoot);
  const files = {};
  Object.entries(loaded.manifest.files).forEach(([role, spec]) => {
    const buffer = inspectFile(loaded.packageRoot, spec, role);
    files[role] = { fileName: spec.fileName, bytes: buffer.length, sha256: sha256(buffer) };
  });
  const deployHtml = inspectFile(loaded.packageRoot, loaded.manifest.files.deployHtml, "deployHtml").toString("utf8");
  assert(deployHtml.includes(loaded.manifest.files.css.url), "deploy_css_url_missing");
  assert(deployHtml.includes(loaded.manifest.files.js.url), "deploy_js_url_missing");
  assert(deployHtml.includes(`integrity="${loaded.manifest.files.css.sri}"`), "deploy_css_sri_missing");
  assert(deployHtml.includes(`integrity="${loaded.manifest.files.js.sri}"`), "deploy_js_sri_missing");
  assert(!deployHtml.includes(loaded.manifest.sourceAssetRevision), "old_asset_revision_remains");
  return {
    ok: true,
    packageRoot: loaded.packageRoot,
    assetRevision: loaded.manifest.assetRevision,
    files
  };
}

async function verifyRemoteAssets(packageRoot = DEFAULT_PACKAGE_ROOT) {
  const { manifest } = readPackage(packageRoot);
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
      const logicalBuffer = Buffer.from(await response.arrayBuffer());
      const headers = {
        contentEncoding: String(response.headers.get("content-encoding") || "identity").toLowerCase(),
        contentType: String(response.headers.get("content-type") || "").toLowerCase(),
        cacheControl: String(response.headers.get("cache-control") || "").toLowerCase(),
        allowOrigin: String(response.headers.get("access-control-allow-origin") || ""),
        encodedBytes: Number(response.headers.get("content-length") || 0)
      };
      assert(logicalBuffer.length === spec.logicalBytes, "remote_logical_bytes_mismatch", {
        role,
        origin,
        expected: spec.logicalBytes,
        actual: logicalBuffer.length
      });
      assert(sha256(logicalBuffer) === spec.logicalSha256, "remote_logical_hash_mismatch", {
        role,
        origin,
        expected: spec.logicalSha256,
        actual: sha256(logicalBuffer)
      });
      assert(headers.contentEncoding === spec.contentEncoding, "remote_content_encoding_mismatch", {
        role,
        origin,
        expected: spec.contentEncoding,
        actual: headers.contentEncoding
      });
      assert(headers.contentType.startsWith(spec.contentType.toLowerCase()), "remote_content_type_mismatch", {
        role,
        origin,
        expected: spec.contentType,
        actual: headers.contentType
      });
      assert(headers.cacheControl === spec.cacheControl.toLowerCase(), "remote_cache_control_mismatch", {
        role,
        origin,
        expected: spec.cacheControl,
        actual: headers.cacheControl
      });
      assert(headers.allowOrigin === origin || headers.allowOrigin === "*", "remote_cors_mismatch", {
        role,
        origin,
        actual: headers.allowOrigin
      });
      assert(headers.encodedBytes === spec.bytes, "remote_encoded_bytes_mismatch", {
        role,
        origin,
        expected: spec.bytes,
        actual: headers.encodedBytes
      });
      results.push({
        role,
        origin,
        status: response.status,
        logicalBytes: logicalBuffer.length,
        logicalSha256: sha256(logicalBuffer),
        ...headers
      });
    }
  }
  return { ok: true, checkedAt: new Date().toISOString(), results };
}

function parseArgs(argv = []) {
  const packageArgument = argv.find((argument) => argument.startsWith("--package="));
  const packageRoot = packageArgument
    ? path.resolve(WORKSPACE_ROOT, packageArgument.slice("--package=".length))
    : DEFAULT_PACKAGE_ROOT;
  const unknown = argv.filter((argument) => argument !== "--remote" && !argument.startsWith("--package="));
  assert(unknown.length === 0, "unknown_argument", { unknown });
  return { packageRoot, remote: argv.includes("--remote") };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const local = verifyLocalPackage(options.packageRoot);
  const remote = options.remote ? await verifyRemoteAssets(options.packageRoot) : null;
  process.stdout.write(`${JSON.stringify({
    command: "verify-stage14-rollout",
    ok: true,
    local,
    remote
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      command: "verify-stage14-rollout",
      ok: false,
      error: error.message,
      details: error.details || null
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_PACKAGE_ROOT,
  ORIGINS,
  readPackage,
  verifyLocalPackage,
  verifyRemoteAssets
};
