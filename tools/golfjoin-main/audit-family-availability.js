"use strict";

const zlib = require("node:zlib");
const { buildGolfJoinFamilyAvailabilityArtifacts } = require("../../server/google-sheet-proxy-function/home-products");
const { validateDataContract } = require("../../server/google-sheet-proxy-function/data-contracts");

const BUCKET_ROOT = "https://storage.googleapis.com/golfjoin-bucket/";
const FAMILY_MANIFEST_URL = `${BUCKET_ROOT}web/product-family/manifest.json`;
const HOME_CARDS_URL = `${BUCKET_ROOT}web/golfjoin_home_cards.json`;

function percentile(values, ratio) {
  const sorted = values.slice().sort((left, right) => left - right);
  if (!sorted.length) return 0;
  return sorted[Math.floor((sorted.length - 1) * ratio)];
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function resolveCatalogUrl(manifest = {}) {
  if (manifest.activeCatalogUrl) return String(manifest.activeCatalogUrl);
  return new URL(String(manifest.activeCatalogObjectName || "").replace(/^\/+/, ""), BUCKET_ROOT).href;
}

function resolveAvailabilityUrl(product = {}) {
  if (product.availabilityUrl) return String(product.availabilityUrl);
  const objectName = String(product.availabilityObjectName || "").replace(/^\/+/, "");
  return objectName ? new URL(objectName, BUCKET_ROOT).href : "";
}

async function main() {
  const [familyManifest, homeCards] = await Promise.all([
    readJson(FAMILY_MANIFEST_URL),
    readJson(HOME_CARDS_URL)
  ]);
  const catalog = await readJson(resolveCatalogUrl(familyManifest));
  const productsByGoodSeq = new Map((homeCards.items || []).map((item) => [String(item.goodSeq || item.erpProductId || ""), item]));
  const availabilityCache = new Map();

  async function loadAvailability(goodSeq) {
    const product = productsByGoodSeq.get(String(goodSeq)) || {};
    const url = resolveAvailabilityUrl(product);
    if (!url) return null;
    if (!availabilityCache.has(url)) availabilityCache.set(url, readJson(url));
    return availabilityCache.get(url);
  }

  const familyGoodSeqs = [...new Set((catalog.families || []).flatMap((family) => (
    (family.members || []).map((member) => String(member.goodSeq || "")).filter(Boolean)
  )))];
  const availabilityArtifacts = (await Promise.all(familyGoodSeqs.map(async (goodSeq) => {
    const payload = await loadAvailability(goodSeq);
    return payload ? { goodSeq, payload } : null;
  }))).filter(Boolean);
  const publication = buildGolfJoinFamilyAvailabilityArtifacts(catalog, availabilityArtifacts, {
    availabilityRevision: homeCards.availabilityRevision || "",
    availabilityObjectPrefix: `web/product-availability/${homeCards.availabilityRevision || ""}`
  });
  const sourceByGoodSeq = new Map(availabilityArtifacts.map((artifact) => [artifact.goodSeq, artifact.payload]));
  const comparisonIssues = [];
  const rows = publication.artifacts.map((artifact) => {
    const { payload } = artifact;
    const contract = validateDataContract("familyAvailabilityV1", payload);
    if (!contract.valid) {
      throw new Error(`Family availability contract failed: ${JSON.stringify(contract.issues)}`);
    }
    payload.products.forEach((product) => {
      const sourceEvents = sourceByGoodSeq.get(product.goodSeq)?.events || [];
      if (JSON.stringify(product.events) !== JSON.stringify(sourceEvents)) {
        comparisonIssues.push({ familyId: payload.familyId, goodSeq: product.goodSeq, reason: "event_payload_mismatch" });
      }
    });
    const source = Buffer.from(`${JSON.stringify(payload)}\n`, "utf8");
    const gzip = zlib.gzipSync(source, { level: zlib.constants.Z_BEST_COMPRESSION });
    return {
      familyId: payload.familyId,
      memberCount: payload.productCount,
      eventCount: payload.count,
      rawBytes: source.length,
      gzipBytes: gzip.length,
      compressionRatio: Number((gzip.length / Math.max(1, source.length)).toFixed(4))
    };
  });

  const rawValues = rows.map((row) => row.rawBytes);
  const gzipValues = rows.map((row) => row.gzipBytes);
  const report = {
    schema: "golfjoin-family-availability-audit-v1",
    measuredAt: new Date().toISOString(),
    availabilityRevision: homeCards.availabilityRevision || "",
    familyRevision: familyManifest.activePublicationRevision || "",
    familyCount: rows.length,
    uniqueProductObjectCount: availabilityCache.size,
    valid: publication.diagnostics.length === 0 && comparisonIssues.length === 0 && rows.length === (catalog.families || []).length,
    issueCount: publication.diagnostics.length + comparisonIssues.length,
    publicationDiagnostics: publication.diagnostics,
    comparisonIssues,
    rawBytes: {
      average: Math.round(rawValues.reduce((sum, value) => sum + value, 0) / Math.max(1, rawValues.length)),
      p50: percentile(rawValues, 0.5),
      p90: percentile(rawValues, 0.9),
      max: Math.max(0, ...rawValues),
      over250KiB: rows.filter((row) => row.rawBytes > 250 * 1024).length
    },
    gzipBytes: {
      average: Math.round(gzipValues.reduce((sum, value) => sum + value, 0) / Math.max(1, gzipValues.length)),
      p50: percentile(gzipValues, 0.5),
      p90: percentile(gzipValues, 0.9),
      max: Math.max(0, ...gzipValues),
      over250KiB: rows.filter((row) => row.gzipBytes > 250 * 1024).length
    },
    over500Events: rows.filter((row) => row.eventCount > 500).length,
    largest: rows.slice().sort((left, right) => right.rawBytes - left.rawBytes).slice(0, 10)
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
