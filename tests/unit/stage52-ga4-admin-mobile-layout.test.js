"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");

test("v52 관리자 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});

test("v52 모바일 최소 폭 해제는 이용자 분석 메뉴에만 적용된다", () => {
  assert.match(dashboard, /document\.body\.classList\.toggle\("analytics-layout-active", isAnalyticsMenu\)/);
  assert.match(dashboard, /@media \(max-width: 860px\)[\s\S]*?body\.analytics-layout-active \{ min-width: 0; \}/);
  assert.match(dashboard, /body\.analytics-layout-active \.app-shell,[\s\S]*?grid-template-columns: 64px minmax\(0, 1fr\)/);
  assert.doesNotMatch(dashboard, /@media \(max-width: 860px\)\s*\{\s*body\s*\{\s*min-width: 0/);
});

test("v52 분석 필터와 KPI·퍼널은 태블릿과 모바일에서 단계적으로 재배치된다", () => {
  assert.match(dashboard, /@media \(max-width: 860px\)[\s\S]*?\.analytics-period-control \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(dashboard, /@media \(max-width: 520px\)[\s\S]*?\.metrics\.analytics-mode \{ grid-template-columns: 1fr/);
  assert.match(dashboard, /@media \(max-width: 520px\)[\s\S]*?\.analytics-funnel\.five \{ grid-template-columns: 1fr/);
  assert.match(dashboard, /\.analytics-custom-period-separator \{ display: none; \}/);
});

test("v52 로그인 복귀 표는 긴 행동명을 줄바꿈하고 가로 터치 스크롤을 유지한다", () => {
  assert.match(dashboard, /\.analytics-table-scroll \{[\s\S]*?overflow-x: auto;[\s\S]*?-webkit-overflow-scrolling: touch;/);
  assert.match(dashboard, /\.analytics-login-return-table th:first-child,[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(dashboard, /analytics-login-return-table/);
  assert.match(dashboard, /로그인 복귀 행동별 성과/);
});

test("v52는 v51 검색·로그인 복귀 카드와 기존 필터를 유지한다", () => {
  for (const value of [
    "여행지 검색 퍼널",
    "로그인 복귀 퍼널",
    "analyticsPeriodFilter",
    "analyticsCompareFilter",
    "analyticsDeviceFilter",
    "analyticsMemberFilter",
    "analyticsSourceFilter"
  ]) {
    assert.ok(dashboard.includes(value), value);
  }
});
