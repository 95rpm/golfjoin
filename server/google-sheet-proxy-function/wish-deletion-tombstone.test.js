"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

function functionBlock(name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} 함수가 필요합니다.`);
  assert.ok(end > start, `${name} 함수 끝을 찾을 수 없습니다.`);
  return source.slice(start, end);
}

test("회원 찜 조회는 deleted 표식을 숨기지 않고 브라우저에 전달한다", () => {
  const sheetsApiRead = functionBlock(
    "readJoinWishesForMemberViaSheetsApi",
    "readJoinWishesForMemberViaAppsScript"
  );
  const appsScriptRead = functionBlock(
    "readJoinWishesForMemberViaAppsScript",
    "readJoinWishesForMemberWithSource"
  );

  assert.match(sheetsApiRead, /rowMatchesJoinWishLookup/);
  assert.doesNotMatch(sheetsApiRead, /status[^\n]*active/i);
  assert.match(appsScriptRead, /sheet:\s*"join_wishes"/);
  assert.doesNotMatch(appsScriptRead, /status:\s*"active"/);
});

test("회원 홈 부트스트랩도 active와 deleted 찜을 함께 반환한다", () => {
  const start = source.indexOf("const wishes = canReadWishes");
  const end = source.indexOf("return {", start);
  assert.ok(start >= 0 && end > start, "홈 부트스트랩 찜 조회 블록이 필요합니다.");
  const block = source.slice(start, end);

  assert.match(block, /rowMatchesJoinWishLookup/);
  assert.doesNotMatch(block, /status[^\n]*active/i);
});
