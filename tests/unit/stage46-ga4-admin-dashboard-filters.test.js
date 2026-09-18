"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");

test("v46 관리자 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});

test("v46은 최근·직접 기간과 이전 기간 비교 컨트롤을 제공한다", () => {
  assert.match(dashboard, /id="analyticsPeriodFilter"[\s\S]*?value="7"[\s\S]*?value="30"[\s\S]*?value="90"[\s\S]*?value="custom"/);
  assert.match(dashboard, /id="analyticsStartDate" type="date"/);
  assert.match(dashboard, /id="analyticsEndDate" type="date"/);
  assert.match(dashboard, /id="analyticsCompareFilter" type="checkbox" checked/);
  assert.match(dashboard, /직접 선택 기간은 최대 90일까지 조회할 수 있습니다/);
  assert.match(dashboard, /url\.searchParams\.set\("startDate", options\.startDate\)/);
  assert.match(dashboard, /url\.searchParams\.set\("endDate", options\.endDate\)/);
  assert.match(dashboard, /url\.searchParams\.set\("compare", "1"\)/);
});

test("v46은 기기·회원상태·유입경로 필터를 인증된 집계 API에만 전달한다", () => {
  assert.match(dashboard, /id="analyticsDeviceFilter"/);
  assert.match(dashboard, /id="analyticsMemberFilter"/);
  assert.match(dashboard, /id="analyticsSourceFilter"/);
  assert.match(dashboard, /url\.searchParams\.set\("device", options\.device\)/);
  assert.match(dashboard, /url\.searchParams\.set\("memberState", options\.memberState\)/);
  assert.match(dashboard, /url\.searchParams\.set\("sourceMedium", options\.sourceMedium\)/);
  const fetchSource = dashboard.match(/async function fetchGa4AnalyticsDashboard[\s\S]*?^    }/m)?.[0] || "";
  assert.match(fetchSource, /"X-Golfjoin-Admin-Token": auth\.token/);
  assert.doesNotMatch(fetchSource, /memberId|memberSeq|mobileNumber|email|birth|userId/i);
});

test("v46 KPI는 이전 기간 요약과 증감률·퍼센트포인트를 표시한다", () => {
  assert.match(dashboard, /ga4AnalyticsState\.data\?\.comparison\?\.summary/);
  assert.match(dashboard, /function buildAnalyticsDelta/);
  assert.match(dashboard, /이전 기간 대비/);
  assert.match(dashboard, /%p/);
  assert.match(dashboard, /\.analytics-kpi-delta\.up/);
  assert.match(dashboard, /\.analytics-kpi-delta\.down/);
});

test("v46 필터 상태는 상단 상태 영역에 표시되고 중복 선택 칩은 제거됐다", () => {
  assert.doesNotMatch(dashboard, /id="analyticsActiveFilters"/);
  assert.doesNotMatch(dashboard, /class="analytics-filter-chip"/);
  assert.match(dashboard, /getAnalyticsPeriodLabel\(\)/);
  assert.match(dashboard, /ga4AnalyticsState\.compare \? "이전 기간 비교"/);
});
