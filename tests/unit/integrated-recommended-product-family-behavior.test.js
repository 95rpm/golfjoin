"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const acorn = require("acorn");

const ROOT = path.resolve(__dirname, "../..");
const dashboardHtml = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const dashboardSource = [...dashboardHtml.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((source) => source.includes("function getRecommendationProductGroups"));
const mainSource = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);
const detailActionSource = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/39-detail-actions-participants.js"),
  "utf8"
);

function getFunctions(source, names) {
  const program = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  return names.map((name) => {
    const node = program.body.find((item) => item.type === "FunctionDeclaration" && item.id?.name === name);
    assert.ok(node, `function not found: ${name}`);
    return source.slice(node.start, node.end);
  }).join("\n");
}

function createContext(values = {}) {
  return vm.createContext({
    console,
    Date,
    Map,
    Set,
    JSON,
    Number,
    String,
    Boolean,
    Math,
    RegExp,
    ...values
  });
}

test("승인 상품군은 같은 출발일의 두 기간만 하나의 추천 후보로 묶는다", () => {
  const context = createContext({
    productFamilyAdminState: {
      families: [{
        familyId: "pf_3562d40bd7cd449fa80eabc859faec63",
        status: "approved",
        preferredGoodSeq: "30001287",
        resolvedRepresentativeGoodSeq: "30001287",
        members: [
          { goodSeq: "30001287", memberStatus: "active" },
          { goodSeq: "30001288", memberStatus: "active" }
        ]
      }],
      catalog: [
        { goodSeq: "30001287", durationLabel: "4박6일" },
        { goodSeq: "30001288", durationLabel: "7박9일" }
      ]
    },
    recommendationCalendarGroupIndexCache: new WeakMap(),
    asText: (value) => String(value ?? "").trim(),
    getPackType: () => "air",
    getRecommendationProductCountry: () => "인도네시아",
    getRecommendationProductRegion: () => "바탐",
    extractTripSummaryPeriod: () => "",
    formatTripNightsDays: () => ""
  });
  vm.runInContext(getFunctions(dashboardSource, [
    "getRecommendationFamilyMemberGoodSeq",
    "getRecommendationApprovedFamilies",
    "getRecommendationFamilyByGoodSeqMap",
    "normalizeRecommendationDurationLabel",
    "getRecommendationFamilyDurationLabels",
    "buildRecommendationFamilyTitle",
    "selectRecommendationCalendarItem",
    "getRecommendationCalendarGroupIndex",
    "getRecommendationGroupDateItems",
    "getRecommendationProductGroups"
  ]), context);

  const makeItem = (goodSeq, eventSeq, departureDate, returnDate, title, price) => ({
    goodSeq,
    eventSeq,
    key: `${goodSeq}::${eventSeq}`,
    product: { goodSeq, eventSeq, departureDate, returnDate, title, price, category: "해외" }
  });
  const groups = context.getRecommendationProductGroups([
    makeItem("30001287", "30286551", "2027-01-16", "2027-01-21", "[1월 월례회] 바탐 3색 4박6일", 1390000),
    makeItem("30001288", "30286552", "2027-01-16", "2027-01-24", "[1월 월례회] 바탐 3색 7박9일", 1890000),
    makeItem("30001287", "30286600", "2027-01-23", "2027-01-28", "[1월 월례회] 바탐 3색 4박6일", 1450000)
  ]);

  assert.equal(groups.length, 2);
  const family = groups.find((group) => group.familyId);
  const individual = groups.find((group) => !group.familyId);
  assert.equal(family.key, "family:pf_3562d40bd7cd449fa80eabc859faec63");
  assert.equal(family.items.length, 2);
  assert.equal(family.period, "4박6일/7박9일");
  assert.match(family.title, /4박6일\/7박9일/);
  assert.equal(family.goodSeq, "30001287");
  assert.equal(individual.key, "product:30001287");
  assert.equal(individual.firstDeparture, "2027-01-23");
});

test("메인 통합 카드 날짜는 출발일 한 번과 두 귀국일을 표시한다", () => {
  const context = createContext();
  vm.runInContext(getFunctions(mainSource, [
    "getAdminRecommendedFamilyOptions",
    "formatCardDateRange"
  ]), context);
  const join = {
    isAdminRecommendedSchedule: true,
    productFamilyId: "pf_3562d40bd7cd449fa80eabc859faec63",
    familyDepartureDate: "2027-01-16",
    departureDate: "2027-01-16",
    returnDate: "2027-01-21",
    familyOptions: [
      { goodSeq: "30001287", eventSeq: "30286551", departureDate: "2027-01-16", returnDate: "2027-01-21", durationLabel: "4박6일", price: 1390000 },
      { goodSeq: "30001288", eventSeq: "30286552", departureDate: "2027-01-16", returnDate: "2027-01-24", durationLabel: "7박9일", price: 1890000 }
    ]
  };
  assert.equal(context.formatCardDateRange(join), "1.16(토)~1.21(목)/1.24(일)");
  assert.equal(context.formatCardDateRange(join, { selectedPeriod: true }), "1.16(토)~1.21(목)");
});

test("상세 기간 옵션은 각 기간의 ERP 행사와 요금을 유지한다", () => {
  const familyId = "pf_3562d40bd7cd449fa80eabc859faec63";
  const liveProducts = [
    { goodSeq: "30001287", eventSeq: "30286551", departureDate: "2027-01-16", returnDate: "2027-01-21", price: 1390000 },
    { goodSeq: "30001288", eventSeq: "30286552", departureDate: "2027-01-16", returnDate: "2027-01-24", price: 1890000 }
  ];
  const context = createContext({
    golfJoinProductFamilyById: new Map([[familyId, {
      familyId,
      members: [
        { goodSeq: "30001287", golfSummary: { label: "골프 4일 · 총 144홀" } },
        { goodSeq: "30001288", golfSummary: { label: "골프 7일 · 총 252홀" } }
      ]
    }]]),
    getBuilderProductSource: () => liveProducts,
    getGolfJoinProductGoodSeq: (value) => String(value.goodSeq || value.erpProductId || ""),
    getGolfJoinProductEventSeq: (value) => String(value.eventSeq || value.erpEventSeq || ""),
    getDetailProductFamilyGolfSummary: (member, product) => product.golfSummary || member.golfSummary || null,
    formatCardFlexDateLabel: () => "1.16(토)",
    getBlockingActiveJoinSchedule: () => null,
    reconcileJoinParticipantsWithLightSummary: (product, summary) => {
      product.participants = Array.from({ length: Number(summary.confirmedCount) || 0 }, (_, index) => ({
        id: `${summary.goodSeq}-${index}`,
        status: "confirmed"
      }));
      product.emptySlots = summary.remainingSlots;
      return product;
    }
  });
  vm.runInContext(getFunctions(mainSource, [
    "getAdminRecommendedFamilyOptions",
    "getAdminRecommendedDetailFamilyPeriodOptions"
  ]), context);
  const join = {
    id: "admin-recommended-family",
    title: "바탐 3색 4박6일/7박9일",
    productFamilyId: familyId,
    familyDepartureDate: "2027-01-16",
    goodSeq: "30001287",
    eventSeq: "30286551",
    familyOptions: [
      { goodSeq: "30001287", eventSeq: "30286551", departureDate: "2027-01-16", returnDate: "2027-01-21", durationLabel: "4박6일", price: 1390000 },
      { goodSeq: "30001288", eventSeq: "30286552", departureDate: "2027-01-16", returnDate: "2027-01-24", durationLabel: "7박9일", price: 1890000 }
    ],
    capacity: 60,
    participantSummary: {
      capacity: 60,
      confirmedCount: 15,
      remainingSlots: 45,
      familyOptionSummaries: [
        { goodSeq: "30001287", eventSeq: "30286551", capacity: 30, confirmedCount: 11, remainingSlots: 19, participantsPreview: [] },
        { goodSeq: "30001288", eventSeq: "30286552", capacity: 30, confirmedCount: 4, remainingSlots: 26, participantsPreview: [] }
      ]
    }
  };
  const options = context.getAdminRecommendedDetailFamilyPeriodOptions(join);
  assert.equal(options.length, 2);
  assert.deepEqual(
    options.map((option) => [
      option.goodSeq,
      option.eventSeq,
      option.product.returnDate,
      option.price,
      option.golfSummary?.label,
      option.selected,
      option.product.participantSummary.capacity,
      option.product.participantSummary.confirmedCount,
      option.product.participants.length
    ]),
    [
      ["30001287", "30286551", "2027-01-21", 1390000, "골프 4일 · 총 144홀", true, 30, 11, 11],
      ["30001288", "30286552", "2027-01-24", 1890000, "골프 7일 · 총 252홀", false, 30, 4, 4]
    ]
  );
});

test("메인 상세 골프 요약도 관광옵션 단축 라운드를 추가 합산하지 않는다", () => {
  const context = createContext({ cleanSecretTourDetailText: (value) => String(value || "").trim() });
  vm.runInContext(getFunctions(mainSource, [
    "analyzeDetailProductFamilyHoleLine",
    "buildDetailProductFamilyGolfSummary"
  ]), context);
  const schedule = [
    { points: ["오전36홀 라운딩"] },
    { points: ["오전36홀 라운딩"] },
    { points: ["오전36홀 라운딩\n[관광옵션]\n18홀 라운드 후 관광"] },
    { points: ["오전36홀 라운딩"] }
  ];
  const summary = context.buildDetailProductFamilyGolfSummary(schedule);
  assert.deepEqual(
    JSON.parse(JSON.stringify([summary.golfDays, summary.minTotalHoles, summary.maxTotalHoles, summary.label])),
    [4, 144, 144, "골프 4일 · 총 144홀"]
  );
});

test("통합 추천일정 신청 대상은 대표상품이 아니라 선택한 기간의 ERP 행사다", () => {
  const context = createContext({
    getCurrentApplyJoin: () => ({}),
    getSecretTourProductReference: (value) => ({
      goodSeq: String(value.goodSeq || value.erpProductId || ""),
      eventSeq: String(value.eventSeq || value.erpEventSeq || "")
    }),
    normalizeJoinCanonicalErpEventSeq: (value) => String(value || ""),
    normalizeJoinCanonicalErpProductId: (value) => String(value || "")
  });
  vm.runInContext(getFunctions(mainSource, ["getCurrentApplyTargetInfo"]), context);
  const target = context.getCurrentApplyTargetInfo({
    id: "admin-recommended-family",
    scheduleId: "admin-recommended-family",
    sourceApplicationId: "rs-family",
    isAdminRecommendedSchedule: true,
    productFamilyId: "pf_3562d40bd7cd449fa80eabc859faec63",
    goodSeq: "30001288",
    eventSeq: "30286552",
    erpProductId: "30001288",
    erpEventSeq: "30286552",
    displayRule: { erpProductId: "30001287", erpEventSeq: "30286551" }
  });
  assert.equal(target.erpProductId, "30001288");
  assert.equal(target.erpEventSeq, "30286552");
  assert.equal(target.targetProductKey, "erp:30001288:30286552");
});

test("통합 상세를 처음 열 때부터 선택된 기간별 참여 현황을 사용한다", () => {
  const openDetailSource = getFunctions(detailActionSource, ["openDetail"]);
  const catalogLoaderSource = getFunctions(mainSource, ["ensureGolfJoinProductFamilyCatalogLoaded"]);
  assert.match(openDetailSource, /getAdminRecommendedDetailFamilyPeriodOptions\(join\)/);
  assert.match(openDetailSource, /currentDetailJoinData\s*=\s*detailJoin/);
  assert.match(openDetailSource, /renderDetailContent\(detailJoin, options\)/);
  assert.match(openDetailSource, /deferWhileHomeDataV2Startup:\s*false/);
  assert.match(openDetailSource, /requireGolfSummaryForFamilyId:\s*join\.productFamilyId/);
  assert.match(openDetailSource, /\.detail-family-period-golf/);
  assert.match(openDetailSource, /target\.textContent\s*=\s*label/);
  assert.match(catalogLoaderSource, /requiresGolfSummaryRefresh/);
  assert.match(catalogLoaderSource, /golfSummaryRefreshAttempts/);
  assert.match(catalogLoaderSource, /golfJoinProductFamilyLoadPromise\s*=\s*null/);
  assert.match(mainSource, /familyParticipantSummary:\s*join\.familyParticipantSummary\s*\|\|\s*join\.participantSummary/);
});
