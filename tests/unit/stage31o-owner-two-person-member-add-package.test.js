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
  "deploy/stage31-owner-quote-integrity/owner-two-person-member-add-20260820-v31o"
);

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v31o는 한 번의 멤버 추가 2명을 서로 다른 참여자로 유지하고 한 그룹으로 연결한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.schema, "secret-golf-join-owner-two-person-member-add-v1");
  assert.equal(manifest.features.companionGroupExcludedFromParticipantIdentity, true);
  assert.equal(manifest.features.oneApplicationTwoPeopleKeptDistinct, true);
  assert.equal(manifest.features.materializedAndSummaryParticipantsAlignedOneToOne, true);
  assert.equal(manifest.features.publicLightCannotReleaseMemberPrivateLoading, true);
  assert.equal(manifest.features.memberScopedBuilderReadiness, true);
  assert.equal(manifest.features.memberScopedJoinApplicationReadiness, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, false);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v31o 파일·압축 JavaScript·C205AD56 복구본이 모두 정상이다", () => {
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
  new vm.Script(source, { filename: "v31o-golfjoin-main.js" });
  const markerBlock = source.slice(
    source.indexOf("function getJoinParticipantApplicationMarkers"),
    source.indexOf("function hasJoinParticipantApplicationMarkerOverlap")
  );
  assert.doesNotMatch(markerBlock, /companionGroup/);
  assert.match(
    source,
    /function applyParticipantSummaryGroupsToMaterializedParticipants[\s\S]{0,2200}used:!1/
  );
  assert.ok(jsRecord.bytes <= 204800);
  assert.equal(
    manifest.files.rollbackHtml.sha256,
    "c205ad56eb726224f502bca34e235ad447d1f95aa89d941ca2b5010fa316a5df"
  );
});
