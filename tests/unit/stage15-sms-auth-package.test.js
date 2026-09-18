"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(
  root,
  "deploy/stage15-sms-member-auth/all-home-settled-layout-20260818-v28"
);
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readRecord(name) {
  const record = manifest.files[name];
  assert.ok(record?.fileName, `${name} fileName`);
  const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
  assert.equal(buffer.length, record.bytes, `${name} bytes`);
  assert.equal(sha256(buffer), record.sha256, `${name} sha256`);
  return { record, buffer };
}

test("15단계 패키지는 전체 HOME 회원과 만료 후 재전송 UI를 활성화하고 서버 Gate를 OFF로 유지한다", () => {
  assert.equal(manifest.schema, "secret-golf-join-stage15-sms-member-auth-v1");
  assert.equal(manifest.limitedMemberSeq, "30002219");
  assert.equal(manifest.stagingEventPlanSeq, 28);
  assert.equal(manifest.memberAuthGateTarget, "off");
  assert.equal(manifest.memberAuthSessionTtlSeconds, 86400);
  assert.equal(manifest.loginOtpTtlSeconds, 180);
  assert.equal(manifest.pendingAuthenticationRefreshBehavior, "logout-to-public-home");
  assert.equal(manifest.signupPhoneVerificationIncluded, true);
  assert.equal(manifest.signupPhoneOtpTtlSeconds, 180);
  assert.equal(manifest.kakaoEnforceReady, false);
  assert.equal(manifest.kakaoSessionExchangeIncluded, true);
  assert.deepEqual(manifest.kakaoAllowedAppIds, ["906676"]);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("배포·복구·서버 파일은 모두 선언한 해시와 일치한다", () => {
  [
    "deployHtml",
    "rollbackHtml",
    "css",
    "js",
    "auditJs",
    "serverIndex",
    "serverAuth",
    "serverKakaoAuth",
    "serverKakaoAuthTest",
    "serverAuthTest",
    "serverAuthBrowserTest",
    "serverAuthIntegrationTest",
    "privateCacheTest",
    "configureEnv",
    "sourcePackageManifest",
    "runbook"
  ].forEach(readRecord);
});

test("압축 자산은 논리 파일·SRI·예산과 일치한다", () => {
  const css = readRecord("css");
  const js = readRecord("js");
  const auditJs = readRecord("auditJs");
  const cssLogical = zlib.gunzipSync(css.buffer);
  const jsLogical = zlib.brotliDecompressSync(js.buffer);
  assert.equal(sha256(cssLogical), css.record.logicalSha256);
  assert.equal(sha256(jsLogical), js.record.logicalSha256);
  assert.deepEqual(jsLogical, auditJs.buffer);
  assert.ok(js.buffer.length <= manifest.javascriptBudgetBytes);
  new vm.Script(jsLogical.toString("utf8"), { filename: "stage15-audit.js" });
});

test("회원가입 휴대폰 인증 버튼은 파란 기본 스타일을 유지하고 hover 규칙이 없다", () => {
  const css = zlib.gunzipSync(readRecord("css").buffer).toString("utf8");
  const sizeRule = css.match(/\.join-member-signup-phone-send-button,\s*\.join-member-signup-phone-verify-button,\s*\.join-member-signup-phone-verified-badge\s*\{([^}]*)\}/);
  const sharedRule = css.match(/\.join-member-signup-phone-send-button,\s*\.join-member-signup-phone-verify-button\s*\{([^}]*)\}/);
  assert.ok(sizeRule, "signup phone button size rule");
  assert.ok(sharedRule, "signup phone button shared rule");
  assert.match(sharedRule[1], /background:\s*#54abff\s*;/);
  assert.match(sharedRule[1], /color:\s*#ffffff\s*;/);
  assert.match(sizeRule[1], /font-size:\s*16px\s*;/);
  assert.match(sizeRule[1], /font-weight:\s*600\s*;/);
  assert.doesNotMatch(css, /\.join-member-signup-phone-(?:send|verify)-button:hover/);
});

test("전체 HOME 배포 HTML은 만료 후 재전송 UI·빈 allowlist·신규 불변 자산을 참조한다", () => {
  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /id="joinMemberOtpForm"/);
  assert.match(html, /id="joinMemberOtpTimer"[^>]*>03:00</);
  assert.match(html, /window\.GOLFJOIN_MEMBER_SMS_AUTH_ENABLED = true/);
  assert.match(html, /window\.GOLFJOIN_MEMBER_SMS_AUTH_MEMBER_SEQS = \[\]/);
  assert.match(html, /id="joinMemberOtpResendButton"[^>]*hidden>재전송</);
  assert.doesNotMatch(html, />인증번호 다시 받기</);
  assert.match(html, /window\.GOLFJOIN_MEMBER_SIGNUP_PHONE_AUTH_ENABLED = true/);
  assert.match(html, /id="joinMemberSignupPhoneSendButton"/);
  assert.match(html, /id="joinMemberSignupPhoneTimer"[^>]*>03:00</);
  assert.match(html, new RegExp(manifest.assetRevision));
  assert.match(html, /data-golfjoin-critical-css=/);
  assert.doesNotMatch(html, new RegExp(manifest.sourceAssetRevision));
  assert.doesNotMatch(html, /cauhemhvdwlkxalwxxxq\.supabase\.co/);
  assert.doesNotMatch(readRecord("auditJs").buffer.toString("utf8"), /cauhemhvdwlkxalwxxxq\.supabase\.co/);
});

test("복구 HTML은 현재 C821B0D1 운영본과 바이트 단위로 같다", () => {
  const rollback = readRecord("rollbackHtml").buffer;
  const sourceManifest = JSON.parse(readRecord("sourcePackageManifest").buffer.toString("utf8"));
  const production = fs.readFileSync(path.join(
    root,
    "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25",
    sourceManifest.files.deployHtml.fileName
  ));
  assert.deepEqual(rollback, production);
  assert.equal(sha256(rollback), "c821b0d138f66f8a85396865784caddb5f0733337d2326e27022b5e8e5ff5d45");
});

test("v20 서버 파일은 당시 배포 해시와 문법을 보존한 고정 스냅샷이다", () => {
  const serverIndex = readRecord("serverIndex");
  const serverAuth = readRecord("serverAuth");
  const serverKakaoAuth = readRecord("serverKakaoAuth");
  [serverIndex, serverAuth, serverKakaoAuth].forEach(({ record, buffer }) => {
    assert.equal(sha256(buffer), record.sha256);
    new vm.Script(buffer.toString("utf8"), { filename: record.fileName });
  });
});

test("24시간 인증 정책과 새로고침 로그아웃 정책을 환경설정 파일에 고정한다", () => {
  const configureEnv = readRecord("configureEnv").buffer.toString("utf8");
  assert.match(configureEnv, /GOLFJOIN_MEMBER_SESSION_TTL_SECONDS\": \"86400\"/);
  assert.match(configureEnv, /GOLFJOIN_MEMBER_OTP_TTL_SECONDS\": \"180\"/);
  assert.match(configureEnv, /GOLFJOIN_MEMBER_SIGNUP_OTP_TTL_SECONDS\": \"180\"/);
  assert.match(configureEnv, /GOLFJOIN_MEMBER_AUTH_GATE\": \"off\"/);
  assert.match(configureEnv, /GOLFJOIN_KAKAO_AUTH_ENABLED\": \"Y\"/);
  assert.match(configureEnv, /GOLFJOIN_KAKAO_ALLOWED_APP_IDS\": \"906676\"/);
});
