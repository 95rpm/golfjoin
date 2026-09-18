"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { __test } = require("./index");

function makeSummary(targetType, targetScheduleId, targetApplicationId) {
  return {
    targetType,
    targetScheduleId,
    targetApplicationId,
    erpProductId: "30001089",
    erpEventSeq: "30276903",
    capacity: 4,
    confirmedCount: 1,
    remainingSlots: 3,
    maleCount: 1,
    femaleCount: 0,
    participantsPreview: [],
    lastAppliedAt: "2026-08-12T17:00:00+09:00"
  };
}

test("공개 홈 응답은 일정 본문이 없는 새 모임 참여자 요약만 제외한다", () => {
  const payload = __test.sanitizeHomeBootstrapLightPayload({
    ok: true,
    newScheduleSummaries: [{ scheduleId: "sch_active", applicationId: "nsa_active" }],
    participantSummaries: [
      makeSummary("new_schedule", "sch_active", "nsa_active"),
      makeSummary("new_schedule", "sch_orphan", "nsa_orphan"),
      makeSummary("recommended_schedule", "admin-recommended-active", "")
    ],
    displayRules: [],
    wishTargetKeys: [],
    warnings: []
  });

  assert.deepEqual(
    payload.participantSummaries.map((item) => item.targetType),
    ["new_schedule", "recommended_schedule"]
  );
  assert.equal(payload.participantSummaries[0].targetScheduleId, "sch_active");
});

test("원천 참여자 집계도 대상 일정을 찾지 못한 행을 건너뛴다", () => {
  const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert.match(
    source,
    /const targetSchedule = findJoinApplicationTargetSchedule\(row, newSchedules, recommendedRows\);\s*if \(!targetSchedule\) return;/
  );
});
