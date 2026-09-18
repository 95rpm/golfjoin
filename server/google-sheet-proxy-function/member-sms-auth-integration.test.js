"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

test("member SMS auth has login and signup public lifecycle actions plus one private delivery action", () => {
  [
    "member_auth_start",
    "member_auth_verify",
    "member_auth_refresh",
    "member_auth_logout",
    "member_signup_phone_start",
    "member_signup_phone_verify",
    "member_signup_phone_assert",
    "member_signup_phone_complete",
    "send_member_sms_otp"
  ].forEach((action) => assert.match(source, new RegExp(`action === ["']${action}["']`)));
});

test("private Aligo role can deliver OTP while the main role cannot", () => {
  assert.match(source, /GOLFJOIN_SERVICE_ROLE === "aligo"[\s\S]{0,240}"send_member_sms_otp"/);
  assert.match(source, /GOLFJOIN_SERVICE_ROLE === "main"[\s\S]{0,240}"send_member_sms_otp"/);
  assert.match(source, /send_member_sms_otp["']\) \{[\s\S]{0,200}isInternalServiceRequest/);
});

test("OTP Cloud Tasks는 로그인과 회원가입 challenge ID를 모두 허용한다", () => {
  assert.match(source, /\^\(\?:gmc\|gspc\)_\[A-Za-z0-9_-\]\{16,\}\$/);
  assert.doesNotMatch(source, /\^gmc_\[A-Za-z0-9_-\]\{16,\}\$/);
});

test("browser auth responses are no-store and Authorization is allowed by CORS", () => {
  assert.match(source, /Access-Control-Allow-Headers[\s\S]{0,180}Authorization/);
  assert.match(source, /privateActions = new Set\(\[[\s\S]{0,260}"member_auth_start"/);
  assert.match(source, /privateActions = new Set\(\[[\s\S]{0,360}"member_auth_refresh"/);
  assert.match(source, /privateActions = new Set\(\[[\s\S]{0,600}"member_signup_phone_complete"/);
});

test("member auth uses a dedicated secret and private bucket configuration", () => {
  assert.match(source, /GOLFJOIN_MEMBER_AUTH_SECRET/);
  assert.match(source, /GOLFJOIN_MEMBER_AUTH_BUCKET/);
  assert.match(source, /new GcsMemberAuthStore/);
  assert.doesNotMatch(source, /createMemberSmsAuthService\(\{[\s\S]{0,300}secret:\s*ADMIN_READ_TOKEN/);
  assert.doesNotMatch(source, /createMemberSmsAuthService\(\{[\s\S]{0,300}secret:\s*GOLFJOIN_INTERNAL_SERVICE_TOKEN/);
});
