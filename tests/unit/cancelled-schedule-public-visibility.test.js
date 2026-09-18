"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const homeSections = fs.readFileSync(
  path.resolve(__dirname, "../../src/golfjoin-main/source/scripts/sections/38-home-sections.js"),
  "utf8"
);
const detail = fs.readFileSync(
  path.resolve(__dirname, "../../src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);
const server = fs.readFileSync(
  path.resolve(__dirname, "../../server/google-sheet-proxy-function/index.js"),
  "utf8"
);

test("메인 섹션은 취소·숨김 일정을 렌더링하지 않는다", () => {
  assert.match(homeSections, /function isPublicHomeJoinSchedule\(join = \{\}\)/);
  assert.match(homeSections, /cancel\|취소\|deleted\|삭제\|rejected\|거절/);
  assert.match(homeSections, /\["hidden", "deleted", "inactive", "false", "0", "숨김"\]/);
});

test("여행지 검색 지역 집계에서도 비공개 일정을 제외한다", () => {
  assert.match(detail, /joins\.filter\(isUserCreatedJoinSchedule\)\.filter\(isPublicHomeJoinSchedule\)/);
});

test("서버 공개 요약과 신규 참여 검증 모두 취소 일정을 차단한다", () => {
  assert.match(server, /const publicNewSchedules = newSchedules\.filter\(isPublicNewScheduleRow\)/);
  assert.match(server, /throw createJoinScheduleUnavailableError\(targetSchedule\)/);
  assert.match(server, /error\?\.code === "join_schedule_unavailable"/);
});
