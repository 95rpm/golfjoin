"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  KAKAO_TOKEN_INFO_URL,
  KAKAO_USER_ME_URL,
  createMemberKakaoAuthVerifier,
  createMemberKakaoSignupCompleter
} = require("./member-kakao-auth");

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("Kakao verifier accepts only the configured app and matching user identity", async () => {
  const calls = [];
  const verifier = createMemberKakaoAuthVerifier({
    allowedAppIds: "12345",
    fetchImpl: async (url, options) => {
      calls.push({ url, authorization: options.headers.Authorization });
      if (url === KAKAO_TOKEN_INFO_URL) return jsonResponse({ id: 2783624471, app_id: 12345, expires_in: 3600 });
      if (url === KAKAO_USER_ME_URL) return jsonResponse({ id: 2783624471 });
      return jsonResponse({}, 404);
    }
  });
  const verified = await verifier.verify("valid-kakao-access-token_1234567890");
  assert.deepEqual(verified, { kakaoId: "2783624471", appId: "12345" });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.authorization === "Bearer valid-kakao-access-token_1234567890"));
});

test("Kakao verifier checks token-info and user/me concurrently", async () => {
  const started = [];
  let releaseRequests;
  const requestsReady = new Promise((resolve) => { releaseRequests = resolve; });
  const verifier = createMemberKakaoAuthVerifier({
    allowedAppIds: "12345",
    fetchImpl: async (url) => {
      started.push(url);
      if (started.length === 2) releaseRequests();
      await requestsReady;
      return url === KAKAO_TOKEN_INFO_URL
        ? jsonResponse({ id: 2783624471, app_id: 12345, expires_in: 3600 })
        : jsonResponse({ id: 2783624471 });
    }
  });
  const verified = await verifier.verify("valid-kakao-access-token_1234567890");
  assert.deepEqual(new Set(started), new Set([KAKAO_TOKEN_INFO_URL, KAKAO_USER_ME_URL]));
  assert.equal(verified.kakaoId, "2783624471");
});

test("Kakao verifier rejects tokens issued for another application", async () => {
  const verifier = createMemberKakaoAuthVerifier({
    allowedAppIds: "12345",
    fetchImpl: async () => jsonResponse({ id: 2783624471, app_id: 99999, expires_in: 3600 })
  });
  await assert.rejects(
    verifier.verify("valid-kakao-access-token_1234567890"),
    (error) => error.status === 401 && error.code === "member_kakao_auth_invalid"
  );
});

test("Kakao verifier rejects mismatched token-info and user/me identities", async () => {
  let call = 0;
  const verifier = createMemberKakaoAuthVerifier({
    allowedAppIds: "12345",
    fetchImpl: async () => (++call === 1
      ? jsonResponse({ id: 2783624471, app_id: 12345, expires_in: 3600 })
      : jsonResponse({ id: 2841862918 }))
  });
  await assert.rejects(
    verifier.verify("valid-kakao-access-token_1234567890"),
    (error) => error.status === 401 && error.code === "member_kakao_identity_mismatch"
  );
});

test("Kakao verifier never includes the access token in an upstream failure", async () => {
  const token = "valid-kakao-access-token_1234567890";
  const verifier = createMemberKakaoAuthVerifier({
    allowedAppIds: "12345",
    fetchImpl: async () => { throw new Error(`network ${token}`); }
  });
  await assert.rejects(verifier.verify(token), (error) => {
    assert.equal(error.code, "member_kakao_auth_unavailable");
    assert.equal(error.message.includes(token), false);
    return true;
  });
});

test("Kakao signup completion verifies the recreated ERP member before issuing a session", async () => {
  let lookupCount = 0;
  let issuedMember = null;
  const completer = createMemberKakaoSignupCompleter({
    verifyKakaoAccessToken: async () => ({ kakaoId: "2783624471", appId: "12345" }),
    lookupMemberExact: async () => {
      lookupCount += 1;
      if (lookupCount === 1) return { matchCount: 0, member: null };
      return {
        matchCount: 1,
        member: {
          custSeq: "30002183",
          custId: "2783624471",
          memberName: "전 규호",
          mobile: "01012346845",
          hasWebAccount: true
        }
      };
    },
    issueVerifiedSession: async (member) => {
      issuedMember = member;
      return { accessToken: "access", refreshToken: "refresh", memberKey: `seq:${member.memberSeq}` };
    },
    retryDelaysMs: [0, 1],
    sleep: async () => {}
  });
  const result = await completer.complete({
    kakaoAccessToken: "valid-kakao-access-token_1234567890",
    memberSeq: "30002183",
    memberId: "2783624471",
    memberName: "전규호",
    memberMobile: "010-1234-6845"
  });
  assert.equal(lookupCount, 2);
  assert.deepEqual(issuedMember, {
    memberSeq: "30002183",
    memberId: "2783624471",
    authMethod: "kakao",
    providerSubject: "2783624471"
  });
  assert.equal(result.memberKey, "seq:30002183");
  assert.equal(result.member.memberSeq, "30002183");
});

test("Kakao signup completion derives memberSeq when the browser ERP recheck cannot provide it", async () => {
  const completer = createMemberKakaoSignupCompleter({
    verifyKakaoAccessToken: async () => ({ kakaoId: "2783624471", appId: "12345" }),
    lookupMemberExact: async () => ({
      matchCount: 1,
      member: {
        custSeq: "30002183",
        custId: "2783624471",
        memberName: "전규호",
        mobile: "01012346845",
        hasWebAccount: true
      }
    }),
    persistVerifiedProfile: async ({ verifiedMember }) => ({
      profileId: `jmp_member-${verifiedMember.memberSeq}`,
      profileStatus: "active"
    }),
    issueVerifiedSession: async (member) => ({
      accessToken: "access",
      refreshToken: "refresh",
      memberKey: `seq:${member.memberSeq}`
    }),
    retryDelaysMs: [0]
  });
  const result = await completer.complete({
    kakaoAccessToken: "valid-kakao-access-token_1234567890",
    memberSeq: "",
    memberId: "2783624471",
    memberName: "전규호",
    memberMobile: "01012346845",
    profilePayload: { profile: { birthDate: "19630102" } }
  });
  assert.equal(result.memberKey, "seq:30002183");
  assert.deepEqual(result.member, {
    memberSeq: "30002183",
    memberId: "2783624471",
    memberName: "전규호",
    memberChannel: "KAKAO",
    memberMobile: "01012346845",
    kakaoId: "2783624471"
  });
  assert.equal(result.profile.profileId, "jmp_member-30002183");
});

test("Kakao signup completion rejects a different ERP identity", async () => {
  let sessionIssued = false;
  const completer = createMemberKakaoSignupCompleter({
    verifyKakaoAccessToken: async () => ({ kakaoId: "2783624471", appId: "12345" }),
    lookupMemberExact: async () => ({
      matchCount: 1,
      member: {
        custSeq: "99999999",
        custId: "2783624471",
        memberName: "전규호",
        mobile: "01012346845",
        hasWebAccount: true
      }
    }),
    issueVerifiedSession: async () => { sessionIssued = true; },
    retryDelaysMs: [0]
  });
  await assert.rejects(
    completer.complete({
      kakaoAccessToken: "valid-kakao-access-token_1234567890",
      memberSeq: "30002183",
      memberId: "2783624471",
      memberName: "전규호",
      memberMobile: "01012346845"
    }),
    (error) => error.status === 400 && error.code === "member_verification_failed"
  );
  assert.equal(sessionIssued, false);
});

test("Kakao signup completion binds the ERP login to the verified Kakao subject", async () => {
  let lookupCalled = false;
  const completer = createMemberKakaoSignupCompleter({
    verifyKakaoAccessToken: async () => ({ kakaoId: "2783624471", appId: "12345" }),
    lookupMemberExact: async () => { lookupCalled = true; },
    issueVerifiedSession: async () => ({}),
    retryDelaysMs: [0]
  });
  await assert.rejects(
    completer.complete({
      kakaoAccessToken: "valid-kakao-access-token_1234567890",
      memberSeq: "30002183",
      memberId: "2841862918",
      memberName: "전규호",
      memberMobile: "01012346845"
    }),
    (error) => error.status === 400 && error.code === "member_verification_failed"
  );
  assert.equal(lookupCalled, false);
});

test("Kakao signup completion persists the verified profile before issuing the member session", async () => {
  const order = [];
  const completer = createMemberKakaoSignupCompleter({
    verifyKakaoAccessToken: async () => ({ kakaoId: "2783624471", appId: "12345" }),
    lookupMemberExact: async () => ({
      matchCount: 1,
      member: {
        custSeq: "30002183",
        custId: "2783624471",
        memberName: "전규호",
        mobile: "01012346845",
        hasWebAccount: true
      }
    }),
    persistVerifiedProfile: async ({ verifiedMember, payload }) => {
      order.push("profile");
      assert.equal(verifiedMember.memberSeq, "30002183");
      assert.equal(payload.profilePayload.profile.birthDate, "19630102");
      return { profileId: "jmp_member-30002183", profileStatus: "active", write: "append" };
    },
    issueVerifiedSession: async () => {
      order.push("session");
      return { accessToken: "access", refreshToken: "refresh", memberKey: "seq:30002183" };
    },
    retryDelaysMs: [0]
  });
  const result = await completer.complete({
    kakaoAccessToken: "valid-kakao-access-token_1234567890",
    memberSeq: "30002183",
    memberId: "2783624471",
    memberName: "전규호",
    memberMobile: "01012346845",
    profilePayload: { profile: { birthDate: "19630102" } }
  });
  assert.deepEqual(order, ["profile", "session"]);
  assert.equal(result.profile.profileId, "jmp_member-30002183");
});

test("Kakao signup completion never issues a session when profile persistence fails", async () => {
  let sessionIssued = false;
  const completer = createMemberKakaoSignupCompleter({
    verifyKakaoAccessToken: async () => ({ kakaoId: "2783624471", appId: "12345" }),
    lookupMemberExact: async () => ({
      matchCount: 1,
      member: {
        custSeq: "30002183",
        custId: "2783624471",
        memberName: "전규호",
        mobile: "01012346845",
        hasWebAccount: true
      }
    }),
    persistVerifiedProfile: async () => {
      const error = new Error("sheet unavailable");
      error.code = "member_kakao_profile_store_unavailable";
      throw error;
    },
    issueVerifiedSession: async () => {
      sessionIssued = true;
      return {};
    },
    retryDelaysMs: [0]
  });
  await assert.rejects(
    completer.complete({
      kakaoAccessToken: "valid-kakao-access-token_1234567890",
      memberSeq: "30002183",
      memberId: "2783624471",
      memberName: "전규호",
      memberMobile: "01012346845"
    }),
    (error) => error.code === "member_kakao_profile_store_unavailable"
  );
  assert.equal(sessionIssued, false);
});

test("Kakao signup completion records PII-free stage metrics without changing the result", async () => {
  const recorded = [];
  const completer = createMemberKakaoSignupCompleter({
    verifyKakaoAccessToken: async () => ({ kakaoId: "2783624471", appId: "12345" }),
    lookupMemberExact: async () => ({
      matchCount: 1,
      member: {
        custSeq: "30002183",
        custId: "2783624471",
        memberName: "전규호",
        mobile: "01012346845",
        hasWebAccount: true
      }
    }),
    persistVerifiedProfile: async () => ({
      profileId: "jmp_member-30002183",
      write: "update",
      reconciliationState: "pending"
    }),
    issueVerifiedSession: async () => ({ memberKey: "seq:30002183" }),
    retryDelaysMs: [0],
    recordMetrics: (metrics) => recorded.push(metrics)
  });
  const result = await completer.complete({
    kakaoAccessToken: "valid-kakao-access-token_1234567890",
    memberId: "2783624471",
    memberName: "전규호",
    memberMobile: "01012346845"
  });
  assert.equal(result.memberKey, "seq:30002183");
  assert.equal(recorded.length, 1);
  assert.deepEqual(recorded[0], {
    outcome: "success",
    failedStage: "",
    errorCode: "",
    totalMs: recorded[0].totalMs,
    verifyMs: recorded[0].verifyMs,
    erpLookupMs: recorded[0].erpLookupMs,
    erpLookupAttempts: 1,
    profilePersistMs: recorded[0].profilePersistMs,
    sessionIssueMs: recorded[0].sessionIssueMs,
    profileWrite: "update",
    reconciliationState: "pending"
  });
  assert.equal(JSON.stringify(recorded[0]).includes("2783624471"), false);
  assert.equal(JSON.stringify(recorded[0]).includes("01012346845"), false);
  assert.equal(JSON.stringify(recorded[0]).includes("전규호"), false);
});
