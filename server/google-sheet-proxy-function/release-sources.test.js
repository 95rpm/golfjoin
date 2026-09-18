"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDataContract } = require("./data-contracts");
const { createReleaseBundle } = require("./release-publisher");
const { buildReleasePublishInput } = require("./release-sources");

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

function makeInput(live = makeLive()) {
  return buildReleasePublishInput({
    bucketName: "golfjoin-test-bucket",
    prefix: "web",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publishedAt: "2026-08-11T12:00:01+09:00",
    summaryPayload: makeSummary(),
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
