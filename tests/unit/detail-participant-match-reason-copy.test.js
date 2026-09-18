const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const detailSource = fs.readFileSync(
  path.join(__dirname, "../../src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);

const reasonBlockStart = detailSource.indexOf("function getDetailMatchStyleLabel");
const reasonBlockEnd = detailSource.indexOf("function renderDetailTravelMatchReasons");

assert.ok(reasonBlockStart >= 0, "match reason source start should exist");
assert.ok(reasonBlockEnd > reasonBlockStart, "match reason source end should exist");

const reasonBlock = detailSource.slice(reasonBlockStart, reasonBlockEnd);

function calculateScenario({ member = {}, join = {}, participants = [] } = {}) {
  const context = {
    currentMember: member,
    join,
    participants,
    result: null
  };
  vm.runInNewContext(`
    function getDetailCurrentMemberForMatch() { return currentMember; }
    function getDetailParticipantAverage(values = []) {
      const valid = values.filter((value) => Number.isFinite(value) && value > 0);
      return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
    }
    function getDetailParticipantAgeDecadeV2(participant = {}) {
      return Number.isFinite(participant.ageDecade) ? participant.ageDecade : null;
    }
    function getDetailParticipantScoreValueV2(participant = {}) {
      return Number(participant.score || 0);
    }
    function getDetailMemberAgeDecadeForMatch(member = {}) {
      return Number.isFinite(member.ageDecade) ? member.ageDecade : null;
    }
    function getDetailMemberScoreForMatch(member = {}) {
      return Number(member.score || 0);
    }
    function getDetailMemberStyleTokens(member = {}) {
      return Array.isArray(member.styles) ? member.styles : [];
    }
    function normalizeDetailMatchTokens(value) {
      return [].concat(Array.isArray(value) ? value : String(value || "").split(/[,\\n/·|]+/)).map((item) => String(item || "").trim()).filter(Boolean);
    }
    function isMonthlyRecommendationJoin(join = {}) { return Boolean(join.monthly); }
    function clampDetailTravelMatchScore(score) { return Math.max(68, Math.min(96, Math.round(Number(score) || 72))); }
    ${reasonBlock}
    result = calculateDetailTravelMatch(join, participants);
  `, context);
  return JSON.parse(JSON.stringify(context.result));
}

test("공통 스타일·연령·타수가 있으면 참여 경험을 설명하는 문구를 최대 세 개 표시한다", () => {
  const result = calculateScenario({
    member: { styles: ["친목중심"], ageDecade: 50, score: 92 },
    join: { departureDate: "2026-10-01", returnDate: "2026-10-05", price: 1000000 },
    participants: [
      { styles: ["친목중심"], ageDecade: 50, score: 94 },
      { styles: ["매너중시"], ageDecade: 60, score: 96 }
    ]
  });

  assert.deepEqual(result.reasons, [
    "친목 중심으로 즐기려는 멤버들이 모였어요",
    "60대 중심이라 편안하게 대화하기 좋아요",
    "100대 타수 중심이라 라운딩 속도가 비슷해요"
  ]);
});

test("추가정보가 없는 월례회 명단은 참여자 연령과 단체 일정 사실만 안내한다", () => {
  const result = calculateScenario({
    member: {},
    join: { monthly: true },
    participants: [
      { ageDecade: 50 },
      { ageDecade: 50 },
      { ageDecade: 60 }
    ]
  });

  assert.deepEqual(result.reasons, [
    "50대 중심의 멤버들과 함께하는 월례회 일정이에요",
    "여러 멤버가 함께하는 월례회라 처음 참여해도 자연스럽게 어울리기 좋아요"
  ]);
});

test("추가정보가 없는 일반 일정은 단체 합류 장벽을 낮추는 문구를 표시한다", () => {
  const result = calculateScenario({
    member: {},
    join: {},
    participants: [{ ageDecade: 40 }]
  });

  assert.deepEqual(result.reasons, [
    "40대 중심의 멤버들과 함께하는 일정이에요",
    "여러 멤버가 함께하는 단체 일정이라 처음 참여해도 자연스럽게 어울리기 좋아요"
  ]);
});

test("이용자와 연령대가 달라도 추가정보가 없는 월례회 명단은 참여자 연령을 사실대로 안내한다", () => {
  const result = calculateScenario({
    member: { ageDecade: 30 },
    join: { monthly: true },
    participants: [
      { ageDecade: 50 },
      { ageDecade: 60 }
    ]
  });

  assert.deepEqual(result.reasons, [
    "60대 중심의 멤버들과 함께하는 월례회 일정이에요",
    "여러 멤버가 함께하는 월례회라 처음 참여해도 자연스럽게 어울리기 좋아요"
  ]);
});

test("서버에서 제공한 적합도 퍼센트는 유지하면서 이유는 실제 데이터로 만든다", () => {
  const result = calculateScenario({
    member: { styles: ["매너중시"], ageDecade: 50 },
    join: { matchPercent: 88 },
    participants: [{ styles: ["매너중시"], ageDecade: 50 }]
  });

  assert.equal(result.percent, 88);
  assert.deepEqual(result.reasons, [
    "서로 배려하는 매너 중심의 라운딩을 선호해요",
    "50대 중심이라 편안하게 대화하기 좋아요"
  ]);
});
