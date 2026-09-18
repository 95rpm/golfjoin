"use strict";

const crypto = require("node:crypto");

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function digits(value) {
  return text(value).replace(/\D/g, "");
}

function date(value) {
  const normalized = digits(value);
  return normalized.length === 8
    ? `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`
    : text(value);
}

function number(value) {
  const normalized = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function identityHash(value) {
  return crypto.createHash("sha256").update(text(value)).digest("hex").slice(0, 16);
}

function addIssue(issues, identity, field, code = "core_field_mismatch") {
  issues.push({ identityHash: identityHash(identity), path: `$.${field}`, code });
}

function normalizeTextList(values, options = {}) {
  const normalized = (Array.isArray(values) ? values : [])
    .map((item) => text(typeof item === "object" && item ? item.text : item))
    .filter(Boolean);
  return options.keepOrder ? normalized : normalized.sort((left, right) => left.localeCompare(right));
}

function normalizeSchedule(schedule) {
  return (Array.isArray(schedule) ? schedule : []).map((item = {}) => ({
    day: text(item.day),
    dateText: text(item.dateText),
    content: text(item.content),
    rawText: text(item.rawText),
    hotel: text(item.extra?.hotel || item.hotel),
    meals: (Array.isArray(item.extra?.meals || item.meals) ? (item.extra?.meals || item.meals) : []).map((meal = {}) => ({
      label: text(meal.label),
      menu: text(meal.menu)
    }))
  }));
}

function normalizeFlightItems(items) {
  return (Array.isArray(items) ? items : []).map((item = {}) => ({
    label: text(item.label),
    airline: text(item.airline),
    code: text(item.code).replace(/\s+/g, "").toUpperCase(),
    fromDate: date(item.fromDate),
    fromTime: text(item.fromTime),
    toDate: date(item.toDate),
    toTime: text(item.toTime)
  }));
}

function normalizeParticipantProfiles(items) {
  return (Array.isArray(items) ? items : []).map((item = {}) => ({
    displayName: text(item.displayName),
    gender: text(item.gender),
    ageDisplay: text(item.ageDisplay),
    profession: text(item.profession),
    level: text(item.level),
    styles: normalizeTextList(item.styles),
    memberPreferences: normalizeTextList(item.memberPreferences)
  })).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function compareFields(identity, current, candidate, fields, issues) {
  fields.forEach(({ name, currentValue, candidateValue, normalize = text }) => {
    const left = normalize(currentValue(current));
    const right = normalize(candidateValue ? candidateValue(candidate) : currentValue(candidate));
    if (stableStringify(left) !== stableStringify(right)) addIssue(issues, identity, name);
  });
}

function compareCollections(currentRows, candidateRows, options) {
  const current = Array.isArray(currentRows) ? currentRows : [];
  const candidate = Array.isArray(candidateRows) ? candidateRows : [];
  const currentByKey = new Map(current.map((item) => [options.key(item), item]).filter(([key]) => key));
  const candidateByKey = new Map(candidate.map((item) => [options.key(item), item]).filter(([key]) => key));
  const issues = [];

  currentByKey.forEach((item, key) => {
    const next = candidateByKey.get(key);
    if (!next) {
      addIssue(issues, key, options.collectionName, "candidate_item_missing");
      return;
    }
    compareFields(key, item, next, options.fields, issues);
  });
  candidateByKey.forEach((item, key) => {
    if (!currentByKey.has(key)) addIssue(issues, key, options.collectionName, "candidate_item_unexpected");
  });

  return { valid: issues.length === 0, issues };
}

const HOME_FIELDS = [
  { name: "goodSeq", currentValue: (item) => item.goodSeq || item.erpProductId, normalize: digits },
  { name: "eventSeq", currentValue: (item) => item.eventSeq || item.erpEventSeq, normalize: digits },
  { name: "familyId", currentValue: (item) => item.familyId || item.productFamilyId, normalize: text },
  { name: "price", currentValue: (item) => item.price, normalize: number },
  { name: "departureDate", currentValue: (item) => item.departureDate, normalize: date },
  { name: "returnDate", currentValue: (item) => item.returnDate, normalize: date },
  { name: "status", currentValue: (item) => item.status || item.displayStatus, normalize: text }
];

function getHomeKey(item = {}) {
  return `${digits(item.goodSeq || item.erpProductId)}:${digits(item.eventSeq || item.erpEventSeq)}`;
}

function compareHomeProductCollections(currentRows, candidateRows) {
  return compareCollections(currentRows, candidateRows, {
    collectionName: "homeProducts",
    key: getHomeKey,
    fields: HOME_FIELDS
  });
}

const LIVE_FIELDS = [
  { name: "scheduleId", currentValue: (item) => item.scheduleId || item.targetScheduleId, normalize: text },
  { name: "goodSeq", currentValue: (item) => item.goodSeq || item.erpProductId, normalize: digits },
  { name: "eventSeq", currentValue: (item) => item.eventSeq || item.erpEventSeq, normalize: digits },
  { name: "confirmedCount", currentValue: (item) => item.confirmedCount ?? item.joinedPeople, normalize: number },
  { name: "remainingSlots", currentValue: (item) => item.remainingSlots ?? item.remainingSeats, normalize: number },
  { name: "approvalStatus", currentValue: (item) => item.approvalStatus, normalize: text },
  { name: "displayStatus", currentValue: (item) => item.displayStatus, normalize: text },
  { name: "participantsPreview", currentValue: (item) => item.participantsPreview, normalize: normalizeParticipantProfiles }
];

function getLiveKey(item = {}) {
  return text(item.scheduleId || item.targetScheduleId);
}

function compareLiveScheduleCollections(currentRows, candidateRows) {
  return compareCollections(currentRows, candidateRows, {
    collectionName: "liveSchedules",
    key: getLiveKey,
    fields: LIVE_FIELDS
  });
}

function compareProductDetailCore(current = {}, candidate = {}) {
  const identity = `${digits(current.goodSeq || current.erpProductId)}:${digits(current.eventSeq || current.erpEventSeq)}`;
  const issues = [];
  compareFields(identity, current, candidate, [
    { name: "goodSeq", currentValue: (item) => item.goodSeq || item.erpProductId, normalize: digits },
    { name: "eventSeq", currentValue: (item) => item.eventSeq || item.erpEventSeq, normalize: digits },
    { name: "title", currentValue: (item) => item.title || item.eventNm, normalize: text },
    { name: "departureDate", currentValue: (item) => item.departureDate || item.startDay, normalize: date },
    { name: "returnDate", currentValue: (item) => item.returnDate || item.endDay, normalize: date },
    { name: "price", currentValue: (item) => item.generalPrice ?? item.price, normalize: number },
    { name: "includes", currentValue: (item) => item.includes, normalize: normalizeTextList },
    { name: "excludes", currentValue: (item) => item.excludes, normalize: normalizeTextList },
    { name: "notes", currentValue: (item) => item.notes, normalize: normalizeTextList },
    { name: "schedule", currentValue: (item) => item.schedule, normalize: normalizeSchedule },
    { name: "slides", currentValue: (item) => item.slides, normalize: (value) => normalizeTextList(value, { keepOrder: true }) },
    { name: "introImages", currentValue: (item) => item.introImages, normalize: (value) => normalizeTextList(value, { keepOrder: true }) },
    {
      name: "flightScheduleItems",
      currentValue: (item) => item.flightScheduleItems,
      candidateValue: (item) => item.flight?.items || item.flightScheduleItems,
      normalize: normalizeFlightItems
    }
  ], issues);
  return { valid: issues.length === 0, issues };
}

module.exports = {
  compareHomeProductCollections,
  compareLiveScheduleCollections,
  compareProductDetailCore,
  identityHash
};
