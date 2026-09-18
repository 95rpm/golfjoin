"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage34-hero-banner-management/detail-bottom-summary-20260821-v34n"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readRecord(key) {
  const record = manifest.files[key];
  assert.ok(record?.fileName, `${key} record`);
  const value = fs.readFileSync(path.join(PACKAGE_ROOT, record.fileName));
  assert.equal(value.length, record.bytes, `${key} bytes`);
  assert.equal(sha256(value), record.sha256, `${key} sha256`);
  return value;
}

test("v34n은 F6FE223D 운영본을 복구본으로 보존하고 신규 불변 자산을 사용한다", () => {
  assert.equal(manifest.javascriptBudget.passed, true);
  Object.keys(manifest.files).forEach(readRecord);
  assert.equal(sha256(readRecord("rollbackHtml")), "f6fe223d4a68d3171f1039fd0e511cbd77a10086a0cab0d1fcb5aba8f5cb34e4");
  assert.match(readRecord("deployHtml").toString("utf8"), new RegExp(manifest.assetRevision));
  assert.equal(manifest.features.serverRedeployRequired, false);
  assert.equal(manifest.features.dashboardRedeployRequired, false);
});

test("v34n 압축 자산은 모든 상품상세의 기간·요금 행과 v34m 성능 보완을 포함한다", () => {
  const css = zlib.gunzipSync(readRecord("css")).toString("utf8");
  const js = zlib.brotliDecompressSync(readRecord("js")).toString("utf8");
  new vm.Script(js, { filename: manifest.names.js });
  assert.match(css, /\.detail-bottom-summary\s*\{/);
  assert.match(css, /\.detail-bottom-price\s*\{/);
  assert.match(css, /justify-content:\s*space-between/);
  assert.match(js, /function renderDetailBottomSummary\(/);
  assert.match(js, /function getDetailBottomPriceValue\(/);
  assert.match(js, /function getBuilderAvailableProductsForSelectedDates\(/);
  assert.match(js, /builderAvailableProductsCache/);
});

test("v34n 배포 HTML은 공통 하단 행을 버튼보다 먼저 한 번만 포함한다", () => {
  const html = readRecord("deployHtml").toString("utf8");
  assert.equal((html.match(/id="detailBottomSummary"/g) || []).length, 1);
  assert.ok(html.indexOf('id="detailBottomSummary"') < html.indexOf('id="detailPhoneButton"'));
  assert.match(html, /id="detailBottomPeriod">여행기간 확인 중<\/div>/);
  assert.match(html, /id="detailBottomPrice">요금 문의<\/div>/);
});
