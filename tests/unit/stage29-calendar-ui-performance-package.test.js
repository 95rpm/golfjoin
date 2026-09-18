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
  "deploy/stage29-calendar-alimtalk/calendar-ui-performance-20260820-v29c"
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

test("29번 달력 UI·성능 통합 묶음은 별도 불변 리비전과 29번 HTML을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_aafa3082c4197c6db06ad924");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("29번 달력 UI·성능 통합 묶음의 모든 파일 해시가 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("통합 CSS는 PC 참여중 범위를 날짜 칸 간격까지 연결한다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  assert.match(css, /calendar-cell\.active-schedule\.calendar-week-start/);
  assert.match(css, /calendar-cell\.active-schedule\.calendar-week-end/);
  assert.match(css, /left:\s*-5px/);
  assert.match(css, /right:\s*-5px/);
});

test("통합 JavaScript는 두 달력의 월 단위 컨텍스트와 월 경계 참여중 범위를 포함한다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /function createBuilderCalendarRenderContext\(/);
  assert.match(source, /function createJoinableCalendarRenderContext\(/);
  assert.match(source, /registeredDepartureDates:new Set/);
  assert.match(source, /calendar-week-start/);
  assert.match(source, /calendar-week-end/);
  assert.doesNotMatch(source, /function renderCalendarSheet\(\)\{clearActiveJoinMySchedulesCache\(\)/);
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_aafa3082c4197c6db06ad924/);
});
