"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(root, "deploy/stage31-owner-quote-integrity/participant-group-authority-20260820-v31l");

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v31l은 서버 요약 그룹을 우선하고 내예약 그룹 첫 아이콘에 나 배지를 표시한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.features.myReservationGroupedParticipantBadge, true);
  assert.equal(manifest.features.groupedMemberIdScan, true);
  assert.equal(manifest.features.firstGroupAvatarBadgePlacement, true);
  assert.equal(manifest.features.serverSummaryCompanionGroupPriority, true);
  assert.equal(manifest.features.mutationPayloadGroupFallbackOnly, true);
  assert.equal(manifest.features.creatorAndAddedMembersSingleGroup, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, false);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v31l 파일·압축 JavaScript·550B6E89 복구본이 모두 정상이다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });
  const jsRecord = manifest.files.js;
  const logicalJs = zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, jsRecord.fileName)));
  const source = logicalJs.toString("utf8");
  new vm.Script(source, { filename: "v31l-golfjoin-main.js" });
  assert.match(source, /function renderJoinMyGroupedParticipantSlots[\s\S]{0,1000}\.some\(\(e,t\)=>isJoinMyParticipantMe\(e,[a-z]\+t,[a-z]\)\)/);
  assert.match(source, /participantCompanionGroup:[a-z]\.companionGroup\|\|e\.participantCompanionGroup\|\|""/);
  assert.match(source, /function getJoinApplicationAuthoritativeCompanionGroup[\s\S]{0,500}function applyJoinApplicationPayload[\s\S]{0,1000}getJoinApplicationAuthoritativeCompanionGroup/);
  assert.ok(jsRecord.bytes <= 204800);
  assert.equal(manifest.files.rollbackHtml.sha256, "550b6e8935bea98855a24223e01e9e63369c6573fcc72b6b975d5cdff7fdbce1");
});
