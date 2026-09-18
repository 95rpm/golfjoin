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
  "deploy/stage29-calendar-alimtalk/mobile-today-label-20260820-v29k"
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

test("v29k 모바일 TODAY 라벨 묶음은 29번과 신규 불변 리비전을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_4b95243c2b90fd4f85b1d2d3");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v29k 파일의 크기와 해시가 모두 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("v29k CSS는 모바일 두 달력의 TODAY 크기와 참여 가능 달력 위치를 보정한다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  assert.match(css, /@media \(max-width: 640px\)\s*\{[\s\S]*?\.calendar-today-label\s*\{[\s\S]*?top:\s*38px;[\s\S]*?font-size:\s*11px;/);
  assert.match(css, /@media \(max-width: 640px\)\s*\{[\s\S]*?\.builder-day\.today \.builder-day-today-label\s*\{[\s\S]*?font-size:\s*11px;/);
  assert.match(css, /@media \(min-width: 641px\)\s*\{[\s\S]*?\.calendar-today-label,[\s\S]*?\.builder-day\.today \.builder-day-today-label,[\s\S]*?\.builder-day-holiday-label\s*\{[\s\S]*?font-size:\s*14px;/);
  assert.match(css, /\.calendar-mobile-month-head\s*\{[\s\S]*?padding:\s*6px 9px 0;/);
});

test("v29k JavaScript와 HTML은 기존 기능과 새 자산 리비전을 보존한다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /function renderCalendarMobileSticky\(/);
  assert.match(source, /"builderActiveScheduleSheet"/);
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_4b95243c2b90fd4f85b1d2d3/);
});
