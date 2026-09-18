"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(root, "deploy/stage31-owner-quote-integrity/participant-race-reconciliation-20260820-v31m");

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v31m은 최초 진입의 요약·실체 참여자 중복을 제거하고 확정 인원으로 고정한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.features.summaryMaterializedParticipantDedupe, true);
  assert.equal(manifest.features.materializedParticipantDetailPriority, true);
  assert.equal(manifest.features.authoritativeConfirmedCountTrim, true);
  assert.equal(manifest.features.deterministicReloadResult, true);
  assert.equal(manifest.features.participantSummaryArrivalOrderReconciled, true);
  assert.equal(manifest.features.creatorJoinedTabFlickerSuppressed, true);
  assert.equal(manifest.features.classificationWaitsForBothMemberDatasets, true);
  assert.equal(manifest.features.serverSummaryCompanionGroupPriority, true);
  assert.equal(manifest.features.myReservationGroupedParticipantBadge, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, false);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v31m 파일·압축 JavaScript·D74DDA04 복구본이 모두 정상이다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });
  const jsRecord = manifest.files.js;
  const source = zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, jsRecord.fileName))).toString("utf8");
  new vm.Script(source, { filename: "v31m-golfjoin-main.js" });
  assert.match(source, /function dedupeJoinParticipantSummaryPreviews[\s\S]{0,1500}function getLightCreatorPreviewPrefixCount/);
  assert.match(source, /function ensureJoinParticipantSummaryCount[\s\S]{0,500}dedupeJoinParticipantSummaryPreviews/);
  assert.match(source, /function reconcileJoinParticipantsWithLightSummary[\s\S]{0,2500}ensureJoinParticipantSummaryCount/);
  assert.match(source, /function shouldIncludeJoinMyJoinedApplication[\s\S]{0,1000}getJoinMyTargetScheduleCreatorSeq/);
  assert.match(source, /function isMyHomeJoinClassificationReady[\s\S]{0,500}googleSheetJoinApplicationsReadCompleted/);
  assert.ok(jsRecord.bytes <= 204800);
  assert.equal(manifest.files.rollbackHtml.sha256, "d74dda0441d532a38db2612904ad38fba0b4b68cefdf341c886e25833c64dd88");
});
