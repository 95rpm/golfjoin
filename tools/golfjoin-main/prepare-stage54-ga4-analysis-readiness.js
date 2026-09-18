"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const SERVER_OUTPUT = path.join(ROOT, "deploy/stage54-ga4-dashboard/ga4-analysis-readiness-api-20260901-v54a");
const ADMIN_OUTPUT = path.join(ROOT, "deploy/stage54-ga4-dashboard/ga4-analysis-readiness-admin-20260901-v54b");
const SERVER_ROLLBACK = path.join(ROOT, "deploy/stage53-ga4-dashboard/ga4-completion-validation-api-20260901-v53a/DEPLOY_ga4-admin-analytics_B8251475.js");
const ADMIN_ROLLBACK = path.join(ROOT, "deploy/stage53-ga4-dashboard/ga4-completion-validation-admin-20260901-v53b/DEPLOY_golfjoin_admin_dashboard_06D22048.html");

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
    contractTest: "stage54a-ga4-analysis-readiness-api.test.js"
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
test("v54a 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.deploy)});assert.equal(hash(rollback),${JSON.stringify(hashes.rollback)});});
test("v54a 서버 JavaScript 문법이 유효하다",()=>assert.doesNotThrow(()=>new Function("require","module","exports",source)));
test("v54a 분석 준비 상태는 7일·30명·100명 기준을 사용한다",()=>{for(const value of ["buildGa4AnalysisReadiness","minimumDays: 7","directionalDenominator: 30","stableDenominator: 100"])assert.ok(source.includes(value),value);});
test("v54a 네 전환율의 분자·분모와 표본 상태를 반환한다",()=>{for(const value of ["detail_rate","apply_start_rate","apply_complete_rate","create_complete_rate","numerator","denominator","sampleStatus"])assert.ok(source.includes(value),value);});
test("v54a 대기·수집·방향성·안정 표본을 구분한다",()=>{for(const value of ["waiting","collecting","directional","stable","activeDataDays","directionalMetrics","stableMetrics"])assert.ok(source.includes(value),value);});
test("v54a 기존 열 개 보고서와 v53 응답을 유지한다",()=>{for(const value of ["GA4_DASHBOARD_REPORT_NAMES",'schema: "golfjoin-ga4-admin-dashboard-v1"',"completionValidation","journeyFunnels"])assert.ok(source.includes(value),value);});
test("v54a 분석 준비 응답은 개인정보를 포함하지 않는다",()=>assert.doesNotMatch(source,/member_id|member_seq|mobileNumber|emailAddress|birthDate/i));
`, "utf8");
  const files = [
    write(SERVER_OUTPUT, names.deploy, deploy, true),
    write(SERVER_OUTPUT, names.deployTest, deployTest, true),
    write(SERVER_OUTPUT, names.integrationTest, integrationTest, true),
    write(SERVER_OUTPUT, names.rollback, rollback, true),
    write(SERVER_OUTPUT, names.contractTest, contractTest, true)
  ];
  const manifest = {
    schema: "golfjoin-stage54a-ga4-analysis-readiness-api-v1",
    generatedAt: new Date().toISOString(),
    propertyId: "552152254",
    requires: "stage53a-ga4-completion-validation-api",
    features: [
      "minimum-seven-day-period",
      "directional-thirty-denominator",
      "stable-one-hundred-denominator",
      "four-rate-numerator-denominator",
      "no-extra-ga4-report",
      "aggregate-data-only"
    ],
    names,
    files
  };
  fs.writeFileSync(path.join(SERVER_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(SERVER_OUTPUT, "README.md"), `# Stage 54a - GA4 분석 준비 상태 API

기존 10개 GA4 보고서를 재사용해 선택 기간과 네 전환율의 분자·분모를 분석 준비 상태로 계산합니다. 추가 Data API 호출은 없습니다.

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

정상 결과는 계약 테스트 7/7, 서버 테스트 19/19, 실패 0입니다.

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

관리자 로그인 상태에서 admin_ga4_dashboard 응답의 analysisReadiness를 확인합니다. HTTP 200, ok=true, metrics 4개와 7·30·100 기준을 확인합니다.

## 4. 복구

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function
cp -f ${names.rollback} ga4-admin-analytics.js
\`\`\`

복구 파일 적용 뒤 같은 Cloud Function 배포 명령을 실행합니다.
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
    test: "stage54b-ga4-analysis-readiness-admin.test.js"
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
test("v54b 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v54b 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new Function(html.slice(a+8,b)));});
test("v54b 초보자용 이용 흐름과 다음 행동을 표시한다",()=>{for(const value of ["이용자 흐름과 다음 행동","가장 먼저 확인할 구간","홈 화면 운영 힌트","마케팅 활용 힌트","다음에 확인할 것","renderAnalyticsReadiness","analysisReadiness"])assert.ok(html.includes(value),value);});
test("v54b 네 이용 흐름과 쉬운 데이터 상태를 표시한다",()=>{for(const value of ["메인 방문 → 상품 상세","상품 상세 → 신청 시작","신청 시작 → 신청 완료","새 모임 시작 → 생성 완료","아직 데이터 없음","데이터 더 필요","경향 참고 가능","비교 분석 가능"])assert.ok(html.includes(value),value);});
test("v54b 데스크톱 4열·태블릿 2열·모바일 1열을 제공한다",()=>{for(const value of ["grid-template-columns: repeat(4, minmax(0, 1fr));",".analytics-readiness-decision-grid,",".analytics-readiness-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }",".analytics-readiness-grid { grid-template-columns: 1fr; }"])assert.ok(html.includes(value),value);});
test("v54b 요청 타이포와 점검 설명 구조를 적용하고 중복 영역을 제거한다",()=>{for(const value of ["font-size: 15px;","font-size: 16px;","padding: 5px 9px;","analytics-readiness-action-detail","analytics-validation-flow-title { color: #3c444e; font-size: 18px; font-weight: 700;"])assert.ok(html.includes(value),value);for(const value of ["analytics-readiness-note","analytics-active-filters","analyticsActiveFilters"])assert.ok(!html.includes(value),value);});
test("v54b 이용자 분석 최초 진입은 공용 관리자 로딩을 사용한다",()=>{assert.ok(html.includes('<div class="empty loading-state"><span class="loading-spinner" aria-hidden="true"></span><span>GA4 이용자 분석 데이터를 불러오는 중입니다.</span></div>'));assert.ok(!html.includes('<div class="analytics-empty-state"><div><span class="loading-spinner" aria-hidden="true"></span><p>GA4 이용자 분석 데이터를 불러오는 중입니다.</p></div></div>'));});
test("v54b 네 카드의 구분선·점검 영역·박스 높이를 가장 긴 내용에 맞춘다",()=>{for(const value of ["grid-auto-rows: 1fr;","grid-template-rows: auto auto minmax(0, 1fr) auto;","height: 100%;","--analytics-readiness-fraction-min-height","--analytics-readiness-action-detail-min-height","scheduleAnalyticsReadinessMetricHeights","document.createRange()","fractions.map(measureTextHeight)","actionDetails.map(measureTextHeight)"])assert.ok(html.includes(value),value);assert.ok(!html.includes(".analytics-readiness-grid { grid-auto-rows: auto; }"));});
test("v54b v53 완료 검증·필터·퍼널·파비콘을 유지한다",()=>{for(const value of ["완료 이벤트 수집 상태","renderAnalyticsCompletionValidation","analyticsPeriodFilter","analyticsCompareFilter","여행지 검색 퍼널","로그인 복귀 퍼널","data:image/svg+xml"])assert.ok(html.includes(value),value);});
`, "utf8");
  const files = [
    write(ADMIN_OUTPUT, names.deploy, deploy),
    write(ADMIN_OUTPUT, names.rollback, rollback),
    write(ADMIN_OUTPUT, names.test, contractTest, true)
  ];
  const manifest = {
    schema: "golfjoin-stage54b-ga4-analysis-readiness-admin-v1",
    generatedAt: new Date().toISOString(),
    projectId: "dashboad-golfjoin-secrettour",
    requires: "stage54a-ga4-analysis-readiness-api",
    supersedes: "stage53b-ga4-completion-validation-admin",
    features: [
      "beginner-friendly-user-journey-card",
      "improvement-priority-guidance",
      "home-section-and-marketing-hints",
      "plain-language-data-status",
      "readability-typography-tuning",
      "duplicate-filter-and-note-removal",
      "shared-admin-initial-loading",
      "equalized-readiness-card-rows",
      "responsive-four-two-one-grid",
      "existing-dashboard-regression-safe"
    ],
    names,
    files
  };
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "RUNBOOK.md"), `# Stage 54b - GA4 이용 흐름·다음 행동 관리자 UI

Stage 54a Cloud Function의 analysisReadiness 응답을 확인한 뒤 배포합니다.

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

정상 결과는 tests 9, pass 9, fail 0입니다.

## 2. 교체·배포

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f public/index.html BACKUP_pre_stage54b_admin_dashboard.html
cp -f ${names.deploy} public/index.html
sha256sum public/index.html BACKUP_pre_stage54b_admin_dashboard.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`

정상 배포 SHA-256: ${deployHash}

## 3. 운영 확인

1. 이용자 분석 최초 진입에서 다른 관리자 메뉴와 같은 공용 스피너 로딩이 표시되는지 확인합니다.
2. 네 이용 흐름 카드의 구분선·다음에 확인할 것·상세 안내가 가장 긴 내용을 기준으로 같은 위치와 높이에 표시되는지 확인합니다.
3. 이용자 흐름과 다음 행동 카드에 확인 기간, 데이터 수집일, 참고 가능한 흐름 수가 표시되는지 확인합니다.
4. 가장 먼저 확인할 구간·홈 화면 운영 힌트·마케팅 활용 힌트가 쉬운 문장으로 표시되는지 확인합니다.
5. 네 이용 흐름에 이동 비율, 사용자 문장, 다음에 확인할 것이 표시되는지 확인합니다.
6. 7일→30일과 기기·회원·유입 필터 변경 시 카드가 함께 갱신되는지 확인합니다.
7. 모바일에서 기간 요약·판단 힌트·네 흐름이 한 열이며 가로 넘침이 없는지 확인합니다.
8. 중복 활성 필터 칩과 하단 중복 안내가 제거됐는지 확인합니다.
9. 완료 이벤트 수집 상태·퍼널·단계 상세와 콘솔이 정상인지 확인합니다.

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
