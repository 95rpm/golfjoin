"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const analytics = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/ga4-admin-analytics.js"), "utf8");

test("v49 관리자 대시보드와 GA4 집계 모듈 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
  assert.doesNotThrow(() => new Function("require", "module", "exports", analytics));
});

test("v49 API는 참여 신청·새 모임 단계 맞춤 측정기준을 집계한다", () => {
  assert.match(analytics, /name: "applySteps"[\s\S]*?customEvent:apply_step[\s\S]*?golfjoin_apply_step_view/);
  assert.match(analytics, /name: "builderSteps"[\s\S]*?customEvent:builder_step[\s\S]*?golfjoin_create_step_view/);
  assert.match(analytics, /internalFunnels:[\s\S]*?apply:[\s\S]*?builder:/);
  assert.match(analytics, /index \+= 5/);
  assert.doesNotMatch(analytics, /member_id|member_seq|mobileNumber|emailAddress|birthDate/i);
});

test("v49 이용자 분석 화면은 두 퍼널에서 단계 상세를 열고 진입·이탈·비교를 표시한다", () => {
  assert.match(dashboard, /data-action="analytics-funnel-detail"/);
  assert.match(dashboard, /data-funnel="\$\{escapeHtml\(detailKey\)\}"/);
  assert.match(dashboard, /function renderAnalyticsInternalFunnelDrawer/);
  assert.match(dashboard, /다음 단계 이탈/);
  assert.match(dashboard, /이전 기간/);
  assert.match(dashboard, /buildAnalyticsDelta\(step\.activeUsers, previousStep\.activeUsers\)/);
  assert.match(dashboard, /analyticsWide: true/);
  assert.match(dashboard, /\.drawer\.analytics-wide \{ width: min\(860px, 100vw\); \}/);
  assert.match(dashboard, /맞춤 측정기준 데이터는 GA4 표준 보고서에 반영되기까지 시간이 걸릴 수 있습니다/);
});

test("v49 내부 퍼널 데이터가 없어도 기존 대시보드와 빈 상태가 유지된다", () => {
  assert.match(dashboard, /ga4AnalyticsState\.data\?\.internalFunnels\?\.\[flowKey\] \|\| \{\}/);
  assert.match(dashboard, /선택한 기간에 수집된 작성 단계 데이터가 없습니다/);
  assert.match(dashboard, /data-menu="user-analytics"/);
  assert.match(dashboard, /golfjoin-ga4-admin-dashboard-v1/);
});

test("v49 단계 상세 전용 타이포그래피는 다른 서랍과 분리된다", () => {
  assert.match(dashboard, /analyticsInternalDetail: true/);
  assert.match(dashboard, /classList\.toggle\("analytics-internal-detail", Boolean\(options\.analyticsInternalDetail\)\)/);
  assert.match(dashboard, /classList\.remove\("analytics-internal-detail"\)/);
  assert.match(dashboard, /\.drawer\.analytics-internal-detail \.drawer-sub \{[\s\S]*?font-size: 16px;[\s\S]*?font-weight: 600;/);
  assert.match(dashboard, /\.drawer\.analytics-internal-detail \.drawer-title \{[\s\S]*?font-size: 22px;[\s\S]*?font-weight: 700;/);
  assert.match(dashboard, /\.drawer\.analytics-internal-detail \.analytics-drawer-metric span \{[\s\S]*?font-size: 16px;[\s\S]*?font-weight: 700;/);
  assert.match(dashboard, /\.drawer\.analytics-internal-detail \.analytics-drawer-metric strong \{[\s\S]*?font-size: 22px;[\s\S]*?font-weight: 600;/);
  assert.match(dashboard, /\.drawer\.analytics-internal-detail \.analytics-rate-cell \{[\s\S]*?font-weight: 700 !important;/);
  assert.match(dashboard, /^    \.drawer-title \{[\s\S]*?font-size: 22px;[\s\S]*?font-weight: 800;/m);
  assert.match(dashboard, /^    \.drawer-sub \{[\s\S]*?font-size: 20px;[\s\S]*?font-weight: 600;/m);
});
