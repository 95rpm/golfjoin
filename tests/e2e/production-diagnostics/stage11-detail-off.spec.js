"use strict";

const { test, expect } = require("@playwright/test");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";

function getHomeUrl() {
  return test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
}

function isPublicDetailSnapshotUrl(url) {
  return url.includes("storage.googleapis.com/golfjoin-bucket/web/product-detail/")
    && url.endsWith(".json");
}

test("Stage 11 Gate OFF detail uses one public snapshot and restores page scroll", async ({ page }) => {
  test.setTimeout(180_000);

  const requests = {
    release: [],
    publicDetail: [],
    goodsView: [],
    flightSchedule: [],
    fullHomeSummary: []
  };
  const detailResponses = [];
  const pageErrors = [];

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/web/release-manifest-v2.json") || url.includes("/web/releases/")) {
      requests.release.push(url);
    }
    if (isPublicDetailSnapshotUrl(url)) requests.publicDetail.push(url);
    if (url.includes("/goods/goods_view?")) requests.goodsView.push(url);
    if (url.includes("/goods/add/flight_schedule?")) requests.flightSchedule.push(url);
    if (url.includes("/web/golfjoin_home_summary.json")) requests.fullHomeSummary.push(url);
  });
  page.on("response", (response) => {
    if (!isPublicDetailSnapshotUrl(response.url())) return;
    detailResponses.push({ url: response.url(), status: response.status() });
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", "9999");
  });

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
    rolloutEligible: false
  }));
  expect(requests.release).toEqual([]);

  await page.evaluate(() => {
    stopQuickMobileCarousel?.();
    window.__stage11ClickAt = null;
    window.__stage11ModalOpenAt = null;
    const modal = document.getElementById("detailModal");
    const observer = new MutationObserver(() => {
      if (window.__stage11ClickAt == null || window.__stage11ModalOpenAt != null) return;
      if (modal?.classList.contains("open")) window.__stage11ModalOpenAt = performance.now();
    });
    observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) {
        window.__stage11ClickAt = performance.now();
      }
    }, { capture: true, once: true });
  });

  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  await firstCard.scrollIntoViewIfNeeded();
  await expect(firstCard).toBeVisible();
  const pageScrollBeforeOpen = await page.evaluate(() => window.scrollY);
  expect(pageScrollBeforeOpen).toBeGreaterThan(0);

  await firstCard.click();
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 1_000 });
  await expect.poll(() => page.evaluate(() => window.__stage11ModalOpenAt), { timeout: 1_000 }).not.toBeNull();

  const immediateState = await page.evaluate((expectedTop) => ({
    shellDelayMs: window.__stage11ModalOpenAt - window.__stage11ClickAt,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyLocked: document.body.classList.contains("detail-modal-page-scroll-locked"),
    expectedTop
  }), pageScrollBeforeOpen);
  expect(immediateState.shellDelayMs).toBeLessThan(100);
  expect(immediateState.bodyPosition).toBe("fixed");
  expect(immediateState.bodyLocked).toBe(true);
  expect(Math.abs(Number.parseFloat(immediateState.bodyTop) + pageScrollBeforeOpen)).toBeLessThanOrEqual(3);
  await expect(detailModal.locator("#detailModalTitle")).not.toHaveText("");

  await expect.poll(() => detailModal.locator(".detail-family-period-option").count(), {
    timeout: 60_000
  }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => currentDetailJoinData?.secretTourDetailLoaded === true), {
    timeout: 60_000
  }).toBe(true);
  await expect.poll(() => detailResponses.length, { timeout: 60_000 }).toBe(1);
  expect(detailResponses[0].status).toBe(200);

  const modalScroll = await page.evaluate(() => {
    const body = document.querySelector("#detailModal .modal-body");
    if (!body) return null;
    const before = body.scrollTop;
    const max = Math.max(0, body.scrollHeight - body.clientHeight);
    const target = Math.min(max, Math.max(1, before + 240));
    body.scrollTop = target;
    return { before, target, after: body.scrollTop, max };
  });
  expect(modalScroll).not.toBeNull();
  expect(modalScroll.max).toBeGreaterThan(0);
  expect(modalScroll.after).toBeGreaterThan(modalScroll.before);

  await page.evaluate(() => closeModal("detailModal"));
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate((target) => Math.abs(window.scrollY - target), pageScrollBeforeOpen), {
    timeout: 5_000
  }).toBeLessThanOrEqual(3);

  const restoredState = await page.evaluate(() => ({
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyLocked: document.body.classList.contains("detail-modal-page-scroll-locked")
  }));
  expect(restoredState.bodyPosition).toBe("");
  expect(restoredState.bodyTop).toBe("");
  expect(restoredState.bodyLocked).toBe(false);

  expect(requests.publicDetail).toHaveLength(1);
  expect(requests.goodsView).toEqual([]);
  expect(requests.fullHomeSummary).toEqual([]);
  expect(pageErrors).toEqual([]);

  console.log(JSON.stringify({
    project: test.info().project.name,
    shellDelayMs: Math.round(immediateState.shellDelayMs * 10) / 10,
    publicDetailRequests: requests.publicDetail.length,
    goodsViewRequests: requests.goodsView.length,
    flightScheduleRequests: requests.flightSchedule.length,
    fullHomeSummaryRequests: requests.fullHomeSummary.length,
    pageScrollBeforeOpen,
    pageScrollRestored: true,
    modalInternalScroll: true
  }));
});
