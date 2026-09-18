"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(root, "deploy/stage31-owner-quote-integrity/same-member-companion-reuse-20260820-v31k");
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v31k 묶음은 A·B 동일 회원 그룹과 최초 신청값 재사용을 함께 배포한다", () => {
  assert.equal(manifest.features.immediateParticipantDeduplication, true);
  assert.equal(manifest.features.creatorOwnedCompanionGrouping, true);
  assert.equal(manifest.features.sameMemberCompanionGrouping, true);
  assert.equal(manifest.features.singleCurrentMemberBadge, true);
  assert.equal(manifest.features.earliestApplicationPreferenceReuse, true);
  assert.equal(manifest.features.chronologicalApplicationReplay, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, true);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v31k 모든 파일은 선언 해시와 일치하고 압축 JavaScript 문법이 정상이다", () => {
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });
  const jsRecord = manifest.files.js;
  const logicalJs = zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, jsRecord.fileName)));
  const logicalSource = logicalJs.toString("utf8");
  new vm.Script(logicalSource, { filename: "v31k-golfjoin-main.js" });
  assert.match(logicalSource, /applyParticipantSummaryGroupsToMaterializedParticipants/);
  assert.match(logicalSource, /getInitialSameMemberApplyPayload/);
  assert.match(logicalSource, /applyInitialSameMemberApplyPreferences/);
  assert.match(logicalSource, /sortJoinApplicationPayloadsBySubmittedAt/);
  assert.ok(jsRecord.bytes <= 204800);
});

test("v31k 서버 후보와 v31h 서버·HTML 복구본은 당시 확정 해시를 보존한다", () => {
  const serverCandidate = fs.readFileSync(path.join(packageRoot, manifest.files.serverIndex.fileName));
  assert.equal(digest(serverCandidate), "e9010fb9fa63eaaac12de7175704e703f3775c5b838392283798e96c65181112");
  assert.equal(manifest.files.rollbackServerIndex.sha256, "7e4a897cd246c3af1cdebf2ea69c3aeaf2fbf597aaf37534aa66f5e1bcca7f5c");
  assert.equal(manifest.files.rollbackHtml.sha256, "a45d2c3c6039f157c4bed89ab81fe61a2eb97ae03c20a97e59660adefac6b1ac");
});

test("v31k 실행 문서는 A 생성자와 B 참여자 시나리오를 각각 검사한다", () => {
  const runbook = fs.readFileSync(path.join(packageRoot, manifest.files.runbook.fileName), "utf8");
  assert.match(runbook, /생성자 A가 1명 일정을 만든 뒤/);
  assert.match(runbook, /A 일정에 B가 1명 참여한 뒤/);
  assert.match(runbook, /라운딩스타일·선호멤버구성·한 줄 인사/);
  assert.match(runbook, /A45D2C3C/);
});
