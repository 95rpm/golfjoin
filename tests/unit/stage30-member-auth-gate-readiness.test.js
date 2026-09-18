"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const serverSource = fs.readFileSync(path.join(root, "server/google-sheet-proxy-function/index.js"), "utf8");
const memberSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"), "utf8");
const detailSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");
const bootSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/boot/40-initialize.js"), "utf8");
const configSource = fs.readFileSync(path.join(root, "tools/golfjoin-main/stage30-configure-member-auth-gate.py"), "utf8");

test("카카오 인증 교환은 회원 데이터 로딩 전에 완료된다", () => {
  const exchangeIndex = bootSource.indexOf("await ensureJoinKakaoMemberAuthSessionOnStartup()");
  const dataIndex = bootSource.indexOf("runGolfJoinHomeDataV2Startup()");
  assert.ok(exchangeIndex >= 0);
  assert.ok(dataIndex > exchangeIndex);
  assert.match(memberSource, /postGolfJoinMemberAuthAction\("member_kakao_auth_exchange"/);
  assert.match(memberSource, /storeJoinMemberAuthSession\(result\)/);
});

test("회원 조회와 쓰기 공통 경로는 현재 회원과 일치하는 Bearer 토큰만 전송한다", () => {
  assert.match(memberSource, /session\.memberKey !== `seq:\$\{memberSeq\}`/);
  assert.match(memberSource, /return accessToken \? \{ "Authorization": `Bearer \$\{accessToken\}` \} : \{\}/);
  assert.match(detailSource, /postGolfJoinSheetPayload[\s\S]*?getJoinMemberAuthRequestHeaders\(payload\?\.member/);
  assert.match(detailSource, /fetchGolfJoinSheetRows[\s\S]*?hasJoinMemberLookupParams\(params\)[\s\S]*?getJoinMemberAuthRequestHeaders\(\)/);
  assert.match(detailSource, /postGolfJoinSheetAction[\s\S]*?getJoinMemberAuthRequestHeaders\(\)/);
});

test("서버 Gate는 report에서 무차단 기록하고 enforce에서 회원번호를 토큰으로 고정한다", () => {
  assert.match(serverSource, /GOLFJOIN_MEMBER_AUTH_GATE === "report"[\s\S]*?writeMemberAuthReport[\s\S]*?return payload/);
  assert.match(serverSource, /claimedMemberSeq && claimedMemberSeq !== identity\.memberSeq[\s\S]*?member_token_mismatch/);
  assert.match(serverSource, /return bindVerifiedMemberIdentity\(payload, identity, options\)/);
  assert.match(serverSource, /hasMemberLookupParams\(req\.query[\s\S]*?applyMemberAuthGate/);
  assert.match(serverSource, /\["new_schedule_builder", "join_apply", "join_member_profile", "join_review", "join_wish"\][\s\S]*?applyMemberAuthGate/);
});

test("Gate 전환 도구는 세 모드만 허용하고 필수 인증 설정이 없으면 중단한다", () => {
  assert.match(configSource, /ALLOWED_GATES = \("off", "report", "enforce"\)/);
  assert.match(configSource, /enabled != "Y"/);
  assert.match(configSource, /len\(secret\.encode\("utf-8"\)\) < 32/);
  assert.match(configSource, /if not bucket/);
  assert.match(configSource, /os\.replace\(temporary, path\)/);
  assert.doesNotMatch(configSource, /print\([^\n]*(?:secret|SECRET)/);
});
