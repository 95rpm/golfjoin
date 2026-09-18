"use strict";

const { test, expect } = require("@playwright/test");

test("13단계 18번 경량 HTML은 실제 PC·MO에서 상품 상세와 스크롤을 유지한다", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  const host = mobile ? "https://m.secret-tour.com" : "https://www.secret-tour.com";
  const url = `${host}/event/event_view?eventPlanSeq=18&page=0&codex_stage13=live_${Date.now()}`;

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const failureNotice = page.locator("#golfJoinExternalAssetFailureNotice");
  const firstCard = page.locator("#join-section-mdpick .join-mdpick-card").first();
  const detailModal = page.locator("#detailModal");

  await expect(failureNotice).toBeHidden({ timeout: 30_000 });
  await expect(firstCard).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-golfjoin-external-asset-failure", /.+/);

  await firstCard.click();
  await expect(detailModal).toBeVisible({ timeout: 60_000 });
  await expect(detailModal).toHaveClass(/\bopen\b/);

  const periodOptions = detailModal.locator(".detail-family-period-option");
  await expect(periodOptions.first()).toBeVisible({ timeout: 30_000 });
  expect(await periodOptions.count()).toBeGreaterThan(0);

  const lockedState = await page.evaluate(() => ({
    bodyPosition: getComputedStyle(document.body).position,
    bodyTop: getComputedStyle(document.body).top
  }));
  expect(lockedState.bodyPosition).toBe("fixed");
  expect(lockedState.bodyTop).toMatch(/^-\d+px$/);

  if (await periodOptions.count() > 1) {
    await periodOptions.nth(1).click();
    await expect(periodOptions.nth(1)).toHaveClass(/is-selected/, { timeout: 30_000 });
  }

  const closeButton = mobile
    ? detailModal.getByRole("button", { name: "뒤로가기" })
    : detailModal.locator(".modal-close-icon");
  await expect(closeButton).toBeVisible({ timeout: 15_000 });
  await closeButton.click();
  await expect(detailModal).toBeHidden({ timeout: 15_000 });

  const restoredState = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    bodyPosition: getComputedStyle(document.body).position,
    failure: document.documentElement.getAttribute("data-golfjoin-external-asset-failure") || ""
  }));
  expect(restoredState.scrollY).toBeGreaterThan(100);
  expect(restoredState.bodyPosition).not.toBe("fixed");
  expect(restoredState.failure).toBe("");
});

test("13단계 외부 CSS·JS는 동일 페이지 재방문에서 브라우저 캐시를 사용한다", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "PC에서 동일 불변 URL 캐시를 대표 검증한다");

  const client = await context.newCDPSession(page);
  await client.send("Network.enable");

  const repeatResponses = [];
  const servedFromCacheRequestIds = new Set();
  let captureRepeat = false;
  client.on("Network.requestServedFromCache", ({ requestId }) => {
    if (captureRepeat) servedFromCacheRequestIds.add(requestId);
  });
  client.on("Network.responseReceived", ({ requestId, response }) => {
    if (captureRepeat && /\/golfjoin-main\.(css|js)$/.test(response.url)) {
      repeatResponses.push({
        requestId,
        url: response.url,
        status: response.status,
        fromDiskCache: Boolean(response.fromDiskCache),
        fromPrefetchCache: Boolean(response.fromPrefetchCache),
        fromServiceWorker: Boolean(response.fromServiceWorker)
      });
    }
  });

  const url = `https://www.secret-tour.com/event/event_view?eventPlanSeq=18&page=0&codex_stage13=cache_${Date.now()}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#join-section-mdpick .join-mdpick-card").first()).toBeVisible({ timeout: 45_000 });

  await page.goto("about:blank");
  captureRepeat = true;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#join-section-mdpick .join-mdpick-card").first()).toBeVisible({ timeout: 45_000 });

  expect(repeatResponses).toHaveLength(2);
  for (const response of repeatResponses) {
    expect(
      servedFromCacheRequestIds.has(response.requestId)
        || response.fromDiskCache
        || response.fromPrefetchCache
        || response.fromServiceWorker
        || response.status === 304,
      JSON.stringify(response)
    ).toBe(true);
  }
  await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeHidden();
});
