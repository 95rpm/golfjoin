"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const { sha256, verifyLocalPackage } = require("../../tools/golfjoin-main/verify-stage13-production");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(ROOT, "deploy/stage13-home-assets/production-gzip-20260813");

test("13단계 gzip 패키지는 전송량·원본 해시·복구 파일을 함께 고정한다", () => {
  const result = verifyLocalPackage(PACKAGE_ROOT, { requireCurrentMain: false });
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
  const html = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.deployHtml.fileName), "utf8");
  const cssEncoded = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.css.fileName));
  const jsEncoded = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.js.fileName));
  const css = zlib.gunzipSync(cssEncoded);
  const js = zlib.gunzipSync(jsEncoded);

  assert.equal(result.ok, true);
  assert.equal(manifest.schema, "secret-golf-join-stage13-gzip-cutover-v1");
  assert.equal(manifest.assetRevision, "gha_fa7df4e8e602419ba81a56ed");
  assert.equal(manifest.contentEncoding, "gzip");
  assert.equal(manifest.expectedColdAssetBytes, 437980);
  assert.equal(manifest.previousColdAssetBytes, 2610356);
  assert.ok(manifest.expectedColdAssetBytes / manifest.previousColdAssetBytes < 0.17);
  assert.equal(sha256(css), manifest.files.css.logicalSha256);
  assert.equal(sha256(js), manifest.files.js.logicalSha256);
  assert.equal(html.split(manifest.files.css.url).length - 1, 1);
  assert.equal(html.split(manifest.files.js.url).length - 1, 1);
  assert.ok(html.includes(`integrity="${manifest.files.css.sri}"`));
  assert.ok(html.includes(`integrity="${manifest.files.js.sri}"`));
  assert.equal(
    sha256(fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.rollbackHtml.fileName))),
    manifest.files.rollbackHtml.sha256
  );
  assert.equal(manifest.files.rollbackHtml.sha256, "ab80599c2e1ecea87d730e28a23f30bdd25670066cd763e4c678ef5340884e31");
  assert.match(fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.runbook.fileName), "utf8"), /--content-encoding=gzip/);
});
