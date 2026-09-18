"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const acorn = require("acorn");

const ROOT = path.resolve(__dirname, "../..");
const dashboardHtml = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const dashboardSource = [...dashboardHtml.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((source) => source.includes("function distributeRecommendationFamilyOptionCapacities"));
const mainDetailSource = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
), "utf8");

function getFunctions(source, names) {
  const program = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  return names.map((name) => {
    const node = program.body.find((item) => item.type === "FunctionDeclaration" && item.id?.name === name);
    assert.ok(node, `function not found: ${name}`);
    return source.slice(node.start, node.end);
  }).join("\n");
}

test("통합 추천일정 총 정원 60명은 두 기간에 30명씩 기록한다", () => {
  const context = vm.createContext({ Number, String, Math, Array });
  vm.runInContext(getFunctions(dashboardSource, [
    "normalizeRecommendationCapacity",
    "distributeRecommendationFamilyOptionCapacities"
  ]), context);
  const result = context.distributeRecommendationFamilyOptionCapacities([
    { goodSeq: "30001287", durationLabel: "4박6일" },
    { goodSeq: "30001288", durationLabel: "7박9일" }
  ], 60);
  assert.deepEqual(Array.from(result, (option) => option.capacity), [30, 30]);
  assert.equal(result.reduce((sum, option) => sum + option.capacity, 0), 60);
});

test("나누어떨어지지 않는 정원도 합계 손실 없이 결정적으로 배분한다", () => {
  const context = vm.createContext({ Number, String, Math, Array });
  vm.runInContext(getFunctions(dashboardSource, [
    "normalizeRecommendationCapacity",
    "distributeRecommendationFamilyOptionCapacities"
  ]), context);
  const result = context.distributeRecommendationFamilyOptionCapacities([{}, {}, {}], 10);
  assert.deepEqual(Array.from(result, (option) => option.capacity), [4, 3, 3]);
});

test("통합 추천일정 저장과 정원 수정은 기간별 정원을 familyOptionsJson에 함께 저장한다", () => {
  assert.match(dashboardSource, /familyOptions\s*=\s*distributeRecommendationFamilyOptionCapacities\(familyOptions, capacity\)/);
  assert.match(dashboardSource, /familyOptionsJson:\s*JSON\.stringify\(distributeRecommendationFamilyOptionCapacities/);
  assert.match(dashboardSource, /기간별 \$\{familyOptions\.map/);
});

test("선택 기간을 반복 렌더링해도 30명 정원이 15명·8명으로 줄지 않는다", () => {
  const wrapped = `function __scope() {\n${mainDetailSource}\n}`;
  const program = acorn.parse(wrapped, { ecmaVersion: "latest", sourceType: "script" });
  const scopeBody = program.body[0].body.body;
  const node = scopeBody.find((item) => item.type === "FunctionDeclaration" && item.id?.name === "getAdminRecommendedFamilyOptions");
  assert.ok(node, "function not found: getAdminRecommendedFamilyOptions");
  const source = wrapped.slice(node.start, node.end);
  const context = vm.createContext({ Number, String, Math, Array, JSON, Set });
  vm.runInContext(source, context);
  const familyOptions = [
    { goodSeq: "30001287", eventSeq: "30286551", departureDate: "2027-01-16", returnDate: "2027-01-21", durationLabel: "4박6일", capacity: 30 },
    { goodSeq: "30001288", eventSeq: "30286552", departureDate: "2027-01-16", returnDate: "2027-01-24", durationLabel: "7박9일", capacity: 30 }
  ];
  const first = context.getAdminRecommendedFamilyOptions({ capacity: 60, familyOptions });
  const second = context.getAdminRecommendedFamilyOptions({
    capacity: 30,
    participantSummary: { capacity: 30 },
    familyOptions: first
  });
  const third = context.getAdminRecommendedFamilyOptions({
    capacity: 30,
    participantSummary: { capacity: 30 },
    familyOptions: second
  });
  assert.deepEqual(Array.from(first, (option) => option.capacity), [30, 30]);
  assert.deepEqual(Array.from(second, (option) => option.capacity), [30, 30]);
  assert.deepEqual(Array.from(third, (option) => option.capacity), [30, 30]);
});
