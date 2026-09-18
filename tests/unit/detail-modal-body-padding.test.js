"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const css = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/styles/10-main.css"),
  "utf8"
);
const markup = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/markup/20-main.html"),
  "utf8"
);

test("상품상세 본문은 헤더 바로 다음 modal-body를 사용한다", () => {
  assert.match(
    markup,
    /<div class="modal-header">[\s\S]*?<div class="modal-body" id="detailContent">/
  );
});

test("PC 상품상세 첫 이미지는 헤더 아래 20px 상단 여백을 가진다", () => {
  assert.match(
    css,
    /@media \(min-width: 641px\) \{[\s\S]*?#detailModal #detailContent,[\s\S]*?body > #detailModal\.sgj-portal-overlay #detailContent \{\s*padding-top: 0 !important;[\s\S]*?#detailModal #detailContent > \.detail-slider,[\s\S]*?margin-top: 20px;/
  );
});

test("PC 상품상세 고정 탭은 본문 패딩 없이 헤더 바로 아래 붙는다", () => {
  assert.match(css, /\.detail-anchor-tabs \{\s*position: sticky;\s*top: 0;/);
  assert.doesNotMatch(
    css,
    /@media \(min-width: 641px\) \{[\s\S]*?#detailModal #detailContent,[\s\S]*?padding-top: 20px !important;/
  );
});

test("모바일 상품상세 본문의 전체 너비 레이아웃은 유지한다", () => {
  assert.match(
    css,
    /#detailModal\.open #detailContent,[\s\S]*?body > #detailModal\.sgj-portal-overlay\.open #detailContent \{\s*padding-top: 0 !important;\s*padding-left: 0 !important;\s*padding-right: 0 !important;/
  );
});
