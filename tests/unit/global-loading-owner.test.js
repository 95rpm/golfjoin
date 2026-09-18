"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function extractFunction(source, functionName) {
  const declaration = `${source.includes(`async function ${functionName}`) ? "async " : ""}function ${functionName}`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.ok(bodyStart > 1, `${functionName} body not found`);
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

function createClassList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach((item) => values.add(item)),
    remove: (...items) => items.forEach((item) => values.delete(item)),
    toggle: (item, force) => force ? values.add(item) : values.delete(item),
    contains: (item) => values.has(item)
  };
}

test("closing one owner cannot close another active global loading action", async () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const openSource = extractFunction(html, "openJoinActionLoading");
  const closeSource = extractFunction(html, "closeJoinActionLoading");
  const overlay = {
    classList: createClassList(),
    style: { setProperty() {} },
    setAttribute() {},
    querySelector() { return box; }
  };
  const box = {
    classList: createClassList(),
    style: { setProperty() {} },
    setAttribute(_name, value) { this.label = value; }
  };
  const message = { textContent: "" };
  const sandbox = {
    document: {
      body: { appendChild() {} },
      getElementById(id) {
        if (id === "joinActionLoadingOverlay") return overlay;
        if (id === "joinActionLoadingMessage") return message;
        return null;
      },
      querySelector() { return box; }
    },
    isHomeInitialLoadingOpen: () => false,
    closeHomeInitialLoading() {},
    portalOverlayToBody: () => overlay,
    normalizeLoadingMessageBase: (value) => String(value || ""),
    renderAnimatedLoadingMessage() {},
    renderJoinActionLoadingIcon() {},
    setWidgetModalOpen() {},
    hasOpenBlockingModal: () => false,
    setJoinMobileBottomNavVisible() {},
    setInterval: () => 1,
    clearInterval() {},
    setTimeout,
    Promise,
    Date
  };

  vm.runInNewContext(`
    let joinActionLoadingCount = 0;
    const joinActionLoadingOwners = new Map();
    let joinActionLoadingGeneration = 0;
    let joinActionLoadingMinVisibleMs = 0;
    let joinActionLoadingOpenedAt = 0;
    let joinActionLoadingMessageBase = "";
    let joinActionLoadingMessageDotIndex = 0;
    let joinActionLoadingTimer = null;
    const JOIN_ACTION_LOADING_MIN_VISIBLE_MS = 0;
    const JOIN_ACTION_LOADING_ICON_INTERVAL_MS = 400;
    const JOIN_LOADING_DOT_SUFFIXES = ["", ".", "..", "..."];
    ${openSource}
    ${closeSource}
    globalThis.openForTest = openJoinActionLoading;
    globalThis.closeForTest = closeJoinActionLoading;
    globalThis.getOwnerCountForTest = () => joinActionLoadingOwners.size;
  `, sandbox);

  const firstToken = sandbox.openForTest("첫 번째", { minVisibleMs: 0 });
  const secondToken = sandbox.openForTest("두 번째", { minVisibleMs: 0 });
  assert.equal(sandbox.getOwnerCountForTest(), 2);
  assert.equal(overlay.classList.contains("open"), true);

  await sandbox.closeForTest(firstToken);
  assert.equal(sandbox.getOwnerCountForTest(), 1);
  assert.equal(overlay.classList.contains("open"), true);
  assert.equal(box.label, "두 번째");

  await sandbox.closeForTest(firstToken);
  assert.equal(sandbox.getOwnerCountForTest(), 1);
  assert.equal(overlay.classList.contains("open"), true);

  await sandbox.closeForTest(secondToken);
  assert.equal(sandbox.getOwnerCountForTest(), 0);
  assert.equal(overlay.classList.contains("open"), false);
});
