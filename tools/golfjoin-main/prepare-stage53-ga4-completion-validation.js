"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const SERVER_OUTPUT = path.join(ROOT, "deploy/stage53-ga4-dashboard/ga4-completion-validation-api-20260901-v53a");
const ADMIN_OUTPUT = path.join(ROOT, "deploy/stage53-ga4-dashboard/ga4-completion-validation-admin-20260901-v53b");
const SERVER_ROLLBACK = path.join(ROOT, "deploy/stage51-ga4-dashboard/ga4-journey-funnels-api-20260901-v51a/DEPLOY_ga4-admin-analytics_674122E5.js");
const ADMIN_ROLLBACK = path.join(ROOT, "deploy/stage52-ga4-dashboard/ga4-admin-mobile-layout-20260901-v52a/DEPLOY_golfjoin_admin_dashboard_2D4FECFC.html");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`required_file_missing:${filePath}`);
  return fs.readFileSync(filePath);
}

function ensureNewOutput(output) {
  if (fs.existsSync(output)) throw new Error(`output_exists:${output}`);
  fs.mkdirSync(output, { recursive: true });
}

function write(output, fileName, value, validateJs = false) {
  if (validateJs) new vm.Script(value.toString("utf8"), { filename: fileName });
  fs.writeFileSync(path.join(output, fileName), value);
  return { fileName, sha256: sha256(value), bytes: value.length };
}

function prepareServer() {
  ensureNewOutput(SERVER_OUTPUT);
  const deploy = readRequired(path.join(SERVER_ROOT, "ga4-admin-analytics.js"));
  const deployTest = readRequired(path.join(SERVER_ROOT, "ga4-admin-analytics.test.js"));
  const integrationTest = readRequired(path.join(SERVER_ROOT, "ga4-admin-analytics-integration.test.js"));
  const rollback = readRequired(SERVER_ROLLBACK);
  const hashes = {
    deploy: sha256(deploy),
    deployTest: sha256(deployTest),
    integrationTest: sha256(integrationTest),
    rollback: sha256(rollback)
  };
  const names = {
    deploy: `DEPLOY_ga4-admin-analytics_${hashes.deploy.slice(0, 8).toUpperCase()}.js`,
    deployTest: `DEPLOY_ga4-admin-analytics_${hashes.deployTest.slice(0, 8).toUpperCase()}.test.js`,
    integrationTest: `DEPLOY_ga4-admin-analytics-integration_${hashes.integrationTest.slice(0, 8).toUpperCase()}.test.js`,
    rollback: `ROLLBACK_ga4-admin-analytics_${hashes.rollback.slice(0, 8).toUpperCase()}.js`,
    contractTest: "stage53a-ga4-completion-validation-api.test.js"
  };
  const contractTest = Buffer.from(`"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const file=(name)=>fs.readFileSync(path.join(__dirname,name));
const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
const deploy=file(${JSON.stringify(names.deploy)}),rollback=file(${JSON.stringify(names.rollback)}),source=deploy.toString("utf8");
test("v53a 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.deploy)});assert.equal(hash(rollback),${JSON.stringify(hashes.rollback)});});
test("v53a 서버 JavaScript 문법이 유효하다",()=>assert.doesNotThrow(()=>new Function("require","module","exports",source)));
test("v53a 참여 신청의 세 완료 신호를 교차 검증한다",()=>{for(const value of ['stepParameter: "apply_step"','key: "submit_start"','key: "step_complete"',"join_apply_complete"])assert.ok(source.includes(value),value);});
test("v53a 새 모임의 세 완료 신호를 교차 검증한다",()=>{for(const value of ['stepParameter: "builder_step"','key: "submit_start"','key: "step_complete"',"new_schedule_complete"])assert.ok(source.includes(value),value);});
test("v53a 수집 상태를 네 단계로 구분한다",()=>{for(const value of ["verified","collecting","needs_review","waiting","completion_signal_mismatch","submit_start_missing"])assert.ok(source.includes(value),value);});
test("v53a 기존 열 개 보고서와 응답 스키마를 유지한다",()=>{assert.ok(source.includes("GA4_DASHBOARD_REPORT_NAMES"));assert.ok(source.includes('schema: "golfjoin-ga4-admin-dashboard-v1"'));assert.ok(source.includes("internalFunnels"));assert.ok(source.includes("journeyFunnels"));});
test("v53a 완료 검증 응답은 개인정보를 포함하지 않는다",()=>assert.doesNotMatch(source,/member_id|member_seq|mobileNumber|emailAddress|birthDate/i));
`, "utf8");
  const files = [
    write(SERVER_OUTPUT, names.deploy, deploy, true),
    write(SERVER_OUTPUT, names.deployTest, deployTest, true),
    write(SERVER_OUTPUT, names.integrationTest, integrationTest, true),
    write(SERVER_OUTPUT, names.rollback, rollback, true),
    write(SERVER_OUTPUT, names.contractTest, contractTest, true)
  ];
  const manifest = {
    schema: "golfjoin-stage53a-ga4-completion-validation-api-v1",
    generatedAt: new Date().toISOString(),
    propertyId: "552152254",
    requires: "stage51a-ga4-journey-funnels-api",
    features: [
      "apply-three-signal-validation",
      "builder-three-signal-validation",
      "verified-collecting-needs-review-waiting-status",
      "no-extra-ga4-report",
      "aggregate-data-only"
    ],
    names,
    files
  };
  fs.writeFileSync(path.join(SERVER_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(SERVER_OUTPUT, "README.md"), `# Stage 53a - GA4 완료 이벤트 검증 API

기존 10개 GA4 보고서로 참여 신청·새 모임의 제출 시작, 단계 완료, 비즈니스 완료 이벤트를 교차 검증합니다. 추가 Data API 호출은 없습니다.

## 1. 업로드·검증

아래 5개 파일을 /home/llno95ll/google-sheet-proxy-function에 업로드합니다.

${files.map((file) => `- \`${file.fileName}\``).join("\n")}

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function
sha256sum ${names.deploy} ${names.deployTest} ${names.integrationTest} ${names.rollback} ${names.contractTest}
node --test ${names.contractTest}

cp -f ${names.deploy} ga4-admin-analytics.js
cp -f ${names.deployTest} ga4-admin-analytics.test.js
cp -f ${names.integrationTest} ga4-admin-analytics-integration.test.js

node --check ga4-admin-analytics.js
node --test ga4-admin-analytics.test.js ga4-admin-analytics-integration.test.js
\`\`\`

정상 결과는 계약 테스트 7/7, 서버 테스트 18/18, 실패 0입니다.

## 2. 배포

\`\`\`bash
gcloud functions deploy golfjoin-sheet-api \\
  --gen2 \\
  --runtime=nodejs22 \\
  --region=asia-northeast3 \\
  --project=golfjoin-499602 \\
  --source=. \\
  --entry-point=proxyGoogleSheet \\
  --trigger-http \\
  --timeout=540s \\
  --memory=1GiB \\
  --allow-unauthenticated \\
  --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
\`\`\`

## 3. 운영 응답 확인

관리자 로그인 상태의 브라우저 콘솔에서 실행합니다. 처음 보이는 Promise 또는 undefined는 오류가 아니며, 펼쳐진 최종 객체를 확인합니다.

\`\`\`js
void (async () => {
  const auth = JSON.parse(sessionStorage.getItem("golfjoinAdminAuth") || localStorage.getItem("golfjoinAdminAuth") || "{}");
  const url = new URL("https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api");
  url.searchParams.set("action", "admin_ga4_dashboard");
  url.searchParams.set("days", "7");
  const response = await fetch(url, { headers: { "X-Golfjoin-Admin-Token": auth.token || "" } });
  const data = await response.json();
  console.log({
    httpStatus: response.status,
    ok: data.ok,
    completionValidation: data.completionValidation,
    warnings: data.warnings
  });
})();
\`\`\`

HTTP 200, ok=true, completionValidation.flows 2개를 확인합니다. 실제 완료가 없으면 waiting 또는 collecting도 정상이며, needs_review만 Network와 코드를 재확인해야 합니다.

## 4. 복구

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function
cp -f ${names.rollback} ga4-admin-analytics.js
\`\`\`

복구 파일을 적용한 뒤 같은 Cloud Function 배포 명령을 실행합니다.
`);
  return { output: SERVER_OUTPUT, manifest };
}

function prepareAdmin() {
  ensureNewOutput(ADMIN_OUTPUT);
  const deploy = readRequired(path.join(ROOT, "golfjoin_admin_dashboard.html"));
  const rollback = readRequired(ADMIN_ROLLBACK);
  const deployHash = sha256(deploy);
  const rollbackHash = sha256(rollback);
  const names = {
    deploy: `DEPLOY_golfjoin_admin_dashboard_${deployHash.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_admin_dashboard_${rollbackHash.slice(0, 8).toUpperCase()}.html`,
    test: "stage53b-ga4-completion-validation-admin.test.js"
  };
  const contractTest = Buffer.from(`"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const file=(name)=>fs.readFileSync(path.join(__dirname,name));
const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
const deploy=file(${JSON.stringify(names.deploy)}),rollback=file(${JSON.stringify(names.rollback)}),html=deploy.toString("utf8");
test("v53b 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v53b 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new Function(html.slice(a+8,b)));});
test("v53b 완료 이벤트 수집 상태와 두 흐름을 표시한다",()=>{for(const value of ["완료 이벤트 수집 상태","renderAnalyticsCompletionValidation","참여 신청","새 모임 생성","completionValidation"])assert.ok(html.includes(value),value);});
test("v53b 네 상태와 세 신호 수치를 표시한다",()=>{for(const value of ["검증 완료","수집 중","확인 필요","수집 대기","제출 시작","단계 완료","완료 이벤트","activeUsers","eventCount"])assert.ok(html.includes(value),value);});
test("v53b 모바일 단일 열과 이벤트명 줄바꿈을 제공한다",()=>{assert.ok(html.includes(".analytics-validation-grid { grid-template-columns: 1fr; }"));assert.ok(html.includes("overflow-wrap: anywhere"));assert.ok(html.includes("analytics-layout-active"));});
test("v53b v52 필터·퍼널·인라인 파비콘을 유지한다",()=>{for(const value of ["analyticsPeriodFilter","analyticsCompareFilter","여행지 검색 퍼널","로그인 복귀 퍼널","data:image/svg+xml"])assert.ok(html.includes(value),value);});
`, "utf8");
  const files = [
    write(ADMIN_OUTPUT, names.deploy, deploy),
    write(ADMIN_OUTPUT, names.rollback, rollback),
    write(ADMIN_OUTPUT, names.test, contractTest, true)
  ];
  const manifest = {
    schema: "golfjoin-stage53b-ga4-completion-validation-admin-v1",
    generatedAt: new Date().toISOString(),
    projectId: "dashboad-golfjoin-secrettour",
    requires: "stage53a-ga4-completion-validation-api",
    supersedes: "stage52a-ga4-admin-mobile-layout",
    features: [
      "completion-validation-card",
      "two-flow-three-signal-status",
      "status-specific-guidance",
      "responsive-validation-layout",
      "existing-dashboard-regression-safe"
    ],
    names,
    files
  };
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "RUNBOOK.md"), `# Stage 53b - GA4 완료 이벤트 검증 관리자 UI

Stage 53a Cloud Function의 completionValidation 응답을 확인한 뒤 배포합니다.

## 1. 업로드·검증

아래 3개 파일을 /home/llno95ll/golfjoin-admin-hosting에 업로드합니다.

- ${names.deploy}
- ${names.rollback}
- ${names.test}

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
sha256sum ${names.deploy} ${names.rollback} ${names.test}
node --test ${names.test}
\`\`\`

정상 결과는 tests 6, pass 6, fail 0입니다.

## 2. 교체·배포

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f public/index.html BACKUP_pre_stage53b_admin_dashboard.html
cp -f ${names.deploy} public/index.html
sha256sum public/index.html BACKUP_pre_stage53b_admin_dashboard.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`

정상 배포 SHA-256: ${deployHash}

## 3. 운영 확인

1. 관리자 로그인 후 이용자 분석 메뉴에서 완료 이벤트 수집 상태 카드가 보이는지 확인합니다.
2. 참여 신청과 새 모임 생성에 제출 시작·단계 완료·완료 이벤트 3개 항목이 표시되는지 확인합니다.
3. 실제 발생 전에는 수집 대기 또는 수집 중, 세 신호가 모두 있으면 검증 완료로 표시되는지 확인합니다.
4. 확인 필요가 표시되면 해당 흐름의 Network collect와 완료 처리 코드를 재검증합니다.
5. 모바일에서 두 흐름이 한 열로 표시되고 이벤트명이 잘리지 않는지 확인합니다.
6. 기존 기간·비교·기기·회원·유입 필터와 단계 상세가 정상인지 확인합니다.

## 4. 복구

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f ${names.rollback} public/index.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`
`);
  return { output: ADMIN_OUTPUT, manifest };
}

console.log(JSON.stringify({ server: prepareServer(), admin: prepareAdmin() }, null, 2));
