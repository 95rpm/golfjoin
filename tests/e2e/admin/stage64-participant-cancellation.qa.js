"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"));

const builderRows = [{
  applicationId: "schedule-active",
  scheduleId: "schedule-active",
  source: "new_schedule_applications",
  createdAt: "2026-09-09T10:00:00+09:00",
  updatedAt: "2026-09-09T10:00:00+09:00",
  creatorName: "모임장",
  creatorPhone: "01011112222",
  creatorGender: "남성",
  creatorBirthYear: "1978",
  creatorPeople: "1",
  productName: "취소 흐름 검증 상품",
  tripSummary: "2박3일",
  departureDate: "2026-10-10",
  returnDate: "2026-10-12",
  maxParticipants: "4",
  applicationStatus: "confirmed",
  displayStatus: "visible"
}];

const joinRows = [{
  applicationId: "join-active",
  scheduleId: "schedule-active",
  targetScheduleId: "schedule-active",
  targetApplicationId: "schedule-active",
  createdAt: "2026-09-09T11:00:00+09:00",
  updatedAt: "2026-09-09T11:00:00+09:00",
  applicantName: "참여고객",
  applicantPhone: "01033334444",
  applicantGender: "여성",
  applicantBirthYear: "1985",
  applicantPeople: "1",
  participantStatus: "신청완료",
  applicationStatus: "confirmed",
  depositStatus: "paid",
  refundStatus: ""
}, {
  applicationId: "join-cancelled",
  scheduleId: "schedule-active",
  targetScheduleId: "schedule-active",
  targetApplicationId: "schedule-active",
  createdAt: "2026-09-09T09:00:00+09:00",
  updatedAt: "2026-09-09T12:00:00+09:00",
  applicantName: "기존취소고객",
  applicantPhone: "01055556666",
  applicantGender: "남성",
  applicantBirthYear: "1980",
  applicantPeople: "1",
  participantStatus: "취소",
  applicationStatus: "cancelled",
  refundStatus: "not_required"
}];

function adminBootstrap() {
  return { builderRows, joinRows, profileRows: [], displayRuleRows: [] };
}

async function openDashboardPage(browser, baseUrl, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    sessionStorage.setItem("golfjoinAdminAuth", JSON.stringify({ token: "qa-token", expiresAt: Date.now() + 3600000 }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://asia-northeast3-golfjoin-499602.cloudfunctions.net/**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("action");
    if (process.env.GOLFJOIN_QA_DEBUG === "1") console.log("qa-route", action, url.searchParams.toString());
    if (action === "admin_bootstrap" || url.searchParams.get("admin") === "1") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminBootstrap()) });
      return;
    }
    if (action === "admin_participant_lookup") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, rows: joinRows }) });
      return;
    }
    if (action === "admin_participant_cancel") {
      const payload = JSON.parse(route.request().postData() || "{}");
      const target = payload.sheet === "new_schedule_applications"
        ? builderRows.find((row) => row.applicationId === payload.applicationId)
        : joinRows.find((row) => row.applicationId === payload.applicationId);
      assert.ok(target, "취소 대상 행이 있어야 한다");
      assert.ok(String(payload.reason || "").trim(), "취소 사유가 전달되어야 한다");
      target.participantStatus = "취소";
      target.applicationStatus = "cancelled";
      target.refundStatus = target.depositStatus === "paid" ? "requested" : "not_required";
      target.updatedAt = "2026-09-09T13:00:00+09:00";
      const activePeople = (builderRows[0]?.participantStatus === "취소" ? 0 : Number(builderRows[0]?.creatorPeople || 1))
        + joinRows.filter((row) => row.participantStatus !== "취소" && row.applicationStatus !== "cancelled")
          .reduce((sum, row) => sum + Number(row.applicantPeople || 1), 0);
      const scheduleCancelled = activePeople === 0;
      if (scheduleCancelled) builderRows[0].displayStatus = "hidden";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, scheduleCancelled, remainingActivePeople: activePeople, refundStatus: target.refundStatus })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_local_data.json**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ generatedAt: "2026-09-09T00:00:00+09:00", items: [] })
  }));
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#lastUpdated")?.textContent !== "불러오는 중");
  return { context, page, errors };
}

async function openParticipantModal(page) {
  const row = page.locator(".schedule-table tbody tr[data-schedule-key]", { hasText: "취소 흐름 검증 상품" }).first();
  await row.waitFor();
  await row.click();
  await page.locator(".participant-list-shell").waitFor({ state: "visible" });
}

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

  try {
    const desktop = await openDashboardPage(browser, baseUrl, { width: 1440, height: 1000 });
    await openParticipantModal(desktop.page);
    assert.match(await desktop.page.locator("#participantListSubtitle").innerText(), /참여 중 2\/4명 · 취소 1명/);
    const beforeNames = await desktop.page.locator("#participantListBody tbody tr td:nth-child(2)").allInnerTexts();
    assert.deepEqual(beforeNames, ["모임장", "참여고객", "기존취소고객"]);
    assert.equal(await desktop.page.locator("#participantListBody tbody tr.is-cancelled").count(), 1);

    const activeJoinRow = desktop.page.locator("#participantListBody tbody tr", { hasText: "참여고객" });
    await activeJoinRow.locator('[data-status-field="refundStatus"][data-status-value="requested"]').click();
    await desktop.page.locator("#confirmBackdrop textarea").fill("고객 요청 취소");
    await desktop.page.locator("#confirmOkButton").click();
    await desktop.page.locator("#confirmTitle", { hasText: "고객 취소 완료" }).waitFor();
    await desktop.page.locator("#confirmOkButton").click();
    await desktop.page.waitForFunction(() => document.querySelector("#participantListSubtitle")?.textContent?.includes("참여 중 1/4명 · 취소 2명"));
    const afterNames = await desktop.page.locator("#participantListBody tbody tr td:nth-child(2)").allInnerTexts();
    assert.deepEqual(afterNames, ["모임장", "참여고객", "기존취소고객"]);
    assert.equal(await desktop.page.locator("#participantListBody tbody tr.is-cancelled").count(), 2);
    assert.match(await activeJoinRow.locator('td[data-label="취소/환불"]').innerText(), /환불대기/);
    const desktopScreenshot = path.join(os.tmpdir(), "golfjoin-stage64-participant-cancellation-desktop.png");
    await desktop.page.screenshot({ path: desktopScreenshot, fullPage: false });
    assert.deepEqual(desktop.errors, []);
    await desktop.context.close();

    joinRows[0].participantStatus = "신청완료";
    joinRows[0].applicationStatus = "confirmed";
    joinRows[0].refundStatus = "";
    const mobile = await openDashboardPage(browser, baseUrl, { width: 390, height: 844 });
    await openParticipantModal(mobile.page);
    assert.equal(await mobile.page.locator("#participantListBody .participant-table tbody").evaluate((element) => getComputedStyle(element).display), "grid");
    assert.equal(await mobile.page.locator("#participantListBody tbody tr.is-cancelled").count(), 1);
    const mobileScreenshot = path.join(os.tmpdir(), "golfjoin-stage64-participant-cancellation-mobile.png");
    await mobile.page.screenshot({ path: mobileScreenshot, fullPage: false });
    assert.deepEqual(mobile.errors, []);
    await mobile.context.close();

    console.log(JSON.stringify({ ok: true, screenshots: { desktop: desktopScreenshot, mobile: mobileScreenshot }, consoleErrors: [] }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
