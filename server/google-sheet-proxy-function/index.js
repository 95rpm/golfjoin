"use strict";

const crypto = require("crypto");
const { Storage } = require("@google-cloud/storage");
const { createGolfjoinQuotePdfBuffer: createGolfjoinQuotePdfBufferV2 } = require("./quote-pdf");
const { createGolfjoinQuoteHtml } = require("./quote-page");

const SHEET_WEB_APP_URL = process.env.SHEET_WEB_APP_URL || "";
const GOOGLE_SHEET_ID = String(process.env.GOOGLE_SHEET_ID || "").trim();
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
  "recommended_schedules",
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
  "recommended_schedules",
  "product_display_rules"
]);
const GOOGLE_SHEET_HEADERS = {
  join_member_profiles: [
    "profileId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberChannel",
    "memberMobile",
    "memberEmail",
    "birthYear",
    "gender",
    "profession",
    "level",
    "travelStyles",
    "profileImageUrl",
    "profileImageObjectName",
    "profileImageSize",
    "requiredAgreed",
    "marketingAgreed",
    "termsAgreedAt",
    "kakaoId",
    "kakaoNickname",
    "adminMemo",
    "updatedAt"
  ],
  join_reviews: [
    "reviewId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberMobile",
    "memberEmail",
    "targetType",
    "targetScheduleId",
    "targetApplicationId",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "departureDate",
    "returnDate",
    "country",
    "region",
    "rating",
    "tags",
    "reviewText",
    "photoName",
    "imageUrl",
    "thumbnailUrl",
    "imagesJson",
    "status",
    "adminMemo",
    "updatedAt"
  ],
  join_applications: [
    "applicationId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberChannel",
    "memberMobile",
    "memberEmail",
    "targetType",
    "targetScheduleId",
    "targetApplicationId",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "departureDate",
    "returnDate",
    "category",
    "country",
    "region",
    "airline",
    "departureAirport",
    "arrivalAirport",
    "applicantName",
    "applicantGender",
    "applicantBirthYear",
    "applicantAgeBand",
    "applicantMobile",
    "applicantProfession",
    "applicantPeople",
    "applicantCompanions",
    "applicantLevel",
    "applicantStyles",
    "applicantPreferredMembers",
    "applicantGreeting",
    "applicantRoomType",
    "flightRequestType",
    "singleRoomSurcharge",
    "singleRoomSurchargeText",
    "singleRoomSurchargeStatus",
    "participantStatus",
    "quoteStatus",
    "depositStatus",
    "balanceStatus",
    "refundStatus",
    "applicationStatus",
    "requiredAgreed",
    "marketingAgreed",
    "adminMemo",
    "updatedAt",
    "memberKey",
    "kakaoId",
    "targetJoinId",
    "targetProductKey",
    "quoteId",
    "quoteNo",
    "quoteUrl",
    "quotePageUrl",
    "quotePdfUrl",
    "quoteFileName",
    "quoteGeneratedAt"
  ],
  new_schedule_applications: [
    "applicationId",
    "scheduleId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberChannel",
    "memberMobile",
    "memberEmail",
    "applicantName",
    "applicantGender",
    "applicantBirthYear",
    "applicantAgeBand",
    "applicantMobile",
    "applicantProfession",
    "applicantPeople",
    "applicantCompanions",
    "applicantLevel",
    "applicantStyles",
    "applicantPreferredMembers",
    "applicantGreeting",
    "applicantRoomType",
    "flightRequestType",
    "singleRoomSurcharge",
    "singleRoomSurchargeText",
    "singleRoomSurchargeStatus",
    "country",
    "region",
    "airline",
    "departureAirport",
    "arrivalAirport",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "productPrice",
    "packType",
    "packTypeName",
    "tripSummary",
    "departureDateFrom",
    "departureDateTo",
    "returnDateFrom",
    "returnDateTo",
    "participantStatus",
    "quoteStatus",
    "depositStatus",
    "balanceStatus",
    "refundStatus",
    "requiredAgreed",
    "marketingAgreed",
    "approvalStatus",
    "displayStatus",
    "applicationStatus",
    "adminMemo",
    "updatedAt",
    "memberKey",
    "kakaoId",
    "quoteId",
    "quoteNo",
    "quoteUrl",
    "quotePageUrl",
    "quotePdfUrl",
    "quoteFileName",
    "quoteGeneratedAt"
  ],
  recommended_schedules: [
    "recommendedScheduleId",
    "erpProductId",
    "erpEventSeq",
    "section",
    "isVisible",
    "isPinned",
    "displayOrder",
    "badgeType",
    "scheduleType",
    "scheduleLabel",
    "capacity",
    "maxPeople",
    "packType",
    "packTypeName",
    "overrideTitle",
    "overrideImageUrl",
    "country",
    "region",
    "airline",
    "departureAirport",
    "arrivalAirport",
    "productPrice",
    "displayStartAt",
    "displayEndAt",
    "tripSummary",
    "adminMemo",
    "updatedAt"
  ],
  schedule_participant_summary: [
    "scheduleId",
    "sourceApplicationId",
    "title",
    "country",
    "region",
    "departureSummary",
    "returnSummary",
    "tripSummary",
    "creatorName",
    "creatorPhone",
    "capacity",
    "creatorPeople",
    "joinedPeople",
    "confirmedPeople",
    "pendingPeople",
    "cancelledPeople",
    "remainingSeats",
    "participantNames",
    "participantPhones",
    "genderSummary",
    "ageSummary",
    "levelSummary",
    "styleSummary",
    "memberPreferenceSummary",
    "status",
    "approvalStatus",
    "displayStatus",
    "updatedAt"
  ],
  join_wishes: [
    "wishId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberChannel",
    "memberMobile",
    "memberEmail",
    "targetType",
    "targetKey",
    "targetScheduleId",
    "targetApplicationId",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "departureDate",
    "returnDate",
    "category",
    "country",
    "region",
    "imageUrl",
    "price",
    "status",
    "adminMemo",
    "updatedAt"
  ]
};
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
const ALIGO_REQUEST_TIMEOUT_MS = Number(process.env.ALIGO_REQUEST_TIMEOUT_MS || 8000);
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
  join_wish: "join_wishes",
  product_display_rule: "recommended_schedules",
  recommended_schedule: "recommended_schedules"
};
const ALLOWED_ACTIONS = new Set(["", "upsert"]);
const ALLOWED_ROOM_TYPES = new Set(["2인1실", "1인1실"]);
const ALLOWED_FLIGHT_REQUEST_TYPES = new Set(["", "직접예약", "대행요청"]);
const ADMIN_STATUS_UPDATE_FIELDS = new Set([
  "participantStatus",
  "quoteStatus",
  "depositStatus",
  "balanceStatus",
  "refundStatus",
  "applicationStatus",
  "adminMemo",
  "quoteId",
  "quoteNo",
  "quoteUrl",
  "quotePageUrl",
  "quotePdfUrl",
  "quoteFileName",
  "quoteGeneratedAt"
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
const GOLFJOIN_SHARE_OG_FALLBACK_IMAGE = String(process.env.GOLFJOIN_SHARE_OG_FALLBACK_IMAGE || "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/hero_banner1.webp").trim();
const MAX_SECRET_TOUR_HTML_BYTES = Number(process.env.MAX_SECRET_TOUR_HTML_BYTES || 1024 * 1024 * 2);
const EXTERNAL_FETCH_TIMEOUT_MS = Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS || 15000);
const GOLFJOIN_PRODUCTS_BUCKET = String(process.env.GOLFJOIN_PRODUCTS_BUCKET || "golfjoin-bucket").trim();
const GOLFJOIN_PRODUCTS_PREFIX = String(process.env.GOLFJOIN_PRODUCTS_PREFIX || "web").trim().replace(/^\/+|\/+$/g, "");
const GOLFJOIN_QUOTES_PREFIX = String(process.env.GOLFJOIN_QUOTES_PREFIX || "quotes").trim().replace(/^\/+|\/+$/g, "");
const GOLFJOIN_QUOTE_DEPOSIT_PER_PERSON = Math.max(0, Number(process.env.GOLFJOIN_QUOTE_DEPOSIT_PER_PERSON || 200000));
const GOLFJOIN_QUOTE_ACCOUNT_TEXT = String(process.env.GOLFJOIN_QUOTE_ACCOUNT_TEXT || "담당자 확인 후 안내").trim();
const SECRET_TOUR_GOODS_CATEGORY_ROOTS = String(process.env.SECRET_TOUR_GOODS_CATEGORY_ROOTS || "1,2,3,5")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const HOME_BOOTSTRAP_CACHE_TTL_MS = Number(process.env.HOME_BOOTSTRAP_CACHE_TTL_MS || 60_000);
const HOME_BOOTSTRAP_STALE_TTL_MS = Number(process.env.HOME_BOOTSTRAP_STALE_TTL_MS || 10 * 60_000);
const HOME_BOOTSTRAP_CACHE_MAX_KEYS = Number(process.env.HOME_BOOTSTRAP_CACHE_MAX_KEYS || 100);
const HOME_BOOTSTRAP_REFRESH_TIMEOUT_MS = Number(process.env.HOME_BOOTSTRAP_REFRESH_TIMEOUT_MS || 2_500);
const HOME_BOOTSTRAP_LIGHT_CACHE_TTL_MS = Number(process.env.HOME_BOOTSTRAP_LIGHT_CACHE_TTL_MS || 5 * 60_000);
const HOME_BOOTSTRAP_LIGHT_STALE_TTL_MS = Number(process.env.HOME_BOOTSTRAP_LIGHT_STALE_TTL_MS || 30 * 60_000);
const HOME_BOOTSTRAP_LIGHT_CACHE_MAX_KEYS = Number(process.env.HOME_BOOTSTRAP_LIGHT_CACHE_MAX_KEYS || 100);
const HOME_BOOTSTRAP_LIGHT_REFRESH_TIMEOUT_MS = Number(process.env.HOME_BOOTSTRAP_LIGHT_REFRESH_TIMEOUT_MS || 2_000);
const MEMBER_PROFILE_LOOKUP_TIMEOUT_MS = Number(process.env.MEMBER_PROFILE_LOOKUP_TIMEOUT_MS || 6000);
const GA4_PROPERTY_ID = String(process.env.GA4_PROPERTY_ID || "404154820").trim();
const GA4_LOOKBACK_DAYS = Math.min(Math.max(Number(process.env.GA4_LOOKBACK_DAYS || 30), 1), 365);
const GA4_HOME_HOSTS = String(process.env.GA4_HOME_HOSTS || process.env.GA4_JOIN_HOSTS || "www.secret-tour.com,m.secret-tour.com")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const GA4_HOME_PATH = String(process.env.GA4_HOME_PATH || "").trim();
const GA4_HOME_EVENT_PLAN_SEQ = String(process.env.GA4_HOME_EVENT_PLAN_SEQ || "").trim();
const GA4_VISITOR_COUNT_CACHE_TTL_MS = Number(process.env.GA4_VISITOR_COUNT_CACHE_TTL_MS || 10 * 60_000);
const GA4_ACTIVE_USER_COUNT_CACHE_TTL_MS = Number(process.env.GA4_ACTIVE_USER_COUNT_CACHE_TTL_MS || 60_000);
const homeBootstrapCache = new Map();
const homeBootstrapLightCache = new Map();
const ga4VisitorCountCache = {
  count: 0,
  updatedAt: 0,
  warning: ""
};
const ga4ActiveUserCountCache = {
  count: 0,
  updatedAt: 0,
  warning: ""
};
const storage = new Storage();

function getAllowedOrigin(origin = "") {
  if (!origin) return "";
  if (ALLOWED_ORIGINS.includes("*")) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

async function fetchWithTimeout(url, options = {}, timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS, label = "upstream request") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createHttpError(`${label} timed out after ${timeoutMs}ms`, 504, { code: "upstream_timeout" });
    }
    throw error;
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

function buildGoogleSheetRecordId(prefix = "row", ...parts) {
  const source = parts.map(asText).filter(Boolean).join("|") || `${Date.now()}|${Math.random()}`;
  return `${prefix}_${sha256(source).slice(0, 20)}`;
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
    display_rules: "recommended_schedules",
    product_display_rules: "recommended_schedules",
    recommended_schedule: "recommended_schedules"
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

const PRIVATE_QUOTE_FIELD_KEYS = new Set([
  "quoteid",
  "quoteno",
  "quoteurl",
  "quotepageurl",
  "quotepdfurl",
  "quotefilename",
  "quotegeneratedat"
]);

function hasMemberLookupParams(params = {}) {
  return Boolean(
    asText(params.memberKey)
    || asText(params.memberSeq)
    || asText(params.memberId)
    || normalizePhone(params.memberMobile || params.phone)
    || asText(params.memberEmail || params.email)
    || asText(params.kakaoId)
  );
}

function sanitizePublicRow(row = {}, options = {}) {
  const preserveQuoteLinks = Boolean(
    options
    && typeof options === "object"
    && options.preserveQuoteLinks
  );
  return Object.entries(row).reduce((object, [key, value]) => {
    const lowerKey = String(key || "").toLowerCase();
    if (!preserveQuoteLinks && (PRIVATE_QUOTE_FIELD_KEYS.has(lowerKey) || lowerKey.startsWith("quote"))) {
      return object;
    }
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

function sanitizePublicPayload(payload, options = {}) {
  if (!payload || typeof payload !== "object") return payload;
  const sanitizeRow = (row) => sanitizePublicRow(row, options);
  if (Array.isArray(payload)) return payload.map(sanitizeRow);
  const next = { ...payload };
  if (Array.isArray(next.rows)) next.rows = next.rows.map(sanitizeRow);
  if (Array.isArray(next.items)) next.items = next.items.map(sanitizeRow);
  if (next.sheets && typeof next.sheets === "object") {
    next.sheets = Object.entries(next.sheets).reduce((sheets, [sheetName, rows]) => {
      if (!PUBLIC_READ_SHEETS.has(resolveReadSheetAlias(sheetName))) return sheets;
      sheets[sheetName] = Array.isArray(rows) ? rows.map(sanitizeRow) : rows;
      return sheets;
    }, {});
  }
  next.publicRedacted = true;
  return next;
}

function normalizeAdminSheetRowForJson(row = {}) {
  const dateOnlyKeys = new Set([
    "departureDateFrom",
    "departureDateTo",
    "returnDateFrom",
    "returnDateTo",
    "departureDate",
    "returnDate",
    "displayStartAt",
    "displayEndAt",
    "birthDate"
  ]);
  return Object.entries(row).reduce((object, [key, value]) => {
    if (dateOnlyKeys.has(key)) {
      object[key] = normalizeSheetDateText(value);
      return object;
    }
    if (/price/i.test(key)) {
      object[key] = normalizeSheetPriceText(value);
      return object;
    }
    object[key] = value;
    return object;
  }, {});
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
  const action = asText(req.query?.action);
  const sheetsApiOnlyActions = new Set(["member_profile_lookup", "home_bootstrap", "home_bootstrap_light", "join_wishes_lookup", "admin_status_update", "quote_generate", "admin_bootstrap", "refresh_secret_tour_products"]);
  const standaloneActions = new Set(["admin_login", "home_stats", "secret_tour_goods_detail", "secret_tour_flight_schedule", "secret_tour_goods_list", "secret_tour_goods_events"]);
  const canUseSheetsApiOnly = Boolean(GOOGLE_SHEET_ID && sheetsApiOnlyActions.has(action));
  const canUseStandaloneAction = standaloneActions.has(action);
  const canUseSheetsApiRead = Boolean(GOOGLE_SHEET_ID && req.method === "GET" && !asText(req.query?.action));
  if (!SHEET_WEB_APP_URL && !canUseSheetsApiOnly && !canUseStandaloneAction && !canUseSheetsApiRead) {
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

function createHttpError(message, status = 400, details = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, details);
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

function normalizeSheetDateText(value = "") {
  const text = asText(value);
  if (!text) return "";
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return text.split("~")[0]?.trim() || text;
  const kstTime = parsed.getTime() + (9 * 60 * 60 * 1000);
  return new Date(kstTime).toISOString().slice(0, 10);
}

function getSheetSerialFromDateText(value = "") {
  const iso = normalizeSheetDateText(value);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const base = Date.UTC(1899, 11, 30);
  return String(Math.round((utc - base) / 86400000));
}

function normalizeSheetPriceText(value = "") {
  const text = asText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text) || /^[A-Z][a-z]{2}\s[A-Z][a-z]{2}\s\d{2}\s\d{4}/.test(text)) {
    return getSheetSerialFromDateText(text);
  }
  return text.replace(/[^\d.-]/g, "");
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

function buildMemberKeyFromValues(values = {}) {
  const existing = asText(values.memberKey);
  if (existing) return existing;
  const memberSeq = asText(values.memberSeq);
  if (memberSeq) return `seq:${memberSeq}`;
  const memberId = asText(values.memberId).toLowerCase();
  if (memberId) return `id:${memberId}`;
  const memberMobile = normalizePhone(values.memberMobile);
  if (memberMobile) return `phone:${memberMobile}`;
  const memberEmail = asText(values.memberEmail).toLowerCase();
  if (memberEmail) return `email:${memberEmail}`;
  const kakaoId = asText(values.kakaoId);
  if (kakaoId) return `kakao:${kakaoId}`;
  return "";
}

function getPayloadMemberKey(payload = {}) {
  return buildMemberKeyFromValues({
    memberKey: payload.memberKey || getValue(payload, "member.memberKey"),
    memberSeq: getValue(payload, "member.memberSeq") || payload.memberSeq,
    memberId: getValue(payload, "member.memberId") || payload.memberId,
    memberMobile: getValue(payload, "member.memberMobile") || payload.memberMobile,
    memberEmail: getValue(payload, "member.memberEmail") || payload.memberEmail,
    kakaoId: getValue(payload, "member.kakaoId") || getValue(payload, "kakao.kakaoId") || payload.kakaoId
  });
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

function parseGolfjoinProductReference(value = "", eventSeqValue = "") {
  const raw = asText(value);
  const explicitEventSeq = asText(eventSeqValue);
  const compositeMatch = raw.match(/(?:secret-tour-|erp-)?(\d{5,})-(\d{5,})/);
  if (compositeMatch) {
    return {
      goodSeq: compositeMatch[1],
      eventSeq: compositeMatch[2]
    };
  }
  return {
    goodSeq: /^\d+$/.test(raw) ? raw : "",
    eventSeq: explicitEventSeq
  };
}

function buildAlimtalkDetailUrl(baseUrl = "", info = {}) {
  const url = new URL(baseUrl);
  const reference = parseGolfjoinProductReference(info.productId || info.erpProductId || info.goodSeq, info.eventSeq || info.erpEventSeq);
  const goodSeq = asText(info.goodSeq || reference.goodSeq || info.erpProductId);
  const eventSeq = asText(info.eventSeq || reference.eventSeq || info.erpEventSeq);
  if (!goodSeq) return buildMyPageUrl(baseUrl);
  url.searchParams.set("golfjoinOpen", "detail");
  url.searchParams.set("goodSeq", goodSeq);
  if (eventSeq) url.searchParams.set("eventSeq", eventSeq);
  return url.toString();
}

function getAlimtalkButtons(info = {}) {
  const linkPc = info?.linkMode === "detail"
    ? buildAlimtalkDetailUrl(GOLFJOIN_MY_PAGE_PC_URL, info)
    : buildMyPageUrl(GOLFJOIN_MY_PAGE_PC_URL);
  const linkMo = info?.linkMode === "detail"
    ? buildAlimtalkDetailUrl(GOLFJOIN_MY_PAGE_MO_URL, info)
    : buildMyPageUrl(GOLFJOIN_MY_PAGE_MO_URL);
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
        linkPc,
        linkMo
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
    linkMode: "my",
    productId: firstText(getValue(payload, "trip.productId"), getValue(payload, "product.id"), getValue(payload, "product.productId"), payload.productId),
    goodSeq: firstText(getValue(payload, "trip.goodSeq"), getValue(payload, "product.goodSeq"), getValue(payload, "product.erpProductId"), payload.goodSeq, payload.erpProductId),
    eventSeq: firstText(getValue(payload, "trip.eventSeq"), getValue(payload, "trip.erpEventSeq"), getValue(payload, "product.eventSeq"), getValue(payload, "product.erpEventSeq"), payload.eventSeq, payload.erpEventSeq),
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
    button_1: getAlimtalkButtons(info),
    testMode: ALIGO_TESTMODE,
    failover: "Y",
    fsubject_1: template.subject || template.templateName || "시크릿투어 알림",
    fmessage_1: message
  });
  const response = await fetchWithTimeout(ALIGO_ALIMTALK_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    redirect: "follow"
  }, ALIGO_REQUEST_TIMEOUT_MS);
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
  const seenPhones = new Set();
  return asText(phones)
    .split(",")
    .map(normalizePhone)
    .filter(Boolean)
    .map((phone, index) => ({
      phone,
      customerName: nameList[index] || "고객"
    }))
    .filter((recipient) => {
      if (seenPhones.has(recipient.phone)) return false;
      seenPhones.add(recipient.phone);
      return true;
    });
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
  if (sheet && resolveReadSheetAlias(sheet) !== expectedSheet) throw createHttpError("sheet does not match source");
  if (!ALLOWED_ACTIONS.has(asText(payload.action))) throw createHttpError("action is not allowed");
  if (payload.keyField && !["profileId", "applicationId", "reviewId", "wishId", "displayRuleId", "recommendedScheduleId"].includes(asText(payload.keyField))) {
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
  const memberKey = getPayloadMemberKey(payload);
  if (!memberKey) throw createHttpError("memberKey is required");
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
  assertAllowedValue(getValue(payload, "applicant.roomType") || "2인1실", "applicant.roomType", ALLOWED_ROOM_TYPES);
  assertAllowedValue(getValue(payload, "applicant.flightRequestType") || "", "applicant.flightRequestType", ALLOWED_FLIGHT_REQUEST_TYPES);
  assertNumberRange(getValue(payload, "applicant.singleRoomSurcharge") || 0, "applicant.singleRoomSurcharge", 0, 10000000);
  assertTextLength(getValue(payload, "applicant.singleRoomSurchargeText"), "applicant.singleRoomSurchargeText", MAX_STRING_LENGTHS.medium);
  assertAllowedValue(getValue(payload, "applicant.singleRoomSurchargeStatus") || "", "applicant.singleRoomSurchargeStatus", new Set(["", "found", "not_found", "manual_check", "not_selected"]));
  assertBooleanTrue(getValue(payload, "agreements.required"), "agreements.required");

  if (Array.isArray(getValue(payload, "applicant.companions")) && getValue(payload, "applicant.companions").length > 7) {
    throw createHttpError("applicant.companions has too many items");
  }
  if (options.requireTrip) {
    assertTextLength(payload.applicationId, "applicationId", MAX_STRING_LENGTHS.short, { required: true });
    assertTextLength(payload.scheduleId, "scheduleId", MAX_STRING_LENGTHS.short, { required: true });
    assertTextLength(getValue(payload, "trip.region") || normalizeList(getValue(payload, "trip.regions")).join(","), "trip.region", MAX_STRING_LENGTHS.medium, { required: true });
    assertTextLength(getValue(payload, "trip.airline") || getValue(payload, "product.airline") || getValue(payload, "product.air2Nm") || getValue(payload, "product.air2CdNm"), "trip.airline", MAX_STRING_LENGTHS.short);
    assertTextLength(getValue(payload, "trip.departureAirport") || getValue(payload, "product.departureAirport") || getValue(payload, "product.airport"), "trip.departureAirport", MAX_STRING_LENGTHS.short);
    assertTextLength(getValue(payload, "trip.arrivalAirport") || getValue(payload, "product.arrivalAirport"), "trip.arrivalAirport", MAX_STRING_LENGTHS.short);
    assertAllowedValue(getValue(payload, "trip.packType"), "trip.packType", new Set(["air", "golf"]));
    assertTextLength(getValue(payload, "trip.packTypeName"), "trip.packTypeName", MAX_STRING_LENGTHS.short);
  } else {
    assertTextLength(getValue(payload, "product.productName") || payload.productName, "product.productName", MAX_STRING_LENGTHS.medium, { required: true });
    const targetType = asText(payload.targetType || getValue(payload, "target.type") || "erp_product");
    const targetJoinId = asText(payload.targetJoinId || getValue(payload, "target.joinId") || getValue(payload, "join.id"));
    const targetScheduleId = asText(payload.targetScheduleId || getValue(payload, "target.scheduleId") || getValue(payload, "join.scheduleId"));
    const targetApplicationId = asText(payload.targetApplicationId || getValue(payload, "target.applicationId") || getValue(payload, "join.applicationId"));
    const erpProductId = asText(payload.erpProductId || getValue(payload, "product.erpProductId") || getValue(payload, "product.productId"));
    const erpEventSeq = asText(payload.erpEventSeq || getValue(payload, "product.erpEventSeq") || getValue(payload, "product.eventSeq"));
    const targetProductKey = asText(payload.targetProductKey || getValue(payload, "target.productKey") || (erpProductId && erpEventSeq ? `erp:${erpProductId}:${erpEventSeq}` : ""));
    if (targetType === "new_schedule" && (!targetJoinId || !targetScheduleId)) {
      throw createHttpError("join target identity is required");
    }
    if (targetType === "recommended_schedule" && (!targetJoinId || (!targetScheduleId && !targetApplicationId))) {
      throw createHttpError("recommended target identity is required");
    }
    if (targetType !== "new_schedule" && targetType !== "recommended_schedule" && (!targetProductKey || !erpProductId || !erpEventSeq)) {
      throw createHttpError("product target identity is required");
    }
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

function validateProductDisplayRulePayload(payload) {
  assertTextLength(payload.erpProductId || getValue(payload, "product.erpProductId") || payload.goodSeq, "erpProductId", MAX_STRING_LENGTHS.short, { required: true });
  assertTextLength(payload.erpEventSeq || getValue(payload, "product.erpEventSeq") || payload.eventSeq, "erpEventSeq", MAX_STRING_LENGTHS.short, { required: true });
  assertAllowedValue(payload.section || "available_schedule", "section", new Set(["available_schedule"]), { required: true });
  assertTextLength(payload.recommendedScheduleId || payload.displayRuleId, "recommendedScheduleId", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.overrideTitle || getValue(payload, "product.productName"), "overrideTitle", MAX_STRING_LENGTHS.medium);
  assertTextLength(payload.overrideImageUrl || getValue(payload, "product.imageUrl"), "overrideImageUrl", MAX_STRING_LENGTHS.url);
  assertTextLength(payload.displayStartAt, "displayStartAt", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.displayEndAt, "displayEndAt", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.tripSummary, "tripSummary", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.badgeType, "badgeType", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.scheduleType, "scheduleType", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.scheduleLabel, "scheduleLabel", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.country || getValue(payload, "product.country"), "country", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.region || getValue(payload, "product.region"), "region", MAX_STRING_LENGTHS.medium);
  assertTextLength(payload.departureAirport || getValue(payload, "product.departureAirport") || getValue(payload, "product.airport"), "departureAirport", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.airline || getValue(payload, "product.airline") || getValue(payload, "product.air2Nm") || getValue(payload, "product.air2CdNm"), "airline", MAX_STRING_LENGTHS.short);
  assertTextLength(payload.arrivalAirport || getValue(payload, "product.arrivalAirport") || getValue(payload, "product.region"), "arrivalAirport", MAX_STRING_LENGTHS.short);
  assertNumberRange(payload.capacity || payload.maxPeople || 4, "capacity", 1, 200);
  assertNumberRange(payload.maxPeople || payload.capacity || 4, "maxPeople", 1, 200);
  assertAllowedValue(payload.packType || getValue(payload, "product.packType") || "", "packType", new Set(["", "air", "golf", "항공팩", "골프팩"]));
  assertTextLength(payload.packTypeName || getValue(payload, "product.packTypeName"), "packTypeName", MAX_STRING_LENGTHS.short);
  assertNumberRange(payload.displayOrder || 0, "displayOrder", 0, 10000);
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
    return;
  }
  if (source === "product_display_rule" || source === "recommended_schedule") {
    validateProductDisplayRulePayload(payload);
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

function validateQuoteGeneratePayload(payload = {}) {
  const sheet = asText(payload.sheet);
  if (!["new_schedule_applications", "join_applications"].includes(sheet)) {
    throw createHttpError("sheet is not allowed");
  }
  assertTextLength(payload.keyValue || payload.applicationId, "applicationId", MAX_STRING_LENGTHS.short, { required: true });
  return {
    sheet,
    keyValue: asText(payload.keyValue || payload.applicationId)
  };
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

function filterSheetRowsForRequest(rows = [], params = {}) {
  let filtered = Array.isArray(rows) ? rows : [];
  const source = asText(params.source);
  const status = asText(params.status);
  const displayStatus = asText(params.displayStatus);
  const approvalStatus = asText(params.approvalStatus);
  const memberSeq = asText(params.memberSeq);
  const memberId = asText(params.memberId);
  const memberMobile = normalizePhone(params.memberMobile || params.phone);
  const memberEmail = asText(params.memberEmail || params.email);
  const kakaoId = asText(params.kakaoId);
  const memberKey = buildMemberKeyFromValues({
    memberKey: params.memberKey,
    memberSeq,
    memberId,
    memberMobile,
    memberEmail,
    kakaoId
  });
  const scheduleId = asText(params.scheduleId || params.targetScheduleId);
  const erpProductId = asText(params.erpProductId || params.productId);
  const erpEventSeq = asText(params.erpEventSeq || params.eventSeq);
  const productName = asText(params.productName);
  const since = params.since ? new Date(params.since).getTime() : 0;

  if (source) filtered = filtered.filter((row) => asText(row.source) === source);
  if (status) filtered = filtered.filter((row) => asText(row.status || row.applicationStatus) === status);
  if (displayStatus) filtered = filtered.filter((row) => asText(row.displayStatus) === displayStatus);
  if (approvalStatus) filtered = filtered.filter((row) => asText(row.approvalStatus) === approvalStatus);
  if (memberKey || memberSeq || memberId || memberMobile || memberEmail || kakaoId) {
    filtered = filtered.filter((row) => {
      const rowMemberSeq = asText(row.memberSeq);
      const rowMemberId = asText(row.memberId);
      const rowMemberMobile = normalizePhone(row.memberMobile || row.applicantMobile || row.creatorPhone || row.phone);
      const rowMemberEmail = asText(row.memberEmail || row.email);
      const rowKakaoId = asText(row.kakaoId);
      const rowMemberKey = buildMemberKeyFromValues({
        memberKey: row.memberKey,
        memberSeq: rowMemberSeq,
        memberId: rowMemberId,
        memberMobile: rowMemberMobile,
        memberEmail: rowMemberEmail,
        kakaoId: rowKakaoId
      });
      return Boolean(
        (memberKey && rowMemberKey && rowMemberKey === memberKey)
        || (memberSeq && rowMemberSeq && rowMemberSeq === memberSeq)
        || (memberId && rowMemberId && rowMemberId === memberId)
        || (memberMobile && rowMemberMobile && rowMemberMobile === memberMobile)
        || (memberEmail && rowMemberEmail && rowMemberEmail === memberEmail)
        || (kakaoId && rowKakaoId && rowKakaoId === kakaoId)
      );
    });
  }
  if (scheduleId) {
    filtered = filtered.filter((row) => asText(row.scheduleId || row.targetScheduleId) === scheduleId);
  }
  if (erpProductId) {
    filtered = filtered.filter((row) => asText(row.erpProductId || row.productId) === erpProductId);
  }
  if (erpEventSeq) {
    filtered = filtered.filter((row) => asText(row.erpEventSeq || row.eventSeq) === erpEventSeq);
  }
  if (productName) {
    filtered = filtered.filter((row) => asText(row.productName) === productName);
  }
  if (since) {
    filtered = filtered.filter((row) => {
      const updatedAt = new Date(row.updatedAt || row.createdAt || row.submittedAt || 0).getTime();
      return updatedAt && updatedAt >= since;
    });
  }

  filtered = filtered.sort((a, b) => {
    return new Date(b.updatedAt || b.createdAt || b.submittedAt || 0).getTime()
      - new Date(a.updatedAt || a.createdAt || a.submittedAt || 0).getTime();
  });

  const limit = Math.max(0, Math.round(Number(params.limit) || 0));
  return limit ? filtered.slice(0, limit) : filtered;
}

async function readScheduleParticipantSummariesViaSheetsApi(params = {}) {
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "recommended_schedules"
  ], { timeoutMs: 7000 });
  const newSchedules = sheetRows.new_schedule_applications || [];
  const recommendedSchedules = (sheetRows.recommended_schedules || [])
    .filter(isActiveRecommendedScheduleRule)
    .map(buildRecommendedScheduleSummarySource);
  const summaries = newSchedules
    .concat(recommendedSchedules)
    .map((schedule) => buildScheduleParticipantSummary(schedule, sheetRows.join_applications || []));
  return filterSheetRowsForRequest(summaries, params);
}

async function readGenericSheetViaSheetsApi(query = {}) {
  const sheetName = resolveReadSheetAlias(query.sheet || "");
  if (sheetName && !ALLOWED_READ_SHEETS.has(sheetName)) {
    throw createHttpError("Sheet is not allowed", 400);
  }
  if (sheetName === "schedule_participant_summary") {
    const rows = await readScheduleParticipantSummariesViaSheetsApi(query);
    return {
      ok: true,
      sheet: sheetName,
      count: rows.length,
      rows,
      items: rows,
      updatedAt: nowKstISOString(),
      source: "sheets_api"
    };
  }
  if (!sheetName || sheetName === "all") {
    const sheetNames = Object.keys(GOOGLE_SHEET_HEADERS).filter((name) => name !== "schedule_participant_summary");
    const sheetRows = await readGoogleSheetRangesViaApi(sheetNames, { timeoutMs: 8000 });
    const sheets = sheetNames.reduce((object, name) => {
      object[name] = filterSheetRowsForRequest(sheetRows[name] || [], query).map(normalizeSheetRowForJson);
      return object;
    }, {});
    sheets.schedule_participant_summary = await readScheduleParticipantSummariesViaSheetsApi(query);
    return {
      ok: true,
      updatedAt: nowKstISOString(),
      sheets,
      source: "sheets_api"
    };
  }
  const rows = filterSheetRowsForRequest(await readGoogleSheetRowsViaApi(sheetName, { timeoutMs: 6000 }), query)
    .map(normalizeSheetRowForJson);
  return {
    ok: true,
    sheet: sheetName,
    count: rows.length,
    rows,
    items: rows,
    updatedAt: nowKstISOString(),
    source: "sheets_api"
  };
}

async function readScheduleSummaryViaSheetsApi(scheduleId = "") {
  const key = asText(scheduleId);
  if (!key) return null;
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "recommended_schedules"
  ], { timeoutMs: 7000 });
  const newSchedules = sheetRows.new_schedule_applications || [];
  const recommendedSchedules = (sheetRows.recommended_schedules || [])
    .filter(isActiveRecommendedScheduleRule)
    .map(buildRecommendedScheduleSummarySource);
  const schedules = newSchedules.concat(recommendedSchedules);
  const schedule = schedules.find((item) => (
    asText(item.scheduleId) === key
    || asText(item.applicationId) === key
    || asText(item.sourceApplicationId) === key
  ));
  if (!schedule) return null;
  return buildScheduleParticipantSummary(schedule, sheetRows.join_applications || []);
}

async function readScheduleSummaryViaAppsScript(scheduleId = "") {
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

async function readScheduleSummary(scheduleId = "") {
  const key = asText(scheduleId);
  if (!key) return null;
  if (GOOGLE_SHEET_ID) {
    try {
      const summary = await readScheduleSummaryViaSheetsApi(key);
      if (summary) return summary;
    } catch (error) {
      console.warn("Schedule summary via Google Sheets API failed; falling back to Apps Script.", {
        scheduleId: key,
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  }
  return readScheduleSummaryViaAppsScript(key);
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
        try {
          afterSummary = await readScheduleSummary(notificationScheduleId);
          beforeSummary = afterSummary
            ? {
                ...afterSummary,
                confirmedPeople: Math.max(0, getNumberValue(afterSummary.confirmedPeople, 0) - getApplicantPeople(payload))
              }
            : null;
        } catch (summaryError) {
          console.warn("Failed to read schedule summary before join alimtalk; sending join notification without summary.", {
            requestId,
            scheduleId: notificationScheduleId,
            name: summaryError?.name || "",
            message: summaryError?.message || ""
          });
        }
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
    memberSeq: asText(row.memberSeq),
    memberId: asText(row.memberId),
    memberName: asText(row.memberName),
    memberChannel: asText(row.memberChannel),
    memberMobile: normalizePhone(row.memberMobile),
    memberEmail: asText(row.memberEmail),
    kakaoId: asText(row.kakaoId),
    kakaoNickname: asText(row.kakaoNickname),
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

function rowMatchesMemberProfileLookup(row = {}, identifiers = {}) {
  const memberSeq = asText(identifiers.memberSeq);
  const memberId = asText(identifiers.memberId);
  const memberMobile = normalizePhone(identifiers.memberMobile);
  const memberEmail = asText(identifiers.memberEmail).toLowerCase();
  const kakaoId = asText(identifiers.kakaoId);
  return Boolean(
    (memberSeq && asText(row.memberSeq) === memberSeq) ||
    (memberId && asText(row.memberId) === memberId) ||
    (memberMobile && normalizePhone(row.memberMobile || row.mobile || row.phone) === memberMobile) ||
    (memberEmail && asText(row.memberEmail || row.email).toLowerCase() === memberEmail) ||
    (kakaoId && asText(row.kakaoId) === kakaoId)
  );
}

async function readMemberProfileLookupRowsViaSheetsApi(identifiers = {}) {
  const rows = await readGoogleSheetRowsViaApi("join_member_profiles", { timeoutMs: MEMBER_PROFILE_LOOKUP_TIMEOUT_MS });
  const matches = rows.filter((row) => rowMatchesMemberProfileLookup(row, identifiers)).reverse();
  if (!matches.length) return [];
  const completed = matches.find(hasCompletedJoinMemberProfile);
  return [sanitizeMemberProfileLookupRow(completed || matches[0])];
}

async function readMemberProfileLookupRowsViaAppsScript(identifiers = {}) {
  const target = buildSheetReadUrl({
    sheet: "join_member_profiles",
    source: "join_member_profile",
    limit: "1",
    memberSeq: identifiers.memberSeq,
    memberId: identifiers.memberId,
    memberMobile: identifiers.memberMobile,
    memberEmail: identifiers.memberEmail,
    kakaoId: identifiers.kakaoId
  });
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: { "Accept": "application/json" },
    redirect: "follow"
  }, MEMBER_PROFILE_LOOKUP_TIMEOUT_MS);
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Member profile lookup upstream failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }
  const payload = JSON.parse(text || "{}");
  const rows = Array.isArray(payload) ? payload : (payload.items || payload.rows || []);
  return rows.slice(0, 1).map(sanitizeMemberProfileLookupRow);
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

function rowMatchesJoinWishLookup(row = {}, identifiers = {}) {
  const memberSeq = asText(identifiers.memberSeq);
  const memberId = asText(identifiers.memberId);
  const memberMobile = normalizePhone(identifiers.memberMobile || identifiers.phone);
  const rowMemberSeq = asText(row.memberSeq);
  const rowMemberId = asText(row.memberId);
  const rowMemberMobile = normalizePhone(row.memberMobile || row.applicantMobile || row.creatorPhone || row.phone);
  return Boolean(
    (memberSeq && rowMemberSeq && rowMemberSeq === memberSeq) ||
    (memberId && rowMemberId && rowMemberId === memberId) ||
    (memberMobile && rowMemberMobile && rowMemberMobile === memberMobile)
  );
}

function sortRowsByUpdatedAtDesc(rows = []) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || a.submittedAt || 0).getTime() || 0;
    const bTime = new Date(b.updatedAt || b.createdAt || b.submittedAt || 0).getTime() || 0;
    return bTime - aTime;
  });
}

async function readJoinWishesForMemberViaSheetsApi(params = {}) {
  const limit = Math.min(Math.max(Number(params?.limit || 200), 1), 200);
  const rows = await readGoogleSheetRowsViaApi("join_wishes", { timeoutMs: 5000 });
  return sortRowsByUpdatedAtDesc(rows.filter((row) => (
    asText(row.source) === "join_wish"
    && asText(row.status || "active") === "active"
    && rowMatchesJoinWishLookup(row, params)
  ))).slice(0, limit);
}

async function readJoinWishesForMemberViaAppsScript(params = {}) {
  const memberSeq = asText(params?.memberSeq);
  const memberId = asText(params?.memberId);
  const memberMobile = normalizePhone(params?.memberMobile || params?.phone);
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

  const identifiers = { memberSeq, memberId, memberMobile, memberEmail, kakaoId };
  const warnings = [];
  if (GOOGLE_SHEET_ID) {
    try {
      const sanitized = await readMemberProfileLookupRowsViaSheetsApi(identifiers);
      res.status(200).json({ items: sanitized, rows: sanitized, source: "sheets_api" });
      return;
    } catch (error) {
      warnings.push("sheets_api_failed");
      console.warn("Member profile lookup via Google Sheets API failed; falling back to Apps Script.", {
        name: error?.name,
        message: error?.message
      });
    }
  }
  try {
    const sanitized = await readMemberProfileLookupRowsViaAppsScript(identifiers);
    res.status(200).json({
      items: sanitized,
      rows: sanitized,
      source: "apps_script",
      warnings
    });
    return;
  } catch (error) {
    console.warn("Member profile lookup fallback failed.", {
      name: error?.name,
      message: error?.message,
      warnings
    });
    res.status(200).json({
      ok: false,
      lookupFailed: true,
      error: "member_profile_lookup_unavailable",
      warnings,
      items: [],
      rows: []
    });
    return;
  }
}

async function proxyJoinWishesLookup(params, res) {
  const memberSeq = asText(params?.memberSeq);
  const memberId = asText(params?.memberId);
  const memberMobile = normalizePhone(params?.memberMobile || params?.phone);
  const result = await readJoinWishesForMemberWithSource({ memberSeq, memberId, memberMobile, limit: params?.limit });
  const sanitized = result.rows.map(sanitizeJoinWishLookupRow);
  res.status(200).json({
    items: sanitized,
    rows: sanitized,
    source: result.source,
    warnings: result.warnings
  });
}

async function readJoinWishesForMemberWithSource(params = {}) {
  const memberSeq = asText(params?.memberSeq);
  const memberId = asText(params?.memberId);
  const memberMobile = normalizePhone(params?.memberMobile || params?.phone);
  if (!memberMobile || (!memberSeq && !memberId)) return { rows: [], source: "", warnings: [] };
  const lookupParams = { ...params, memberSeq, memberId, memberMobile };
  const warnings = [];
  if (GOOGLE_SHEET_ID) {
    try {
      return {
        rows: await readJoinWishesForMemberViaSheetsApi(lookupParams),
        source: "sheets_api",
        warnings
      };
    } catch (error) {
      warnings.push({ key: "sheetsApi", message: error?.message || "Google Sheets API read failed" });
      console.warn("Join wishes lookup via Google Sheets API failed; falling back to Apps Script.", {
        name: error?.name,
        message: error?.message
      });
    }
  }
  return {
    rows: await readJoinWishesForMemberViaAppsScript(lookupParams),
    source: "apps_script",
    warnings
  };
}

async function readJoinWishesForMember(params = {}) {
  const result = await readJoinWishesForMemberWithSource(params);
  return result.rows;
}

async function readHomeBootstrapPart(key, reader) {
  try {
    return { key, rows: await reader() };
  } catch (error) {
    return { key, rows: [], warning: error?.message || `${key} failed` };
  }
}

async function readHomeBootstrapBatchDirect(params = {}) {
  const target = buildSheetReadUrl({
    action: "home_bootstrap",
    sheet: "new_schedule_applications",
    memberSeq: asText(params.memberSeq),
    memberId: asText(params.memberId),
    memberMobile: normalizePhone(params.memberMobile || params.phone),
    newScheduleLimit: Math.min(Math.max(Number(params.newScheduleLimit || 100), 1), 100),
    joinApplicationLimit: Math.min(Math.max(Number(params.joinApplicationLimit || 50), 1), 100),
    reviewLimit: Math.min(Math.max(Number(params.reviewLimit || 200), 1), 200),
    wishLimit: Math.min(Math.max(Number(params.wishLimit || 200), 1), 200)
  });
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: { "Accept": "application/json" },
    redirect: "follow"
  });
  const text = await response.text();
  if (!response.ok) throw createHttpError(`Home bootstrap batch failed: ${response.status}`, response.status);
  const payload = JSON.parse(text || "{}");
  if (
    !payload
    || !Array.isArray(payload.newSchedules)
    || !Array.isArray(payload.joinApplications)
    || !Array.isArray(payload.reviews)
    || !Array.isArray(payload.wishes)
  ) {
    throw createHttpError("Home bootstrap batch payload is invalid", 502);
  }
  return {
    newSchedules: payload.newSchedules.map(sanitizePublicRow),
    joinApplications: payload.joinApplications.map(sanitizePublicRow),
    reviews: payload.reviews.map(sanitizePublicRow),
    wishes: payload.wishes.map(sanitizeJoinWishLookupRow),
    displayRules: Array.isArray(payload.displayRules) ? payload.displayRules.map(sanitizePublicRow) : [],
    profileCount: Math.max(0, Math.round(Number(payload.profileCount) || 0)),
    visitorCount: Math.max(0, Math.round(Number(payload.visitorCount) || 0)),
    activeUserCount: Math.max(0, Math.round(Number(payload.activeUserCount) || 0)),
    warnings: []
  };
}

async function readHomeBootstrapLightViaAppsScript(params = {}) {
  const target = buildSheetReadUrl({
    action: "home_bootstrap_light",
    newScheduleLimit: Math.min(Math.max(Number(params.newScheduleLimit || 100), 1), 100),
    joinApplicationLimit: Math.min(Math.max(Number(params.joinApplicationLimit || 100), 1), 200)
  });
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: { "Accept": "application/json" },
    redirect: "follow"
  });
  const text = await response.text();
  if (!response.ok) throw createHttpError(`Home bootstrap light failed: ${response.status}`, response.status);
  const payload = JSON.parse(text || "{}");
  if (
    !payload
    || !Array.isArray(payload.newScheduleSummaries)
    || !Array.isArray(payload.participantSummaries)
    || !Array.isArray(payload.displayRules)
    || !Array.isArray(payload.wishTargetKeys)
  ) {
    throw createHttpError("Home bootstrap light payload is invalid", 502);
  }
  return sanitizeHomeBootstrapLightPayload(payload);
}

async function readHomeBootstrapLightViaSheetsApi(params = {}) {
  const newScheduleLimit = Math.min(Math.max(Number(params.newScheduleLimit || 100), 1), 100);
  const joinApplicationLimit = Math.min(Math.max(Number(params.joinApplicationLimit || 100), 1), 200);
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "recommended_schedules"
  ], { timeoutMs: 7000 });
  const newSchedules = filterSheetRowsForHome(sheetRows.new_schedule_applications || [], {
    source: "new_schedule_builder",
    limit: newScheduleLimit
  });
  const joinApplications = filterSheetRowsForHome(sheetRows.join_applications || [], {
    source: "join_apply",
    limit: joinApplicationLimit
  });
  const displayRules = filterSheetRowsForHome(sheetRows.recommended_schedules || [], {
    limit: 100
  }).filter((row) => (
    asText(row.section) === "available_schedule"
    && asText(row.isVisible || "true").toLowerCase() !== "false"
  ));
  return sanitizeHomeBootstrapLightPayload({
    ok: true,
    serverTime: nowKstISOString(),
    updatedAt: nowKstISOString(),
    newScheduleSummaries: newSchedules.map(buildNewScheduleSummary),
    participantSummaries: buildParticipantSummaries(joinApplications),
    displayRules: displayRules.map(buildDisplayRuleSummary),
    wishTargetKeys: [],
    memberBasic: {
      hasMember: false
    },
    warnings: [],
    source: "sheets_api"
  });
}

async function readHomeBootstrapLightDirect(params = {}) {
  const warnings = [];
  if (GOOGLE_SHEET_ID) {
    try {
      return {
        ...await readHomeBootstrapLightViaSheetsApi(params),
        source: "sheets_api"
      };
    } catch (error) {
      warnings.push({ key: "sheetsApi", message: error?.message || "Google Sheets API read failed" });
      console.warn("Home bootstrap light via Google Sheets API failed; falling back to Apps Script.", {
        name: error?.name,
        message: error?.message
      });
    }
  }
  const payload = await readHomeBootstrapLightViaAppsScript(params);
  return {
    ...payload,
    source: "apps_script",
    warnings: [
      ...(payload.warnings || []),
      ...warnings
    ]
  };
}

function sanitizePreviewItem(item = {}) {
  return {
    displayName: maskName(item.displayName || item.name || ""),
    gender: asText(item.gender),
    ageDisplay: asText(item.ageDisplay || item.age),
    profession: asText(item.profession),
    level: asText(item.level),
    styles: Array.isArray(item.styles) ? item.styles.map(asText).filter(Boolean) : [],
    memberPreferences: Array.isArray(item.memberPreferences) ? item.memberPreferences.map(asText).filter(Boolean) : [],
    iconSeed: asText(item.iconSeed || item.seed),
    companionGroup: asText(item.companionGroup)
  };
}

function sanitizeHomeBootstrapLightPayload(payload = {}) {
  return {
    ok: Boolean(payload.ok !== false),
    serverTime: asText(payload.serverTime || payload.updatedAt || nowKstISOString()),
    updatedAt: asText(payload.updatedAt || payload.serverTime || nowKstISOString()),
    newScheduleSummaries: (Array.isArray(payload.newScheduleSummaries) ? payload.newScheduleSummaries : []).map((item) => ({
      scheduleId: asText(item.scheduleId),
      applicationId: asText(item.applicationId),
      targetType: asText(item.targetType || "new_schedule"),
      memberSeq: asText(item.memberSeq),
      memberId: asText(item.memberId),
      memberName: asText(item.memberName),
      memberChannel: asText(item.memberChannel),
      memberMobile: normalizePhone(item.memberMobile),
      memberEmail: asText(item.memberEmail),
      erpProductId: asText(item.erpProductId),
      erpEventSeq: asText(item.erpEventSeq),
      title: asText(item.title),
      country: asText(item.country),
      region: asText(item.region),
      airline: asText(item.airline),
      departureAirport: asText(item.departureAirport),
      arrivalAirport: asText(item.arrivalAirport),
      departureDate: normalizeSheetDateText(item.departureDate),
      returnDate: normalizeSheetDateText(item.returnDate),
      price: normalizeSheetPriceText(item.price),
      image: asText(item.image),
      packType: asText(item.packType),
      packTypeName: asText(item.packTypeName),
      flightIncluded: asText(item.flightIncluded),
      roomType: asText(item.roomType),
      flightRequestType: asText(item.flightRequestType),
      singleRoomSurchargeText: asText(item.singleRoomSurchargeText),
      creatorPreview: sanitizePreviewItem(item.creatorPreview || {}),
      participantsPreview: (Array.isArray(item.participantsPreview) ? item.participantsPreview : []).map(sanitizePreviewItem).slice(0, 4),
      confirmedCount: Math.max(0, Math.round(Number(item.confirmedCount) || 0)),
      remainingSlots: Math.max(0, Math.round(Number(item.remainingSlots) || 0)),
      approvalStatus: asText(item.approvalStatus),
      displayStatus: asText(item.displayStatus),
      sortOrder: item.sortOrder,
      createdAt: asText(item.createdAt),
      updatedAt: asText(item.updatedAt),
      shareUrl: asText(item.shareUrl)
    })),
    participantSummaries: (Array.isArray(payload.participantSummaries) ? payload.participantSummaries : []).map((item) => ({
      targetType: asText(item.targetType),
      targetScheduleId: asText(item.targetScheduleId),
      targetApplicationId: asText(item.targetApplicationId),
      erpProductId: asText(item.erpProductId),
      erpEventSeq: asText(item.erpEventSeq),
      confirmedCount: Math.max(0, Math.round(Number(item.confirmedCount) || 0)),
      remainingSlots: Math.max(0, Math.round(Number(item.remainingSlots) || 0)),
      participantsPreview: (Array.isArray(item.participantsPreview) ? item.participantsPreview : []).map(sanitizePreviewItem).slice(0, 4),
      lastAppliedAt: asText(item.lastAppliedAt)
    })),
    displayRules: (Array.isArray(payload.displayRules) ? payload.displayRules : []).map(sanitizePublicRow),
    wishTargetKeys: (Array.isArray(payload.wishTargetKeys) ? payload.wishTargetKeys : []).map((item) => ({
      targetType: asText(item.targetType || "product"),
      targetKey: asText(item.targetKey),
      targetScheduleId: asText(item.targetScheduleId),
      targetApplicationId: asText(item.targetApplicationId),
      erpProductId: asText(item.erpProductId),
      erpEventSeq: asText(item.erpEventSeq),
      status: asText(item.status || "active"),
      updatedAt: asText(item.updatedAt)
    })).filter((item) => item.targetKey),
    memberBasic: {
      hasMember: Boolean(payload.memberBasic?.hasMember)
    },
    source: asText(payload.source),
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    cache: payload.cache || undefined
  };
}

function splitSheetList(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  return asText(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function parsePeopleCount(value) {
  return Math.max(1, Math.round(Number(asText(value).replace(/[^\d.-]/g, "")) || 1));
}

function parseQuoteMoney(value) {
  const number = Number(asText(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function formatQuoteMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "담당자 확인";
  return `${Math.round(number).toLocaleString("ko-KR")}원`;
}

function getQuoteApplicationType(sheetName = "", row = {}) {
  if (sheetName === "new_schedule_applications" || asText(row.source).includes("new_schedule")) return "새모임 생성";
  return "참여신청";
}

function getQuoteRoomType(row = {}) {
  return firstText(row.applicantRoomType, row.roomType, getValue(row, "applicant.roomType"), "2인1실");
}

function getQuoteFlightText(row = {}, schedule = {}, product = {}) {
  const flightRequestType = firstText(row.flightRequestType, row.applicantFlightRequestType);
  const airline = firstText(row.airline, schedule.airline, product.airline, product.airlineName, product.air2Nm, product.air2CdNm);
  if (flightRequestType) return airline ? `${airline} / ${flightRequestType}` : flightRequestType;
  return airline || "담당자 확인";
}

function splitQuoteList(value, fallback = []) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).slice(0, 12);
  const items = asText(value).split(/[\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return items.length ? items : fallback;
}

function firstQuoteList(...values) {
  for (const value of values) {
    const items = splitQuoteList(value, []);
    if (items.length) return items;
  }
  return [];
}

function buildQuoteData(payload = {}, existingRow = {}) {
  const sheetName = asText(payload.sheet);
  const row = { ...(existingRow || {}), ...(payload.participant || {}) };
  const schedule = payload.schedule || {};
  const product = payload.product || {};
  const draft = payload.quote || {};
  const generatedAt = nowKstISOString();
  const applicationId = firstText(row.applicationId, row.joinApplyId, payload.keyValue);
  const quoteId = buildGoogleSheetRecordId("quote", applicationId, generatedAt, crypto.randomBytes(4).toString("hex"));
  const quoteDate = generatedAt.slice(0, 10).replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const quoteSuffix = crypto.createHash("sha1").update(quoteId).digest("hex").slice(0, 6).toUpperCase();
  const people = parsePeopleCount(firstText(draft.people, row.applicantPeople, row.people, row.creatorPeople, "1"));
  const unitPrice = parseQuoteMoney(firstText(draft.unitPrice, row.productPrice, row.price, schedule.productPrice, product.productPrice, product.price));
  const singleRoomSurcharge = parseQuoteMoney(firstText(draft.singleRoomSurcharge, row.singleRoomSurcharge, schedule.singleRoomSurcharge));
  const productSubtotal = unitPrice ? unitPrice * people : 0;
  const estimatedTotal = productSubtotal + singleRoomSurcharge;
  const depositPerPerson = parseQuoteMoney(firstText(draft.depositPerPerson, GOLFJOIN_QUOTE_DEPOSIT_PER_PERSON));
  const deposit = depositPerPerson ? depositPerPerson * people : 0;
  const balance = estimatedTotal && deposit ? Math.max(0, estimatedTotal - deposit) : 0;
  const includedItems = firstQuoteList(
    draft.includedItems,
    product.includes,
    product.includeItems,
    row.includes,
    row.includeItems,
    getValue(row, "product.includes"),
    getValue(row, "trip.includes")
  );
  const excludedItems = firstQuoteList(
    draft.excludedItems,
    product.excludes,
    product.excludeItems,
    row.excludes,
    row.excludeItems,
    getValue(row, "product.excludes"),
    getValue(row, "trip.excludes")
  );
  return {
    quoteId,
    quoteNo: `GJQ-${quoteDate}-${quoteSuffix}`,
    generatedAt,
    applicationId,
    applicationType: firstText(draft.applicationType, getQuoteApplicationType(sheetName, row)),
    applicantName: firstText(draft.applicantName, row.applicantName, row.memberName, row.creatorName, row.name, "고객"),
    applicantPhone: normalizePhone(firstText(draft.applicantPhone, row.applicantMobile, row.memberMobile, row.creatorPhone, row.phone)),
    productName: firstText(draft.productName, row.productName, schedule.productName, product.productName, product.title, "골프조인 상품"),
    productImageUrl: firstText(draft.productImageUrl, row.imageUrl, row.image, schedule.imageUrl, schedule.image, product.imageUrl, product.image, product.thumbnailUrl),
    country: firstText(draft.country, row.country, schedule.country, product.country),
    region: firstText(draft.region, row.region, schedule.region, product.region),
    departureDate: normalizeSheetDateText(firstText(draft.departureDate, row.departureDate, row.departureDateFrom, schedule.departureDate, schedule.departureDateFrom, product.departureDate)),
    returnDate: normalizeSheetDateText(firstText(draft.returnDate, row.returnDate, row.returnDateTo, schedule.returnDate, schedule.returnDateTo, product.returnDate)),
    airline: firstText(draft.airline, getQuoteFlightText(row, schedule, product)),
    departureAirport: firstText(draft.departureAirport, row.departureAirport, schedule.departureAirport, product.departureAirport, product.depAirport),
    arrivalAirport: firstText(draft.arrivalAirport, row.arrivalAirport, schedule.arrivalAirport, product.arrivalAirport, product.arrAirport),
    roomType: firstText(draft.roomType, getQuoteRoomType(row)),
    people,
    companions: asText(row.applicantCompanions || row.companions),
    styles: asText(row.applicantStyles || row.styles),
    preferredMembers: asText(row.applicantPreferredMembers || row.memberPreferences),
    unitPrice,
    productSubtotal,
    singleRoomSurcharge,
    estimatedTotal,
    deposit,
    balance,
    formattedProductSubtotal: formatQuoteMoney(productSubtotal || unitPrice),
    formattedSingleRoomSurcharge: singleRoomSurcharge ? formatQuoteMoney(singleRoomSurcharge) : "-",
    formattedEstimatedTotal: formatQuoteMoney(estimatedTotal),
    formattedDepositPerPerson: formatQuoteMoney(depositPerPerson),
    formattedDeposit: formatQuoteMoney(deposit),
    formattedBalance: estimatedTotal ? `${Math.round(balance).toLocaleString("ko-KR")}원` : "담당자 확인",
    accountText: firstText(draft.accountText, GOLFJOIN_QUOTE_ACCOUNT_TEXT),
    flightScheduleItems: firstQuoteList(draft.flightScheduleItems, product.flightScheduleItems, row.flightScheduleItems),
    itineraryItems: firstQuoteList(draft.itineraryItems, product.itineraryItems, row.itineraryItems),
    includedItems: includedItems.length ? includedItems : ["실제 상품 포함 사항 확인 필요"],
    excludedItems: excludedItems.length ? excludedItems : ["실제 상품 불포함 사항 확인 필요"],
    productNotes: firstQuoteList(draft.productNotes, product.notes, product.notice, row.notes, row.notice),
    specialNotes: firstText(
      draft.specialNotes,
      "본 견적서는 현재 신청 정보와 조회 가능한 상품 조건을 기준으로 작성되었습니다. 항공 좌석, 객실 가능 여부, 환율 및 현지 상황에 따라 담당자 확인 후 최종 금액이 변경될 수 있습니다."
    )
  };
}

function pdfHexText(value = "") {
  let hex = "";
  const text = String(value == null ? "" : value);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    hex += code.toString(16).padStart(4, "0");
  }
  return `<${hex}>`;
}

function quoteTextWidth(text = "", fontSize = 12) {
  return Array.from(String(text || "")).reduce((sum, char) => {
    return sum + fontSize * (/[\u0000-\u007f]/.test(char) ? 0.54 : 0.92);
  }, 0);
}

function wrapQuoteText(text = "", maxWidth = 200, fontSize = 12) {
  const source = asText(text) || "-";
  const lines = [];
  let current = "";
  Array.from(source).forEach((char) => {
    const next = `${current}${char}`;
    if (current && quoteTextWidth(next, fontSize) > maxWidth) {
      lines.push(current);
      current = char.trimStart();
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function addPdfText(ops, text, x, y, size = 12, options = {}) {
  const color = options.color || [31, 41, 51];
  const font = options.font || "F1";
  ops.push(`${(color[0] / 255).toFixed(3)} ${(color[1] / 255).toFixed(3)} ${(color[2] / 255).toFixed(3)} rg`);
  ops.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfHexText(text)} Tj ET`);
}

function addPdfRect(ops, x, y, width, height, options = {}) {
  const fill = options.fill;
  const stroke = options.stroke;
  if (fill) {
    ops.push(`${(fill[0] / 255).toFixed(3)} ${(fill[1] / 255).toFixed(3)} ${(fill[2] / 255).toFixed(3)} rg`);
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }
  if (stroke) {
    ops.push(`${(stroke[0] / 255).toFixed(3)} ${(stroke[1] / 255).toFixed(3)} ${(stroke[2] / 255).toFixed(3)} RG`);
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  }
}

function addQuoteKeyValue(ops, label, value, x, y, width, options = {}) {
  addPdfText(ops, label, x, y, 10.5, { color: [95, 107, 122] });
  const lines = wrapQuoteText(value || "-", width, options.size || 12.8).slice(0, options.maxLines || 2);
  lines.forEach((line, index) => {
    addPdfText(ops, line, x, y - 17 - (index * 15), options.size || 12.8, { color: [31, 41, 51] });
  });
}

function buildPdfBuffer(objects = []) {
  let body = "%PDF-1.4\n%\u007f\u007f\u007f\u007f\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "binary"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "binary");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "binary");
}

function createGolfjoinQuotePdfBuffer(quote = {}) {
  const ops = [];
  addPdfRect(ops, 0, 0, 595, 842, { fill: [255, 255, 255] });
  addPdfRect(ops, 0, 834, 595, 8, { fill: [52, 137, 248] });
  addPdfText(ops, "골프조인 예약요청 견적서", 46, 790, 23, { color: [17, 24, 39] });
  addPdfRect(ops, 456, 768, 88, 30, { fill: [52, 137, 248] });
  addPdfText(ops, "자동 생성", 474, 778, 12, { color: [255, 255, 255] });
  addPdfText(ops, `견적번호 ${quote.quoteNo}`, 46, 764, 11.5, { color: [95, 107, 122] });
  addPdfText(ops, `생성일 ${quote.generatedAt}`, 46, 746, 11.5, { color: [95, 107, 122] });

  addPdfRect(ops, 46, 600, 503, 118, { fill: [246, 248, 251], stroke: [217, 222, 231] });
  addPdfText(ops, "신청 정보", 64, 692, 15, { color: [17, 24, 39] });
  addQuoteKeyValue(ops, "신청자", quote.applicantName, 64, 665, 130);
  addQuoteKeyValue(ops, "연락처", quote.applicantPhone, 220, 665, 140);
  addQuoteKeyValue(ops, "신청유형", quote.applicationType, 386, 665, 130);
  addQuoteKeyValue(ops, "신청인원", `${quote.people}명`, 64, 625, 130);
  addQuoteKeyValue(ops, "숙소타입", quote.roomType, 220, 625, 140);
  addQuoteKeyValue(ops, "항공", quote.airline, 386, 625, 130);

  addPdfRect(ops, 46, 442, 503, 132, { fill: [255, 255, 255], stroke: [217, 222, 231] });
  addPdfText(ops, "일정 정보", 64, 548, 15, { color: [17, 24, 39] });
  addQuoteKeyValue(ops, "상품명", quote.productName, 64, 520, 460, { maxLines: 2 });
  addQuoteKeyValue(ops, "지역", [quote.country, quote.region].filter(Boolean).join(" / ") || "-", 64, 475, 190);
  addQuoteKeyValue(ops, "출발일", quote.departureDate || "-", 278, 475, 110);
  addQuoteKeyValue(ops, "도착일", quote.returnDate || "-", 420, 475, 110);

  addPdfRect(ops, 46, 238, 503, 178, { fill: [246, 248, 251], stroke: [217, 222, 231] });
  addPdfText(ops, "견적 금액", 64, 390, 15, { color: [17, 24, 39] });
  const rows = [
    ["상품가", quote.unitPrice ? `1인 기준 x ${quote.people}명` : "담당자 확인", formatQuoteMoney(quote.productSubtotal || quote.unitPrice)],
    ["1인1실 추가요금", quote.singleRoomSurcharge ? "신청 기준" : "-", quote.singleRoomSurcharge ? formatQuoteMoney(quote.singleRoomSurcharge) : "-"],
    ["예상 총액", "자동 산출", formatQuoteMoney(quote.estimatedTotal)],
    ["예약금", `1인 ${formatQuoteMoney(GOLFJOIN_QUOTE_DEPOSIT_PER_PERSON)}`, formatQuoteMoney(quote.deposit)],
    ["잔금", "예약금 제외", formatQuoteMoney(quote.balance)]
  ];
  let y = 360;
  rows.forEach((row, index) => {
    const isTotal = index === 2;
    addPdfRect(ops, 64, y - 9, 466, 28, { fill: isTotal ? [232, 241, 255] : [255, 255, 255], stroke: [225, 229, 235] });
    addPdfText(ops, row[0], 78, y, isTotal ? 13.5 : 12.2, { color: [31, 41, 51] });
    addPdfText(ops, row[1], 218, y, 11.2, { color: [95, 107, 122] });
    addPdfText(ops, row[2], 406, y, isTotal ? 15.5 : 12.8, { color: isTotal ? [52, 137, 248] : [31, 41, 51] });
    y -= 30;
  });

  addPdfRect(ops, 46, 158, 503, 54, { fill: [255, 255, 255], stroke: [217, 222, 231] });
  addPdfText(ops, "입금 안내", 64, 188, 14, { color: [17, 24, 39] });
  addPdfText(ops, quote.accountText || "담당자 확인 후 안내", 150, 188, 13.5, { color: [31, 41, 51] });
  addPdfText(ops, "입금 후 담당자 확인을 거쳐 예약 진행 상태가 변경됩니다.", 64, 170, 11.2, { color: [95, 107, 122] });

  addPdfRect(ops, 46, 76, 503, 58, { fill: [246, 248, 251], stroke: [217, 222, 231] });
  const notice = "본 견적서는 신청 정보를 기준으로 자동 생성된 예약요청 견적서입니다. 항공 좌석, 객실 가능 여부, 환율, 현지 상황에 따라 담당자 확인 후 최종 금액이 변경될 수 있습니다.";
  wrapQuoteText(notice, 464, 10.8).slice(0, 3).forEach((line, index) => {
    addPdfText(ops, line, 64, 112 - (index * 15), 10.8, { color: [55, 58, 60] });
  });
  addPdfText(ops, "시크릿투어 · 카카오채널 문의 · www.secret-tour.com", 46, 42, 10.2, { color: [95, 107, 122] });

  const content = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /HYGoThic-Medium /Encoding /UniKS-UCS2-H /DescendantFonts [5 0 R] >>",
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYGoThic-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 2 >> /FontDescriptor 6 0 R /DW 1000 >>",
    "<< /Type /FontDescriptor /FontName /HYGoThic-Medium /Flags 4 /FontBBox [-6 -145 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -145 /CapHeight 880 /StemV 80 >>",
    `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`
  ];
  return buildPdfBuffer(objects);
}

function buildStoragePublicUrl(bucketName = "", objectName = "") {
  return `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${objectName.split("/").map(encodeURIComponent).join("/")}`;
}

function buildQuoteObjectName(quote = {}, extension = "pdf") {
  const date = normalizeSheetDateText(quote.generatedAt).replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeQuoteId = asText(quote.quoteId).replace(/[^a-z0-9_-]+/gi, "-") || buildGoogleSheetRecordId("quote", date);
  const safeExtension = asText(extension).toLowerCase().replace(/[^a-z0-9]+/g, "") || "pdf";
  return `${GOLFJOIN_QUOTES_PREFIX ? `${GOLFJOIN_QUOTES_PREFIX}/` : ""}${date.slice(0, 4)}/${date.slice(4, 6)}/${safeQuoteId}.${safeExtension}`;
}

async function saveQuotePdfToStorage(buffer, quote = {}) {
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  const objectName = buildQuoteObjectName(quote);
  const file = bucket.file(objectName);
  await file.save(buffer, {
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      contentType: "application/pdf"
    }
  });
  try {
    await file.makePublic();
  } catch (error) {
    console.warn("Quote PDF makePublic failed; returning bucket URL.", error?.message || error);
  }
  return {
    objectName,
    url: buildStoragePublicUrl(GOLFJOIN_PRODUCTS_BUCKET, objectName)
  };
}

async function saveQuoteHtmlToStorage(html, quote = {}) {
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  const objectName = buildQuoteObjectName(quote, "html");
  const file = bucket.file(objectName);
  await file.save(Buffer.from(String(html || ""), "utf8"), {
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      contentType: "text/html; charset=utf-8"
    }
  });
  try {
    await file.makePublic();
  } catch (error) {
    console.warn("Quote HTML makePublic failed; returning bucket URL.", error?.message || error);
  }
  return {
    objectName,
    url: buildStoragePublicUrl(GOLFJOIN_PRODUCTS_BUCKET, objectName)
  };
}

function buildPreviewSeed(row = {}, fallback = "") {
  return [
    row.applicationId,
    row.scheduleId,
    row.memberSeq,
    row.memberId,
    row.applicantMobile,
    row.memberMobile,
    fallback
  ].map(asText).filter(Boolean).join("-");
}

function buildParticipantPreview(row = {}, index = 0) {
  return {
    displayName: asText(row.applicantName || row.creatorName || row.memberName || row.name),
    gender: asText(row.applicantGender || row.creatorGender || row.gender),
    ageDisplay: asText(row.applicantAgeBand || row.creatorAgeDisplay || row.ageDisplay),
    profession: asText(row.applicantProfession || row.creatorProfession || row.profession),
    level: asText(row.applicantLevel || row.creatorLevel || row.level),
    styles: splitSheetList(row.applicantStyles || row.creatorStyles || row.styles),
    memberPreferences: splitSheetList(row.applicantPreferredMembers || row.creatorMemberPreferences || row.creatorPreferredMemberComposition || row.memberPreferences),
    iconSeed: buildPreviewSeed(row, index),
    companionGroup: parsePeopleCount(row.applicantPeople) > 1 ? asText(row.applicationId || row.scheduleId) : ""
  };
}

function buildCompanionPreview(row = {}, companion = {}, index = 0) {
  const companionObject = typeof companion === "object" && companion ? companion : { gender: companion };
  return {
    displayName: asText(companionObject.name || companionObject.displayName || `일행${index + 1}`),
    gender: asText(companionObject.gender || companionObject.value || companionObject),
    ageDisplay: asText(row.applicantAgeBand),
    profession: asText(row.applicantProfession),
    level: asText(row.applicantLevel),
    styles: splitSheetList(row.applicantStyles),
    memberPreferences: splitSheetList(row.applicantPreferredMembers),
    iconSeed: buildPreviewSeed(row, `companion-${index}`),
    companionGroup: asText(row.applicationId || row.scheduleId)
  };
}

function parseCompanionPreviews(row = {}) {
  const raw = asText(row.applicantCompanions || row.creatorCompanions);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item, index) => buildCompanionPreview(row, item || {}, index));
  } catch (error) {
    // Fall through to comma-separated gender values.
  }
  return raw.split(",").map((gender, index) => buildCompanionPreview(row, { gender: gender.trim() }, index)).filter((item) => item.gender);
}

function buildParticipantPreviewList(row = {}, maxCount = 4) {
  const count = parsePeopleCount(row.applicantPeople || row.creatorPeople || "1");
  return [buildParticipantPreview(row, 0), ...parseCompanionPreviews(row)].slice(0, Math.min(maxCount, count));
}

function getFirstDateFromRange(from = "", to = "") {
  return normalizeSheetDateText(from || to || "");
}

function normalizeLightCountry(row = {}) {
  return asText(row.country || row.countryName || row.nation || row.productCountry || row.erpCountry || "");
}

function normalizeLightRegion(row = {}) {
  return asText(row.region || row.city || row.area || row.location || "");
}

function buildNewScheduleSummary(row = {}) {
  const people = parsePeopleCount(row.applicantPeople || row.creatorPeople || "1");
  const capacity = 4;
  const confirmedCount = Math.min(capacity, people);
  const departureDate = getFirstDateFromRange(row.departureDateFrom, row.departureDateTo);
  const returnDate = getFirstDateFromRange(row.returnDateFrom, row.returnDateTo) || departureDate;
  return {
    scheduleId: asText(row.scheduleId),
    applicationId: asText(row.applicationId),
    targetType: "new_schedule",
    memberSeq: asText(row.memberSeq),
    memberId: asText(row.memberId),
    memberName: asText(row.memberName || row.applicantName),
    memberChannel: asText(row.memberChannel),
    memberMobile: normalizePhone(row.memberMobile || row.applicantMobile),
    memberEmail: asText(row.memberEmail),
    erpProductId: asText(row.erpProductId),
    erpEventSeq: asText(row.erpEventSeq),
    title: asText(row.productName),
    country: normalizeLightCountry(row),
    region: normalizeLightRegion(row),
    airline: asText(row.airline),
    departureAirport: asText(row.departureAirport),
    arrivalAirport: asText(row.arrivalAirport),
    departureDate,
    returnDate,
    price: normalizeSheetPriceText(row.productPrice),
    image: asText(row.imageUrl),
    packType: asText(row.packType),
    packTypeName: asText(row.packTypeName),
    flightIncluded: asText(row.flightIncluded),
    roomType: asText(row.applicantRoomType || row.roomType),
    flightRequestType: asText(row.flightRequestType),
    singleRoomSurchargeText: asText(row.singleRoomSurchargeText),
    creatorPreview: buildParticipantPreview(row, "creator"),
    participantsPreview: buildParticipantPreviewList(row, 4),
    confirmedCount,
    remainingSlots: Math.max(0, capacity - confirmedCount),
    approvalStatus: asText(row.approvalStatus || row.applicationStatus || row.status || "approved"),
    displayStatus: asText(row.displayStatus || "visible"),
    sortOrder: row.sortOrder || row.displayOrder || "",
    createdAt: asText(row.createdAt),
    updatedAt: asText(row.updatedAt || row.createdAt),
    shareUrl: asText(row.shareUrl || row.pageUrl)
  };
}

function getParticipantSummaryTargetType(row = {}) {
  const targetType = asText(row.targetType);
  const targetScheduleId = asText(row.targetScheduleId);
  if (targetType === "recommended_schedule" || targetScheduleId.startsWith("admin-recommended-")) return "recommended_schedule";
  return targetType;
}

function getParticipantSummaryKey(row = {}) {
  const targetType = getParticipantSummaryTargetType(row);
  const targetScheduleId = asText(row.targetScheduleId);
  if (targetType === "recommended_schedule" && targetScheduleId) return ["recommended_schedule", targetScheduleId, "", "", ""].join("|");
  return [
    targetType,
    row.targetScheduleId || "",
    row.targetApplicationId || "",
    row.erpProductId || "",
    row.erpEventSeq || ""
  ].map(asText).join("|");
}

function buildParticipantSummaries(rows = []) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = getParticipantSummaryKey(row);
    if (!groups.has(key)) {
      groups.set(key, {
        targetType: getParticipantSummaryTargetType(row),
        targetScheduleId: asText(row.targetScheduleId),
        targetApplicationId: asText(row.targetApplicationId),
        erpProductId: asText(row.erpProductId),
        erpEventSeq: asText(row.erpEventSeq),
        confirmedCount: 0,
        remainingSlots: 4,
        participantsPreview: [],
        lastAppliedAt: ""
      });
    }
    const group = groups.get(key);
    const count = parsePeopleCount(row.applicantPeople || row.people || "1");
    group.confirmedCount = Math.min(4, group.confirmedCount + count);
    group.participantsPreview = group.participantsPreview.concat(buildParticipantPreviewList(row, count)).slice(0, 4);
    group.remainingSlots = Math.max(0, 4 - group.confirmedCount);
    const appliedAt = asText(row.updatedAt || row.createdAt);
    if (appliedAt > asText(group.lastAppliedAt)) group.lastAppliedAt = appliedAt;
  });
  return Array.from(groups.values());
}

function summarizeSheetValues(values = []) {
  const counts = values.map(asText).filter(Boolean).reduce((summary, value) => {
    summary[value] = (summary[value] || 0) + 1;
    return summary;
  }, {});
  return Object.keys(counts).map((key) => `${key} ${counts[key]}`).join(" / ");
}

function dateRangeSummary(from = "", to = "") {
  const start = normalizeSheetDateText(from);
  const end = normalizeSheetDateText(to);
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end || "";
}

function buildRecommendedScheduleId(rule = {}) {
  const idSeed = rule.recommendedScheduleId
    || rule.displayRuleId
    || [rule.erpProductId, rule.erpEventSeq, rule.displayStartAt].map(asText).filter(Boolean).join("-")
    || "rule";
  const safe = asText(idSeed).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `admin-recommended-${safe || "rule"}`;
}

function isActiveRecommendedScheduleRule(rule = {}) {
  const section = asText(rule.section) || "available_schedule";
  const visible = asText(rule.isVisible === undefined || rule.isVisible === "" ? "true" : rule.isVisible).toLowerCase();
  const status = asText(rule.status).toLowerCase();
  return section === "available_schedule" && visible !== "false" && visible !== "0" && visible !== "no" && status !== "cancelled" && status !== "hidden";
}

function buildRecommendedScheduleSummarySource(rule = {}) {
  return {
    scheduleId: buildRecommendedScheduleId(rule),
    sourceApplicationId: rule.recommendedScheduleId || rule.displayRuleId || "",
    applicationId: rule.recommendedScheduleId || rule.displayRuleId || "",
    productName: rule.overrideTitle || rule.productName || rule.erpProductId || "Recommended schedule",
    country: rule.country || "",
    region: rule.region || "",
    departureDateFrom: normalizeSheetDateText(rule.displayStartAt || ""),
    departureDateTo: normalizeSheetDateText(rule.displayStartAt || ""),
    returnDateFrom: normalizeSheetDateText(rule.displayEndAt || rule.displayStartAt || ""),
    returnDateTo: normalizeSheetDateText(rule.displayEndAt || rule.displayStartAt || ""),
    tripSummary: rule.tripSummary || "",
    packType: rule.packType || "",
    packTypeName: rule.packTypeName || "",
    applicantPeople: "0",
    creatorPeople: "0",
    capacity: rule.capacity || rule.maxPeople || "4",
    maxPeople: rule.maxPeople || rule.capacity || "4",
    scheduleType: rule.scheduleType || "",
    scheduleLabel: rule.scheduleLabel || "",
    status: "open",
    approvalStatus: "approved",
    displayStatus: "visible",
    erpProductId: rule.erpProductId || "",
    erpEventSeq: rule.erpEventSeq || "",
    isAdminRecommendedSchedule: true
  };
}

function getScheduleCapacity(schedule = {}) {
  const capacity = Number(asText(schedule.capacity || schedule.maxPeople).replace(/\D/g, ""));
  return Number.isFinite(capacity) && capacity > 0 ? capacity : 4;
}

function isJoinApplicationForSchedule(join = {}, schedule = {}) {
  const targetIds = [
    join.targetJoinId,
    join.targetScheduleId,
    join.targetApplicationId
  ].map(asText).filter(Boolean);
  const scheduleIds = [
    schedule.scheduleId,
    schedule.applicationId,
    schedule.sourceApplicationId
  ].map(asText).filter(Boolean);
  if (targetIds.some((targetId) => scheduleIds.includes(targetId))) return true;
  if (!schedule.isAdminRecommendedSchedule) return false;
  const productId = asText(schedule.erpProductId);
  const eventSeq = asText(schedule.erpEventSeq);
  const targetProductKey = asText(join.targetProductKey || (join.erpProductId && join.erpEventSeq ? `erp:${join.erpProductId}:${join.erpEventSeq}` : ""));
  return Boolean(productId && eventSeq && targetProductKey === `erp:${productId}:${eventSeq}`);
}

function buildScheduleParticipantSummary(schedule = {}, joinRows = []) {
  const relatedJoins = joinRows.filter((join) => isJoinApplicationForSchedule(join, schedule));
  const confirmedJoins = relatedJoins.filter((join) => asText(join.applicationStatus || join.status) !== "cancelled");
  const cancelledJoins = relatedJoins.filter((join) => asText(join.applicationStatus || join.status) === "cancelled");
  const pendingJoins = relatedJoins.filter((join) => asText(join.applicationStatus || join.status) === "pending");
  const creatorPeople = schedule.isAdminRecommendedSchedule ? 0 : parsePeopleCount(schedule.applicantPeople || schedule.creatorPeople || "1");
  const joinedPeople = confirmedJoins.reduce((sum, join) => sum + parsePeopleCount(join.applicantPeople || join.people), 0);
  const capacity = getScheduleCapacity(schedule);
  const confirmedPeople = Math.min(capacity, creatorPeople + joinedPeople);
  const creatorParticipants = creatorPeople > 0 ? [{
    name: schedule.applicantName || schedule.creatorName,
    phone: schedule.applicantMobile || schedule.creatorPhone,
    gender: schedule.applicantGender || schedule.creatorGender,
    age: schedule.applicantAgeBand || schedule.creatorAgeDisplay,
    level: schedule.applicantLevel || schedule.creatorLevel,
    styles: schedule.applicantStyles || schedule.creatorStyles,
    memberPreferences: schedule.applicantPreferredMembers || schedule.creatorMemberPreferences || schedule.creatorPreferredMemberComposition
  }] : [];
  const participants = creatorParticipants.concat(confirmedJoins.map((join) => ({
    name: join.applicantName || join.name,
    phone: join.applicantMobile || join.phone,
    gender: join.applicantGender || join.gender,
    age: join.applicantAgeBand || join.ageDisplay,
    level: join.applicantLevel || join.level,
    styles: join.applicantStyles || join.styles,
    memberPreferences: join.applicantPreferredMembers || join.memberPreferences || join.preferredMemberComposition
  }))).slice(0, capacity);
  return {
    scheduleId: asText(schedule.scheduleId),
    sourceApplicationId: asText(schedule.applicationId || schedule.sourceApplicationId),
    title: asText(schedule.productName || `${schedule.region || "일정"} 맞춤 조인`),
    country: asText(schedule.country),
    region: asText(schedule.region),
    departureSummary: dateRangeSummary(schedule.departureDateFrom, schedule.departureDateTo),
    returnSummary: dateRangeSummary(schedule.returnDateFrom, schedule.returnDateTo),
    tripSummary: asText(schedule.tripSummary),
    creatorName: asText(schedule.applicantName || schedule.creatorName),
    creatorPhone: normalizePhone(schedule.applicantMobile || schedule.creatorPhone),
    capacity,
    creatorPeople,
    joinedPeople,
    confirmedPeople,
    pendingPeople: pendingJoins.reduce((sum, join) => sum + parsePeopleCount(join.applicantPeople || join.people), 0),
    cancelledPeople: cancelledJoins.reduce((sum, join) => sum + parsePeopleCount(join.applicantPeople || join.people), 0),
    remainingSeats: Math.max(0, capacity - confirmedPeople),
    participantNames: participants.map((item) => asText(item.name)).filter(Boolean).join(", "),
    participantPhones: participants.map((item) => normalizePhone(item.phone)).filter(Boolean).join(", "),
    genderSummary: summarizeSheetValues(participants.map((item) => item.gender)),
    ageSummary: summarizeSheetValues(participants.map((item) => item.age)),
    levelSummary: summarizeSheetValues(participants.map((item) => item.level)),
    styleSummary: summarizeSheetValues(participants.flatMap((item) => asText(item.styles).split(",").map(asText))),
    memberPreferenceSummary: summarizeSheetValues(participants.flatMap((item) => asText(item.memberPreferences).split(",").map(asText))),
    status: asText(schedule.applicationStatus || schedule.status || "open"),
    approvalStatus: asText(schedule.approvalStatus || "pending"),
    displayStatus: asText(schedule.displayStatus || "visible"),
    updatedAt: nowKstISOString()
  };
}

function buildJoinApplicationSheetObject(payload = {}, applicationId = "", headers = GOOGLE_SHEET_HEADERS.join_applications) {
  const rowPayload = {
    ...payload,
    applicationId: applicationId || payload.applicationId || payload.joinApplyId
  };
  return headers.reduce((row, header) => {
    row[header] = buildJoinApplicationSheetValue(rowPayload, header);
    return row;
  }, {});
}

function doScheduleIdsMatch(schedule = {}, scheduleId = "", applicationId = "") {
  const normalizedScheduleId = asText(scheduleId);
  const normalizedApplicationId = asText(applicationId);
  return Boolean(
    (normalizedScheduleId && (
      asText(schedule.scheduleId) === normalizedScheduleId
      || asText(schedule.applicationId) === normalizedScheduleId
      || asText(schedule.sourceApplicationId) === normalizedScheduleId
    ))
    || (normalizedApplicationId && (
      asText(schedule.applicationId) === normalizedApplicationId
      || asText(schedule.sourceApplicationId) === normalizedApplicationId
      || asText(schedule.scheduleId) === normalizedApplicationId
    ))
  );
}

function findJoinApplicationTargetSchedule(joinRow = {}, newSchedules = [], recommendedRows = []) {
  const recommendedSchedules = (recommendedRows || [])
    .filter(isActiveRecommendedScheduleRule)
    .map(buildRecommendedScheduleSummarySource);
  const targetType = asText(joinRow.targetType);
  const targetScheduleId = asText(joinRow.targetScheduleId);
  const targetApplicationId = asText(joinRow.targetApplicationId);
  const targetJoinId = asText(joinRow.targetJoinId);
  const wantsRecommended = targetType === "recommended_schedule" || targetJoinId.startsWith("admin-recommended-") || targetScheduleId.startsWith("admin-recommended-");
  const primarySchedules = wantsRecommended ? recommendedSchedules : newSchedules;
  const fallbackSchedules = wantsRecommended ? newSchedules : recommendedSchedules;
  return primarySchedules.find((schedule) => doScheduleIdsMatch(schedule, targetJoinId || targetScheduleId, targetApplicationId))
    || primarySchedules.find((schedule) => isJoinApplicationForSchedule(joinRow, schedule))
    || fallbackSchedules.find((schedule) => doScheduleIdsMatch(schedule, targetJoinId || targetScheduleId, targetApplicationId))
    || fallbackSchedules.find((schedule) => isJoinApplicationForSchedule(joinRow, schedule))
    || null;
}

function getJoinApplicationRequestedPeople(payload = {}, row = {}) {
  return parsePeopleCount(
    getValue(payload, "applicant.people")
    || row.applicantPeople
    || payload.applicantPeople
    || payload.people
    || "1"
  );
}

function createJoinScheduleFullError(details = {}) {
  return createHttpError("join_schedule_full", 409, {
    code: "join_schedule_full",
    reason: "capacity_full",
    ...details
  });
}

function isJoinScheduleFullError(error) {
  return Boolean(error && (error.code === "join_schedule_full" || error.message === "join_schedule_full"));
}

async function assertJoinApplicationCapacityAvailable(payload = {}, applicationId = "") {
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "recommended_schedules"
  ], { timeoutMs: 7000 });
  const joinRows = sheetRows.join_applications || [];
  const newSchedules = sheetRows.new_schedule_applications || [];
  const joinRow = buildJoinApplicationSheetObject(payload, applicationId);
  const targetSchedule = findJoinApplicationTargetSchedule(joinRow, newSchedules, sheetRows.recommended_schedules || []);
  const existingIndex = joinRows.findIndex((row) => asText(row.applicationId || row.joinApplyId) === applicationId);
  if (!targetSchedule) {
    return {
      joinRows,
      existingIndex,
      existingRow: existingIndex >= 0 ? joinRows[existingIndex] : {},
      summary: null
    };
  }
  const requestedPeople = getJoinApplicationRequestedPeople(payload, joinRow);
  const capacityRows = joinRows.filter((row) => asText(row.applicationId || row.joinApplyId) !== applicationId);
  const summary = buildScheduleParticipantSummary(targetSchedule, capacityRows);
  if (requestedPeople > Number(summary.remainingSeats || 0)) {
    throw createJoinScheduleFullError({
      scheduleId: asText(summary.scheduleId || targetSchedule.scheduleId),
      targetScheduleId: asText(joinRow.targetScheduleId),
      targetApplicationId: asText(joinRow.targetApplicationId),
      remainingSeats: Number(summary.remainingSeats || 0),
      requestedPeople,
      capacity: Number(summary.capacity || getScheduleCapacity(targetSchedule)),
      confirmedPeople: Number(summary.confirmedPeople || 0)
    });
  }
  return {
    joinRows,
    existingIndex,
    existingRow: existingIndex >= 0 ? joinRows[existingIndex] : {},
    summary
  };
}

function buildDisplayRuleSummary(row = {}) {
  return {
    recommendedScheduleId: asText(row.recommendedScheduleId || row.displayRuleId),
    targetType: "recommended_schedule",
    targetId: asText(row.recommendedScheduleId || row.displayRuleId || row.erpProductId),
    erpProductId: asText(row.erpProductId),
    erpEventSeq: asText(row.erpEventSeq),
    section: asText(row.section),
    displayStatus: asText(row.displayStatus || (asText(row.isVisible || "true").toLowerCase() === "false" ? "hidden" : "visible")),
    approvalStatus: asText(row.approvalStatus || "approved"),
    isVisible: row.isVisible,
    isPinned: row.isPinned,
    sectionKey: asText(row.section),
    sortOrder: row.displayOrder || "",
    displayOrder: row.displayOrder || "",
    badge: asText(row.badgeType),
    badgeType: asText(row.badgeType),
    scheduleType: asText(row.scheduleType),
    scheduleLabel: asText(row.scheduleLabel),
    capacity: row.capacity || row.maxPeople || "",
    maxPeople: row.maxPeople || row.capacity || "",
    packType: asText(row.packType),
    packTypeName: asText(row.packTypeName),
    overrideTitle: asText(row.overrideTitle),
    overrideImageUrl: asText(row.overrideImageUrl),
    country: asText(row.country),
    region: asText(row.region),
    airline: asText(row.airline),
    departureAirport: asText(row.departureAirport),
    arrivalAirport: asText(row.arrivalAirport),
    productPrice: normalizeSheetPriceText(row.productPrice),
    price: normalizeSheetPriceText(row.productPrice),
    displayStartAt: normalizeSheetDateText(row.displayStartAt),
    displayEndAt: normalizeSheetDateText(row.displayEndAt),
    tripSummary: asText(row.tripSummary),
    updatedAt: asText(row.updatedAt)
  };
}

function filterSheetRowsForHome(rows = [], filters = {}) {
  const source = asText(filters.source);
  const status = asText(filters.status);
  const filtered = rows.filter((row) => {
    if (source && asText(row.source) && asText(row.source) !== source) return false;
    if (status && asText(row.status || row.applicationStatus) !== status) return false;
    return true;
  }).sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || a.submittedAt || 0).getTime() || 0;
    const bTime = new Date(b.updatedAt || b.createdAt || b.submittedAt || 0).getTime() || 0;
    return bTime - aTime;
  });
  const limit = Math.max(0, Math.round(Number(filters.limit) || 0));
  return limit ? filtered.slice(0, limit) : filtered;
}

function normalizeSheetRowForJson(row = {}) {
  const dateKeys = new Set([
    "departureDateFrom",
    "departureDateTo",
    "returnDateFrom",
    "returnDateTo",
    "departureDate",
    "returnDate",
    "displayStartAt",
    "displayEndAt"
  ]);
  return Object.entries(row).reduce((object, [key, value]) => {
    if (key === "productPrice") {
      object[key] = normalizeSheetPriceText(value);
    } else if (dateKeys.has(key)) {
      object[key] = normalizeSheetDateText(value);
    } else if (["memberMobile", "applicantMobile", "creatorPhone"].includes(key)) {
      object[key] = normalizePhone(value);
    } else {
      object[key] = value;
    }
    return object;
  }, {});
}

async function readHomeBootstrapViaSheetsApi(params = {}) {
  const newScheduleLimit = Math.min(Math.max(Number(params.newScheduleLimit || 100), 1), 100);
  const joinApplicationLimit = Math.min(Math.max(Number(params.joinApplicationLimit || 50), 1), 100);
  const reviewLimit = Math.min(Math.max(Number(params.reviewLimit || 200), 1), 200);
  const wishLimit = Math.min(Math.max(Number(params.wishLimit || 200), 1), 200);
  const memberSeq = asText(params.memberSeq);
  const memberId = asText(params.memberId);
  const memberMobile = normalizePhone(params.memberMobile || params.phone);
  const canReadWishes = Boolean(memberMobile && (memberSeq || memberId));
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "join_reviews",
    "recommended_schedules",
    "join_member_profiles",
    "join_wishes"
  ], { timeoutMs: 8000 });
  const newSchedules = filterSheetRowsForHome(sheetRows.new_schedule_applications || [], {
    source: "new_schedule_builder",
    limit: newScheduleLimit
  }).map(normalizeSheetRowForJson).map(sanitizePublicRow);
  const joinApplications = filterSheetRowsForHome(sheetRows.join_applications || [], {
    source: "join_apply",
    limit: joinApplicationLimit
  }).map(normalizeSheetRowForJson).map(sanitizePublicRow);
  const reviews = filterSheetRowsForHome(sheetRows.join_reviews || [], {
    source: "join_review",
    status: "visible",
    limit: reviewLimit
  }).map(normalizeSheetRowForJson).map(sanitizePublicRow);
  const displayRules = filterSheetRowsForHome(sheetRows.recommended_schedules || [], {
    limit: 100
  }).filter((row) => (
    asText(row.section) === "available_schedule"
    && asText(row.isVisible || "true").toLowerCase() !== "false"
  )).map(normalizeSheetRowForJson).map(sanitizePublicRow);
  const wishes = canReadWishes
    ? sortRowsByUpdatedAtDesc((sheetRows.join_wishes || []).filter((row) => (
      asText(row.source) === "join_wish"
      && asText(row.status || "active") === "active"
      && rowMatchesJoinWishLookup(row, { memberSeq, memberId, memberMobile })
    ))).slice(0, wishLimit).map(normalizeSheetRowForJson).map(sanitizeJoinWishLookupRow)
    : [];
  return {
    newSchedules,
    joinApplications,
    reviews,
    wishes,
    displayRules,
    profileCount: (sheetRows.join_member_profiles || []).filter(hasCompletedJoinMemberProfile).length,
    visitorCount: 0,
    activeUserCount: 0,
    source: "sheets_api",
    warnings: []
  };
}

async function readAdminBootstrapViaSheetsApi(params = {}) {
  const limit = Math.min(Math.max(Number(params?.limit || 1000), 1), 3000);
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "join_member_profiles",
    "recommended_schedules"
  ], { timeoutMs: 7000 });
  const normalizeRows = (rows = []) => rows.slice(0, limit).map(normalizeAdminSheetRowForJson);
  return {
    ok: true,
    updatedAt: nowKstISOString(),
    builderRows: normalizeRows(sheetRows.new_schedule_applications || []),
    joinRows: normalizeRows(sheetRows.join_applications || []),
    profileRows: normalizeRows(sheetRows.join_member_profiles || []),
    displayRuleRows: normalizeRows(sheetRows.recommended_schedules || []),
    source: "sheets_api"
  };
}

function createHomeBootstrapCacheKey(params = {}) {
  return [
    asText(params.memberSeq),
    asText(params.memberId),
    normalizePhone(params.memberMobile || params.phone),
    Math.min(Math.max(Number(params.newScheduleLimit || 100), 1), 100),
    Math.min(Math.max(Number(params.joinApplicationLimit || 50), 1), 100),
    Math.min(Math.max(Number(params.reviewLimit || 200), 1), 200),
    Math.min(Math.max(Number(params.wishLimit || 200), 1), 200)
  ].join("|");
}

function cloneHomeBootstrapPayload(payload = {}) {
  return {
    newSchedules: Array.isArray(payload.newSchedules) ? payload.newSchedules : [],
    joinApplications: Array.isArray(payload.joinApplications) ? payload.joinApplications : [],
    reviews: Array.isArray(payload.reviews) ? payload.reviews : [],
    wishes: Array.isArray(payload.wishes) ? payload.wishes : [],
    displayRules: Array.isArray(payload.displayRules) ? payload.displayRules : [],
    profileCount: Math.max(0, Math.round(Number(payload.profileCount) || 0)),
    visitorCount: Math.max(0, Math.round(Number(payload.visitorCount) || 0)),
    activeUserCount: Math.max(0, Math.round(Number(payload.activeUserCount) || 0)),
    source: asText(payload.source),
    warnings: Array.isArray(payload.warnings) ? [...payload.warnings] : [],
    cache: payload.cache || undefined
  };
}

function createHomeBootstrapLightCacheKey(params = {}) {
  return [
    "public-v2",
    Math.min(Math.max(Number(params.newScheduleLimit || 100), 1), 100),
    Math.min(Math.max(Number(params.joinApplicationLimit || 100), 1), 200)
  ].join("|");
}

function cloneHomeBootstrapLightPayload(payload = {}) {
  return sanitizeHomeBootstrapLightPayload(payload);
}

function hasCompletedJoinMemberProfile(row = {}) {
  return Boolean(
    asText(row.gender)
    && asText(row.birthYear)
    && asText(row.level)
    && asText(row.travelStyles || row.styles)
  );
}

async function getGoogleMetadataAccessToken() {
  const response = await fetchWithTimeout("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    method: "GET",
    headers: { "Metadata-Flavor": "Google", "Accept": "application/json" }
  }, 8000, "Google metadata token");
  const text = await response.text();
  if (!response.ok) throw createHttpError(`Google metadata token failed: ${response.status}`, response.status);
  const payload = JSON.parse(text || "{}");
  const token = asText(payload.access_token);
  if (!token) throw createHttpError("Google metadata token is empty", 502);
  return token;
}

function escapeGoogleSheetNameForRange(sheetName = "") {
  return asText(sheetName).replace(/'/g, "''");
}

function mapGoogleSheetValuesToRows(values = []) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = values[0].map((header) => asText(header));
  return values.slice(1).map((row) => headers.reduce((object, header, index) => {
    if (!header) return object;
    object[header] = row[index] == null ? "" : row[index];
    return object;
  }, {}));
}

async function readGoogleSheetRowsViaApi(sheetName, options = {}) {
  if (!GOOGLE_SHEET_ID) throw createHttpError("GOOGLE_SHEET_ID is not configured", 500);
  const token = await getGoogleMetadataAccessToken();
  const range = `'${escapeGoogleSheetNameForRange(sheetName)}'!A:ZZ`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}/values/${encodeURIComponent(range)}`);
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", options.valueRenderOption || "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");
  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    }
  }, options.timeoutMs || 5000, `Google Sheets header read ${sheetName}`);
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Google Sheets API read failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }
  const payload = JSON.parse(text || "{}");
  return mapGoogleSheetValuesToRows(payload.values || []);
}

async function readGoogleSheetHeaderViaApi(sheetName, options = {}) {
  if (!GOOGLE_SHEET_ID) throw createHttpError("GOOGLE_SHEET_ID is not configured", 500);
  const token = await getGoogleMetadataAccessToken();
  const range = `'${escapeGoogleSheetNameForRange(sheetName)}'!1:1`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}/values/${encodeURIComponent(range)}`);
  url.searchParams.set("majorDimension", "ROWS");
  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    }
  }, options.timeoutMs || 5000, `Google Sheets read ${sheetName}`);
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Google Sheets API header read failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }
  const payload = JSON.parse(text || "{}");
  return (payload.values?.[0] || []).map((header) => asText(header)).filter(Boolean);
}

async function ensureGoogleSheetHeadersViaApi(sheetName, options = {}) {
  const expectedHeaders = GOOGLE_SHEET_HEADERS[sheetName] || [];
  if (!expectedHeaders.length) return [];
  const currentHeaders = await readGoogleSheetHeaderViaApi(sheetName, options);
  if (!currentHeaders.length) {
    await writeGoogleSheetValuesViaApi(`'${escapeGoogleSheetNameForRange(sheetName)}'!1:1`, [expectedHeaders], options);
    return expectedHeaders;
  }
  const currentSet = new Set(currentHeaders);
  const missingHeaders = expectedHeaders.filter((header) => !currentSet.has(header));
  if (!missingHeaders.length) return currentHeaders;
  const mergedHeaders = currentHeaders.concat(missingHeaders);
  await writeGoogleSheetValuesViaApi(`'${escapeGoogleSheetNameForRange(sheetName)}'!1:1`, [mergedHeaders], options);
  return mergedHeaders;
}

async function readGoogleSheetRangesViaApi(sheetNames = [], options = {}) {
  if (!GOOGLE_SHEET_ID) throw createHttpError("GOOGLE_SHEET_ID is not configured", 500);
  const names = sheetNames.map(asText).filter(Boolean);
  if (!names.length) return {};
  const token = await getGoogleMetadataAccessToken();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}/values:batchGet`);
  names.forEach((sheetName) => {
    url.searchParams.append("ranges", `'${escapeGoogleSheetNameForRange(sheetName)}'!A:ZZ`);
  });
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", options.valueRenderOption || "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");
  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    }
  }, options.timeoutMs || 6000, "Google Sheets batch read");
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Google Sheets API batch read failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }
  const payload = JSON.parse(text || "{}");
  const valueRanges = Array.isArray(payload.valueRanges) ? payload.valueRanges : [];
  return names.reduce((object, sheetName, index) => {
    object[sheetName] = mapGoogleSheetValuesToRows(valueRanges[index]?.values || []);
    return object;
  }, {});
}

async function writeGoogleSheetValuesViaApi(range, values = [], options = {}) {
  if (!GOOGLE_SHEET_ID) throw createHttpError("GOOGLE_SHEET_ID is not configured", 500);
  const token = await getGoogleMetadataAccessToken();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}/values/${encodeURIComponent(range)}`);
  url.searchParams.set("valueInputOption", options.valueInputOption || "USER_ENTERED");
  const response = await fetchWithTimeout(url.toString(), {
    method: options.method || "PUT",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values })
  }, options.timeoutMs || 6000, "Google Sheets write");
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Google Sheets API write failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }
  return JSON.parse(text || "{}");
}

async function appendGoogleSheetValuesViaApi(sheetName, values = [], options = {}) {
  if (!GOOGLE_SHEET_ID) throw createHttpError("GOOGLE_SHEET_ID is not configured", 500);
  const token = await getGoogleMetadataAccessToken();
  const range = `'${escapeGoogleSheetNameForRange(sheetName)}'!A:ZZ`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}/values/${encodeURIComponent(range)}:append`);
  url.searchParams.set("valueInputOption", options.valueInputOption || "USER_ENTERED");
  url.searchParams.set("insertDataOption", options.insertDataOption || "INSERT_ROWS");
  const response = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values: [values] })
  }, options.timeoutMs || 6000, `Google Sheets append ${sheetName}`);
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Google Sheets API append failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }
  return JSON.parse(text || "{}");
}

function buildJoinWishSheetValue(payload = {}, header = "") {
  const createdAt = payload.createdAt || payload.savedAt || nowKstISOString();
  const targetType = payload.targetType || getValue(payload, "target.type") || "product";
  const targetKey = payload.targetKey
    || getValue(payload, "target.targetKey")
    || getValue(payload, "target.key")
    || getValue(payload, "product.erpProductId")
    || getValue(payload, "product.productId")
    || payload.erpProductId
    || payload.goodSeq
    || "";
  const wishId = payload.wishId || buildGoogleSheetRecordId(
    "jw",
    getValue(payload, "member.memberSeq") || getValue(payload, "member.memberId") || getValue(payload, "member.memberName") || "member",
    targetType,
    targetKey
  );
  const values = {
    wishId,
    createdAt,
    source: payload.source || "join_wish",
    pageUrl: payload.pageUrl || "",
    memberSeq: getValue(payload, "member.memberSeq"),
    memberId: getValue(payload, "member.memberId"),
    memberName: getValue(payload, "member.memberName"),
    memberChannel: getValue(payload, "member.memberChannel"),
    memberMobile: normalizePhone(getValue(payload, "member.memberMobile")),
    memberEmail: getValue(payload, "member.memberEmail"),
    targetType,
    targetKey,
    targetScheduleId: payload.targetScheduleId || getValue(payload, "target.scheduleId"),
    targetApplicationId: payload.targetApplicationId || getValue(payload, "target.applicationId"),
    erpProductId: payload.erpProductId || getValue(payload, "product.erpProductId") || getValue(payload, "product.productId"),
    erpEventSeq: payload.erpEventSeq || getValue(payload, "product.erpEventSeq") || getValue(payload, "product.eventSeq"),
    productName: getValue(payload, "product.productName") || payload.productName,
    departureDate: getValue(payload, "product.departureDate") || payload.departureDate,
    returnDate: getValue(payload, "product.returnDate") || payload.returnDate,
    category: getValue(payload, "product.category") || payload.category,
    country: getValue(payload, "product.country") || payload.country || "",
    region: getValue(payload, "product.region") || payload.region,
    imageUrl: getValue(payload, "product.imageUrl") || payload.imageUrl,
    price: getValue(payload, "product.price") || payload.price,
    status: payload.status || "active",
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString()
  };
  return values[header] == null ? "" : values[header];
}

function buildJoinWishSheetRow(payload = {}, existingRow = {}) {
  return GOOGLE_SHEET_HEADERS.join_wishes.map((header) => {
    if (header === "createdAt" && existingRow.createdAt) return existingRow.createdAt;
    return buildJoinWishSheetValue(payload, header);
  });
}

function buildJoinMemberProfileSheetValue(payload = {}, header = "") {
  const createdAt = payload.createdAt || payload.submittedAt || nowKstISOString();
  const profileId = payload.profileId || buildGoogleSheetRecordId(
    "jmp",
    createdAt,
    getValue(payload, "member.memberSeq") || payload.memberSeq || getValue(payload, "member.memberId") || payload.memberId || getValue(payload, "member.memberName") || payload.memberName || "member"
  );
  const travelStyles = getValue(payload, "profile.travelStyles") ?? payload.travelStyles;
  const values = {
    profileId,
    createdAt,
    source: payload.source || "join_member_profile",
    pageUrl: payload.pageUrl || "",
    memberSeq: getValue(payload, "member.memberSeq") || payload.memberSeq,
    memberId: getValue(payload, "member.memberId") || payload.memberId,
    memberName: getValue(payload, "member.memberName") || payload.memberName,
    memberChannel: getValue(payload, "member.memberChannel") || payload.memberChannel,
    memberMobile: normalizePhone(getValue(payload, "member.memberMobile") || payload.memberMobile),
    memberEmail: getValue(payload, "member.memberEmail") || payload.memberEmail,
    birthYear: getValue(payload, "profile.birthYear") || payload.birthYear,
    gender: getValue(payload, "profile.gender") || payload.gender,
    profession: getValue(payload, "profile.profession") || payload.profession,
    level: getValue(payload, "profile.level") || payload.level,
    travelStyles: Array.isArray(travelStyles) ? travelStyles.map(asText).filter(Boolean).join(", ") : asText(travelStyles),
    profileImageUrl: getValue(payload, "profile.profileImageUrl") || payload.profileImageUrl,
    profileImageObjectName: getValue(payload, "profile.profileImageObjectName") || payload.profileImageObjectName,
    profileImageSize: getValue(payload, "profile.profileImageSize") || payload.profileImageSize,
    requiredAgreed: getValue(payload, "profile.requiredAgreed") ?? payload.requiredAgreed,
    marketingAgreed: getValue(payload, "profile.marketingAgreed") ?? payload.marketingAgreed,
    termsAgreedAt: getValue(payload, "profile.termsAgreedAt") || payload.termsAgreedAt || createdAt,
    kakaoId: getValue(payload, "kakao.kakaoId") || payload.kakaoId,
    kakaoNickname: getValue(payload, "kakao.nickname") || payload.kakaoNickname,
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString()
  };
  return values[header] == null ? "" : values[header];
}

function buildJoinMemberProfileSheetRow(payload = {}, existingRow = {}) {
  return GOOGLE_SHEET_HEADERS.join_member_profiles.map((header) => {
    if (header === "createdAt" && existingRow.createdAt) return existingRow.createdAt;
    return buildJoinMemberProfileSheetValue(payload, header);
  });
}

async function saveJoinMemberProfileViaSheetsApi(payload = {}) {
  const profileId = asText(payload.profileId || buildJoinMemberProfileSheetValue(payload, "profileId"));
  if (!profileId) throw createHttpError("profileId is required", 400);
  const rows = await readGoogleSheetRowsViaApi("join_member_profiles", { timeoutMs: 5000 });
  const existingIndex = rows.findIndex((row) => asText(row.profileId) === profileId);
  const existingRow = existingIndex >= 0 ? rows[existingIndex] : {};
  const rowValues = buildJoinMemberProfileSheetRow({ ...payload, profileId }, existingRow);
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await updateGoogleSheetRowViaApi("join_member_profiles", rowNumber, rowValues, { timeoutMs: 6000 });
    return { ok: true, sheet: "join_member_profiles", write: "update", row: rowNumber, source: "sheets_api" };
  }
  const response = await appendGoogleSheetValuesViaApi("join_member_profiles", rowValues, { timeoutMs: 6000 });
  return {
    ok: true,
    sheet: "join_member_profiles",
    write: "append",
    row: response.updates?.updatedRange || "",
    source: "sheets_api"
  };
}

function buildJoinReviewSheetValue(payload = {}, header = "") {
  const createdAt = payload.createdAt || payload.submittedAt || nowKstISOString();
  const reviewId = payload.reviewId || buildGoogleSheetRecordId(
    "jr",
    createdAt,
    getValue(payload, "member.memberSeq") || getValue(payload, "member.memberId") || getValue(payload, "member.memberName") || "member",
    getValue(payload, "product.erpProductId") || payload.erpProductId || getValue(payload, "product.productName")
  );
  const tags = payload.tags ?? getValue(payload, "review.tags");
  const reviewImages = getValue(payload, "review.images");
  const values = {
    reviewId,
    createdAt,
    source: payload.source || "join_review",
    pageUrl: payload.pageUrl || "",
    memberSeq: getValue(payload, "member.memberSeq"),
    memberId: getValue(payload, "member.memberId"),
    memberName: getValue(payload, "member.memberName"),
    memberMobile: normalizePhone(getValue(payload, "member.memberMobile")),
    memberEmail: getValue(payload, "member.memberEmail"),
    targetType: payload.targetType || getValue(payload, "target.type") || "erp_product",
    targetScheduleId: payload.targetScheduleId || getValue(payload, "target.scheduleId"),
    targetApplicationId: payload.targetApplicationId || getValue(payload, "target.applicationId"),
    erpProductId: payload.erpProductId || getValue(payload, "product.erpProductId") || getValue(payload, "product.productId"),
    erpEventSeq: payload.erpEventSeq || getValue(payload, "product.erpEventSeq") || getValue(payload, "product.eventSeq"),
    productName: getValue(payload, "product.productName") || payload.productName,
    departureDate: getValue(payload, "product.departureDate") || payload.departureDate,
    returnDate: getValue(payload, "product.returnDate") || payload.returnDate,
    country: getValue(payload, "product.country") || payload.country || "",
    region: getValue(payload, "product.region") || payload.region,
    rating: payload.rating || getValue(payload, "review.rating"),
    tags: Array.isArray(tags) ? tags.map(asText).filter(Boolean).join(", ") : asText(tags),
    reviewText: payload.reviewText || getValue(payload, "review.text"),
    photoName: payload.photoName || getValue(payload, "review.photoName"),
    imageUrl: payload.imageUrl || getValue(payload, "review.imageUrl"),
    thumbnailUrl: payload.thumbnailUrl || getValue(payload, "review.thumbnailUrl"),
    imagesJson: payload.imagesJson || (Array.isArray(reviewImages) ? JSON.stringify(reviewImages) : ""),
    status: payload.status || "visible",
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString()
  };
  return values[header] == null ? "" : values[header];
}

function buildJoinReviewSheetRow(payload = {}, existingRow = {}) {
  return GOOGLE_SHEET_HEADERS.join_reviews.map((header) => {
    if (header === "createdAt" && existingRow.createdAt) return existingRow.createdAt;
    return buildJoinReviewSheetValue(payload, header);
  });
}

function joinSheetList(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  return asText(value);
}

function stringifySheetCompanions(value) {
  if (!value) return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  return asText(value);
}

function firstSheetListValue(value) {
  if (Array.isArray(value)) return value.map(asText).find(Boolean) || "";
  const text = asText(value);
  if (!text) return "";
  return text.split(",").map(asText).find(Boolean) || text;
}

function lastSheetListValue(value) {
  if (Array.isArray(value)) {
    const items = value.map(asText).filter(Boolean);
    return items[items.length - 1] || "";
  }
  const text = asText(value);
  if (!text) return "";
  const items = text.split(",").map(asText).filter(Boolean);
  return items[items.length - 1] || text;
}

function buildNewScheduleApplicationSheetValue(payload = {}, header = "") {
  const createdAt = payload.createdAt || payload.submittedAt || nowKstISOString();
  const applicationId = payload.applicationId || buildGoogleSheetRecordId(
    "nsa",
    createdAt,
    getPayloadMemberKey(payload) || getValue(payload, "member.memberSeq") || getValue(payload, "member.memberId") || getValue(payload, "member.memberName") || "member"
  );
  const scheduleId = payload.scheduleId || buildGoogleSheetRecordId("sch", applicationId);
  const packTypeValue = getValue(payload, "trip.packType") || payload.packType;
  const packTypeNameValue = getValue(payload, "trip.packTypeName") || payload.packTypeName;
  const rawAirlineValue = getValue(payload, "trip.airline")
    || getValue(payload, "product.airline")
    || getValue(payload, "product.airlineName")
    || getValue(payload, "product.airlineNm")
    || getValue(payload, "product.air2Nm")
    || getValue(payload, "product.air2CdNm");
  const rawDepartureAirportValue = getValue(payload, "trip.departureAirport")
    || getValue(payload, "product.departureAirport")
    || getValue(payload, "product.airport");
  const isGolfPack = asText(packTypeValue).toLowerCase() === "golf" || asText(packTypeNameValue).includes("\uACE8\uD504");
  const values = {
    applicationId,
    scheduleId,
    createdAt,
    source: payload.source || "new_schedule_builder",
    pageUrl: payload.pageUrl || "",
    memberSeq: getValue(payload, "member.memberSeq"),
    memberId: getValue(payload, "member.memberId"),
    memberName: getValue(payload, "member.memberName"),
    memberChannel: getValue(payload, "member.memberChannel"),
    memberMobile: normalizePhone(getValue(payload, "member.memberMobile")),
    memberEmail: getValue(payload, "member.memberEmail"),
    applicantName: getValue(payload, "applicant.name"),
    applicantGender: getValue(payload, "applicant.gender"),
    applicantBirthYear: getValue(payload, "applicant.birthYear"),
    applicantAgeBand: getValue(payload, "applicant.ageDisplay"),
    applicantMobile: normalizePhone(getValue(payload, "applicant.phone")),
    applicantProfession: getValue(payload, "applicant.profession"),
    applicantPeople: getValue(payload, "applicant.people"),
    applicantCompanions: stringifySheetCompanions(getValue(payload, "applicant.companions")),
    applicantLevel: getValue(payload, "applicant.level"),
    applicantStyles: joinSheetList(getValue(payload, "applicant.styles")),
    applicantPreferredMembers: joinSheetList(getValue(payload, "applicant.preferredMemberComposition") || getValue(payload, "applicant.memberPreferences")),
    applicantGreeting: getValue(payload, "applicant.greeting"),
    applicantRoomType: getValue(payload, "applicant.roomType") || "2\uC778\uC2E4",
    flightRequestType: getValue(payload, "applicant.flightRequestType"),
    singleRoomSurcharge: getValue(payload, "applicant.singleRoomSurcharge"),
    singleRoomSurchargeText: getValue(payload, "applicant.singleRoomSurchargeText"),
    singleRoomSurchargeStatus: getValue(payload, "applicant.singleRoomSurchargeStatus"),
    country: getValue(payload, "trip.country") || getValue(payload, "product.country") || payload.country || "",
    region: getValue(payload, "trip.region") || getValue(payload, "product.region") || payload.region,
    airline: isGolfPack ? (rawAirlineValue || "\uAC1C\uBCC4\uD56D\uACF5") : rawAirlineValue,
    departureAirport: isGolfPack ? "" : rawDepartureAirportValue,
    arrivalAirport: getValue(payload, "trip.arrivalAirport") || getValue(payload, "product.arrivalAirport") || getValue(payload, "product.region"),
    erpProductId: getValue(payload, "trip.erpProductId") || getValue(payload, "trip.productId"),
    erpEventSeq: getValue(payload, "trip.erpEventSeq") || getValue(payload, "trip.eventSeq"),
    productName: getValue(payload, "trip.productName"),
    productPrice: normalizeSheetPriceText(getValue(payload, "trip.productPrice") || payload.productPrice || payload.price),
    packType: packTypeValue,
    packTypeName: packTypeNameValue,
    tripSummary: getValue(payload, "trip.tripSummary"),
    departureDateFrom: normalizeSheetDateText(getValue(payload, "trip.flexibleDays.startBefore") || firstSheetListValue(getValue(payload, "trip.departureDates")) || getValue(payload, "trip.startSummary")),
    departureDateTo: normalizeSheetDateText(getValue(payload, "trip.flexibleDays.startAfter") || lastSheetListValue(getValue(payload, "trip.departureDates")) || getValue(payload, "trip.startSummary")),
    returnDateFrom: normalizeSheetDateText(getValue(payload, "trip.flexibleDays.endBefore") || firstSheetListValue(getValue(payload, "trip.returnDates")) || getValue(payload, "trip.endSummary")),
    returnDateTo: normalizeSheetDateText(getValue(payload, "trip.flexibleDays.endAfter") || lastSheetListValue(getValue(payload, "trip.returnDates")) || getValue(payload, "trip.endSummary")),
    participantStatus: payload.participantStatus || getValue(payload, "payment.participantStatus") || "\uC2E0\uCCAD",
    quoteStatus: payload.quoteStatus || getValue(payload, "payment.quoteStatus") || "",
    depositStatus: payload.depositStatus || getValue(payload, "payment.depositStatus") || "",
    balanceStatus: payload.balanceStatus || getValue(payload, "payment.balanceStatus") || "",
    refundStatus: payload.refundStatus || getValue(payload, "payment.refundStatus") || "",
    requiredAgreed: getValue(payload, "agreements.required"),
    marketingAgreed: getValue(payload, "agreements.marketing"),
    approvalStatus: payload.approvalStatus || "pending",
    displayStatus: payload.displayStatus || "visible",
    applicationStatus: payload.applicationStatus || payload.status || "open",
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString(),
    memberKey: getPayloadMemberKey(payload),
    kakaoId: getValue(payload, "member.kakaoId") || getValue(payload, "kakao.kakaoId") || payload.kakaoId
  };
  return values[header] == null ? "" : values[header];
}

function buildNewScheduleApplicationSheetRow(payload = {}, existingRow = {}, headers = GOOGLE_SHEET_HEADERS.new_schedule_applications) {
  return headers.map((header) => {
    if (header === "createdAt" && existingRow.createdAt) return existingRow.createdAt;
    return buildNewScheduleApplicationSheetValue(payload, header);
  });
}

function buildRecommendedScheduleSheetValue(payload = {}, header = "") {
  const erpProductId = getValue(payload, "product.erpProductId") || payload.erpProductId || payload.goodSeq || "";
  const erpEventSeq = getValue(payload, "product.erpEventSeq") || payload.erpEventSeq || payload.eventSeq || "";
  const section = payload.section || "available_schedule";
  const recommendedScheduleId = payload.recommendedScheduleId
    || payload.displayRuleId
    || buildGoogleSheetRecordId("rs", erpProductId, erpEventSeq, section);
  const normalizedCapacity = normalizeRecommendedSchedulePeopleValue(payload.capacity, payload.maxPeople);
  const normalizedMaxPeople = normalizeRecommendedSchedulePeopleValue(payload.maxPeople, payload.capacity);
  const values = {
    recommendedScheduleId,
    erpProductId,
    erpEventSeq,
    section,
    isVisible: payload.isVisible === false ? false : asText(payload.isVisible || "true"),
    isPinned: payload.isPinned === true || asText(payload.isPinned).toLowerCase() === "true",
    displayOrder: payload.displayOrder || 0,
    badgeType: payload.badgeType || "recommended",
    scheduleType: payload.scheduleType || "",
    scheduleLabel: payload.scheduleLabel || "",
    capacity: normalizedCapacity,
    maxPeople: normalizedMaxPeople,
    packType: payload.packType || getValue(payload, "product.packType") || "",
    packTypeName: payload.packTypeName || getValue(payload, "product.packTypeName") || "",
    overrideTitle: payload.overrideTitle || getValue(payload, "product.productName") || "",
    overrideImageUrl: payload.overrideImageUrl || getValue(payload, "product.imageUrl") || "",
    country: payload.country || getValue(payload, "product.country") || "",
    region: payload.region || getValue(payload, "product.region") || "",
    airline: payload.airline
      || getValue(payload, "product.airline")
      || getValue(payload, "product.airlineName")
      || getValue(payload, "product.airlineNm")
      || getValue(payload, "product.air2Nm")
      || getValue(payload, "product.air2CdNm")
      || "",
    departureAirport: payload.departureAirport || getValue(payload, "product.departureAirport") || getValue(payload, "product.airport") || "",
    arrivalAirport: payload.arrivalAirport || getValue(payload, "product.arrivalAirport") || getValue(payload, "product.region") || "",
    productPrice: normalizeSheetPriceText(payload.productPrice || payload.price || getValue(payload, "product.price")),
    displayStartAt: normalizeSheetDateText(payload.displayStartAt || getValue(payload, "product.departureDate") || ""),
    displayEndAt: normalizeSheetDateText(payload.displayEndAt || getValue(payload, "product.returnDate") || payload.displayStartAt || getValue(payload, "product.departureDate") || ""),
    tripSummary: payload.tripSummary || getValue(payload, "product.tripSummary") || "",
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString()
  };
  return values[header] == null ? "" : values[header];
}

function buildRecommendedScheduleSheetRow(payload = {}, existingRow = {}) {
  return GOOGLE_SHEET_HEADERS.recommended_schedules.map((header) => {
    if (header === "recommendedScheduleId" && existingRow.recommendedScheduleId) return existingRow.recommendedScheduleId;
    return buildRecommendedScheduleSheetValue(payload, header);
  });
}

function normalizeRecommendedSchedulePeopleValue(...values) {
  for (const value of values) {
    const number = Number(asText(value).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(number) && number > 0) return String(Math.max(1, Math.min(200, Math.round(number))));
  }
  return "";
}

function buildJoinApplicationSheetValue(payload = {}, header = "") {
  const createdAt = payload.createdAt || payload.submittedAt || nowKstISOString();
  const applicationId = payload.applicationId || payload.joinApplyId || buildGoogleSheetRecordId(
    "join",
    createdAt,
    getPayloadMemberKey(payload) || getValue(payload, "member.memberSeq") || getValue(payload, "member.memberId") || getValue(payload, "member.memberName") || "member"
  );
  const erpProductId = payload.erpProductId || getValue(payload, "product.erpProductId") || getValue(payload, "product.productId");
  const erpEventSeq = payload.erpEventSeq || getValue(payload, "product.erpEventSeq") || getValue(payload, "product.eventSeq");
  const targetJoinId = payload.targetJoinId || getValue(payload, "target.joinId") || getValue(payload, "join.id");
  const targetProductKey = payload.targetProductKey || getValue(payload, "target.productKey") || (erpProductId && erpEventSeq ? `erp:${erpProductId}:${erpEventSeq}` : "");
  const values = {
    applicationId,
    createdAt,
    source: payload.source || "join_apply",
    pageUrl: payload.pageUrl || "",
    memberSeq: getValue(payload, "member.memberSeq"),
    memberId: getValue(payload, "member.memberId"),
    memberName: getValue(payload, "member.memberName"),
    memberChannel: getValue(payload, "member.memberChannel"),
    memberMobile: normalizePhone(getValue(payload, "member.memberMobile")),
    memberEmail: getValue(payload, "member.memberEmail"),
    targetType: payload.targetType || getValue(payload, "target.type") || "erp_product",
    targetScheduleId: payload.targetScheduleId || getValue(payload, "target.scheduleId"),
    targetApplicationId: payload.targetApplicationId || getValue(payload, "target.applicationId"),
    erpProductId,
    erpEventSeq,
    productName: getValue(payload, "product.productName") || payload.productName,
    departureDate: getValue(payload, "product.departureDate") || payload.departureDate,
    returnDate: getValue(payload, "product.returnDate") || payload.returnDate,
    category: getValue(payload, "product.category") || payload.category,
    country: getValue(payload, "product.country") || payload.country || "",
    region: getValue(payload, "product.region") || payload.region,
    airline: getValue(payload, "product.airline") || getValue(payload, "product.airlineName") || getValue(payload, "product.airlineNm") || getValue(payload, "product.air2Nm") || getValue(payload, "product.air2CdNm"),
    departureAirport: getValue(payload, "product.departureAirport") || payload.departureAirport,
    arrivalAirport: getValue(payload, "product.arrivalAirport") || payload.arrivalAirport || getValue(payload, "product.region"),
    applicantName: getValue(payload, "applicant.name"),
    applicantGender: getValue(payload, "applicant.gender"),
    applicantBirthYear: getValue(payload, "applicant.birthYear"),
    applicantAgeBand: getValue(payload, "applicant.ageDisplay"),
    applicantMobile: normalizePhone(getValue(payload, "applicant.phone")),
    applicantProfession: getValue(payload, "applicant.profession"),
    applicantPeople: getValue(payload, "applicant.people"),
    applicantCompanions: stringifySheetCompanions(getValue(payload, "applicant.companions")),
    applicantLevel: getValue(payload, "applicant.level"),
    applicantStyles: joinSheetList(getValue(payload, "applicant.styles")),
    applicantPreferredMembers: joinSheetList(getValue(payload, "applicant.preferredMemberComposition") || getValue(payload, "applicant.memberPreferences")),
    applicantGreeting: getValue(payload, "applicant.greeting"),
    applicantRoomType: getValue(payload, "applicant.roomType") || "2인실",
    flightRequestType: getValue(payload, "applicant.flightRequestType"),
    singleRoomSurcharge: getValue(payload, "applicant.singleRoomSurcharge"),
    singleRoomSurchargeText: getValue(payload, "applicant.singleRoomSurchargeText"),
    singleRoomSurchargeStatus: getValue(payload, "applicant.singleRoomSurchargeStatus"),
    participantStatus: payload.participantStatus || getValue(payload, "payment.participantStatus") || "신청",
    quoteStatus: payload.quoteStatus || getValue(payload, "payment.quoteStatus") || "",
    depositStatus: payload.depositStatus || getValue(payload, "payment.depositStatus") || "",
    balanceStatus: payload.balanceStatus || getValue(payload, "payment.balanceStatus") || "",
    refundStatus: payload.refundStatus || getValue(payload, "payment.refundStatus") || "",
    applicationStatus: payload.applicationStatus || payload.status || "confirmed",
    requiredAgreed: getValue(payload, "agreements.required"),
    marketingAgreed: getValue(payload, "agreements.marketing"),
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString(),
    memberKey: getPayloadMemberKey(payload),
    kakaoId: getValue(payload, "member.kakaoId") || getValue(payload, "kakao.kakaoId") || payload.kakaoId,
    targetJoinId,
    targetProductKey
  };
  return values[header] == null ? "" : values[header];
}

function buildJoinApplicationSheetRow(payload = {}, existingRow = {}, headers = GOOGLE_SHEET_HEADERS.join_applications) {
  return headers.map((header) => {
    if (header === "createdAt" && existingRow.createdAt) return existingRow.createdAt;
    return buildJoinApplicationSheetValue(payload, header);
  });
}

async function saveNewScheduleApplicationViaSheetsApi(payload = {}) {
  const applicationId = asText(payload.applicationId || buildNewScheduleApplicationSheetValue(payload, "applicationId"));
  if (!applicationId) throw createHttpError("applicationId is required", 400);
  const scheduleId = asText(payload.scheduleId || buildNewScheduleApplicationSheetValue({ ...payload, applicationId }, "scheduleId"));
  const headers = await ensureGoogleSheetHeadersViaApi("new_schedule_applications", { timeoutMs: 6000 });
  const rows = await readGoogleSheetRowsViaApi("new_schedule_applications", { timeoutMs: 5000 });
  const existingIndex = rows.findIndex((row) => asText(row.applicationId) === applicationId);
  const existingRow = existingIndex >= 0 ? rows[existingIndex] : {};
  const rowPayload = { ...payload, applicationId, scheduleId };
  const rowValues = buildNewScheduleApplicationSheetRow(rowPayload, existingRow, headers);
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await updateGoogleSheetRowViaApi("new_schedule_applications", rowNumber, rowValues, { timeoutMs: 6000 });
    return { ok: true, sheet: "new_schedule_applications", write: "update", row: rowNumber, source: "sheets_api", applicationId, scheduleId };
  }
  const response = await appendGoogleSheetValuesViaApi("new_schedule_applications", rowValues, { timeoutMs: 6000 });
  return {
    ok: true,
    sheet: "new_schedule_applications",
    write: "append",
    row: response.updates?.updatedRange || "",
    source: "sheets_api",
    applicationId,
    scheduleId
  };
}

async function saveRecommendedScheduleViaSheetsApi(payload = {}) {
  const recommendedScheduleId = asText(payload.recommendedScheduleId || payload.displayRuleId || buildRecommendedScheduleSheetValue(payload, "recommendedScheduleId"));
  if (!recommendedScheduleId) throw createHttpError("recommendedScheduleId is required", 400);
  const rows = await readGoogleSheetRowsViaApi("recommended_schedules", { timeoutMs: 5000 });
  const existingIndex = rows.findIndex((row) => asText(row.recommendedScheduleId || row.displayRuleId) === recommendedScheduleId);
  const existingRow = existingIndex >= 0 ? rows[existingIndex] : {};
  const rowValues = buildRecommendedScheduleSheetRow({ ...payload, recommendedScheduleId }, existingRow);
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await updateGoogleSheetRowViaApi("recommended_schedules", rowNumber, rowValues, { timeoutMs: 6000, valueInputOption: "RAW" });
    return { ok: true, sheet: "recommended_schedules", write: "update", row: rowNumber, source: "sheets_api", recommendedScheduleId };
  }
  const response = await appendGoogleSheetValuesViaApi("recommended_schedules", rowValues, { timeoutMs: 6000, valueInputOption: "RAW" });
  return {
    ok: true,
    sheet: "recommended_schedules",
    write: "append",
    row: response.updates?.updatedRange || "",
    source: "sheets_api",
    recommendedScheduleId
  };
}

async function updateAdminStatusViaSheetsApi(payload = {}) {
  const sheetName = asText(payload.sheet);
  const headers = GOOGLE_SHEET_HEADERS[sheetName];
  if (!headers) throw createHttpError("sheet is not allowed", 400);
  const keyField = asText(payload.keyField || "applicationId");
  const keyValue = asText(payload.keyValue);
  const rows = await readGoogleSheetRowsViaApi(sheetName, { timeoutMs: 5000 });
  const existingIndex = rows.findIndex((row) => asText(row[keyField]) === keyValue);
  if (existingIndex < 0) {
    return { ok: false, error: "row_not_found", sheet: sheetName, keyField, keyValue, source: "sheets_api" };
  }
  const existingRow = rows[existingIndex];
  const nextRow = { ...existingRow };
  Object.entries(payload.fields || {}).forEach(([field, value]) => {
    if (ADMIN_STATUS_UPDATE_FIELDS.has(field)) nextRow[field] = value;
  });
  if (headers.includes("updatedAt")) nextRow.updatedAt = nowKstISOString();
  const rowValues = headers.map((header) => nextRow[header] == null ? "" : nextRow[header]);
  const rowNumber = existingIndex + 2;
  await updateGoogleSheetRowViaApi(sheetName, rowNumber, rowValues, { timeoutMs: 6000 });
  return {
    ok: true,
    sheet: sheetName,
    row: rowNumber,
    keyField,
    keyValue,
    source: "sheets_api"
  };
}

async function generateQuoteViaSheetsApi(payload = {}) {
  const { sheet, keyValue } = validateQuoteGeneratePayload(payload);
  let headers;
  let rows;
  try {
    headers = await ensureGoogleSheetHeadersViaApi(sheet, { timeoutMs: 15000 });
  } catch (error) {
    throw createHttpError(`quote header sync failed: ${error.message || error}`, error.status || 502, { code: error.code || "quote_header_sync_failed" });
  }
  try {
    rows = await readGoogleSheetRowsViaApi(sheet, { timeoutMs: 15000 });
  } catch (error) {
    throw createHttpError(`quote row read failed: ${error.message || error}`, error.status || 502, { code: error.code || "quote_row_read_failed" });
  }
  const existingIndex = rows.findIndex((row) => asText(row.applicationId || row.joinApplyId) === keyValue);
  if (existingIndex < 0) {
    return { ok: false, error: "row_not_found", sheet, keyField: "applicationId", keyValue, source: "sheets_api" };
  }
  const existingRow = rows[existingIndex] || {};
  const quote = buildQuoteData({ ...payload, sheet, keyValue }, existingRow);
  const pdfBuffer = await createGolfjoinQuotePdfBufferV2(quote);
  let savedPdf;
  try {
    savedPdf = await saveQuotePdfToStorage(pdfBuffer, quote);
  } catch (error) {
    throw createHttpError(`quote pdf upload failed: ${error.message || error}`, error.status || 502, { code: error.code || "quote_pdf_upload_failed" });
  }
  let savedPage;
  try {
    const quoteHtml = createGolfjoinQuoteHtml(quote, { pdfUrl: savedPdf.url });
    savedPage = await saveQuoteHtmlToStorage(quoteHtml, quote);
  } catch (error) {
    throw createHttpError(`quote page upload failed: ${error.message || error}`, error.status || 502, { code: error.code || "quote_page_upload_failed" });
  }
  const fields = {
    quoteId: quote.quoteId,
    quoteNo: quote.quoteNo,
    quoteUrl: savedPage.url,
    quotePageUrl: savedPage.url,
    quotePdfUrl: savedPdf.url,
    quoteFileName: savedPdf.objectName,
    quoteGeneratedAt: quote.generatedAt,
    quoteStatus: asText(existingRow.quoteStatus) === "sent" ? "sent" : "created"
  };
  const nextRow = {
    ...existingRow,
    ...fields,
    updatedAt: nowKstISOString()
  };
  const rowValues = headers.map((header) => nextRow[header] == null ? "" : nextRow[header]);
  const rowNumber = existingIndex + 2;
  try {
    await updateGoogleSheetRowViaApi(sheet, rowNumber, rowValues, { timeoutMs: 15000 });
  } catch (error) {
    throw createHttpError(`quote row update failed: ${error.message || error}`, error.status || 502, { code: error.code || "quote_row_update_failed" });
  }
  return {
    ok: true,
    sheet,
    row: rowNumber,
    keyField: "applicationId",
    keyValue,
    quoteId: quote.quoteId,
    quoteNo: quote.quoteNo,
    quoteUrl: savedPage.url,
    quotePageUrl: savedPage.url,
    quotePdfUrl: savedPdf.url,
    quoteFileName: savedPdf.objectName,
    quoteGeneratedAt: quote.generatedAt,
    fields,
    source: "sheets_api"
  };
}

async function saveJoinApplicationViaSheetsApi(payload = {}) {
  const applicationId = asText(payload.applicationId || payload.joinApplyId || buildJoinApplicationSheetValue(payload, "applicationId"));
  if (!applicationId) throw createHttpError("applicationId is required", 400);
  const headers = await ensureGoogleSheetHeadersViaApi("join_applications", { timeoutMs: 6000 });
  const capacityCheck = await assertJoinApplicationCapacityAvailable(payload, applicationId);
  const existingIndex = capacityCheck.existingIndex;
  const existingRow = capacityCheck.existingRow || {};
  const rowValues = buildJoinApplicationSheetRow({ ...payload, applicationId }, existingRow, headers);
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await updateGoogleSheetRowViaApi("join_applications", rowNumber, rowValues, { timeoutMs: 6000 });
    return { ok: true, sheet: "join_applications", write: "update", row: rowNumber, source: "sheets_api", applicationId };
  }
  const response = await appendGoogleSheetValuesViaApi("join_applications", rowValues, { timeoutMs: 6000 });
  return {
    ok: true,
    sheet: "join_applications",
    write: "append",
    row: response.updates?.updatedRange || "",
    source: "sheets_api",
    applicationId
  };
}

async function saveJoinReviewViaSheetsApi(payload = {}) {
  const reviewId = asText(payload.reviewId || buildJoinReviewSheetValue(payload, "reviewId"));
  if (!reviewId) throw createHttpError("reviewId is required", 400);
  const rows = await readGoogleSheetRowsViaApi("join_reviews", { timeoutMs: 5000 });
  const existingIndex = rows.findIndex((row) => asText(row.reviewId) === reviewId);
  const existingRow = existingIndex >= 0 ? rows[existingIndex] : {};
  const rowValues = buildJoinReviewSheetRow({ ...payload, reviewId }, existingRow);
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await updateGoogleSheetRowViaApi("join_reviews", rowNumber, rowValues, { timeoutMs: 6000 });
    return { ok: true, sheet: "join_reviews", write: "update", row: rowNumber, source: "sheets_api" };
  }
  const response = await appendGoogleSheetValuesViaApi("join_reviews", rowValues, { timeoutMs: 6000 });
  return {
    ok: true,
    sheet: "join_reviews",
    write: "append",
    row: response.updates?.updatedRange || "",
    source: "sheets_api"
  };
}

async function saveJoinWishViaSheetsApi(payload = {}) {
  const wishId = asText(payload.wishId || buildJoinWishSheetValue(payload, "wishId"));
  if (!wishId) throw createHttpError("wishId is required", 400);
  const rows = await readGoogleSheetRowsViaApi("join_wishes", { timeoutMs: 5000 });
  const existingIndex = rows.findIndex((row) => asText(row.wishId) === wishId);
  const existingRow = existingIndex >= 0 ? rows[existingIndex] : {};
  const rowValues = buildJoinWishSheetRow({ ...payload, wishId }, existingRow);
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await updateGoogleSheetRowViaApi("join_wishes", rowNumber, rowValues, { timeoutMs: 6000 });
    return { ok: true, sheet: "join_wishes", write: "update", row: rowNumber, source: "sheets_api" };
  }
  const response = await appendGoogleSheetValuesViaApi("join_wishes", rowValues, { timeoutMs: 6000 });
  return {
    ok: true,
    sheet: "join_wishes",
    write: "append",
    row: response.updates?.updatedRange || "",
    source: "sheets_api"
  };
}

function columnNumberToLetters(value = 1) {
  let number = Math.max(1, Number(value) || 1);
  let letters = "";
  while (number > 0) {
    const modulo = (number - 1) % 26;
    letters = String.fromCharCode(65 + modulo) + letters;
    number = Math.floor((number - modulo) / 26);
  }
  return letters;
}

async function updateGoogleSheetRowViaApi(sheetName, rowNumber, values = [], options = {}) {
  const endColumn = columnNumberToLetters(values.length || 1);
  const range = `'${escapeGoogleSheetNameForRange(sheetName)}'!A${rowNumber}:${endColumn}${rowNumber}`;
  return writeGoogleSheetValuesViaApi(range, [values], {
    ...options,
    method: "PUT",
    timeoutMs: options.timeoutMs || 6000
  });
}

function buildGa4HomeVisitorDimensionFilter() {
  const expressions = [];
  if (GA4_HOME_HOSTS.length) {
    expressions.push({
      filter: {
        fieldName: "hostName",
        inListFilter: {
          values: GA4_HOME_HOSTS,
          caseSensitive: false
        }
      }
    });
  }
  if (GA4_HOME_PATH) {
    expressions.push({
      filter: {
        fieldName: "pagePathPlusQueryString",
        stringFilter: {
          matchType: "CONTAINS",
          value: GA4_HOME_PATH,
          caseSensitive: false
        }
      }
    });
  }
  if (GA4_HOME_EVENT_PLAN_SEQ) {
    expressions.push({
      filter: {
        fieldName: "pagePathPlusQueryString",
        stringFilter: {
          matchType: "CONTAINS",
          value: `eventPlanSeq=${GA4_HOME_EVENT_PLAN_SEQ}`,
          caseSensitive: false
        }
      }
    });
  }
  if (!expressions.length) return undefined;
  return expressions.length === 1 ? expressions[0] : { andGroup: { expressions } };
}

async function readGa4HomeVisitorCount() {
  if (!GA4_PROPERTY_ID) return { count: 0, warning: "GA4_PROPERTY_ID is not configured" };
  const ageMs = Date.now() - ga4VisitorCountCache.updatedAt;
  if (ga4VisitorCountCache.updatedAt && ageMs <= GA4_VISITOR_COUNT_CACHE_TTL_MS) {
    return {
      count: ga4VisitorCountCache.count,
      warning: ga4VisitorCountCache.warning
    };
  }
  try {
    const token = await getGoogleMetadataAccessToken();
    const body = {
      dateRanges: [{ startDate: `${GA4_LOOKBACK_DAYS}daysAgo`, endDate: "today" }],
      metrics: [{ name: "totalUsers" }],
      dimensionFilter: buildGa4HomeVisitorDimensionFilter()
    };
    const response = await fetchWithTimeout(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(GA4_PROPERTY_ID)}:runReport`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(body)
    }, 5000);
    const text = await response.text();
    if (!response.ok) throw createHttpError(`GA4 visitor count failed: ${response.status} ${text.slice(0, 200)}`, response.status);
    const payload = JSON.parse(text || "{}");
    const count = Math.max(0, Math.round(Number(payload.rows?.[0]?.metricValues?.[0]?.value || 0)));
    ga4VisitorCountCache.count = count;
    ga4VisitorCountCache.updatedAt = Date.now();
    ga4VisitorCountCache.warning = "";
    return { count, warning: "" };
  } catch (error) {
    const warning = error?.message || "GA4 visitor count failed";
    if (ga4VisitorCountCache.updatedAt) {
      ga4VisitorCountCache.warning = warning;
      return { count: ga4VisitorCountCache.count, warning };
    }
    return { count: 0, warning };
  }
}

async function readGa4HomeActiveUserCount() {
  if (!GA4_PROPERTY_ID) return { count: 0, warning: "GA4_PROPERTY_ID is not configured" };
  const ageMs = Date.now() - ga4ActiveUserCountCache.updatedAt;
  if (ga4ActiveUserCountCache.updatedAt && ageMs <= GA4_ACTIVE_USER_COUNT_CACHE_TTL_MS) {
    return {
      count: ga4ActiveUserCountCache.count,
      warning: ga4ActiveUserCountCache.warning
    };
  }
  try {
    const token = await getGoogleMetadataAccessToken();
    const body = {
      metrics: [{ name: "activeUsers" }]
    };
    const response = await fetchWithTimeout(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(GA4_PROPERTY_ID)}:runRealtimeReport`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(body)
    }, 5000);
    const text = await response.text();
    if (!response.ok) throw createHttpError(`GA4 active user count failed: ${response.status} ${text.slice(0, 200)}`, response.status);
    const payload = JSON.parse(text || "{}");
    const count = Math.max(0, Math.round(Number(payload.rows?.[0]?.metricValues?.[0]?.value || 0)));
    ga4ActiveUserCountCache.count = count;
    ga4ActiveUserCountCache.updatedAt = Date.now();
    ga4ActiveUserCountCache.warning = "";
    return { count, warning: "" };
  } catch (error) {
    const warning = error?.message || "GA4 active user count failed";
    if (ga4ActiveUserCountCache.updatedAt) {
      ga4ActiveUserCountCache.warning = warning;
      return { count: ga4ActiveUserCountCache.count, warning };
    }
    return { count: 0, warning };
  }
}

async function appendHomeBootstrapVisitorCount(payload = {}) {
  const next = {
    ...payload,
    visitorCount: Math.max(0, Math.round(Number(payload.visitorCount) || 0)),
    activeUserCount: Math.max(0, Math.round(Number(payload.activeUserCount) || 0))
  };
  const [visitorResult, activeResult] = await Promise.all([
    readGa4HomeVisitorCount(),
    readGa4HomeActiveUserCount()
  ]);
  next.visitorCount = visitorResult.count;
  next.activeUserCount = activeResult.count;
  if (visitorResult.warning) {
    next.warnings = [
      ...(Array.isArray(next.warnings) ? next.warnings : []),
      { key: "visitorCount", message: visitorResult.warning }
    ];
  }
  if (activeResult.warning) {
    next.warnings = [
      ...(Array.isArray(next.warnings) ? next.warnings : []),
      { key: "activeUserCount", message: activeResult.warning }
    ];
  }
  return next;
}

function getHomeBootstrapCacheEntry(cacheKey) {
  const entry = homeBootstrapCache.get(cacheKey);
  if (!entry?.payload) return null;
  const ageMs = Date.now() - entry.updatedAt;
  if (ageMs > HOME_BOOTSTRAP_STALE_TTL_MS) {
    homeBootstrapCache.delete(cacheKey);
    return null;
  }
  return { ...entry, ageMs };
}

function setHomeBootstrapCacheEntry(cacheKey, payload) {
  if (homeBootstrapCache.size >= HOME_BOOTSTRAP_CACHE_MAX_KEYS && !homeBootstrapCache.has(cacheKey)) {
    const oldestKey = homeBootstrapCache.keys().next().value;
    if (oldestKey) homeBootstrapCache.delete(oldestKey);
  }
  homeBootstrapCache.set(cacheKey, {
    payload: cloneHomeBootstrapPayload(payload),
    updatedAt: Date.now(),
    refreshing: null
  });
}

async function readHomeBootstrapUncached(params = {}) {
  if (GOOGLE_SHEET_ID) {
    try {
      return await appendHomeBootstrapVisitorCount(await readHomeBootstrapViaSheetsApi(params));
    } catch (error) {
      console.warn("Home bootstrap via Google Sheets API failed; falling back to Apps Script batch.", error?.message || error);
    }
  }
  try {
    return await appendHomeBootstrapVisitorCount({
      ...await readHomeBootstrapBatchDirect(params),
      source: "apps_script_batch"
    });
  } catch (error) {
    console.warn("Home bootstrap batch failed; falling back to parallel sheet reads.", error?.message || error);
  }
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
    readHomeBootstrapPart("displayRules", () => readSheetRowsDirect({
      sheet: "recommended_schedules",
      section: "available_schedule",
      limit: Math.min(Math.max(Number(params?.displayRuleLimit || 100), 1), 100)
    }).then((rows) => rows.map(sanitizePublicRow))),
    readHomeBootstrapPart("profileCount", () => readSheetRowsDirect({
      sheet: "join_member_profiles",
      limit: Math.min(Math.max(Number(params?.profileLimit || 1000), 1), 3000)
    }).then((rows) => rows.filter(hasCompletedJoinMemberProfile))),
    readHomeBootstrapPart("visitorCount", () => readGa4HomeVisitorCount().then((result) => result.count)),
    readHomeBootstrapPart("activeUserCount", () => readGa4HomeActiveUserCount().then((result) => result.count)),
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
  return parts.reduce((object, part) => {
    object[part.key] = part.key === "profileCount"
      ? part.rows.length
      : part.key === "visitorCount" || part.key === "activeUserCount"
        ? Math.max(0, Math.round(Number(part.rows) || 0))
        : part.rows;
    if (part.warning) object.warnings.push({ key: part.key, message: part.warning });
    return object;
  }, {
    newSchedules: [],
    joinApplications: [],
    reviews: [],
    wishes: [],
    displayRules: [],
    profileCount: 0,
    visitorCount: 0,
    activeUserCount: 0,
    source: "apps_script_parallel",
    warnings: []
  });
}

async function readHomeBootstrapLightUncached(params = {}) {
  return readHomeBootstrapLightDirect(params);
}

function refreshHomeBootstrapCache(cacheKey, params = {}) {
  const existing = homeBootstrapCache.get(cacheKey);
  if (existing?.refreshing) return existing.refreshing;
  const refreshing = readHomeBootstrapUncached(params)
    .then((payload) => {
      setHomeBootstrapCacheEntry(cacheKey, payload);
      return payload;
    })
    .catch((error) => {
      console.warn("Home bootstrap cache refresh failed.", error?.message || error);
      return null;
    })
    .finally(() => {
      const entry = homeBootstrapCache.get(cacheKey);
      if (entry) entry.refreshing = null;
    });
  if (existing) {
    existing.refreshing = refreshing;
  } else {
    homeBootstrapCache.set(cacheKey, { payload: null, updatedAt: 0, refreshing });
  }
  return refreshing;
}

function getHomeBootstrapLightCacheEntry(cacheKey) {
  const entry = homeBootstrapLightCache.get(cacheKey);
  if (!entry?.payload) return null;
  const ageMs = Date.now() - entry.updatedAt;
  if (ageMs > HOME_BOOTSTRAP_LIGHT_STALE_TTL_MS) {
    homeBootstrapLightCache.delete(cacheKey);
    return null;
  }
  return { ...entry, ageMs };
}

function setHomeBootstrapLightCacheEntry(cacheKey, payload) {
  if (homeBootstrapLightCache.size >= HOME_BOOTSTRAP_LIGHT_CACHE_MAX_KEYS && !homeBootstrapLightCache.has(cacheKey)) {
    const oldestKey = homeBootstrapLightCache.keys().next().value;
    if (oldestKey) homeBootstrapLightCache.delete(oldestKey);
  }
  homeBootstrapLightCache.set(cacheKey, {
    payload: cloneHomeBootstrapLightPayload(payload),
    updatedAt: Date.now(),
    refreshing: null
  });
}

function refreshHomeBootstrapLightCache(cacheKey, params = {}) {
  const existing = homeBootstrapLightCache.get(cacheKey);
  if (existing?.refreshing) return existing.refreshing;
  const refreshing = readHomeBootstrapLightUncached(params)
    .then((payload) => {
      setHomeBootstrapLightCacheEntry(cacheKey, payload);
      return payload;
    })
    .catch((error) => {
      console.warn("Home bootstrap light cache refresh failed.", error?.message || error);
      return null;
    })
    .finally(() => {
      const entry = homeBootstrapLightCache.get(cacheKey);
      if (entry) entry.refreshing = null;
    });
  if (existing) {
    existing.refreshing = refreshing;
  } else {
    homeBootstrapLightCache.set(cacheKey, { payload: null, updatedAt: 0, refreshing });
  }
  return refreshing;
}

async function proxyHomeBootstrap(params, res) {
  const noStore = String(params?.cache || params?.cacheMode || "").toLowerCase() === "no-store";
  if (noStore) {
    const payload = await readHomeBootstrapUncached(params);
    res.status(200).json({
      ...cloneHomeBootstrapPayload(payload),
      cache: { status: "bypass", ageMs: 0 }
    });
    return;
  }
  const cacheKey = createHomeBootstrapCacheKey(params);
  const cached = getHomeBootstrapCacheEntry(cacheKey);
  if (cached && cached.ageMs <= HOME_BOOTSTRAP_CACHE_TTL_MS) {
    res.status(200).json({
      ...cloneHomeBootstrapPayload(cached.payload),
      cache: { status: "hit", ageMs: cached.ageMs }
    });
    return;
  }
  if (cached) {
    refreshHomeBootstrapCache(cacheKey, params);
    res.status(200).json({
      ...cloneHomeBootstrapPayload(cached.payload),
      warnings: [
        ...(cached.payload.warnings || []),
        { key: "cache", message: "Returned stale home bootstrap cache while refreshing." }
      ],
      cache: { status: "stale", ageMs: cached.ageMs }
    });
    return;
  }
  const refresh = refreshHomeBootstrapCache(cacheKey, params);
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), HOME_BOOTSTRAP_REFRESH_TIMEOUT_MS);
  });
  const payload = await Promise.race([refresh, timeout]);
  if (payload) {
    res.status(200).json({
      ...cloneHomeBootstrapPayload(payload),
      cache: { status: "miss", ageMs: 0 }
    });
    return;
  }
  const fallback = await refresh;
  if (!fallback) throw createHttpError("Home bootstrap failed", 502);
  res.status(200).json({
    ...cloneHomeBootstrapPayload(fallback),
    cache: { status: "miss-slow", ageMs: 0 }
  });
}

async function proxyHomeBootstrapLight(params, res) {
  const noStore = String(params?.cache || params?.cacheMode || "").toLowerCase() === "no-store";
  if (noStore) {
    const payload = await readHomeBootstrapLightUncached(params);
    res.status(200).json({
      ...cloneHomeBootstrapLightPayload(payload),
      cache: { status: "bypass", ageMs: 0 }
    });
    return;
  }
  const cacheKey = createHomeBootstrapLightCacheKey(params);
  const cached = getHomeBootstrapLightCacheEntry(cacheKey);
  if (cached && cached.ageMs <= HOME_BOOTSTRAP_LIGHT_CACHE_TTL_MS) {
    res.status(200).json({
      ...cloneHomeBootstrapLightPayload(cached.payload),
      cache: { status: "hit", ageMs: cached.ageMs }
    });
    return;
  }
  if (cached) {
    refreshHomeBootstrapLightCache(cacheKey, params);
    res.status(200).json({
      ...cloneHomeBootstrapLightPayload(cached.payload),
      warnings: [
        ...(cached.payload.warnings || []),
        { key: "cache", message: "Returned stale home bootstrap light cache while refreshing." }
      ],
      cache: { status: "stale", ageMs: cached.ageMs }
    });
    return;
  }
  const refresh = refreshHomeBootstrapLightCache(cacheKey, params);
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), HOME_BOOTSTRAP_LIGHT_REFRESH_TIMEOUT_MS);
  });
  const payload = await Promise.race([refresh, timeout]);
  if (payload) {
    res.status(200).json({
      ...cloneHomeBootstrapLightPayload(payload),
      cache: { status: "miss", ageMs: 0 }
    });
    return;
  }
  const fallback = await refresh;
  if (!fallback) throw createHttpError("Home bootstrap light failed", 502);
  res.status(200).json({
    ...cloneHomeBootstrapLightPayload(fallback),
    cache: { status: "miss-slow", ageMs: 0 }
  });
}

async function proxyHomeStats(res) {
  const [visitorResult, activeResult] = await Promise.all([
    readGa4HomeVisitorCount(),
    readGa4HomeActiveUserCount()
  ]);
  const warnings = [];
  if (visitorResult.warning) warnings.push({ key: "recent30DayVisitors", message: visitorResult.warning });
  if (activeResult.warning) warnings.push({ key: "activeUsersNow", message: activeResult.warning });
  res.status(200).json({
    ok: true,
    recent30DayVisitors: visitorResult.count,
    activeUsersNow: activeResult.count,
    updatedAt: nowKstISOString(),
    warnings
  });
}

function assertDigits(value, field) {
  const text = asText(value);
  if (!/^\d+$/.test(text)) throw createHttpError(`${field} is invalid`);
  return text;
}

function escapeHtml(value = "") {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactText(value = "", maxLength = 160) {
  const text = asText(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function isSecretTourHost(hostname = "") {
  return /^(www\.|m\.)?secret-tour\.com$/i.test(String(hostname || ""));
}

function normalizeShareTargetUrl(value = "") {
  try {
    const url = new URL(asText(value) || "/event/plan_view?eventPlanSeq=3&page=1", SECRET_TOUR_PUBLIC_ORIGIN);
    if (url.protocol !== "https:" || !isSecretTourHost(url.hostname)) {
      return `${SECRET_TOUR_PUBLIC_ORIGIN}/event/plan_view?eventPlanSeq=3&page=1`;
    }
    return url.toString();
  } catch (error) {
    return `${SECRET_TOUR_PUBLIC_ORIGIN}/event/plan_view?eventPlanSeq=3&page=1`;
  }
}

function normalizeShareImageUrl(value = "") {
  try {
    const url = new URL(asText(value) || GOLFJOIN_SHARE_OG_FALLBACK_IMAGE);
    if (url.protocol !== "https:") return GOLFJOIN_SHARE_OG_FALLBACK_IMAGE;
    return url.toString();
  } catch (error) {
    return GOLFJOIN_SHARE_OG_FALLBACK_IMAGE;
  }
}

function getRequestAbsoluteUrl(req) {
  const protocol = asText(req.headers["x-forwarded-proto"]) || req.protocol || "https";
  const host = asText(req.headers["x-forwarded-host"]) || asText(req.headers.host);
  const originalUrl = req.originalUrl || req.url || "";
  if (!host) return normalizeShareTargetUrl("");
  return `${protocol}://${host}${originalUrl}`;
}

function proxyShareOg(req, res) {
  const targetUrl = normalizeShareTargetUrl(req.query?.url);
  const title = compactText(req.query?.title || "\uC2DC\uD06C\uB9BF\uD22C\uC5B4 \uC870\uC778\uACE8\uD504", 90);
  const description = compactText(req.query?.desc || req.query?.description || "\uD568\uAED8 \uB5A0\uB0A0 \uACE8\uD504\uCE5C\uAD6C\uB97C \uCC3E\uB294 \uC911", 180);
  const imageUrl = normalizeShareImageUrl(req.query?.image || req.query?.imageUrl);
  const shareUrl = getRequestAbsoluteUrl(req);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImageUrl = escapeHtml(imageUrl);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeTargetUrl = escapeHtml(targetUrl);
  res.status(200);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "public, max-age=300, s-maxage=300");
  res.send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <link rel="canonical" href="${safeTargetUrl}">
  <meta name="robots" content="noindex, follow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="\uC2DC\uD06C\uB9BF\uD22C\uC5B4">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImageUrl}">
  <meta property="og:image:secure_url" content="${safeImageUrl}">
  <meta property="og:url" content="${safeShareUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImageUrl}">
  <meta http-equiv="refresh" content="0; url=${safeTargetUrl}">
</head>
<body>
  <script>location.replace(${JSON.stringify(targetUrl)});</script>
  <a href="${safeTargetUrl}">\uC0C1\uD488 \uC0C1\uC138\uBCF4\uAE30</a>
</body>
</html>`);
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

function buildSecretTourGoodsListProxyUrl(query = {}) {
  const target = new URL("/goods/getGoodsList.json", SECRET_TOUR_PUBLIC_ORIGIN);
  target.searchParams.set("cate1", asText(query.cate1 || ""));
  target.searchParams.set("cate2", asText(query.cate2 || ""));
  target.searchParams.set("cate3", asText(query.cate3 || ""));
  target.searchParams.set("goodDetailCd", asText(query.goodDetailCd || ""));
  target.searchParams.set("page", assertDigits(query.page || "1", "page"));
  target.searchParams.set("rows", assertDigits(query.rows || "100", "rows"));
  return target;
}

function buildSecretTourGoodsEventsProxyUrl(query = {}) {
  const target = new URL("/goods/getGoodsEventList.json", SECRET_TOUR_PUBLIC_ORIGIN);
  target.searchParams.set("goodSeq", assertDigits(query.goodSeq, "goodSeq"));
  return target;
}

function secretTourDateToISO(value) {
  const text = String(value || "").replace(/\D/g, "");
  if (text.length !== 8) return "";
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function secretTourImageUrl(path) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SECRET_TOUR_PUBLIC_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
}

function addDaysToISO(isoDate, days) {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function nowKstISOString() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}+09:00`;
}

function isSecretTourAirlineName(value) {
  return /(대한항공|아시아나항공?|제주항공|진에어|티웨이항공?|에어서울|에어부산|이스타항공|에어프레미아|사천항공|산동항공|베트남항공|비엣젯항공|타이항공|싱가포르항공|캐세이퍼시픽|중화항공|에바항공|중국동방항공|중국남방항공|중국국제항공|상하이항공|말레이시아항공|필리핀항공|세부퍼시픽|스쿠트항공|항공사)/.test(asText(value));
}

function normalizeSecretTourAirportName(...values) {
  return values.map(asText).find((value) => value && !isSecretTourAirlineName(value)) || "";
}

function normalizeSecretTourAirlineName(...values) {
  return values.map(asText).find(isSecretTourAirlineName) || "";
}

const SECRET_TOUR_TITLE_COUNTRIES = [
  "라오스", "말레이시아", "미얀마", "베트남", "브루나이", "인도네시아", "태국", "필리핀",
  "일본", "중국", "대만", "괌", "사이판", "제주", "한국"
];
const SECRET_TOUR_TITLE_COUNTRY_ALIASES = {
  "말레이지아": "말레이시아"
};
const SECRET_TOUR_REGION_COUNTRY_MAP = {
  "조호바루": "말레이시아",
  "코타키나발루": "말레이시아"
};

function inferSecretTourCountryFromRegion(...regions) {
  for (const region of regions.map(asText).filter(Boolean)) {
    const key = region.split(",").map(asText).filter(Boolean)[0] || region;
    const country = SECRET_TOUR_REGION_COUNTRY_MAP[key];
    if (country) return country;
  }
  return "";
}

function parseSecretTourTitleDestination(...titles) {
  for (const title of titles.map(asText).filter(Boolean)) {
    const normalized = title
      .replace(/^\[[^\]]+\]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    const parts = normalized.split(" ").filter(Boolean);
    const countryIndex = parts.findIndex((part) => SECRET_TOUR_TITLE_COUNTRIES.includes(part) || SECRET_TOUR_TITLE_COUNTRY_ALIASES[part]);
    if (countryIndex < 0) continue;
    const country = SECRET_TOUR_TITLE_COUNTRY_ALIASES[parts[countryIndex]] || parts[countryIndex];
    return {
      country,
      region: asText(parts[countryIndex + 1] || "").replace(/[()[\],]/g, "")
    };
  }
  return { country: "", region: "" };
}

function normalizeSecretTourGoodsItem(item = {}, index = 0) {
  const departureDate = secretTourDateToISO(item.minStartDay);
  const dayCnt = Number(item.dayCnt) || 1;
  const price = Number(item.dpPrice) || Number(item.minPrice) || 0;
  const productType = item.productType || item.goodsType || item.goodType || item.goodKind || item.goodDetailCdNm || item.goodDetailName || item.packageType || item.packType || item.tourType || item.airProductYn || item.airYn || item.flightYn || item.includeAirYn || "";
  const title = asText(item.goodNm) || "Golf join product";
  const destination = parseSecretTourTitleDestination(title);
  return {
    id: item.goodSeq ? `secret-tour-${item.goodSeq}` : `secret-tour-product-${index}`,
    source: "secret-tour-goods",
    goodSeq: asText(item.goodSeq),
    eventSeq: "",
    erpProductId: asText(item.goodSeq),
    erpEventSeq: "",
    goodTransportSeq: asText(item.goodTransportSeq || item.transportSeq || item.goodAirSeq || item.airSeq || item.flightSeq),
    goodCd: asText(item.goodCd),
    productType: asText(productType),
    goodsType: asText(item.goodsType || item.goodType),
    goodDetailCdNm: asText(item.goodDetailCdNm || item.goodDetailName),
    airProductYn: asText(item.airProductYn || item.airYn || item.flightYn || item.includeAirYn),
    air2Cd: asText(item.air2Cd),
    air2CdNm: asText(item.air2CdNm),
    air2Nm: asText(item.air2Nm || item.air2CdNm),
    title,
    country: destination.country,
    region: destination.region || asText(item.tourCity || item.areaCdNm),
    category: asText(item.areaCdNm),
    airport: normalizeSecretTourAirportName(item.departureAirport, item.depAirport, item.airport, item.airportName, item.air2CdNm),
    departureAirport: normalizeSecretTourAirportName(item.departureAirport, item.depAirport, item.airport, item.airportName, item.air2CdNm),
    arrivalAirport: asText(item.arrivalAirport || item.arrAirport || item.toCity || item.arrivalCity || item.tourCity || item.areaCdNm),
    airline: normalizeSecretTourAirlineName(item.airline, item.airlineName, item.airlineNm, item.air2Nm, item.air2CdNm),
    departureDate,
    returnDate: addDaysToISO(departureDate, Math.max(dayCnt - 1, 0)),
    duration: asText(item.period || item.dayNightCnt),
    dayNightCnt: asText(item.period || item.dayNightCnt),
    price,
    image: secretTourImageUrl(item.imagePath),
    includes: [],
    excludes: [],
    notes: [],
    schedule: [],
    emptySlots: 4
  };
}

function normalizeSecretTourGoodsEventItem(product = {}, event = {}, index = 0) {
  const departureDate = secretTourDateToISO(event.startDay || event.depStartDay || product.minStartDay);
  const returnDate = secretTourDateToISO(event.endDay || event.arrStartDay);
  const price = Number(event.adultPrice) || Number(event.minPrice) || Number(product.minPrice) || 0;
  const restCnt = Number(event.restCnt);
  const productType = event.productType || event.goodsType || event.goodType || event.goodKind || event.goodDetailCdNm || event.goodDetailName || event.packageType || event.packType || event.tourType || event.airProductYn || event.airYn || event.flightYn || event.includeAirYn || product.productType || product.goodsType || product.goodType || product.goodKind || product.goodDetailCdNm || product.goodDetailName || product.packageType || product.packType || product.tourType || product.airProductYn || product.airYn || product.flightYn || product.includeAirYn || "";
  const goodSeq = asText(product.goodSeq);
  const eventSeq = asText(event.eventSeq);
  const title = asText(event.eventNm || product.goodNm) || "Golf join product";
  const destination = parseSecretTourTitleDestination(title, product.goodNm);
  return {
    id: eventSeq ? `secret-tour-${goodSeq}-${eventSeq}` : `secret-tour-${goodSeq}-event-${index}`,
    source: "secret-tour-goods-event",
    goodSeq,
    eventSeq,
    erpProductId: goodSeq && eventSeq ? `secret-tour-${goodSeq}-${eventSeq}` : goodSeq,
    erpEventSeq: eventSeq,
    goodTransportSeq: asText(event.goodTransportSeq || event.transportSeq || event.goodAirSeq || event.airSeq || event.flightSeq || product.goodTransportSeq || product.transportSeq || product.goodAirSeq || product.airSeq || product.flightSeq),
    goodCd: asText(product.goodCd),
    productType: asText(productType),
    goodsType: asText(event.goodsType || event.goodType || product.goodsType || product.goodType),
    goodDetailCdNm: asText(event.goodDetailCdNm || event.goodDetailName || product.goodDetailCdNm || product.goodDetailName),
    airProductYn: asText(event.airProductYn || event.airYn || event.flightYn || event.includeAirYn || product.airProductYn || product.airYn || product.flightYn || product.includeAirYn),
    air2Cd: asText(event.air2Cd || product.air2Cd),
    air2CdNm: asText(product.air2CdNm),
    air2Nm: asText(event.air2Nm || product.air2Nm || product.air2CdNm),
    title,
    country: destination.country,
    region: destination.region || asText(product.tourCity || product.areaCdNm),
    category: asText(product.areaCdNm),
    airport: normalizeSecretTourAirportName(event.departureAirport, event.depAirport, event.airport, event.airportName, product.airport, product.air2CdNm),
    departureAirport: normalizeSecretTourAirportName(event.departureAirport, event.depAirport, event.airport, event.airportName, product.airport, product.air2CdNm),
    arrivalAirport: asText(event.arrivalAirport || event.arrAirport || event.toCity || event.arrivalCity || product.arrivalAirport || product.arrAirport || product.toCity || product.arrivalCity || product.tourCity || product.areaCdNm),
    airline: normalizeSecretTourAirlineName(event.airline, event.airlineName, event.airlineNm, event.air2Nm, product.airline, product.air2Nm, product.air2CdNm),
    departureDate,
    returnDate: returnDate || departureDate,
    duration: asText(event.period || product.period || product.dayNightCnt),
    dayNightCnt: asText(event.period || product.period || product.dayNightCnt),
    price,
    image: secretTourImageUrl(event.imagePath || product.imagePath),
    includes: [],
    excludes: [],
    notes: [],
    schedule: [],
    emptySlots: Number.isFinite(restCnt) ? Math.max(0, restCnt) : 4
  };
}

async function fetchSecretTourJson(target) {
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: {
      "Accept": "application/json, */*;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "GolfJoinAdmin/1.0"
    },
    redirect: "follow"
  });
  const text = await response.text();
  if (!response.ok) throw createHttpError(`Secret Tour JSON failed: ${response.status}`, 502);
  try {
    return JSON.parse(text || "{}");
  } catch (error) {
    throw createHttpError("Secret Tour JSON is invalid", 502);
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function loadSecretTourGoodsListForCategory(cate1, rows) {
  const firstPayload = await fetchSecretTourJson(buildSecretTourGoodsListProxyUrl({ cate1, page: "1", rows: String(rows) }));
  const firstList = Array.isArray(firstPayload?.list) ? firstPayload.list : [];
  const totalCount = Number(firstPayload?.count || firstList[0]?.totalCount || firstList.length) || firstList.length;
  const pageCount = Math.ceil(totalCount / rows);
  const allItems = firstList.slice();
  for (let page = 2; page <= pageCount; page += 1) {
    const payload = await fetchSecretTourJson(buildSecretTourGoodsListProxyUrl({ cate1, page: String(page), rows: String(rows) }));
    const list = Array.isArray(payload?.list) ? payload.list : [];
    allItems.push(...list);
  }
  return allItems;
}

function uniqueSecretTourGoodsItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.goodSeq || item.goodCd || item.goodNm;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadSecretTourGoodsProducts() {
  const rows = 100;
  const categoryLists = await mapWithConcurrency(SECRET_TOUR_GOODS_CATEGORY_ROOTS, 3, (cate1) => {
    return loadSecretTourGoodsListForCategory(cate1, rows);
  });
  const allItems = uniqueSecretTourGoodsItems(categoryLists.flat());
  const eventGroups = await mapWithConcurrency(allItems, 4, async (item, itemIndex) => {
    try {
      const payload = await fetchSecretTourJson(buildSecretTourGoodsEventsProxyUrl({ goodSeq: item.goodSeq }));
      const events = Array.isArray(payload?.list) ? payload.list : [];
      if (!events.length) return [normalizeSecretTourGoodsItem(item, itemIndex)];
      return events.map((event, eventIndex) => normalizeSecretTourGoodsEventItem(item, event, eventIndex));
    } catch (error) {
      console.warn("Secret Tour event load failed", { goodSeq: item.goodSeq, message: error?.message || "" });
      return [normalizeSecretTourGoodsItem(item, itemIndex)];
    }
  });
  return eventGroups.flat();
}

function buildGolfJoinProductsPayload(items = []) {
  const dates = items.map((item) => item.departureDate).filter(Boolean).sort();
  return {
    schema: "secret-golf-join-board-v1",
    generatedAt: nowKstISOString(),
    range: {
      startDate: dates[0] || "",
      endDate: dates[dates.length - 1] || ""
    },
    count: items.length,
    items
  };
}

const GOLFJOIN_HOME_SUMMARY_RANGE_DAYS = 240;
const GOLFJOIN_HOME_SUMMARY_START_OFFSET_DAYS = 7;
const GOLFJOIN_HOME_SUMMARY_FIELDS = [
  "id",
  "source",
  "goodSeq",
  "eventSeq",
  "basePriceSeq",
  "title",
  "country",
  "countryName",
  "nation",
  "productCountry",
  "erpCountry",
  "region",
  "category",
  "departureDate",
  "returnDate",
  "date",
  "dayCnt",
  "dayNight",
  "duration",
  "dayNightCnt",
  "price",
  "airport",
  "departureAirport",
  "arrivalAirport",
  "airline",
  "badge",
  "badgeKind",
  "status",
  "priceDesc",
  "groupCd",
  "image",
  "emptySlots",
  "productType",
  "goodsType",
  "goodDetailCdNm",
  "airProductYn",
  "air2Cd",
  "air2CdNm",
  "air2Nm"
];

function addDaysToISODate(isoDate = "", days = 0) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function compactGolfJoinHomeSummaryItem(item = {}) {
  return GOLFJOIN_HOME_SUMMARY_FIELDS.reduce((acc, key) => {
    const value = item[key];
    if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

const GOLFJOIN_DESTINATION_COUNTRIES = [
  "라오스", "말레이시아", "미얀마", "베트남", "브루나이", "인도네시아", "태국", "필리핀",
  "일본", "중국", "대만", "괌", "사이판", "제주"
];

function normalizeGolfJoinDestinationKey(value = "") {
  return asText(value).replace(/\s+/g, "").replace(/[(),·/]/g, "").toLowerCase();
}

function inferGolfJoinDestinationCountry(item = {}, regionName = "") {
  const direct = firstText(item.country, item.countryName, item.nation, item.productCountry, item.erpCountry);
  if (direct) return direct;
  const parsed = parseSecretTourTitleDestination(item.title, item.productName, item.goodName);
  if (parsed.country) return parsed.country;
  const regionCountry = inferSecretTourCountryFromRegion(regionName, item.region, item.city, item.area, item.location);
  if (regionCountry) return regionCountry;
  const regionKey = normalizeGolfJoinDestinationKey(regionName);
  const haystack = [item.title, item.productName, item.goodName, item.region, item.location].map(asText).join(" ");
  return GOLFJOIN_DESTINATION_COUNTRIES.find((country) => haystack.includes(country) && normalizeGolfJoinDestinationKey(country) !== regionKey) || "";
}

function buildGolfJoinDestinationSummary(items = []) {
  const countries = new Map();
  items.forEach((item) => {
    const parsed = parseSecretTourTitleDestination(item.title, item.productName, item.goodName);
    const regionName = asText(parsed.region || item.region || item.city || item.area || item.location).split(",")[0]?.trim() || "";
    const countryName = inferGolfJoinDestinationCountry(item, regionName);
    if (!regionName && !countryName) return;
    const countryDisplay = countryName || regionName;
    const countryKey = normalizeGolfJoinDestinationKey(countryDisplay);
    if (!countryKey) return;
    if (!countries.has(countryKey)) {
      countries.set(countryKey, {
        name: countryDisplay,
        category: asText(item.category),
        count: 0,
        earliestDepartureDate: "",
        regions: new Map()
      });
    }
    const country = countries.get(countryKey);
    country.count += 1;
    if (item.departureDate && (!country.earliestDepartureDate || item.departureDate < country.earliestDepartureDate)) {
      country.earliestDepartureDate = item.departureDate;
    }
    if (regionName && normalizeGolfJoinDestinationKey(regionName) !== countryKey) {
      const regionKey = normalizeGolfJoinDestinationKey(regionName);
      if (!country.regions.has(regionKey)) {
        country.regions.set(regionKey, { name: regionName, count: 0, earliestDepartureDate: "" });
      }
      const region = country.regions.get(regionKey);
      region.count += 1;
      if (item.departureDate && (!region.earliestDepartureDate || item.departureDate < region.earliestDepartureDate)) {
        region.earliestDepartureDate = item.departureDate;
      }
    }
  });
  return {
    countries: [...countries.values()].map((country) => ({
      name: country.name,
      category: country.category,
      count: country.count,
      earliestDepartureDate: country.earliestDepartureDate,
      regions: [...country.regions.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"))
    })).sort((a, b) => a.name.localeCompare(b.name, "ko"))
  };
}

function buildGolfJoinHomeSummaryPayload(payload = {}, options = {}) {
  const generatedDate = String(payload.generatedAt || nowKstISOString()).slice(0, 10);
  const startDate = addDaysToISODate(generatedDate, GOLFJOIN_HOME_SUMMARY_START_OFFSET_DAYS) || generatedDate || payload.range?.startDate || "";
  const endDate = addDaysToISODate(startDate, GOLFJOIN_HOME_SUMMARY_RANGE_DAYS) || payload.range?.endDate || "";
  const sourceItems = Array.isArray(payload.items) ? payload.items : [];
  const items = sourceItems
    .filter((item) => !item.departureDate || (item.departureDate >= startDate && item.departureDate <= endDate))
    .map(compactGolfJoinHomeSummaryItem);
  return {
    schema: "secret-golf-join-home-summary-v1",
    generatedAt: payload.generatedAt || nowKstISOString(),
    sourceGeneratedAt: payload.generatedAt || "",
    range: { startDate, endDate },
    sourceCount: sourceItems.length,
    count: items.length,
    items,
    destinations: buildGolfJoinDestinationSummary(items),
    ...(options.homeBootstrapLight ? {
      homeBootstrapLight: options.homeBootstrapLight,
      homeBootstrapLightUpdatedAt: options.homeBootstrapLight.updatedAt || options.homeBootstrapLight.serverTime || nowKstISOString()
    } : {})
  };
}

function getGolfJoinProductObjectName(fileName) {
  return `${GOLFJOIN_PRODUCTS_PREFIX ? `${GOLFJOIN_PRODUCTS_PREFIX}/` : ""}${fileName}`;
}

async function saveGolfJoinProductsPayload(payload) {
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  const jsonText = `${JSON.stringify(payload, null, 2)}\n`;
  const jsText = `window.SECRET_GOLF_JOIN_PRODUCTS = ${jsonText};\n`;
  let homeBootstrapLight = null;
  try {
    homeBootstrapLight = await readHomeBootstrapLightDirect({ newScheduleLimit: 100, joinApplicationLimit: 100 });
  } catch (error) {
    console.warn("Failed to include home bootstrap light in product summary.", error);
  }
  const summaryPayload = buildGolfJoinHomeSummaryPayload(payload, { homeBootstrapLight });
  const summaryText = `${JSON.stringify(summaryPayload)}\n`;
  const options = {
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=60",
      contentType: "application/json; charset=utf-8"
    }
  };
  await bucket.file(getGolfJoinProductObjectName("golfjoin_home_summary.json")).save(summaryText, options);
  await bucket.file(getGolfJoinProductObjectName("golfjoin_local_data.json")).save(jsonText, options);
  await bucket.file(getGolfJoinProductObjectName("golfjoin_local_data.js")).save(jsText, {
    ...options,
    metadata: {
      ...options.metadata,
      contentType: "application/javascript; charset=utf-8"
    }
  });
}

async function readGolfJoinProductsPayloadFromStorage() {
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  const file = bucket.file(getGolfJoinProductObjectName("golfjoin_local_data.json"));
  const [buffer] = await file.download();
  const payload = JSON.parse(buffer.toString("utf8") || "{}");
  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw createHttpError("Stored golfjoin product payload is empty", 502);
  }
  return payload;
}

async function refreshGolfJoinHomeSummaryFromCurrentData(reason = "manual") {
  const [productsPayload, homeBootstrapLight] = await Promise.all([
    readGolfJoinProductsPayloadFromStorage(),
    readHomeBootstrapLightDirect({ newScheduleLimit: 100, joinApplicationLimit: 100 })
  ]);
  const summaryPayload = buildGolfJoinHomeSummaryPayload(productsPayload, { homeBootstrapLight });
  summaryPayload.refreshReason = asText(reason) || "manual";
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  await bucket.file(getGolfJoinProductObjectName("golfjoin_home_summary.json")).save(`${JSON.stringify(summaryPayload)}\n`, {
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=60",
      contentType: "application/json; charset=utf-8"
    }
  });
  return summaryPayload;
}

function refreshGolfJoinHomeSummaryInBackground(reason = "write") {
  refreshGolfJoinHomeSummaryFromCurrentData(reason)
    .then((summary) => {
      console.log("golfjoin home summary refreshed", {
        reason,
        count: summary.count,
        newScheduleCount: summary.homeBootstrapLight?.newScheduleSummaries?.length || 0,
        participantSummaryCount: summary.homeBootstrapLight?.participantSummaries?.length || 0
      });
    })
    .catch((error) => {
      console.warn("Failed to refresh golfjoin home summary in background.", {
        reason,
        message: error?.message || String(error)
      });
    });
}

async function refreshSecretTourProducts(req, res) {
  if (!isAdminReadRequest(req)) {
    const error = new Error(hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured");
    error.status = 403;
    throw error;
  }
  const items = await loadSecretTourGoodsProducts();
  if (!items.length) throw createHttpError("No Secret Tour products were loaded", 502);
  const payload = buildGolfJoinProductsPayload(items);
  await saveGolfJoinProductsPayload(payload);
  const summaryPayload = buildGolfJoinHomeSummaryPayload(payload);
  res.status(200).json({
    ok: true,
    saved: true,
    bucket: GOLFJOIN_PRODUCTS_BUCKET,
    files: [
      getGolfJoinProductObjectName("golfjoin_home_summary.json"),
      getGolfJoinProductObjectName("golfjoin_local_data.js"),
      getGolfJoinProductObjectName("golfjoin_local_data.json")
    ],
    generatedAt: payload.generatedAt,
    range: payload.range,
    summaryRange: summaryPayload.range,
    summaryCount: summaryPayload.count,
    count: payload.count,
    items: payload.items
  });
}

async function proxySecretTourJson(req, res) {
  if (!isAdminReadRequest(req)) {
    const error = new Error(hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured");
    error.status = 403;
    throw error;
  }
  const action = asText(req.query?.action);
  const target = action === "secret_tour_goods_events"
    ? buildSecretTourGoodsEventsProxyUrl(req.query || {})
    : buildSecretTourGoodsListProxyUrl(req.query || {});
  const response = await fetchWithTimeout(target, {
    method: "GET",
    headers: {
      "Accept": "application/json, */*;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "GolfJoinAdmin/1.0"
    },
    redirect: "follow"
  });
  const text = await response.text();
  res.status(response.status);
  res.set("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
  res.send(text);
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
  if (req.query?.action === "secret_tour_goods_list" || req.query?.action === "secret_tour_goods_events") {
    await proxySecretTourJson(req, res);
    return;
  }
  if (req.query?.action === "admin_bootstrap" && GOOGLE_SHEET_ID) {
    if (!isAdminReadRequest(req)) {
      const error = new Error(hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured");
      error.status = 403;
      throw error;
    }
    try {
      const payload = await readAdminBootstrapViaSheetsApi(req.query || {});
      if (req.query?.refreshSummary === "true") {
        refreshGolfJoinHomeSummaryInBackground("admin_bootstrap");
      }
      res.status(200).json(payload);
      return;
    } catch (error) {
      console.warn("Admin bootstrap via Google Sheets API failed; falling back to Apps Script.", {
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  }
  const requestedSheet = resolveReadSheetAlias(req.query?.sheet || "");
  const adminRequested = req.query?.admin === "1" || requestedSheet === "all" || !PUBLIC_READ_SHEETS.has(requestedSheet);
  const isAdmin = isAdminReadRequest(req);
  const preserveMemberQuoteLinks = (
    ["new_schedule_applications", "join_applications"].includes(requestedSheet)
    && hasMemberLookupParams(req.query || {})
  );
  if (adminRequested && !isAdmin) {
    const error = new Error(hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured");
    error.status = 403;
    throw error;
  }
  if (GOOGLE_SHEET_ID) {
    try {
      const payload = await readGenericSheetViaSheetsApi({
        ...(req.query || {}),
        sheet: requestedSheet || req.query?.sheet || ""
      });
      res.status(200).json(isAdmin ? payload : sanitizePublicPayload(payload, {
        preserveQuoteLinks: preserveMemberQuoteLinks
      }));
      return;
    } catch (error) {
      console.warn("Generic sheet read via Google Sheets API failed; falling back to Apps Script.", {
        sheet: requestedSheet,
        name: error?.name || "",
        message: error?.message || ""
      });
      if (!SHEET_WEB_APP_URL) throw error;
    }
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
    res.send(JSON.stringify(sanitizePublicPayload(JSON.parse(text), {
      preserveQuoteLinks: preserveMemberQuoteLinks
    })));
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

  if (req.query?.action === "home_bootstrap_light") {
    const payload = readBody(req);
    await proxyHomeBootstrapLight(payload, res);
    return;
  }

  if (req.query?.action === "home_stats") {
    await proxyHomeStats(res);
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
    if (GOOGLE_SHEET_ID) {
      try {
        const savedPayload = await updateAdminStatusViaSheetsApi(payload);
        if (savedPayload.ok && !payload.skipSummaryRefresh) {
          refreshGolfJoinHomeSummaryInBackground("admin_status_update");
        }
        res.status(200).json(savedPayload);
        return;
      } catch (error) {
        console.warn("Admin status update via Google Sheets API failed; falling back to Apps Script.", {
          name: error?.name || "",
          message: error?.message || ""
        });
      }
    }
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

  if (req.query?.action === "quote_generate") {
    if (!isAdminReadRequest(req)) {
      const error = new Error(hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured");
      error.status = 403;
      throw error;
    }
    if (!GOOGLE_SHEET_ID) throw createHttpError("GOOGLE_SHEET_ID is not configured", 500);
    const payload = readBody(req);
    const savedPayload = await generateQuoteViaSheetsApi(payload);
    res.status(savedPayload.ok ? 200 : 404).json(savedPayload);
    return;
  }

  if (req.query?.action === "refresh_secret_tour_products") {
    await refreshSecretTourProducts(req, res);
    return;
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
  const source = asText(payload.source);
  if (!isWriteRequestAuthorized(req) && !((source === "product_display_rule" || source === "recommended_schedule") && isAdminReadRequest(req))) {
    const error = new Error("Write token is required");
    error.status = 403;
    throw error;
  }
  validateWritePayload(payload);
  if (source === "join_member_profile" && GOOGLE_SHEET_ID) {
    try {
      const savedPayload = await saveJoinMemberProfileViaSheetsApi(payload);
      res.status(200).json(savedPayload);
      return;
    } catch (error) {
      console.warn("Join member profile save via Google Sheets API failed; falling back to Apps Script.", {
        requestId,
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  }
  if (source === "new_schedule_builder" && GOOGLE_SHEET_ID) {
    try {
      const savedPayload = await saveNewScheduleApplicationViaSheetsApi(payload);
      const notificationPayload = {
        ...payload,
        applicationId: savedPayload.applicationId || payload.applicationId,
        scheduleId: savedPayload.scheduleId || payload.scheduleId
      };
      sendGolfjoinApplicationNotificationsInBackground(notificationPayload, asText(notificationPayload.scheduleId), requestId);
      refreshGolfJoinHomeSummaryInBackground(source);
      res.status(200).json({
        ...savedPayload,
        notifications: ALIGO_ENABLED
          ? [{ queued: true, reason: "notification_queued" }]
          : [{ skipped: true, reason: "aligo is disabled" }]
      });
      return;
    } catch (error) {
      console.warn("New schedule save via Google Sheets API failed; falling back to Apps Script.", {
        requestId,
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  }
  if (source === "join_apply" && GOOGLE_SHEET_ID) {
    try {
      const savedPayload = await saveJoinApplicationViaSheetsApi(payload);
      sendGolfjoinApplicationNotificationsInBackground(payload, asText(payload.targetScheduleId || getValue(payload, "target.scheduleId")), requestId);
      refreshGolfJoinHomeSummaryInBackground(source);
      res.status(200).json({
        ...savedPayload,
        notifications: ALIGO_ENABLED
          ? [{ queued: true, reason: "notification_queued" }]
          : [{ skipped: true, reason: "aligo is disabled" }]
      });
      return;
    } catch (error) {
      if (isJoinScheduleFullError(error)) throw error;
      console.warn("Join apply save via Google Sheets API failed; falling back to Apps Script.", {
        requestId,
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  }
  if (source === "join_review" && GOOGLE_SHEET_ID) {
    try {
      const savedPayload = await saveJoinReviewViaSheetsApi(payload);
      res.status(200).json(savedPayload);
      return;
    } catch (error) {
      console.warn("Join review save via Google Sheets API failed; falling back to Apps Script.", {
        requestId,
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  }
  if (source === "join_wish" && GOOGLE_SHEET_ID) {
    try {
      const savedPayload = await saveJoinWishViaSheetsApi(payload);
      res.status(200).json(savedPayload);
      return;
    } catch (error) {
      console.warn("Join wish save via Google Sheets API failed; falling back to Apps Script.", {
        requestId,
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  }
  if ((source === "product_display_rule" || source === "recommended_schedule") && GOOGLE_SHEET_ID) {
    try {
      const savedPayload = await saveRecommendedScheduleViaSheetsApi(payload);
      refreshGolfJoinHomeSummaryInBackground(source);
      res.status(200).json(savedPayload);
      return;
    } catch (error) {
      console.warn("Recommended schedule save via Google Sheets API failed; falling back to Apps Script.", {
        requestId,
        name: error?.name || "",
        message: error?.message || ""
      });
    }
  }
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
    if (savedPayload?.ok === false && asText(savedPayload.code || savedPayload.error) === "join_schedule_full") {
      res.status(409).send(JSON.stringify(savedPayload));
      return;
    }
    sendGolfjoinApplicationNotificationsInBackground(payload, notificationScheduleId, requestId);
    refreshGolfJoinHomeSummaryInBackground(source);
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
    if (req.method === "GET" && req.query?.action === "share_og") {
      proxyShareOg(req, res);
      return;
    }
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
    res.status(error.status || 500).json({
      error: error.message || "Request failed",
      ...(error.code ? { code: error.code } : {}),
      ...(error.reason ? { reason: error.reason } : {}),
      ...(Number.isFinite(error.remainingSeats) ? { remainingSeats: error.remainingSeats } : {}),
      ...(Number.isFinite(error.requestedPeople) ? { requestedPeople: error.requestedPeople } : {}),
      ...(Number.isFinite(error.capacity) ? { capacity: error.capacity } : {}),
      ...(Number.isFinite(error.confirmedPeople) ? { confirmedPeople: error.confirmedPeople } : {})
    });
  }
};
