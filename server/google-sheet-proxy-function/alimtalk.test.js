"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseRetryDelays,
  createAlimtalkNotificationId,
  isRetryableAlimtalkError,
  isRetryableAlimtalkResult,
  runAlimtalkWithRetry
} = require("./alimtalk");

test("retry delays default to 5s, 20s and 60s", () => {
  assert.deepEqual(parseRetryDelays(""), [5000, 20000, 60000]);
  assert.deepEqual(parseRetryDelays("100,200"), [100, 200]);
});

test("notification id is deterministic and input-sensitive", () => {
  const first = createAlimtalkNotificationId(["application-1", "create", "01012345678"]);
  assert.equal(first, createAlimtalkNotificationId(["application-1", "create", "01012345678"]));
  assert.notEqual(first, createAlimtalkNotificationId(["application-1", "join", "01012345678"]));
});

test("only timeout, network and 5xx failures are retryable", () => {
  assert.equal(isRetryableAlimtalkError(new Error("upstream request timed out after 15000ms")), true);
  assert.equal(isRetryableAlimtalkError(Object.assign(new Error("rejected"), { status: 400 })), false);
  assert.equal(isRetryableAlimtalkResult({ ok: false, status: 503 }), true);
  assert.equal(isRetryableAlimtalkResult({ ok: false, status: 400, response: { code: -101 } }), false);
});

test("retries three times with 5s, 20s and 60s delays", async () => {
  const delays = [];
  let calls = 0;
  const result = await runAlimtalkWithRetry(async () => {
    calls += 1;
    if (calls < 4) throw new Error("network timeout");
    return { ok: true, status: 200 };
  }, {
    retryDelaysMs: [5000, 20000, 60000],
    sleep: async (ms) => delays.push(ms)
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 4);
  assert.equal(result.retryCount, 3);
  assert.deepEqual(delays, [5000, 20000, 60000]);
});

test("does not retry an explicit provider rejection", async () => {
  let calls = 0;
  const result = await runAlimtalkWithRetry(async () => {
    calls += 1;
    return { ok: false, status: 200, retryable: false, response: { code: -101, message: "rejected" } };
  }, { sleep: async () => assert.fail("sleep should not be called") });
  assert.equal(calls, 1);
  assert.equal(result.retryCount, 0);
});

test("retries an HTTP 5xx result and stops after a successful response", async () => {
  let attempts = 0;
  const delays = [];
  const result = await runAlimtalkWithRetry(async () => {
    attempts += 1;
    return attempts < 3
      ? { ok: false, status: 503, retryable: true }
      : { ok: true, status: 200 };
  }, {
    retryDelaysMs: [5000, 20000, 60000],
    sleep: async (delayMs) => delays.push(delayMs)
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(result.retryCount, 2);
  assert.deepEqual(delays, [5000, 20000]);
});

test("returns the final failure after all three retries are exhausted", async () => {
  const result = await runAlimtalkWithRetry(async () => {
    const error = new Error("upstream request timed out after 15000ms");
    error.name = "AbortError";
    throw error;
  }, {
    retryDelaysMs: [5000, 20000, 60000],
    sleep: async () => {}
  });

  assert.equal(result.ok, false);
  assert.equal(result.attempts, 4);
  assert.equal(result.retryCount, 3);
  assert.equal(result.retryHistory.length, 4);
});
