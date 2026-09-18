"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { IMMUTABLE_CACHE_CONTROL, sha256 } = require("./external-assets");
const { buildStage15Candidate } = require("./prepare-stage15-sms-auth");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage31-owner-quote-integrity/reservation-group-finalization-20260821-v31q"
);
const CURRENT_PRODUCTION_HTML = path.join(
  WORKSPACE_ROOT,
  "deploy/stage31-owner-quote-integrity/member-private-bootstrap-readiness-20260820-v31p/DEPLOY_golfjoin_main_member_private_bootstrap_readiness_DAA1D2F8.html"
);
const SOURCE_PACKAGE = path.join(
  WORKSPACE_ROOT,
  "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25"
);

function publicUrl(objectName) {
  return `https://storage.googleapis.com/golfjoin-bucket/${objectName}`;
}

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function writeExclusive(fileName, buffer) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), buffer, { flag: "wx" });
}

async function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);
  const candidate = await buildStage15Candidate({
    sourcePackage: SOURCE_PACKAGE,
    stagingEventPlanSeq: 29,
    generatedAt: new Date().toISOString()
  });
  zlib.gunzipSync(candidate.cssGzip);
  const logicalJs = zlib.brotliDecompressSync(candidate.jsBrotli);
  const logicalSource = logicalJs.toString("utf8");
  new vm.Script(logicalSource, { filename: "stage31q-golfjoin-main.js" });
  if (!/function dedupeJoinParticipantSummaryPreviews[\s\S]{0,1500}function getLightCreatorPreviewPrefixCount/.test(logicalSource)) {
    throw new Error("participant_summary_preview_dedupe_missing");
  }
  if (!/function ensureJoinParticipantSummaryCount[\s\S]{0,500}dedupeJoinParticipantSummaryPreviews/.test(logicalSource)) {
    throw new Error("participant_summary_final_reconciliation_missing");
  }
  if (!/function reconcileJoinParticipantsWithLightSummary[\s\S]{0,2500}ensureJoinParticipantSummaryCount/.test(logicalSource)) {
    throw new Error("participant_summary_arrival_order_reconciliation_missing");
  }
  if (!/function applyJoinApplicationPayload[\s\S]{0,7000}reconcileJoinParticipantsWithLightSummary/.test(logicalSource)) {
    throw new Error("join_application_final_summary_reconciliation_missing");
  }
  if (!/\.slice\(0,[a-z]\)/.test(logicalSource.slice(
    logicalSource.indexOf("function ensureJoinParticipantSummaryCount"),
    logicalSource.indexOf("function mergeJoinParticipantsByIdentity")
  ))) {
    throw new Error("authoritative_participant_count_trim_missing");
  }
  if (!/function renderJoinMyGroupedParticipantSlots[\s\S]{0,1000}\.some\(\(e,t\)=>isJoinMyParticipantMe\(e,[a-z]\+t,[a-z]\)\)/.test(logicalSource)) {
    throw new Error("my_reservation_group_badge_fix_missing");
  }
  if (!/function shouldIncludeJoinMyJoinedApplication[\s\S]{0,1000}getJoinMyTargetScheduleCreatorSeq/.test(logicalSource)) {
    throw new Error("creator_member_add_joined_classification_guard_missing");
  }
  if (!/function isMyHomeJoinClassificationReady[\s\S]{0,500}googleSheetJoinApplicationsReadCompleted/.test(logicalSource)) {
    throw new Error("my_home_join_classification_readiness_missing");
  }
  if (!/function isMyHomeJoinClassificationReady[\s\S]{0,800}googleSheetBuilderApplicationsReadMemberKey/.test(logicalSource)
    || !/function isMyHomeJoinClassificationReady[\s\S]{0,800}googleSheetJoinApplicationsReadMemberKey/.test(logicalSource)) {
    throw new Error("member_scoped_private_readiness_missing");
  }
  const markerBlock = logicalSource.slice(
    logicalSource.indexOf("function getJoinParticipantApplicationMarkers"),
    logicalSource.indexOf("function hasJoinParticipantApplicationMarkerOverlap")
  );
  if (/companionGroup/.test(markerBlock)) {
    throw new Error("companion_group_must_not_be_identity_marker");
  }
  if (!/function applyParticipantSummaryGroupsToMaterializedParticipants[\s\S]{0,2200}used:!1/.test(logicalSource)
    || !/function applyParticipantSummaryGroupsToMaterializedParticipants[\s\S]{0,2600}\.used=!0/.test(logicalSource)) {
    throw new Error("one_to_one_materialized_preview_alignment_missing");
  }
  if (!/function enforceCreatorOwnedApplicationCompanionGroup[\s\S]{0,2200}creator-party/.test(logicalSource)
    || !/function applyJoinApplicationPayload[\s\S]{0,8500}enforceCreatorOwnedApplicationCompanionGroup/.test(logicalSource)) {
    throw new Error("creator_owned_application_group_finalization_missing");
  }
  if (!/function getJoinMyJoinedApplicationKey[\s\S]{0,800}schedule:/.test(logicalSource)) {
    throw new Error("joined_reservation_schedule_dedupe_missing");
  }
  const detailModuleSource = fs.readFileSync(path.join(
    WORKSPACE_ROOT,
    "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
  ), "utf8");
  if (!/function applyHomeBootstrapLightRows[\s\S]{0,2200}hasMemberScope/.test(detailModuleSource)) {
    throw new Error("public_light_must_not_release_private_loading_missing");
  }
  const homeBootstrapModuleSource = fs.readFileSync(path.join(
    WORKSPACE_ROOT,
    "src/golfjoin-main/source/scripts/data/35-home-bootstrap.js"
  ), "utf8");
  const publicBootstrapStart = homeBootstrapModuleSource.indexOf("async function hydrateHomeBootstrapLightFromGoogleSheet");
  const publicBootstrapEnd = homeBootstrapModuleSource.indexOf("function waitForHomeBootstrapBeforeSecondaryHydration", publicBootstrapStart);
  const publicBootstrapBlock = homeBootstrapModuleSource.slice(publicBootstrapStart, publicBootstrapEnd);
  if (!/const hasMemberScope = Boolean/.test(publicBootstrapBlock)
    || !/if \(!hasMemberScope\) \{[\s\S]*googleSheetBuilderApplicationsLoading = true/.test(publicBootstrapBlock)) {
    throw new Error("public_bootstrap_private_loading_ownership_fix_missing");
  }
  const secondaryStart = homeBootstrapModuleSource.indexOf("async function hydrateHomeSecondaryData");
  const secondaryEnd = homeBootstrapModuleSource.indexOf("function scheduleHomeSecondaryHydration", secondaryStart);
  const secondaryBlock = homeBootstrapModuleSource.slice(secondaryStart, secondaryEnd);
  if (!/googleSheetBuilderApplicationsReadMemberKey !== memberKey/.test(secondaryBlock)
    || !/googleSheetJoinApplicationsReadMemberKey !== memberKey/.test(secondaryBlock)
    || /hasFreshGoogleSheetRowsCache/.test(secondaryBlock)) {
    throw new Error("current_member_private_read_start_fix_missing");
  }

  const rollbackHtml = fs.readFileSync(CURRENT_PRODUCTION_HTML);
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_reservation_group_finalization_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`
  };
  const hashes = {
    deployHtml: sha256(candidate.candidateHtml),
    rollbackHtml: sha256(rollbackHtml),
    css: sha256(candidate.cssGzip),
    js: sha256(candidate.jsBrotli)
  };
  const runbook = Buffer.from([
    "# v31q 내예약 재조회 그룹 고정 및 동일 일정 중복 카드 제거",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. CSS·JS 2개를 Cloud Shell에 업로드하고 해시를 확인한다.",
    "- [ ] 2. GCS 불변 경로에 CSS·JS를 업로드한다.",
    "- [ ] 3. 200·Content-Encoding·immutable 응답 헤더를 확인한다.",
    "- [ ] 4. 신규 HTML 전체 내용을 운영 페이지에 저장한다.",
    "- [ ] 5. 캐시 유무와 관계없이 최초 진입에서 나의 모임 섹션이 회원 전용 조회 완료 후 나타나는지 확인한다.",
    "- [ ] 6. B 생성 1명 + 한 번의 멤버 추가로 2명 동시 추가 일정에서 3명·첫 아이콘 나·전체 연결선을 확인한다.",
    "- [ ] 7. 첫 진입과 새로고침 모두 해당 일정이 참여중인 모임 탭에 잠깐 나타나지 않는지 확인한다.",
    "- [ ] 8. 내예약 진입 전후 나의모임 카드·상세·내예약 카드·상세의 3명 연결선이 동일한지 확인한다.",
    "- [ ] 9. 동일 일정에 참여 신청 행이 여러 개여도 참여중 카드가 한 건만 표시되는지 확인한다.",
    "- [ ] 10. A 생성 + B 참여 그룹의 분리·연결·나 배지를 확인한다.",
    "- [ ] 11. 문제가 있으면 DAA1D2F8 HTML로 즉시 복구한다.",
    "",
    "## 파일 해시",
    "",
    "```text",
    `${names.css}  ${hashes.css}`,
    `${names.js}  ${hashes.js}`,
    `${names.deployHtml}  ${hashes.deployHtml}`,
    `${names.rollbackHtml}  ${hashes.rollbackHtml}`,
    "```",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "```",
    "",
    `HTML은 ${names.deployHtml} 전체 내용을 사용합니다.`,
    `복구 시 ${names.rollbackHtml} 전체 내용을 사용합니다.`,
    "서버 함수는 재배포하지 않습니다.",
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false });
  writeExclusive(names.deployHtml, candidate.candidateHtml);
  writeExclusive(names.rollbackHtml, rollbackHtml);
  writeExclusive(names.css, candidate.cssGzip);
  writeExclusive(names.js, candidate.jsBrotli);
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "secret-golf-join-reservation-group-finalization-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      summaryMaterializedParticipantDedupe: true,
      materializedParticipantDetailPriority: true,
      authoritativeConfirmedCountTrim: true,
      deterministicReloadResult: true,
      participantSummaryArrivalOrderReconciled: true,
      creatorJoinedTabFlickerSuppressed: true,
      classificationWaitsForBothMemberDatasets: true,
      memberScopedBuilderReadiness: true,
      memberScopedJoinApplicationReadiness: true,
      publicSummaryCannotUnlockMyJoinSection: true,
      companionGroupExcludedFromParticipantIdentity: true,
      oneApplicationTwoPeopleKeptDistinct: true,
      materializedAndSummaryParticipantsAlignedOneToOne: true,
      publicLightCannotReleaseMemberPrivateLoading: true,
      publicBootstrapDoesNotOwnMemberPrivateLoading: true,
      currentMemberPrivateReadAlwaysStarts: true,
      creatorOwnedApplicationGroupFinalizedAfterSummary: true,
      joinedReservationDedupedBySchedule: true,
      serverSummaryCompanionGroupPriority: true,
      myReservationGroupedParticipantBadge: true,
      sheetApiRedeployRequired: false,
      aligoApiRedeployRequired: false
    },
    assets: {
      css: { objectName: candidate.assets.css.objectName, url: publicUrl(candidate.assets.css.objectName) },
      js: { objectName: candidate.assets.js.objectName, url: publicUrl(candidate.assets.js.objectName) }
    },
    files: {
      deployHtml: fileRecord(names.deployHtml, candidate.candidateHtml),
      rollbackHtml: fileRecord(names.rollbackHtml, rollbackHtml),
      css: fileRecord(names.css, candidate.cssGzip, {
        contentEncoding: "gzip",
        objectName: candidate.assets.css.objectName
      }),
      js: fileRecord(names.js, candidate.jsBrotli, {
        contentEncoding: "br",
        objectName: candidate.assets.js.objectName
      }),
      runbook: fileRecord("RUNBOOK.md", runbook)
    }
  };
  writeExclusive("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot: OUTPUT_ROOT, manifest }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
