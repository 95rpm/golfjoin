"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const {
  buildExternalAssetBundle,
  sha256,
  sriSha256
} = require("../../tools/golfjoin-main/external-assets");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "golfjoin-assets-"));
  const files = {
    "source/shell/00-preamble.html": "<!doctype html><html><head><script>window.early=true;</script>\n<style>",
    "source/styles/10-main.css": "body{color:#123;}\n",
    "source/markup/20-main.html": "</style></head><body><button onclick=\"hello()\">go</button>\n<script>",
    "source/scripts/30-a.js": "function hello(){window.answer=",
    "source/scripts/31-b.js": "42;}\n",
    "source/shell/40-suffix.html": "</script><footer>done</footer></body></html>"
  };
  Object.entries(files).forEach(([relativePath, content]) => {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  });
  const mainHtmlPath = path.join(root, "legacy.html");
  fs.writeFileSync(mainHtmlPath, Object.values(files).join(""));
  return {
    root,
    mainHtmlPath,
    files,
    manifest: { sourceOrder: Object.keys(files) }
  };
}

test("외부 자산 후보는 CSS·JS 순서를 유지하고 HTML에서 큰 inline 블록만 제거한다", () => {
  const source = fixture();
  const bundle = buildExternalAssetBundle({
    sourceRoot: source.root,
    mainHtmlPath: source.mainHtmlPath,
    manifest: source.manifest,
    generatedAt: "2026-08-13T12:00:00+09:00",
    bucketName: "test-bucket",
    objectPrefix: "web/home-assets"
  });
  const css = bundle.artifacts.css.buffer.toString("utf8");
  const js = bundle.artifacts.js.buffer.toString("utf8");
  const html = bundle.artifacts.html.buffer.toString("utf8");

  assert.equal(css, source.files["source/styles/10-main.css"]);
  assert.equal(js, `${source.files["source/scripts/30-a.js"]}${source.files["source/scripts/31-b.js"]}`);
  assert.doesNotThrow(() => new vm.Script(js));
  assert.match(html, /<script>window\.early=true;<\/script>/);
  assert.doesNotMatch(html, /body\{color/);
  assert.doesNotMatch(html, /function hello/);
  assert.match(html, new RegExp(bundle.publication.assets.css.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(bundle.publication.assets.js.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /integrity="sha256-/);
  assert.match(html, /onclick="hello\(\)"/);
  assert.match(html, /<footer>done<\/footer>/);
  assert.match(html, /handleGolfJoinExternalAssetFailure\('css'\)/);
  assert.match(html, /handleGolfJoinExternalAssetFailure\('js'\)/);
  assert.match(html, /golfJoinExternalAssetFailureNotice/);
  assert.match(html, /golfJoinExternalAssetFailureNotice[^>]+display:none/);
  assert.match(html, /notice\.style\.display=\"flex\"/);
  assert.match(html, /classList\.remove\(\"home-initial-loading\",\"modal-open\"\)/);
});

test("발행 메타데이터는 불변 URL·정확한 MIME·무결성값·원본 복구 파일을 기록한다", () => {
  const source = fixture();
  const bundle = buildExternalAssetBundle({
    sourceRoot: source.root,
    mainHtmlPath: source.mainHtmlPath,
    manifest: source.manifest,
    generatedAt: "2026-08-13T12:00:00+09:00"
  });
  const { publication, artifacts } = bundle;

  assert.match(publication.assetRevision, /^gha_[a-f0-9]{24}$/);
  assert.equal(publication.browserReadEnabled, false);
  assert.equal(publication.rollbackFile, "golfjoin_main_legacy.html");
  assert.equal(publication.assets.css.contentType, "text/css; charset=utf-8");
  assert.equal(publication.assets.js.contentType, "application/javascript; charset=utf-8");
  assert.equal(publication.assets.css.sha256, sha256(artifacts.css.buffer));
  assert.equal(publication.assets.js.sri, sriSha256(artifacts.js.buffer));
  assert.match(publication.assets.css.objectName, new RegExp(`/${publication.assetRevision}/`));
  assert.match(publication.assets.js.objectName, new RegExp(`/${publication.assetRevision}/`));
  assert.equal(publication.sourceHtmlSha256, sha256(artifacts.legacyHtml.buffer));
});

test("시험 자산은 운영 코드와 격리되고 성공 여부를 전역 상태로 확인할 수 있다", () => {
  const source = fixture();
  const bundle = buildExternalAssetBundle({
    sourceRoot: source.root,
    mainHtmlPath: source.mainHtmlPath,
    manifest: source.manifest,
    generatedAt: "2026-08-13T12:00:00+09:00"
  });
  const probeJs = bundle.artifacts.probeJs.buffer.toString("utf8");
  const snippet = bundle.artifacts.probeSnippet.buffer.toString("utf8");

  assert.doesNotThrow(() => new vm.Script(probeJs));
  assert.match(probeJs, /__GOLFJOIN_STAGE13_EXTERNAL_ASSET_PROBE__/);
  assert.match(bundle.publication.probe.css.objectName, /\/probe\//);
  assert.match(bundle.publication.probe.js.objectName, /\/probe\//);
  assert.match(snippet, /stage13-probe\.css/);
  assert.match(snippet, /stage13-probe\.js/);
  assert.match(snippet, /integrity="sha256-/);
  assert.match(snippet, /data-golfjoin-stage13-result/);
  assert.match(snippet, /__GOLFJOIN_STAGE13_EXTERNAL_ASSET_PROBE__/);
});

test("gzip 전송 후보는 논리 내용과 SRI를 유지하고 별도 불변 revision을 만든다", () => {
  const source = fixture();
  const identity = buildExternalAssetBundle({
    sourceRoot: source.root,
    mainHtmlPath: source.mainHtmlPath,
    manifest: source.manifest,
    generatedAt: "2026-08-13T12:00:00+09:00"
  });
  const gzip = buildExternalAssetBundle({
    sourceRoot: source.root,
    mainHtmlPath: source.mainHtmlPath,
    manifest: source.manifest,
    generatedAt: "2026-08-13T12:00:00+09:00",
    contentEncoding: "gzip"
  });

  assert.notEqual(gzip.assetRevision, identity.assetRevision);
  assert.equal(gzip.publication.contentEncoding, "gzip");
  assert.equal(gzip.publication.assets.css.contentEncoding, "gzip");
  assert.equal(gzip.publication.assets.js.contentEncoding, "gzip");
  assert.equal(gzip.publication.assets.css.uploadFileName, "golfjoin-main.css.gz");
  assert.equal(gzip.publication.assets.js.uploadFileName, "golfjoin-main.js.gz");
  assert.equal(zlib.gunzipSync(gzip.artifacts.cssDelivery.buffer).toString("utf8"), source.files["source/styles/10-main.css"]);
  assert.equal(
    zlib.gunzipSync(gzip.artifacts.jsDelivery.buffer).toString("utf8"),
    `${source.files["source/scripts/30-a.js"]}${source.files["source/scripts/31-b.js"]}`
  );
  assert.equal(gzip.publication.assets.css.sri, identity.publication.assets.css.sri);
  assert.equal(gzip.publication.assets.js.sri, identity.publication.assets.js.sri);
  assert.equal(gzip.publication.assets.css.logicalSri, identity.publication.assets.css.sri);
  assert.equal(gzip.publication.assets.js.logicalSri, identity.publication.assets.js.sri);
  assert.equal(gzip.publication.assets.css.encodedSri, sriSha256(gzip.artifacts.cssDelivery.buffer));
  assert.equal(gzip.publication.assets.js.encodedSri, sriSha256(gzip.artifacts.jsDelivery.buffer));
  assert.equal(gzip.publication.assets.css.encodedBytes, gzip.artifacts.cssDelivery.buffer.length);
  assert.equal(gzip.publication.assets.js.encodedBytes, gzip.artifacts.jsDelivery.buffer.length);
  assert.equal(gzip.publication.assets.css.encodedSha256, sha256(gzip.artifacts.cssDelivery.buffer));
  assert.equal(gzip.publication.assets.js.encodedSha256, sha256(gzip.artifacts.jsDelivery.buffer));
});

test("지원하지 않는 전송 압축 형식은 빌드 전에 차단한다", () => {
  const source = fixture();
  assert.throws(() => buildExternalAssetBundle({
    sourceRoot: source.root,
    mainHtmlPath: source.mainHtmlPath,
    manifest: source.manifest,
    contentEncoding: "br"
  }), /external_asset_content_encoding_invalid:br/);
});
