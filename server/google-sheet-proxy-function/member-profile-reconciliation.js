"use strict";

const RECONCILIATION_STATE_PENDING = "pending";
const RECONCILIATION_STATE_DONE = "done";

function text(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeAttempts(value) {
  const attempts = Number.parseInt(value, 10);
  return Number.isFinite(attempts) && attempts > 0 ? attempts : 0;
}

function normalizeErrorCode(value) {
  const valueText = text(value);
  if (!/^[a-z][a-z0-9_-]{0,79}$/i.test(valueText)) return "application_sync_failed";
  return valueText.toLowerCase();
}

function buildPendingReconciliationFields(options = {}) {
  const now = text(options.now);
  const revision = text(options.revision) || now;
  if (!revision) throw new TypeError("reconciliation revision is required");
  return {
    reconciliationState: RECONCILIATION_STATE_PENDING,
    reconciliationRevision: revision,
    reconciliationAttempts: 0,
    reconciliationNextAt: "",
    reconciliationErrorCode: "",
    reconciliationUpdatedAt: now || revision
  };
}

function isPendingReconciliation(row = {}) {
  return text(row.reconciliationState).toLowerCase() === RECONCILIATION_STATE_PENDING
    && Boolean(text(row.reconciliationRevision));
}

function isReconciliationRetryDue(row = {}, nowMs = Date.now()) {
  if (!isPendingReconciliation(row)) return false;
  const nextAtMs = Date.parse(text(row.reconciliationNextAt));
  return !Number.isFinite(nextAtMs) || nextAtMs <= Number(nowMs);
}

function canCommitReconciliationResult(row = {}, revision = "") {
  return isPendingReconciliation(row)
    && text(row.reconciliationRevision) === text(revision);
}

function buildCompletedReconciliationFields(row = {}, options = {}) {
  if (!canCommitReconciliationResult(row, options.revision)) return null;
  return {
    reconciliationState: RECONCILIATION_STATE_DONE,
    reconciliationRevision: text(options.revision),
    reconciliationAttempts: normalizeAttempts(row.reconciliationAttempts),
    reconciliationNextAt: "",
    reconciliationErrorCode: "",
    reconciliationUpdatedAt: text(options.now)
  };
}

function buildFailedReconciliationFields(row = {}, options = {}) {
  if (!canCommitReconciliationResult(row, options.revision)) return null;
  return {
    reconciliationState: RECONCILIATION_STATE_PENDING,
    reconciliationRevision: text(options.revision),
    reconciliationAttempts: normalizeAttempts(row.reconciliationAttempts) + 1,
    reconciliationNextAt: text(options.nextAt),
    reconciliationErrorCode: normalizeErrorCode(options.errorCode),
    reconciliationUpdatedAt: text(options.now)
  };
}

module.exports = {
  RECONCILIATION_STATE_PENDING,
  RECONCILIATION_STATE_DONE,
  buildPendingReconciliationFields,
  buildCompletedReconciliationFields,
  buildFailedReconciliationFields,
  isPendingReconciliation,
  isReconciliationRetryDue,
  canCommitReconciliationResult,
  normalizeErrorCode
};
