"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/sections/38-home-sections.js"
), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
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
  throw new Error(`${name} is incomplete`);
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...items) { items.forEach((item) => values.add(item)); },
    remove(...items) { items.forEach((item) => values.delete(item)); },
    toggle(item, force) {
      if (force) values.add(item);
      else values.delete(item);
    },
    contains(item) { return values.has(item); }
  };
}

test("모달 잠금 중 섹션 자동 동기화는 현재 활성 칩을 변경하지 않는다", () => {
  const frames = [];
  const body = { classList: createClassList() };
  const root = { classList: createClassList() };
  let sectionQueryCount = 0;
  const sandbox = {
    document: {
      body,
      documentElement: root,
      querySelectorAll(selector) {
        if (selector === "[data-join-section]") sectionQueryCount += 1;
        return [];
      }
    },
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    }
  };
  const sources = [
    "isJoinSectionNavScrollSyncSuspended",
    "updateJoinSectionNavActive",
    "scheduleJoinSectionNavActiveUpdate"
  ].map((name) => extractFunction(SOURCE, name)).join("\n");

  vm.runInNewContext(`
    let joinSectionNavScrollFrame = 0;
    ${sources}
    globalThis.scheduleForTest = scheduleJoinSectionNavActiveUpdate;
  `, sandbox);

  sandbox.scheduleForTest();
  assert.equal(frames.length, 1, "잠금 전 자동 갱신 프레임이 예약되어야 한다");

  body.classList.add("join-widget-page-scroll-locked");
  frames.shift()();
  assert.equal(sectionQueryCount, 0, "예약된 프레임도 잠금 후에는 섹션 위치를 읽지 않아야 한다");

  sandbox.scheduleForTest();
  assert.equal(frames.length, 0, "잠금 중 새 자동 갱신 프레임을 예약하지 않아야 한다");
});

test("모달 잠금은 명시적으로 지정한 섹션 칩 변경을 막지 않는다", () => {
  const button = {
    dataset: { joinSectionTarget: "best" },
    classList: createClassList(),
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name) || null; }
  };
  const sandbox = {
    document: {
      body: { classList: createClassList(["join-widget-page-scroll-locked"]) },
      documentElement: { classList: createClassList(["modal-open"]) },
      querySelector() { return button; },
      querySelectorAll() { return [button]; }
    },
    keepJoinSectionNavButtonInView() {}
  };

  vm.runInNewContext(`
    let joinSectionNavActiveKey = "mdpick";
    ${extractFunction(SOURCE, "setJoinSectionNavActive")}
    globalThis.setForTest = setJoinSectionNavActive;
  `, sandbox);

  sandbox.setForTest("best");
  assert.equal(button.classList.contains("active"), true);
  assert.equal(button.getAttribute("aria-current"), "true");
});

test("모바일 섹션 칩 이동은 확대·축소 상태 모두 고정 내비게이션 높이를 기준으로 한다", () => {
  const root = {};
  const sandbox = {
    document: {
      documentElement: root,
      getElementById(id) { return id === "secret-golf-join" ? root : null; }
    },
    window: { innerWidth: 390 },
    getComputedStyle() {
      return {
        getPropertyValue(name) {
          if (name === "--mobile-home-header-height") return "55px";
          if (name === "--mobile-join-section-nav-fixed-height") return "46px";
          if (name === "--join-pc-header-zone-offset") return "187px";
          return "";
        }
      };
    }
  };

  vm.runInNewContext(`
    ${extractFunction(SOURCE, "getJoinSectionNavScrollOffset")}
    globalThis.offsetForTest = getJoinSectionNavScrollOffset;
  `, sandbox);

  assert.equal(sandbox.offsetForTest({ offsetHeight: 105 }), 113, "확대 상태도 최종 고정 높이를 사용해야 한다");
  assert.equal(sandbox.offsetForTest({ offsetHeight: 46 }), 113, "축소 고정 상태도 같은 위치를 사용해야 한다");
});
