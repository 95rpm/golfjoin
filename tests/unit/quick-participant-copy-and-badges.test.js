"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const SCRIPT_PATH = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/sections/38-home-sections.js"
);
const CSS_PATH = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/styles/10-main.css"
);
const SCRIPT = fs.readFileSync(SCRIPT_PATH, "utf8");
const CSS = fs.readFileSync(CSS_PATH, "utf8");

function extractFunction(name, nextName) {
  const start = SCRIPT.indexOf(`function ${name}(`);
  const end = SCRIPT.indexOf(`function ${nextName}(`, start + 1);
  assert.ok(start >= 0, `missing function: ${name}`);
  assert.ok(end > start, `missing next function: ${nextName}`);
  return SCRIPT.slice(start, end);
}

function renderCopy(join) {
  const context = vm.createContext({
    JOIN_MAX_CAPACITY: 60,
    getConfirmedParticipants: (value) => value.participants.filter((participant) => participant.status === "confirmed"),
    getJoinAuthoritativeConfirmedCount: (value) => value.confirmedCount,
    getJoinRecruitmentCapacity: (value) => value.capacity
  });
  vm.runInContext(extractFunction("renderJoinParticipantCopy", "renderSoonCompactTeam"), context);
  context.join = join;
  return vm.runInContext("renderJoinParticipantCopy(join)", context);
}

function makePreviews(count = 40) {
  const ages = [
    ...Array.from({ length: 25 }, () => "60대 초반"),
    ...Array.from({ length: 10 }, () => "50대 후반"),
    ...Array.from({ length: 3 }, () => "40대 초반"),
    ...Array.from({ length: 2 }, () => "70대이상 초반")
  ];
  return ages.slice(0, count).map((age) => ({
    status: "confirmed",
    age,
    preferences: ["매너중시"]
  }));
}

test("참여자 미리보기가 40명으로 제한돼도 실제 59명 집계를 문구에 사용한다", () => {
  const html = renderCopy({
    participants: makePreviews(40),
    confirmedCount: 59,
    capacity: 60,
    emptySlots: 1
  });
  assert.match(html, /이미 59명 참여, 마지막 한 자리만 남았어요\./);
  assert.doesNotMatch(html, /이미 40명 참여/);
  assert.match(html, /60대·50대 중심 참여자 구성/);
  assert.doesNotMatch(html, /초반|중반|후반|매너중시/);
});

test("나이대는 개인 순서가 아니라 실제 참여자 빈도 상위 두 구간으로 요약한다", () => {
  const html = renderCopy({
    participants: [
      ...Array.from({ length: 6 }, () => ({ status: "confirmed", age: "50대 후반", preferences: [] })),
      ...Array.from({ length: 3 }, () => ({ status: "confirmed", age: "60대 초반", preferences: [] })),
      { status: "confirmed", age: "40대 중반", preferences: [] }
    ],
    confirmedCount: 10,
    capacity: 12,
    emptySlots: 2
  });
  assert.match(html, /50대·60대 중심 참여자 구성/);
  assert.doesNotMatch(html, /40대/);
});

test("서버가 제공한 전체 연령대 집계가 제한된 참여자 미리보기보다 우선한다", () => {
  const html = renderCopy({
    participants: makePreviews(40),
    participantSummary: {
      ageDecadeCounts: { 40: 2, 50: 31, 60: 20, 70: 6 }
    },
    confirmedCount: 59,
    capacity: 60,
    emptySlots: 1
  });
  assert.match(html, /50대·60대 중심 참여자 구성/);
  assert.doesNotMatch(html, /40대·60대 중심/);
});

test("잔여석 문구는 일정의 실제 잔여석에 맞춰 바뀐다", () => {
  const openHtml = renderCopy({
    participants: makePreviews(8),
    confirmedCount: 57,
    capacity: 60,
    emptySlots: 3
  });
  const fullHtml = renderCopy({
    participants: makePreviews(8),
    confirmedCount: 60,
    capacity: 60,
    emptySlots: 0
  });
  assert.match(openHtml, /이미 57명 참여, 3자리만 남았어요\./);
  assert.match(fullHtml, /이미 60명 참여, 현재 모집이 마감됐어요\./);
});

test("마감임박의 마지막 1자리 배지는 추천일정 배지와 동일한 시각 규격을 사용한다", () => {
  const markerStart = CSS.indexOf("/* v66b: keep quick-card urgency badges consistent with recommendation badges. */");
  const markerEnd = CSS.indexOf("/* end v66b quick-card badge consistency */", markerStart);
  assert.ok(markerStart >= 0 && markerEnd > markerStart);
  const block = CSS.slice(markerStart, markerEnd);
  for (const value of [
    "height: 25px",
    "min-height: 25px",
    "padding: 4px 8px",
    "border: 1px solid var(--border)",
    "background: #ffffff",
    "color: #373a3c",
    "font-size: var(--font-card-category)"
  ]) assert.ok(block.includes(value), value);
});

test("마감임박 카드에서는 해외 범용 배지를 숨긴다", () => {
  assert.match(CSS, /#secret-golf-join \.join-product-section\.layout-quick \.join-category-chip\.overseas \{\s*display: none !important;\s*\}/);
});
