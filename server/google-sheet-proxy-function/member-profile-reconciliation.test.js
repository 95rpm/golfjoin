"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPendingReconciliationFields,
  buildCompletedReconciliationFields,
  buildFailedReconciliationFields,
  isPendingReconciliation,
  isReconciliationRetryDue,
  canCommitReconciliationResult
} = require("./member-profile-reconciliation");

const now = "2026-09-02T10:00:00+09:00";
const revision = "2026-09-02T10:00:00+09:00-abcdef12";

test("신규 후속 동기화는 재시도 가능한 pending 상태로 기록한다", () => {
  const fields = buildPendingReconciliationFields({ now, revision });
  assert.equal(fields.reconciliationState, "pending");
  assert.equal(fields.reconciliationRevision, revision);
  assert.equal(fields.reconciliationAttempts, 0);
  assert.equal(fields.reconciliationErrorCode, "");
  assert.equal(isPendingReconciliation(fields), true);
  assert.equal(isReconciliationRetryDue(fields, Date.parse(now)), true);
});

test("동일 작업 버전만 완료 상태로 바꿀 수 있다", () => {
  const pending = buildPendingReconciliationFields({ now, revision });
  assert.equal(canCommitReconciliationResult(pending, revision), true);
  assert.equal(buildCompletedReconciliationFields(pending, {
    revision: "stale-revision",
    now
  }), null);
  const completed = buildCompletedReconciliationFields(pending, { revision, now });
  assert.equal(completed.reconciliationState, "done");
  assert.equal(completed.reconciliationRevision, revision);
  assert.equal(isPendingReconciliation(completed), false);
});

test("실패 시 PII가 아닌 정규화된 오류 코드와 재시도 정보를 남긴다", () => {
  const pending = {
    ...buildPendingReconciliationFields({ now, revision }),
    reconciliationAttempts: "2"
  };
  const failed = buildFailedReconciliationFields(pending, {
    revision,
    now: "2026-09-02T10:01:00+09:00",
    nextAt: "2026-09-02T10:06:00+09:00",
    errorCode: "Google Sheets 503 / member 010-1234-5678"
  });
  assert.equal(failed.reconciliationState, "pending");
  assert.equal(failed.reconciliationAttempts, 3);
  assert.equal(failed.reconciliationNextAt, "2026-09-02T10:06:00+09:00");
  assert.equal(failed.reconciliationErrorCode, "application_sync_failed");
  assert.equal(isReconciliationRetryDue(failed, Date.parse("2026-09-02T10:05:00+09:00")), false);
  assert.equal(isReconciliationRetryDue(failed, Date.parse("2026-09-02T10:06:00+09:00")), true);
});

test("새 저장이 만든 다른 작업 버전에는 이전 결과를 덮어쓰지 않는다", () => {
  const latest = buildPendingReconciliationFields({
    now: "2026-09-02T10:02:00+09:00",
    revision: "newer-revision"
  });
  assert.equal(buildFailedReconciliationFields(latest, {
    revision,
    now,
    errorCode: "timeout"
  }), null);
  assert.equal(canCommitReconciliationResult(latest, revision), false);
});
