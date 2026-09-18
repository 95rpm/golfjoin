"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const SECTION_SOURCE = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/sections/38-home-sections.js"),
  "utf8"
);
const DETAIL_SOURCE = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);

function slice(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `missing slice: ${startToken}`);
  return source.slice(start, end);
}

test("해외조인 BEST는 다른 모집 영역과 같은 출발 7일 전 노출 기준을 사용한다", () => {
  const overseasBest = slice(
    SECTION_SOURCE,
    "function getOverseasBestItems",
    "function getMyHomeJoinItems"
  );
  const soonCandidate = slice(
    DETAIL_SOURCE,
    "function isSoonCandidate",
    "function getAvailableSoonRangeFilters"
  );

  assert.match(overseasBest, /\.filter\(isOverseasJoin\)[\s\S]*?\.filter\(isSoonCandidate\)/);
  assert.match(soonCandidate, /getJoinDaysFromToday\(join\)\s*>=\s*7/);
});

test("해외조인 BEST의 로그인별 소유 일정 제외 규칙은 유지한다", () => {
  const filteredItems = slice(
    SECTION_SOURCE,
    "function getOverseasBestFilteredItems",
    "function setMyJoinFilter"
  );
  const homeSections = slice(
    SECTION_SOURCE,
    "function getHomeJoinSections",
    "function hasActiveJoinScheduleItems"
  );

  assert.match(filteredItems, /!isMyHomeJoinSchedule\(join\)/);
  assert.match(homeSections, /const scheduleItems = upcomingScheduleItems/);
  assert.doesNotMatch(homeSections, /currentMemberKey|isHomeJoinScheduleVisibleForCurrentMember/);
});
