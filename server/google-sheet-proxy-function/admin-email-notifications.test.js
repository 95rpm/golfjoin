"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const {
  normalizeEmail,
  isValidEmail,
  maskEmail,
  createVerificationHash,
  safeHashEqual,
  normalizeSettings,
  sanitizeSettings,
  normalizeApplicationDetails,
  buildAdminApplicationEmail,
  buildVerificationEmail,
  buildAppsScriptSignaturePayload,
  createAppsScriptMailer,
  sendEmailWithRetry
} = require("./admin-email-notifications");

test("수신 이메일을 정규화·검증하고 안전하게 마스킹한다", () => {
  assert.equal(normalizeEmail("  Admin@Secret-Tour.com "), "admin@secret-tour.com");
  assert.equal(isValidEmail("admin@secret-tour.com"), true);
  assert.equal(isValidEmail("admin@localhost"), false);
  assert.equal(maskEmail("admin@secret-tour.com"), "ad***@secret-tour.com");
});

test("인증번호 해시는 이메일에 귀속되고 상수 시간 비교를 사용한다", () => {
  const first = createVerificationHash("admin@secret-tour.com", "123456", "secret");
  const same = createVerificationHash("ADMIN@SECRET-TOUR.COM", "123456", "secret");
  const other = createVerificationHash("admin@secret-tour.com", "654321", "secret");
  assert.equal(safeHashEqual(first, same), true);
  assert.equal(safeHashEqual(first, other), false);
});

test("대시보드 응답은 인증 해시를 노출하지 않는다", () => {
  const settings = normalizeSettings({
    enabled: "TRUE",
    recipientsJson: JSON.stringify([{
      email: "admin@secret-tour.com",
      verifiedAt: "2026-09-14T10:00:00+09:00",
      verificationHash: "never-expose-this"
    }])
  });
  const publicSettings = sanitizeSettings(settings, {
    providerConfigured: true,
    masterEnabled: true,
    fromEmail: "notice@secret-tour.com"
  });
  assert.equal(publicSettings.verifiedRecipientCount, 1);
  assert.equal(JSON.stringify(publicSettings).includes("never-expose-this"), false);
});

test("새 모임 생성 이메일 제목과 본문에 상담 필수 정보가 포함된다", () => {
  const message = buildAdminApplicationEmail({
    source: "new_schedule_builder",
    applicationId: "nsa_20260914_001",
    scheduleId: "schedule_001",
    submittedAt: "2026-09-14T09:15:00+09:00",
    member: { memberChannel: "KAKAO", memberEmail: "customer@example.com" },
    applicant: {
      name: "홍길동",
      phone: "01012345678",
      gender: "남성",
      ageDisplay: "48세",
      people: 2,
      roomType: "1인1실",
      singleRoomSurchargeText: "8,000엔",
      flightRequestType: "항공 포함 요청",
      level: "중급",
      styles: ["친목"],
      memberPreferences: ["비슷한 연령대"],
      greeting: "오전 출발편을 원합니다."
    },
    trip: {
      productName: "일본 후쿠오카 2박3일",
      country: "일본",
      region: "후쿠오카",
      tripSummary: "2박3일",
      departureDates: ["2026-09-26"],
      returnDates: ["2026-09-28"]
    }
  }, { dashboardUrl: "https://dashboad-golfjoin-secrettour.web.app" });

  assert.match(message.subject, /^\[골프조인 신규신청\] 새 모임 생성 \| 홍길동 \| 후쿠오카 \| 2026\.09\.26$/);
  assert.match(message.plainText, /처리 상태: 상담대기 · 견적 생성 전/);
  assert.match(message.plainText, /싱글차지: 8,000엔/);
  assert.match(message.html, /상담대기에서 신청 내용 확인하기/);
  assert.match(message.dashboardUrl, /applicationId=nsa_20260914_001/);
});

test("참여 신청 시트 행도 이메일 정보로 재구성할 수 있다", () => {
  const details = normalizeApplicationDetails({
    source: "join_apply",
    applicationId: "ja_20260914_001",
    targetScheduleId: "schedule_001",
    createdAt: "2026-09-14T10:00:00+09:00",
    applicantName: "김골프",
    applicantMobile: "01098765432",
    applicantGender: "여성",
    applicantAgeBand: "42세",
    applicantPeople: "1",
    productName: "일본 아오모리 4박5일",
    country: "일본",
    region: "아오모리",
    departureDate: "2026-09-17",
    returnDate: "2026-09-21",
    applicantStyles: '["여유로운 라운드"]'
  });
  assert.equal(details.typeLabel, "참여 신청");
  assert.equal(details.applicantName, "김골프");
  assert.equal(details.region, "아오모리");
  assert.deepEqual(details.styles, ["여유로운 라운드"]);
});

test("안전하지 않은 대시보드 주소는 이메일 링크에서 제외한다", () => {
  const message = buildAdminApplicationEmail({
    source: "join_apply",
    applicationId: "ja_1",
    applicantName: "테스트",
    productName: "테스트 상품",
    departureDate: "2026-09-20"
  }, { dashboardUrl: "http://example.com/admin?token=secret" });
  assert.equal(message.dashboardUrl, "");
  assert.equal(message.html.includes("token=secret"), false);
});

test("인증 이메일은 6자리 코드와 만료 안내를 포함한다", () => {
  const message = buildVerificationEmail("admin@secret-tour.com", "123456", { expiresInMinutes: 10 });
  assert.match(message.subject, /이메일 수신 주소 인증/);
  assert.match(message.plainText, /123456/);
  assert.match(message.plainText, /10분/);
  assert.equal(message.html.includes("admin@secret-tour.com"), false);
});

test("Apps Script 어댑터는 비밀값을 전송하지 않고 본문 전체에 HMAC 서명한다", async () => {
  let request = null;
  const signingSecret = "0123456789abcdef0123456789abcdef";
  const mailer = createAppsScriptMailer({
    endpointUrl: "https://script.google.com/macros/s/test-deployment/exec",
    signingSecret,
    fromEmail: "notice@secret-tour.com",
    fromName: "시크릿투어 골프조인",
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, messageId: "gas-message-1", quotaRemaining: 99 })
      };
    }
  });
  const result = await mailer.send({
    to: "admin@secret-tour.com",
    idempotencyKey: "aem_test_001",
    subject: "신규 신청",
    plainText: "본문",
    html: "<p>본문</p>"
  });
  assert.equal(result.ok, true);
  assert.equal(result.messageId, "gas-message-1");
  assert.equal(request.url, "https://script.google.com/macros/s/test-deployment/exec");
  assert.equal(request.options.redirect, "follow");
  assert.equal(request.options.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.equal(JSON.stringify(request.body).includes(signingSecret), false);
  assert.equal(request.body.action, "admin_email_send");
  assert.equal(request.body.idempotencyKey, "aem_test_001");
  assert.equal(request.body.html, "<p>본문</p>");
  const expected = crypto.createHmac("sha256", signingSecret)
    .update(buildAppsScriptSignaturePayload(request.body), "utf8")
    .digest("hex");
  assert.equal(request.body.signature, expected);
});

test("Apps Script 어댑터는 일일 할당량 소진을 영구 오류로 처리한다", async () => {
  const mailer = createAppsScriptMailer({
    endpointUrl: "https://script.google.com/macros/s/test-deployment/exec",
    signingSecret: "0123456789abcdef0123456789abcdef",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: false, error: "apps_script_quota_exceeded" })
    })
  });
  const result = await mailer.send({ to: "admin@secret-tour.com", subject: "테스트", plainText: "본문" });
  assert.equal(result.ok, false);
  assert.equal(result.retryable, false);
  assert.equal(result.errorCode, "apps_script_quota_exceeded");
});

test("일시 오류만 제한 횟수 안에서 재시도하고 성공하면 멈춘다", async () => {
  let attempts = 0;
  const result = await sendEmailWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) return { ok: false, retryable: true, errorCode: "email_provider_rate_limited" };
    return { ok: true, messageId: "done" };
  }, { to: "admin@secret-tour.com" }, { retryDelaysMs: [0, 0, 0, 0] });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(result.retryCount, 2);
});

test("영구 오류는 재시도하지 않는다", async () => {
  let attempts = 0;
  const result = await sendEmailWithRetry(async () => {
    attempts += 1;
    return { ok: false, retryable: false, errorCode: "email_recipient_invalid" };
  }, {}, { retryDelaysMs: [0, 0, 0] });
  assert.equal(attempts, 1);
  assert.equal(result.retryCount, 0);
});
