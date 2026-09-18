"use strict";

const crypto = require("node:crypto");

const MEMBER_AUTH_ISSUER = "golfjoin-member-sms-auth";
const MEMBER_AUTH_AUDIENCE = "golfjoin-sheet-api";
const MEMBER_ACCESS_TOKEN_PREFIX = "gjma";
const MEMBER_REFRESH_TOKEN_PREFIX = "gjmr";
const MEMBER_SIGNUP_PROOF_TOKEN_PREFIX = "gjsp";
const MEMBER_AUTH_SCHEMA = "golfjoin-member-sms-auth-v1";
const MEMBER_SIGNUP_PROOF_AUDIENCE = "golfjoin-member-signup-phone";

function text(value) {
  return String(value == null ? "" : value).trim();
}

function createMemberAuthError(message, status = 400, code = "member_auth_error", details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, details);
  return error;
}

function normalizeMemberAuthPhone(value = "") {
  const digits = text(value).replace(/\D/g, "");
  if (/^82(1[016789]\d{8})$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^1[016789]\d{8}$/.test(digits)) return `0${digits}`;
  return digits;
}

function normalizeMemberAuthName(value = "") {
  return text(value).replace(/\s+/g, "").toLowerCase();
}

function isKoreanMobile(value = "") {
  return /^01[016789]\d{7,8}$/.test(normalizeMemberAuthPhone(value));
}

function safeEqual(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hmac(secret, purpose, value) {
  return crypto
    .createHmac("sha256", String(secret))
    .update(`${purpose}\u0000${String(value)}`, "utf8")
    .digest("base64url");
}

function randomId(prefix, bytes = 18, randomBytes = crypto.randomBytes) {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

function maskMemberAuthPhone(value = "") {
  const mobile = normalizeMemberAuthPhone(value);
  if (mobile.length < 7) return "***";
  return `${mobile.slice(0, 3)}-xxxx-${mobile.slice(-4)}`;
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value) {
  return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
}

function assertMemberAuthSecret(secret) {
  if (Buffer.byteLength(String(secret || ""), "utf8") < 32) {
    throw createMemberAuthError("Member authentication is not configured", 503, "member_auth_not_configured");
  }
}

function createMemberAccessToken({
  secret,
  memberSeq,
  memberId = "",
  nowMs = Date.now(),
  ttlSeconds = 300,
  jti = randomId("jti", 12)
} = {}) {
  assertMemberAuthSecret(secret);
  const sub = text(memberSeq);
  const trustedMemberId = text(memberId);
  if (!/^\d+$/.test(sub)) throw createMemberAuthError("Invalid member identity", 400, "member_identity_invalid");
  if (trustedMemberId.length > 200 || /[\u0000-\u001f\u007f]/.test(trustedMemberId)) {
    throw createMemberAuthError("Invalid member identity", 400, "member_identity_invalid");
  }
  const issuedAt = Math.floor(Number(nowMs) / 1000);
  const expiresIn = Math.max(60, Math.min(300, Number(ttlSeconds) || 300));
  const payload = encodeJson({
    iss: MEMBER_AUTH_ISSUER,
    aud: MEMBER_AUTH_AUDIENCE,
    sub,
    memberKey: `seq:${sub}`,
    ...(trustedMemberId ? { memberId: trustedMemberId } : {}),
    iat: issuedAt,
    exp: issuedAt + expiresIn,
    jti: text(jti)
  });
  const signature = hmac(secret, "member-access", payload);
  return `${MEMBER_ACCESS_TOKEN_PREFIX}.${payload}.${signature}`;
}

function verifyMemberAccessToken(token, { secret, nowMs = Date.now() } = {}) {
  assertMemberAuthSecret(secret);
  const parts = text(token).split(".");
  if (parts.length !== 3 || parts[0] !== MEMBER_ACCESS_TOKEN_PREFIX) {
    throw createMemberAuthError("Invalid member token", 401, "member_token_invalid");
  }
  const [, encoded, signature] = parts;
  if (!safeEqual(signature, hmac(secret, "member-access", encoded))) {
    throw createMemberAuthError("Invalid member token", 401, "member_token_invalid");
  }
  let payload;
  try {
    payload = decodeJson(encoded);
  } catch {
    throw createMemberAuthError("Invalid member token", 401, "member_token_invalid");
  }
  const nowSeconds = Math.floor(Number(nowMs) / 1000);
  const trustedMemberId = text(payload.memberId);
  if (
    payload.iss !== MEMBER_AUTH_ISSUER
    || payload.aud !== MEMBER_AUTH_AUDIENCE
    || !/^\d+$/.test(text(payload.sub))
    || payload.memberKey !== `seq:${payload.sub}`
    || !Number.isFinite(Number(payload.iat))
    || !Number.isFinite(Number(payload.exp))
    || Number(payload.iat) > nowSeconds + 30
    || Number(payload.exp) <= nowSeconds
    || Number(payload.exp) - Number(payload.iat) > 300
    || (payload.memberId != null && typeof payload.memberId !== "string")
    || trustedMemberId.length > 200
    || /[\u0000-\u001f\u007f]/.test(trustedMemberId)
  ) {
    throw createMemberAuthError("Expired or invalid member token", 401, "member_token_invalid");
  }
  return Object.freeze({
    memberSeq: text(payload.sub),
    memberKey: text(payload.memberKey),
    memberId: trustedMemberId,
    issuedAt: Number(payload.iat),
    expiresAt: Number(payload.exp),
    jti: text(payload.jti)
  });
}

function createMemberSignupProofToken({
  secret,
  challengeId,
  mobileHash,
  nowMs = Date.now(),
  ttlSeconds = 15 * 60,
  jti = randomId("gsp", 12)
} = {}) {
  assertMemberAuthSecret(secret);
  const normalizedChallengeId = text(challengeId);
  const normalizedMobileHash = text(mobileHash);
  if (!/^gspc_[A-Za-z0-9_-]{16,}$/.test(normalizedChallengeId) || !normalizedMobileHash) {
    throw createMemberAuthError("Invalid signup phone verification", 400, "member_signup_phone_invalid");
  }
  const issuedAt = Math.floor(Number(nowMs) / 1000);
  const expiresIn = Math.max(60, Math.min(30 * 60, Number(ttlSeconds) || 15 * 60));
  const payload = encodeJson({
    iss: MEMBER_AUTH_ISSUER,
    aud: MEMBER_SIGNUP_PROOF_AUDIENCE,
    challengeId: normalizedChallengeId,
    mobileHash: normalizedMobileHash,
    iat: issuedAt,
    exp: issuedAt + expiresIn,
    jti: text(jti)
  });
  const signature = hmac(secret, "member-signup-proof", payload);
  return `${MEMBER_SIGNUP_PROOF_TOKEN_PREFIX}.${payload}.${signature}`;
}

function verifyMemberSignupProofToken(token, { secret, nowMs = Date.now() } = {}) {
  assertMemberAuthSecret(secret);
  const parts = text(token).split(".");
  if (parts.length !== 3 || parts[0] !== MEMBER_SIGNUP_PROOF_TOKEN_PREFIX) {
    throw createMemberAuthError("휴대폰 인증을 다시 진행해 주세요.", 401, "member_signup_phone_proof_invalid");
  }
  const [, encoded, signature] = parts;
  if (!safeEqual(signature, hmac(secret, "member-signup-proof", encoded))) {
    throw createMemberAuthError("휴대폰 인증을 다시 진행해 주세요.", 401, "member_signup_phone_proof_invalid");
  }
  let payload;
  try {
    payload = decodeJson(encoded);
  } catch {
    throw createMemberAuthError("휴대폰 인증을 다시 진행해 주세요.", 401, "member_signup_phone_proof_invalid");
  }
  const nowSeconds = Math.floor(Number(nowMs) / 1000);
  if (
    payload.iss !== MEMBER_AUTH_ISSUER
    || payload.aud !== MEMBER_SIGNUP_PROOF_AUDIENCE
    || !/^gspc_[A-Za-z0-9_-]{16,}$/.test(text(payload.challengeId))
    || !text(payload.mobileHash)
    || !text(payload.jti)
    || !Number.isFinite(Number(payload.iat))
    || !Number.isFinite(Number(payload.exp))
    || Number(payload.iat) > nowSeconds + 30
    || Number(payload.exp) <= nowSeconds
    || Number(payload.exp) - Number(payload.iat) > 30 * 60
  ) {
    throw createMemberAuthError("휴대폰 인증이 만료되었습니다. 다시 인증해 주세요.", 401, "member_signup_phone_proof_invalid");
  }
  return Object.freeze({
    challengeId: text(payload.challengeId),
    mobileHash: text(payload.mobileHash),
    issuedAt: Number(payload.iat),
    expiresAt: Number(payload.exp),
    jti: text(payload.jti)
  });
}

function parseRefreshToken(token = "") {
  const parts = text(token).split(".");
  if (
    parts.length !== 3
    || parts[0] !== MEMBER_REFRESH_TOKEN_PREFIX
    || !/^gms_[A-Za-z0-9_-]{16,}$/.test(parts[1])
    || !/^[A-Za-z0-9_-]{32,}$/.test(parts[2])
  ) {
    throw createMemberAuthError("Invalid member session", 401, "member_session_invalid");
  }
  return { sessionId: parts[1], secretPart: parts[2] };
}

function isPreconditionError(error) {
  return Number(error?.code) === 412 || Number(error?.statusCode) === 412;
}

function isNotFoundError(error) {
  return Number(error?.code) === 404 || Number(error?.statusCode) === 404;
}

class GcsMemberAuthStore {
  constructor(bucket, options = {}) {
    if (!bucket || typeof bucket.file !== "function") throw new TypeError("A private GCS bucket is required");
    this.bucket = bucket;
    this.prefix = text(options.prefix || "member-auth/v1").replace(/^\/+|\/+$/g, "");
    this.maxMutationAttempts = Math.max(2, Math.min(12, Number(options.maxMutationAttempts || 8)));
  }

  objectName(relativePath) {
    const relative = text(relativePath).replace(/^\/+/, "");
    if (!relative || relative.includes("..")) throw new TypeError("Invalid member auth object path");
    return `${this.prefix}/${relative}`;
  }

  async readJson(relativePath) {
    const objectName = this.objectName(relativePath);
    const file = this.bucket.file(objectName);
    try {
      const [metadata] = await file.getMetadata();
      const generation = Number(metadata.generation || 0);
      const generationFile = generation
        ? this.bucket.file(objectName, { generation: String(generation) })
        : file;
      const [bytes] = await generationFile.download();
      return { exists: true, generation, value: JSON.parse(bytes.toString("utf8")) };
    } catch (error) {
      if (isNotFoundError(error)) return { exists: false, generation: 0, value: null };
      throw error;
    }
  }

  async saveJson(relativePath, value, generation = 0) {
    const file = this.bucket.file(this.objectName(relativePath));
    await file.save(Buffer.from(JSON.stringify(value), "utf8"), {
      resumable: false,
      validation: "crc32c",
      metadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "no-store, max-age=0"
      },
      preconditionOpts: { ifGenerationMatch: Number(generation || 0) }
    });
  }

  async createJson(relativePath, value) {
    await this.saveJson(relativePath, value, 0);
    return { value };
  }

  async deleteJson(relativePath) {
    const file = this.bucket.file(this.objectName(relativePath));
    try {
      await file.delete({ ignoreNotFound: true });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }

  async mutateJson(relativePath, updater) {
    for (let attempt = 0; attempt < this.maxMutationAttempts; attempt += 1) {
      const current = await this.readJson(relativePath);
      const decision = await updater(current.value, current);
      if (!decision || decision.write === false) {
        return { written: false, value: current.value, result: decision?.result };
      }
      try {
        await this.saveJson(relativePath, decision.value, current.generation);
        return { written: true, value: decision.value, result: decision.result };
      } catch (error) {
        if (isPreconditionError(error)) continue;
        throw error;
      }
    }
    throw createMemberAuthError("Member authentication state is busy", 409, "member_auth_state_conflict");
  }
}

class MemoryMemberAuthStore {
  constructor() {
    this.records = new Map();
  }

  async readJson(path) {
    if (!this.records.has(path)) return { exists: false, generation: 0, value: null };
    const record = this.records.get(path);
    return { exists: true, generation: record.generation, value: structuredClone(record.value) };
  }

  async createJson(path, value) {
    if (this.records.has(path)) {
      const error = new Error("precondition failed");
      error.code = 412;
      throw error;
    }
    this.records.set(path, { generation: 1, value: structuredClone(value) });
    return { value: structuredClone(value) };
  }

  async deleteJson(path) {
    this.records.delete(path);
  }

  async mutateJson(path, updater) {
    const current = await this.readJson(path);
    const decision = await updater(current.value, current);
    if (!decision || decision.write === false) {
      return { written: false, value: current.value, result: decision?.result };
    }
    const generation = current.generation + 1;
    this.records.set(path, { generation, value: structuredClone(decision.value) });
    return { written: true, value: structuredClone(decision.value), result: decision.result };
  }

  dump() {
    return new Map([...this.records.entries()].map(([key, value]) => [key, structuredClone(value.value)]));
  }
}

async function consumeRateLimit(store, path, options = {}) {
  const nowMs = Number(options.nowMs || Date.now());
  const windowMs = Math.max(1000, Number(options.windowMs || 60 * 60 * 1000));
  const maxCount = Math.max(1, Number(options.maxCount || 1));
  const minIntervalMs = Math.max(0, Number(options.minIntervalMs || 0));
  const mutation = await store.mutateJson(path, (current) => {
    const events = Array.isArray(current?.events)
      ? current.events.map(Number).filter((value) => Number.isFinite(value) && value > nowMs - windowMs)
      : [];
    const lastAt = events.length ? Math.max(...events) : 0;
    const retryForInterval = lastAt && nowMs - lastAt < minIntervalMs
      ? minIntervalMs - (nowMs - lastAt)
      : 0;
    const retryForWindow = events.length >= maxCount
      ? Math.max(1000, Math.min(...events) + windowMs - nowMs)
      : 0;
    const retryAfterMs = Math.max(retryForInterval, retryForWindow);
    if (retryAfterMs > 0) {
      return { write: false, result: { allowed: false, retryAfterMs } };
    }
    const nextEvents = [...events, nowMs];
    return {
      write: true,
      value: {
        schema: MEMBER_AUTH_SCHEMA,
        events: nextEvents,
        updatedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + windowMs).toISOString()
      },
      result: { allowed: true, retryAfterMs: 0 }
    };
  });
  return mutation.result;
}

function createMemberSmsAuthService(options = {}) {
  const secret = String(options.secret || "");
  const store = options.store;
  const lookupMemberExact = options.lookupMemberExact;
  const enqueueOtp = options.enqueueOtp;
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const sleep = typeof options.sleep === "function"
    ? options.sleep
    : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const signupMemberLookupRetryDelaysMs = Array.isArray(options.signupMemberLookupRetryDelaysMs)
    ? options.signupMemberLookupRetryDelaysMs.map(Number).filter((value) => Number.isFinite(value) && value >= 0)
    : [0, 500, 1000, 2000, 4000];
  const randomBytes = typeof options.randomBytes === "function" ? options.randomBytes : crypto.randomBytes;
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : crypto.randomInt;
  const otpTtlSeconds = Math.max(120, Math.min(600, Number(options.otpTtlSeconds || 180)));
  const signupOtpTtlSeconds = Math.max(120, Math.min(300, Number(options.signupOtpTtlSeconds || 180)));
  const signupProofTtlSeconds = Math.max(5 * 60, Math.min(30 * 60, Number(options.signupProofTtlSeconds || 15 * 60)));
  const accessTtlSeconds = Math.max(60, Math.min(300, Number(options.accessTtlSeconds || 300)));
  const sessionTtlSeconds = Math.max(15 * 60, Math.min(24 * 60 * 60, Number(options.sessionTtlSeconds || 24 * 60 * 60)));
  const maxOtpAttempts = Math.max(3, Math.min(10, Number(options.maxOtpAttempts || 5)));
  const resendCooldownMs = Math.max(30_000, Number(options.resendCooldownMs || 60_000));
  const memberHourlyLimit = Math.max(2, Number(options.memberHourlyLimit || 10));
  const clientHourlyLimit = Math.max(5, Number(options.clientHourlyLimit || 20));

  function assertReady() {
    assertMemberAuthSecret(secret);
    if (!store || typeof store.readJson !== "function" || typeof store.mutateJson !== "function") {
      throw createMemberAuthError("Member authentication storage is not configured", 503, "member_auth_store_not_configured");
    }
  }

  function fingerprint(purpose, value) {
    return hmac(secret, purpose, text(value));
  }

  function challengePath(challengeId) {
    return `challenges/${challengeId}.json`;
  }

  function signupChallengePath(challengeId) {
    return `signup-challenges/${challengeId}.json`;
  }

  function sessionPath(sessionId) {
    return `sessions/${sessionId}.json`;
  }

  async function assertStartRate(memberName, mobile, clientFingerprint, nowMs) {
    const identityHash = fingerprint("rate-identity", `${normalizeMemberAuthName(memberName)}|${mobile}`);
    const clientHash = fingerprint("rate-client", clientFingerprint || "unknown");
    const identityRate = await consumeRateLimit(store, `rates/identity/${identityHash}.json`, {
      nowMs,
      windowMs: 60 * 60 * 1000,
      maxCount: memberHourlyLimit,
      minIntervalMs: resendCooldownMs
    });
    if (!identityRate.allowed) {
      throw createMemberAuthError("잠시 후 인증번호를 다시 요청해 주세요.", 429, "member_otp_rate_limited", {
        retryAfterSeconds: Math.ceil(identityRate.retryAfterMs / 1000)
      });
    }
    const clientRate = await consumeRateLimit(store, `rates/client/${clientHash}.json`, {
      nowMs,
      windowMs: 60 * 60 * 1000,
      maxCount: clientHourlyLimit,
      minIntervalMs: 1000
    });
    if (!clientRate.allowed) {
      throw createMemberAuthError("잠시 후 인증번호를 다시 요청해 주세요.", 429, "member_otp_rate_limited", {
        retryAfterSeconds: Math.ceil(clientRate.retryAfterMs / 1000)
      });
    }
    return { identityHash, clientHash };
  }

  async function start(payload = {}, context = {}) {
    assertReady();
    if (typeof lookupMemberExact !== "function" || typeof enqueueOtp !== "function") {
      throw createMemberAuthError("Member authentication service is not configured", 503, "member_auth_not_configured");
    }
    const memberName = text(payload.memberName || payload.name);
    const mobile = normalizeMemberAuthPhone(payload.memberMobile || payload.mobile || payload.phone);
    const claimedMemberSeq = text(payload.memberSeq);
    const claimedMemberId = text(payload.memberId);
    const memberChannel = text(payload.memberChannel || "HOME").toUpperCase();
    if (memberChannel !== "HOME") {
      throw createMemberAuthError("현재는 일반 아이디 로그인 회원만 SMS 인증을 사용할 수 있습니다.", 400, "member_auth_channel_not_supported");
    }
    if (memberName.length < 2 || memberName.length > 50 || !isKoreanMobile(mobile)) {
      throw createMemberAuthError("회원정보를 확인해 주세요.", 400, "member_verification_failed");
    }
    if (claimedMemberSeq && !/^\d+$/.test(claimedMemberSeq)) {
      throw createMemberAuthError("회원정보를 확인해 주세요.", 400, "member_verification_failed");
    }
    const nowMs = now();
    const rate = await assertStartRate(memberName, mobile, context.clientFingerprint, nowMs);
    const lookup = await lookupMemberExact(memberName, mobile);
    const member = lookup?.member || null;
    const memberSeq = text(member?.custSeq);
    const memberId = text(member?.custId);
    const exactMatch = Boolean(
      lookup?.matchCount === 1
      && member
      && member.hasWebAccount !== false
      && /^\d+$/.test(memberSeq)
      && memberId
      && normalizeMemberAuthPhone(member.mobile) === mobile
      && (!claimedMemberSeq || claimedMemberSeq === memberSeq)
      && (!claimedMemberId || claimedMemberId.toLowerCase() === memberId.toLowerCase())
    );
    if (!exactMatch) {
      throw createMemberAuthError("회원정보를 확인해 주세요.", 400, "member_verification_failed");
    }

    const challengeId = randomId("gmc", 18, randomBytes);
    const otpCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAtMs = nowMs + otpTtlSeconds * 1000;
    const record = {
      schema: MEMBER_AUTH_SCHEMA,
      challengeId,
      status: "pending",
      memberSeq,
      memberId,
      memberKey: `seq:${memberSeq}`,
      memberChannel: "HOME",
      mobileHash: fingerprint("mobile", mobile),
      identityHash: rate.identityHash,
      clientHash: rate.clientHash,
      otpHash: hmac(secret, "member-otp", `${challengeId}|${otpCode}`),
      attemptCount: 0,
      maxAttempts: maxOtpAttempts,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      verifiedAt: "",
      sessionId: ""
    };
    await store.createJson(challengePath(challengeId), record);
    try {
      await enqueueOtp({
        challengeId,
        receiver: mobile,
        code: otpCode,
        expiresInMinutes: Math.ceil(otpTtlSeconds / 60)
      });
    } catch (error) {
      await store.mutateJson(challengePath(challengeId), (current) => ({
        write: true,
        value: {
          ...current,
          status: "dispatch_failed",
          updatedAt: new Date(now()).toISOString()
        }
      })).catch(() => {});
      throw createMemberAuthError("인증번호 발송을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, "member_otp_dispatch_failed");
    }
    return {
      ok: true,
      challengeId,
      expiresIn: otpTtlSeconds,
      resendAfter: Math.ceil(resendCooldownMs / 1000),
      destinationHint: maskMemberAuthPhone(mobile)
    };
  }

  async function signupStart(payload = {}, context = {}) {
    assertReady();
    if (typeof enqueueOtp !== "function") {
      throw createMemberAuthError("Member authentication service is not configured", 503, "member_auth_not_configured");
    }
    const mobile = normalizeMemberAuthPhone(payload.mobile || payload.memberMobile || payload.phone);
    if (!isKoreanMobile(mobile)) {
      throw createMemberAuthError("올바른 휴대폰번호를 입력해 주세요.", 400, "member_signup_phone_invalid");
    }
    const nowMs = now();
    const rate = await assertStartRate("signup", mobile, context.clientFingerprint, nowMs);
    const challengeId = randomId("gspc", 18, randomBytes);
    const otpCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAtMs = nowMs + signupOtpTtlSeconds * 1000;
    const record = {
      schema: MEMBER_AUTH_SCHEMA,
      purpose: "signup_phone",
      challengeId,
      status: "pending",
      mobileHash: fingerprint("mobile", mobile),
      identityHash: rate.identityHash,
      clientHash: rate.clientHash,
      otpHash: hmac(secret, "member-signup-otp", `${challengeId}|${otpCode}`),
      attemptCount: 0,
      maxAttempts: maxOtpAttempts,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      verifiedAt: "",
      proofJti: "",
      completedAt: "",
      sessionId: ""
    };
    await store.createJson(signupChallengePath(challengeId), record);
    try {
      await enqueueOtp({
        challengeId,
        receiver: mobile,
        code: otpCode,
        expiresInMinutes: Math.ceil(signupOtpTtlSeconds / 60)
      });
    } catch (error) {
      await store.mutateJson(signupChallengePath(challengeId), (current) => ({
        write: true,
        value: {
          ...current,
          status: "dispatch_failed",
          updatedAt: new Date(now()).toISOString()
        }
      })).catch(() => {});
      throw createMemberAuthError("인증번호 발송을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, "member_otp_dispatch_failed");
    }
    return {
      ok: true,
      challengeId,
      expiresIn: signupOtpTtlSeconds,
      resendAfter: Math.ceil(resendCooldownMs / 1000),
      destinationHint: maskMemberAuthPhone(mobile)
    };
  }

  function createSessionCandidate(member, nowMs, metadata = {}) {
    const sessionId = randomId("gms", 18, randomBytes);
    const refreshSecret = randomBytes(32).toString("base64url");
    const expiresAtMs = nowMs + sessionTtlSeconds * 1000;
    return {
      sessionId,
      refreshSecret,
      refreshToken: `${MEMBER_REFRESH_TOKEN_PREFIX}.${sessionId}.${refreshSecret}`,
      record: {
        schema: MEMBER_AUTH_SCHEMA,
        sessionId,
        status: "active",
        memberSeq: member.memberSeq,
        memberId: member.memberId,
        memberKey: `seq:${member.memberSeq}`,
        memberChannel: text(metadata.memberChannel || member.memberChannel || "HOME").toUpperCase(),
        authMethod: text(metadata.authMethod || "sms"),
        providerSubjectHash: text(metadata.providerSubjectHash),
        refreshHash: hmac(secret, "member-refresh", `${sessionId}|${refreshSecret}`),
        rotation: 0,
        createdAt: new Date(nowMs).toISOString(),
        updatedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
        revokedAt: ""
      }
    };
  }

  async function issueVerifiedSession(payload = {}) {
    assertReady();
    const memberSeq = text(payload.memberSeq);
    const memberId = text(payload.memberId);
    if (!/^\d+$/.test(memberSeq)) {
      throw createMemberAuthError("회원정보를 확인해 주세요.", 400, "member_verification_failed");
    }
    const nowMs = now();
    const candidate = createSessionCandidate({
      memberSeq,
      memberId,
      memberChannel: text(payload.memberChannel || "HOME").toUpperCase()
    }, nowMs, {
      memberChannel: text(payload.memberChannel || "HOME").toUpperCase(),
      authMethod: text(payload.authMethod || "verified_external"),
      providerSubjectHash: payload.providerSubject
        ? fingerprint("provider-subject", `${text(payload.authMethod)}|${text(payload.providerSubject)}`)
        : ""
    });
    await store.createJson(sessionPath(candidate.sessionId), candidate.record);
    return createTokenResponse(memberSeq, memberId, candidate.refreshToken, nowMs, Date.parse(candidate.record.expiresAt));
  }

  function createTokenResponse(memberSeq, memberId, refreshToken, nowMs, sessionExpiresAtMs = nowMs + sessionTtlSeconds * 1000) {
    return {
      ok: true,
      tokenType: "Bearer",
      accessToken: createMemberAccessToken({ secret, memberSeq, memberId, nowMs, ttlSeconds: accessTtlSeconds }),
      expiresIn: accessTtlSeconds,
      refreshToken,
      sessionExpiresIn: Math.max(0, Math.ceil((Number(sessionExpiresAtMs) - nowMs) / 1000)),
      memberKey: `seq:${memberSeq}`
    };
  }

  async function verify(payload = {}) {
    assertReady();
    const challengeId = text(payload.challengeId);
    const otpCode = text(payload.code || payload.otpCode).replace(/\D/g, "");
    if (!/^gmc_[A-Za-z0-9_-]{16,}$/.test(challengeId) || !/^\d{6}$/.test(otpCode)) {
      throw createMemberAuthError("인증번호를 확인해 주세요.", 400, "member_otp_invalid");
    }
    const nowMs = now();
    const current = await store.readJson(challengePath(challengeId));
    if (!current.exists || !current.value) {
      throw createMemberAuthError("인증 요청이 만료되었습니다.", 401, "member_otp_expired");
    }
    const candidate = createSessionCandidate({
      memberSeq: text(current.value.memberSeq),
      memberId: text(current.value.memberId)
    }, nowMs);
    await store.createJson(sessionPath(candidate.sessionId), candidate.record);

    let verification;
    try {
      verification = await store.mutateJson(challengePath(challengeId), (record) => {
        if (!record || record.status !== "pending") {
          return { write: false, result: { status: record?.status || "missing" } };
        }
        if (Date.parse(record.expiresAt || "") <= nowMs) {
          return {
            write: true,
            value: { ...record, status: "expired", updatedAt: new Date(nowMs).toISOString() },
            result: { status: "expired" }
          };
        }
        const attemptCount = Math.max(0, Number(record.attemptCount || 0));
        const maxAttempts = Math.max(1, Number(record.maxAttempts || maxOtpAttempts));
        if (attemptCount >= maxAttempts) {
          return {
            write: true,
            value: { ...record, status: "locked", updatedAt: new Date(nowMs).toISOString() },
            result: { status: "locked" }
          };
        }
        const valid = safeEqual(
          text(record.otpHash),
          hmac(secret, "member-otp", `${challengeId}|${otpCode}`)
        );
        if (!valid) {
          const nextAttempts = attemptCount + 1;
          const locked = nextAttempts >= maxAttempts;
          return {
            write: true,
            value: {
              ...record,
              status: locked ? "locked" : "pending",
              attemptCount: nextAttempts,
              updatedAt: new Date(nowMs).toISOString()
            },
            result: { status: locked ? "locked" : "invalid", attemptsRemaining: Math.max(0, maxAttempts - nextAttempts) }
          };
        }
        return {
          write: true,
          value: {
            ...record,
            status: "verified",
            attemptCount: attemptCount + 1,
            verifiedAt: new Date(nowMs).toISOString(),
            updatedAt: new Date(nowMs).toISOString(),
            sessionId: candidate.sessionId,
            otpHash: ""
          },
          result: { status: "verified", memberSeq: text(record.memberSeq) }
        };
      });
    } catch (error) {
      await store.deleteJson(sessionPath(candidate.sessionId)).catch(() => {});
      throw error;
    }

    if (verification.result?.status !== "verified") {
      await store.deleteJson(sessionPath(candidate.sessionId)).catch(() => {});
      if (verification.result?.status === "invalid") {
        throw createMemberAuthError("인증번호가 일치하지 않습니다.", 401, "member_otp_invalid", {
          attemptsRemaining: verification.result.attemptsRemaining
        });
      }
      if (verification.result?.status === "locked") {
        throw createMemberAuthError("인증번호 입력 횟수를 초과했습니다.", 429, "member_otp_locked");
      }
      throw createMemberAuthError("인증 요청이 만료되었거나 이미 사용되었습니다.", 401, "member_otp_expired");
    }
    return createTokenResponse(
      verification.result.memberSeq,
      candidate.record.memberId,
      candidate.refreshToken,
      nowMs,
      Date.parse(candidate.record.expiresAt)
    );
  }

  async function signupVerify(payload = {}) {
    assertReady();
    const challengeId = text(payload.challengeId);
    const otpCode = text(payload.code || payload.otpCode).replace(/\D/g, "");
    const mobile = normalizeMemberAuthPhone(payload.mobile || payload.memberMobile || payload.phone);
    if (!/^gspc_[A-Za-z0-9_-]{16,}$/.test(challengeId) || !/^\d{6}$/.test(otpCode) || !isKoreanMobile(mobile)) {
      throw createMemberAuthError("인증번호를 확인해 주세요.", 400, "member_otp_invalid");
    }
    const nowMs = now();
    const proofJti = randomId("gsp", 12, randomBytes);
    const expectedMobileHash = fingerprint("mobile", mobile);
    const mutation = await store.mutateJson(signupChallengePath(challengeId), (record) => {
      if (!record || record.purpose !== "signup_phone" || record.status !== "pending") {
        return { write: false, result: { status: record?.status || "missing" } };
      }
      if (!safeEqual(text(record.mobileHash), expectedMobileHash)) {
        return { write: false, result: { status: "mobile_mismatch" } };
      }
      if (Date.parse(record.expiresAt || "") <= nowMs) {
        return {
          write: true,
          value: { ...record, status: "expired", updatedAt: new Date(nowMs).toISOString() },
          result: { status: "expired" }
        };
      }
      const attemptCount = Math.max(0, Number(record.attemptCount || 0));
      const maxAttempts = Math.max(1, Number(record.maxAttempts || maxOtpAttempts));
      if (attemptCount >= maxAttempts) {
        return {
          write: true,
          value: { ...record, status: "locked", updatedAt: new Date(nowMs).toISOString() },
          result: { status: "locked" }
        };
      }
      const valid = safeEqual(
        text(record.otpHash),
        hmac(secret, "member-signup-otp", `${challengeId}|${otpCode}`)
      );
      if (!valid) {
        const nextAttempts = attemptCount + 1;
        const locked = nextAttempts >= maxAttempts;
        return {
          write: true,
          value: {
            ...record,
            status: locked ? "locked" : "pending",
            attemptCount: nextAttempts,
            updatedAt: new Date(nowMs).toISOString()
          },
          result: { status: locked ? "locked" : "invalid", attemptsRemaining: Math.max(0, maxAttempts - nextAttempts) }
        };
      }
      return {
        write: true,
        value: {
          ...record,
          status: "verified",
          attemptCount: attemptCount + 1,
          verifiedAt: new Date(nowMs).toISOString(),
          updatedAt: new Date(nowMs).toISOString(),
          proofJti,
          otpHash: ""
        },
        result: { status: "verified", mobileHash: text(record.mobileHash) }
      };
    });
    if (mutation.result?.status !== "verified") {
      if (mutation.result?.status === "invalid") {
        throw createMemberAuthError("인증번호가 일치하지 않습니다.", 401, "member_otp_invalid", {
          attemptsRemaining: mutation.result.attemptsRemaining
        });
      }
      if (mutation.result?.status === "locked") {
        throw createMemberAuthError("인증번호 입력 횟수를 초과했습니다.", 429, "member_otp_locked");
      }
      if (mutation.result?.status === "mobile_mismatch") {
        throw createMemberAuthError("휴대폰번호가 변경되었습니다. 다시 인증해 주세요.", 401, "member_signup_phone_mismatch");
      }
      throw createMemberAuthError("인증 요청이 만료되었거나 이미 사용되었습니다.", 401, "member_otp_expired");
    }
    const verificationToken = createMemberSignupProofToken({
      secret,
      challengeId,
      mobileHash: mutation.result.mobileHash,
      nowMs,
      ttlSeconds: signupProofTtlSeconds,
      jti: proofJti
    });
    return {
      ok: true,
      verified: true,
      verificationToken,
      verificationExpiresIn: signupProofTtlSeconds,
      destinationHint: maskMemberAuthPhone(mobile)
    };
  }

  async function assertSignupProofRecord(payload = {}) {
    const mobile = normalizeMemberAuthPhone(payload.mobile || payload.memberMobile || payload.phone);
    if (!isKoreanMobile(mobile)) {
      throw createMemberAuthError("휴대폰 인증을 다시 진행해 주세요.", 401, "member_signup_phone_proof_invalid");
    }
    const nowMs = now();
    const proof = verifyMemberSignupProofToken(payload.verificationToken, { secret, nowMs });
    const expectedMobileHash = fingerprint("mobile", mobile);
    if (!safeEqual(proof.mobileHash, expectedMobileHash)) {
      throw createMemberAuthError("휴대폰번호가 변경되었습니다. 다시 인증해 주세요.", 401, "member_signup_phone_mismatch");
    }
    const current = await store.readJson(signupChallengePath(proof.challengeId));
    const record = current.value;
    if (
      !current.exists
      || !record
      || record.purpose !== "signup_phone"
      || !["verified", "completed"].includes(record.status)
      || !safeEqual(text(record.mobileHash), proof.mobileHash)
      || !safeEqual(text(record.proofJti), proof.jti)
    ) {
      throw createMemberAuthError("휴대폰 인증을 다시 진행해 주세요.", 401, "member_signup_phone_proof_invalid");
    }
    return { mobile, proof, record, nowMs };
  }

  async function signupAssert(payload = {}) {
    assertReady();
    await assertSignupProofRecord(payload);
    return { ok: true, verified: true };
  }

  async function signupComplete(payload = {}) {
    assertReady();
    if (typeof lookupMemberExact !== "function") {
      throw createMemberAuthError("Member authentication service is not configured", 503, "member_auth_not_configured");
    }
    const checked = await assertSignupProofRecord(payload);
    const memberName = text(payload.memberName || payload.name);
    const claimedMemberSeq = text(payload.memberSeq);
    const claimedMemberId = text(payload.memberId);
    if (memberName.length < 2 || !/^\d+$/.test(claimedMemberSeq) || !claimedMemberId) {
      throw createMemberAuthError("회원정보를 확인해 주세요.", 400, "member_verification_failed");
    }
    let verifiedMember = null;
    const retryDelays = signupMemberLookupRetryDelaysMs.length
      ? signupMemberLookupRetryDelaysMs
      : [0];
    for (const delayMs of retryDelays) {
      if (delayMs > 0) await sleep(delayMs);
      const lookup = await lookupMemberExact(memberName, checked.mobile);
      const candidateMember = lookup?.member || null;
      const candidateMemberSeq = text(candidateMember?.custSeq);
      const candidateMemberId = text(candidateMember?.custId);
      const exactMatch = Boolean(
        lookup?.matchCount === 1
        && candidateMember
        && candidateMember.hasWebAccount !== false
        && candidateMemberSeq === claimedMemberSeq
        && candidateMemberId.toLowerCase() === claimedMemberId.toLowerCase()
        && normalizeMemberAuthPhone(candidateMember.mobile) === checked.mobile
      );
      if (exactMatch) {
        verifiedMember = candidateMember;
        break;
      }
    }
    if (!verifiedMember) {
      throw createMemberAuthError("회원정보를 확인해 주세요.", 400, "member_verification_failed");
    }
    const memberSeq = text(verifiedMember.custSeq);
    const memberId = text(verifiedMember.custId);
    const candidate = createSessionCandidate({ memberSeq, memberId }, checked.nowMs);
    await store.createJson(sessionPath(candidate.sessionId), candidate.record);
    let completion;
    try {
      completion = await store.mutateJson(signupChallengePath(checked.proof.challengeId), (record) => {
        if (
          !record
          || record.status !== "verified"
          || !safeEqual(text(record.mobileHash), checked.proof.mobileHash)
          || !safeEqual(text(record.proofJti), checked.proof.jti)
        ) {
          return { write: false, result: { completed: false } };
        }
        return {
          write: true,
          value: {
            ...record,
            status: "completed",
            completedAt: new Date(checked.nowMs).toISOString(),
            updatedAt: new Date(checked.nowMs).toISOString(),
            sessionId: candidate.sessionId
          },
          result: { completed: true }
        };
      });
    } catch (error) {
      await store.deleteJson(sessionPath(candidate.sessionId)).catch(() => {});
      throw error;
    }
    if (!completion.result?.completed) {
      await store.deleteJson(sessionPath(candidate.sessionId)).catch(() => {});
      throw createMemberAuthError("휴대폰 인증이 이미 사용되었거나 만료되었습니다.", 401, "member_signup_phone_proof_invalid");
    }
    return createTokenResponse(memberSeq, memberId, candidate.refreshToken, checked.nowMs, Date.parse(candidate.record.expiresAt));
  }

  async function refresh(payload = {}) {
    assertReady();
    const parsed = parseRefreshToken(payload.refreshToken);
    const nowMs = now();
    const nextSecret = randomBytes(32).toString("base64url");
    const nextRefreshToken = `${MEMBER_REFRESH_TOKEN_PREFIX}.${parsed.sessionId}.${nextSecret}`;
    const mutation = await store.mutateJson(sessionPath(parsed.sessionId), (record) => {
      if (
        !record
        || record.status !== "active"
        || Date.parse(record.expiresAt || "") <= nowMs
        || !safeEqual(record.refreshHash, hmac(secret, "member-refresh", `${parsed.sessionId}|${parsed.secretPart}`))
      ) {
        return { write: false, result: { valid: false } };
      }
      return {
        write: true,
        value: {
          ...record,
          refreshHash: hmac(secret, "member-refresh", `${parsed.sessionId}|${nextSecret}`),
          rotation: Math.max(0, Number(record.rotation || 0)) + 1,
          updatedAt: new Date(nowMs).toISOString()
        },
        result: {
          valid: true,
          memberSeq: text(record.memberSeq),
          memberId: text(record.memberId),
          sessionExpiresAtMs: Date.parse(record.expiresAt || "")
        }
      };
    });
    if (!mutation.result?.valid) {
      throw createMemberAuthError("회원 인증 세션이 만료되었습니다.", 401, "member_session_invalid");
    }
    return createTokenResponse(
      mutation.result.memberSeq,
      mutation.result.memberId,
      nextRefreshToken,
      nowMs,
      mutation.result.sessionExpiresAtMs
    );
  }

  async function revoke(payload = {}) {
    assertReady();
    const parsed = parseRefreshToken(payload.refreshToken);
    const nowMs = now();
    await store.mutateJson(sessionPath(parsed.sessionId), (record) => {
      if (!record) return { write: false, result: { revoked: true } };
      const valid = safeEqual(record.refreshHash, hmac(secret, "member-refresh", `${parsed.sessionId}|${parsed.secretPart}`));
      if (!valid) return { write: false, result: { revoked: true } };
      return {
        write: true,
        value: {
          ...record,
          status: "revoked",
          refreshHash: "",
          revokedAt: new Date(nowMs).toISOString(),
          updatedAt: new Date(nowMs).toISOString()
        },
        result: { revoked: true }
      };
    });
    return { ok: true, revoked: true };
  }

  return Object.freeze({
    start,
    verify,
    refresh,
    revoke,
    signupStart,
    signupVerify,
    signupAssert,
    signupComplete,
    issueVerifiedSession
  });
}

module.exports = {
  MEMBER_AUTH_ISSUER,
  MEMBER_AUTH_AUDIENCE,
  MEMBER_ACCESS_TOKEN_PREFIX,
  MEMBER_REFRESH_TOKEN_PREFIX,
  MEMBER_SIGNUP_PROOF_TOKEN_PREFIX,
  GcsMemberAuthStore,
  MemoryMemberAuthStore,
  normalizeMemberAuthPhone,
  maskMemberAuthPhone,
  createMemberAccessToken,
  verifyMemberAccessToken,
  createMemberSignupProofToken,
  verifyMemberSignupProofToken,
  createMemberSmsAuthService,
  consumeRateLimit
};
