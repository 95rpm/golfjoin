"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemberKakaoSignupCompleter } = require("./member-kakao-auth");

const signupPayload = {
  kakaoAccessToken: "valid-kakao-access-token_1234567890",
  memberSeq: "",
  memberId: "9988776655",
  memberName: "신규회원",
  memberMobile: "01098765432",
  profilePayload: {
    member: {
      memberId: "9988776655",
      memberName: "신규회원",
      memberChannel: "KAKAO",
      memberMobile: "01098765432",
      memberEmail: "new@example.com"
    },
    profile: {
      birthYear: "1988",
      birthDate: "19880517",
      gender: "여성",
      profession: "회사원",
      level: "입문·초보입니다",
      travelStyles: ["친목중심"],
      requiredAgreed: true,
      marketingAgreed: false,
      termsAgreedAt: "2026-08-31T10:00:00+09:00"
    },
    kakao: {
      kakaoId: "9988776655",
      nickname: "신규"
    }
  }
};

function createSimulation(options = {}) {
  let erpCreateCount = 0;
  let lookupCount = 0;
  let profileWriteCount = 0;
  let sessionIssueCount = 0;
  let failNextProfileWrite = Boolean(options.failFirstProfileWrite);
  const erp = new Map();
  const profiles = new Map();

  const createErpMember = () => {
    erpCreateCount += 1;
    erp.set("30009999", {
      custSeq: "30009999",
      custId: "9988776655",
      memberName: "신규회원",
      mobile: "01098765432",
      hasWebAccount: true
    });
  };
  const completer = createMemberKakaoSignupCompleter({
    verifyKakaoAccessToken: async () => ({ kakaoId: "9988776655", appId: "906676" }),
    lookupMemberExact: async () => {
      lookupCount += 1;
      if (lookupCount < 3) return { matchCount: 0, member: null };
      return { matchCount: 1, member: erp.get("30009999") };
    },
    persistVerifiedProfile: async ({ verifiedMember, payload }) => {
      profileWriteCount += 1;
      if (failNextProfileWrite) {
        failNextProfileWrite = false;
        const error = new Error("temporary Sheet failure");
        error.code = "member_kakao_profile_store_unavailable";
        throw error;
      }
      profiles.set(verifiedMember.memberSeq, {
        memberSeq: verifiedMember.memberSeq,
        memberId: verifiedMember.memberId,
        ...payload.profilePayload.profile
      });
      return {
        profileId: `jmp_member-${verifiedMember.memberSeq}`,
        profileStatus: "active",
        write: profiles.size === 1 && profileWriteCount === 1 ? "append" : "update"
      };
    },
    issueVerifiedSession: async (member) => {
      sessionIssueCount += 1;
      assert.ok(profiles.has(member.memberSeq), "프로필 저장 전에 세션을 발급하면 안 됩니다.");
      return {
        accessToken: `access-${sessionIssueCount}`,
        refreshToken: `refresh-${sessionIssueCount}`,
        memberKey: `seq:${member.memberSeq}`
      };
    },
    retryDelaysMs: [0, 1, 2],
    sleep: async () => {}
  });

  return {
    createErpMember,
    complete: () => completer.complete(signupPayload),
    snapshot: () => ({
      erpCreateCount,
      lookupCount,
      profileWriteCount,
      sessionIssueCount,
      erpCount: erp.size,
      profileCount: profiles.size,
      profile: profiles.get("30009999")
    })
  };
}

test("ERP 미가입 신규 카카오 회원은 ERP 1건·Sheet 프로필 1건·인증 세션으로 완료된다", async () => {
  const simulation = createSimulation();
  simulation.createErpMember();
  const result = await simulation.complete();
  const state = simulation.snapshot();
  assert.equal(result.memberKey, "seq:30009999");
  assert.equal(result.member.memberSeq, "30009999");
  assert.equal(result.profile.profileStatus, "active");
  assert.equal(state.erpCreateCount, 1);
  assert.equal(state.erpCount, 1);
  assert.equal(state.profileCount, 1);
  assert.equal(state.sessionIssueCount, 1);
  assert.equal(state.profile.birthDate, "19880517");
  assert.equal(state.profile.gender, "여성");
});

test("ERP 생성 후 첫 Sheet 저장이 실패해도 ERP를 재생성하지 않고 같은 프로필로 재개한다", async () => {
  const simulation = createSimulation({ failFirstProfileWrite: true });
  simulation.createErpMember();
  await assert.rejects(
    simulation.complete(),
    (error) => error.code === "member_kakao_profile_store_unavailable"
  );
  let state = simulation.snapshot();
  assert.equal(state.erpCreateCount, 1);
  assert.equal(state.erpCount, 1);
  assert.equal(state.profileCount, 0);
  assert.equal(state.sessionIssueCount, 0);

  const result = await simulation.complete();
  state = simulation.snapshot();
  assert.equal(result.memberKey, "seq:30009999");
  assert.equal(state.erpCreateCount, 1);
  assert.equal(state.erpCount, 1);
  assert.equal(state.profileCount, 1);
  assert.equal(state.sessionIssueCount, 1);
});

test("동일 최종 확정 요청을 다시 보내도 Sheet 프로필은 한 행으로 유지된다", async () => {
  const simulation = createSimulation();
  simulation.createErpMember();
  await simulation.complete();
  await simulation.complete();
  const state = simulation.snapshot();
  assert.equal(state.erpCreateCount, 1);
  assert.equal(state.erpCount, 1);
  assert.equal(state.profileCount, 1);
  assert.equal(state.sessionIssueCount, 2);
});
