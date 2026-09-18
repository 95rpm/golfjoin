"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.resolve(__dirname, "../../golfjoin_admin_dashboard.html"), "utf8");

test("v65 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const start = html.indexOf("<script>");
  const end = html.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new vm.Script(html.slice(start + 8, end)));
});

test("v65 왼쪽 설정 메뉴와 이메일 알림 관리 화면을 제공한다", () => {
  [
    'data-menu="settings"',
    "신규 신청 이메일 알림",
    "수신 이메일",
    "최근 발송 이력",
    "이메일 알림 사용",
    "새 모임 생성",
    "참여 신청"
  ].forEach((value) => assert.ok(html.includes(value), value));
});

test("v65 수신 이메일은 인증·테스트·삭제 절차를 제공한다", () => {
  [
    'data-admin-email-action="request"',
    'data-admin-email-action="verify"',
    'data-admin-email-action="resend"',
    'data-admin-email-action="test"',
    'data-admin-email-action="remove"',
    "인증번호 6자리"
  ].forEach((value) => assert.ok(html.includes(value), value));
});

test("v65 실패 이력은 재전송할 수 있고 성공 이력은 재전송 버튼을 만들지 않는다", () => {
  assert.match(html, /status\.key === "failed" \? `<button[\s\S]*data-admin-email-action="retry"/);
  assert.ok(html.includes("admin_email_delivery_retry"));
});

test("v65 설정 API는 관리자 세션 토큰과 no-store를 사용한다", () => {
  assert.match(html, /admin_email_settings_get/);
  assert.match(html, /"X-Golfjoin-Admin-Token": auth\.token/);
  assert.match(html, /cache: "no-store"/);
});

test("v65 이메일의 상담대기 링크는 신청 ID 검색으로 연결된다", () => {
  [
    "applyAdminApplicationDeepLink",
    'url.searchParams.get("applicationId")',
    'state.currentSchedulePanel = "consultation"',
    "item.row.applicationId",
    "item.row.targetScheduleId"
  ].forEach((value) => assert.ok(html.includes(value), value));
});

test("v65 설정 화면은 모바일 단일 열 레이아웃을 제공한다", () => {
  assert.match(html, /@media \(max-width: 700px\)[\s\S]*\.admin-email-recipient-form \{ grid-template-columns: 1fr; \}/);
  assert.match(html, /\.admin-email-delivery-scroll \{ overflow-x: auto; \}/);
});

test("v65b 설정 화면은 Google Apps Script 발송 방식과 할당량 오류를 안내한다", () => {
  assert.ok(html.includes("Google Apps Script 웹앱과 서명 비밀값"));
  assert.ok(html.includes("settings.providerName"));
  assert.ok(html.includes("apps_script_quota_exceeded"));
  assert.equal(html.includes("SendGrid 발신 설정"), false);
});
