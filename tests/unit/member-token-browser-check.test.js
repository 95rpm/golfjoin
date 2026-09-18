"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const CHECK_SOURCE = fs.readFileSync(
  path.join(ROOT_DIR, "tools", "golfjoin-main", "check-secret-tour-member-token.browser.js"),
  "utf8"
);

test("회원 토큰 점검기는 same-origin·no-store와 5분 수명을 검증한다", () => {
  assert.match(CHECK_SOURCE, /credentials:\s*"same-origin"/);
  assert.match(CHECK_SOURCE, /cache:\s*"no-store"/);
  assert.match(CHECK_SOURCE, /maximumLifetimeSeconds\s*=\s*5\s*\*\s*60/);
  assert.match(CHECK_SOURCE, /claims\.iss\s*===\s*expectedIssuer/);
  assert.match(CHECK_SOURCE, /includesAudience\(claims\.aud,\s*expectedAudience\)/);
  assert.match(CHECK_SOURCE, /claims\.memberKey\s*===\s*`seq:\$\{claims\.sub\s*\|\|\s*""\}`/);
  assert.match(CHECK_SOURCE, /String\(header\.alg\)\.toLowerCase\(\)\s*!==\s*"none"/);
});

test("회원 토큰 점검 결과는 토큰 원문과 개인정보 값을 포함하지 않는다", () => {
  assert.match(CHECK_SOURCE, /forbiddenClaimPattern\s*=\s*\/\(phone\|mobile\|email\|birthday\|birth\|gender\|name\)\/i/);
  assert.doesNotMatch(CHECK_SOURCE, /console\.(?:log|info|warn|error)\([^\n]*,\s*token\s*\)/);
  assert.match(CHECK_SOURCE, /subPresent:\s*Boolean\(claims\.sub\)/);
  assert.match(CHECK_SOURCE, /memberKeyMatchesSub:/);
  assert.doesNotMatch(CHECK_SOURCE, /claims:\s*claims\b/);
});
