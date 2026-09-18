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

test("상세 일정 일차 이동은 내비게이션의 현재 위치가 아닌 최종 sticky 높이를 사용한다", () => {
  const sandbox = {
    getComputedStyle() {
      return { top: "52px" };
    }
  };

  vm.runInNewContext(`
    ${extractFunction(SOURCE, "getDetailScheduleDayScrollOffset")}
    globalThis.offsetForTest = getDetailScheduleDayScrollOffset;
  `, sandbox);

  const navBeforeSticky = {
    offsetHeight: 54,
    getBoundingClientRect() { return { top: 480, bottom: 534, height: 54 }; }
  };
  const navAfterSticky = {
    offsetHeight: 54,
    getBoundingClientRect() { return { top: 52, bottom: 106, height: 54 }; }
  };

  assert.equal(sandbox.offsetForTest(navBeforeSticky), 118);
  assert.equal(sandbox.offsetForTest(navAfterSticky), 118);
  assert.match(SOURCE, /targetRect\.top - detailRect\.top - stickyOffset/);
  assert.doesNotMatch(SOURCE, /const anchorBottom = navRect \? navRect\.bottom/);
});
