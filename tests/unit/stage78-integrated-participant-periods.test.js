const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const server = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"), "utf8");
const serverTest = require(path.join(ROOT, "server/google-sheet-proxy-function/index.js")).__test;

const integratedSchedule = {
  productFamilyId: "pf_monthly",
  erpProductId: "30001287",
  erpEventSeq: "30286551",
  departureDateFrom: "2027-01-16",
  returnDateFrom: "2027-01-21",
  capacity: "60",
  familyOptionsJson: JSON.stringify([
    { goodSeq: "30001287", eventSeq: "30286551", durationLabel: "4박6일", departureDate: "2027-01-16", returnDate: "2027-01-21", capacity: 30 },
    { goodSeq: "30001288", eventSeq: "30286552", durationLabel: "7박9일", departureDate: "2027-01-16", returnDate: "2027-01-24", capacity: 30 }
  ])
};

test("v78 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const scripts = [...dashboard.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  assert.equal(scripts.length, 1);
  scripts.forEach((script) => assert.doesNotThrow(() => new vm.Script(script)));
});

test("v78 일정관리 기간 열은 통합 추천일정의 모든 기간을 표시한다", () => {
  assert.match(dashboard, /function getSchedulePeriodLabel\(schedule = \{\}\)/);
  assert.match(dashboard, /getScheduleFamilyPeriodOptions\(schedule\)\.map\(\(option\) => option\.durationLabel\)/);
  assert.match(dashboard, /<td>\$\{escapeHtml\(getSchedulePeriodLabel\(schedule\)\)\}<\/td>/);
});

test("v78 멤버보기는 ERP 상품·행사 ID 기준으로 기간별 표와 요약을 나눈다", () => {
  assert.match(dashboard, /function getParticipantFamilyOptionId\(row = \{\}\)/);
  assert.match(dashboard, /option\.optionId === optionId/);
  assert.match(dashboard, /function getParticipantPeriodGroups\(schedule = \{\}\)/);
  assert.match(dashboard, /data-family-option-id=/);
  assert.match(dashboard, /기간 확인 필요/);
  assert.match(dashboard, /group\.option\.durationLabel.*group\.counts\.active.*group\.option\.capacity/s);
});

test("v78 참여자 추가는 기간 선택 후 선택 ERP 식별값을 저장 요청에 포함한다", () => {
  assert.match(dashboard, /async function chooseRosterFamilyPeriod\(schedule, participant = null\)/);
  assert.match(dashboard, /title: participant \? "참여 기간 확인" : "참여 기간 선택"/);
  assert.match(dashboard, /selectedFamilyOptionId: selectedOption\.optionId/);
  assert.match(dashboard, /getAdminRosterSchedulePayload\(rosterEditorSchedule, rosterEditorPeriodOption\)/);
});

test("v78 서버는 선택 기간을 등록 상품군에서 검증하고 기간별 정원만 검사한다", () => {
  assert.match(server, /function resolveAdminRosterFamilyOption\(canonical = \{\}, payload = \{\}\)/);
  assert.match(server, /recommended_family_option_required/);
  assert.match(server, /const selectedFamilyOption = resolveAdminRosterFamilyOption\(canonical, payload\)/);
  assert.match(server, /buildRecommendedFamilyOptionParticipantSummary\(canonical\.schedule, capacityRows, selectedFamilyOption\)/);
  assert.match(server, /buildAdminRosterScheduleSnapshot\(canonical, context\.product \|\| \{\}, context\.selectedFamilyOption \|\| null\)/);
});

test("v78 선택 기간의 날짜와 ERP 식별값이 참여신청 행에 저장된다", () => {
  assert.match(server, /selectedFamilyOption\?\.departureDate \|\| schedule\.departureDateFrom/);
  assert.match(server, /selectedFamilyOption\?\.returnDate \|\| schedule\.returnDateFrom/);
  assert.match(server, /selectedFamilyOption\?\.goodSeq \|\| schedule\.erpProductId/);
  assert.match(server, /selectedFamilyOption\?\.eventSeq \|\| schedule\.erpEventSeq/);
});

test("v78 서버 기간 선택은 등록된 ERP 상품·행사 조합만 허용한다", () => {
  const canonical = { schedule: integratedSchedule };
  const selected = serverTest.resolveAdminRosterFamilyOption(canonical, {
    erpProductId: "30001288",
    erpEventSeq: "30286552"
  });
  assert.equal(selected.durationLabel, "7박9일");
  assert.throws(
    () => serverTest.resolveAdminRosterFamilyOption(canonical, { erpProductId: "99999999", erpEventSeq: "39999999" }),
    (error) => error?.status === 400 && error?.code === "recommended_family_option_required"
  );
});

test("v78 관리자 참여자 스냅샷은 선택 기간의 날짜와 ERP 식별값을 사용한다", () => {
  const canonical = {
    schedule: integratedSchedule,
    targetType: "recommended_schedule",
    targetScheduleId: "admin-recommended-rs-monthly",
    targetApplicationId: "rs-monthly",
    targetJoinId: "admin-recommended-rs-monthly"
  };
  const selected = serverTest.resolveAdminRosterFamilyOption(canonical, {
    erpProductId: "30001288",
    erpEventSeq: "30286552"
  });
  const snapshot = serverTest.buildAdminRosterScheduleSnapshot(canonical, {}, selected);
  assert.equal(snapshot.erpProductId, "30001288");
  assert.equal(snapshot.erpEventSeq, "30286552");
  assert.equal(snapshot.departureDate, "2027-01-16");
  assert.equal(snapshot.returnDate, "2027-01-24");
  assert.equal(snapshot.durationLabel, "7박9일");
});
