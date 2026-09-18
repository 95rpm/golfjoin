"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(root, "deploy/stage32-wish-family-detail/wish-delete-backdrop-20260821-v32b");
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v32b는 찜 삭제 확정과 PC 상세 배경 유지를 서버·브라우저에 함께 배포한다", () => {
  assert.equal(manifest.features.deletedWishTombstonesReturnedByServer, true);
  assert.equal(manifest.features.deletedWishTombstonesPreservedByBrowser, true);
  assert.equal(manifest.features.staleLocalWishesCannotResurrect, true);
  assert.equal(manifest.features.pcDetailBackdropPreserved, true);
  assert.equal(manifest.features.mobileFixedScrollLockPreserved, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, true);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.features.memberAuthGateRemainsReport, true);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v32b 파일 해시·압축 내용·서버 복구본이 모두 정상이다", () => {
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });

  const js = zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, manifest.files.js.fileName))).toString("utf8");
  const css = zlib.gunzipSync(fs.readFileSync(path.join(packageRoot, manifest.files.css.fileName))).toString("utf8");
  const server = fs.readFileSync(path.join(packageRoot, manifest.files.serverIndex.fileName), "utf8");
  new vm.Script(js, { filename: "v32b-golfjoin-main.js" });
  new vm.Script(server, { filename: "v32b-index.js" });
  assert.match(js, /joinWishesSheetReadCacheV2/);
  assert.match(js, /mergeJoinWishProductRecords/);
  assert.match(js, /usesFixedBodyLock/);
  assert.match(css, /\.detail-family-periods/);
  assert.equal(manifest.files.rollbackHtml.sha256, "49cbeb0c2279911a8c10a83da5b2b0fdb6614ceb1aac0b7e1a7f2108b1d8d501");
  assert.equal(manifest.files.rollbackServer.sha256, "e9010fb9fa63eaaac12de7175704e703f3775c5b838392283798e96c65181112");
});

test("v32b 실행 문서는 삭제·새로고침·PC 배경·복구를 모두 검사한다", () => {
  const runbook = fs.readFileSync(path.join(packageRoot, manifest.files.runbook.fileName), "utf8");
  assert.match(runbook, /세 상품을 모두 삭제/);
  assert.match(runbook, /로그아웃\/로그인 후 찜 목록이 0개/);
  assert.match(runbook, /PC 상세모달 뒤에 현재 메인 위치/);
  assert.match(runbook, /HTML을 먼저 복구/);
});
