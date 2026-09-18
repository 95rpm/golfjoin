"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { __test } = require("./index");
const { createGolfjoinQuoteHtml } = require("./quote-page");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

test("견적 확정 1인 금액을 별도 숫자 필드로 계산한다", () => {
  const quote = __test.buildQuoteData({
    sheet: "new_schedule_applications",
    keyValue: "nsa_test",
    quote: {
      unitPrice: "1,234,000",
      departureDate: "2026-09-21",
      returnDate: "2026-09-25"
    }
  }, {
    applicationId: "nsa_test",
    applicantName: "테스트",
    applicantPeople: "3"
  });

  assert.equal(quote.unitPrice, 1234000);
  assert.equal(quote.productSubtotal, 3702000);
});

test("견적서 불포함사항은 줄바꿈으로만 나누고 금액의 천 단위 쉼표를 보존한다", () => {
  const excludedItems = [
    "왕복항공권 (유류할증료&TAX 포함)",
    "캐디피(30,000원/18홀)",
    "캐디팁(8$/18홀)",
    "미팅샌딩비(50$/4인시)",
    "중식&석식"
  ];
  const quote = __test.buildQuoteData({
    sheet: "new_schedule_applications",
    keyValue: "nsa_quote_list_test",
    quote: {
      excludedItems: excludedItems.join("\n"),
      departureDate: "2026-09-21",
      returnDate: "2026-09-25"
    }
  }, {
    applicationId: "nsa_quote_list_test",
    applicantName: "테스트",
    applicantPeople: "1"
  });

  assert.deepEqual(quote.excludedItems, excludedItems);
  const html = createGolfjoinQuoteHtml(quote);
  assert.match(html, /<li>캐디피\(30,000원\/18홀\)<\/li>/);
  assert.doesNotMatch(html, /<li>캐디피\(30<\/li>|<li>000원\/18홀\)<\/li>/);
});

test("관리자 상태 갱신은 정적 계약이 아니라 실제 시트 헤더 순서로 행을 쓴다", () => {
  const start = source.indexOf("async function updateAdminStatusViaSheetsApi");
  const end = source.indexOf("async function sendQuoteNotificationViaSheetsApi", start);
  const block = source.slice(start, end);
  assert.match(block, /ensureGoogleSheetHeadersViaApi\(sheetName/);
  assert.doesNotMatch(block, /const headers = GOOGLE_SHEET_HEADERS\[sheetName\]/);
});

test("견적 생성은 확정 1인 금액을 시트와 응답에 함께 저장한다", () => {
  const start = source.indexOf("async function generateQuoteViaSheetsApi");
  const end = source.indexOf("async function saveJoinApplicationViaSheetsApi", start);
  const block = source.slice(start, end);
  assert.match(block, /quoteUnitPrice: quote\.unitPrice/);
  assert.match(block, /quoteUnitPrice: fields\.quoteUnitPrice/);
});

test("신청 시트 두 종류 모두 quoteUnitPrice 계약을 가진다", () => {
  const joinHeader = source.slice(source.indexOf("join_applications: ["), source.indexOf("new_schedule_applications: ["));
  const scheduleHeader = source.slice(source.indexOf("new_schedule_applications: ["), source.indexOf("recommended_schedules: ["));
  assert.match(joinHeader, /"quoteUnitPrice"/);
  assert.match(scheduleHeader, /"quoteUnitPrice"/);
});

test("손상 행 복구는 productPrice를 견적 1인가로 추정하지 않고 암호화 견적 원본을 검증한다", () => {
  const repairSource = fs.readFileSync(path.join(__dirname, "repair-test-schedule-quote-row.js"), "utf8");
  assert.match(repairSource, /readVerifiedQuoteUnitPrice\(recoveredRow, envSource\)/);
  assert.match(repairSource, /encrypted_quote_json/);
  assert.match(repairSource, /quote\.unitPrice/);
  assert.match(repairSource, /"X-Goog-User-Project": quotaProject/);
  assert.match(repairSource, /AbortSignal\.timeout\(30_000\)/);
  assert.match(repairSource, /\[5\/5\] 복구 후보 검증을 완료했습니다/);
  assert.match(repairSource, /findRowNumbers\(/);
  assert.match(repairSource, /readExactRow\(/);
  assert.match(repairSource, /!A1:ZZ1/);
  assert.doesNotMatch(repairSource, /!1:1/);
  assert.doesNotMatch(repairSource, /!A:ZZ/);
  assert.doesNotMatch(repairSource, /quoteUnitPrice\s*=\s*Number\(String\(currentRow\.productPrice/);
});
