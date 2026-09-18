"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const dashboard = fs.readFileSync(process.env.STAGE68B_ADMIN_HTML || path.join(ROOT, "golfjoin_admin_dashboard.html"));
const FAMILY_ID = "pf_3562d40bd7cd449fa80eabc859faec63";
const fourPeriodQa = process.env.STAGE68D_FOUR_PERIODS === "1";
const coreProducts = [
  {
    id: "30001287-30286551",
    goodSeq: "30001287",
    eventSeq: "30286551",
    erpProductId: "30001287",
    erpEventSeq: "30286551",
    title: "[1월 월례회] 인도네시아 바탐 3색 4박6일 아스톤",
    country: "인도네시아",
    region: "바탐",
    category: "해외",
    departureDate: "2027-01-16",
    returnDate: "2027-01-21",
    duration: "4박6일",
    price: 1390000,
    packType: "air",
    airline: "제주항공",
    departureAirport: "인천"
  },
  {
    id: "30001288-30286552",
    goodSeq: "30001288",
    eventSeq: "30286552",
    erpProductId: "30001288",
    erpEventSeq: "30286552",
    title: "[1월 월례회] 인도네시아 바탐 3색 7박9일 아스톤",
    country: "인도네시아",
    region: "바탐",
    category: "해외",
    departureDate: "2027-01-16",
    returnDate: "2027-01-24",
    duration: "7박9일",
    price: 1890000,
    packType: "air",
    airline: "제주항공",
    departureAirport: "인천"
  },
  ...(fourPeriodQa ? [
    {
      id: "30001289-30286553",
      goodSeq: "30001289",
      eventSeq: "30286553",
      erpProductId: "30001289",
      erpEventSeq: "30286553",
      title: "[1월 월례회] 인도네시아 바탐 3색 5박7일 아스톤",
      country: "인도네시아",
      region: "바탐",
      category: "해외",
      departureDate: "2027-01-16",
      returnDate: "2027-01-22",
      duration: "5박7일",
      price: 1590000,
      packType: "air",
      airline: "제주항공",
      departureAirport: "인천"
    },
    {
      id: "30001290-30286554",
      goodSeq: "30001290",
      eventSeq: "30286554",
      erpProductId: "30001290",
      erpEventSeq: "30286554",
      title: "[1월 월례회] 인도네시아 바탐 3색 6박8일 아스톤",
      country: "인도네시아",
      region: "바탐",
      category: "해외",
      departureDate: "2027-01-16",
      returnDate: "2027-01-23",
      duration: "6박8일",
      price: 1690000,
      packType: "air",
      airline: "제주항공",
      departureAirport: "인천"
    }
  ] : [])
];
const fillerCount = Math.max(0, Number(process.env.STAGE68C_PERF_FILLERS || 0));
const products = coreProducts.concat(Array.from({ length: fillerCount }, (_, index) => {
  const departure = new Date(Date.UTC(2026, 9, 1 + (index % 60)));
  const returnDate = new Date(departure.getTime() + 4 * 86400000);
  const dateText = departure.toISOString().slice(0, 10);
  const returnText = returnDate.toISOString().slice(0, 10);
  const goodSeq = String(31000000 + index);
  const eventSeq = String(32000000 + index);
  return {
    id: `${goodSeq}-${eventSeq}`,
    goodSeq,
    eventSeq,
    erpProductId: goodSeq,
    erpEventSeq: eventSeq,
    title: `성능 검증 추천상품 ${index + 1} 4박5일`,
    country: "일본",
    region: `지역 ${index + 1}`,
    category: "해외",
    departureDate: dateText,
    returnDate: returnText,
    duration: "4박5일",
    price: 900000 + index * 1000,
    packType: "golf"
  };
}));

const familyPayload = {
  ok: true,
  catalogRevision: "pfc_20260915",
  analysisRevision: "pfa_8c40f28ad724381d48e83bb3",
  catalog: coreProducts.map((product) => ({
    goodSeq: product.goodSeq,
    eventSeq: product.eventSeq,
    title: product.title,
    sourceProductTitle: product.title,
    durationLabel: product.duration,
    duration: product.duration,
    packType: product.packType,
    country: product.country,
    region: product.region,
    departureDate: product.departureDate,
    returnDate: product.returnDate,
    lowestPrice: product.price
  })),
  candidates: [],
  families: [{
    familyId: FAMILY_ID,
    status: "approved",
    candidateKeySnapshot: "air|인도네시아|바탐|1월월례회인도네시아바탐3색",
    representativeMode: "manual",
    preferredGoodSeq: "30001287",
    resolvedRepresentativeGoodSeq: "30001287",
    configRevision: 2,
    publishedRevision: 2,
    publishStatus: "published",
    members: coreProducts.map((product) => ({
      goodSeq: product.goodSeq,
      memberStatus: "active",
      sourceTitleSnapshot: product.title
    }))
  }],
  familyDiagnostics: [],
  summary: { approved: 1 }
};
const registeredRule = {
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
  capacity: "60",
  maxPeople: "60",
  packType: "air",
  packTypeName: "항공팩",
  overrideTitle: "[1월 월례회] 인도네시아 바탐 3색 4박6일/7박9일 아스톤",
  country: "인도네시아",
  region: "바탐",
  displayStartAt: "2027-01-16",
  displayEndAt: "2027-01-21",
  productFamilyId: FAMILY_ID,
  familyDepartureDate: "2027-01-16",
  familyOptionsJson: JSON.stringify([
    { goodSeq: "30001287", eventSeq: "30286551", departureDate: "2027-01-16", returnDate: "2027-01-21", durationLabel: "4박6일", price: 1390000 },
    { goodSeq: "30001288", eventSeq: "30286552", departureDate: "2027-01-16", returnDate: "2027-01-24", durationLabel: "7박9일", price: 1890000 }
  ])
};

async function main() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/" || url.pathname === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(dashboard);
      return;
    }
    if (url.pathname === "/web/golfjoin_local_data.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
      response.end(`window.SECRET_GOLF_JOIN_PRODUCTS=${JSON.stringify({ items: products })};`);
      return;
    }
    if (url.pathname === "/web/golfjoin_local_data.json") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ generatedAt: "2026-09-15T00:00:00+09:00", items: products }));
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
  await context.addInitScript(() => {
    sessionStorage.setItem("golfjoinAdminAuth", JSON.stringify({ token: "qa-token", expiresAt: Date.now() + 3600000 }));
  });
  const page = await context.newPage();
  const errors = [];
  let savedRulePayload = null;
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    errors.push(message.text());
    console.error("browser console:", message.text());
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error("browser pageerror:", error.message);
  });
  await page.route("https://asia-northeast3-golfjoin-499602.cloudfunctions.net/**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("action");
    const requestPayload = route.request().method() === "POST" ? route.request().postDataJSON() : {};
    if (["recommended_schedule", "product_display_rule"].includes(requestPayload.source)) {
      savedRulePayload = requestPayload;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    const body = action === "admin_product_family_bootstrap"
      ? familyPayload
      : { builderRows: [], joinRows: [], profileRows: [], displayRuleRows: [registeredRule], displayRules: [registeredRule] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route("https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_local_data.json**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ generatedAt: "2026-09-15T00:00:00+09:00", items: products })
  }));
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const navigationStartedAt = Date.now();
    await page.locator('.nav-button[data-menu="recommended-schedules"]').click();
    const familyRow = page.locator(`tr[data-product-family-id="${FAMILY_ID}"]`);
    await familyRow.waitFor();
    const navigationElapsedMs = Date.now() - navigationStartedAt;
    if (fillerCount) {
      assert.ok(navigationElapsedMs < 5000, `recommendation navigation took ${navigationElapsedMs}ms`);
      assert.ok(await page.locator(".recommendation-calendar-picker").count() >= 140);
      assert.equal(await page.locator(".recommendation-calendar-day").count(), 0);
      const firstCalendarToggle = page.locator('[data-action="recommendation-calendar-toggle"]').first();
      const calendarPicker = firstCalendarToggle.locator("xpath=..");
      const calendarOpenStartedAt = Date.now();
      await firstCalendarToggle.click({ force: true });
      await page.locator(".recommendation-calendar-day").first().waitFor();
      const calendarOpenElapsedMs = Date.now() - calendarOpenStartedAt;
      assert.ok(await page.locator(".recommendation-calendar-day").count() <= 70);
      assert.ok(calendarOpenElapsedMs < 750, `calendar open took ${calendarOpenElapsedMs}ms`);
      const firstMonthBefore = await calendarPicker.locator(".recommendation-calendar-month-title-text").first().innerText();
      const calendarNextStartedAt = Date.now();
      await calendarPicker.locator('[data-action="recommendation-calendar-next"]').click();
      await page.waitForFunction(
        ({ before }) => document.querySelector(".recommendation-calendar-picker.open .recommendation-calendar-month-title-text")?.textContent?.trim() !== before,
        { before: firstMonthBefore }
      );
      const calendarNextElapsedMs = Date.now() - calendarNextStartedAt;
      assert.ok(calendarNextElapsedMs < 500, `calendar next month took ${calendarNextElapsedMs}ms`);
      await firstCalendarToggle.click({ force: true });
      console.log(JSON.stringify({ calendarOpenElapsedMs, calendarNextElapsedMs, calendarFillerCount: fillerCount }));
    }
    const rowText = await familyRow.innerText();
    assert.match(rowText, /항공팩/);
    assert.match(rowText, fourPeriodQa ? /4박6일[\s\S]*7박9일/ : /4박6일\/7박9일/);
    assert.match(rowText, /상품군 통합/);
    assert.match(rowText, /추천등록/);
    assert.equal(await page.locator(`tr[data-product-family-id="${FAMILY_ID}"]`).count(), 1);
    assert.equal(await familyRow.locator("[data-recommendation-monthly]").count(), 0);
    assert.equal(await familyRow.locator("[data-recommendation-capacity]").count(), 0);
    assert.equal(await familyRow.locator(":scope > td").count(), 10);

    const registrationToggle = familyRow.locator('[data-action="recommendation-registration-toggle"]');
    await registrationToggle.waitFor();
    assert.match(await registrationToggle.innerText(), /1개 등록/);
    await registrationToggle.click();
    const registeredItem = page.locator(`.recommendation-registered-item[data-recommended-schedule-id="${registeredRule.recommendedScheduleId}"]`);
    await registeredItem.waitFor();
    assert.match(await registeredItem.innerText(), /1월 월례회/);
    assert.match(await registeredItem.innerText(), /상품군 통합/);

    if (fourPeriodQa) {
      const periodItems = familyRow.locator(".recommendation-period-item");
      assert.equal(await periodItems.count(), 4);
      const periodLayout = await periodItems.evaluateAll((items) => items.map((item) => {
        const rect = item.getBoundingClientRect();
        return { left: Math.round(rect.left), top: Math.round(rect.top) };
      }));
      assert.equal(new Set(periodLayout.map((item) => item.left)).size, 2);
      assert.equal(new Set(periodLayout.map((item) => item.top)).size, 2);
      const periodCellWidth = await familyRow.locator("td:nth-child(5)").evaluate((cell) => cell.getBoundingClientRect().width);
      assert.ok(periodCellWidth >= 172, `period cell width was ${periodCellWidth}`);
      const periodBoxStyle = await periodItems.first().evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          height: style.height,
          borderWidth: style.borderTopWidth,
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor,
          display: style.display
        };
      });
      const productViewStyle = await familyRow.locator('[data-action="recommendation-product-view"]').evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          height: style.height,
          borderWidth: style.borderTopWidth,
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor
        };
      });
      assert.ok(["flex", "inline-flex"].includes(periodBoxStyle.display));
      assert.deepEqual(
        {
          height: periodBoxStyle.height,
          borderWidth: periodBoxStyle.borderWidth,
          borderRadius: periodBoxStyle.borderRadius,
          backgroundColor: periodBoxStyle.backgroundColor
        },
        productViewStyle
      );

      const tableWrap = page.locator(".table-wrap");
      await tableWrap.evaluate((element) => { element.scrollTop = 420; });
      await page.waitForTimeout(50);
      const stackCheck = await page.evaluate(() => {
        const header = document.querySelector(".recommendation-table > thead > tr > th:nth-child(6)");
        const action = document.querySelector('[data-action="recommendation-register-candidate"]');
        if (!header || !action) return null;
        const headerRect = header.getBoundingClientRect();
        const actionRect = action.getBoundingClientRect();
        const x = Math.max(headerRect.left + 4, Math.min(actionRect.left + actionRect.width / 2, headerRect.right - 4));
        const y = headerRect.top + headerRect.height / 2;
        const topmost = document.elementFromPoint(x, y);
        return {
          headerZ: getComputedStyle(header).zIndex,
          headerOwnsPoint: Boolean(topmost && topmost.closest("th") === header)
        };
      });
      assert.ok(stackCheck);
      assert.equal(stackCheck.headerZ, "6");
      assert.equal(stackCheck.headerOwnsPoint, true);
      await tableWrap.evaluate((element) => { element.scrollTop = 0; });

      const layoutScreenshot = path.join(os.tmpdir(), "golfjoin-stage68d-recommendation-four-period-layout.png");
      await familyRow.screenshot({ path: layoutScreenshot });
      console.log(JSON.stringify({ fourPeriodLayout: periodLayout, periodCellWidth, periodBoxStyle, stackCheck, layoutScreenshot }));
    }

    const registrationButton = familyRow.locator('[data-action="recommendation-register-candidate"]');
    const dialog = page.locator(".recommendation-confirm-dialog");
    await registrationButton.click();
    await dialog.waitFor();
    const registrationModeScreenshot = path.join(os.tmpdir(), "golfjoin-stage73-recommendation-registration-mode.png");
    await dialog.screenshot({ path: registrationModeScreenshot });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileDialogGeometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
    });
    assert.ok(mobileDialogGeometry.left >= 0 && mobileDialogGeometry.right <= 390);
    assert.equal(mobileDialogGeometry.scrollWidth, mobileDialogGeometry.clientWidth);
    const registrationMobileScreenshot = path.join(os.tmpdir(), "golfjoin-stage73-recommendation-registration-mobile.png");
    await dialog.screenshot({ path: registrationMobileScreenshot });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.match(await dialog.innerText(), /개별 등록/);
    assert.match(await dialog.innerText(), /통합 등록/);
    assert.match(await dialog.innerText(), /\[1월 월례회\] 인도네시아 바탐/);
    assert.match(await dialog.innerText(), /항공팩/);
    assert.match(await dialog.innerText(), /출발일\s*2027\.01\.16/);
    assert.match(await dialog.innerText(), /요금\s*1,390,000원/);
    assert.match(await dialog.innerText(), /일반/);
    assert.match(await dialog.innerText(), /단체/);
    assert.match(await dialog.innerText(), /정원/);
    const monthlyToggle = dialog.locator("[data-recommendation-registration-monthly]");
    assert.equal(await monthlyToggle.isChecked(), true);
    await monthlyToggle.uncheck({ force: true });
    assert.equal(await monthlyToggle.isChecked(), false);
    await monthlyToggle.check({ force: true });
    assert.equal(await monthlyToggle.isChecked(), true);
    const capacityInput = dialog.locator("[data-recommendation-registration-capacity]");
    assert.equal(await capacityInput.inputValue(), "60");
    await capacityInput.fill("0");
    assert.equal(await page.locator("#confirmOkButton").isDisabled(), true);
    await capacityInput.fill("60");
    assert.equal(await page.locator("#confirmOkButton").isEnabled(), true);
    await dialog.locator(".recommendation-registration-mode", { hasText: "개별 등록" }).click();
    assert.equal(await page.locator("#confirmOkButton").isDisabled(), true);
    await dialog.locator(".recommendation-registration-period-option", { hasText: "4박6일" }).click();
    assert.equal(await page.locator("#confirmOkButton").isEnabled(), true);
    await page.locator("#confirmOkButton").click();
    await page.waitForFunction(() => document.getElementById("confirmTitle")?.textContent?.trim() === "추천일정 등록 확인");
    const individualConfirmation = await dialog.innerText();
    assert.match(individualConfirmation, /선택한 설정으로 추천일정을 등록할까요/);
    assert.equal(await dialog.locator(".info-grid").count(), 0);
    await page.locator("#confirmCancelButton").click();

    await registrationButton.click();
    await dialog.waitFor();
    if (fourPeriodQa) {
      await dialog.locator(".recommendation-registration-period-option", { hasText: "7박9일" }).click();
      await dialog.locator(".recommendation-registration-period-option", { hasText: "5박7일" }).click();
    }
    await page.locator("#confirmOkButton").click();
    await page.waitForFunction(() => document.getElementById("confirmTitle")?.textContent?.trim() === "추천일정 등록 확인");
    const registrationConfirmation = await dialog.innerText();
    const registrationConfirmationScreenshot = path.join(os.tmpdir(), "golfjoin-stage73-recommendation-confirmation.png");
    await dialog.screenshot({ path: registrationConfirmationScreenshot });
    assert.match(registrationConfirmation, /선택한 설정으로 추천일정을 등록할까요/);
    assert.equal(await dialog.locator(".info-grid").count(), 0);
    await page.locator("#confirmOkButton").click();
    await page.waitForFunction(() => !document.getElementById("dashboardLoadingOverlay")?.classList.contains("open"));
    assert.ok(savedRulePayload);
    assert.equal(savedRulePayload.productFamilyId, FAMILY_ID);
    assert.equal(savedRulePayload.scheduleType, "monthly");
    assert.equal(savedRulePayload.capacity, "60");
    const savedFamilyOptions = JSON.parse(savedRulePayload.familyOptionsJson);
    assert.deepEqual(savedFamilyOptions.map((option) => option.durationLabel), fourPeriodQa ? ["4박6일", "5박7일"] : ["4박6일", "7박9일"]);

    await page.evaluate(() => {
      state.displayRules = [];
      state.expandedRecommendationGoodSeq = "";
      renderTable();
    });
    const freshRegistrationButton = page.locator(`tr[data-product-family-id="${FAMILY_ID}"] [data-action="recommendation-register-candidate"]`);
    await freshRegistrationButton.click();
    await dialog.waitFor();
    assert.equal(await dialog.locator("[data-recommendation-registration-monthly]").isChecked(), false);
    assert.equal(await dialog.locator("[data-recommendation-registration-capacity]").inputValue(), "4");
    assert.match(await dialog.innerText(), /추천일정 등록/);
    const freshRegistrationScreenshot = path.join(os.tmpdir(), "golfjoin-stage73-new-recommendation-registration.png");
    await dialog.screenshot({ path: freshRegistrationScreenshot });
    await page.locator("#confirmCancelButton").click();

    const screenshot = path.join(os.tmpdir(), "golfjoin-stage68b-integrated-recommendation-dashboard.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, screenshot, registrationModeScreenshot, registrationMobileScreenshot, registrationConfirmationScreenshot, freshRegistrationScreenshot, mobileDialogGeometry, navigationElapsedMs, fillerCount, fourPeriodQa, savedFamilyOptions, consoleErrors: errors }, null, 2));
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
