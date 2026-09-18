"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { __test } = require("./index");

function makePayload(overrides = {}) {
  const familyOptions = [
    {
      goodSeq: "30001287",
      eventSeq: "30286551",
      departureDate: "2027-01-16",
      returnDate: "2027-01-21",
      durationLabel: "4박6일",
      price: 1390000
    },
    {
      goodSeq: "30001288",
      eventSeq: "30286552",
      departureDate: "2027-01-16",
      returnDate: "2027-01-24",
      durationLabel: "7박9일",
      price: 1890000
    }
  ];
  return {
    recommendedScheduleId: "rs-family-pf_3562d40bd7cd449fa80eabc859faec63-2027-01-16",
    erpProductId: "30001287",
    erpEventSeq: "30286551",
    section: "available_schedule",
    capacity: 40,
    maxPeople: 40,
    packType: "air",
    productFamilyId: "pf_3562d40bd7cd449fa80eabc859faec63",
    familyDepartureDate: "2027-01-16",
    familyOptionsJson: JSON.stringify(familyOptions),
    ...overrides
  };
}

test("동일 출발일의 서로 다른 ERP 상품 기간은 통합 추천일정으로 유효하다", () => {
  assert.doesNotThrow(() => __test.validateProductDisplayRulePayload(makePayload()));
});

test("상품군 옵션의 출발일이 다르면 저장을 거부한다", () => {
  const payload = makePayload();
  const options = JSON.parse(payload.familyOptionsJson);
  options[1].departureDate = "2027-01-17";
  payload.familyOptionsJson = JSON.stringify(options);
  assert.throws(
    () => __test.validateProductDisplayRulePayload(payload),
    /familyOptionsJson\[1\] is invalid/
  );
});

test("같은 ERP 상품을 중복한 옵션은 저장을 거부한다", () => {
  const payload = makePayload();
  const options = JSON.parse(payload.familyOptionsJson);
  options[1].goodSeq = options[0].goodSeq;
  payload.familyOptionsJson = JSON.stringify(options);
  assert.throws(
    () => __test.validateProductDisplayRulePayload(payload),
    /distinct ERP products/
  );
});

test("시트 헤더 순서가 달라도 통합 필드는 해당 열에 정확히 기록된다", () => {
  const payload = makePayload();
  const headers = [
    "recommendedScheduleId",
    "familyOptionsJson",
    "erpEventSeq",
    "productFamilyId",
    "familyDepartureDate",
    "erpProductId"
  ];
  const row = __test.buildRecommendedScheduleSheetRow(payload, {}, headers);
  assert.deepEqual(row, headers.map((header) => (
    header === "familyOptionsJson" ? payload.familyOptionsJson : String(payload[header] ?? "")
  )));
});

test("통합 정원 60명은 두 기간에 30명씩 안전하게 배분된다", () => {
  const payload = makePayload({ capacity: 60, maxPeople: 60 });
  const schedule = {
    ...payload,
    isAdminRecommendedSchedule: true,
    scheduleId: `admin-recommended-${payload.recommendedScheduleId}`,
    applicationId: payload.recommendedScheduleId
  };
  const options = __test.getRecommendedScheduleFamilyOptions(schedule);
  assert.deepEqual(options.map((option) => option.capacity), [30, 30]);
  assert.equal(options.reduce((sum, option) => sum + option.capacity, 0), 60);
});

test("기간별 정원의 합이 통합 정원과 다르면 저장을 거부한다", () => {
  const payload = makePayload({ capacity: 60, maxPeople: 60 });
  const options = JSON.parse(payload.familyOptionsJson).map((option) => ({ ...option, capacity: 20 }));
  payload.familyOptionsJson = JSON.stringify(options);
  assert.throws(
    () => __test.validateProductDisplayRulePayload(payload),
    /capacity total must match capacity/
  );
});

test("통합 참여 현황은 합산하고 기간별 참여 현황은 ERP 행사별로 분리한다", () => {
  const payload = makePayload({ capacity: 60, maxPeople: 60 });
  const schedule = {
    ...payload,
    isAdminRecommendedSchedule: true,
    scheduleId: `admin-recommended-${payload.recommendedScheduleId}`,
    applicationId: payload.recommendedScheduleId,
    sourceApplicationId: payload.recommendedScheduleId
  };
  const makeJoin = (applicationId, goodSeq, eventSeq, people) => ({
    applicationId,
    targetType: "recommended_schedule",
    targetScheduleId: schedule.scheduleId,
    targetApplicationId: schedule.applicationId,
    erpProductId: goodSeq,
    erpEventSeq: eventSeq,
    applicantName: applicationId,
    applicantPeople: String(people),
    applicationStatus: "pending"
  });
  const joins = [
    makeJoin("four-night", "30001287", "30286551", 2),
    makeJoin("seven-night", "30001288", "30286552", 3)
  ];
  const summary = __test.buildScheduleParticipantSummary(schedule, joins);
  assert.equal(summary.capacity, 60);
  assert.equal(summary.confirmedPeople, 5);
  assert.deepEqual(
    summary.familyOptionSummaries.map((option) => [option.goodSeq, option.capacity, option.confirmedCount, option.remainingSlots]),
    [
      ["30001287", 30, 2, 28],
      ["30001288", 30, 3, 27]
    ]
  );
  assert.equal(__test.findRecommendedScheduleFamilyOption(schedule, joins[1]).goodSeq, "30001288");
});

test("한 기간이 30명으로 마감돼도 다른 기간의 잔여석은 독립적으로 유지된다", () => {
  const payload = makePayload({ capacity: 60, maxPeople: 60 });
  const schedule = {
    ...payload,
    isAdminRecommendedSchedule: true,
    scheduleId: `admin-recommended-${payload.recommendedScheduleId}`,
    applicationId: payload.recommendedScheduleId
  };
  const joins = [
    {
      applicationId: "four-night-full",
      targetType: "recommended_schedule",
      targetScheduleId: schedule.scheduleId,
      erpProductId: "30001287",
      erpEventSeq: "30286551",
      applicantPeople: "30",
      applicationStatus: "pending"
    }
  ];
  const options = __test.getRecommendedScheduleFamilyOptions(schedule);
  const first = __test.buildRecommendedFamilyOptionParticipantSummary(schedule, joins, options[0]);
  const second = __test.buildRecommendedFamilyOptionParticipantSummary(schedule, joins, options[1]);
  assert.equal(first.remainingSlots, 0);
  assert.equal(first.remainingSeats, 0);
  assert.equal(first.confirmedPeople, 30);
  assert.equal(second.remainingSlots, 30);
  assert.equal(second.remainingSeats, 30);
  assert.equal(second.confirmedPeople, 0);
});
