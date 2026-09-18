"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildInventory,
  collectExecutableScriptSources,
  collectScriptInventory,
  renderMarkdown
} = require("../../tools/golfjoin-main/inventory");

test("함수·window 공개·정적 이벤트를 소스 위치와 함께 수집한다", () => {
  const source = [
    "function boot() {}",
    "window.boot = boot;",
    "document.addEventListener('click', boot);",
    "window.addEventListener(\"resize\", boot);",
    "document.dispatchEvent(new CustomEvent('ready'));"
  ].join("\n");
  const result = collectScriptInventory("source/scripts/boot.js", source);
  assert.deepEqual(result.namedFunctions.map(({ name, line }) => ({ name, line })), [{ name: "boot", line: 1 }]);
  assert.equal(result.windowExports[0].name, "boot");
  assert.equal(result.windowExports[0].assignedFrom, "boot");
  assert.equal(result.eventListeners.length, 2);
  assert.equal(result.customEvents[0].event, "ready");
});

test("shell 안의 조기 실행 inline script도 원래 줄 번호로 포함한다", () => {
  const source = "<!doctype html>\n<script>\nfunction earlyBoot() {}\n</script>\n<style>";
  const scripts = collectExecutableScriptSources("source/shell/00-preamble.html", source);
  assert.equal(scripts.length, 1);
  const inventory = collectScriptInventory(scripts[0].path, scripts[0].source, scripts[0].lineOffset);
  assert.equal(inventory.namedFunctions[0].name, "earlyBoot");
  assert.equal(inventory.namedFunctions[0].line, 3);
});

test("manifest 순서대로 의존성 목록과 초보자용 문서를 만든다", () => {
  const sources = new Map([
    ["source/preamble.html", "<script>function early() {}</script>\n<style>"],
    ["source/a.js", "function a() {}\nwindow.a = a;\n"],
    ["source/b.js", "function b() {}\ndocument.addEventListener('click', b);\n"],
    ["source/end.html", "</script>"]
  ]);
  const inventory = buildInventory(
    { sourceOrder: [...sources.keys()] },
    (name) => sources.get(name)
  );
  assert.equal(inventory.summary.namedFunctions, 3);
  assert.equal(inventory.summary.uniqueWindowExports, 1);
  assert.equal(inventory.eventListenerSummary[0].event, "click");
  const markdown = renderMarkdown(inventory);
  assert.match(markdown, /window 공개 목록/);
  assert.match(markdown, /source\/a\.js:2/);
});
