"use strict";

const { test, expect } = require("@playwright/test");

const REVISION = "gha_fa7df4e8e602419ba81a56ed";
const CSS_URL = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${REVISION}/golfjoin-main.css`;
const JS_URL = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${REVISION}/golfjoin-main.js`;
const CSS_SRI = "sha256-FJnb28o+8rIXDqVBXlhjBqHXxFQTxs/QVsPeNiRMg8s=";
const JS_SRI = "sha256-OFWxTZQbLuf05WhcgObC0bdYMeRDyoJbiB5Xikauvfw=";

test("13단계 운영 전환본은 실제 PC·MO에서 외부 자산·상세·스크롤이 정상이다", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  const host = mobile ? "https://m.secret-tour.com" : "https://www.secret-tour.com";
  const url = `${host}/event/plan_view?eventPlanSeq=3&page=1&codex_stage13=cutover_${Date.now()}`;
  const assetResponses = [];
  const pageErrors = [];

  page.on("response", (response) => {
    if (response.url() === CSS_URL || response.url() === JS_URL) {
      assetResponses.push({
        url: response.url(),
        status: response.status(),
        contentEncoding: response.headers()["content-encoding"] || "identity",
        contentType: response.headers()["content-type"] || ""
      });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const failureNotice = page.locator("#golfJoinExternalAssetFailureNotice");
  const firstCard = page.locator("#join-section-mdpick .join-mdpick-card").first();
  const detailModal = page.locator("#detailModal");
  await expect(failureNotice).toBeHidden({ timeout: 30_000 });
  await expect(firstCard).toBeVisible({ timeout: 45_000 });

  const initial = await page.evaluate(({ cssUrl, jsUrl }) => {
    const css = document.querySelector(`link[href="${cssUrl}"]`);
    const js = document.querySelector(`script[src="${jsUrl}"]`);
    return {
      failure: document.documentElement.getAttribute("data-golfjoin-external-asset-failure") || "",
      cssIntegrity: css?.getAttribute("integrity") || "",
      jsIntegrity: js?.getAttribute("integrity") || "",
      cssLoaded: Array.from(document.styleSheets).some((sheet) => sheet.href === cssUrl),
      scrollable: document.documentElement.scrollHeight > window.innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
    };
  }, { cssUrl: CSS_URL, jsUrl: JS_URL });
  expect(initial.failure).toBe("");
  expect(initial.cssIntegrity).toBe(CSS_SRI);
  expect(initial.jsIntegrity).toBe(JS_SRI);
  expect(initial.cssLoaded).toBe(true);
  expect(initial.scrollable).toBe(true);
  if (mobile) expect(initial.horizontalOverflow).toBeLessThanOrEqual(2);

  expect(assetResponses.filter((item) => item.url === CSS_URL)).toHaveLength(1);
  expect(assetResponses.filter((item) => item.url === JS_URL)).toHaveLength(1);
  expect(assetResponses.every((item) => item.status === 200)).toBe(true);
  expect(assetResponses.every((item) => item.contentEncoding === "gzip")).toBe(true);
  expect(assetResponses.find((item) => item.url === CSS_URL)?.contentType).toMatch(/^text\/css/);
  expect(assetResponses.find((item) => item.url === JS_URL)?.contentType).toMatch(/^application\/javascript/);

  await firstCard.click();
  await expect(detailModal).toBeVisible({ timeout: 60_000 });
  const periodOptions = detailModal.locator(".detail-family-period-option");
  await expect(periodOptions.first()).toBeVisible({ timeout: 30_000 });
  expect(await periodOptions.count()).toBe(3);

  await periodOptions.nth(1).click();
  await expect(periodOptions.nth(1)).toHaveClass(/is-selected/, { timeout: 30_000 });
  await expect(detailModal).toContainText("10박 12일");
  await expect(detailModal).toContainText("540,000원");

  const locked = await page.evaluate(() => ({
    position: getComputedStyle(document.body).position,
    top: getComputedStyle(document.body).top
  }));
  expect(locked.position).toBe("fixed");
  expect(locked.top).toMatch(/^-\d+px$/);

  const closeButton = mobile
    ? detailModal.getByRole("button", { name: "뒤로가기" })
    : detailModal.locator(".modal-close-icon");
  await expect(closeButton).toBeVisible({ timeout: 15_000 });
  await closeButton.click();
  await expect(detailModal).toBeHidden({ timeout: 15_000 });

  const restored = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    bodyPosition: getComputedStyle(document.body).position,
    failure: document.documentElement.getAttribute("data-golfjoin-external-asset-failure") || ""
  }));
  expect(restored.scrollY).toBeGreaterThan(100);
  expect(restored.bodyPosition).not.toBe("fixed");
  expect(restored.failure).toBe("");
  expect(pageErrors).toEqual([]);
});

test("13단계 운영 전환본은 재방문에서 외부 CSS·JS 캐시를 사용한다", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "동일 불변 자산의 캐시는 PC 대표 검사로 확인한다");
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  const servedFromCache = new Set();
  const repeatResponses = [];
  let repeat = false;

  client.on("Network.requestServedFromCache", ({ requestId }) => {
    if (repeat) servedFromCache.add(requestId);
  });
  client.on("Network.responseReceived", ({ requestId, response }) => {
    if (repeat && (response.url === CSS_URL || response.url === JS_URL)) {
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

  const url = `https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1&codex_stage13=cache_${Date.now()}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#join-section-mdpick .join-mdpick-card").first()).toBeVisible({ timeout: 45_000 });
  await page.goto("about:blank");
  repeat = true;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#join-section-mdpick .join-mdpick-card").first()).toBeVisible({ timeout: 45_000 });

  expect(repeatResponses).toHaveLength(2);
  for (const response of repeatResponses) {
    expect(
      servedFromCache.has(response.requestId)
        || response.fromDiskCache
        || response.fromPrefetchCache
        || response.fromServiceWorker
        || response.status === 304,
      JSON.stringify(response)
    ).toBe(true);
  }
  await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeHidden();
});
