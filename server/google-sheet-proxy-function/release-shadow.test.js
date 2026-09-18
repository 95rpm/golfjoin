"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReleasePublishInput } = require("./release-sources");
const { buildReleaseShadowReport, assertReleaseShadowReport } = require("./release-shadow");

function preview(displayName, gender, seed) {
  return {
    displayName,
    gender,
    ageDisplay: "40대",
    profession: "사업",
    level: "입문",
    styles: ["매너중시"],
    memberPreferences: ["누구나 즐겁게"],
    iconSeed: `preview_${seed.repeat(20).slice(0, 20)}`,
    companionGroup: "creator"
  };
}

function makeSource() {
  const creator = preview("권*", "남성", "a");
  const participant = preview("전*", "남성", "b");
  const summaryPayload = {
    generatedAt: "2026-08-11T12:00:00+09:00",
    sourceGeneratedAt: "2026-08-11T11:59:00+09:00",
    count: 2,
    items: [
      {
        id: "erp-30001104-30285494",
        goodSeq: "30001104",
        eventSeq: "30285494",
        title: "태국 우돈타니 3박 5일",
        departureDate: "2026-08-20",
        returnDate: "2026-08-24",
        price: 259000,
        status: ""
      },
      {
        id: "erp-30001105-30285495",
        goodSeq: "30001105",
        eventSeq: "30285495",
        title: "태국 우돈타니 4박 6일",
        departureDate: "2026-08-21",
        returnDate: "2026-08-26",
        price: 279000,
        status: "available"
      }
    ],
    range: { startDate: "2026-08-11", endDate: "2027-08-11" },
    productMetaByGoodSeq: {},
    destinations: { countries: [] }
  };
  const homeBootstrapLight = {
    ok: true,
    serverTime: "2026-08-11T12:00:00+09:00",
    updatedAt: "2026-08-11T12:00:00+09:00",
    newScheduleSummaries: [{
      scheduleId: "sch_private_fixture",
      applicationId: "nsa_private_fixture",
      targetType: "new_schedule",
      erpProductId: "30001104",
      erpEventSeq: "30285494",
      title: "태국 우돈타니 3박 5일",
      departureDate: "2026-08-20",
      returnDate: "2026-08-24",
      price: 259000,
      creatorPreview: creator,
      participantsPreview: [creator, participant],
      confirmedCount: 2,
      remainingSlots: 2,
      approvalStatus: "pending",
      displayStatus: "visible"
    }],
    participantSummaries: [{
      targetType: "new_schedule",
      targetScheduleId: "sch_private_fixture",
      targetApplicationId: "nsa_private_fixture",
      erpProductId: "30001104",
      erpEventSeq: "30285494",
      capacity: 4,
      confirmedCount: 2,
      remainingSlots: 2,
      maleCount: 2,
      femaleCount: 0,
      participantsPreview: [creator, participant]
    }],
    displayRules: [],
    wishTargetKeys: [],
    memberBasic: { hasMember: false },
    warnings: []
  };
  const members = summaryPayload.items.map((item, index) => ({
    goodSeq: item.goodSeq,
    title: item.title,
    durationNights: index === 0 ? 3 : 4,
    durationDays: index === 0 ? 5 : 6,
    durationLabel: index === 0 ? "3박 5일" : "4박 6일",
    lowestPrice: item.price,
    earliestDepartureDate: item.departureDate,
    representativeEventSeq: item.eventSeq
  }));
  const familyCatalog = {
    schema: "golfjoin-product-family-catalog-v1",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publicationRevision: "pfc_111111111111111111111111",
    familyCount: 1,
    memberCount: 2,
    families: [{
      familyId: "pf_private_fixture",
      representativeGoodSeq: "30001104",
      representative: members[0],
      members
    }],
    familyIdByGoodSeq: { "30001104": "pf_private_fixture", "30001105": "pf_private_fixture" },
    diagnostics: []
  };
  return { summaryPayload, homeBootstrapLight, familyCatalog };
}

function makePrepared() {
  const source = makeSource();
  const releaseInput = buildReleasePublishInput({
    bucketName: "golfjoin-test-bucket",
    prefix: "web",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publishedAt: "2026-08-11T12:00:01+09:00",
    ...source
  });
  return { ...source, releaseInput };
}

test("같은 원본으로 만든 legacy와 V2 후보의 핵심 필드가 모두 일치한다", () => {
  const prepared = makePrepared();
  const report = buildReleaseShadowReport({ ...prepared, comparedAt: "2026-08-11T12:00:02+09:00" });

  assert.equal(report.valid, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.browserExecuted, false);
  assert.equal(report.comparisons.homeProducts.currentCount, 2);
  assert.equal(report.comparisons.availabilityEvents.currentCount, 2);
  assert.equal(report.comparisons.newSchedules.currentCount, 1);
  assert.equal(report.comparisons.participantSummaries.currentCount, 1);
  assert.equal(report.comparisons.productFamilies.currentCount, 1);
  assert.doesNotThrow(() => assertReleaseShadowReport(report));
});

test("가격·참여자·대표상품이 달라지면 root 전환 전에 실패할 보고서를 만든다", () => {
  const prepared = makePrepared();
  prepared.releaseInput = structuredClone(prepared.releaseInput);
  prepared.releaseInput.objects.homeCards.payload.items[0].price += 10000;
  prepared.releaseInput.objects.liveHome.payload.participantSummaries[0].participantsPreview.pop();
  prepared.releaseInput.objects.productFamily.payload.families[0].representativeGoodSeq = "30001105";
  const report = buildReleaseShadowReport({ ...prepared, comparedAt: "2026-08-11T12:00:02+09:00" });

  assert.equal(report.valid, false);
  assert.ok(report.issueCount >= 3);
  assert.throws(() => assertReleaseShadowReport(report), /shadow comparison failed/);
  assert.ok(report.comparisons.homeProducts.issueSamples.some((issue) => issue.path === "$.price"));
  assert.ok(report.comparisons.participantSummaries.issueSamples.some((issue) => issue.path === "$.participantsPreview"));
  assert.ok(report.comparisons.productFamilies.issueSamples.some((issue) => issue.path === "$.representativeGoodSeq"));
});

test("Shadow 보고서에는 원본 상품·일정·회원 식별자와 공개 이름이 남지 않는다", () => {
  const prepared = makePrepared();
  prepared.releaseInput = structuredClone(prepared.releaseInput);
  prepared.releaseInput.objects.liveHome.payload.newScheduleSummaries = [];
  const serialized = JSON.stringify(buildReleaseShadowReport({
    ...prepared,
    comparedAt: "2026-08-11T12:00:02+09:00"
  }));

  [
    "30001104",
    "30285494",
    "sch_private_fixture",
    "nsa_private_fixture",
    "pf_private_fixture",
    "권*",
    "전*"
  ].forEach((privateValue) => assert.equal(serialized.includes(privateValue), false));
});
