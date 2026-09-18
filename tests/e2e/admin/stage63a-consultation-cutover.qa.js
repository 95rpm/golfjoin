"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"));
const targetTitle = "일본 후쿠오카 2박3일 운영 전환 확인 상품";

const builderRows = [
  {
    applicationId: "legacy-monthly-customer",
    scheduleId: "legacy-monthly-customer",
    source: "new_schedule_applications",
    createdAt: "2026-09-01T10:00:00+09:00",
    creatorName: "기존월례회고객",
    creatorPhone: "01011112222",
    creatorGender: "여성",
    creatorBirthYear: "1980",
    creatorPeople: "1",
    productName: "[10월 월례회] 기존 누적 고객",
    departureDate: "2026-10-01",
    returnDate: "2026-10-04"
  },
  {
    applicationId: "cutover-customer",
    scheduleId: "cutover-customer",
    source: "new_schedule_applications",
    createdAt: "2026-09-07T21:11:00+09:00",
    creatorName: "기준신청자",
    creatorPhone: "01033334444",
    creatorGender: "남성",
    creatorBirthYear: "1978",
    creatorPeople: "2",
    productName: targetTitle,
    tripSummary: "2박3일",
    departureDate: "2026-09-26",
    returnDate: "2026-09-28"
  }
];

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
      response.end("window.SECRET_GOLF_JOIN_PRODUCTS={items:[]};");
      return;
    }
    if (url.pathname === "/web/golfjoin_local_data.json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ generatedAt: "2026-09-09T00:00:00+09:00", items: [] }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    sessionStorage.setItem("golfjoinAdminAuth", JSON.stringify({ token: "qa-token", expiresAt: Date.now() + 3600000 }));
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.route("https://asia-northeast3-golfjoin-499602.cloudfunctions.net/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("action") === "admin_bootstrap") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ builderRows, joinRows: [], profileRows: [], displayRuleRows: [] })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_local_data.json**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ generatedAt: "2026-09-09T00:00:00+09:00", items: [] })
  }));
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));

  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#lastUpdated")?.textContent !== "불러오는 중");
    assert.equal(await page.title(), "골프조인 운영 대시보드");
    assert.equal(await page.locator("body").evaluate((element) => element.innerText.trim().length > 0), true);
    const consultationCard = page.locator(".schedule-work-card", { hasText: "상담대기" });
    assert.equal((await consultationCard.locator(".schedule-work-count").innerText()).replace(/\s+/g, " ").trim(), "1 NEW");
    assert.equal(await consultationCard.locator(".schedule-work-new-badge").innerText(), "NEW");

    const newScheduleCard = page.locator('.schedule-work-card[data-metric-action="new-recent"]');
    assert.equal(await newScheduleCard.getAttribute("aria-label"), "최근 3일 생성 일정");
    assert.equal(await newScheduleCard.locator(".schedule-work-count").innerText(), "1");
    await newScheduleCard.click();
    await page.locator(".schedule-table tbody tr[data-schedule-key]").waitFor();
    const recentScheduleTableText = await page.locator(".schedule-table").innerText();
    assert.match(recentScheduleTableText, new RegExp(targetTitle));
    assert.doesNotMatch(recentScheduleTableText, /기존월례회고객|10월 월례회/);
    const recentScheduleScreenshot = path.join(os.tmpdir(), "golfjoin-stage63d-new-schedule-three-day-window.png");
    await page.screenshot({ path: recentScheduleScreenshot, fullPage: false });

    await page.locator(".schedule-status-card").first().click();
    const scheduleRow = page.locator(".schedule-table tbody tr[data-schedule-key]").first();
    await scheduleRow.waitFor();
    await scheduleRow.click();
    const participantBackdrop = page.locator("#participantListBackdrop");
    const participantShell = page.locator(".participant-list-shell");
    await participantShell.waitFor({ state: "visible" });
    const subtitleBox = await page.locator("#participantListSubtitle").boundingBox();
    const shellBox = await participantShell.boundingBox();
    assert.ok(subtitleBox && shellBox, "참여자 명단 모달 위치를 확인할 수 있어야 한다");
    const backdropPoint = {
      x: Math.max(2, Math.floor(shellBox.x / 2)),
      y: Math.max(2, Math.min(998, Math.floor(subtitleBox.y + subtitleBox.height / 2)))
    };
    await page.mouse.move(subtitleBox.x + Math.min(120, subtitleBox.width / 2), subtitleBox.y + subtitleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(backdropPoint.x, backdropPoint.y, { steps: 12 });
    await page.mouse.up();
    assert.equal(await participantBackdrop.getAttribute("aria-hidden"), "false");
    assert.equal(await participantBackdrop.evaluate((element) => element.classList.contains("open")), true);
    const modalDragScreenshot = path.join(os.tmpdir(), "golfjoin-stage63c-modal-drag-kept-open.png");
    await page.screenshot({ path: modalDragScreenshot, fullPage: false });
    await page.mouse.click(backdropPoint.x, backdropPoint.y);
    await participantShell.waitFor({ state: "hidden" });
    assert.equal(await participantBackdrop.getAttribute("aria-hidden"), "true");

    await consultationCard.click();
    await page.locator(".consultation-table tbody tr").waitFor();
    assert.equal(await page.locator(".consultation-table tbody tr").count(), 1);
    const tableText = await page.locator(".consultation-table").innerText();
    assert.match(tableText, /기준신청자/);
    assert.match(tableText, /26\.09\.07\(월\) 21:11/);
    assert.match(tableText, new RegExp(targetTitle));
    assert.doesNotMatch(tableText, /기존월례회고객|10월 월례회/);
    assert.equal(await page.locator("[data-vite-dev-id], nextjs-portal").count(), 0);
    assert.deepEqual(consoleErrors, []);

    const screenshotWithNew = path.join(os.tmpdir(), "golfjoin-stage63b-consultation-new.png");
    await page.screenshot({ path: screenshotWithNew, fullPage: true });

    builderRows[1].quotePageUrl = "https://example.test/quote/cutover-customer";
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#lastUpdated")?.textContent !== "불러오는 중");
    const quotedCard = page.locator(".schedule-work-card", { hasText: "상담대기" });
    assert.equal(await quotedCard.locator(".schedule-work-count").innerText(), "1");
    assert.equal(await quotedCard.locator(".schedule-work-new-badge").count(), 0);
    await quotedCard.click();
    assert.equal(await page.locator(".consultation-table tbody tr").count(), 1);
    assert.doesNotMatch(await page.locator(".consultation-table").innerText(), /기존월례회고객|10월 월례회/);
    assert.deepEqual(consoleErrors, []);
    const screenshotWithoutNew = path.join(os.tmpdir(), "golfjoin-stage63b-consultation-quoted.png");
    await page.screenshot({ path: screenshotWithoutNew, fullPage: false });
    console.log(JSON.stringify({
      ok: true,
      screenshots: { withNew: screenshotWithNew, withoutNew: screenshotWithoutNew, modalDrag: modalDragScreenshot, recentSchedule: recentScheduleScreenshot },
      consultationCount: 1,
      consoleErrors
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
