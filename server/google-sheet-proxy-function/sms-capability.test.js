"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { __test } = require("./index");

test("알리고 응답의 성공·실패 코드를 숫자로 정규화한다", () => {
  assert.equal(__test.parseAligoResultCode({ result_code: "1" }), 1);
  assert.equal(__test.parseAligoResultCode({ result_code: -101 }), -101);
});

test("알리고 응답 코드가 없거나 잘못되면 안전한 실패 코드로 처리한다", () => {
  assert.equal(__test.parseAligoResultCode({}), -9999);
  assert.equal(__test.parseAligoResultCode({ result_code: "invalid" }), -9999);
});
