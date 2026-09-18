"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const detailSource = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");
const authSource = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"), "utf8");
const deepLinkSource = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"), "utf8");

test("참여 로그인에는 통합 상품과 선택 기간 식별값을 모두 보존한다", () => {
  assert.match(detailSource, /function getJoinApplyResumeParams\(/);
  assert.match(detailSource, /\.\.\.\(productFamilyId \? \{ productFamilyId \} : \{\}\)/);
  assert.match(detailSource, /\.\.\.\(goodSeq \? \{ goodSeq \} : \{\}\)/);
  assert.match(detailSource, /\.\.\.\(eventSeq \? \{ eventSeq \} : \{\}\)/);
  assert.match(detailSource, /requireJoinLogin\("apply", applyResumeParams\)/);
  assert.match(authSource, /"productFamilyId"/);
});

test("카카오 로그인 복귀는 상품 데이터와 선택 기간을 복원한 뒤 신청창을 연다", () => {
  assert.match(detailSource, /async function restoreJoinApplyTarget\(/);
  assert.match(detailSource, /await hydrateAdminRecommendedSchedulesFromGoogleSheet\(\)/);
  assert.match(detailSource, /option\.goodSeq === goodSeq && option\.eventSeq === eventSeq/);
  assert.match(authSource, /openGlobalApply\(\{ resumeParams: params, skipProfileCheck: true \}\)/);
  assert.match(deepLinkSource, /resumeParams: \{ applyJoinId, goodSeq, eventSeq, productFamilyId \}/);
});

test("신청 대상이 없으면 잘못된 기본 상품으로 신청창을 열지 않는다", () => {
  assert.match(detailSource, /if \(!applyJoin\) \{[\s\S]*신청할 상품 정보를 확인하지 못했습니다\.[\s\S]*return false;/);
  assert.match(detailSource, /if \(options\.resumeParams && !await restoreJoinApplyTarget\(options\.resumeParams\)\)/);
});
