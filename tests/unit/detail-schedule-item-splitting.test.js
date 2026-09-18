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
  ${extractFunction(SOURCE, "normalizeDetailSchedulePointText")}
  ${extractFunction(SOURCE, "splitScheduleItems")}
  ${extractFunction(SOURCE, "getDetailSchedulePoints")}
  globalThis.splitForTest = splitScheduleItems;
  globalThis.pointsForTest = getDetailSchedulePoints;
`, sandbox);

test("쉼표·및·슬래시·가운데점은 일정 항목을 새로 나누지 않는다", () => {
  const content = "공항 도착, 가이드 미팅 및 호텔/리조트 이동 · 휴식";
  assert.deepEqual(
    Array.from(sandbox.splitForTest(content)),
    [content]
  );
});

test("서버가 제공한 points 배열만 detail-schedule-point 단위로 사용한다", () => {
  assert.deepEqual(
    Array.from(sandbox.pointsForTest({
      content: "과거 합본 문구",
      points: ["인천공항 출발", "가이드 미팅\n호텔 이동"]
    })),
    ["인천공항 출발", "가이드 미팅\n호텔 이동"]
  );
});

test("과거 스냅샷의 content는 분해하지 않고 하나의 포인트로 표시한다", () => {
  assert.deepEqual(
    Array.from(sandbox.pointsForTest({ content: "공항 도착, 가이드 미팅/호텔 이동" })),
    ["공항 도착, 가이드 미팅/호텔 이동"]
  );
});

test("detail-schedule-point는 내부 줄바꿈을 보존한다", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css"), "utf8");
  assert.match(css, /\.detail-schedule-point\s*\{[^}]*white-space:\s*pre-line;/s);
});
