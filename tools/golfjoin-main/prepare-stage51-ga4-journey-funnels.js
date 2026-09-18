"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const SERVER_OUTPUT = path.join(ROOT, "deploy/stage51-ga4-dashboard/ga4-journey-funnels-api-20260901-v51a");
const ADMIN_OUTPUT = path.join(ROOT, "deploy/stage51-ga4-dashboard/ga4-journey-funnels-admin-20260901-v51b");
const SERVER_ROLLBACK = path.join(
  ROOT,
  "deploy/stage49-ga4-dashboard/ga4-internal-funnel-api-20260901-v49a/DEPLOY_ga4-admin-analytics_3887E7B9.js"
);
const ADMIN_ROLLBACK = path.join(
  ROOT,
  "deploy/stage49-ga4-dashboard/ga4-internal-funnel-admin-typography-20260901-v49c/DEPLOY_golfjoin_admin_dashboard_20DB140D.html"
);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`required_file_missing:${filePath}`);
  return fs.readFileSync(filePath);
}

function write(output, name, value, validateJs = false) {
  if (validateJs) new vm.Script(value.toString("utf8"), { filename: name });
  fs.writeFileSync(path.join(output, name), value);
  return { fileName: name, sha256: sha256(value), bytes: value.length };
}

function ensureNewOutput(output) {
  if (fs.existsSync(output)) throw new Error(`output_exists:${output}`);
  fs.mkdirSync(output, { recursive: true });
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
    contractTest: "stage51a-ga4-journey-funnels-api.test.js"
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
test("v51a 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.deploy)});assert.equal(hash(rollback),${JSON.stringify(hashes.rollback)});});
test("v51a 서버 JavaScript 문법이 유효하다",()=>assert.doesNotThrow(()=>new Function("require","module","exports",source)));
test("v51a 검색 퍼널 5단계를 집계한다",()=>{for(const value of ["searchFunnel","golfjoin_destination_search_open","golfjoin_destination_search_submit","view_item_list","select_item","view_item","destination_search"])assert.ok(source.includes(value),value);});
test("v51a 로그인 복귀와 원래 행동 완료율을 집계한다",()=>{for(const value of ["loginFunnel","loginReturnActions","golfjoin_login_required","golfjoin_login_start","golfjoin_login_return_complete","customEvent:return_action"])assert.ok(source.includes(value),value);});
test("v51a 현재·이전 기간에 journeyFunnels를 반환한다",()=>{assert.ok(source.includes("journeyFunnels"));assert.ok(source.includes("comparison"));assert.ok(source.includes("completionRate"));});
test("v51a 열 개 보고서를 최대 5개씩 분할하고 개인정보를 포함하지 않는다",()=>{assert.ok(source.includes("index += 5"));assert.equal((source.match(/name: "/g)||[]).length>=10,true);assert.doesNotMatch(source,/member_id|member_seq|mobileNumber|emailAddress|birthDate/i);});
`, "utf8");
  const files = [
    write(SERVER_OUTPUT, names.deploy, deploy, true),
    write(SERVER_OUTPUT, names.deployTest, deployTest, true),
    write(SERVER_OUTPUT, names.integrationTest, integrationTest, true),
    write(SERVER_OUTPUT, names.rollback, rollback, true),
    write(SERVER_OUTPUT, names.contractTest, contractTest, true)
  ];
  const manifest = {
    schema: "golfjoin-stage51a-ga4-journey-funnels-api-v1",
    generatedAt: new Date().toISOString(),
    propertyId: "552152254",
    requires: "stage49a-ga4-internal-funnel-api",
    features: [
      "five-step-search-funnel",
      "four-step-login-return-funnel",
      "login-return-action-completion-rate",
      "previous-period-comparison",
      "ten-report-two-batch-contract",
      "aggregate-data-only"
    ],
    names,
    files
  };
  fs.writeFileSync(path.join(SERVER_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(SERVER_OUTPUT, "README.md"), `# Stage 51a - GA4 검색·로그인 복귀 퍼널 API

관리자 UI보다 Cloud Function을 먼저 배포합니다. 기존 응답을 유지하면서 journeyFunnels.search, journeyFunnels.loginReturn, loginReturnActions를 추가합니다.

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

정상 결과는 계약 테스트 6/6, 서버 테스트 17/17, 실패 0입니다. 열 개 상세 보고서는 GA4 제한에 맞춰 5개씩 두 번 호출합니다.

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

관리자 로그인 상태의 브라우저 콘솔에서 실행합니다. 콘솔 첫 줄의 Promise pending 또는 undefined는 즉시 실행 함수 반환값이므로 오류가 아닙니다. 펼쳐진 최종 객체를 확인합니다.

\`\`\`js
void (async () => {
  const auth = JSON.parse(sessionStorage.getItem("golfjoinAdminAuth") || localStorage.getItem("golfjoinAdminAuth") || "{}");
  const url = new URL("https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api");
  url.searchParams.set("action", "admin_ga4_dashboard");
  url.searchParams.set("days", "7");
  url.searchParams.set("compare", "1");
  const response = await fetch(url, { headers: { "X-Golfjoin-Admin-Token": auth.token || "" } });
  const data = await response.json();
  console.log({
    httpStatus: response.status,
    ok: data.ok,
    search: data.journeyFunnels?.search,
    loginReturn: data.journeyFunnels?.loginReturn,
    loginReturnActions: data.loginReturnActions,
    comparisonSearch: data.comparison?.journeyFunnels?.search,
    warnings: data.warnings
  });
})();
\`\`\`

HTTP 200과 검색 5단계·로그인 복귀 4단계 배열을 확인합니다. 데이터 처리 지연 때문에 사용자가 0이어도 구조가 있으면 정상입니다. warnings가 없거나 undefined여야 합니다.

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
    test: "stage51b-ga4-journey-funnels-admin.test.js"
  };
  const testSource = Buffer.from(`"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const file=(name)=>fs.readFileSync(path.join(__dirname,name));
const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
const deploy=file(${JSON.stringify(names.deploy)}),rollback=file(${JSON.stringify(names.rollback)}),html=deploy.toString("utf8");
test("v51b 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v51b 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new Function(html.slice(a+8,b)));});
test("v51b 검색 5단계와 로그인 복귀 4단계를 표시한다",()=>{for(const value of ["여행지 검색 퍼널","mapAnalyticsJourneySteps(searchFunnel)","로그인 복귀 퍼널","mapAnalyticsJourneySteps(loginReturnFunnel)",".analytics-funnel.five"])assert.ok(html.includes(value),value);});
test("v51b 원래 행동별 요구·복귀 완료율 표와 이전 기간을 제공한다",()=>{assert.ok(html.includes("renderAnalyticsLoginReturnActions"));assert.ok(html.includes("로그인 복귀 행동별 성과"));assert.ok(html.includes("복귀 완료율"));assert.ok(html.includes("이전 기간"));});
test("v51b 기존 필터·내부 단계 상세·인라인 파비콘을 유지한다",()=>{for(const value of ["analyticsDeviceFilter","analyticsMemberFilter","analyticsSourceFilter","analytics-funnel-detail","data:image/svg+xml"])assert.ok(html.includes(value),value);});
test("v51b 모바일 로그인 화면은 관리자 최소 폭에 밀리지 않는다",()=>{assert.ok(html.includes("body:has(.login-screen:not([hidden]))"));assert.ok(html.includes("min-width: 0;"));});
`, "utf8");
  const files = [
    write(ADMIN_OUTPUT, names.deploy, deploy),
    write(ADMIN_OUTPUT, names.rollback, rollback),
    write(ADMIN_OUTPUT, names.test, testSource, true)
  ];
  const manifest = {
    schema: "golfjoin-stage51b-ga4-journey-funnels-admin-v1",
    generatedAt: new Date().toISOString(),
    projectId: "dashboad-golfjoin-secrettour",
    requires: "stage51a-ga4-journey-funnels-api",
    supersedes: "stage49c-ga4-internal-funnel-typography",
    features: [
      "five-step-search-funnel-card",
      "four-step-login-return-funnel-card",
      "login-return-action-comparison-table",
      "journey-opportunity-rules",
      "mobile-login-layout-fix"
    ],
    names,
    files
  };
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "RUNBOOK.md"), `# Stage 51b - GA4 검색·로그인 복귀 퍼널 관리자 UI

Stage 51a Cloud Function의 운영 응답을 확인한 뒤 진행합니다.

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
cp -f public/index.html BACKUP_pre_stage51b_admin_dashboard.html
cp -f ${names.deploy} public/index.html
sha256sum public/index.html BACKUP_pre_stage51b_admin_dashboard.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`

정상 배포 SHA-256: ${deployHash}

## 3. 운영 확인

1. 관리자 로그인 후 이용자 분석 메뉴로 이동합니다.
2. 검색 퍼널에 검색 열기·실행·결과 목록·상품 선택·상세 열람 5단계가 보이는지 확인합니다.
3. 로그인 복귀 퍼널에 로그인 요구·시작·성공·원래 행동 복귀 4단계가 보이는지 확인합니다.
4. 로그인 복귀 행동별 성과에서 새 모임·참여 신청 등 원래 행동별 요구·완료·복귀 완료율이 보이는지 확인합니다.
5. 이전 기간 비교를 켰을 때 표의 이전 기간 값이 보이고, 끄면 -로 표시되는지 확인합니다.
6. 필터와 기간을 바꿔 새 카드가 함께 갱신되고 콘솔에 새 오류가 없는지 확인합니다.
7. 모바일 폭에서 로그인 화면이 화면 중앙에 보이는지 확인합니다.

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
