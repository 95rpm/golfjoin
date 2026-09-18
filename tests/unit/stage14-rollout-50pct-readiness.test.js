"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage14-rollout/home-data-v2-50pct-20260814"
);
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function inspect(role) {
  const spec = MANIFEST.files[role];
  assert.ok(spec, role);
  const buffer = fs.readFileSync(path.join(PACKAGE_ROOT, spec.fileName));
  assert.equal(buffer.length, spec.bytes, `${role}:bytes`);
  assert.equal(sha256(buffer), spec.sha256, `${role}:sha256`);
  return buffer;
}

test("14-4 50% 묶음은 현 운영 B45F74A7을 정확한 복구본으로 보존한다", () => {
  assert.equal(MANIFEST.schema, "secret-golf-join-stage14-home-data-rollout-v1");
  assert.equal(MANIFEST.status, "production-deployed-verified");
  assert.equal(MANIFEST.stagingEventPlanSeq, 21);
  assert.equal(MANIFEST.requiresGcsUpload, false);
  assert.equal(MANIFEST.legacyCodeRemoved, false);
  assert.equal(MANIFEST.sourceAssetRevision, "gha_48362bc64e0ce0b00aeafc79");
  assert.equal(MANIFEST.assetRevision, "gha_a15f2d1627468db50f6191b4");
  assert.equal(MANIFEST.rollout.previousBasisPoints, 1000);
  assert.equal(MANIFEST.rollout.targetBasisPoints, 5000);
  assert.equal(MANIFEST.rollout.previousPercent, 10);
  assert.equal(MANIFEST.rollout.targetPercent, 50);
  assert.equal(MANIFEST.rollout.audience, "anonymous-only");
  assert.equal(MANIFEST.localVerification.status, "passed");
  assert.equal(MANIFEST.localVerification.fullUnitTests.passed, 141);
  assert.equal(MANIFEST.localVerification.fullUnitTests.failed, 0);
  assert.equal(MANIFEST.localVerification.candidateBrowserTests.passed, 4);
  assert.equal(MANIFEST.localVerification.candidateBrowserTests.failed, 0);
  assert.equal(MANIFEST.localVerification.candidateBrowserTests.eligibleBucket, 4999);
  assert.equal(MANIFEST.localVerification.candidateBrowserTests.ineligibleBucket, 5000);
  assert.equal(MANIFEST.remoteVerification.status, "passed");
  assert.equal(MANIFEST.remoteVerification.originChecksPassed, 4);
  assert.equal(MANIFEST.remoteVerification.originChecksFailed, 0);
  assert.equal(MANIFEST.stagingVerification.status, "passed");
  assert.equal(MANIFEST.stagingVerification.anonymousBoundaryTests.passed, 4);
  assert.equal(MANIFEST.stagingVerification.anonymousBoundaryTests.failed, 0);
  assert.equal(MANIFEST.stagingVerification.signedInDesktop.releaseRequestCount, 0);
  assert.equal(MANIFEST.productionVerification.status, "passed");
  assert.equal(MANIFEST.productionVerification.anonymousBoundaryTests.passed, 4);
  assert.equal(MANIFEST.productionVerification.anonymousBoundaryTests.failed, 0);
  assert.equal(MANIFEST.productionVerification.signedInDesktop.releaseRequestCount, 0);
  assert.equal(MANIFEST.productionVerification.externalAssetErrors, 0);
  assert.equal(MANIFEST.productionVerification.consoleErrors, 0);
  const rollback = inspect("rollbackHtml");
  assert.equal(sha256(rollback), "b45f74a7d48f5bc411ebb7cca277e922f2fa6acbf3341a130b2c7e9bc2782045");
});

test("14-4 50% 후보의 파일·SRI·압축 왕복·200KiB 예산이 일치한다", () => {
  Object.keys(MANIFEST.files).forEach(inspect);
  const deploy = inspect("deployHtml").toString("utf8");
  const css = zlib.gunzipSync(inspect("css"));
  const jsEncoded = inspect("js");
  const js = zlib.brotliDecompressSync(jsEncoded);
  assert.equal(sha256(css), MANIFEST.files.css.logicalSha256);
  assert.equal(sha256(js), MANIFEST.files.js.logicalSha256);
  assert.equal(js.length, MANIFEST.files.js.logicalBytes);
  assert.equal(jsEncoded.length <= MANIFEST.javascriptBudgetBytes, true);
  assert.equal(MANIFEST.javascriptBudgetPassed, true);
  assert.match(js.toString("utf8"), /GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS=5e3/);
  new vm.Script(js.toString("utf8"), { filename: "stage14-50pct-ready.min.js" });
  assert.equal(deploy.includes(MANIFEST.files.css.url), true);
  assert.equal(deploy.includes(MANIFEST.files.js.url), true);
  assert.equal(deploy.includes(`integrity="${MANIFEST.files.css.sri}"`), true);
  assert.equal(deploy.includes(`integrity="${MANIFEST.files.js.sri}"`), true);
  assert.equal(deploy.includes(MANIFEST.sourceAssetRevision), false);
});

test("14-4 실행서는 4999·5000 경계, Gate OFF와 B45F74A7 복구를 포함한다", () => {
  const runbook = inspect("runbook").toString("utf8");
  assert.match(runbook, /gcloud storage cp/);
  assert.match(runbook, /eventPlanSeq 21/);
  assert.match(runbook, /bucket 4999/);
  assert.match(runbook, /bucket 5000/);
  assert.match(runbook, /release-admin-cli\.js gate-off/);
  assert.match(runbook, new RegExp(MANIFEST.files.rollbackHtml.fileName));
});
