"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const MEMBER_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"
), "utf8");
const RESERVATION_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"
), "utf8");

function getFunctionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} not found`);
  assert.notEqual(end, -1, `${nextName} boundary not found`);
  return source.slice(start, end);
}

test("내예약 클릭은 모달이 준비될 때까지 공통 로딩 문구를 표시한다", () => {
  const block = getFunctionBlock(RESERVATION_SOURCE, "handleJoinMyTripClick", "getJoinLogoutUrl");
  assert.match(block, /openJoinActionLoading\("예약정보를 불러오고 있어요", \{ minVisibleMs: 300 \}\)/);
  assert.match(block, /beforePendingRosterPrompt: \(\) => closeJoinActionLoading\(loadingToken\)/);
  assert.match(block, /finally \{\s*await closeJoinActionLoading\(loadingToken\);\s*joinMyReservationOpening = false;/);
});

test("과거 신청 확인창은 공통 로딩을 먼저 닫은 뒤 표시한다", () => {
  const promptBlock = getFunctionBlock(MEMBER_SOURCE, "promptJoinPendingRosterCandidates", "resetJoinMemberSignupValidation");
  const closeIndex = promptBlock.lastIndexOf("await options.beforePromptOpen()");
  const openIndex = promptBlock.indexOf('overlay.classList.add("open")');
  assert.ok(closeIndex >= 0, "beforePromptOpen callback missing");
  assert.ok(openIndex > closeIndex, "pending roster prompt opened before common loading closed");
  assert.match(
    promptBlock,
    /if \(joinPendingRosterPromptPromise\) \{[\s\S]*?await options\.beforePromptOpen\(\);[\s\S]*?return joinPendingRosterPromptPromise;/
  );

  const menuBlock = getFunctionBlock(RESERVATION_SOURCE, "openJoinMyMenu", "closeJoinMyMenu");
  assert.match(menuBlock, /beforePromptOpen: options\.beforePendingRosterPrompt/);
});

test("내예약 중복 클릭 잠금과 백그라운드 캐시 갱신을 유지한다", () => {
  const clickBlock = getFunctionBlock(RESERVATION_SOURCE, "handleJoinMyTripClick", "getJoinLogoutUrl");
  const menuBlock = getFunctionBlock(RESERVATION_SOURCE, "openJoinMyMenu", "closeJoinMyMenu");
  assert.match(clickBlock, /if \(joinMyReservationOpening\) return/);
  assert.match(menuBlock, /Promise\.allSettled\(\[builderApplicationsRefresh, joinApplicationsRefresh\]\)/);
  assert.match(menuBlock, /hasFreshGoogleSheetRowsCache\(GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY/);
  assert.match(menuBlock, /hasFreshGoogleSheetRowsCache\(GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY/);
});
