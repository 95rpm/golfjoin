"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(
  root,
  "deploy/stage32-wish-family-detail/modal-section-nav-stability-20260821-v32d"
);
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v32d는 모달 중 섹션 칩 자동 변경만 멈추고 명시적 칩 선택은 보존한다", () => {
  assert.equal(manifest.features.modalLockSuspendsSectionNavAutoSync, true);
  assert.equal(manifest.features.pendingSectionNavFrameRechecksModalLock, true);
  assert.equal(manifest.features.explicitSectionNavSelectionPreserved, true);
  assert.equal(manifest.features.commonModalScrollLockV32cPreserved, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, false);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.features.memberAuthGateRemainsReport, true);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v32d 파일 해시·압축 JavaScript·v32c 복구본이 모두 정상이다", () => {
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });
  const js = zlib.brotliDecompressSync(
    fs.readFileSync(path.join(packageRoot, manifest.files.js.fileName))
  ).toString("utf8");
  new vm.Script(js, { filename: "v32d-golfjoin-main.js" });
  assert.match(js, /function isJoinSectionNavScrollSyncSuspended\(/);
  assert.match(js, /join-widget-page-scroll-locked/);
  assert.match(js, /function updateJoinSectionNavActive\(\)\{if\(isJoinSectionNavScrollSyncSuspended\(\)\)return/);
  assert.match(js, /function scheduleJoinSectionNavActiveUpdate\(\)\{isJoinSectionNavScrollSyncSuspended\(\)\|\|/);
  assert.match(js, /function setJoinSectionNavActive\(/);
  assert.equal(
    manifest.files.rollbackHtml.sha256,
    "5cf06d688d4d40f8c6300836a80b3f1719558cefbf202b71e017b8b1f6ed97f2"
  );
});

test("v32d 실행 문서는 상품상세·하단 메뉴·직접 칩 이동과 v32c 복구를 확인한다", () => {
  const runbook = fs.readFileSync(path.join(packageRoot, manifest.files.runbook.fileName), "utf8");
  assert.match(runbook, /상품상세를 열고 활성 칩이 첫 칩으로 바뀌지 않는지/);
  assert.match(runbook, /하단 메뉴의 모임만들기·모임찾기·나의모임/);
  assert.match(runbook, /직접 섹션 칩을 누르면/);
  assert.match(runbook, /v32c HTML로 즉시 복구/);
});
