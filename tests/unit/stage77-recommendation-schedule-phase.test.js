const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = dashboard.indexOf(marker);
  assert.notEqual(start, -1, `${name} 함수가 있어야 합니다.`);
  const signatureEnd = dashboard.indexOf("\n", start);
  const braceStart = dashboard.lastIndexOf("{", signatureEnd);
  let depth = 0;
  for (let index = braceStart; index < dashboard.length; index += 1) {
    if (dashboard[index] === "{") depth += 1;
    if (dashboard[index] === "}") depth -= 1;
    if (depth === 0) return dashboard.slice(start, index + 1);
  }
  throw new Error(`${name} 함수 끝을 찾지 못했습니다.`);
}

test("v77 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const scripts = [...dashboard.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  assert.equal(scripts.length, 1);
  scripts.forEach((script) => assert.doesNotThrow(() => new vm.Script(script)));
});

test("v77 추천일정은 출발일이 오늘보다 이전이면 종료로 판정한다", () => {
  const context = {
    asText: (value) => String(value ?? "").trim(),
    findProductForDisplayRule: () => ({}),
    parseRecommendationFamilyOptions: (value) => JSON.parse(value || "[]"),
    getRecommendationTodayISO: () => "2026-01-24"
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction("getRecommendationRuleStartISO"),
    extractFunction("getRecommendationRuleEndISO"),
    extractFunction("getRecommendationRulePhase"),
    "this.getStart = getRecommendationRuleStartISO; this.getEnd = getRecommendationRuleEndISO; this.getPhase = getRecommendationRulePhase;"
  ].join("\n"), context);

  const rule = {
    displayStartAt: "2026-01-23",
    displayEndAt: "2026-01-21",
    familyOptionsJson: JSON.stringify([
      { departureDate: "2026-01-23", returnDate: "2026-01-21" },
      { departureDate: "2026-01-23", returnDate: "2026-01-24" }
    ])
  };
  assert.equal(context.getStart(rule), "2026-01-23");
  assert.equal(context.getEnd(rule), "2026-01-24");
  assert.equal(context.getPhase(rule, "2026-01-24"), "ended");
  assert.equal(context.getPhase({ displayStartAt: "2026-01-24" }, "2026-01-24"), "ongoing");
  assert.equal(context.getPhase({ displayStartAt: "2026-01-25" }, "2026-01-24"), "ongoing");
});

test("v77 추천일정 상단에 진행 중·종료 건수와 상태 필터를 제공한다", () => {
  assert.match(dashboard, /\["진행 중인 일정", ongoingCount, "ongoing"\]/);
  assert.match(dashboard, /\["종료된 일정", endedCount, "ended"\]/);
  assert.match(dashboard, /data-recommendation-metric-filter=/);
  assert.match(dashboard, /recommendationSchedulePhase === filter/);
});

test("v77 상태 목록은 상품 후보와 독립적으로 등록된 추천일정을 표시한다", () => {
  assert.match(dashboard, /renderRecommendationStatusView\(phaseRules, recommendationPhase\)/);
  assert.match(dashboard, /sortedRules\.map\(renderRecommendationRegisteredItem\)/);
  assert.match(dashboard, /data-action="recommendation-show-candidates"/);
  assert.doesNotMatch(dashboard, /class="recommendation-status-view-title"/);
  assert.doesNotMatch(dashboard, /class="recommendation-manager-status"/);
});

test("v77 진행 중·종료 상태는 상단 필터로만 구분하고 목록에서 반복하지 않는다", () => {
  assert.match(dashboard, /getRecommendationRulePhase\(rule\) !== recommendationPhase/);
  assert.doesNotMatch(dashboard, /class="recommendation-status-badge/);
});
