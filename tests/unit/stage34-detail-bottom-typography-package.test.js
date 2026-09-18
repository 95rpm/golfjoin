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
  "deploy/stage34-hero-banner-management/detail-bottom-typography-20260821-v34o"
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

test("v34o는 신규 타이포그래피 자산과 F6FE223D 복구본을 자체 보존한다", () => {
  assert.equal(manifest.javascriptBudget.passed, true);
  Object.keys(manifest.files).forEach(readRecord);
  assert.equal(sha256(readRecord("rollbackHtml")), "f6fe223d4a68d3171f1039fd0e511cbd77a10086a0cab0d1fcb5aba8f5cb34e4");
  assert.match(readRecord("deployHtml").toString("utf8"), new RegExp(manifest.assetRevision));
});

test("v34o CSS는 PC·모바일 날짜, 요금 숫자와 원 단위 크기·색상을 구분한다", () => {
  const css = zlib.gunzipSync(readRecord("css")).toString("utf8");
  assert.match(css, /\.detail-bottom-period-text\.card-meta-text-date\s*\{[\s\S]*?font-size:\s*18px/);
  assert.match(css, /\.detail-bottom-price\s*\{[\s\S]*?color:\s*#373a3c;[\s\S]*?font-size:\s*22px;[\s\S]*?font-weight:\s*700/);
  assert.match(css, /\.detail-bottom-price-unit\s*\{[\s\S]*?color:\s*#5d6b82;[\s\S]*?font-size:\s*20px/);
  assert.match(css, /body > #detailModal\.sgj-portal-overlay \.detail-bottom-period-text\.card-meta-text-date\s*\{\s*font-size:\s*17px/);
  assert.match(css, /body > #detailModal\.sgj-portal-overlay \.detail-bottom-price\s*\{\s*font-size:\s*20px/);
  assert.match(css, /body > #detailModal\.sgj-portal-overlay \.detail-bottom-price-unit\s*\{\s*font-size:\s*18px/);
});

test("v34o HTML·JavaScript는 요금 숫자와 원 단위를 별도 요소로 갱신한다", () => {
  const html = readRecord("deployHtml").toString("utf8");
  const js = zlib.brotliDecompressSync(readRecord("js")).toString("utf8");
  new vm.Script(js, { filename: manifest.names.js });
  assert.equal((html.match(/id="detailBottomSummary"/g) || []).length, 1);
  assert.match(html, /id="detailBottomPriceValue">요금 문의<\/span>/);
  assert.match(html, /id="detailBottomPriceUnit" hidden>원<\/span>/);
  assert.match(js, /detailBottomPriceValue/);
  assert.match(js, /detailBottomPriceUnit/);
  assert.match(js, /builderAvailableProductsCache/);
});
