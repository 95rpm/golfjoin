"use strict";

const { test, expect } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = readLocalMainHtml();
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const DIAGNOSTIC_MEMBER = Object.freeze({
  memberSeq: "E2E_DIAGNOSTIC_MEMBER",
  memberId: "e2e_diagnostic_member",
  memberName: "진단테스트회원",
  memberChannel: "E2E",
  memberMobile: "01012345678",
  memberEmail: "diagnostic-member@example.invalid",
  gender: "남성",
  birthYear: "1980",
  birthday: "1980",
  profession: "테스트",
  level: "중급",
  travelStyles: "매너중시",
  profileComplete: true
});

function asCookieData(member) {
  return `CookieData(userSeq=${member.memberSeq},userId=${member.memberId},userNm=${member.memberName},userChnCd=${member.memberChannel})`;
}

async function installLocalDiagnosticsPage(page, options = {}) {
  const member = options.member || null;
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(({ profile }) => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    window.__golfjoinE2eSafeConsole = [];
    const originalError = window.console.error.bind(window.console);
    window.console.error = (...args) => {
      window.__golfjoinE2eSafeConsole.push(args);
      originalError(...args);
    };
    if (profile) {
      localStorage.setItem("joinMemberProfiles", JSON.stringify({
        [profile.memberSeq]: profile,
        [profile.memberId]: profile
      }));
    }
  }, { profile: member });

  await page.route((url) => /\.(?:png|jpe?g|webp|gif)$/i.test(url.pathname), async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG });
  });
  await page.route(/\/goods\/(?:goods_view|add\/flight_schedule)(?:\?|$)/, async (route) => {
    const isFlight = route.request().url().includes("flight_schedule");
    await route.fulfill({
      status: 200,
      contentType: isFlight ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
      body: isFlight ? "{}" : "<!doctype html><html><body></body></html>"
    });
  });
  await page.route(/\/mypage\/(?:member|mypage)(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><body>${member ? asCookieData(member) : ""}</body></html>`
    });
  });
  await page.route("**/golfjoin-sheet-api?**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("action") || "";
    let payload = { rows: [], synthetic: true };
    if (action === "home_bootstrap_light") {
      payload = {
        newScheduleSummaries: [],
        participantSummaries: [],
        displayRules: [],
        serverTime: "2026-08-07T00:00:00+09:00",
        synthetic: true
      };
    } else if (action === "home_stats") {
      payload = { recent30DayVisitors: 0, activeUsersNow: 0, synthetic: true };
    } else if (action === "member_profile_lookup") {
      payload = { rows: member ? [member] : [], synthetic: true };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload)
    });
  });
  await page.route((url) => {
    const target = new URL(HOME_URL);
    return url.origin === target.origin && url.pathname === target.pathname
      && url.searchParams.get("eventPlanSeq") === target.searchParams.get("eventPlanSeq");
  }, async (route) => {
    let html = LOCAL_MAIN_HTML;
    if (member) {
      const initializeNeedle = "initializeGolfJoinHome().catch";
      html = html.replace(
        initializeNeedle,
        `setJoinSessionMember(${JSON.stringify(member)});\n    ${initializeNeedle}`
      );
      html = html.replace("</body>", `<div hidden>${asCookieData(member)}</div></body>`);
    }
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: html
    });
  });

  return pageErrors;
}

test("local diagnostics record public boot, first image, and detail stages without runtime errors", async ({ page }) => {
  const pageErrors = await installLocalDiagnosticsPage(page);
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });

  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 45_000
  }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (
    window.getGolfJoinPerformanceSnapshot?.().map((entry) => entry.name) || []
  )), { timeout: 45_000 }).toEqual(expect.arrayContaining([
    "golfjoin:boot:start",
    "golfjoin:boot:interactive",
    "golfjoin:boot:products-ready",
    "golfjoin:boot:bootstrap-settled",
    "golfjoin:image:mdpick-first-ready",
    "golfjoin:duration:boot-interactive",
    "golfjoin:duration:home-products",
    "golfjoin:duration:home-bootstrap",
    "golfjoin:duration:mdpick-first-image"
  ]));

  await page.evaluate(async () => {
    const product = getHomeProductSource().find((item) => item?.goodSeq && item?.eventSeq);
    if (!product) throw new Error("e2e_diagnostic_product_not_found");
    await showMdPickDetailProduct(product, getProductGroupKey(product), getMdPickProductCountryKey(product));
  });
  await expect(page.locator("#detailModal")).toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate(() => (
    window.getGolfJoinPerformanceSnapshot?.().map((entry) => entry.name) || []
  )), { timeout: 30_000 }).toEqual(expect.arrayContaining([
    "golfjoin:detail:start",
    "golfjoin:detail:visible",
    "golfjoin:detail:erp-ready",
    "golfjoin:detail:flight-ready",
    "golfjoin:duration:detail-visible",
    "golfjoin:duration:detail-erp",
    "golfjoin:duration:detail-flight"
  ]));

  const snapshot = await page.evaluate(() => window.getGolfJoinPerformanceSnapshot());
  expect(snapshot.every((entry) => (
    Object.keys(entry).join(",") === "name,entryType,startTime,duration"
    && entry.name.startsWith("golfjoin:")
  ))).toBe(true);
  const mdPickImageRequestDelay = await page.evaluate(() => {
    const entries = window.getGolfJoinPerformanceSnapshot();
    const productsReady = entries.find((entry) => entry.name === "golfjoin:boot:products-ready");
    const imageUrl = document.querySelector("#joinMdPickSection .join-mdpick-card img")?.currentSrc || "";
    const imageRequest = window.performance.getEntriesByType("resource")
      .filter((entry) => entry.name === imageUrl)
      .at(-1);
    return imageRequest && productsReady ? imageRequest.startTime - productsReady.startTime : null;
  });
  expect(mdPickImageRequestDelay).not.toBeNull();
  expect(mdPickImageRequestDelay).toBeGreaterThanOrEqual(0);
  expect(mdPickImageRequestDelay).toBeLessThanOrEqual(100);
  await expect(page.locator("#joinMdPickSection .join-mdpick-card img").first()).toHaveAttribute("loading", "eager");
  await page.evaluate(() => {
    selectMdPickCountry("japan");
    setMdPickPackFilter("japan", "air");
    setMdPickPackFilter("japan", "golf");
    setMdPickTheme("city");
  });
  await expect(page.locator("#joinMdPickSection .join-mdpick-country")).toHaveAttribute("data-mdpick-country", "japan");
  await expect(page.locator("#joinMdPickSection [data-mdpick-pack-filter='golf']")).toHaveClass(/\bactive\b/);
  await expect(page.locator("#join-section-mdpick-theme [data-mdpick-theme-group='city']")).toHaveClass(/\bactive\b/);
  const themeGroupCounts = await page.evaluate(() => ({
    rendered: document.querySelectorAll("#join-section-mdpick-theme [data-mdpick-theme-group]").length,
    visible: getVisibleMdPickThemes().length,
    legacyDuplicates: document.querySelectorAll("#join-section-mdpick-theme .legacy-active-hidden").length
  }));
  expect(themeGroupCounts.rendered).toBe(themeGroupCounts.visible);
  expect(themeGroupCounts.legacyDuplicates).toBe(0);
  await page.evaluate(() => {
    selectMdPickCountry("thailand");
    setMdPickPackFilter("thailand", "golf");
    setMdPickTheme("relax");
  });
  expect(snapshot.some((entry) => entry.name.startsWith("golfjoin:private:"))).toBe(false);
  expect(JSON.stringify(snapshot)).not.toMatch(/member|phone|email|30001104|eventPlanSeq/i);
  expect(pageErrors).toEqual([]);
});

test("local diagnostics record private hydration and mask the signed-in member in browser logs", async ({ page }) => {
  const pageErrors = await installLocalDiagnosticsPage(page, { member: DIAGNOSTIC_MEMBER });
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });

  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    window.getGolfJoinPerformanceSnapshot?.().map((entry) => entry.name) || []
  )), { timeout: 45_000 }).toEqual(expect.arrayContaining([
    "golfjoin:private:start",
    "golfjoin:private:ready",
    "golfjoin:duration:private-data"
  ]));

  await page.evaluate((profile) => {
    golfJoinSafeError(`${profile.memberName} ${profile.memberMobile} ${profile.memberEmail}`, {
      memberSeq: profile.memberSeq,
      memberId: profile.memberId,
      endpoint: `https://example.com/member/read?memberKey=seq:${profile.memberSeq}&email=${profile.memberEmail}`,
      status: 500
    });
  }, DIAGNOSTIC_MEMBER);
  const captured = await page.evaluate(() => JSON.stringify(window.__golfjoinE2eSafeConsole || []));
  [
    DIAGNOSTIC_MEMBER.memberSeq,
    DIAGNOSTIC_MEMBER.memberId,
    DIAGNOSTIC_MEMBER.memberName,
    DIAGNOSTIC_MEMBER.memberMobile,
    DIAGNOSTIC_MEMBER.memberEmail,
    "memberKey=",
    "email="
  ].forEach((secret) => expect(captured).not.toContain(secret));
  expect(captured).toContain("https://example.com/member/read");
  expect(captured).toContain("500");
  expect(pageErrors).toEqual([]);
});
