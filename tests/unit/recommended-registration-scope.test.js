"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const acorn = require("acorn");

const ROOT = path.resolve(__dirname, "../..");
const dashboardHtml = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const dashboardSource = [...dashboardHtml.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((source) => source.includes("function selectRecommendationRegistrationScope"));
const serverSource = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"), "utf8");
const appsScriptSource = fs.readFileSync(path.join(ROOT, "doc/google-sheet-web-app.gs"), "utf8");

function getFunctions(source, names) {
  const program = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  return names.map((name) => {
    const node = program.body.find((item) => item.type === "FunctionDeclaration" && item.id?.name === name);
    assert.ok(node, `function not found: ${name}`);
    return source.slice(node.start, node.end);
  }).join("\n");
}

test("신규 추천등록은 기존 규칙이 없어도 일반 일정으로 안전하게 초기화한다", () => {
  const context = vm.createContext({
    asText: (value = "") => String(value == null ? "" : value).trim()
  });
  vm.runInContext(getFunctions(dashboardSource, ["isMonthlyRecommendationRule"]), context);
  assert.equal(context.isMonthlyRecommendationRule(null), false);
  assert.equal(context.isMonthlyRecommendationRule(undefined), false);
  assert.equal(context.isMonthlyRecommendationRule({ scheduleType: "monthly" }), true);
});

test("상품군 관리 열은 추천등록 버튼 하나만 제공한다", () => {
  assert.match(dashboardHtml, /data-action="recommendation-register-candidate">추천등록<\/button>/);
  assert.doesNotMatch(dashboardHtml, /data-action="recommendation-register-candidate">\$\{group\.familyId \? "통합 추천등록"/);
});

test("추천일정 행의 구분·정원 편집은 제거하고 등록 모달에서 설정한다", () => {
  const managerStart = dashboardSource.lastIndexOf("function renderRecommendedSchedulesManager");
  const managerEnd = dashboardSource.indexOf("function getFamilyPrototypeStatusLabel", managerStart);
  const managerSource = dashboardSource.slice(managerStart, managerEnd);
  assert.doesNotMatch(managerSource, /data-recommendation-monthly/);
  assert.doesNotMatch(managerSource, /data-recommendation-capacity/);
  assert.match(dashboardSource, /data-recommendation-registration-monthly/);
  assert.match(dashboardSource, /recommendation-registration-type-toggle/);
  assert.match(dashboardSource, /data-recommendation-registration-capacity/);
  assert.match(dashboardSource, /recommendationOptions\.monthly = registrationSelection\.monthly/);
  assert.match(dashboardSource, /recommendationOptions\.capacity = registrationSelection\.capacity/);
});

test("등록 모달 상단은 선택 상품·팩 유형·출발일·요금을 요약한다", () => {
  assert.match(dashboardSource, /recommendation-registration-product-title/);
  assert.match(dashboardSource, /selectedProduct\.title \|\| group\?\.title/);
  assert.match(dashboardSource, /getPackLabel\(selectedPackType\)/);
  assert.match(dashboardSource, />출발일 <strong>/);
  assert.match(dashboardSource, /formatPrice\(selectedPrice\)/);
  assert.match(dashboardSource, /title: "추천일정 등록"/);
  assert.match(dashboardSource, /recommendation-registration-period-date/);
  assert.match(dashboardSource, /recommendation-registration-period-price/);
});

test("등록 모달은 개별 한 기간과 통합 복수 기간을 구분한다", () => {
  assert.match(dashboardSource, /function selectRecommendationRegistrationScope/);
  assert.match(dashboardSource, /value="individual"/);
  assert.match(dashboardSource, /value="integrated"/);
  assert.match(dashboardSource, /mode === "individual" \? selectedCount === 1/);
  assert.match(dashboardSource, /mode === "integrated" && selectedCount >= 2/);
  assert.match(dashboardSource, /selectedOptionIds\.has\(getRecommendationFamilyOptionId\(option\)\)/);
});

test("설정 모달은 등록 버튼을 사용하고 최종 확인은 상세 요약 없이 간단히 표시한다", () => {
  const selectFlow = dashboardSource.slice(
    dashboardSource.indexOf("async function selectRecommendationRegistrationScope"),
    dashboardSource.indexOf("function buildRecommendationCandidateSchedule")
  );
  const confirmFlow = dashboardSource.slice(
    dashboardSource.indexOf("async function confirmAndSaveRecommendationSchedule"),
    dashboardSource.indexOf("async function openRecommendationCandidateProduct")
  );
  assert.match(selectFlow, /okText: "등록"/);
  assert.match(confirmFlow, /title: "추천일정 등록 확인"/);
  assert.match(confirmFlow, /message: "선택한 설정으로 추천일정을 등록할까요\?"/);
  assert.doesNotMatch(confirmFlow, /summaryRows|class="info-grid"/);
});

test("개별 등록은 상품군 필드를 비우고 통합 등록은 선택 옵션만 저장한다", () => {
  const saveFlow = dashboardSource.slice(
    dashboardSource.indexOf("async function saveRecommendationScheduleByKey"),
    dashboardSource.indexOf("async function saveRegisteredRecommendationCapacity")
  );
  assert.match(saveFlow, /registrationMode === "integrated"/);
  assert.match(saveFlow, /const productFamilyId = registrationMode === "integrated"/);
  assert.match(saveFlow, /familyOptionsJson: productFamilyId \? JSON\.stringify\(familyOptions\) : ""/);
  assert.match(saveFlow, /`rs-\$\{selected\.goodSeq\}-\$\{selected\.eventSeq\}`/);
});

test("서버는 동일 ERP 기간의 개별·통합 중복을 차단한다", () => {
  const context = vm.createContext({
    JSON,
    Set,
    String,
    asText: (value = "") => String(value == null ? "" : value).trim(),
    normalizeCanonicalErpEventSeq: (value) => /^\d+$/.test(String(value || "")) ? String(value) : "",
    normalizeCanonicalErpProductId: (value) => /^\d+$/.test(String(value || "")) ? String(value) : "",
    createHttpError: (message, status, details) => Object.assign(new Error(message), { status }, details)
  });
  vm.runInContext(getFunctions(serverSource, [
    "isActiveRecommendedScheduleRule",
    "getRecommendedScheduleOptionKeys",
    "assertNoRecommendedScheduleOptionConflict"
  ]), context);
  const rows = [{
    recommendedScheduleId: "rs-30001287-30286551",
    erpProductId: "30001287",
    erpEventSeq: "30286551",
    section: "available_schedule",
    isVisible: true
  }];
  assert.throws(() => context.assertNoRecommendedScheduleOptionConflict(rows, {
    recommendedScheduleId: "rs-family-pf_abc-2027-01-16",
    productFamilyId: "pf_abc",
    familyOptionsJson: JSON.stringify([
      { goodSeq: "30001287", eventSeq: "30286551" },
      { goodSeq: "30001288", eventSeq: "30286552" }
    ])
  }, "rs-family-pf_abc-2027-01-16"), (error) => error.code === "recommended_schedule_option_conflict" && error.status === 409);
  assert.doesNotThrow(() => context.assertNoRecommendedScheduleOptionConflict(rows, rows[0], "rs-30001287-30286551"));
});

test("Apps Script 폴백도 상품군 필드와 중복 차단을 유지한다", () => {
  assert.match(appsScriptSource, /"productFamilyId",\s*"familyDepartureDate",\s*"familyOptionsJson"/);
  assert.match(appsScriptSource, /function getRecommendedScheduleConflictError_/);
  assert.match(appsScriptSource, /error:\s*"recommended_schedule_option_conflict"/);
  assert.match(appsScriptSource, /recommendationConflictError = getRecommendedScheduleConflictError_\(payload\)/);
});
