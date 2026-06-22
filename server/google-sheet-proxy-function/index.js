"use strict";

const SHEET_WEB_APP_URL = process.env.SHEET_WEB_APP_URL || "";
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "https://m.secret-tour.com,https://www.secret-tour.com")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const ALLOWED_READ_SHEETS = new Set([
  "new_schedule_applications",
  "join_applications",
  "join_member_profiles",
  "join_reviews",
  "join_wishes",
  "schedule_participant_summary",
  "product_display_rules",
  "new_schedule",
  "builder",
  "join",
  "join_member_profile",
  "member_profiles",
  "join_review",
  "reviews",
  "join_wish",
  "wishes",
  "summary",
  "display_rules",
  "all"
]);

const ALLOWED_WRITE_SHEETS_BY_SOURCE = {
  new_schedule_builder: "new_schedule_applications",
  join_apply: "join_applications",
  join_member_profile: "join_member_profiles",
  join_review: "join_reviews",
  join_wish: "join_wishes"
};
const ALLOWED_ACTIONS = new Set(["", "upsert"]);
const ALLOWED_GENDERS = new Set(["남성", "여성", "M", "F", "male", "female"]);
const MAX_STRING_LENGTHS = {
  name: 50,
  phone: 20,
  email: 120,
  url: 600,
  short: 120,
  medium: 300,
  long: 2000
};
const MAX_POST_BYTES = Number(process.env.MAX_POST_BYTES || 128 * 1024);

function getAllowedOrigin(origin = "") {
  if (!origin) return "";
  if (ALLOWED_ORIGINS.includes("*")) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function setCorsHeaders(req, res) {
  const origin = getAllowedOrigin(req.headers.origin || "");
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "false");
  }
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Max-Age", "3600");
}

function assertRequestAllowed(req) {
  if (!SHEET_WEB_APP_URL) {
    const error = new Error("SHEET_WEB_APP_URL is not configured");
    error.status = 500;
    throw error;
  }
  if (ALLOWED_ORIGINS.length && !getAllowedOrigin(req.headers.origin || "")) {
    const error = new Error("Origin not allowed");
    error.status = 403;
    throw error;
  }
}

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8") || "{}");
  return {};
}

function normalizeSheetName(value = "") {
  return String(value || "").trim();
}

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getValue(object, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), object);
}

function asText(value = "") {
  return String(value == null ? "" : value).trim();
}

function assertTextLength(value, field, maxLength, options = {}) {
  const text = asText(value);
  if (options.required && !text) throw createHttpError(`${field} is required`);
  if (text.length > maxLength) throw createHttpError(`${field} is too long`);
  return text;
}

function normalizePhone(value = "") {
  const digits = asText(value).replace(/\D/g, "");
  if (/^1[016789]\d{8}$/.test(digits)) return `0${digits}`;
  return digits;
}

function assertPhone(value, field = "phone") {
  const phone = normalizePhone(value);
  if (!/^010\d{8}$/.test(phone)) throw createHttpError(`${field} is invalid`);
  return phone;
}

function assertBirthYear(value, field = "birthYear", options = {}) {
  const text = asText(value);
  if (!text && !options.required) return "";
  if (!/^(19|20)\d{2}$/.test(text)) throw createHttpError(`${field} is invalid`);
  const year = Number(text);
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) throw createHttpError(`${field} is invalid`);
  return text;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeList(parsed);
    } catch (error) {
      // Fall back to comma-separated text.
    }
    return trimmed.split(",").map(asText).filter(Boolean);
  }
  return [];
}

function assertList(value, field, options = {}) {
  const list = normalizeList(value);
  if (options.required && !list.length) throw createHttpError(`${field} is required`);
  if (options.maxItems && list.length > options.maxItems) throw createHttpError(`${field} has too many items`);
  const maxTextLength = options.maxTextLength || MAX_STRING_LENGTHS.short;
  list.forEach((item) => {
    if (item.length > maxTextLength) throw createHttpError(`${field} item is too long`);
  });
  return list;
}

function assertBooleanTrue(value, field) {
  if (value !== true && value !== "true" && value !== 1 && value !== "1") {
    throw createHttpError(`${field} is required`);
  }
}

function assertNumberRange(value, field, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw createHttpError(`${field} is invalid`);
  }
  return number;
}

function assertAllowedValue(value, field, allowedValues, options = {}) {
  const text = asText(value);
  if (!text && !options.required) return "";
  if (!allowedValues.has(text)) throw createHttpError(`${field} is invalid`);
  return text;
}

function assertSafeGcsImageUrl(value, field, allowedPrefixes) {
  const url = asText(value);
  if (!url) return "";
  const prefixes = Array.isArray(allowedPrefixes) ? allowedPrefixes : [allowedPrefixes];
  assertTextLength(url, field, MAX_STRING_LENGTHS.url);
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw createHttpError(`${field} is invalid`);
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "storage.googleapis.com") {
    throw createHttpError(`${field} host is not allowed`);
  }
  const path = decodeURIComponent(parsed.pathname || "");
  if (!prefixes.some((prefix) => path.startsWith(`/golfjoin-bucket/${prefix}/`))) {
    throw createHttpError(`${field} path is not allowed`);
  }
  return url;
}

function parseImages(payload) {
  const directImages = getValue(payload, "review.images");
  if (Array.isArray(directImages)) return directImages;
  const imagesJson = asText(payload.imagesJson);
  if (!imagesJson) return [];
  try {
    const parsed = JSON.parse(imagesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw createHttpError("imagesJson is invalid");
  }
}

function assertWriteSourceAndSheet(payload) {
  const source = asText(payload.source);
  const expectedSheet = ALLOWED_WRITE_SHEETS_BY_SOURCE[source];
  if (!expectedSheet) throw createHttpError("source is not allowed");
  const sheet = normalizeSheetName(payload.sheet || "");
  if (sheet && sheet !== expectedSheet) throw createHttpError("sheet does not match source");
  if (!ALLOWED_ACTIONS.has(asText(payload.action))) throw createHttpError("action is not allowed");
  if (payload.keyField && !["profileId", "applicationId", "reviewId", "wishId"].includes(asText(payload.keyField))) {
    throw createHttpError("keyField is not allowed");
  }
  return source;
}

function validateMember(payload) {
  assertTextLength(getValue(payload, "member.memberName"), "member.memberName", MAX_STRING_LENGTHS.name);
  assertTextLength(getValue(payload, "member.memberId"), "member.memberId", MAX_STRING_LENGTHS.short);
  assertTextLength(getValue(payload, "member.memberSeq"), "member.memberSeq", MAX_STRING_LENGTHS.short);
  assertTextLength(getValue(payload, "member.memberEmail"), "member.memberEmail", MAX_STRING_LENGTHS.email);
  const mobile = getValue(payload, "member.memberMobile");
  if (mobile) assertPhone(mobile, "member.memberMobile");
}

function validateApplicationPayload(payload, options = {}) {
  validateMember(payload);
  assertTextLength(getValue(payload, "applicant.name"), "applicant.name", MAX_STRING_LENGTHS.name, { required: true });
  assertPhone(getValue(payload, "applicant.phone"), "applicant.phone");
  assertBirthYear(getValue(payload, "applicant.birthYear"), "applicant.birthYear", { required: true });
  assertAllowedValue(getValue(payload, "applicant.gender"), "applicant.gender", ALLOWED_GENDERS, { required: true });
  assertTextLength(getValue(payload, "applicant.level"), "applicant.level", MAX_STRING_LENGTHS.short);
  assertNumberRange(getValue(payload, "applicant.people") || 1, "applicant.people", 1, 8);
  assertList(getValue(payload, "applicant.styles"), "applicant.styles", { required: true, maxItems: 3, maxTextLength: 40 });
  assertList(getValue(payload, "applicant.memberPreferences") || getValue(payload, "applicant.preferredMemberComposition"), "applicant.memberPreferences", { maxItems: 3, maxTextLength: 40 });
  assertTextLength(getValue(payload, "applicant.profession"), "applicant.profession", 80);
  assertTextLength(getValue(payload, "applicant.greeting"), "applicant.greeting", 120);
  assertBooleanTrue(getValue(payload, "agreements.required"), "agreements.required");

  if (Array.isArray(getValue(payload, "applicant.companions")) && getValue(payload, "applicant.companions").length > 7) {
    throw createHttpError("applicant.companions has too many items");
  }
  if (options.requireTrip) {
    assertTextLength(getValue(payload, "trip.region") || normalizeList(getValue(payload, "trip.regions")).join(","), "trip.region", MAX_STRING_LENGTHS.medium, { required: true });
  } else {
    assertTextLength(getValue(payload, "product.productName") || payload.productName, "product.productName", MAX_STRING_LENGTHS.medium, { required: true });
  }
}

function validateMemberProfilePayload(payload) {
  validateMember(payload);
  assertTextLength(getValue(payload, "member.memberName"), "member.memberName", MAX_STRING_LENGTHS.name, { required: true });
  assertPhone(getValue(payload, "member.memberMobile"), "member.memberMobile");
  assertBirthYear(getValue(payload, "profile.birthYear"), "profile.birthYear", { required: true });
  assertAllowedValue(getValue(payload, "profile.gender"), "profile.gender", ALLOWED_GENDERS, { required: true });
  assertTextLength(getValue(payload, "profile.level"), "profile.level", MAX_STRING_LENGTHS.short, { required: true });
  assertList(getValue(payload, "profile.travelStyles"), "profile.travelStyles", { required: true, maxItems: 5, maxTextLength: 40 });
  assertTextLength(getValue(payload, "profile.profession"), "profile.profession", 80);
  assertBooleanTrue(getValue(payload, "profile.requiredAgreed"), "profile.requiredAgreed");
  assertSafeGcsImageUrl(getValue(payload, "profile.profileImageUrl"), "profile.profileImageUrl", [
    "golfjoin_uploads/photos/profiles",
    "golfjoin_uploads/profiles",
    "golfjoin_uploads/photos"
  ]);
  assertTextLength(getValue(payload, "profile.profileImageObjectName"), "profile.profileImageObjectName", MAX_STRING_LENGTHS.url);
}

function validateReviewPayload(payload) {
  validateMember(payload);
  assertTextLength(getValue(payload, "member.memberName"), "member.memberName", MAX_STRING_LENGTHS.name, { required: true });
  const mobile = getValue(payload, "member.memberMobile");
  if (mobile) assertPhone(mobile, "member.memberMobile");
  assertTextLength(getValue(payload, "product.productName") || payload.productName, "product.productName", MAX_STRING_LENGTHS.medium, { required: true });
  assertNumberRange(payload.rating || getValue(payload, "review.rating"), "rating", 1, 5);
  assertList(payload.tags || getValue(payload, "review.tags"), "tags", { maxItems: 6, maxTextLength: 30 });
  assertTextLength(payload.reviewText || getValue(payload, "review.text"), "reviewText", MAX_STRING_LENGTHS.long, { required: true });
  if (asText(payload.reviewText || getValue(payload, "review.text")).length < 20) {
    throw createHttpError("reviewText is too short");
  }
  const reviewImagePrefixes = [
    "golfjoin_uploads/photos/reviews",
    "golfjoin_uploads/reviews"
  ];
  assertSafeGcsImageUrl(payload.imageUrl || getValue(payload, "review.imageUrl"), "imageUrl", reviewImagePrefixes);
  assertSafeGcsImageUrl(payload.thumbnailUrl || getValue(payload, "review.thumbnailUrl"), "thumbnailUrl", reviewImagePrefixes);
  const images = parseImages(payload);
  if (images.length > 3) throw createHttpError("review.images has too many items");
  images.forEach((image, index) => {
    assertSafeGcsImageUrl(image.imageUrl || image.url, `review.images[${index}].imageUrl`, reviewImagePrefixes);
    assertSafeGcsImageUrl(image.thumbnailUrl || image.thumbnail, `review.images[${index}].thumbnailUrl`, reviewImagePrefixes);
  });
}

function validateWishPayload(payload) {
  validateMember(payload);
  const memberSeq = asText(getValue(payload, "member.memberSeq"));
  const memberId = asText(getValue(payload, "member.memberId"));
  const memberMobile = asText(getValue(payload, "member.memberMobile"));
  if (!memberSeq && !memberId && !memberMobile) {
    throw createHttpError("member identity is required");
  }
  if (memberMobile) assertPhone(memberMobile, "member.memberMobile");
  const targetType = assertAllowedValue(payload.targetType || getValue(payload, "target.type"), "targetType", new Set(["product", "join_schedule"]), { required: true });
  assertTextLength(payload.targetKey || getValue(payload, "target.targetKey") || getValue(payload, "target.key"), "targetKey", MAX_STRING_LENGTHS.short, { required: true });
  assertTextLength(payload.wishId, "wishId", MAX_STRING_LENGTHS.short, { required: true });
  assertAllowedValue(payload.status || "active", "status", new Set(["active", "deleted"]), { required: true });
  if (targetType === "product") {
    assertTextLength(getValue(payload, "product.erpProductId") || payload.erpProductId || payload.goodSeq, "product.erpProductId", MAX_STRING_LENGTHS.short, { required: true });
  }
  assertTextLength(getValue(payload, "product.productName") || payload.productName, "product.productName", MAX_STRING_LENGTHS.medium);
  assertTextLength(getValue(payload, "product.imageUrl") || payload.imageUrl, "product.imageUrl", MAX_STRING_LENGTHS.url);
}

function validateWritePayload(payload) {
  const source = assertWriteSourceAndSheet(payload);
  assertTextLength(payload.pageUrl, "pageUrl", MAX_STRING_LENGTHS.url);
  assertTextLength(payload.adminMemo, "adminMemo", MAX_STRING_LENGTHS.medium);
  if (source === "new_schedule_builder") {
    validateApplicationPayload(payload, { requireTrip: true });
    return;
  }
  if (source === "join_apply") {
    validateApplicationPayload(payload, { requireTrip: false });
    return;
  }
  if (source === "join_member_profile") {
    validateMemberProfilePayload(payload);
    return;
  }
  if (source === "join_review") {
    validateReviewPayload(payload);
    return;
  }
  if (source === "join_wish") {
    validateWishPayload(payload);
  }
}

function buildSheetReadUrl(query = {}) {
  const target = new URL(SHEET_WEB_APP_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === "") return;
    target.searchParams.set(key, String(value));
  });
  const sheet = normalizeSheetName(target.searchParams.get("sheet") || "");
  if (sheet && !ALLOWED_READ_SHEETS.has(sheet)) {
    const error = new Error("Sheet is not allowed");
    error.status = 400;
    throw error;
  }
  return target;
}

async function proxyGet(req, res) {
  const target = buildSheetReadUrl(req.query || {});
  const response = await fetch(target, {
    method: "GET",
    headers: { "Accept": "application/json" },
    redirect: "follow"
  });
  const text = await response.text();
  res.status(response.status);
  res.set("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
  res.send(text);
}

async function proxyPost(req, res) {
  const rawLength = Number(req.headers["content-length"] || 0);
  if (rawLength > MAX_POST_BYTES) {
    const error = new Error("Payload too large");
    error.status = 413;
    throw error;
  }
  const payload = readBody(req);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Invalid payload");
    error.status = 400;
    throw error;
  }
  validateWritePayload(payload);
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body, "utf8") > MAX_POST_BYTES) {
    const error = new Error("Payload too large");
    error.status = 413;
    throw error;
  }
  const response = await fetch(SHEET_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body,
    redirect: "follow"
  });
  const text = await response.text();
  res.status(response.status);
  res.set("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
  res.send(text);
}

exports.proxyGoogleSheet = async (req, res) => {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    assertRequestAllowed(req);
    if (req.method === "GET") {
      await proxyGet(req, res);
      return;
    }
    if (req.method === "POST") {
      await proxyPost(req, res);
      return;
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Request failed" });
  }
};
