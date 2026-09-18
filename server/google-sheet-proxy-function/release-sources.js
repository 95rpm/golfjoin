"use strict";

const {
  buildGolfJoinHomeArtifacts,
  buildAvailabilityRevision,
  HOME_PRODUCT_MINIMUM_ADVANCE_DAYS
} = require("./home-products");
const { assertDataContract } = require("./data-contracts");
const { serializeJson, sha256 } = require("./release-publisher");

function text(value) {
  return String(value ?? "").trim();
}

function stableRevision(prefix, value) {
  return `${prefix}_${sha256(serializeJson(value)).slice(0, 24)}`;
}

function buildAvailabilityIndex(homeArtifacts = {}, generatedAt = "") {
  const items = (Array.isArray(homeArtifacts.availabilityArtifacts) ? homeArtifacts.availabilityArtifacts : [])
    .map((artifact) => artifact.payload)
    .sort((left, right) => text(left.goodSeq).localeCompare(text(right.goodSeq)));
  return {
    schema: "secret-golf-join-product-availability-index-v1",
    generatedAt,
    availabilityRevision: text(homeArtifacts.availabilityRevision),
    minimumAdvanceDays: Number(homeArtifacts.minimumAdvanceDays || 0),
    bookableFrom: text(homeArtifacts.bookableFrom),
    productCount: items.length,
    items
  };
}

function buildLegacyDetailIndex(source = {}, generatedAt = "") {
  const basis = {
    status: "legacy-on-demand",
    staticRevision: text(source.staticRevision),
    familyRevision: text(source.familyRevision),
    availabilityRevision: text(source.availabilityRevision)
  };
  return {
    schema: "secret-golf-join-product-detail-index-v1",
    generatedAt,
    detailRevision: stableRevision("gpdi", basis),
    status: "legacy-on-demand",
    count: 0,
    items: []
  };
}

function buildProductDetailIndex(summaryPayload = {}, options = {}) {
  const bucketName = text(options.bucketName);
  const prefix = text(options.prefix || "web");
  const generatedAt = text(options.generatedAt || summaryPayload.generatedAt);
  const expectedGoodSeqs = new Set((Array.isArray(summaryPayload.items) ? summaryPayload.items : [])
    .map((item) => text(item?.goodSeq || item?.erpProductId))
    .filter(Boolean));
  const items = Object.entries(summaryPayload.productMetaByGoodSeq || {}).map(([goodSeqValue, meta]) => {
    const goodSeq = text(goodSeqValue);
    const detailRevision = text(meta?.detailRevision);
    const objectName = text(meta?.detailObjectName);
    const eventSeq = text(meta?.detailEventSeq);
    const expectedSuffix = `/product-detail/${detailRevision}/${goodSeq}.json`;
    if (
      !expectedGoodSeqs.has(goodSeq)
      || meta?.detailStatus !== "ready"
      || !/^gpd_[a-f0-9]{24}$/.test(detailRevision)
      || !/^\d+$/.test(eventSeq)
      || objectName !== `${prefix}/product-detail/${detailRevision}/${goodSeq}.json`
    ) return null;
    return {
      goodSeq,
      eventSeq,
      detailRevision,
      detailStatus: "ready",
      objectName,
      url: `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${objectName.split("/").map(encodeURIComponent).join("/")}`
    };
  }).filter(Boolean).sort((left, right) => left.goodSeq.localeCompare(right.goodSeq));
  if (!items.length) {
    return buildLegacyDetailIndex({
      staticRevision: text(options.staticRevision),
      familyRevision: text(options.familyRevision),
      availabilityRevision: text(options.availabilityRevision)
    }, generatedAt);
  }
  const status = expectedGoodSeqs.size > 0 && items.length === expectedGoodSeqs.size ? "ready" : "partial";
  const basis = { status, items };
  return {
    schema: "secret-golf-join-product-detail-index-v1",
    generatedAt,
    detailRevision: stableRevision("gpdi", basis),
    status,
    count: items.length,
    items
  };
}

function normalizeReleaseHomeCards(payload = {}) {
  return {
    ...payload,
    items: (Array.isArray(payload.items) ? payload.items : []).map((item) => (
      item?.homeProductSummary === true && !text(item.status)
        ? { ...item, status: "available" }
        : item
    ))
  };
}

function buildReleaseHomeCardsPayload(homeCardsPayload = {}, familyCatalog = {}) {
  const normalizedHomeCards = normalizeReleaseHomeCards(homeCardsPayload);
  const familyRevision = text(familyCatalog.publicationRevision);
  const availabilityReferences = (Array.isArray(normalizedHomeCards.items) ? normalizedHomeCards.items : [])
    .map((item) => ({
      goodSeq: text(item?.goodSeq),
      availabilityObjectName: text(item?.availabilityObjectName)
    }))
    .filter((item) => item.goodSeq && item.availabilityObjectName)
    .sort((left, right) => left.goodSeq.localeCompare(right.goodSeq));
  const publicationRevision = stableRevision("ghc", {
    homeCardsRevision: text(normalizedHomeCards.publicationRevision),
    familyRevision,
    availabilityReferences
  });
  return {
    ...normalizedHomeCards,
    publicationRevision,
    productFamilyCatalog: familyCatalog
  };
}

function assertReleaseHomeAvailabilityReferences(payload = {}) {
  const availabilityRevision = text(payload.availabilityRevision);
  const summaries = (Array.isArray(payload.items) ? payload.items : [])
    .filter((item) => item?.homeProductSummary === true);
  summaries.forEach((item, index) => {
    const goodSeq = text(item.goodSeq);
    const objectName = text(item.availabilityObjectName);
    const expectedSuffix = `/product-availability/${availabilityRevision}/${goodSeq}.json`;
    if (!goodSeq || !availabilityRevision || !objectName.endsWith(expectedSuffix)) {
      const error = new Error(`Release home availability shard reference is invalid: ${index}`);
      error.code = "release_home_availability_shard_invalid";
      throw error;
    }
  });
}

function buildReleasePublishInput(options = {}) {
  const bucketName = text(options.bucketName);
  const prefix = text(options.prefix || "web");
  const generatedAt = text(options.generatedAt || options.summaryPayload?.generatedAt);
  const publishedAt = text(options.publishedAt || generatedAt);
  const summaryPayload = options.summaryPayload || {};
  const homeBootstrapLight = options.homeBootstrapLight || summaryPayload.homeBootstrapLight || {};
  const familyCatalog = options.familyCatalog || {};
  const staticSummaryPayload = { ...summaryPayload };
  delete staticSummaryPayload.homeBootstrapLight;
  delete staticSummaryPayload.homeBootstrapLightUpdatedAt;
  const availabilityRevision = buildAvailabilityRevision(staticSummaryPayload);
  const availabilityObjectPrefix = `${prefix}/product-availability/${availabilityRevision}`;
  const homeArtifacts = buildGolfJoinHomeArtifacts(staticSummaryPayload, {
    minimumAdvanceDays: HOME_PRODUCT_MINIMUM_ADVANCE_DAYS,
    availabilityRevision,
    availabilityObjectPrefix
  });
  const homeCardsPayload = buildReleaseHomeCardsPayload(homeArtifacts.homeCardsPayload, familyCatalog);
  const liveHome = {
    schema: "secret-golf-join-home-live-v1",
    ...homeBootstrapLight
  };
  const liveRevision = stableRevision("ghl", liveHome);
  liveHome.liveRevision = liveRevision;
  const availabilityIndex = buildAvailabilityIndex(homeArtifacts, generatedAt);
  const detailIndex = buildProductDetailIndex(staticSummaryPayload, {
    bucketName,
    prefix,
    generatedAt,
    staticRevision: homeCardsPayload.publicationRevision,
    familyRevision: familyCatalog.publicationRevision,
    availabilityRevision: homeArtifacts.availabilityRevision
  });
  const sourceSnapshot = {
    productsGeneratedAt: text(summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt),
    liveUpdatedAt: text(homeBootstrapLight.updatedAt || homeBootstrapLight.serverTime),
    familyRevision: text(familyCatalog.publicationRevision),
    staticRevision: homeCardsPayload.publicationRevision,
    availabilityRevision: homeArtifacts.availabilityRevision,
    detailRevision: detailIndex.detailRevision
  };
  const sourceSnapshotWatermark = stableRevision("gjs", sourceSnapshot);

  assertReleaseHomeAvailabilityReferences(homeCardsPayload);
  assertDataContract("homeCardsV2", homeCardsPayload);
  assertDataContract("homeBootstrapLightV1", liveHome);
  assertDataContract("productFamilyCatalogV1", familyCatalog);
  assertDataContract("productAvailabilityIndexV1", availabilityIndex);
  assertDataContract("productDetailIndexV1", detailIndex);

  return {
    bucketName,
    prefix,
    generatedAt,
    publishedAt,
    sourceSnapshotWatermark,
    objects: {
      homeCards: {
        revision: homeCardsPayload.publicationRevision,
        payload: homeCardsPayload
      },
      liveHome: {
        revision: liveRevision,
        payload: liveHome
      },
      productFamily: {
        revision: text(familyCatalog.publicationRevision),
        payload: familyCatalog
      },
      availability: {
        revision: homeArtifacts.availabilityRevision,
        payload: availabilityIndex,
        contentEncoding: "gzip"
      },
      productDetail: {
        revision: detailIndex.detailRevision,
        payload: detailIndex
      }
    }
  };
}

module.exports = {
  stableRevision,
  buildAvailabilityIndex,
  buildLegacyDetailIndex,
  buildProductDetailIndex,
  normalizeReleaseHomeCards,
  buildReleaseHomeCardsPayload,
  assertReleaseHomeAvailabilityReferences,
  buildReleasePublishInput
};
