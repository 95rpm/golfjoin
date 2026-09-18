"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { __test } = require("./index");

function template(type, gender = "") {
  return __test.resolveGolfjoinAlimtalkTemplate(type, { gender });
}

function buttons(type, info = {}) {
  return JSON.parse(__test.getAlimtalkButtons(type, info)).button;
}

test("성별에 따라 생성·참여·견적 알림톡 템플릿을 정확히 선택한다", () => {
  assert.deepEqual(
    [template("create", "남성").code, template("create", "여성").code],
    ["UK_1065", "UK_1064"]
  );
  assert.deepEqual(
    [template("join", "M").code, template("join", "F").code],
    ["UK_1066", "UK_1068"]
  );
  assert.deepEqual(
    [template("quote", "male").code, template("quote", "female").code],
    ["UK_1075", "UK_1077"]
  );
  assert.equal(template("complete").code, "UK_1074");
  assert.equal(template("create", ""), null);
});

test("등록된 알림톡 템플릿 제목을 그대로 사용한다", () => {
  assert.equal(template("create", "남성").templateName, "조인생성완료_이미지형_남");
  assert.equal(template("create", "여성").templateName, "조인생성완료_이미지형_여");
  assert.equal(template("join", "남성").templateName, "조인참여완료_이미지형_남");
  assert.equal(template("join", "여성").templateName, "조인참여완료_이미지형_여");
  assert.equal(template("complete").templateName, "조인모집완료_이미지형_남여");
  assert.equal(template("quote", "남성").templateName, "견적서발송완료_이미지형_남");
  assert.equal(template("quote", "여성").templateName, "견적서발송완료_이미지형_여");
});

test("등록된 알림톡 버튼명을 상황별로 그대로 사용한다", () => {
  assert.equal(buttons("create", { gender: "남성", reservationTab: "created", scheduleId: "sch_create" })[1].name, "내 모임 확인하기");
  assert.equal(buttons("join", { gender: "여성", reservationTab: "joined", scheduleId: "sch_join" })[1].name, "조인 모임 확인하기");
  assert.equal(buttons("complete", { scheduleId: "sch_complete" })[1].name, "모임 정보 확인하기");
  assert.equal(buttons("quote", { gender: "남성", quoteUrl: "https://example.com/quote" })[1].name, "견적서 확인하기");
});

test("생성·참여·모집완료·견적 본문은 새 승인 문구와 변수를 사용한다", () => {
  const info = {
    gender: "여성",
    customerName: "홍길순",
    productName: "테스트 상품",
    region: "태국 치앙마이",
    departureDate: "2026-09-01(화)",
    returnDate: "2026-09-04(금)",
    people: "2명"
  };
  const create = __test.buildGolfjoinAlimtalkMessage("create", info);
  const join = __test.buildGolfjoinAlimtalkMessage("join", info);
  const complete = __test.buildGolfjoinAlimtalkMessage("complete", info);
  const quote = __test.buildGolfjoinAlimtalkMessage("quote", info);

  assert.match(create, /■ 모임 정보/);
  assert.doesNotMatch(create, /■ 신청 정보/);
  assert.match(join, /조인모임 참여 신청이 완료되었어요/);
  assert.match(complete, /함께 떠날 분들이 모두 모여/);
  assert.match(complete, /■ 항공권 예약 안내/);
  assert.match(complete, /- 모집 인원: 2명/);
  assert.match(quote, /신청하신 모임의 견적서가 도착했어요/);
  assert.match(quote, /아래 ‘견적서 확인하기’ 버튼을 눌러/);
  [create, join, complete, quote].forEach((message) => {
    assert.match(message, /홍길순님/);
    assert.match(message, /테스트 상품/);
    assert.match(message, /태국 치앙마이/);
  });
});

test("생성·참여 딥링크는 각 탭과 모임 ID를 포함한다", () => {
  const scheduleId = "sch_test_123";
  const created = buttons("create", { gender: "남성", reservationTab: "created", scheduleId })[1];
  const joined = buttons("join", { gender: "여성", reservationTab: "joined", scheduleId })[1];

  assert.equal(new URL(created.linkPc).searchParams.get("golfjoinTab"), "created");
  assert.equal(new URL(created.linkMo).searchParams.get("golfjoinTab"), "created");
  assert.equal(new URL(joined.linkPc).searchParams.get("golfjoinTab"), "joined");
  assert.equal(new URL(joined.linkMo).searchParams.get("golfjoinTab"), "joined");
  [created.linkPc, created.linkMo, joined.linkPc, joined.linkMo].forEach((value) => {
    const url = new URL(value);
    assert.equal(url.searchParams.get("golfjoinOpen"), "my-section");
    assert.equal(url.searchParams.get("scheduleId"), scheduleId);
  });
});

test("모집완료 모바일과 PC는 승인 템플릿의 www complete 딥링크다", () => {
  const scheduleId = "sch_complete_456";
  const link = buttons("complete", { scheduleId })[1];
  assert.equal(new URL(link.linkMo).origin, "https://www.secret-tour.com");
  assert.equal(new URL(link.linkPc).origin, "https://www.secret-tour.com");
  [link.linkMo, link.linkPc].forEach((value) => {
    const url = new URL(value);
    assert.equal(url.pathname, "/event/plan_view");
    assert.equal(url.searchParams.get("eventPlanSeq"), "3");
    assert.equal(url.searchParams.get("page"), "1");
    assert.equal(url.searchParams.get("golfjoinOpen"), "my-section");
    assert.equal(url.searchParams.get("golfjoinTab"), "complete");
    assert.equal(url.searchParams.get("scheduleId"), scheduleId);
  });
});

test("견적 알림톡 버튼은 보호된 HTTPS 견적서 링크를 사용한다", () => {
  const quoteUrl = "https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api?action=quote_view&quoteId=quote_123&token=abc";
  const link = buttons("quote", { gender: "남성", quoteUrl })[1];
  assert.equal(link.name, "견적서 확인하기");
  assert.equal(link.linkPc, link.linkMo);
  assert.equal(new URL(link.linkPc).protocol, "https:");
  assert.equal(new URL(link.linkPc).searchParams.get("quoteId"), "quote_123");
});

test("견적 행을 알림톡 변수로 정규화한다", () => {
  const info = __test.getAlimtalkQuoteInfo({
    applicantName: "테스트",
    applicantMobile: "010-1234-5678",
    applicantGender: "여성",
    applicantPeople: "3",
    country: "태국",
    region: "치앙마이",
    productName: "치앙마이 골프",
    departureDateFrom: "2026-09-01",
    returnDateTo: "2026-09-05",
    quotePageUrl: "https://example.com/quote"
  });
  assert.equal(info.phone, "01012345678");
  assert.equal(info.gender, "여성");
  assert.equal(info.people, "3명");
  assert.equal(info.region, "태국 치앙마이");
  assert.equal(info.departureDate, "2026-09-01(화)");
  assert.equal(info.returnDate, "2026-09-05(토)");
});
