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
  "deploy/stage29-calendar-alimtalk/calendar-active-schedule-20260820-v29e"
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

test("29번 참여중 일정 클릭 보완 묶음은 별도 불변 리비전과 29번 HTML을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_6f7d7309d1cac09d77e7e3c1");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("29번 참여중 일정 클릭 보완 묶음의 모든 파일 해시가 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("후보 CSS는 비활성보다 참여중 날짜를 우선하고 공용 상품 시트를 최상위에 표시한다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  assert.match(css, /calendar-cell\.unavailable\.active-schedule[^}]*opacity:\s*1/);
  assert.match(css, /calendar-cell\.active-schedule \.calendar-day-button strong[^}]*color:\s*#c2410c !important/);
  assert.match(css, /builder-active-schedule-sheet[^}]*position:\s*fixed/);
  assert.match(css, /builder-active-schedule-sheet\.open[^}]*transform:\s*translate\(-50%,\s*0\)/);
});

test("후보 JavaScript는 참여 가능 달력의 참여중 날짜에서 새 모임과 같은 상품 시트를 연다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /openBuilderActiveScheduleSheet/);
  assert.match(source, /portalOverlayToBody\("builderActiveScheduleSheet"\)/);
  assert.match(source, /renderRegionProductCard/);
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_6f7d7309d1cac09d77e7e3c1/);
});
