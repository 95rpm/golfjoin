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
  "deploy/stage29-calendar-alimtalk/calendar-index-loading-20260820-v29d"
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

test("29번 캘린더 인덱스·정적 로딩 묶음은 새 불변 리비전과 29번 HTML을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_b5481e251ae8a7a7bc41970e");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("29번 캘린더 인덱스·정적 로딩 묶음의 모든 파일 해시가 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("후보 CSS는 정적 회색 로딩·상단 연결선·흰색 일정 끝점·통일된 TODAY를 포함한다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  assert.match(css, /calendar-sheet-common-loading/);
  assert.match(css, /calendar-cell\.active-schedule \.calendar-day-button::before\s*\{[^}]*top:\s*0[^}]*transform:\s*none/);
  assert.match(css, /active-schedule-start \.calendar-day-button strong/);
  assert.match(css, /builder-calendar-loading-cell/);
  assert.match(css, /builder-day\.today \.builder-day-number\s*\{[^}]*width:\s*34px/);
});

test("후보 JavaScript는 상품 원본·날짜 인덱스를 재사용하고 화면 뒤에서 월 데이터를 갱신한다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /function getBuilderProductDateIndex\(/);
  assert.match(source, /builderProductSourceCache/);
  assert.match(source, /builderRegisteredProductsCache/);
  assert.match(source, /function renderBuilderCalendarLoadingShell\(/);
  assert.match(source, /calendar-sheet-common-loading/);
  assert.doesNotMatch(source, /calendar-loading-cell-day skeleton-glass-shimmer/);
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_b5481e251ae8a7a7bc41970e/);
});
