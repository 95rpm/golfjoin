"use strict";

const crypto = require("crypto");

const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const MAX_RECIPIENTS = 5;

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function firstText(...values) {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
}

function getValue(source, path) {
  return String(path || "").split(".").reduce((value, key) => (
    value && typeof value === "object" ? value[key] : undefined
  ), source);
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 120 && EMAIL_PATTERN.test(email);
}

function maskEmail(value) {
  const email = normalizeEmail(value);
  const [local = "", domain = ""] = email.split("@");
  if (!local || !domain) return "";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${domain}`;
}

function hmac(value, secret) {
  return crypto.createHmac("sha256", String(secret || "")).update(String(value || ""), "utf8").digest("hex");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function createRecipientHash(email, secret) {
  return hmac(`recipient:${normalizeEmail(email)}`, secret);
}

function createVerificationCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function createVerificationHash(email, code, secret) {
  return hmac(`verify:${normalizeEmail(email)}:${text(code)}`, secret);
}

function safeHashEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(String(value || ""));
  } catch (error) {
    return fallback;
  }
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (["true", "1", "y", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "n", "no", "off"].includes(normalized)) return false;
  return Boolean(fallback);
}

function normalizeRecipients(value) {
  const parsed = Array.isArray(value) ? value : parseJson(value, []);
  const seen = new Set();
  return (Array.isArray(parsed) ? parsed : []).map((recipient) => {
    const email = normalizeEmail(recipient?.email);
    if (!isValidEmail(email) || seen.has(email)) return null;
    seen.add(email);
    return {
      email,
      verifiedAt: text(recipient?.verifiedAt),
      disabled: booleanValue(recipient?.disabled),
      verificationHash: text(recipient?.verificationHash),
      verificationExpiresAt: text(recipient?.verificationExpiresAt),
      verificationSentAt: text(recipient?.verificationSentAt),
      verificationAttempts: Math.max(0, Number(recipient?.verificationAttempts || 0) || 0)
    };
  }).filter(Boolean).slice(0, MAX_RECIPIENTS);
}

function createDefaultSettings() {
  return {
    settingId: "new_application_email",
    enabled: false,
    notifyNewSchedule: true,
    notifyJoinApply: true,
    recipients: [],
    version: 0,
    updatedAt: "",
    updatedBy: ""
  };
}

function normalizeSettings(row = {}) {
  return {
    ...createDefaultSettings(),
    settingId: text(row.settingId) || "new_application_email",
    enabled: booleanValue(row.enabled),
    notifyNewSchedule: booleanValue(row.notifyNewSchedule, true),
    notifyJoinApply: booleanValue(row.notifyJoinApply, true),
    recipients: normalizeRecipients(row.recipients || row.recipientsJson),
    version: Math.max(0, Number(row.version || 0) || 0),
    updatedAt: text(row.updatedAt),
    updatedBy: text(row.updatedBy)
  };
}

function sanitizeSettings(settings = {}, options = {}) {
  const normalized = normalizeSettings(settings);
  return {
    settingId: normalized.settingId,
    enabled: normalized.enabled,
    notifyNewSchedule: normalized.notifyNewSchedule,
    notifyJoinApply: normalized.notifyJoinApply,
    recipients: normalized.recipients.map((recipient) => ({
      email: recipient.email,
      maskedEmail: maskEmail(recipient.email),
      verified: Boolean(recipient.verifiedAt),
      verifiedAt: recipient.verifiedAt,
      disabled: recipient.disabled,
      verificationSentAt: recipient.verificationSentAt,
      verificationExpiresAt: recipient.verifiedAt ? "" : recipient.verificationExpiresAt
    })),
    verifiedRecipientCount: normalized.recipients.filter((recipient) => recipient.verifiedAt && !recipient.disabled).length,
    version: normalized.version,
    updatedAt: normalized.updatedAt,
    updatedBy: normalized.updatedBy,
    providerConfigured: Boolean(options.providerConfigured),
    provider: text(options.provider),
    providerName: text(options.providerName),
    masterEnabled: Boolean(options.masterEnabled),
    fromEmail: text(options.fromEmail)
  };
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  const parsed = parseJson(raw, null);
  if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean);
  return raw.split(",").map(text).filter(Boolean);
}

function formatKstDateTime(value) {
  const raw = text(value);
  if (!raw) return "미등록";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed).replace(/\. /g, ".").replace(/\.$/, "");
}

function formatKoreanDate(value) {
  const raw = text(value);
  if (!raw) return "미등록";
  const match = raw.match(/(20\d{2})[-./]?(\d{2})[-./]?(\d{2})/);
  if (!match) return raw;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${iso}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][parsed.getDay()];
  return `${iso.replace(/-/g, ".")}(${weekday})`;
}

function calculateAgeLabel(birthYear) {
  const year = Number(String(birthYear || "").match(/(?:19|20)\d{2}/)?.[0] || 0);
  if (!year) return "";
  const currentYear = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric" }).format(new Date()));
  const age = currentYear - year;
  return age >= 0 && age < 120 ? `${age}세` : "";
}

function normalizeApplicationDetails(payload = {}) {
  const source = text(payload.source);
  const isNewSchedule = source === "new_schedule_builder" || Boolean(payload.scheduleId && !payload.targetScheduleId);
  const type = isNewSchedule ? "new_schedule" : "join_apply";
  const applicant = getValue(payload, "applicant") || {};
  const member = getValue(payload, "member") || {};
  const trip = getValue(payload, "trip") || {};
  const product = getValue(payload, "product") || {};
  const join = getValue(payload, "join") || {};
  const departureDates = parseList(trip.departureDates);
  const returnDates = parseList(trip.returnDates);
  const birthYear = firstText(applicant.birthYear, payload.applicantBirthYear, member.birthYear);
  const applicationId = firstText(payload.applicationId, payload.joinApplyId);
  const scheduleId = firstText(payload.scheduleId, payload.targetScheduleId, getValue(payload, "target.scheduleId"));
  return {
    type,
    typeLabel: isNewSchedule ? "새 모임 생성" : "참여 신청",
    applicationId,
    scheduleId,
    submittedAt: firstText(payload.submittedAt, payload.createdAt, payload.updatedAt),
    applicantName: firstText(applicant.name, payload.applicantName, member.memberName, payload.memberName) || "미등록",
    applicantPhone: firstText(applicant.phone, payload.applicantMobile, member.memberMobile, payload.memberMobile) || "미등록",
    applicantGender: firstText(applicant.gender, payload.applicantGender, member.gender) || "미등록",
    applicantAge: firstText(applicant.ageDisplay, payload.applicantAgeBand, calculateAgeLabel(birthYear)) || "미등록",
    memberChannel: firstText(member.memberChannel, payload.memberChannel) || "미등록",
    memberEmail: firstText(member.memberEmail, payload.memberEmail) || "미등록",
    productName: firstText(trip.productName, product.productName, join.title, payload.productName) || "미등록",
    country: firstText(trip.country, product.country, join.country, payload.country) || "미등록",
    region: firstText(trip.region, product.region, join.region, payload.region) || "미등록",
    departureDate: firstText(payload.departureDate, product.departureDate, join.departureDate, payload.departureDateFrom, departureDates[0], trip.startSummary),
    returnDate: firstText(payload.returnDate, product.returnDate, join.returnDate, payload.returnDateTo, returnDates[returnDates.length - 1], trip.endSummary),
    tripSummary: firstText(trip.tripSummary, payload.tripSummary) || "미등록",
    people: Math.max(1, Number(firstText(applicant.people, payload.applicantPeople, 1)) || 1),
    capacity: Math.max(0, Number(firstText(payload.capacity, payload.maxPeople, getValue(payload, "target.capacity"), 0)) || 0),
    roomType: firstText(applicant.roomType, payload.applicantRoomType) || "미등록",
    flightRequestType: firstText(applicant.flightRequestType, payload.flightRequestType) || "미등록",
    singleRoomSurchargeText: firstText(applicant.singleRoomSurchargeText, payload.singleRoomSurchargeText),
    level: firstText(applicant.level, payload.applicantLevel) || "미등록",
    styles: parseList(applicant.styles || payload.applicantStyles),
    preferences: parseList(applicant.memberPreferences || applicant.preferredMemberComposition || payload.applicantPreferredMembers),
    greeting: firstText(applicant.greeting, payload.applicantGreeting) || "미등록"
  };
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value, maxLength) {
  const normalized = text(value).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");
  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(1, maxLength - 1))}…` : normalized;
}

function safeDashboardUrl(baseUrl, details) {
  try {
    const url = new URL(String(baseUrl || ""));
    if (url.protocol !== "https:") return "";
    url.searchParams.set("menu", "schedules");
    url.searchParams.set("panel", "consultation");
    if (details.applicationId) url.searchParams.set("applicationId", details.applicationId);
    return url.toString();
  } catch (error) {
    return "";
  }
}

function buildAdminApplicationEmail(payload = {}, options = {}) {
  const details = normalizeApplicationDetails(payload);
  const departure = formatKoreanDate(details.departureDate);
  const returnDate = formatKoreanDate(details.returnDate);
  const location = [details.country, details.region].filter((value, index, array) => value && value !== "미등록" && array.indexOf(value) === index).join(" ") || "지역 미등록";
  const subject = truncate(`[골프조인 신규신청] ${details.typeLabel} | ${details.applicantName} | ${details.region !== "미등록" ? details.region : details.country} | ${departure.replace(/\([^)]*\)$/, "")}`, 120);
  const dashboardUrl = safeDashboardUrl(options.dashboardUrl, details);
  const surcharge = details.singleRoomSurchargeText || (details.roomType === "1인1실" ? "별도 확인 필요" : "해당 없음");
  const styles = details.styles.length ? details.styles.join(", ") : "미등록";
  const preferences = details.preferences.length ? details.preferences.join(", ") : "미등록";
  const rows = [
    ["신청 구분", details.typeLabel],
    ["신청 일시", formatKstDateTime(details.submittedAt)],
    ["처리 상태", "상담대기 · 견적 생성 전"],
    ["신청자명", details.applicantName],
    ["연락처", details.applicantPhone],
    ["성별 / 연령", `${details.applicantGender} / ${details.applicantAge}`],
    ["회원 구분", details.memberChannel],
    ["이메일", details.memberEmail],
    ["상품명", details.productName],
    ["지역", location],
    ["출발일", departure],
    ["귀국일", returnDate],
    ["여행 기간", details.tripSummary],
    ["신청 인원", `${details.people}명`],
    ["객실 선택", details.roomType],
    ["싱글차지", surcharge],
    ["항공 요청", details.flightRequestType],
    ["골프 수준", details.level],
    ["선호 스타일", styles],
    ["선호 동반자", preferences],
    ["인사말 / 요청사항", details.greeting],
    ["신청 ID", details.applicationId || "미등록"],
    ["일정 ID", details.scheduleId || "미등록"]
  ];
  const plainText = [
    `${details.typeLabel} 신청이 접수되었습니다.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    dashboardUrl ? `\n상담대기에서 확인: ${dashboardUrl}` : "",
    "",
    "※ 고객 상담에 필요한 최소 정보만 포함되어 있습니다.",
    "※ 정확한 상품 가격과 항공 좌석은 상담 전 다시 확인해 주세요."
  ].filter((line, index, values) => line || (index > 0 && values[index - 1])).join("\n");
  const sections = [
    { title: "신청 요약", start: 0, end: 3 },
    { title: "신청자 정보", start: 3, end: 8 },
    { title: "상품 및 일정", start: 8, end: 17 },
    { title: "참여 조건 및 요청사항", start: 17, end: 21 },
    { title: "관리 정보", start: 21, end: rows.length }
  ];
  const sectionHtml = sections.map((section) => `
    <div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:18px">
      <div style="margin-bottom:10px;color:#2563eb;font-size:13px;font-weight:700">${escapeHtml(section.title)}</div>
      <table role="presentation" style="width:100%;border-collapse:collapse">
        ${rows.slice(section.start, section.end).map(([label, value]) => `<tr><td style="width:116px;padding:6px 12px 6px 0;color:#6b7280;font-size:14px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;line-height:1.55;word-break:break-word">${escapeHtml(value)}</td></tr>`).join("")}
      </table>
    </div>`).join("");
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#f3f5f8;font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#111827"><div style="padding:28px 12px"><div style="max-width:640px;margin:0 auto;border:1px solid #e3e8ef;border-radius:16px;background:#fff;overflow:hidden"><div style="padding:24px 26px;background:#287fd5;color:#fff"><div style="font-size:13px;font-weight:700;opacity:.9">골프조인 신규신청</div><h1 style="margin:7px 0 0;font-size:22px;line-height:1.4">${escapeHtml(details.typeLabel)} 신청이 접수되었습니다.</h1></div><div style="padding:24px 26px">${sectionHtml}${dashboardUrl ? `<div style="margin-top:26px;text-align:center"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;border-radius:10px;background:#4fa9ff;color:#fff;padding:13px 24px;font-size:15px;font-weight:700;text-decoration:none">상담대기에서 신청 내용 확인하기</a></div>` : ""}<div style="margin-top:24px;border-radius:10px;background:#f7f9fb;padding:14px 16px;color:#6b7280;font-size:12px;line-height:1.6">고객 상담에 필요한 최소 정보만 포함되어 있습니다.<br>정확한 상품 가격과 항공 좌석은 상담 전 다시 확인해 주세요.</div></div></div></div></body></html>`;
  return { subject, plainText, html, details, dashboardUrl };
}

function buildVerificationEmail(email, code, options = {}) {
  const expiresInMinutes = Math.max(1, Number(options.expiresInMinutes || 10) || 10);
  const subject = "[골프조인 대시보드] 이메일 수신 주소 인증";
  const plainText = `골프조인 대시보드 이메일 인증번호는 ${code}입니다.\n${expiresInMinutes}분 안에 설정 화면에 입력해 주세요.\n요청하지 않았다면 이 메일을 무시해 주세요.`;
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#f3f5f8;font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif"><div style="padding:28px 12px"><div style="max-width:520px;margin:0 auto;border:1px solid #e3e8ef;border-radius:16px;background:#fff;padding:28px"><div style="color:#287fd5;font-size:13px;font-weight:700">골프조인 대시보드</div><h1 style="margin:8px 0 12px;color:#1f2937;font-size:22px">이메일 수신 주소를 인증해 주세요.</h1><p style="margin:0;color:#667085;font-size:14px;line-height:1.6"><strong>${escapeHtml(maskEmail(email))}</strong> 주소를 신규 신청 알림 수신처로 등록하기 위한 인증번호입니다.</p><div style="margin:22px 0;border-radius:12px;background:#eef6ff;padding:18px;text-align:center;color:#1f6fbd;font-size:30px;font-weight:800;letter-spacing:8px">${escapeHtml(code)}</div><p style="margin:0;color:#8a94a3;font-size:13px;line-height:1.6">${expiresInMinutes}분 안에 설정 화면에 입력해 주세요.<br>요청하지 않았다면 이 메일을 무시해 주세요.</p></div></div></body></html>`;
  return { subject, plainText, html };
}

function buildTestEmail(options = {}) {
  const subject = "[골프조인 대시보드] 신규 신청 이메일 알림 테스트";
  const sentAt = formatKstDateTime(options.sentAt || new Date().toISOString());
  const plainText = `골프조인 신규 신청 이메일 알림이 정상적으로 연결되었습니다.\n테스트 시각: ${sentAt}\n이 메일은 실제 고객 신청이 아닙니다.`;
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#f3f5f8;font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif"><div style="padding:28px 12px"><div style="max-width:520px;margin:0 auto;border:1px solid #e3e8ef;border-radius:16px;background:#fff;padding:28px"><div style="color:#287fd5;font-size:13px;font-weight:700">골프조인 대시보드</div><h1 style="margin:8px 0 12px;color:#1f2937;font-size:22px">이메일 알림 연결이 정상입니다.</h1><p style="margin:0;color:#667085;font-size:14px;line-height:1.7">신규 일정 생성과 참여 신청이 접수되면 이 주소로 신청 내역이 전달됩니다.</p><div style="margin-top:20px;border-radius:10px;background:#f7f9fb;padding:14px 16px;color:#6b7280;font-size:13px">테스트 시각: ${escapeHtml(sentAt)}<br>이 메일은 실제 고객 신청이 아닙니다.</div></div></div></body></html>`;
  return { subject, plainText, html };
}

function buildAppsScriptSignaturePayload(payload = {}) {
  return [
    text(payload.action),
    text(payload.version),
    text(payload.timestamp),
    text(payload.nonce),
    text(payload.idempotencyKey),
    normalizeEmail(payload.to),
    sha256Hex(payload.subject),
    sha256Hex(payload.plainText),
    sha256Hex(payload.html),
    text(payload.fromName)
  ].join("\n");
}

function createAppsScriptMailer(options = {}) {
  const endpointUrl = text(options.endpointUrl);
  const signingSecret = text(options.signingSecret);
  const fromEmail = normalizeEmail(options.fromEmail);
  const fromName = text(options.fromName) || "시크릿투어 골프조인";
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 12000) || 12000);
  let validEndpoint = false;
  try {
    const parsed = new URL(endpointUrl);
    validEndpoint = parsed.protocol === "https:" && parsed.hostname === "script.google.com" && /\/macros\/s\/[^/]+\/exec$/.test(parsed.pathname);
  } catch (error) {
    validEndpoint = false;
  }
  const configured = Boolean(validEndpoint && signingSecret.length >= 32 && typeof fetchImpl === "function");
  return {
    configured,
    fromEmail,
    async send(message = {}) {
      const recipient = normalizeEmail(message.to);
      if (!configured) return { ok: false, skipped: true, retryable: false, errorCode: "email_provider_not_configured" };
      if (!isValidEmail(recipient)) return { ok: false, retryable: false, errorCode: "email_recipient_invalid" };
      const subject = truncate(message.subject, 120);
      const plainText = String(message.plainText || "");
      const html = String(message.html || "");
      if (!subject || !plainText || plainText.length > 30000 || html.length > 100000) {
        return { ok: false, retryable: false, errorCode: "email_message_invalid" };
      }
      const timestamp = Date.now();
      const nonce = crypto.randomBytes(16).toString("hex");
      const idempotencyKey = truncate(
        text(message.idempotencyKey) || `email_${sha256Hex([recipient, subject, plainText, html].join("\u0000"))}`,
        120
      );
      const requestBody = {
        action: "admin_email_send",
        version: 1,
        timestamp,
        nonce,
        idempotencyKey,
        to: recipient,
        subject,
        plainText,
        html,
        fromName
      };
      requestBody.signature = hmac(buildAppsScriptSignaturePayload(requestBody), signingSecret);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpointUrl, {
          method: "POST",
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(requestBody)
        });
        const responseText = await response.text();
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            retryable: response.status === 429 || response.status >= 500,
            errorCode: response.status === 429 ? "email_provider_rate_limited" : `email_provider_http_${response.status}`,
            providerMessage: truncate(responseText, 120)
          };
        }
        const result = parseJson(responseText, {});
        if (!result?.ok) {
          const errorCode = text(result?.error || result?.code) || "email_provider_invalid_response";
          return {
            ok: false,
            status: response.status,
            retryable: ["apps_script_busy", "apps_script_temporary_error"].includes(errorCode),
            errorCode,
            providerMessage: ""
          };
        }
        return {
          ok: true,
          status: response.status,
          retryable: false,
          duplicate: Boolean(result.duplicate),
          messageId: text(result.messageId),
          quotaRemaining: Number(result.quotaRemaining)
        };
      } catch (error) {
        return {
          ok: false,
          retryable: true,
          errorCode: error?.name === "AbortError" ? "email_provider_timeout" : "email_provider_network_error"
        };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

async function sendEmailWithRetry(send, message, options = {}) {
  const delays = Array.isArray(options.retryDelaysMs) ? options.retryDelaysMs.map(Number).filter((value) => value >= 0) : [1000, 2000, 4000, 8000];
  let result = null;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    result = await send(message);
    if (result?.ok || result?.skipped || !result?.retryable || attempt >= delays.length) {
      return { ...result, attempts: attempt + 1, retryCount: attempt };
    }
    const delayMs = delays[attempt];
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { ...(result || {}), attempts: delays.length + 1, retryCount: delays.length };
}

module.exports = {
  MAX_RECIPIENTS,
  normalizeEmail,
  isValidEmail,
  maskEmail,
  createRecipientHash,
  createVerificationCode,
  createVerificationHash,
  safeHashEqual,
  normalizeRecipients,
  createDefaultSettings,
  normalizeSettings,
  sanitizeSettings,
  normalizeApplicationDetails,
  buildAdminApplicationEmail,
  buildVerificationEmail,
  buildTestEmail,
  sha256Hex,
  buildAppsScriptSignaturePayload,
  createAppsScriptMailer,
  sendEmailWithRetry,
  formatKstDateTime,
  formatKoreanDate
};
