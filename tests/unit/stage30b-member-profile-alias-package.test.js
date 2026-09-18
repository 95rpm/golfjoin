"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage30-member-auth-gate/legacy-profile-alias-20260821-v30b"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("30b 묶음은 Report 선배포·5분 흡수·Enforce 재전환 순서를 고정한다", () => {
  assert.equal(manifest.schema, "golfjoin-stage30b-member-profile-alias-v1");
  assert.equal(manifest.serverOnly, true);
  assert.equal(manifest.browserAssetDeployRequired, false);
  assert.equal(manifest.sheetDataMigrationRequired, false);
  assert.deepEqual(manifest.rollout, {
    firstGate: "report",
    accessTokenDrainSeconds: 300,
    finalGate: "enforce",
    rollback: "saved-report-revision-traffic"
  });
});

test("30b 서버 후보는 서명된 memberId만 기존 프로필 별칭으로 사용한다", () => {
  const index = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.index.fileName), "utf8");
  const auth = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.memberSmsAuth.fileName), "utf8");
  assert.match(index, /const memberId = asText\(identity\.memberId\)/);
  assert.match(index, /if \(memberId\) next\.memberId = memberId/);
  assert.match(auth, /createMemberAccessToken\(\{ secret, memberSeq, memberId, nowMs/);
  assert.match(auth, /memberId:\s*trustedMemberId/);
});

test("30b 모든 배포 파일은 선언 해시와 문법을 보존한다", () => {
  Object.values(manifest.files).forEach((entry) => {
    const buffer = fs.readFileSync(path.join(PACKAGE_ROOT, entry.fileName));
    assert.equal(buffer.length, entry.bytes, entry.fileName);
    assert.equal(sha256(buffer), entry.sha256, entry.fileName);
    if (entry.fileName.endsWith(".js")) {
      new vm.Script(buffer.toString("utf8"), { filename: entry.fileName });
    }
  });
});
