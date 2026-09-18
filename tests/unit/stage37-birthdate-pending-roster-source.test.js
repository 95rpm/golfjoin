"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const markup = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/markup/20-main.html"), "utf8");
const authSource = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"), "utf8");
const reservationSource = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css"), "utf8");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");

test("조인 회원가입과 추가정보는 전체 생년월일을 받는다", () => {
  assert.match(markup, /id="joinMemberSignupBirthYear"[^>]*aria-label="출생 연도"/);
  assert.match(markup, /id="joinMemberSignupBirthMonth"[^>]*aria-label="출생 월"/);
  assert.match(markup, /id="joinMemberSignupBirthDay"[^>]*aria-label="출생 일"/);
  assert.match(markup, /type="hidden" id="joinMemberSignupBirthDate"/);
  assert.match(authSource, /birthDate:\s*getJoinMemberSignupBirthDate\(\)/);
  assert.match(authSource, /"birthday",/);
  assert.match(authSource, /birthday:\s*birthDate/);
  assert.match(reservationSource, /id="joinProfileManageBirthYear"[^>]*aria-label="출생 연도"/);
  assert.match(reservationSource, /id="joinProfileManageBirthMonth"[^>]*aria-label="출생 월"/);
  assert.match(reservationSource, /id="joinProfileManageBirthDay"[^>]*aria-label="출생 일"/);
  assert.match(reservationSource, /const birthDate = getJoinProfileManageBirthDate\(\)/);
  assert.match(reservationSource, /\bbirthDate,\s*\r?\n/);
});

test("프로필 관리 생년월일 수정은 아래로 열리는 커스텀 연·월·일 드롭다운을 사용한다", () => {
  assert.match(
    reservationSource,
    /const birthSelects = field\.closest\("\.join-profile-birth-selects"\)\?\.querySelectorAll\("select"\) \|\| \[\];[\s\S]*?birthSelects\.forEach\(\(select\) => \{[\s\S]*?setJoinProfileManageBirthSelectDisabled\(select, false\)/
  );
  assert.match(reservationSource, /function upgradeJoinProfileManageBirthDropdowns\(scope = document\)/);
  assert.match(reservationSource, /trigger\.className = "join-profile-birth-trigger"/);
  assert.match(reservationSource, /menu\.setAttribute\("role", "listbox"\)/);
  assert.match(css, /\.join-profile-birth-select\s*\{[\s\S]*?font-size:\s*18px;/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.join-profile-birth-select\s*\{\s*font-size:\s*16px;/);
  assert.match(css, /\.join-profile-birth-menu\s*\{[\s\S]*?top:\s*calc\(100% \+ 6px\)/);
  assert.match(css, /\.join-profile-birth-trigger:disabled\s*\{[\s\S]*?background:\s*transparent/);
});

test("출생연도만 저장된 기존 회원은 약관동의 화면으로 되돌리지 않는다", () => {
  assert.match(authSource, /const hasLegacyBirthYear = \/\^\\d\{4\}\$\/\.test/);
  assert.match(authSource, /!getJoinMemberBirthDate\(member\) && !hasLegacyBirthYear/);
  assert.match(authSource, /profileId:\s*profile\.profileId \|\| member\.profileId \|\| ""/);
  assert.match(authSource, /function composeJoinMemberSignupBirthDate\(\)/);
  assert.match(authSource, /const birthDate = getJoinMemberSignupBirthDate\(\)/);
  assert.match(authSource, /const validBirthDate = \/\^\\d\{8\}\$\/\.test\(birthDate\)/);
});

test("전체 생년월일이 없는 기존 프로필은 전용 연월일 입력창에서만 보완한다", () => {
  assert.match(authSource, /function isJoinMemberBirthDateUpgradeRequired\(member = \{\}\)/);
  assert.match(authSource, /const hasExistingProfile = Boolean\(String\(member\.profileId/);
  assert.match(authSource, /id=\"joinMemberBirthDateUpgradeYear\"/);
  assert.match(authSource, /id=\"joinMemberBirthDateUpgradeMonth\"/);
  assert.match(authSource, /id=\"joinMemberBirthDateUpgradeDay\"/);
  assert.match(authSource, /function buildJoinMemberBirthDateUpgradePayload/);
  assert.match(authSource, /birthDate,\s*\r?\n\s*gender:[\s\S]*?requiredAgreed:\s*true/);
  assert.match(authSource, /await updateSecretTourMemberProfile\(payload, member\)/);
  assert.match(authSource, /await saveJoinMemberProfileWithConfirmation\(payload, member\)/);
  assert.match(authSource, /promptJoinPendingRosterCandidates\(\{ source: \"birthdate-upgrade\" \}\)/);
  assert.match(authSource, /<header class="join-member-birthdate-upgrade-header">/);
  assert.doesNotMatch(authSource, /id="joinMemberBirthDateUpgradeTitle">추가정보 입력<\/h2>/);
  assert.match(authSource, /<div class="join-member-birthdate-upgrade-title" id="joinMemberBirthDateUpgradeTitle">생년월일을 입력해주세요\.<\/div>/);
  assert.doesNotMatch(authSource, /id="joinMemberBirthDateUpgradeTitle">[^<]*<\/h2>/);
  assert.match(authSource, /class="join-member-birthdate-upgrade-description">원활한 여행 예약을 위해 생년월일이 필요해요\.<\/p>/);
  assert.doesNotMatch(authSource, /join-member-birthdate-upgrade-prompt/);
  assert.doesNotMatch(authSource, /join-member-birthdate-upgrade-label/);
  assert.doesNotMatch(authSource, /연도, 월, 일을 모두 선택해 주세요\./);
  assert.match(css, /\.join-member-birthdate-upgrade-modal/);
  assert.match(css, /\.join-member-birthdate-upgrade-header\s*\{[\s\S]*?justify-content:\s*flex-end/);
  assert.match(css, /\.join-member-birthdate-upgrade-header\s*\{[\s\S]*?justify-content:\s*flex-end;[\s\S]*?background:\s*#fff;/);
  assert.doesNotMatch(css, /\.join-member-birthdate-upgrade-header\s*\{[^}]*border-bottom:/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.join-member-birthdate-upgrade-header\s*\{[\s\S]*?min-height:\s*50px;/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.join-member-birthdate-upgrade-content\s*\{\s*padding:\s*0 20px calc\(22px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(css, /\.join-member-birthdate-upgrade-title\s*\{[\s\S]*?padding:\s*0;[\s\S]*?border-bottom:\s*0;[\s\S]*?color:\s*#000000;[\s\S]*?text-align:\s*left;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.join-member-birthdate-upgrade-title\s*\{\s*font-size:\s*20px;/);
  assert.match(css, /\.join-member-birthdate-upgrade-description\s*\{\s*margin:\s*0 0 10px;/);
  assert.match(css, /\.join-member-birthdate-upgrade-helper:empty\s*\{\s*display:\s*none/);
});

test("관리자 명단은 연락처 미정과 8자리 생년월일을 같은 행에서 입력한다", () => {
  assert.match(dashboard, /data-roster-field="contactPending"/);
  assert.match(dashboard, /class="roster-pending-check"[\s\S]*?<span>확인 전<\/span>/);
  assert.doesNotMatch(dashboard, /<span class="roster-field-label">미정 여부<\/span>/);
  assert.match(dashboard, /\.roster-grid\s*\{[^}]*grid-template-columns:[^;}]*76px/);
  assert.match(dashboard, /\.roster-pending-check\s*\{[\s\S]*?border:\s*0;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(dashboard, /data-roster-field="birthDate" placeholder="예: 19630824"/);
  assert.match(dashboard, /item\.birthDate\s*=\s*getRosterEditorBirthDate\(\{ birthDate: item\.birthDate \}\)/);
  assert.match(dashboard, /생년월일 8자리\(예: 19630824\)/);
  assert.match(dashboard, /contactPending:\s*Boolean\(item\.contactPending\)/);
  assert.match(dashboard, /!\/\^\\d\{8\}\$\/\.test\(item\.birthDate\)/);
});

test("과거 일정 확인 UI는 후보 조회 후 수락·거절을 명시적으로 저장한다", () => {
  assert.match(authSource, /member_pending_roster_candidates/);
  assert.match(authSource, /member_pending_roster_decide/);
  assert.match(authSource, /맞아요, 내 일정이에요/);
  assert.match(authSource, /나중에 확인하기/);
  assert.match(reservationSource, /promptJoinPendingRosterCandidates\(\{\s*source: "my-reservations"/);
  assert.match(css, /\.join-pending-roster-modal/);
});
