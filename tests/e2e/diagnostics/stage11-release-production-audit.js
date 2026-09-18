"use strict";

const crypto = require("node:crypto");
const { validateDataContract } = require("../../../server/google-sheet-proxy-function/data-contracts");

const ROOT_URL = process.env.GOLFJOIN_RELEASE_ROOT_URL
  || "https://storage.googleapis.com/golfjoin-bucket/web/release-manifest-v2.json";
const EXPECTED_RELEASE = process.env.GOLFJOIN_EXPECTED_RELEASE_REVISION || "";
const CONCURRENCY = Math.max(1, Math.min(20, Number(process.env.GOLFJOIN_RELEASE_AUDIT_CONCURRENCY || 8)));
const CONTRACT_BY_ROLE = Object.freeze({
  homeCards: "homeCardsV2",
  liveHome: "homeBootstrapLightV1",
  productFamily: "productFamilyCatalogV1",
  availability: "productAvailabilityIndexV1",
  productDetail: "productDetailIndexV1"
});

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function hasPrivateField(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return false;
  const forbiddenKeys = /^(?:memberprice|adultprice|childprice|infantprice|oilprice|phone|mobile|email|memberid|memberkey|memberseq|benefit|seat|remainingseat)$/i;
  return Object.entries(value).some(([key, item]) => (
    forbiddenKeys.test(String(key).replace(/[^a-z0-9]/gi, ""))
    || hasPrivateField(item, depth + 1)
  ));
}

async function fetchLogicalJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer, payload: JSON.parse(buffer.toString("utf8") || "{}") };
}

async function mapConcurrent(items, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  return output;
}

async function main() {
  const { payload: root } = await fetchLogicalJson(ROOT_URL);
  const rootContract = validateDataContract("releaseManifestV2", root);
  const rootIssues = [...rootContract.issues];
  if (EXPECTED_RELEASE && root.releaseRevision !== EXPECTED_RELEASE) {
    rootIssues.push({ path: "$.releaseRevision", code: "unexpected_release_revision" });
  }

  const archive = await fetchLogicalJson(root.manifestUrl);
  const archiveMatchesRoot = JSON.stringify(archive.payload) === JSON.stringify(root);
  const roles = Object.keys(CONTRACT_BY_ROLE);
  const objectResults = [];
  const objectPayloads = {};
  for (const role of roles) {
    const reference = root.objects?.[role] || {};
    const result = await fetchLogicalJson(reference.url);
    const contract = validateDataContract(CONTRACT_BY_ROLE[role], result.payload);
    const issues = [...contract.issues];
    if (result.buffer.length !== Number(reference.bytes)) issues.push({ path: "$", code: "bytes_mismatch" });
    if (sha256(result.buffer) !== reference.contentSha256) issues.push({ path: "$", code: "sha256_mismatch" });
    if (result.payload.releaseRevision !== root.releaseRevision) issues.push({ path: "$.releaseRevision", code: "stamp_mismatch" });
    if (result.payload.sourceSnapshotWatermark !== root.sourceSnapshotWatermark) issues.push({ path: "$.sourceSnapshotWatermark", code: "stamp_mismatch" });
    if (result.payload.releaseRole !== role) issues.push({ path: "$.releaseRole", code: "stamp_mismatch" });
    if (result.payload.releaseDataRevision !== reference.revision) issues.push({ path: "$.releaseDataRevision", code: "stamp_mismatch" });
    objectPayloads[role] = result.payload;
    objectResults.push({
      role,
      httpStatus: result.response.status,
      bytes: result.buffer.length,
      contentEncoding: reference.contentEncoding,
      valid: issues.length === 0,
      issueCount: issues.length,
      issueSamples: issues.slice(0, 5)
    });
  }

  const detailIndex = objectPayloads.productDetail || {};
  const detailItems = Array.isArray(detailIndex.items) ? detailIndex.items : [];
  const duplicateDetailUrls = detailItems
    .map((item) => String(item?.url || ""))
    .filter((url, index, urls) => url && urls.indexOf(url) !== index);
  const snapshotResults = await mapConcurrent(detailItems, async (item) => {
    const issues = [];
    try {
      const { payload } = await fetchLogicalJson(item.url);
      const contract = validateDataContract("productDetailSnapshotV1", payload);
      if (!contract.valid) issues.push(...contract.issues);
      if (String(payload.goodSeq || "") !== String(item.goodSeq || "")) issues.push({ path: "$.goodSeq", code: "good_seq_mismatch" });
      if (String(payload.eventSeq || "") !== String(item.eventSeq || "")) issues.push({ path: "$.eventSeq", code: "event_seq_mismatch" });
      if (String(payload.detailRevision || "") !== String(item.detailRevision || "")) issues.push({ path: "$.detailRevision", code: "detail_revision_mismatch" });
      if (payload.detailStatus !== "ready") issues.push({ path: "$.detailStatus", code: "detail_not_ready" });
      if (hasPrivateField(payload)) issues.push({ path: "$", code: "private_field_present" });
    } catch (error) {
      issues.push({ path: "$", code: String(error?.message || error) });
    }
    return { valid: issues.length === 0, issues };
  });
  const snapshotFailures = snapshotResults.filter((item) => !item.valid);

  const summary = {
    rootUrl: ROOT_URL,
    releaseRevision: root.releaseRevision,
    previousStableRevision: root.previousStableRevision,
    browserReadEnabled: root.browserReadEnabled,
    rootContractValid: rootIssues.length === 0,
    rootIssueCount: rootIssues.length,
    archiveMatchesRoot,
    releaseObjectCount: objectResults.length,
    releaseObjectValidCount: objectResults.filter((item) => item.valid).length,
    releaseObjects: objectResults,
    detailIndexStatus: detailIndex.status,
    detailIndexCount: Number(detailIndex.count || 0),
    detailSnapshotRequestedCount: snapshotResults.length,
    detailSnapshotValidCount: snapshotResults.length - snapshotFailures.length,
    detailSnapshotFailureCount: snapshotFailures.length,
    duplicateDetailUrlCount: new Set(duplicateDetailUrls).size,
    detailIssueSamples: snapshotFailures.slice(0, 10).map((item) => item.issues.slice(0, 5))
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (
    rootIssues.length
    || !archiveMatchesRoot
    || objectResults.some((item) => !item.valid)
    || detailIndex.status !== "ready"
    || Number(detailIndex.count) !== detailItems.length
    || snapshotFailures.length
    || duplicateDetailUrls.length
  ) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
