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
  "deploy/stage29-calendar-alimtalk/calendar-active-sheet-geometry-20260820-v29f-final"
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

test("29번 참여일정 카드 시트 보완은 별도 불변 리비전과 29번 HTML을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_0e181df94eaa031463abd46a");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("29번 참여일정 카드 시트 보완 파일은 크기와 해시가 모두 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("후보 CSS는 PC와 모바일 모두 원 모달의 너비·하단·하단 라운드를 사용한다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  assert.match(css, /\.builder-active-schedule-sheet\s*\{[\s\S]*?width:\s*var\(--builder-active-origin-width/);
  assert.match(css, /\.builder-active-schedule-sheet\s*\{[\s\S]*?bottom:\s*var\(--builder-active-origin-bottom/);
  assert.match(css, /\.builder-active-schedule-sheet\s*\{[\s\S]*?transform:\s*translate\(var\(--builder-active-origin-translate-x/);
  assert.match(css, /body\s*>\s*#builderActiveScheduleBackdrop\.sgj-portal-overlay\s*\{[\s\S]*?inset:\s*auto\s*!important/);
  assert.match(css, /body\s*>\s*#builderActiveScheduleSheet\.sgj-portal-overlay\s*\{[\s\S]*?width:\s*var\(--builder-active-origin-width,[^)]*\)\s*!important/);
  assert.match(css, /body\s*>\s*#builderActiveScheduleSheet\.sgj-portal-overlay\s*\{[\s\S]*?border-radius:\s*24px 24px var\(--builder-active-origin-radius-bottom-right/);
});

test("후보 JavaScript는 월 경계 참여일정 클릭과 원 모달 기준 좌표 동기화를 포함한다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /onclick="openBuilderActiveScheduleSheet\('/);
  assert.match(source, /function syncBuilderActiveScheduleLayerGeometry/);
  assert.match(source, /--builder-active-origin-width/);
  assert.match(source, /--builder-active-origin-bottom/);
  assert.match(source, /"builderActiveScheduleBackdrop"===e\?"2147483638"/);
  assert.match(source, /"builderActiveScheduleSheet"===e\?"2147483639"/);

  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_0e181df94eaa031463abd46a/);
});
