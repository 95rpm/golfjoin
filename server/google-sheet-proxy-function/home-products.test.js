"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HOME_PRODUCT_MINIMUM_ADVANCE_DAYS,
  buildGolfJoinHomeArtifacts,
  buildGolfJoinFamilyAvailabilityArtifacts
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

test("상품군 가용일은 구성 상품 행사를 손실 없이 한 객체로 합친다", () => {
  const availabilityRevision = "gpa_111111111111111111111111";
  const familyRevision = "pfc_222222222222222222222222";
  const source = buildGolfJoinHomeArtifacts({
    generatedAt: "2026-08-12T10:00:00+09:00",
    items: [
      makeEvent(20, { goodSeq: "30001104", eventSeq: "10420" }),
      makeEvent(21, { goodSeq: "30001104", eventSeq: "10421" }),
      makeEvent(22, { goodSeq: "30001242", eventSeq: "12422" })
    ]
  }, {
    availabilityRevision,
    availabilityObjectPrefix: `web/product-availability/${availabilityRevision}`
  });
  const publication = buildGolfJoinFamilyAvailabilityArtifacts({
    publicationRevision: familyRevision,
    families: [{
      familyId: "pf_test",
      members: [{ goodSeq: "30001104" }, { goodSeq: "30001242" }]
    }]
  }, source.availabilityArtifacts, {
    availabilityRevision,
    availabilityObjectPrefix: `web/product-availability/${availabilityRevision}`
  });

  assert.equal(publication.diagnostics.length, 0);
  assert.equal(publication.artifacts.length, 1);
  assert.equal(publication.artifacts[0].objectName, `web/product-availability/${availabilityRevision}/families/${familyRevision}/pf_test.json`);
  assert.equal(publication.artifacts[0].payload.productCount, 2);
  assert.equal(publication.artifacts[0].payload.count, 3);
  assert.deepEqual(publication.artifacts[0].payload.products.map((product) => [product.goodSeq, product.count]), [
    ["30001104", 2],
    ["30001242", 1]
  ]);
  publication.artifacts[0].payload.products.forEach((product) => {
    const original = source.availabilityArtifacts.find((artifact) => artifact.goodSeq === product.goodSeq).payload.events;
    assert.deepEqual(product.events, original);
  });
});

test("상품군 원본 누락과 비정상 대형 객체는 발행하지 않고 기존 상품별 fallback을 보존한다", () => {
  const availabilityRevision = "gpa_333333333333333333333333";
  const source = buildGolfJoinHomeArtifacts({
    generatedAt: "2026-08-12T10:00:00+09:00",
    items: [makeEvent(20, { goodSeq: "30001104", eventSeq: "10420" })]
  }, { availabilityRevision });
  const catalog = {
    publicationRevision: "pfc_444444444444444444444444",
    families: [{
      familyId: "pf_test",
      members: [{ goodSeq: "30001104" }, { goodSeq: "30001242" }]
    }]
  };
  const missing = buildGolfJoinFamilyAvailabilityArtifacts(catalog, source.availabilityArtifacts, { availabilityRevision });
  assert.equal(missing.artifacts.length, 0);
  assert.equal(missing.diagnostics[0].reason, "family_availability_source_invalid");
  assert.deepEqual(missing.diagnostics[0].missingGoodSeqs, ["30001242"]);

  const duplicated = [
    ...source.availabilityArtifacts,
    {
      payload: {
        ...source.availabilityArtifacts[0].payload,
        goodSeq: "30001242",
        count: 1,
        events: [makeEvent(21, { goodSeq: "30001242", eventSeq: "12421" })]
      }
    }
  ];
  const limited = buildGolfJoinFamilyAvailabilityArtifacts(catalog, duplicated, {
    availabilityRevision,
    maximumEventCount: 1
  });
  assert.equal(limited.artifacts.length, 0);
  assert.equal(limited.diagnostics[0].reason, "family_availability_safety_limit_exceeded");
});

test("공개 상세 스냅샷 참조가 바뀌면 홈 정적 리비전도 바뀐다", () => {
  const base = {
    generatedAt: "2026-08-12T10:00:00+09:00",
    sourceGeneratedAt: "2026-08-12T10:00:00+09:00",
    items: [makeEvent(20)],
    productMetaByGoodSeq: {
      "30001104": {
        detailRevision: "gpd_111111111111111111111111",
        detailObjectName: "web/product-detail/gpd_111111111111111111111111/30001104.json",
        detailStatus: "ready"
      }
    }
  };
  const first = buildGolfJoinHomeArtifacts(base);
  const second = buildGolfJoinHomeArtifacts({
    ...base,
    productMetaByGoodSeq: {
      "30001104": {
        detailRevision: "gpd_222222222222222222222222",
        detailObjectName: "web/product-detail/gpd_222222222222222222222222/30001104.json",
        detailStatus: "ready"
      }
    }
  });
  assert.notEqual(first.publicationRevision, second.publicationRevision);
  assert.equal(first.availabilityRevision, second.availabilityRevision);
});
