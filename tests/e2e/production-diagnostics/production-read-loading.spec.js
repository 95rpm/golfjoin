"use strict";

const { test, expect } = require("@playwright/test");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";

test("deployed slow reads use delayed local loading without a global lock", async ({ page }) => {
  test.setTimeout(180_000);
  const homeUrl = test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;

  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.route(/\/goods\/(?:goods_view|add\/flight_schedule)(?:\?|$)/, async (route) => {
    const isFlight = route.request().url().includes("flight_schedule");
    await route.fulfill({
      status: 200,
      contentType: isFlight ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
      body: isFlight ? "{}" : "<!doctype html><html><body></body></html>"
    });
  });

  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  await expect(page.locator("#homeInitialLoadingOverlay")).not.toHaveClass(/\bopen\b/);

  await page.evaluate(() => {
    const original = loadGolfJoinProductGroupAvailability;
    window.__releaseProductionAvailability = null;
    const gate = new Promise((resolve) => {
      window.__releaseProductionAvailability = resolve;
    });
    loadGolfJoinProductGroupAvailability = async (products) => {
      await gate;
      return original(products);
    };
    window.__productionCardReadClickAt = null;
    window.__productionCardReadIndicatorDelay = null;
    document.addEventListener("click", (event) => {
      if (!event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) return;
      window.__productionCardReadClickAt = performance.now();
    }, { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (window.__productionCardReadClickAt == null) return;
      if (!document.querySelector("#joinMdPickSection .join-mdpick-card > .join-read-loading-indicator")) return;
      window.__productionCardReadIndicatorDelay = performance.now() - window.__productionCardReadClickAt;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  await firstCard.scrollIntoViewIfNeeded();
  const pageScrollBeforeRead = await page.evaluate(() => window.scrollY);
  await firstCard.click();
  await expect(firstCard).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#joinActionLoadingOverlay")).not.toHaveClass(/\bopen\b/);
  await expect(firstCard.locator(":scope > .join-read-loading-indicator")).toBeVisible({ timeout: 1_500 });
  await expect.poll(() => page.evaluate(() => window.__productionCardReadIndicatorDelay)).toBeGreaterThanOrEqual(140);

  await page.evaluate(() => window.scrollBy(0, 100));
  await expect.poll(() => page.evaluate((before) => window.scrollY > before, pageScrollBeforeRead)).toBe(true);

  await page.evaluate(() => window.__releaseProductionAvailability?.());
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 60_000 });
  await expect(firstCard.locator(":scope > .join-read-loading-indicator")).toHaveCount(0);
  await expect(firstCard).not.toHaveAttribute("aria-busy", "true");

  await expect.poll(() => detailModal.locator(".detail-family-period-option").count(), {
    timeout: 60_000
  }).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => {
    const original = loadSecretTourGoodsDetail;
    window.__releaseProductionFamilyDetail = null;
    const gate = new Promise((resolve) => {
      window.__releaseProductionFamilyDetail = resolve;
    });
    loadSecretTourGoodsDetail = async (product) => {
      await gate;
      return original(product);
    };
    window.__productionPeriodReadClickAt = null;
    window.__productionPeriodReadIndicatorDelay = null;
    document.addEventListener("click", (event) => {
      if (!event.target?.closest?.(".detail-family-period-option")) return;
      window.__productionPeriodReadClickAt = performance.now();
    }, { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (window.__productionPeriodReadClickAt == null) return;
      if (!document.querySelector("#detailModal .detail-family-periods > .join-read-loading-indicator")) return;
      window.__productionPeriodReadIndicatorDelay = performance.now() - window.__productionPeriodReadClickAt;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  const alternateOption = detailModal.locator(".detail-family-period-option:not(.is-selected)").first();
  await alternateOption.click();
  await expect(page.locator("#joinActionLoadingOverlay")).not.toHaveClass(/\bopen\b/);
  await expect(detailModal.locator(".detail-family-periods > .join-read-loading-indicator")).toBeVisible({ timeout: 1_500 });
  await expect.poll(() => page.evaluate(() => window.__productionPeriodReadIndicatorDelay)).toBeGreaterThanOrEqual(140);

  const detailBody = detailModal.locator("#detailContent");
  const detailScrollBefore = await detailBody.evaluate((element) => element.scrollTop);
  await detailBody.evaluate((element) => { element.scrollTop += 120; });
  await expect.poll(() => detailBody.evaluate((element, before) => element.scrollTop > before, detailScrollBefore)).toBe(true);

  const closeButton = detailModal.locator(".detail-slider-back:visible, .modal-close-icon:visible").first();
  await closeButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await page.evaluate(() => window.__releaseProductionFamilyDetail?.());
  await expect(detailModal.locator(".join-read-loading-indicator")).toHaveCount(0, { timeout: 60_000 });
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
});
