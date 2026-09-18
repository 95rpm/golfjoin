"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

test("schedule mutations return sanitized current snapshots and a revision", () => {
  assert.match(source, /function buildPublicMutationSnapshots\(/);
  assert.match(source, /sanitizeHomeBootstrapLightPayload\(\{/);
  assert.match(source, /scheduleSummary: participantSummarySync\.scheduleSummary \|\| null/);
  assert.match(source, /participantSummary: participantSummarySync\.participantSummary \|\| null/);
  assert.match(source, /mutationRevision: participantSummarySync\.mutationRevision/);
});

test("a committed write with failed participant synchronization cannot fall back", () => {
  assert.match(source, /code: "participant_summary_sync_failed"/);
  assert.match(source, /writeCommitted: true/);
  assert.match(source, /if \(error\?\.writeCommitted \|\| error\?\.code === "participant_summary_sync_failed"\) throw error/);
  assert.match(source, /isJoinScheduleFullError\(error\)[\s\S]{0,120}\|\| error\?\.writeCommitted/);
});

test("error responses preserve committed-write recovery identifiers", () => {
  assert.match(source, /error\.applicationId \? \{ applicationId: error\.applicationId \}/);
  assert.match(source, /error\.scheduleId \? \{ scheduleId: error\.scheduleId \}/);
  assert.match(source, /error\.mutationRevision \? \{ mutationRevision: error\.mutationRevision \}/);
  assert.match(source, /participantSummarySync: error\.participantSummarySync/);
});

test("same application IDs are serialized by an atomic storage lock", () => {
  assert.match(source, /async function acquireApplicationMutationLock\(/);
  assert.match(source, /application-locks\/\$\{sha256\(normalizedApplicationId\)\}\.lock/);
  assert.match(source, /preconditionOpts: \{ ifGenerationMatch: 0 \}/);
  assert.match(source, /code: "application_mutation_in_progress"/);
  assert.match(source, /withApplicationMutationLock\(\s*applicationId,/);
});
