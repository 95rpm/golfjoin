"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const source = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);

function sourceBetween(startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `missing source range: ${startToken}`);
  return source.slice(start, end);
}

test("관리자 추천일정은 과거 동일 상품보다 등록된 ERP 행사번호를 우선한다", () => {
  const normalizer = sourceBetween(
    "function normalizeAdminRecommendedScheduleRule",
    "function applyAdminRecommendedScheduleRows"
  );

  assert.match(normalizer, /eventSeq: rule\.erpEventSeq \|\| product\?\.eventSeq/);
  assert.match(normalizer, /selectedFamilyOption\?\.eventSeq \|\| productReference\.eventSeq \|\| product\?\.eventSeq \|\| ""/);
  assert.match(normalizer, /erpEventSeq: normalizeJoinCanonicalErpEventSeq\(selectedFamilyOption\?\.eventSeq \|\| productReference\.eventSeq \|\| product\?\.erpEventSeq\)/);
  assert.doesNotMatch(normalizer, /eventSeq: product\?\.eventSeq \|\| productReference\.eventSeq/);
});

test("추천일정의 정확한 상품·행사번호가 상세 조회 URL까지 전달된다", () => {
  const normalizer = sourceBetween(
    "function normalizeAdminRecommendedScheduleRule",
    "function applyAdminRecommendedScheduleRows"
  );
  const detailLoader = sourceBetween(
    "function buildSecretTourGoodsViewUrl",
    "function cleanSecretTourDetailText"
  );

  assert.match(normalizer, /goodSeq: selectedFamilyOption\?\.goodSeq \|\| rule\.erpProductId \|\| product\?\.goodSeq/);
  assert.match(detailLoader, /goodSeq: String\(product\?\.goodSeq \|\| ""\)/);
  assert.match(detailLoader, /eventSeq: String\(product\?\.eventSeq \|\| ""\)/);
});
