"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const indexSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

test("카카오 재가입 완료 action은 private 독립 경로에서 검증 세션을 발급한다", () => {
  assert.match(indexSource, /privateActions = new Set\(\[[\s\S]{0,700}"member_kakao_signup_complete"/);
  assert.match(indexSource, /standaloneActions = new Set\(\[[\s\S]{0,700}"member_kakao_signup_complete"/);
  assert.match(indexSource, /req\.query\?\.action === "member_kakao_signup_complete"/);
  assert.match(indexSource, /golfjoinMemberKakaoSignup\.complete\(readBody\(req\)\)/);
});

test("같은 카카오 식별자의 탈퇴 전 프로필은 새 행 대신 재가입 ERP 회원번호로 갱신한다", () => {
  assert.match(indexSource, /function findKakaoRejoinProfileIndex\(rows = \[\], payload = \{\}\)/);
  assert.match(indexSource, /const kakaoRejoinProfileIndex = findKakaoRejoinProfileIndex\(rows, payload\)/);
  assert.match(indexSource, /temporaryProfileIndex >= 0 \? temporaryProfileIndex : kakaoRejoinProfileIndex/);
});
