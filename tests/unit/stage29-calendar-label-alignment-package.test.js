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
  "deploy/stage29-calendar-alimtalk/calendar-label-alignment-20260820-v29j"
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

test("v29j 달력 라벨 보정 묶음은 29번과 신규 불변 리비전을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_d1e9dc6fdcd438db945cee3b");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v29j 파일의 크기와 해시가 모두 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("v29j CSS는 PC TODAY와 공휴일 위치 및 모바일 헤더 여백을 통일한다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  assert.match(css, /@media \(min-width: 641px\)\s*\{[\s\S]*?\.calendar-today-label,[\s\S]*?\.builder-day\.today \.builder-day-today-label,[\s\S]*?\.builder-day-holiday-label\s*\{[\s\S]*?font-size:\s*14px;/);
  assert.match(css, /@media \(min-width: 641px\)\s*\{[\s\S]*?\.calendar-today-label\s*\{[\s\S]*?top:\s*calc\(50% \+ -5px\);/);
  assert.match(css, /\.builder-day\.today \.builder-day-today-label\s*\{[\s\S]*?top:\s*calc\(50% \+ 18px\);/);
  assert.match(css, /\.builder-day-holiday-label\s*\{[\s\S]*?top:\s*calc\(50% \+ 18px\);/);
  assert.match(css, /\.calendar-mobile-month-head\s*\{[\s\S]*?padding:\s*6px 9px 0;/);
});

test("v29j JavaScript와 HTML은 v29i 기능과 새 자산 리비전을 보존한다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /function renderCalendarMobileSticky\(/);
  assert.match(source, /"builderActiveScheduleSheet"/);
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_d1e9dc6fdcd438db945cee3b/);
});
