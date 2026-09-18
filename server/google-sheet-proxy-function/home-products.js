"use strict";

const crypto = require("crypto");

const HOME_PRODUCT_MINIMUM_ADVANCE_DAYS = 7;

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
  return stableRevision("ghc", {
    sourceGeneratedAt: text(summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt),
    range: summaryPayload.range || {},
    sourceCount: Number(summaryPayload.sourceCount || summaryPayload.count || 0),
    homeBootstrapLightUpdatedAt: text(summaryPayload.homeBootstrapLightUpdatedAt),
    refreshReason: text(summaryPayload.refreshReason),
    availabilityRevision: buildAvailabilityRevision(summaryPayload)
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

module.exports = {
  HOME_PRODUCT_MINIMUM_ADVANCE_DAYS,
  addDaysToISODate,
  isBookableProductEvent,
  compareProductEventsByDeparture,
  buildAvailabilityRevision,
  buildHomeCardsPublicationRevision,
  buildGolfJoinHomeArtifacts
};
