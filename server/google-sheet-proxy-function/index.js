"use strict";

const crypto = require("crypto");
const { Storage } = require("@google-cloud/storage");
const { createGolfjoinQuotePdfBuffer: createGolfjoinQuotePdfBufferV2 } = require("./quote-pdf");
const { createGolfjoinQuoteHtml, QUOTE_HERO_IMAGE_URL } = require("./quote-page");
const { getErpSessionCookie, postErpFormJson } = require("./erp-client");
const MAX_PARTICIPANT_PREVIEW_COUNT = 40;

const SHEET_WEB_APP_URL = process.env.SHEET_WEB_APP_URL || "";
const GOOGLE_SHEET_ID = String(process.env.GOOGLE_SHEET_ID || "").trim();
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "https://m.secret-tour.com,https://www.secret-tour.com,https://admin.secret-tour.com,https://dashboad-golfjoin-secrettour.web.app")
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
    "updatedAt",
    "memberKey",
    "birthDate",
    "profileStatus",
    "profileOrigin",
    "identityMatchStatus",
    "erpLinkedAt",
    "mergedIntoProfileId",
    "createdByAdmin",
    "updatedByAdmin"
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
    "quotePageFileName",
    "quoteDataFileName",
    "quoteGeneratedAt",
    "quoteAdditionalAmountsJson",
    "quoteFlightDetailsJson",
    "quoteAccessTokenHash",
    "quoteExpiresAt",
    "profileId",
    "registrationSource",
    "adminRosterItemId",
    "rosterBatchId",
    "applicantBirthDate",
    "identityMatchStatus",
    "scheduleSnapshotJson",
    "createdByAdmin",
    "updatedByAdmin",
    "cancelledAt",
    "cancelledBy",
    "cancelReason"
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
    "quotePageFileName",
    "quoteDataFileName",
    "quoteGeneratedAt",
    "quoteAdditionalAmountsJson",
    "quoteFlightDetailsJson",
    "quoteAccessTokenHash",
    "quoteExpiresAt"
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
const ADMIN_SESSION_TTL_SECONDS = Number(process.env.ADMIN_SESSION_TTL_SECONDS || 8 * 60 * 60);
const WRITE_TOKEN = String(process.env.WRITE_TOKEN || "").trim();
const ALIGO_USERID = String(process.env.ALIGO_USERID || "").trim();
const ALIGO_APIKEY = String(process.env.ALIGO_APIKEY || "").trim();
const ALIGO_SENDERKEY = String(process.env.ALIGO_SENDERKEY || "").trim();
const ALIGO_SENDER = String(process.env.ALIGO_SENDER || process.env.SENDER || "0234461119").trim();
const ALIGO_TESTMODE = String(process.env.ALIGO_TESTMODE || process.env.TESTMODE || "N").trim();
const ALIGO_ENABLED = String(process.env.ALIGO_ENABLED || "N").trim().toUpperCase() === "Y";
const ALIGO_REQUEST_TIMEOUT_MS = Number(process.env.ALIGO_REQUEST_TIMEOUT_MS || 8000);
const GOLFJOIN_ALIGO_SERVICE_URL = String(process.env.GOLFJOIN_ALIGO_SERVICE_URL || "").trim();
const GOLFJOIN_INTERNAL_SERVICE_TOKEN = String(process.env.GOLFJOIN_INTERNAL_SERVICE_TOKEN || "").trim();
const GOLFJOIN_SERVICE_ROLE = String(process.env.GOLFJOIN_SERVICE_ROLE || "all").trim().toLowerCase();
const GOLFJOIN_ALIGO_TASK_QUEUE = String(process.env.GOLFJOIN_ALIGO_TASK_QUEUE || "").trim();
const GOLFJOIN_ALIGO_TASK_LOCATION = String(process.env.GOLFJOIN_ALIGO_TASK_LOCATION || "asia-northeast3").trim();
const GOLFJOIN_TASKS_SERVICE_ACCOUNT = String(process.env.GOLFJOIN_TASKS_SERVICE_ACCOUNT || "").trim();
const GOLFJOIN_PROJECT_ID = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "").trim();
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
const GOLFJOIN_QUOTE_ACCOUNT_TEXT = String(process.env.GOLFJOIN_QUOTE_ACCOUNT_TEXT || "신한은행 140-013-991111 (주)시크릿투어").trim();
const GOLFJOIN_QUOTE_PDF_MAX_QUEUE = Math.max(1, Math.min(20, Number(process.env.GOLFJOIN_QUOTE_PDF_MAX_QUEUE || 5) || 5));
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

function isInternalServiceRequest(req) {
  return Boolean(
    GOLFJOIN_INTERNAL_SERVICE_TOKEN
    && safeEqual(getHeader(req, "x-golfjoin-internal-token"), GOLFJOIN_INTERNAL_SERVICE_TOKEN)
  );
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
  "quotegeneratedat",
  "quotepagefilename",
  "quotedatafilename",
  "quoteaccesstokenhash",
  "quoteexpiresat"
]);

const ALWAYS_PRIVATE_QUOTE_FIELD_KEYS = new Set([
  "quotefilename",
  "quotepagefilename",
  "quotedatafilename",
  "quoteaccesstokenhash"
]);

const PRIVATE_IDENTITY_FIELD_KEYS = new Set([
  "memberkey",
  "profileid",
  "birthdate",
  "applicantbirthdate",
  "identitymatchstatus",
  "adminrosteritemid",
  "rosterbatchid",
  "createdbyadmin",
  "updatedbyadmin",
  "cancelledby",
  "cancelreason",
  "mergedintoprofileid",
  "scheduleSnapshotJson".toLowerCase()
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
    if (ALWAYS_PRIVATE_QUOTE_FIELD_KEYS.has(lowerKey)) return object;
    if (PRIVATE_IDENTITY_FIELD_KEYS.has(lowerKey)) return object;
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
  const sheetsApiOnlyActions = new Set(["member_profile_lookup", "home_bootstrap", "home_bootstrap_light", "join_wishes_lookup", "admin_status_update", "admin_participant_lookup", "admin_participant_batch_upsert", "admin_participant_delete", "quote_generate", "admin_bootstrap", "refresh_secret_tour_products"]);
  const standaloneActions = new Set(["admin_login", "admin_erp_login_check", "admin_erp_member_lookup", "home_stats", "secret_tour_goods_detail", "secret_tour_flight_schedule", "secret_tour_goods_list", "secret_tour_goods_events"]);
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

function normalizeErpProductId(value = "", eventSeq = "") {
  const text = asText(value);
  if (!text) return "";
  const normalizedEventSeq = asText(eventSeq);
  if (text.startsWith("secret-tour-")) {
    const withoutPrefix = text.slice("secret-tour-".length);
    if (normalizedEventSeq && withoutPrefix.endsWith(`-${normalizedEventSeq}`)) {
      return withoutPrefix.slice(0, -(normalizedEventSeq.length + 1));
    }
    const numericMatch = withoutPrefix.match(/^(\d+)(?:-\d+)?$/);
    if (numericMatch) return numericMatch[1];
  }
  return text;
}

function isCancelledJoinApplication(row = {}) {
  const applicationStatus = asText(row.applicationStatus || row.status).toLowerCase();
  const participantStatus = asText(row.participantStatus).toLowerCase();
  const cancelledValues = new Set(["cancelled", "canceled", "cancel", "취소", "참여취소", "환불완료"]);
  return [applicationStatus, participantStatus].some((status) => (
    cancelledValues.has(status) || /cancel|취소|환불/.test(status)
  ));
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

function assertServiceRole(req) {
  if (!GOLFJOIN_SERVICE_ROLE || GOLFJOIN_SERVICE_ROLE === "all") return;
  const action = asText(req.query?.action);
  const isAllowed = GOLFJOIN_SERVICE_ROLE === "main"
    ? !["quote_generate", "send_application_notifications"].includes(action)
    : GOLFJOIN_SERVICE_ROLE === "quote"
      ? ["quote_generate", "quote_pdf", "quote_view"].includes(action)
      : GOLFJOIN_SERVICE_ROLE === "aligo"
        ? action === "send_application_notifications"
        : false;
  if (!isAllowed) throw createHttpError("Not found", 404);
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

async function getAlimtalkTripInfoWithLatestPhone(payload = {}, summary = {}) {
  const info = getAlimtalkTripInfo(payload, summary);
  if (!GOOGLE_SHEET_ID) return info;
  const identifiers = {
    memberSeq: getValue(payload, "member.memberSeq") || payload.memberSeq,
    memberId: getValue(payload, "member.memberId") || payload.memberId,
    memberMobile: getValue(payload, "member.memberMobile") || getValue(payload, "applicant.phone") || payload.memberMobile,
    memberEmail: getValue(payload, "member.memberEmail") || payload.memberEmail,
    kakaoId: getValue(payload, "member.kakaoId") || payload.kakaoId
  };
  if (!identifiers.memberSeq && !identifiers.memberId && !identifiers.memberMobile && !identifiers.memberEmail && !identifiers.kakaoId) {
    return info;
  }
  try {
    const profiles = await readMemberProfileLookupRowsViaSheetsApi(identifiers);
    const latestPhone = normalizePhone(profiles[0]?.memberMobile);
    return latestPhone ? { ...info, phone: latestPhone } : info;
  } catch (error) {
    console.warn("Failed to resolve latest member phone before Alimtalk send; using application phone.", {
      name: error?.name || "",
      message: error?.message || ""
    });
    return info;
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
    .filter(isManageableRecommendedScheduleRule)
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
    .filter(isManageableRecommendedScheduleRule)
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
    const info = await getAlimtalkTripInfoWithLatestPhone(payload, afterSummary || {});
    results.push({
      type: "create",
      result: await sendGolfjoinAlimtalk("create", info)
    });
  } else if (source === "join_apply") {
    const info = await getAlimtalkTripInfoWithLatestPhone(payload, afterSummary || {});
    results.push({
      type: "join",
      result: await sendGolfjoinAlimtalk("join", info)
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

async function processGolfjoinApplicationNotifications(payload = {}, notificationScheduleId = "", requestId = "") {
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
  console.log("golfjoin alimtalk completed", { requestId, source, notifications });
  return notifications;
}

function sendGolfjoinApplicationNotificationsInBackground(payload = {}, notificationScheduleId = "", requestId = "") {
  if (!ALIGO_ENABLED || !(asText(payload.source) === "new_schedule_builder" || asText(payload.source) === "join_apply")) return;
  setImmediate(() => {
    processGolfjoinApplicationNotifications(payload, notificationScheduleId, requestId).catch((error) => {
      console.warn("Failed to send golfjoin alimtalk notification in background.", {
        requestId,
        source: asText(payload.source),
        name: error?.name || "",
        message: error?.message || ""
      });
    });
  });
}

async function enqueueGolfjoinApplicationNotifications(payload = {}, notificationScheduleId = "", requestId = "") {
  if (!GOLFJOIN_PROJECT_ID || !GOLFJOIN_ALIGO_TASK_QUEUE || !GOLFJOIN_TASKS_SERVICE_ACCOUNT) {
    throw createHttpError("Cloud Tasks notification queue is not fully configured", 500, { code: "aligo_task_queue_not_configured" });
  }
  const target = new URL(GOLFJOIN_ALIGO_SERVICE_URL);
  target.searchParams.set("action", "send_application_notifications");
  const audienceUrl = new URL(GOLFJOIN_ALIGO_SERVICE_URL);
  audienceUrl.search = "";
  audienceUrl.hash = "";
  const taskKey = firstText(
    payload.applicationId,
    payload.joinApplyId,
    getValue(payload, "application.applicationId"),
    `${asText(payload.source)}|${notificationScheduleId}|${requestId}`
  );
  const taskId = `aligo-${asText(payload.source).replace(/[^a-z0-9_-]+/gi, "-")}-${sha256(taskKey).slice(0, 32)}`;
  const parent = `projects/${GOLFJOIN_PROJECT_ID}/locations/${GOLFJOIN_ALIGO_TASK_LOCATION}/queues/${GOLFJOIN_ALIGO_TASK_QUEUE}`;
  const accessToken = await getGoogleMetadataAccessToken();
  const response = await fetchWithTimeout(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      task: {
        name: `${parent}/tasks/${taskId}`,
        dispatchDeadline: "180s",
        httpRequest: {
          httpMethod: "POST",
          url: target.toString(),
          headers: {
            "Content-Type": "application/json",
            "X-Golfjoin-Internal-Token": GOLFJOIN_INTERNAL_SERVICE_TOKEN
          },
          body: Buffer.from(JSON.stringify({ payload, notificationScheduleId, requestId }), "utf8").toString("base64"),
          oidcToken: {
            serviceAccountEmail: GOLFJOIN_TASKS_SERVICE_ACCOUNT,
            audience: audienceUrl.toString().replace(/\/$/, "")
          }
        }
      }
    })
  }, 10_000, "Cloud Tasks enqueue");
  const result = await response.json().catch(() => ({}));
  if (response.status === 409) return { queued: true, duplicate: true, reason: "notification_already_queued" };
  if (!response.ok) throw createHttpError(result.error?.message || `Cloud Tasks enqueue failed: ${response.status}`, response.status || 502);
  return { queued: true, taskName: asText(result.name), reason: "notification_queued" };
}

async function dispatchGolfjoinApplicationNotifications(payload = {}, notificationScheduleId = "", requestId = "") {
  const source = asText(payload.source);
  if (!(source === "new_schedule_builder" || source === "join_apply")) {
    return [{ skipped: true, reason: "notification source is not supported" }];
  }
  if (!GOLFJOIN_ALIGO_SERVICE_URL) {
    sendGolfjoinApplicationNotificationsInBackground(payload, notificationScheduleId, requestId);
    return ALIGO_ENABLED
      ? [{ queued: true, reason: "notification_queued_locally" }]
      : [{ skipped: true, reason: "aligo service is not configured" }];
  }
  if (!GOLFJOIN_INTERNAL_SERVICE_TOKEN) {
    return [{ ok: false, reason: "internal service token is not configured" }];
  }
  if (GOLFJOIN_ALIGO_TASK_QUEUE) {
    try {
      return [await enqueueGolfjoinApplicationNotifications(payload, notificationScheduleId, requestId)];
    } catch (error) {
      console.warn("Failed to enqueue golfjoin alimtalk notification.", {
        requestId,
        source,
        name: error?.name || "",
        message: error?.message || ""
      });
      return [{ ok: false, reason: error?.message || "aligo task enqueue failed" }];
    }
  }
  try {
    const target = new URL(GOLFJOIN_ALIGO_SERVICE_URL);
    target.searchParams.set("action", "send_application_notifications");
    const audienceUrl = new URL(GOLFJOIN_ALIGO_SERVICE_URL);
    audienceUrl.search = "";
    audienceUrl.hash = "";
    const identityToken = await getGoogleMetadataIdentityToken(audienceUrl.toString().replace(/\/$/, ""));
    const response = await fetchWithTimeout(target.toString(), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${identityToken}`,
        "Content-Type": "application/json",
        "X-Golfjoin-Internal-Token": GOLFJOIN_INTERNAL_SERVICE_TOKEN
      },
      body: JSON.stringify({ payload, notificationScheduleId, requestId })
    }, Math.max(12_000, ALIGO_REQUEST_TIMEOUT_MS + 8_000), "Aligo service request");
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      return [{ ok: false, status: response.status, reason: result.error || "aligo service request failed" }];
    }
    return Array.isArray(result.notifications) ? result.notifications : [];
  } catch (error) {
    console.warn("Failed to dispatch golfjoin alimtalk notification.", {
      requestId,
      source,
      name: error?.name || "",
      message: error?.message || ""
    });
    return [{ ok: false, reason: error?.message || "aligo service request failed" }];
  }
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
    source: "join_apply"
  });
  const displayRules = filterSheetRowsForHome(sheetRows.recommended_schedules || [], {
    limit: 100
  }).filter(isActiveRecommendedScheduleRule);
  return sanitizeHomeBootstrapLightPayload({
    ok: true,
    serverTime: nowKstISOString(),
    updatedAt: nowKstISOString(),
    newScheduleSummaries: newSchedules.map(buildNewScheduleSummary),
    participantSummaries: buildParticipantSummaries(joinApplications, newSchedules, displayRules),
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
      capacity: Math.max(1, Math.round(Number(item.capacity) || 4)),
      confirmedCount: Math.max(0, Math.round(Number(item.confirmedCount) || 0)),
      remainingSlots: Math.max(0, Math.round(Number(item.remainingSlots) || 0)),
      participantsPreview: (Array.isArray(item.participantsPreview) ? item.participantsPreview : [])
        .map(sanitizePreviewItem)
        .slice(0, Math.min(MAX_PARTICIPANT_PREVIEW_COUNT, Math.max(1, Math.round(Number(item.capacity) || 4)))),
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

function normalizeQuoteAdditionalAmounts(value = []) {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch (error) {
      source = [];
    }
  }
  if (!Array.isArray(source)) return [];
  return source.slice(0, 12).map((item) => ({
    label: firstText(item?.label, item?.title, item?.name),
    amount: parseQuoteMoney(item?.amount ?? item?.value)
  })).filter((item) => item.label && item.amount);
}

const QUOTE_FLIGHT_DETAIL_KEYS = [
  "outboundFlightName",
  "outboundDepartureTime",
  "outboundArrivalTime",
  "inboundFlightName",
  "inboundDepartureTime",
  "inboundArrivalTime"
];

function normalizeQuoteFlightDetails(value = {}) {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch (error) {
      source = {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) source = {};
  return QUOTE_FLIGHT_DETAIL_KEYS.reduce((details, key) => {
    details[key] = asText(source[key]);
    return details;
  }, {});
}

function buildQuoteFlightScheduleItems(details = {}) {
  const normalized = normalizeQuoteFlightDetails(details);
  return [
    {
      label: "출발편",
      flightName: normalized.outboundFlightName,
      departureTime: normalized.outboundDepartureTime,
      arrivalTime: normalized.outboundArrivalTime
    },
    {
      label: "귀국편",
      flightName: normalized.inboundFlightName,
      departureTime: normalized.inboundDepartureTime,
      arrivalTime: normalized.inboundArrivalTime
    }
  ].filter((item) => item.flightName || item.departureTime || item.arrivalTime);
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

function normalizeQuoteFlightRequestType(...values) {
  const text = firstText(...values).replace(/\s+/g, "");
  if (text.includes("직접예약")) return "직접예약";
  if (text.includes("대행요청")) return "대행요청";
  return "";
}

function isQuoteFlightExcluded(draft = {}, row = {}, schedule = {}, product = {}) {
  const packType = firstText(
    draft.packType,
    row.packType,
    schedule.packType,
    product.packType,
    row.packTypeName,
    schedule.packTypeName,
    product.packTypeName
  ).replace(/\s+/g, "").toLowerCase();
  if (["golf", "골프팩", "golftel", "landonly", "land"].includes(packType)) return true;
  const flightIncluded = firstText(draft.flightIncluded, row.flightIncluded, schedule.flightIncluded, product.flightIncluded).replace(/\s+/g, "").toLowerCase();
  if (["n", "no", "false", "0", "불포함", "별도", "excluded"].includes(flightIncluded)) return true;
  const airline = firstText(draft.airline, row.airline, schedule.airline, product.airline, product.airlineName, product.air2Nm);
  return /개별항공|항공별도|항공불포함/.test(airline.replace(/\s+/g, ""));
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

function splitQuoteLineList(value, fallback = []) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).slice(0, 12);
  const items = asText(value).split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return items.length ? items : fallback;
}

function firstQuoteLineList(...values) {
  for (const value of values) {
    const items = splitQuoteLineList(value, []);
    if (items.length) return items;
  }
  return [];
}

function normalizeQuoteItinerarySchedule(value) {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch (error) {
      source = [];
    }
  }
  if (!Array.isArray(source)) return [];
  return source.slice(0, 15).map((item, index) => {
    if (!item || typeof item !== "object") return null;
    const points = (Array.isArray(item.points) ? item.points : splitQuoteList(item.content || item.rawText, []))
      .map((point) => {
        if (point && typeof point === "object") {
          return {
            title: firstText(point.title, point.main, point.name, point.text, point.content),
            description: firstText(point.description, point.subText, point.subtitle, point.detail)
          };
        }
        return { title: asText(point), description: "" };
      })
      .filter((point) => point.title)
      .slice(0, 20);
    const meals = Array.isArray(item.meals)
      ? item.meals.slice(0, 6).map((meal) => ({
        label: asText(meal?.label),
        menu: asText(meal?.menu)
      })).filter((meal) => meal.label || meal.menu)
      : [];
    return {
      day: firstText(item.day, `${index + 1}일차`),
      dateText: asText(item.dateText),
      points,
      content: firstText(item.content, item.rawText),
      hotel: asText(item.hotel),
      meals
    };
  }).filter(Boolean);
}

function getQuoteNightCount(values = [], departureDate = "", returnDate = "") {
  for (const value of values) {
    const match = asText(value).match(/(\d{1,2})\s*박/);
    if (match) return Math.max(1, Math.min(30, Number(match[1]) || 1));
  }
  const start = normalizeSheetDateText(departureDate);
  const end = normalizeSheetDateText(returnDate);
  const startMatch = start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const endMatch = end.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (startMatch && endMatch) {
    const startUtc = Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]));
    const endUtc = Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]));
    const nights = Math.round((endUtc - startUtc) / 86400000);
    if (nights > 0 && nights <= 30) return nights;
  }
  return 1;
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
  const departureDate = normalizeSheetDateText(firstText(draft.departureDate, row.departureDate, row.departureDateFrom, schedule.departureDate, schedule.departureDateFrom, product.departureDate));
  const returnDate = normalizeSheetDateText(firstText(draft.returnDate, row.returnDate, row.returnDateTo, schedule.returnDate, schedule.returnDateTo, product.returnDate));
  const tripSummary = firstText(
    draft.tripSummary,
    row.tripSummary,
    schedule.tripSummary,
    schedule.duration,
    product.tripSummary,
    product.dayNightCnt,
    product.duration
  );
  const nightCount = getQuoteNightCount([
    tripSummary,
    draft.productName,
    row.productName,
    schedule.productName,
    product.productName,
    product.title
  ], departureDate, returnDate);
  const unitPrice = parseQuoteMoney(firstText(draft.unitPrice, row.productPrice, row.price, schedule.productPrice, product.productPrice, product.price));
  const singleRoomSurchargePerNight = parseQuoteMoney(firstText(draft.singleRoomSurcharge, row.singleRoomSurcharge, schedule.singleRoomSurcharge));
  const singleRoomSurcharge = singleRoomSurchargePerNight * nightCount;
  const additionalAmounts = normalizeQuoteAdditionalAmounts(draft.additionalAmounts || row.quoteAdditionalAmountsJson);
  const additionalAmountTotal = additionalAmounts.reduce((sum, item) => sum + item.amount, 0);
  const airfareItem = additionalAmounts.find((item) => item.label.replace(/\s+/g, "") === "항공료");
  const airfare = airfareItem?.amount || 0;
  const productSubtotal = unitPrice ? unitPrice * people : 0;
  const estimatedTotal = productSubtotal + additionalAmountTotal + singleRoomSurcharge;
  const depositPerPerson = parseQuoteMoney(firstText(draft.depositPerPerson, GOLFJOIN_QUOTE_DEPOSIT_PER_PERSON));
  const deposit = depositPerPerson ? depositPerPerson * people : 0;
  const balance = estimatedTotal && deposit ? Math.max(0, estimatedTotal - deposit) : 0;
  const flightExcluded = isQuoteFlightExcluded(draft, row, schedule, product);
  const flightRequestType = normalizeQuoteFlightRequestType(
    draft.flightRequestType,
    row.flightRequestType,
    row.applicantFlightRequestType,
    getValue(row, "applicant.flightRequestType"),
    flightExcluded ? "대행요청" : ""
  );
  const savedFlightDetails = normalizeQuoteFlightDetails(row.quoteFlightDetailsJson);
  const flightDetails = normalizeQuoteFlightDetails(QUOTE_FLIGHT_DETAIL_KEYS.reduce((details, key) => {
    details[key] = Object.prototype.hasOwnProperty.call(draft, key) ? asText(draft[key]) : savedFlightDetails[key];
    return details;
  }, {}));
  const structuredFlightSchedule = buildQuoteFlightScheduleItems(flightDetails);
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
    productImageUrl: QUOTE_HERO_IMAGE_URL,
    country: firstText(draft.country, row.country, schedule.country, product.country),
    region: firstText(draft.region, row.region, schedule.region, product.region),
    departureDate,
    returnDate,
    airline: firstText(draft.airline, getQuoteFlightText(row, schedule, product)),
    flightExcluded,
    flightRequestType,
    flightDetails,
    ...flightDetails,
    departureAirport: firstText(draft.departureAirport, row.departureAirport, schedule.departureAirport, product.departureAirport, product.depAirport),
    arrivalAirport: firstText(draft.arrivalAirport, row.arrivalAirport, schedule.arrivalAirport, product.arrivalAirport, product.arrAirport),
    roomType: firstText(draft.roomType, getQuoteRoomType(row)),
    people,
    nightCount,
    tripDuration: tripSummary.match(/\d{1,2}\s*박/) ? tripSummary : `${nightCount}박 ${nightCount + 1}일`,
    companions: asText(row.applicantCompanions || row.companions),
    styles: asText(row.applicantStyles || row.styles),
    preferredMembers: asText(row.applicantPreferredMembers || row.memberPreferences),
    unitPrice,
    productSubtotal,
    singleRoomSurchargePerNight,
    singleRoomSurcharge,
    additionalAmounts: additionalAmounts.map((item) => ({ ...item, formattedAmount: formatQuoteMoney(item.amount) })),
    additionalAmountTotal,
    airfare,
    airfareIncluded: Boolean(airfare),
    estimatedTotal,
    deposit,
    balance,
    formattedProductSubtotal: formatQuoteMoney(productSubtotal || unitPrice),
    formattedSingleRoomSurchargePerNight: singleRoomSurchargePerNight ? formatQuoteMoney(singleRoomSurchargePerNight) : "-",
    formattedSingleRoomSurcharge: singleRoomSurcharge ? formatQuoteMoney(singleRoomSurcharge) : "-",
    formattedEstimatedTotal: formatQuoteMoney(estimatedTotal),
    formattedAirfare: airfare ? formatQuoteMoney(airfare) : "-",
    formattedDepositPerPerson: formatQuoteMoney(depositPerPerson),
    formattedDeposit: formatQuoteMoney(deposit),
    formattedBalance: estimatedTotal ? `${Math.round(balance).toLocaleString("ko-KR")}원` : "담당자 확인",
    accountText: firstText(draft.accountText, GOLFJOIN_QUOTE_ACCOUNT_TEXT),
    flightScheduleItems: structuredFlightSchedule.length
      ? structuredFlightSchedule
      : firstQuoteList(draft.flightScheduleItems, product.flightScheduleItems, row.flightScheduleItems),
    itinerarySchedule: normalizeQuoteItinerarySchedule(draft.itinerarySchedule || product.itinerarySchedule || product.schedule || row.itinerarySchedule),
    itineraryItems: firstQuoteList(draft.itineraryItems, product.itineraryItems, row.itineraryItems),
    includedItems: includedItems.length ? includedItems : ["실제 상품 포함 사항 확인 필요"],
    excludedItems: excludedItems.length ? excludedItems : ["실제 상품 불포함 사항 확인 필요"],
    productNotes: firstQuoteLineList(draft.productNotes, product.notes, product.notice, row.notes, row.notice),
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

const QUOTE_ENCRYPTED_FILE_MAGIC = Buffer.from("GJQ1", "ascii");

function getQuoteEncryptionKey(accessToken = "") {
  if (!asText(accessToken)) throw createHttpError("quote access token is required", 500);
  return crypto.createHash("sha256").update(String(accessToken), "utf8").digest();
}

function encryptQuoteBuffer(buffer, accessToken = "") {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getQuoteEncryptionKey(accessToken), iv);
  const encrypted = Buffer.concat([cipher.update(source), cipher.final()]);
  return Buffer.concat([QUOTE_ENCRYPTED_FILE_MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

function decryptQuoteBuffer(buffer, accessToken = "") {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  const headerLength = QUOTE_ENCRYPTED_FILE_MAGIC.length + 12 + 16;
  if (source.length <= headerLength || !source.subarray(0, QUOTE_ENCRYPTED_FILE_MAGIC.length).equals(QUOTE_ENCRYPTED_FILE_MAGIC)) {
    throw createHttpError("invalid quote file", 404);
  }
  const ivStart = QUOTE_ENCRYPTED_FILE_MAGIC.length;
  const tagStart = ivStart + 12;
  const encryptedStart = tagStart + 16;
  const decipher = crypto.createDecipheriv("aes-256-gcm", getQuoteEncryptionKey(accessToken), source.subarray(ivStart, tagStart));
  decipher.setAuthTag(source.subarray(tagStart, encryptedStart));
  return Buffer.concat([decipher.update(source.subarray(encryptedStart)), decipher.final()]);
}

function buildQuoteObjectName(quote = {}, extension = "pdf") {
  const date = normalizeSheetDateText(quote.generatedAt).replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeQuoteId = asText(quote.quoteId).replace(/[^a-z0-9_-]+/gi, "-") || buildGoogleSheetRecordId("quote", date);
  const safeExtension = asText(extension).toLowerCase().replace(/[^a-z0-9]+/g, "") || "pdf";
  return `${GOLFJOIN_QUOTES_PREFIX ? `${GOLFJOIN_QUOTES_PREFIX}/` : ""}${date.slice(0, 4)}/${date.slice(4, 6)}/${safeQuoteId}.${safeExtension}`;
}

function getQuoteAccessBaseUrl(requestUrl = "", action = "quote_view") {
  const configuredBase = action === "quote_pdf"
    ? firstText(process.env.GOLFJOIN_QUOTE_PDF_BASE_URL, process.env.GOLFJOIN_QUOTE_VIEW_BASE_URL)
    : asText(process.env.GOLFJOIN_QUOTE_VIEW_BASE_URL);
  const candidates = [configuredBase, asText(requestUrl)].filter(Boolean);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      if (host.endsWith(".cloudfunctions.net") && (!url.pathname || url.pathname === "/")) {
        const functionName = asText(process.env.GOLFJOIN_QUOTE_FUNCTION_NAME || process.env.K_SERVICE || "golfjoin-sheet-api");
        url.pathname = `/${functionName || "golfjoin-sheet-api"}`;
      } else if (host.endsWith(".a.run.app")) {
        url.pathname = "/";
      }
      url.search = "";
      url.hash = "";
      return url;
    } catch (error) {
      lastError = error;
    }
  }
  throw createHttpError(`quote view base URL is invalid: ${lastError?.message || "missing URL"}`, 500, {
    code: "quote_view_base_url_invalid"
  });
}

function buildQuoteAccessUrl(requestUrl = "", action = "quote_view", quoteId = "", accessToken = "") {
  const url = getQuoteAccessBaseUrl(requestUrl, action);
  url.search = "";
  url.hash = "";
  url.searchParams.set("action", action);
  url.searchParams.set("quoteId", quoteId);
  url.searchParams.set("token", accessToken);
  return url.toString();
}

async function saveQuoteHtmlToStorage(html, quote = {}, accessToken = "") {
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  const objectName = buildQuoteObjectName(quote, "html");
  const file = bucket.file(objectName);
  await file.save(encryptQuoteBuffer(Buffer.from(String(html || ""), "utf8"), accessToken), {
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      contentType: "application/octet-stream",
      metadata: { golfjoinQuoteEncrypted: "aes-256-gcm" }
    }
  });
  return {
    objectName
  };
}

async function saveQuoteDataToStorage(quote = {}, accessToken = "") {
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  const objectName = buildQuoteObjectName(quote, "json");
  const file = bucket.file(objectName);
  const body = Buffer.from(JSON.stringify(quote), "utf8");
  await file.save(encryptQuoteBuffer(body, accessToken), {
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      contentType: "application/octet-stream",
      metadata: { golfjoinQuoteEncrypted: "aes-256-gcm" }
    }
  });
  return { objectName };
}

function getQuoteObjectNameFromStorageUrl(value = "") {
  try {
    const url = new URL(asText(value));
    if (url.hostname !== "storage.googleapis.com") return "";
    const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    if (parts.shift() !== GOLFJOIN_PRODUCTS_BUCKET) return "";
    return parts.join("/");
  } catch (error) {
    return "";
  }
}

function isManagedQuoteObjectName(value = "") {
  const objectName = asText(value);
  if (!objectName || !/\.(?:html|json|pdf)$/i.test(objectName) || !/(?:^|\/)quote_[a-z0-9_-]+\.(?:html|json|pdf)$/i.test(objectName)) return false;
  return !GOLFJOIN_QUOTES_PREFIX || objectName.startsWith(`${GOLFJOIN_QUOTES_PREFIX}/`);
}

function getQuoteDataObjectName(row = {}) {
  const configured = asText(row.quoteDataFileName);
  if (configured) return configured;
  const pageObjectName = asText(row.quotePageFileName);
  return pageObjectName.toLowerCase().endsWith(".html")
    ? `${pageObjectName.slice(0, -5)}.json`
    : "";
}

async function deleteQuoteObjects(objectNames = []) {
  const candidates = [...new Set(objectNames.map(asText).filter(isManagedQuoteObjectName))];
  if (!candidates.length) return;
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  await Promise.allSettled(candidates.map((objectName) => bucket.file(objectName).delete({ ignoreNotFound: true })));
}

async function deleteSupersededQuoteFiles(row = {}, keepObjectNames = []) {
  const keep = new Set(keepObjectNames.map(asText).filter(Boolean));
  const candidates = new Set([
    asText(row.quoteFileName),
    asText(row.quotePageFileName),
    getQuoteDataObjectName(row),
    getQuoteObjectNameFromStorageUrl(row.quotePdfUrl),
    getQuoteObjectNameFromStorageUrl(row.quotePageUrl || row.quoteUrl)
  ].filter((objectName) => isManagedQuoteObjectName(objectName) && !keep.has(objectName)));
  if (!candidates.size) return;
  const bucket = storage.bucket(GOLFJOIN_PRODUCTS_BUCKET);
  const results = await Promise.allSettled([...candidates].map((objectName) => bucket.file(objectName).delete({ ignoreNotFound: true })));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn("Superseded quote cleanup failed.", { objectName: [...candidates][index], message: result.reason?.message || String(result.reason) });
    }
  });
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
    normalizeErpProductId(row.erpProductId, row.erpEventSeq),
    row.erpEventSeq || ""
  ].map(asText).join("|");
}

function buildParticipantSummaries(rows = [], newSchedules = [], recommendedRows = []) {
  const groups = new Map();
  rows.filter((row) => !isCancelledJoinApplication(row)).forEach((row) => {
    const key = getParticipantSummaryKey(row);
    const targetSchedule = findJoinApplicationTargetSchedule(row, newSchedules, recommendedRows);
    if (getParticipantSummaryTargetType(row) === "recommended_schedule" && !targetSchedule) return;
    const capacity = getScheduleCapacity(targetSchedule || {});
    if (!groups.has(key)) {
      const creatorPeople = targetSchedule && !targetSchedule.isAdminRecommendedSchedule
        ? parsePeopleCount(targetSchedule.applicantPeople || targetSchedule.creatorPeople || "1")
        : 0;
      const creatorPreview = creatorPeople > 0
        ? buildParticipantPreviewList({
            applicantName: targetSchedule.applicantName || targetSchedule.creatorName,
            applicantGender: targetSchedule.applicantGender || targetSchedule.creatorGender,
            applicantAgeBand: targetSchedule.applicantAgeBand || targetSchedule.creatorAgeDisplay
          }, creatorPeople)
        : [];
      groups.set(key, {
        targetType: getParticipantSummaryTargetType(row),
        targetScheduleId: asText(row.targetScheduleId),
        targetApplicationId: asText(row.targetApplicationId),
        erpProductId: normalizeErpProductId(row.erpProductId, row.erpEventSeq),
        erpEventSeq: asText(row.erpEventSeq),
        capacity,
        requestedCount: creatorPeople,
        confirmedCount: Math.min(capacity, creatorPeople),
        remainingSlots: Math.max(0, capacity - creatorPeople),
        participantsPreview: creatorPreview.slice(0, Math.min(MAX_PARTICIPANT_PREVIEW_COUNT, capacity)),
        lastAppliedAt: ""
      });
    }
    const group = groups.get(key);
    group.capacity = Math.max(group.capacity, capacity);
    const count = parsePeopleCount(row.applicantPeople || row.people || "1");
    group.requestedCount += count;
    group.confirmedCount = Math.min(group.capacity, group.requestedCount);
    group.participantsPreview = group.participantsPreview
      .concat(buildParticipantPreviewList(row, count))
      .slice(0, Math.min(MAX_PARTICIPANT_PREVIEW_COUNT, group.capacity));
    group.remainingSlots = Math.max(0, group.capacity - group.confirmedCount);
    const appliedAt = asText(row.updatedAt || row.createdAt);
    if (appliedAt > asText(group.lastAppliedAt)) group.lastAppliedAt = appliedAt;
  });
  return Array.from(groups.values()).map(({ requestedCount, ...group }) => group);
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
  return section === "available_schedule"
    && !["false", "0", "no", "hidden", "deleted"].includes(visible)
    && !["cancelled", "hidden", "deleted"].includes(status);
}

function isManageableRecommendedScheduleRule(rule = {}) {
  const section = asText(rule.section) || "available_schedule";
  const status = asText(rule.status).toLowerCase();
  return section === "available_schedule" && status !== "deleted";
}

function buildRecommendedScheduleSummarySource(rule = {}) {
  return {
    scheduleId: buildRecommendedScheduleId(rule),
    sourceApplicationId: rule.recommendedScheduleId || rule.displayRuleId || "",
    applicationId: rule.recommendedScheduleId || rule.displayRuleId || "",
    productName: rule.overrideTitle || rule.productName || rule.erpProductId || "Recommended schedule",
    country: rule.country || "",
    region: rule.region || "",
    airline: rule.airline || "",
    departureAirport: rule.departureAirport || "",
    arrivalAirport: rule.arrivalAirport || "",
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
    status: asText(rule.status) || "open",
    approvalStatus: "approved",
    displayStatus: isActiveRecommendedScheduleRule(rule) ? "visible" : "hidden",
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
  if (targetIds.length) return false;
  if (!schedule.isAdminRecommendedSchedule) return false;
  const eventSeq = asText(schedule.erpEventSeq);
  const productId = normalizeErpProductId(schedule.erpProductId, eventSeq);
  const targetProductKeyParts = asText(join.targetProductKey).split(":");
  const joinEventSeq = asText(join.erpEventSeq || (targetProductKeyParts[0] === "erp" ? targetProductKeyParts[targetProductKeyParts.length - 1] : ""));
  const targetProductId = targetProductKeyParts[0] === "erp" && targetProductKeyParts.length >= 3
    ? targetProductKeyParts.slice(1, -1).join(":")
    : "";
  const joinProductId = normalizeErpProductId(join.erpProductId || targetProductId, joinEventSeq);
  return Boolean(productId && eventSeq && joinProductId === productId && joinEventSeq === eventSeq);
}

function buildScheduleParticipantSummary(schedule = {}, joinRows = []) {
  const relatedJoins = joinRows.filter((join) => isJoinApplicationForSchedule(join, schedule));
  const confirmedJoins = relatedJoins.filter((join) => !isCancelledJoinApplication(join));
  const cancelledJoins = relatedJoins.filter(isCancelledJoinApplication);
  const pendingJoins = relatedJoins.filter((join) => (
    !isCancelledJoinApplication(join)
    && asText(join.applicationStatus || join.status) === "pending"
  ));
  const creatorCancelled = !schedule.isAdminRecommendedSchedule && isCancelledJoinApplication(schedule);
  const creatorBasePeople = schedule.isAdminRecommendedSchedule ? 0 : parsePeopleCount(schedule.applicantPeople || schedule.creatorPeople || "1");
  const creatorPeople = creatorCancelled ? 0 : creatorBasePeople;
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
    cancelledPeople: (creatorCancelled ? creatorBasePeople : 0)
      + cancelledJoins.reduce((sum, join) => sum + parsePeopleCount(join.applicantPeople || join.people), 0),
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

async function syncScheduleParticipantSummarySheetViaApi(sourceSheet = "", updatedRow = {}) {
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "recommended_schedules",
    "schedule_participant_summary"
  ], { timeoutMs: 9000 });
  const schedules = (sheetRows.new_schedule_applications || []).concat(
    (sheetRows.recommended_schedules || [])
      .filter(isManageableRecommendedScheduleRule)
      .map(buildRecommendedScheduleSummarySource)
  );
  const updatedIds = new Set([
    updatedRow.scheduleId,
    updatedRow.applicationId,
    updatedRow.sourceApplicationId
  ].map(asText).filter(Boolean));
  const targetSchedules = sourceSheet === "new_schedule_applications"
    ? schedules.filter((schedule) => [
      schedule.scheduleId,
      schedule.applicationId,
      schedule.sourceApplicationId
    ].map(asText).some((id) => id && updatedIds.has(id)))
    : schedules.filter((schedule) => isJoinApplicationForSchedule(updatedRow, schedule));
  if (!targetSchedules.length) {
    return { ok: true, updated: 0, appended: 0, reason: "schedule_not_found" };
  }

  const headers = GOOGLE_SHEET_HEADERS.schedule_participant_summary;
  const summaryRows = sheetRows.schedule_participant_summary || [];
  let updated = 0;
  let appended = 0;
  for (const schedule of targetSchedules) {
    const summary = buildScheduleParticipantSummary(schedule, sheetRows.join_applications || []);
    const summaryIds = new Set([summary.scheduleId, summary.sourceApplicationId].map(asText).filter(Boolean));
    const existingIndex = summaryRows.findIndex((row) => [
      row.scheduleId,
      row.sourceApplicationId
    ].map(asText).some((id) => id && summaryIds.has(id)));
    const values = headers.map((header) => summary[header] == null ? "" : summary[header]);
    if (existingIndex >= 0) {
      await updateGoogleSheetRowViaApi("schedule_participant_summary", existingIndex + 2, values, {
        timeoutMs: 7000,
        valueInputOption: "RAW"
      });
      summaryRows[existingIndex] = summary;
      updated += 1;
    } else {
      await appendGoogleSheetValuesViaApi("schedule_participant_summary", values, {
        timeoutMs: 7000,
        valueInputOption: "RAW"
      });
      summaryRows.push(summary);
      appended += 1;
    }
  }
  return { ok: true, updated, appended };
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
    .filter(isManageableRecommendedScheduleRule)
    .map(buildRecommendedScheduleSummarySource);
  const targetType = asText(joinRow.targetType);
  const targetScheduleId = asText(joinRow.targetScheduleId);
  const targetApplicationId = asText(joinRow.targetApplicationId);
  const targetJoinId = asText(joinRow.targetJoinId);
  const wantsRecommended = targetType === "recommended_schedule" || targetJoinId.startsWith("admin-recommended-") || targetScheduleId.startsWith("admin-recommended-");
  const primarySchedules = wantsRecommended ? recommendedSchedules : newSchedules;
  const fallbackSchedules = wantsRecommended ? newSchedules : recommendedSchedules;
  const targetIds = [targetJoinId, targetScheduleId, targetApplicationId].filter(Boolean);
  const exactMatch = [...primarySchedules, ...fallbackSchedules]
    .find((schedule) => targetIds.some((targetId) => doScheduleIdsMatch(schedule, targetId, targetId)));
  if (exactMatch) return exactMatch;
  if (targetJoinId || targetScheduleId || targetApplicationId) return null;
  const legacyMatches = [...primarySchedules, ...fallbackSchedules]
    .filter((schedule) => isJoinApplicationForSchedule(joinRow, schedule));
  return legacyMatches.length === 1 ? legacyMatches[0] : null;
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
  }).filter(isActiveRecommendedScheduleRule).map(normalizeSheetRowForJson).map(sanitizePublicRow);
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

const googleMetadataIdentityTokenCache = new Map();

async function getGoogleMetadataIdentityToken(audience = "") {
  const safeAudience = asText(audience);
  if (!safeAudience) throw createHttpError("Google identity token audience is empty", 500);
  const cached = googleMetadataIdentityTokenCache.get(safeAudience);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const url = new URL("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity");
  url.searchParams.set("audience", safeAudience);
  url.searchParams.set("format", "full");
  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: { "Metadata-Flavor": "Google", "Accept": "text/plain" }
  }, 8000, "Google metadata identity token");
  const token = asText(await response.text());
  if (!response.ok || !token) throw createHttpError(`Google metadata identity token failed: ${response.status}`, response.status || 502);
  let expiresAt = Date.now() + 5 * 60_000;
  try {
    const payload = parseBase64UrlJson(token.split(".")[1]);
    expiresAt = Number(payload.exp || 0) * 1000 || expiresAt;
  } catch (error) {}
  googleMetadataIdentityTokenCache.set(safeAudience, { token, expiresAt });
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
    updatedAt: nowKstISOString(),
    memberKey: payload.memberKey || getValue(payload, "member.memberKey") || buildMemberKeyFromValues({
      memberSeq: getValue(payload, "member.memberSeq") || payload.memberSeq,
      memberId: getValue(payload, "member.memberId") || payload.memberId,
      memberMobile: getValue(payload, "member.memberMobile") || payload.memberMobile
    }),
    birthDate: getValue(payload, "profile.birthDate") || payload.birthDate,
    profileStatus: getValue(payload, "profile.profileStatus") || payload.profileStatus,
    profileOrigin: getValue(payload, "profile.profileOrigin") || payload.profileOrigin,
    identityMatchStatus: payload.identityMatchStatus,
    erpLinkedAt: payload.erpLinkedAt,
    mergedIntoProfileId: payload.mergedIntoProfileId,
    createdByAdmin: payload.createdByAdmin,
    updatedByAdmin: payload.updatedByAdmin
  };
  return values[header] == null ? "" : values[header];
}

function buildJoinMemberProfileSheetRow(payload = {}, existingRow = {}, headers = GOOGLE_SHEET_HEADERS.join_member_profiles, options = {}) {
  return headers.map((header) => {
    if (header === "createdAt" && existingRow.createdAt) return existingRow.createdAt;
    const value = buildJoinMemberProfileSheetValue(payload, header);
    if (
      options.preserveExistingWhenEmpty
      && (value == null || value === "")
      && existingRow[header] != null
      && existingRow[header] !== ""
    ) {
      return existingRow[header];
    }
    return value;
  });
}

function findAdminRosterTemporaryProfileIndex(rows = [], payload = {}) {
  const memberName = normalizeErpMemberName(getValue(payload, "member.memberName") || payload.memberName);
  const memberMobile = normalizePhone(getValue(payload, "member.memberMobile") || payload.memberMobile);
  if (!memberName || !memberMobile) return -1;
  const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => (
    !asText(row.mergedIntoProfileId)
    && (asText(row.profileStatus) === "temporary" || asText(row.profileOrigin) === "admin_roster")
    && normalizeErpMemberName(row.memberName || row.name) === memberName
    && normalizePhone(row.memberMobile || row.mobile || row.phone) === memberMobile
  ));
  matches.sort((left, right) => (
    asText(right.row.updatedAt || right.row.createdAt).localeCompare(asText(left.row.updatedAt || left.row.createdAt))
  ));
  return matches[0]?.index ?? -1;
}

async function claimAdminRosterApplicationsForProfile(profileId = "", profilePayload = {}) {
  const safeProfileId = asText(profileId);
  if (!safeProfileId) return 0;
  const headers = await ensureGoogleSheetHeadersViaApi("join_applications", { timeoutMs: 7000 });
  const rows = await readGoogleSheetRowsViaApi("join_applications", { timeoutMs: 7000 });
  const memberName = asText(getValue(profilePayload, "member.memberName") || profilePayload.memberName);
  const memberMobile = normalizePhone(getValue(profilePayload, "member.memberMobile") || profilePayload.memberMobile);
  const memberSeq = asText(getValue(profilePayload, "member.memberSeq") || profilePayload.memberSeq);
  const memberId = asText(getValue(profilePayload, "member.memberId") || profilePayload.memberId);
  const memberEmail = asText(getValue(profilePayload, "member.memberEmail") || profilePayload.memberEmail);
  const memberChannel = asText(getValue(profilePayload, "member.memberChannel") || profilePayload.memberChannel);
  const profileMemberKey = `profile:${safeProfileId}`;
  const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => {
    if (asText(row.registrationSource).toLowerCase() !== "admin") return false;
    if (asText(row.profileId) === safeProfileId || asText(row.memberKey) === profileMemberKey) return true;
    return Boolean(
      memberName
      && memberMobile
      && normalizeErpMemberName(row.applicantName || row.memberName) === normalizeErpMemberName(memberName)
      && normalizePhone(row.applicantMobile || row.memberMobile) === memberMobile
    );
  });
  for (const { row, index } of matches) {
    const next = {
      ...row,
      profileId: safeProfileId,
      memberKey: profileMemberKey,
      memberSeq: memberSeq || row.memberSeq,
      memberId: memberId || row.memberId,
      memberName: memberName || row.memberName,
      memberMobile: memberMobile || row.memberMobile,
      memberEmail: memberEmail || row.memberEmail,
      memberChannel: memberChannel || row.memberChannel,
      identityMatchStatus: "member_profile",
      updatedAt: nowKstISOString()
    };
    await updateGoogleSheetRowViaApi(
      "join_applications",
      index + 2,
      headers.map((header) => next[header] == null ? "" : next[header]),
      { timeoutMs: 7000 }
    );
  }
  if (matches.length) refreshGolfJoinHomeSummaryInBackground("admin_roster_profile_claim");
  return matches.length;
}

async function syncApplicationPhonesForMemberProfile(profileId = "", profilePayload = {}, previousProfile = {}) {
  const nextPhone = normalizePhone(getValue(profilePayload, "member.memberMobile") || profilePayload.memberMobile);
  if (!nextPhone) return 0;
  const identifiers = {
    profileId: asText(profileId),
    memberKey: asText(profilePayload.memberKey || getValue(profilePayload, "member.memberKey")),
    memberSeq: asText(getValue(profilePayload, "member.memberSeq") || profilePayload.memberSeq || previousProfile.memberSeq),
    memberId: asText(getValue(profilePayload, "member.memberId") || profilePayload.memberId || previousProfile.memberId),
    memberEmail: asText(getValue(profilePayload, "member.memberEmail") || profilePayload.memberEmail || previousProfile.memberEmail).toLowerCase(),
    kakaoId: asText(getValue(profilePayload, "member.kakaoId") || profilePayload.kakaoId || previousProfile.kakaoId),
    previousPhone: normalizePhone(previousProfile.memberMobile || previousProfile.mobile || previousProfile.phone),
    memberName: normalizeErpMemberName(getValue(profilePayload, "member.memberName") || profilePayload.memberName || previousProfile.memberName)
  };
  const matchesProfile = (row = {}) => {
    if (identifiers.profileId && asText(row.profileId) === identifiers.profileId) return true;
    if (identifiers.memberKey && asText(row.memberKey) === identifiers.memberKey) return true;
    if (identifiers.memberSeq && asText(row.memberSeq) === identifiers.memberSeq) return true;
    if (identifiers.memberId && asText(row.memberId) === identifiers.memberId) return true;
    if (identifiers.memberEmail && asText(row.memberEmail).toLowerCase() === identifiers.memberEmail) return true;
    if (identifiers.kakaoId && asText(row.kakaoId) === identifiers.kakaoId) return true;
    return Boolean(
      identifiers.previousPhone
      && identifiers.memberName
      && normalizePhone(row.memberMobile || row.applicantMobile) === identifiers.previousPhone
      && normalizeErpMemberName(row.memberName || row.applicantName) === identifiers.memberName
    );
  };
  let updatedCount = 0;
  for (const sheetName of ["join_applications", "new_schedule_applications"]) {
    const [headers, rows] = await Promise.all([
      ensureGoogleSheetHeadersViaApi(sheetName, { timeoutMs: 7000 }),
      readGoogleSheetRowsViaApi(sheetName, { timeoutMs: 7000 })
    ]);
    const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => matchesProfile(row));
    for (const { row, index } of matches) {
      const next = {
        ...row,
        memberMobile: nextPhone,
        applicantMobile: nextPhone
      };
      await updateGoogleSheetRowViaApi(
        sheetName,
        index + 2,
        headers.map((header) => next[header] == null ? "" : next[header]),
        { timeoutMs: 7000 }
      );
      updatedCount += 1;
    }
  }
  if (updatedCount) refreshGolfJoinHomeSummaryInBackground("member_profile_phone_sync");
  return updatedCount;
}

async function saveJoinMemberProfileViaSheetsApi(payload = {}) {
  const requestedProfileId = asText(payload.profileId || buildJoinMemberProfileSheetValue(payload, "profileId"));
  if (!requestedProfileId) throw createHttpError("profileId is required", 400);
  const headers = await ensureGoogleSheetHeadersViaApi("join_member_profiles", { timeoutMs: 6000 });
  const rows = await readGoogleSheetRowsViaApi("join_member_profiles", { timeoutMs: 5000 });
  const profileIdIndex = rows.findIndex((row) => asText(row.profileId) === requestedProfileId);
  const temporaryProfileIndex = findAdminRosterTemporaryProfileIndex(rows, payload);
  const existingIndex = profileIdIndex >= 0 ? profileIdIndex : temporaryProfileIndex;
  const existingRow = existingIndex >= 0 ? rows[existingIndex] : {};
  const profileId = asText(existingRow.profileId) || requestedProfileId;
  const claimsAdminRoster = asText(existingRow.profileStatus) === "temporary" || asText(existingRow.profileOrigin) === "admin_roster";
  const rowPayload = claimsAdminRoster ? {
    ...payload,
    profileId,
    memberKey: `profile:${profileId}`,
    profileStatus: "active",
    profileOrigin: existingRow.profileOrigin || "admin_roster",
    identityMatchStatus: "member_profile",
    erpLinkedAt: existingRow.erpLinkedAt,
    createdByAdmin: existingRow.createdByAdmin,
    updatedByAdmin: existingRow.updatedByAdmin
  } : { ...payload, profileId };
  const rowValues = buildJoinMemberProfileSheetRow(rowPayload, existingRow, headers, {
    preserveExistingWhenEmpty: claimsAdminRoster
  });
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await updateGoogleSheetRowViaApi("join_member_profiles", rowNumber, rowValues, { timeoutMs: 6000 });
    const claimedApplicationCount = claimsAdminRoster
      ? await claimAdminRosterApplicationsForProfile(profileId, rowPayload)
      : 0;
    const syncedApplicationCount = await syncApplicationPhonesForMemberProfile(profileId, rowPayload, existingRow).catch((error) => {
      console.warn("Failed to synchronize member phone to application rows after profile update.", {
        profileId,
        name: error?.name || "",
        message: error?.message || ""
      });
      return 0;
    });
    return {
      ok: true,
      sheet: "join_member_profiles",
      write: "update",
      row: rowNumber,
      source: "sheets_api",
      profileId,
      claimedApplicationCount,
      syncedApplicationCount
    };
  }
  const response = await appendGoogleSheetValuesViaApi("join_member_profiles", rowValues, { timeoutMs: 6000 });
  const syncedApplicationCount = await syncApplicationPhonesForMemberProfile(profileId, rowPayload, existingRow).catch((error) => {
    console.warn("Failed to synchronize member phone to application rows after profile append.", {
      profileId,
      name: error?.name || "",
      message: error?.message || ""
    });
    return 0;
  });
  return {
    ok: true,
    sheet: "join_member_profiles",
    write: "append",
    row: response.updates?.updatedRange || "",
    source: "sheets_api",
    profileId,
    syncedApplicationCount
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

async function appendGoogleSheetRowsViaApi(sheetName, rows = [], options = {}) {
  if (!GOOGLE_SHEET_ID) throw createHttpError("GOOGLE_SHEET_ID is not configured", 500);
  if (!Array.isArray(rows) || !rows.length) return { updates: { updatedRows: 0 } };
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
    body: JSON.stringify({ values: rows })
  }, options.timeoutMs || 10_000, `Google Sheets batch append ${sheetName}`);
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Google Sheets API batch append failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }
  return JSON.parse(text || "{}");
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
  const erpEventSeq = payload.erpEventSeq || getValue(payload, "product.erpEventSeq") || getValue(payload, "product.eventSeq");
  const erpProductId = normalizeErpProductId(
    payload.erpProductId || getValue(payload, "product.erpProductId") || getValue(payload, "product.productId"),
    erpEventSeq
  );
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
    targetProductKey,
    profileId: payload.profileId || getValue(payload, "member.profileId"),
    registrationSource: payload.registrationSource,
    adminRosterItemId: payload.adminRosterItemId,
    rosterBatchId: payload.rosterBatchId,
    applicantBirthDate: getValue(payload, "applicant.birthDate") || payload.applicantBirthDate,
    identityMatchStatus: payload.identityMatchStatus,
    scheduleSnapshotJson: typeof payload.scheduleSnapshotJson === "string"
      ? payload.scheduleSnapshotJson
      : JSON.stringify(payload.scheduleSnapshot || {}),
    createdByAdmin: payload.createdByAdmin,
    updatedByAdmin: payload.updatedByAdmin,
    cancelledAt: payload.cancelledAt,
    cancelledBy: payload.cancelledBy,
    cancelReason: payload.cancelReason
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
  let participantSummarySync = null;
  if (!payload.skipSummaryRefresh) {
    try {
      participantSummarySync = await syncScheduleParticipantSummarySheetViaApi(sheetName, nextRow);
    } catch (error) {
      participantSummarySync = {
        ok: false,
        error: error?.message || String(error)
      };
      console.warn("Failed to sync schedule participant summary sheet.", {
        sheet: sheetName,
        keyValue,
        message: participantSummarySync.error
      });
    }
  }
  return {
    ok: true,
    sheet: sheetName,
    row: rowNumber,
    keyField,
    keyValue,
    source: "sheets_api",
    ...(participantSummarySync ? { participantSummarySync } : {})
  };
}

async function generateQuoteViaSheetsApi(payload = {}, requestUrl = "") {
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
  const quoteAccessToken = crypto.randomBytes(32).toString("base64url");
  const quoteAccessTokenHash = sha256(quoteAccessToken);
  const quotePageUrl = buildQuoteAccessUrl(requestUrl, "quote_view", quote.quoteId, quoteAccessToken);
  const quotePdfUrl = buildQuoteAccessUrl(requestUrl, "quote_pdf", quote.quoteId, quoteAccessToken);
  let savedData;
  try {
    savedData = await saveQuoteDataToStorage(quote, quoteAccessToken);
  } catch (error) {
    throw createHttpError(`quote data upload failed: ${error.message || error}`, error.status || 502, { code: error.code || "quote_data_upload_failed" });
  }
  let savedPage;
  try {
    const quoteHtml = createGolfjoinQuoteHtml(quote, { pdfUrl: quotePdfUrl });
    savedPage = await saveQuoteHtmlToStorage(quoteHtml, quote, quoteAccessToken);
  } catch (error) {
    await deleteQuoteObjects([savedData.objectName]);
    throw createHttpError(`quote page upload failed: ${error.message || error}`, error.status || 502, { code: error.code || "quote_page_upload_failed" });
  }
  const fields = {
    quoteId: quote.quoteId,
    quoteNo: quote.quoteNo,
    quoteUrl: quotePageUrl,
    quotePageUrl,
    quotePdfUrl,
    quoteFileName: "",
    quotePageFileName: savedPage.objectName,
    quoteDataFileName: savedData.objectName,
    quoteGeneratedAt: quote.generatedAt,
    quoteAdditionalAmountsJson: JSON.stringify(quote.additionalAmounts || []),
    quoteFlightDetailsJson: JSON.stringify(quote.flightDetails || {}),
    quoteAccessTokenHash,
    quoteExpiresAt: "",
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
    await deleteQuoteObjects([savedPage.objectName, savedData.objectName]);
    throw createHttpError(`quote row update failed: ${error.message || error}`, error.status || 502, { code: error.code || "quote_row_update_failed" });
  }
  await deleteSupersededQuoteFiles(existingRow, [savedPage.objectName, savedData.objectName]);
  return {
    ok: true,
    sheet,
    row: rowNumber,
    keyField: "applicationId",
    keyValue,
    quoteId: quote.quoteId,
    quoteNo: quote.quoteNo,
    quoteUrl: quotePageUrl,
    quotePageUrl,
    quotePdfUrl,
    quoteFileName: "",
    quoteGeneratedAt: quote.generatedAt,
    quoteStatus: fields.quoteStatus,
    fields: {
      quoteId: fields.quoteId,
      quoteNo: fields.quoteNo,
      quoteUrl: fields.quoteUrl,
      quotePageUrl: fields.quotePageUrl,
      quotePdfUrl: fields.quotePdfUrl,
      quoteFileName: fields.quoteFileName,
      quotePageFileName: fields.quotePageFileName,
      quoteDataFileName: fields.quoteDataFileName,
      quoteGeneratedAt: fields.quoteGeneratedAt,
      quoteAdditionalAmountsJson: fields.quoteAdditionalAmountsJson,
      quoteFlightDetailsJson: fields.quoteFlightDetailsJson,
      quoteStatus: fields.quoteStatus
    },
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

function setProtectedQuoteHeaders(res) {
  res.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
}

function sendProtectedQuoteError(res, status = 404) {
  setProtectedQuoteHeaders(res);
  res.status(status);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>견적서 확인 안내</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f4f7fa;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.box{max-width:460px;padding:36px;border:1px solid #dde3ec;background:#fff;text-align:center}.box h1{margin:0 0 12px;font-size:22px}.box p{margin:0;color:#697386;line-height:1.7}</style></head><body><div class="box"><h1>견적서를 확인할 수 없습니다.</h1><p>링크가 올바르지 않거나 접근 권한이 없습니다.</p></div></body></html>`);
}

async function findQuoteAccessRecord(quoteId = "") {
  const safeQuoteId = asText(quoteId);
  if (!/^quote_[a-z0-9_-]{8,80}$/i.test(safeQuoteId)) return null;
  const sheets = ["new_schedule_applications", "join_applications"];
  const results = await Promise.all(sheets.map(async (sheetName) => ({
    sheetName,
    rows: await readGoogleSheetRowsViaApi(sheetName, { timeoutMs: 8000 })
  })));
  for (const result of results) {
    const row = result.rows.find((item) => asText(item.quoteId) === safeQuoteId);
    if (row) return { sheetName: result.sheetName, row };
  }
  return null;
}

let quotePdfGenerationTail = Promise.resolve();
let quotePdfGenerationQueueDepth = 0;

async function withQuotePdfGenerationSlot(task) {
  if (quotePdfGenerationQueueDepth >= GOLFJOIN_QUOTE_PDF_MAX_QUEUE) {
    throw createHttpError("quote pdf generation queue is full", 429, { code: "quote_pdf_queue_full" });
  }
  quotePdfGenerationQueueDepth += 1;
  const previous = quotePdfGenerationTail;
  let release;
  quotePdfGenerationTail = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await task();
  } finally {
    quotePdfGenerationQueueDepth = Math.max(0, quotePdfGenerationQueueDepth - 1);
    release();
  }
}

async function createProtectedQuotePdf(record = {}, accessToken = "") {
  const objectName = getQuoteDataObjectName(record.row || {});
  if (!objectName || !objectName.toLowerCase().endsWith(".json") || !isManagedQuoteObjectName(objectName)) {
    throw createHttpError("quote data file is unavailable", 404, { code: "quote_data_file_unavailable" });
  }
  return withQuotePdfGenerationSlot(async () => {
    const [encryptedBuffer] = await storage.bucket(GOLFJOIN_PRODUCTS_BUCKET).file(objectName).download();
    const content = decryptQuoteBuffer(encryptedBuffer, accessToken);
    let quote;
    try {
      quote = JSON.parse(content.toString("utf8"));
    } catch (error) {
      throw createHttpError("quote data file is invalid", 404, { code: "quote_data_file_invalid" });
    }
    if (!quote || typeof quote !== "object" || asText(quote.quoteId) !== asText(record.row?.quoteId)) {
      throw createHttpError("quote data does not match", 404, { code: "quote_data_mismatch" });
    }
    return createGolfjoinQuotePdfBufferV2(quote);
  });
}

async function deleteGoogleSheetRowViaApi(sheetName, rowNumber, options = {}) {
  if (!GOOGLE_SHEET_ID) throw createHttpError("GOOGLE_SHEET_ID is not configured", 500);
  const safeRowNumber = Number(rowNumber);
  if (!Number.isInteger(safeRowNumber) || safeRowNumber < 2) throw createHttpError("삭제할 시트 행이 올바르지 않습니다.", 400);
  const token = await getGoogleMetadataAccessToken();
  const metadataUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}`);
  metadataUrl.searchParams.set("fields", "sheets.properties(sheetId,title)");
  const metadataResponse = await fetchWithTimeout(metadataUrl.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    }
  }, options.timeoutMs || 6000, `Google Sheets metadata read ${sheetName}`);
  const metadataText = await metadataResponse.text();
  if (!metadataResponse.ok) {
    throw createHttpError(`Google Sheets API metadata read failed: ${metadataResponse.status} ${metadataText.slice(0, 200)}`, metadataResponse.status);
  }
  const metadata = JSON.parse(metadataText || "{}");
  const sheet = (metadata.sheets || []).find((item) => asText(item?.properties?.title) === asText(sheetName));
  const sheetId = Number(sheet?.properties?.sheetId);
  if (!Number.isInteger(sheetId)) throw createHttpError(`${sheetName} 시트를 찾지 못했습니다.`, 404);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}:batchUpdate`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: safeRowNumber - 1,
            endIndex: safeRowNumber
          }
        }
      }]
    })
  }, options.timeoutMs || 8000, `Google Sheets row delete ${sheetName}`);
  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(`Google Sheets API row delete failed: ${response.status} ${text.slice(0, 200)}`, response.status);
  }
  return JSON.parse(text || "{}");
}

async function proxyProtectedQuote(req, res, assetType = "html") {
  setProtectedQuoteHeaders(res);
  const quoteId = asText(req.query?.quoteId);
  const accessToken = asText(req.query?.token);
  if (!quoteId || !/^[A-Za-z0-9_-]{40,100}$/.test(accessToken)) {
    sendProtectedQuoteError(res, 404);
    return;
  }
  let record;
  try {
    record = await findQuoteAccessRecord(quoteId);
  } catch (error) {
    console.error("Protected quote lookup failed.", { quoteId, message: error?.message || String(error) });
    sendProtectedQuoteError(res, 503);
    return;
  }
  const tokenHash = asText(record?.row?.quoteAccessTokenHash);
  if (!record || !tokenHash || !safeEqual(sha256(accessToken), tokenHash)) {
    sendProtectedQuoteError(res, 404);
    return;
  }
  const isPdf = assetType === "pdf";
  if (isPdf && asText(record.row.quoteDataFileName)) {
    if (GOLFJOIN_SERVICE_ROLE === "main") {
      sendProtectedQuoteError(res, 404);
      return;
    }
    try {
      const content = await createProtectedQuotePdf(record, accessToken);
      const safeFileName = `${firstText(record.row.quoteNo, "golfjoin-quote").replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `attachment; filename="${safeFileName}"`);
      res.set("Content-Length", String(content.length));
      res.set("X-Golfjoin-Pdf-Generation", "on-demand");
      res.status(200).send(content);
    } catch (error) {
      console.error("Protected quote PDF generation failed.", { quoteId, message: error?.message || String(error) });
      sendProtectedQuoteError(res, error.status || 503);
    }
    return;
  }
  const objectName = asText(isPdf ? record.row.quoteFileName : record.row.quotePageFileName);
  const expectedExtension = isPdf ? ".pdf" : ".html";
  if (!objectName || !objectName.toLowerCase().endsWith(expectedExtension) || (GOLFJOIN_QUOTES_PREFIX && !objectName.startsWith(`${GOLFJOIN_QUOTES_PREFIX}/`))) {
    sendProtectedQuoteError(res, 404);
    return;
  }
  try {
    const [encryptedBuffer] = await storage.bucket(GOLFJOIN_PRODUCTS_BUCKET).file(objectName).download();
    const content = decryptQuoteBuffer(encryptedBuffer, accessToken);
    if (isPdf) {
      const safeFileName = `${firstText(record.row.quoteNo, "golfjoin-quote").replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `attachment; filename="${safeFileName}"`);
      res.set("X-Golfjoin-Pdf-Generation", "stored-legacy");
    } else {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Content-Security-Policy", "default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    }
    res.status(200).send(content);
  } catch (error) {
    console.error("Protected quote file read failed.", { quoteId, assetType, message: error?.message || String(error) });
    sendProtectedQuoteError(res, 404);
  }
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

function assertAdminErpRequest(req) {
  if (isAdminReadRequest(req)) return;
  throw createHttpError(
    hasAdminReadAuthConfigured() ? "Admin credentials are required" : "Admin reads are not configured",
    403
  );
}

function normalizeErpMemberPhone(value = "") {
  let digits = normalizePhone(value);
  if (digits.length === 10 && digits.startsWith("10")) digits = `0${digits}`;
  return digits;
}

function getErpMemberPhone(row = {}) {
  const direct = normalizeErpMemberPhone(row.mobile || row.mobileNo || row.mobilePhone || "");
  if (direct) return direct;
  return normalizeErpMemberPhone([row.mobile1, row.mobile2, row.mobile3].map(asText).filter(Boolean).join(""));
}

function normalizeErpMemberName(value = "") {
  return asText(value).replace(/\s+/g, "").toLowerCase();
}

function sanitizeErpMemberMatch(row = {}) {
  const custId = asText(row.custId);
  return {
    custSeq: asText(row.custSeq || row.custSeqDisp),
    custId,
    memberName: asText(row.custNm),
    mobile: getErpMemberPhone(row),
    hasWebAccount: Boolean(custId),
    memberJoinCd: asText(row.memberJoinCd),
    payMemberCd: asText(row.payMemberCd),
    siteCd: asText(row.siteCd),
    siteName: asText(row.siteNm),
    joinChannel: asText(row.extnChnlLinkNm)
  };
}

async function lookupErpMemberExact(memberName = "", memberMobile = "") {
  const normalizedName = asText(memberName);
  const normalizedMobile = normalizeErpMemberPhone(memberMobile);
  const searchStartDate = asText(process.env.ERP_MEMBER_SEARCH_START_DATE || "2000-01-01");
  const searchEndDate = nowKstISOString().slice(0, 10);
  const result = await postErpFormJson("/cu/cu03/cu03_101_01_list.json", {
    schOrderBy: "cu02_106_01_list",
    delYn: "N",
    searchDate: "insDt",
    searchStDate: searchStartDate,
    searchEnDate: searchEndDate,
    memberJoinCd: "",
    payMemberCd: "",
    validTermCd: "",
    memberAreaCd: "",
    ddayCnt: "",
    custNm: normalizedName,
    orderBy: "cu02_106_01_list",
    pagingYn: "Y",
    startRow: "1",
    endRow: "100",
    asyncPage: "true"
  }, {
    referer: `${process.env.ERP_MEMBER_LIST_REFERER || "https://secrettour.toursoft.co.kr/erp/cu/cu03/pop/cu03_101_01_list"}`,
    timeoutMs: 20_000
  });
  const status = Number(result?.status || 200);
  if (status !== 200) throw createHttpError(asText(result?.msg) || "ERP member lookup failed", 502);
  const expectedName = normalizeErpMemberName(normalizedName);
  const matches = (Array.isArray(result?.list) ? result.list : []).filter((row) => (
    normalizeErpMemberName(row.custNm) === expectedName
    && getErpMemberPhone(row) === normalizedMobile
    && asText(row.delYn || "N").toUpperCase() !== "Y"
  ));
  if (!matches.length) return { matchStatus: "not_found", memberExists: false, matchCount: 0, member: null };
  if (matches.length > 1) return { matchStatus: "multiple_matches", memberExists: true, matchCount: matches.length, member: null };
  const member = sanitizeErpMemberMatch(matches[0]);
  return {
    matchStatus: member.hasWebAccount ? "web_member" : "erp_customer",
    memberExists: true,
    matchCount: 1,
    member
  };
}

function findExactMemberProfile(rows = [], memberName = "", memberMobile = "") {
  const expectedName = normalizeErpMemberName(memberName);
  const expectedMobile = normalizeErpMemberPhone(memberMobile);
  return rows
    .filter((row) => (
      normalizeErpMemberName(row.memberName || row.name) === expectedName
      && normalizeErpMemberPhone(row.memberMobile || row.mobile || row.phone) === expectedMobile
      && !asText(row.mergedIntoProfileId)
    ))
    .sort((left, right) => asText(right.updatedAt || right.createdAt).localeCompare(asText(left.updatedAt || left.createdAt)))[0] || null;
}

function parseAdminRosterBirthDate(value = "") {
  const digits = asText(value).replace(/\D/g, "");
  if (!/^\d{6}$/.test(digits)) throw createHttpError("생년월일은 yymmdd 6자리로 입력해 주세요.", 400);
  const yy = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const currentYear = Number(nowKstISOString().slice(0, 4));
  const year = yy <= (currentYear % 100) ? 2000 + yy : 1900 + yy;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw createHttpError("생년월일을 확인해 주세요.", 400);
  }
  return {
    birthDate: `${year}${digits.slice(2)}`,
    birthYear: String(year),
    ageBand: buildAdminRosterAgeBand(year)
  };
}

function buildAdminRosterAgeBand(birthYear = "") {
  const year = Number(asText(birthYear).replace(/\D/g, ""));
  const currentYear = Number(nowKstISOString().slice(0, 4));
  const age = currentYear - year;
  if (!Number.isFinite(age) || age < 1 || age > 99) return "";
  const decade = Math.min(Math.floor(age / 10) * 10, 70);
  const ones = age % 10;
  const phase = ones <= 3 ? "초반" : ones <= 6 ? "중반" : "후반";
  return `${decade >= 70 ? "70대이상" : `${decade}대`} ${phase}`;
}

function validateAdminRosterParticipant(item = {}, index = 0) {
  const label = `participants[${index}]`;
  const name = assertTextLength(item.name, `${label}.name`, MAX_STRING_LENGTHS.name, { required: true });
  const phone = normalizeErpMemberPhone(item.phone);
  if (!phone) throw createHttpError(`${label}.phone is required`, 400);
  assertPhone(phone, `${label}.phone`);
  const birth = parseAdminRosterBirthDate(item.birthDate);
  const gender = asText(item.gender);
  if (!["남성", "여성"].includes(gender)) throw createHttpError(`${label}.gender is invalid`, 400);
  const roomType = asText(item.roomType);
  if (!["2인1실", "1인1실"].includes(roomType)) throw createHttpError(`${label}.roomType is invalid`, 400);
  const flightRequestType = asText(item.flightRequestType);
  if (!["대행요청", "직접예약"].includes(flightRequestType)) throw createHttpError(`${label}.flightRequestType is invalid`, 400);
  const level = assertTextLength(item.level, `${label}.level`, MAX_STRING_LENGTHS.short);
  const rosterItemId = assertTextLength(item.rosterItemId, `${label}.rosterItemId`, MAX_STRING_LENGTHS.short, { required: true });
  return { name, phone, ...birth, gender, roomType, flightRequestType, level, rosterItemId };
}

function resolveAdminRosterSchedule(payload = {}, newSchedules = [], recommendedRows = []) {
  const scheduleId = asText(payload.targetScheduleId || payload.scheduleId || payload.scheduleKey);
  const applicationId = asText(payload.targetApplicationId || payload.applicationId);
  const targetType = asText(payload.targetType);
  const recommendedSchedules = recommendedRows.filter(isManageableRecommendedScheduleRule).map(buildRecommendedScheduleSummarySource);
  const recommendedMatches = recommendedSchedules.filter((schedule) => doScheduleIdsMatch(schedule, scheduleId, applicationId));
  const newMatches = newSchedules.filter((schedule) => doScheduleIdsMatch(schedule, scheduleId, applicationId));
  const matches = targetType === "recommended_schedule"
    ? recommendedMatches
    : targetType === "new_schedule"
      ? newMatches
      : [...recommendedMatches, ...newMatches];
  if (matches.length !== 1) throw createHttpError(matches.length ? "일정 식별값이 중복되었습니다." : "대상 일정을 찾지 못했습니다.", 404);
  const schedule = matches[0];
  const isRecommended = Boolean(schedule.isAdminRecommendedSchedule);
  const canonicalScheduleId = asText(schedule.scheduleId);
  const canonicalApplicationId = asText(schedule.applicationId || schedule.sourceApplicationId);
  return {
    schedule,
    targetType: isRecommended ? "recommended_schedule" : "new_schedule",
    targetScheduleId: canonicalScheduleId,
    targetApplicationId: canonicalApplicationId,
    targetJoinId: isRecommended ? canonicalScheduleId : `sheet-builder-application-${canonicalScheduleId}`
  };
}

async function mapWithConcurrency(items = [], concurrency = 4, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function proxyAdminErpLoginCheck(req, res) {
  assertAdminErpRequest(req);
  await getErpSessionCookie({ force: true });
  res.status(200).json({ ok: true, authenticated: true });
}

async function proxyAdminErpMemberLookup(req, res) {
  assertAdminErpRequest(req);
  const payload = readBody(req);
  const memberName = asText(payload.memberName || payload.name);
  const memberMobile = normalizeErpMemberPhone(payload.memberMobile || payload.mobile || payload.phone);
  assertTextLength(memberName, "memberName", MAX_STRING_LENGTHS.name, { required: true });
  if (!memberMobile) throw createHttpError("memberMobile is required", 400);
  assertPhone(memberMobile, "memberMobile");

  const [erpResult, profiles] = await Promise.all([
    lookupErpMemberExact(memberName, memberMobile),
    readGoogleSheetRowsViaApi("join_member_profiles", { timeoutMs: 6000 })
  ]);
  const profile = findExactMemberProfile(profiles, memberName, memberMobile);
  res.status(200).json({
    ok: true,
    ...erpResult,
    profile: profile ? {
      profileId: asText(profile.profileId),
      profileStatus: asText(profile.profileStatus || "active"),
      hasAdditionalInfo: asText(profile.profileStatus) !== "temporary" && hasCompletedJoinMemberProfile(profile)
    } : null
  });
}

function buildAdminRosterScheduleSnapshot(canonical = {}, fallbackProduct = {}) {
  const schedule = canonical.schedule || {};
  return {
    targetType: canonical.targetType,
    targetScheduleId: canonical.targetScheduleId,
    targetApplicationId: canonical.targetApplicationId,
    targetJoinId: canonical.targetJoinId,
    productName: asText(schedule.productName || schedule.title),
    departureDate: normalizeSheetDateText(schedule.departureDateFrom || schedule.departureDate || schedule.displayStartAt),
    returnDate: normalizeSheetDateText(schedule.returnDateFrom || schedule.returnDate || schedule.displayEndAt),
    country: asText(schedule.country),
    region: asText(schedule.region),
    airline: firstText(
      schedule.airline,
      fallbackProduct.airline,
      fallbackProduct.airlineName,
      fallbackProduct.airlineNm,
      fallbackProduct.air2Nm,
      fallbackProduct.air2CdNm
    ),
    departureAirport: firstText(
      schedule.departureAirport,
      fallbackProduct.departureAirport,
      fallbackProduct.depAirport,
      fallbackProduct.airport
    ),
    arrivalAirport: firstText(
      schedule.arrivalAirport,
      fallbackProduct.arrivalAirport,
      fallbackProduct.arrAirport
    ),
    erpProductId: normalizeErpProductId(schedule.erpProductId, schedule.erpEventSeq),
    erpEventSeq: asText(schedule.erpEventSeq)
  };
}

function buildAdminRosterApplicationPayload(participant = {}, identity = {}, canonical = {}, batchId = "", context = {}) {
  const schedule = canonical.schedule || {};
  const snapshot = buildAdminRosterScheduleSnapshot(canonical, context.product || {});
  const profile = identity.profile || {};
  const erpMember = identity.erp?.member || {};
  const profileId = asText(identity.profileId);
  const memberKey = `profile:${profileId}`;
  const applicationId = buildGoogleSheetRecordId("join_admin", canonical.targetScheduleId, participant.rosterItemId);
  return {
    applicationId,
    createdAt: nowKstISOString(),
    source: "join_apply",
    pageUrl: asText(context.pageUrl),
    registrationSource: "admin",
    adminRosterItemId: participant.rosterItemId,
    rosterBatchId: batchId,
    profileId,
    memberKey,
    identityMatchStatus: identity.identityMatchStatus,
    createdByAdmin: ADMIN_LOGIN_ID || "dashboard",
    updatedByAdmin: ADMIN_LOGIN_ID || "dashboard",
    targetType: canonical.targetType,
    targetScheduleId: canonical.targetScheduleId,
    targetApplicationId: canonical.targetApplicationId,
    targetJoinId: canonical.targetJoinId,
    targetProductKey: snapshot.erpProductId && snapshot.erpEventSeq ? `erp:${snapshot.erpProductId}:${snapshot.erpEventSeq}` : "",
    erpProductId: snapshot.erpProductId,
    erpEventSeq: snapshot.erpEventSeq,
    scheduleSnapshot: snapshot,
    member: {
      memberKey,
      profileId,
      memberSeq: asText(profile.memberSeq || erpMember.custSeq),
      memberId: asText(profile.memberId || erpMember.custId),
      memberName: participant.name,
      memberChannel: asText(profile.memberChannel || erpMember.joinChannel),
      memberMobile: participant.phone,
      memberEmail: asText(profile.memberEmail)
    },
    product: {
      productName: snapshot.productName,
      departureDate: snapshot.departureDate,
      returnDate: snapshot.returnDate,
      country: snapshot.country,
      region: snapshot.region,
      airline: snapshot.airline,
      departureAirport: snapshot.departureAirport,
      arrivalAirport: snapshot.arrivalAirport,
      erpProductId: snapshot.erpProductId,
      erpEventSeq: snapshot.erpEventSeq
    },
    applicant: {
      name: participant.name,
      phone: participant.phone,
      birthDate: participant.birthDate,
      birthYear: participant.birthYear,
      ageDisplay: participant.ageBand,
      gender: participant.gender,
      people: "1",
      companions: [],
      level: participant.level,
      styles: [],
      preferredMemberComposition: [],
      greeting: "",
      roomType: participant.roomType,
      flightRequestType: participant.flightRequestType
    },
    participantStatus: "신청",
    applicationStatus: "confirmed",
    adminMemo: "관리자 명단 등록"
  };
}

function buildAdminTemporaryProfileRow(participant = {}, erp = {}, profileId = "") {
  const erpMember = erp.member || {};
  const now = nowKstISOString();
  const identityMatchStatus = erp.matchStatus === "web_member"
    ? "web_member"
    : erp.matchStatus === "erp_customer"
      ? "erp_customer"
      : "temporary_guest";
  return {
    profileId,
    createdAt: now,
    source: "join_member_profile",
    pageUrl: "",
    memberSeq: asText(erpMember.custSeq),
    memberId: asText(erpMember.custId),
    memberName: participant.name,
    memberChannel: asText(erpMember.joinChannel),
    memberMobile: participant.phone,
    memberEmail: "",
    birthYear: participant.birthYear,
    birthDate: participant.birthDate,
    gender: participant.gender,
    profession: "",
    level: participant.level,
    travelStyles: "",
    profileImageUrl: "",
    profileImageObjectName: "",
    profileImageSize: "",
    requiredAgreed: "",
    marketingAgreed: "",
    termsAgreedAt: "",
    kakaoId: "",
    kakaoNickname: "",
    adminMemo: "관리자 명단 등록 임시 프로필",
    updatedAt: now,
    memberKey: `profile:${profileId}`,
    profileStatus: "temporary",
    profileOrigin: "admin_roster",
    identityMatchStatus,
    erpLinkedAt: erp.memberExists ? now : "",
    mergedIntoProfileId: "",
    createdByAdmin: ADMIN_LOGIN_ID || "dashboard",
    updatedByAdmin: ADMIN_LOGIN_ID || "dashboard"
  };
}

async function proxyAdminParticipantLookup(req, res) {
  assertAdminErpRequest(req);
  const payload = readBody(req);
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "recommended_schedules"
  ], { timeoutMs: 9000 });
  const canonical = resolveAdminRosterSchedule(
    payload,
    sheetRows.new_schedule_applications || [],
    sheetRows.recommended_schedules || []
  );
  const rows = (sheetRows.join_applications || []).filter((row) => isJoinApplicationForSchedule(row, canonical.schedule));
  res.status(200).json({ ok: true, rows, schedule: buildAdminRosterScheduleSnapshot(canonical) });
}

async function proxyAdminParticipantBatchUpsert(req, res) {
  assertAdminErpRequest(req);
  const payload = readBody(req);
  const rawParticipants = Array.isArray(payload.participants) ? payload.participants : [];
  if (!rawParticipants.length || rawParticipants.length > 40) {
    throw createHttpError("참여자는 한 번에 1명 이상 40명 이하로 등록해 주세요.", 400);
  }
  const participants = rawParticipants.map(validateAdminRosterParticipant);
  const duplicateKeys = new Set();
  participants.forEach((participant) => {
    const key = `${normalizeErpMemberName(participant.name)}|${participant.phone}`;
    if (duplicateKeys.has(key)) throw createHttpError("같은 이름과 연락처가 명단에 중복되었습니다.", 409);
    duplicateKeys.add(key);
  });

  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "join_member_profiles",
    "recommended_schedules"
  ], { timeoutMs: 12_000 });
  const canonical = resolveAdminRosterSchedule(
    payload,
    sheetRows.new_schedule_applications || [],
    sheetRows.recommended_schedules || []
  );
  const allJoinRows = sheetRows.join_applications || [];
  const plannedApplicationIds = new Set(participants.map((participant) => (
    buildGoogleSheetRecordId("join_admin", canonical.targetScheduleId, participant.rosterItemId)
  )));
  const relatedActiveRows = allJoinRows.filter((row) => isJoinApplicationForSchedule(row, canonical.schedule) && !isCancelledJoinApplication(row));
  const creatorName = asText(canonical.schedule.applicantName || canonical.schedule.creatorName);
  const creatorPhone = normalizeErpMemberPhone(canonical.schedule.applicantMobile || canonical.schedule.creatorPhone);
  participants.forEach((participant) => {
    const alreadyJoined = relatedActiveRows.some((row) => (
      !plannedApplicationIds.has(asText(row.applicationId || row.joinApplyId))
      &&
      normalizeErpMemberName(row.applicantName || row.memberName) === normalizeErpMemberName(participant.name)
      && normalizeErpMemberPhone(row.applicantMobile || row.memberMobile) === participant.phone
    ));
    const isCreator = creatorPhone === participant.phone && normalizeErpMemberName(creatorName) === normalizeErpMemberName(participant.name);
    if (alreadyJoined || isCreator) throw createHttpError(`${participant.name}님은 이미 이 일정에 등록되어 있습니다.`, 409);
  });
  const capacityRows = allJoinRows.filter((row) => !plannedApplicationIds.has(asText(row.applicationId || row.joinApplyId)));
  const summary = buildScheduleParticipantSummary(canonical.schedule, capacityRows);
  if (participants.length > Number(summary.remainingSeats || 0)) {
    throw createJoinScheduleFullError({
      scheduleId: canonical.targetScheduleId,
      remainingSeats: Number(summary.remainingSeats || 0),
      requestedPeople: participants.length,
      capacity: Number(summary.capacity || getScheduleCapacity(canonical.schedule)),
      confirmedPeople: Number(summary.confirmedPeople || 0)
    });
  }

  const erpResults = await mapWithConcurrency(participants, 4, (participant) => lookupErpMemberExact(participant.name, participant.phone));
  const profileRows = sheetRows.join_member_profiles || [];
  const profileById = new Map(profileRows.map((row) => [asText(row.profileId), row]));
  const existingApplicationById = new Map(allJoinRows.map((row) => [asText(row.applicationId || row.joinApplyId), row]));
  const identities = participants.map((participant, index) => {
    const erp = erpResults[index];
    if (erp.matchStatus === "multiple_matches") {
      throw createHttpError(`${participant.name}님의 ERP 회원 정보가 여러 건입니다. ERP에서 연락처를 확인해 주세요.`, 409);
    }
    const applicationId = buildGoogleSheetRecordId("join_admin", canonical.targetScheduleId, participant.rosterItemId);
    const existingApplication = existingApplicationById.get(applicationId);
    const linkedProfile = profileById.get(asText(existingApplication?.profileId));
    const canReuseLinkedTemporaryProfile = Boolean(
      linkedProfile
      && (asText(linkedProfile.profileStatus) === "temporary" || asText(linkedProfile.profileOrigin) === "admin_roster")
    );
    const profile = findExactMemberProfile(profileRows, participant.name, participant.phone)
      || (canReuseLinkedTemporaryProfile ? linkedProfile : null);
    const profileId = asText(profile?.profileId) || buildGoogleSheetRecordId("jmp_admin", normalizeErpMemberName(participant.name), participant.phone);
    const profileIsActive = Boolean(profile && asText(profile.profileStatus || "active") !== "temporary");
    const identityMatchStatus = profileIsActive
      ? "member_profile"
      : erp.matchStatus === "web_member"
        ? "web_member"
        : erp.matchStatus === "erp_customer"
          ? "erp_customer"
          : "temporary_guest";
    return { profile, profileId, erp, identityMatchStatus };
  });

  const profileHeaders = await ensureGoogleSheetHeadersViaApi("join_member_profiles", { timeoutMs: 8000 });
  const applicationHeaders = await ensureGoogleSheetHeadersViaApi("join_applications", { timeoutMs: 8000 });
  const newProfiles = identities
    .map((identity, index) => identity.profile ? null : buildAdminTemporaryProfileRow(participants[index], identity.erp, identity.profileId))
    .filter(Boolean);
  if (newProfiles.length) {
    await appendGoogleSheetRowsViaApi(
      "join_member_profiles",
      newProfiles.map((row) => profileHeaders.map((header) => row[header] == null ? "" : row[header])),
      { timeoutMs: 12_000 }
    );
  }
  for (let index = 0; index < identities.length; index += 1) {
    const identity = identities[index];
    const profile = identity.profile;
    if (!profile || (asText(profile.profileStatus) !== "temporary" && asText(profile.profileOrigin) !== "admin_roster")) continue;
    const profileRowIndex = profileRows.indexOf(profile);
    if (profileRowIndex < 0) continue;
    const participant = participants[index];
    const nextProfile = {
      ...profile,
      memberName: participant.name,
      memberMobile: participant.phone,
      birthYear: participant.birthYear,
      birthDate: participant.birthDate,
      gender: participant.gender,
      level: participant.level,
      identityMatchStatus: identity.identityMatchStatus,
      updatedAt: nowKstISOString(),
      updatedByAdmin: ADMIN_LOGIN_ID || "dashboard"
    };
    await updateGoogleSheetRowViaApi(
      "join_member_profiles",
      profileRowIndex + 2,
      profileHeaders.map((header) => nextProfile[header] == null ? "" : nextProfile[header]),
      { timeoutMs: 8000 }
    );
  }

  const batchId = asText(payload.rosterBatchId) || buildGoogleSheetRecordId("roster", canonical.targetScheduleId, nowKstISOString());
  const pageUrl = asText(payload.pageUrl || req.headers.origin || process.env.ADMIN_DASHBOARD_URL || "");
  const rosterContext = {
    pageUrl,
    product: payload.product && typeof payload.product === "object" ? payload.product : {}
  };
  const applicationPayloads = participants.map((participant, index) => (
    buildAdminRosterApplicationPayload(participant, identities[index], canonical, batchId, rosterContext)
  ));
  const existingById = new Map(allJoinRows.map((row, index) => [asText(row.applicationId || row.joinApplyId), { row, index }]));
  const appendRows = [];
  const savedRows = [];
  for (const applicationPayload of applicationPayloads) {
    const applicationId = asText(applicationPayload.applicationId);
    const existing = existingById.get(applicationId);
    const nextObject = buildJoinApplicationSheetObject(applicationPayload, applicationId, applicationHeaders);
    if (existing) {
      const preserved = { ...existing.row, ...nextObject };
      preserved.createdAt = existing.row.createdAt || nextObject.createdAt;
      ["participantStatus", "applicationStatus", "depositStatus", "balanceStatus", "refundStatus"].forEach((key) => {
        if (existing.row[key] != null) preserved[key] = existing.row[key];
      });
      ["quoteId", "quoteNo", "quoteUrl", "quotePageUrl", "quotePdfUrl", "quoteFileName", "quotePageFileName", "quoteDataFileName", "quoteGeneratedAt", "quoteAdditionalAmountsJson", "quoteFlightDetailsJson", "quoteAccessTokenHash", "quoteExpiresAt"].forEach((key) => {
        if (!asText(nextObject[key]) && existing.row[key] != null) preserved[key] = existing.row[key];
      });
      await updateGoogleSheetRowViaApi(
        "join_applications",
        existing.index + 2,
        applicationHeaders.map((header) => preserved[header] == null ? "" : preserved[header]),
        { timeoutMs: 8000 }
      );
      savedRows.push(preserved);
    } else {
      appendRows.push(applicationHeaders.map((header) => nextObject[header] == null ? "" : nextObject[header]));
      savedRows.push(nextObject);
    }
  }
  if (appendRows.length) await appendGoogleSheetRowsViaApi("join_applications", appendRows, { timeoutMs: 12_000 });
  refreshGolfJoinHomeSummaryInBackground("admin_roster_batch_upsert");
  res.status(200).json({
    ok: true,
    savedCount: savedRows.length,
    profileCreatedCount: newProfiles.length,
    rosterBatchId: batchId,
    rows: savedRows,
    identities: identities.map((identity, index) => ({
      rosterItemId: participants[index].rosterItemId,
      profileId: identity.profileId,
      matchStatus: identity.identityMatchStatus,
      hasWebAccount: Boolean(identity.erp.member?.hasWebAccount)
    }))
  });
}

async function proxyAdminParticipantDelete(req, res) {
  assertAdminErpRequest(req);
  const payload = readBody(req);
  const applicationId = assertTextLength(
    payload.applicationId || payload.joinApplyId,
    "applicationId",
    MAX_STRING_LENGTHS.short,
    { required: true }
  );
  const sheetRows = await readGoogleSheetRangesViaApi([
    "new_schedule_applications",
    "join_applications",
    "join_member_profiles",
    "recommended_schedules"
  ], { timeoutMs: 9000 });
  const canonical = resolveAdminRosterSchedule(
    payload,
    sheetRows.new_schedule_applications || [],
    sheetRows.recommended_schedules || []
  );
  const joinRows = sheetRows.join_applications || [];
  const rowIndex = joinRows.findIndex((row) => asText(row.applicationId || row.joinApplyId) === applicationId);
  if (rowIndex < 0) throw createHttpError("삭제할 참여자 정보를 찾지 못했습니다.", 404);
  const row = joinRows[rowIndex];
  if (!isJoinApplicationForSchedule(row, canonical.schedule)) {
    throw createHttpError("선택한 일정의 참여자 정보가 아닙니다.", 409);
  }
  if (asText(row.registrationSource).toLowerCase() !== "admin" && !asText(row.adminRosterItemId)) {
    throw createHttpError("관리자가 직접 등록한 참여자만 삭제할 수 있습니다.", 403);
  }
  await deleteGoogleSheetRowViaApi("join_applications", rowIndex + 2, { timeoutMs: 9000 });
  let profileDeleted = false;
  const profileId = asText(row.profileId);
  const isProfileUsedElsewhere = Boolean(profileId && joinRows.some((item, index) => (
    index !== rowIndex && asText(item.profileId) === profileId
  )));
  if (profileId && !isProfileUsedElsewhere) {
    const profileRows = sheetRows.join_member_profiles || [];
    const profileIndex = profileRows.findIndex((item) => asText(item.profileId) === profileId);
    const profile = profileIndex >= 0 ? profileRows[profileIndex] : null;
    if (profile && (asText(profile.profileStatus) === "temporary" || asText(profile.profileOrigin) === "admin_roster")) {
      try {
        await deleteGoogleSheetRowViaApi("join_member_profiles", profileIndex + 2, { timeoutMs: 9000 });
        profileDeleted = true;
      } catch (error) {
        console.warn("Admin roster orphan profile cleanup failed", error);
      }
    }
  }
  refreshGolfJoinHomeSummaryInBackground("admin_participant_delete");
  res.status(200).json({
    ok: true,
    deleted: true,
    sheet: "join_applications",
    applicationId,
    adminRosterItemId: asText(row.adminRosterItemId),
    profileDeleted
  });
}

async function proxyPost(req, res) {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (req.query?.action === "send_application_notifications") {
    if (!isInternalServiceRequest(req)) throw createHttpError("Internal service credentials are required", 403);
    if (!ALIGO_ENABLED) throw createHttpError("Aligo is not enabled", 503);
    const body = readBody(req);
    const payload = body.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw createHttpError("Invalid notification payload", 400);
    const source = asText(payload.source);
    if (!(source === "new_schedule_builder" || source === "join_apply")) throw createHttpError("Unsupported notification source", 400);
    const notifications = await processGolfjoinApplicationNotifications(
      payload,
      asText(body.notificationScheduleId),
      asText(body.requestId || requestId)
    );
    res.status(200).json({ ok: true, notifications });
    return;
  }
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

  if (req.query?.action === "admin_erp_login_check") {
    await proxyAdminErpLoginCheck(req, res);
    return;
  }

  if (req.query?.action === "admin_erp_member_lookup") {
    await proxyAdminErpMemberLookup(req, res);
    return;
  }

  if (req.query?.action === "admin_participant_lookup") {
    await proxyAdminParticipantLookup(req, res);
    return;
  }

  if (req.query?.action === "admin_participant_batch_upsert") {
    await proxyAdminParticipantBatchUpsert(req, res);
    return;
  }

  if (req.query?.action === "admin_participant_delete") {
    await proxyAdminParticipantDelete(req, res);
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
        let homeSummaryRefresh = null;
        if (savedPayload.ok && !payload.skipSummaryRefresh) {
          try {
            const summary = await refreshGolfJoinHomeSummaryFromCurrentData("admin_status_update");
            homeSummaryRefresh = {
              ok: true,
              participantSummaryCount: summary.homeBootstrapLight?.participantSummaries?.length || 0
            };
          } catch (error) {
            homeSummaryRefresh = {
              ok: false,
              error: error?.message || String(error)
            };
            console.warn("Failed to refresh home summary after admin status update.", {
              message: homeSummaryRefresh.error
            });
          }
        }
        res.status(200).json({
          ...savedPayload,
          ...(homeSummaryRefresh ? { homeSummaryRefresh } : {})
        });
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
    const savedPayload = await generateQuoteViaSheetsApi(payload, getRequestAbsoluteUrl(req));
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
      const notifications = await dispatchGolfjoinApplicationNotifications(notificationPayload, asText(notificationPayload.scheduleId), requestId);
      refreshGolfJoinHomeSummaryInBackground(source);
      res.status(200).json({
        ...savedPayload,
        notifications
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
      const notifications = await dispatchGolfjoinApplicationNotifications(payload, asText(payload.targetScheduleId || getValue(payload, "target.scheduleId")), requestId);
      refreshGolfJoinHomeSummaryInBackground(source);
      res.status(200).json({
        ...savedPayload,
        notifications
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
    const notifications = await dispatchGolfjoinApplicationNotifications(payload, notificationScheduleId, requestId);
    refreshGolfJoinHomeSummaryInBackground(source);
    res.send(JSON.stringify({
      ...savedPayload,
      notifications
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
    assertServiceRole(req);
    if (req.method === "POST" && req.query?.action === "send_application_notifications") {
      await proxyPost(req, res);
      return;
    }
    if (req.method === "GET" && req.query?.action === "share_og") {
      proxyShareOg(req, res);
      return;
    }
    if (req.method === "GET" && (req.query?.action === "quote_view" || req.query?.action === "quote_pdf")) {
      await proxyProtectedQuote(req, res, req.query.action === "quote_pdf" ? "pdf" : "html");
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
