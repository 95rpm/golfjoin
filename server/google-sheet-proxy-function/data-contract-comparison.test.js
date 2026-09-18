"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compareHomeProductCollections,
  compareLiveScheduleCollections,
  compareProductDetailCore,
  identityHash
} = require("./data-contract-comparison");

function participant(displayName, gender, iconSeed) {
  return {
    displayName,
    gender,
    ageDisplay: "40대",
    profession: "사업",
    level: "입문",
    styles: ["매너중시"],
    memberPreferences: ["누구나 즐겁게"],
    iconSeed
  };
}

test("현재 홈 카드와 신규 홈 카드의 핵심값이 같으면 통과한다", () => {
  const current = [{
    goodSeq: "30001104",
    eventSeq: "30285494",
    productFamilyId: "pf_fixture",
    price: "259,000원",
    departureDate: "20260812",
    returnDate: "20260816",
    status: "예약"
  }];
  const candidate = [{
    erpProductId: "30001104",
    erpEventSeq: "30285494",
    familyId: "pf_fixture",
    price: 259000,
    departureDate: "2026-08-12",
    returnDate: "2026-08-16",
    status: "예약"
  }];
  assert.equal(compareHomeProductCollections(current, candidate).valid, true);
});

test("현재 홈 카드와 신규 홈 카드의 가격이 다르면 필드 오류로 기록한다", () => {
  const base = {
    goodSeq: "30001104",
    eventSeq: "30285494",
    familyId: "pf_fixture",
    price: 259000,
    departureDate: "2026-08-12",
    returnDate: "2026-08-16",
    status: "예약"
  };
  const result = compareHomeProductCollections([base], [{ ...base, price: 299000 }]);
  assert.ok(result.issues.some((issue) => issue.path === "$.price" && issue.code === "core_field_mismatch"));
});

test("신규 경로의 누락·추가 상품은 원본 식별자 없이 해시로만 기록한다", () => {
  const current = [{ goodSeq: "30001104", eventSeq: "30285494" }];
  const candidate = [{ goodSeq: "30001279", eventSeq: "30285966" }];
  const result = compareHomeProductCollections(current, candidate);
  assert.ok(result.issues.some((issue) => issue.code === "candidate_item_missing"));
  assert.ok(result.issues.some((issue) => issue.code === "candidate_item_unexpected"));
  assert.equal(JSON.stringify(result.issues).includes("30001104"), false);
  assert.equal(JSON.stringify(result.issues).includes("30285966"), false);
  assert.ok(result.issues.every((issue) => /^[a-f0-9]{16}$/.test(issue.identityHash)));
});

test("공개 모임 비교는 iconSeed가 달라도 같은 A·B 공개 프로필이면 통과한다", () => {
  const current = [{
    scheduleId: "sch_fixture",
    erpProductId: "30001104",
    erpEventSeq: "30285494",
    confirmedCount: 3,
    remainingSlots: 1,
    approvalStatus: "pending",
    displayStatus: "visible",
    participantsPreview: [participant("권**", "남성", "legacy-a"), participant("일*", "여성", "legacy-b"), participant("전**", "남성", "legacy-c")]
  }];
  const candidate = [{
    targetScheduleId: "sch_fixture",
    goodSeq: "30001104",
    eventSeq: "30285494",
    joinedPeople: 3,
    remainingSeats: 1,
    approvalStatus: "pending",
    displayStatus: "visible",
    participantsPreview: [participant("전**", "남성", "new-c"), participant("권**", "남성", "new-a"), participant("일*", "여성", "new-b")]
  }];
  assert.equal(compareLiveScheduleCollections(current, candidate).valid, true);
});

test("신규 공개 모임에서 B 참여자 프로필이 빠지면 비교가 실패한다", () => {
  const base = {
    scheduleId: "sch_fixture",
    erpProductId: "30001104",
    erpEventSeq: "30285494",
    confirmedCount: 3,
    remainingSlots: 1,
    approvalStatus: "pending",
    displayStatus: "visible"
  };
  const current = [{ ...base, participantsPreview: [participant("권**", "남성", "a"), participant("일*", "여성", "b"), participant("전**", "남성", "c")] }];
  const candidate = [{ ...base, participantsPreview: [participant("권**", "남성", "x"), participant("일*", "여성", "y")] }];
  const result = compareLiveScheduleCollections(current, candidate);
  assert.ok(result.issues.some((issue) => issue.path === "$.participantsPreview"));
});

function currentDetail() {
  return {
    goodSeq: "30001104",
    eventSeq: "30285494",
    title: "태국 우돈타니 로얄크릭 3박5일",
    startDay: "20260812",
    endDay: "20260816",
    generalPrice: 259000,
    includes: ["그린피", "호텔 숙박"],
    excludes: ["개인경비"],
    notes: ["여권 확인"],
    schedule: [{ day: "1일차", dateText: "8/12(수)", content: "인천 출발", rawText: "인천 출발", extra: { hotel: "호텔", meals: [] } }],
    slides: ["https://image.secret-tour.com/slide.jpg"],
    introImages: ["https://image.secret-tour.com/intro.jpg"],
    flightScheduleItems: [{ label: "출발", airline: "대한항공", code: "KE 123", fromDate: "20260812", fromTime: "08:00", toDate: "20260812", toTime: "12:00" }]
  };
}

function candidateDetail() {
  return {
    goodSeq: "30001104",
    eventSeq: "30285494",
    title: "태국 우돈타니 로얄크릭 3박5일",
    departureDate: "2026-08-12",
    returnDate: "2026-08-16",
    price: "259,000원",
    includes: ["호텔 숙박", "그린피"],
    excludes: ["개인경비"],
    notes: [{ text: "여권 확인", source: "goods detail" }],
    schedule: [{ day: "1일차", dateText: "8/12(수)", content: "인천 출발", rawText: "인천 출발", extra: { hotel: "호텔", meals: [] } }],
    slides: ["https://image.secret-tour.com/slide.jpg"],
    introImages: ["https://image.secret-tour.com/intro.jpg"],
    flight: { items: [{ label: "출발", airline: "대한항공", code: "KE123", fromDate: "2026-08-12", fromTime: "08:00", toDate: "2026-08-12", toTime: "12:00" }] }
  };
}

test("현재 HTML 파싱 상세와 신규 상세 스냅샷의 핵심값이 같으면 통과한다", () => {
  assert.equal(compareProductDetailCore(currentDetail(), candidateDetail()).valid, true);
});

test("신규 상세 스냅샷이 다른 행사를 가리키면 비교가 실패한다", () => {
  const candidate = candidateDetail();
  candidate.eventSeq = "30265790";
  const result = compareProductDetailCore(currentDetail(), candidate);
  assert.ok(result.issues.some((issue) => issue.path === "$.eventSeq"));
});

test("상세 일정이나 이미지가 달라지면 해당 필드만 불일치로 기록한다", () => {
  const candidate = candidateDetail();
  candidate.schedule[0].content = "다른 일정";
  candidate.introImages = [];
  const result = compareProductDetailCore(currentDetail(), candidate);
  assert.ok(result.issues.some((issue) => issue.path === "$.schedule"));
  assert.ok(result.issues.some((issue) => issue.path === "$.introImages"));
  assert.equal(result.issues.some((issue) => issue.path === "$.price"), false);
});

test("비교용 식별자 해시는 같은 입력에 항상 같고 원문을 포함하지 않는다", () => {
  const first = identityHash("private-test-identity");
  const second = identityHash("private-test-identity");
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{16}$/);
  assert.equal(first.includes("private"), false);
});
