"use strict";

const KAKAO_TOKEN_INFO_URL = "https://kapi.kakao.com/v1/user/access_token_info";
const KAKAO_USER_ME_URL = "https://kapi.kakao.com/v2/user/me";

function text(value) {
  return String(value == null ? "" : value).trim();
}

function createKakaoAuthError(message, status = 401, code = "member_kakao_auth_invalid") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeAccessToken(value) {
  const token = text(value);
  if (!/^[A-Za-z0-9._~-]{20,2048}$/.test(token)) {
    throw createKakaoAuthError("카카오 인증정보를 확인해 주세요.");
  }
  return token;
}

function normalizeAllowedAppIds(value) {
  const values = Array.isArray(value) ? value : text(value).split(",");
  return new Set(values.map((entry) => text(entry)).filter((entry) => /^\d+$/.test(entry)));
}

function normalizeMemberPhone(value) {
  let digits = text(value).replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("10")) digits = `0${digits}`;
  return digits;
}

function normalizeMemberName(value) {
  return text(value).replace(/\s+/g, "").toLowerCase();
}

async function readKakaoJson(fetchImpl, url, accessToken, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw createKakaoAuthError("카카오 인증정보가 만료되었습니다.", 401, "member_kakao_token_invalid");
    }
    return body;
  } catch (error) {
    if (error?.code) throw error;
    if (error?.name === "AbortError") {
      throw createKakaoAuthError("카카오 인증 확인 시간이 초과되었습니다.", 504, "member_kakao_auth_timeout");
    }
    throw createKakaoAuthError("카카오 인증을 확인하지 못했습니다.", 503, "member_kakao_auth_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

function createMemberKakaoAuthVerifier(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const allowedAppIds = normalizeAllowedAppIds(options.allowedAppIds);
  const timeoutMs = Math.max(1000, Math.min(15000, Number(options.timeoutMs || 5000)));

  async function verify(accessTokenValue) {
    if (typeof fetchImpl !== "function" || !allowedAppIds.size) {
      throw createKakaoAuthError("카카오 회원 인증이 설정되지 않았습니다.", 503, "member_kakao_auth_not_configured");
    }
    const accessToken = normalizeAccessToken(accessTokenValue);
    const [tokenInfo, user] = await Promise.all([
      readKakaoJson(fetchImpl, KAKAO_TOKEN_INFO_URL, accessToken, timeoutMs),
      readKakaoJson(fetchImpl, KAKAO_USER_ME_URL, accessToken, timeoutMs)
    ]);
    const kakaoId = text(tokenInfo.id);
    const appId = text(tokenInfo.app_id);
    if (!/^\d+$/.test(kakaoId) || !allowedAppIds.has(appId) || Number(tokenInfo.expires_in || 0) <= 0) {
      throw createKakaoAuthError("카카오 인증정보를 확인해 주세요.");
    }
    if (text(user.id) !== kakaoId) {
      throw createKakaoAuthError("카카오 회원정보가 일치하지 않습니다.", 401, "member_kakao_identity_mismatch");
    }
    return Object.freeze({ kakaoId, appId });
  }

  return Object.freeze({ verify });
}

function createMemberKakaoSignupCompleter(options = {}) {
  const verifyKakaoAccessToken = options.verifyKakaoAccessToken;
  const lookupMemberExact = options.lookupMemberExact;
  const persistVerifiedProfile = options.persistVerifiedProfile;
  const issueVerifiedSession = options.issueVerifiedSession;
  const sleep = typeof options.sleep === "function"
    ? options.sleep
    : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const retryDelaysMs = Array.isArray(options.retryDelaysMs)
    ? options.retryDelaysMs.map(Number).filter((value) => Number.isFinite(value) && value >= 0)
    : [0, 500, 1000, 2000, 3500];
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const recordMetrics = typeof options.recordMetrics === "function" ? options.recordMetrics : null;

  function reportMetrics(metrics = {}) {
    if (!recordMetrics) return;
    try {
      recordMetrics(Object.freeze({
        outcome: text(metrics.outcome) || "unknown",
        failedStage: text(metrics.failedStage),
        errorCode: text(metrics.errorCode),
        totalMs: Math.max(0, Number(metrics.totalMs || 0)),
        verifyMs: Math.max(0, Number(metrics.verifyMs || 0)),
        erpLookupMs: Math.max(0, Number(metrics.erpLookupMs || 0)),
        erpLookupAttempts: Math.max(0, Number(metrics.erpLookupAttempts || 0)),
        profilePersistMs: Math.max(0, Number(metrics.profilePersistMs || 0)),
        sessionIssueMs: Math.max(0, Number(metrics.sessionIssueMs || 0)),
        profileWrite: text(metrics.profileWrite),
        reconciliationState: text(metrics.reconciliationState)
      }));
    } catch (error) {
      // Metrics must never change the signup result.
    }
  }

  async function complete(payload = {}) {
    const metrics = {
      outcome: "error",
      failedStage: "configuration",
      errorCode: "",
      totalMs: 0,
      verifyMs: 0,
      erpLookupMs: 0,
      erpLookupAttempts: 0,
      profilePersistMs: 0,
      sessionIssueMs: 0,
      profileWrite: "",
      reconciliationState: ""
    };
    const startedAt = now();
    let stageStartedAt = startedAt;
    try {
    if (
      typeof verifyKakaoAccessToken !== "function"
      || typeof lookupMemberExact !== "function"
      || typeof issueVerifiedSession !== "function"
    ) {
      throw createKakaoAuthError(
        "카카오 회원 인증이 설정되지 않았습니다.",
        503,
        "member_kakao_signup_not_configured"
      );
    }

    metrics.failedStage = "kakao_verify";
    stageStartedAt = now();
    const verified = await verifyKakaoAccessToken(payload.kakaoAccessToken);
    metrics.verifyMs = now() - stageStartedAt;
    metrics.failedStage = "payload_validation";
    const memberSeq = text(payload.memberSeq);
    const claimedMemberId = text(payload.memberId);
    const memberName = text(payload.memberName || payload.name);
    const memberMobile = normalizeMemberPhone(payload.memberMobile || payload.mobile || payload.phone);
    if (
      (memberSeq && !/^\d+$/.test(memberSeq))
      || memberName.length < 2
      || !/^01\d{8,9}$/.test(memberMobile)
      || (claimedMemberId && claimedMemberId !== verified.kakaoId)
    ) {
      throw createKakaoAuthError("회원정보를 확인해 주세요.", 400, "member_verification_failed");
    }

    let matchedMember = null;
    metrics.failedStage = "erp_lookup";
    stageStartedAt = now();
    for (const delayMs of (retryDelaysMs.length ? retryDelaysMs : [0])) {
      if (delayMs > 0) await sleep(delayMs);
      metrics.erpLookupAttempts += 1;
      const lookup = await lookupMemberExact(memberName, memberMobile);
      const candidate = lookup?.member || null;
      const exactMatch = Boolean(
        lookup?.matchCount === 1
        && candidate
        && candidate.hasWebAccount !== false
        && (!memberSeq || text(candidate.custSeq) === memberSeq)
        && text(candidate.custId) === verified.kakaoId
        && normalizeMemberName(candidate.memberName) === normalizeMemberName(memberName)
        && normalizeMemberPhone(candidate.mobile) === memberMobile
      );
      if (exactMatch) {
        matchedMember = candidate;
        break;
      }
    }
    metrics.erpLookupMs = now() - stageStartedAt;
    if (!matchedMember) {
      throw createKakaoAuthError("회원정보를 확인해 주세요.", 400, "member_verification_failed");
    }

    const verifiedMember = {
      memberSeq: text(matchedMember.custSeq),
      memberId: text(matchedMember.custId),
      authMethod: "kakao",
      providerSubject: verified.kakaoId
    };
    metrics.failedStage = "profile_persist";
    stageStartedAt = now();
    const persistedProfile = typeof persistVerifiedProfile === "function"
      ? await persistVerifiedProfile({
          payload,
          verified,
          member: matchedMember,
          verifiedMember
        })
      : null;
    metrics.profilePersistMs = now() - stageStartedAt;
    metrics.profileWrite = text(persistedProfile?.write);
    metrics.reconciliationState = text(persistedProfile?.reconciliationState);
    metrics.failedStage = "session_issue";
    stageStartedAt = now();
    const session = await issueVerifiedSession(verifiedMember);
    metrics.sessionIssueMs = now() - stageStartedAt;
    const member = {
      memberSeq: text(matchedMember.custSeq),
      memberId: text(matchedMember.custId),
      memberName: text(matchedMember.memberName),
      memberChannel: "KAKAO",
      memberMobile: normalizeMemberPhone(matchedMember.mobile),
      kakaoId: verified.kakaoId
    };
    const result = persistedProfile
      ? { ...session, member, profile: persistedProfile }
      : { ...session, member };
    metrics.outcome = "success";
    metrics.failedStage = "";
    metrics.totalMs = now() - startedAt;
    reportMetrics(metrics);
    return result;
    } catch (error) {
      if (metrics.failedStage === "kakao_verify" && metrics.verifyMs === 0) {
        metrics.verifyMs = now() - stageStartedAt;
      } else if (metrics.failedStage === "erp_lookup" && metrics.erpLookupMs === 0) {
        metrics.erpLookupMs = now() - stageStartedAt;
      } else if (metrics.failedStage === "profile_persist" && metrics.profilePersistMs === 0) {
        metrics.profilePersistMs = now() - stageStartedAt;
      } else if (metrics.failedStage === "session_issue" && metrics.sessionIssueMs === 0) {
        metrics.sessionIssueMs = now() - stageStartedAt;
      }
      metrics.errorCode = text(error?.code) || "unknown_error";
      metrics.totalMs = now() - startedAt;
      reportMetrics(metrics);
      throw error;
    }
  }

  return Object.freeze({ complete });
}

module.exports = {
  KAKAO_TOKEN_INFO_URL,
  KAKAO_USER_ME_URL,
  normalizeAccessToken,
  normalizeAllowedAppIds,
  createMemberKakaoAuthVerifier,
  createMemberKakaoSignupCompleter
};
