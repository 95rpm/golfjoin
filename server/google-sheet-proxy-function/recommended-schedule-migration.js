"use strict";

const crypto = require("crypto");

const MIGRATION_SHEETS = Object.freeze([
  "recommended_schedules",
  "join_applications",
  "schedule_participant_summary",
  "join_wishes",
  "join_reviews",
  "new_schedule_applications"
]);

function text(value = "") {
  return String(value == null ? "" : value).trim();
}

function firstText(...values) {
  return values.map(text).find(Boolean) || "";
}

function normalizeNumericId(value = "", label = "id") {
  const normalized = text(value);
  if (!/^\d+$/.test(normalized)) throw new Error(`${label} must be numeric`);
  return normalized;
}

function buildRecommendedScheduleReference(goodSeq = "", eventSeq = "") {
  const normalizedGoodSeq = normalizeNumericId(goodSeq, "goodSeq");
  const normalizedEventSeq = normalizeNumericId(eventSeq, "eventSeq");
  const recommendedScheduleId = `rs-${normalizedGoodSeq}-${normalizedEventSeq}`;
  return {
    goodSeq: normalizedGoodSeq,
    eventSeq: normalizedEventSeq,
    recommendedScheduleId,
    adminScheduleId: `admin-recommended-${recommendedScheduleId}`,
    productKey: `erp:${normalizedGoodSeq}:${normalizedEventSeq}`
  };
}

function buildRecommendedScheduleMigrationKey(source = {}, target = {}) {
  return `recommended-schedule:${source.goodSeq}:${source.eventSeq}->${target.goodSeq}:${target.eventSeq}`;
}

function buildMigrationFingerprint(source = {}, target = {}) {
  return crypto
    .createHash("sha256")
    .update(buildRecommendedScheduleMigrationKey(source, target), "utf8")
    .digest("hex")
    .slice(0, 20);
}

function getProductDetails(product = {}) {
  return {
    title: firstText(product.title, product.productName, product.goodName),
    imageUrl: firstText(product.image, product.imageUrl, product.thumbnailUrl),
    country: firstText(product.country, product.countryName, product.nation),
    region: firstText(product.region, product.city, product.area),
    airline: firstText(product.airline, product.airlineName, product.air2Nm, product.air2CdNm),
    departureAirport: firstText(product.departureAirport, product.depAirport, product.airport, product.airportName),
    arrivalAirport: firstText(product.arrivalAirport, product.arrAirport),
    departureDate: firstText(product.departureDate, product.date),
    returnDate: firstText(product.returnDate),
    tripSummary: firstText(product.tripSummary, product.dayNightCnt, product.duration, product.dayNight),
    price: firstText(product.price, product.productPrice, product.generalPrice),
    packType: firstText(product.packType),
    packTypeName: firstText(product.packTypeName)
  };
}

function sameProductReference(row = {}, reference = {}) {
  return text(row.erpProductId || row.goodSeq || row.productId) === reference.goodSeq
    && text(row.erpEventSeq || row.eventSeq) === reference.eventSeq;
}

function hasScheduleReference(row = {}, reference = {}) {
  const values = [
    row.recommendedScheduleId,
    row.displayRuleId,
    row.scheduleId,
    row.sourceApplicationId,
    row.targetScheduleId,
    row.targetApplicationId,
    row.targetJoinId,
    row.targetKey,
    row.targetProductKey
  ].map(text).filter(Boolean);
  return values.some((value) => (
    value === reference.recommendedScheduleId
    || value === reference.adminScheduleId
    || value === reference.productKey
    || value.includes(reference.adminScheduleId)
    || value.includes(reference.recommendedScheduleId)
  ));
}

function replaceReferenceText(value = "", source = {}, target = {}) {
  const original = String(value == null ? "" : value);
  if (!original) return original;
  if (original === source.goodSeq) return target.goodSeq;
  if (original === source.eventSeq) return target.eventSeq;
  if (original === source.recommendedScheduleId) return target.recommendedScheduleId;
  if (original === source.adminScheduleId) return target.adminScheduleId;
  if (original === source.productKey) return target.productKey;
  return original
    .split(source.adminScheduleId).join(target.adminScheduleId)
    .split(source.recommendedScheduleId).join(target.recommendedScheduleId)
    .split(source.productKey).join(target.productKey)
    .split(`${source.goodSeq}:${source.eventSeq}`).join(`${target.goodSeq}:${target.eventSeq}`)
    .split(`${source.goodSeq}-${source.eventSeq}`).join(`${target.goodSeq}-${target.eventSeq}`)
    .replace(new RegExp(`([?&]goodSeq=)${source.goodSeq}(?=&|$)`, "g"), `$1${target.goodSeq}`)
    .replace(new RegExp(`([?&]eventSeq=)${source.eventSeq}(?=&|$)`, "g"), `$1${target.eventSeq}`);
}

function migrateNestedReferences(value, source = {}, target = {}) {
  if (Array.isArray(value)) return value.map((item) => migrateNestedReferences(item, source, target));
  if (value && typeof value === "object") {
    return Object.entries(value).reduce((next, [key, item]) => {
      next[key] = migrateNestedReferences(item, source, target);
      return next;
    }, {});
  }
  if (typeof value === "string") return replaceReferenceText(value, source, target);
  return value;
}

function migrateScheduleSnapshot(value = "", source = {}, target = {}, details = {}) {
  const raw = text(value);
  if (!raw) return value;
  try {
    const parsed = migrateNestedReferences(JSON.parse(raw), source, target);
    const updated = {
      ...parsed,
      targetScheduleId: target.adminScheduleId,
      targetApplicationId: target.recommendedScheduleId,
      targetJoinId: target.adminScheduleId,
      erpProductId: target.goodSeq,
      erpEventSeq: target.eventSeq,
      ...(details.title ? { productName: details.title } : {}),
      ...(details.departureDate ? { departureDate: details.departureDate } : {}),
      ...(details.returnDate ? { returnDate: details.returnDate } : {}),
      ...(details.country ? { country: details.country } : {}),
      ...(details.region ? { region: details.region } : {}),
      ...(details.airline ? { airline: details.airline } : {}),
      ...(details.departureAirport ? { departureAirport: details.departureAirport } : {}),
      ...(details.arrivalAirport ? { arrivalAirport: details.arrivalAirport } : {})
    };
    return JSON.stringify(updated);
  } catch (error) {
    return replaceReferenceText(value, source, target);
  }
}

function applyIfPresent(row = {}, key = "", value = "") {
  if (!text(value)) return;
  row[key] = value;
}

function migrateRecommendedScheduleRow(row = {}, context = {}) {
  const { source, target, details, now } = context;
  const next = {
    ...row,
    recommendedScheduleId: target.recommendedScheduleId,
    erpProductId: target.goodSeq,
    erpEventSeq: target.eventSeq,
    updatedAt: now
  };
  applyIfPresent(next, "overrideTitle", details.title);
  applyIfPresent(next, "overrideImageUrl", details.imageUrl);
  applyIfPresent(next, "country", details.country);
  applyIfPresent(next, "region", details.region);
  applyIfPresent(next, "airline", details.airline);
  applyIfPresent(next, "departureAirport", details.departureAirport);
  applyIfPresent(next, "arrivalAirport", details.arrivalAirport);
  applyIfPresent(next, "productPrice", details.price);
  applyIfPresent(next, "displayStartAt", details.departureDate);
  applyIfPresent(next, "displayEndAt", details.returnDate);
  applyIfPresent(next, "tripSummary", details.tripSummary);
  applyIfPresent(next, "packType", details.packType);
  applyIfPresent(next, "packTypeName", details.packTypeName);
  return next;
}

function migrateJoinApplicationRow(row = {}, context = {}) {
  const { source, target, details, now } = context;
  const next = {
    ...row,
    targetType: "recommended_schedule",
    targetScheduleId: target.adminScheduleId,
    targetApplicationId: target.recommendedScheduleId,
    targetJoinId: target.adminScheduleId,
    targetProductKey: target.productKey,
    erpProductId: target.goodSeq,
    erpEventSeq: target.eventSeq,
    updatedAt: now
  };
  applyIfPresent(next, "productName", details.title);
  applyIfPresent(next, "departureDate", details.departureDate);
  applyIfPresent(next, "returnDate", details.returnDate);
  applyIfPresent(next, "country", details.country);
  applyIfPresent(next, "region", details.region);
  applyIfPresent(next, "airline", details.airline);
  applyIfPresent(next, "departureAirport", details.departureAirport);
  applyIfPresent(next, "arrivalAirport", details.arrivalAirport);
  if (Object.prototype.hasOwnProperty.call(next, "scheduleSnapshotJson")) {
    next.scheduleSnapshotJson = migrateScheduleSnapshot(next.scheduleSnapshotJson, source, target, details);
  }
  return next;
}

function migrateParticipantSummaryRow(row = {}, context = {}) {
  const { target, details, now } = context;
  const next = {
    ...row,
    scheduleId: target.adminScheduleId,
    sourceApplicationId: target.recommendedScheduleId,
    updatedAt: now
  };
  applyIfPresent(next, "title", details.title);
  applyIfPresent(next, "country", details.country);
  applyIfPresent(next, "region", details.region);
  applyIfPresent(next, "departureSummary", details.departureDate);
  applyIfPresent(next, "returnSummary", details.returnDate);
  applyIfPresent(next, "tripSummary", details.tripSummary);
  return next;
}

function migrateProductLinkedRow(row = {}, context = {}, options = {}) {
  const { source, target, details, now } = context;
  const next = migrateNestedReferences({ ...row }, source, target);
  next.erpProductId = target.goodSeq;
  next.erpEventSeq = target.eventSeq;
  next.updatedAt = now;
  if (hasScheduleReference(row, source)) {
    if (Object.prototype.hasOwnProperty.call(next, "targetScheduleId")) next.targetScheduleId = target.adminScheduleId;
    if (Object.prototype.hasOwnProperty.call(next, "targetApplicationId")) next.targetApplicationId = target.recommendedScheduleId;
  }
  applyIfPresent(next, "productName", details.title);
  applyIfPresent(next, "country", details.country);
  applyIfPresent(next, "region", details.region);
  if (options.dates !== false) {
    applyIfPresent(next, "departureDate", details.departureDate);
    applyIfPresent(next, "returnDate", details.returnDate);
    applyIfPresent(next, "departureDateFrom", details.departureDate);
    applyIfPresent(next, "departureDateTo", details.departureDate);
    applyIfPresent(next, "returnDateFrom", details.returnDate);
    applyIfPresent(next, "returnDateTo", details.returnDate);
  }
  applyIfPresent(next, "airline", details.airline);
  applyIfPresent(next, "departureAirport", details.departureAirport);
  applyIfPresent(next, "arrivalAirport", details.arrivalAirport);
  applyIfPresent(next, "imageUrl", details.imageUrl);
  applyIfPresent(next, "price", details.price);
  applyIfPresent(next, "productPrice", details.price);
  applyIfPresent(next, "tripSummary", details.tripSummary);
  applyIfPresent(next, "packType", details.packType);
  applyIfPresent(next, "packTypeName", details.packTypeName);
  return next;
}

function rowMatchesSource(sheetName = "", row = {}, source = {}) {
  if (sheetName === "schedule_participant_summary") return hasScheduleReference(row, source);
  if (sheetName === "recommended_schedules") {
    return text(row.recommendedScheduleId || row.displayRuleId) === source.recommendedScheduleId;
  }
  if (sheetName === "join_applications") {
    return hasScheduleReference(row, source)
      || (text(row.targetType) === "recommended_schedule" && sameProductReference(row, source));
  }
  return hasScheduleReference(row, source) || sameProductReference(row, source);
}

function migrateSheetRow(sheetName = "", row = {}, context = {}) {
  if (sheetName === "recommended_schedules") return migrateRecommendedScheduleRow(row, context);
  if (sheetName === "join_applications") return migrateJoinApplicationRow(row, context);
  if (sheetName === "schedule_participant_summary") return migrateParticipantSummaryRow(row, context);
  return migrateProductLinkedRow(row, context);
}

function buildValues(row = {}, headers = []) {
  return headers.map((header) => row[header] == null ? "" : row[header]);
}

function buildRecommendedScheduleMigrationPlan(options = {}) {
  const source = buildRecommendedScheduleReference(options.sourceGoodSeq, options.sourceEventSeq);
  const target = buildRecommendedScheduleReference(options.targetGoodSeq, options.targetEventSeq);
  if (source.goodSeq === target.goodSeq && source.eventSeq === target.eventSeq) {
    throw new Error("source and target product references must differ");
  }
  const sheets = options.sheets || {};
  const headersBySheet = options.headersBySheet || {};
  const now = text(options.now) || new Date().toISOString();
  const details = getProductDetails(options.targetProduct || {});
  const context = { source, target, details, now };
  const recommendedRows = sheets.recommended_schedules || [];
  const sourceRuleIndexes = recommendedRows
    .map((row, index) => rowMatchesSource("recommended_schedules", row, source) ? index : -1)
    .filter((index) => index >= 0);
  const targetRuleIndexes = recommendedRows
    .map((row, index) => text(row.recommendedScheduleId || row.displayRuleId) === target.recommendedScheduleId ? index : -1)
    .filter((index) => index >= 0);
  if (sourceRuleIndexes.length > 1 || targetRuleIndexes.length > 1) throw new Error("recommended schedule id is duplicated");
  if (sourceRuleIndexes.length && targetRuleIndexes.length && sourceRuleIndexes[0] !== targetRuleIndexes[0]) {
    throw new Error("target recommended schedule already exists");
  }
  if (!sourceRuleIndexes.length && !targetRuleIndexes.length) throw new Error("source recommended schedule was not found");

  const productFamilyMatches = (sheets.product_family_members || []).filter((row) => text(row.goodSeq) === source.goodSeq);
  const productFamilyMasterMatches = (sheets.product_family_master || []).filter((row) => (
    text(row.preferredGoodSeq) === source.goodSeq || text(row.resolvedRepresentativeGoodSeq) === source.goodSeq
  ));
  if (productFamilyMatches.length || productFamilyMasterMatches.length) {
    const error = new Error("source product is linked to a product family and requires product-family migration");
    error.code = "product_family_migration_required";
    error.details = {
      memberRows: productFamilyMatches.length,
      masterRows: productFamilyMasterMatches.length
    };
    throw error;
  }

  const updates = [];
  const counts = {};
  MIGRATION_SHEETS.forEach((sheetName) => {
    const rows = sheets[sheetName] || [];
    const headers = headersBySheet[sheetName] || [];
    if (!headers.length) throw new Error(`${sheetName} headers are required`);
    rows.forEach((row, index) => {
      if (!rowMatchesSource(sheetName, row, source)) return;
      const nextRow = migrateSheetRow(sheetName, row, context);
      updates.push({
        sheetName,
        rowNumber: index + 2,
        before: row,
        after: nextRow,
        beforeValues: buildValues(row, headers),
        afterValues: buildValues(nextRow, headers)
      });
      counts[sheetName] = (counts[sheetName] || 0) + 1;
    });
  });

  return {
    source,
    target,
    details,
    migrationKey: buildRecommendedScheduleMigrationKey(source, target),
    fingerprint: buildMigrationFingerprint(source, target),
    updates,
    counts,
    alreadyMigrated: !sourceRuleIndexes.length && targetRuleIndexes.length > 0,
    sourceParticipantCount: counts.join_applications || 0
  };
}

function summarizeRecommendedScheduleMigrationPlan(plan = {}) {
  return {
    source: plan.source,
    target: plan.target,
    migrationKey: plan.migrationKey,
    fingerprint: plan.fingerprint,
    alreadyMigrated: Boolean(plan.alreadyMigrated),
    updateCount: Array.isArray(plan.updates) ? plan.updates.length : 0,
    counts: plan.counts || {},
    participantCount: Number(plan.sourceParticipantCount || 0),
    targetProduct: plan.details || {}
  };
}

module.exports = {
  MIGRATION_SHEETS,
  buildRecommendedScheduleReference,
  buildRecommendedScheduleMigrationKey,
  buildRecommendedScheduleMigrationPlan,
  summarizeRecommendedScheduleMigrationPlan,
  replaceReferenceText,
  migrateScheduleSnapshot,
  rowMatchesSource
};
