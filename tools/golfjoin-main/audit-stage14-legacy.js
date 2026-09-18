"use strict";

const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(WORKSPACE_ROOT, "src/golfjoin-main");
const MANIFEST_PATH = path.join(SOURCE_ROOT, "source-manifest.json");
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, "artifacts/stage14-legacy-audit.json");

const LEGACY_PATHS = Object.freeze([
  {
    id: "legacy-home-cards",
    symbol: "loadGolfJoinHomeCardsJson",
    classification: "active-primary",
    removalGate: "Release V2가 로그인 포함 100%에서 안정화되기 전에는 제거 금지"
  },
  {
    id: "legacy-home-summary",
    symbol: "loadGolfJoinHomeSummaryJson",
    classification: "failure-fallback",
    removalGate: "home cards와 Product Discovery 장애 관찰에서 호출 0건 확인 전 제거 금지"
  },
  {
    id: "legacy-home-live",
    symbol: "hydrateHomeBootstrapLightFromGoogleSheet",
    classification: "active-primary",
    removalGate: "Release V2가 로그인 포함 100%에서 live 데이터 정합성을 통과하기 전에는 제거 금지"
  },
  {
    id: "legacy-product-family-catalog",
    symbol: "ensureGolfJoinProductFamilyCatalogLoaded",
    classification: "active-primary",
    removalGate: "Release V2 비대상과 상품군 fallback이 남아 있는 동안 제거 금지"
  },
  {
    id: "legacy-full-product-loader",
    symbol: "ensureExternalGolfJoinProductsLoaded",
    classification: "failure-fallback",
    removalGate: "Product Discovery 장애 시 원격 복구 수단과 호출 관찰 장치가 준비되기 전 제거 금지"
  },
  {
    id: "legacy-live-erp-scraper",
    symbol: "loadSecretTourGoodsProducts",
    classification: "emergency-last-resort",
    removalGate: "전체 상품 fallback을 원격으로 비활성화하고 관리자 복구 절차를 검증한 뒤 첫 제거 후보"
  },
  {
    id: "legacy-product-detail-parser",
    symbol: "loadLegacySecretTourGoodsDetail",
    classification: "failure-fallback",
    removalGate: "모든 진입 상품에 공개 상세 스냅샷이 존재하고 손상 fallback이 별도로 마련되기 전 제거 금지"
  },
  {
    id: "legacy-individual-availability",
    symbol: "loadGolfJoinProductGroupAvailabilityLegacy",
    classification: "failure-fallback",
    removalGate: "모든 상품군 가용일 객체의 완전성과 원격 복구를 장기간 확인하기 전 제거 금지"
  }
]);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function collectSymbolLocations(files, symbol) {
  const escaped = escapeRegExp(symbol);
  const invocation = new RegExp(`\\b${escaped}\\s*\\(`, "g");
  const definition = new RegExp(`\\bfunction\\s+${escaped}\\s*\\(`, "g");
  const definitions = [];
  const invocations = [];
  files.forEach(({ path: relativePath, source }) => {
    let match;
    definition.lastIndex = 0;
    while ((match = definition.exec(source)) !== null) {
      definitions.push({ path: relativePath, line: lineNumberAt(source, match.index) });
    }
    invocation.lastIndex = 0;
    while ((match = invocation.exec(source)) !== null) {
      invocations.push({ path: relativePath, line: lineNumberAt(source, match.index) });
    }
  });
  const definitionKeys = new Set(definitions.map(({ path: relativePath, line }) => `${relativePath}:${line}`));
  const calls = invocations.filter(({ path: relativePath, line }) => !definitionKeys.has(`${relativePath}:${line}`));
  return { definitions, calls };
}

function readRolloutBasisPoints(files) {
  const releaseSource = files.find(({ path: relativePath }) => relativePath.endsWith("35-release-v2-bootstrap.js"))?.source || "";
  const match = releaseSource.match(/GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS\s*=\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function buildLegacyAudit(manifest, readSource) {
  const files = manifest.sourceOrder.map((relativePath) => ({
    path: relativePath,
    source: readSource(relativePath)
  }));
  const paths = LEGACY_PATHS.map((entry) => {
    const locations = collectSymbolLocations(files, entry.symbol);
    return {
      ...entry,
      definitionCount: locations.definitions.length,
      callCount: locations.calls.length,
      definitions: locations.definitions,
      calls: locations.calls
    };
  });
  const bootSource = files.find(({ path: relativePath }) => relativePath.endsWith("40-initialize.js"))?.source || "";
  const productDiscoverySource = files.find(({ path: relativePath }) => relativePath.endsWith("35-product-discovery.js"))?.source || "";
  const memberSource = files.find(({ path: relativePath }) => relativePath.endsWith("36-member-reservations-deeplinks.js"))?.source || "";
  const detailSource = files.find(({ path: relativePath }) => relativePath.endsWith("37-detail-builder-calendar.js"))?.source || "";
  const fullLoaderSymbol = "ensureExternalGolfJoinProductsLoaded";
  const fullLoaderInBoot = (bootSource.match(new RegExp(`\\b${fullLoaderSymbol}\\s*\\(`, "g")) || []).length;
  const fullLoaderFallbackCalls = paths.find(({ id }) => id === "legacy-full-product-loader")?.callCount || 0;
  return {
    schema: "golfjoin-stage14-legacy-audit-v1",
    sourceManifestSchemaVersion: manifest.schemaVersion,
    releaseV2: {
      rolloutBasisPoints: readRolloutBasisPoints(files),
      rolloutPercent: (readRolloutBasisPoints(files) || 0) / 100,
      anonymousOnly: /!isGolfJoinHomeDataV2Anonymous\(\)/.test(
        files.find(({ path: relativePath }) => relativePath.endsWith("35-release-v2-bootstrap.js"))?.source || ""
      )
    },
    fullProductLoader: {
      initialBootCallCount: fullLoaderInBoot,
      fallbackCallCount: fullLoaderFallbackCalls,
      productDiscoveryFallbackCallCount: (productDiscoverySource.match(new RegExp(`\\b${fullLoaderSymbol}\\s*\\(`, "g")) || []).length,
      memberDeepLinkFallbackCallCount: (memberSource.match(new RegExp(`\\b${fullLoaderSymbol}\\s*\\(`, "g")) || []).length,
      liveErpScraperCallCount: (detailSource.match(/\bloadSecretTourGoodsProducts\s*\(/g) || []).length - 1
    },
    summary: {
      pathCount: paths.length,
      activePrimaryCount: paths.filter(({ classification }) => classification === "active-primary").length,
      failureFallbackCount: paths.filter(({ classification }) => classification === "failure-fallback").length,
      emergencyLastResortCount: paths.filter(({ classification }) => classification === "emergency-last-resort").length,
      immediateDeletionCandidateCount: 0
    },
    paths
  };
}

function validateLegacyAudit(audit) {
  const failures = [];
  if (audit.releaseV2.rolloutBasisPoints !== 10000) failures.push("Release V2 rollout is not the Stage 14 target 100% value");
  if (audit.releaseV2.anonymousOnly !== true) failures.push("Release V2 is not anonymous-only");
  if (audit.fullProductLoader.initialBootCallCount !== 0) failures.push("Full product loader is called during initial boot");
  if (audit.fullProductLoader.fallbackCallCount !== 5) failures.push("Full product fallback call count changed");
  if (audit.fullProductLoader.productDiscoveryFallbackCallCount !== 3) failures.push("Product Discovery fallback call count changed");
  if (audit.fullProductLoader.memberDeepLinkFallbackCallCount !== 2) failures.push("Member deep-link fallback call count changed");
  if (audit.fullProductLoader.liveErpScraperCallCount !== 1) failures.push("Live ERP scraper call count changed");
  audit.paths.forEach((entry) => {
    if (entry.definitionCount !== 1) failures.push(`${entry.symbol} definition count is ${entry.definitionCount}`);
    if (entry.callCount < 1) failures.push(`${entry.symbol} has no caller`);
  });
  if (audit.summary.immediateDeletionCandidateCount !== 0) failures.push("Unexpected immediate deletion candidate");
  return failures;
}

function runAudit() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const readSource = (relativePath) => fs.readFileSync(path.join(SOURCE_ROOT, relativePath), "utf8");
  const audit = buildLegacyAudit(manifest, readSource);
  const failures = validateLegacyAudit(audit);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify({ ...audit, valid: failures.length === 0, failures }, null, 2)}\n`, "utf8");
  return { ...audit, valid: failures.length === 0, failures };
}

if (require.main === module) {
  const audit = runAudit();
  process.stdout.write(`${JSON.stringify({
    valid: audit.valid,
    releaseV2: audit.releaseV2,
    fullProductLoader: audit.fullProductLoader,
    summary: audit.summary,
    failures: audit.failures
  }, null, 2)}\n`);
  if (!audit.valid) process.exitCode = 1;
}

module.exports = {
  LEGACY_PATHS,
  buildLegacyAudit,
  collectSymbolLocations,
  validateLegacyAudit
};
