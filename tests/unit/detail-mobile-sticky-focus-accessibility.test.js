"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const detail = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");
const markup = fs.readFileSync(path.join(root, "src/golfjoin-main/source/markup/20-main.html"), "utf8");
const dynamic = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/detail/39-detail-actions-participants.js"), "utf8");

test("숨는 모바일 상세 헤더는 내부 포커스를 해제한 뒤 inert와 aria-hidden을 적용한다", () => {
  assert.match(detail, /header\.contains\(document\.activeElement\)/);
  assert.match(detail, /document\.activeElement\?\.blur\?\.\(\)/);
  assert.match(detail, /header\.inert = true/);
  assert.match(detail, /header\.setAttribute\("aria-hidden", "true"\)/);
});

test("초기·동적 모바일 상세 헤더는 닫힌 상태에서 inert다", () => {
  assert.match(markup, /detail-mobile-sticky-header" aria-hidden="true" inert/);
  assert.match(dynamic, /detail-mobile-sticky-header" aria-hidden="true" inert/);
});
