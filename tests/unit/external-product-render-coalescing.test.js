"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function getFunctionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const next = source.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} not found`);
  assert.notEqual(next, -1, `${nextName} boundary not found`);
  return source.slice(start, next);
}

test("external product hydration avoids synchronous and duplicate full home renders", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const block = getFunctionBlock(html, "ensureExternalGolfJoinProductsLoaded", "scheduleMdPickSectionRenderWhenDataReady");
  assert.doesNotMatch(block, /\brenderJoins\s*\(/);
  assert.equal((block.match(/\bscheduleHomeRender\s*\(/g) || []).length, 1);
  assert.match(block, /scheduleHomeRender\(\{ deferWhileModalOpen: true \}\)/);
  assert.match(block, /getElementById\("builderModal"\)\?\.classList\.contains\("open"\)[\s\S]*renderBuilderCalendar\(\)/);
});

test("deferred home rendering waits until product interaction modals close", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const scheduleBlock = getFunctionBlock(html, "scheduleHomeRender", "renderMdPickSectionOnly");
  const closeBlock = getFunctionBlock(html, "closeModal", "openMdPickRegionSearchModal");
  assert.match(scheduleBlock, /deferWhileModalOpen/);
  assert.match(scheduleBlock, /homeRenderDeferredUntilModalClose = true/);
  assert.match(scheduleBlock, /isHomeRenderBlockedByModalOrInteraction\(\)/);
  assert.match(closeBlock, /homeRenderDeferredUntilModalClose/);
  assert.match(closeBlock, /flushDeferredHomeRenderIfReady\(\)/);
});

test("deferred home rendering protects the MD PICK availability-to-modal gap", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const interactionBlock = getFunctionBlock(
    html,
    "isHomeRenderBlockingInteractionActive",
    "isHomeRenderBlockedByModalOrInteraction"
  );
  const blockedBlock = getFunctionBlock(
    html,
    "isHomeRenderBlockedByModalOrInteraction",
    "flushDeferredHomeRenderIfReady"
  );
  const readLoadingEndBlock = getFunctionBlock(html, "endJoinReadLoading", "runJoinReadLoading");

  assert.match(interactionBlock, /joinReadLoadingOwners\.keys\(\)/);
  assert.match(interactionBlock, /startsWith\("mdpick-availability:"\)/);
  assert.match(blockedBlock, /isHomeRenderBlockingInteractionActive\(\)/);
  assert.match(blockedBlock, /getElementById\("detailModal"\)/);
  assert.match(blockedBlock, /getElementById\("builderModal"\)/);
  assert.match(blockedBlock, /getElementById\("regionSearchModal"\)/);
  assert.match(readLoadingEndBlock, /flushDeferredHomeRenderIfReady\(\)/);
});
