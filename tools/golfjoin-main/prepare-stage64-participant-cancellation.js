"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const MAIN_BASELINE = path.join(
  ROOT,
  "deploy/stage62-recommended-detail-sticky-tabs/recommended-detail-sticky-tabs-20260907-v62"
);
const DASHBOARD_BASELINE = path.join(
  ROOT,
  "deploy/stage63-consultation-cutover/admin-consultation-cutover-new-badge-modal-drag-new-schedule-three-day-20260909-v63d"
);
const OUTPUT = path.join(
  ROOT,
  "deploy/stage64-participant-cancellation/participant-cancellation-20260909-v64"
);

const OLD_PUBLIC_FILTER = "function isPublicHomeJoinSchedule(e={}){return!0===e?.isPublicHomeSchedule}";
const NEW_PUBLIC_FILTER = "function isPublicHomeJoinSchedule(e={}){const t=[e.applicationStatus,e.status,e.scheduleStatus,e.approvalStatus,e.lightSummary?.approvalStatus].map(e=>String(e||\"\").trim().toLowerCase()),i=String(e.displayStatus||\"\").trim().toLowerCase();return!t.some(e=>[\"cancelled\",\"canceled\",\"취소\",\"deleted\",\"삭제\",\"rejected\",\"반려\"].includes(e))&&![\"hidden\",\"숨김\",\"deleted\",\"삭제\"].includes(i)&&!0===e?.isPublicHomeSchedule}";
const OLD_REGION_FILTER = "joins.filter(isUserCreatedJoinSchedule).forEach";
const NEW_REGION_FILTER = "joins.filter(isUserCreatedJoinSchedule).filter(isPublicHomeJoinSchedule).forEach";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sri(value) {
  return `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;
}

function readVerified(root, record, label) {
  const value = fs.readFileSync(path.join(root, record.fileName));
  if (sha256(value) !== record.sha256) throw new Error(`${label}_hash_mismatch`);
  return value;
}

function replaceExact(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count !== 1) throw new Error(`${label}_count_invalid:${count}`);
  return source.replace(target, replacement);
}

function verifyInlineScripts(html, label) {
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  scripts.forEach((source, index) => new vm.Script(source, { filename: `${label}-inline-${index + 1}.js` }));
  return scripts.length;
}

function makeMainCloudShellTest(names, hashes) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `const cssGz=fs.readFileSync(${JSON.stringify(names.css)}),jsBr=fs.readFileSync(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v64 메인 업로드 자산 해시와 JavaScript 문법이 유효하다",()=>{assert.equal(hash(cssGz),${JSON.stringify(hashes.css)});assert.equal(hash(jsBr),${JSON.stringify(hashes.js)});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v64 메인은 취소·숨김 일정을 모든 홈 섹션에서 제외한다",()=>{assert.ok(js.includes(${JSON.stringify(NEW_PUBLIC_FILTER)}));assert.equal(js.includes(${JSON.stringify(OLD_PUBLIC_FILTER)}),false)});\n`
    + `test("v64 여행지 검색 지역 집계도 취소·숨김 일정을 제외한다",()=>{assert.ok(js.includes(${JSON.stringify(NEW_REGION_FILTER)}));assert.equal(js.includes(${JSON.stringify(OLD_REGION_FILTER)}),false)});\n`;
}

function makeDashboardTest(names, hashes) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `const deploy=read(${JSON.stringify(names.dashboardDeploy)}),rollback=read(${JSON.stringify(names.dashboardRollback)}),html=deploy.toString("utf8");\n`
    + `test("v64 대시보드 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.dashboardDeploy)});assert.equal(hash(rollback),${JSON.stringify(hashes.dashboardRollback)})});\n`
    + `test("v64 대시보드 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new vm.Script(html.slice(a+8,b)))});\n`
    + `test("v64 취소는 전용 서버 작업과 필수 사유를 사용한다",()=>{for(const value of ["admin_participant_cancel","cancelScheduleParticipant","submitAdminParticipantCancellation","취소 사유를 입력해 주세요.","expectedUpdatedAt"])assert.ok(html.includes(value),value)});\n`
    + `test("v64 활성 참여자가 없으면 일정취소 탭으로 이동한다",()=>{for(const value of ["response.scheduleCancelled","statusFilter.value = \\"cancelled\\"","closeParticipantListModal","loadDashboard"])assert.ok(html.includes(value),value)});\n`
    + `test("v64 취소자는 집계에서 제외되고 명단 하단에 표시된다",()=>{for(const value of ["isParticipantCancelled","getActiveParticipantDisplayRows","is-cancelled","participant-role-badge cancelled","Number(isParticipantCancelled(left.row))","취소"])assert.ok(html.includes(value),value)});\n`
    + `test("v64 생성자 취소 후 참여자가 남으면 관리자 운영으로 표시한다",()=>{assert.ok(html.includes("생성자 취소 · 관리자 운영"));assert.ok(html.includes("isParticipantCancelled(schedule.row || {}) && getParticipantRosterCounts(schedule).active > 0"))});\n`
    + `test("v64 입금 여부에 따라 환불 불필요·환불대기·환불완료를 구분한다",()=>{for(const value of ["isParticipantDepositPaid","isParticipantBalancePaid","renderParticipantPaymentReadonlyBadge","환불 불필요","환불대기","환불완료"])assert.ok(html.includes(value),value)});\n`;
}

function makePackageTest(names, hashes, revision) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `const main=read(${JSON.stringify(names.mainDeploy)}),mainRollback=read(${JSON.stringify(names.mainRollback)}),css=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),dashboard=read(${JSON.stringify(names.dashboardDeploy)}),dashboardRollback=read(${JSON.stringify(names.dashboardRollback)}),server=read(${JSON.stringify(names.server)});\n`
    + `test("v64 전체 산출물 해시가 일치한다",()=>{const actual={main:hash(main),mainRollback:hash(mainRollback),css:hash(css),js:hash(jsBr),dashboard:hash(dashboard),dashboardRollback:hash(dashboardRollback),server:hash(server)};assert.deepEqual(actual,${JSON.stringify({ main: hashes.mainDeploy, mainRollback: hashes.mainRollback, css: hashes.css, js: hashes.js, dashboard: hashes.dashboardDeploy, dashboardRollback: hashes.dashboardRollback, server: hashes.server })})});\n`
    + `test("v64 메인 HTML은 신규 리비전과 논리 SRI를 사용한다",()=>{const html=main.toString("utf8"),js=zlib.brotliDecompressSync(jsBr);assert.ok(html.includes(${JSON.stringify(revision)}));assert.ok(html.includes(${JSON.stringify(hashes.cssSri)}));assert.ok(html.includes(${JSON.stringify(hashes.jsSri)}));assert.doesNotThrow(()=>new vm.Script(js.toString("utf8")))});\n`
    + `test("v64 서버·대시보드 취소 계약을 포함한다",()=>{const api=server.toString("utf8"),admin=dashboard.toString("utf8");for(const value of ["admin_participant_cancel","buildAdminParticipantCancellationDecision","cancelAdminParticipantViaSheetsApi","join_schedule_unavailable"])assert.ok(api.includes(value),value);for(const value of ["submitAdminParticipantCancellation","participant-role-badge cancelled","생성자 취소 · 관리자 운영"])assert.ok(admin.includes(value),value)});\n`;
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 64 - 참여자 취소와 일정 공개 차단\n\n`
    + `참여자 취소를 서버의 단일 작업으로 처리합니다. 취소 뒤 활성 인원이 남으면 해당 고객만 취소하고, 0명이면 고객 생성 일정을 취소·숨김 처리해 메인페이지와 여행지 검색에서 제외합니다. 취소자는 명단 하단에 감사 이력으로 남고 모집·결제·성별 집계에서는 제외됩니다.\n\n`
    + `## 1. Cloud Shell - 서버 파일 업로드·검증\n\n`
    + `아래 3개 파일을 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다.\n\n`
    + `- ${names.server}\n- ${names.serverTest}\n- ${names.mainCloudTest}\n\n`
    + `메인 자산 ${names.css}, ${names.js}도 같은 폴더에 업로드합니다. 메인 HTML은 Cloud Shell에 올리지 않습니다.\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.server} ${names.serverTest} ${names.mainCloudTest} ${names.css} ${names.js}\ncp -f index.js BACKUP_pre_stage64_index.js\ncp -f ${names.server} index.js\nnode --check index.js\nnode --test ${names.serverTest} ${names.mainCloudTest}\n\`\`\`\n\n`
    + `정상 결과는 tests 8, pass 8, fail 0입니다.\n\n`
    + `## 2. Cloud Function 배포\n\n`
    + `\`\`\`bash\nPREVIOUS_STAGE64_REVISION="$(gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='value(serviceConfig.revision)')"\nprintf 'PREVIOUS_STAGE64_REVISION=%s\\n' "$PREVIOUS_STAGE64_REVISION"\ngcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml\ngcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest\ngcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(state,updateTime,serviceConfig.revision,serviceConfig.uri)'\ngcloud run services describe golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(status.latestCreatedRevisionName,status.latestReadyRevisionName,status.traffic)'\n\`\`\`\n\n`
    + `## 3. 메인 자산 업로드·HTML 교체\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\ncurl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\ncurl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n\`\`\`\n\n`
    + `ERP 편집기에서 ${names.mainDeploy} 전체 내용으로 교체합니다.\n\n`
    + `## 4. 관리자 대시보드 업로드·배포\n\n`
    + `아래 3개 파일을 \`/home/llno95ll/golfjoin-admin-hosting\`에 업로드합니다.\n\n`
    + `- ${names.dashboardDeploy}\n- ${names.dashboardRollback}\n- ${names.dashboardTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/golfjoin-admin-hosting\nsha256sum ${names.dashboardDeploy} ${names.dashboardRollback} ${names.dashboardTest}\nnode --test ${names.dashboardTest}\ncp -f public/index.html BACKUP_pre_stage64_admin_dashboard.html\ncp -f ${names.dashboardDeploy} public/index.html\nsha256sum public/index.html BACKUP_pre_stage64_admin_dashboard.html\nfirebase deploy --only hosting --project dashboad-golfjoin-secrettour\n\`\`\`\n\n`
    + `정상 결과는 tests 7, pass 7, fail 0입니다.\n\n`
    + `## 5. 운영 확인\n\n`
    + `1. 참여자가 2명 이상인 일정에서 한 명을 취소하고 일정이 유지되는지 확인합니다.\n`
    + `2. 취소 고객이 명단 하단에 표시되고 활성 인원·성별·결제 집계에서 빠지는지 확인합니다.\n`
    + `3. 생성자를 취소해도 다른 참여자가 남으면 '생성자 취소 · 관리자 운영'이 표시되는지 확인합니다.\n`
    + `4. 활성 인원이 1명인 고객 생성 일정에서 마지막 고객을 취소하면 일정취소 탭으로 이동하는지 확인합니다.\n`
    + `5. 메인페이지 새로고침 뒤 해당 일정이 모든 섹션·여행지 검색에서 사라졌는지 확인합니다.\n`
    + `6. 취소된 일정에 기존 딥링크로 신규 참여를 시도하면 차단되는지 확인합니다.\n`
    + `7. 미입금 취소는 환불 불필요, 입금 취소는 환불대기로 표시되는지 확인합니다.\n\n`
    + `## 6. 복구\n\n`
    + `관리자 HTML은 ${names.dashboardRollback}, 메인 HTML은 ${names.mainRollback}으로 교체합니다. 서버는 PREVIOUS_STAGE64_REVISION으로 트래픽을 되돌리고 BACKUP_pre_stage64_index.js를 index.js로 복원합니다. GCS 객체는 삭제하지 않습니다.\n\n`
    + `- 메인 배포 SHA-256: ${hashes.mainDeploy}\n`
    + `- 대시보드 배포 SHA-256: ${hashes.dashboardDeploy}\n`
    + `- 서버 index SHA-256: ${hashes.server}\n`;
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const mainManifest = JSON.parse(fs.readFileSync(path.join(MAIN_BASELINE, "manifest.json"), "utf8"));
  const mainRollback = readVerified(MAIN_BASELINE, mainManifest.files.deployHtml, "main_html");
  const oldCssGzip = readVerified(MAIN_BASELINE, mainManifest.files.css, "main_css");
  const oldJsBrotli = readVerified(MAIN_BASELINE, mainManifest.files.js, "main_js");
  const css = zlib.gunzipSync(oldCssGzip);
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");
  let nextJs = replaceExact(oldJs, OLD_PUBLIC_FILTER, NEW_PUBLIC_FILTER, "public_filter");
  nextJs = replaceExact(nextJs, OLD_REGION_FILTER, NEW_REGION_FILTER, "region_filter");
  new vm.Script(nextJs, { filename: "golfjoin-main-v64.js" });
  const js = Buffer.from(nextJs, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");
  const revision = `gha_${sha256(Buffer.concat([css, Buffer.from("\n--golfjoin-asset-boundary--\n"), js, Buffer.from("\n--golfjoin-participant-cancellation-v1--\n")])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let mainDeployText = mainRollback.toString("utf8").split(mainManifest.assetRevision).join(revision);
  mainDeployText = replaceExact(mainDeployText, mainManifest.files.js.logicalSri, jsSri, "main_js_sri");
  verifyInlineScripts(mainDeployText, "main");
  const mainDeploy = Buffer.from(mainDeployText, "utf8");

  const dashboardManifest = JSON.parse(fs.readFileSync(path.join(DASHBOARD_BASELINE, "manifest.json"), "utf8"));
  const dashboardRollbackRecord = dashboardManifest.files.find((item) => item.name.startsWith("DEPLOY_"));
  const dashboardRollback = fs.readFileSync(path.join(DASHBOARD_BASELINE, dashboardRollbackRecord.name));
  if (sha256(dashboardRollback) !== dashboardRollbackRecord.sha256) throw new Error("dashboard_baseline_hash_mismatch");
  const dashboardDeploy = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"));
  verifyInlineScripts(dashboardDeploy.toString("utf8"), "dashboard");
  const server = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
  new vm.Script(server.toString("utf8"), { filename: "stage64-index.js" });
  const serverTest = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/participant-cancellation.test.js"));

  const hashes = {
    mainDeploy: sha256(mainDeploy),
    mainRollback: sha256(mainRollback),
    css: sha256(oldCssGzip),
    js: sha256(jsBrotli),
    cssSri,
    jsSri,
    dashboardDeploy: sha256(dashboardDeploy),
    dashboardRollback: sha256(dashboardRollback),
    server: sha256(server),
    serverTest: sha256(serverTest)
  };
  const names = {
    mainDeploy: `DEPLOY_golfjoin_main_participant_cancellation_${hashes.mainDeploy.slice(0, 8).toUpperCase()}.html`,
    mainRollback: `ROLLBACK_golfjoin_main_${hashes.mainRollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    dashboardDeploy: `DEPLOY_golfjoin_admin_dashboard_${hashes.dashboardDeploy.slice(0, 8).toUpperCase()}.html`,
    dashboardRollback: `ROLLBACK_golfjoin_admin_dashboard_${hashes.dashboardRollback.slice(0, 8).toUpperCase()}.html`,
    server: "stage64-index.js",
    serverTest: "stage64-participant-cancellation.test.js",
    mainCloudTest: "stage64-main-public-cancellation-cloudshell.test.js",
    dashboardTest: "stage64-dashboard-participant-cancellation.test.js",
    packageTest: "stage64-participant-cancellation-package.test.js"
  };

  const mainCloudTest = Buffer.from(makeMainCloudShellTest(names, hashes), "utf8");
  const dashboardTest = Buffer.from(makeDashboardTest(names, hashes), "utf8");
  const packageTest = Buffer.from(makePackageTest(names, hashes, revision), "utf8");
  const runbook = Buffer.from(makeRunbook(names, hashes, revision), "utf8");
  const manifest = {
    schema: "golfjoin-participant-cancellation-v1",
    version: "v64",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    behavior: {
      cancellationReasonRequired: true,
      cancelOnlySelectedParticipantWhenActivePeopleRemain: true,
      cancelScheduleWhenNoActivePeopleRemain: true,
      creatorCancellationKeepsScheduleUnderAdminOperation: true,
      cancelledParticipantsExcludedFromOperationalCounts: true,
      cancelledSchedulesExcludedFromPublicHomeAndRegionSearch: true,
      unavailableSchedulesRejectNewApplications: true,
      refundStatusDerivedFromPayment: true
    },
    names,
    hashes
  };

  fs.mkdirSync(OUTPUT, { recursive: true });
  const files = new Map([
    [names.mainDeploy, mainDeploy],
    [names.mainRollback, mainRollback],
    [names.css, oldCssGzip],
    [names.js, jsBrotli],
    [names.dashboardDeploy, dashboardDeploy],
    [names.dashboardRollback, dashboardRollback],
    [names.server, server],
    [names.serverTest, serverTest],
    [names.mainCloudTest, mainCloudTest],
    [names.dashboardTest, dashboardTest],
    [names.packageTest, packageTest],
    ["RUNBOOK.md", runbook]
  ]);
  files.forEach((value, name) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(ROOT, "golfjoin_main.html"), mainDeploy);
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, revision, names, hashes }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  }
}
