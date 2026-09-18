"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "server/google-sheet-proxy-function/index.js"), "utf8");

test("v65 이메일 설정과 발송 이력은 공개 시트 목록에 포함되지 않는다", () => {
  const publicBlock = source.match(/const PUBLIC_READ_SHEETS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  assert.equal(publicBlock.includes("admin_notification_settings"), false);
  assert.equal(publicBlock.includes("admin_email_delivery_log"), false);
  assert.match(source, /admin_notification_settings:\s*\[/);
  assert.match(source, /admin_email_delivery_log:\s*\[/);
});

test("v65 관리자 전용 설정·인증·테스트·재시도 작업을 제공한다", () => {
  [
    "admin_email_settings_get",
    "admin_email_settings_save",
    "admin_email_recipient_request_verification",
    "admin_email_recipient_verify",
    "admin_email_recipient_remove",
    "admin_email_test_send",
    "admin_email_delivery_retry",
    "admin_email_application_replay"
  ].forEach((action) => assert.match(source, new RegExp(`action === \\"${action}\\"`)));
  assert.match(source, /function assertAdminEmailRequest[\s\S]*isAdminReadRequest/);
});

test("v65c 이메일 설정 조회는 일반 시트 fallback보다 먼저 GET 전용 라우터에서 처리한다", () => {
  const getStart = source.indexOf("async function proxyGet(req, res)");
  const getEnd = source.indexOf("\nfunction proxyAdminLogin", getStart);
  const postStart = source.indexOf("async function proxyPost(req, res)");
  const postEnd = source.indexOf("\nexports.proxyGoogleSheet", postStart);
  const getBlock = source.slice(getStart, getEnd);
  const postBlock = source.slice(postStart, postEnd);
  const settingsRouteIndex = getBlock.indexOf('action === "admin_email_settings_get"');
  const genericReadIndex = getBlock.indexOf("const requestedSheet =");

  assert.ok(getStart >= 0 && getEnd > getStart);
  assert.ok(postStart >= 0 && postEnd > postStart);
  assert.ok(settingsRouteIndex >= 0);
  assert.ok(genericReadIndex > settingsRouteIndex);
  assert.equal(postBlock.includes('action === "admin_email_settings_get"'), false);
});

test("v75 신청 저장은 알림톡과 관리자 이메일을 서로 독립된 Cloud Tasks로 처리한다", () => {
  assert.match(source, /target\.searchParams\.set\("action", "send_application_notifications"\)/);
  assert.match(source, /target\.searchParams\.set\("action", "send_admin_application_email"\)/);
  assert.match(source, /const taskId = `admin-email-/);
  assert.match(source, /enqueueJobs\.push\(enqueueGolfjoinApplicationNotifications/);
  assert.match(source, /enqueueJobs\.push\(enqueueGolfjoinAdminApplicationEmail/);
  assert.match(source, /return Promise\.all\(enqueueJobs\)/);
  assert.equal(/dispatchGolfjoinApplicationNotifications[\s\S]{0,800}api\.sendgrid\.com/.test(source), false);
});

test("v75 관리자 이메일 전용 작업은 최신 메인 API에서만 실행되고 알림톡 작업자와 중복 발송하지 않는다", () => {
  assert.match(source, /GOLFJOIN_ADMIN_EMAIL_SERVICE_URL/);
  assert.match(source, /action === "send_admin_application_email"[\s\S]*processGolfjoinAdminApplicationEmail/);
  const alimtalkRoute = source.match(/if \(req\.query\?\.action === "send_application_notifications"\) \{([\s\S]*?)\n  \}\n  if \(req\.query\?\.action === "send_admin_application_email"/)?.[1] || "";
  assert.ok(alimtalkRoute);
  assert.equal(alimtalkRoute.includes("processGolfjoinAdminApplicationEmail"), false);
  assert.match(source, /GOLFJOIN_SERVICE_ROLE === "aligo"[\s\S]{0,180}\["send_application_notifications", "aligo_sms_capability", "send_member_sms_otp"\]/);
});

test("v75 누락 신청 재발송은 관리자 인증과 신청 ID를 요구하며 기존 멱등성 검사를 재사용한다", () => {
  const replayBlock = source.match(/async function proxyAdminEmailApplicationReplay[\s\S]*?\n\}/)?.[0] || "";
  assert.match(replayBlock, /assertAdminEmailRequest\(req\)/);
  assert.match(replayBlock, /applicationId/);
  assert.match(replayBlock, /processGolfjoinAdminApplicationEmail/);
  assert.equal(replayBlock.includes("force: true"), false);
});

test("v65b 메일 발송은 SendGrid 없이 서명된 Google Apps Script 웹앱을 사용한다", () => {
  assert.match(source, /GOLFJOIN_EMAIL_PROVIDER \|\| "apps_script"/);
  assert.match(source, /GOLFJOIN_APPS_SCRIPT_EMAIL_URL/);
  assert.match(source, /GOLFJOIN_APPS_SCRIPT_EMAIL_SECRET/);
  assert.match(source, /createAppsScriptMailer\(/);
  assert.equal(source.includes("GOLFJOIN_SENDGRID_API_KEY"), false);
  assert.equal(source.includes("createSendGridMailer"), false);
});

test("v65 관리자 수동 명단 추가는 신규 고객 신청 이메일에서 제외한다", () => {
  assert.match(source, /registrationSource\)\.toLowerCase\(\) === "admin"/);
  assert.match(source, /admin_email_admin_roster_ignored/);
});

test("v65 이력은 수신 주소 원문과 이메일 본문을 저장하지 않는다", () => {
  const headers = source.match(/admin_email_delivery_log:\s*\[([\s\S]*?)\]/)?.[1] || "";
  assert.match(headers, /"recipientMasked"/);
  assert.match(headers, /"recipientHash"/);
  assert.equal(headers.includes('"recipientEmail"'), false);
  assert.equal(headers.includes('"body"'), false);
  assert.equal(headers.includes('"plainText"'), false);
});
