"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const memberSource = fs.readFileSync(path.join(
  __dirname,
  "..",
  "..",
  "src",
  "golfjoin-main",
  "source",
  "scripts",
  "member",
  "34-member-auth-profile-wishes.js"
), "utf8");
const reservationsSource = fs.readFileSync(path.join(
  __dirname,
  "..",
  "..",
  "src",
  "golfjoin-main",
  "source",
  "scripts",
  "member",
  "36-member-reservations-deeplinks.js"
), "utf8");

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `source range missing: ${startToken}`);
  return source.slice(start, end);
}

test("카카오 최종 화면은 프로필 확정 후 과거 신청 후보 조회를 기다리지 않는다", () => {
  const completionSource = sourceBetween(
    memberSource,
    "async function saveJoinMemberKakaoProfileAndContinue",
    "function buildJoinMemberProfilePayload"
  );
  assert.doesNotMatch(completionSource, /promptJoinPendingRosterCandidates/);
  assert.match(completionSource, /finishJoinMemberSignupAndContinue/);
  assert.match(reservationsSource, /await promptJoinPendingRosterCandidates\(\{ source: "my-reservations" \}\)/);
});

test("검증된 카카오 가입만 신청서 전화번호 동기화를 지연한다", () => {
  assert.match(
    serverSource,
    /saveJoinMemberProfileViaSheetsApi\(payload, \{ deferApplicationSync: true \}\)/
  );
  assert.match(
    serverSource,
    /const syncedApplicationCount = deferApplicationSync \? 0 : await syncApplicationPhonesForMemberProfile/
  );
  assert.match(
    serverSource,
    /const claimedApplicationCount = claimsAdminRoster[\s\S]{0,180}claimAdminRosterApplicationsForProfile/
  );
  assert.match(
    serverSource,
    /preserveExistingWhenEmpty: claimsAdminRoster \|\| savesPendingProfile \|\| isPendingReconciliation\(existingRow\)/
  );
});

test("후속 동기화 상태는 프로필 행에 내구적으로 기록되고 최신 작업만 확정한다", () => {
  for (const header of [
    "reconciliationState",
    "reconciliationRevision",
    "reconciliationAttempts",
    "reconciliationNextAt",
    "reconciliationErrorCode",
    "reconciliationUpdatedAt"
  ]) {
    assert.match(serverSource, new RegExp(`"${header}"`));
  }
  assert.match(serverSource, /buildPendingReconciliationFields/);
  assert.match(serverSource, /buildCompletedReconciliationFields/);
  assert.match(serverSource, /buildFailedReconciliationFields/);
});

test("인증된 내 예약 조회가 보류 작업을 재시도하고 실패해도 후보 조회는 유지한다", () => {
  const endpointSource = sourceBetween(
    serverSource,
    "async function proxyMemberPendingRosterCandidates",
    "async function proxyMemberPendingRosterDecide"
  );
  assert.match(endpointSource, /getVerifiedMemberIdentity\(req\)/);
  assert.match(endpointSource, /await reconcilePendingMemberProfileApplications\(identity\)\.catch/);
  assert.match(endpointSource, /readPendingRosterCandidatesForVerifiedMember\(identity\)/);
});

test("프로필 저장 성공 전 세션 발급 금지 순서를 유지한다", () => {
  const kakaoAuthSource = fs.readFileSync(path.join(__dirname, "member-kakao-auth.js"), "utf8");
  const persistIndex = kakaoAuthSource.indexOf("await persistVerifiedProfile");
  const sessionIndex = kakaoAuthSource.indexOf("await issueVerifiedSession", persistIndex);
  assert.ok(persistIndex >= 0 && sessionIndex > persistIndex);
});
