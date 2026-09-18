"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const LOADING_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/loading/33-loading-and-modal-layer.js"
), "utf8");
const DETAIL_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
), "utf8");
const PROFILE_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"
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

function createStyle(initial = {}) {
  const values = new Map();
  Object.entries(initial).forEach(([property, value]) => {
    values.set(property, { value: String(value), priority: "" });
  });
  return {
    getPropertyValue(property) {
      return values.get(property)?.value || "";
    },
    getPropertyPriority(property) {
      return values.get(property)?.priority || "";
    },
    setProperty(property, value, priority = "") {
      values.set(property, { value: String(value), priority: String(priority) });
    },
    removeProperty(property) {
      const previous = values.get(property)?.value || "";
      values.delete(property);
      return previous;
    }
  };
}

function createClassList() {
  const values = new Set();
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

test("첫 모달은 현재 문서 위치를 고정하고 중첩 모달이 모두 닫힐 때만 복원한다", () => {
  const sources = [
    "captureWidgetModalPageScrollState",
    "captureInlineStyleProperty",
    "restoreInlineStyleProperty",
    "lockWidgetModalPageScroll",
    "unlockWidgetModalPageScroll",
    "setWidgetModalOpen"
  ].map((name) => extractFunction(LOADING_SOURCE, name)).join("\n");
  const body = {
    style: createStyle({ "padding-right": "4px" }),
    classList: createClassList(),
    scrollHeight: 4800,
    offsetHeight: 4800
  };
  const root = {
    style: createStyle({ "scroll-behavior": "smooth" }),
    classList: createClassList(),
    scrollHeight: 5000,
    offsetHeight: 5000,
    clientWidth: 1260,
    scrollTop: 920,
    scrollLeft: 0
  };
  const widget = { classList: createClassList() };
  const scrollCalls = [];
  let blockingModalOpen = false;
  const sandbox = {
    document: {
      body,
      documentElement: root,
      scrollingElement: root,
      getElementById(id) { return id === "secret-golf-join" ? widget : null; }
    },
    window: {
      scrollY: 920,
      scrollX: 0,
      innerWidth: 1280,
      innerHeight: 800,
      scrollTo(left, top) { scrollCalls.push([left, top]); },
      requestAnimationFrame(callback) { callback(); }
    },
    getComputedStyle() { return { paddingRight: "4px" }; },
    hasOpenBlockingModal() { return blockingModalOpen; },
    hasOpenJoinFullscreenModal() { return false; },
    setJoinMobileBottomNavVisible() {},
    shouldKeepJoinMobileBottomNavOverModal() { return false; },
    scheduleJoinFullscreenModalCoverStateUpdate() {}
  };

  vm.runInNewContext(`
    let widgetModalPageScrollLockState = null;
    ${sources}
    globalThis.setOpenForTest = setWidgetModalOpen;
  `, sandbox);

  sandbox.setOpenForTest(true);
  assert.equal(body.style.getPropertyValue("position"), "fixed");
  assert.equal(body.style.getPropertyValue("top"), "-920px");
  assert.equal(body.style.getPropertyValue("height"), "5000px");
  assert.equal(body.style.getPropertyValue("overflow"), "visible");
  assert.equal(body.style.getPropertyPriority("overflow"), "important");
  assert.equal(root.style.getPropertyValue("overflow"), "hidden");
  assert.equal(root.style.getPropertyPriority("overflow"), "important");
  assert.equal(body.style.getPropertyValue("padding-right"), "24px");
  assert.equal(body.classList.contains("join-widget-page-scroll-locked"), true);

  sandbox.window.scrollY = 0;
  sandbox.setOpenForTest(true);
  assert.equal(body.style.getPropertyValue("top"), "-920px");

  blockingModalOpen = true;
  sandbox.setOpenForTest(false);
  assert.equal(body.style.getPropertyValue("position"), "fixed");

  blockingModalOpen = false;
  sandbox.setOpenForTest(false);
  assert.equal(body.style.getPropertyValue("position"), "");
  assert.equal(body.style.getPropertyValue("top"), "");
  assert.equal(body.style.getPropertyValue("height"), "");
  assert.equal(body.style.getPropertyValue("overflow"), "");
  assert.equal(body.style.getPropertyValue("padding-right"), "4px");
  assert.equal(root.style.getPropertyValue("overflow"), "");
  assert.equal(root.style.getPropertyValue("scroll-behavior"), "smooth");
  assert.equal(body.classList.contains("join-widget-page-scroll-locked"), false);
  assert.deepEqual(scrollCalls.at(-1), [0, 920]);
});

test("상품상세와 프로필은 공통 잠금을 덮어쓰는 개별 body top 잠금을 사용하지 않는다", () => {
  assert.doesNotMatch(DETAIL_SOURCE, /lockDetailModalPageScroll|detailModalPageScrollLockState/);
  assert.doesNotMatch(PROFILE_SOURCE, /lockJoinProfileManagePageScroll|joinProfileManageScrollLockY/);
});

test("공용 openModal로 여는 상세·생성·전화 모달도 모두 같은 잠금을 동기화한다", () => {
  const openSource = extractFunction(DETAIL_SOURCE, "openModal");
  const closeSource = extractFunction(DETAIL_SOURCE, "closeModal");
  assert.match(openSource, /overlay\?\.classList\.add\("open"\);[\s\S]{0,220}?setWidgetModalOpen\(true\);/);
  assert.doesNotMatch(openSource, /if \(id === "detailModal" \|\| id === "builderModal"\)[\s\S]{0,100}?setWidgetModalOpen/);
  assert.match(closeSource, /modal\?\.classList\.remove\("open"\);\s*setWidgetModalOpen\(hasOpenBlockingModal\(\)\);/);
});
