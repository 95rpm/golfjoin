"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const SERVER_OUTPUT = path.join(ROOT, "deploy/stage49-ga4-dashboard/ga4-internal-funnel-api-20260901-v49a");
const ADMIN_OUTPUT = path.join(ROOT, "deploy/stage49-ga4-dashboard/ga4-internal-funnel-admin-20260901-v49b");
const SERVER_ROLLBACK = path.join(ROOT, "deploy/stage44-ga4-data-api/ga4-comparison-filters-20260901-v44c/stage44c-ga4-admin-analytics.js");
const ADMIN_ROLLBACK = path.join(ROOT, "deploy/stage46-ga4-admin-dashboard/golfjoin-ga4-comparison-filters-20260901-v46a/DEPLOY_golfjoin_admin_dashboard_1E83D49D.html");

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
    contractTest: "stage49a-ga4-internal-funnel-api.test.js"
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
test("v49a 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.deploy)});assert.equal(hash(rollback),${JSON.stringify(hashes.rollback)});});
test("v49a 서버 JavaScript 문법이 유효하다",()=>assert.doesNotThrow(()=>new Function("require","module","exports",source)));
test("v49a 참여 신청 단계 보고서를 포함한다",()=>{assert.match(source,/customEvent:apply_step/);assert.match(source,/golfjoin_apply_step_view/);assert.match(source,/name: "applySteps"/);});
test("v49a 새 모임 단계 보고서를 포함한다",()=>{assert.match(source,/customEvent:builder_step/);assert.match(source,/golfjoin_create_step_view/);assert.match(source,/name: "builderSteps"/);});
test("v49a 배치 요청은 최대 5개씩 분할하고 개인정보를 포함하지 않는다",()=>{assert.ok(source.includes("index += 5"));assert.doesNotMatch(source,/member_id|member_seq|mobileNumber|emailAddress|birthDate/i);});
`, "utf8");
  const files = [
    write(SERVER_OUTPUT, names.deploy, deploy, true),
    write(SERVER_OUTPUT, names.deployTest, deployTest, true),
    write(SERVER_OUTPUT, names.integrationTest, integrationTest, true),
    write(SERVER_OUTPUT, names.rollback, rollback, true),
    write(SERVER_OUTPUT, names.contractTest, contractTest, true)
  ];
  const manifest = {
    schema: "golfjoin-stage49a-ga4-internal-funnel-api-v1",
    generatedAt: new Date().toISOString(),
    propertyId: "552152254",
    features: ["apply-step-report", "builder-step-report", "step-drop-off", "previous-period-step-comparison", "five-report-batch-chunking"],
    names,
    files
  };
  fs.writeFileSync(path.join(SERVER_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(SERVER_OUTPUT, "README.md"), `# Stage 49a - GA4 내부 단계 퍼널 API

관리자 UI보다 Cloud Function을 먼저 배포합니다. 기존 \`golfjoin-ga4-admin-dashboard-v1\` 응답을 유지하면서 \`internalFunnels\`를 추가합니다.

## 1. 업로드·검증

아래 5개 파일을 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다.

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

정상 결과는 계약 테스트 \`5/5\`, 서버 테스트 \`15/15\`, 실패 \`0\`입니다.

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

관리자 로그인 상태의 브라우저 콘솔에서 실행합니다.

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
    apply: data.internalFunnels?.apply,
    builder: data.internalFunnels?.builder,
    comparisonApply: data.comparison?.internalFunnels?.apply,
    warnings: data.warnings
  });
})();
\`\`\`

HTTP 200과 \`internalFunnels.apply.steps\`, \`internalFunnels.builder.steps\` 배열을 확인합니다. 등록 직후 기간에는 값이 0이어도 정상이며, 보고서 실패 시 \`warnings\`에 해당 영역만 표시됩니다.

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
    test: "stage49b-ga4-internal-funnel-admin.test.js"
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
test("v49b 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v49b 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new Function(html.slice(a+8,b)));});
test("v49b 두 퍼널에 단계 상세 버튼이 있다",()=>{assert.ok(html.includes('renderAnalyticsFunnel("참여 신청 퍼널"'));assert.ok(html.includes('], "", "apply")'));assert.ok(html.includes('renderAnalyticsFunnel("새 모임 생성 퍼널"'));assert.ok(html.includes('], "three", "builder")'));assert.match(html,/data-action="analytics-funnel-detail"/);});
test("v49b 단계별 진입·이탈·이전 기간 비교를 표시한다",()=>{assert.match(html,/function renderAnalyticsInternalFunnelDrawer/);assert.match(html,/다음 단계 이탈/);assert.match(html,/이전 기간/);assert.ok(html.includes("buildAnalyticsDelta(step.activeUsers, previousStep.activeUsers)"));});
test("v49b 분석 상세는 넓은 서랍과 빈 데이터 안내를 제공한다",()=>{assert.match(html,/drawer\.analytics-wide/);assert.match(html,/analyticsWide: true/);assert.match(html,/선택한 기간에 수집된 작성 단계 데이터가 없습니다/);});
`, "utf8");
  const files = [
    write(ADMIN_OUTPUT, names.deploy, deploy),
    write(ADMIN_OUTPUT, names.rollback, rollback),
    write(ADMIN_OUTPUT, names.test, testSource, true)
  ];
  const manifest = {
    schema: "golfjoin-stage49b-ga4-internal-funnel-admin-v1",
    generatedAt: new Date().toISOString(),
    projectId: "dashboad-golfjoin-secrettour",
    requires: "stage49a-ga4-internal-funnel-api",
    features: ["apply-step-drawer", "builder-step-drawer", "drop-off-table", "previous-period-step-delta", "internal-drop-off-opportunity"],
    names,
    files
  };
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "RUNBOOK.md"), `# Stage 49b - GA4 내부 단계 퍼널 관리자 UI

Stage 49a Cloud Function의 운영 응답을 확인한 뒤 진행합니다.

## 1. 업로드·검증

아래 3개 파일을 \`/home/llno95ll/golfjoin-admin-hosting\`에 업로드합니다.

- \`${names.deploy}\`
- \`${names.rollback}\`
- \`${names.test}\`

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
sha256sum ${names.deploy} ${names.rollback} ${names.test}
node --test ${names.test}
\`\`\`

정상 결과는 \`tests 5\`, \`pass 5\`, \`fail 0\`입니다.

## 2. 교체·배포

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f public/index.html BACKUP_pre_stage49b_admin_dashboard.html
cp -f ${names.deploy} public/index.html
sha256sum public/index.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`

정상 배포 SHA-256: \`${deployHash}\`

## 3. 운영 확인

1. 관리자 로그인 후 \`이용자 분석\` 메뉴로 이동합니다.
2. \`참여 신청 퍼널\`의 \`단계 상세\`를 눌러 신청서 진입·확인·제출·완료가 보이는지 확인합니다.
3. \`새 모임 생성 퍼널\`의 \`단계 상세\`를 눌러 날짜·여행지·참여자·확인·제출·완료가 보이는지 확인합니다.
4. \`이전 기간 비교\`를 켠 상태에서는 이전 기간과 증감 열이 보이고, 끄면 해당 값이 \`-\`로 표시되는지 확인합니다.
5. 콘솔에 새 오류가 없는지 확인합니다.

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
