"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage30-member-auth-gate/legacy-profile-alias-ui-20260821-v30c"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("30c는 Report 선배포와 5분 흡수 후 Enforce 전환을 고정한다", () => {
  assert.equal(manifest.schema, "golfjoin-stage30c-member-profile-gate-v1");
  assert.deepEqual(manifest.rollout, {
    firstGate: "report",
    accessTokenDrainSeconds: 300,
    finalGate: "enforce",
    rollback: "saved-report-revision-traffic-and-v32d-html"
  });
  assert.equal(manifest.features.signedLegacyMemberIdAlias, true);
  assert.equal(manifest.features.cachedIncompleteProfileWaitsForRefresh, true);
  assert.equal(manifest.features.completeLegacyProfileNeverOpensRequiredForm, true);
  assert.equal(manifest.features.trueIncompleteProfileStillOpensRequiredForm, true);
  assert.equal(manifest.features.aligoDeployRequired, false);
  assert.equal(manifest.features.sheetDataMigrationRequired, false);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("30c의 모든 파일은 선언된 해시와 크기를 보존한다", () => {
  Object.values(manifest.files).forEach((entry) => {
    const buffer = fs.readFileSync(path.join(PACKAGE_ROOT, entry.fileName));
    assert.equal(buffer.length, entry.bytes, entry.fileName);
    assert.equal(digest(buffer), entry.sha256, entry.fileName);
  });
});

test("30c 브라우저와 서버 후보는 문법 및 서명 memberId 계약을 통과한다", () => {
  const browserJs = zlib.brotliDecompressSync(
    fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.js.fileName))
  ).toString("utf8");
  new vm.Script(browserJs, { filename: "stage30c-browser.js" });

  const index = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.index.fileName), "utf8");
  const auth = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.memberSmsAuth.fileName), "utf8");
  new vm.Script(index, { filename: "stage30c-index.js" });
  new vm.Script(auth, { filename: "stage30c-member-sms-auth.js" });
  assert.match(index, /const memberId = asText\(identity\.memberId\)/);
  assert.match(auth, /createMemberAccessToken\(\{ secret, memberSeq, memberId, nowMs/);
});

test("30c 실행 문서는 기존회원 깜빡임·신규회원·복구를 모두 확인한다", () => {
  const runbook = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.runbook.fileName), "utf8");
  assert.match(runbook, /추가정보 화면이 한 프레임도 나타나지 않는지/);
  assert.match(runbook, /실제 미완료 시험회원/);
  assert.match(runbook, /최소 5분/);
  assert.match(runbook, /v32d HTML로 되돌린다/);
});
