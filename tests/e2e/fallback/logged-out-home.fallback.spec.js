"use strict";

const { test, expect } = require("@playwright/test");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";

async function expectUsablePublicHome(page) {
  const root = page.locator("#secret-golf-join");
  await expect(root).toBeVisible();
  await expect.poll(
    () => page.locator("#joinMdPickSection .join-mdpick-card").count(),
    { timeout: 45_000 }
  ).toBeGreaterThan(0);
  await expect(page.locator("#homeInitialLoadingOverlay")).not.toHaveClass(/\bopen\b/, { timeout: 45_000 });

  const canScroll = await page.evaluate(() => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    return (scrollingElement?.scrollHeight || 0) > window.innerHeight;
  });
  expect(canScroll).toBe(true);
  await page.evaluate(() => window.scrollTo(0, Math.min(600, document.scrollingElement?.scrollHeight || 600)));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.locator("#joinActionLoadingOverlay")).not.toHaveClass(/\bopen\b/);
}

test("상품군 manifest 요청이 실패해도 공개 메인 카드와 스크롤을 유지한다", async ({ page }) => {
  let failedManifestRequestCount = 0;
  await page.route("**/web/product-family/manifest.json*", async (route) => {
    failedManifestRequestCount += 1;
    await route.abort("failed");
  });

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expectUsablePublicHome(page);
  expect(failedManifestRequestCount).toBeGreaterThan(0);
});

test("home_bootstrap_light가 500이어도 공개 메인 카드와 스크롤을 유지한다", async ({ page }) => {
  let failedBootstrapRequestCount = 0;
  await page.route("**/golfjoin-sheet-api?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("action") !== "home_bootstrap_light") {
      await route.continue();
      return;
    }
    failedBootstrapRequestCount += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ ok: false, error: "e2e_forced_home_bootstrap_failure" })
    });
  });

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expectUsablePublicHome(page);
  expect(failedBootstrapRequestCount).toBeGreaterThan(0);
});

test("home_bootstrap_light가 3초 지연돼도 로딩을 끝내고 공개 메인을 유지한다", async ({ page }) => {
  let delayedBootstrapRequestCount = 0;
  let observedDelayMs = 0;
  await page.route("**/golfjoin-sheet-api?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("action") !== "home_bootstrap_light") {
      await route.continue();
      return;
    }
    delayedBootstrapRequestCount += 1;
    const startedAt = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    observedDelayMs = Date.now() - startedAt;
    await route.continue();
  });

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expectUsablePublicHome(page);
  expect(delayedBootstrapRequestCount).toBeGreaterThan(0);
  await expect.poll(() => observedDelayMs, { timeout: 10_000 }).toBeGreaterThanOrEqual(2_900);
});

test("홈 manifest가 없는 카드 파일을 가리켜도 기존 홈 카드로 복구한다", async ({ page }) => {
  const missingObjectName = "web/e2e-missing-home-cards.json";
  let modifiedManifestCount = 0;
  let missingCardsRequestCount = 0;

  await page.route("**/web/e2e-missing-home-cards.json*", async (route) => {
    missingCardsRequestCount += 1;
    await route.fulfill({
      status: 404,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ error: "e2e_forced_missing_home_cards" })
    });
  });
  await page.route("**/web/golfjoin_home_manifest.json*", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    modifiedManifestCount += 1;
    await route.fulfill({
      response,
      json: {
        ...manifest,
        activeCardsObjectName: missingObjectName,
        activeCardsUrl: `https://storage.googleapis.com/golfjoin-bucket/${missingObjectName}`
      }
    });
  });

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expectUsablePublicHome(page);
  expect(modifiedManifestCount).toBeGreaterThan(0);
  expect(missingCardsRequestCount).toBeGreaterThan(0);
});

test("홈 카드 JSON이 잘못돼도 전체 홈 요약으로 복구한다", async ({ page }) => {
  const malformedObjectName = "web/e2e-malformed-home-cards.json";
  let modifiedManifestCount = 0;
  let malformedCardsRequestCount = 0;
  let homeSummaryRequestCount = 0;

  page.on("request", (request) => {
    if (/\/web\/golfjoin_home_summary\.json(?:\?|$)/.test(request.url())) {
      homeSummaryRequestCount += 1;
    }
  });
  const fulfillMalformedJson = async (route) => {
    malformedCardsRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: "{e2e-malformed-json"
    });
  };
  await page.route("**/web/e2e-malformed-home-cards.json*", fulfillMalformedJson);
  await page.route("**/web/golfjoin_home_cards.json*", fulfillMalformedJson);
  await page.route("**/web/golfjoin_home_manifest.json*", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    modifiedManifestCount += 1;
    await route.fulfill({
      response,
      json: {
        ...manifest,
        activeCardsObjectName: malformedObjectName,
        activeCardsUrl: `https://storage.googleapis.com/golfjoin-bucket/${malformedObjectName}`
      }
    });
  });

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expectUsablePublicHome(page);
  expect(modifiedManifestCount).toBeGreaterThan(0);
  expect(malformedCardsRequestCount).toBeGreaterThan(0);
  expect(homeSummaryRequestCount).toBeGreaterThan(0);
});
