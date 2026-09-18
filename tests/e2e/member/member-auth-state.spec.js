"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const USE_LOCAL_MAIN_HTML = process.env.GOLFJOIN_E2E_USE_LOCAL_HTML === "1";
const LOCAL_MAIN_HTML = USE_LOCAL_MAIN_HTML
  ? fs.readFileSync(path.resolve(__dirname, "../../../golfjoin_main.html"), "utf8")
  : "";

function replaceEmbeddedGolfJoinHtml(shellHtml) {
  const marker = "<title>골프 조인 게시판</title>";
  const markerIndex = shellHtml.indexOf(marker);
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("member_e2e_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

const COMPLETE_PROFILE = Object.freeze({
  gender: "남성",
  birthYear: "1980",
  birthday: "1980",
  profession: "E2E 직군",
  level: "중급",
  travelStyles: "매너중시"
});

const RAW_MEMBER = Object.freeze({
  memberSeq: "E2E_RAW_A",
  memberId: "e2e_raw_a",
  memberName: "E2E_RAW_A",
  memberChannel: "E2E"
});

const SESSION_MEMBER = Object.freeze({
  memberSeq: "E2E_SESSION_B",
  memberId: "e2e_session_b",
  memberName: "E2E_SESSION_B",
  memberChannel: "E2E",
  memberMobile: "01000000002",
  memberEmail: "e2e_session_b@example.invalid",
  ...COMPLETE_PROFILE,
  profileComplete: true
});

const INCOMPLETE_MEMBER = Object.freeze({
  memberSeq: "E2E_INCOMPLETE_C",
  memberId: "e2e_incomplete_c",
  memberName: "E2E_INCOMPLETE_C",
  memberChannel: "E2E"
});

const DEEP_LINK_SCHEDULE_ID = "sch_e2e_after_login_deep_link";
const DEEP_LINK_APPLICATION_ID = "nsa_e2e_after_login_deep_link";

const DEEP_LINK_HOME_BOOTSTRAP = Object.freeze({
  newScheduleSummaries: [{
    applicationId: DEEP_LINK_APPLICATION_ID,
    scheduleId: DEEP_LINK_SCHEDULE_ID,
    memberSeq: RAW_MEMBER.memberSeq,
    memberId: RAW_MEMBER.memberId,
    memberName: RAW_MEMBER.memberName,
    creatorName: RAW_MEMBER.memberName,
    title: "E2E 로그인 복귀 딥링크 일정",
    country: "태국",
    region: "우돈타니",
    departureAirport: "인천",
    arrivalAirport: "우돈타니",
    departureDate: "2026-09-08",
    returnDate: "2026-09-12",
    approvalStatus: "pending",
    displayStatus: "visible",
    recruitmentStatus: "open",
    capacity: 4,
    confirmedCount: 1,
    remainingSlots: 3,
    erpProductId: "30001104",
    erpEventSeq: "30285494",
    participantsPreview: [{
      memberSeq: RAW_MEMBER.memberSeq,
      memberId: RAW_MEMBER.memberId,
      displayName: RAW_MEMBER.memberName,
      gender: "남성",
      ageDisplay: "40대",
      level: "중급",
      styles: ["매너중시"]
    }]
  }],
  participantSummaries: [],
  displayRules: [],
  serverTime: "2026-08-06T00:00:00+09:00",
  synthetic: true
});

function asCookieData(member) {
  return `CookieData(userSeq=${member.memberSeq},userId=${member.memberId},userNm=${member.memberName},userChnCd=${member.memberChannel || "E2E"})`;
}

function completeProfileStore(member) {
  const profile = {
    ...member,
    ...COMPLETE_PROFILE,
    updatedAt: "2026-08-06T00:00:00+09:00"
  };
  return {
    [member.memberSeq]: profile,
    [member.memberId]: profile
  };
}

function syntheticMemberDetailHtml(member) {
  return `<!doctype html><html><body>
    <div hidden>${asCookieData(member)}</div>
    <input id="userNm" value="${member.memberName}">
    <input id="mobile" value="01000000003">
    <input id="email" value="e2e_incomplete_c@example.invalid">
  </body></html>`;
}

async function installSyntheticMemberEnvironment(page, options = {}) {
  const rawMember = options.rawMember || RAW_MEMBER;
  const sessionMember = options.sessionMember || null;
  const profileStore = options.profileStore || {};
  const observed = {
    memberReadKeys: [],
    sheetReads: [],
    actionReads: [],
    blockedWrites: [],
    logoutRequests: 0
  };

  await page.addInitScript((profiles) => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    if (profiles && Object.keys(profiles).length) {
      localStorage.setItem("joinMemberProfiles", JSON.stringify(profiles));
    }
  }, profileStore);

  await page.route(/\/mypage\/(?:member|mypage)(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: syntheticMemberDetailHtml(rawMember)
    });
  });

  await page.route("**/member/logout.json*", async (route) => {
    observed.logoutRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ ok: true, synthetic: true })
    });
  });

  await page.route("**/golfjoin-sheet-api?**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const action = url.searchParams.get("action") || "";
    const memberKey = url.searchParams.get("memberKey") || "";

    if (method === "GET") {
      if (memberKey) observed.memberReadKeys.push(memberKey);
      observed.sheetReads.push({
        sheet: url.searchParams.get("sheet") || "",
        source: url.searchParams.get("source") || "",
        memberKey
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ rows: [], synthetic: true })
      });
      return;
    }

    const allowedReadActions = new Set([
      "home_bootstrap_light",
      "home_bootstrap",
      "home_stats",
      "member_profile_lookup",
      "join_wishes_lookup"
    ]);
    if (!allowedReadActions.has(action)) {
      observed.blockedWrites.push({ method, action: action || "no-action" });
      await route.fulfill({
        status: 409,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: false, error: "e2e_blocked_write" })
      });
      return;
    }

    observed.actionReads.push(action);
    if (action === "home_bootstrap_light" && options.homeBootstrapDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.homeBootstrapDelayMs));
    }
    let payload = { rows: [], synthetic: true };
    if (action === "home_bootstrap_light") {
      payload = options.homeBootstrapLight || {
        newScheduleSummaries: [],
        participantSummaries: [],
        displayRules: [],
        serverTime: "2026-08-06T00:00:00+09:00",
        synthetic: true
      };
    } else if (action === "home_bootstrap") {
      payload = {
        newSchedules: [],
        joinApplications: [],
        reviews: [],
        wishes: [],
        displayRules: [],
        synthetic: true
      };
    } else if (action === "home_stats") {
      payload = { recent30DayVisitors: 0, activeUsersNow: 0, synthetic: true };
    } else if (action === "member_profile_lookup") {
      payload = { rows: options.profileLookupRows || [], synthetic: true };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload)
    });
  });

  await page.route((url) => (
    ["www.secret-tour.com", "m.secret-tour.com"].includes(url.hostname)
    && url.pathname === "/event/plan_view"
    && url.searchParams.get("eventPlanSeq") === "3"
  ), async (route) => {
    const response = await route.fetch();
    let html = await response.text();
    if (USE_LOCAL_MAIN_HTML) html = replaceEmbeddedGolfJoinHtml(html);
    const authMarker = `<div id="golfjoinE2eCookieData" hidden>${asCookieData(rawMember)}</div>`;
    if (!html.includes("</body>")) throw new Error("e2e_home_body_not_found");
    html = html.replace("</body>", `${authMarker}</body>`);
    if (sessionMember) {
      const initializeNeedle = "initializeGolfJoinHome().catch";
      if (!html.includes(initializeNeedle)) throw new Error("e2e_home_initializer_not_found");
      html = html.replace(
        initializeNeedle,
        `setJoinSessionMember(${JSON.stringify(sessionMember)});\n    ${initializeNeedle}`
      );
    }
    if (options.instrumentOpenDetail) {
      const openDetailNeedle = "function openDetail(id, options = {}) {";
      if (!html.includes(openDetailNeedle)) throw new Error("e2e_open_detail_not_found");
      html = html.replace(
        openDetailNeedle,
        `${openDetailNeedle}\n      window.__golfjoinE2eOpenDetailCalls = window.__golfjoinE2eOpenDetailCalls || [];\n      window.__golfjoinE2eOpenDetailCalls.push({ id: String(id || \"\"), at: Date.now() });`
      );
    }
    await route.fulfill({
      response,
      body: html,
      headers: {
        ...response.headers(),
        "content-type": "text/html; charset=utf-8"
      }
    });
  });

  return observed;
}

async function openSyntheticHome(page, url = HOME_URL) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await page.waitForFunction(() => typeof getJoinLoginState === "function");
  await expect(page.locator("#homeInitialLoadingOverlay")).not.toHaveClass(/\bopen\b/, { timeout: 45_000 });
}

async function readAuthSnapshot(page) {
  return page.evaluate(() => {
    const state = getJoinLoginState();
    const member = getJoinCachedCurrentMember();
    return {
      isLogin: state.isLogin,
      memberSeq: member?.memberSeq || "",
      memberId: member?.memberId || "",
      memberKey: getJoinMemberCanonicalKey(member || {}),
      profileComplete: isJoinMemberProfileComplete(member || {}),
      isSessionMember: Boolean(member?.isSessionMember)
    };
  });
}

test("raw CookieData 회원을 로그인 상태로 인식하고 회원 키를 분리한다", async ({ page }) => {
  const observed = await installSyntheticMemberEnvironment(page, {
    rawMember: RAW_MEMBER,
    profileStore: completeProfileStore(RAW_MEMBER)
  });
  await openSyntheticHome(page);

  await expect.poll(() => readAuthSnapshot(page)).toEqual({
    isLogin: true,
    memberSeq: RAW_MEMBER.memberSeq,
    memberId: RAW_MEMBER.memberId,
    memberKey: `seq:${RAW_MEMBER.memberSeq}`,
    profileComplete: true,
    isSessionMember: false
  });
  await expect.poll(() => observed.memberReadKeys.includes(`seq:${RAW_MEMBER.memberSeq}`), {
    timeout: 20_000
  }).toBe(true);
  expect(observed.blockedWrites).toEqual([]);
});

test("검증 세션 회원이 같은 문서의 오래된 CookieData 회원보다 우선한다", async ({ page }) => {
  const observed = await installSyntheticMemberEnvironment(page, {
    rawMember: RAW_MEMBER,
    sessionMember: SESSION_MEMBER,
    profileStore: completeProfileStore(RAW_MEMBER)
  });
  await openSyntheticHome(page);

  await expect.poll(() => readAuthSnapshot(page)).toEqual({
    isLogin: true,
    memberSeq: SESSION_MEMBER.memberSeq,
    memberId: SESSION_MEMBER.memberId,
    memberKey: `seq:${SESSION_MEMBER.memberSeq}`,
    profileComplete: true,
    isSessionMember: true
  });
  await expect.poll(() => observed.memberReadKeys.includes(`seq:${SESSION_MEMBER.memberSeq}`), {
    timeout: 20_000
  }).toBe(true);
  expect(observed.memberReadKeys).not.toContain(`seq:${RAW_MEMBER.memberSeq}`);
  expect(observed.blockedWrites).toEqual([]);
});

test("필수 프로필이 없는 로그인 회원에게 추가정보 입력 화면을 연다", async ({ page }) => {
  const observed = await installSyntheticMemberEnvironment(page, {
    rawMember: INCOMPLETE_MEMBER,
    profileLookupRows: []
  });
  await openSyntheticHome(page);

  const form = page.locator("#joinMemberSignupForm");
  await expect(form).toHaveAttribute("data-profile-required", "true", { timeout: 30_000 });
  await expect(form).toHaveClass(/\bis-profile-required\b/);
  await expect(page.locator("#joinMemberLoginModal")).toHaveClass(/\bopen\b/);
  await expect(page.locator("#joinMemberLoginTitle")).toHaveText("추가정보 입력");
  expect(observed.actionReads).toContain("member_profile_lookup");
  expect(observed.blockedWrites).toEqual([]);
});

test("A회원 로그아웃 후 B회원 로그인 시 A회원 개인 캐시를 폐기한다", async ({ page }) => {
  const observed = await installSyntheticMemberEnvironment(page, {
    rawMember: RAW_MEMBER,
    sessionMember: { ...RAW_MEMBER, ...COMPLETE_PROFILE, profileComplete: true },
    profileStore: completeProfileStore(RAW_MEMBER)
  });
  await openSyntheticHome(page);

  const result = await page.evaluate(async (nextMember) => {
    const before = getJoinCachedCurrentMember();
    writeJoinMemberScopedItems("secretGolfJoinWishProducts", [{ targetKey: "E2E_A_ONLY" }], before);
    writeJoinMemberScopedItems("secretGolfJoinApplications", [{ joinApplyId: "E2E_A_ONLY" }], before);
    writeJoinMemberScopedItems("secretGolfJoinBuilderApplications", [{ applicationId: "E2E_A_ONLY" }], before);
    const beforeKeys = [
      "secretGolfJoinWishProducts",
      "secretGolfJoinApplications",
      "secretGolfJoinBuilderApplications"
    ].filter((key) => localStorage.getItem(key));

    await handleJoinMyLogout();
    const afterLogoutKeys = [
      "secretGolfJoinWishProducts",
      "secretGolfJoinApplications",
      "secretGolfJoinBuilderApplications",
      "joinApplicationsSheetReadCache",
      "builderApplicationsSheetReadCache",
      "joinWishesSheetReadCache"
    ].filter((key) => localStorage.getItem(key));

    setJoinSessionMember(nextMember);
    const after = getJoinCachedCurrentMember();
    const staleWishItems = readJoinMemberScopedItems("secretGolfJoinWishProducts", after);
    const scopeKey = syncActiveJoinMySchedulesMemberScope();
    return {
      beforeMemberKey: getJoinMemberCanonicalKey(before),
      beforeKeys,
      afterLogoutKeys,
      afterMemberKey: getJoinMemberCanonicalKey(after),
      staleWishCount: staleWishItems.length,
      scopeKey
    };
  }, SESSION_MEMBER);

  expect(result.beforeMemberKey).toBe(`seq:${RAW_MEMBER.memberSeq}`);
  expect(result.beforeKeys).toHaveLength(3);
  expect(result.afterLogoutKeys).toEqual([]);
  expect(result.afterMemberKey).toBe(`seq:${SESSION_MEMBER.memberSeq}`);
  expect(result.staleWishCount).toBe(0);
  expect(result.scopeKey).toBe(`seq:${SESSION_MEMBER.memberSeq}`);
  expect(observed.logoutRequests).toBe(1);
  expect(observed.blockedWrites).toEqual([]);
});

test("로그인 복귀 중 회원 일정 응답이 늦어도 딥링크 상세를 한 번만 연다", async ({ page }) => {
  test.setTimeout(120_000);
  const observed = await installSyntheticMemberEnvironment(page, {
    rawMember: RAW_MEMBER,
    profileStore: completeProfileStore(RAW_MEMBER),
    profileLookupRows: [{
      ...RAW_MEMBER,
      ...COMPLETE_PROFILE,
      memberMobile: "01000000001",
      memberEmail: "e2e_raw_a@example.invalid"
    }],
    homeBootstrapLight: DEEP_LINK_HOME_BOOTSTRAP,
    homeBootstrapDelayMs: 2_500,
    instrumentOpenDetail: true
  });

  const url = new URL(HOME_URL);
  url.searchParams.set("afterLogin", "my-section");
  url.searchParams.set("scheduleId", DEEP_LINK_SCHEDULE_ID);
  url.searchParams.set("golfjoinTab", "created");
  await openSyntheticHome(page, url.toString());

  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 45_000 });
  const expectedJoinId = `sheet-builder-application-${DEEP_LINK_SCHEDULE_ID}`;
  await expect.poll(() => page.evaluate(() => (
    window.__golfjoinE2eOpenDetailCalls?.map((item) => item.id) || []
  )), {
    timeout: 30_000
  }).toEqual([expectedJoinId]);

  await page.waitForTimeout(3_000);
  expect(await page.evaluate(() => window.__golfjoinE2eOpenDetailCalls?.length || 0)).toBe(1);
  const finalUrl = new URL(page.url());
  expect(finalUrl.searchParams.has("afterLogin")).toBe(false);
  expect(finalUrl.searchParams.has("golfjoinOpen")).toBe(false);
  expect(finalUrl.searchParams.has("scheduleId")).toBe(false);
  expect(observed.actionReads).toContain("home_bootstrap_light");
  expect(observed.actionReads).toContain("member_profile_lookup");
  expect(observed.blockedWrites).toEqual([]);
});

test("나의 모임을 다시 열 때 회원 API 목록과 회원별 캐시를 비교한다", async ({ page }, testInfo) => {
  const observed = await installSyntheticMemberEnvironment(page, {
    rawMember: RAW_MEMBER,
    sessionMember: SESSION_MEMBER,
    profileStore: completeProfileStore(RAW_MEMBER)
  });
  await openSyntheticHome(page);

  await expect.poll(() => observed.memberReadKeys.includes(`seq:${SESSION_MEMBER.memberSeq}`), {
    timeout: 20_000
  }).toBe(true);
  await page.waitForFunction(() => (
    !googleSheetBuilderApplicationsLoading
    && !googleSheetJoinApplicationsLoading
  ));
  observed.sheetReads.length = 0;
  observed.memberReadKeys.length = 0;

  const openAndCollect = async () => {
    await page.evaluate(() => openJoinMyMenu({ skipProfileCheck: true }));
    await expect(page.locator("#joinMyMenuModal")).toHaveClass(/\bopen\b/);
    await expect.poll(() => observed.sheetReads.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
    await page.waitForFunction(() => !joinMyReservationsRefreshing);
    const reads = observed.sheetReads.map((item) => ({ ...item }));
    const cacheScope = await page.evaluate(() => {
      const readScope = (key) => {
        try {
          return JSON.parse(localStorage.getItem(key) || "null")?.memberKey || "";
        } catch (error) {
          return "";
        }
      };
      return {
        builder: readScope("builderApplicationsSheetReadCache"),
        join: readScope("joinApplicationsSheetReadCache")
      };
    });
    await page.evaluate(() => closeJoinMyMenu());
    await expect(page.locator("#joinMyMenuModal")).not.toHaveClass(/\bopen\b/);
    observed.sheetReads.length = 0;
    observed.memberReadKeys.length = 0;
    return { reads, cacheScope };
  };

  const firstOpen = await openAndCollect();
  const secondOpen = await openAndCollect();
  const summarize = (reads) => reads.map((item) => ({
    sheet: item.sheet,
    source: item.source,
    scoped: Boolean(item.memberKey)
  }));
  const comparison = {
    firstOpen: summarize(firstOpen.reads),
    secondOpen: summarize(secondOpen.reads),
    firstCacheScope: firstOpen.cacheScope,
    secondCacheScope: secondOpen.cacheScope
  };
  await testInfo.attach("member-api-cache-comparison.json", {
    body: Buffer.from(JSON.stringify(comparison, null, 2)),
    contentType: "application/json"
  });

  const expectedMemberKey = `seq:${SESSION_MEMBER.memberSeq}`;
  expect(firstOpen.cacheScope).toEqual({ builder: expectedMemberKey, join: expectedMemberKey });
  expect(secondOpen.cacheScope).toEqual({ builder: expectedMemberKey, join: expectedMemberKey });
  expect(summarize(firstOpen.reads)).toEqual([
    { sheet: "new_schedule_applications", source: "new_schedule_builder", scoped: false },
    { sheet: "new_schedule_applications", source: "new_schedule_builder", scoped: true },
    { sheet: "join_applications", source: "", scoped: true }
  ]);
  expect(summarize(secondOpen.reads)).toEqual(summarize(firstOpen.reads));
  expect(secondOpen.reads.length).toBeLessThanOrEqual(firstOpen.reads.length);
  expect(observed.blockedWrites).toEqual([]);
});
