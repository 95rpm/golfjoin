"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sourcePath = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
);
const source = fs.readFileSync(sourcePath, "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing function: ${name}`);
  const signatureEnd = source.indexOf(") {", start);
  assert.ok(signatureEnd > start, `missing function signature: ${name}`);
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
  throw new Error(`incomplete function: ${name}`);
}

const context = vm.createContext({
  JOIN_MAX_CAPACITY: 60,
  getConfirmedParticipants(join) {
    return Array.isArray(join.participants)
      ? join.participants.filter((participant) => participant.status === "confirmed")
      : [];
  },
  getJoinRecruitmentCapacity(join) {
    return Number(join.capacity || join.maxCapacity || 60);
  }
});

vm.runInContext([
  extractFunction("getJoinAuthoritativeConfirmedCount"),
  extractFunction("getMonthlyCardParticipantCount")
].join("\n"), context);

test("최초 화면의 0명 임시값이 실제 59명 집계를 가리지 않는다", () => {
  const count = context.getMonthlyCardParticipantCount({
    participantSummary: null,
    lightSummary: null,
    confirmedCount: 0,
    currentCount: 59,
    participantCount: 0,
    capacity: 60,
    participants: []
  });
  assert.equal(count, 59);
});

test("참여자 요약이 도착하면 동일한 실제 인원수를 유지한다", () => {
  const count = context.getMonthlyCardParticipantCount({
    participantSummary: { confirmedCount: 59 },
    confirmedCount: 0,
    currentCount: 59,
    capacity: 60,
    participants: []
  });
  assert.equal(count, 59);
});

test("참여 인원은 모집 정원을 초과해 표시하지 않는다", () => {
  const count = context.getMonthlyCardParticipantCount({
    currentCount: 61,
    capacity: 60,
    participants: []
  });
  assert.equal(count, 60);
});
