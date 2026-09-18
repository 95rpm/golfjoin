"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage41-ga4/golfjoin-ga4-final-audit-20260831-v41e");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(OUTPUT, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v41e 배포 파일은 선언 해시와 압축 JavaScript 문법을 보존한다", () => {
  Object.values(MANIFEST.files).forEach((entry) => {
    const file = fs.readFileSync(path.join(OUTPUT, entry.fileName));
    assert.equal(file.length, entry.bytes, `${entry.fileName} bytes`);
    assert.equal(sha256(file), entry.sha256, `${entry.fileName} sha256`);
  });

  const compressed = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.js));
  const javascript = zlib.brotliDecompressSync(compressed).toString("utf8");
  assert.doesNotThrow(() => new vm.Script(javascript));
  assert.match(javascript, /G-LLY6DLP23E/);
  assert.match(javascript, /552152254/);
  assert.match(javascript, /golfjoin_section_view/);
  assert.match(javascript, /markGolfJoinGa4MemberStateReady/);
  assert.match(javascript, /memberStateReady/);
  assert.match(javascript, /member_kakao_signup_complete/);
  assert.match(javascript, /serverFinalized/);
  assert.match(javascript, /trackGolfJoinGa4EventOnce/);
  assert.match(javascript, /golfjoin_apply_error/);
  assert.match(javascript, /golfjoin_create_error/);
  assert.doesNotMatch(javascript, /GA4 remains inactive/);
});

test("v41e HTML은 JavaScript만 새 불변 자산으로 교체하고 v41c를 복구본으로 보존한다", () => {
  const deploy = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.deployHtml), "utf8");
  const rollback = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.rollbackHtml));
  const v41c = fs.readFileSync(path.join(
    ROOT,
    "deploy/stage41-ga4/golfjoin-ga4-begin-checkout-20260831-v41c/DEPLOY_golfjoin_main_ga4_tracking_DF25F342.html"
  ));
  assert.deepEqual(rollback, v41c);
  assert.match(deploy, new RegExp(MANIFEST.assetRevision));
  assert.match(deploy, new RegExp(MANIFEST.files.js.logicalSri.replace(/[+\/]/g, "\\$&")));
  assert.equal(deploy.includes("gha_8e750365251a73492eb5be45/golfjoin-main.js"), false);
});

test("v41e는 전체 퍼널 진입·완료 무결성과 기존 속성 분리를 선언한다", () => {
  assert.equal(MANIFEST.analytics.measurementId, "G-LLY6DLP23E");
  assert.equal(MANIFEST.analytics.propertyId, "552152254");
  assert.equal(MANIFEST.analytics.routingGroup, "golfjoin");
  assert.equal(MANIFEST.analytics.existingHomepagePropertyPreserved, true);
  assert.equal(MANIFEST.features.memberStateResolvedBeforePageView, true);
  assert.equal(MANIFEST.features.beginCheckoutOnActualApplyModalOpen, true);
  assert.equal(MANIFEST.features.allDetailModalEntryTracking, true);
  assert.equal(MANIFEST.features.allBuilderModalEntryTracking, true);
  assert.equal(MANIFEST.features.confirmedMutationCompletionTracking, true);
  assert.equal(MANIFEST.features.completionDeduplication, true);
  assert.equal(MANIFEST.features.nullSafeItemNormalization, true);
  assert.equal(MANIFEST.features.loginAndSignupSeparation, true);
  assert.equal(MANIFEST.features.serverRedeployRequired, false);
  assert.equal(MANIFEST.features.cssRedeployRequired, false);
});
