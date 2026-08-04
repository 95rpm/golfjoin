"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EXPECTED_MIGRATION_KEY,
  parseYamlScalar,
  assertDryRun
} = require("./recommended-schedule-migrate-cli");

test("env yaml에서 관리자 토큰을 출력 없이 읽는다", () => {
  assert.equal(parseYamlScalar("ADMIN_READ_TOKEN: 'secret-token'\n", "ADMIN_READ_TOKEN"), "secret-token");
  assert.equal(parseYamlScalar('ADMIN_READ_TOKEN: "secret-token"\n', "ADMIN_READ_TOKEN"), "secret-token");
});

test("드라이런은 추천일정 1건, 명단 27건, 요약 1건만 허용한다", () => {
  assert.doesNotThrow(() => assertDryRun({
    migration: {
      migrationKey: EXPECTED_MIGRATION_KEY,
      counts: {
        recommended_schedules: 1,
        join_applications: 27,
        schedule_participant_summary: 1
      }
    }
  }));
  assert.throws(() => assertDryRun({
    migration: {
      migrationKey: EXPECTED_MIGRATION_KEY,
      counts: {
        recommended_schedules: 1,
        join_applications: 26,
        schedule_participant_summary: 1
      }
    }
  }), /Expected 27 participant rows/);
});
