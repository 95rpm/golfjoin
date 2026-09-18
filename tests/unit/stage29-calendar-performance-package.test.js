"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(
  root,
  "deploy/stage29-calendar-alimtalk/date-conflict-calendar-performance-20260820-v29b"
);
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readRecord(name) {
  const record = manifest.files[name];
  assert.ok(record?.fileName, `${name} fileName`);
  const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
  assert.equal(buffer.length, record.bytes, `${name} bytes`);
  assert.equal(sha256(buffer), record.sha256, `${name} sha256`);
  return { record, buffer };
}

test("29번 캘린더 성능 보완 묶음은 신규 불변 리비전을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_da8c12dc90ffff48e9895498");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("29번 캘린더 성능 보완 묶음의 파일 크기와 해시가 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("Brotli JavaScript는 문법·예산·월 렌더 캐시를 모두 포함한다", () => {
  const js = readRecord("js");
  const logicalJs = zlib.brotliDecompressSync(js.buffer);
  assert.equal(sha256(logicalJs), js.record.logicalSha256);
  assert.ok(js.buffer.length <= 204800);
  new vm.Script(logicalJs.toString("utf8"), { filename: js.record.fileName });
  const source = logicalJs.toString("utf8");
  assert.match(source, /function createBuilderCalendarRenderContext\(/);
  assert.match(source, /productDateBounds:getBuilderProductDateBounds\(\)/);
  assert.match(source, /departureDateSet:new Set/);
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_da8c12dc90ffff48e9895498/);
});
