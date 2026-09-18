"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const STATE_SOURCE = read("src/golfjoin-main/source/scripts/store/30-state-and-presets.js");
const MEMBER_SOURCE = read("src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js");
const HOME_SOURCE = read("src/golfjoin-main/source/scripts/data/35-home-bootstrap.js");
const DETAIL_SOURCE = read("src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js");
const RESERVATION_SOURCE = read("src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js");

test("회원별 동일 데이터 요청은 세대·회원키·데이터형 Promise 하나로 합친다", () => {
  assert.match(STATE_SOURCE, /const joinPrivateRequestRegistry = new Map\(\)/);
  assert.match(MEMBER_SOURCE, /const requestKey = `\$\{scope\.generation\}\|\$\{scope\.memberKey\}\|\$\{String\(dataType \|\| "private"\)\}`/);
  assert.match(MEMBER_SOURCE, /if \(current\) return current/);
  assert.match(DETAIL_SOURCE, /runJoinPrivateRequestOnce\(\s*"builder-applications"/);
  assert.match(DETAIL_SOURCE, /runJoinPrivateRequestOnce\(\s*"join-applications"/);
  assert.match(MEMBER_SOURCE, /runJoinPrivateRequestOnce\(\s*"join-wishes"/);
});

test("회원 전환과 로그아웃은 이전 요청 세대를 무효화한다", () => {
  assert.match(MEMBER_SOURCE, /function invalidateJoinPrivateRequests\(\)/);
  assert.match(MEMBER_SOURCE, /googleSheetBuilderApplicationsRequestGeneration \+= 1/);
  assert.match(MEMBER_SOURCE, /googleSheetJoinApplicationsRequestGeneration \+= 1/);
  assert.match(MEMBER_SOURCE, /function clearJoinPrivateClientCaches\(\) \{\s*invalidateJoinPrivateRequests\(\)/);
  assert.match(MEMBER_SOURCE, /if \(!isJoinPrivateRequestScopeCurrent\(requestScope\)\) return getJoinWishProducts\(\)/);
});

test("회원 보조 조회는 병렬 재검증하고 이미 받은 공개 모임을 재사용한다", () => {
  assert.match(HOME_SOURCE, /const privateRefreshes = \[\]/);
  assert.match(HOME_SOURCE, /await Promise\.allSettled\(privateRefreshes\)/);
  assert.doesNotMatch(HOME_SOURCE, /await hydrateBuilderApplicationJoinsFromGoogleSheet\(/);
  assert.doesNotMatch(HOME_SOURCE, /await hydrateJoinApplicationsFromGoogleSheet\(/);
  assert.match(DETAIL_SOURCE, /const canReuseBootstrapPublicRows = homeBootstrapLightAuthoritativeApplied/);
  assert.match(DETAIL_SOURCE, /canReuseBootstrapPublicRows \? Promise\.resolve\(bootstrapPublicRows\) : fetchGolfJoinSheetRows/);
  assert.match(DETAIL_SOURCE, /writeGoogleSheetRowsCache\(GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY, currentScopedMemberRows/);
  assert.match(DETAIL_SOURCE, /currentPublicRows\.forEach\(\(summary\) => upsertLightNewScheduleSummary\(summary, \{ publicHome: true \}\)\)/);
  assert.match(DETAIL_SOURCE, /pendingHomeBootstrapLightData\?\.participantSummaries \|\| \[\]\)\.forEach\(applyLightParticipantSummary\)/);
});

test("회원별 로컬 캐시는 회원키·세대·데이터형 메타데이터를 기록한다", () => {
  assert.match(MEMBER_SOURCE, /sessionGeneration: requestScope\.generation/);
  assert.match(MEMBER_SOURCE, /dataType: storageKey/);
  assert.match(DETAIL_SOURCE, /dataType: key/);
  assert.match(DETAIL_SOURCE, /String\(cached\.dataType\) !== String\(key\)/);
});

test("내예약은 방금 갱신한 동일 회원 캐시를 즉시 표시하고 중복 재조회를 생략한다", () => {
  assert.match(RESERVATION_SOURCE, /const memberCacheOptions = \{ memberKey: getJoinWishMemberKey\(member\) \}/);
  assert.match(RESERVATION_SOURCE, /hasFreshGoogleSheetRowsCache\(GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY, memberCacheOptions\)/);
  assert.match(RESERVATION_SOURCE, /hasFreshGoogleSheetRowsCache\(GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY, memberCacheOptions\)/);
  assert.match(RESERVATION_SOURCE, /requestAnimationFrame\(\(\) => renderMyJoinSectionInPlace\(\)\)/);
  assert.doesNotMatch(RESERVATION_SOURCE, /requestAnimationFrame\(renderJoins\)/);
});
