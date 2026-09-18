"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");

test("관리자 대시보드 인라인 스크립트는 올바른 JavaScript다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});

test("이용자 분석 메뉴는 관리자 인증으로 상세 GA4 action만 호출한다", () => {
  assert.match(dashboard, /data-menu="user-analytics"[\s\S]*?이용자 분석/);
  assert.match(dashboard, /url\.searchParams\.set\("action", "admin_ga4_dashboard"\)/);
  assert.match(dashboard, /"X-Golfjoin-Admin-Token": auth\.token/);
  assert.match(dashboard, /data\.schema !== "golfjoin-ga4-admin-dashboard-v1"/);
  assert.doesNotMatch(
    dashboard.match(/async function fetchGa4AnalyticsDashboard[\s\S]*?^    }/m)?.[0] || "",
    /memberId|memberSeq|mobile|email|birth|name=/i
  );
});

test("이용자 분석은 기간·KPI·퍼널·섹션·비교·추이·유입경로와 상태를 제공한다", () => {
  assert.match(dashboard, /id="analyticsPeriodFilter"[\s\S]*?value="7"[\s\S]*?value="30"[\s\S]*?value="90"/);
  [
    "방문자",
    "상세 열람률",
    "신청 시작률",
    "신청 완료율",
    "참여 신청 퍼널",
    "새 모임 생성 퍼널",
    "지금 확인할 개선 후보",
    "섹션 성과",
    "기기별 상세 열람률",
    "회원상태별 상세 열람률",
    "일별 추이",
    "유입경로"
  ].forEach((label) => assert.match(dashboard, new RegExp(label)));
  assert.match(dashboard, /data\.quality\?\.partial/);
  assert.match(dashboard, /data\.warnings/);
  assert.match(dashboard, /data-action="analytics-retry"/);
});

test("관리자 페이지는 인라인 파비콘을 사용해 favicon.ico 404 요청을 만들지 않는다", () => {
  assert.match(dashboard, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.doesNotMatch(dashboard, /href=["']\/favicon\.ico/);
});

test("이용자 분석 타이포와 퍼널 장식은 v45b 화면 규격을 따른다", () => {
  [
    [/\.analytics-kpi \.metric-label\s*\{[\s\S]*?font-size:\s*17px;[\s\S]*?font-weight:\s*700;/, "KPI 라벨"],
    [/\.analytics-kpi \.metric-value\s*\{[\s\S]*?font-size:\s*28px;[\s\S]*?font-weight:\s*600;/, "KPI 값"],
    [/\.analytics-kpi-meta\s*\{[\s\S]*?font-size:\s*16px;[\s\S]*?font-weight:\s*600;[\s\S]*?margin-top:\s*2px;/, "KPI 설명"],
    [/\.analytics-card-title\s*\{[\s\S]*?font-size:\s*20px;[\s\S]*?font-weight:\s*700;/, "카드 제목"],
    [/\.analytics-funnel-label\s*\{[\s\S]*?font-size:\s*16px;[\s\S]*?font-weight:\s*700;/, "퍼널 라벨"],
    [/\.analytics-funnel-value\s*\{[\s\S]*?font-size:\s*22px;[\s\S]*?font-weight:\s*600;/, "퍼널 값"],
    [/\.analytics-opportunity strong\s*\{[\s\S]*?font-size:\s*16px;[\s\S]*?font-weight:\s*700;/, "개선 기회 제목"],
    [/\.analytics-table th,[\s\S]*?\.analytics-table td\s*\{[\s\S]*?font-size:\s*15px;[\s\S]*?font-weight:\s*650;/, "분석 표"],
    [/\.analytics-compare-name\s*\{[\s\S]*?font-size:\s*15px;[\s\S]*?font-weight:\s*700;/, "비교 라벨"],
    [/\.analytics-compare-value\s*\{[\s\S]*?font-size:\s*15px;[\s\S]*?font-weight:\s*800;/, "비교 값"]
  ].forEach(([pattern, label]) => assert.match(dashboard, pattern, label));
  assert.match(dashboard, /<span>분석기간<\/span>/);
  assert.doesNotMatch(dashboard, /\.analytics-funnel-step::after/);
  assert.doesNotMatch(dashboard, /--funnel-width/);
  assert.doesNotMatch(dashboard, /class="analytics-status-bar"/);
  assert.doesNotMatch(dashboard, /\.analytics-status-bar\s*\{/);
  assert.match(dashboard, /function setAnalyticsLastUpdated[\s\S]*?analytics-status-main[\s\S]*?analytics-status-side/);
  assert.match(dashboard, /element\.classList\.add\("analytics-status-inline"\)/);
});
