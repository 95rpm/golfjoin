"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const detailSource = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);
const actionSource = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/39-detail-actions-participants.js"),
  "utf8"
);
const serverSource = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"), "utf8");

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `missing source range: ${startToken}`);
  return source.slice(start, end);
}

test("추천일정 관리는 승인 상품군의 같은 출발일만 통합한다", () => {
  const grouping = sourceBetween(
    dashboard,
    "function getRecommendationApprovedFamilies",
    "function findRecommendationProductByKey"
  );
  assert.match(grouping, /asText\(family\.status\) === "approved"/);
  assert.match(grouping, /goodSeqs\.size >= 2/);
  assert.match(grouping, /sharedDates\?\.has\(asText\(item\.product\?\.departureDate\)\)/);
  assert.match(grouping, /useFamily \? `family:\$\{familyId\}` : `product:\$\{item\.goodSeq\}`/);
  assert.match(dashboard, /\["product-families", "recommended-schedules"\]\.includes\(state\.currentMenu\)/);
});

test("통합 추천일정은 상품군·출발일·실제 ERP 기간 옵션을 한 행에 저장한다", () => {
  const saveFlow = sourceBetween(
    dashboard,
    "async function saveRecommendationScheduleByKey",
    "async function saveRegisteredRecommendationCapacity"
  );
  const familyOptions = sourceBetween(
    dashboard,
    "function buildRecommendationFamilyOptions",
    "function buildRecommendationCandidateSchedule"
  );
  assert.match(saveFlow, /`rs-family-\$\{productFamilyId\}-\$\{asText\(product\.departureDate\)\}`/);
  assert.match(saveFlow, /productFamilyId,/);
  assert.match(saveFlow, /familyDepartureDate:/);
  assert.match(saveFlow, /familyOptionsJson: productFamilyId \? JSON\.stringify\(familyOptions\) : ""/);
  for (const field of ["goodSeq", "eventSeq", "departureDate", "returnDate", "durationLabel", "price"]) {
    assert.match(familyOptions, new RegExp(`\\b${field}\\b`), field);
  }
});

test("기존 개별 추천일정과 출발일이 맞지 않는 상품은 개별 그룹으로 유지한다", () => {
  const groupKey = sourceBetween(
    dashboard,
    "function getRecommendationRuleGroupKey",
    "function parseRecommendationFamilyOptions"
  );
  assert.match(groupKey, /asText\(item\.product\?\.departureDate\) === departureDate/);
  assert.match(groupKey, /return familyGroup \? asText\(familyGroup\.key\) : `product:\$\{goodSeq\}`/);
});

test("메인 카드는 통합 귀국일을 표시하고 상세·신청은 선택 기간만 사용한다", () => {
  const cardFormatter = sourceBetween(
    detailSource,
    "function formatCardDateRange",
    "function formatCardFlexDateLabel"
  );
  assert.match(cardFormatter, /familyReturnLabels\.length >= 2/);
  assert.match(cardFormatter, /`\$\{startLabel\}~\$\{familyReturnLabels\.join\("\/"\)\}`/);
  assert.match(actionSource, /formatCardDateRange\(join, \{ selectedPeriod: true \}\)/);
  assert.match(detailSource, /formatCardDateRange\(join, \{ selectedPeriod: true \}\)/);
});

test("상세 기간 탭은 선택한 실제 ERP 상품·행사·가격으로 교체한다", () => {
  const options = sourceBetween(
    detailSource,
    "function getAdminRecommendedDetailFamilyPeriodOptions",
    "function renderDetailProductFamilyPeriods"
  );
  const select = sourceBetween(
    detailSource,
    "async function selectDetailProductFamilyPeriod",
    "function getProductGroupKey"
  );
  assert.match(options, /goodSeq: snapshot\.goodSeq/);
  assert.match(options, /eventSeq: snapshot\.eventSeq/);
  assert.match(options, /returnDate: snapshot\.returnDate/);
  assert.match(options, /price: Number\(snapshot\.price\)/);
  assert.match(select, /currentDetailJoinData = prepareSecretTourInitialFlightScheduleState\(option\.product\)/);
  assert.match(select, /await enrichOpenDetailWithSecretTourData/);
  assert.match(detailSource, /currentDetailJoinData && currentDetailJoinData\.id === currentDetailJoinId/);
});

test("서버는 추천일정 상품군 열을 보존하고 잘못된 통합 옵션을 거부한다", () => {
  assert.match(serverSource, /"productFamilyId",\s*"familyDepartureDate",\s*"familyOptionsJson"/);
  assert.match(serverSource, /departureDate !== familyDepartureDate/);
  assert.match(serverSource, /familyOptionsJson must contain distinct ERP products/);
  assert.match(serverSource, /ensureGoogleSheetHeadersViaApi\("recommended_schedules"/);
});
