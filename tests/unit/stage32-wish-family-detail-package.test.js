"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage32-wish-family-detail/wish-family-detail-20260821-v32"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readManifestFile(key) {
  const entry = manifest.files[key];
  const buffer = fs.readFileSync(path.join(PACKAGE_ROOT, entry.fileName));
  assert.equal(buffer.length, entry.bytes, `${key} bytes`);
  assert.equal(sha256(buffer), entry.sha256, `${key} sha256`);
  return buffer;
}

test("v32 묶음은 상품군 찜의 정확한 상품 상세와 기간 배경 제거를 함께 배포한다", () => {
  assert.equal(manifest.schema, "secret-golf-join-wish-family-detail-v1");
  assert.equal(manifest.javascriptBudgetPassed, true);
  assert.equal(manifest.features.wishedExactGoodSeqResolved, true);
  assert.equal(manifest.features.wishedExactEventSeqPreferred, true);
  assert.equal(manifest.features.familyAvailabilityUsed, true);
  assert.equal(manifest.features.existingDetailModalUsed, true);
  assert.equal(manifest.features.detailFamilyPeriodsBackgroundRemoved, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, false);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.features.memberAuthGateRemainsReport, true);
});

test("v32 파일·압축 자산·49CBEB0C 복구본이 모두 정상이다", () => {
  const deployHtml = readManifestFile("deployHtml").toString("utf8");
  const rollbackHtml = readManifestFile("rollbackHtml");
  const cssGzip = readManifestFile("css");
  const jsBrotli = readManifestFile("js");
  readManifestFile("runbook");

  assert.equal(sha256(rollbackHtml).slice(0, 8).toUpperCase(), "49CBEB0C");
  assert.match(deployHtml, new RegExp(manifest.assetRevision));
  assert.match(deployHtml, new RegExp(manifest.assets.css.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(deployHtml, new RegExp(manifest.assets.js.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const css = zlib.gunzipSync(cssGzip).toString("utf8");
  const js = zlib.brotliDecompressSync(jsBrotli).toString("utf8");
  new vm.Script(js, { filename: "v32-golfjoin-main.js" });
  assert.ok(jsBrotli.length <= 204800);

  assert.match(js, /async function resolveJoinWishProductDetail\(/);
  assert.match(js, /ensureGolfJoinProductFamilyCatalogLoaded/);
  assert.match(js, /loadGolfJoinProductGroupAvailability/);
  assert.match(js, /showMdPickDetailProduct/);
  const familyPeriods = css.match(/\.detail-family-periods\s*\{([^}]*)\}/);
  assert.ok(familyPeriods);
  assert.doesNotMatch(familyPeriods[1], /\bbackground(?:-color)?\s*:/);
});
