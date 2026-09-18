"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs, assertSafeReleaseResult } = require("./release-admin-cli");

test("release CLI는 status, publish, 유효한 rollback 대상만 허용한다", () => {
  assert.equal(parseArgs(["status", "--env-file=/tmp/release.env"]).command, "status");
  assert.equal(parseArgs(["publish"]).command, "publish");
  assert.equal(
    parseArgs(["rollback", "--target=gjr_111111111111111111111111"]).targetReleaseRevision,
    "gjr_111111111111111111111111"
  );
  assert.throws(() => parseArgs(["remove"]), /status, publish, or rollback/);
  assert.throws(() => parseArgs(["rollback", "--target=bad"]), /rollback requires/);
});

test("최초 status는 root가 없어도 안전한 정상 결과로 인정한다", () => {
  assert.doesNotThrow(() => assertSafeReleaseResult("status", {
    ok: true,
    release: { exists: false, browserReadEnabled: false, objectCount: 0 }
  }));
});

test("활성 release는 객체 5개와 브라우저 OFF가 아니면 거부한다", () => {
  const valid = {
    ok: true,
    rootUpdatedLast: true,
    release: {
      exists: true,
      releaseRevision: "gjr_111111111111111111111111",
      browserReadEnabled: false,
      objectCount: 5
    }
  };
  assert.doesNotThrow(() => assertSafeReleaseResult("publish", valid));
  assert.throws(() => assertSafeReleaseResult("publish", {
    ...valid,
    release: { ...valid.release, browserReadEnabled: true }
  }), /browserReadEnabled/);
  assert.throws(() => assertSafeReleaseResult("status", {
    ...valid,
    release: { ...valid.release, objectCount: 4 }
  }), /five verified/);
});
