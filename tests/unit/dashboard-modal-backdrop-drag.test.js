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

function createBackdropHarness() {
  const listeners = new Map();
  const backdrop = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, target, detail = {}) {
      const event = { type, target, pointerId: 1, isPrimary: true, ...detail };
      [...(listeners.get(type) || [])].forEach((listener) => listener(event));
    }
  };
  return backdrop;
}

test("모달 본문에서 시작해 배경에서 끝난 텍스트 드래그는 모달을 닫지 않는다", () => {
  const sandbox = {};
  vm.runInNewContext(`${extractFunction(dashboard, "bindModalBackdropDismiss")}; globalThis.bind = bindModalBackdropDismiss;`, sandbox);
  const backdrop = createBackdropHarness();
  const modalText = {};
  let closeCount = 0;
  sandbox.bind(backdrop, () => { closeCount += 1; });

  backdrop.dispatch("pointerdown", modalText);
  backdrop.dispatch("pointerup", backdrop);
  backdrop.dispatch("click", backdrop);

  assert.equal(closeCount, 0);
});

test("배경에서 누르고 배경에서 놓은 정상 클릭만 모달을 닫는다", () => {
  const sandbox = {};
  vm.runInNewContext(`${extractFunction(dashboard, "bindModalBackdropDismiss")}; globalThis.bind = bindModalBackdropDismiss;`, sandbox);
  const backdrop = createBackdropHarness();
  const modalText = {};
  let closeCount = 0;
  const unbind = sandbox.bind(backdrop, () => { closeCount += 1; });

  backdrop.dispatch("pointerdown", backdrop);
  backdrop.dispatch("pointerup", modalText);
  backdrop.dispatch("click", backdrop);
  assert.equal(closeCount, 0);

  backdrop.dispatch("pointerdown", backdrop);
  backdrop.dispatch("pointerup", backdrop);
  backdrop.dispatch("click", backdrop);
  assert.equal(closeCount, 1);

  backdrop.dispatch("pointerdown", backdrop);
  backdrop.dispatch("pointercancel", backdrop);
  backdrop.dispatch("click", backdrop);
  assert.equal(closeCount, 1);

  unbind();
  backdrop.dispatch("pointerdown", backdrop);
  backdrop.dispatch("pointerup", backdrop);
  backdrop.dispatch("click", backdrop);
  assert.equal(closeCount, 1);
});

test("배경 닫기를 제공하는 모든 대시보드 모달은 공통 드래그 안전 처리기를 사용한다", () => {
  const bindings = [
    'bindModalBackdropDismiss($("#drawerBackdrop"), closeDrawer);',
    'bindModalBackdropDismiss($("#familyReviewBackdrop"), closeFamilyReviewModal);',
    'bindModalBackdropDismiss($("#familyGroupAssignBackdrop"), closeFamilyGroupAssignModal);',
    'bindModalBackdropDismiss(document.getElementById("quoteEditorBackdrop"), closeQuoteEditor);',
    'bindModalBackdropDismiss(document.getElementById("participantListBackdrop"), closeParticipantListModal);'
  ];
  bindings.forEach((binding) => assert.ok(dashboard.includes(binding), binding));
  assert.match(extractFunction(dashboard, "openConfirmDialog"), /bindModalBackdropDismiss\(backdrop, \(\) => cleanup\(false\)\)/);
  assert.doesNotMatch(dashboard, /Backdrop"\)\??\.addEventListener\("click"/);
});

test("관리자 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});
