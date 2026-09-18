"use strict";

const { test, expect } = require("@playwright/test");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const ACTIVE_RELEASE_REVISION = "gjr_e010727ecd2b7a7610a3c129";
const SYNTHETIC_MEMBER = Object.freeze({
  memberSeq: "39999999",
  memberId: "e2e_v2_member",
  memberName: "E2E_V2_MEMBER"
});

function getHomeUrl() {
  return test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
}

function isReleaseV2Url(url) {
  return url.includes("/web/release-manifest-v2.json") || url.includes("/web/releases/");
}

function isLegacyHomeCoreUrl(url) {
  return url.includes("/web/golfjoin_home_cards.json")
    || url.includes("/web/product-family/manifest.json")
    || url.includes("action=home_bootstrap_light");
}

async function installRolloutBucket(page, bucket) {
  await page.addInitScript((value) => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", String(value));
  }, bucket);
}

async function installSyntheticMemberShell(page) {
  const homeUrl = new URL(getHomeUrl());
  await page.route((url) => (
    url.origin === homeUrl.origin
    && url.pathname === homeUrl.pathname
    && url.searchParams.get("eventPlanSeq") === homeUrl.searchParams.get("eventPlanSeq")
  ), async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const marker = `<div hidden>CookieData(userSeq=${SYNTHETIC_MEMBER.memberSeq},userId=${SYNTHETIC_MEMBER.memberId},userNm=${SYNTHETIC_MEMBER.memberName},userChnCd=E2E)</div>`;
    const headers = { ...response.headers() };
    delete headers["content-length"];
    delete headers["content-encoding"];
    await route.fulfill({
      status: response.status(),
      headers,
      body: html.replace("</body>", `${marker}</body>`)
    });
  });
  await page.route("**/golfjoin-sheet-api?**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("action") || "";
    const payload = action === "home_bootstrap_light"
      ? { newScheduleSummaries: [], participantSummaries: [], displayRules: [], synthetic: true }
      : action === "home_stats"
        ? { recent30DayVisitors: 0, activeUsersNow: 0, synthetic: true }
        : { rows: [], synthetic: true };
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload)
    });
  });
}

async function installRenderCounterShell(page) {
  const homeUrl = new URL(getHomeUrl());
  await page.route((url) => (
    url.origin === homeUrl.origin
    && url.pathname === homeUrl.pathname
    && url.searchParams.get("eventPlanSeq") === homeUrl.searchParams.get("eventPlanSeq")
  ), async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const marker = "function renderJoins(options = {}) {";
    const replacement = `${marker}\n      window.__golfJoinRenderCounts ||= { total: 0, localSnapshot: 0, releaseV2: 0, other: 0 };\n      window.__golfJoinRenderCounts.total += 1;\n      if (options?.source === \"release-v2\") window.__golfJoinRenderCounts.releaseV2 += 1;\n      else if (options?.skipQuickMobileCarousel) window.__golfJoinRenderCounts.localSnapshot += 1;\n      else window.__golfJoinRenderCounts.other += 1;`;
    if ((html.match(/function renderJoins\(options = \{\}\) \{/g) || []).length !== 1) {
      throw new Error("renderJoins instrumentation marker is not unique");
    }
    const headers = { ...response.headers() };
    delete headers["content-length"];
    delete headers["content-encoding"];
    await route.fulfill({
      status: response.status(),
      headers,
      body: html.replace(marker, replacement)
    });
  });
}

async function expectPageScrolls(page) {
  const result = await page.evaluate(() => {
    const before = window.scrollY;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const target = before < maxScroll - 1
      ? Math.min(maxScroll, before + 600)
      : Math.max(0, before - 600);
    window.scrollTo(0, target);
    return { before, target };
  });
  expect(result.target).not.toBe(result.before);
  await expect.poll(() => page.evaluate((target) => Math.abs(window.scrollY - target), result.target))
    .toBeLessThanOrEqual(1);
}

test("deployed 99% non-cohort keeps Legacy with zero Release requests while remote ON", async ({ page }) => {
  const releaseRequests = [];
  const pageErrors = [];
  page.on("request", (request) => {
    if (isReleaseV2Url(request.url())) releaseRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installRolloutBucket(page, 9999);

  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  const diagnostics = await page.evaluate(() => getGolfJoinHomeDataV2Diagnostics());
  expect(diagnostics).toEqual(expect.objectContaining({
    state: "LEGACY_READY",
    reason: "rollout_not_eligible",
    requestCount: 0,
    rolloutBucket: 9999,
    rolloutEligible: false,
    startupDecisionPending: false
  }));
  await expectPageScrolls(page);
  await page.waitForTimeout(750);
  expect(releaseRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("deployed 10% cohort uses exactly three Release requests and no Legacy core requests", async ({ page }) => {
  const releaseRequests = [];
  const availabilityShardRequests = [];
  const legacyCoreRequests = [];
  const publicDetailRequests = [];
  const publicDetailResponses = [];
  const goodsViewRequests = [];
  const fullHomeSummaryRequests = [];
  const pageErrors = [];
  page.on("request", (request) => {
    const url = request.url();
    if (isReleaseV2Url(url)) releaseRequests.push(url);
    if (url.includes("/web/product-availability/")) availabilityShardRequests.push(url);
    if (isLegacyHomeCoreUrl(url)) legacyCoreRequests.push(url);
    if (url.includes("/web/product-detail/") && url.endsWith(".json")) publicDetailRequests.push(url);
    if (url.includes("/goods/goods_view?")) goodsViewRequests.push(url);
    if (url.includes("/web/golfjoin_home_summary.json")) fullHomeSummaryRequests.push(url);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/web/product-detail/") && url.endsWith(".json")) {
      publicDetailResponses.push({ url, status: response.status() });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installRolloutBucket(page, 0);

  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.evaluate(() => getGolfJoinHomeDataV2Diagnostics()), {
    timeout: 60_000
  }).toEqual(expect.objectContaining({
    state: "V2_RUNNING",
    reason: "running",
    requestCount: 3,
    rolloutBucket: 0,
    rolloutEligible: true,
    startupDecisionPending: false,
    committedReleaseRevision: ACTIVE_RELEASE_REVISION
  }));
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  const firstImage = firstCard.locator("img").first();
  await expect(firstImage).toBeVisible();
  await expect.poll(() => firstImage.evaluate((image) => image.complete && image.naturalWidth > 0), {
    timeout: 30_000
  }).toBe(true);
  await expectPageScrolls(page);
  await expect(async () => {
    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toBeVisible();
  }).toPass({ timeout: 30_000 });
  const scrollBeforeDetail = await page.evaluate(() => window.scrollY);
  await firstCard.click();
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 60_000 });
  await expect(detailModal.locator("#detailModalTitle")).not.toHaveText("");
  const periodOptions = detailModal.locator(".detail-family-period-option");
  await expect.poll(() => periodOptions.count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
  const periodGoodSeqs = await periodOptions.evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("data-family-good-seq")).filter(Boolean)
  ));
  expect(new Set(periodGoodSeqs).size).toBeGreaterThanOrEqual(2);
  await expect(detailModal.locator(".detail-family-period-option.is-selected")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => currentDetailJoinData?.secretTourDetailLoaded === true), {
    timeout: 60_000
  }).toBe(true);
  await expect.poll(() => publicDetailResponses.length, { timeout: 60_000 }).toBe(1);
  expect(publicDetailResponses[0].status).toBe(200);
  const closeButton = detailModal.locator(".detail-slider-back:visible, .modal-close-icon:visible").first();
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate((target) => Math.abs(window.scrollY - target), scrollBeforeDetail), {
    timeout: 5_000
  }).toBeLessThanOrEqual(3);
  await page.waitForTimeout(750);
  expect(releaseRequests).toHaveLength(3);
  expect(releaseRequests[0]).toContain("/web/release-manifest-v2.json");
  expect(availabilityShardRequests.length).toBeGreaterThan(0);
  expect(legacyCoreRequests).toEqual([]);
  expect(publicDetailRequests).toHaveLength(1);
  expect(goodsViewRequests).toEqual([]);
  expect(fullHomeSummaryRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("deployed synthetic member uses the same public Release as anonymous visitors", async ({ page }) => {
  const releaseRequests = [];
  const pageErrors = [];
  page.on("request", (request) => {
    if (isReleaseV2Url(request.url())) releaseRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installRolloutBucket(page, 0);
  await installSyntheticMemberShell(page);

  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.evaluate(() => getGolfJoinHomeDataV2Diagnostics()), {
    timeout: 60_000
  }).toEqual(expect.objectContaining({
    state: "V2_RUNNING",
    reason: "running",
    requestCount: 3,
    rolloutBucket: 0,
    rolloutEligible: true,
    startupDecisionPending: false,
    committedReleaseRevision: ACTIVE_RELEASE_REVISION
  }));
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  expect(await page.evaluate(() => getJoinLoginState().isLogin)).toBe(true);
  expect(releaseRequests).toHaveLength(3);
  expect(pageErrors).toEqual([]);
});

test("deployed 10% path performs one local snapshot paint and one authoritative V2 render", async ({ page }) => {
  await installRolloutBucket(page, 0);
  await installRenderCounterShell(page);

  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => getGolfJoinHomeDataV2Diagnostics()), {
    timeout: 60_000
  }).toEqual(expect.objectContaining({
    state: "V2_RUNNING",
    committedReleaseRevision: ACTIVE_RELEASE_REVISION
  }));
  await expect.poll(() => page.evaluate(() => ({
    counts: window.__golfJoinRenderCounts,
    homeRenderScheduled: Boolean(homeRenderScheduled),
    mdPickRenderScheduled: Boolean(homeMdPickRenderScheduled)
  })), { timeout: 30_000 }).toEqual({
    counts: {
      total: 2,
      localSnapshot: 1,
      releaseV2: 1,
      other: 0
    },
    homeRenderScheduled: false,
    mdPickRenderScheduled: false
  });
});
