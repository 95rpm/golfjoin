"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { sha256, sriSha256 } = require("../../tools/golfjoin-main/external-assets");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage13-home-assets/production-minified-brotli-bridged-20260813"
);
const SOURCE_PACKAGE_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage13-home-assets/production-critical-css-refresh-20260813"
);

function readManifest(root = PACKAGE_ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
}

function readVerified(root, record) {
  const buffer = fs.readFileSync(path.join(root, record.fileName));
  assert.equal(sha256(buffer), record.sha256, record.fileName);
  assert.equal(buffer.length, record.bytes, record.fileName);
  return buffer;
}

function criticalBlock(html) {
  const match = html.match(/<style data-golfjoin-critical-css="[^"]+">\n[\s\S]*?<\/style>/);
  assert.ok(match, "Critical CSS block must exist");
  return match[0];
}

test("13단계 Brotli 후보는 검증된 운영 HTML을 정확한 복구본으로 포함한다", () => {
  const manifest = readManifest();
  const sourceManifest = readManifest(SOURCE_PACKAGE_ROOT);
  const rollback = readVerified(PACKAGE_ROOT, manifest.files.rollbackHtml);
  const sourceProductionHtml = readVerified(SOURCE_PACKAGE_ROOT, sourceManifest.files.deployHtml);

  assert.equal(manifest.schema, "secret-golf-join-minified-brotli-deployment-v1");
  assert.ok([
    "ready-for-gcs-upload",
    "ready-for-staging-html",
    "staging-verified-ready-for-production",
    "production-deployed-verified",
    "rollback-verified-manual-candidate-check-required",
    "production-redeployment-ready",
    "production-redeployed-mobile-final-check-pending"
  ].includes(manifest.status));
  assert.equal(manifest.sourceAssetRevision, sourceManifest.assetRevision);
  assert.equal(manifest.sourceProductionHtmlSha256, sourceManifest.files.deployHtml.sha256);
  assert.equal(rollback.compare(sourceProductionHtml), 0);
  assert.equal(manifest.recoveryTargetMinutes, 5);
  assert.equal(manifest.localVerification.fullUnitPassed, 128);
  assert.equal(manifest.localVerification.browserTestPassed, 4);
  assert.equal(manifest.localVerification.inlineHandlerScopeRegressionPassed, true);
  assert.equal(manifest.localVerification.forcedJavaScriptFailureRecoveryPassed, true);
  if (manifest.requiresGcsUpload) {
    assert.equal(manifest.status, "ready-for-gcs-upload");
    assert.equal(manifest.remoteVerification, undefined);
    assert.equal(manifest.stagingVerification.status, "pending-gcs-upload");
  } else {
    assert.equal(manifest.remoteVerification.originChecks, 4);
    assert.equal(manifest.remoteVerification.chromiumTestPassed, 2);
    assert.equal(manifest.remoteVerification.encodedHashPassed, true);
    assert.equal(manifest.remoteVerification.decodedLogicalHashPassed, true);
    assert.ok([
      "pending-html-application",
      "passed",
      "production-passed"
    ].includes(manifest.stagingVerification.status));
  }
  if (manifest.status === "production-deployed-verified") {
    assert.equal(manifest.redeploymentVerification.status, "production-passed");
    assert.equal(manifest.redeploymentVerification.oldRevisionAssetCount, 0);
    assert.equal(manifest.redeploymentVerification.detailImageCount, 19);
    assert.equal(manifest.redeploymentVerification.detailBrokenImageCount, 0);
    assert.equal(manifest.redeploymentVerification.browserErrorCount, 0);
    assert.equal(manifest.redeploymentVerification.mobileProductionManualCheckRequired, false);
    assert.equal(manifest.redeploymentVerification.mobileProductionManualCheckPassed, true);
    assert.equal(manifest.redeploymentVerification.mobileHomeMeetingTabsPassed, true);
    assert.equal(manifest.redeploymentVerification.mobileReservationTabsPassed, true);
    assert.equal(manifest.redeploymentVerification.mobileParticipantsAndDetailPassed, true);
    assert.equal(manifest.redeploymentVerification.mobileScrollRestorePassed, true);
  }
});

test("후보 HTML은 Critical CSS를 유지하고 새 revision과 논리 SRI만 참조한다", () => {
  const manifest = readManifest();
  const candidate = readVerified(PACKAGE_ROOT, manifest.files.deployHtml).toString("utf8");
  const rollback = readVerified(PACKAGE_ROOT, manifest.files.rollbackHtml).toString("utf8");

  assert.equal(criticalBlock(candidate), criticalBlock(rollback));
  assert.ok(!candidate.includes(manifest.sourceAssetRevision));
  assert.match(candidate, new RegExp(manifest.assetRevision, "g"));
  assert.equal(candidate.split(manifest.assetRevision).length - 1, manifest.revisionOccurrenceCount);
  assert.equal(candidate.split(manifest.files.css.url).length - 1, 2);
  assert.equal(candidate.split(manifest.files.js.url).length - 1, 1);
  assert.equal(candidate.split(manifest.files.js.sri).length - 1, 1);
  assert.match(candidate, /data-golfjoin-full-css','loaded'/);
  assert.match(candidate, /handleGolfJoinExternalAssetFailure\('js'\)/);
});

test("축소 JS는 Brotli 왕복·문법·200 KiB 전송 예산을 모두 통과한다", () => {
  const manifest = readManifest();
  const encoded = readVerified(PACKAGE_ROOT, manifest.files.js);
  const logical = readVerified(PACKAGE_ROOT, manifest.files.auditJs);
  const decoded = zlib.brotliDecompressSync(encoded);

  assert.equal(manifest.minifier.name, "terser");
  assert.equal(manifest.minifier.version, "5.50.0");
  assert.equal(manifest.minifier.compressPasses, 2);
  assert.equal(manifest.minifier.topLevel, false);
  assert.equal(manifest.minifier.inlineHandlerBridge, true);
  assert.ok(manifest.minifier.inlineHandlerCount >= 200);
  assert.ok(manifest.minifier.inlineHandlerNames.includes("switchJoinMyTab"));
  assert.ok(manifest.minifier.inlineHandlerNames.includes("setMyJoinFilter"));
  assert.equal(manifest.delivery.javascript, "br");
  assert.equal(manifest.delivery.brotliQuality, 11);
  assert.equal(decoded.compare(logical), 0);
  assert.equal(sha256(logical), manifest.files.js.logicalSha256);
  assert.equal(sriSha256(logical), manifest.files.js.sri);
  assert.equal(encoded.length, manifest.javascriptBrotliBytes);
  assert.ok(encoded.length <= manifest.javascriptBudgetBytes);
  assert.equal(manifest.javascriptBudgetPassed, true);
  assert.doesNotThrow(() => new vm.Script(logical.toString("utf8")));
});

test("CSS는 검증 완료된 gzip 논리 내용과 전송 파일을 그대로 재사용한다", () => {
  const manifest = readManifest();
  const sourceManifest = readManifest(SOURCE_PACKAGE_ROOT);
  const encoded = readVerified(PACKAGE_ROOT, manifest.files.css);
  const sourceEncoded = readVerified(SOURCE_PACKAGE_ROOT, sourceManifest.files.css);
  const logical = zlib.gunzipSync(encoded);

  assert.equal(manifest.delivery.css, "gzip");
  assert.equal(manifest.files.css.contentEncoding, "gzip");
  assert.equal(encoded.compare(sourceEncoded), 0);
  assert.equal(sha256(logical), manifest.files.css.logicalSha256);
  assert.equal(sriSha256(logical), manifest.files.css.sri);
  assert.equal(manifest.files.css.logicalSha256, sourceManifest.files.css.logicalSha256);
});

test("실행서는 18번 선검증·헤더·즉시 복구 순서를 명시한다", () => {
  const manifest = readManifest();
  const runbook = readVerified(PACKAGE_ROOT, manifest.files.runbook).toString("utf8");

  assert.match(runbook, /eventPlanSeq=18/);
  assert.match(runbook, /content-encoding=gzip/);
  assert.match(runbook, /content-encoding=br/);
  assert.match(runbook, /운영 전환하지 말고/);
  assert.match(runbook, new RegExp(manifest.files.rollbackHtml.fileName));
});
