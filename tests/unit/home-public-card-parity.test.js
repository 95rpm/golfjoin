"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const RELEASE_SOURCE = read("src/golfjoin-main/source/scripts/data/35-release-v2-bootstrap.js");
const DETAIL_SOURCE = read("src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js");
const SECTION_SOURCE = read("src/golfjoin-main/source/scripts/sections/38-home-sections.js");

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test("로그인·비로그인은 동일한 V2 공용 Release를 사용한다", () => {
  assert.doesNotMatch(RELEASE_SOURCE, /member_not_eligible/);
  assert.doesNotMatch(RELEASE_SOURCE, /isGolfJoinHomeDataV2Anonymous/);
  assert.match(RELEASE_SOURCE, /runGolfJoinHomeDataV2Transaction\(\{[\s\S]*force:\s*true/);
});

test("공용 메인 섹션은 회원 소유·참여·기간 겹침으로 카드를 삭제하지 않는다", () => {
  const block = between(SECTION_SOURCE, "function getHomeJoinSections()", "function hasActiveJoinScheduleItems");
  assert.match(block, /filter\(isPublicHomeJoinSchedule\)/);
  assert.doesNotMatch(block, /getJoinWishMemberKey/);
  assert.doesNotMatch(block, /isHomeJoinScheduleVisibleForCurrentMember/);
});

test("공개 일정 표시는 공용 부트스트랩에서만 부여되고 회원 병합 뒤에도 유지된다", () => {
  assert.match(DETAIL_SOURCE, /if \(options\.publicHome === true\) join\.isPublicHomeSchedule = true/);
  assert.match(DETAIL_SOURCE, /if \(existingJoin\.isPublicHomeSchedule === true\) join\.isPublicHomeSchedule = true/);
  assert.match(DETAIL_SOURCE, /upsertLightNewScheduleSummary\(summary, \{ publicHome: true \}\)/);
  assert.match(DETAIL_SOURCE, /isAdminRecommendedSchedule:\s*true,\s*isPublicHomeSchedule:\s*true/);
  assert.doesNotMatch(
    between(DETAIL_SOURCE, "function hydrateBuilderApplicationJoinsFromLocalCache()", "function applyBuilderApplicationsFromGoogleSheetRows"),
    /source:\s*"local"[^\n]*publicHome:\s*true/
  );
});
