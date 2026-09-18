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
  "deploy/stage31-owner-quote-integrity/participant-group-authority-20260820-v31l"
);
const CURRENT_PRODUCTION_HTML = path.join(
  WORKSPACE_ROOT,
  "deploy/stage31-owner-quote-integrity/same-member-companion-reuse-20260820-v31k/DEPLOY_golfjoin_main_same_member_group_550B6E89.html"
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
  new vm.Script(logicalSource, { filename: "stage31l-golfjoin-main.js" });
  if (!/function renderJoinMyGroupedParticipantSlots[\s\S]{0,1000}\.some\(\(e,t\)=>isJoinMyParticipantMe\(e,[a-z]\+t,[a-z]\)\)/.test(logicalSource)) {
    throw new Error("my_reservation_group_badge_fix_missing");
  }
  if (!/participantCompanionGroup:[a-z]\.companionGroup\|\|e\.participantCompanionGroup\|\|""/.test(logicalSource)) {
    throw new Error("mutation_summary_group_priority_fix_missing");
  }
  if (!/function getJoinApplicationAuthoritativeCompanionGroup[\s\S]{0,500}function applyJoinApplicationPayload[\s\S]{0,1000}getJoinApplicationAuthoritativeCompanionGroup/.test(logicalSource)) {
    throw new Error("authoritative_participant_group_reconciliation_missing");
  }

  const rollbackHtml = fs.readFileSync(CURRENT_PRODUCTION_HTML);
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_participant_group_authority_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
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
    "# v31l 참여자 그룹 권위값·내예약 나 배지 보완",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. CSS·JS 압축 파일 2개를 Cloud Shell에 업로드하고 해시를 확인한다.",
    "- [ ] 2. GCS 불변 경로에 CSS·JS를 업로드한다.",
    "- [ ] 3. 응답 헤더의 200·Content-Encoding·immutable을 확인한다.",
    "- [ ] 4. 신규 HTML 전체 내용을 운영 페이지에 저장한다.",
    "- [ ] 5. B 생성 1명 + B 멤버추가 2명 일정에서 세 아이콘이 모두 한 가로선으로 연결되는지 확인한다.",
    "- [ ] 6. 나의모임 카드·상품상세·내예약 카드에서 첫 아이콘에만 나 배지가 보이는지 확인한다.",
    "- [ ] 7. A 생성 + B 참여·멤버추가 일정은 A 그룹과 B 그룹이 분리되고 B 그룹만 서로 연결되는지 확인한다.",
    "- [ ] 8. 새로고침 후에도 세 화면의 그룹·배지가 유지되고 콘솔 오류가 없는지 확인한다.",
    "- [ ] 9. 문제가 있으면 550B6E89 HTML로 즉시 복구한다.",
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
    "golfjoin-sheet-api와 golfjoin-aligo-api는 재배포하지 않습니다.",
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
    schema: "secret-golf-join-participant-group-authority-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      myReservationGroupedParticipantBadge: true,
      groupedMemberIdScan: true,
      firstGroupAvatarBadgePlacement: true,
      sameMemberCompanionGroupingPreserved: true,
      serverSummaryCompanionGroupPriority: true,
      mutationPayloadGroupFallbackOnly: true,
      creatorAndAddedMembersSingleGroup: true,
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
