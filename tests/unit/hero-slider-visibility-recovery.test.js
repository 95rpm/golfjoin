"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
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
  throw new Error(`${name} is incomplete`);
}

const sandbox = {};
vm.runInNewContext(`
  ${extractFunction(SOURCE, "normalizeHeroRealSlideIndex")}
  globalThis.normalizeForTest = normalizeHeroRealSlideIndex;
`, sandbox);

test("백그라운드에서 복제 범위를 여러 번 지난 인덱스도 실제 슬라이드 범위로 복구한다", () => {
  assert.equal(sandbox.normalizeForTest(1, 2), 1);
  assert.equal(sandbox.normalizeForTest(2, 2), 2);
  assert.equal(sandbox.normalizeForTest(3, 2), 1);
  assert.equal(sandbox.normalizeForTest(9, 2), 1);
  assert.equal(sandbox.normalizeForTest(0, 2), 2);
});
