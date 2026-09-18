"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const DETAIL_SOURCE = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");
const HOME_SOURCE = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/data/35-home-bootstrap.js"), "utf8");

function extractFunction(source, functionName) {
  const declaration = `${source.includes(`async function ${functionName}`) ? "async " : ""}function ${functionName}`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const signatureEnd = source.indexOf(") {", start);
  assert.notEqual(signatureEnd, -1, `${functionName} signature not found`);
  const bodyStart = signatureEnd + 2;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (["\"", "'", "`"].includes(character)) {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

test("a manual retry reuses the first application and schedule IDs", () => {
  const storage = new Map();
  const sandbox = {
    Date,
    PENDING_SCHEDULE_MUTATION_STORAGE_KEY: "pending",
    PENDING_SCHEDULE_MUTATION_TTL_MS: 24 * 60 * 60 * 1000,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    },
    getNestedValue(object, keyPath) {
      return String(keyPath).split(".").reduce((value, key) => value?.[key], object) ?? "";
    },
    toBuilderApplicationArray(value) { return Array.isArray(value) ? value : String(value || "").split(",").filter(Boolean); },
    buildGoogleSheetRecordId(prefix, value) { return `${prefix}_${value}`; },
    golfJoinSafeWarn() {}
  };
  const functions = [
    "getScheduleMutationOperationKey",
    "readPendingScheduleMutations",
    "writePendingScheduleMutations",
    "stabilizeScheduleMutationPayload",
    "clearPendingScheduleMutation"
  ].map((name) => extractFunction(DETAIL_SOURCE, name)).join("\n");
  vm.runInNewContext(`${functions}; globalThis.stabilize = stabilizeScheduleMutationPayload; globalThis.clearPending = clearPendingScheduleMutation;`, sandbox);
  const base = {
    applicationId: "nsa_first",
    scheduleId: "sch_first",
    submittedAt: "2026-08-12T10:00:00+09:00",
    member: { memberKey: "seq:1" },
    trip: { erpProductId: "30001104", erpEventSeq: "30285494", departureDates: ["2026-09-01"] }
  };
  const first = sandbox.stabilize(base, "builder");
  const retry = sandbox.stabilize({
    ...base,
    applicationId: "nsa_second",
    scheduleId: "sch_second",
    submittedAt: "2026-08-12T10:01:00+09:00"
  }, "builder");
  assert.equal(first.applicationId, "nsa_first");
  assert.equal(retry.applicationId, "nsa_first");
  assert.equal(retry.scheduleId, "sch_first");
  sandbox.clearPending(retry, "builder");
  const afterSuccess = sandbox.stabilize({ ...base, applicationId: "nsa_third", scheduleId: "sch_third" }, "builder");
  assert.equal(afterSuccess.applicationId, "nsa_third");
});

test("snapshots older than a successful mutation cannot overwrite it", () => {
  const sandbox = { Date, scheduleMutationWatermarks: new Map(), getNestedValue(object, keyPath) {
    return String(keyPath).split(".").reduce((value, key) => value?.[key], object) ?? "";
  } };
  const functions = [
    "getScheduleMutationIdentityKeys",
    "getScheduleMutationRevisionTime",
    "recordScheduleMutationWatermark",
    "shouldApplyScheduleMutationSnapshot"
  ].map((name) => extractFunction(DETAIL_SOURCE, name)).join("\n");
  vm.runInNewContext(`${functions}; globalThis.record = recordScheduleMutationWatermark; globalThis.shouldApply = shouldApplyScheduleMutationSnapshot;`, sandbox);
  sandbox.record({ scheduleId: "sch_1" }, "2026-08-12T10:00:10+09:00");
  assert.equal(sandbox.shouldApply({ scheduleId: "sch_1", updatedAt: "2026-08-12T10:00:09+09:00" }), false);
  assert.equal(sandbox.shouldApply({ scheduleId: "sch_1", updatedAt: "2026-08-12T10:00:10+09:00" }), true);
});

test("client retries the exact same payload and invalidates pre-mutation reads", () => {
  assert.match(DETAIL_SOURCE, /saveScheduleMutationWithRetry\(\s*saveBuilderApplyToGoogleSheet,\s*payload/);
  assert.match(DETAIL_SOURCE, /saveScheduleMutationWithRetry\(\s*saveJoinApplyToGoogleSheet,\s*applyPayload/);
  assert.match(DETAIL_SOURCE, /homeBootstrapLightRequestGeneration \+= 1/);
  assert.match(DETAIL_SOURCE, /invalidateJoinPrivateRequests\(\)/);
  assert.match(DETAIL_SOURCE, /filter\(shouldApplyScheduleMutationSnapshot\)/);
  assert.match(DETAIL_SOURCE, /preserveRecentLocal: true/);
  assert.match(HOME_SOURCE, /const requestGeneration = \+\+homeBootstrapLightRequestGeneration/);
  assert.match(HOME_SOURCE, /requestGeneration !== homeBootstrapLightRequestGeneration/);
});
