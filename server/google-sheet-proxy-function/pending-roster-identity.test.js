"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { __test } = require("./index");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

test("관리자 명단은 신규 전체 생년월일과 기존 6자리 생년월일을 모두 정규화한다", () => {
  assert.equal(__test.parseAdminRosterBirthDate("1963-08-24").birthDate, "19630824");
  assert.equal(__test.parseAdminRosterBirthDate("1963-08-24").birthYear, "1963");
  assert.equal(__test.parseAdminRosterBirthDate("630824").birthDate, "19630824");
  assert.throws(() => __test.parseAdminRosterBirthDate("20260230"), /생년월일/);
});

test("연락처 미정 참여자는 전화번호 없이 정상 참여자로 검증되고 임시 프로필을 만들지 않는다", () => {
  const participant = __test.validateAdminRosterParticipant({
    name: "홍길동",
    contactPending: true,
    phone: "",
    birthDate: "19630824",
    gender: "남성",
    roomType: "2인1실",
    flightRequestType: "대행요청",
    level: "초보",
    rosterItemId: "roster_pending_1"
  }, 0);
  assert.equal(participant.contactPending, true);
  assert.equal(participant.phone, "");
  assert.equal(participant.birthDate, "19630824");
  assert.equal(__test.buildAdminTemporaryProfileRow(participant, {}, "", 0), null);
});

test("연락처가 확정된 관리자 참여자는 전화번호가 필수다", () => {
  assert.throws(() => __test.validateAdminRosterParticipant({
    name: "홍길동",
    contactPending: false,
    phone: "",
    birthDate: "19630824",
    gender: "남성",
    roomType: "2인1실",
    flightRequestType: "대행요청",
    rosterItemId: "roster_known_1"
  }, 0), /phone is required/);
});

test("연락처 미정 참여 기록은 이름·전체 생년월일·성별이 모두 같을 때만 후보가 된다", () => {
  const row = {
    registrationSource: "admin",
    identityMatchStatus: "contact_pending",
    applicantName: "홍 길동",
    applicantBirthDate: "19630824",
    applicantGender: "남성",
    applicationId: "ja_pending_1",
    productName: "치앙마이 골프 3박5일",
    departureDate: "2026-10-01",
    returnDate: "2026-10-05"
  };
  assert.equal(__test.rowMatchesPendingRosterProfile(row, {
    memberName: "홍길동",
    birthDate: "19630824",
    gender: "남"
  }), true);
  assert.equal(__test.rowMatchesPendingRosterProfile(row, {
    memberName: "홍길동",
    birthDate: "19630825",
    gender: "남성"
  }), false);
  assert.equal(__test.rowMatchesPendingRosterProfile(row, {
    memberName: "홍길동",
    birthDate: "19630824",
    gender: "여성"
  }), false);
});

test("후보 조회·확정 action은 회원 토큰이 필요한 private POST로 라우팅한다", () => {
  for (const action of ["member_pending_roster_candidates", "member_pending_roster_decide"]) {
    assert.match(source, new RegExp(`"${action}"`));
  }
  assert.match(source, /getVerifiedMemberIdentity\(req\)/);
  assert.match(source, /identityLinkedMethod:\s*"name_birthdate_gender_confirmed"/);
  assert.match(source, /identityRejectedMemberKeysJson/);
});
