"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const DETAIL = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);
const DETAIL_ACTIONS = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/39-detail-actions-participants.js"),
  "utf8"
);
const MEMBER = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"),
  "utf8"
);
const RESERVATIONS = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"),
  "utf8"
);

function extract(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} start`);
  assert.ok(end > start, `${name} end`);
  return source.slice(start, end);
}

test("새 모임 시작은 모든 진입 경로가 공유하는 실제 모달 열림 지점에서 한 번 기록한다", () => {
  const openModal = extract(DETAIL, "openModal", "elevateBuilderProductDetailModal");
  const mobileCreate = extract(RESERVATIONS, "handleJoinMobileCreateClick", "handleJoinMobileFindClick");
  const openFromMain = extract(DETAIL, "openBuilderModalFromMain", "resetDetailModalScroll");

  assert.match(openModal, /wasAlreadyOpen/);
  assert.match(openModal, /id === "builderModal"/);
  assert.match(openModal, /trackGolfJoinGa4Event\("golfjoin_create_start"/);
  assert.match(openFromMain, /analyticsSourceArea:\s*getBuilderGa4SourceArea\(trigger\)/);
  assert.doesNotMatch(mobileCreate, /golfjoin_create_start/);
});

test("모든 상품·모임 상세는 공통 상세 모달 열림 지점에서 view_item을 기록한다", () => {
  const openModal = extract(DETAIL, "openModal", "elevateBuilderProductDetailModal");
  const openDetail = extract(DETAIL_ACTIONS, "openDetail", "openBuilderDetail");

  assert.match(openModal, /id === "detailModal"/);
  assert.match(openModal, /trackGolfJoinGa4Event\("golfjoin_detail_view"/);
  assert.match(openModal, /item_type:/);
  assert.doesNotMatch(openDetail, /golfjoin_detail_view/);
  assert.match(openDetail, /analyticsSourceArea:/);
});

test("참여 완료는 서버 확정 직후, 화면 참여자 재조합보다 먼저 한 번 기록한다", () => {
  const submit = extract(DETAIL, "submitGlobalApply", "ensurePhonePrefix");
  const accepted = submit.indexOf("acceptScheduleMutationResponse(saveResponse, applyPayload)");
  const tracked = submit.indexOf('trackGolfJoinGa4EventOnce(');
  const reconciled = submit.indexOf("attachJoinApplicationParticipantMarkersFromMutation");
  const completeUi = submit.indexOf("showGlobalApplyCompleteState()");

  assert.ok(accepted >= 0);
  assert.ok(tracked > accepted);
  assert.ok(reconciled > tracked);
  assert.ok(completeUi > tracked);
  assert.match(submit, /`join_apply:\$\{applyPayload\.joinApplyId/);
  assert.match(submit, /getGolfJoinGa4Item\(applyPayload\.join\)/);
  assert.doesNotMatch(submit, /getGolfJoinGa4Item\(getCurrentApplyJoin\(\)\)/);
  assert.match(submit, /participant_count:\s*Number\(people \|\| 1\)/);
});

test("새 모임 완료도 서버 확정 직후 로컬 카드 반영보다 먼저 기록한다", () => {
  const submit = extract(DETAIL, "submitBuilderApply", "updateBuilderAgreeCollapsedLayout");
  const accepted = submit.indexOf("acceptScheduleMutationResponse(saveResponse, payload)");
  const tracked = submit.indexOf('trackGolfJoinGa4EventOnce(');
  const upserted = submit.indexOf("upsertBuilderApplicationJoin(payload");

  assert.ok(accepted >= 0);
  assert.ok(tracked > accepted);
  assert.ok(upserted > tracked);
  assert.match(submit, /`new_schedule:\$\{payload\.applicationId/);
  assert.match(submit, /item_type:\s*"join_schedule"/);
  assert.match(submit, /participant_count:/);
  assert.match(submit, /builder_step:\s*"complete"/);
});

test("새 모임 내부 단계는 실제 단계 전환마다 한 번씩 기록한다", () => {
  const setStep = extract(DETAIL, "setBuilderStep", "updateBuilderBottomOffset");
  const openModal = extract(DETAIL, "openModal", "elevateBuilderProductDetailModal");
  const submit = extract(DETAIL, "submitBuilderApply", "updateBuilderAgreeCollapsedLayout");
  const confirm = extract(DETAIL, "openApplySubmitConfirmModal", "closeApplySubmitConfirmModal");

  assert.match(setStep, /trackGolfJoinBuilderStep\(step\)/);
  assert.match(openModal, /golfJoinBuilderGa4Steps\.clear\(\)/);
  assert.match(openModal, /golfJoinBuilderGa4SourceArea = options\.analyticsSourceArea/);
  assert.match(submit, /trackGolfJoinBuilderStep\("submit_start"\)/);
  assert.match(confirm, /trackGolfJoinBuilderStep\("review"\)/);
});

test("참여 신청 내부 단계는 폼·확인·제출·완료 지점에만 기록한다", () => {
  const open = extract(DETAIL, "openGlobalApply", "refreshGlobalApplyProductDataInBackground");
  const submit = extract(DETAIL, "submitGlobalApply", "ensurePhonePrefix");
  const confirm = extract(DETAIL, "openApplySubmitConfirmModal", "closeApplySubmitConfirmModal");

  assert.match(open, /golfJoinApplyGa4Steps\.clear\(\)/);
  assert.match(open, /trackGolfJoinApplyStep\("form_view"\)/);
  assert.match(confirm, /trackGolfJoinApplyStep\("review"\)/);
  assert.match(submit, /trackGolfJoinApplyStep\("submit_start"/);
  assert.match(submit, /trackGolfJoinApplyStep\("complete"/);
  assert.match(submit, /apply_step:\s*"complete"/);
});

test("이메일 로그인 시작·성공과 비밀번호 재설정은 서로 다른 행동으로 집계한다", () => {
  const resetPassword = extract(MEMBER, "submitJoinMemberResetPassword", "checkJoinMemberSignupDuplicates");
  const emailLogin = extract(MEMBER, "submitJoinMemberEmailLogin", "normalizeJoinMemberPhone");
  const otp = extract(MEMBER, "submitJoinMemberOtpCode", "resendJoinMemberOtpCode");

  assert.doesNotMatch(resetPassword, /golfjoin_login_start/);
  assert.match(emailLogin, /golfjoin_login_start/);
  assert.ok(emailLogin.indexOf("golfjoin_login_start") < emailLogin.indexOf('postJoinMemberLoginForm("/member/getMemberLoginCheck.json"'));
  assert.match(emailLogin, /trackGolfJoinGa4Event\("login", \{ method: "email", member_state: "homepage" \}\)/);
  assert.ok(otp.indexOf('setJoinSessionMember(verifiedMember)') < otp.indexOf('trackGolfJoinGa4Event("login", { method: "email", member_state: "homepage" })'));
});

test("카카오 로그인과 신규가입은 실제 성공 결과에 따라 분리한다", () => {
  const kakaoLogin = extract(MEMBER, "submitJoinMemberKakaoLogin", "redirectToJoinLogin");
  const finish = extract(MEMBER, "finishJoinMemberSignupAndContinue", "setJoinMemberLoginStatus");
  const profileSave = extract(MEMBER, "saveJoinMemberKakaoProfileAndContinue", "buildJoinMemberProfilePayload");

  assert.match(kakaoLogin, /golfjoin_login_start/);
  assert.match(kakaoLogin, /trackGolfJoinGa4Event\("login", \{ method: "kakao", member_state: "kakao" \}\)/);
  assert.match(finish, /options\.trackSignup === true/);
  assert.match(finish, /options\.trackLogin === true/);
  assert.match(profileSave, /trackSignup:\s*options\.trackSignup === true/);
  assert.match(profileSave, /trackLogin:\s*options\.trackLogin === true/);
});

test("찜 목록 삭제도 상세 삭제와 별도로 삭제 행동을 기록한다", () => {
  const remove = extract(RESERVATIONS, "executeJoinWishRemove", "handleJoinMyTripClick");
  assert.match(remove, /golfjoin_wish_remove/);
  assert.match(remove, /source_area:\s*"wish_list"/);
});

test("상품상세 찜 추가·삭제는 상세 유입으로 기록한다", () => {
  const toggleWish = extract(DETAIL_ACTIONS, "handleDetailWish", "getDetailShortUrlEndpoint");
  assert.match(toggleWish, /golfjoin_wish_add/);
  assert.match(toggleWish, /golfjoin_wish_remove/);
  assert.equal((toggleWish.match(/source_area:\s*"detail"/g) || []).length, 2);
});
