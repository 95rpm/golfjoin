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
    throw new Error("stage11_candidate_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

async function openCandidate(page) {
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
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
}

test("slow family availability opens a safe detail shell before the response", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openCandidate(page);
  await page.evaluate(() => {
    const original = loadGolfJoinProductGroupAvailability;
    window.__stage11AvailabilityRelease = null;
    const gate = new Promise((resolve) => { window.__stage11AvailabilityRelease = resolve; });
    loadGolfJoinProductGroupAvailability = async (products) => {
      await gate;
      return original(products);
    };
    window.__stage11ClickAt = null;
    window.__stage11ModalOpenAt = null;
    const modalObserver = new MutationObserver(() => {
      if (window.__stage11ClickAt == null || window.__stage11ModalOpenAt != null) return;
      if (document.getElementById("detailModal")?.classList.contains("open")) {
        window.__stage11ModalOpenAt = performance.now();
      }
    });
    modalObserver.observe(document.getElementById("detailModal"), { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) window.__stage11ClickAt = performance.now();
    }, { capture: true, once: true });
  });

  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click();
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 1_000 });
  await expect.poll(() => page.evaluate(() => window.__stage11ModalOpenAt)).not.toBeNull();
  const shellDelay = await page.evaluate(() => window.__stage11ModalOpenAt - window.__stage11ClickAt);
  expect(shellDelay).toBeLessThan(100);
  await expect(detailModal.locator(".detail-progressive-period")).toBeVisible();
  await expect(detailModal.locator(".detail-progressive-shell-block")).toHaveCount(3);
  await expect(detailModal.locator("#detailPrimaryButton")).toBeDisabled();
  await expect(detailModal.locator("#detailPrimaryButton")).toHaveText("일정 확인 중");
  await expect(page.locator("#joinActionLoadingOverlay")).not.toHaveClass(/\bopen\b/);

  await page.evaluate(() => window.__stage11AvailabilityRelease?.());
  await expect.poll(() => detailModal.locator(".detail-family-period-option").count(), {
    timeout: 60_000
  }).toBeGreaterThanOrEqual(2);
  await expect(detailModal.locator(".detail-progressive-period")).toHaveCount(0);
  await expect(detailModal.locator("#detailPrimaryButton")).toBeEnabled();
  await expect(detailModal.locator("#detailPrimaryButton")).toContainText("멤버 모집하기");
  expect(pageErrors).toEqual([]);
});

test("closing the progressive shell discards the late availability result", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openCandidate(page);
  await page.evaluate(() => {
    const original = loadGolfJoinProductGroupAvailability;
    window.__stage11CloseRelease = null;
    const gate = new Promise((resolve) => { window.__stage11CloseRelease = resolve; });
    loadGolfJoinProductGroupAvailability = async (products) => {
      await gate;
      return original(products);
    };
  });

  await page.locator("#joinMdPickSection .join-mdpick-card").first().click();
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 1_000 });
  await page.evaluate(() => closeModal("detailModal"));
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await page.evaluate(() => window.__stage11CloseRelease?.());
  await page.waitForTimeout(1_000);
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await expect(page.locator("#joinActionLoadingOverlay")).not.toHaveClass(/\bopen\b/);
  expect(pageErrors).toEqual([]);
});

test("closing during a slow goods detail read discards the late detail result", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openCandidate(page);
  await page.evaluate(() => {
    const original = loadSecretTourGoodsDetail;
    window.__stage11DetailCalled = false;
    window.__stage11DetailRelease = null;
    const gate = new Promise((resolve) => { window.__stage11DetailRelease = resolve; });
    loadSecretTourGoodsDetail = async (...args) => {
      window.__stage11DetailCalled = true;
      await gate;
      return original(...args);
    };
  });

  await page.locator("#joinMdPickSection .join-mdpick-card").first().click();
  const detailModal = page.locator("#detailModal");
  await expect.poll(() => page.evaluate(() => window.__stage11DetailCalled), { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => closeModal("detailModal"));
  await page.evaluate(() => window.__stage11DetailRelease?.());
  await page.waitForTimeout(1_000);
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate(() => currentDetailJoinData)).toBeNull();
  expect(pageErrors).toEqual([]);
});

test("a failed goods detail read exposes one-click retry and revisioned cache keys", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openCandidate(page);
  const cacheKeys = await page.evaluate(() => ({
    first: getSecretTourGoodsDetailCacheKey({ goodSeq: "30000001", eventSeq: "40000001", availabilityRevision: "gpa_first" }),
    second: getSecretTourGoodsDetailCacheKey({ goodSeq: "30000001", eventSeq: "40000001", availabilityRevision: "gpa_second" })
  }));
  expect(cacheKeys.first).not.toBe(cacheKeys.second);

  await page.evaluate(() => {
    const original = loadSecretTourGoodsDetail;
    window.__stage11DetailRetryCalls = 0;
    loadSecretTourGoodsDetail = (...args) => {
      window.__stage11DetailRetryCalls += 1;
      if (window.__stage11DetailRetryCalls === 1) return Promise.reject(new Error("stage11_expected_first_failure"));
      return original(...args);
    };
  });

  await page.locator("#joinMdPickSection .join-mdpick-card").first().click();
  const notice = page.locator("#detailModal .detail-load-retry-notice");
  await expect(notice).toBeVisible({ timeout: 60_000 });
  await expect(notice.locator("button")).toHaveText("다시 시도");
  await notice.locator("button").click();
  await expect.poll(() => page.evaluate(() => window.__stage11DetailRetryCalls), { timeout: 60_000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => currentDetailJoinData?.secretTourDetailLoaded === true), {
    timeout: 60_000
  }).toBe(true);
  await expect(notice).toHaveCount(0);
  const flightRetryMarkup = await page.evaluate(() => renderDetailFlightSummary({
    category: "해외",
    productType: "항공팩",
    airline: "대한항공",
    secretTourFlightScheduleState: "timeout"
  }));
  expect(flightRetryMarkup).toContain("retryCurrentDetailFlightSchedule()");
  expect(flightRetryMarkup).toContain("항공편 다시 확인");
  expect(pageErrors).toEqual([]);
});
