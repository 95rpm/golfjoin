"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const SOURCE_PATH = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
);
const SOURCE = fs.readFileSync(SOURCE_PATH, "utf8");

function between(startMarker, endMarker) {
  const start = SOURCE.indexOf(startMarker);
  const end = SOURCE.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return SOURCE.slice(start, end);
}

test("명시된 항공팩은 상품명에 항공팩 문구가 없어도 항공포함으로 판정한다", () => {
  const functionSource = between(
    "function hasIncludedFlight(join = {})",
    "function renderJoinFlightChip(join)"
  );
  const context = vm.createContext({
    hasRoundTripFlightInclude: () => false,
    isIndividualAirProduct: (join) => Boolean(join.individualAir),
    getActualDetailProductType: (join) => join.packType === "air" ? "항공팩" : (join.packType === "golf" ? "골프팩" : "")
  });
  vm.runInContext(functionSource, context);

  assert.equal(vm.runInContext("hasIncludedFlight({ packType: 'air', title: '[1월 월례회] 바탐' })", context), true);
  assert.equal(vm.runInContext("hasIncludedFlight({ packType: 'golf', title: '[1월 월례회] 바탐' })", context), false);
  assert.equal(vm.runInContext("hasIncludedFlight({ packType: 'air', individualAir: true })", context), false);
});

test("관리자 추천일정은 현재 홈 상품과 전용 보정 캐시를 우선 조회한다", () => {
  const findBlock = between(
    "function findAdminRecommendedProduct(rule = {})",
    "function reconcileAdminRecommendedProducts(rows = [], normalizedJoins = [])"
  );
  assert.match(findBlock, /adminRecommendedProductCache\.get\(productKey\)/);
  assert.match(findBlock, /\.\.\.\(homeGolfJoinProducts \|\| \[\]\)/);
  assert.match(findBlock, /\.\.\.joins\.filter\(\(item\) => !item\?\.isAdminRecommendedSchedule\)/);
});

test("이미지 없는 추천일정은 최신 홈 카드에서 상품을 읽고 같은 행사번호로 다시 결합한다", () => {
  const reconcileBlock = between(
    "function reconcileAdminRecommendedProducts(rows = [], normalizedJoins = [])",
    "function normalizeAdminRecommendedScheduleRule(rule = {})"
  );
  const applyBlock = between(
    "function applyAdminRecommendedScheduleRows(rows = [], options = {})",
    "async function hydrateAdminRecommendedSchedulesFromGoogleSheet()"
  );

  assert.match(reconcileBlock, /loadGolfJoinHomeCardsJson\(\)/);
  assert.match(reconcileBlock, /adminRecommendedProductCache\.set\(key, normalizedProduct\)/);
  assert.match(reconcileBlock, /applyAdminRecommendedScheduleRows\(latestRows, \{ reconcileProducts: false \}\)/);
  assert.match(reconcileBlock, /scheduleHomeRender\(\{ deferWhileModalOpen: true, source: "admin-recommended-product-reconciliation" \}\)/);
  assert.match(applyBlock, /reconcileAdminRecommendedProducts\(rows, normalizedJoins\)/);
});

