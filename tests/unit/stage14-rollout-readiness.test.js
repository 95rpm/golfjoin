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
  "deploy/stage14-rollout/home-data-v2-10pct-20260814"
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

test("14단계 배포 묶음은 현 운영 5C09A3C5를 그대로 복구본으로 보존한다", () => {
  assert.equal(MANIFEST.schema, "secret-golf-join-stage14-home-data-rollout-v1");
  assert.equal(MANIFEST.status, "production-deployed-verified");
  assert.equal(MANIFEST.requiresGcsUpload, false);
  assert.equal(MANIFEST.remoteVerification.status, "passed");
  assert.equal(MANIFEST.remoteVerification.originChecks, 4);
  assert.equal(MANIFEST.stagingVerification.status, "passed");
  assert.equal(MANIFEST.stagingVerification.eventPlanSeq, 20);
  assert.equal(MANIFEST.stagingVerification.releaseBoundaryTestPassed, 4);
  assert.equal(MANIFEST.productionVerification.status, "passed");
  assert.equal(MANIFEST.productionVerification.eventPlanSeq, 3);
  assert.equal(MANIFEST.productionVerification.releaseBoundaryTestPassed, 4);
  assert.equal(MANIFEST.productionVerification.loggedInReleaseRequestCount, 0);
  assert.equal(MANIFEST.legacyCodeRemoved, false);
  assert.equal(MANIFEST.sourceAssetRevision, "gha_5bc35b4dfa142ab84486bdb4");
  assert.match(MANIFEST.assetRevision, /^gha_[a-f0-9]{24}$/);
  assert.notEqual(MANIFEST.assetRevision, MANIFEST.sourceAssetRevision);
  assert.equal(MANIFEST.rollout.previousBasisPoints, 100);
  assert.equal(MANIFEST.rollout.targetBasisPoints, 1000);
  assert.equal(MANIFEST.rollout.audience, "anonymous-only");
  const rollback = inspect("rollbackHtml");
  assert.equal(sha256(rollback), "5c09a3c54a42632f72b5e0910cb66cf49d68d22b0f03306da14370ff2f158df9");
});

test("14단계 후보의 모든 파일·SRI·압축 왕복·200KiB 예산이 일치한다", () => {
  Object.keys(MANIFEST.files).forEach(inspect);
  const deploy = inspect("deployHtml").toString("utf8");
  const cssEncoded = inspect("css");
  const jsEncoded = inspect("js");
  const css = zlib.gunzipSync(cssEncoded);
  const js = zlib.brotliDecompressSync(jsEncoded);
  assert.equal(sha256(css), MANIFEST.files.css.logicalSha256);
  assert.equal(sha256(js), MANIFEST.files.js.logicalSha256);
  assert.equal(js.length, MANIFEST.files.js.logicalBytes);
  assert.equal(jsEncoded.length <= MANIFEST.javascriptBudgetBytes, true);
  assert.equal(MANIFEST.javascriptBudgetPassed, true);
  assert.match(js.toString("utf8"), /GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS=1e3/);
  new vm.Script(js.toString("utf8"), { filename: "stage14-ready.min.js" });
  assert.equal(deploy.includes(MANIFEST.files.css.url), true);
  assert.equal(deploy.includes(MANIFEST.files.js.url), true);
  assert.equal(deploy.includes(`integrity="${MANIFEST.files.css.sri}"`), true);
  assert.equal(deploy.includes(`integrity="${MANIFEST.files.js.sri}"`), true);
  assert.equal(deploy.includes(MANIFEST.sourceAssetRevision), false);
});

test("14단계 실행서는 GCS 선업로드·bucket 경계·Gate OFF·HTML 복구 순서를 포함한다", () => {
  const runbook = inspect("runbook").toString("utf8");
  assert.match(runbook, /gcloud storage cp/);
  assert.match(runbook, /eventPlanSeq 20/);
  assert.match(runbook, /bucket 999/);
  assert.match(runbook, /bucket 1000/);
  assert.match(runbook, /release-admin-cli\.js gate-off/);
  assert.match(runbook, new RegExp(MANIFEST.files.rollbackHtml.fileName));
});
