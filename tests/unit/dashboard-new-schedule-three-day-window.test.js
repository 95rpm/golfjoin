"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dashboard = fs.readFileSync(path.resolve(__dirname, "../../golfjoin_admin_dashboard.html"), "utf8");

function extractFunction(source, functionName) {
  const declaration = `function ${functionName}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const bodyStart = source.indexOf(") {", start) + 2;
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
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

function createRecentScheduleMatcher() {
  const sandbox = { Date, Intl };
  vm.runInNewContext(`
    const NEW_SCHEDULE_RECENT_DAYS = 3;
    const KST_CALENDAR_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
    });
    const asText = (value) => String(value == null ? "" : value).trim();
    const firstText = (...values) => values.map(asText).find(Boolean) || "";
    ${extractFunction(dashboard, "parseDateTime")}
    ${extractFunction(dashboard, "getKstCalendarDayValue")}
    ${extractFunction(dashboard, "getScheduleCreatedDate")}
    ${extractFunction(dashboard, "isRecentlyCreatedSchedule")}
    globalThis.matches = isRecentlyCreatedSchedule;
  `, sandbox);
  return sandbox.matches;
}

test("신규 일정 기준은 한국시간 오늘을 포함한 최근 3개 날짜이다", () => {
  const matches = createRecentScheduleMatcher();
  const now = new Date("2026-09-09T23:59:59+09:00");

  assert.equal(matches({ row: { createdAt: "2026-09-09T00:00:00+09:00" } }, 3, now), true);
  assert.equal(matches({ row: { createdAt: "2026-09-08T12:00:00+09:00" } }, 3, now), true);
  assert.equal(matches({ row: { createdAt: "2026-09-07T00:00:00+09:00" } }, 3, now), true);
  assert.equal(matches({ row: { createdAt: "2026-09-06T23:59:59+09:00" } }, 3, now), false);
  assert.equal(matches({ row: { createdAt: "2026-09-10T00:00:00+09:00" } }, 3, now), false);
});

test("UTC 시각과 생성일 대체 필드도 한국 날짜 경계로 판정한다", () => {
  const matches = createRecentScheduleMatcher();
  const now = new Date("2026-09-09T10:00:00+09:00");

  assert.equal(matches({ row: { createdAt: "2026-09-06T15:00:00Z" } }, 3, now), true);
  assert.equal(matches({ row: { createdAt: "2026-09-06T14:59:59Z" } }, 3, now), false);
  assert.equal(matches({ row: { submittedAt: "2026-09-08T11:00:00+09:00" } }, 3, now), true);
  assert.equal(matches({ row: { updatedAt: "not-a-date" } }, 3, now), false);
});

test("신규 카드 숫자와 목록은 같은 최근 3일 함수와 추천일정 제외 조건을 사용한다", () => {
  assert.match(dashboard, /const NEW_SCHEDULE_RECENT_DAYS = 3;/);
  assert.match(
    dashboard,
    /const newRecent = state\.schedules\.filter\(\(schedule\) => !schedule\.isRecommendationSchedule && isRecentlyCreatedSchedule\(schedule\)\)\.length;/
  );
  assert.match(
    dashboard,
    /!state\.scheduleCreatedRecentOnly \|\| \(!schedule\.isRecommendationSchedule && isRecentlyCreatedSchedule\(schedule\)\)/
  );
  assert.match(dashboard, /data-metric-action="new-recent"/);
  assert.match(dashboard, /aria-label="최근 \$\{escapeHtml\(NEW_SCHEDULE_RECENT_DAYS\)\}일 생성 일정"/);
});
