"use strict";

const { test, expect } = require("@playwright/test");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";

async function waitForStableHomeLayout(page) {
  let previousSignature = "";
  let stableSamples = 0;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const metrics = await page.evaluate(() => {
      const root = document.getElementById("secret-golf-join");
      return {
        rootHeight: root?.scrollHeight || 0,
        pageHeight: document.scrollingElement?.scrollHeight || 0,
        sectionCount: root?.querySelectorAll(".join-product-section").length || 0,
        mdPickCount: root?.querySelectorAll("#joinMdPickSection .join-mdpick-card").length || 0,
        loadingCount: root?.querySelectorAll(".join-product-section.layout-loading").length || 0
      };
    });
    const signature = JSON.stringify(metrics);
    stableSamples = metrics.loadingCount === 0 && signature === previousSignature ? stableSamples + 1 : 0;
    if (stableSamples >= 4) return;
    previousSignature = signature;
    await page.waitForTimeout(400);
  }
  throw new Error("home_layout_not_stable");
}

test("로그아웃 메인 진입·스크롤·MD PICK 이미지·상세 열기/닫기", async ({ page }) => {
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });

  const root = page.locator("#secret-golf-join");
  await expect(root).toBeVisible();
  await page.waitForFunction(() => document.querySelectorAll("#joinMdPickSection .join-mdpick-card").length > 0, null, {
    timeout: 30_000
  });

  const mySectionVisible = await page.locator("#join-section-my").evaluateAll((sections) => sections.some((section) => {
    const style = window.getComputedStyle(section);
    return !section.hidden && style.display !== "none" && style.visibility !== "hidden";
  }));
  expect(mySectionVisible).toBe(false);

  const mdPickSection = page.locator("#joinMdPickSection");
  await mdPickSection.scrollIntoViewIfNeeded();
  const firstCard = mdPickSection.locator(".join-mdpick-card").first();
  await expect(firstCard).toBeVisible();
  const firstImage = firstCard.locator("img").first();
  await expect(firstImage).toBeVisible();
  await expect.poll(() => firstImage.evaluate((image) => image.complete && image.naturalWidth > 0), {
    timeout: 20_000
  }).toBe(true);
  await waitForStableHomeLayout(page);

  await firstCard.scrollIntoViewIfNeeded();
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
  expect(scrollBeforeOpen).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.__golfjoinE2eCardClickScrollY = null;
    const captureCardClickScroll = (event) => {
      if (!event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) return;
      window.__golfjoinE2eCardClickScrollY = window.scrollY;
      document.removeEventListener("click", captureCardClickScroll, true);
    };
    document.addEventListener("click", captureCardClickScroll, true);
  });

  await firstCard.click();
  const scrollAtClick = await page.evaluate(() => window.__golfjoinE2eCardClickScrollY);
  expect(scrollAtClick).toBeGreaterThan(0);
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/);
  await expect(detailModal.locator("#detailModalTitle")).not.toHaveText("");

  const mobileLockedScrollTop = await page.evaluate(() => {
    if (!window.matchMedia?.("(max-width: 640px)")?.matches) return null;
    if (document.body.style.position !== "fixed") return null;
    const lockedTop = Math.abs(Number.parseFloat(document.body.style.top));
    return Number.isFinite(lockedTop) ? lockedTop : null;
  });
  if (mobileLockedScrollTop != null) {
    expect(Math.abs(mobileLockedScrollTop - scrollAtClick)).toBeLessThanOrEqual(3);
  }

  const backgroundState = await root.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return { connected: element.isConnected, display: style.display, visibility: style.visibility };
  });
  expect(backgroundState.connected).toBe(true);
  expect(backgroundState.display).not.toBe("none");
  expect(backgroundState.visibility).not.toBe("hidden");

  const visibleCloseButton = detailModal.locator(
    ".detail-slider-back:visible, .modal-close-icon:visible"
  ).first();
  await expect(visibleCloseButton).toBeVisible();
  await visibleCloseButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);

  await expect.poll(() => page.evaluate((target) => Math.abs(window.scrollY - target), scrollAtClick), { timeout: 5_000 })
    .toBeLessThanOrEqual(3);
  const scrollAfterClose = await page.evaluate(() => window.scrollY);
  expect(Math.abs(scrollAfterClose - scrollAtClick)).toBeLessThanOrEqual(3);
});

test("상품상세 응답 대기 중 닫아도 모달과 스크롤이 복원 상태를 유지한다", async ({ page }) => {
  test.setTimeout(120_000);
  let delayedDetailRequestCount = 0;
  await page.route(/\/goods\/goods_view(?:\?|$)/, async (route) => {
    delayedDetailRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.continue();
  });

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForFunction(() => document.querySelectorAll("#joinMdPickSection .join-mdpick-card").length > 0, null, {
    timeout: 30_000
  });
  await waitForStableHomeLayout(page);

  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  await firstCard.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.__golfjoinE2eCardClickScrollY = null;
    const captureCardClickScroll = (event) => {
      if (!event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) return;
      window.__golfjoinE2eCardClickScrollY = window.scrollY;
      document.removeEventListener("click", captureCardClickScroll, true);
    };
    document.addEventListener("click", captureCardClickScroll, true);
  });

  const detailResponsePromise = page.waitForResponse(
    (response) => /\/goods\/goods_view(?:\?|$)/.test(response.url()),
    { timeout: 60_000 }
  );
  await firstCard.click();

  const scrollAtClick = await page.evaluate(() => window.__golfjoinE2eCardClickScrollY);
  expect(scrollAtClick).toBeGreaterThan(0);
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/);
  await expect.poll(() => delayedDetailRequestCount).toBeGreaterThan(0);

  const closeButton = detailModal.locator(
    ".detail-slider-back:visible, .modal-close-icon:visible"
  ).first();
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate((target) => Math.abs(window.scrollY - target), scrollAtClick), { timeout: 5_000 })
    .toBeLessThanOrEqual(3);

  const detailResponse = await detailResponsePromise;
  expect(detailResponse.ok()).toBe(true);
  await page.waitForTimeout(500);
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  const scrollAfterLateResponse = await page.evaluate(() => window.scrollY);
  expect(Math.abs(scrollAfterLateResponse - scrollAtClick)).toBeLessThanOrEqual(3);
});

test("이전 상품 상세 응답이 늦게 도착해도 새 상품 모달을 덮어쓰지 않는다", async ({ page }) => {
  test.setTimeout(180_000);
  let requestPhase = "first";
  let firstDetailRequestCount = 0;
  let firstDetailResponseCount = 0;
  let secondDetailRequestCount = 0;
  let secondDetailResponseCount = 0;
  const firstDetailUrls = new Set();
  const secondDetailUrls = new Set();
  let releaseFirstDetailRequest;
  const firstDetailRequestGate = new Promise((resolve) => {
    releaseFirstDetailRequest = resolve;
  });

  page.on("response", (response) => {
    if (firstDetailUrls.has(response.url())) firstDetailResponseCount += 1;
    if (secondDetailUrls.has(response.url())) secondDetailResponseCount += 1;
  });
  await page.route(/\/goods\/goods_view(?:\?|$)/, async (route) => {
    if (requestPhase === "first") {
      firstDetailRequestCount += 1;
      firstDetailUrls.add(route.request().url());
      await firstDetailRequestGate;
    } else {
      secondDetailRequestCount += 1;
      secondDetailUrls.add(route.request().url());
    }
    await route.continue();
  });

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForFunction(() => document.querySelectorAll("#joinMdPickSection .join-mdpick-card").length > 1, null, {
    timeout: 30_000
  });
  await waitForStableHomeLayout(page);

  const cards = page.locator("#joinMdPickSection .join-mdpick-card");
  const firstCard = cards.nth(0);
  const secondCard = cards.nth(1);
  const detailModal = page.locator("#detailModal");
  const detailTitle = detailModal.locator("#detailModalTitle");
  const firstCardTitle = await firstCard.locator(".join-mdpick-title").textContent();
  const secondCardTitle = await secondCard.locator(".join-mdpick-title").textContent();
  expect(firstCardTitle).toBeTruthy();
  expect(secondCardTitle).toBeTruthy();
  expect(secondCardTitle).not.toBe(firstCardTitle);

  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click();
  await expect(detailModal).toHaveClass(/\bopen\b/);
  await expect.poll(() => firstDetailRequestCount).toBeGreaterThan(0);
  const firstTitle = await detailTitle.textContent();
  expect(firstTitle).toBeTruthy();

  let closeButton = detailModal.locator(
    ".detail-slider-back:visible, .modal-close-icon:visible"
  ).first();
  await closeButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  requestPhase = "second";

  await secondCard.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.__golfjoinE2eSecondCardClickScrollY = null;
    const captureSecondCardClickScroll = (event) => {
      if (!event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) return;
      window.__golfjoinE2eSecondCardClickScrollY = window.scrollY;
      document.removeEventListener("click", captureSecondCardClickScroll, true);
    };
    document.addEventListener("click", captureSecondCardClickScroll, true);
  });
  await secondCard.click();
  const secondClickScroll = await page.evaluate(() => window.__golfjoinE2eSecondCardClickScrollY);
  expect(secondClickScroll).toBeGreaterThan(0);
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 45_000 });
  await expect.poll(() => secondDetailRequestCount).toBeGreaterThan(0);
  try {
    await expect.poll(() => secondDetailResponseCount, { timeout: 60_000 }).toBeGreaterThan(0);
    await expect(detailTitle).toHaveText(secondCardTitle, { timeout: 30_000 });
  } catch (error) {
    releaseFirstDetailRequest();
    throw error;
  }
  const secondTitle = secondCardTitle;

  releaseFirstDetailRequest();
  await expect.poll(() => firstDetailResponseCount, { timeout: 60_000 })
    .toBeGreaterThanOrEqual(firstDetailRequestCount);
  await page.waitForTimeout(500);
  await expect(detailModal).toHaveClass(/\bopen\b/);
  await expect(detailTitle).toHaveText(secondTitle);

  closeButton = detailModal.locator(
    ".detail-slider-back:visible, .modal-close-icon:visible"
  ).first();
  await closeButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate((target) => Math.abs(window.scrollY - target), secondClickScroll), { timeout: 5_000 })
    .toBeLessThanOrEqual(3);
});

test("상품군 여행기간을 연속 선택해도 마지막 선택만 유지한다", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForFunction(() => document.querySelectorAll("#joinMdPickSection .join-mdpick-card").length > 0, null, {
    timeout: 30_000
  });
  await waitForStableHomeLayout(page);

  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  await firstCard.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.__golfjoinE2eCardClickScrollY = null;
    const captureCardClickScroll = (event) => {
      if (!event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) return;
      window.__golfjoinE2eCardClickScrollY = window.scrollY;
      document.removeEventListener("click", captureCardClickScroll, true);
    };
    document.addEventListener("click", captureCardClickScroll, true);
  });
  await firstCard.click();

  const scrollAtClick = await page.evaluate(() => window.__golfjoinE2eCardClickScrollY);
  expect(scrollAtClick).toBeGreaterThan(0);
  const detailModal = page.locator("#detailModal");
  const detailTitle = detailModal.locator("#detailModalTitle");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 45_000 });
  await expect.poll(
    () => detailModal.locator(".detail-family-period-option").count(),
    { timeout: 60_000 }
  ).toBeGreaterThanOrEqual(2);

  const initialTitle = await detailTitle.textContent();
  const originalOption = detailModal.locator(".detail-family-period-option.is-selected").first();
  await expect(originalOption).toHaveCount(1);
  const originalGoodSeq = await originalOption.getAttribute("data-family-good-seq");
  expect(originalGoodSeq).toBeTruthy();
  const alternateOption = detailModal.locator(".detail-family-period-option:not(.is-selected)").first();
  const alternateGoodSeq = await alternateOption.getAttribute("data-family-good-seq");
  expect(alternateGoodSeq).toBeTruthy();
  expect(alternateGoodSeq).not.toBe(originalGoodSeq);

  await page.route(/\/goods\/goods_view(?:\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.continue();
  });

  const alternateSelector = `.detail-family-period-option[data-family-good-seq="${alternateGoodSeq}"]`;
  const originalSelector = `.detail-family-period-option[data-family-good-seq="${originalGoodSeq}"]`;
  const alternateClick = detailModal.locator(alternateSelector).click({ timeout: 90_000 });
  await page.waitForTimeout(50);
  const originalClick = detailModal.locator(originalSelector).click({ timeout: 90_000 });
  await Promise.all([alternateClick, originalClick]);

  await expect.poll(async () => (
    detailModal.locator(".detail-family-period-option.is-selected").first().getAttribute("data-family-good-seq")
  ), { timeout: 60_000 }).toBe(originalGoodSeq);
  await expect(detailModal.locator(".detail-family-period-option.is-selected")).toHaveCount(1);
  await expect(detailTitle).toHaveText(initialTitle);

  const closeButton = detailModal.locator(
    ".detail-slider-back:visible, .modal-close-icon:visible"
  ).first();
  await closeButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate((target) => Math.abs(window.scrollY - target), scrollAtClick), { timeout: 5_000 })
    .toBeLessThanOrEqual(3);
});
