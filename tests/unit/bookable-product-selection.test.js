"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function extractFunction(source, functionName) {
  const declaration = `function ${functionName}`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const bodyStart = source.indexOf(") {", start) + 2;
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
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

function createSelector(activeSchedules) {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = extractFunction(html, "selectGolfJoinBookableProduct");
  const counters = { activeReads: 0, rangeReads: 0 };
  const sandbox = {
    isGolfJoinBookableProductEvent: (product) => product.bookable !== false,
    getActiveJoinMySchedules() {
      counters.activeReads += 1;
      return activeSchedules;
    },
    normalizeJoinScheduleRange(product) {
      counters.rangeReads += 1;
      return product.range || null;
    },
    doJoinScheduleRangesOverlap(left, right) {
      return left.start <= right.end && right.start <= left.end;
    },
    selectGolfJoinProductGroupRepresentative(products) {
      return products[0] || null;
    }
  };
  vm.runInNewContext(`${source}\nglobalThis.selectForTest = selectGolfJoinBookableProduct;`, sandbox);
  return { select: sandbox.selectForTest, counters };
}

test("bookable selection skips per-product overlap work when the member has no active schedules", () => {
  const { select, counters } = createSelector([]);
  const products = Array.from({ length: 267 }, (_, index) => ({ id: index, range: { start: index, end: index + 1 } }));
  const selected = select(products, { avoidActiveScheduleOverlap: true });
  assert.equal(selected.id, 0);
  assert.equal(counters.activeReads, 1);
  assert.equal(counters.rangeReads, 0);
});

test("bookable selection preserves overlap exclusion and fallback semantics", () => {
  const active = [{ range: { start: 10, end: 20 } }];
  const firstRun = createSelector(active);
  const selected = firstRun.select([
    { id: "overlap", range: { start: 12, end: 13 } },
    { id: "clear", range: { start: 30, end: 31 } }
  ], { avoidActiveScheduleOverlap: true });
  assert.equal(selected.id, "clear");
  assert.equal(firstRun.counters.activeReads, 1);

  const fallbackRun = createSelector(active);
  const fallback = fallbackRun.select([
    { id: "first-overlap", range: { start: 12, end: 13 } },
    { id: "second-overlap", range: { start: 15, end: 16 } }
  ], { avoidActiveScheduleOverlap: true });
  assert.equal(fallback.id, "first-overlap");
});
