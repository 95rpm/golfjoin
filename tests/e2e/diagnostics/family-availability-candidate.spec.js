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
    throw new Error("family_availability_candidate_shell_boundary_not_found");
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
      const availabilityRevision = String(products[0].availabilityRevision || golfJoinHomeManifest?.availabilityRevision || "");
      const familyRevision = String(golfJoinProductFamilyCatalog?.publicationRevision || "");
      return {
        buttonIndex,
        familyId,
        familyRevision,
        availabilityRevision,
        minimumAdvanceDays: Number(homeGolfJoinMinimumAdvanceDays || 0),
        products
      };
    }
    return null;
  });
}

function buildFamilyPayload(fixture) {
  const toIsoDate = (date) => date.toISOString().slice(0, 10);
  const products = fixture.products.map((product, index) => {
    const departure = new Date();
    departure.setUTCDate(departure.getUTCDate() + 30 + index);
    const arrival = new Date(departure);
    arrival.setUTCDate(arrival.getUTCDate() + 4);
    return {
      goodSeq: String(product.goodSeq || product.erpProductId || ""),
      count: 1,
      events: [{
        ...product,
        departureDate: toIsoDate(departure),
        returnDate: toIsoDate(arrival),
        price: Number(product.price) || Number(product.priceFrom) || 1,
        status: "available",
        homeProductSummary: false,
        homeReferenceOnly: false
      }]
    };
  });
  return {
    schema: "secret-golf-join-family-availability-v1",
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: new Date().toISOString(),
    availabilityRevision: fixture.availabilityRevision,
    familyRevision: fixture.familyRevision,
    familyId: fixture.familyId,
    minimumAdvanceDays: fixture.minimumAdvanceDays,
    bookableFrom: fixture.products[0].bookableFrom || fixture.products[0].departureDate,
    goodSeqs: products.map((product) => product.goodSeq),
    productCount: products.length,
    count: products.length,
    products
  };
}

test("local candidate loads a product family's dates with exactly one family request", async ({ page }) => {
  test.setTimeout(180_000);
  await openCandidate(page);
  const fixture = await readVisibleFamilyFixture(page);
  expect(fixture).not.toBeNull();
  const payload = buildFamilyPayload(fixture);
  const requests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/product-availability/")) requests.push(url);
  });
  await page.route(/\/product-availability\/[^/]+\/families\/[^/]+\/[^/]+\.json(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload)
    });
  });

  await page.locator("#joinMdPickSection .join-mdpick-card").nth(fixture.buttonIndex).click();
  await expect(page.locator("#detailModal")).toHaveClass(/\bopen\b/, { timeout: 60_000 });
  await expect.poll(() => page.locator("#detailModal .detail-family-period-option").count(), {
    timeout: 60_000
  }).toBeGreaterThanOrEqual(2);
  expect(requests.filter((url) => url.includes("/families/")).length).toBe(1);
  expect(requests.filter((url) => !url.includes("/families/")).length).toBe(0);
});

test("local candidate falls back to each product object when the family object is unavailable", async ({ page }) => {
  test.setTimeout(180_000);
  await openCandidate(page);
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
  expect(requests.filter((url) => url.includes("/families/")).length).toBe(1);
  expect(new Set(requests.filter((url) => !url.includes("/families/"))).size).toBe(fixture.products.length);
});
