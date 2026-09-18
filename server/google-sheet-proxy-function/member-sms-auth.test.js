"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  MemoryMemberAuthStore,
  createMemberAccessToken,
  verifyMemberAccessToken,
  createMemberSmsAuthService,
  consumeRateLimit
} = require("./member-sms-auth");

const AUTH_SECRET = "member-auth-test-secret-that-is-longer-than-thirty-two-bytes";

function createDeterministicRandomBytes() {
  let counter = 0;
  return (size) => {
    counter += 1;
    return Buffer.alloc(size, counter);
  };
}

function createFixture(options = {}) {
  let nowMs = options.nowMs || Date.parse("2026-08-14T06:00:00.000Z");
  const store = new MemoryMemberAuthStore();
  const queued = [];
  const service = createMemberSmsAuthService({
    secret: AUTH_SECRET,
    store,
    now: () => nowMs,
    randomBytes: createDeterministicRandomBytes(),
    randomInt: () => 123456,
    lookupMemberExact: async (name, mobile) => ({
      matchStatus: "web_member",
      memberExists: true,
      matchCount: 1,
      member: {
        custSeq: "30002219",
        custId: "test004",
        memberName: name,
        mobile,
        hasWebAccount: true,
        joinChannel: "HOME"
      }
    }),
    enqueueOtp: async (payload) => queued.push(payload),
    ...(options.service || {})
  });
  return {
    store,
    queued,
    service,
    get nowMs() { return nowMs; },
    set nowMs(value) { nowMs = value; }
  };
}

function startPayload(overrides = {}) {
  return {
    memberSeq: "30002219",
    memberId: "test004",
    memberName: "테스트",
    memberChannel: "HOME",
    memberMobile: "01022234445",
    ...overrides
  };
}

test("member access token accepts only its signature, audience and five-minute lifetime", () => {
  const nowMs = Date.parse("2026-08-14T06:00:00.000Z");
  const token = createMemberAccessToken({
    secret: AUTH_SECRET,
    memberSeq: "30002219",
    memberId: "test004",
    nowMs,
    ttlSeconds: 300,
    jti: "test-jti"
  });
  const verified = verifyMemberAccessToken(token, { secret: AUTH_SECRET, nowMs: nowMs + 299_000 });
  assert.equal(verified.memberSeq, "30002219");
  assert.equal(verified.memberKey, "seq:30002219");
  assert.equal(verified.memberId, "test004");
  assert.throws(
    () => verifyMemberAccessToken(token, { secret: AUTH_SECRET, nowMs: nowMs + 300_000 }),
    (error) => error.code === "member_token_invalid" && error.status === 401
  );
  assert.throws(
    () => verifyMemberAccessToken(`${token.slice(0, -1)}x`, { secret: AUTH_SECRET, nowMs }),
    (error) => error.code === "member_token_invalid"
  );
});

test("verified Kakao identity can receive the same rotating 24-hour member session", async () => {
  const fixture = createFixture();
  const result = await fixture.service.issueVerifiedSession({
    memberSeq: "30002047",
    memberId: "2783624471",
    memberChannel: "KAKAO",
    authMethod: "kakao",
    providerSubject: "2783624471"
  });
  assert.equal(result.memberKey, "seq:30002047");
  assert.equal(result.expiresIn, 300);
  assert.equal(result.sessionExpiresIn, 24 * 60 * 60);
  const verified = verifyMemberAccessToken(result.accessToken, {
    secret: AUTH_SECRET,
    nowMs: fixture.nowMs
  });
  assert.equal(verified.memberSeq, "30002047");
  assert.equal(verified.memberId, "2783624471");
  const sessionId = result.refreshToken.split(".")[1];
  const stored = await fixture.store.readJson(`sessions/${sessionId}.json`);
  assert.equal(stored.value.memberChannel, "KAKAO");
  assert.equal(stored.value.authMethod, "kakao");
  assert.notEqual(stored.value.providerSubjectHash, "2783624471");
});

test("login OTP start uses three minutes, rechecks the ERP member and stores no plaintext phone or code", async () => {
  const fixture = createFixture();
  const result = await fixture.service.start(startPayload(), { clientFingerprint: "ip|browser" });
  assert.equal(result.ok, true);
  assert.equal(result.expiresIn, 180);
  assert.equal(result.destinationHint, "010-xxxx-4445");
  assert.equal(fixture.queued.length, 1);
  assert.equal(fixture.queued[0].code, "123456");
  assert.equal(fixture.queued[0].expiresInMinutes, 3);
  const challenge = [...fixture.store.dump().entries()].find(([key]) => key.startsWith("challenges/"));
  assert.ok(challenge);
  const serialized = JSON.stringify(challenge[1]);
  assert.equal(serialized.includes("123456"), false);
  assert.equal(serialized.includes("01022234445"), false);
  assert.equal(challenge[1].memberSeq, "30002219");
  assert.match(challenge[1].otpHash, /^[A-Za-z0-9_-]{40,}$/);
});

test("OTP start rejects a browser member identity that differs from the ERP result", async () => {
  const fixture = createFixture();
  await assert.rejects(
    fixture.service.start(startPayload({ memberSeq: "30009999" }), { clientFingerprint: "ip|browser" }),
    (error) => error.code === "member_verification_failed" && error.status === 400
  );
  assert.equal(fixture.queued.length, 0);
});

test("OTP verify issues a five-minute access token and a rotating session credential", async () => {
  const fixture = createFixture();
  const started = await fixture.service.start(startPayload(), { clientFingerprint: "ip|browser" });
  const verified = await fixture.service.verify({ challengeId: started.challengeId, code: "123456" });
  assert.equal(verified.ok, true);
  assert.equal(verified.expiresIn, 300);
  assert.equal(verified.sessionExpiresIn, 24 * 60 * 60);
  assert.equal(verified.memberKey, "seq:30002219");
  assert.match(verified.refreshToken, /^gjmr\.gms_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(
    verifyMemberAccessToken(verified.accessToken, { secret: AUTH_SECRET, nowMs: fixture.nowMs }).memberSeq,
    "30002219"
  );
  assert.equal(
    verifyMemberAccessToken(verified.accessToken, { secret: AUTH_SECRET, nowMs: fixture.nowMs }).memberId,
    "test004"
  );

  const refreshed = await fixture.service.refresh({ refreshToken: verified.refreshToken });
  assert.notEqual(refreshed.refreshToken, verified.refreshToken);
  await assert.rejects(
    fixture.service.refresh({ refreshToken: verified.refreshToken }),
    (error) => error.code === "member_session_invalid" && error.status === 401
  );
  assert.equal(
    verifyMemberAccessToken(refreshed.accessToken, { secret: AUTH_SECRET, nowMs: fixture.nowMs }).memberSeq,
    "30002219"
  );
  assert.equal(
    verifyMemberAccessToken(refreshed.accessToken, { secret: AUTH_SECRET, nowMs: fixture.nowMs }).memberId,
    "test004"
  );
});

test("signup phone OTP is valid for three minutes and stores neither plaintext phone nor code", async () => {
  const fixture = createFixture();
  const started = await fixture.service.signupStart(
    { mobile: "01022234445" },
    { clientFingerprint: "signup-ip|browser" }
  );
  assert.equal(started.ok, true);
  assert.equal(started.expiresIn, 180);
  assert.equal(started.destinationHint, "010-xxxx-4445");
  assert.equal(fixture.queued.length, 1);
  assert.equal(fixture.queued[0].expiresInMinutes, 3);
  const challenge = [...fixture.store.dump().entries()].find(([key]) => key.startsWith("signup-challenges/"));
  assert.ok(challenge);
  const serialized = JSON.stringify(challenge[1]);
  assert.equal(serialized.includes("123456"), false);
  assert.equal(serialized.includes("01022234445"), false);
  assert.equal(challenge[1].purpose, "signup_phone");
});

test("signup phone proof is bound to the verified phone and can create one member session", async () => {
  const fixture = createFixture();
  const started = await fixture.service.signupStart(
    { mobile: "01022234445" },
    { clientFingerprint: "signup-ip|browser" }
  );
  const verified = await fixture.service.signupVerify({
    challengeId: started.challengeId,
    code: "123456",
    mobile: "01022234445"
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.verified, true);
  assert.match(verified.verificationToken, /^gjsp\./);
  assert.deepEqual(
    await fixture.service.signupAssert({
      mobile: "01022234445",
      verificationToken: verified.verificationToken
    }),
    { ok: true, verified: true }
  );
  await assert.rejects(
    fixture.service.signupAssert({
      mobile: "01099998888",
      verificationToken: verified.verificationToken
    }),
    (error) => error.code === "member_signup_phone_mismatch" && error.status === 401
  );
  const completed = await fixture.service.signupComplete({
    memberSeq: "30002219",
    memberId: "test004",
    memberName: "테스트",
    mobile: "01022234445",
    verificationToken: verified.verificationToken
  });
  assert.equal(completed.memberKey, "seq:30002219");
  assert.equal(completed.sessionExpiresIn, 24 * 60 * 60);
  await assert.rejects(
    fixture.service.signupComplete({
      memberSeq: "30002219",
      memberId: "test004",
      memberName: "테스트",
      mobile: "01022234445",
      verificationToken: verified.verificationToken
    }),
    (error) => error.code === "member_signup_phone_proof_invalid"
  );
});

test("signup completion retries until the newly-created ERP member becomes searchable", async () => {
  let lookupCount = 0;
  const retryDelays = [];
  const fixture = createFixture({
    service: {
      signupMemberLookupRetryDelaysMs: [0, 25, 50],
      sleep: async (milliseconds) => retryDelays.push(milliseconds),
      lookupMemberExact: async (name, mobile) => {
        lookupCount += 1;
        if (lookupCount < 3) {
          return { matchStatus: "not_found", memberExists: false, matchCount: 0, member: null };
        }
        return {
          matchStatus: "web_member",
          memberExists: true,
          matchCount: 1,
          member: {
            custSeq: "30002219",
            custId: "test004",
            memberName: name,
            mobile,
            hasWebAccount: true,
            joinChannel: "HOME"
          }
        };
      }
    }
  });
  const started = await fixture.service.signupStart(
    { mobile: "01022234445" },
    { clientFingerprint: "signup-index-delay" }
  );
  const verified = await fixture.service.signupVerify({
    challengeId: started.challengeId,
    code: "123456",
    mobile: "01022234445"
  });
  const completed = await fixture.service.signupComplete({
    memberSeq: "30002219",
    memberId: "test004",
    memberName: "테스트",
    mobile: "01022234445",
    verificationToken: verified.verificationToken
  });
  assert.equal(completed.memberKey, "seq:30002219");
  assert.equal(lookupCount, 3);
  assert.deepEqual(retryDelays, [25, 50]);
});

test("signup phone verification expires after three minutes", async () => {
  const fixture = createFixture();
  const started = await fixture.service.signupStart(
    { mobile: "01022234445" },
    { clientFingerprint: "signup-ip|browser" }
  );
  fixture.nowMs += 181_000;
  await assert.rejects(
    fixture.service.signupVerify({
      challengeId: started.challengeId,
      code: "123456",
      mobile: "01022234445"
    }),
    (error) => error.code === "member_otp_expired" && error.status === 401
  );
});

test("OTP is single-use and five wrong attempts lock the challenge", async () => {
  const fixture = createFixture();
  const started = await fixture.service.start(startPayload(), { clientFingerprint: "ip|browser" });
  for (let index = 0; index < 4; index += 1) {
    await assert.rejects(
      fixture.service.verify({ challengeId: started.challengeId, code: "000000" }),
      (error) => error.code === "member_otp_invalid" && error.attemptsRemaining === 4 - index
    );
  }
  await assert.rejects(
    fixture.service.verify({ challengeId: started.challengeId, code: "000000" }),
    (error) => error.code === "member_otp_locked" && error.status === 429
  );
  await assert.rejects(
    fixture.service.verify({ challengeId: started.challengeId, code: "123456" }),
    (error) => error.code === "member_otp_locked" || error.code === "member_otp_expired"
  );
});

test("OTP verification fails after expiration", async () => {
  const fixture = createFixture();
  const started = await fixture.service.start(startPayload(), { clientFingerprint: "ip|browser" });
  fixture.nowMs += 301_000;
  await assert.rejects(
    fixture.service.verify({ challengeId: started.challengeId, code: "123456" }),
    (error) => error.code === "member_otp_expired" && error.status === 401
  );
});

test("rate counter enforces both cooldown and rolling-window count", async () => {
  const store = new MemoryMemberAuthStore();
  const first = await consumeRateLimit(store, "rates/test.json", {
    nowMs: 1_000_000,
    minIntervalMs: 60_000,
    windowMs: 3_600_000,
    maxCount: 2
  });
  assert.equal(first.allowed, true);
  const cooldown = await consumeRateLimit(store, "rates/test.json", {
    nowMs: 1_030_000,
    minIntervalMs: 60_000,
    windowMs: 3_600_000,
    maxCount: 2
  });
  assert.equal(cooldown.allowed, false);
  const second = await consumeRateLimit(store, "rates/test.json", {
    nowMs: 1_061_000,
    minIntervalMs: 60_000,
    windowMs: 3_600_000,
    maxCount: 2
  });
  assert.equal(second.allowed, true);
  const capped = await consumeRateLimit(store, "rates/test.json", {
    nowMs: 1_122_000,
    minIntervalMs: 60_000,
    windowMs: 3_600_000,
    maxCount: 2
  });
  assert.equal(capped.allowed, false);
});

test("default member hourly OTP allowance supports ordinary expiry resends while retaining a cap", () => {
  const source = fs.readFileSync(path.join(__dirname, "member-sms-auth.js"), "utf8");
  assert.match(source, /memberHourlyLimit\s*=\s*Math\.max\(2,\s*Number\(options\.memberHourlyLimit\s*\|\|\s*10\)\)/);
});

test("revoked refresh credential cannot be used again", async () => {
  const fixture = createFixture();
  const started = await fixture.service.start(startPayload(), { clientFingerprint: "ip|browser" });
  const verified = await fixture.service.verify({ challengeId: started.challengeId, code: "123456" });
  assert.deepEqual(await fixture.service.revoke({ refreshToken: verified.refreshToken }), { ok: true, revoked: true });
  await assert.rejects(
    fixture.service.refresh({ refreshToken: verified.refreshToken }),
    (error) => error.code === "member_session_invalid"
  );
});
