"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);

function loadSurchargeParsers() {
  const start = SOURCE.indexOf("function parseApplyBookingList");
  const end = SOURCE.indexOf("function getApplyBookingOptions", start);
  assert.ok(start >= 0 && end > start, "single room surcharge parser helpers");
  const context = vm.createContext({
    Number,
    String,
    Set,
    getNestedValue(value, key) {
      return key.split(".").reduce((current, part) => current?.[part], value);
    }
  });
  new vm.Script(
    `${SOURCE.slice(start, end)}\nthis.surchargeApi = { findApplySurchargeMoney, extractSingleRoomSurcharge, getSingleRoomSurchargeInfo, parseApplyWonAmount };`,
    { filename: "single-room-surcharge-parsers.js" }
  ).runInContext(context);
  return context.surchargeApi;
}

function renderSurcharge(options) {
  const start = SOURCE.indexOf("function updateApplyBookingOptions");
  const end = SOURCE.indexOf("function scrollApplyChipGroupIntoView", start);
  assert.ok(start >= 0 && end > start, "single room surcharge renderer");
  const surcharge = {
    textContent: "",
    innerHTML: "",
    title: "",
    removeAttribute(name) {
      if (name === "title") this.title = "";
    }
  };
  const noopClassList = { toggle() {}, remove() {} };
  const context = vm.createContext({
    getApplyBookingOptions: () => options,
    formatApplyWon: (amount) => `${Number(amount).toLocaleString("ko-KR")}원`,
    escapeHtml: (value) => String(value),
    document: {
      querySelector(selector) {
        if (selector.startsWith("[data-apply-room-surcharge")) return surcharge;
        return { classList: noopClassList };
      }
    }
  });
  new vm.Script(`${SOURCE.slice(start, end)}\nupdateApplyBookingOptions("global");`).runInContext(context);
  return surcharge;
}

test("일본 상품의 8,000엔 싱글차지는 원화로 변환하지 않고 엔 단위를 보존한다", () => {
  const api = loadSurchargeParsers();
  const parsed = api.getSingleRoomSurchargeInfo({
    notes: ["싱글차지 1박 8,000엔"]
  });

  assert.equal(parsed.amount, 0);
  assert.equal(parsed.displayText, "8,000엔");
  assert.equal(parsed.sourceText, "싱글차지 1박 8,000엔");
  assert.equal(parsed.status, "manual_check");
  assert.equal(api.parseApplyWonAmount("8,000엔"), 0);
});

test("기존 숫자 필드가 있어도 참고사항에 엔이 명시되면 외화가 우선한다", () => {
  const api = loadSurchargeParsers();
  const parsed = api.getSingleRoomSurchargeInfo({
    singleRoomSurcharge: 8000,
    singleRoomSurchargeText: "1인1실 추가요금 8,000엔",
    singleRoomSurchargeStatus: "found"
  });

  assert.equal(parsed.amount, 0);
  assert.equal(parsed.displayText, "8,000엔");
  assert.equal(parsed.status, "manual_check");
});

test("원화 싱글차지는 기존처럼 숫자 금액과 원 단위를 유지한다", () => {
  const api = loadSurchargeParsers();
  const parsed = api.getSingleRoomSurchargeInfo({
    notes: ["1인 1실 추가요금 80,000원"]
  });

  assert.equal(parsed.amount, 80000);
  assert.equal(parsed.displayText, "80,000원");
  assert.equal(parsed.status, "found");
});

test("1인1실 선택 안내는 파싱된 통화 단위를 그대로 렌더링한다", () => {
  const surcharge = renderSurcharge({
    packType: "golf",
    roomType: "1인1실",
    singleRoomSurcharge: 0,
    singleRoomSurchargeDisplayText: "8,000엔",
    singleRoomSurchargeText: "싱글차지 1박 8,000엔"
  });

  assert.equal(surcharge.innerHTML, "1인 1실 추가요금 <strong>8,000엔</strong>");
  assert.equal(surcharge.title, "싱글차지 1박 8,000엔");
});

