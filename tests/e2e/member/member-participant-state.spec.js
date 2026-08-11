"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = fs.readFileSync(path.resolve(__dirname, "../../../golfjoin_main.html"), "utf8");
const OLD_PARTICIPANT_RECONCILIATION = "const existingParticipants = getConfirmedParticipants(join);";
const NEW_PARTICIPANT_RECONCILIATION = `const existingParticipants = getConfirmedParticipants(join)
          .filter((participant) => !isJoinParticipantPreviewSource(participant));`;

if (!LOCAL_MAIN_HTML.includes(NEW_PARTICIPANT_RECONCILIATION)) {
  throw new Error("local_participant_reconciliation_fix_not_found");
}

const SCHEDULE_ID = "sch_e2e_ab_participants";
const SCHEDULE_APPLICATION_ID = "nsa_e2e_ab_participants";
const JOIN_APPLICATION_ID = "ja_e2e_b_participant";
const JOIN_ID = `sheet-builder-application-${SCHEDULE_ID}`;
const ERP_PRODUCT_ID = "30001104";
const ERP_EVENT_SEQ = "30285494";
const B_PREVIEW_SEED = "preview_e2e_b_000001";

const COMPLETE_PROFILE = Object.freeze({
  gender: "남성",
  birthYear: "1980",
  birthday: "1980",
  profession: "E2E 직업",
  level: "입문·초보",
  travelStyles: "매너중시",
  profileComplete: true
});

const MEMBER_A = Object.freeze({
  memberSeq: "E2E_CREATOR_A",
  memberId: "e2e_creator_a",
  memberName: "권태호",
  memberChannel: "E2E",
  memberMobile: "01000000101",
  memberEmail: "e2e_creator_a@example.invalid",
  ...COMPLETE_PROFILE
});

const MEMBER_B = Object.freeze({
  memberSeq: "E2E_JOINER_B",
  memberId: "e2e_joiner_b",
  memberName: "전규호",
  memberChannel: "E2E",
  memberMobile: "01000000102",
  memberEmail: "e2e_joiner_b@example.invalid",
  ...COMPLETE_PROFILE
});

const CREATOR_PREVIEW = Object.freeze({
  displayName: "권**",
  gender: "남성",
  ageDisplay: "50대 후반",
  level: "80대 정도입니다",
  styles: ["매너중시"],
  memberPreferences: ["누구나 즐겁게"],
  iconSeed: "preview_e2e_a_000001",
  companionGroup: "group_e2e_a_000001"
});

const CREATOR_COMPANION_PREVIEW = Object.freeze({
  displayName: "일행1",
  gender: "여성",
  ageDisplay: "50대 후반",
  level: "80대 정도입니다",
  styles: ["매너중시"],
  memberPreferences: ["누구나 즐겁게"],
  iconSeed: "preview_e2e_a_companion",
  companionGroup: "group_e2e_a_000001"
});

const JOINER_B_PREVIEW = Object.freeze({
  displayName: "전**",
  gender: "남성",
  ageDisplay: "40대 중반",
  level: "입문·초보",
  styles: ["매너중시"],
  memberPreferences: ["누구나 즐겁게"],
  iconSeed: B_PREVIEW_SEED,
  companionGroup: ""
});

const JOINER_C_PREVIEW = Object.freeze({
  displayName: "김**",
  gender: "여성",
  ageDisplay: "40대 후반",
  level: "90대 정도입니다",
  styles: ["진행빠른편"],
  memberPreferences: ["누구나 즐겁게"],
  iconSeed: "preview_e2e_c_000001",
  companionGroup: ""
});

function asCookieData(member) {
  return `CookieData(userSeq=${member.memberSeq},userId=${member.memberId},userNm=${member.memberName},userChnCd=${member.memberChannel})`;
}

function profileStore(member) {
  const profile = { ...member, updatedAt: "2026-08-06T00:00:00+09:00" };
  return {
    [member.memberSeq]: profile,
    [member.memberId]: profile
  };
}

function buildBuilderRow() {
  return {
    applicationId: SCHEDULE_APPLICATION_ID,
    scheduleId: SCHEDULE_ID,
    createdAt: "2026-08-04T15:50:01+09:00",
    source: "new_schedule_builder",
    memberSeq: MEMBER_A.memberSeq,
    memberId: MEMBER_A.memberId,
    memberName: MEMBER_A.memberName,
    memberChannel: MEMBER_A.memberChannel,
    memberMobile: MEMBER_A.memberMobile,
    memberEmail: MEMBER_A.memberEmail,
    applicantName: MEMBER_A.memberName,
    applicantGender: "남성",
    applicantBirthYear: "1969",
    applicantAgeBand: "50대 후반",
    applicantMobile: MEMBER_A.memberMobile,
    applicantProfession: "사업",
    applicantPeople: 2,
    applicantCompanions: JSON.stringify([{ gender: "여성" }]),
    applicantLevel: "80대 정도입니다",
    applicantStyles: "매너중시",
    applicantPreferredMembers: "누구나 즐겁게",
    applicantGreeting: "E2E 생성 일정입니다.",
    applicantRoomType: "1인1실",
    country: "태국",
    region: "우돈타니",
    airline: "개별항공",
    departureAirport: "인천",
    arrivalAirport: "우돈타니",
    erpProductId: ERP_PRODUCT_ID,
    erpEventSeq: ERP_EVENT_SEQ,
    productName: "E2E A생성 B참여 우돈타니 일정",
    productPrice: "259000",
    packType: "golf",
    packTypeName: "골프팩",
    tripSummary: "3박 5일",
    departureDate: "2026-09-08",
    returnDate: "2026-09-12",
    startSummary: "2026-09-08",
    endSummary: "2026-09-12",
    applicationStatus: "신청",
    approvalStatus: "pending",
    displayStatus: "visible",
    recruitmentStatus: "open",
    memberKey: `seq:${MEMBER_A.memberSeq}`,
    productFamilyId: "pf_e2e_ab_participants"
  };
}

function buildJoinApplicationRow({ cancelled = false } = {}) {
  return {
    applicationId: JOIN_APPLICATION_ID,
    joinApplyId: JOIN_APPLICATION_ID,
    createdAt: "2026-08-04T15:51:01+09:00",
    submittedAt: "2026-08-04T15:51:01+09:00",
    source: "join_apply",
    memberSeq: MEMBER_B.memberSeq,
    memberId: MEMBER_B.memberId,
    memberName: MEMBER_B.memberName,
    memberChannel: MEMBER_B.memberChannel,
    memberMobile: MEMBER_B.memberMobile,
    memberEmail: MEMBER_B.memberEmail,
    targetType: "new_schedule",
    targetScheduleId: SCHEDULE_ID,
    targetApplicationId: SCHEDULE_APPLICATION_ID,
    targetJoinId: JOIN_ID,
    erpProductId: ERP_PRODUCT_ID,
    erpEventSeq: ERP_EVENT_SEQ,
    targetProductKey: `erp:${ERP_PRODUCT_ID}:${ERP_EVENT_SEQ}`,
    productName: "E2E A생성 B참여 우돈타니 일정",
    departureDate: "2026-09-08",
    returnDate: "2026-09-12",
    region: "우돈타니",
    applicantName: MEMBER_B.memberName,
    applicantGender: "남성",
    applicantBirthYear: "1980",
    applicantAgeBand: "40대 중반",
    applicantMobile: MEMBER_B.memberMobile,
    applicantProfession: "사업",
    applicantPeople: 1,
    applicantCompanions: "[]",
    applicantLevel: "입문·초보",
    applicantStyles: "매너중시",
    applicantPreferredMembers: "누구나 즐겁게",
    applicantGreeting: "E2E 참여 신청입니다.",
    applicationStatus: cancelled ? "cancelled" : "confirmed",
    participantStatus: cancelled ? "cancelled" : "confirmed",
    memberKey: `seq:${MEMBER_B.memberSeq}`,
    participantPreviewSeed: B_PREVIEW_SEED,
    participantCompanionGroup: ""
  };
}

function buildHomeBootstrap(mode = "recruiting") {
  const hasB = mode !== "creator" && mode !== "cancelled";
  const isComplete = mode === "complete";
  const previews = [CREATOR_PREVIEW, CREATOR_COMPANION_PREVIEW];
  if (hasB) previews.push(JOINER_B_PREVIEW);
  if (isComplete) previews.push(JOINER_C_PREVIEW);
  const confirmedCount = previews.length;
  const maleCount = previews.filter((item) => item.gender === "남성").length;
  const femaleCount = previews.filter((item) => item.gender === "여성").length;
  return {
    newScheduleSummaries: [{
      applicationId: SCHEDULE_APPLICATION_ID,
      scheduleId: SCHEDULE_ID,
      memberSeq: MEMBER_A.memberSeq,
      memberId: MEMBER_A.memberId,
      memberName: MEMBER_A.memberName,
      creatorName: MEMBER_A.memberName,
      title: "E2E A생성 B참여 우돈타니 일정",
      country: "태국",
      region: "우돈타니",
      departureAirport: "인천",
      arrivalAirport: "우돈타니",
      departureDate: "2026-09-08",
      returnDate: "2026-09-12",
      price: 259000,
      packType: "golf",
      packTypeName: "골프팩",
      approvalStatus: "pending",
      displayStatus: "visible",
      recruitmentStatus: isComplete ? "complete" : "open",
      capacity: 4,
      confirmedCount: 2,
      remainingSlots: 2,
      erpProductId: ERP_PRODUCT_ID,
      erpEventSeq: ERP_EVENT_SEQ,
      creatorPreview: CREATOR_PREVIEW,
      participantsPreview: [CREATOR_PREVIEW, CREATOR_COMPANION_PREVIEW]
    }],
    participantSummaries: [{
      targetScheduleId: SCHEDULE_ID,
      targetApplicationId: SCHEDULE_APPLICATION_ID,
      erpProductId: ERP_PRODUCT_ID,
      erpEventSeq: ERP_EVENT_SEQ,
      capacity: 4,
      confirmedCount,
      remainingSlots: Math.max(0, 4 - confirmedCount),
      maleCount,
      femaleCount,
      participantsPreview: previews,
      lastAppliedAt: mode === "cancelled"
        ? "2026-08-06T02:00:00+09:00"
        : "2026-08-06T01:00:00+09:00"
    }],
    displayRules: [],
    serverTime: mode === "cancelled"
      ? "2026-08-06T02:00:00+09:00"
      : `2026-08-06T01:00:0${confirmedCount}+09:00`,
    synthetic: true
  };
}

async function installParticipantEnvironment(page, options = {}) {
  const member = options.member || MEMBER_B;
  const state = { mode: options.mode || "recruiting" };
  const observed = { reads: [], blockedWrites: [], logoutRequests: 0 };

  await page.addInitScript(({ profiles }) => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("joinMemberProfiles", JSON.stringify(profiles));
  }, { profiles: profileStore(member) });

  await page.route(/\/mypage\/(?:member|mypage)(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><body><div hidden>${asCookieData(member)}</div></body></html>`
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
    const sheet = url.searchParams.get("sheet") || "";
    const memberKey = url.searchParams.get("memberKey") || "";
    observed.reads.push({ method, action, sheet, memberKey });

    if (method === "GET") {
      let rows = [];
      if (sheet === "new_schedule_applications") {
        rows = !memberKey || memberKey === `seq:${MEMBER_A.memberSeq}`
          ? [buildBuilderRow()]
          : [];
      } else if (sheet === "join_applications" && memberKey === `seq:${MEMBER_B.memberSeq}`) {
        rows = [buildJoinApplicationRow({ cancelled: state.mode === "cancelled" })];
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ rows, synthetic: true })
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

    let payload = { rows: [], synthetic: true };
    if (action === "home_bootstrap_light") {
      payload = buildHomeBootstrap(state.mode);
    } else if (action === "home_bootstrap") {
      const activeJoinRows = state.mode === "creator"
        ? []
        : [buildJoinApplicationRow({ cancelled: state.mode === "cancelled" })];
      payload = {
        newSchedules: [buildBuilderRow()],
        joinApplications: activeJoinRows,
        reviews: [],
        wishes: [],
        displayRules: [],
        synthetic: true
      };
    } else if (action === "home_stats") {
      payload = { recent30DayVisitors: 0, activeUsersNow: 0, synthetic: true };
    } else if (action === "member_profile_lookup") {
      payload = { rows: [member], synthetic: true };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload)
    });
  });

  await page.route(/\/goods\/(?:goods_view|add\/flight_schedule)(?:\?|$)/, async (route) => {
    const contentType = route.request().url().includes("flight_schedule")
      ? "application/json; charset=utf-8"
      : "text/html; charset=utf-8";
    await route.fulfill({
      status: 200,
      contentType,
      body: contentType.startsWith("application/json") ? "{}" : "<!doctype html><html><body></body></html>"
    });
  });

  await page.route((url) => (
    ["www.secret-tour.com", "m.secret-tour.com"].includes(url.hostname)
    && url.pathname === "/event/plan_view"
    && url.searchParams.get("eventPlanSeq") === "3"
  ), async (route) => {
    const response = await route.fetch();
    let html = await response.text();
    const initializeNeedle = "initializeGolfJoinHome().catch";
    if (!html.includes(initializeNeedle) || !html.includes("</body>")) {
      throw new Error("e2e_home_injection_point_not_found");
    }
    html = html.replace(
      initializeNeedle,
      `setJoinSessionMember(${JSON.stringify(member)});\n    ${initializeNeedle}`
    );
    if (html.includes(OLD_PARTICIPANT_RECONCILIATION)) {
      html = html.replace(OLD_PARTICIPANT_RECONCILIATION, NEW_PARTICIPANT_RECONCILIATION);
    } else if (!html.includes(NEW_PARTICIPANT_RECONCILIATION)) {
      throw new Error("e2e_participant_reconciliation_injection_point_not_found");
    }
    html = html.replace("</body>", `<div hidden>${asCookieData(member)}</div></body>`);
    await route.fulfill({
      response,
      body: html,
      headers: { ...response.headers(), "content-type": "text/html; charset=utf-8" }
    });
  });

  return { state, observed };
}

async function openSyntheticHome(page) {
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await page.waitForFunction(() => typeof getJoinLoginState === "function");
  await expect(page.locator("#homeInitialLoadingOverlay")).not.toHaveClass(/\bopen\b/, { timeout: 45_000 });
  await page.waitForFunction((joinId) => {
    const join = joins.find((item) => item.id === joinId);
    return Boolean(join && !googleSheetBuilderApplicationsLoading && !googleSheetJoinApplicationsLoading);
  }, JOIN_ID);
  await page.evaluate(() => {
    renderJoins();
    renderMyJoinSectionInPlace();
  });
}

async function expectRuntimeParticipants(page, expected) {
  await expect.poll(() => page.evaluate((joinId) => {
    const join = joins.find((item) => item.id === joinId);
    const participants = join ? getConfirmedParticipants(join) : [];
    return {
      count: participants.length,
      currentCount: join ? getJoinAuthoritativeConfirmedCount(join) : 0,
      currentMemberCount: participants.filter((participant) => (
        isJoinParticipantForCurrentMemberInSchedule(participant, join)
      )).length,
      hostCount: participants.filter((participant) => participant.isHost || participant.isCreator).length,
      genders: participants.map((participant) => participant.gender)
    };
  }, JOIN_ID), { timeout: 30_000 }).toEqual(expected);
}

async function expectParticipantBadges(scope, {
  avatars,
  genderSummary,
  countText,
  currentMember = true,
  host = true
}) {
  await expect(scope.locator(".team-avatar")).toHaveCount(avatars);
  const hostBadge = scope.locator(".join-my-card-participant-me-badge.host");
  await expect(hostBadge).toHaveCount(host ? 1 : 0);
  if (host) await expect(hostBadge).toHaveText("모임장");
  const meBadge = scope.locator(".join-my-card-participant-me-badge:not(.host)");
  await expect(meBadge).toHaveCount(currentMember ? 1 : 0);
  if (currentMember) await expect(meBadge).toHaveText("나");
  if (genderSummary) {
    await expect(scope.locator(".detail-participant-gender-summary")).toHaveText(genderSummary);
  }
  if (countText) {
    await expect(scope.locator(".detail-participant-info-value").first()).toHaveText(countText);
  }
}

async function openAndCheckDetail(page, expected) {
  await page.evaluate((joinId) => openDetail(joinId, { allowUnavailable: true }), JOIN_ID);
  const modal = page.locator("#detailModal");
  await expect(modal).toHaveClass(/\bopen\b/, { timeout: 30_000 });
  await expect(modal.locator("#detailModalTitle")).toContainText("E2E A생성 B참여");
  await expectParticipantBadges(modal.locator(".detail-participant-status"), expected);
  await page.evaluate(() => closeModal("detailModal"));
  await expect(modal).not.toHaveClass(/\bopen\b/);
}

async function openJoinMyTab(page, tab = "joined") {
  await page.evaluate((tabKey) => openJoinMyMenu({ skipProfileCheck: true, tab: tabKey }), tab);
  const modal = page.locator("#joinMyMenuModal");
  await expect(modal).toHaveClass(/\bopen\b/);
  await page.evaluate((tabKey) => switchJoinMyTab(tabKey), tab);
  const section = modal.locator(`.join-my-section[data-join-my-section="${tab}"]`);
  await expect(section).toBeVisible();
  return { modal, section };
}

test("A회원이 2명으로 생성한 모집중 일정은 생성자 화면에 정확히 표시된다", async ({ page }) => {
  const { observed } = await installParticipantEnvironment(page, { member: MEMBER_A, mode: "creator" });
  await openSyntheticHome(page);
  await expectRuntimeParticipants(page, {
    count: 2,
    currentCount: 2,
    currentMemberCount: 1,
    hostCount: 1,
    genders: ["남성", "여성"]
  });

  const section = page.locator('[data-join-section="my"]');
  await expect(section).toBeVisible();
  await expect(section.locator('[data-my-join-panel="created"] .join-card')).toHaveCount(1);
  const card = section.locator('[data-my-join-panel="created"] .join-card').first();
  await expect(card.locator(".team-avatar")).toHaveCount(2);
  await expect(card.locator(".join-my-card-participant-me-badge:not(.host)")).toHaveText("나");
  await expect(card.locator(".team-empty")).toHaveCount(2);

  await openAndCheckDetail(page, {
    avatars: 2,
    genderSummary: "남성 1명 · 여성 1명",
    countText: "2명",
    currentMember: true,
    host: false
  });

  const { section: myCreated } = await openJoinMyTab(page, "created");
  await expect(myCreated.locator(".join-my-created-filter-button")).toHaveCount(1);
  await expect(myCreated.locator(".join-my-created-filter-button")).toHaveText("모집중 1건");
  await expect(myCreated.locator(".join-my-card .team-avatar")).toHaveCount(2);
  await expect(myCreated.locator(".join-my-participant-count-value").first()).toHaveText("2/4명");
  expect(observed.blockedWrites).toEqual([]);
});

test("B회원의 3/4 참여중 카드와 상세에 A 모임장·B 나·성별 구성이 표시된다", async ({ page }) => {
  const { observed } = await installParticipantEnvironment(page, { member: MEMBER_B, mode: "recruiting" });
  await openSyntheticHome(page);
  await expectRuntimeParticipants(page, {
    count: 3,
    currentCount: 3,
    currentMemberCount: 1,
    hostCount: 1,
    genders: ["남성", "여성", "남성"]
  });

  const relationshipSnapshot = await page.evaluate((joinId) => {
    const join = joins.find((item) => item.id === joinId);
    const relationship = getMyHomeJoinRelationship(join || {});
    return {
      isCreated: relationship.isCreated,
      isJoined: relationship.isJoined,
      isUserCreated: isUserCreatedJoinSchedule(join || {}),
      isFuture: getJoinDaysFromToday(join || {}) >= 0,
      itemCount: getMyHomeJoinItems().length,
      hasSectionHtml: Boolean(renderMyHomeJoinSection())
    };
  }, JOIN_ID);
  expect(relationshipSnapshot).toEqual({
    isCreated: false,
    isJoined: true,
    isUserCreated: true,
    isFuture: true,
    itemCount: 1,
    hasSectionHtml: true
  });

  const panel = page.locator('[data-my-join-panel="joined"]');
  await expect(panel).toBeVisible();
  const card = panel.locator('.join-card[data-my-join-card="joined"]').first();
  await expectParticipantBadges(card, { avatars: 3, currentMember: true });
  await expect(card.locator(".team-empty")).toHaveCount(1);

  await openAndCheckDetail(page, {
    avatars: 3,
    genderSummary: "남성 2명 · 여성 1명",
    countText: "3명",
    currentMember: true
  });

  const { section: myJoined } = await openJoinMyTab(page, "joined");
  await expect(myJoined.locator(".join-my-created-filter-button")).toHaveCount(1);
  await expect(myJoined.locator(".join-my-created-filter-button")).toHaveText("참여중 1건");
  await expectParticipantBadges(myJoined.locator(".join-my-card").first(), {
    avatars: 3,
    currentMember: true
  });
  await expect(myJoined.locator(".join-my-participant-count-value").first()).toHaveText("3/4명");
  await expect(myJoined.locator(".join-my-participant-pill-value").first()).toHaveText("남성 2명 · 여성 1명");
  expect(observed.blockedWrites).toEqual([]);
});

test("B회원의 4/4 일정은 메인과 내예약에서 모집완료를 우선 표시한다", async ({ page }) => {
  const { observed } = await installParticipantEnvironment(page, { member: MEMBER_B, mode: "complete" });
  await openSyntheticHome(page);
  await expectRuntimeParticipants(page, {
    count: 4,
    currentCount: 4,
    currentMemberCount: 1,
    hostCount: 1,
    genders: ["남성", "여성", "남성", "여성"]
  });

  const panel = page.locator('[data-my-join-panel="complete"]');
  await expect(panel).toBeVisible();
  const card = panel.locator('.join-card[data-my-join-card="complete"]').first();
  await expectParticipantBadges(card, { avatars: 4, currentMember: true });
  await expect(card.locator(".team-empty")).toHaveCount(0);

  await openAndCheckDetail(page, {
    avatars: 4,
    genderSummary: "남성 2명 · 여성 2명",
    countText: "4명",
    currentMember: true
  });

  const { section: myJoined } = await openJoinMyTab(page, "joined");
  const filters = myJoined.locator(".join-my-created-filter-button");
  await expect(filters).toHaveCount(2);
  await expect(filters.first()).toHaveText("모집완료 1건");
  await expect(filters.first()).toHaveClass(/\bactive\b/);
  await expect(filters.nth(1)).toHaveText("참여중 0건");
  await expect(myJoined.locator(".join-my-card-schedule-badge.complete")).toHaveText("모집완료");
  await expectParticipantBadges(myJoined.locator(".join-my-card").first(), {
    avatars: 4,
    currentMember: true
  });
  await expect(myJoined.locator(".join-my-participant-count-value").first()).toHaveText("4/4명");
  expect(observed.blockedWrites).toEqual([]);
});

test("B회원 참여 취소 후 재로그인해도 B 아이콘과 개인 일정 캐시가 되살아나지 않는다", async ({ page }) => {
  const { state, observed } = await installParticipantEnvironment(page, { member: MEMBER_B, mode: "recruiting" });
  await openSyntheticHome(page);
  await expectRuntimeParticipants(page, {
    count: 3,
    currentCount: 3,
    currentMemberCount: 1,
    hostCount: 1,
    genders: ["남성", "여성", "남성"]
  });

  state.mode = "cancelled";
  await page.evaluate(async () => {
    await hydrateJoinApplicationsFromGoogleSheet({ renderStart: false });
    await hydrateHomeBootstrapLightFromGoogleSheet();
  });
  const cancelledRuntimeSnapshot = await page.evaluate((joinId) => {
    const join = joins.find((item) => item.id === joinId);
    return {
      participantSummaryCount: join?.participantSummary?.confirmedCount,
      lightSummaryCount: join?.lightSummary?.confirmedCount,
      emptySlots: join?.emptySlots,
      participants: getConfirmedParticipants(join || {}).map((participant) => ({
        id: participant.id,
        source: participant.source,
        previewSeed: participant.previewSeed,
        sourceRecordId: participant.sourceRecordId,
        isCurrentMember: participant.isCurrentMember === true,
        gender: participant.gender,
        name: participant.name
      }))
    };
  }, JOIN_ID);
  if (cancelledRuntimeSnapshot.participants.length !== 2) {
    throw new Error(`cancelled_participant_reconciliation_failed:${JSON.stringify(cancelledRuntimeSnapshot)}`);
  }
  await expectRuntimeParticipants(page, {
    count: 2,
    currentCount: 2,
    currentMemberCount: 0,
    hostCount: 1,
    genders: ["남성", "여성"]
  });
  await expect(page.locator('[data-join-section="my"]')).toHaveCount(0);

  const afterCancellation = await page.evaluate((joinApplyId) => ({
    joinedCount: getJoinMyReservationGroups(getJoinCachedCurrentMember()).joined.length,
    rememberedCancelled: Array.from(joinApplicationPayloadMemory.values())
      .filter((item) => String(item.joinApplyId || "") === joinApplyId)
      .every((item) => isCancelledJoinApplyPayload(item)),
    cacheMemberKey: JSON.parse(localStorage.getItem("joinApplicationsSheetReadCache") || "null")?.memberKey || ""
  }), JOIN_APPLICATION_ID);
  expect(afterCancellation).toEqual({
    joinedCount: 0,
    rememberedCancelled: true,
    cacheMemberKey: `seq:${MEMBER_B.memberSeq}`
  });

  await page.evaluate(async (member) => {
    await handleJoinMyLogout();
    setJoinSessionMember(member);
    await hydrateJoinApplicationsFromGoogleSheet({ renderStart: false });
    await hydrateHomeBootstrapLightFromGoogleSheet();
  }, MEMBER_B);
  await expectRuntimeParticipants(page, {
    count: 2,
    currentCount: 2,
    currentMemberCount: 0,
    hostCount: 1,
    genders: ["남성", "여성"]
  });
  const afterRelogin = await page.evaluate(() => ({
    memberKey: getJoinMemberCanonicalKey(getJoinCachedCurrentMember() || {}),
    joinedCount: getJoinMyReservationGroups(getJoinCachedCurrentMember()).joined.length,
    privateItems: readJoinMemberScopedItems("secretGolfJoinApplications").length
  }));
  expect(afterRelogin).toEqual({
    memberKey: `seq:${MEMBER_B.memberSeq}`,
    joinedCount: 0,
    privateItems: 0
  });
  expect(observed.logoutRequests).toBe(1);
  expect(observed.blockedWrites).toEqual([]);
});
