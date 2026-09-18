"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  buildLegacyAudit,
  collectSymbolLocations,
  validateLegacyAudit
} = require("../../tools/golfjoin-main/audit-stage14-legacy");

test("Legacy 함수의 정의와 호출 위치를 서로 구분한다", () => {
  const files = [{
    path: "source/a.js",
    source: [
      "function legacyLoad() {}",
      "legacyLoad();",
      "async function caller() { return legacyLoad(); }"
    ].join("\n")
  }];
  const result = collectSymbolLocations(files, "legacyLoad");
  assert.deepEqual(result.definitions, [{ path: "source/a.js", line: 1 }]);
  assert.deepEqual(result.calls, [
    { path: "source/a.js", line: 2 },
    { path: "source/a.js", line: 3 }
  ]);
});

test("현재 소스의 전체 상품 로더는 초기 진입이 아닌 fallback에서만 호출된다", () => {
  const root = path.resolve(__dirname, "../..");
  const sourceRoot = path.join(root, "src/golfjoin-main");
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "source-manifest.json"), "utf8"));
  const audit = buildLegacyAudit(
    manifest,
    (relativePath) => fs.readFileSync(path.join(sourceRoot, relativePath), "utf8")
  );
  assert.equal(audit.releaseV2.rolloutBasisPoints, 10000);
  assert.equal(audit.releaseV2.rolloutPercent, 100);
  assert.equal(audit.releaseV2.anonymousOnly, true);
  assert.equal(audit.fullProductLoader.initialBootCallCount, 0);
  assert.equal(audit.fullProductLoader.fallbackCallCount, 5);
  assert.equal(audit.fullProductLoader.productDiscoveryFallbackCallCount, 3);
  assert.equal(audit.fullProductLoader.memberDeepLinkFallbackCallCount, 2);
  assert.equal(audit.fullProductLoader.liveErpScraperCallCount, 1);
  assert.equal(audit.summary.immediateDeletionCandidateCount, 0);
  assert.deepEqual(validateLegacyAudit(audit), []);
});

test("Legacy 경로는 활성 주경로·장애 fallback·최후 복구로 빠짐없이 분류된다", () => {
  const root = path.resolve(__dirname, "../..");
  const sourceRoot = path.join(root, "src/golfjoin-main");
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "source-manifest.json"), "utf8"));
  const audit = buildLegacyAudit(
    manifest,
    (relativePath) => fs.readFileSync(path.join(sourceRoot, relativePath), "utf8")
  );
  assert.equal(audit.summary.pathCount, 8);
  assert.equal(audit.summary.activePrimaryCount, 3);
  assert.equal(audit.summary.failureFallbackCount, 4);
  assert.equal(audit.summary.emergencyLastResortCount, 1);
  audit.paths.forEach((entry) => {
    assert.equal(entry.definitionCount, 1, entry.symbol);
    assert.ok(entry.callCount >= 1, entry.symbol);
    assert.ok(entry.removalGate.length > 10, entry.symbol);
  });
});
