const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");

test("v79 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const scripts = [...dashboard.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  assert.equal(scripts.length, 1);
  scripts.forEach((script) => assert.doesNotThrow(() => new vm.Script(script)));
});

test("v79 상담대기는 신청자가 선택한 통합 기간만 표시한다", () => {
  assert.match(dashboard, /function getParticipantSelectedScheduleContext\(schedule = \{\}, participant = \{\}\)/);
  assert.match(dashboard, /const option = findScheduleFamilyPeriodOption\(schedule, participant\)/);
  assert.match(dashboard, /<td>\$\{escapeHtml\(selected\.periodLabel \|\| "-"\)\}<\/td>/);
  assert.match(dashboard, /renderScheduleDateCell\(selected\.returnDate\)/);
  assert.doesNotMatch(
    dashboard.match(/function renderConsultationApplicantRow\(item\) \{[\s\S]*?\n    \}/)?.[0] || "",
    /getSchedulePeriodLabel\(schedule\)/
  );
});

test("v79 견적 초안은 선택 ERP 상품의 상품명과 출발·도착일을 사용한다", () => {
  assert.match(dashboard, /selectedProductContext: getParticipantSelectedScheduleContext\(schedule, participant\)/);
  assert.match(dashboard, /productName: selected\.productName \|\| participant\.productName/);
  assert.match(dashboard, /departureDate: normalizeQuoteEditorDate\(selected\.departureDate/);
  assert.match(dashboard, /returnDate: normalizeQuoteEditorDate\(selected\.returnDate/);
  assert.match(dashboard, /tripSummary: selected\.periodLabel/);
});

test("v79 견적 상세와 확정 요청은 선택 ERP 상품 컨텍스트를 유지한다", () => {
  assert.match(dashboard, /getProductDetailContent\(selected\.row \|\| \{\}, selected\.product \|\| \{\}\)/);
  assert.match(dashboard, /schedule: quoteEditorContext\.selectedProductContext\?\.row/);
  assert.match(dashboard, /product: quoteEditorContext\.selectedProductContext\?\.product/);
  assert.match(dashboard, /if \(includedItems\) quoteEditorDraft\.includedItems = includedItems/);
  assert.match(dashboard, /if \(itinerarySchedule\.length\) quoteEditorDraft\.itinerarySchedule = itinerarySchedule/);
  assert.match(dashboard, /if \(flightScheduleItems\) quoteEditorDraft\.flightScheduleItems = flightScheduleItems/);
});
