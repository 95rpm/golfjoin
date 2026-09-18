"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

function extractFunction(functionName) {
  const declaration = `function ${functionName}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const bodyStart = source.indexOf(") {", start) + 2;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

function createSandbox() {
  return {
    asText: (value) => String(value || "").trim(),
    normalizePhone: (value) => String(value || "").replace(/\D/g, ""),
    sha256: (value) => crypto.createHash("sha256").update(String(value), "utf8").digest("hex")
  };
}

function extractCompanionGroupFunctions() {
  return [
    "getParticipantMemberIdentityMarkers",
    "getParticipantApplicationCompanionGroup",
    "getCreatorOwnedParticipantCompanionGroup"
  ].map(extractFunction).join("\n");
}

test("생성자와 같은 회원의 멤버 추가만 생성자 동행 그룹을 만든다", () => {
  const sandbox = createSandbox();
  vm.runInNewContext(`${extractCompanionGroupFunctions()}; globalThis.resolve = getCreatorOwnedParticipantCompanionGroup;`, sandbox);
  const schedule = {
    scheduleId: "sch_test",
    memberSeq: "30002047",
    memberId: "2783624471",
    memberMobile: "010-1111-2222"
  };
  assert.equal(sandbox.resolve({ memberSeq: "30002047" }, schedule), "creator-party-sch_test");
  assert.equal(sandbox.resolve({ memberId: "2783624471" }, schedule), "creator-party-sch_test");
  assert.equal(sandbox.resolve({ applicantMobile: "01011112222" }, schedule), "creator-party-sch_test");
  assert.equal(sandbox.resolve({ memberSeq: "30002183", memberMobile: "01099998888" }, schedule), "");
});

test("서버 참여자 요약은 생성자 본인 추가 시 생성자와 추가 멤버를 같은 그룹으로 묶는다", () => {
  const sandbox = {
    ...createSandbox(),
    MAX_PARTICIPANT_PREVIEW_COUNT: 40,
    isCancelledJoinApplication: () => false,
    getParticipantSummaryKey: () => "new_schedule|sch_test",
    findJoinApplicationTargetSchedule: (_row, schedules) => schedules[0],
    getScheduleCapacity: () => 4,
    parsePeopleCount: (value) => Math.max(1, Number(value) || 1),
    buildParticipantPreviewList: (row, count) => Array.from({ length: count }, (_, index) => ({
      displayName: index === 0 ? (row.applicantName || row.memberName || "참여자") : `일행${index}`,
      gender: index === 0 ? (row.applicantGender || "남성") : "여성",
      companionGroup: Number(row.applicantPeople || row.creatorPeople || 1) > 1 ? String(row.applicationId || row.scheduleId || "") : ""
    })),
    countParticipantSummaryGenders: (participants) => participants.reduce((counts, participant) => {
      if (participant.gender === "여성") counts.female += 1;
      else counts.male += 1;
      return counts;
    }, { male: 0, female: 0 }),
    countParticipantSummaryAgeDecades: () => ({}),
    mergeParticipantSummaryAgeDecades: (current) => current || {},
    isManageableRecommendedScheduleRule: () => true,
    buildRecommendedScheduleSummarySource: (value) => value,
    getRecommendedScheduleFamilyOptions: () => [],
    buildRecommendedFamilyOptionParticipantSummary: () => ({}),
    getParticipantSummaryTargetType: () => "new_schedule",
    normalizeCanonicalErpProductId: (value) => value || "",
    normalizeCanonicalErpEventSeq: (value) => value || ""
  };
  vm.runInNewContext(`${extractCompanionGroupFunctions()}
    ${extractFunction("buildParticipantSummaries")}
    globalThis.build = buildParticipantSummaries;`, sandbox);
  const schedule = {
    scheduleId: "sch_test",
    applicationId: "nsa_test",
    memberSeq: "30002047",
    memberName: "생성자",
    applicantPeople: "1"
  };
  const ownerAddition = {
    applicationId: "ja_owner",
    targetScheduleId: "sch_test",
    memberSeq: "30002047",
    applicantName: "생성자",
    applicantPeople: "2"
  };
  const [summary] = sandbox.build([ownerAddition], [schedule], []);
  assert.equal(summary.confirmedCount, 3);
  assert.deepEqual(
    Array.from(summary.participantsPreview, (participant) => participant.companionGroup),
    ["creator-party-sch_test", "creator-party-sch_test", "creator-party-sch_test"]
  );
});

test("다른 이용자의 동행 참여는 생성자 그룹과 분리한다", () => {
  const sandbox = createSandbox();
  vm.runInNewContext(`${extractCompanionGroupFunctions()}; globalThis.resolve = getCreatorOwnedParticipantCompanionGroup;`, sandbox);
  assert.equal(sandbox.resolve(
    { memberSeq: "30002183", applicationId: "ja_other" },
    { memberSeq: "30002047", scheduleId: "sch_test" }
  ), "");
});

test("같은 B 이용자의 두 참여 신청은 생성자와 분리된 하나의 회원 동행 그룹을 사용한다", () => {
  const sandbox = {
    ...createSandbox(),
    MAX_PARTICIPANT_PREVIEW_COUNT: 40,
    isCancelledJoinApplication: () => false,
    getParticipantSummaryKey: () => "new_schedule|sch_test",
    findJoinApplicationTargetSchedule: (_row, schedules) => schedules[0],
    getScheduleCapacity: () => 4,
    parsePeopleCount: (value) => Math.max(1, Number(value) || 1),
    buildParticipantPreviewList: (row, count) => Array.from({ length: count }, (_, index) => ({
      displayName: index === 0 ? row.applicantName : `일행${index}`,
      gender: "남성",
      iconSeed: `${row.applicationId}-${index}`,
      companionGroup: ""
    })),
    countParticipantSummaryGenders: (participants) => ({ male: participants.length, female: 0 }),
    countParticipantSummaryAgeDecades: () => ({}),
    mergeParticipantSummaryAgeDecades: (current) => current || {},
    isManageableRecommendedScheduleRule: () => true,
    buildRecommendedScheduleSummarySource: (value) => value,
    getRecommendedScheduleFamilyOptions: () => [],
    buildRecommendedFamilyOptionParticipantSummary: () => ({}),
    getParticipantSummaryTargetType: () => "new_schedule",
    normalizeCanonicalErpProductId: (value) => value || "",
    normalizeCanonicalErpEventSeq: (value) => value || ""
  };
  vm.runInNewContext(`${extractCompanionGroupFunctions()}
    ${extractFunction("buildParticipantSummaries")}
    globalThis.build = buildParticipantSummaries;`, sandbox);
  const schedule = {
    scheduleId: "sch_test",
    applicationId: "nsa_test",
    memberSeq: "creator-seq",
    memberName: "생성자",
    applicantPeople: "1"
  };
  const rows = [
    { applicationId: "ja_b_first", targetScheduleId: "sch_test", memberSeq: "b-seq", applicantName: "B", applicantPeople: "1" },
    { applicationId: "ja_b_added", targetScheduleId: "sch_test", memberSeq: "b-seq", applicantName: "B", applicantPeople: "1" }
  ];
  const [summary] = sandbox.build(rows, [schedule], []);
  assert.equal(summary.confirmedCount, 3);
  const groups = Array.from(summary.participantsPreview, (participant) => participant.companionGroup);
  assert.equal(groups[0], "");
  assert.match(groups[1], /^member-party-sch_test-/);
  assert.equal(groups[2], groups[1]);
});
