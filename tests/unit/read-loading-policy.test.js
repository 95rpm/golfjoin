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

test("read loading waits 150ms and uses a local target without shimmer", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  assert.match(html, /const JOIN_READ_LOADING_DELAY_MS = 150;/);
  assert.match(html, /\.join-read-loading-indicator\s*\{/);
  assert.doesNotMatch(
    html.slice(html.indexOf(".join-read-loading-indicator"), html.indexOf(".join-action-loading-icon")),
    /animation|shimmer/i
  );
});

test("MD PICK availability read uses local delayed loading and keeps the global overlay closed", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const block = getFunctionBlock(html, "openMdPickProductDetail", "renderMdPickCard");
  assert.match(block, /runJoinReadLoading/);
  assert.match(block, /mdpick-availability:/);
  assert.doesNotMatch(block, /openJoinActionLoading|closeJoinActionLoading/);
  const cardBlock = getFunctionBlock(html, "renderMdPickCard", "consumeMdPickSwipeClick");
  assert.match(cardBlock, /openMdPickProductDetail/);
  assert.match(cardBlock, /event\.currentTarget/);
});

test("family period read uses a modal-local delayed loading target", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const block = getFunctionBlock(html, "selectDetailProductFamilyPeriod", "getProductGroupKey");
  assert.match(block, /runJoinReadLoading/);
  assert.match(block, /#detailModal \.detail-family-periods/);
  assert.doesNotMatch(block, /openJoinActionLoading|closeJoinActionLoading/);
});

test("write actions retain the blocking global loading overlay", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  assert.match(html, /openJoinActionLoading\("참여 신청을 접수하고 있어요"\)/);
  assert.match(html, /openJoinActionLoading\("프로필을 저장하고 있어요"/);
  assert.match(html, /runJoinActionLoading\(async \(\) => \{\s*removeJoinWishProduct/);
});
