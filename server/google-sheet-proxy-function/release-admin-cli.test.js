"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs, assertSafeReleaseResult } = require("./release-admin-cli");

test("release CLI는 status, publish, gate와 유효한 rollback 대상을 허용한다", () => {
  assert.equal(parseArgs(["status", "--env-file=/tmp/release.env"]).command, "status");
  assert.equal(parseArgs(["shadow"]).command, "shadow");
  assert.equal(parseArgs(["publish"]).command, "publish");
  assert.equal(
    parseArgs(["rollback", "--target=gjr_111111111111111111111111"]).targetReleaseRevision,
    "gjr_111111111111111111111111"
  );
  assert.equal(
    parseArgs(["gate-on", "--target=gjr_111111111111111111111111"]).targetReleaseRevision,
    "gjr_111111111111111111111111"
  );
  assert.equal(parseArgs(["gate-off"]).command, "gate-off");
  assert.throws(() => parseArgs(["remove"]), /status, shadow, publish, rollback, gate-on, or gate-off/);
  assert.throws(() => parseArgs(["rollback", "--target=bad"]), /rollback requires/);
  assert.throws(() => parseArgs(["gate-on"]), /gate-on requires/);
});

test("최초 status는 root가 없어도 안전한 정상 결과로 인정한다", () => {
  assert.doesNotThrow(() => assertSafeReleaseResult("status", {
    ok: true,
    release: { exists: false, browserReadEnabled: false, objectCount: 0 }
  }));
});

test("활성 release는 객체 5개를 요구하고 변경 명령별 browser gate 결과를 검증한다", () => {
  const valid = {
    ok: true,
    rootUpdatedLast: true,
    shadow: { valid: true, issueCount: 0, browserExecuted: false },
    release: {
      exists: true,
      releaseRevision: "gjr_111111111111111111111111",
      browserReadEnabled: false,
      objectCount: 5
    }
  };
  assert.doesNotThrow(() => assertSafeReleaseResult("publish", valid));
  assert.doesNotThrow(() => assertSafeReleaseResult("status", {
    ...valid,
    release: { ...valid.release, browserReadEnabled: true }
  }));
  assert.doesNotThrow(() => assertSafeReleaseResult("gate-on", {
    ...valid,
    release: { ...valid.release, browserReadEnabled: true }
  }));
  assert.doesNotThrow(() => assertSafeReleaseResult("gate-off", valid));
  assert.throws(() => assertSafeReleaseResult("publish", {
    ...valid,
    release: { ...valid.release, browserReadEnabled: true }
  }), /must leave browserReadEnabled false/);
  assert.throws(() => assertSafeReleaseResult("gate-on", valid), /did not enable/);
  assert.throws(() => assertSafeReleaseResult("status", {
    ...valid,
    release: { ...valid.release, objectCount: 4 }
  }), /five verified/);
});

test("shadow CLI는 서버 실행·불일치 0건만 성공으로 인정한다", () => {
  assert.doesNotThrow(() => assertSafeReleaseResult("shadow", {
    ok: true,
    shadow: { valid: true, issueCount: 0, browserExecuted: false }
  }));
  assert.throws(() => assertSafeReleaseResult("shadow", {
    ok: true,
    shadow: { valid: false, issueCount: 1, browserExecuted: false }
  }), /found 1 issue/);
  assert.throws(() => assertSafeReleaseResult("shadow", {
    ok: true,
    shadow: { valid: true, issueCount: 0, browserExecuted: true }
  }), /must run on the server/);
});
