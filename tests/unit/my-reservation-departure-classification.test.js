"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function extractFunction(source, functionName) {
  const declaration = `function ${functionName}`;
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
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

function createClassifier() {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = [
    extractFunction(html, "isJoinMyDeparturePast"),
    extractFunction(html, "isJoinMyCompletedAfterDeparture"),
    extractFunction(html, "getJoinMyCompletedReservations")
  ].join("\n");
  const sandbox = {
    getDateOnlyTime(value) {
      const time = new Date(`${String(value || "").slice(0, 10)}T00:00:00`).getTime();
      return Number.isFinite(time) ? time : NaN;
    },
    getJoinMyScheduleBadge(item) {
      return item.badge || null;
    },
    buildJoinMyCompletedReservationItem(item) {
      return { ...item, scheduleGroup: "completed" };
    }
  };
  vm.runInNewContext(`${source}; globalThis.classifyForTest = { isJoinMyDeparturePast, isJoinMyCompletedAfterDeparture, getJoinMyCompletedReservations };`, sandbox);
  return sandbox.classifyForTest;
}

test("모집완료 일정은 출발일 다음 날부터 다녀온 일정으로 분류한다", () => {
  const classifier = createClassifier();
  const referenceDate = new Date("2026-08-13T12:00:00");
  const completed = { id: "complete", departureDate: "2026-08-12", badge: { className: "complete" } };
  const departingToday = { id: "today", departureDate: "2026-08-13", badge: { className: "complete" } };
  const recruiting = { id: "recruiting", departureDate: "2026-08-12", badge: { className: "recruiting" } };

  assert.equal(classifier.isJoinMyCompletedAfterDeparture(completed, referenceDate), true);
  assert.equal(classifier.isJoinMyCompletedAfterDeparture(departingToday, referenceDate), false);
  assert.equal(classifier.isJoinMyCompletedAfterDeparture(recruiting, referenceDate), false);
  assert.deepEqual(
    Array.from(classifier.getJoinMyCompletedReservations([completed, departingToday, recruiting], referenceDate), (item) => item.id),
    ["complete"]
  );
});

test("내예약 그룹은 이동된 모집완료 일정을 생성·참여 목록에서 제외한다", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = extractFunction(html, "getJoinMyReservationGroups");
  assert.match(source, /created:\s*createdItems\.filter\(\(item\) => !isJoinMyCompletedAfterDeparture\(item\)\)/);
  assert.match(source, /joined:\s*joinedItems\.filter\(\(item\) => !isJoinMyCompletedAfterDeparture\(item\)\)/);
  assert.match(source, /completed:\s*getJoinMyCompletedReservations\(\[\.\.\.createdItems, \.\.\.joinedItems\]\)/);
});
