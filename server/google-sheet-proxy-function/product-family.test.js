"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REPRESENTATIVE_MODE,
  normalizeGoodSeq,
  parseDeparturePatternFromTitle,
  analyzeGolfHoleLine,
  buildGolfSummaryFromSchedule,
  normalizeGolfSummary,
  inferPackType,
  buildProductCatalog,
  buildProductMaterialSignature,
  getSafeCandidateKeyRepair,
  buildAnalysisRevision,
  buildCandidateAnalysis,
  hydrateFamilyState,
  reconcileFamilyWithCatalog,
  validateFamilyAssignment,
  resolveRepresentative,
  buildPublishedFamilyCatalog,
  buildProductFamilyManifest
} = require("./product-family");

test("상품업데이트가 사용하는 골프 요약 정규화 함수를 외부에 제공한다", () => {
  assert.equal(typeof normalizeGolfSummary, "function");
  assert.deepEqual(normalizeGolfSummary({
    golfDays: 2,
    minTotalHoles: 36,
    maxTotalHoles: 45,
    label: "골프 2일 · 총 36~45홀",
    status: "resolved",
    dayBreakdown: []
  }), {
    golfDays: 2,
    minTotalHoles: 36,
    maxTotalHoles: 45,
    label: "골프 2일 · 총 36~45홀",
    status: "resolved",
    dayBreakdown: []
  });
});

test("상품명 기간 뒤 출발 문구로 지정요일과 매일출발을 구분한다", () => {
  assert.deepEqual(parseDeparturePatternFromTitle("태국 방콕 3박5일 일/월/화/수출발 골프"), {
    mode: "weekday",
    weekdays: ["일", "월", "화", "수"],
    label: "일/월/화/수출발",
    status: "resolved"
  });
  assert.equal(parseDeparturePatternFromTitle("태국 방콕 4박6일 골프").label, "매일출발");
  assert.equal(parseDeparturePatternFromTitle("태국 방콕 4박6일 인천출발").status, "review_required");
});

test("조건부 홀수와 보너스 홀수를 최소 최대 범위로 계산한다", () => {
  assert.deepEqual(analyzeGolfHoleLine("주중 오전36홀/주말 오후18홀"), {
    minHoles: 18,
    maxHoles: 36,
    condition: "alternative"
  });
  assert.deepEqual(analyzeGolfHoleLine("18홀 또는 27홀"), {
    minHoles: 18,
    maxHoles: 27,
    condition: "alternative"
  });
  assert.deepEqual(analyzeGolfHoleLine("18홀 + 보너스 9홀"), {
    minHoles: 18,
    maxHoles: 27,
    condition: "optional_bonus"
  });
  assert.deepEqual(analyzeGolfHoleLine("18홀 + 18홀 보너스"), {
    minHoles: 18,
    maxHoles: 36,
    condition: "optional_bonus"
  });
  assert.deepEqual(analyzeGolfHoleLine("바탐 아일랜드 골프장 오전36홀 라운딩\n[관광옵션]\n18홀 라운드 후 관광"), {
    minHoles: 36,
    maxHoles: 36,
    condition: "fixed"
  });
});

test("관광옵션의 단축 라운드는 기본 라운드에 추가 합산하지 않는다", () => {
  const fourDay = buildGolfSummaryFromSchedule([
    { points: ["오전36홀 라운딩"] },
    { points: ["오전36홀 라운딩"] },
    { points: ["오전36홀 라운딩\n[관광옵션]\n18홀 라운드 후 관광"] },
    { points: ["오전36홀 라운딩"] }
  ]);
  const sevenDay = buildGolfSummaryFromSchedule([
    ...Array.from({ length: 2 }, () => ({ points: ["오전36홀 라운딩"] })),
    { points: ["오전36홀 라운딩\n[관광옵션]\n18홀 라운드 후 관광"] },
    ...Array.from({ length: 4 }, () => ({ points: ["오전36홀 라운딩"] }))
  ]);
  assert.deepEqual([fourDay.golfDays, fourDay.minTotalHoles, fourDay.maxTotalHoles, fourDay.label], [4, 144, 144, "골프 4일 · 총 144홀"]);
  assert.deepEqual([sevenDay.golfDays, sevenDay.minTotalHoles, sevenDay.maxTotalHoles, sevenDay.label], [7, 252, 252, "골프 7일 · 총 252홀"]);
});

test("골프 횟수는 라운딩 수가 아닌 골프 일정이 있는 일차 수로 계산한다", () => {
  const summary = buildGolfSummaryFromSchedule([
    { day: "1일차", points: ["공항 출발", "골프장으로 이동"] },
    { day: "2일차", points: ["오전 18홀 + 오후 18홀 라운딩"] },
    { day: "3일차", points: ["주중 오전36홀/주말 오후18홀"] },
    { day: "4일차", points: ["18홀 + 보너스 9홀"] }
  ]);
  assert.equal(summary.golfDays, 3);
  assert.equal(summary.minTotalHoles, 72);
  assert.equal(summary.maxTotalHoles, 99);
  assert.equal(summary.label, "골프 3일 · 총 72~99홀");
});

function makeItems() {
  return [
    {
      goodSeq: "30001001",
      eventSeq: "100",
      title: "태국 방콕 썬라이즈 3박5일 그린피 포함",
      country: "태국",
      region: "방콕",
      duration: "3박 5일",
      departureDate: "2026-10-01",
      returnDate: "2026-10-05",
      price: 900000
    },
    {
      goodSeq: "30001001",
      eventSeq: "101",
      title: "태국 방콕 썬라이즈 3박5일 그린피 포함",
      country: "태국",
      region: "방콕",
      duration: "3박 5일",
      departureDate: "2026-09-01",
      returnDate: "2026-09-05",
      price: 850000
    },
    {
      goodSeq: "30001002",
      eventSeq: "200",
      title: "태국 방콕 썬라이즈 4박6일 조식 포함",
      country: "태국",
      region: "방콕",
      duration: "4박 6일",
      departureDate: "2026-10-02",
      returnDate: "2026-10-07",
      price: 970000
    }
  ];
}

function makeJanuaryBatamItems() {
  return [
    {
      goodSeq: "30001287",
      eventSeq: "30286551",
      title: "[1월 월례회] 인도네시아 바탐 3색 4박6일 아스톤",
      sourceProductTitle: "[1월 월례회] 인도네시아 바탐 3색 4박6일 아스톤",
      country: "인도네시아",
      region: "바탐",
      duration: "4박 6일",
      departureDate: "2027-01-16",
      returnDate: "2027-01-21",
      price: 1290000,
      airline: "제주항공",
      air2Cd: "7C",
      goodTransportSeq: "3586"
    },
    {
      goodSeq: "30001288",
      eventSeq: "30286552",
      title: "[1월 월례회] 인도네시아 바탐 3색 7박9일 아스톤",
      sourceProductTitle: "[1월 월례회] 인도네시아 바탐 3색 7박9일 아스톤",
      country: "인도네시아",
      region: "바탐",
      duration: "7박 9일",
      departureDate: "2027-01-16",
      returnDate: "2027-01-24",
      price: 1540000,
      airline: "제주항공",
      air2Cd: "7C",
      goodTransportSeq: "3585"
    }
  ];
}

function makeApprovedFamily(catalog, overrides = {}) {
  return {
    familyId: "pf_test",
    status: "approved",
    representativeMode: "lowest_price",
    preferredGoodSeq: "",
    resolvedRepresentativeGoodSeq: "30001001",
    candidateKeySnapshot: catalog[0].candidateKey,
    configRevision: 1,
    members: catalog.map((product) => ({
      familyId: "pf_test",
      goodSeq: product.goodSeq,
      memberStatus: "active",
      durationNights: product.durationNights,
      durationDays: product.durationDays,
      sourceTitleSnapshot: product.title,
      materialSignature: buildProductMaterialSignature(product),
      sourceActive: true,
      configRevision: 1
    })),
    ...overrides
  };
}

test("ERP 상품번호는 숫자형 goodSeq만 허용한다", () => {
  assert.equal(normalizeGoodSeq("30001001"), "30001001");
  assert.equal(normalizeGoodSeq("secret-tour-30001001-100"), "");
});

test("카탈로그는 goodSeq별 출발 가능한 최저가 행사를 대표 스냅샷으로 만든다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  assert.equal(catalog.length, 2);
  assert.equal(catalog[0].lowestPrice, 850000);
  assert.equal(catalog[0].representativeEventSeq, "101");
  assert.equal(catalog[0].durationLabel, "3박 5일");
  assert.equal(catalog[0].candidateKey, catalog[1].candidateKey);
  assert.match(buildAnalysisRevision(catalog, "2026-07-29T00:00:00+09:00"), /^pfa_[a-f0-9]{24}$/);
});

test("상품군 서버는 추천 일정과 동일하게 명시값·항공사·항공코드·운송편을 판정한다", () => {
  assert.equal(inferPackType({ packType: "air", title: "일반 제목" }), "air");
  assert.equal(inferPackType({ packType: "golf", airline: "제주항공" }), "golf");
  assert.equal(inferPackType({ airline: "개별항공", air2Cd: "XX" }), "golf");
  assert.equal(inferPackType({ airline: "제주항공" }), "air");
  assert.equal(inferPackType({ air2Cd: "7C" }), "air");
  assert.equal(inferPackType({ goodTransportSeq: "3586" }), "air");
  assert.equal(inferPackType({ flightScheduleItems: [{ airline: "7C" }] }), "air");
  assert.equal(inferPackType({ airProductYn: "N", airline: "제주항공" }), "air");
  assert.equal(inferPackType({ title: "항공권 불포함 골프텔", airline: "제주항공" }), "golf");
  assert.equal(inferPackType({ title: "태국 방콕 3박5일 골프" }), "golf");
});

test("1월 월례회 두 ERP 상품을 항공팩 한 후보로 재분석한다", () => {
  const catalog = buildProductCatalog(makeJanuaryBatamItems(), { today: "2026-09-15" });
  assert.deepEqual(catalog.map((product) => product.goodSeq), ["30001287", "30001288"]);
  assert.ok(catalog.every((product) => product.packType === "air"));
  assert.deepEqual(
    [...new Set(catalog.map((product) => product.candidateKey))],
    ["air|인도네시아|바탐|1월월례회인도네시아바탐3색"]
  );
});

test("카탈로그는 상품업데이트에서 미리 계산한 골프 요약을 우선 사용한다", () => {
  const items = makeItems().map((item) => item.goodSeq === "30001001" ? {
    ...item,
    golfSummary: {
      golfDays: 3,
      minTotalHoles: 54,
      maxTotalHoles: 72,
      label: "골프 3일 · 총 54~72홀",
      status: "resolved",
      dayBreakdown: []
    }
  } : item);
  const catalog = buildProductCatalog(items, { today: "2026-08-01" });
  assert.equal(catalog[0].golfSummary.label, "골프 3일 · 총 54~72홀");
});

test("서로 다른 기간의 동일 후보 상품군을 승인하고 최저가 대표를 계산한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const validated = validateFamilyAssignment({
    familyId: "pf_test",
    memberGoodSeqs: ["30001001", "30001002"],
    representativeMode: REPRESENTATIVE_MODE.LOWEST_PRICE
  }, { catalog, families: [] });
  assert.equal(validated.memberGoodSeqs.length, 2);
  assert.equal(resolveRepresentative(validated), "30001001");
});

test("수동 대표상품은 반드시 상품군 구성원이어야 한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  assert.throws(() => validateFamilyAssignment({
    familyId: "pf_test",
    memberGoodSeqs: ["30001001", "30001002"],
    representativeMode: REPRESENTATIVE_MODE.MANUAL,
    preferredGoodSeq: "39999999"
  }, { catalog, families: [] }), (error) => error.code === "family_representative_invalid");
});

test("다른 활성 상품군에 속한 goodSeq의 중복 승인을 차단한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const families = [{
    familyId: "pf_existing",
    status: "approved",
    members: [{ goodSeq: "30001001", memberStatus: "active" }]
  }];
  assert.throws(() => validateFamilyAssignment({
    familyId: "pf_new",
    memberGoodSeqs: ["30001001", "30001002"]
  }, { catalog, families }), (error) => error.code === "family_member_conflict");
});

test("마스터가 커밋되지 않은 다음 리비전 구성원 행은 활성 상태에 섞이지 않는다", () => {
  const families = hydrateFamilyState([
    { familyId: "pf_test", status: "approved", configRevision: "1", updatedAt: "2026-07-29T10:00:00+09:00" }
  ], [
    { familyId: "pf_test", goodSeq: "30001001", memberStatus: "active", configRevision: "1" },
    { familyId: "pf_test", goodSeq: "30001002", memberStatus: "active", configRevision: "2" }
  ]);
  assert.deepEqual(families[0].members.map((member) => member.goodSeq), ["30001001"]);
});

test("서버 후보 분석은 기간이 다른 동일 후보를 묶고 승인 소속을 표시한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const pending = buildCandidateAnalysis(catalog, []);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].status, "pending");
  assert.deepEqual(pending[0].unassignedGoodSeqs, ["30001001", "30001002"]);

  const family = makeApprovedFamily(catalog);
  const approved = buildCandidateAnalysis(catalog, [family]);
  assert.equal(approved[0].status, "approved");
  assert.deepEqual(approved[0].familyIds, ["pf_test"]);
  assert.deepEqual(approved[0].unassignedGoodSeqs, []);
});

test("상품 데이터가 동일하면 승인 상품군을 새 버전으로 만들지 않는다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const family = makeApprovedFamily(catalog);
  const reconciliation = reconcileFamilyWithCatalog(family, catalog);
  assert.equal(reconciliation.changed, false);
  assert.equal(reconciliation.requiresReview, false);
  assert.equal(reconciliation.family.status, "approved");
});

test("기존 1월 월례회 상품군은 ID·구성·대표를 유지하고 golf 후보 키만 air로 보정한다", () => {
  const airCatalog = buildProductCatalog(makeJanuaryBatamItems(), { today: "2026-09-15" });
  const legacyCatalog = airCatalog.map((product) => ({
    ...product,
    packType: "golf",
    candidateKey: product.candidateKey.replace(/^air\|/, "golf|")
  }));
  const family = makeApprovedFamily(legacyCatalog, {
    familyId: "pf_january_batam",
    representativeMode: REPRESENTATIVE_MODE.MANUAL,
    preferredGoodSeq: "30001288",
    resolvedRepresentativeGoodSeq: "30001288"
  });
  const beforeMembers = family.members.map((member) => member.goodSeq);
  const repair = getSafeCandidateKeyRepair(family, airCatalog);
  const reconciliation = reconcileFamilyWithCatalog(family, airCatalog);

  assert.equal(repair.applied, true);
  assert.equal(repair.fromCandidateKey, "golf|인도네시아|바탐|1월월례회인도네시아바탐3색");
  assert.equal(repair.toCandidateKey, "air|인도네시아|바탐|1월월례회인도네시아바탐3색");
  assert.equal(reconciliation.changed, true);
  assert.equal(reconciliation.requiresReview, false);
  assert.deepEqual(reconciliation.reasons, []);
  assert.equal(reconciliation.family.status, "approved");
  assert.equal(reconciliation.family.familyId, "pf_january_batam");
  assert.equal(reconciliation.family.preferredGoodSeq, "30001288");
  assert.equal(reconciliation.family.resolvedRepresentativeGoodSeq, "30001288");
  assert.deepEqual(reconciliation.family.members.map((member) => member.goodSeq), beforeMembers);
  assert.equal(reconciliation.family.candidateKeySnapshot, repair.toCandidateKey);

  const published = buildPublishedFamilyCatalog([reconciliation.family], airCatalog, {
    catalogRevision: "catalog-air",
    analysisRevision: "analysis-air"
  });
  assert.equal(published.familyCount, 1);
  assert.equal(published.families[0].familyId, "pf_january_batam");
  assert.equal(published.families[0].candidateKey, repair.toCandidateKey);
  assert.deepEqual(published.families[0].members.map((member) => member.goodSeq), beforeMembers);
});

test("후보 키의 지역·상품명이 달라진 상품군은 자동 보정하지 않고 재검토한다", () => {
  const airCatalog = buildProductCatalog(makeJanuaryBatamItems(), { today: "2026-09-15" });
  const legacyCatalog = airCatalog.map((product) => ({
    ...product,
    packType: "golf",
    candidateKey: product.candidateKey.replace(/^air\|인도네시아\|바탐\|/, "golf|인도네시아|발리|")
  }));
  const family = makeApprovedFamily(legacyCatalog, {
    familyId: "pf_unrelated_changed_key",
    candidateKeySnapshot: "golf|인도네시아|발리|1월월례회인도네시아바탐3색"
  });
  const reconciliation = reconcileFamilyWithCatalog(family, airCatalog);
  assert.equal(reconciliation.candidateKeyRepair, null);
  assert.equal(reconciliation.requiresReview, true);
  assert.equal(reconciliation.family.status, "review_required");
  assert.equal(reconciliation.family.candidateKeySnapshot, family.candidateKeySnapshot);
  assert.ok(reconciliation.reasons.includes("candidate_key_changed"));
});

test("다른 기존 골프팩 상품군은 항공팩 보정의 영향을 받지 않는다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const family = makeApprovedFamily(catalog, { familyId: "pf_other_golf" });
  const reconciliation = reconcileFamilyWithCatalog(family, catalog);
  assert.equal(reconciliation.changed, false);
  assert.equal(reconciliation.candidateKeyRepair, null);
  assert.equal(reconciliation.family.familyId, "pf_other_golf");
  assert.deepEqual(reconciliation.family.members.map((member) => member.goodSeq), ["30001001", "30001002"]);
  assert.match(reconciliation.family.candidateKeySnapshot, /^golf\|/);
});

test("승인 구성원의 핵심 내용이 변경되면 상품군을 재검토 상태로 전환한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const family = makeApprovedFamily(catalog);
  const changedCatalog = catalog.map((product) => product.goodSeq === "30001002"
    ? {
        ...product,
        title: `${product.title} 변경`,
        materialSignature: ""
      }
    : product);
  const reconciliation = reconcileFamilyWithCatalog(family, changedCatalog);
  assert.equal(reconciliation.changed, true);
  assert.equal(reconciliation.requiresReview, true);
  assert.equal(reconciliation.family.status, "review_required");
  assert.ok(reconciliation.reasons.includes("member_material_changed"));
});

test("구성 상품이 현재 카탈로그에서 사라져도 상품군 소속은 보존하고 재검토 처리한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const family = makeApprovedFamily(catalog, {
    representativeMode: "manual",
    preferredGoodSeq: "30001002",
    resolvedRepresentativeGoodSeq: "30001002"
  });
  const reconciliation = reconcileFamilyWithCatalog(family, catalog.filter((product) => product.goodSeq !== "30001002"));
  assert.equal(reconciliation.family.members.length, 2);
  assert.equal(reconciliation.family.members[1].sourceActive, false);
  assert.equal(reconciliation.family.preferredGoodSeq, "30001002");
  assert.equal(reconciliation.family.resolvedRepresentativeGoodSeq, "30001001");
  assert.equal(reconciliation.family.status, "review_required");
  assert.ok(reconciliation.reasons.includes("manual_representative_unavailable"));
});

test("자동 대표상품은 가격 변경 시 재검토 없이 현재 최저가 상품으로 갱신한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const family = makeApprovedFamily(catalog);
  const repricedCatalog = catalog.map((product) => product.goodSeq === "30001002"
    ? { ...product, lowestPrice: 700000 }
    : product);
  const reconciliation = reconcileFamilyWithCatalog(family, repricedCatalog);
  assert.equal(reconciliation.changed, true);
  assert.equal(reconciliation.requiresReview, false);
  assert.equal(reconciliation.family.status, "approved");
  assert.equal(reconciliation.family.resolvedRepresentativeGoodSeq, "30001002");
});

test("같은 리비전과 갱신시각의 마지막 마스터 행을 최신 발행 상태로 사용한다", () => {
  const families = hydrateFamilyState([
    { familyId: "pf_test", status: "approved", configRevision: "1", publishStatus: "pending", updatedAt: "2026-07-30T10:00:00+09:00" },
    { familyId: "pf_test", status: "approved", configRevision: "1", publishStatus: "published", updatedAt: "2026-07-30T10:00:00+09:00" }
  ], [
    { familyId: "pf_test", goodSeq: "30001001", memberStatus: "active", configRevision: "1" }
  ]);
  assert.equal(families[0].publishStatus, "published");
});

test("승인 상품군만 결정적 버전 카탈로그로 발행한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const approved = makeApprovedFamily(catalog);
  const reviewRequired = makeApprovedFamily(catalog, { familyId: "pf_review", status: "review_required" });
  const revoked = makeApprovedFamily(catalog, { familyId: "pf_revoked", status: "revoked" });
  const first = buildPublishedFamilyCatalog([approved, reviewRequired, revoked], catalog, {
    catalogRevision: "catalog-1",
    analysisRevision: "analysis-1",
    generatedAt: "2026-07-30T10:00:00+09:00"
  });
  const second = buildPublishedFamilyCatalog([approved], catalog, {
    catalogRevision: "catalog-1",
    analysisRevision: "analysis-1",
    generatedAt: "2026-07-30T11:00:00+09:00"
  });
  assert.match(first.publicationRevision, /^pfc_[a-f0-9]{24}$/);
  assert.equal(first.publicationRevision, second.publicationRevision);
  assert.equal(first.familyCount, 1);
  assert.equal(first.memberCount, 2);
  assert.equal(first.families[0].representativeGoodSeq, "30001001");
  assert.deepEqual(first.families[0].members.map((member) => member.goodSeq), ["30001001", "30001002"]);
  assert.equal(first.families[0].members[0].departurePattern.label, "매일출발");
  assert.equal(first.families[0].members[0].golfSummary.status, "empty");
  assert.equal(first.familyIdByGoodSeq["30001002"], "pf_test");
});

test("발행 시 같은 ERP 상품의 승인 상품군 중복 소속을 차단한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const left = makeApprovedFamily(catalog, { familyId: "pf_left" });
  const right = makeApprovedFamily(catalog, { familyId: "pf_right" });
  assert.throws(() => buildPublishedFamilyCatalog([left, right], catalog, {
    catalogRevision: "catalog-1",
    analysisRevision: "analysis-1"
  }), (error) => error.code === "family_publish_member_conflict");
});

test("유효 구성원이 부족한 승인 상품군은 발행에서 제외하고 진단한다", () => {
  const catalog = buildProductCatalog(makeItems(), { today: "2026-08-01" });
  const family = makeApprovedFamily(catalog, {
    members: [{ goodSeq: "30001001", memberStatus: "active", sourceActive: true, configRevision: 1 }]
  });
  const published = buildPublishedFamilyCatalog([family], catalog, {
    catalogRevision: "catalog-1",
    analysisRevision: "analysis-1"
  });
  assert.equal(published.familyCount, 0);
  assert.deepEqual(published.diagnostics[0].reasons, ["active_members_insufficient"]);
});

test("매니페스트는 현재 발행본과 직전 발행본을 연결한다", () => {
  const publishedCatalog = {
    publicationRevision: "pfc_111111111111111111111111",
    sourceCatalogRevision: "catalog-2",
    analysisRevision: "analysis-2",
    familyCount: 2,
    memberCount: 5
  };
  const manifest = buildProductFamilyManifest(publishedCatalog, {
    objectName: "web/product-family/catalogs/pfc_111111111111111111111111.json",
    url: "https://storage.googleapis.com/test/catalog.json"
  }, {
    activePublicationRevision: "pfc_000000000000000000000000",
    previousPublicationRevision: "pfc_ffffffffffffffffffffffff"
  }, {
    publishedAt: "2026-07-30T12:00:00+09:00"
  });
  assert.equal(manifest.schema, "golfjoin-product-family-manifest-v1");
  assert.equal(manifest.activePublicationRevision, "pfc_111111111111111111111111");
  assert.equal(manifest.previousPublicationRevision, "pfc_000000000000000000000000");
  assert.equal(manifest.familyCount, 2);
  assert.equal(manifest.memberCount, 5);
});

test("같은 발행본의 매니페스트를 다시 만들면 기존 직전 버전을 보존한다", () => {
  const revision = "pfc_222222222222222222222222";
  const manifest = buildProductFamilyManifest({
    publicationRevision: revision,
    familyCount: 1,
    memberCount: 2
  }, {
    objectName: `web/product-family/catalogs/${revision}.json`,
    url: "https://storage.googleapis.com/test/catalog.json"
  }, {
    activePublicationRevision: revision,
    previousPublicationRevision: "pfc_111111111111111111111111"
  });
  assert.equal(manifest.previousPublicationRevision, "pfc_111111111111111111111111");
});
