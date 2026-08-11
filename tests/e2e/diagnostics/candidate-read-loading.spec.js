"use strict";

const { test, expect } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = readLocalMainHtml();

function replaceEmbeddedGolfJoinHtml(shellHtml) {
  const marker = "<title>골프 조인 게시판</title>";
  const markerIndex = shellHtml.indexOf(marker);
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("candidate_read_loading_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

test("slow product reads use delayed local loading and never open the global overlay", async ({ page }) => {
  test.setTimeout(180_000);
  const homeUrl = test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;

  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.route((url) => {
    const target = new URL(homeUrl);
    return url.origin === target.origin
      && url.pathname === target.pathname
      && url.searchParams.get("eventPlanSeq") === target.searchParams.get("eventPlanSeq");
  }, async (route) => {
    const response = await route.fetch();
    const shellHtml = await response.text();
    await route.fulfill({
      response,
      body: replaceEmbeddedGolfJoinHtml(shellHtml),
      headers: { ...response.headers(), "content-type": "text/html; charset=utf-8" }
    });
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
    window.__releaseCandidateAvailability = null;
    const gate = new Promise((resolve) => {
      window.__releaseCandidateAvailability = resolve;
    });
    loadGolfJoinProductGroupAvailability = async (products) => {
      await gate;
      return original(products);
    };
  });

  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  await firstCard.scrollIntoViewIfNeeded();
  const pageScrollBeforeRead = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => {
    window.__candidateCardReadClickAt = null;
    window.__candidateCardReadIndicatorDelay = null;
    window.__candidateDeferredHomeRenderCalls = [];
    const originalRenderJoins = renderJoins;
    renderJoins = function observedCandidateRenderJoins(...args) {
      window.__candidateDeferredHomeRenderCalls.push(performance.now());
      return originalRenderJoins(...args);
    };
    document.addEventListener("click", (event) => {
      if (!event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) return;
      window.__candidateCardReadClickAt = performance.now();
      queueMicrotask(() => scheduleHomeRender({ deferWhileModalOpen: true }));
    }, { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (window.__candidateCardReadClickAt == null) return;
      if (!document.querySelector("#joinMdPickSection .join-mdpick-card > .join-read-loading-indicator")) return;
      window.__candidateCardReadIndicatorDelay = performance.now() - window.__candidateCardReadClickAt;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
  await firstCard.click();
  await expect(firstCard).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#joinActionLoadingOverlay")).not.toHaveClass(/\bopen\b/);
  await expect(firstCard.locator(":scope > .join-read-loading-indicator")).toBeVisible({ timeout: 1_500 });
  await expect.poll(() => page.evaluate(() => window.__candidateCardReadIndicatorDelay)).toBeGreaterThanOrEqual(140);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__candidateDeferredHomeRenderCalls.length)).toBe(0);

  await page.evaluate(() => window.scrollBy(0, 100));
  await expect.poll(() => page.evaluate((before) => window.scrollY > before, pageScrollBeforeRead)).toBe(true);

  await page.evaluate(() => window.__releaseCandidateAvailability?.());
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 60_000 });
  await expect(firstCard.locator(":scope > .join-read-loading-indicator")).toHaveCount(0);
  await expect(firstCard).not.toHaveAttribute("aria-busy", "true");
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__candidateDeferredHomeRenderCalls.length)).toBe(0);

  await expect.poll(() => detailModal.locator(".detail-family-period-option").count(), {
    timeout: 60_000
  }).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => {
    const original = loadSecretTourGoodsDetail;
    window.__releaseCandidateFamilyDetail = null;
    const gate = new Promise((resolve) => {
      window.__releaseCandidateFamilyDetail = resolve;
    });
    loadSecretTourGoodsDetail = async (product) => {
      await gate;
      return original(product);
    };
  });

  const alternateOption = detailModal.locator(".detail-family-period-option:not(.is-selected)").first();
  await page.evaluate(() => {
    window.__candidatePeriodReadClickAt = null;
    window.__candidatePeriodReadIndicatorDelay = null;
    document.addEventListener("click", (event) => {
      if (!event.target?.closest?.(".detail-family-period-option")) return;
      window.__candidatePeriodReadClickAt = performance.now();
    }, { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (window.__candidatePeriodReadClickAt == null) return;
      if (!document.querySelector("#detailModal .detail-family-periods > .join-read-loading-indicator")) return;
      window.__candidatePeriodReadIndicatorDelay = performance.now() - window.__candidatePeriodReadClickAt;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
  await alternateOption.click();
  await expect(page.locator("#joinActionLoadingOverlay")).not.toHaveClass(/\bopen\b/);
  await expect(detailModal.locator(".detail-family-periods > .join-read-loading-indicator")).toBeVisible({ timeout: 1_500 });
  await expect.poll(() => page.evaluate(() => window.__candidatePeriodReadIndicatorDelay)).toBeGreaterThanOrEqual(140);

  const detailBody = detailModal.locator("#detailContent");
  const detailScrollBefore = await detailBody.evaluate((element) => element.scrollTop);
  await detailBody.evaluate((element) => { element.scrollTop += 120; });
  await expect.poll(() => detailBody.evaluate((element, before) => element.scrollTop > before, detailScrollBefore)).toBe(true);

  const closeButton = detailModal.locator(".detail-slider-back:visible, .modal-close-icon:visible").first();
  await closeButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate(() => window.__candidateDeferredHomeRenderCalls.length), {
    timeout: 60_000
  }).toBe(1);
  await page.evaluate(() => window.__releaseCandidateFamilyDetail?.());
  await expect(detailModal.locator(".join-read-loading-indicator")).toHaveCount(0, { timeout: 60_000 });
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
});
