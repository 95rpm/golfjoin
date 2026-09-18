"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const frontendPaths = {
  auth: path.join(root, "src", "golfjoin-main", "source", "scripts", "member", "34-member-auth-profile-wishes.js"),
  loading: path.join(root, "src", "golfjoin-main", "source", "scripts", "loading", "33-loading-and-modal-layer.js"),
  boot: path.join(root, "src", "golfjoin-main", "source", "scripts", "boot", "40-initialize.js"),
  request: path.join(root, "src", "golfjoin-main", "source", "scripts", "detail", "37-detail-builder-calendar.js"),
  markup: path.join(root, "src", "golfjoin-main", "source", "markup", "20-main.html"),
  style: path.join(root, "src", "golfjoin-main", "source", "styles", "10-main.css")
};
const frontendSourceAvailable = Object.values(frontendPaths).every((filePath) => fs.existsSync(filePath));
const readFrontendSource = (filePath) => frontendSourceAvailable
  ? fs.readFileSync(filePath, "utf8")
  : "";
const frontendTest = frontendSourceAvailable
  ? test
  : (name, fn) => test(name, {
    skip: "프런트 원본이 포함되지 않은 서버 전용 배포 폴더에서는 로컬 브라우저 소스 검사를 건너뜁니다."
  }, fn);
const authSource = readFrontendSource(frontendPaths.auth);
const loadingSource = readFrontendSource(frontendPaths.loading);
const bootSource = readFrontendSource(frontendPaths.boot);
const requestSource = readFrontendSource(frontendPaths.request);
const markupSource = readFrontendSource(frontendPaths.markup);
const styleSource = readFrontendSource(frontendPaths.style);
const serverSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

frontendTest("일반 로그인 SMS 인증은 HOME 회원만 허용하고 빈 allowlist는 전체 HOME 회원에 적용한다", () => {
  assert.match(loadingSource, /window\.GOLFJOIN_MEMBER_SMS_AUTH_ENABLED === true/);
  assert.match(loadingSource, /window\.GOLFJOIN_MEMBER_SIGNUP_PHONE_AUTH_ENABLED === true/);
  assert.match(authSource, /GOLFJOIN_MEMBER_SMS_AUTH_MEMBER_SEQS/);
  assert.match(authSource, /memberChannel !== "HOME"/);
  assert.match(authSource, /if \(!normalizedAllowlist\.length\) return true/);
  assert.match(authSource, /isJoinMemberSmsAuthEnabledFor\(member\)/);
});

frontendTest("로그인 성공 뒤 OTP 시작·검증·재전송 UI를 연결한다", () => {
  assert.match(authSource, /getMemberLoginCheck\.json[\s\S]{0,1200}beginJoinMemberSmsAuth/);
  assert.match(authSource, /!member\.memberSeq \|\| !member\.memberName \|\| !member\.memberMobile[\s\S]{0,240}fetchJoinMemberProfileFromGoogleSheet\(member, \{ refresh: true \}\)[\s\S]{0,180}mergeJoinMemberIdentity/);
  assert.match(authSource, /member_auth_start/);
  assert.match(authSource, /member_auth_verify/);
  assert.match(authSource, /verifiedAuthResult\?\.memberKey[\s\S]{0,120}\^seq:\(\\d\+\)\$[\s\S]{0,220}state\.member = \{ \.\.\.state\.member, memberSeq: verifiedMemberSeq \}/);
  assert.match(authSource, /member_auth_refresh/);
  assert.match(authSource, /member_auth_logout/);
  assert.match(markupSource, /id="joinMemberOtpCode"/);
  assert.match(markupSource, /autocomplete="one-time-code"/);
  assert.match(markupSource, /id="joinMemberOtpTimer"[^>]*>03:00</);
  assert.match(markupSource, /join-member-otp-input-wrap[\s\S]{0,500}id="joinMemberOtpResendButton"[^>]*hidden>재전송</);
  assert.doesNotMatch(markupSource, />인증번호 다시 받기</);
  assert.match(authSource, /result\.expiresIn \|\| 180/);
  assert.match(authSource, /resendButton\.hidden = remainingSeconds > 0/);
  assert.match(authSource, /Number\(state\.expiresAt \|\| 0\) > Date\.now\(\)/);
  assert.match(authSource, /const codeComplete = \/\^\\d\{6\}\$\/\.test\(String\(input\?\.value \|\| ""\)\)/);
  assert.match(authSource, /verifyButton\.disabled = Boolean\(busy\) \|\| expired \|\| Boolean\(state\?\.locked\) \|\| !codeComplete/);
  assert.match(authSource, /setJoinMemberOtpBusy\(joinMyMenuState\.smsAuthBusy\)/);
  assert.match(styleSource, /\.join-member-otp-form \.join-member-login-button\.signup:disabled\s*\{[\s\S]{0,180}background:\s*#f1f3f5;[\s\S]{0,120}color:\s*#adb5bd;/);
  assert.match(styleSource, /\.join-member-otp-resend\s*\{[\s\S]{0,240}height:\s*36px;[\s\S]{0,240}background:\s*#54abff;/);
});

frontendTest("OTP 시작 실패 시 남은 ERP 로그인 쿠키와 로컬 회원 상태를 되돌린다", () => {
  assert.match(authSource, /async function rollbackJoinMemberErpLoginAfterSmsAuthFailure/);
  assert.match(authSource, /\/member\/logout\.json/);
  assert.match(authSource, /credentials: "include"/);
  assert.match(authSource, /await rollbackJoinMemberErpLoginAfterSmsAuthFailure\(\)/);
  assert.match(authSource, /sessionStorage\.removeItem\(JOIN_SESSION_MEMBER_KEY\)/);
});

frontendTest("제한 회원은 OTP 전에 ERP 세션을 끊고 새로고침하면 비로그인 메인으로 복구한다", () => {
  assert.match(authSource, /setJoinMemberAuthPendingLogin\(member\)/);
  assert.match(authSource, /clearJoinMemberErpLoginForSmsAuth\(\{ clearPending: false, revokeAuthSession: true \}\)/);
  assert.match(authSource, /resetPendingJoinMemberSmsAuthOnStartup/);
  assert.match(bootSource, /await resetPendingJoinMemberSmsAuthOnStartup\(\)/);
  assert.match(authSource, /location\.replace\(getJoinLoggedOutMainUrl\(\)\)/);
  assert.match(authSource, /isJoinMemberSmsAuthEnabledFor\(renderedMember\)[\s\S]{0,120}!readJoinMemberAuthSession\(\)/);
  assert.match(authSource, /postJoinMemberLoginForm\("\/member\/getMemberLoginCheck\.json", erpLogin\)/);
  assert.match(authSource, /setJoinSessionMember\(verifiedMember\)/);
});

frontendTest("암호화 로그인 값은 OTP 현재 메모리에만 두고 공통 로딩을 사용한다", () => {
  assert.match(authSource, /erpLogin: options\.erpLogin/);
  assert.match(authSource, /openJoinActionLoading\("인증번호를 보내고 있어요"/);
  assert.match(authSource, /openJoinActionLoading\("인증번호를 다시 보내고 있어요"/);
  assert.doesNotMatch(authSource, /(?:sessionStorage|localStorage)\.setItem\([^\n]*(custPw|erpLogin|encryptedPassword)/);
});

frontendTest("OTP 화면은 로그인 헤더와 입력 필드 체계를 공유한다", () => {
  assert.match(markupSource, /id="joinMemberOtpForm" aria-labelledby="joinMemberLoginTitle"/);
  assert.doesNotMatch(markupSource, /join-member-otp-heading/);
  assert.match(markupSource, /class="join-member-email-field" for="joinMemberOtpCode"/);
  assert.match(markupSource, /class="join-member-login-button signup" id="joinMemberOtpVerifyButton"/);
});

frontendTest("OTP 안내는 회원가입 타이틀·설명 체계를 공유하고 휴대폰을 소문자 x로 표시한다", () => {
  assert.match(markupSource, /join-member-signup-step-title[^>]*>인증번호가 발송됐어요</);
  assert.match(markupSource, /join-member-signup-step-desc[^>]*id="joinMemberOtpDestination"/);
  assert.match(authSource, /formatJoinMemberOtpDestinationHint\(result\.destinationHint\)/);
  assert.match(authSource, /-xxxx-/);
});

frontendTest("일반 회원가입 휴대폰은 3분 OTP·70대30 UI·인증완료 배지와 저장 직전 검증을 사용한다", () => {
  assert.match(markupSource, /id="joinMemberSignupPhoneSendButton"[^>]*>인증하기</);
  assert.match(markupSource, /id="joinMemberSignupPhoneAuthRow"[^>]*hidden/);
  assert.match(markupSource, /id="joinMemberSignupPhoneCode"[^>]*autocomplete="one-time-code"/);
  assert.match(markupSource, /id="joinMemberSignupPhoneTimer"[^>]*>03:00</);
  assert.match(markupSource, /id="joinMemberSignupPhoneVerifiedBadge"[^>]*hidden[^>]*>인증완료</);
  assert.match(authSource, /member_signup_phone_start/);
  assert.match(authSource, /member_signup_phone_verify/);
  assert.match(authSource, /member_signup_phone_assert/);
  assert.match(authSource, /member_signup_phone_complete/);
  assert.match(authSource, /mobileInput\.disabled\s*=\s*verified/);
  assert.match(styleSource, /join-member-signup-phone-auth-row[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\) 76px/);
  assert.match(styleSource, /join-member-signup-phone-timer[\s\S]{0,220}font-size:\s*16px/);
  assert.match(styleSource, /@media \(max-width:\s*640px\)[\s\S]{0,180}join-member-signup-phone-auth-row[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\) 72px/);
  assert.match(styleSource, /join-member-signup-phone-send-button,[\s\S]{0,120}join-member-signup-phone-verify-button,[\s\S]{0,120}join-member-signup-phone-verified-badge[\s\S]{0,180}height:\s*36px;[\s\S]{0,80}padding:\s*0 12px;/);
  assert.match(styleSource, /join-member-signup-phone-send-button\[hidden\][\s\S]{0,180}display:\s*none !important/);
  assert.match(authSource, /sendButton\.hidden\s*=\s*!required\s*\|\|\s*verified/);
  assert.doesNotMatch(authSource, /(?:sessionStorage|localStorage)\.setItem\([^\n]*(verificationToken|signupPhoneAuth)/i);
});

frontendTest("브라우저에는 OTP 원문을 저장하지 않고 탭 세션 토큰만 저장한다", () => {
  assert.match(authSource, /sessionStorage\.setItem\(JOIN_MEMBER_AUTH_SESSION_KEY, JSON\.stringify\(session\)\)/);
  assert.doesNotMatch(authSource, /sessionStorage\.setItem\([^\n]*(otpCode|challengeId|memberMobile)/i);
  assert.doesNotMatch(authSource, /localStorage\.setItem\([^\n]*(accessToken|refreshToken)/i);
});

frontendTest("회원 전용 읽기와 쓰기 요청은 선택적으로 Bearer 토큰을 첨부한다", () => {
  assert.match(authSource, /return accessToken \? \{ "Authorization": `Bearer \$\{accessToken\}` \} : \{\}/);
  assert.match(requestSource, /getJoinMemberAuthRequestHeaders/);
  assert.match(requestSource, /postGolfJoinSheetPayload[\s\S]{0,900}memberAuthHeaders/);
  assert.match(requestSource, /fetchGolfJoinSheetRows[\s\S]{0,900}memberAuthHeaders/);
  assert.match(requestSource, /postGolfJoinSheetAction[\s\S]{0,900}memberAuthHeaders/);
});

test("서버 Gate는 개인 읽기·회원 쓰기·회원 범위 GET을 모두 감싼다", () => {
  assert.match(serverSource, /GOLFJOIN_MEMBER_AUTH_GATE/);
  assert.match(serverSource, /member_profile_lookup[\s\S]{0,220}applyMemberAuthGate/);
  assert.match(serverSource, /join_wishes_lookup[\s\S]{0,220}applyMemberAuthGate/);
  assert.match(serverSource, /home_bootstrap[\s\S]{0,220}applyMemberAuthGate/);
  assert.match(serverSource, /\["new_schedule_builder", "join_apply", "join_member_profile", "join_review", "join_wish"\][\s\S]{0,220}applyMemberAuthGate/);
  assert.match(serverSource, /hasMemberLookupParams\(req\.query[\s\S]{0,220}applyMemberAuthGate/);
});

test("enforce Gate는 토큰 memberSeq를 기준으로 요청 회원을 고정한다", () => {
  assert.match(serverSource, /member_token_mismatch/);
  assert.match(serverSource, /bindVerifiedMemberIdentity/);
  assert.match(serverSource, /memberKey = `seq:\$\{memberSeq\}`/);
  assert.match(serverSource, /readOnly[\s\S]{0,260}delete next\[key\]/);
});
