"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const analytics = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/ga4-admin-analytics.js"), "utf8");

test("v51 관리자 대시보드와 GA4 집계 모듈 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
  assert.doesNotThrow(() => new Function("require", "module", "exports", analytics));
});

test("v51 API는 검색·로그인 복귀·행동별 완료율 보고서를 두 배치 안에서 집계한다", () => {
  assert.match(analytics, /name: "searchFunnel"[\s\S]*?customEvent:source_area/);
  assert.match(analytics, /name: "loginFunnel"[\s\S]*?golfjoin_login_return_complete/);
  assert.match(analytics, /name: "loginReturnActions"[\s\S]*?customEvent:return_action/);
  assert.match(analytics, /journeyFunnels:[\s\S]*?search:[\s\S]*?loginReturn:/);
  assert.match(analytics, /loginReturnActions: buildGa4LoginReturnActions/);
  assert.match(analytics, /index \+= 5/);
});

test("v51 검색 퍼널은 메인 검색과 destination_search 후속 행동을 다섯 단계로 연결한다", () => {
  ["검색 열기", "검색 실행", "결과 노출", "상품 선택", "상세 열람"].forEach((label) => {
    assert.match(analytics, new RegExp(label));
  });
  assert.match(analytics, /sourceAreas: \["main"\]/);
  assert.match(analytics, /sourceAreas: \["destination_search"\]/);
  assert.match(dashboard, /여행지 검색 퍼널/);
  assert.match(dashboard, /mapAnalyticsJourneySteps\(searchFunnel\)/);
  assert.match(dashboard, /analytics-funnel\.five/);
});

test("v51 로그인 복귀 퍼널과 원래 행동별 표는 유효한 이전 기간 데이터만 표시한다", () => {
  assert.match(dashboard, /로그인 복귀 퍼널/);
  assert.match(dashboard, /로그인 복귀 행동별 성과/);
  assert.match(dashboard, /data\.loginReturnActions, comparison\.loginReturnActions, comparisonAvailable/);
  assert.match(dashboard, /data\.comparisonAvailable === true/);
  assert.match(dashboard, /로그인 요구/);
  assert.match(dashboard, /복귀 완료/);
  assert.match(dashboard, /이전 기간/);
});

test("v51은 기존 필터·내부 퍼널·개인정보 차단 계약을 유지한다", () => {
  assert.match(dashboard, /options\.memberState/);
  assert.match(dashboard, /options\.sourceMedium/);
  assert.match(dashboard, /internalFunnels\?\.apply/);
  assert.match(dashboard, /internalFunnels\?\.builder/);
  assert.doesNotMatch(analytics, /member_id|member_seq|mobileNumber|emailAddress|birthDate/i);
});

test("v51 모바일 로그인 화면은 관리자 본문의 최소 폭에 밀리지 않는다", () => {
  assert.match(dashboard, /body:has\(\.login-screen:not\(\[hidden\]\)\) \{[\s\S]*?min-width: 0;/);
  assert.match(dashboard, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});
