"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { IMMUTABLE_CACHE_CONTROL, sha256 } = require("./external-assets");
const { buildStage15Candidate } = require("./prepare-stage15-sms-auth");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, "deploy/stage31-owner-quote-integrity/owner-quote-integrity-20260820-v31h");
const CURRENT_PRODUCTION_HTML = path.join(
  WORKSPACE_ROOT,
  "deploy/stage29-calendar-alimtalk/mobile-today-label-20260820-v29k/DEPLOY_golfjoin_main_calendar_alimtalk_D1473B28.html"
);
const SOURCE_PACKAGE = path.join(WORKSPACE_ROOT, "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25");
const STAGING_EVENT_PLAN_SEQ = 29;

function publicUrl(objectName) {
  return `https://storage.googleapis.com/golfjoin-bucket/${objectName}`;
}

function writeExclusive(fileName, buffer) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), buffer, { flag: "wx" });
}

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

async function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);
  const candidate = await buildStage15Candidate({
    sourcePackage: SOURCE_PACKAGE,
    stagingEventPlanSeq: STAGING_EVENT_PLAN_SEQ,
    generatedAt: new Date().toISOString()
  });
  zlib.gunzipSync(candidate.cssGzip);
  const logicalJs = zlib.brotliDecompressSync(candidate.jsBrotli);
  new vm.Script(logicalJs.toString("utf8"), { filename: "stage31-golfjoin-main.js" });

  const rollbackHtml = fs.readFileSync(CURRENT_PRODUCTION_HTML);
  const serverIndex = fs.readFileSync(path.join(WORKSPACE_ROOT, "server/google-sheet-proxy-function/index.js"));
  const serverTest = fs.readFileSync(path.join(WORKSPACE_ROOT, "server/google-sheet-proxy-function/quote-row-integrity.test.js"));
  const repairScript = fs.readFileSync(path.join(WORKSPACE_ROOT, "server/google-sheet-proxy-function/repair-test-schedule-quote-row.js"));
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_owner_quote_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    serverIndex: "stage31-index.js",
    serverTest: "stage31-quote-row-integrity.test.js",
    repairScript: "stage31-repair-test-schedule-quote-row.js"
  };
  const hashes = {
    deployHtml: sha256(candidate.candidateHtml),
    rollbackHtml: sha256(rollbackHtml),
    css: sha256(candidate.cssGzip),
    js: sha256(candidate.jsBrotli),
    serverIndex: sha256(serverIndex),
    serverTest: sha256(serverTest),
    repairScript: sha256(repairScript)
  };
  const runbook = Buffer.from([
    "# 31단계 생성자 우선·견적 행 무결성 복구 배포",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. Cloud Shell 서버 폴더에 stage31 서버 파일 3개를 업로드한다.",
    "- [ ] 2. 아래 해시와 업로드 파일 해시가 모두 같은지 확인한다.",
    "- [ ] 3. index.js와 신규 테스트를 교체하고 npm test를 통과시킨다.",
    "- [ ] 4. 현재 Sheet API 리비전을 기록한 뒤 Sheet API만 배포한다.",
    "- [ ] 5. 손상된 테스트 일정 복구를 먼저 dry-run하고 값 확인 후 apply한다.",
    "- [ ] 6. 신규 CSS·JS 불변 객체를 GCS에 업로드하고 응답 헤더를 확인한다.",
    `- [ ] 7. 테스트 페이지 ${STAGING_EVENT_PLAN_SEQ}에 신규 HTML을 저장한다.`,
    "- [ ] 8. 생성자 A의 멤버추가 딥링크·나의모임·내예약·견적 금액을 검사한다.",
    "- [ ] 9. 운영 HTML을 전환하고 최종 회귀 검사를 한다.",
    "- [ ] 10. 이상 시 D1473B28 HTML과 직전 Sheet API 리비전으로 즉시 복구한다.",
    "",
    "## 파일 해시",
    "",
    "```text",
    `${names.serverIndex}  ${hashes.serverIndex}`,
    `${names.serverTest}  ${hashes.serverTest}`,
    `${names.repairScript}  ${hashes.repairScript}`,
    `${names.css}  ${hashes.css}`,
    `${names.js}  ${hashes.js}`,
    `${names.deployHtml}  ${hashes.deployHtml}`,
    `${names.rollbackHtml}  ${hashes.rollbackHtml}`,
    "```",
    "",
    "## 서버 교체와 테스트",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `cp -f ${names.serverIndex} index.js`,
    `cp -f ${names.serverTest} quote-row-integrity.test.js`,
    `cp -f ${names.repairScript} repair-test-schedule-quote-row.js`,
    "node --check index.js",
    "node --check repair-test-schedule-quote-row.js",
    "npm test",
    "```",
    "",
    "## Sheet API 배포",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "PREVIOUS_STAGE31_REVISION=\"$(gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='value(serviceConfig.revision)')\"",
    "printf 'PREVIOUS_STAGE31_REVISION=%s\\n' \"$PREVIOUS_STAGE31_REVISION\"",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "```",
    "",
    "## 손상된 테스트 일정 1건 복구",
    "",
    "먼저 dry-run 결과의 상품명·상품가·견적 1인가·출발일·도착일을 확인합니다.",
    "견적 1인가는 밀린 productPrice가 아니라 저장된 암호화 견적 JSON의 unitPrice를 복호화·검증해 가져옵니다.",
    "견적 JSON을 찾지 못하면 스크립트는 변경 없이 중단하며, 견적서에서 직접 확인한 금액만 --quote-unit-price로 지정할 수 있습니다.",
    "",
    "```bash",
    "node repair-test-schedule-quote-row.js --quota-project=golfjoin-499602 --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "```",
    "",
    "값이 맞을 때만 실제 복구합니다.",
    "",
    "```bash",
    "node repair-test-schedule-quote-row.js --apply --quota-project=golfjoin-499602 --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "```",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "```",
    "",
    `테스트 페이지에는 ${names.deployHtml} 전체 내용을 저장합니다.`,
    `문제가 생기면 ${names.rollbackHtml} 전체 내용으로 메인 HTML을 복구합니다.`,
    "서버 문제는 위에서 기록한 PREVIOUS_STAGE31_REVISION으로 Cloud Run 트래픽을 100% 되돌립니다.",
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false });
  writeExclusive(names.deployHtml, candidate.candidateHtml);
  writeExclusive(names.rollbackHtml, rollbackHtml);
  writeExclusive(names.css, candidate.cssGzip);
  writeExclusive(names.js, candidate.jsBrotli);
  writeExclusive(names.serverIndex, serverIndex);
  writeExclusive(names.serverTest, serverTest);
  writeExclusive(names.repairScript, repairScript);
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "secret-golf-join-owner-quote-integrity-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    stagingEventPlanSeq: STAGING_EVENT_PLAN_SEQ,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      actualSheetHeaderOrderWrites: true,
      ownerRelationshipPrecedence: true,
      ownerParticipantBadgePrecedence: true,
      memberHydratedDeepLinks: true,
      canonicalTripRecoveryFromJoinApplication: true,
      quoteUnitPriceCards: true,
      guardedSingleScheduleRepair: true
    },
    assets: {
      css: { objectName: candidate.assets.css.objectName, url: publicUrl(candidate.assets.css.objectName) },
      js: { objectName: candidate.assets.js.objectName, url: publicUrl(candidate.assets.js.objectName) }
    },
    files: {
      deployHtml: fileRecord(names.deployHtml, candidate.candidateHtml),
      rollbackHtml: fileRecord(names.rollbackHtml, rollbackHtml),
      css: fileRecord(names.css, candidate.cssGzip, { contentEncoding: "gzip", objectName: candidate.assets.css.objectName }),
      js: fileRecord(names.js, candidate.jsBrotli, { contentEncoding: "br", objectName: candidate.assets.js.objectName }),
      serverIndex: fileRecord(names.serverIndex, serverIndex),
      serverTest: fileRecord(names.serverTest, serverTest),
      repairScript: fileRecord(names.repairScript, repairScript),
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
