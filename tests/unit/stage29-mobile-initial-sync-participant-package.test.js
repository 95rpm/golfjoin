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
  "deploy/stage29-calendar-alimtalk/mobile-initial-sync-participant-20260820-v29i"
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

test("v29i 초기 동기화·참여자 정보 묶음은 29번과 신규 불변 리비전을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_15e0f38059bea23acf105c2b");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v29i 파일의 크기와 해시가 모두 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("v29i CSS는 모바일 한 줄 헤더·연결선·공휴일 위치를 고정한다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  assert.match(css, /calendar-mobile-month-head\s*\{[\s\S]*?grid-template-rows:\s*36px;/);
  assert.match(css, /calendar-mobile-month-head \.calendar-availability-legend-item\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /calendar-mobile-month-navigation\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /calendar-mobile-paged-month \.calendar-cell\.active-schedule \.calendar-day-button::before\s*\{[\s\S]*?top:\s*3px;/);
  assert.match(css, /calendar-mobile-paged-month \.calendar-holiday-label\s*\{[\s\S]*?top:\s*38px;/);
});

test("v29i JavaScript는 최초 회원 일정 도착과 참여자 정보 상위 레이어를 포함한다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /function renderCalendarMobileSticky\(/);
  assert.match(source, /calendar-availability-legend-item active-schedule/);
  assert.match(source, /function hydrateJoinApplicationsFromGoogleSheetUncoalesced\([\s\S]*?refreshOpenCalendarSheetAfterJoinDataChange\(\)/);
  assert.match(source, /function hydrateBuilderApplicationJoinsFromGoogleSheetUncoalesced\([\s\S]*?refreshOpenCalendarSheetAfterJoinDataChange\(\)/);
  assert.match(source, /function openParticipant\([\s\S]*?"builderActiveScheduleSheet"[\s\S]*?"2147483700"[\s\S]*?"2147483701"/);
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_15e0f38059bea23acf105c2b/);
});
