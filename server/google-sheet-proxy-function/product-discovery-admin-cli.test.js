"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs, assertSafeResult } = require("./product-discovery-admin-cli");

function result(enabled = false) {
  return {
    ok: true,
    rootUpdatedLast: true,
    productDiscovery: {
      exists: true,
      discoveryRevision: "gpd_aaaaaaaaaaaaaaaaaaaaaaaa",
      browserReadEnabled: enabled,
      eventCount: 100,
      monthCount: 6,
      objectCount: 8
    }
  };
}

test("product discovery CLI는 status·shadow와 독립 gate 명령만 허용한다", () => {
  assert.equal(parseArgs(["status"]).command, "status");
  assert.equal(parseArgs(["shadow"]).command, "shadow");
  assert.equal(parseArgs(["gate-off"]).command, "gate-off");
  assert.equal(
    parseArgs(["gate-on", "--target=gpd_aaaaaaaaaaaaaaaaaaaaaaaa"]).targetDiscoveryRevision,
    "gpd_aaaaaaaaaaaaaaaaaaaaaaaa"
  );
  assert.throws(() => parseArgs(["publish"]), /status, shadow, gate-on, or gate-off/);
  assert.throws(() => parseArgs(["gate-on"]), /requires --target/);
});

test("CLI는 검증 객체 수와 gate 결과를 확인한다", () => {
  assert.doesNotThrow(() => assertSafeResult("status", result(false)));
  assert.doesNotThrow(() => assertSafeResult("gate-on", result(true)));
  assert.doesNotThrow(() => assertSafeResult("gate-off", result(false)));
  const badCount = result(false);
  badCount.productDiscovery.objectCount = 7;
  assert.throws(() => assertSafeResult("status", badCount), /verification count/);
  assert.throws(() => assertSafeResult("gate-on", result(false)), /did not enable/);
});

test("최초 status는 root가 없어도 안전한 정상 결과다", () => {
  assert.doesNotThrow(() => assertSafeResult("status", {
    ok: true,
    productDiscovery: { exists: false }
  }));
});

test("shadow는 서버 실행과 불일치 0건만 성공으로 인정한다", () => {
  assert.doesNotThrow(() => assertSafeResult("shadow", {
    ok: true,
    shadow: { browserExecuted: false, valid: true, issueCount: 0 }
  }));
  assert.throws(() => assertSafeResult("shadow", {
    ok: true,
    shadow: { browserExecuted: false, valid: false, issueCount: 1 }
  }), /found 1 issue/);
});
