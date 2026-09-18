"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const ANALYTICS = read("src/golfjoin-main/source/scripts/analytics/30-ga4-events.js");
const DETAIL = read("src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js");
const SECTIONS = read("src/golfjoin-main/source/scripts/sections/38-home-sections.js");
const MEMBER = read("src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js");
const DEEPLINKS = read("src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js");

test("검색 결과 상세는 일반 일정과 MD PICK 모두 destination_search 귀속을 유지한다", () => {
  assert.match(DETAIL, /renderRegionProductCard\(join, \{\s*onClick: `openDetail\('[^`]+sourceArea: 'destination_search'/s);
  assert.match(DETAIL, /analyticsSourceArea: options\.analyticsSourceArea \|\| ""/);
  assert.match(SECTIONS, /openMdPickProductDetail\(groupKey, countryKey, null, \{ sourceArea: "destination_search" \}\)/);
  assert.match(SECTIONS, /analyticsSourceArea: options\.sourceArea \|\| ""/);
  assert.match(ANALYTICS, /source_area: "destination_search"/);
});

test("메인 여행지 검색 열기와 실행은 source_area를 main으로 통일한다", () => {
  assert.match(DETAIL, /function getRegionSearchGa4SourceArea/);
  assert.match(DETAIL, /source_area: getRegionSearchGa4SourceArea\(context\)/);
  assert.match(DETAIL, /source_area: getRegionSearchGa4SourceArea\(\)/);
});

test("로그인 완료 뒤 실제 원래 행동 복귀에만 전용 이벤트를 전송한다", () => {
  assert.match(MEMBER, /function trackJoinLoginReturnComplete\(afterLogin = "my-menu", resumed = true\)/);
  assert.match(MEMBER, /"golfjoin_login_return_complete"/);
  assert.match(MEMBER, /return_action: afterLogin/);
  assert.match(MEMBER, /source_area: "login"/);
  assert.match(MEMBER, /if \(resumed === false\) return false/);
  assert.match(MEMBER, /async function continueAfterJoinMemberLogin/);
  assert.match(MEMBER, /async function continueAfterJoinMemberProfileSave/);
  assert.match(DEEPLINKS, /const resumed = await continueJoinExternalDetailAfterLogin/);
  assert.match(DEEPLINKS, /return trackJoinLoginReturnComplete\(afterLogin, resumed\)/);
});

test("로그인 후 원래 행동이 실패하면 완료 이벤트를 만들지 않고 성공하면 한 번 기록한다", async () => {
  const start = MEMBER.indexOf("function trackJoinLoginReturnComplete");
  const end = MEMBER.indexOf("function handleJoinMemberLoginBack", start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  let applyResult = false;
  const context = vm.createContext({
    joinMyMenuState: { loginRedirecting: false, pendingLoginParams: {} },
    getJoinSafeReturnUrl: () => "",
    closeJoinMemberLoginModal() {},
    continueBuilderAfterLogin: async () => true,
    openGlobalApply: async () => applyResult,
    setJoinMobileNavActive() {},
    openJoinMyMenu: async () => true,
    openJoinMyDrawer: async () => true,
    continueDetailWishAfterLogin: async () => true,
    continueJoinExternalDetailAfterLogin: async () => true,
    continueMyHomeJoinDeepLinkAfterLogin: async () => true,
    openJoinProfileManageModal: async () => true,
    trackGolfJoinGa4Event(event, parameters) {
      calls.push({ event, parameters });
      return true;
    },
    location: { href: "" }
  });
  new vm.Script(MEMBER.slice(start, end)).runInContext(context);

  assert.equal(await context.continueAfterJoinMemberLogin("apply"), false);
  assert.equal(calls.length, 0);

  applyResult = true;
  assert.equal(await context.continueAfterJoinMemberLogin("apply"), true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    event: "golfjoin_login_return_complete",
    parameters: { return_action: "apply", source_area: "login" }
  }]);
});

test("복귀 추적 파라미터는 기존 GA4 허용 목록에만 머물며 개인정보 필드를 추가하지 않는다", () => {
  assert.match(ANALYTICS, /"return_action"/);
  assert.match(ANALYTICS, /"source_area"/);
  for (const forbidden of ["memberSeq", "memberMobile", "externalEmail", "birthDate", "authToken"]) {
    assert.doesNotMatch(
      MEMBER.slice(
        MEMBER.indexOf("function trackJoinLoginReturnComplete"),
        MEMBER.indexOf("async function continueAfterJoinMemberLogin")
      ),
      new RegExp(forbidden)
    );
  }
});
