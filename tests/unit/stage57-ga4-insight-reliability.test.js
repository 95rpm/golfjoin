"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const analytics = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/ga4-admin-analytics.js"), "utf8");
const detail = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");

test("v57 관리자 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});

test("v57 참여 신청 성공은 내부 완료 단계와 비즈니스 완료 이벤트를 모두 전송한다", () => {
  const successStart = detail.indexOf("acceptScheduleMutationResponse(saveResponse, applyPayload)");
  const successEnd = detail.indexOf("applyPayload = attachJoinApplicationParticipantMarkersFromMutation", successStart);
  const success = detail.slice(successStart, successEnd);
  assert.match(success, /trackGolfJoinApplyStep\("complete"/);
  assert.match(success, /"golfjoin_apply_complete"/);
  assert.ok(success.indexOf('trackGolfJoinApplyStep("complete"') < success.indexOf('"golfjoin_apply_complete"'));
});

test("v57 독립 이벤트 역전은 100% 초과율 대신 진단 상태로 계약한다", () => {
  for (const value of [
    "sequenceMismatch",
    "nonMonotonic",
    "non_monotonic_active_users",
    "independent_event_reach",
    "순차 전환율을 표시하지 않습니다"
  ]) assert.ok(analytics.includes(value), value);
  assert.match(dashboard, /순차 비교 불가/);
  assert.match(dashboard, /analytics-funnel-diagnostic/);
  assert.match(dashboard, /searchFunnel\.diagnostic/);
  assert.match(dashboard, /loginReturnFunnel\.diagnostic/);
});

test("v57 이전 기간 방문자가 없으면 비교 배지와 비교 열을 숨긴다", () => {
  assert.match(analytics, /comparisonAvailable = Boolean\([\s\S]*?summary\?\.visitors/);
  assert.match(dashboard, /data\.comparisonAvailable === true/);
  assert.match(dashboard, /previous === 0\) return null/);
  assert.match(dashboard, /comparisonAvailable \? "<th>이전 기간<\/th>" : ""/);
  assert.match(dashboard, /comparisonAvailable \? " · 이전 기간 비교" : ""/);
  assert.match(dashboard, /이전 기간 데이터 없음/);
});

test("v57 상품 섹션 성과에서 새 일정 생성 CTA를 서버와 화면 양쪽에서 제외한다", () => {
  assert.match(analytics, /const excluded = new Set\(\[[^\]]*"new_schedule"/);
  assert.match(dashboard, /function isAnalyticsProductSection/);
  assert.match(dashboard, /"new_schedule"\]\.includes\(key\)/);
  assert.match(dashboard, /filter\(\(item\) => isAnalyticsProductSection\(item\.sectionName\)/);
});

test("v57 진단 불가 검색·로그인 흐름은 자동 개선 후보로 단정하지 않는다", () => {
  assert.match(dashboard, /searchFunnel\.actionable !== false/);
  assert.match(dashboard, /loginReturnFunnel\.actionable !== false/);
});
