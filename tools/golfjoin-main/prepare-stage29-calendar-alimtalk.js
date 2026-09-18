"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { IMMUTABLE_CACHE_CONTROL, sha256 } = require("./external-assets");
const { buildStage15Candidate } = require("./prepare-stage15-sms-auth");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const SOURCE_PACKAGE = path.join(
  WORKSPACE_ROOT,
  "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25"
);
const OUTPUT_ROOT = process.env.GOLFJOIN_STAGE29_OUTPUT_ROOT
  ? path.resolve(WORKSPACE_ROOT, process.env.GOLFJOIN_STAGE29_OUTPUT_ROOT)
  : path.join(
    WORKSPACE_ROOT,
    "deploy/stage29-calendar-alimtalk/date-conflict-alimtalk-20260818-v29"
  );
const STAGING_EVENT_PLAN_SEQ = Number(process.env.GOLFJOIN_STAGE29_EVENT_PLAN_SEQ || 28);

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function writeExclusive(fileName, buffer) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), buffer, { flag: "wx" });
}

function publicUrl(objectName) {
  return `https://storage.googleapis.com/golfjoin-bucket/${objectName}`;
}

function buildRunbook(candidate, names, hashes) {
  return [
    "# 29단계 일정 충돌 방지·알림톡 개편 배포",
    "",
    "현 운영 HTML C821B0D1을 복구본으로 보존합니다.",
    "알림톡 전송 작업자는 Aligo 함수이므로 Aligo를 먼저 배포하고 Sheet API를 다음에 배포합니다.",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. Cloud Shell에 stage29 서버 파일 2개를 업로드하고 해시를 확인한다.",
    "- [ ] 2. index.js와 알림톡 테스트 파일을 교체하고 npm test를 통과시킨다.",
    "- [ ] 3. golfjoin-aligo-api를 먼저, golfjoin-sheet-api를 다음에 배포한다.",
    "- [ ] 4. GCS에 신규 gzip CSS와 Brotli JS를 업로드하고 응답 헤더를 확인한다.",
    `- [ ] 5. eventPlanSeq ${STAGING_EVENT_PLAN_SEQ}에 신규 HTML을 넣어 PC·모바일 날짜 충돌 규칙을 검사한다.`,
    "- [ ] 6. 생성·참여·모집완료 알림톡을 성별별로 검사한다.",
    "- [ ] 7. 대시보드 신규 HTML에서 견적 알림톡 전송을 검사한다.",
    "- [ ] 8. 운영 HTML과 대시보드를 전환한 뒤 핵심 회귀 검사를 한다.",
    "- [ ] 9. 문제가 있으면 ROLLBACK HTML로 즉시 복구한다.",
    "",
    "## 업로드 파일 해시",
    "",
    "```text",
    `${names.serverIndex}  ${hashes.serverIndex}`,
    `${names.alimtalkTest}  ${hashes.alimtalkTest}`,
    `${names.dashboardHtml}  ${hashes.dashboardHtml}`,
    `${names.css}  ${hashes.css}`,
    `${names.js}  ${hashes.js}`,
    `${names.deployHtml}  ${hashes.deployHtml}`,
    `${names.rollbackHtml}  ${hashes.rollbackHtml}`,
    "```",
    "",
    "## 서버 배포 전 교체",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `cp -f ${names.serverIndex} index.js`,
    `cp -f ${names.alimtalkTest} alimtalk-templates.test.js`,
    "node --check index.js",
    "npm test",
    "```",
    "",
    "## 서버 함수 순차 배포",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "export VPC_CONNECTOR=\"golfjoin-vpc-connector\"",
    "gcloud functions deploy golfjoin-aligo-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=300s --cpu=1 --memory=1GiB --min-instances=0 --max-instances=3 --concurrency=5 --no-allow-unauthenticated --vpc-connector=\"${VPC_CONNECTOR}\" --egress-settings=all --env-vars-file=/home/llno95ll/golfjoin-aligo-api.env.yaml && \\",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "unset VPC_CONNECTOR",
    "```",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "",
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "```",
    "",
    "## 테스트와 복구",
    "",
    `테스트 페이지 ${STAGING_EVENT_PLAN_SEQ}에는 ${names.deployHtml} 전체 내용을 넣습니다.`,
    `대시보드는 ${names.dashboardHtml} 전체 내용으로 교체합니다.`,
    `문제가 생기면 메인 HTML을 ${names.rollbackHtml} 내용으로 즉시 되돌립니다.`,
    "GCS 불변 객체는 복구 시 삭제하지 않습니다.",
    ""
  ].join("\n");
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
  new vm.Script(logicalJs.toString("utf8"), { filename: "stage29-golfjoin-main.js" });

  const serverIndex = fs.readFileSync(path.join(WORKSPACE_ROOT, "server/google-sheet-proxy-function/index.js"));
  const alimtalkTest = fs.readFileSync(path.join(WORKSPACE_ROOT, "server/google-sheet-proxy-function/alimtalk-templates.test.js"));
  const dashboardHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, "golfjoin_admin_dashboard.html"));
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_calendar_alimtalk_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(candidate.rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    auditJs: `AUDIT_golfjoin-main_${sha256(candidate.minifiedJs).slice(0, 8).toUpperCase()}.min.js`,
    serverIndex: "stage29-index.js",
    alimtalkTest: "stage29-alimtalk-templates.test.js",
    dashboardHtml: `DEPLOY_golfjoin_admin_dashboard_${sha256(dashboardHtml).slice(0, 8).toUpperCase()}.html`
  };
  const hashes = {
    deployHtml: sha256(candidate.candidateHtml),
    rollbackHtml: sha256(candidate.rollbackHtml),
    css: sha256(candidate.cssGzip),
    js: sha256(candidate.jsBrotli),
    serverIndex: sha256(serverIndex),
    alimtalkTest: sha256(alimtalkTest),
    dashboardHtml: sha256(dashboardHtml)
  };
  const runbook = Buffer.from(buildRunbook(candidate, names, hashes), "utf8");
  const files = {
    deployHtml: record(names.deployHtml, candidate.candidateHtml),
    rollbackHtml: record(names.rollbackHtml, candidate.rollbackHtml),
    css: record(names.css, candidate.cssGzip, {
      logicalBytes: candidate.css.length,
      logicalSha256: sha256(candidate.css),
      sri: candidate.assets.css.sri,
      objectName: candidate.assets.css.objectName,
      url: publicUrl(candidate.assets.css.objectName),
      contentEncoding: "gzip"
    }),
    js: record(names.js, candidate.jsBrotli, {
      logicalBytes: candidate.minifiedJs.length,
      logicalSha256: sha256(candidate.minifiedJs),
      sri: candidate.assets.js.sri,
      objectName: candidate.assets.js.objectName,
      url: publicUrl(candidate.assets.js.objectName),
      contentEncoding: "br"
    }),
    auditJs: record(names.auditJs, candidate.minifiedJs),
    serverIndex: record(names.serverIndex, serverIndex),
    alimtalkTest: record(names.alimtalkTest, alimtalkTest),
    dashboardHtml: record(names.dashboardHtml, dashboardHtml),
    runbook: record("RUNBOOK.md", runbook)
  };
  const manifest = {
    schema: "secret-golf-join-calendar-alimtalk-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    stagingEventPlanSeq: STAGING_EVENT_PLAN_SEQ,
    productionEventPlanSeq: 3,
    rollbackProductionHtmlSha256: hashes.rollbackHtml,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      memberScheduleConflictBlocking: true,
      itineraryDateUsesSelectedDeparture: true,
      regionDateFirstBuilder: true,
      joinableCalendarActiveScheduleRange: true,
      genderedAlimtalkTemplates: true,
      quoteAlimtalkDashboardAction: true
    },
    files
  };

  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false });
  writeExclusive(names.deployHtml, candidate.candidateHtml);
  writeExclusive(names.rollbackHtml, candidate.rollbackHtml);
  writeExclusive(names.css, candidate.cssGzip);
  writeExclusive(names.js, candidate.jsBrotli);
  writeExclusive(names.auditJs, candidate.minifiedJs);
  writeExclusive(names.serverIndex, serverIndex);
  writeExclusive(names.alimtalkTest, alimtalkTest);
  writeExclusive(names.dashboardHtml, dashboardHtml);
  writeExclusive("RUNBOOK.md", runbook);
  writeExclusive("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));

  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot: OUTPUT_ROOT, manifest }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
