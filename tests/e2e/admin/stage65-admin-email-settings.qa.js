"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"));
let settings = {
  settingId: "new_application_email",
  enabled: true,
  notifyNewSchedule: true,
  notifyJoinApply: true,
  recipients: [{
    email: "operations@secret-tour.com",
    maskedEmail: "op******@secret-tour.com",
    verified: true,
    verifiedAt: "2026-09-14T09:00:00+09:00",
    disabled: false,
    verificationSentAt: "",
    verificationExpiresAt: ""
  }],
  verifiedRecipientCount: 1,
  version: 3,
  updatedAt: "2026-09-14T09:00:00+09:00",
  updatedBy: "admin",
  providerConfigured: true,
  masterEnabled: true,
  fromEmail: "golfjoin@secret-tour.com"
};
let deliveries = [{
  notificationId: "aem_failed_1",
  applicationId: "ja_20260914_001",
  notificationType: "join_apply",
  source: "join_apply",
  scheduleId: "schedule_1",
  recipientMasked: "op******@secret-tour.com",
  status: "failed",
  attemptCount: 5,
  retryCount: 4,
  lastErrorCode: "email_provider_timeout",
  createdAt: "2026-09-14T09:30:00+09:00",
  updatedAt: "2026-09-14T09:31:00+09:00",
  failedAt: "2026-09-14T09:31:00+09:00"
}];

function dashboardBootstrap() {
  return { builderRows: [], joinRows: [], profileRows: [], displayRuleRows: [] };
}

function normalizeRecipientCounts() {
  settings.verifiedRecipientCount = settings.recipients.filter((item) => item.verified && !item.disabled).length;
}

async function mockCloudFunction(route) {
  const url = new URL(route.request().url());
  const action = url.searchParams.get("action");
  const payload = JSON.parse(route.request().postData() || "{}");
  if (action === "admin_bootstrap" || url.searchParams.get("admin") === "1") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboardBootstrap()) });
    return;
  }
  if (action === "admin_email_settings_get") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, settings, deliveries }) });
    return;
  }
  if (action === "admin_email_settings_save") {
    assert.equal(payload.version, settings.version);
    settings = {
      ...settings,
      enabled: payload.enabled,
      notifyNewSchedule: payload.notifyNewSchedule,
      notifyJoinApply: payload.notifyJoinApply,
      version: settings.version + 1,
      updatedAt: "2026-09-14T10:00:00+09:00"
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, settings }) });
    return;
  }
  if (action === "admin_email_recipient_request_verification") {
    settings = {
      ...settings,
      recipients: settings.recipients.filter((item) => item.email !== payload.email).concat({
        email: payload.email,
        maskedEmail: "ne*****@example.com",
        verified: false,
        verifiedAt: "",
        disabled: false,
        verificationSentAt: "2026-09-14T10:01:00+09:00",
        verificationExpiresAt: "2026-09-14T10:11:00+09:00"
      }),
      version: settings.version + 1,
      updatedAt: "2026-09-14T10:01:00+09:00"
    };
    normalizeRecipientCounts();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, settings }) });
    return;
  }
  if (action === "admin_email_recipient_verify") {
    assert.equal(payload.code, "123456");
    settings = {
      ...settings,
      recipients: settings.recipients.map((item) => item.email === payload.email
        ? { ...item, verified: true, verifiedAt: "2026-09-14T10:02:00+09:00", verificationExpiresAt: "" }
        : item),
      version: settings.version + 1,
      updatedAt: "2026-09-14T10:02:00+09:00"
    };
    normalizeRecipientCounts();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, settings }) });
    return;
  }
  if (action === "admin_email_test_send") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, recipient: "op******@secret-tour.com" }) });
    return;
  }
  if (action === "admin_email_delivery_retry") {
    deliveries = deliveries.map((item) => item.notificationId === payload.notificationId
      ? { ...item, status: "sent", attemptCount: 6, updatedAt: "2026-09-14T10:03:00+09:00", sentAt: "2026-09-14T10:03:00+09:00", failedAt: "" }
      : item);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, delivery: { ok: true, status: "sent" } }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
}

async function openDashboard(browser, baseUrl, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    sessionStorage.setItem("golfjoinAdminAuth", JSON.stringify({ token: "qa-token", expiresAt: Date.now() + 3600000 }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://asia-northeast3-golfjoin-499602.cloudfunctions.net/**", mockCloudFunction);
  await page.route("https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_local_data.json**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ generatedAt: "2026-09-14T00:00:00+09:00", items: [] })
  }));
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator('.nav-button[data-menu="settings"]').click();
  await page.locator(".admin-email-settings").waitFor();
  return { context, page, errors };
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
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ generatedAt: "2026-09-14T00:00:00+09:00", items: [] }));
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
    const desktop = await openDashboard(browser, baseUrl, { width: 1440, height: 1000 });
    assert.equal(await desktop.page.locator("#pageTitle").innerText(), "설정");
    assert.equal(await desktop.page.locator("#adminEmailEnabled").isChecked(), true);
    assert.match(await desktop.page.locator(".admin-email-settings").innerText(), /알림 사용 중/);
    assert.match(await desktop.page.locator(".admin-email-settings").innerText(), /전송 실패/);
    await desktop.page.locator('[data-admin-email-action="save"]').click();
    await desktop.page.waitForFunction(() => document.querySelector(".admin-email-settings-feedback")?.textContent?.includes("설정"));
    await desktop.page.locator('[data-admin-email-action="test"]').first().click();
    await desktop.page.waitForFunction(() => document.querySelector(".admin-email-settings-feedback")?.textContent?.includes("테스트 이메일"));

    await desktop.page.locator("#adminEmailRecipientInput").fill("new-admin@example.com");
    await desktop.page.locator('[data-admin-email-action="request"]').click();
    await desktop.page.locator('[data-admin-email-code="new-admin@example.com"]').fill("123456");
    await desktop.page.locator('[data-admin-email-action="verify"][data-email="new-admin@example.com"]').click();
    await desktop.page.waitForFunction(() => document.querySelector(".admin-email-settings")?.textContent?.includes("2개 인증"));

    await desktop.page.locator('[data-admin-email-action="retry"]').click();
    await desktop.page.waitForFunction(() => document.querySelector(".admin-email-delivery-table")?.textContent?.includes("전송 완료"));
    const desktopScreenshot = path.join(os.tmpdir(), "golfjoin-stage65-admin-email-settings-desktop.png");
    await desktop.page.screenshot({ path: desktopScreenshot, fullPage: true });
    assert.deepEqual(desktop.errors, []);
    await desktop.context.close();

    const mobile = await openDashboard(browser, baseUrl, { width: 390, height: 844 });
    assert.equal(await mobile.page.locator(".admin-email-recipient-form").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 1);
    assert.equal(await mobile.page.locator(".admin-email-settings").isVisible(), true);
    const toggleBox = await mobile.page.locator(".admin-email-control-row .admin-email-switch").first().boundingBox();
    assert.ok(toggleBox && toggleBox.x + toggleBox.width <= 390, "모바일에서도 알림 스위치가 화면 안에 보여야 한다");
    const mobileScreenshot = path.join(os.tmpdir(), "golfjoin-stage65-admin-email-settings-mobile.png");
    await mobile.page.screenshot({ path: mobileScreenshot, fullPage: true });
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
