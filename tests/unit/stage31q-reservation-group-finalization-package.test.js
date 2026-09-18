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
  "deploy/stage31-owner-quote-integrity/reservation-group-finalization-20260821-v31q"
);

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v31q는 내예약 재조회 후 생성자 그룹을 고정하고 동일 일정 카드를 한 건으로 만든다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.schema, "secret-golf-join-reservation-group-finalization-v1");
  assert.equal(manifest.features.creatorOwnedApplicationGroupFinalizedAfterSummary, true);
  assert.equal(manifest.features.joinedReservationDedupedBySchedule, true);
  assert.equal(manifest.features.currentMemberPrivateReadAlwaysStarts, true);
  assert.equal(manifest.features.oneApplicationTwoPeopleKeptDistinct, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, false);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
});

test("v31q 파일·압축 JavaScript·DAA1D2F8 복구본이 모두 정상이다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });
  const jsRecord = manifest.files.js;
  const source = zlib.brotliDecompressSync(
    fs.readFileSync(path.join(packageRoot, jsRecord.fileName))
  ).toString("utf8");
  new vm.Script(source, { filename: "v31q-golfjoin-main.js" });
  assert.match(source, /function enforceCreatorOwnedApplicationCompanionGroup/);
  assert.match(
    source,
    /function applyJoinApplicationPayload[\s\S]{0,8500}enforceCreatorOwnedApplicationCompanionGroup/
  );
  assert.match(source, /function getJoinMyJoinedApplicationKey[\s\S]{0,800}schedule:/);
  assert.ok(jsRecord.bytes <= 204800);
  assert.equal(
    manifest.files.rollbackHtml.sha256,
    "daa1d2f8a95ac969d8adc1959d2a9b4f634f216ebc950b88d04e3ae8afc5792b"
  );
});
