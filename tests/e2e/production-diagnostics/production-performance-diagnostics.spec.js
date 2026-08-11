"use strict";

const { test, expect } = require("@playwright/test");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const DIAGNOSTIC_MEMBER = Object.freeze({
  memberSeq: "E2E_PRODUCTION_DIAGNOSTIC",
  memberId: "e2e_production_diagnostic",
  memberName: "운영진단합성회원",
  memberChannel: "E2E",
  memberMobile: "01098765432",
  memberEmail: "production-diagnostic@example.invalid",
  gender: "남성",
  birthYear: "1980",
  birthday: "1980",
  profession: "테스트",
  level: "중급",
  travelStyles: "매너중시",
  profileComplete: true
});

async function captureSafeConsole(page, profile = null) {
  await page.addInitScript(({ member }) => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    window.__golfjoinProductionDiagnosticConsole = [];
    window.__golfJoinThemeFirstCardCount = null;
    const observeFirstThemeCards = () => {
      const observer = new MutationObserver(() => {
        if (window.__golfJoinThemeFirstCardCount !== null) return;
        if (!performance.getEntriesByName("golfjoin:mdpick:data-ready").length) return;
        const count = document.querySelectorAll("#join-section-mdpick-theme .join-mdpick-theme-card").length;
        if (count > 0) {
          window.__golfJoinThemeFirstCardCount = count;
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) observeFirstThemeCards();
    else document.addEventListener("DOMContentLoaded", observeFirstThemeCards, { once: true });
    const originalError = window.console.error.bind(window.console);
    window.console.error = (...args) => {
      window.__golfjoinProductionDiagnosticConsole.push(args);
      originalError(...args);
    };
    if (member) {
      localStorage.setItem("joinMemberProfiles", JSON.stringify({
        [member.memberSeq]: member,
        [member.memberId]: member
      }));
    }
  }, { member: profile });
}

async function mockReadOnlyDetailRequests(page) {
  await page.route(/\/goods\/(?:goods_view|add\/flight_schedule)(?:\?|$)/, async (route) => {
    const isFlight = route.request().url().includes("flight_schedule");
    await route.fulfill({
      status: 200,
      contentType: isFlight ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
      body: isFlight ? "{}" : "<!doctype html><html><body></body></html>"
    });
  });
}

async function expectStaticSafeSnapshot(page, expectedNames) {
  await expect.poll(() => page.evaluate(() => (
    window.getGolfJoinPerformanceSnapshot?.().map((entry) => entry.name) || []
  )), { timeout: 60_000 }).toEqual(expect.arrayContaining(expectedNames));
  const snapshot = await page.evaluate(() => window.getGolfJoinPerformanceSnapshot());
  expect(snapshot.length).toBeGreaterThan(0);
  expect(snapshot.every((entry) => (
    Object.keys(entry).join(",") === "name,entryType,startTime,duration"
    && entry.name.startsWith("golfjoin:")
  ))).toBe(true);
  expect(JSON.stringify(snapshot)).not.toMatch(/phone|email|memberKey|memberSeq|eventPlanSeq|goodSeq|eventSeq/i);
}

test("deployed public page records boot, first image, and detail marks", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await captureSafeConsole(page);
  await mockReadOnlyDetailRequests(page);
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  await expectStaticSafeSnapshot(page, [
    "golfjoin:boot:start",
    "golfjoin:boot:interactive",
    "golfjoin:boot:products-ready",
    "golfjoin:mdpick:data-ready",
    "golfjoin:mdpick:primary-render-start",
    "golfjoin:mdpick:primary-dom-ready",
    "golfjoin:boot:bootstrap-settled",
    "golfjoin:image:mdpick-first-ready",
    "golfjoin:duration:boot-interactive",
    "golfjoin:duration:home-products",
    "golfjoin:duration:mdpick-data",
    "golfjoin:duration:mdpick-primary-render",
    "golfjoin:duration:mdpick-data-to-dom",
    "golfjoin:duration:home-bootstrap",
    "golfjoin:duration:mdpick-first-image"
  ]);
  const mdPickImageRequestDelay = await page.evaluate(() => {
    const entries = window.getGolfJoinPerformanceSnapshot();
    const dataReady = entries.find((entry) => entry.name === "golfjoin:mdpick:data-ready");
    const imagePaths = new Set([...document.querySelectorAll("#joinMdPickSection .join-mdpick-card img")]
      .map((image) => image.currentSrc || image.getAttribute("src") || "")
      .filter(Boolean)
      .map((url) => new URL(url, location.href).pathname));
    const imageRequest = window.performance.getEntriesByType("resource")
      .filter((entry) => imagePaths.has(new URL(entry.name).pathname))
      .sort((a, b) => a.startTime - b.startTime)[0];
    return imageRequest && dataReady
      ? Math.max(0, imageRequest.startTime - dataReady.startTime)
      : null;
  });
  expect(mdPickImageRequestDelay).not.toBeNull();
  expect(mdPickImageRequestDelay).toBeGreaterThanOrEqual(0);
  expect(mdPickImageRequestDelay).toBeLessThanOrEqual(100);
  await expect(page.locator("#joinMdPickSection .join-mdpick-card img").first()).toHaveAttribute("loading", "eager");

  const deferredTheme = page.locator("#joinMdPickSection [data-mdpick-theme-deferred]");
  if (await deferredTheme.count()) {
    await deferredTheme.scrollIntoViewIfNeeded();
  }
  await expect.poll(() => page.locator("#join-section-mdpick-theme .join-mdpick-theme-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  await page.evaluate(() => stopMdPickThemeAutoSlide());
  await expect.poll(() => page.evaluate(() => window.__golfJoinThemeFirstCardCount)).toBe(3);
  await expect(page.locator("#join-section-mdpick-theme [data-mdpick-theme-group].active .join-mdpick-theme-card")).toHaveCount(3);

  const nextTheme = await page.evaluate(() => {
    const themes = getVisibleMdPickThemes();
    const activeKey = document.querySelector("#join-section-mdpick-theme [data-mdpick-theme-group].active")
      ?.dataset?.mdpickThemeGroup || "";
    const theme = themes.find((item) => item.key !== activeKey);
    return theme ? {
      key: theme.key,
      images: theme.items.map((product) => product.image || product.thumb || "").filter(Boolean)
    } : null;
  });
  expect(nextTheme).not.toBeNull();
  await page.evaluate(({ key, images }) => {
    images.forEach((url) => mdPickImagePrefetchUrls.delete(url));
    const tab = [...document.querySelectorAll("#join-section-mdpick-theme .join-mdpick-theme-tab")]
      .find((button) => (button.getAttribute("onclick") || "").includes(`'${key}'`));
    tab?.dispatchEvent(new MouseEvent("mouseenter"));
  }, nextTheme);
  await expect.poll(() => page.evaluate(({ images }) => (
    images.length > 0 && images.every((url) => mdPickImagePrefetchUrls.has(url))
  ), nextTheme)).toBe(true);
  await page.evaluate(({ key }) => setMdPickTheme(key), nextTheme);
  await expect(page.locator(`#join-section-mdpick-theme [data-mdpick-theme-group="${nextTheme.key}"].active .join-mdpick-theme-card`)).toHaveCount(3);

  const brokenThemeImage = page.locator(`#join-section-mdpick-theme [data-mdpick-theme-group="${nextTheme.key}"] .join-mdpick-theme-thumb img`).first();
  await brokenThemeImage.evaluate((image) => {
    image.src = "data:image/png;base64,broken-image";
  });
  await expect(brokenThemeImage.locator("..")).toHaveClass(/is-image-fallback/);

  const brokenPrimaryImage = page.locator("#joinMdPickSection .join-mdpick-card .join-mdpick-thumb img").first();
  await brokenPrimaryImage.evaluate((image) => {
    image.src = "data:image/png;base64,broken-image";
  });
  await expect(brokenPrimaryImage.locator("..")).toHaveClass(/is-image-fallback/);

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

  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click();
  await expect(page.locator("#detailModal")).toHaveClass(/\bopen\b/);
  await expectStaticSafeSnapshot(page, [
    "golfjoin:detail:start",
    "golfjoin:detail:visible",
    "golfjoin:detail:erp-ready",
    "golfjoin:detail:flight-ready",
    "golfjoin:duration:detail-visible",
    "golfjoin:duration:detail-erp",
    "golfjoin:duration:detail-flight"
  ]);
  expect(pageErrors).toEqual([]);
});

test("deployed code records private hydration and masks a synthetic member", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await captureSafeConsole(page, DIAGNOSTIC_MEMBER);

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
      payload = { rows: [DIAGNOSTIC_MEMBER], synthetic: true };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload)
    });
  });
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await page.evaluate((profile) => {
    setJoinSessionMember(profile);
  }, DIAGNOSTIC_MEMBER);
  const syntheticLoginState = await page.evaluate(() => ({
    isLogin: getJoinLoginState().isLogin,
    hasSessionStorage: Boolean(sessionStorage.getItem("joinSessionMember")),
    hasSessionMember: Boolean(getJoinSessionMember()?.isSessionMember)
  }));
  expect(syntheticLoginState).toEqual({
    isLogin: true,
    hasSessionStorage: true,
    hasSessionMember: true
  });
  await page.evaluate(() => hydrateHomeSecondaryData());
  await expectStaticSafeSnapshot(page, [
    "golfjoin:private:start",
    "golfjoin:private:ready",
    "golfjoin:duration:private-data"
  ]);

  await page.evaluate((profile) => {
    golfJoinSafeError(`${profile.memberName} ${profile.memberMobile} ${profile.memberEmail}`, {
      memberSeq: profile.memberSeq,
      memberId: profile.memberId,
      endpoint: `https://example.com/member/read?memberKey=seq:${profile.memberSeq}&email=${profile.memberEmail}`,
      status: 500
    });
  }, DIAGNOSTIC_MEMBER);
  const captured = await page.evaluate(() => JSON.stringify(window.__golfjoinProductionDiagnosticConsole || []));
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
