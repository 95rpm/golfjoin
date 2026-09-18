"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildProductDiscoveryArtifacts } = require("./product-discovery");
const { validateDataContract } = require("./data-contracts");

function event(goodSeq, eventSeq, departureDate, region, overrides = {}) {
  return {
    id: `erp-${goodSeq}-${eventSeq}`,
    source: "erp",
    goodSeq,
    eventSeq,
    title: `테스트 상품 ${goodSeq}`,
    region,
    category: "해외",
    departureDate,
    returnDate: departureDate,
    price: 100000 + Number(eventSeq),
    airport: "인천",
    status: "예약",
    emptySlots: 4,
    ...overrides
  };
}

function source(items) {
  return {
    generatedAt: "2026-08-13T09:00:00+09:00",
    sourceGeneratedAt: "2026-08-13T08:59:00+09:00",
    items
  };
}

function assertContracts(publication) {
  assert.equal(validateDataContract("productDiscoveryManifestV1", publication.manifestPayload).valid, true);
  assert.equal(validateDataContract("productDiscoveryIndexV1", publication.indexArtifact.payload).valid, true);
  assert.equal(validateDataContract("productDiscoveryLookupV1", publication.lookupArtifact.payload).valid, true);
  publication.monthArtifacts.forEach((artifact) => {
    assert.equal(validateDataContract("productDiscoveryMonthV1", artifact.payload).valid, true);
  });
}

test("전체 상품을 월별 조각과 직접 조회표에 정확히 한 번씩 배치한다", () => {
  const publication = buildProductDiscoveryArtifacts(source([
    event("30000002", "302", "2026-09-02", "치앙마이"),
    event("30000001", "301", "2026-08-20", "방콕"),
    event("30000001", "300", "2026-08-03", "치앙마이"),
    event("30000003", "303", "2026-10-01", "다낭")
  ]));

  assert.match(publication.discoveryRevision, /^gpd_[a-f0-9]{24}$/);
  assert.equal(publication.eventCount, 4);
  assert.equal(publication.monthCount, 3);
  assert.equal(publication.regionCount, 3);
  assert.deepEqual(publication.monthArtifacts.map((item) => item.month), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(publication.monthArtifacts.map((item) => item.payload.count), [2, 1, 1]);

  const partitionKeys = publication.monthArtifacts.flatMap((artifact) => (
    artifact.payload.items.map((item) => `${item.goodSeq}:${item.eventSeq}`)
  ));
  const lookupKeys = publication.lookupArtifact.payload.items.map((item) => item.key);
  assert.deepEqual(partitionKeys.slice().sort(), lookupKeys.slice().sort());
  assert.equal(new Set(partitionKeys).size, 4);
  assert.equal(publication.indexArtifact.payload.eventCount, 4);
  assert.equal(publication.manifestPayload.eventCount, 4);
  assertContracts(publication);
});

test("입력 순서와 객체 키 순서가 달라도 같은 리비전과 객체 해시를 만든다", () => {
  const left = event("30000001", "301", "2026-08-20", "방콕");
  const right = event("30000002", "302", "2026-09-02", "치앙마이");
  const reorderedLeft = Object.fromEntries(Object.entries(left).reverse());
  const first = buildProductDiscoveryArtifacts(source([left, right]));
  const second = buildProductDiscoveryArtifacts(source([right, reorderedLeft]));

  assert.equal(first.discoveryRevision, second.discoveryRevision);
  assert.equal(first.indexArtifact.sha256, second.indexArtifact.sha256);
  assert.equal(first.lookupArtifact.sha256, second.lookupArtifact.sha256);
  assert.deepEqual(
    first.monthArtifacts.map((item) => item.sha256),
    second.monthArtifacts.map((item) => item.sha256)
  );
});

test("중복 상품 일정과 잘못된 날짜는 발행 후보 생성 전에 중단한다", () => {
  const duplicate = event("30000001", "301", "2026-08-20", "방콕");
  assert.throws(
    () => buildProductDiscoveryArtifacts(source([duplicate, { ...duplicate }])),
    /Duplicate product discovery event/
  );
  assert.throws(
    () => buildProductDiscoveryArtifacts(source([event("30000001", "301", "2026\/08\/20", "방콕")])),
    /Invalid discovery departureDate/
  );
});

test("계약 검증은 개수·월 경계·객체 참조 변조를 거부한다", () => {
  const publication = buildProductDiscoveryArtifacts(source([
    event("30000001", "301", "2026-08-20", "방콕"),
    event("30000002", "302", "2026-09-02", "치앙마이")
  ]));
  const badManifest = structuredClone(publication.manifestPayload);
  badManifest.index.objectName = "web/wrong/index.json";
  assert.equal(validateDataContract("productDiscoveryManifestV1", badManifest).valid, false);

  const badIndex = structuredClone(publication.indexArtifact.payload);
  badIndex.eventCount = 99;
  badIndex.regions[0].months.push("2099-01");
  assert.equal(validateDataContract("productDiscoveryIndexV1", badIndex).valid, false);

  const badLookup = structuredClone(publication.lookupArtifact.payload);
  badLookup.items[0].key = "wrong";
  assert.equal(validateDataContract("productDiscoveryLookupV1", badLookup).valid, false);

  const badMonth = structuredClone(publication.monthArtifacts[0].payload);
  badMonth.items[0].departureDate = "2026-09-20";
  assert.equal(validateDataContract("productDiscoveryMonthV1", badMonth).valid, false);
});
