"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const memberSource = fs.readFileSync(
  path.join(root, "src", "golfjoin-main", "source", "scripts", "member", "34-member-auth-profile-wishes.js"),
  "utf8"
);
const indexSource = fs.readFileSync(
  path.join(root, "server", "google-sheet-proxy-function", "index.js"),
  "utf8"
);
const kakaoAuthSource = fs.readFileSync(
  path.join(root, "server", "google-sheet-proxy-function", "member-kakao-auth.js"),
  "utf8"
);

test("신규 카카오 가입 완료 요청은 추가정보 전체를 서버 최종 확정 API에 포함한다", () => {
  assert.match(
    memberSource,
    /const profilePayload = buildJoinMemberProfilePayload\(getJoinMemberFromKakaoSignupData\(data\)\);[\s\S]{0,300}rememberJoinPendingKakaoSignupDraft\(profilePayload\)/
  );
  assert.match(
    memberSource,
    /finalizeJoinKakaoSignupAndContinue\([\s\S]{0,200}profilePayload/
  );
  assert.match(
    memberSource,
    /memberMobile: data\.mobile \|\| erpMember\.memberMobile \|\| "",[\s\S]{0,100}\{ profilePayload \}/
  );
  assert.match(memberSource, /\{ timeoutMs: 60000 \}/);
});

test("신규 카카오 가입은 서버 프로필 확정 결과를 사용하고 별도 Sheet 저장을 반복하지 않는다", () => {
  assert.match(
    memberSource,
    /serverFinalized: true,[\s\S]{0,120}saveResult: authResult\?\.profile/
  );
  assert.match(
    memberSource,
    /const saveResult = serverFinalized[\s\S]{0,100}options\.saveResult \|\| \{\}[\s\S]{0,100}saveJoinMemberProfileWithConfirmation/
  );
});

test("서버는 검증된 ERP·Kakao 식별자로 프로필을 저장한 뒤 세션을 발급한다", () => {
  assert.match(indexSource, /persistVerifiedProfile: \(context\) => persistVerifiedKakaoSignupProfile\(context\)/);
  assert.match(
    indexSource,
    /function buildVerifiedKakaoSignupProfilePayload\([\s\S]{0,5000}memberSeq,[\s\S]{0,200}memberId: kakaoId,[\s\S]{0,200}memberChannel: "KAKAO"/
  );
  assert.match(
    kakaoAuthSource,
    /persistedProfile = typeof persistVerifiedProfile[\s\S]{0,500}const session = await issueVerifiedSession\(verifiedMember\)/
  );
});

test("ERP 반영 지연·중단 재개·이전 회원 캐시 오염을 방지한다", () => {
  const completionStart = memberSource.indexOf("async function submitJoinMemberProfileOnly");
  const completionEnd = memberSource.indexOf("async function submitJoinMemberSignup", completionStart);
  const completionSource = memberSource.slice(completionStart, completionEnd);
  assert.ok(completionStart >= 0 && completionEnd > completionStart);
  assert.doesNotMatch(completionSource, /getJoinKakaoErpMemberAfterSignup/);
  assert.match(memberSource, /function rememberJoinPendingKakaoSignupDraft\(/);
  assert.match(memberSource, /function restoreJoinPendingKakaoSignupDraft\(/);
  assert.match(memberSource, /if \(memberSeq && profileSeq && memberSeq !== profileSeq\) return false/);
  assert.match(memberSource, /profileStatus: row\.profileStatus \|\| profile\.profileStatus \|\| ""/);
  assert.match(memberSource, /profileStatus \|\| ""\)\.trim\(\)\.toLowerCase\(\) === "pending"/);
  assert.match(
    memberSource,
    /error\?\.endpoint === "\/member\/saveExternalMember\.json"[\s\S]{0,500}finalizeJoinKakaoSignupAndContinue/
  );
  assert.match(completionSource, /const duplicateMessage = await checkJoinMemberKakaoSignupDuplicates\(data\)/);
  assert.match(completionSource, /await finalizeJoinKakaoSignupAndContinue/);
  assert.match(
    memberSource,
    /if \(!\/\^\\d\+\$\/\.test\(String\(erpMember\.memberSeq \|\| ""\)\.trim\(\)\)\) \{\s*if \(!required\) return null;/
  );
});

test("브라우저 ERP 재확인 없이도 서버가 memberSeq를 확정해 가입을 완료한다", () => {
  assert.match(kakaoAuthSource, /\(memberSeq && !\/\^\\d\+\$\/\.test\(memberSeq\)\)/);
  assert.match(kakaoAuthSource, /&& \(!memberSeq \|\| text\(candidate\.custSeq\) === memberSeq\)/);
  assert.match(kakaoAuthSource, /const member = \{[\s\S]{0,300}memberSeq: text\(matchedMember\.custSeq\)/);
  assert.match(memberSource, /result\?\.member\?\.memberSeq/);
});

test("가입 최종 확정은 동일 회원 잠금과 멱등 Sheet upsert를 사용한다", () => {
  assert.match(
    indexSource,
    /withApplicationMutationLock\([\s\S]{0,100}`member-kakao-signup:\$\{memberSeq\}`[\s\S]{0,180}saveJoinMemberProfileViaSheetsApi\(payload, \{ deferApplicationSync: true \}\)/
  );
  assert.match(indexSource, /const kakaoRejoinProfileIndex = findKakaoRejoinProfileIndex\(rows, payload\)/);
  assert.match(indexSource, /preserveExistingWhenEmpty: claimsAdminRoster \|\| savesPendingProfile/);
});
