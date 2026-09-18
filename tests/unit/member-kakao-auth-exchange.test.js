"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const memberSource = fs.readFileSync(path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"
), "utf8");
const bootSource = fs.readFileSync(path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/boot/40-initialize.js"
), "utf8");

test("Kakao startup restores the SDK token once and exchanges it before home data starts", () => {
  assert.match(memberSource, /KakaoSdk\?\.Auth\?\.getAccessToken\?\.\(\)/);
  assert.match(memberSource, /postGolfJoinMemberAuthAction\("member_kakao_auth_exchange"/);
  assert.match(memberSource, /storeJoinMemberAuthSession\(result\)/);
  assert.doesNotMatch(memberSource, /setAccessToken\(null\)/);
  const resetIndex = bootSource.indexOf("resetPendingJoinMemberSmsAuthOnStartup");
  const exchangeIndex = bootSource.indexOf("ensureJoinKakaoMemberAuthSessionOnStartup");
  const dataIndex = bootSource.indexOf("runGolfJoinHomeDataV2Startup");
  assert.ok(resetIndex >= 0 && exchangeIndex > resetIndex && dataIndex > exchangeIndex);
});

test("member requests attach only a session matching the current memberSeq", () => {
  assert.match(memberSource, /session\.memberKey !== `seq:\$\{memberSeq\}`/);
  assert.match(memberSource, /Authorization.*Bearer \$\{accessToken\}/);
});
