"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const memberSource = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"),
  "utf8"
);
const serverSource = fs.readFileSync(
  path.join(ROOT, "server/google-sheet-proxy-function/index.js"),
  "utf8"
);

test("탈퇴 후 카카오 재가입은 브라우저 ERP 재확인 실패에도 서버에서 복구하고 프로필 저장 전에 인증 세션을 만든다", () => {
  assert.match(memberSource, /"member_kakao_signup_complete"/);
  const completionStart = memberSource.indexOf("async function submitJoinMemberProfileOnly");
  const completionEnd = memberSource.indexOf("async function submitJoinMemberSignup", completionStart);
  const completionSource = memberSource.slice(completionStart, completionEnd);
  assert.ok(completionStart >= 0 && completionEnd > completionStart);
  assert.doesNotMatch(completionSource, /getJoinKakaoErpMemberAfterSignup/);
  assert.match(
    completionSource,
    /const duplicateMessage = await checkJoinMemberKakaoSignupDuplicates\(data\);[\s\S]{0,1500}await finalizeJoinKakaoSignupAndContinue\([\s\S]{0,250}profilePayload/
  );
  assert.match(
    completionSource,
    /if \(\(result\?\.message \|\| ""\) !== "SUCCESS"\) \{[\s\S]{0,400}verifying on server/
  );
  assert.match(completionSource, /error\?\.endpoint === "\/member\/saveExternalMember\.json"/);
  assert.match(completionSource, /Kakao signup server recovery after ERP save response failed/);
});

test("ERP만 생성된 채 재접속해도 프로필 매핑 404를 ERP 신원 검증 세션으로 복구한다", () => {
  assert.match(
    memberSource,
    /postGolfJoinMemberAuthAction\("member_kakao_auth_exchange"[\s\S]{0,700}\[404, 409\]\.includes\(Number\(exchangeError\?\.status \|\| 0\)\)[\s\S]{0,4000}postGolfJoinMemberAuthAction\("member_kakao_signup_complete"/
  );
  assert.match(memberSource, /const renderedMember = parseJoinCookieData[\s\S]{0,100}const storedMember = getJoinSessionMember\(\)/);
  assert.match(memberSource, /storedMember\.memberSeq[\s\S]{0,220}renderedMember\.memberSeq[\s\S]{0,180}mergeJoinMemberIdentity\(storedMember, renderedMember\)/);
  assert.match(memberSource, /postJoinMemberLoginForm\([\s\S]{0,100}"\/member\/getMemberExternalLoginCheck\.json"/);
  assert.match(memberSource, /const erpDetail = await fetchJoinMemberDetail\(\)/);
  assert.match(memberSource, /const kakaoResponse = await requestJoinKakaoCurrentUser\(KakaoSdk\)/);
  assert.match(memberSource, /buildJoinErpMemberFromLoginResponse\(\{\}, kakaoResponse\)/);
  assert.match(
    memberSource,
    /recoveryMember = mergeJoinMemberIdentity\(\s*recoveryMember,\s*buildJoinErpMemberFromLoginResponse\(erpLoginResult/
  );
  assert.match(memberSource, /recoveryMember = mergeJoinMemberIdentity\(recoveryMember, \{ memberSeq \}\)/);
  assert.match(memberSource, /memberSeq: recoveryMember\.memberSeq \|\| memberSeq/);
  assert.match(memberSource, /memberName: recoveryMember\.memberName \|\| ""/);
  assert.match(memberSource, /memberMobile: recoveryMember\.memberMobile \|\| ""/);
});

test("카카오 재가입 복구는 ERP 응답이 비어도 user/me의 이름·연락처를 보완한다", () => {
  assert.match(memberSource, /memberName: memberName \|\| kakaoResponse\?\.kakao_account\?\.name \|\| ""/);
  assert.match(
    memberSource,
    /memberMobile: memberMobile \|\| normalizeJoinMemberPhone\(kakaoResponse\?\.kakao_account\?\.phone_number \|\| ""\)/
  );
  assert.match(memberSource, /function requestJoinKakaoCurrentUser\(KakaoSdk = window\.Kakao\)/);
});

test("카카오 재가입 완료 action은 독립 라우팅되고 private no-store로 처리된다", () => {
  assert.match(serverSource, /privateActions = new Set\(\[[\s\S]{0,700}"member_kakao_signup_complete"/);
  assert.match(serverSource, /standaloneActions = new Set\(\[[\s\S]{0,700}"member_kakao_signup_complete"/);
  assert.match(serverSource, /req\.query\?\.action === "member_kakao_signup_complete"/);
  assert.match(serverSource, /golfjoinMemberKakaoSignup\.complete\(readBody\(req\)\)/);
});

test("같은 카카오 식별자의 잔존 프로필은 새 행을 만들지 않고 재가입 회원번호로 갱신한다", () => {
  assert.match(serverSource, /function findKakaoRejoinProfileIndex\(rows = \[\], payload = \{\}\)/);
  assert.match(serverSource, /const kakaoRejoinProfileIndex = findKakaoRejoinProfileIndex\(rows, payload\)/);
  assert.match(
    serverSource,
    /temporaryProfileIndex >= 0 \? temporaryProfileIndex : kakaoRejoinProfileIndex/
  );
});
