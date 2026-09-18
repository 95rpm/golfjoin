"use strict";

const crypto = require("crypto");

const HOME_PRODUCT_MINIMUM_ADVANCE_DAYS = 7;
const FAMILY_AVAILABILITY_MAX_RAW_BYTES = 1024 * 1024;
const FAMILY_AVAILABILITY_MAX_EVENT_COUNT = 2000;

function text(value) {
  return String(value ?? "").trim();
}

function addDaysToISODate(isoDate = "", days = 0) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(isoDate));
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function stableRevision(prefix, value) {
  return `${prefix}_${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24)}`;
}

function getProductGoodSeq(item = {}) {
  const goodSeq = text(item.goodSeq || item.erpProductId || item.productId);
  return /^\d+$/.test(goodSeq) ? goodSeq : "";
}

function getEventPrice(item = {}) {
  const price = Number(item.price || item.generalPrice || item.productPrice || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function isUnavailableStatus(value = "") {
  return /(마감|종료|판매중지|취소|closed|cancel)/i.test(text(value));
}

function isBookableProductEvent(item = {}, minimumDate = "") {
  const departureDate = text(item.departureDate).slice(0, 10);
  const returnDate = text(item.returnDate || departureDate).slice(0, 10);
  return Boolean(
    getProductGoodSeq(item)
    && departureDate
    && (!minimumDate || departureDate >= minimumDate)
    && returnDate
    && getEventPrice(item) > 0
    && !isUnavailableStatus(item.status)
  );
}

function compareProductEventsByDeparture(left = {}, right = {}) {
  return text(left.departureDate || "9999-12-31").localeCompare(text(right.departureDate || "9999-12-31"))
    || getEventPrice(left) - getEventPrice(right)
    || text(left.returnDate || "9999-12-31").localeCompare(text(right.returnDate || "9999-12-31"))
    || text(left.eventSeq || left.erpEventSeq).localeCompare(text(right.eventSeq || right.erpEventSeq));
}

function buildAvailabilityRevision(summaryPayload = {}) {
  return stableRevision("gpa", {
    sourceGeneratedAt: text(summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt),
    range: summaryPayload.range || {},
    sourceCount: Number(summaryPayload.sourceCount || summaryPayload.count || 0),
    events: (Array.isArray(summaryPayload.items) ? summaryPayload.items : []).map((item) => [
      item.goodSeq,
      item.eventSeq,
      item.departureDate,
      item.returnDate,
      item.price,
      item.status,
      item.departureAirport || item.airport
    ])
  });
}

function buildHomeCardsPublicationRevision(summaryPayload = {}) {
  const productDetailReferences = Object.entries(summaryPayload.productMetaByGoodSeq || {})
    .map(([goodSeq, meta]) => [
      text(goodSeq),
      text(meta?.detailRevision),
      text(meta?.detailObjectName),
      text(meta?.detailStatus)
    ])
    .filter((item) => item[0] && item[1])
    .sort((left, right) => left[0].localeCompare(right[0]));
  return stableRevision("ghc", {
    sourceGeneratedAt: text(summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt),
    range: summaryPayload.range || {},
    sourceCount: Number(summaryPayload.sourceCount || summaryPayload.count || 0),
    homeBootstrapLightUpdatedAt: text(summaryPayload.homeBootstrapLightUpdatedAt),
    refreshReason: text(summaryPayload.refreshReason),
    availabilityRevision: buildAvailabilityRevision(summaryPayload),
    productDetailReferences
  });
}

function buildGolfJoinHomeArtifacts(summaryPayload = {}, options = {}) {
  const minimumAdvanceDays = Number.isFinite(Number(options.minimumAdvanceDays))
    ? Math.max(0, Number(options.minimumAdvanceDays))
    : HOME_PRODUCT_MINIMUM_ADVANCE_DAYS;
  const generatedDate = text(summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt).slice(0, 10);
  const bookableFrom = addDaysToISODate(generatedDate, minimumAdvanceDays);
  const availabilityRevision = text(options.availabilityRevision) || buildAvailabilityRevision(summaryPayload);
  const publicationRevision = text(options.publicationRevision) || buildHomeCardsPublicationRevision(summaryPayload);
  const availabilityObjectPrefix = text(options.availabilityObjectPrefix).replace(/\/+$/, "");
  const sourceItems = Array.isArray(summaryPayload.items) ? summaryPayload.items : [];
  const productGroups = new Map();

  sourceItems.forEach((item) => {
    if (!isBookableProductEvent(item)) return;
    const goodSeq = getProductGoodSeq(item);
    if (!productGroups.has(goodSeq)) productGroups.set(goodSeq, []);
    productGroups.get(goodSeq).push({
      ...item,
      goodSeq,
      price: getEventPrice(item),
      departureDate: text(item.departureDate).slice(0, 10),
      returnDate: text(item.returnDate || item.departureDate).slice(0, 10)
    });
  });

  const availabilityArtifacts = [...productGroups.entries()].map(([goodSeq, groupItems]) => {
    const events = groupItems.slice().sort(compareProductEventsByDeparture);
    const objectName = availabilityObjectPrefix ? `${availabilityObjectPrefix}/${goodSeq}.json` : "";
    return {
      goodSeq,
      objectName,
      payload: {
        schema: "secret-golf-join-product-availability-v1",
        generatedAt: summaryPayload.generatedAt || "",
        sourceGeneratedAt: summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt || "",
        availabilityRevision,
        goodSeq,
        minimumAdvanceDays,
        bookableFrom,
        range: {
          startDate: events[0]?.departureDate || "",
          endDate: events[events.length - 1]?.departureDate || ""
        },
        count: events.length,
        events
      }
    };
  });
  const artifactByGoodSeq = new Map(availabilityArtifacts.map((artifact) => [artifact.goodSeq, artifact]));

  const productSummaries = [...productGroups.entries()].map(([goodSeq, groupItems]) => {
    const bookableEvents = groupItems
      .filter((item) => isBookableProductEvent(item, bookableFrom))
      .sort(compareProductEventsByDeparture);
    if (!bookableEvents.length) return null;
    const earliestEvent = bookableEvents[0];
    const priceFrom = Math.min(...bookableEvents.map(getEventPrice).filter((price) => price > 0));
    const artifact = artifactByGoodSeq.get(goodSeq);
    return {
      ...earliestEvent,
      homeProductSummary: true,
      priceFrom: Number.isFinite(priceFrom) ? priceFrom : getEventPrice(earliestEvent),
      earliestBookableDate: earliestEvent.departureDate,
      minimumAdvanceDays,
      availabilityRevision,
      ...(artifact?.objectName ? { availabilityObjectName: artifact.objectName } : {})
    };
  }).filter(Boolean);

  const referencedValues = options.referencedValues instanceof Set ? options.referencedValues : new Set();
  const summaryIds = new Set(productSummaries.map((item) => text(item.id || item.eventSeq || item.erpEventSeq)).filter(Boolean));
  const referencedItems = sourceItems.filter((item) => {
    if (!referencedValues.size) return false;
    return [item.id, item.eventSeq, item.erpEventSeq, item.scheduleId]
      .some((value) => referencedValues.has(text(value)));
  }).filter((item) => {
    const id = text(item.id || item.eventSeq || item.erpEventSeq);
    if (!id || summaryIds.has(id)) return false;
    summaryIds.add(id);
    return true;
  }).map((item) => {
    const goodSeq = getProductGoodSeq(item);
    const artifact = artifactByGoodSeq.get(goodSeq);
    return {
      ...item,
      homeReferenceOnly: true,
      minimumAdvanceDays,
      availabilityRevision,
      ...(artifact?.objectName ? { availabilityObjectName: artifact.objectName } : {})
    };
  });

  const items = [...productSummaries, ...referencedItems];
  const homeCardsPayload = {
    schema: "secret-golf-join-home-cards-v2",
    generatedAt: summaryPayload.generatedAt || "",
    sourceGeneratedAt: summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt || "",
    publicationRevision,
    availabilityRevision,
    minimumAdvanceDays,
    bookableFrom,
    range: summaryPayload.range || {},
    sourceCount: Number(summaryPayload.count || sourceItems.length),
    productSummaryCount: productSummaries.length,
    count: items.length,
    items,
    productMetaByGoodSeq: summaryPayload.productMetaByGoodSeq || {},
    destinations: summaryPayload.destinations || { countries: [] },
    ...(summaryPayload.homeBootstrapLight ? {
      homeBootstrapLight: summaryPayload.homeBootstrapLight,
      homeBootstrapLightUpdatedAt: summaryPayload.homeBootstrapLightUpdatedAt
        || summaryPayload.homeBootstrapLight.updatedAt
        || summaryPayload.homeBootstrapLight.serverTime
        || summaryPayload.generatedAt
        || ""
    } : {})
  };

  return {
    minimumAdvanceDays,
    bookableFrom,
    publicationRevision,
    availabilityRevision,
    availabilityArtifacts,
    homeCardsPayload
  };
}

function buildGolfJoinFamilyAvailabilityArtifacts(publishedCatalog = {}, availabilityArtifacts = [], options = {}) {
  const familyRevision = text(publishedCatalog.publicationRevision);
  const availabilityObjectPrefix = text(options.availabilityObjectPrefix).replace(/\/+$/, "");
  const maximumRawBytes = Number.isFinite(Number(options.maximumRawBytes))
    ? Math.max(1, Number(options.maximumRawBytes))
    : FAMILY_AVAILABILITY_MAX_RAW_BYTES;
  const maximumEventCount = Number.isFinite(Number(options.maximumEventCount))
    ? Math.max(1, Number(options.maximumEventCount))
    : FAMILY_AVAILABILITY_MAX_EVENT_COUNT;
  const availabilityByGoodSeq = new Map((Array.isArray(availabilityArtifacts) ? availabilityArtifacts : [])
    .map((artifact) => [getProductGoodSeq(artifact?.payload || artifact), artifact?.payload || artifact])
    .filter(([goodSeq, payload]) => goodSeq && payload));
  const diagnostics = [];
  const artifacts = [];

  (Array.isArray(publishedCatalog.families) ? publishedCatalog.families : [])
    .slice()
    .sort((left, right) => text(left?.familyId).localeCompare(text(right?.familyId)))
    .forEach((family) => {
      const familyId = text(family?.familyId);
      const goodSeqs = [...new Set((Array.isArray(family?.members) ? family.members : [])
        .map((member) => getProductGoodSeq(member))
        .filter(Boolean))];
      const sourcePayloads = goodSeqs.map((goodSeq) => availabilityByGoodSeq.get(goodSeq)).filter(Boolean);
      const missingGoodSeqs = goodSeqs.filter((goodSeq) => !availabilityByGoodSeq.has(goodSeq));
      const availabilityRevisions = [...new Set(sourcePayloads.map((payload) => text(payload.availabilityRevision)).filter(Boolean))];
      const availabilityRevision = text(options.availabilityRevision) || availabilityRevisions[0] || "";
      const invalidSourceGoodSeqs = sourcePayloads.filter((payload) => (
        text(payload.schema) !== "secret-golf-join-product-availability-v1"
        || getProductGoodSeq(payload) !== text(payload.goodSeq)
        || (availabilityRevision && text(payload.availabilityRevision) !== availabilityRevision)
        || !Array.isArray(payload.events)
        || Number(payload.count) !== payload.events.length
      )).map((payload) => text(payload.goodSeq)).filter(Boolean);

      if (!familyId || goodSeqs.length < 2 || missingGoodSeqs.length || invalidSourceGoodSeqs.length || availabilityRevisions.length > 1) {
        diagnostics.push({
          familyId,
          status: "skipped",
          reason: "family_availability_source_invalid",
          goodSeqs,
          missingGoodSeqs,
          invalidSourceGoodSeqs,
          availabilityRevisions
        });
        return;
      }

      const products = goodSeqs.map((goodSeq) => {
        const source = availabilityByGoodSeq.get(goodSeq);
        return {
          goodSeq,
          count: source.events.length,
          events: source.events
        };
      });
      const eventCount = products.reduce((sum, product) => sum + product.count, 0);
      const firstSource = sourcePayloads[0] || {};
      const payload = {
        schema: "secret-golf-join-family-availability-v1",
        generatedAt: text(options.generatedAt || firstSource.generatedAt),
        sourceGeneratedAt: text(options.sourceGeneratedAt || firstSource.sourceGeneratedAt || firstSource.generatedAt),
        availabilityRevision,
        familyRevision,
        familyId,
        minimumAdvanceDays: Number.isFinite(Number(firstSource.minimumAdvanceDays))
          ? Number(firstSource.minimumAdvanceDays)
          : 0,
        bookableFrom: text(firstSource.bookableFrom),
        goodSeqs,
        productCount: products.length,
        count: eventCount,
        products
      };
      const rawBytes = Buffer.byteLength(`${JSON.stringify(payload)}\n`, "utf8");
      if (eventCount > maximumEventCount || rawBytes > maximumRawBytes) {
        diagnostics.push({
          familyId,
          status: "skipped",
          reason: "family_availability_safety_limit_exceeded",
          eventCount,
          rawBytes,
          maximumEventCount,
          maximumRawBytes
        });
        return;
      }
      artifacts.push({
        familyId,
        availabilityRevision,
        familyRevision,
        objectName: availabilityObjectPrefix && familyRevision
          ? `${availabilityObjectPrefix}/families/${familyRevision}/${familyId}.json`
          : "",
        eventCount,
        rawBytes,
        payload
      });
    });

  return {
    schema: "secret-golf-join-family-availability-publication-v1",
    availabilityRevision: text(options.availabilityRevision)
      || artifacts[0]?.availabilityRevision
      || "",
    familyRevision,
    familyCount: artifacts.length,
    eventCount: artifacts.reduce((sum, artifact) => sum + artifact.eventCount, 0),
    artifacts,
    diagnostics
  };
}

module.exports = {
  HOME_PRODUCT_MINIMUM_ADVANCE_DAYS,
  FAMILY_AVAILABILITY_MAX_RAW_BYTES,
  FAMILY_AVAILABILITY_MAX_EVENT_COUNT,
  addDaysToISODate,
  isBookableProductEvent,
  compareProductEventsByDeparture,
  buildAvailabilityRevision,
  buildHomeCardsPublicationRevision,
  buildGolfJoinHomeArtifacts,
  buildGolfJoinFamilyAvailabilityArtifacts
};
