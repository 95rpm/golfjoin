"use strict";

const crypto = require("crypto");

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
const PUBLIC_READ_SHEETS = new Set([
  "new_schedule_applications",
  "join_applications",
  "join_reviews",
  "schedule_participant_summary",
  "product_display_rules"
]);
const ADMIN_READ_TOKEN = String(process.env.ADMIN_READ_TOKEN || "").trim();
const ADMIN_LOGIN_ID = String(process.env.ADMIN_LOGIN_ID || "").trim();
const ADMIN_LOGIN_PASSWORD = String(process.env.ADMIN_LOGIN_PASSWORD || "").trim();
const ADMIN_LOGIN_PASSWORD_SHA256 = String(process.env.ADMIN_LOGIN_PASSWORD_SHA256 || "").trim().toLowerCase();
const ADMIN_SESSION_TTL_SECONDS = Number(process.env.ADMIN_SESSION_TTL_SECONDS || 60 * 60);
const WRITE_TOKEN = String(process.env.WRITE_TOKEN || "").trim();
const ALIGO_USERID = String(process.env.ALIGO_USERID || "").trim();
const ALIGO_APIKEY = String(process.env.ALIGO_APIKEY || "").trim();
const ALIGO_SENDERKEY = String(process.env.ALIGO_SENDERKEY || "").trim();
const ALIGO_SENDER = String(process.env.ALIGO_SENDER || process.env.SENDER || "0234461119").trim();
const ALIGO_TESTMODE = String(process.env.ALIGO_TESTMODE || process.env.TESTMODE || "N").trim();
const ALIGO_ENABLED = String(process.env.ALIGO_ENABLED || "N").trim().toUpperCase() === "Y";
const GOLFJOIN_MY_PAGE_PC_URL = String(process.env.GOLFJOIN_MY_PAGE_PC_URL || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1&golfjoinOpen=my").trim();
const GOLFJOIN_MY_PAGE_MO_URL = String(process.env.GOLFJOIN_MY_PAGE_MO_URL || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1&golfjoinOpen=my").trim();
const ALIGO_ALIMTALK_SEND_URL = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";
const GOLFJOIN_ALIMTALK_TEMPLATES = {
  create: {
    code: "UI_9393",
    templateName: "조인생성완료_이미지형",
    subject: "[시크릿투어 조인모임 개설안내]",
    body: `[시크릿투어 조인모임 개설안내]

#{고객명}님, 안녕하세요.
시크릿투어 골프조인입니다.

조인모임 개설 신청이 완료되었어요.

담당자 배정 후 예약 및 견적 안내를 드릴 예정입니다. 잠시만 기다려주세요.

■ 신청 정보
- 상품명: #{상품명}
- 지역: #{지역}
- 출발일: #{출발일}
- 도착일: #{도착일}
- 신청 인원: #{인원}

■ 여행 문의
TEL : 02-3446-1119
월~금 09:00~18:00 (토/일/공휴일 제외)
채팅으로 문의하기:
http://pf.kakao.com/_lRbYxj/chat

■ 홈페이지
https://www.secret-tour.com`
  },
  join: {
    code: "UI_9389",
    templateName: "조인참여완료_이미지형",
    subject: "[시크릿투어 조인모임 참여안내]",
    body: `[시크릿투어 조인모임 참여안내]

#{고객명}님, 안녕하세요.
시크릿투어 골프조인입니다.

조인모임 참여 신청이 완료되었어요.

담당자 배정 후 예약 및 견적 안내를 드릴 예정입니다. 잠시만 기다려주세요.

■ 신청 정보
- 상품명: #{상품명}
- 지역: #{지역}
- 출발일: #{출발일}
- 도착일: #{도착일}
- 신청 인원: #{인원}

■ 여행 문의
TEL : 02-3446-1119
월~금 09:00~18:00 (토/일/공휴일 제외)
채팅으로 문의하기:
http://pf.kakao.com/_lRbYxj/chat

■ 홈페이지
https://www.secret-tour.com`
  },
  complete: {
    code: "UI_9395",
    templateName: "조인모집완료_이미지형",
    subject: "[시크릿투어 조인모임 모집완료 안내]",
    body: `[시크릿투어 조인모임 모집완료 안내]

#{고객명}님, 안녕하세요.
시크릿투어 골프조인입니다.

신청하신 조인모임 일정의 인원 모집이 완료되었어요.

담당자 배정 후 예약 및 잔금 안내를 드릴 예정입니다. 잠시만 기다려주세요.

■ 일정 정보
- 상품명: #{상품명}
- 지역: #{지역}
- 출발일: #{출발일}
- 도착일: #{도착일}
- 모집 인원: #{모집인원}

■ 여행 문의
TEL : 02-3446-1119
월~금 09:00~18:00 (토/일/공휴일 제외)
채팅으로 문의하기:
http://pf.kakao.com/_lRbYxj/chat

■ 홈페이지
https://www.secret-tour.com`
  }
};

const ALLOWED_WRITE_SHEETS_BY_SOURCE = {
  new_schedule_builder: "new_schedule_applications",
  join_apply: "join_applications",
  join_member_profile: "join_member_profiles",
  join_review: "join_reviews",
  join_wish: "join_wishes"
};
const ALLOWED_ACTIONS = new Set(["", "upsert"]);
const ADMIN_STATUS_UPDATE_FIELDS = new Set([
  "participantStatus",
  "quoteStatus",
  "depositStatus",
  "balanceStatus",
  "refundStatus",
  "applicationStatus",
  "adminMemo"
]);
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
const SECRET_TOUR_PUBLIC_ORIGIN = "https://www.secret-tour.com";
const MAX_SECRET_TOUR_HTML_BYTES = Number(process.env.MAX_SECRET_TOUR_HTML_BYTES || 1024 * 1024 * 2);
const EXTERNAL_FETCH_TIMEOUT_MS = Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS || 15000);

function getAllowedOrigin(origin = "") {
  if (!origin) return "";
  if (ALLOWED_ORIGINS.includes("*")) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

async function fetchWithTimeout(url, options = {}, timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getHeader(req, name) {
  return String(req.headers[name.toLowerCase()] || "").trim();
}

function safeEqual(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256(value = "") {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function base64UrlEncode(value) {
  return Buffer.from(String(value), "utf8").toString("base64url");
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseBase64UrlJson(value = "") {
  return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
}

function hmacSha256(value = "") {
  return crypto.createHmac("sha256", ADMIN_READ_TOKEN).update(String(value), "utf8").digest("base64url");
}

function isAdminLoginValid(loginId = "", loginPassword = "") {
  if (!ADMIN_LOGIN_ID || !loginId || !loginPassword || !safeEqual(loginId, ADMIN_LOGIN_ID)) return false;
  if (ADMIN_LOGIN_PASSWORD_SHA256) return safeEqual(sha256(loginPassword), ADMIN_LOGIN_PASSWORD_SHA256);
  return Boolean(ADMIN_LOGIN_PASSWORD && safeEqual(loginPassword, ADMIN_LOGIN_PASSWORD));
}

function createAdminSessionToken(loginId = "") {
  if (!ADMIN_READ_TOKEN) {
    const error = new Error("ADMIN_READ_TOKEN is required for admin sessions");
    error.status = 500;
    throw error;
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlJson({
    sub: loginId,
    iat: now,
    exp: now + Math.max(60, ADMIN_SESSION_TTL_SECONDS)
  });
  return `admin.${payload}.${hmacSha256(payload)}`;
}

function isAdminSessionTokenValid(token = "") {
  const parts = String(token).split(".");
  if (parts.length !== 3 || parts[0] !== "admin" || !ADMIN_READ_TOKEN) return false;
  const [, payload, signature] = parts;
  if (!safeEqual(signature, hmacSha256(payload))) return false;
  try {
    const parsed = parseBase64UrlJson(payload);
    if (parsed.sub !== ADMIN_LOGIN_ID) return false;
    return Number(parsed.exp || 0) > Math.floor(Date.now() / 1000);
  } catch (error) {
    return false;
  }
}

function isAdminReadRequest(req) {
  const token = getHeader(req, "x-golfjoin-admin-token");
  if (ADMIN_READ_TOKEN && safeEqual(token, ADMIN_READ_TOKEN)) return true;
  return isAdminSessionTokenValid(token);
}

function hasAdminReadAuthConfigured() {
  return Boolean(ADMIN_READ_TOKEN && ADMIN_LOGIN_ID && (ADMIN_LOGIN_PASSWORD || ADMIN_LOGIN_PASSWORD_SHA256));
}

function isWriteRequestAuthorized(req) {
  return !WRITE_TOKEN || getHeader(req, "x-golfjoin-write-token") === WRITE_TOKEN;
}

function resolveReadSheetAlias(sheet = "") {
  const requested = normalizeSheetName(sheet);
  const aliases = {
    new_schedule: "new_schedule_applications",
    builder: "new_schedule_applications",
    join: "join_applications",
    join_member_profile: "join_member_profiles",
    member_profiles: "join_member_profiles",
    join_review: "join_reviews",
    reviews: "join_reviews",
    join_wish: "join_wishes",
    wishes: "join_wishes",
    summary: "schedule_participant_summary",
    display_rules: "product_display_rules"
  };
  return aliases[requested] || requested;
}

function maskName(value = "") {
  const text = asText(value);
  if (!text) return "";
  if (text.length === 1) return `${text}**`;
  return `${text.charAt(0)}${"*".repeat(Math.min(2, text.length - 1))}`;
}

function maskPhone(value = "") {
  const digits = normalizePhone(value);
  if (!digits) return "";
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function sanitizePublicRow(row = {}) {
  return Object.entries(row).reduce((object, [key, value]) => {
    const lowerKey = String(key || "").toLowerCase();
    if (
      lowerKey.includes("email") ||
      lowerKey.includes("memo") ||
      lowerKey.includes("kakao") ||
      lowerKey === "memberid" ||
      lowerKey === "memberseq" ||
      lowerKey === "profileimageobjectname" ||
      lowerKey === "imagesjson"
    ) {
      return object;
    }
    if (lowerKey.includes("mobile") || lowerKey.includes("phone")) {
      object[key] = maskPhone(value);
      return object;
    }
    if (["membername", "applicantname", "creatorname", "participantnames"].includes(lowerKey)) {
      object[key] = String(value || "")
        .split(",")
        .map((name) => maskName(name))
        .filter(Boolean)
        .join(", ");
      return object;
    }
    object[key] = value;
    return object;
  }, {});
}

function sanitizePublicPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map(sanitizePublicRow);
  const next = { ...payload };
  if (Array.isArray(next.rows)) next.rows = next.rows.map(sanitizePublicRow);
  if (Array.isArray(next.items)) next.items = next.items.map(sanitizePublicRow);
  if (next.sheets && typeof next.sheets === "object") {
    next.sheets = Object.entries(next.sheets).reduce((sheets, [sheetName, rows]) => {
      if (!PUBLIC_READ_SHEETS.has(resolveReadSheetAlias(sheetName))) return sheets;
      sheets[sheetName] = Array.isArray(rows) ? rows.map(sanitizePublicRow) : rows;
      return sheets;
    }, {});
  }
  next.publicRedacted = true;
  return next;
}

function setCorsHeaders(req, res) {
  const origin = getAllowedOrigin(req.headers.origin || "");
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "false");
  }
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Golfjoin-Admin-Token, X-Golfjoin-Admin-Id, X-Golfjoin-Admin-Password, X-Golfjoin-Write-Token");
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

function getNumberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getApplicantPeople(payload = {}) {
  return Math.max(1, getNumberValue(getValue(payload, "applicant.people"), 1));
}

function formatAlimtalkPeople(value) {
  return `${Math.max(1, getNumberValue(value, 1))}명`;
}

function formatAlimtalkDate(value = "") {
  const text = asText(value);
  if (!text) return "";
  const dateMatch = text.match(/(\d{4})\D?(\d{2})\D?(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const normalized = `${year}-${month}-${day}`;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    if (!Number.isNaN(date.getTime())) return `${normalized}(${weekdays[date.getUTCDay()]})`;
    return normalized;
  }
  return text;
}

function firstText(...values) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function normalizeRegionText(value = "") {
  return asText(value).replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ");
}

function formatAlimtalkRegion(country = "", region = "") {
  const countryText = normalizeRegionText(country);
  const regionText = normalizeRegionText(region);
  if (!countryText && !regionText) return "-";
  if (!countryText) {
    const parts = regionText.split(",").map(asText).filter(Boolean);
    if (parts.length >= 2) return [parts.slice(1).join(" "), parts[0]].filter(Boolean).join(" ");
    return regionText;
  }
  if (!regionText || regionText === countryText) return countryText;
  const parts = regionText.split(",").map(asText).filter(Boolean);
  const regionName = parts.length >= 2 && parts[parts.length - 1] === countryText
    ? parts.slice(0, -1).join(" ")
    : regionText.replace(countryText, "").trim();
  return [countryText, regionName || regionText].filter(Boolean).join(" ");
}

function buildMyPageUrl(baseUrl = "") {
  const url = new URL(baseUrl);
  url.searchParams.set("golfjoinOpen", "my");
  return url.toString();
}

function getAlimtalkButtons() {
  return JSON.stringify({
    button: [
      {
        name: "채널추가",
        linkType: "AC",
        linkTypeName: "채널 추가"
      },
      {
        name: "조인 모임 확인하기",
        linkType: "WL",
        linkTypeName: "웹링크",
        linkPc: buildMyPageUrl(GOLFJOIN_MY_PAGE_PC_URL),
        linkMo: buildMyPageUrl(GOLFJOIN_MY_PAGE_MO_URL)
      }
    ]
  });
}

function getAlimtalkTripInfo(payload = {}, summary = {}) {
  const isBuilder = asText(payload.source) === "new_schedule_builder";
  const country = firstText(
    getValue(payload, "trip.country"),
    getValue(payload, "product.country"),
    payload.country,
    summary.country
  );
  const region = firstText(
    getValue(payload, "trip.region"),
    getValue(payload, "product.region"),
    getValue(payload, "product.countryRegion"),
    payload.region,
    summary.region,
    summary.country
  );
  return {
    customerName: firstText(getValue(payload, "applicant.name"), getValue(payload, "member.memberName"), summary.creatorName, "고객"),
    phone: normalizePhone(getValue(payload, "applicant.phone") || getValue(payload, "member.memberMobile")),
    productName: firstText(getValue(payload, "trip.productName"), getValue(payload, "product.productName"), payload.productName, summary.title, "골프조인 상품"),
    region: formatAlimtalkRegion(country, region),
    departureDate: formatAlimtalkDate(firstText(
      isBuilder ? getValue(payload, "trip.startSummary") : getValue(payload, "product.departureDate"),
      summary.departureSummary,
      getValue(payload, "trip.departureDates.0")
    )),
    returnDate: formatAlimtalkDate(firstText(
      isBuilder ? getValue(payload, "trip.endSummary") : getValue(payload, "product.returnDate"),
      summary.returnSummary,
      getValue(payload, "trip.returnDates.0")
    )),
    people: formatAlimtalkPeople(getApplicantPeople(payload))
  };
}

function buildGolfjoinAlimtalkMessage(type, info = {}) {
  const template = GOLFJOIN_ALIMTALK_TEMPLATES[type];
  return template.body
    .replaceAll("#{고객명}", info.customerName || "고객")
    .replaceAll("#{상품명}", info.productName || "-")
    .replaceAll("#{지역}", info.region || "-")
    .replaceAll("#{출발일}", info.departureDate || "-")
    .replaceAll("#{도착일}", info.returnDate || "-")
    .replaceAll("#{모집인원}", info.people || "-")
    .replaceAll("#{인원}", info.people || "-");
}

function isAlimtalkConfigured() {
  return Boolean(ALIGO_ENABLED && ALIGO_USERID && ALIGO_APIKEY && ALIGO_SENDERKEY && ALIGO_SENDER);
}

async function sendGolfjoinAlimtalk(type, info = {}) {
  const template = GOLFJOIN_ALIMTALK_TEMPLATES[type];
  const receiver = normalizePhone(info.phone);
  if (!template || !receiver || !isAlimtalkConfigured()) {
    return { skipped: true, reason: !receiver ? "receiver is empty" : "aligo is not configured" };
  }
  const message = buildGolfjoinAlimtalkMessage(type, info);
  const body = new URLSearchParams({
    apikey: ALIGO_APIKEY,
    userid: ALIGO_USERID,
    senderkey: ALIGO_SENDERKEY,
    tpl_code: template.code,
    sender: ALIGO_SENDER,
    receiver_1: receiver,
    subject_1: template.templateName || template.subject,
    message_1: message,
    button_1: getAlimtalkButtons(),
    testMode: ALIGO_TESTMODE,
    failover: "Y",
    fmessage_1: message
  });
  const response = await fetchWithTimeout(ALIGO_ALIMTALK_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    redirect: "follow"
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch (error) {
    payload = { raw: text };
  }
  if (!response.ok || String(payload.code || "").startsWith("-")) {
    return { ok: false, status: response.status, response: payload };
  }
  return { ok: true, status: response.status, response: payload };
}

function splitNamesAndPhones(names = "", phones = "") {
  const nameList = asText(names).split(",").map(asText);
  return asText(phones)
    .split(",")
    .map(normalizePhone)
    .filter(Boolean)
    .map((phone, index) => ({
      phone,
      customerName: nameList[index] || "고객"
    }));
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
    assertAllowedValue(getValue(payload, "trip.packType"), "trip.packType", new Set(["air", "golf"]));
    assertTextLength(getValue(payload, "trip.packTypeName"), "trip.packTypeName", MAX_STRING_LENGTHS.short);
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

function validateAdminStatusUpdatePayload(payload = {}) {
  const sheet = asText(payload.sheet);
  if (!["new_schedule_applications", "join_applications"].includes(sheet)) {
    throw createHttpError("sheet is not allowed");
  }
  if (asText(payload.keyField || "applicationId") !== "applicationId") {
    throw createHttpError("keyField is not allowed");
  }
  assertTextLength(payload.keyValue, "keyValue", MAX_STRING_LENGTHS.short, { required: true });
  if (!payload.fields || typeof payload.fields !== "object" || Array.isArray(payload.fields)) {
    throw createHttpError("fields is required");
  }
  Object.entries(payload.fields).forEach(([field, value]) => {
    if (!ADMIN_STATUS_UPDATE_FIELDS.has(field)) throw createHttpError(`${field} is not allowed`);
    assertTextLength(value, field, MAX_STRING_LENGTHS.medium);
  });
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

async function readSheetRowsDirect(query = {}) {
  const target = buildSheetReadUrl(query);
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: { "Accept": "application/json" },
    redirect: "follow"
  });
  const text = await response.text();
  if (!response.ok) throw createHttpError(`Sheet read failed: ${response.status}`, response.status);
  const payload = JSON.parse(text || "{}");
  return Array.isArray(payload) ? payload : (payload.items || payload.rows || payload.applications || []);
}

async function readScheduleSummary(scheduleId = "") {
  const key = asText(scheduleId);
  if (!key) return null;
  const rows = await readSheetRowsDirect({
    sheet: "schedule_participant_summary",
    scheduleId: key,
    limit: "1",
    refreshSummary: "true"
  });
  return rows[0] || null;
}

async function sendGolfjoinApplicationNotifications(payload = {}, beforeSummary = null, afterSummary = null) {
  const source = asText(payload.source);
  const results = [];
  if (source === "new_schedule_builder") {
    results.push({
      type: "create",
      result: await sendGolfjoinAlimtalk("create", getAlimtalkTripInfo(payload, afterSummary || {}))
    });
  } else if (source === "join_apply") {
    results.push({
      type: "join",
      result: await sendGolfjoinAlimtalk("join", getAlimtalkTripInfo(payload, afterSummary || {}))
    });
  }

  const beforePeople = getNumberValue(beforeSummary?.confirmedPeople, 0);
  const afterPeople = getNumberValue(afterSummary?.confirmedPeople, 0);
  const capacity = getNumberValue(afterSummary?.capacity, 4) || 4;
  if (afterSummary && beforePeople < capacity && afterPeople >= capacity) {
    const recipients = splitNamesAndPhones(afterSummary.participantNames, afterSummary.participantPhones);
    const country = firstText(afterSummary.country, getValue(payload, "trip.country"), getValue(payload, "product.country"), payload.country);
    const region = firstText(afterSummary.region, getValue(payload, "trip.region"), getValue(payload, "product.region"), getValue(payload, "product.countryRegion"), payload.region);
    const baseInfo = {
      productName: firstText(afterSummary.title, getValue(payload, "trip.productName"), getValue(payload, "product.productName"), "골프조인 상품"),
      region: formatAlimtalkRegion(country, region),
      departureDate: formatAlimtalkDate(afterSummary.departureSummary),
      returnDate: formatAlimtalkDate(afterSummary.returnSummary),
      people: formatAlimtalkPeople(capacity)
    };
    for (const recipient of recipients) {
      results.push({
        type: "complete",
        phone: maskPhone(recipient.phone),
        result: await sendGolfjoinAlimtalk("complete", { ...baseInfo, ...recipient })
      });
    }
  }
  return results;
}

function sendGolfjoinApplicationNotificationsInBackground(payload = {}, notificationScheduleId = "", requestId = "") {
  if (!ALIGO_ENABLED || !(asText(payload.source) === "new_schedule_builder" || asText(payload.source) === "join_apply")) return;
  setImmediate(async () => {
    try {
      const source = asText(payload.source);
      let beforeSummary = null;
      let afterSummary = null;
      if (source === "join_apply" && notificationScheduleId) {
        afterSummary = await readScheduleSummary(notificationScheduleId);
        beforeSummary = afterSummary
          ? {
              ...afterSummary,
              confirmedPeople: Math.max(0, getNumberValue(afterSummary.confirmedPeople, 0) - getApplicantPeople(payload))
            }
          : null;
      }
      const notifications = await sendGolfjoinApplicationNotifications(payload, beforeSummary, afterSummary);
      console.log("golfjoin alimtalk background completed", { requestId, source, notifications });
    } catch (error) {
      console.warn("Failed to send golfjoin alimtalk notification in background.", {
        requestId,
        source: asText(payload.source),
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  });
}

function sanitizeMemberProfileLookupRow(row = {}) {
  return {
    profileId: asText(row.profileId),
    gender: asText(row.gender),
    birthYear: asText(row.birthYear || row.birthday),
    profession: asText(row.profession),
    level: asText(row.level),
    travelStyles: asText(row.travelStyles || row.styles),
    profileImageUrl: asText(row.profileImageUrl),
    profileThumbnailUrl: asText(row.profileThumbnailUrl || row.profileImageUrl),
    profileImageObjectName: asText(row.profileImageObjectName),
    profileImageMimeType: asText(row.profileImageMimeType),
    profileImageSize: asText(row.profileImageSize),
    updatedAt: asText(row.updatedAt || row.submittedAt)
  };
}

function sanitizeJoinWishLookupRow(row = {}) {
  return {
    wishId: asText(row.wishId),
    createdAt: asText(row.createdAt),
    savedAt: asText(row.savedAt || row.createdAt),
    updatedAt: asText(row.updatedAt),
    status: asText(row.status || "active"),
    targetType: asText(row.targetType || row.wishType),
    wishType: asText(row.wishType || row.targetType),
    targetKey: asText(row.targetKey),
    targetScheduleId: asText(row.targetScheduleId || row.scheduleId),
    targetApplicationId: asText(row.targetApplicationId || row.sourceApplicationId),
    scheduleId: asText(row.scheduleId || row.targetScheduleId),
    sourceApplicationId: asText(row.sourceApplicationId || row.targetApplicationId),
    erpProductId: asText(row.erpProductId || row.productId || row.goodSeq),
    erpEventSeq: asText(row.erpEventSeq || row.eventSeq),
    productName: asText(row.productName || row.title),
    title: asText(row.title || row.productName),
    departureDate: asText(row.departureDate),
    returnDate: asText(row.returnDate),
    category: asText(row.category),
    region: asText(row.region),
    imageUrl: asText(row.imageUrl || row.image),
    image: asText(row.image || row.imageUrl),
    price: asText(row.price)
  };
}

async function proxyMemberProfileLookup(params, res) {
  const memberSeq = asText(params?.memberSeq);
  const memberId = asText(params?.memberId);
  const memberMobile = normalizePhone(params?.memberMobile || params?.phone);
  const memberEmail = asText(params?.memberEmail || params?.email);
  const kakaoId = asText(params?.kakaoId);
  if (!memberSeq && !memberId && !memberMobile && !memberEmail && !kakaoId) {
    res.status(200).json({ items: [], rows: [] });
    return;
  }
  if (memberEmail) assertTextLength(memberEmail, "memberEmail", MAX_STRING_LENGTHS.email);
  if (kakaoId) assertTextLength(kakaoId, "kakaoId", MAX_STRING_LENGTHS.short);

  const target = buildSheetReadUrl({
    sheet: "join_member_profiles",
    source: "join_member_profile",
    limit: "1",
    memberSeq,
    memberId,
    memberMobile,
    memberEmail,
    kakaoId
  });
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: { "Accept": "application/json" },
    redirect: "follow"
  });
  const text = await response.text();
  if (!response.ok) {
    res.status(response.status);
    res.set("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(text);
    return;
  }
  const payload = JSON.parse(text || "{}");
  const rows = Array.isArray(payload) ? payload : (payload.items || payload.rows || []);
  const sanitized = rows.slice(0, 1).map(sanitizeMemberProfileLookupRow);
  res.status(200).json({ items: sanitized, rows: sanitized });
}

async function proxyJoinWishesLookup(params, res) {
  const memberSeq = asText(params?.memberSeq);
  const memberId = asText(params?.memberId);
  const memberMobile = normalizePhone(params?.memberMobile || params?.phone);
  const rows = await readJoinWishesForMember({ memberSeq, memberId, memberMobile, limit: params?.limit });
  const sanitized = rows.map(sanitizeJoinWishLookupRow);
  res.status(200).json({ items: sanitized, rows: sanitized });
}

async function readJoinWishesForMember(params = {}) {
  const memberSeq = asText(params?.memberSeq);
  const memberId = asText(params?.memberId);
  const memberMobile = normalizePhone(params?.memberMobile || params?.phone);
  if (!memberMobile || (!memberSeq && !memberId)) return [];
  const target = buildSheetReadUrl({
    sheet: "join_wishes",
    source: "join_wish",
    status: "active",
    limit: Math.min(Math.max(Number(params?.limit || 200), 1), 200),
    memberSeq,
    memberId,
    memberMobile
  });
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: { "Accept": "application/json" },
    redirect: "follow"
  });
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Join wishes lookup failed: ${response.status}`, response.status);
  }
  const payload = JSON.parse(text || "{}");
  return Array.isArray(payload) ? payload : (payload.items || payload.rows || []);
}

async function readHomeBootstrapPart(key, reader) {
  try {
    return { key, rows: await reader() };
  } catch (error) {
    return { key, rows: [], warning: error?.message || `${key} failed` };
  }
}

async function proxyHomeBootstrap(params, res) {
  const memberSeq = asText(params?.memberSeq);
  const memberId = asText(params?.memberId);
  const memberMobile = normalizePhone(params?.memberMobile || params?.phone);
  const parts = await Promise.all([
    readHomeBootstrapPart("newSchedules", () => readSheetRowsDirect({
      sheet: "new_schedule_applications",
      source: "new_schedule_builder",
      limit: Math.min(Math.max(Number(params?.newScheduleLimit || 100), 1), 100)
    }).then((rows) => rows.map(sanitizePublicRow))),
    readHomeBootstrapPart("joinApplications", () => readSheetRowsDirect({
      sheet: "join_applications",
      source: "join_apply",
      limit: Math.min(Math.max(Number(params?.joinApplicationLimit || 50), 1), 100)
    }).then((rows) => rows.map(sanitizePublicRow))),
    readHomeBootstrapPart("reviews", () => readSheetRowsDirect({
      sheet: "join_reviews",
      source: "join_review",
      status: "visible",
      limit: Math.min(Math.max(Number(params?.reviewLimit || 200), 1), 200)
    }).then((rows) => rows.map(sanitizePublicRow))),
    readHomeBootstrapPart("wishes", async () => {
      const rows = await readJoinWishesForMember({
        memberSeq,
        memberId,
        memberMobile,
        limit: Math.min(Math.max(Number(params?.wishLimit || 200), 1), 200)
      });
      return rows.map(sanitizeJoinWishLookupRow);
    })
  ]);
  const payload = parts.reduce((object, part) => {
    object[part.key] = part.rows;
    if (part.warning) object.warnings.push({ key: part.key, message: part.warning });
    return object;
  }, {
    newSchedules: [],
    joinApplications: [],
    reviews: [],
    wishes: [],
    warnings: []
  });
  res.status(200).json(payload);
}

function assertDigits(value, field) {
  const text = asText(value);
  if (!/^\d+$/.test(text)) throw createHttpError(`${field} is invalid`);
  return text;
}

function buildSecretTourGoodsViewProxyUrl(query = {}) {
  const goodSeq = assertDigits(query.goodSeq, "goodSeq");
  const eventSeq = assertDigits(query.eventSeq, "eventSeq");
  const target = new URL("/goods/goods_view", SECRET_TOUR_PUBLIC_ORIGIN);
  target.searchParams.set("goodSeq", goodSeq);
  target.searchParams.set("eventSeq", eventSeq);
  return target;
}

function buildSecretTourFlightScheduleProxyUrl(query = {}) {
  const eventSeq = assertDigits(query.eventSeq, "eventSeq");
  const goodTransportSeq = assertDigits(query.goodTransportSeq, "goodTransportSeq");
  const target = new URL("/goods/add/flight_schedule", SECRET_TOUR_PUBLIC_ORIGIN);
  target.searchParams.set("eventSeq", eventSeq);
  target.searchParams.set("goodTransportSeq", goodTransportSeq);
  if (query.startDay) target.searchParams.set("startDay", assertDigits(query.startDay, "startDay"));
  if (query.endDay) target.searchParams.set("endDay", assertDigits(query.endDay, "endDay"));
  return target;
}

async function proxySecretTourHtml(req, res) {
  if (!isAdminReadRequest(req)) {
    const error = new Error(hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured");
    error.status = 403;
    throw error;
  }
  const action = asText(req.query?.action);
  const target = action === "secret_tour_flight_schedule"
    ? buildSecretTourFlightScheduleProxyUrl(req.query || {})
    : buildSecretTourGoodsViewProxyUrl(req.query || {});
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: {
      "Accept": "text/html, */*;q=0.8",
      "User-Agent": "GolfJoinAdmin/1.0"
    },
    redirect: "follow"
  });
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_SECRET_TOUR_HTML_BYTES) {
    throw createHttpError("Secret Tour response is too large", 502);
  }
  const text = Buffer.from(arrayBuffer).toString("utf8");
  res.status(response.status);
  res.set("Content-Type", response.headers.get("content-type") || "text/html; charset=utf-8");
  res.send(text);
}

async function proxyGet(req, res) {
  if (req.query?.action === "member_profile_lookup") {
    throw createHttpError("Use POST for member_profile_lookup", 405);
  }
  if (req.query?.action === "secret_tour_goods_detail" || req.query?.action === "secret_tour_flight_schedule") {
    await proxySecretTourHtml(req, res);
    return;
  }
  const requestedSheet = resolveReadSheetAlias(req.query?.sheet || "");
  const adminRequested = req.query?.admin === "1" || requestedSheet === "all" || !PUBLIC_READ_SHEETS.has(requestedSheet);
  const isAdmin = isAdminReadRequest(req);
  if (adminRequested && !isAdmin) {
    const error = new Error(hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured");
    error.status = 403;
    throw error;
  }
  const target = buildSheetReadUrl(req.query || {});
  target.searchParams.delete("admin");
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: { "Accept": "application/json" },
    redirect: "follow"
  });
  const text = await response.text();
  res.status(response.status);
  res.set("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
  if (isAdmin || !response.ok) {
    res.send(text);
    return;
  }
  try {
    res.send(JSON.stringify(sanitizePublicPayload(JSON.parse(text))));
  } catch (error) {
    res.send(text);
  }
}

function proxyAdminLogin(req, res) {
  const payload = readBody(req);
  const loginId = asText(payload.loginId);
  const loginPassword = asText(payload.loginPassword);
  if (!hasAdminReadAuthConfigured()) {
    const error = new Error("Admin login is not configured");
    error.status = 500;
    throw error;
  }
  if (!isAdminLoginValid(loginId, loginPassword)) {
    const error = new Error("Invalid admin credentials");
    error.status = 403;
    throw error;
  }
  res.status(200).json({
    token: createAdminSessionToken(loginId),
    expiresIn: Math.max(60, ADMIN_SESSION_TTL_SECONDS)
  });
}

async function proxyPost(req, res) {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (req.query?.action === "member_profile_lookup") {
    const payload = readBody(req);
    await proxyMemberProfileLookup(payload, res);
    return;
  }

  if (req.query?.action === "join_wishes_lookup") {
    const payload = readBody(req);
    await proxyJoinWishesLookup(payload, res);
    return;
  }

  if (req.query?.action === "home_bootstrap") {
    const payload = readBody(req);
    await proxyHomeBootstrap(payload, res);
    return;
  }

  if (req.query?.action === "admin_login") {
    proxyAdminLogin(req, res);
    return;
  }

  if (req.query?.action === "admin_status_update") {
    if (!isAdminReadRequest(req)) {
      const error = new Error(hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured");
      error.status = 403;
      throw error;
    }
    const payload = readBody(req);
    validateAdminStatusUpdatePayload(payload);
    const response = await fetchWithTimeout(SHEET_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, action: "admin_status_update" }),
      redirect: "follow"
    });
    const text = await response.text();
    res.status(response.status);
    res.set("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(text);
    return;
  }

  if (!isWriteRequestAuthorized(req)) {
    const error = new Error("Write token is required");
    error.status = 403;
    throw error;
  }
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
  const source = asText(payload.source);
  console.log("golfjoin write start", {
    requestId,
    source,
    contentLength: Number(req.headers["content-length"] || 0),
    applicationId: asText(payload.applicationId || payload.joinApplyId),
    scheduleId: asText(payload.scheduleId || payload.targetScheduleId || getValue(payload, "target.scheduleId"))
  });
  const notificationScheduleId = source === "new_schedule_builder"
    ? asText(payload.scheduleId)
    : source === "join_apply"
      ? asText(payload.targetScheduleId || getValue(payload, "target.scheduleId"))
      : "";
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body, "utf8") > MAX_POST_BYTES) {
    const error = new Error("Payload too large");
    error.status = 413;
    throw error;
  }
  let response;
  try {
    response = await fetchWithTimeout(SHEET_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
      redirect: "follow"
    });
  } catch (error) {
    console.error("golfjoin sheet post failed", {
      requestId,
      source,
      name: error?.name || "",
      message: error?.message || ""
    });
    throw error;
  }
  const text = await response.text();
  console.log("golfjoin sheet post response", {
    requestId,
    source,
    status: response.status,
    ok: response.ok,
    bodyHead: text.slice(0, 300)
  });
  res.status(response.status);
  res.set("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
  if (!response.ok || !(source === "new_schedule_builder" || source === "join_apply")) {
    res.send(text);
    return;
  }
  try {
    const savedPayload = JSON.parse(text || "{}");
    sendGolfjoinApplicationNotificationsInBackground(payload, notificationScheduleId, requestId);
    res.send(JSON.stringify({
      ...savedPayload,
      notifications: ALIGO_ENABLED
        ? [{ queued: true, reason: "notification_queued" }]
        : [{ skipped: true, reason: "aligo is disabled" }]
    }));
  } catch (error) {
    console.warn("Failed to queue golfjoin alimtalk notification.", error);
    res.send(text);
  }
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
