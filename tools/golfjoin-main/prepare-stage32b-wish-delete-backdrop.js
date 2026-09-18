"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { IMMUTABLE_CACHE_CONTROL, sha256 } = require("./external-assets");
const { buildStage15Candidate } = require("./prepare-stage15-sms-auth");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_ROOT = path.join(
  ROOT,
  "deploy/stage32-wish-family-detail/wish-delete-backdrop-20260821-v32b"
);
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage31-owner-quote-integrity/reservation-group-finalization-20260821-v31q/DEPLOY_golfjoin_main_reservation_group_finalization_49CBEB0C.html"
);
const ROLLBACK_SERVER = path.join(
  ROOT,
  "deploy/stage31-owner-quote-integrity/same-member-companion-reuse-20260820-v31k/stage31k-index.js"
);
const SERVER_INDEX = path.join(ROOT, "server/google-sheet-proxy-function/index.js");
const SERVER_TEST = path.join(ROOT, "server/google-sheet-proxy-function/wish-deletion-tombstone.test.js");
const SOURCE_PACKAGE = path.join(
  ROOT,
  "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25"
);

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function writeExclusive(fileName, buffer) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), buffer, { flag: "wx" });
}

function assertBrowserCandidate(js, css) {
  new vm.Script(js, { filename: "stage32b-golfjoin-main.js" });
  [
    /async function resolveJoinWishProductDetail\(/,
    /function mergeJoinWishProductRecords\(/,
    /joinWishesSheetReadCacheV2/,
    /status:\s*"deleted"/,
    /window\.matchMedia\?\.\("\(max-width: 640px\)"\)/
  ].forEach((pattern) => {
    if (!pattern.test(js)) throw new Error(`browser_candidate_missing:${pattern}`);
  });
  const familyPeriods = css.match(/\.detail-family-periods\s*\{([^}]*)\}/);
  if (!familyPeriods || /\bbackground(?:-color)?\s*:/.test(familyPeriods[1])) {
    throw new Error("detail_family_periods_background_must_be_transparent");
  }
}

function assertServerCandidate(source) {
  new vm.Script(source, { filename: "stage32b-index.js" });
  const sheetsStart = source.indexOf("async function readJoinWishesForMemberViaSheetsApi");
  const sheetsEnd = source.indexOf("async function readJoinWishesForMemberViaAppsScript", sheetsStart);
  const appsEnd = source.indexOf("async function readJoinWishesForMemberWithSource", sheetsEnd);
  const sheetsBlock = source.slice(sheetsStart, sheetsEnd);
  const appsBlock = source.slice(sheetsEnd, appsEnd);
  if (sheetsStart < 0 || sheetsEnd <= sheetsStart || appsEnd <= sheetsEnd) {
    throw new Error("join_wish_server_read_blocks_missing");
  }
  if (/status[^\n]*active/i.test(sheetsBlock) || /status:\s*"active"/.test(appsBlock)) {
    throw new Error("deleted_wish_tombstone_filtered_on_server");
  }
}

async function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);

  const candidate = await buildStage15Candidate({
    sourcePackage: SOURCE_PACKAGE,
    stagingEventPlanSeq: 29,
    generatedAt: new Date().toISOString()
  });
  const logicalCss = zlib.gunzipSync(candidate.cssGzip).toString("utf8");
  const logicalJs = zlib.brotliDecompressSync(candidate.jsBrotli).toString("utf8");
  assertBrowserCandidate(logicalJs, logicalCss);

  const serverIndex = fs.readFileSync(SERVER_INDEX);
  const serverTest = fs.readFileSync(SERVER_TEST);
  const rollbackServer = fs.readFileSync(ROLLBACK_SERVER);
  const rollbackHtml = fs.readFileSync(ROLLBACK_HTML);
  assertServerCandidate(serverIndex.toString("utf8"));
  new vm.Script(serverTest.toString("utf8"), { filename: "stage32b-wish-deletion-tombstone.test.js" });
  new vm.Script(rollbackServer.toString("utf8"), { filename: "rollback-stage31k-index.js" });

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_wish_delete_backdrop_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    serverIndex: "stage32b-index.js",
    serverTest: "stage32b-wish-deletion-tombstone.test.js",
    rollbackServer: "ROLLBACK_stage31k-index.js"
  };
  const files = {
    deployHtml: candidate.candidateHtml,
    rollbackHtml,
    css: candidate.cssGzip,
    js: candidate.jsBrotli,
    serverIndex,
    serverTest,
    rollbackServer
  };

  const runbook = Buffer.from([
    "# v32b 찜 삭제 확정·PC 상세 배경 유지",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. 서버 후보·테스트·CSS·JS를 Cloud Shell에 업로드하고 해시를 확인한다.",
    "- [ ] 2. 현재 Sheet API 리비전을 기록한다.",
    "- [ ] 3. 서버 후보를 index.js로, 테스트 후보를 테스트 파일로 교체한다.",
    "- [ ] 4. node --check와 npm test 통과 후 golfjoin-sheet-api만 배포한다.",
    "- [ ] 5. 배포 환경변수에서 GOLFJOIN_MEMBER_AUTH_GATE=report를 확인한다.",
    "- [ ] 6. CSS·JS를 GCS 신규 불변 경로에 업로드하고 응답 헤더를 확인한다.",
    "- [ ] 7. 신규 HTML을 시험 페이지에 저장한다.",
    "- [ ] 8. 상품군 상품 2개와 일반상품 1개를 찜한 뒤 세 상품을 모두 삭제한다.",
    "- [ ] 9. 즉시·새로고침·로그아웃/로그인 후 찜 목록이 0개인지 확인한다.",
    "- [ ] 10. Google Sheet의 deleted 행이 다시 카드로 나타나지 않는지 확인한다.",
    "- [ ] 11. PC 상세모달 뒤에 현재 메인 위치가 어둡게 마스킹되어 보이는지 확인한다.",
    "- [ ] 12. PC 상세 닫기 후 원래 스크롤 위치, 모바일 상세 잠금·복원을 확인한다.",
    "- [ ] 13. 상품군 찜 상세의 정확한 기간·가격·이미지와 투명 기간 영역을 확인한다.",
    "- [ ] 14. 비로그인·카카오·일반회원 및 나의모임·내예약 회귀를 확인한다.",
    "- [ ] 15. 모두 정상일 때 같은 HTML을 운영 페이지에 저장한다.",
    "- [ ] 16. 문제 시 HTML을 먼저 복구하고 필요하면 Sheet API도 복구한다.",
    "",
    "## 서버 교체·검사·배포",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `cp -f ${names.serverIndex} index.js`,
    `cp -f ${names.serverTest} wish-deletion-tombstone.test.js`,
    "node --check index.js",
    "node --check wish-deletion-tombstone.test.js",
    "npm test",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "```",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "```",
    "",
    `신규 HTML: ${names.deployHtml}`,
    `HTML 복구: ${names.rollbackHtml}`,
    `서버 복구: ${names.rollbackServer}를 index.js로 교체 후 같은 배포 명령 실행`,
    "Aligo API는 배포하지 않습니다. 회원 인증 Gate는 report를 유지합니다.",
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false });
  Object.entries(names).forEach(([key, fileName]) => writeExclusive(fileName, files[key]));
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "secret-golf-join-wish-delete-backdrop-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      wishedExactProductDetail: true,
      deletedWishTombstonesReturnedByServer: true,
      deletedWishTombstonesPreservedByBrowser: true,
      staleLocalWishesCannotResurrect: true,
      detailFamilyPeriodsBackgroundRemoved: true,
      pcDetailBackdropPreserved: true,
      mobileFixedScrollLockPreserved: true,
      sheetApiRedeployRequired: true,
      aligoApiRedeployRequired: false,
      memberAuthGateRemainsReport: true
    },
    assets: {
      css: { objectName: candidate.assets.css.objectName },
      js: { objectName: candidate.assets.js.objectName }
    },
    files: {
      deployHtml: fileRecord(names.deployHtml, files.deployHtml),
      rollbackHtml: fileRecord(names.rollbackHtml, files.rollbackHtml),
      css: fileRecord(names.css, files.css, { contentEncoding: "gzip", objectName: candidate.assets.css.objectName }),
      js: fileRecord(names.js, files.js, { contentEncoding: "br", objectName: candidate.assets.js.objectName }),
      serverIndex: fileRecord(names.serverIndex, files.serverIndex),
      serverTest: fileRecord(names.serverTest, files.serverTest),
      rollbackServer: fileRecord(names.rollbackServer, files.rollbackServer),
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
