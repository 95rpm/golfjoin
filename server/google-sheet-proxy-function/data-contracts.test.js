"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildGolfJoinHomeArtifacts } = require("./home-products");
const {
  REPRESENTATIVE_MODE,
  buildProductCatalog,
  buildProductMaterialSignature,
  buildPublishedFamilyCatalog,
  buildProductFamilyManifest
} = require("./product-family");
const {
  DATA_CONTRACTS,
  validateDataContract,
  assertDataContract
} = require("./data-contracts");

function makeEvent(day, overrides = {}) {
  return {
    id: `erp-30001104-30285${day}`,
    goodSeq: "30001104",
    eventSeq: `30285${day}`,
    title: "태국 우돈타니 로얄크릭 3박5일",
    country: "태국",
    region: "우돈타니",
    category: "해외",
    departureDate: `2026-08-${String(day).padStart(2, "0")}`,
    returnDate: `2026-08-${String(day + 4).padStart(2, "0")}`,
    duration: "3박 5일",
    price: 259000,
    status: "예약",
    ...overrides
  };
}

function buildHomeFixture() {
  return buildGolfJoinHomeArtifacts({
    generatedAt: "2026-08-03T10:00:00+09:00",
    sourceGeneratedAt: "2026-08-03T10:00:00+09:00",
    count: 2,
    items: [makeEvent(11), makeEvent(12)]
  }, {
    availabilityObjectPrefix: "web/product-availability/gpa_fixture"
  });
}

function buildFamilyFixture() {
  const sourceItems = [
    makeEvent(11, { goodSeq: "30001104", eventSeq: "3028511", duration: "3박 5일" }),
    makeEvent(12, { goodSeq: "30001105", eventSeq: "3028512", duration: "4박 6일", price: 289000 })
  ];
  const catalog = buildProductCatalog(sourceItems, { today: "2026-08-01" });
  const family = {
    familyId: "pf_fixture",
    status: "approved",
    representativeMode: REPRESENTATIVE_MODE.LOWEST_PRICE,
    resolvedRepresentativeGoodSeq: "30001104",
    candidateKeySnapshot: catalog[0].candidateKey,
    configRevision: 1,
    members: catalog.map((product) => ({
      familyId: "pf_fixture",
      goodSeq: product.goodSeq,
      memberStatus: "active",
      durationNights: product.durationNights,
      durationDays: product.durationDays,
      sourceTitleSnapshot: product.title,
      materialSignature: buildProductMaterialSignature(product),
      sourceActive: true,
      configRevision: 1
    }))
  };
  return buildPublishedFamilyCatalog([family], catalog, {
    catalogRevision: "catalog-fixture",
    analysisRevision: "analysis-fixture",
    generatedAt: "2026-08-03T10:00:00+09:00"
  });
}

function makePreview(seed, gender, displayName) {
  return {
    displayName,
    gender,
    ageDisplay: "40대",
    profession: "",
    level: "입문",
    styles: ["매너중시"],
    memberPreferences: ["누구나 즐겁게"],
    iconSeed: `preview_${seed.repeat(20).slice(0, 20)}`,
    companionGroup: ""
  };
}

function buildHomeBootstrapLightFixture() {
  const creator = makePreview("a", "남성", "권**");
  const companion = makePreview("b", "여성", "일*");
  const joiner = makePreview("c", "남성", "전**");
  return {
    ok: true,
    serverTime: "2026-08-06T12:00:00+09:00",
    updatedAt: "2026-08-06T12:00:00+09:00",
    newScheduleSummaries: [{
      scheduleId: "sch_fixture",
      applicationId: "nsa_fixture",
      targetType: "new_schedule",
      erpProductId: "30001104",
      erpEventSeq: "30285494",
      productFamilyId: "pf_fixture",
      title: "태국 우돈타니 로얄크릭 3박5일",
      departureDate: "2026-08-12",
      returnDate: "2026-08-16",
      price: 259000,
      creatorPreview: creator,
      participantsPreview: [creator, companion],
      confirmedCount: 2,
      remainingSlots: 2,
      approvalStatus: "pending",
      displayStatus: "visible"
    }],
    participantSummaries: [{
      targetType: "new_schedule",
      targetScheduleId: "sch_fixture",
      targetApplicationId: "nsa_fixture",
      erpProductId: "30001104",
      erpEventSeq: "30285494",
      capacity: 4,
      confirmedCount: 3,
      remainingSlots: 1,
      maleCount: 2,
      femaleCount: 1,
      participantsPreview: [creator, companion, joiner],
      lastAppliedAt: "2026-08-06T12:00:00+09:00"
    }],
    displayRules: [],
    wishTargetKeys: [],
    memberBasic: { hasMember: false },
    warnings: []
  };
}

function buildProductDetailSnapshotFixture() {
  return {
    schema: "secret-golf-join-product-detail-v1",
    generatedAt: "2026-08-06T13:00:00+09:00",
    detailRevision: "gpd_111111111111111111111111",
    goodSeq: "30001104",
    eventSeq: "30285494",
    erpProductId: "30001104",
    erpEventSeq: "30285494",
    goodTransportSeq: "30002073",
    title: "태국 우돈타니 로얄크릭 3박5일",
    detailTitleCopy: "골프와 휴식을 함께 즐기는 일정",
    goodDescription: "로얄크릭 골프 여행",
    departureDate: "2026-08-12",
    returnDate: "2026-08-16",
    duration: "3박 5일",
    price: 259000,
    adultPrice: 259000,
    childPrice: 0,
    infantPrice: 0,
    oilPrice: 0,
    heroImage: "https://image.secret-tour.com/products/30001104/main.jpg",
    detailStatus: "ready",
    sectionStatus: {
      includes: "available",
      excludes: "available",
      notes: "available",
      schedule: "available",
      images: "available"
    },
    flight: {
      state: "loaded",
      packType: "항공팩",
      airline: "대한항공",
      departureAirport: "인천",
      arrivalAirport: "우돈타니",
      items: [
        {
          label: "출발",
          airline: "대한항공",
          code: "KE123",
          fromDate: "2026-08-12",
          fromTime: "08:00",
          toDate: "2026-08-12",
          toTime: "12:00",
          rawText: "출발 항공 일정"
        },
        {
          label: "도착",
          airline: "대한항공",
          code: "KE124",
          fromDate: "2026-08-16",
          fromTime: "13:00",
          toDate: "2026-08-16",
          toTime: "17:00",
          rawText: "도착 항공 일정"
        }
      ]
    },
    includes: ["그린피", "호텔 숙박"],
    excludes: ["개인경비"],
    notes: [{ text: "여권 유효기간을 확인해 주세요.", source: "goods detail 참고사항" }],
    schedule: [
      {
        day: "1일차",
        dateText: "8/12(수)",
        content: "인천 출발, 우돈타니 도착",
        rawText: "인천 출발 후 우돈타니 도착",
        extra: { hotel: "로얄크릭 호텔", meals: [{ label: "석식", menu: "현지식" }] }
      },
      {
        day: "2일차",
        dateText: "8/13(목)",
        content: "골프 라운딩",
        rawText: "로얄크릭 골프 라운딩",
        extra: { hotel: "로얄크릭 호텔", meals: [{ label: "조식", menu: "호텔식" }] }
      }
    ],
    slides: ["https://image.secret-tour.com/products/30001104/slide-1.jpg"],
    introImages: ["https://image.secret-tour.com/products/30001104/intro-1.jpg"],
    sourceUrl: "https://www.secret-tour.com/goods/goods_view?goodSeq=30001104&eventSeq=30285494",
    source: "secret-tour-goods-view",
    warnings: []
  };
}

test("계약 정의는 JSON Schema 2020-12 형식과 고유 ID를 가진다", () => {
  Object.values(DATA_CONTRACTS).forEach((schema) => {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.match(schema.$id, /^https:\/\/golfjoin\.local\/contracts\//);
  });
});

test("release manifest V2 계약은 브라우저 사용 OFF와 역할별 리비전 일치를 요구한다", () => {
  const revision = "gjr_111111111111111111111111";
  const roles = {
    homeCards: ["staticRevision", "ghc_111111111111111111111111"],
    liveHome: ["liveRevision", "ghl_111111111111111111111111"],
    productFamily: ["familyRevision", "pfc_111111111111111111111111"],
    availability: ["availabilityRevision", "gpa_111111111111111111111111"],
    productDetail: ["detailRevision", "gpd_111111111111111111111111"]
  };
  const payload = {
    schema: "secret-golf-join-release-manifest-v2",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publishedAt: "2026-08-11T12:00:01+09:00",
    releaseRevision: revision,
    previousStableRevision: "",
    sourceSnapshotWatermark: "sheet-snapshot-fixture",
    browserReadEnabled: false,
    manifestObjectName: `web/releases/${revision}/manifest.json`,
    manifestUrl: `https://storage.googleapis.com/test/web/releases/${revision}/manifest.json`,
    objects: {}
  };
  Object.entries(roles).forEach(([role, [revisionField, value]]) => {
    payload[revisionField] = value;
    payload.objects[role] = {
      role,
      revision: value,
      schema: `fixture-${role}-v1`,
      objectName: `web/releases/${revision}/objects/${role}.json`,
      url: `https://storage.googleapis.com/test/web/releases/${revision}/objects/${role}.json`,
      contentSha256: "a".repeat(64),
      bytes: 100,
      contentType: "application/json; charset=utf-8",
      contentEncoding: "identity"
    };
  });
  assert.equal(validateDataContract("releaseManifestV2", payload).valid, true);

  const enabled = structuredClone(payload);
  enabled.browserReadEnabled = true;
  assert.equal(validateDataContract("releaseManifestV2", enabled).valid, false);

  const mismatched = structuredClone(payload);
  mismatched.objects.homeCards.revision = "ghc_222222222222222222222222";
  assert.ok(validateDataContract("releaseManifestV2", mismatched).issues
    .some((issue) => issue.code === "release_revision_field_mismatch"));
});

test("홈 카드 V2 생성 결과가 핵심 필드 계약을 통과한다", () => {
  const artifacts = buildHomeFixture();
  assert.equal(validateDataContract("homeCardsV2", artifacts.homeCardsPayload).valid, true);
  assert.equal(validateDataContract("productAvailabilityV1", artifacts.availabilityArtifacts[0].payload).valid, true);
});

test("홈 매니페스트의 카드 경로는 활성 발행 리비전과 일치해야 한다", () => {
  const payload = {
    schema: "secret-golf-join-home-manifest-v1",
    generatedAt: "2026-08-03T10:00:00+09:00",
    activePublicationRevision: "ghc_111111111111111111111111",
    activeCardsObjectName: "web/home-cards/ghc_111111111111111111111111.json",
    activeCardsUrl: "https://storage.googleapis.com/test/ghc_111111111111111111111111.json",
    availabilityRevision: "gpa_222222222222222222222222",
    minimumAdvanceDays: 7,
    bookableFrom: "2026-08-10"
  };
  assert.equal(validateDataContract("homeManifestV1", payload).valid, true);
  const invalid = { ...payload, activeCardsObjectName: "web/home-cards/ghc_wrong.json" };
  assert.ok(validateDataContract("homeManifestV1", invalid).issues.some((issue) => issue.code === "publication_revision_mismatch"));
});

test("홈 대표상품에서 goodSeq가 빠지면 계약이 실패한다", () => {
  const payload = structuredClone(buildHomeFixture().homeCardsPayload);
  delete payload.items[0].goodSeq;
  const result = validateDataContract("homeCardsV2", payload);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.items[0].goodSeq" && issue.code === "required"));
});

test("출발 가능일의 goodSeq가 상위 상품과 다르면 계약이 실패한다", () => {
  const payload = structuredClone(buildHomeFixture().availabilityArtifacts[0].payload);
  payload.events[0].goodSeq = "39999999";
  const result = validateDataContract("productAvailabilityV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "good_seq_mismatch"));
});

test("상품군 카탈로그와 매니페스트 생성 결과가 계약을 통과한다", () => {
  const catalog = buildFamilyFixture();
  assertDataContract("productFamilyCatalogV1", catalog);
  const manifest = buildProductFamilyManifest(catalog, {
    objectName: `web/product-family/catalogs/${catalog.publicationRevision}.json`,
    url: `https://storage.googleapis.com/test/${catalog.publicationRevision}.json`
  }, {}, {
    publishedAt: "2026-08-03T10:00:00+09:00"
  });
  assertDataContract("productFamilyManifestV1", manifest);
});

test("상품군 대표 goodSeq가 구성원과 다르면 계약이 실패한다", () => {
  const payload = structuredClone(buildFamilyFixture());
  payload.families[0].representativeGoodSeq = "39999999";
  const result = validateDataContract("productFamilyCatalogV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "representative_not_member"));
  assert.ok(result.issues.some((issue) => issue.code === "representative_mismatch"));
});

test("상품군 매핑과 구성원 수가 실제 구성원과 다르면 계약이 실패한다", () => {
  const payload = structuredClone(buildFamilyFixture());
  const goodSeq = payload.families[0].members[0].goodSeq;
  payload.familyIdByGoodSeq[goodSeq] = "pf_other";
  payload.memberCount += 1;
  const result = validateDataContract("productFamilyCatalogV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "family_mapping_mismatch"));
  assert.ok(result.issues.some((issue) => issue.path === "$.memberCount" && issue.code === "count_mismatch"));
});

test("검증 오류에는 실제 필드값이나 개인정보를 복사하지 않는다", () => {
  const result = validateDataContract("homeCardsV2", { schema: "wrong" });
  const serialized = JSON.stringify(result.issues);
  assert.equal(serialized.includes("wrong"), false);
  assert.ok(result.issues.every((issue) => Object.prototype.hasOwnProperty.call(issue, "path")));
});

test("A가 2명 생성하고 B가 1명 참여한 공개 live 요약이 계약을 통과한다", () => {
  assertDataContract("homeBootstrapLightV1", buildHomeBootstrapLightFixture());
});

test("생성자와 참여자 목록의 공개 프로필이 같으면 iconSeed 표현이 달라도 통과한다", () => {
  const payload = structuredClone(buildHomeBootstrapLightFixture());
  payload.newScheduleSummaries[0].creatorPreview.iconSeed = "preview_eeeeeeeeeeeeeeeeeeee";
  assertDataContract("homeBootstrapLightV1", payload);
});

test("생성자의 공개 프로필이 일정 참여자 목록에서 빠지면 계약이 실패한다", () => {
  const payload = structuredClone(buildHomeBootstrapLightFixture());
  payload.newScheduleSummaries[0].participantsPreview[0] = makePreview("d", "남성", "김**");
  const result = validateDataContract("homeBootstrapLightV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "creator_preview_missing"));
});

test("현재인원은 3명인데 B 참여자 아이콘이 없으면 계약이 실패한다", () => {
  const payload = structuredClone(buildHomeBootstrapLightFixture());
  payload.participantSummaries[0].participantsPreview.pop();
  const result = validateDataContract("homeBootstrapLightV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "preview_count_mismatch"));
});

test("참여 요약의 ERP 행사번호가 생성 일정과 다르면 계약이 실패한다", () => {
  const payload = structuredClone(buildHomeBootstrapLightFixture());
  payload.participantSummaries[0].erpEventSeq = "30265790";
  const result = validateDataContract("homeBootstrapLightV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "product_identity_mismatch"));
});

test("생성자 아이콘이 참여자 요약에서 빠지면 계약이 실패한다", () => {
  const payload = structuredClone(buildHomeBootstrapLightFixture());
  payload.participantSummaries[0].participantsPreview[0] = makePreview("d", "남성", "김**");
  const result = validateDataContract("homeBootstrapLightV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "creator_participant_missing"));
});

test("아이콘 성별과 남녀 집계가 다르면 계약이 실패한다", () => {
  const payload = structuredClone(buildHomeBootstrapLightFixture());
  payload.participantSummaries[0].maleCount = 1;
  payload.participantSummaries[0].femaleCount = 2;
  const result = validateDataContract("homeBootstrapLightV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "gender_count_mismatch"));
});

test("공개 참여자 아이콘에 휴대폰이나 회원키가 포함되면 계약이 실패한다", () => {
  const payload = structuredClone(buildHomeBootstrapLightFixture());
  payload.participantSummaries[0].participantsPreview[2].memberMobile = "redacted-test-value";
  payload.participantSummaries[0].participantsPreview[2].memberKey = "redacted-test-key";
  const result = validateDataContract("homeBootstrapLightV1", payload);
  assert.equal(result.issues.filter((issue) => issue.code === "private_field_present").length, 2);
  assert.equal(JSON.stringify(result.issues).includes("redacted-test"), false);
});

test("대규모 관리자 일정은 참여자 아이콘을 최대 40개까지만 허용한다", () => {
  const payload = structuredClone(buildHomeBootstrapLightFixture());
  payload.newScheduleSummaries = [];
  const previews = Array.from({ length: 40 }, (_, index) => makePreview((index % 10).toString(16), index < 23 ? "남성" : "여성", `참가자${index + 1}`))
    .map((preview, index) => ({ ...preview, iconSeed: `preview_${index.toString(16).padStart(20, "0")}` }));
  payload.participantSummaries = [{
    targetType: "recommended_schedule",
    targetScheduleId: "admin-recommended-fixture",
    targetApplicationId: "",
    erpProductId: "30001279",
    erpEventSeq: "30285966",
    capacity: 70,
    confirmedCount: 67,
    remainingSlots: 3,
    maleCount: 50,
    femaleCount: 17,
    participantsPreview: previews,
    lastAppliedAt: "2026-08-06T12:00:00+09:00"
  }];
  assertDataContract("homeBootstrapLightV1", payload);
});

test("시트 참여자 요약은 현재인원·남은자리·이름·성별 합계가 일치해야 한다", () => {
  const payload = {
    scheduleId: "sch_fixture",
    sourceApplicationId: "nsa_fixture",
    title: "태국 우돈타니 로얄크릭 3박5일",
    capacity: 4,
    creatorPeople: 2,
    joinedPeople: 3,
    confirmedPeople: 3,
    pendingPeople: 0,
    cancelledPeople: 0,
    remainingSeats: 1,
    participantNames: "권**, 일*, 전**",
    participantPhones: "010****6167, 010****6845",
    genderSummary: "남성 2 / 여성 1",
    ageSummary: "50대 2 / 40대 1",
    levelSummary: "입문 3",
    styleSummary: "매너중시 3",
    memberPreferenceSummary: "누구나 즐겁게 3",
    status: "open",
    approvalStatus: "pending",
    displayStatus: "visible",
    updatedAt: "2026-08-06T12:00:00+09:00"
  };
  assertDataContract("scheduleParticipantSummaryV1", payload);
  payload.joinedPeople = 2;
  payload.genderSummary = "남성 2";
  const result = validateDataContract("scheduleParticipantSummaryV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "joined_people_mismatch"));
  assert.ok(result.issues.some((issue) => issue.code === "gender_count_mismatch"));
});

test("상품상세 스냅샷은 상품·행사·기간·항공·본문·이미지 계약을 통과한다", () => {
  assertDataContract("productDetailSnapshotV1", buildProductDetailSnapshotFixture());
});

test("상품상세 스냅샷의 ERP 행사번호가 대상 행사와 다르면 실패한다", () => {
  const payload = buildProductDetailSnapshotFixture();
  payload.erpEventSeq = "30265790";
  const result = validateDataContract("productDetailSnapshotV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "product_identity_mismatch"));
});

test("상품상세 원본 URL이 다른 상품이나 행사를 가리키면 실패한다", () => {
  const payload = buildProductDetailSnapshotFixture();
  payload.sourceUrl = "https://www.secret-tour.com/goods/goods_view?goodSeq=30001104&eventSeq=30265790";
  const result = validateDataContract("productDetailSnapshotV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "source_product_identity_mismatch"));
});

test("출발일보다 귀국일이 빠른 상품상세 스냅샷은 실패한다", () => {
  const payload = buildProductDetailSnapshotFixture();
  payload.returnDate = "2026-08-11";
  const result = validateDataContract("productDetailSnapshotV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "return_before_departure"));
});

test("일정이 있다고 표시했지만 일정표가 비어 있으면 실패한다", () => {
  const payload = buildProductDetailSnapshotFixture();
  payload.schedule = [];
  const result = validateDataContract("productDetailSnapshotV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "available_section_empty"));
});

test("항공 로딩 완료 상태인데 항공편이 비어 있으면 실패한다", () => {
  const payload = buildProductDetailSnapshotFixture();
  payload.flight.items = [];
  const result = validateDataContract("productDetailSnapshotV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "loaded_flight_empty"));
});

test("부분 상세 데이터에는 누락 사유를 나타내는 경고 코드가 필요하다", () => {
  const payload = buildProductDetailSnapshotFixture();
  payload.detailStatus = "partial";
  const result = validateDataContract("productDetailSnapshotV1", payload);
  assert.ok(result.issues.some((issue) => issue.code === "detail_warning_required"));
});

test("상세 이미지는 HTTP 또는 HTTPS 주소여야 한다", () => {
  const payload = buildProductDetailSnapshotFixture();
  payload.slides[0] = "javascript:alert(1)";
  const result = validateDataContract("productDetailSnapshotV1", payload);
  assert.ok(result.issues.some((issue) => issue.path === "$.slides[0]" && issue.code === "pattern_mismatch"));
});
