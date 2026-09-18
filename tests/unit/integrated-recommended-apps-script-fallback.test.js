"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const acorn = require("acorn");

const ROOT = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(ROOT, "doc/google-sheet-web-app.gs"), "utf8");
const program = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });

function getFunctionSource(name) {
  const node = program.body.find((item) => item.type === "FunctionDeclaration" && item.id?.name === name);
  assert.ok(node, `function not found: ${name}`);
  return source.slice(node.start, node.end);
}

test("Apps Script 추천일정 원본은 통합 상품군 식별값을 보존한다", () => {
  const functionSource = getFunctionSource("buildRecommendedScheduleSummarySource_");
  assert.match(functionSource, /productFamilyId:\s*rule\.productFamilyId/);
  assert.match(functionSource, /familyOptionsJson:\s*rule\.familyOptionsJson/);
});

test("Apps Script 폴백도 선택 ERP 행사별 잔여석을 계산한다", () => {
  const context = vm.createContext({ String, Math });
  context.value_ = () => "";
  context.getRecommendedFamilyOptions_ = () => [
    { goodSeq: "30001287", eventSeq: "30286551", capacity: 30 },
    { goodSeq: "30001288", eventSeq: "30286552", capacity: 30 }
  ];
  context.isCancelledJoinApplication_ = (join) => join.status === "cancelled";
  context.isJoinApplicationForSchedule_ = () => true;
  context.parsePositiveInteger_ = (value) => Number(value) || 0;
  context.parsePeople_ = (value) => Number(value) || 1;
  vm.runInContext(getFunctionSource("findRecommendedFamilyOption_"), context);
  vm.runInContext(getFunctionSource("buildRecommendedFamilyOptionCapacitySummary_"), context);
  const selected = context.findRecommendedFamilyOption_({}, {
    erpProductId: "30001288",
    erpEventSeq: "30286552"
  });
  const summary = context.buildRecommendedFamilyOptionCapacitySummary_({}, [
    { erpProductId: "30001287", erpEventSeq: "30286551", applicantPeople: "30" },
    { erpProductId: "30001288", erpEventSeq: "30286552", applicantPeople: "2" }
  ], selected);
  assert.equal(summary.capacity, 30);
  assert.equal(summary.confirmedPeople, 2);
  assert.equal(summary.remainingSeats, 28);
});

test("Apps Script 저장 검사는 통합 상품에서 기간별 요약을 사용한다", () => {
  const functionSource = getFunctionSource("getJoinApplicationCapacityError_");
  assert.match(functionSource, /findRecommendedFamilyOption_\(targetSchedule, joinRow\)/);
  assert.match(functionSource, /buildRecommendedFamilyOptionCapacitySummary_\(targetSchedule, capacityRows, selectedFamilyOption\)/);
  assert.match(functionSource, /join_schedule_option_invalid/);
});
