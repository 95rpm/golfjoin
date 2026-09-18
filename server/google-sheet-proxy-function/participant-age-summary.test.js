"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { __test } = require("./index");

test("전체 참여자 연령을 10년 단위로 집계한다", () => {
  const participants = [
    ...Array.from({ length: 31 }, () => ({ ageDisplay: "50대 후반" })),
    ...Array.from({ length: 20 }, () => ({ ageDisplay: "60대 초반" })),
    ...Array.from({ length: 6 }, () => ({ ageDisplay: "70대이상 초반" })),
    ...Array.from({ length: 2 }, () => ({ ageDisplay: "40대 중반" }))
  ];
  assert.deepEqual(__test.countParticipantSummaryAgeDecades(participants), {
    40: 2,
    50: 31,
    60: 20,
    70: 6
  });
});

test("공개 홈 응답은 안전한 연령대별 집계만 유지한다", () => {
  const payload = __test.sanitizeHomeBootstrapLightPayload({
    ok: true,
    newScheduleSummaries: [],
    participantSummaries: [{
      targetType: "recommended_schedule",
      targetScheduleId: "admin-recommended-rs-age",
      capacity: 60,
      confirmedCount: 59,
      remainingSlots: 1,
      ageDecadeCounts: { 50: 31.2, 60: 20, invalid: 999, 120: 1, 40: -2 },
      participantsPreview: []
    }],
    displayRules: [],
    wishTargetKeys: []
  });
  assert.deepEqual(payload.participantSummaries[0].ageDecadeCounts, {
    50: 31,
    60: 20
  });
});

test("이전 응답에는 참여자 미리보기로 연령대 집계를 보완한다", () => {
  const payload = __test.sanitizeHomeBootstrapLightPayload({
    ok: true,
    newScheduleSummaries: [],
    participantSummaries: [{
      targetType: "recommended_schedule",
      targetScheduleId: "admin-recommended-rs-legacy",
      capacity: 4,
      confirmedCount: 2,
      remainingSlots: 2,
      participantsPreview: [
        { ageDisplay: "60대 초반" },
        { ageDisplay: "50대 후반" }
      ]
    }],
    displayRules: [],
    wishTargetKeys: []
  });
  assert.deepEqual(payload.participantSummaries[0].ageDecadeCounts, {
    50: 1,
    60: 1
  });
});
