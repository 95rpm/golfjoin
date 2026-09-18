"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ASSET_PATTERN,
  executedRanges,
  mergeRanges,
  summarizeEntry
} = require("../../tools/golfjoin-main/measure-stage13-coverage");

test("coverage 범위는 겹치거나 맞닿은 구간을 한 번만 계산한다", () => {
  assert.deepEqual(
    mergeRanges([
      { start: 8, end: 12 },
      { start: 0, end: 4 },
      { start: 3, end: 9 },
      { start: 20, end: 20 }
    ]),
    [{ start: 0, end: 12 }]
  );
});

test("외부 자산 coverage는 전체와 실행 바이트를 구분한다", () => {
  const result = summarizeEntry({
    url: "https://storage.googleapis.com/golfjoin-bucket/web/home-assets/gha_test/golfjoin-main.js",
    text: "0123456789",
    ranges: [{ start: 1, end: 4 }, { start: 6, end: 8 }]
  });
  assert.equal(result.rawBytes, 10);
  assert.equal(result.coveredBytes, 5);
  assert.equal(result.coveredPercent, 50);
  assert.ok(result.rawGzipBytes > 0);
  assert.ok(result.coveredGzipApproxBytes > 0);
  assert.match(result.url, ASSET_PATTERN);
});

test("JavaScript coverage의 source 필드도 계산한다", () => {
  const result = summarizeEntry({
    url: "https://storage.googleapis.com/golfjoin-bucket/web/home-assets/gha_test/golfjoin-main.js",
    source: "function boot(){return true;} boot();",
    ranges: [{ start: 0, end: 15 }]
  });
  assert.ok(result.rawBytes > 15);
  assert.equal(result.coveredBytes, 15);
});

test("coverage offset은 한글이 있어도 문자열 위치와 UTF-8 바이트를 정확히 계산한다", () => {
  const result = summarizeEntry({
    url: "https://storage.googleapis.com/golfjoin-bucket/web/home-assets/gha_test/golfjoin-main.css",
    text: "가나다abcdef",
    ranges: [{ start: 1, end: 4 }]
  }, { includeRanges: true });
  assert.equal(result.rawBytes, 15);
  assert.equal(result.coveredBytes, 7);
  assert.deepEqual(result.ranges, [{ start: 1, end: 4 }]);
});

test("V8 precise coverage에서 실제 실행된 범위만 고른다", () => {
  assert.deepEqual(executedRanges([
    { ranges: [{ startOffset: 0, endOffset: 30, count: 1 }] },
    { ranges: [{ startOffset: 5, endOffset: 10, count: 0 }] },
    { ranges: [{ startOffset: 10, endOffset: 20, count: 2 }] }
  ]), [
    { start: 0, end: 5 },
    { start: 10, end: 30 }
  ]);
});
