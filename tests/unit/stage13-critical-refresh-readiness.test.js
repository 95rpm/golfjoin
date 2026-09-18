"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const { sha256 } = require("../../tools/golfjoin-main/external-assets");
const { verifyInlineScripts } = require("../../tools/golfjoin-main/prepare-stage13-critical-refresh");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage13-home-assets/production-critical-css-refresh-20260813"
);

test("내예약 분류 수정용 Critical CSS 갱신 묶음은 새 자산과 기존 운영 복구본을 함께 고정한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
  assert.equal(manifest.schema, "secret-golf-join-critical-css-refresh-deployment-v1");
  assert.equal(manifest.status, "production-deployed-verified");
  assert.equal(manifest.requiresGcsUpload, false);
  assert.equal(manifest.stagingEventPlanSeq, 18);
  assert.equal(manifest.productionEventPlanSeq, 3);
  assert.equal(manifest.assetRevision, "gha_6a5960e126c4d272b8a5fa8f");
  assert.equal(manifest.criticalRevision, "ghc_e19ab131bda0aee7e8b1c01e");
  assert.ok(manifest.criticalCssGzipBytes <= manifest.criticalCssBudgetBytes);
  assert.equal(manifest.performance.status, "local-synthetic-passed");
  assert.ok(manifest.performance.pc.improvementPercent >= 15);
  assert.ok(manifest.performance.mobile.improvementPercent >= 15);
  assert.equal(manifest.performance.pageErrorCount, 0);
  assert.equal(manifest.remoteVerification.originChecks, 4);
  assert.equal(manifest.remoteVerification.chromiumChecksPassed, 4);
  assert.equal(manifest.remoteVerification.hashPassed, true);
  assert.equal(manifest.stagingVerification.eventPlanSeq, 18);
  assert.equal(manifest.stagingVerification.pcAnonymousPassed, true);
  assert.equal(manifest.stagingVerification.authenticatedPassed, true);
  assert.equal(manifest.stagingVerification.pastCompletedMovedToCompletedTab, true);
  assert.equal(manifest.stagingVerification.activeTabPastCompletedCount, 0);
  assert.equal(manifest.stagingVerification.pageWarningOrErrorCount, 0);
  assert.equal(manifest.stagingVerification.browserRepeatCacheMeasurement.css, "memory-cache");
  assert.equal(manifest.stagingVerification.browserRepeatCacheMeasurement.js, "memory-cache");
  assert.equal(manifest.stagingVerification.browserRepeatCacheMeasurement.passed, true);
  assert.equal(manifest.productionVerification.eventPlanSeq, 3);
  assert.equal(manifest.productionVerification.pcPublicPassed, true);
  assert.equal(manifest.productionVerification.mobileAuthenticatedPassed, true);
  assert.equal(manifest.productionVerification.horizontalOverflowPx, 0);
  assert.equal(manifest.productionVerification.pastCompletedMovedToCompletedTab, true);
  assert.equal(manifest.productionVerification.scrollLockReleased, true);
  assert.equal(manifest.productionVerification.rollbackRequired, false);
  assert.equal(manifest.transferBudgetAudit.html.passed, true);
  assert.equal(manifest.transferBudgetAudit.criticalCss.passed, true);
  assert.equal(manifest.transferBudgetAudit.javascript.passed, false);
  assert.equal(manifest.transferBudgetAudit.javascript.overBudgetBytes, 131858);
  assert.equal(manifest.transferBudgetAudit.minificationProbe.passed, false);
  assert.equal(manifest.transferBudgetAudit.minificationProbe.overBudgetBytes, 55150);
  assert.equal(manifest.transferBudgetAudit.largestMixedModule.canDeferWholeModule, false);
  assert.equal(manifest.files.rollbackHtml.sha256, "36b1dc681bcbe3ede0d70e39d3766f88349c603a2003dc9fa9cada4f1d406bd3");

  for (const spec of Object.values(manifest.files)) {
    const buffer = fs.readFileSync(path.join(PACKAGE_ROOT, spec.fileName));
    assert.equal(buffer.length, spec.bytes, spec.fileName);
    assert.equal(sha256(buffer), spec.sha256, spec.fileName);
  }

  const deploy = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.deployHtml.fileName), "utf8");
  assert.equal(verifyInlineScripts(deploy), manifest.inlineScriptCount);
  assert.match(deploy, /data-golfjoin-critical-css=/);
  assert.match(deploy, /rel="preload" as="style"/);
  assert.equal(deploy.split(manifest.files.css.url).length - 1, 2);
  assert.equal(deploy.split(manifest.files.js.url).length - 1, 1);
  assert.ok(deploy.includes(`integrity="${manifest.files.css.sri}"`));
  assert.ok(deploy.includes(`integrity="${manifest.files.js.sri}"`));

  const css = zlib.gunzipSync(fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.css.fileName)));
  const js = zlib.gunzipSync(fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.js.fileName)));
  assert.equal(css.length, manifest.files.css.logicalBytes);
  assert.equal(js.length, manifest.files.js.logicalBytes);
  assert.equal(sha256(css), manifest.files.css.logicalSha256);
  assert.equal(sha256(js), manifest.files.js.logicalSha256);
});
