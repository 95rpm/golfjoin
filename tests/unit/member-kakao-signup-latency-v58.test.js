"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const memberSource = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"),
  "utf8"
);
const kakaoAuthSource = fs.readFileSync(
  path.join(ROOT, "server/google-sheet-proxy-function/member-kakao-auth.js"),
  "utf8"
);
const indexSource = fs.readFileSync(
  path.join(ROOT, "server/google-sheet-proxy-function/index.js"),
  "utf8"
);

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `source range missing: ${startToken}`);
  return source.slice(start, end);
}

test("v58a 카카오 중복 확인은 병렬 실행하고 메시지 우선순위는 ID·휴대폰·이메일 순서를 유지한다", () => {
  const source = sourceBetween(
    memberSource,
    "async function checkJoinMemberKakaoSignupDuplicates",
    "function buildJoinMemberKakaoSignupData"
  );
  assert.match(source, /Promise\.allSettled\(\[/);
  assert.match(source, /if \(result\?\.status === "rejected"\) throw result\.reason/);
  const idIndex = source.indexOf('lastSignupDuplicateField = "id"');
  const mobileIndex = source.indexOf('lastSignupDuplicateField = "mobile"');
  const emailIndex = source.indexOf('lastSignupDuplicateField = "email"');
  assert.ok(idIndex >= 0 && mobileIndex > idIndex && emailIndex > mobileIndex);
});

test("v58a 병렬 중복 확인은 하위 검사 실패가 있어도 이미 확인된 상위 중복을 우선한다", async () => {
  const source = sourceBetween(
    memberSource,
    "async function checkJoinMemberKakaoSignupDuplicates",
    "function buildJoinMemberKakaoSignupData"
  );
  const started = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const context = {
    joinMyMenuState: {},
    Promise,
    Number,
    postJoinMemberForm: async (endpoint) => {
      started.push(endpoint);
      await gate;
      if (endpoint.includes("Email")) throw Object.assign(new Error("email unavailable"), { code: "email_unavailable" });
      return { count: endpoint.includes("IdCheck") ? 1 : 0 };
    },
    getJoinMemberSignupDuplicateMessage: (field) => `duplicate:${field}`
  };
  vm.runInNewContext(`${source};this.checkJoinMemberKakaoSignupDuplicates=checkJoinMemberKakaoSignupDuplicates;`, context);
  const pending = context.checkJoinMemberKakaoSignupDuplicates({
    custId: "kakao-id",
    mobile1: "010",
    mobile2: "1234",
    mobile3: "5678",
    email: "test@example.com"
  });
  await Promise.resolve();
  assert.equal(started.length, 3);
  release();
  assert.equal(await pending, "duplicate:id");
  assert.equal(context.joinMyMenuState.lastSignupDuplicateField, "id");
});

test("v58a 마지막 클릭 경로는 브라우저 ERP 앞·뒤 재조회를 제거하고 서버 확정을 유지한다", () => {
  const source = sourceBetween(
    memberSource,
    "async function submitJoinMemberProfileOnly",
    "async function submitJoinMemberSignup"
  );
  assert.doesNotMatch(source, /getJoinKakaoErpMemberAfterSignup/);
  assert.match(source, /"\/member\/saveExternalMember\.json"/);
  assert.match(source, /await finalizeJoinKakaoSignupAndContinue/);
  assert.match(source, /error\?\.endpoint === "\/member\/saveExternalMember\.json"/);
});

test("v58a 마지막 처리 단계는 진행 상태를 구체적으로 안내한다", () => {
  for (const message of [
    "가입정보를 확인하고 있어요.",
    "회원정보를 생성하고 있어요.",
    "로그인을 연결하고 있어요."
  ]) {
    assert.match(memberSource, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("v58a 서버는 카카오 두 검증 요청을 병렬화하고 PII 없는 단계 지표만 기록한다", () => {
  assert.match(kakaoAuthSource, /Promise\.all\(\[[\s\S]{0,300}KAKAO_TOKEN_INFO_URL[\s\S]{0,300}KAKAO_USER_ME_URL/);
  assert.match(kakaoAuthSource, /erpLookupAttempts/);
  assert.match(kakaoAuthSource, /profilePersistMs/);
  assert.match(kakaoAuthSource, /sessionIssueMs/);
  assert.doesNotMatch(
    sourceBetween(kakaoAuthSource, "function reportMetrics", "async function complete"),
    /memberId|memberName|memberMobile|kakaoId|accessToken/
  );
  assert.match(indexSource, /console\.info\("golfjoin_kakao_signup_completion", metrics\)/);
});

test("v58a 서버는 프로필 영구 저장 후에만 세션을 발급한다", () => {
  const persistIndex = kakaoAuthSource.indexOf("await persistVerifiedProfile");
  const sessionIndex = kakaoAuthSource.indexOf("await issueVerifiedSession", persistIndex);
  assert.ok(persistIndex >= 0 && sessionIndex > persistIndex);
});
