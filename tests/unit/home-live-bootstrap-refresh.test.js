"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const BOOT_PATH = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/boot/40-initialize.js"
);
const BOOT_SOURCE = fs.readFileSync(BOOT_PATH, "utf8");

function getInitializeBlock() {
  const start = BOOT_SOURCE.indexOf("async function initializeGolfJoinHome");
  const end = BOOT_SOURCE.indexOf("initializeGolfJoinHome().catch", start + 1);
  assert.notEqual(start, -1, "initializeGolfJoinHome not found");
  assert.notEqual(end, -1, "initializeGolfJoinHome boundary not found");
  return BOOT_SOURCE.slice(start, end);
}

test("release-v2 first paint is always reconciled with current public schedule data", () => {
  const block = getInitializeBlock();
  const v2Decision = block.indexOf("const useGolfJoinHomeDataV2");
  const liveRequest = block.indexOf(
    "const releaseV2LiveReconciliationPromise = useGolfJoinHomeDataV2"
  );
  const memberScope = block.indexOf("const canFastCloseAfterLoginLoading");

  assert.ok(v2Decision >= 0, "release-v2 startup decision not found");
  assert.ok(liveRequest > v2Decision, "current public bootstrap must run after release-v2 commit");
  assert.ok(liveRequest > memberScope, "live schedule refresh must not be gated by member scope");
  assert.match(
    block,
    /const releaseV2LiveReconciliationPromise = useGolfJoinHomeDataV2\s*\? hydrateHomeBootstrapLightFromGoogleSheet\(\{ render: false \}\)/,
    "release-v2 must reconcile its mutable snapshot with current public data"
  );
});

test("a failed live refresh keeps the release snapshot and schedules a retry", () => {
  const block = getInitializeBlock();
  const requestStart = block.indexOf("const releaseV2LiveReconciliationPromise");
  const legacyStart = block.indexOf("const homeBootstrapDataPromise", requestStart + 1);
  const requestBlock = block.slice(requestStart, legacyStart);

  assert.match(requestBlock, /homeBootstrapSnapshotNeedsRefresh = true;/);
  assert.match(
    requestBlock,
    /catch\(\(error\) => \{[\s\S]*?return pendingHomeBootstrapLightData;/,
    "release-v2 must remain the safe fallback while the deferred retry is pending"
  );
});

test("the authoritative live refresh schedules one final home render for both startup modes", () => {
  const block = getInitializeBlock();
  const renderPromiseStart = block.indexOf("const initialHomeDataRenderPromise");
  const secondaryStart = block.indexOf("scheduleHomeSecondaryHydration", renderPromiseStart + 1);
  const renderBlock = block.slice(renderPromiseStart, secondaryStart);

  assert.match(renderBlock, /scheduleHomeRender\(\{ deferWhileModalOpen: true \}\);/);
  assert.match(
    renderBlock,
    /Promise\.all\(\[[\s\S]*?releaseV2LiveReconciliationPromise[\s\S]*?\]\)/,
    "release-v2 needs a render after current capacity and participant counts arrive"
  );
});

test("live reconciliation does not block signed-in resume work", () => {
  const block = getInitializeBlock();
  const bootstrapStart = block.indexOf("const bootstrapPromise = homeBootstrapDataPromise");
  const renderStart = block.indexOf("const initialHomeDataRenderPromise", bootstrapStart + 1);
  const bootstrapBlock = block.slice(bootstrapStart, renderStart);

  assert.notEqual(bootstrapStart, -1, "member resume bootstrap not found");
  assert.doesNotMatch(
    bootstrapBlock,
    /releaseV2LiveReconciliationPromise/,
    "a slow public refresh must not delay login/profile/deep-link resume"
  );
});
