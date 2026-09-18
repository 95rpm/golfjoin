"use strict";

const { buildGolfJoinHomeArtifacts, HOME_PRODUCT_MINIMUM_ADVANCE_DAYS } = require("./home-products");
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
  const homeArtifacts = buildGolfJoinHomeArtifacts(staticSummaryPayload, {
    minimumAdvanceDays: HOME_PRODUCT_MINIMUM_ADVANCE_DAYS
  });
  const liveHome = {
    schema: "secret-golf-join-home-live-v1",
    ...homeBootstrapLight
  };
  const liveRevision = stableRevision("ghl", liveHome);
  liveHome.liveRevision = liveRevision;
  const availabilityIndex = buildAvailabilityIndex(homeArtifacts, generatedAt);
  const detailIndex = buildLegacyDetailIndex({
    staticRevision: homeArtifacts.publicationRevision,
    familyRevision: familyCatalog.publicationRevision,
    availabilityRevision: homeArtifacts.availabilityRevision
  }, generatedAt);
  const sourceSnapshot = {
    productsGeneratedAt: text(summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt),
    liveUpdatedAt: text(homeBootstrapLight.updatedAt || homeBootstrapLight.serverTime),
    familyRevision: text(familyCatalog.publicationRevision),
    staticRevision: homeArtifacts.publicationRevision,
    availabilityRevision: homeArtifacts.availabilityRevision,
    detailRevision: detailIndex.detailRevision
  };
  const sourceSnapshotWatermark = stableRevision("gjs", sourceSnapshot);

  assertDataContract("homeCardsV2", homeArtifacts.homeCardsPayload);
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
        revision: homeArtifacts.publicationRevision,
        payload: homeArtifacts.homeCardsPayload
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
  buildReleasePublishInput
};
