"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dashboardPath = path.resolve(__dirname, "../../golfjoin_admin_dashboard.html");
const source = fs.readFileSync(dashboardPath, "utf8");

test("추천일정 첫 진입은 상품군 로딩 중 거대한 후보 표를 먼저 그리지 않는다", () => {
  assert.match(source, /productFamilyAdminState\.loading && !productFamilyAdminState\.loaded/);
  assert.match(source, /추천 상품군 정보를 불러오고 있습니다/);
});

test("추천일정 달력은 행마다 미리 만들지 않고 선택한 행만 지연 생성한다", () => {
  assert.match(source, /<div class="recommendation-calendar-months"><\/div>/);
  assert.match(source, /willOpen && !picker\.querySelector\("\.recommendation-calendar-months"\)\?\.children\.length/);
  assert.match(source, /updateRecommendationCalendarPicker\(picker\)/);
});

test("추천일정 달력은 화면에서 계산한 상품군·상품·월·날짜 인덱스를 재사용한다", () => {
  assert.match(source, /let recommendationCalendarRuntime = \{[\s\S]*?groupsByKey: new Map\(\)[\s\S]*?itemsByKey: new Map\(\)/);
  assert.match(source, /const recommendationCalendarGroupIndexCache = new WeakMap\(\)/);
  assert.match(source, /function indexRecommendationCalendarRuntime\(groups = \[\]\)/);
  assert.match(source, /indexRecommendationCalendarRuntime\(allProductGroups\)/);
  assert.match(source, /recommendationCalendarRuntime\.groupsByKey\.get\(asText\(groupId\)\)/);
  assert.match(source, /getRecommendationCalendarGroupIndex\(group\)\.itemsByMonth\.get\(monthKey\)/);
  assert.match(source, /getRecommendationCalendarGroupIndex\(group\)\.itemsByDate\.get\(asText\(departureDate\)\)/);
});

test("달력 한 달 렌더링은 날짜마다 전체 상품을 다시 찾지 않는다", () => {
  const grid = source.match(/function renderRecommendationCalendarGrid\([\s\S]*?\n    \}/)?.[0] || "";
  assert.match(grid, /const selected = getRecommendationCalendarGroupIndex\(group\)\.itemsByKey\.get/);
  assert.match(grid, /const todayISO = getRecommendationTodayISO\(\)/);
  assert.match(grid, /const dayOfWeek = \(firstDay \+ day - 1\) % 7/);
  assert.doesNotMatch(grid, /for \(let day[\s\S]*?findRecommendationProductByKey\(selectedKey\)/);
});

test("등록 추천일정의 상품군 연결은 전체 그룹을 반복 계산하지 않는다", () => {
  assert.match(source, /const allProductGroups = getRecommendationProductGroups\(productItems\)/);
  assert.match(source, /const registeredRulesByGroupKey = new Map\(\)/);
  assert.match(source, /getRecommendationRuleGroupKey\(rule, allProductGroups\)/);
  assert.match(source, /registeredRulesByGroupKey\.get\(asText\(group\.key\)\) \|\| \[\]/);
});

test("상품군 구성원이 문자열 또는 객체여도 같은 상품군으로 처리한다", () => {
  assert.match(source, /function getRecommendationFamilyMemberGoodSeq\(member\)/);
  assert.match(source, /typeof member === "string" \? asText\(member\) : asText\(member\?\.goodSeq\)/);
});

test("추천일정 기간 열은 한 행에 두 개씩 최대 두 행으로 제한한다", () => {
  assert.match(source, /\.recommendation-period-list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(source, /\.recommendation-table th:nth-child\(5\),[\s\S]*?min-width:\s*172px/);
  assert.match(source, /labels\.length > 4[\s\S]*?labels\.slice\(0, 3\)[\s\S]*?외 \$\{labels\.length - 3\}개/);
  assert.match(source, /\$\{renderRecommendationPeriodCell\(group\)\}/);
});

test("추천일정 기간은 상품보기와 같은 박스형 스타일로 표시한다", () => {
  assert.match(source, /\.recommendation-period-item\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(source, /\.recommendation-period-item\s*\{[\s\S]*?height:\s*28px/);
  assert.match(source, /\.recommendation-period-item\s*\{[\s\S]*?border:\s*1px solid var\(--line\)/);
  assert.match(source, /\.recommendation-period-item\s*\{[\s\S]*?border-radius:\s*8px/);
  assert.match(source, /\.recommendation-period-item\s*\{[\s\S]*?background:\s*var\(--panel\)/);
  assert.match(source, /\.recommendation-period-item\s*\{[\s\S]*?padding:\s*0 8px/);
});

test("추천일정 고정 헤더를 유지하고 일반·단체 설정은 등록 모달에 둔다", () => {
  assert.match(source, /\.recommendation-table > thead > tr > th\s*\{\s*z-index:\s*6/);
  assert.match(source, /\.recommendation-registration-settings\s*\{/);
  assert.match(source, /data-recommendation-registration-monthly/);
  assert.match(source, /recommendation-registration-type-toggle/);
});

test("등록상태 버튼은 저장한 상품군 키로 같은 행을 펼친다", () => {
  assert.match(source, /const isExpanded = activeCount > 0 && state\.expandedRecommendationGoodSeq === asText\(group\.key\)/);
  assert.match(source, /const goodSeq = asText\(row\?\.dataset\.recommendationProduct\)/);
  assert.match(source, /state\.expandedRecommendationGoodSeq = state\.expandedRecommendationGoodSeq === goodSeq \? "" : goodSeq/);
  assert.match(source, /registeredRules\.map\(renderRecommendationRegisteredItem\)/);
});
