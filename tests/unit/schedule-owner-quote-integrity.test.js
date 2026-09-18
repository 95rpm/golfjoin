"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const memberSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"), "utf8");
const detailSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");

function extractFunction(source, functionName) {
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

test("일정 생성자는 같은 계정의 동반자 추가 신청보다 항상 나로 우선한다", () => {
  const sandbox = {
    joins: [],
    isCurrentMemberCreatedJoinSchedule: (join) => join.owned === true,
    isJoinParticipantForCurrentMember: (participant) => participant.identityMatched === true
  };
  vm.runInNewContext(`${extractFunction(memberSource, "isJoinParticipantForCurrentMemberInSchedule")}
    globalThis.check = isJoinParticipantForCurrentMemberInSchedule;`, sandbox);

  const owned = { owned: true };
  assert.equal(sandbox.check({ isHost: true }, owned), true);
  assert.equal(sandbox.check({ identityMatched: true }, owned), false);
  assert.equal(sandbox.check({ isHost: true }, { owned: false }), false);
  assert.equal(sandbox.check({ identityMatched: true }, { owned: false }), true);
});

test("딥링크 탭은 URL보다 실제 생성·참여 관계를 우선한다", () => {
  const sandbox = {
    isJoinFullyBooked: (join) => join.full === true,
    getMyHomeJoinRelationship: (join) => join.relationship,
    normalizeMyHomeJoinFilter: (value, fallback) => ["complete", "created", "joined"].includes(value) ? value : fallback
  };
  vm.runInNewContext(`${extractFunction(memberSource, "resolveMyHomeJoinDeepLinkFilter")}
    globalThis.resolve = resolveMyHomeJoinDeepLinkFilter;`, sandbox);

  assert.equal(sandbox.resolve({ relationship: { isCreated: true, isJoined: false } }, "joined"), "created");
  assert.equal(sandbox.resolve({ relationship: { isCreated: false, isJoined: true } }, "created"), "joined");
  assert.equal(sandbox.resolve({ full: true, relationship: { isCreated: true } }, "joined"), "complete");
});

test("손상된 생성 일정의 상품명과 기간은 연결된 참여 신청의 정상값으로 복원한다", () => {
  const functions = [
    "getJoinApplicationTargetRow",
    "isJoinCanonicalIsoDate",
    "reconcileJoinCanonicalTripFromApplication"
  ].map((name) => extractFunction(detailSource, name)).join("\n");
  const sandbox = {
    getNestedValue: (object, dottedPath) => dottedPath.split(".").reduce((value, key) => value?.[key], object),
    getSecretTourProductReference: () => ({}),
    normalizeJoinCanonicalErpEventSeq: (value) => value || "",
    normalizeJoinCanonicalErpProductId: (value) => value || "",
    escapeBuilderApplicationText: (value) => String(value || "")
  };
  vm.runInNewContext(`${functions}
    globalThis.reconcile = reconcileJoinCanonicalTripFromApplication;`, sandbox);

  const join = {
    title: "비엔티안 맞춤 조인 요청",
    departureDate: "3박 5일",
    returnDate: "2026-09-21",
    duration: "골프팩"
  };
  sandbox.reconcile(join, {
    productName: "라오스 비엔티안 정상 상품",
    departureDate: "2026-09-21",
    returnDate: "2026-09-25"
  });
  assert.equal(join.title, "라오스 비엔티안 정상 상품");
  assert.equal(join.departureDate, "2026-09-21");
  assert.equal(join.returnDate, "2026-09-25");
  assert.equal(join.duration, "4박 5일");
});

test("소유 일정의 멤버추가 신청자는 생성자 회원키를 상속하지 않는다", () => {
  const applyBlock = extractFunction(detailSource, "applyJoinApplicationPayload");
  assert.match(applyBlock, /representsCurrentMember = index === 0 && !currentMemberOwnsJoin && !currentMemberMarked/);
  assert.match(applyBlock, /memberIdentity = representsCurrentMember/);
  assert.match(applyBlock, /isCurrentMember = representsCurrentMember/);
  assert.match(applyBlock, /currentMemberOwnsJoin[\s\S]*participant\?\.isHost[\s\S]*isCurrentMember: true/);
});

test("멤버추가 저장 응답의 참여자 식별키를 즉시 화면 객체에 연결한다", () => {
  const source = extractFunction(detailSource, "attachJoinApplicationParticipantMarkersFromMutation");
  const sandbox = {
    findJoinForParticipantSummary: () => ({ id: "sheet-builder-application-sch_test" }),
    findJoinForJoinApplicationPayload: () => null,
    getLightCreatorPreviewPrefixCount: () => 1,
    parseApplyPeopleValue: (value) => Number(value) || 1,
    getNestedValue: (object, dottedPath) => dottedPath.split(".").reduce((value, key) => value?.[key], object)
  };
  vm.runInNewContext(`${source}; globalThis.attach = attachJoinApplicationParticipantMarkersFromMutation;`, sandbox);
  const payload = {
    joinApplyId: "ja_test",
    applicant: { people: 2 }
  };
  const result = sandbox.attach(payload, {
    participantSummary: {
      participantsPreview: [
        { iconSeed: "preview_creator" },
        { iconSeed: "preview_applicant", companionGroup: "group_application" },
        { iconSeed: "preview_companion", companionGroup: "group_application" }
      ]
    }
  });
  assert.equal(result.participantPreviewSeed, "preview_applicant");
  assert.equal(result.participantCompanionGroup, "group_application");
  assert.equal(payload.participantPreviewSeed, undefined);
});

test("참여 완료 직후 서버 식별키를 붙인 뒤 로컬 참여자를 합친다", () => {
  const submitBlock = extractFunction(detailSource, "submitGlobalApply");
  const acceptIndex = submitBlock.indexOf("acceptScheduleMutationResponse(saveResponse, applyPayload)");
  const attachIndex = submitBlock.indexOf("attachJoinApplicationParticipantMarkersFromMutation(applyPayload, saveResponse)");
  const applyIndex = submitBlock.indexOf("applyJoinApplicationPayload(applyPayload, { persist: true })");
  const summaryIndex = submitBlock.indexOf("applyScheduleMutationParticipantResponse(saveResponse)");
  assert.ok(acceptIndex >= 0);
  assert.ok(attachIndex > acceptIndex);
  assert.ok(applyIndex > attachIndex);
  assert.ok(summaryIndex > applyIndex);
});

test("생성자 1명과 같은 신청의 멤버 2명은 서버 미리보기와 합쳐도 3명이다", () => {
  const functions = [
    "normalizeJoinParticipantApplicationMarker",
    "isUsableJoinParticipantApplicationMarker",
    "doJoinParticipantApplicationMarkersMatch",
    "getJoinParticipantApplicationMarkers",
    "hasJoinParticipantApplicationMarkerOverlap",
    "isJoinParticipantPreviewSource"
  ].map((name) => extractFunction(memberSource, name)).concat([
    extractFunction(detailSource, "mergeJoinParticipantsByIdentity"),
    extractFunction(detailSource, "applyParticipantSummaryGroupsToMaterializedParticipants")
  ]).join("\n");
  const sandbox = {
    getJoinParticipantMemberIdentity: (participant) => ({
      seq: String(participant.memberSeq || ""),
      id: String(participant.memberId || ""),
      phone: String(participant.memberMobile || ""),
      email: String(participant.memberEmail || ""),
      kakaoId: String(participant.kakaoId || "")
    })
  };
  vm.runInNewContext(`${functions}; globalThis.merge = mergeJoinParticipantsByIdentity;
    globalThis.applyGroups = applyParticipantSummaryGroupsToMaterializedParticipants;`, sandbox);
  const group = "group_application";
  const existing = [
    { id: "creator", isHost: true, isCreator: true, status: "confirmed" },
    { id: "ja_test-p1", source: "join_apply", previewSeed: "preview_applicant", companionGroup: group, status: "confirmed" },
    { id: "ja_test-p2", source: "join_apply", previewSeed: "preview_applicant", companionGroup: group, status: "confirmed" }
  ];
  const previews = [
    { id: "summary-p1", source: "participant_summary_preview", previewSeed: "preview_applicant", companionGroup: group, status: "confirmed" },
    { id: "summary-p2", source: "participant_summary_preview", previewSeed: "preview_companion", companionGroup: group, status: "confirmed" }
  ];
  const aligned = sandbox.applyGroups(existing, previews);
  const merged = sandbox.merge(aligned, previews, 4);
  assert.equal(merged.length, 3);
  assert.deepEqual(Array.from(merged, (participant) => participant.id), ["creator", "ja_test-p1", "ja_test-p2"]);
});

test("한 번의 멤버 추가 신청에서 실체 1명과 요약 동반자 1명은 서로 다른 참여자로 유지한다", () => {
  const functions = [
    "normalizeJoinParticipantApplicationMarker",
    "isUsableJoinParticipantApplicationMarker",
    "doJoinParticipantApplicationMarkersMatch",
    "getJoinParticipantApplicationMarkers",
    "hasJoinParticipantApplicationMarkerOverlap",
    "isJoinParticipantPreviewSource"
  ].map((name) => extractFunction(memberSource, name)).concat([
    extractFunction(detailSource, "mergeJoinParticipantsByIdentity"),
    extractFunction(detailSource, "applyParticipantSummaryGroupsToMaterializedParticipants")
  ]).join("\n");
  const sandbox = {
    getJoinParticipantMemberIdentity: (participant) => ({
      seq: String(participant.memberSeq || ""),
      id: String(participant.memberId || ""),
      phone: String(participant.memberMobile || ""),
      email: String(participant.memberEmail || ""),
      kakaoId: String(participant.kakaoId || "")
    })
  };
  vm.runInNewContext(`${functions}; globalThis.merge = mergeJoinParticipantsByIdentity;
    globalThis.applyGroups = applyParticipantSummaryGroupsToMaterializedParticipants;
    globalThis.markers = getJoinParticipantApplicationMarkers;`, sandbox);
  const group = "group_same_owner_application";
  const existing = [
    { id: "creator", isHost: true, isCreator: true, companionGroup: group, status: "confirmed" },
    { id: "ja_test-p1", source: "join_apply", previewSeed: "preview_applicant", companionGroup: group, status: "confirmed" }
  ];
  const previews = [
    { id: "summary-p1", source: "participant_summary_preview", previewSeed: "preview_applicant", companionGroup: group, status: "confirmed" },
    { id: "summary-p2", source: "participant_summary_preview", previewSeed: "preview_companion", companionGroup: group, status: "confirmed" }
  ];
  const aligned = sandbox.applyGroups(existing, previews);
  const merged = sandbox.merge(aligned, previews, 4);
  assert.deepEqual(Array.from(merged, (participant) => participant.id), ["creator", "ja_test-p1", "summary-p2"]);
  assert.deepEqual(Array.from(merged, (participant) => participant.companionGroup), [group, group, group]);
  assert.equal(Array.from(sandbox.markers({ companionGroup: group })).includes(group), false);
});

test("생성자 본인이 추가한 멤버는 생성자와 같은 동행 가로선 그룹을 사용한다", () => {
  const applyBlock = extractFunction(detailSource, "applyJoinApplicationPayload");
  assert.match(applyBlock, /currentMemberMatchesApplication = Boolean/);
  assert.match(applyBlock, /memberLookupMatched \|\| isJoinMyJoinApplicationForMember/);
  assert.match(applyBlock, /creatorOwnedCompanionGroup = currentMemberOwnsJoin && currentMemberMatchesApplication/);
  assert.match(applyBlock, /authoritativeCompanionGroup[\s\S]*normalized\.participantCompanionGroup/);
  assert.match(applyBlock, /participant\?\.isHost \|\| participant\?\.isCreator[\s\S]*companionGroup: creatorOwnedCompanionGroup/);
  assert.match(applyBlock, /companionGroup: creatorOwnedCompanionGroup[\s\S]*authoritativeCompanionGroup[\s\S]*normalized\.participantCompanionGroup/);
});

test("서버 요약 그룹은 개별 참여 신청 행의 이전 그룹보다 우선한다", () => {
  const source = extractFunction(detailSource, "getJoinApplicationAuthoritativeCompanionGroup");
  const sandbox = {};
  vm.runInNewContext(`${source}; globalThis.resolveGroup = getJoinApplicationAuthoritativeCompanionGroup;`, sandbox);
  const result = sandbox.resolveGroup([
    { id: "creator", companionGroup: "group_server_canonical" },
    { id: "application", companionGroup: "group_server_canonical" }
  ], new Set([1]));
  assert.equal(result, "group_server_canonical");

  const markerBlock = extractFunction(detailSource, "attachJoinApplicationParticipantMarkersFromMutation");
  assert.match(
    markerBlock,
    /participantCompanionGroup: firstApplicationPreview\.companionGroup[\s\S]*\|\| payload\.participantCompanionGroup/
  );
});

test("참여자 요약의 생성자 동행 그룹을 기존 생성자 아이콘에도 복원한다", () => {
  const summaryBlock = extractFunction(detailSource, "reconcileJoinParticipantsWithLightSummary");
  assert.match(summaryBlock, /creatorCompanionGroup/);
  assert.match(summaryBlock, /index < creatorPrefixCount \? \{ \.\.\.participant, companionGroup: creatorCompanionGroup \}/);
  const applyBlock = extractFunction(detailSource, "applyLightParticipantSummary");
  assert.match(applyBlock, /reconcileJoinParticipantsWithLightSummary\(join, join\.participantSummary\)/);
});

test("같은 B 이용자의 후속 멤버 추가는 기존 B에만 나 배지를 남기고 같은 그룹을 사용한다", () => {
  const applyBlock = extractFunction(detailSource, "applyJoinApplicationPayload");
  assert.match(applyBlock, /isCurrentMemberParticipant = nextParticipant\?\.isCurrentMember === true/);
  assert.match(applyBlock, /!currentMemberMarked[\s\S]*isCurrentMemberParticipant[\s\S]*currentMemberMarked = true/);
  assert.match(applyBlock, /representsCurrentMember = index === 0 && !currentMemberOwnsJoin && !currentMemberMarked/);
  assert.match(applyBlock, /companionGroup: creatorOwnedCompanionGroup[\s\S]*\|\| normalized\.participantCompanionGroup/);
  assert.match(applyBlock, /participant\?\.isCurrentMember === true[\s\S]*priority = 1/);
  assert.match(applyBlock, /isCurrentApplicationParticipant[\s\S]*priority = 2/);
  const cacheBlock = extractFunction(detailSource, "hydrateJoinApplicationsFromLocalCache");
  assert.match(cacheBlock, /sortJoinApplicationPayloadsBySubmittedAt/);
});

test("같은 회원의 여러 참여 신청은 항상 최초 신청부터 적용한다", () => {
  const source = extractFunction(detailSource, "sortJoinApplicationPayloadsBySubmittedAt");
  const sandbox = {};
  vm.runInNewContext(`${source}; globalThis.sortPayloads = sortJoinApplicationPayloadsBySubmittedAt;`, sandbox);
  const sorted = sandbox.sortPayloads([
    { id: "second", submittedAt: "2026-08-20T11:00:00+09:00" },
    { id: "first", submittedAt: "2026-08-20T10:00:00+09:00" }
  ]);
  assert.deepEqual(Array.from(sorted, (item) => item.id), ["first", "second"]);
});

test("서버 요약의 회원 그룹을 기존 실체 참여자 아이콘에도 복원한다", () => {
  const source = extractFunction(detailSource, "applyParticipantSummaryGroupsToMaterializedParticipants");
  const sandbox = {
    getJoinParticipantApplicationMarkers: (participant) => [participant.previewSeed, participant.companionGroup].filter(Boolean),
    hasJoinParticipantApplicationMarkerOverlap: (preview, markers) => (
      [preview.previewSeed, preview.companionGroup].filter(Boolean).some((marker) => markers.includes(marker))
    )
  };
  vm.runInNewContext(`${source}; globalThis.applyGroups = applyParticipantSummaryGroupsToMaterializedParticipants;`, sandbox);
  const existing = [
    { id: "b-first", previewSeed: "seed-b-first", isCurrentMember: true },
    { id: "b-added", previewSeed: "seed-b-added" }
  ];
  const previews = [
    { previewSeed: "seed-b-first", companionGroup: "member-party-sch-b" },
    { previewSeed: "seed-b-added", companionGroup: "member-party-sch-b" }
  ];
  const result = sandbox.applyGroups(existing, previews);
  assert.deepEqual(Array.from(result, (participant) => participant.companionGroup), [
    "member-party-sch-b",
    "member-party-sch-b"
  ]);
  assert.equal(result.filter((participant) => participant.isCurrentMember).length, 1);
  assert.equal(result[0].isCurrentMember, true);
});

test("첫 새로고침의 요약·실체 참여자 중복은 상세정보가 있는 실체 아이콘을 남긴다", () => {
  const source = [
    extractFunction(detailSource, "getLightPreviewMatchKey"),
    extractFunction(detailSource, "areLightParticipantPreviewsSame"),
    extractFunction(detailSource, "dedupeJoinParticipantSummaryPreviews")
  ].join("\n");
  const sandbox = {
    isJoinParticipantPreviewSource: (participant) => participant.source === "participant_summary_preview",
    getJoinParticipantApplicationMarkers: (participant) => [participant.previewSeed].filter(Boolean),
    hasJoinParticipantApplicationMarkerOverlap: (participant, markers) => (
      markers.includes(participant.previewSeed)
    )
  };
  vm.runInNewContext(`${source}; globalThis.dedupe = dedupeJoinParticipantSummaryPreviews;`, sandbox);
  const group = "group_server_canonical";
  const result = sandbox.dedupe([
    { id: "creator", name: "전규호", gender: "남성", companionGroup: group, isHost: true },
    { id: "summary-applicant", source: "participant_summary_preview", name: "전**", gender: "남성", companionGroup: group },
    { id: "summary-companion", source: "participant_summary_preview", name: "일**", gender: "여성", companionGroup: group },
    { id: "materialized-applicant", source: "join_apply", name: "전**", gender: "남성", companionGroup: group, isCurrentMember: true }
  ]);
  assert.deepEqual(Array.from(result, (participant) => participant.id), [
    "creator",
    "summary-companion",
    "materialized-applicant"
  ]);
  const ensureBlock = extractFunction(detailSource, "ensureJoinParticipantSummaryCount");
  assert.match(ensureBlock, /uniqueParticipants = dedupeJoinParticipantSummaryPreviews\(participants\)/);
  assert.match(ensureBlock, /uniqueParticipants\.slice\(0, targetCount\)/);
});

test("생성자가 멤버를 추가한 일정은 생성 행 확인 전 참여중 탭으로 분류하지 않는다", () => {
  const reservationsSource = fs.readFileSync(
    path.join(root, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"),
    "utf8"
  );
  const homeSectionsSource = fs.readFileSync(
    path.join(root, "src/golfjoin-main/source/scripts/sections/38-home-sections.js"),
    "utf8"
  );

  const includeBlock = extractFunction(reservationsSource, "shouldIncludeJoinMyJoinedApplication");
  assert.match(includeBlock, /getJoinMyTargetScheduleCreatorSeq\(application\)/);
  assert.match(includeBlock, /memberIdentity\.seq === targetCreatorSeq\) return false/);
  assert.match(includeBlock, /googleSheetBuilderApplicationsReadCompleted/);
  assert.match(includeBlock, /!googleSheetBuilderApplicationsLoading/);
  assert.match(
    reservationsSource,
    /\.filter\(\(application\) => shouldIncludeJoinMyJoinedApplication\(application, member\)\)/
  );

  const readinessBlock = extractFunction(homeSectionsSource, "isMyHomeJoinClassificationReady");
  assert.match(readinessBlock, /googleSheetBuilderApplicationsReadCompleted/);
  assert.match(readinessBlock, /googleSheetJoinApplicationsReadCompleted/);
  assert.match(readinessBlock, /!googleSheetBuilderApplicationsLoading/);
  assert.match(readinessBlock, /!googleSheetJoinApplicationsLoading/);
  assert.match(readinessBlock, /googleSheetBuilderApplicationsReadMemberKey === memberKey/);
  assert.match(readinessBlock, /googleSheetJoinApplicationsReadMemberKey === memberKey/);
  const readinessSandbox = {
    GOLFJOIN_SHEET_API_ENDPOINT: "https://example.test/sheet-api",
    getJoinCachedCurrentMember: () => ({ memberKey: "seq:30002183" }),
    getJoinWishMemberKey: () => "seq:30002183",
    googleSheetBuilderApplicationsReadCompleted: true,
    googleSheetJoinApplicationsReadCompleted: true,
    googleSheetBuilderApplicationsLoading: false,
    googleSheetJoinApplicationsLoading: false,
    googleSheetBuilderApplicationsReadMemberKey: "",
    googleSheetJoinApplicationsReadMemberKey: ""
  };
  vm.runInNewContext(`${readinessBlock}; globalThis.isReady = isMyHomeJoinClassificationReady;`, readinessSandbox);
  assert.equal(readinessSandbox.isReady(), false);
  readinessSandbox.googleSheetBuilderApplicationsReadMemberKey = "seq:30002183";
  readinessSandbox.googleSheetJoinApplicationsReadMemberKey = "seq:30002183";
  assert.equal(readinessSandbox.isReady(), true);
  assert.match(
    homeSectionsSource,
    /function getMyHomeJoinItems\(\)[\s\S]{0,700}if \(!isMyHomeJoinClassificationReady\(\)\) return \[\]/
  );
});

test("공개 경량 데이터와 로컬 캐시는 회원 전용 조회 완료 상태를 해제하지 않는다", () => {
  const homeBootstrapSource = fs.readFileSync(
    path.join(root, "src/golfjoin-main/source/scripts/data/35-home-bootstrap.js"),
    "utf8"
  );
  const lightBlock = extractFunction(detailSource, "applyHomeBootstrapLightRows");
  const joinCacheBlock = extractFunction(detailSource, "hydrateJoinApplicationsFromLocalCache");
  const builderCacheBlock = extractFunction(detailSource, "hydrateBuilderApplicationJoinsFromLocalCache");
  const joinNetworkBlock = extractFunction(detailSource, "hydrateJoinApplicationsFromGoogleSheetUncoalesced");
  const builderNetworkBlock = extractFunction(detailSource, "hydrateBuilderApplicationJoinsFromGoogleSheetUncoalesced");
  const lightNetworkBlock = extractFunction(homeBootstrapSource, "hydrateHomeBootstrapLightFromGoogleSheet")
    .replace(/^function /, "async function ");
  const secondaryBlock = extractFunction(homeBootstrapSource, "hydrateHomeSecondaryData")
    .replace(/^function /, "async function ");

  assert.match(lightBlock, /const hasMemberScope = Boolean/);
  assert.match(lightBlock, /if \(!hasMemberScope\) \{[\s\S]*googleSheetBuilderApplicationsLoading = false/);
  assert.match(lightNetworkBlock, /const hasMemberScope = Boolean/);
  assert.match(lightNetworkBlock, /if \(!hasMemberScope\) \{[\s\S]*googleSheetBuilderApplicationsLoading = true/);
  assert.match(secondaryBlock, /googleSheetBuilderApplicationsReadMemberKey !== memberKey/);
  assert.match(secondaryBlock, /googleSheetJoinApplicationsReadMemberKey !== memberKey/);
  assert.doesNotMatch(secondaryBlock, /hasFreshGoogleSheetRowsCache/);
  assert.doesNotMatch(joinCacheBlock, /googleSheetJoinApplicationsReadMemberKey = memberKey/);
  assert.doesNotMatch(builderCacheBlock, /googleSheetBuilderApplicationsReadMemberKey = memberKey/);
  assert.match(joinNetworkBlock, /googleSheetJoinApplicationsReadMemberKey = ""[\s\S]*googleSheetJoinApplicationsLoading = true/);
  assert.match(builderNetworkBlock, /googleSheetBuilderApplicationsReadMemberKey = ""[\s\S]*googleSheetBuilderApplicationsLoading = true/);
  assert.match(homeBootstrapSource, /googleSheetBuilderApplicationsReadMemberKey = ""/);
  assert.match(homeBootstrapSource, /googleSheetJoinApplicationsReadMemberKey = ""/);
});

test("공개 부트스트랩은 로그인 회원의 private loading을 점유하지 않고 현재 회원 조회를 시작한다", async () => {
  const homeBootstrapSource = fs.readFileSync(
    path.join(root, "src/golfjoin-main/source/scripts/data/35-home-bootstrap.js"),
    "utf8"
  );
  const lightNetworkBlock = extractFunction(homeBootstrapSource, "hydrateHomeBootstrapLightFromGoogleSheet")
    .replace(/^function /, "async function ");
  const secondaryBlock = extractFunction(homeBootstrapSource, "hydrateHomeSecondaryData")
    .replace(/^function /, "async function ");
  const sandbox = {
    GOLFJOIN_SHEET_API_ENDPOINT: "https://example.test/sheet-api",
    homeBootstrapLightRequestGeneration: 0,
    getJoinCachedCurrentMember: () => ({ memberKey: "seq:30002183" }),
    getJoinWishMemberKey: () => "seq:30002183",
    googleSheetBuilderApplicationsLoading: false,
    googleSheetJoinApplicationsLoading: false,
    googleSheetBuilderApplicationsReadCompleted: true,
    googleSheetJoinApplicationsReadCompleted: true,
    googleSheetBuilderApplicationsReadFailed: false,
    googleSheetJoinApplicationsReadFailed: false,
    googleSheetBuilderApplicationsReadMemberKey: "",
    googleSheetJoinApplicationsReadMemberKey: "",
    googleSheetJoinWishesLoading: true,
    homeBootstrapSnapshotNeedsRefresh: false,
    postGolfJoinSheetAction: async () => ({ cache: { status: "fresh" } }),
    writeJoinJsonCache: () => {},
    applyHomeBootstrapLightRows: () => {},
    HOME_BOOTSTRAP_LIGHT_CACHE_KEY: "home-light",
    markGolfJoinPerformanceOnce: () => {},
    builderReads: 0,
    joinReads: 0,
    hydrateBuilderApplicationJoinsFromGoogleSheet: async () => { sandbox.builderReads += 1; },
    hydrateJoinApplicationsFromGoogleSheet: async () => { sandbox.joinReads += 1; },
    hydrateJoinWishesFromGoogleSheet: async () => {},
    scheduleHomeRender: () => {},
    refreshDetailWishButtons: () => {},
    refreshOpenJoinMyMenu: () => {},
    resumeJoinExternalDeepLink: async () => {},
    hydrateHomeStatsFromGoogleSheet: async () => {},
    golfJoinSafeWarn: () => {}
  };
  vm.runInNewContext(`
    ${lightNetworkBlock}
    ${secondaryBlock}
    globalThis.loadLight = hydrateHomeBootstrapLightFromGoogleSheet;
    globalThis.loadPrivate = hydrateHomeSecondaryData;
  `, sandbox);

  await sandbox.loadLight({ render: false });
  assert.equal(sandbox.googleSheetBuilderApplicationsLoading, false);
  assert.equal(sandbox.googleSheetJoinApplicationsLoading, false);

  await sandbox.loadPrivate();
  assert.equal(sandbox.builderReads, 1);
  assert.equal(sandbox.joinReads, 1);

  sandbox.googleSheetBuilderApplicationsReadMemberKey = "seq:30002183";
  sandbox.googleSheetJoinApplicationsReadMemberKey = "seq:30002183";
  await sandbox.loadPrivate();
  assert.equal(sandbox.builderReads, 1);
  assert.equal(sandbox.joinReads, 1);
});

test("참여 신청이 요약보다 먼저 또는 나중에 도착해도 확정 인원과 동행 그룹을 다시 맞춘다", () => {
  const applyBlock = extractFunction(detailSource, "applyJoinApplicationPayload");
  assert.match(applyBlock, /!options\.persist && join\.participantSummary\?\.participantsPreview/);
  assert.match(applyBlock, /reconcileJoinParticipantsWithLightSummary\(join, join\.participantSummary\)/);
  const reconcileBlock = extractFunction(detailSource, "reconcileJoinParticipantsWithLightSummary");
  assert.match(reconcileBlock, /creatorCompanionGroup/);
  assert.match(reconcileBlock, /applyParticipantSummaryGroupsToMaterializedParticipants/);
  assert.match(reconcileBlock, /ensureJoinParticipantSummaryCount/);
  assert.match(applyBlock, /enforceCreatorOwnedApplicationCompanionGroup/);

  const source = [
    extractFunction(detailSource, "getLightPreviewMatchKey"),
    extractFunction(detailSource, "areLightParticipantPreviewsSame"),
    extractFunction(detailSource, "dedupeJoinParticipantSummaryPreviews")
  ].join("\n");
  const sandbox = {
    isJoinParticipantPreviewSource: (participant) => participant.source === "participant_summary_preview",
    getJoinParticipantApplicationMarkers: (participant) => [participant.previewSeed].filter(Boolean),
    hasJoinParticipantApplicationMarkerOverlap: (participant, markers) => markers.includes(participant.previewSeed)
  };
  vm.runInNewContext(`${source}; globalThis.dedupe = dedupeJoinParticipantSummaryPreviews;`, sandbox);
  const canonicalGroup = "group_server_canonical";
  const creator = { id: "creator", name: "전규호", gender: "남성", companionGroup: canonicalGroup, isHost: true };
  const summaryApplicant = { id: "summary-applicant", source: "participant_summary_preview", previewSeed: "apply-seed", name: "전**", gender: "남성", companionGroup: canonicalGroup };
  const summaryCompanion = { id: "summary-companion", source: "participant_summary_preview", previewSeed: "companion-seed", name: "일**", gender: "여성", companionGroup: canonicalGroup };
  const materializedApplicant = { id: "materialized-applicant", source: "join_apply", previewSeed: "apply-seed", name: "전**", gender: "남성", companionGroup: canonicalGroup };
  const materializedCompanion = { id: "materialized-companion", source: "join_apply", previewSeed: "apply-seed", name: "일행1", gender: "여성", companionGroup: canonicalGroup };
  const summaryFirst = sandbox.dedupe([creator, summaryApplicant, summaryCompanion, materializedApplicant, materializedCompanion]);
  const applicationFirst = sandbox.dedupe([creator, materializedApplicant, materializedCompanion, summaryApplicant, summaryCompanion]);
  [summaryFirst, applicationFirst].forEach((participants) => {
    assert.equal(participants.length, 3);
    assert.deepEqual(Array.from(participants, (participant) => participant.companionGroup), [canonicalGroup, canonicalGroup, canonicalGroup]);
  });
});

test("내예약 재조회 후에도 생성자와 한 번에 추가한 두 멤버는 하나의 그룹을 유지한다", () => {
  const source = extractFunction(detailSource, "enforceCreatorOwnedApplicationCompanionGroup");
  const sandbox = {
    normalizeJoinParticipantApplicationMarker: (value) => String(value || ""),
    isUsableJoinParticipantApplicationMarker: (value) => Boolean(value),
    isJoinApplicationMaterializedParticipant: (participant, recordId) => (
      String(participant.id || "").startsWith(`${recordId}-p`)
    ),
    hasJoinParticipantApplicationMarkerOverlap: (participant, markers) => (
      markers.includes(String(participant.previewSeed || ""))
    )
  };
  vm.runInNewContext(`${source}; globalThis.enforceGroup = enforceCreatorOwnedApplicationCompanionGroup;`, sandbox);
  const join = {
    id: "builder-target",
    scheduleId: "sch-owner",
    participants: [
      { id: "host", isHost: true, companionGroup: "summary-owner-party" },
      { id: "ja-owner-add-p1", previewSeed: "owner-add", companionGroup: "application-party" },
      { id: "ja-owner-add-p2", previewSeed: "owner-add", companionGroup: "application-party", name: "일행1" }
    ]
  };

  sandbox.enforceGroup(join, { participantPreviewSeed: "owner-add" }, "ja-owner-add", "application-party");
  assert.deepEqual(
    Array.from(join.participants, (participant) => participant.companionGroup),
    ["summary-owner-party", "summary-owner-party", "summary-owner-party"]
  );
  assert.equal(join.participants[2].name, "일행1");
});

test("내예약 참여중 카드는 신청 ID가 달라도 같은 일정이면 한 건만 사용한다", () => {
  const source = extractFunction(memberSource, "getJoinMyJoinedApplicationKey");
  const sandbox = {
    getJoinApplicationTargetRow: (application) => ({
      targetScheduleId: application.targetScheduleId || "",
      targetApplicationId: application.targetApplicationId || "",
      targetJoinId: application.targetJoinId || "",
      erpProductId: application.erpProductId || "",
      erpEventSeq: application.erpEventSeq || ""
    }),
    getNestedValue: (value, key) => key.split(".").reduce((item, part) => item?.[part], value)
  };
  vm.runInNewContext(`${source}; globalThis.getKey = getJoinMyJoinedApplicationKey;`, sandbox);
  const first = sandbox.getKey({ joinApplyId: "ja-first", targetScheduleId: "sch-same" });
  const second = sandbox.getKey({ joinApplyId: "ja-second", targetScheduleId: "sch-same" });
  assert.equal(first, "schedule:sch-same");
  assert.equal(second, first);
});

test("내예약 동행 그룹은 최신 신청 ID가 두 번째 그룹원이어도 첫 아이콘에 나 배지를 표시한다", () => {
  const source = [
    extractFunction(memberSource, "isJoinMyParticipantMe"),
    extractFunction(memberSource, "renderJoinMyGroupedParticipantSlots")
  ].join("\n");
  const renderedGroups = [];
  const sandbox = {
    isJoinParticipantForCurrentMember: () => false,
    renderJoinMyParticipantSlot: () => "slot",
    isJoinMyParticipantHost: () => false,
    renderJoinMyParticipantGroup: (participants, _joinId, options) => {
      renderedGroups.push({ ids: participants.map((participant) => participant.id), ...options });
      return "group";
    }
  };
  vm.runInNewContext(`${source}; globalThis.renderGroups = renderJoinMyGroupedParticipantSlots;`, sandbox);
  const item = {
    scheduleGroup: "joined",
    myParticipantIds: ["b-latest"]
  };
  const html = sandbox.renderGroups([
    { id: "b-first", companionGroup: "member-party-sch-b" },
    { id: "b-latest", companionGroup: "member-party-sch-b" }
  ], "join-b", { item });
  assert.equal(html, "group");
  assert.deepEqual(Array.from(renderedGroups[0].ids), ["b-first", "b-latest"]);
  assert.equal(renderedGroups[0].isMe, true);
});

test("참여 신청 모달은 같은 일정의 최초 생성 또는 참여 신청 정보를 선택한다", () => {
  const source = [
    extractFunction(detailSource, "sortJoinApplicationPayloadsBySubmittedAt"),
    extractFunction(detailSource, "getInitialSameMemberApplyPayload")
  ].join("\n");
  const join = { id: "join-test", sheetApplication: { submittedAt: "2026-08-20T09:00:00+09:00", applicant: { greeting: "생성 인사" } } };
  const sandbox = {
    joinApplicationPayloadMemory: new Map([
      ["late", { target: "join-test", submittedAt: "2026-08-20T11:00:00+09:00", applicant: { greeting: "두 번째" } }],
      ["first", { target: "join-test", submittedAt: "2026-08-20T10:00:00+09:00", applicant: { greeting: "첫 참여" } }]
    ]),
    isCancelledJoinApplyPayload: () => false,
    isJoinMyJoinApplicationForMember: () => true,
    findJoinForJoinApplicationPayload: (application) => application.target === "join-test" ? join : null,
    isJoinMyCreatedScheduleForMember: (_join, member) => member.role === "creator"
  };
  vm.runInNewContext(`${source}; globalThis.selectInitial = getInitialSameMemberApplyPayload;`, sandbox);
  assert.equal(sandbox.selectInitial(join, { role: "creator" }).applicant.greeting, "생성 인사");
  assert.equal(sandbox.selectInitial(join, { role: "joined" }).applicant.greeting, "첫 참여");
  const applyBlock = extractFunction(detailSource, "applyInitialSameMemberApplyPreferences");
  assert.match(applyBlock, /applicant\.styles/);
  assert.match(applyBlock, /applicant\.preferredMemberComposition \|\| applicant\.memberPreferences/);
  assert.match(applyBlock, /globalApplyGreeting/);
});

test("회원 딥링크는 생성·참여 시트 동기화 후 대상을 연다", () => {
  const block = extractFunction(memberSource, "continueMyHomeJoinDeepLinkAfterLogin");
  assert.match(block, /hydrateBuilderApplicationJoinsFromGoogleSheet/);
  assert.match(block, /hydrateJoinApplicationsFromGoogleSheet/);
  assert.match(block, /const join = findMyHomeJoinDeepLinkTarget/);
});

test("나의 모임 카드만 확정 견적 1인 금액을 우선 표시한다", () => {
  const renderBlock = extractFunction(detailSource, "renderJoinCard");
  assert.match(renderBlock, /options\.myJoinFilter[\s\S]*getJoinFinalQuoteUnitPrice\(join\) \|\| join\.price/);
  assert.match(renderBlock, /formatPrice\(displayPrice\)/);
});
