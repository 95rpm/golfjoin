"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const mainHtmlPath = process.env.STAGE68B_MAIN_HTML || path.join(ROOT, "dist/golfjoin-main/golfjoin_main.html");
const html = fs.readFileSync(mainHtmlPath);
const packagedJs = process.env.STAGE68B_MAIN_JS
  ? zlib.brotliDecompressSync(fs.readFileSync(process.env.STAGE68B_MAIN_JS)).toString("utf8")
  : "";
const packagedCss = process.env.STAGE68B_MAIN_CSS
  ? zlib.gunzipSync(fs.readFileSync(process.env.STAGE68B_MAIN_CSS)).toString("utf8")
  : "";
const FAMILY_ID = "pf_3562d40bd7cd449fa80eabc859faec63";
const monthlyFirstLoadQa = process.env.STAGE68D_MONTHLY_FIRST_LOAD === "1";
const familyGolfSummaryQa = process.env.STAGE68G_GOLF_SUMMARY === "1";
const periodCapacityQa = process.env.STAGE69_PERIOD_CAPACITY === "1";
const familyPublicationRevision = "pfc_0823fd4490f81c995bf23a2e";
const image = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420'%3E%3Crect width='640' height='420' fill='%2356a8e8'/%3E%3C/svg%3E";
const familyOptions = [
  { goodSeq: "30001287", eventSeq: "30286551", departureDate: "2027-01-16", returnDate: "2027-01-21", durationLabel: "4박6일", price: 1390000, ...(periodCapacityQa ? { capacity: 30 } : {}) },
  { goodSeq: "30001288", eventSeq: "30286552", departureDate: "2027-01-16", returnDate: "2027-01-24", durationLabel: "7박9일", price: 1890000, ...(periodCapacityQa ? { capacity: 30 } : {}) }
];
const products = familyOptions.map((option) => ({
  id: `${option.goodSeq}-${option.eventSeq}`,
  goodSeq: option.goodSeq,
  eventSeq: option.eventSeq,
  erpProductId: option.goodSeq,
  erpEventSeq: option.eventSeq,
  title: `[1월 월례회] 인도네시아 바탐 3색 ${option.durationLabel} 아스톤`,
  country: "인도네시아",
  region: "바탐",
  category: "해외",
  departureDate: option.departureDate,
  returnDate: option.returnDate,
  duration: option.durationLabel,
  price: option.price,
  packType: "air",
  packTypeName: "항공팩",
  airline: "제주항공",
  departureAirport: "인천",
  image,
  ...(monthlyFirstLoadQa ? { currentCount: 59, confirmedCount: 0, participantCount: 0 } : {}),
  schedule: []
}));
const rule = {
  recommendedScheduleId: `rs-family-${FAMILY_ID}-2027-01-16`,
  erpProductId: "30001287",
  erpEventSeq: "30286551",
  section: "available_schedule",
  isVisible: true,
  isPinned: true,
  displayOrder: 1,
  badgeType: "monthly",
  scheduleType: "monthly",
  scheduleLabel: "월례회",
  capacity: monthlyFirstLoadQa || periodCapacityQa ? "60" : "40",
  maxPeople: monthlyFirstLoadQa || periodCapacityQa ? "60" : "40",
  packType: "air",
  packTypeName: "항공팩",
  overrideTitle: "[1월 월례회] 인도네시아 바탐 3색 4박6일/7박9일 아스톤",
  overrideImageUrl: image,
  country: "인도네시아",
  region: "바탐",
  departureAirport: "인천",
  airline: "제주항공",
  productPrice: "1390000",
  displayStartAt: "2027-01-16",
  displayEndAt: "2027-01-21",
  tripSummary: "4박6일/7박9일",
  productFamilyId: FAMILY_ID,
  familyDepartureDate: "2027-01-16",
  familyOptionsJson: JSON.stringify(familyOptions)
};

async function main() {
  const integratedParticipantSummary = periodCapacityQa ? {
    targetType: "recommended_schedule",
    targetScheduleId: `admin-recommended-${rule.recommendedScheduleId}`,
    targetApplicationId: rule.recommendedScheduleId,
    erpProductId: rule.erpProductId,
    erpEventSeq: rule.erpEventSeq,
    capacity: 60,
    confirmedCount: 15,
    confirmedPeople: 15,
    remainingSlots: 45,
    participantsPreview: [],
    familyOptionSummaries: [
      { goodSeq: "30001287", eventSeq: "30286551", departureDate: "2027-01-16", returnDate: "2027-01-21", durationLabel: "4박6일", capacity: 30, confirmedCount: 11, confirmedPeople: 11, remainingSlots: 19, participantsPreview: [] },
      { goodSeq: "30001288", eventSeq: "30286552", departureDate: "2027-01-16", returnDate: "2027-01-24", durationLabel: "7박9일", capacity: 30, confirmedCount: 4, confirmedPeople: 4, remainingSlots: 26, participantsPreview: [] }
    ]
  } : null;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/" || url.pathname === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (url.pathname.includes("/goods/goods_view")) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><html><body><h1>1월 월례회 바탐</h1></body></html>");
      return;
    }
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ items }) => {
    window.SECRET_GOLF_JOIN_PRODUCTS = { items, range: { startDate: "2026-09-15", endDate: "2027-12-31" } };
  }, { items: products });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/golfjoin-sheet-api?**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("action");
    const payload = action === "home_bootstrap_light"
      ? {
        ok: true,
        newScheduleSummaries: [],
        participantSummaries: periodCapacityQa ? [integratedParticipantSummary] : monthlyFirstLoadQa ? [{
          targetType: "recommended_schedule",
          targetScheduleId: `admin-recommended-${rule.recommendedScheduleId}`,
          targetApplicationId: rule.recommendedScheduleId,
          erpProductId: rule.erpProductId,
          erpEventSeq: rule.erpEventSeq,
          capacity: 60,
          confirmedCount: 0,
          remainingSlots: 60,
          participantsPreview: []
        }] : [],
        displayRules: [rule],
        serverTime: "2026-09-15T12:00:00+09:00"
      }
      : { ok: true, rows: [] };
    await route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: JSON.stringify(payload) });
  });
  await page.route("https://storage.googleapis.com/golfjoin-bucket/web/**", async (route) => {
    const url = new URL(route.request().url());
    if (packagedJs && /golfjoin-main\.js$/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: packagedJs });
      return;
    }
    if (packagedCss && /golfjoin-main\.css$/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: packagedCss });
      return;
    }
    if (familyGolfSummaryQa && /\/product-family\/manifest\.json$/.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          schema: "golfjoin-product-family-manifest-v1",
          activePublicationRevision: familyPublicationRevision,
          activeCatalogObjectName: `web/product-family/catalogs/${familyPublicationRevision}.json`
        })
      });
      return;
    }
    if (familyGolfSummaryQa && url.pathname.endsWith(`/product-family/catalogs/${familyPublicationRevision}.json`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          schema: "golfjoin-product-family-catalog-v1",
          publicationRevision: familyPublicationRevision,
          familyIdByGoodSeq: { "30001287": FAMILY_ID, "30001288": FAMILY_ID },
          families: [{
            familyId: FAMILY_ID,
            status: "approved",
            members: [
              { goodSeq: "30001287", golfSummary: { label: "골프 4일 · 총 144홀" } },
              { goodSeq: "30001288", golfSummary: { label: "골프 7일 · 총 252홀" } }
            ]
          }]
        })
      });
      return;
    }
    if (/golfjoin_(?:local_data|home_cards)\.json$/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: JSON.stringify({ items: products }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json; charset=utf-8", body: JSON.stringify({ error: "qa_not_configured" }) });
  });
  await page.route("**/goods/goods_view?**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: "<!doctype html><html><body><h1>1월 월례회 바탐</h1></body></html>"
  }));
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const card = page.locator(".join-card").filter({ hasText: "4박6일/7박9일" }).first();
    await card.waitFor({ timeout: 20000 });
    const cardText = await card.innerText();
    assert.match(cardText, /1\.16\(토\)~1\.21\(목\)\/1\.24\(일\)/);
    assert.match(cardText, /항공팩|월례회/);
    if (monthlyFirstLoadQa) {
      assert.match(cardText, /현재 59명 참여중/);
      assert.match(cardText, /59\/60명/);
      assert.doesNotMatch(cardText, /0\/60명/);
    }
    if (periodCapacityQa) {
      assert.match(cardText, /현재 15명 참여중/);
      assert.match(cardText, /15\/60명/);
    }

    await card.click();
    const modal = page.locator("#detailModal");
    await modal.waitFor();
    const periodOptions = modal.locator(".detail-family-period-option");
    assert.equal(await periodOptions.count(), 2);
    assert.match(await periodOptions.nth(0).innerText(), /4박 6일/);
    assert.match(await periodOptions.nth(1).innerText(), /7박 9일/);
    if (familyGolfSummaryQa) {
      assert.match(await periodOptions.nth(0).innerText(), /골프 4일 · 총 144홀/);
      assert.match(await periodOptions.nth(1).innerText(), /골프 7일 · 총 252홀/);
      assert.doesNotMatch(await periodOptions.allInnerTexts().then((items) => items.join(" ")), /골프 일정 확인 중/);
    }
    if (monthlyFirstLoadQa) {
      assert.match(await modal.locator(".detail-monthly-gauge-count").first().innerText(), /59\/60명/);
    }
    if (periodCapacityQa) {
      assert.match(await modal.locator(".detail-monthly-gauge-count").first().innerText(), /11\/30명/);
    }
    await periodOptions.nth(1).click();
    await page.waitForFunction(() => document.querySelectorAll("#detailModal .detail-family-period-option")[1]?.classList.contains("is-selected"));
    assert.match(await modal.locator(".detail-bottom-summary").innerText(), /1\.16\(토\)~1\.24\(일\)/);
    if (monthlyFirstLoadQa) {
      assert.match(await modal.locator(".detail-monthly-gauge-count").first().innerText(), /59\/60명/);
    }
    if (periodCapacityQa) {
      assert.match(await modal.locator(".detail-monthly-gauge-count").first().innerText(), /4\/30명/);
    }

    const screenshot = path.join(os.tmpdir(), "golfjoin-stage68b-integrated-recommendation-main.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ ok: true, screenshot, monthlyFirstLoadQa, familyGolfSummaryQa, periodCapacityQa, pageErrors }, null, 2));
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
