"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const source = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);

function loadEventFlightScheduleBuilder() {
  const start = source.indexOf("function buildSecretTourEventFlightScheduleItems");
  const end = source.indexOf("function normalizeSecretTourGoodsEventItem", start);
  assert.ok(start >= 0 && end > start, "행사 항공정보 보완 함수가 존재해야 합니다.");
  const context = {
    secretTourDateToISO: (value) => {
      const matched = String(value || "").match(/^(\d{4})(\d{2})(\d{2})$/);
      return matched ? `${matched[1]}-${matched[2]}-${matched[3]}` : "";
    }
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.api = { buildSecretTourEventFlightScheduleItems };`, context);
  return context.api;
}

test("항공팩 행사는 goodTransportSeq가 0이어도 행사 응답의 왕복 시각으로 항공정보를 만든다", () => {
  const { buildSecretTourEventFlightScheduleItems } = loadEventFlightScheduleBuilder();
  const items = buildSecretTourEventFlightScheduleItems({
    goodTransportSeq: 0,
    air2Cd: "7C",
    air2Nm: "제주항공",
    depStartDay: "20260904",
    depEndDay: "20260904",
    arrStartDay: "20260907",
    arrEndDay: "20260907",
    depStartTime: "10:00",
    depEndTime: "11:15",
    arrStartTime: "12:15",
    arrEndTime: "15:35"
  });

  assert.deepEqual(JSON.parse(JSON.stringify(items)), [
    { label: "출발", airline: "제주항공", code: "7C", fromDate: "2026-09-04", fromTime: "10:00", toDate: "2026-09-04", toTime: "11:15" },
    { label: "도착", airline: "제주항공", code: "7C", fromDate: "2026-09-07", fromTime: "12:15", toDate: "2026-09-07", toTime: "15:35" }
  ]);
});

test("행사 응답의 왕복 시각이 불완전하면 기존 상세 조회 경로를 유지한다", () => {
  const { buildSecretTourEventFlightScheduleItems } = loadEventFlightScheduleBuilder();
  assert.deepEqual(JSON.parse(JSON.stringify(buildSecretTourEventFlightScheduleItems({
    depStartTime: "10:00",
    depEndTime: "11:15",
    arrStartTime: "12:15"
  }))), []);
});

test("goodTransportSeq 0은 별도 항공편 조회용 유효 키가 아니다", () => {
  const start = source.indexOf("function isUsableSecretTourTransportSeq");
  const end = source.indexOf("async function loadSecretTourEventFlightSchedule", start);
  assert.ok(start >= 0 && end > start, "항공편 키 검증 함수가 존재해야 합니다.");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.api = { isUsableSecretTourTransportSeq };`, context);

  assert.equal(context.api.isUsableSecretTourTransportSeq(0), false);
  assert.equal(context.api.isUsableSecretTourTransportSeq("0"), false);
  assert.equal(context.api.isUsableSecretTourTransportSeq(""), false);
  assert.equal(context.api.isUsableSecretTourTransportSeq("12345"), true);
});

test("상세 진입은 행사 항공정보를 먼저 조회한 뒤에만 기존 항공편 API를 사용한다", () => {
  assert.match(source, /flightScheduleItems = await loadSecretTourEventFlightSchedule/);
  assert.match(source, /if \(!hasCompleteSecretTourFlightScheduleItems\(flightScheduleItems\)\) \{\s*flightScheduleItems = await loadSecretTourFlightSchedule/s);
  assert.match(source, /loadSecretTourGoodsEvents\(reference\.goodSeq\)/);
  assert.match(source, /Boolean\(lookupProduct\.goodSeq && lookupProduct\.eventSeq\)[\s\S]*?\? "loading"/);
});
