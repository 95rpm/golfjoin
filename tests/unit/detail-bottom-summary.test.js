"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const markup = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/markup/20-main.html"), "utf8");
const styles = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css"), "utf8");
const detailSource = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/39-detail-actions-participants.js"),
  "utf8"
);

function loadDetailBottomSummaryFunctions(overrides = {}) {
  const start = detailSource.indexOf("function parseDetailBottomPriceValue");
  const end = detailSource.indexOf("function renderDetailContent", start);
  assert.ok(start >= 0 && end > start, "detail bottom summary helpers");
  const nodes = {
    detailBottomPeriod: { textContent: "" },
    detailBottomPriceValue: { textContent: "" },
    detailBottomPriceUnit: { textContent: "원", hidden: true }
  };
  const context = {
    document: { getElementById: (id) => nodes[id] || null },
    getNestedValue: (value, key) => key.split(".").reduce((current, part) => current?.[part], value),
    parseBuilderApplicationPrice: (value) => {
      const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    },
    getJoinFinalQuoteUnitPrice: () => 0,
    formatCardDateRange: (join) => join.testPeriod || "",
    formatPrice: (value) => Number(value).toLocaleString("ko-KR"),
    ...overrides
  };
  vm.createContext(context);
  vm.runInContext(
    `${detailSource.slice(start, end)}\nthis.detailBottomApi = { getDetailBottomPriceValue, renderDetailBottomSummary };`,
    context
  );
  return { api: context.detailBottomApi, nodes };
}

test("상품상세 공통 하단은 캘린더 방식의 기간과 오른쪽 요금 영역을 버튼 위에 둔다", () => {
  const summaryIndex = markup.indexOf('class="detail-bottom-summary"');
  const phoneButtonIndex = markup.indexOf('id="detailPhoneButton"');
  assert.ok(summaryIndex >= 0 && summaryIndex < phoneButtonIndex);
  assert.match(markup, /id="detailBottomPeriod">여행기간 확인 중<\/div>/);
  assert.match(markup, /id="detailBottomPriceValue">요금 문의<\/span>/);
  assert.match(markup, /id="detailBottomPriceUnit" hidden>원<\/span>/);
  assert.match(markup, /detail-bottom-period card-meta-item/);
  assert.match(markup, /lucide-calendar-icon lucide-calendar/);
  assert.match(styles, /\.detail-bottom-summary\s*\{[\s\S]*?justify-content:\s*space-between/);
  assert.match(styles, /\.detail-bottom-price\s*\{[\s\S]*?margin-left:\s*auto/);
});

test("상품상세 하단 요금은 확정 견적 1인 금액을 상품가보다 우선한다", () => {
  const { api } = loadDetailBottomSummaryFunctions({
    getJoinFinalQuoteUnitPrice: () => 3351111
  });
  assert.equal(api.getDetailBottomPriceValue({ price: 656000 }), 3351111);
});

test("상품상세 하단은 여행기간과 천 단위 요금을 함께 갱신한다", () => {
  const { api, nodes } = loadDetailBottomSummaryFunctions();
  api.renderDetailBottomSummary({ testPeriod: "8.31(월)~9.4(금)", price: "656,000원" });
  assert.equal(nodes.detailBottomPeriod.textContent, "8.31(월)~9.4(금)");
  assert.equal(nodes.detailBottomPriceValue.textContent, "656,000");
  assert.equal(nodes.detailBottomPriceUnit.hidden, false);
});

test("상품상세 하단은 아직 값이 없을 때 빈 영역 대신 안내 문구를 유지한다", () => {
  const { api, nodes } = loadDetailBottomSummaryFunctions();
  api.renderDetailBottomSummary({});
  assert.equal(nodes.detailBottomPeriod.textContent, "여행기간 확인 중");
  assert.equal(nodes.detailBottomPriceValue.textContent, "요금 문의");
  assert.equal(nodes.detailBottomPriceUnit.hidden, true);
});

test("상품상세 하단 타이포그래피는 PC·모바일 날짜와 요금 단위를 구분한다", () => {
  assert.match(styles, /\.detail-bottom-period-text\.card-meta-text-date\s*\{[\s\S]*?font-size:\s*18px/);
  assert.match(styles, /\.detail-bottom-price\s*\{[\s\S]*?color:\s*#373a3c;[\s\S]*?font-size:\s*22px;[\s\S]*?font-weight:\s*700/);
  assert.match(styles, /\.detail-bottom-price-unit\s*\{[\s\S]*?color:\s*#5d6b82;[\s\S]*?font-size:\s*20px/);
  assert.match(styles, /body > #detailModal\.sgj-portal-overlay \.detail-bottom-period-text\.card-meta-text-date\s*\{\s*font-size:\s*17px/);
  assert.match(styles, /body > #detailModal\.sgj-portal-overlay \.detail-bottom-price\s*\{\s*font-size:\s*20px/);
  assert.match(styles, /body > #detailModal\.sgj-portal-overlay \.detail-bottom-price-unit\s*\{\s*font-size:\s*18px/);
});
