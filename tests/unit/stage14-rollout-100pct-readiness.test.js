"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage14-rollout/home-data-v2-100pct-20260814"
);
const SOURCE_PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage14-rollout/home-data-v2-50pct-20260814"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
const sourceManifest = JSON.parse(
  fs.readFileSync(path.join(SOURCE_PACKAGE_ROOT, "manifest.json"), "utf8")
);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readVerifiedFile(record) {
  const buffer = fs.readFileSync(path.join(PACKAGE_ROOT, record.fileName));
  assert.equal(buffer.length, record.bytes, record.fileName);
  assert.equal(sha256(buffer), record.sha256, record.fileName);
  return buffer;
}

test("14-5 100% 묶음은 현재 운영 9146A817을 정확한 복구본으로 보존한다", () => {
  assert.equal(manifest.status, "production-deployed-verified");
  assert.equal(manifest.stagingEventPlanSeq, 22);
  assert.equal(manifest.rollout.previousBasisPoints, 5000);
  assert.equal(manifest.rollout.targetBasisPoints, 10000);
  assert.equal(manifest.rollout.previousPercent, 50);
  assert.equal(manifest.rollout.targetPercent, 100);
  assert.equal(manifest.rollout.audience, "anonymous-only");
  assert.equal(manifest.legacyCodeRemoved, false);
  assert.equal(manifest.sourceAssetRevision, sourceManifest.assetRevision);
  assert.equal(manifest.sourceProductionHtmlSha256, sourceManifest.files.deployHtml.sha256);

  const rollback = readVerifiedFile(manifest.files.rollbackHtml);
  const currentProduction = fs.readFileSync(
    path.join(SOURCE_PACKAGE_ROOT, sourceManifest.files.deployHtml.fileName)
  );
  assert.equal(rollback.equals(currentProduction), true);
  assert.equal(sha256(rollback).slice(0, 8).toUpperCase(), "9146A817");
});

test("14-5 100% 후보의 파일·SRI·압축 왕복·200KiB 예산이 일치한다", () => {
  Object.values(manifest.files).forEach(readVerifiedFile);
  const html = readVerifiedFile(manifest.files.deployHtml).toString("utf8");
  const css = zlib.gunzipSync(readVerifiedFile(manifest.files.css));
  const js = zlib.brotliDecompressSync(readVerifiedFile(manifest.files.js));

  assert.equal(sha256(css), manifest.files.css.logicalSha256);
  assert.equal(sha256(js), manifest.files.js.logicalSha256);
  assert.equal(manifest.javascriptBudgetPassed, true);
  assert.ok(manifest.javascriptBrotliBytes <= 200 * 1024);
  assert.match(html, new RegExp(manifest.assetRevision));
  assert.match(html, new RegExp(manifest.files.css.sri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(manifest.files.js.sri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(html, new RegExp(manifest.sourceAssetRevision));
});

test("14-5 로컬 검증은 최고 bucket·회원 제외·Gate OFF·Legacy 복구를 모두 고정한다", () => {
  const local = manifest.localVerification;
  assert.equal(local.status, "passed");
  assert.equal(local.highestAnonymousBucketPassed, 9999);
  assert.equal(local.memberExclusionPassed, true);
  assert.equal(local.remoteGateOffPassed, true);
  assert.equal(local.legacyAuditPassed, true);
  assert.deepEqual(local.fullUnitTests, { passed: 145, failed: 0 });
  assert.equal(local.candidateBrowserTests.passed, 2);
  assert.equal(local.candidateBrowserTests.skipped, 2);
  assert.equal(local.candidateBrowserTests.failed, 0);
  assert.equal(local.candidateBrowserTests.anonymousIneligibleBucketExists, false);

  const runbook = readVerifiedFile(manifest.files.runbook).toString("utf8");
  assert.match(runbook, /bucket 9999/);
  assert.match(runbook, /rolloutBasisPoints: 10000/);
  assert.match(runbook, /member_not_eligible/);
  assert.match(runbook, /gate-off/);
  assert.match(runbook, /ROLLBACK_golfjoin_main_9146A817\.html/);
});

test("14-5 원격 자산은 PC·MO의 압축·해시·CORS·불변 캐시를 모두 통과한다", () => {
  const remote = manifest.remoteVerification;
  assert.equal(manifest.requiresGcsUpload, false);
  assert.equal(remote.status, "passed");
  assert.equal(remote.originChecksPassed, 4);
  assert.equal(remote.originChecksFailed, 0);
  assert.equal(remote.desktopOriginPassed, true);
  assert.equal(remote.mobileOriginPassed, true);
  assert.equal(remote.httpStatusPassed, true);
  assert.equal(remote.logicalHashPassed, true);
  assert.equal(remote.contentEncodingPassed, true);
  assert.equal(remote.contentTypePassed, true);
  assert.equal(remote.corsPassed, true);
  assert.equal(remote.immutableCachePassed, true);

  const staging = manifest.stagingVerification;
  assert.equal(staging.status, "passed");
  assert.equal(staging.eventPlanSeq, 22);
  assert.equal(staging.assetRevisionMatched, true);
  assert.equal(staging.anonymousBrowserTests.passed, 2);
  assert.equal(staging.anonymousBrowserTests.failed, 0);
  assert.equal(staging.anonymousBrowserTests.eligibleBucket, 9999);
  assert.equal(staging.productDetail.loadedImages, 19);
  assert.equal(staging.productDetail.brokenImages, 0);
  assert.equal(staging.productDetail.periodOptions, 3);
  assert.equal(staging.productDetail.periodSwitchPassed, true);
  assert.equal(staging.productDetail.scrollRestoreY, 830);
  assert.deepEqual(staging.signedInMember.reservationTabsPassed, [
    "created",
    "joined",
    "completed"
  ]);
  assert.equal(staging.signedInMember.participantCompositionPassed, true);
  assert.equal(staging.signedInMember.reservationScrollRestorePassed, true);
  assert.equal(staging.appHorizontalOverflowPx, 0);
  assert.equal(staging.consoleErrors, 0);

  const production = manifest.productionVerification;
  assert.equal(production.status, "passed");
  assert.equal(production.eventPlanSeq, 3);
  assert.equal(production.assetRevisionMatched, true);
  assert.equal(production.anonymousBrowserTests.passed, 2);
  assert.equal(production.anonymousBrowserTests.failed, 0);
  assert.equal(production.anonymousBrowserTests.releaseRequestCountPerClient, 3);
  assert.equal(production.anonymousBrowserTests.legacyCoreRequestCount, 0);
  assert.equal(production.anonymousBrowserTests.pageErrors, 0);
  assert.equal(production.productDetail.standaloneBrokenImages, 0);
  assert.equal(production.productDetail.familyBrokenImages, 0);
  assert.equal(production.productDetail.familyPeriodOptions, 3);
  assert.equal(production.productDetail.familyPeriodSwitchPassed, true);
  assert.deepEqual(production.signedInMember.reservationTabsPassed, [
    "created",
    "joined",
    "completed"
  ]);
  assert.equal(production.signedInMember.participantCompositionPassed, true);
  assert.equal(production.appHorizontalOverflowPx, 0);
  assert.equal(production.externalAssetFailure, false);
});
