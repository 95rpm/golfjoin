"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const analytics = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/ga4-admin-analytics.js"), "utf8");

test("v54 관리자 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});

test("v54 API는 추가 보고서 없이 분석 준비 상태와 분자·분모를 제공한다", () => {
  for (const value of [
    "buildGa4AnalysisReadiness",
    "analysisReadiness",
    "minimumDays: 7",
    "directionalDenominator: 30",
    "stableDenominator: 100",
    "numerator",
    "denominator",
    "sampleStatus"
  ]) assert.ok(analytics.includes(value), value);
  assert.ok(analytics.includes("GA4_DASHBOARD_REPORT_NAMES"));
  assert.doesNotMatch(analytics, /member_id|member_seq|mobileNumber|emailAddress|birthDate/i);
});

test("v54 이용자 흐름 카드는 초보자용 해석과 네 이동 구간을 표시한다", () => {
  for (const value of [
    "이용자 흐름과 다음 행동",
    "가장 먼저 확인할 구간",
    "홈 화면 운영 힌트",
    "마케팅 활용 힌트",
    "메인 방문 → 상품 상세",
    "상품 상세 → 신청 시작",
    "신청 시작 → 신청 완료",
    "새 모임 시작 → 생성 완료",
    "다음에 확인할 것",
    "renderAnalyticsReadiness",
    "data.analysisReadiness"
  ]) assert.ok(dashboard.includes(value), value);
  for (const value of ["상세 열람률", "신청 시작률", "신청 완료율", "새 모임 완료율"]) {
    assert.ok(analytics.includes(value), value);
  }
});

test("v54 표본 판정은 내부에 유지하고 화면에는 쉬운 상태 문구를 표시한다", () => {
  for (const value of ["아직 데이터 없음", "데이터 더 필요", "경향 참고 가능", "비교 분석 가능"]) {
    assert.ok(dashboard.includes(value), value);
  }
  const renderStart = dashboard.indexOf("function renderAnalyticsReadiness");
  const renderEnd = dashboard.indexOf("function mapAnalyticsJourneySteps", renderStart);
  const renderSource = dashboard.slice(renderStart, renderEnd);
  for (const value of ["분자", "분모", "방향성", "안정 표본"]) assert.ok(!renderSource.includes(value), value);
});

test("v54 요청 타이포·상태 배지·점검 설명 구조를 적용하고 중복 안내를 제거한다", () => {
  for (const [pattern, label] of [
    [/\.analytics-readiness-period-item span \{[\s\S]*?font-size: 15px;[\s\S]*?font-weight: 700;/, "기간 라벨"],
    [/\.analytics-readiness-decision-label \{[^}]*font-size: 15px;[^}]*font-weight: 700;/, "판단 라벨"],
    [/\.analytics-readiness-metric-name \{[\s\S]*?font-size: 16px;[\s\S]*?font-weight: 800;/, "흐름명"],
    [/\.analytics-readiness-status \{[\s\S]*?padding: 5px 9px;[\s\S]*?font-size: 12px;/, "상태 배지"],
    [/\.analytics-readiness-fraction \{[^}]*font-size: 15px;[^}]*font-weight: 600;/, "사용자 문장"],
    [/\.analytics-readiness-action span \{[\s\S]*?font-size: 15px;[\s\S]*?font-weight: 800;/, "점검 제목"],
    [/\.analytics-readiness-action-detail \{[^}]*color: #707c8d;[^}]*font-size: 14px;[^}]*font-weight: 600;/, "점검 내용"],
    [/\.analytics-validation-flow-title \{[^}]*font-size: 18px;[^}]*font-weight: 700;/, "검증 흐름명"],
    [/\.analytics-validation-check-name \{[\s\S]*?font-size: 15px;[\s\S]*?font-weight: 700;/, "검증 항목명"],
    [/\.analytics-validation-check-code \{[\s\S]*?font-size: 14px;[\s\S]*?font-weight: 600;/, "검증 코드"],
    [/\.analytics-validation-check-value \{[^}]*font-size: 16px;[^}]*font-weight: 700;/, "검증 값"],
    [/\.analytics-validation-note \{[^}]*margin-top: 15px;[^}]*font-size: 14px;[^}]*font-weight: 700;/, "검증 안내"]
  ]) assert.match(dashboard, pattern, label);
  assert.match(dashboard, /class="analytics-readiness-action-detail"/);
  assert.doesNotMatch(dashboard, /analytics-readiness-note/);
  assert.doesNotMatch(dashboard, /analytics-active-filters/);
});

test("v54 분석 준비 카드가 태블릿 2열·모바일 1열로 재배치된다", () => {
  assert.match(dashboard, /\.analytics-readiness-grid \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(dashboard, /@media \(max-width: 860px\)[\s\S]*?\.analytics-readiness-decision-grid,[\s\S]*?\.analytics-readiness-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(dashboard, /@media \(max-width: 520px\)[\s\S]*?\.analytics-readiness-decision-grid,[\s\S]*?\.analytics-readiness-grid \{ grid-template-columns: 1fr; \}/);
});

test("v54 분석 준비 네 카드는 가장 긴 내용을 기준으로 구분선과 점검 영역을 맞춘다", () => {
  assert.match(
    dashboard,
    /\.analytics-readiness-grid \{[\s\S]*?grid-auto-rows: 1fr;[\s\S]*?align-items: stretch;/
  );
  assert.match(
    dashboard,
    /\.analytics-readiness-metric \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\) auto;[\s\S]*?height: 100%;/
  );
  assert.match(dashboard, /--analytics-readiness-fraction-min-height/);
  assert.match(dashboard, /--analytics-readiness-action-detail-min-height/);
  assert.match(dashboard, /function scheduleAnalyticsReadinessMetricHeights\(\)[\s\S]*?document\.createRange\(\)[\s\S]*?fractions\.map\(measureTextHeight\)[\s\S]*?actionDetails\.map\(measureTextHeight\)/);
  assert.match(dashboard, /tableWrap\.innerHTML = `[\s\S]*?scheduleAnalyticsReadinessMetricHeights\(\);/);
  assert.doesNotMatch(dashboard, /\.analytics-readiness-grid \{ grid-auto-rows: auto; \}/);
});

test("v54 이용자 분석 최초 진입은 다른 관리자 메뉴와 같은 공용 로딩을 사용한다", () => {
  assert.match(
    dashboard,
    /ga4AnalyticsState\.loading && !ga4AnalyticsState\.data[\s\S]*?class="empty loading-state"[\s\S]*?class="loading-spinner"[\s\S]*?GA4 이용자 분석 데이터를 불러오는 중입니다\./
  );
  assert.doesNotMatch(
    dashboard,
    /ga4AnalyticsState\.loading && !ga4AnalyticsState\.data[\s\S]{0,400}?class="analytics-empty-state"/
  );
});

test("v54는 v53 완료 검증과 기존 기간·필터·퍼널을 유지한다", () => {
  for (const value of [
    "renderAnalyticsCompletionValidation",
    "완료 이벤트 수집 상태",
    "analyticsPeriodFilter",
    "analyticsCompareFilter",
    "analyticsDeviceFilter",
    "여행지 검색 퍼널",
    "로그인 복귀 퍼널"
  ]) assert.ok(dashboard.includes(value), value);
});
