"use strict";

const { validateDataContract } = require("../../../server/google-sheet-proxy-function/data-contracts");

const MANIFEST_URL = process.env.GOLFJOIN_HOME_MANIFEST_URL
  || "https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_home_manifest.json";
const CONCURRENCY = Math.max(1, Math.min(20, Number(process.env.GOLFJOIN_DETAIL_AUDIT_CONCURRENCY || 8)));

function hasPrivateField(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return false;
  const forbiddenKeys = /^(?:memberprice|adultprice|childprice|infantprice|oilprice|phone|mobile|email|memberid|memberkey|memberseq|benefit|seat|remainingseat)$/i;
  return Object.entries(value).some(([key, item]) => (
    forbiddenKeys.test(String(key).replace(/[^a-z0-9]/gi, ""))
    || hasPrivateField(item, depth + 1)
  ));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return { response, payload: await response.json() };
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
  const { payload: manifest } = await fetchJson(MANIFEST_URL);
  const manifestContract = validateDataContract("homeManifestV1", manifest);
  const cardsUrl = String(manifest.activeCardsUrl || "");
  if (!cardsUrl) throw new Error("activeCardsUrl is missing");

  const { payload: cards } = await fetchJson(cardsUrl);
  const cardsContract = validateDataContract("homeCardsV2", cards);
  const releaseNormalizedCards = {
    ...cards,
    items: (Array.isArray(cards.items) ? cards.items : []).map((item) => (
      item?.homeProductSummary === true && !String(item?.status || "").trim()
        ? { ...item, status: "available" }
        : item
    ))
  };
  const releaseNormalizedCardsContract = validateDataContract("homeCardsV2", releaseNormalizedCards);
  const rawCardsIssuesAreExpectedStatusDefaults = cardsContract.issues.every((issue) => (
    issue?.code === "summary_field_required" && /\.status$/.test(String(issue?.path || ""))
  ));
  const entries = Object.entries(cards.productMetaByGoodSeq || {});
  const duplicateUrls = entries
    .map(([, meta]) => String(meta?.detailUrl || ""))
    .filter((url, index, urls) => url && urls.indexOf(url) !== index);

  const results = await mapConcurrent(entries, async ([goodSeq, meta]) => {
    const url = String(meta?.detailUrl || "");
    const expectedRevision = String(meta?.detailRevision || "");
    const issues = [];
    if (meta?.detailStatus !== "ready") issues.push("card_detail_status_not_ready");
    if (!/^gpd_[a-f0-9]{24}$/.test(expectedRevision)) issues.push("card_detail_revision_invalid");
    if (!url) issues.push("card_detail_url_missing");
    if (issues.length) return { goodSeq, valid: false, issues };

    try {
      const { payload: snapshot } = await fetchJson(url);
      const contract = validateDataContract("productDetailSnapshotV1", snapshot);
      if (!contract.valid) issues.push(...contract.issues.map((item) => `${item.path}:${item.code}`));
      if (snapshot.detailStatus !== "ready") issues.push("snapshot_detail_status_not_ready");
      if (String(snapshot.goodSeq || "") !== String(goodSeq)) issues.push("good_seq_mismatch");
      if (String(snapshot.detailRevision || "") !== expectedRevision) issues.push("detail_revision_mismatch");
      if (hasPrivateField(snapshot)) issues.push("private_field_present");
      return { goodSeq, valid: issues.length === 0, issues };
    } catch (error) {
      return { goodSeq, valid: false, issues: [String(error?.message || error)] };
    }
  });

  const failures = results.filter((item) => !item.valid);
  const summary = {
    manifestUrl: MANIFEST_URL,
    manifestGeneratedAt: manifest.generatedAt,
    activePublicationRevision: manifest.activePublicationRevision,
    cardsUrl,
    cardsGeneratedAt: cards.generatedAt,
    manifestContractValid: manifestContract.valid,
    manifestContractIssues: manifestContract.issues,
    cardsContractValid: cardsContract.valid,
    rawCardsIssuesAreExpectedStatusDefaults,
    cardsContractIssues: cardsContract.issues.slice(0, 20),
    releaseNormalizedCardsContractValid: releaseNormalizedCardsContract.valid,
    releaseNormalizedCardsContractIssues: releaseNormalizedCardsContract.issues.slice(0, 20),
    productMetaCount: entries.length,
    snapshotRequestedCount: results.length,
    snapshotValidCount: results.length - failures.length,
    snapshotFailureCount: failures.length,
    duplicateDetailUrlCount: new Set(duplicateUrls).size,
    issueSamples: failures.slice(0, 10)
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (
    !manifestContract.valid
    || !rawCardsIssuesAreExpectedStatusDefaults
    || !releaseNormalizedCardsContract.valid
    || !entries.length
    || failures.length
    || duplicateUrls.length
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
