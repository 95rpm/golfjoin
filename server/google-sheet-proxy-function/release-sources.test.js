"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDataContract } = require("./data-contracts");
const { createReleaseBundle } = require("./release-publisher");
const {
  buildReleasePublishInput,
  assertReleaseHomeAvailabilityReferences
} = require("./release-sources");

function makeSummary() {
  return {
    generatedAt: "2026-08-11T12:00:00+09:00",
    sourceGeneratedAt: "2026-08-11T11:59:00+09:00",
    count: 1,
    items: [{
      id: "erp-30001104-30285494",
      goodSeq: "30001104",
      eventSeq: "30285494",
      title: "태국 우돈타니 로얄크릭 3박5일",
      departureDate: "2026-08-20",
      returnDate: "2026-08-24",
      price: 259000,
      status: "예약"
    }],
    range: { startDate: "2026-08-12", endDate: "2027-08-12" },
    productMetaByGoodSeq: {},
    destinations: { countries: [] }
  };
}

function makeLive(updatedAt = "2026-08-11T12:00:00+09:00") {
  return {
    ok: true,
    serverTime: updatedAt,
    updatedAt,
    newScheduleSummaries: [],
    participantSummaries: [],
    displayRules: [],
    wishTargetKeys: [],
    memberBasic: { hasMember: false },
    warnings: []
  };
}

function makeFamily() {
  return {
    schema: "golfjoin-product-family-catalog-v1",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publicationRevision: "pfc_111111111111111111111111",
    sourceCatalogRevision: "catalog-fixture",
    analysisRevision: "analysis-fixture",
    familyCount: 0,
    memberCount: 0,
    families: [],
    familyIdByGoodSeq: {},
    diagnostics: []
  };
}

function makeInput(live = makeLive(), summary = makeSummary()) {
  return buildReleasePublishInput({
    bucketName: "golfjoin-test-bucket",
    prefix: "web",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publishedAt: "2026-08-11T12:00:01+09:00",
    summaryPayload: summary,
    homeBootstrapLight: live,
    familyCatalog: makeFamily()
  });
}

test("현재 홈·live·상품군 데이터로 검증 가능한 V2 발행 입력을 만든다", () => {
  const input = makeInput();
  const bundle = createReleaseBundle(input);
  assert.equal(validateDataContract("homeCardsV2", input.objects.homeCards.payload).valid, true);
  assert.equal(validateDataContract("homeBootstrapLightV1", input.objects.liveHome.payload).valid, true);
  assert.equal(validateDataContract("productFamilyCatalogV1", input.objects.productFamily.payload).valid, true);
  assert.equal(validateDataContract("productAvailabilityIndexV1", input.objects.availability.payload).valid, true);
  assert.equal(validateDataContract("productDetailIndexV1", input.objects.productDetail.payload).valid, true);
  assert.equal(bundle.manifest.browserReadEnabled, false);
  assert.equal(bundle.manifest.sourceSnapshotWatermark, input.sourceSnapshotWatermark);
});

test("같은 원본 snapshot은 같은 하위 리비전과 watermark를 만든다", () => {
  const first = makeInput();
  const second = makeInput();
  assert.deepEqual(
    Object.fromEntries(Object.entries(first.objects).map(([role, object]) => [role, object.revision])),
    Object.fromEntries(Object.entries(second.objects).map(([role, object]) => [role, object.revision]))
  );
  assert.equal(first.sourceSnapshotWatermark, second.sourceSnapshotWatermark);
});

test("live 데이터만 바뀌면 live 리비전과 watermark만 바뀌고 정적·가용일은 유지된다", () => {
  const first = makeInput(makeLive("2026-08-11T12:00:00+09:00"));
  const second = makeInput(makeLive("2026-08-11T12:01:00+09:00"));
  assert.equal(first.objects.homeCards.revision, second.objects.homeCards.revision);
  assert.equal(first.objects.availability.revision, second.objects.availability.revision);
  assert.equal(first.objects.productFamily.revision, second.objects.productFamily.revision);
  assert.equal(first.objects.productDetail.revision, second.objects.productDetail.revision);
  assert.notEqual(first.objects.liveHome.revision, second.objects.liveHome.revision);
  assert.notEqual(first.sourceSnapshotWatermark, second.sourceSnapshotWatermark);
});

test("현재 상세는 legacy on-demand 상태를 명시하고 빈 데이터인 척하지 않는다", () => {
  const input = makeInput();
  const detail = input.objects.productDetail.payload;
  assert.equal(detail.status, "legacy-on-demand");
  assert.equal(detail.count, 0);
  assert.deepEqual(detail.items, []);
  assert.equal(input.objects.productDetail.revision, detail.detailRevision);
});

test("공개 상세 스냅샷이 있으면 Release V2 상세 인덱스가 ready로 전환된다", () => {
  const summary = makeSummary();
  summary.productMetaByGoodSeq = {
    "30001104": {
      detailRevision: "gpd_222222222222222222222222",
      detailStatus: "ready",
      detailEventSeq: "30285494",
      detailObjectName: "web/product-detail/gpd_222222222222222222222222/30001104.json",
      detailUrl: "https://storage.googleapis.com/golfjoin-test-bucket/web/product-detail/gpd_222222222222222222222222/30001104.json"
    }
  };
  const input = makeInput(makeLive(), summary);
  const detail = input.objects.productDetail.payload;
  assert.equal(detail.status, "ready");
  assert.equal(detail.count, 1);
  assert.equal(detail.items[0].goodSeq, "30001104");
  assert.equal(validateDataContract("productDetailIndexV1", detail).valid, true);
});

test("Release V2는 판매 가능한 대표 카드의 빈 상태를 available로 정규화한다", () => {
  const summary = makeSummary();
  summary.items[0].status = "";

  const input = makeInput(makeLive(), summary);
  const homeCards = input.objects.homeCards.payload;

  assert.equal(homeCards.productSummaryCount, 1);
  assert.equal(homeCards.items[0].status, "available");
  assert.equal(validateDataContract("homeCardsV2", homeCards).valid, true);
});

test("home-static은 별도 요청 없이 첫 화면 상품군을 구성할 카탈로그를 포함한다", () => {
  const input = makeInput();
  const homeCards = input.objects.homeCards.payload;

  assert.equal(homeCards.productFamilyCatalog.schema, "golfjoin-product-family-catalog-v1");
  assert.equal(
    homeCards.productFamilyCatalog.publicationRevision,
    input.objects.productFamily.revision
  );
  assert.equal(validateDataContract("homeCardsV2", homeCards).valid, true);
});

test("home-static은 live 일정을 중복하지 않고 상품별 가용일 shard 주소만 제공한다", () => {
  const summary = makeSummary();
  summary.homeBootstrapLight = makeLive();
  summary.homeBootstrapLightUpdatedAt = summary.homeBootstrapLight.updatedAt;

  const input = makeInput(makeLive(), summary);
  const homeCards = input.objects.homeCards.payload;
  const liveHome = input.objects.liveHome.payload;

  assert.equal(Object.hasOwn(homeCards, "homeBootstrapLight"), false);
  assert.equal(Object.hasOwn(homeCards, "newScheduleSummaries"), false);
  assert.equal(Object.hasOwn(homeCards, "participantSummaries"), false);
  assert.equal(Array.isArray(homeCards.items[0].events), false);
  assert.equal(
    homeCards.items[0].availabilityObjectName,
    `web/product-availability/${homeCards.availabilityRevision}/30001104.json`
  );
  assert.deepEqual(liveHome.newScheduleSummaries, []);
  assert.deepEqual(liveHome.participantSummaries, []);
});

test("상품별 가용일 shard 주소가 달라지면 home-static 리비전도 달라진다", () => {
  const first = makeInput();
  const second = buildReleasePublishInput({
    bucketName: "golfjoin-test-bucket",
    prefix: "web-next",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publishedAt: "2026-08-11T12:00:01+09:00",
    summaryPayload: makeSummary(),
    homeBootstrapLight: makeLive(),
    familyCatalog: makeFamily()
  });

  assert.notEqual(first.objects.homeCards.revision, second.objects.homeCards.revision);
  assert.notEqual(
    first.objects.homeCards.payload.items[0].availabilityObjectName,
    second.objects.homeCards.payload.items[0].availabilityObjectName
  );
});

test("새 Release는 대표 카드의 가용일 shard 주소가 없거나 다른 리비전이면 발행 전에 실패한다", () => {
  const missing = structuredClone(makeInput().objects.homeCards.payload);
  delete missing.items[0].availabilityObjectName;
  assert.throws(
    () => assertReleaseHomeAvailabilityReferences(missing),
    (error) => error.code === "release_home_availability_shard_invalid"
  );

  const mismatched = structuredClone(makeInput().objects.homeCards.payload);
  mismatched.items[0].availabilityObjectName = `web/product-availability/gpa_ffffffffffffffffffffffff/${mismatched.items[0].goodSeq}.json`;
  assert.throws(
    () => assertReleaseHomeAvailabilityReferences(mismatched),
    (error) => error.code === "release_home_availability_shard_invalid"
  );
});

test("상품군 리비전이 바뀌면 embedded home-static 리비전도 함께 바뀐다", () => {
  const first = makeInput();
  const changedFamily = makeFamily();
  changedFamily.publicationRevision = "pfc_222222222222222222222222";
  const second = buildReleasePublishInput({
    bucketName: "golfjoin-test-bucket",
    prefix: "web",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publishedAt: "2026-08-11T12:00:01+09:00",
    summaryPayload: makeSummary(),
    homeBootstrapLight: makeLive(),
    familyCatalog: changedFamily
  });

  assert.notEqual(first.objects.homeCards.revision, second.objects.homeCards.revision);
  assert.notEqual(first.sourceSnapshotWatermark, second.sourceSnapshotWatermark);
});
