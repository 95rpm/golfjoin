"use strict";

const { test, expect } = require("@playwright/test");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";

async function openProductionHome(page) {
  const homeUrl = test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => ({
    loader: typeof loadGolfJoinProductGroupAvailability,
    context: typeof getGolfJoinProductFamilyAvailabilityContext,
    payload: typeof applyGolfJoinProductFamilyAvailabilityPayload
  })), { timeout: 30_000 }).toEqual({ loader: "function", context: "function", payload: "function" });
}

async function readVisibleFamilyFixture(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll("#joinMdPickSection .join-mdpick-card")];
    const source = getHomeProductSource().filter((product) => !product.homeReferenceOnly);
    for (let buttonIndex = 0; buttonIndex < buttons.length; buttonIndex += 1) {
      const onclick = buttons[buttonIndex].getAttribute("onclick") || "";
      const match = /openMdPickProductDetail\('([^']+)'/.exec(onclick);
      const groupKey = match?.[1] || "";
      if (!groupKey.startsWith("family-")) continue;
      const products = source.filter((product) => getProductGroupKey(product) === groupKey);
      const familyId = products.map(getGolfJoinProductFamilyId).find(Boolean) || "";
      const family = golfJoinProductFamilyById.get(familyId);
      const memberGoodSeqs = (family?.members || []).map((member) => String(member.goodSeq || "")).filter(Boolean).sort();
      const productGoodSeqs = products.map(getGolfJoinProductGoodSeq).filter(Boolean).sort();
      if (products.length < 2
        || memberGoodSeqs.length !== productGoodSeqs.length
        || memberGoodSeqs.some((goodSeq, index) => goodSeq !== productGoodSeqs[index])) continue;
      return {
        buttonIndex,
        familyId,
        productCount: products.length,
        availabilityRevision: String(products[0].availabilityRevision || golfJoinHomeManifest?.availabilityRevision || ""),
        familyRevision: String(golfJoinProductFamilyCatalog?.publicationRevision || "")
      };
    }
    return null;
  });
}

async function positionPageForRestoreCheck(page) {
  const target = await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const target = Math.min(900, Math.floor(maxScroll * 0.35));
    scrollTo(0, target);
    return target;
  });
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 10_000 }).toBe(target);
  return page.evaluate(() => scrollY);
}

async function closeDetailAndVerifyScroll(page, beforeScroll) {
  await page.evaluate(() => window.closeModal("detailModal"));
  await expect(page.locator("#detailModal")).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 10_000 }).toBe(beforeScroll);
}

test("production uses one family availability request and restores scroll", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openProductionHome(page);
  const fixture = await readVisibleFamilyFixture(page);
  expect(fixture).not.toBeNull();
  const beforeScroll = await positionPageForRestoreCheck(page);
  const requests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/product-availability/")) requests.push(url);
  });

  await page.locator("#joinMdPickSection .join-mdpick-card").nth(fixture.buttonIndex).click();
  await expect(page.locator("#detailModal")).toHaveClass(/\bopen\b/, { timeout: 60_000 });
  await expect.poll(() => page.locator("#detailModal .detail-family-period-option").count(), {
    timeout: 60_000
  }).toBeGreaterThanOrEqual(2);

  const familyRequests = requests.filter((url) => url.includes("/families/"));
  const productRequests = requests.filter((url) => !url.includes("/families/"));
  expect(familyRequests).toHaveLength(1);
  expect(productRequests).toHaveLength(0);
  expect(familyRequests[0]).toContain(`/product-availability/${fixture.availabilityRevision}/families/${fixture.familyRevision}/${fixture.familyId}.json`);
  expect(pageErrors).toEqual([]);
  await closeDetailAndVerifyScroll(page, beforeScroll);
});

test("production falls back to every member when the family object fails", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openProductionHome(page);
  const fixture = await readVisibleFamilyFixture(page);
  expect(fixture).not.toBeNull();
  const requests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/product-availability/")) requests.push(url);
  });
  await page.route(/\/product-availability\/[^/]+\/families\/[^/]+\/[^/]+\.json(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.locator("#joinMdPickSection .join-mdpick-card").nth(fixture.buttonIndex).click();
  await expect(page.locator("#detailModal")).toHaveClass(/\bopen\b/, { timeout: 60_000 });
  await expect.poll(() => page.locator("#detailModal .detail-family-period-option").count(), {
    timeout: 60_000
  }).toBeGreaterThanOrEqual(2);

  expect(requests.filter((url) => url.includes("/families/"))).toHaveLength(1);
  expect(new Set(requests.filter((url) => !url.includes("/families/"))).size).toBe(fixture.productCount);
  expect(pageErrors).toEqual([]);
});
