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
  "deploy/stage34-hero-banner-management/dashboard-hero-banners-20260821-v34m"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readRecord(name) {
  const fileName = manifest.names[name] || name;
  const record = manifest.files[fileName];
  assert.ok(record?.fileName, `${name} fileName`);
  const value = fs.readFileSync(path.join(PACKAGE_ROOT, record.fileName));
  assert.equal(value.length, record.bytes, `${name} bytes`);
  assert.equal(sha256(value), record.sha256, `${name} sha256`);
  return value;
}

test("v34m은 현재 운영 HTML을 복구본으로 보존하고 신규 불변 자산을 사용한다", () => {
  assert.match(manifest.assetRevision, /^gha_[a-f0-9]{24}$/);
  assert.equal(manifest.javascriptBudget.passed, true);
  Object.keys(manifest.files).forEach(readRecord);
  assert.equal(sha256(readRecord("mainRollback")), "f6fe223d4a68d3171f1039fd0e511cbd77a10086a0cab0d1fcb5aba8f5cb34e4");
  assert.match(readRecord("mainDeploy").toString("utf8"), new RegExp(manifest.assetRevision));
});

test("v34m JavaScript는 날짜완료와 지역선택에서 같은 후보 캐시를 재사용한다", () => {
  const source = zlib.brotliDecompressSync(readRecord("js")).toString("utf8");
  new vm.Script(source, { filename: manifest.names.js });
  assert.match(source, /builderAvailableProductsCache/);
  assert.match(source, /function getBuilderAvailableProductsForSelectedDates\(/);
  assert.match(source, /function isBuilderRegionAvailableForDate\(/);
  assert.match(source, /getBuilderAvailableProductsForSelectedDates\(\)/);
  assert.doesNotMatch(source, /filter\(\(\{category:\w+\}\)=>isBuilderCategoryAvailable/);
});
