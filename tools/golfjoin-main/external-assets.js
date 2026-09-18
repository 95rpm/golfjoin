"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(WORKSPACE_ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST_PATH = path.join(SOURCE_ROOT, "source-manifest.json");
const MAIN_HTML_PATH = path.join(WORKSPACE_ROOT, "golfjoin_main.html");
const DEFAULT_OUTPUT_ROOT = path.join(WORKSPACE_ROOT, "dist/golfjoin-main/external-assets");
const DEFAULT_BUCKET_NAME = "golfjoin-bucket";
const DEFAULT_OBJECT_PREFIX = "web/home-assets";
const CSS_SOURCE_PATH = "source/styles/10-main.css";
const PREAMBLE_SOURCE_PATH = "source/shell/00-preamble.html";
const MARKUP_SOURCE_PATH = "source/markup/20-main.html";
const SUFFIX_SOURCE_PATH = "source/shell/40-suffix.html";
const SCRIPT_SOURCE_PATTERN = /^source\/scripts\/.+\.js$/;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const HTML_CACHE_CONTROL = "no-store";
const SUPPORTED_CONTENT_ENCODINGS = new Set(["identity", "gzip"]);

function text(value) {
  return String(value ?? "").trim();
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sriSha256(buffer) {
  return `sha256-${crypto.createHash("sha256").update(buffer).digest("base64")}`;
}

function assertInside(parentPath, targetPath, code) {
  const parent = path.resolve(parentPath);
  const target = path.resolve(targetPath);
  const relative = path.relative(parent, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${code}:${target}`);
  return target;
}

function readSourceManifest(manifestPath = SOURCE_MANIFEST_PATH) {
  const resolved = assertInside(WORKSPACE_ROOT, manifestPath, "manifest_outside_workspace");
  const manifest = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!Array.isArray(manifest.sourceOrder) || !manifest.sourceOrder.length) {
    throw new Error("source_manifest_order_missing");
  }
  return manifest;
}

function readSourceFile(sourceRoot, relativePath) {
  const resolved = assertInside(sourceRoot, path.resolve(sourceRoot, relativePath), "source_outside_root");
  return fs.readFileSync(resolved);
}

function requireSourceOrder(manifest) {
  const required = [PREAMBLE_SOURCE_PATH, CSS_SOURCE_PATH, MARKUP_SOURCE_PATH, SUFFIX_SOURCE_PATH];
  required.forEach((relativePath) => {
    if (!manifest.sourceOrder.includes(relativePath)) throw new Error(`required_source_missing:${relativePath}`);
  });
  const scriptPaths = manifest.sourceOrder.filter((relativePath) => SCRIPT_SOURCE_PATTERN.test(relativePath));
  if (!scriptPaths.length) throw new Error("script_sources_missing");
  return scriptPaths;
}

function publicUrl(bucketName, objectName) {
  const encodedObjectName = objectName.split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${encodedObjectName}`;
}

function replaceRequired(source, pattern, replacement, code) {
  const matches = source.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`));
  if (!matches || matches.length !== 1) throw new Error(`${code}:${matches?.length || 0}`);
  return source.replace(pattern, replacement);
}

function buildAssetFailureGuard(assetRevision) {
  return `<script>\n`
    + `(function installGolfJoinExternalAssetFailureGuard(){\n`
    + `  var revision=${JSON.stringify(assetRevision)};\n`
    + `  var timers=[];\n`
    + `  var reveal=function(){\n`
    + `    var body=document.body;\n`
    + `    if(body){body.classList.remove(\"home-initial-loading\",\"modal-open\");body.style.overflow=\"\";}\n`
    + `    var overlay=document.getElementById(\"homeInitialLoadingOverlay\");\n`
    + `    if(overlay){overlay.classList.remove(\"open\");overlay.setAttribute(\"aria-hidden\",\"true\");overlay.style.display=\"none\";}\n`
    + `    var notice=document.getElementById(\"golfJoinExternalAssetFailureNotice\");\n`
    + `    if(notice){notice.hidden=false;notice.style.display=\"flex\";notice.setAttribute(\"aria-hidden\",\"false\");}\n`
    + `  };\n`
    + `  window.handleGolfJoinExternalAssetFailure=function(kind){\n`
    + `    var failure={kind:String(kind||\"unknown\"),assetRevision:revision,failedAt:new Date().toISOString()};\n`
    + `    window.__GOLFJOIN_EXTERNAL_ASSET_FAILURE__=failure;\n`
    + `    document.documentElement.setAttribute(\"data-golfjoin-external-asset-failure\",failure.kind);\n`
    + `    reveal();\n`
    + `    document.addEventListener(\"DOMContentLoaded\",reveal,{once:true});\n`
    + `    window.addEventListener(\"load\",reveal,{once:true});\n`
    + `    [0,250,1000,3000].forEach(function(delay){timers.push(setTimeout(reveal,delay));});\n`
    + `  };\n`
    + `})();\n`
    + `</script>\n`;
}

function buildAssetFailureNotice(assetRevision) {
  return `<div id="golfJoinExternalAssetFailureNotice" hidden aria-hidden="true" data-asset-revision="${assetRevision}" style="position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(255,255,255,.98);font-family:Pretendard,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111827;box-sizing:border-box;">`
    + `<div style="width:min(100%,420px);padding:28px 24px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;text-align:center;box-shadow:0 16px 40px rgba(15,23,42,.12);">`
    + `<strong style="display:block;font-size:18px;line-height:1.5;">페이지 구성 파일을 불러오지 못했습니다.</strong>`
    + `<span style="display:block;margin-top:8px;font-size:14px;line-height:1.6;color:#6b7280;">잠시 후 다시 시도해 주세요. 같은 화면이 계속되면 기존 단일 HTML로 즉시 복구할 수 있습니다.</span>`
    + `<button type="button" onclick="location.reload()" style="width:100%;margin-top:20px;padding:12px 16px;border:0;border-radius:10px;background:#111827;color:#fff;font-size:15px;font-weight:700;cursor:pointer;">새로고침</button>`
    + `</div></div>`;
}

function buildProbeAssets(assetRevision, generatedAt) {
  const css = Buffer.from(
    `.golfjoin-stage13-external-asset-probe{--golfjoin-stage13-probe:"${assetRevision}" !important;}\n`,
    "utf8"
  );
  const js = Buffer.from(
    `window.__GOLFJOIN_STAGE13_EXTERNAL_ASSET_PROBE__ = Object.freeze({ok:true,assetRevision:${JSON.stringify(assetRevision)},loadedAt:new Date().toISOString()});\n`
      + `window.dispatchEvent(new CustomEvent("golfjoin:stage13-probe-ready",{detail:window.__GOLFJOIN_STAGE13_EXTERNAL_ASSET_PROBE__}));\n`,
    "utf8"
  );
  return { css, js, generatedAt };
}

function buildExternalAssetBundle(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot || SOURCE_ROOT);
  const manifest = options.manifest || readSourceManifest(options.manifestPath || SOURCE_MANIFEST_PATH);
  const scriptPaths = requireSourceOrder(manifest);
  const bucketName = text(options.bucketName || DEFAULT_BUCKET_NAME);
  const objectPrefix = text(options.objectPrefix || DEFAULT_OBJECT_PREFIX).replace(/^\/+|\/+$/g, "");
  const generatedAt = text(options.generatedAt || new Date().toISOString());
  const contentEncoding = text(options.contentEncoding || "identity").toLowerCase();
  if (!bucketName || !objectPrefix || !generatedAt) throw new Error("external_asset_options_invalid");
  if (!SUPPORTED_CONTENT_ENCODINGS.has(contentEncoding)) {
    throw new Error(`external_asset_content_encoding_invalid:${contentEncoding}`);
  }

  const preamble = readSourceFile(sourceRoot, PREAMBLE_SOURCE_PATH).toString("utf8");
  const css = readSourceFile(sourceRoot, CSS_SOURCE_PATH);
  const markup = readSourceFile(sourceRoot, MARKUP_SOURCE_PATH).toString("utf8");
  const suffix = readSourceFile(sourceRoot, SUFFIX_SOURCE_PATH).toString("utf8");
  const js = Buffer.concat(scriptPaths.map((relativePath) => readSourceFile(sourceRoot, relativePath)));
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.js" });

  const revisionParts = [css, Buffer.from("\n--golfjoin-asset-boundary--\n"), js];
  if (contentEncoding !== "identity") {
    revisionParts.push(Buffer.from(`\n--golfjoin-delivery-${contentEncoding}-v1--\n`));
  }
  const assetRevision = `gha_${sha256(Buffer.concat(revisionParts)).slice(0, 24)}`;
  const revisionPrefix = `${objectPrefix}/${assetRevision}`;
  const cssObjectName = `${revisionPrefix}/golfjoin-main.css`;
  const jsObjectName = `${revisionPrefix}/golfjoin-main.js`;
  const cssUrl = publicUrl(bucketName, cssObjectName);
  const jsUrl = publicUrl(bucketName, jsObjectName);
  const cssDelivery = contentEncoding === "gzip"
    ? zlib.gzipSync(css, { level: 9, mtime: 0 })
    : css;
  const jsDelivery = contentEncoding === "gzip"
    ? zlib.gzipSync(js, { level: 9, mtime: 0 })
    : js;
  const cssSri = sriSha256(css);
  const jsSri = sriSha256(js);
  const failureGuard = buildAssetFailureGuard(assetRevision);
  const failureNotice = buildAssetFailureNotice(assetRevision);

  const externalPreamble = replaceRequired(
    preamble,
    /<style>\s*$/,
    `${failureGuard}<link rel="stylesheet" href="${cssUrl}" integrity="${cssSri}" crossorigin="anonymous" onerror="handleGolfJoinExternalAssetFailure('css')">\n`,
    "preamble_style_boundary_invalid"
  );
  const withoutStyleClose = replaceRequired(markup, /^<\/style>/, "", "markup_style_boundary_invalid");
  const markupWithFailureNotice = replaceRequired(
    withoutStyleClose,
    /<body(?:\s[^>]*)?>/,
    (bodyTag) => `${bodyTag}\n${failureNotice}`,
    "markup_body_boundary_invalid"
  );
  const externalMarkup = replaceRequired(
    markupWithFailureNotice,
    /<script>\s*$/,
    `<script src="${jsUrl}" integrity="${jsSri}" crossorigin="anonymous" onerror="handleGolfJoinExternalAssetFailure('js')">\n`,
    "markup_script_boundary_invalid"
  );
  if (!/^<\/script>/.test(suffix)) throw new Error("suffix_script_boundary_invalid");
  const html = Buffer.from(`${externalPreamble}${externalMarkup}${suffix}`, "utf8");
  const legacyHtml = fs.readFileSync(options.mainHtmlPath || MAIN_HTML_PATH);
  const probe = buildProbeAssets(assetRevision, generatedAt);
  const probePrefix = `${objectPrefix}/probe/${assetRevision}`;
  const probeCssObjectName = `${probePrefix}/stage13-probe.css`;
  const probeJsObjectName = `${probePrefix}/stage13-probe.js`;
  const probeCssUrl = publicUrl(bucketName, probeCssObjectName);
  const probeJsUrl = publicUrl(bucketName, probeJsObjectName);
  const probeSnippet = Buffer.from(
    `<link rel="stylesheet" href="${probeCssUrl}" integrity="${sriSha256(probe.css)}" crossorigin="anonymous">\n`
      + `<div class="golfjoin-stage13-external-asset-probe" hidden aria-hidden="true"></div>\n`
      + `<script src="${probeJsUrl}" integrity="${sriSha256(probe.js)}" crossorigin="anonymous"></script>\n`
      + `<script>\n`
      + `(function recordGolfJoinStage13ProbeResult(){\n`
      + `  var cssUrl=${JSON.stringify(probeCssUrl)};\n`
      + `  var jsUrl=${JSON.stringify(probeJsUrl)};\n`
      + `  var collect=function(){\n`
      + `    var entries=(window.performance&&typeof window.performance.getEntriesByType===\"function\")?window.performance.getEntriesByType(\"resource\").filter(function(entry){return entry.name===cssUrl||entry.name===jsUrl;}).map(function(entry){return{name:entry.name,initiatorType:entry.initiatorType,transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,decodedBodySize:entry.decodedBodySize,duration:entry.duration};}):[];\n`
      + `    document.documentElement.setAttribute(\"data-golfjoin-stage13-result\",JSON.stringify({probe:window.__GOLFJOIN_STAGE13_EXTERNAL_ASSET_PROBE__||null,resources:entries,recordedAt:new Date().toISOString()}));\n`
      + `  };\n`
      + `  if(document.readyState===\"complete\")setTimeout(collect,0);else window.addEventListener(\"load\",function(){setTimeout(collect,0);},{once:true});\n`
      + `})();\n`
      + `</script>\n`,
    "utf8"
  );

  const artifacts = {
    css: { fileName: "golfjoin-main.css", objectName: cssObjectName, url: cssUrl, contentType: "text/css; charset=utf-8", buffer: css },
    js: { fileName: "golfjoin-main.js", objectName: jsObjectName, url: jsUrl, contentType: "application/javascript; charset=utf-8", buffer: js },
    html: { fileName: "golfjoin_main_external.html", contentType: "text/html; charset=utf-8", buffer: html },
    legacyHtml: { fileName: "golfjoin_main_legacy.html", contentType: "text/html; charset=utf-8", buffer: legacyHtml },
    probeCss: { fileName: "stage13-probe.css", objectName: probeCssObjectName, url: probeCssUrl, contentType: "text/css; charset=utf-8", buffer: probe.css },
    probeJs: { fileName: "stage13-probe.js", objectName: probeJsObjectName, url: probeJsUrl, contentType: "application/javascript; charset=utf-8", buffer: probe.js },
    probeSnippet: { fileName: "stage13-probe-snippet.html", contentType: "text/html; charset=utf-8", buffer: probeSnippet }
  };
  if (contentEncoding === "gzip") {
    artifacts.cssDelivery = {
      fileName: "golfjoin-main.css.gz",
      objectName: cssObjectName,
      url: cssUrl,
      contentType: "text/css; charset=utf-8",
      contentEncoding,
      buffer: cssDelivery
    };
    artifacts.jsDelivery = {
      fileName: "golfjoin-main.js.gz",
      objectName: jsObjectName,
      url: jsUrl,
      contentType: "application/javascript; charset=utf-8",
      contentEncoding,
      buffer: jsDelivery
    };
  }
  const describe = (artifact) => ({
    fileName: artifact.fileName,
    ...(artifact.objectName ? { objectName: artifact.objectName, url: artifact.url } : {}),
    bytes: artifact.buffer.length,
    sha256: sha256(artifact.buffer),
    sri: sriSha256(artifact.buffer),
    contentType: artifact.contentType,
    cacheControl: artifact.objectName ? IMMUTABLE_CACHE_CONTROL : HTML_CACHE_CONTROL
  });
  const publication = {
    schema: "secret-golf-join-home-assets-publication-v1",
    generatedAt,
    assetRevision,
    contentEncoding,
    sourceHtmlSha256: sha256(legacyHtml),
    sourceHtmlBytes: legacyHtml.length,
    candidateHtmlSha256: sha256(html),
    candidateHtmlBytes: html.length,
    browserReadEnabled: false,
    rollbackFile: artifacts.legacyHtml.fileName,
    assets: {
      css: {
        ...describe(artifacts.css),
        logicalSri: sriSha256(css),
        encodedSri: sriSha256(cssDelivery),
        uploadFileName: contentEncoding === "gzip" ? artifacts.cssDelivery.fileName : artifacts.css.fileName,
        contentEncoding,
        encodedBytes: cssDelivery.length,
        encodedSha256: sha256(cssDelivery)
      },
      js: {
        ...describe(artifacts.js),
        logicalSri: sriSha256(js),
        encodedSri: sriSha256(jsDelivery),
        uploadFileName: contentEncoding === "gzip" ? artifacts.jsDelivery.fileName : artifacts.js.fileName,
        contentEncoding,
        encodedBytes: jsDelivery.length,
        encodedSha256: sha256(jsDelivery)
      }
    },
    probe: {
      css: describe(artifacts.probeCss),
      js: describe(artifacts.probeJs),
      snippetFile: artifacts.probeSnippet.fileName
    }
  };
  return { assetRevision, artifacts, publication };
}

function writeExternalAssetBundle(bundle, outputRoot = DEFAULT_OUTPUT_ROOT) {
  const safeOutputRoot = assertInside(WORKSPACE_ROOT, outputRoot, "output_outside_workspace");
  const revisionRoot = path.join(safeOutputRoot, bundle.assetRevision);
  fs.mkdirSync(revisionRoot, { recursive: true });
  Object.values(bundle.artifacts).forEach((artifact) => {
    fs.writeFileSync(path.join(revisionRoot, artifact.fileName), artifact.buffer);
  });
  fs.writeFileSync(
    path.join(revisionRoot, "publication.json"),
    `${JSON.stringify(bundle.publication, null, 2)}\n`,
    "utf8"
  );
  return revisionRoot;
}

function parseArgs(argv = []) {
  return argv.reduce((options, argument) => {
    if (argument.startsWith("--output=")) options.outputRoot = argument.slice("--output=".length);
    else if (argument.startsWith("--bucket=")) options.bucketName = argument.slice("--bucket=".length);
    else if (argument.startsWith("--prefix=")) options.objectPrefix = argument.slice("--prefix=".length);
    else if (argument.startsWith("--encoding=")) options.contentEncoding = argument.slice("--encoding=".length);
    else throw new Error(`unknown_argument:${argument}`);
    return options;
  }, {});
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const bundle = buildExternalAssetBundle(options);
  const outputRoot = writeExternalAssetBundle(bundle, options.outputRoot || DEFAULT_OUTPUT_ROOT);
  console.log(JSON.stringify({
    ok: true,
    outputRoot,
    ...bundle.publication
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  DEFAULT_BUCKET_NAME,
  DEFAULT_OBJECT_PREFIX,
  IMMUTABLE_CACHE_CONTROL,
  SUPPORTED_CONTENT_ENCODINGS,
  sha256,
  sriSha256,
  readSourceManifest,
  buildExternalAssetBundle,
  writeExternalAssetBundle,
  parseArgs
};
