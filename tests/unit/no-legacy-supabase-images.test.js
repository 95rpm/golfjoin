"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const legacyHost = "cauhemhvdwlkxalwxxxq.supabase.co";
const activeFiles = [
  "golfjoin_main.html",
  "src/golfjoin-main/source/markup/20-main.html",
  "src/golfjoin-main/source/shell/40-suffix.html",
  "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js",
  "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"
];

test("현재 메인 소스는 폐기된 Supabase 이미지 호스트를 요청하지 않는다", () => {
  for (const relativePath of activeFiles) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.equal(
      source.includes(legacyHost),
      false,
      `${relativePath} contains retired image host`
    );
  }
});

test("상세 이미지가 없으면 외부 요청 없이 내부 대체 이미지를 사용한다", () => {
  const source = fs.readFileSync(
    path.join(root, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
    "utf8"
  );
  assert.match(source, /const inlineFallback = "data:image\/svg\+xml/);
  assert.match(source, /return \[join\.image \|\| inlineFallback\]/);
  assert.match(source, /return join\.image \? \[join\.image\] : \[\]/);
});
