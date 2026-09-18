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
  "deploy/stage29-calendar-alimtalk/date-conflict-alimtalk-20260818-v29"
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

test("29단계 배포 묶음은 일정 충돌 방지와 알림톡 개편 기능을 명시한다", () => {
  assert.equal(manifest.schema, "secret-golf-join-calendar-alimtalk-v1");
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 28);
  Object.values(manifest.features).forEach((enabled) => assert.equal(enabled, true));
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("29단계 모든 파일은 선언된 크기와 해시를 보존한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("압축 자산은 논리 해시·문법·불변 revision과 일치한다", () => {
  const css = readRecord("css");
  const js = readRecord("js");
  const logicalCss = zlib.gunzipSync(css.buffer);
  const logicalJs = zlib.brotliDecompressSync(js.buffer);
  assert.equal(sha256(logicalCss), css.record.logicalSha256);
  assert.equal(sha256(logicalJs), js.record.logicalSha256);
  assert.ok(js.buffer.length <= 204800);
  new vm.Script(logicalJs.toString("utf8"), { filename: js.record.fileName });
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, new RegExp(manifest.assetRevision));
  assert.match(html, /data-golfjoin-critical-css=/);
});

test("즉시 복구 HTML은 검증된 C821B0D1 운영본이다", () => {
  const rollback = readRecord("rollbackHtml").buffer;
  assert.equal(sha256(rollback), "c821b0d138f66f8a85396865784caddb5f0733337d2326e27022b5e8e5ff5d45");
});

test("서버 묶음은 새 성별 템플릿과 complete 모바일 m 링크를 포함한다", () => {
  const source = readRecord("serverIndex").buffer.toString("utf8");
  ["UK1065", "UK1064", "UK1066", "UK1068", "UK1074", "UK1075", "UK1077"].forEach((code) => {
    assert.match(source, new RegExp(`code: \\"${code}\\"`));
  });
  assert.match(source, /GOLFJOIN_COMPLETE_PAGE_MO_URL = "https:\/\/m\.secret-tour\.com/);
  assert.match(source, /action === "quote_send_notification"/);
  new vm.Script(source, { filename: manifest.files.serverIndex.fileName });
});

test("대시보드 묶음은 실제 견적 알림톡 전송 action을 사용한다", () => {
  const dashboard = readRecord("dashboardHtml").buffer.toString("utf8");
  assert.match(dashboard, /data-action="quote-send"/);
  assert.match(dashboard, /quote_send_notification/);
  assert.doesNotMatch(dashboard, /quote-send-placeholder/);
});
