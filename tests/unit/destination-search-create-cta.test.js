"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const detail = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");
const auth = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"), "utf8");
const deepLinks = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css"), "utf8");

function slice(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `missing slice: ${startToken}`);
  return source.slice(start, end);
}

test("여행지 검색의 일정 있음·없음 상태가 동일한 생성 안내 UI를 사용한다", () => {
  const renderer = slice(detail, "function renderRegionCreatePrompt", "function getJoinRecommendationRegionParts");
  const search = slice(detail, "function performRegionProductSearch", "function openTravelDateModal");

  assert.match(renderer, /region-result-empty region-result-create-prompt/);
  assert.match(renderer, /region-result-empty-copy/);
  assert.match(renderer, /region-result-empty-title/);
  assert.match(renderer, /region-result-empty-action-line/);
  assert.match(renderer, /region-result-empty-action/);
  assert.match(renderer, /원하는 일정이 없나요\?/);
  assert.match(renderer, /에는 아직 참여 가능한 모임이 없어요\./);
  assert.match(renderer, /원하는 상품과 날짜로 직접 모임을 만들어 보세요\./);
  assert.match(renderer, /에 모임 만들기/);
  assert.match(search, /renderRegionCreatePrompt\(query\)/);
  assert.match(search, /renderRegionCreatePrompt\(query, \{ hasResults: true \}\)/);
  assert.match(search, /다른 지역에서 바로 참여 가능한 모임/);
});

test("생성 안내 버튼은 기존 일정 없음 버튼의 색상과 반응형 스타일을 그대로 공유한다", () => {
  const actionRule = css.match(/#regionSearchModal \.region-result-empty-action\s*\{([\s\S]*?)\}/)?.[1] || "";
  const resultPromptRule = css.match(/#regionSearchModal \.region-result-create-prompt\.is-after-results\s*\{([\s\S]*?)\}/)?.[1] || "";

  assert.match(actionRule, /background:\s*#54abff/);
  assert.match(actionRule, /color:\s*#fff/);
  assert.match(resultPromptRule, /margin-top:\s*18px/);
  assert.doesNotMatch(resultPromptRule, /background|color|border|font|padding/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?#regionSearchModal \.region-result-empty-action\s*\{[\s\S]*?max-width:\s*320px/);
});

test("지역 생성 CTA는 지역을 보존하고 출발일 우선 생성 흐름으로 연결한다", () => {
  const entry = slice(detail, "async function initializeBuilderFromRegionSearch", "function getJoinRecommendationRegionParts");
  const dateSelection = slice(detail, "function selectBuilderDate", "function getBuilderDateButton");
  const productSelection = slice(detail, "function selectBuilderProduct", "async function showBuilderProductDetailProduct");

  assert.match(entry, /builderAction:\s*"region-search"/);
  assert.match(entry, /builderRegion:\s*targetRegion/);
  assert.match(entry, /analyticsSourceArea:\s*"destination_search"/);
  assert.match(entry, /regionDateFirstMode:\s*true/);
  assert.match(entry, /dateConstraintRegions:\s*\[targetRegion\]/);
  assert.match(dateSelection, /if \(builderState\.regionDateFirstMode\)/);
  assert.match(dateSelection, /builderState\.endDay = null/);
  assert.match(productSelection, /product\.returnDate \|\| product\.departureDate/);
});

test("비로그인·프로필 보완·리다이렉트 뒤에도 선택 지역을 복원한다", () => {
  const continuation = slice(detail, "async function continueBuilderAfterLogin", "let detailModalPageScrollState");
  const modal = slice(detail, "async function openModal", "function elevateBuilderProductDetailModal");
  const resume = slice(deepLinks, "async function resumeJoinMyMenuAfterLogin", "function getJoinExternalDeepLinkTarget");

  assert.match(continuation, /builderAction === "region-search"/);
  assert.match(continuation, /normalizeRegionBuilderEntryName\(params\.builderRegion\)/);
  assert.match(continuation, /if \(!targetRegion\)[\s\S]*openModal\("builderModal"/);
  assert.match(modal, /requireJoinLogin\("builder", builderLoginParams\)/);
  assert.match(modal, /ensureJoinMemberProfileReady\("builder", builderLoginParams\)/);
  assert.match(auth, /"builderRegion"/);
  assert.match(resume, /const builderRegion = params\.get\("builderRegion"\)/);
  assert.match(resume, /params\.delete\("builderRegion"\)/);
  assert.match(resume, /continueBuilderAfterLogin\(\{ builderAction, builderRegion,/);
});
