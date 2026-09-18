"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
), "utf8");

function functionSource(name, nextMarker) {
  const startMarker = `function ${name}`;
  const start = SOURCE.indexOf(startMarker);
  const end = SOURCE.indexOf(nextMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing function: ${name}`);
  assert.ok(end > start, `missing end marker: ${nextMarker}`);
  return SOURCE.slice(start, end);
}

function makeParticipants(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `participant-${index + 1}`,
    status: "confirmed"
  }));
}

test("추천일정 상품 보정은 같은 일정의 권위 참여 요약을 지우지 않는다", () => {
  const scheduleId = "admin-recommended-rs-30001279-30285966";
  const sourceApplicationId = "rs-30001279-30285966";
  const participants = makeParticipants(59);
  const context = vm.createContext({
    joins: [{
      id: scheduleId,
      scheduleId,
      sourceApplicationId,
      erpProductId: "30001279",
      erpEventSeq: "30285966",
      isAdminRecommendedSchedule: true,
      participants,
      participantSummary: { confirmedCount: 59, remainingSlots: 1 },
      maxCapacity: 60,
      emptySlots: 1,
      image: ""
    }],
    normalizeAdminRecommendedScheduleRule: () => ({
      id: scheduleId,
      scheduleId,
      sourceApplicationId,
      erpProductId: "30001279",
      erpEventSeq: "30285966",
      isAdminRecommendedSchedule: true,
      participants: [],
      maxCapacity: 60,
      emptySlots: 60,
      image: "https://example.test/hydrated.jpg",
      displayOrder: 1
    }),
    reconcileAdminRecommendedProducts: () => {}
  });

  vm.runInContext(functionSource(
    "applyAdminRecommendedScheduleRows(rows = [], options = {})",
    "async function hydrateAdminRecommendedSchedulesFromGoogleSheet()"
  ), context);

  vm.runInContext("applyAdminRecommendedScheduleRows([{}], { reconcileProducts: false })", context);
  const result = context.joins[0];
  assert.equal(result.image, "https://example.test/hydrated.jpg");
  assert.equal(result.participantSummary.confirmedCount, 59);
  assert.equal(result.participants.length, 59);
  assert.equal(result.emptySlots, 1);
});

test("다른 ERP 행사로 바뀐 추천일정에는 이전 참여 요약을 승계하지 않는다", () => {
  const scheduleId = "admin-recommended-rs-shared";
  const context = vm.createContext({
    joins: [{
      id: scheduleId,
      sourceApplicationId: "rs-shared",
      erpProductId: "30001279",
      erpEventSeq: "30285966",
      isAdminRecommendedSchedule: true,
      participants: makeParticipants(59),
      participantSummary: { confirmedCount: 59, remainingSlots: 1 },
      emptySlots: 1
    }],
    normalizeAdminRecommendedScheduleRule: () => ({
      id: scheduleId,
      sourceApplicationId: "rs-shared",
      erpProductId: "30009999",
      erpEventSeq: "30999999",
      isAdminRecommendedSchedule: true,
      participants: [],
      emptySlots: 60,
      displayOrder: 1
    }),
    reconcileAdminRecommendedProducts: () => {}
  });

  vm.runInContext(functionSource(
    "applyAdminRecommendedScheduleRows(rows = [], options = {})",
    "async function hydrateAdminRecommendedSchedulesFromGoogleSheet()"
  ), context);

  vm.runInContext("applyAdminRecommendedScheduleRows([{}], { reconcileProducts: false })", context);
  const result = context.joins[0];
  assert.equal(result.participantSummary, undefined);
  assert.equal(result.participants.length, 0);
  assert.equal(result.emptySlots, 60);
});
