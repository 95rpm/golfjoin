"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRecommendedScheduleMigrationPlan,
  summarizeRecommendedScheduleMigrationPlan
} = require("./recommended-schedule-migration");

const headersBySheet = {
  recommended_schedules: ["recommendedScheduleId", "erpProductId", "erpEventSeq", "overrideTitle", "overrideImageUrl", "updatedAt"],
  join_applications: ["applicationId", "targetType", "targetScheduleId", "targetApplicationId", "targetJoinId", "targetProductKey", "erpProductId", "erpEventSeq", "productName", "scheduleSnapshotJson", "depositStatus", "quoteId", "updatedAt"],
  schedule_participant_summary: ["scheduleId", "sourceApplicationId", "title", "joinedPeople", "remainingSeats", "updatedAt"],
  join_wishes: ["wishId", "targetKey", "targetScheduleId", "targetApplicationId", "erpProductId", "erpEventSeq", "productName", "updatedAt"],
  join_reviews: ["reviewId", "targetScheduleId", "targetApplicationId", "erpProductId", "erpEventSeq", "productName", "updatedAt"],
  new_schedule_applications: ["applicationId", "scheduleId", "erpProductId", "erpEventSeq", "productName", "updatedAt"]
};

function buildSheets() {
  return {
    recommended_schedules: [{
      recommendedScheduleId: "rs-30001278-30284707",
      erpProductId: "30001278",
      erpEventSeq: "30284707",
      overrideTitle: "old title",
      overrideImageUrl: "https://example.com/30001278/old.jpg"
    }],
    join_applications: [{
      applicationId: "join_admin_keep_this_id",
      targetType: "recommended_schedule",
      targetScheduleId: "admin-recommended-rs-30001278-30284707",
      targetApplicationId: "rs-30001278-30284707",
      targetJoinId: "admin-recommended-rs-30001278-30284707",
      targetProductKey: "erp:30001278:30284707",
      erpProductId: "30001278",
      erpEventSeq: "30284707",
      productName: "old title",
      scheduleSnapshotJson: JSON.stringify({
        targetScheduleId: "admin-recommended-rs-30001278-30284707",
        erpProductId: "30001278",
        erpEventSeq: "30284707"
      }),
      depositStatus: "paid",
      quoteId: "quote_keep_this_id"
    }],
    schedule_participant_summary: [{
      scheduleId: "admin-recommended-rs-30001278-30284707",
      sourceApplicationId: "rs-30001278-30284707",
      title: "old title",
      joinedPeople: 27,
      remainingSeats: 13
    }],
    join_wishes: [{
      wishId: "wish_keep_this_id",
      targetKey: "join:admin-recommended-rs-30001278-30284707",
      targetScheduleId: "admin-recommended-rs-30001278-30284707",
      targetApplicationId: "rs-30001278-30284707",
      erpProductId: "30001278",
      erpEventSeq: "30284707",
      productName: "old title"
    }],
    join_reviews: [],
    new_schedule_applications: [],
    product_family_members: [],
    product_family_master: []
  };
}

function makePlan(overrides = {}) {
  return buildRecommendedScheduleMigrationPlan({
    sourceGoodSeq: "30001278",
    sourceEventSeq: "30284707",
    targetGoodSeq: "30001279",
    targetEventSeq: "30285966",
    targetProduct: {
      title: "[10월 월례회] 새 상품",
      image: "https://example.com/30001279/new.jpg",
      departureDate: "2026-10-04",
      returnDate: "2026-10-10",
      price: 1260000
    },
    headersBySheet,
    sheets: buildSheets(),
    now: "2026-08-04T14:00:00+09:00",
    ...overrides
  });
}

test("추천일정과 명단을 같은 행에서 새 상품 참조로 교체한다", () => {
  const plan = makePlan();
  const summary = summarizeRecommendedScheduleMigrationPlan(plan);
  assert.deepEqual(summary.counts, {
    recommended_schedules: 1,
    join_applications: 1,
    schedule_participant_summary: 1,
    join_wishes: 1
  });
  assert.equal(summary.participantCount, 1);

  const joinUpdate = plan.updates.find((item) => item.sheetName === "join_applications");
  assert.equal(joinUpdate.after.applicationId, "join_admin_keep_this_id");
  assert.equal(joinUpdate.after.quoteId, "quote_keep_this_id");
  assert.equal(joinUpdate.after.depositStatus, "paid");
  assert.equal(joinUpdate.after.targetScheduleId, "admin-recommended-rs-30001279-30285966");
  assert.equal(joinUpdate.after.targetApplicationId, "rs-30001279-30285966");
  assert.equal(joinUpdate.after.targetProductKey, "erp:30001279:30285966");
  assert.equal(JSON.parse(joinUpdate.after.scheduleSnapshotJson).erpProductId, "30001279");

  const participantSummary = plan.updates.find((item) => item.sheetName === "schedule_participant_summary");
  assert.equal(participantSummary.after.joinedPeople, 27);
  assert.equal(participantSummary.after.remainingSeats, 13);
});

test("대상 추천일정이 이미 존재하면 중복 이전을 차단한다", () => {
  const sheets = buildSheets();
  sheets.recommended_schedules.push({ recommendedScheduleId: "rs-30001279-30285966" });
  assert.throws(() => makePlan({ sheets }), /target recommended schedule already exists/);
});

test("상품군에 연결된 원본 상품은 별도 이전 없이 수정하지 않는다", () => {
  const sheets = buildSheets();
  sheets.product_family_members.push({ familyId: "family-1", goodSeq: "30001278" });
  assert.throws(
    () => makePlan({ sheets }),
    (error) => error.code === "product_family_migration_required" && error.details.memberRows === 1
  );
});

test("이미 이전된 상태에서 다시 실행하면 변경 행이 없다", () => {
  const first = makePlan();
  const sheets = buildSheets();
  first.updates.forEach((update) => {
    sheets[update.sheetName][update.rowNumber - 2] = update.after;
  });
  const second = makePlan({ sheets });
  assert.equal(second.alreadyMigrated, true);
  assert.equal(second.updates.length, 0);
});
