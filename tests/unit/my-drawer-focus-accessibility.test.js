"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const markup = fs.readFileSync(path.join(root, "src/golfjoin-main/source/markup/20-main.html"), "utf8");
const memberSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"), "utf8");

test("닫힌 마이메뉴는 aria-hidden과 inert를 함께 사용한다", () => {
  assert.match(markup, /id="joinMyDrawerOverlay"[^>]*aria-hidden="true"[^>]*\binert\b/);
});

test("마이메뉴를 닫기 전에 내부 포커스를 해제하고 inert를 적용한다", () => {
  const closeBlock = memberSource.match(/function closeJoinMyDrawer\(\)[\s\S]*?\n    }/);
  assert.ok(closeBlock, "closeJoinMyDrawer block");
  assert.match(closeBlock[0], /overlay\?\.contains\(focusedElement\)/);
  assert.match(closeBlock[0], /focusedElement\.blur\(\)/);
  assert.match(closeBlock[0], /overlay\.inert = true/);
  assert.ok(
    closeBlock[0].indexOf("focusedElement.blur()") < closeBlock[0].indexOf('setAttribute("aria-hidden", "true")'),
    "focus must be released before aria-hidden"
  );
});

test("마이메뉴를 열 때 inert를 먼저 해제한다", () => {
  const showBlock = memberSource.match(/function showJoinMyDrawer\(member = \{\}\)[\s\S]*?\n    }/);
  assert.ok(showBlock, "showJoinMyDrawer block");
  assert.match(showBlock[0], /overlay\.inert = false/);
  assert.ok(
    showBlock[0].indexOf("overlay.inert = false") < showBlock[0].indexOf('setAttribute("aria-hidden", "false")'),
    "inert must be released before the drawer becomes visible"
  );
});
