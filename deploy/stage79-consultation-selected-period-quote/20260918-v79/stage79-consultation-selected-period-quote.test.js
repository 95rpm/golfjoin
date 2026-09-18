const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const deployName = "DEPLOY_golfjoin_admin_dashboard_BA892377.html";
const rollbackName = "ROLLBACK_golfjoin_admin_dashboard_43D7F2B1.html";
const deploy = fs.readFileSync(deployName, "utf8");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("v79 대시보드 배포·복구 해시가 일치한다", () => {
  assert.equal(sha256(deployName), "ba892377868ed658cdc4c5d89194622b1dcaad4748fcad51554be131fbdb88bb");
  assert.equal(sha256(rollbackName), "43d7f2b17baf4a4bddd5efe37f72748d147404ee120beeff15d52200ab759b1e");
});

test("v79 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const scripts = [...deploy.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  assert.equal(scripts.length, 1);
  scripts.forEach((script) => assert.doesNotThrow(() => new vm.Script(script)));
});

test("v79 상담대기는 신청자가 선택한 기간·상품명·출발일·도착일만 표시한다", () => {
  assert.match(deploy, /function getParticipantSelectedScheduleContext\(schedule = \{\}, participant = \{\}\)/);
  assert.match(deploy, /const option = findScheduleFamilyPeriodOption\(schedule, participant\)/);
  assert.match(deploy, /<td class="product-cell">\$\{escapeHtml\(selected\.productName\)\}<\/td>/);
  assert.match(deploy, /<td>\$\{escapeHtml\(selected\.periodLabel \|\| "-"\)\}<\/td>/);
  assert.match(deploy, /renderScheduleDateCell\(selected\.departureDate\)/);
  assert.match(deploy, /renderScheduleDateCell\(selected\.returnDate\)/);
});

test("v79 견적 초안과 확정 요청은 신청자가 선택한 ERP 상품을 유지한다", () => {
  assert.match(deploy, /selectedProductContext: getParticipantSelectedScheduleContext\(schedule, participant\)/);
  assert.match(deploy, /productName: selected\.productName \|\| participant\.productName/);
  assert.match(deploy, /departureDate: normalizeQuoteEditorDate\(selected\.departureDate/);
  assert.match(deploy, /returnDate: normalizeQuoteEditorDate\(selected\.returnDate/);
  assert.match(deploy, /schedule: quoteEditorContext\.selectedProductContext\?\.row/);
  assert.match(deploy, /product: quoteEditorContext\.selectedProductContext\?\.product/);
});

test("v79 견적 미리보기는 선택 상품의 실제 상세를 조회해 전체 항목을 채운다", () => {
  assert.match(deploy, /getProductDetailContent\(selected\.row \|\| \{\}, selected\.product \|\| \{\}\)/);
  assert.match(deploy, /if \(flightScheduleItems\) quoteEditorDraft\.flightScheduleItems = flightScheduleItems/);
  assert.match(deploy, /if \(includedItems\) quoteEditorDraft\.includedItems = includedItems/);
  assert.match(deploy, /if \(excludedItems\) quoteEditorDraft\.excludedItems = excludedItems/);
  assert.match(deploy, /if \(productNotes\) quoteEditorDraft\.productNotes = productNotes/);
  assert.match(deploy, /if \(itinerarySchedule\.length\) quoteEditorDraft\.itinerarySchedule = itinerarySchedule/);
});

test("v79은 v78 통합 일정 기간별 참여자 기능을 유지한다", () => {
  assert.match(deploy, /function getParticipantPeriodGroups\(schedule = \{\}\)/);
  assert.match(deploy, /data-family-option-id=/);
  assert.match(deploy, /async function chooseRosterFamilyPeriod\(schedule, participant = null\)/);
  assert.match(deploy, /selectedFamilyOptionId: selectedOption\.optionId/);
});
