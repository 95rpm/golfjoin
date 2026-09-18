"use strict";

const crypto = require("node:crypto");

const PRODUCT_DISCOVERY_PREFIX = "gpd";
const PRODUCT_DISCOVERY_ROOT_OBJECT_NAME = "web/product-discovery/manifest.json";

function text(value) {
  return String(value ?? "").trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    const child = value[key];
    if (child !== undefined) result[key] = canonicalize(child);
    return result;
  }, {});
}

function serializePayload(payload) {
  return `${JSON.stringify(canonicalize(payload))}\n`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function buildPublicUrl(bucketName, objectName) {
  const bucket = text(bucketName);
  const normalizedObjectName = text(objectName).replace(/^\/+/, "");
  if (!bucket || !normalizedObjectName) return "";
  return `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${normalizedObjectName.split("/").map(encodeURIComponent).join("/")}`;
}

function compareEvents(left = {}, right = {}) {
  return text(left.departureDate).localeCompare(text(right.departureDate))
    || text(left.returnDate).localeCompare(text(right.returnDate))
    || text(left.goodSeq).localeCompare(text(right.goodSeq))
    || text(left.eventSeq).localeCompare(text(right.eventSeq));
}

function normalizeEvent(item = {}, index = 0) {
  const goodSeq = text(item.goodSeq || item.erpProductId || item.productId);
  const eventSeq = text(item.eventSeq || item.erpEventSeq);
  const departureDate = text(item.departureDate).slice(0, 10);
  const returnDate = text(item.returnDate || departureDate).slice(0, 10);
  const title = text(item.title);
  const price = Number(item.price || item.generalPrice || item.productPrice || 0);
  if (!/^\d+$/.test(goodSeq)) throw new Error(`Invalid discovery goodSeq at item ${index}`);
  if (!eventSeq) throw new Error(`Missing discovery eventSeq at item ${index}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) throw new Error(`Invalid discovery departureDate at item ${index}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate) || returnDate < departureDate) {
    throw new Error(`Invalid discovery returnDate at item ${index}`);
  }
  if (!title) throw new Error(`Missing discovery title at item ${index}`);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid discovery price at item ${index}`);
  return canonicalize({
    ...item,
    goodSeq,
    eventSeq,
    departureDate,
    returnDate,
    price
  });
}

function eventIdentity(item = {}) {
  return `${text(item.goodSeq)}:${text(item.eventSeq)}`;
}

function createArtifact(payload, objectName, bucketName) {
  const serialized = serializePayload(payload);
  return {
    objectName,
    url: buildPublicUrl(bucketName, objectName),
    sha256: sha256(serialized),
    rawBytes: Buffer.byteLength(serialized, "utf8"),
    payload
  };
}

function buildProductDiscoveryArtifacts(summaryPayload = {}, options = {}) {
  const sourceItems = Array.isArray(summaryPayload.items) ? summaryPayload.items : [];
  if (!sourceItems.length) throw new Error("Product discovery source is empty");

  const items = sourceItems.map(normalizeEvent).sort(compareEvents);
  const seenKeys = new Set();
  items.forEach((item) => {
    const key = eventIdentity(item);
    if (seenKeys.has(key)) throw new Error(`Duplicate product discovery event: ${key}`);
    seenKeys.add(key);
  });

  const generatedAt = text(options.generatedAt || summaryPayload.generatedAt || summaryPayload.sourceGeneratedAt);
  const sourceGeneratedAt = text(summaryPayload.sourceGeneratedAt || summaryPayload.generatedAt || generatedAt);
  if (!generatedAt || !sourceGeneratedAt) throw new Error("Product discovery generatedAt is required");
  // Versioned objects also contain these timestamps. Include them in the revision so
  // one immutable object name can never refer to two different logical payloads.
  const discoveryRevision = `${PRODUCT_DISCOVERY_PREFIX}_${sha256(JSON.stringify({
    generatedAt,
    sourceGeneratedAt,
    items
  })).slice(0, 24)}`;

  const objectPrefix = text(options.objectPrefix || "web/product-discovery").replace(/\/+$/, "");
  const bucketName = text(options.bucketName || "golfjoin-bucket");
  const revisionPrefix = `${objectPrefix}/${discoveryRevision}`;
  const groupedByMonth = new Map();
  items.forEach((item) => {
    const month = item.departureDate.slice(0, 7);
    if (!groupedByMonth.has(month)) groupedByMonth.set(month, []);
    groupedByMonth.get(month).push(item);
  });

  const monthArtifacts = [...groupedByMonth.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([month, monthItems]) => {
      const regions = [...new Set(monthItems.map((item) => text(item.region)).filter(Boolean))].sort();
      const payload = {
        schema: "secret-golf-join-product-discovery-month-v1",
        generatedAt,
        sourceGeneratedAt,
        discoveryRevision,
        month,
        range: {
          startDate: monthItems[0].departureDate,
          endDate: monthItems[monthItems.length - 1].departureDate
        },
        count: monthItems.length,
        items: monthItems
      };
      return {
        month,
        regions,
        ...createArtifact(payload, `${revisionPrefix}/months/${month}.json`, bucketName)
      };
    });

  const regionMap = new Map();
  items.forEach((item) => {
    const region = text(item.region);
    if (!region) return;
    if (!regionMap.has(region)) regionMap.set(region, { count: 0, months: new Set() });
    const entry = regionMap.get(region);
    entry.count += 1;
    entry.months.add(item.departureDate.slice(0, 7));
  });
  const regions = [...regionMap.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([name, entry]) => ({ name, count: entry.count, months: [...entry.months].sort() }));

  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  const range = { startDate: firstItem.departureDate, endDate: lastItem.departureDate };
  const indexPayload = {
    schema: "secret-golf-join-product-discovery-index-v1",
    generatedAt,
    sourceGeneratedAt,
    discoveryRevision,
    range,
    eventCount: items.length,
    monthCount: monthArtifacts.length,
    regionCount: regions.length,
    months: monthArtifacts.map((artifact) => ({
      month: artifact.month,
      range: artifact.payload.range,
      count: artifact.payload.count,
      regions: artifact.regions,
      objectName: artifact.objectName,
      url: artifact.url,
      sha256: artifact.sha256,
      rawBytes: artifact.rawBytes
    })),
    regions
  };
  const indexArtifact = createArtifact(indexPayload, `${revisionPrefix}/index.json`, bucketName);

  const lookupPayload = {
    schema: "secret-golf-join-product-discovery-lookup-v1",
    generatedAt,
    sourceGeneratedAt,
    discoveryRevision,
    count: items.length,
    items: items.map((item) => ({
      key: eventIdentity(item),
      goodSeq: item.goodSeq,
      eventSeq: item.eventSeq,
      month: item.departureDate.slice(0, 7)
    }))
  };
  const lookupArtifact = createArtifact(lookupPayload, `${revisionPrefix}/lookup.json`, bucketName);

  const manifestPayload = {
    schema: "secret-golf-join-product-discovery-manifest-v1",
    generatedAt,
    sourceGeneratedAt,
    discoveryRevision,
    browserReadEnabled: options.browserReadEnabled === true,
    range,
    eventCount: items.length,
    monthCount: monthArtifacts.length,
    regionCount: regions.length,
    index: {
      objectName: indexArtifact.objectName,
      url: indexArtifact.url,
      sha256: indexArtifact.sha256,
      rawBytes: indexArtifact.rawBytes
    },
    lookup: {
      objectName: lookupArtifact.objectName,
      url: lookupArtifact.url,
      sha256: lookupArtifact.sha256,
      rawBytes: lookupArtifact.rawBytes
    }
  };

  return {
    schema: "secret-golf-join-product-discovery-publication-v1",
    discoveryRevision,
    eventCount: items.length,
    monthCount: monthArtifacts.length,
    regionCount: regions.length,
    rootObjectName: text(options.rootObjectName || PRODUCT_DISCOVERY_ROOT_OBJECT_NAME),
    manifestPayload,
    indexArtifact,
    lookupArtifact,
    monthArtifacts
  };
}

module.exports = {
  PRODUCT_DISCOVERY_PREFIX,
  PRODUCT_DISCOVERY_ROOT_OBJECT_NAME,
  canonicalize,
  serializePayload,
  buildPublicUrl,
  buildProductDiscoveryArtifacts
};
