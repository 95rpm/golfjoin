"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HOME_PRODUCT_MINIMUM_ADVANCE_DAYS,
  buildGolfJoinHomeArtifacts
} = require("./home-products");

function makeEvent(day, overrides = {}) {
  const date = `2026-08-${String(day).padStart(2, "0")}`;
  return {
    id: `secret-tour-30001104-${day}`,
    goodSeq: "30001104",
    eventSeq: String(day),
    title: "태국 우돈타니 로얄크릭 3박5일",
    region: "우돈타니",
    category: "해외",
    departureDate: date,
    returnDate: `2026-08-${String(day + 4).padStart(2, "0")}`,
    departureAirport: "인천",
    price: 259000 + day,
    status: "예약",
    ...overrides
  };
}

test("홈 카드 v2는 상품당 한 행만 두고 실제 출발일은 모두 별도 보존한다", () => {
  const items = Array.from({ length: 12 }, (_, index) => makeEvent(index + 4));
  const artifacts = buildGolfJoinHomeArtifacts({
    generatedAt: "2026-08-03T13:17:37+09:00",
    sourceGeneratedAt: "2026-08-03T13:17:37+09:00",
    range: { startDate: "2026-08-03", endDate: "2027-04-01" },
    count: items.length,
    items
  }, { availabilityObjectPrefix: "web/product-availability/revision" });

  assert.equal(artifacts.minimumAdvanceDays, HOME_PRODUCT_MINIMUM_ADVANCE_DAYS);
  assert.equal(artifacts.homeCardsPayload.schema, "secret-golf-join-home-cards-v2");
  assert.equal(artifacts.homeCardsPayload.productSummaryCount, 1);
  assert.equal(artifacts.homeCardsPayload.items[0].departureDate, "2026-08-10");
  assert.equal(artifacts.homeCardsPayload.items[0].departureAirport, "인천");
  assert.equal(artifacts.availabilityArtifacts[0].payload.events.length, 12);
  assert.deepEqual(
    artifacts.availabilityArtifacts[0].payload.events.slice(0, 3).map((item) => item.departureDate),
    ["2026-08-04", "2026-08-05", "2026-08-06"]
  );
});

test("마감 행사와 최소 출발 준비기간 이전 행사는 대표 홈 카드에서 제외한다", () => {
  const artifacts = buildGolfJoinHomeArtifacts({
    generatedAt: "2026-08-03T09:00:00+09:00",
    items: [
      makeEvent(9),
      makeEvent(10, { status: "마감" }),
      makeEvent(11, { price: 300000 }),
      makeEvent(12, { price: 250000 })
    ]
  });

  assert.equal(artifacts.homeCardsPayload.items[0].departureDate, "2026-08-11");
  assert.equal(artifacts.homeCardsPayload.items[0].price, 300000);
  assert.equal(artifacts.homeCardsPayload.items[0].priceFrom, 250000);
});

test("홈 발행 리비전과 출발 가능일 리비전을 분리한다", () => {
  const base = {
    generatedAt: "2026-08-03T09:00:00+09:00",
    sourceGeneratedAt: "2026-08-03T09:00:00+09:00",
    items: [makeEvent(11)]
  };
  const first = buildGolfJoinHomeArtifacts(base);
  const scheduleRefresh = buildGolfJoinHomeArtifacts({
    ...base,
    homeBootstrapLightUpdatedAt: "2026-08-04T10:00:00+09:00"
  });

  assert.equal(first.availabilityRevision, scheduleRefresh.availabilityRevision);
  assert.notEqual(first.publicationRevision, scheduleRefresh.publicationRevision);
});
