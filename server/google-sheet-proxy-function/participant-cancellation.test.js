"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { __test } = require("./index");

function makeCreator(overrides = {}) {
  return {
    applicationId: "nsa_creator",
    scheduleId: "schedule_1",
    applicantName: "생성자",
    applicantPeople: "1",
    applicationStatus: "confirmed",
    approvalStatus: "approved",
    displayStatus: "visible",
    ...overrides
  };
}

function makeJoin(overrides = {}) {
  return {
    applicationId: "join_1",
    targetType: "new_schedule",
    targetScheduleId: "schedule_1",
    targetApplicationId: "nsa_creator",
    applicantName: "참여자",
    applicantPeople: "1",
    participantStatus: "신청",
    applicationStatus: "confirmed",
    ...overrides
  };
}

test("마지막 활성 생성자를 취소하면 일정 전체가 취소된다", () => {
  const creator = makeCreator();
  const decision = __test.buildAdminParticipantCancellationDecision(
    creator,
    [],
    creator,
    "new_schedule_applications"
  );
  assert.equal(decision.remainingActivePeople, 0);
  assert.equal(decision.scheduleCancelled, true);
  assert.equal(decision.adminOperated, false);
});

test("다른 참여자가 남은 생성자 취소는 일정 유지와 관리자 운영으로 판정한다", () => {
  const creator = makeCreator();
  const decision = __test.buildAdminParticipantCancellationDecision(
    creator,
    [makeJoin()],
    creator,
    "new_schedule_applications"
  );
  assert.equal(decision.remainingActivePeople, 1);
  assert.equal(decision.scheduleCancelled, false);
  assert.equal(decision.adminOperated, true);
});

test("참여자 한 명을 취소해도 활성 생성자가 남으면 일정은 유지된다", () => {
  const creator = makeCreator();
  const join = makeJoin();
  const decision = __test.buildAdminParticipantCancellationDecision(
    creator,
    [join],
    join,
    "join_applications"
  );
  assert.equal(decision.remainingActivePeople, 1);
  assert.equal(decision.scheduleCancelled, false);
  assert.equal(decision.creatorCancelled, false);
});

test("입금 이력이 있을 때만 환불대기로 분기한다", () => {
  assert.equal(__test.getParticipantCancellationRefundStatus({}), "not_required");
  assert.equal(__test.getParticipantCancellationRefundStatus({ depositStatus: "unpaid" }), "not_required");
  assert.equal(__test.getParticipantCancellationRefundStatus({ depositStatus: "paid" }), "requested");
  assert.equal(__test.getParticipantCancellationRefundStatus({ balanceStatus: "입금완료" }), "requested");
});

test("취소·숨김 일정은 공개 응답에서 제거되고 참여 불가로 판정된다", () => {
  const payload = __test.sanitizeHomeBootstrapLightPayload({
    ok: true,
    newScheduleSummaries: [
      { scheduleId: "active", applicationId: "active-app", approvalStatus: "approved", displayStatus: "visible" },
      { scheduleId: "cancelled", applicationId: "cancelled-app", approvalStatus: "cancelled", displayStatus: "hidden" }
    ],
    participantSummaries: [
      { targetType: "new_schedule", targetScheduleId: "active" },
      { targetType: "new_schedule", targetScheduleId: "cancelled" }
    ]
  });
  assert.deepEqual(payload.newScheduleSummaries.map((item) => item.scheduleId), ["active"]);
  assert.deepEqual(payload.participantSummaries.map((item) => item.targetScheduleId), ["active"]);
  assert.equal(__test.isScheduleUnavailableForJoin({ applicationStatus: "cancelled" }), true);
  assert.equal(__test.isScheduleUnavailableForJoin({ displayStatus: "hidden" }), true);
  assert.equal(__test.isPublicNewScheduleRow({ applicationStatus: "confirmed", displayStatus: "visible" }), true);
});
