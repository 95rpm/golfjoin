"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const BOOT_SOURCE = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/boot/40-initialize.js"),
  "utf8"
);

test("페이지뷰 준비 신호는 렌더 쿠키와 카카오 인증 동기화가 끝난 뒤 실행한다", () => {
  const cookieReady = BOOT_SOURCE.indexOf("await waitForRenderedCookieDataReady()");
  const kakaoReady = BOOT_SOURCE.indexOf("await ensureJoinKakaoMemberAuthSessionOnStartup()");
  const analyticsReady = BOOT_SOURCE.indexOf("markGolfJoinGa4MemberStateReady()");

  assert.ok(cookieReady >= 0);
  assert.ok(kakaoReady > cookieReady);
  assert.ok(analyticsReady > kakaoReady);
});
