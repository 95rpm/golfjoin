"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");

test("v53 관리자 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});

test("v53 완료 이벤트 수집 상태는 두 흐름의 세 신호를 표시한다", () => {
  for (const value of [
    "완료 이벤트 수집 상태",
    "제출 시작 → 단계 완료 → 비즈니스 완료 이벤트",
    "renderAnalyticsCompletionValidation",
    "completionValidation",
    "check.eventName",
    "check.parameter",
    "check.activeUsers",
    "check.eventCount"
  ]) assert.ok(dashboard.includes(value), value);
});

test("v53 완료 이벤트 상태는 검증·수집·확인·대기를 구분한다", () => {
  for (const value of ["verified", "collecting", "needs_review", "waiting", "검증 완료", "수집 중", "확인 필요", "수집 대기"]) {
    assert.ok(dashboard.includes(value), value);
  }
});

test("v53 완료 이벤트 카드는 모바일 한 열과 긴 이벤트명 줄바꿈을 지원한다", () => {
  assert.match(dashboard, /\.analytics-validation-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(dashboard, /@media \(max-width: 520px\)[\s\S]*?\.analytics-validation-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(dashboard, /\.analytics-validation-check-code \{ white-space: normal; overflow-wrap: anywhere; \}/);
});

test("v53는 v52 모바일 레이아웃과 기존 분석 카드를 유지한다", () => {
  for (const value of [
    "analytics-layout-active",
    "여행지 검색 퍼널",
    "로그인 복귀 퍼널",
    "로그인 복귀 행동별 성과",
    "analyticsPeriodFilter",
    "analyticsCompareFilter"
  ]) assert.ok(dashboard.includes(value), value);
});
