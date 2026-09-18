"use strict";

const { test, expect } = require("@playwright/test");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";

test("deployed non-cohort browser stays on Legacy without release requests", async ({ page }) => {
  const homeUrl = test.info().project.name === "mobile-chrome"
    ? MOBILE_HOME_URL
    : DESKTOP_HOME_URL;
  const releaseRequests = [];
  const pageErrors = [];

  page.on("request", (request) => {
    const url = request.url();
    if (
      url.includes("/web/release-manifest-v2.json")
      || url.includes("/web/releases/")
    ) {
      releaseRequests.push(url);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", "9999");
  });

  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);

  const diagnostics = await page.evaluate(() => getGolfJoinHomeDataV2Diagnostics());
  expect(diagnostics.autoBootEnabled).toBe(true);
  expect(diagnostics.rolloutBasisPoints).toBe(1000);
  expect(diagnostics.rolloutBucket).toBe(9999);
  expect(diagnostics.rolloutEligible).toBe(false);
  expect(diagnostics.state).toBe("LEGACY_READY");
  expect(diagnostics.reason).toBe("rollout_not_eligible");
  expect(diagnostics.requestCount).toBe(0);
  expect(diagnostics.hasCandidate).toBe(false);
  expect(diagnostics.committedReleaseRevision).toBe("");

  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollBy(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll);

  await page.waitForTimeout(1_000);
  expect(releaseRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("deployed eligible cohort honors remote OFF after one manifest request", async ({ page }) => {
  const homeUrl = test.info().project.name === "mobile-chrome"
    ? MOBILE_HOME_URL
    : DESKTOP_HOME_URL;
  const releaseRequests = [];
  const pageErrors = [];

  page.on("request", (request) => {
    const url = request.url();
    if (
      url.includes("/web/release-manifest-v2.json")
      || url.includes("/web/releases/")
    ) {
      releaseRequests.push(url);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", "0");
  });

  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  const diagnostics = await page.evaluate(() => getGolfJoinHomeDataV2Diagnostics());
  expect(diagnostics.autoBootEnabled).toBe(true);
  expect(diagnostics.rolloutBucket).toBe(0);
  expect(diagnostics.rolloutEligible).toBe(true);
  expect(diagnostics.state).toBe("LEGACY_READY");
  expect(diagnostics.reason).toBe("remote_gate_off");
  expect(diagnostics.requestCount).toBe(1);
  expect(diagnostics.hasCandidate).toBe(false);
  expect(diagnostics.committedReleaseRevision).toBe("");
  expect(releaseRequests).toHaveLength(1);
  expect(releaseRequests[0]).toContain("/web/release-manifest-v2.json");
  expect(pageErrors).toEqual([]);
});
