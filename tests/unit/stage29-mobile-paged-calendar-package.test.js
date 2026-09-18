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
  "deploy/stage29-calendar-alimtalk/mobile-paged-calendar-20260820-v29h"
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

test("v29h 모바일 한 달 페이징 묶음은 29번과 신규 불변 리비전을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_7cdeebf06f30ccbe6de40ed1");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v29h 파일의 크기와 해시가 모두 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("v29h CSS는 모바일 월 헤더·라벨 위치·요일·날짜 간격을 새 모임 규격으로 맞춘다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  assert.match(css, /calendar-mobile-month-head \.calendar-availability-legend-item\.active-schedule\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?justify-self:\s*start;/);
  assert.match(css, /calendar-mobile-month-head \.calendar-availability-legend-item\.available\s*\{[\s\S]*?grid-column:\s*3;[\s\S]*?justify-self:\s*end;/);
  assert.match(css, /calendar-mobile-month-label\s*\{[\s\S]*?color:\s*var\(--text\);[\s\S]*?font-size:\s*18px;[\s\S]*?font-weight:\s*800;/);
  assert.match(css, /calendar-mobile-month-navigation \.calendar-month-nav\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?width:\s*36px;/);
  assert.match(css, /calendar-mobile-sticky \.calendar-label\s*\{[\s\S]*?padding:\s*8px 0;[\s\S]*?color:\s*#373A3C;[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*700;/);
  assert.match(css, /calendar-mobile-paged-month \.calendar-cell,[\s\S]*?calendar-mobile-paged-month \.calendar-day-button\s*\{[\s\S]*?min-height:\s*60px;/);
});

test("v29h JavaScript는 모바일에 한 달만 렌더하고 기존 일정 카드 시트를 보존한다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /renderCalendarMobileSticky\(calendarViewMonth,/);
  assert.match(source, /hideMonthTitle:!0/);
  assert.match(source, /mobilePaged:!0/);
  assert.doesNotMatch(source, /mobileEndMonth/);
  assert.match(source, /function openBuilderActiveScheduleSheet\(/);
  assert.match(source, /function startBuilderActiveScheduleOpenAnimation\(/);
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_7cdeebf06f30ccbe6de40ed1/);
});
