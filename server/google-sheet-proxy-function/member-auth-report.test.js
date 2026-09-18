"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { __test } = require("./index");

test("회원 인증 Report 식별자는 비밀키 HMAC으로만 가명화한다", () => {
  const secret = "member-auth-report-test-secret-32-bytes-minimum";
  const first = __test.createMemberAuthReportRef("30002047", secret);
  const repeated = __test.createMemberAuthReportRef("30002047", secret);
  const anotherMember = __test.createMemberAuthReportRef("30002183", secret);
  const anotherSecret = __test.createMemberAuthReportRef("30002047", `${secret}-rotated`);

  assert.match(first, /^[a-f0-9]{20}$/);
  assert.equal(first, repeated);
  assert.notEqual(first, anotherMember);
  assert.notEqual(first, anotherSecret);
  assert.equal(first.includes("30002047"), false);
  assert.equal(__test.createMemberAuthReportRef("30002047", "short"), "");
  assert.equal(__test.createMemberAuthReportRef("", secret), "");
});

test("Report 로그는 원문 회원번호 대신 요청·검증 가명값만 기록한다", () => {
  const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  const reportBlock = source.match(/function writeMemberAuthReport[\s\S]*?\n}\n\nfunction bindVerifiedMemberIdentity/);

  assert.ok(reportBlock, "writeMemberAuthReport block");
  assert.match(reportBlock[0], /claimedMemberRef:\s*createMemberAuthReportRef\(claimedMemberSeq\)/);
  assert.match(reportBlock[0], /verifiedMemberRef:\s*createMemberAuthReportRef\(verifiedMemberSeq\)/);
  assert.doesNotMatch(reportBlock[0], /memberSeq\s*:/);
  assert.doesNotMatch(reportBlock[0], /memberMobile|memberEmail|phone|email/i);
});
