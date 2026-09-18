"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const SOURCE_PATH = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
);

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
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
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${functionName} body is incomplete`);
}

function loadHelpers() {
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const sandbox = { JOIN_MAX_CAPACITY: 4 };
  vm.runInNewContext(
    `${extractFunction(source, "isMonthlyRecommendationJoin")};`
      + `${extractFunction(source, "getJoinRecruitmentCapacity")};`
      + "globalThis.helpers = { isMonthlyRecommendationJoin, getJoinRecruitmentCapacity };",
    sandbox
  );
  return sandbox.helpers;
}

test("모집 정원 계산은 일정 또는 displayRule이 null이어도 기본 정원을 반환한다", () => {
  const { getJoinRecruitmentCapacity } = loadHelpers();
  assert.equal(getJoinRecruitmentCapacity(null, 4), 4);
  assert.equal(getJoinRecruitmentCapacity({ displayRule: null }, 4), 4);
  assert.equal(getJoinRecruitmentCapacity({ displayRule: { capacity: 70 } }, 4), 70);
  assert.equal(getJoinRecruitmentCapacity({ participantSummary: { capacity: 3 } }, 4), 3);
});

test("월례회 판별은 null 입력을 일반 일정으로 안전하게 처리한다", () => {
  const { isMonthlyRecommendationJoin } = loadHelpers();
  assert.equal(isMonthlyRecommendationJoin(null), false);
  assert.equal(isMonthlyRecommendationJoin({ displayRule: null }), false);
  assert.equal(isMonthlyRecommendationJoin({ scheduleType: "monthly" }), true);
  assert.equal(isMonthlyRecommendationJoin({ displayRule: { scheduleLabel: "10월 월례회" } }), true);
});

test("확정 인원 계산은 연결된 일정이 null이어도 0명을 반환한다", () => {
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const sandbox = {
    JOIN_MAX_CAPACITY: 4,
    getJoinRecruitmentCapacity(join, fallback) {
      assert.equal(join && typeof join, "object");
      assert.equal(Object.keys(join).length, 0);
      return fallback;
    },
    getConfirmedParticipants(join) {
      assert.equal(join && typeof join, "object");
      assert.equal(Object.keys(join).length, 0);
      return [];
    }
  };
  vm.runInNewContext(
    `${extractFunction(source, "getJoinAuthoritativeConfirmedCount")};`
      + "globalThis.getCount = getJoinAuthoritativeConfirmedCount;",
    sandbox
  );
  assert.equal(sandbox.getCount(null), 0);
});
