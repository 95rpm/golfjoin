"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dashboard = fs.readFileSync(path.resolve(__dirname, "../../golfjoin_admin_dashboard.html"), "utf8");

function extractFunction(source, functionName) {
  const declaration = `function ${functionName}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const bodyStart = source.indexOf(") {", start) + 2;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

test("상담대기 운영 전환 시각은 2026-09-07 21:11 KST이다", () => {
  assert.match(
    dashboard,
    /const CONSULTATION_QUEUE_VISIBLE_FROM = "2026-09-07T21:11:00\+09:00";/
  );
});

test("운영 전환 신청자는 포함하고 이전 누적 고객과 잘못된 시각은 제외한다", () => {
  const sandbox = { Date };
  vm.runInNewContext(`
    const CONSULTATION_QUEUE_VISIBLE_FROM = "2026-09-07T21:11:00+09:00";
    function parseDateTime() { return null; }
    ${extractFunction(dashboard, "getTimeValue")}
    ${extractFunction(dashboard, "isConsultationApplicantVisible")}
    globalThis.visible = isConsultationApplicantVisible;
  `, sandbox);

  assert.equal(sandbox.visible("2026-09-07T21:10:59+09:00"), false);
  assert.equal(sandbox.visible("2026-09-07T21:11:00+09:00"), true);
  assert.equal(sandbox.visible("2026-09-08T08:00:00+09:00"), true);
  assert.equal(sandbox.visible(""), false);
  assert.equal(sandbox.visible("not-a-date"), false);
});

test("상담대기 숫자와 표는 동일한 전환 필터를 사용한다", () => {
  const source = extractFunction(dashboard, "getConsultationApplicants");
  assert.match(source, /if \(!isConsultationApplicantVisible\(item\.createdAt\)\) return false;/);
  assert.match(dashboard, /const consultationApplicants = getConsultationApplicants\(\{ useKeyword: false \}\);/);
  assert.match(dashboard, /const consultationCount = consultationApplicants\.length;/);
  assert.match(dashboard, /function renderConsultationApplicantsTable\(\) \{\s*const rows = getConsultationApplicants\(\);/);
});

test("견적서가 생성되지 않은 상담이 있을 때만 숫자 옆에 NEW를 표시한다", () => {
  assert.match(
    dashboard,
    /const hasUnquotedConsultation = consultationApplicants\.some\(\(item\) => !hasGeneratedConsultationQuote\(item\.row\)\);/
  );
  assert.match(
    dashboard,
    /\$\{hasUnquotedConsultation \? '<span class="schedule-work-new-badge">NEW<\/span>' : ""\}/
  );
  assert.match(
    dashboard,
    /function hasGeneratedConsultationQuote\(row = \{\}\) \{\s*return Boolean\(normalizeQuoteAccessUrl\(row\.quotePageUrl \|\| row\.quoteUrl\)\);\s*\}/
  );
  assert.match(dashboard, /\.schedule-work-new-badge\s*\{[\s\S]*?background:\s*var\(--red\)[\s\S]*?font-size:\s*11px/);
});

test("표시 규칙은 특정 고객 개인정보나 월례회 제목에 의존하지 않는다", () => {
  assert.doesNotMatch(dashboard, /최유선|010[- ]?9654[- ]?0966/);
  const source = extractFunction(dashboard, "getConsultationApplicants");
  assert.doesNotMatch(source, /8월 월례회|10월 월례회/);
});

test("관리자 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});
