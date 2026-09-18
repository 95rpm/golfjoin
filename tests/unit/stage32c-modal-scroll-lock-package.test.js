"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(root, "deploy/stage32-wish-family-detail/all-modal-scroll-lock-20260821-v32c-final");
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v32c는 전체 모달 원위치 고정과 중첩 모달 기준점 보존을 브라우저에만 배포한다", () => {
  assert.equal(manifest.features.allBlockingModalsPreserveOpeningScroll, true);
  assert.equal(manifest.features.allBlockingModalsRestoreOpeningScroll, true);
  assert.equal(manifest.features.nestedModalsKeepFirstScrollAnchor, true);
  assert.equal(manifest.features.fullDocumentBackdropPreserved, true);
  assert.equal(manifest.features.detailSpecificScrollLockRemoved, true);
  assert.equal(manifest.features.profileSpecificScrollLockRemoved, true);
  assert.equal(manifest.features.mobileParticipantSheetUsesCommonLock, true);
  assert.equal(manifest.features.wishlistV32bFixPreserved, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, false);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.features.memberAuthGateRemainsReport, true);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v32c 파일 해시·압축 JavaScript·v32b 복구본이 모두 정상이다", () => {
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });
  const js = zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, manifest.files.js.fileName))).toString("utf8");
  new vm.Script(js, { filename: "v32c-golfjoin-main.js" });
  assert.match(js, /captureWidgetModalPageScrollState/);
  assert.match(js, /lockWidgetModalPageScroll/);
  assert.match(js, /unlockWidgetModalPageScroll/);
  assert.match(js, /join-widget-page-scroll-locked/);
  assert.doesNotMatch(js, /lockDetailModalPageScroll|lockJoinProfileManagePageScroll/);
  assert.equal(manifest.files.rollbackHtml.sha256, "1200ab07146cb16fa5b72db80f6320bcdda737c80d358ddaec4be3cf477c8f64");
});

test("v32c 실행 문서는 모든 주요 모달과 브라우저 전용 배포·복구를 확인한다", () => {
  const runbook = fs.readFileSync(path.join(packageRoot, manifest.files.runbook.fileName), "utf8");
  assert.match(runbook, /모임만들기·모임찾기·로그인·나의모임·내예약/);
  assert.match(runbook, /중첩 모달/);
  assert.match(runbook, /Sheet API는 현재 배포본을 그대로 유지/);
  assert.match(runbook, /v32b HTML로 즉시 복구/);
});
