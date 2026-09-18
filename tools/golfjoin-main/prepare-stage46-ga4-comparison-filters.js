"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const SERVER_OUTPUT = path.join(ROOT, "deploy/stage44-ga4-data-api/ga4-comparison-filters-20260901-v44c");
const ADMIN_OUTPUT = path.join(ROOT, "deploy/stage46-ga4-admin-dashboard/golfjoin-ga4-comparison-filters-20260901-v46a");
const SERVER_ROLLBACK = path.join(ROOT, "deploy/stage44-ga4-data-api/ga4-dashboard-breakdowns-20260901-v44b");
const ADMIN_ROLLBACK = path.join(ROOT, "deploy/stage45-ga4-admin-dashboard/golfjoin-ga4-admin-dashboard-typography-20260901-v45b/DEPLOY_golfjoin_admin_dashboard_A9EAC6C7.html");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`required_file_missing:${filePath}`);
  return fs.readFileSync(filePath);
}

function writeFile(output, name, buffer, syntax = false) {
  if (syntax) new vm.Script(buffer.toString("utf8"), { filename: name });
  fs.writeFileSync(path.join(output, name), buffer);
  return { fileName: name, sha256: sha256(buffer), bytes: buffer.length };
}

function prepareServer() {
  if (fs.existsSync(SERVER_OUTPUT)) throw new Error(`output_exists:${SERVER_OUTPUT}`);
  fs.mkdirSync(SERVER_OUTPUT, { recursive: true });
  const inputs = [
    [path.join(SERVER_ROOT, "index.js"), "stage44c-index.js", true],
    [path.join(SERVER_ROOT, "ga4-admin-analytics.js"), "stage44c-ga4-admin-analytics.js", true],
    [path.join(SERVER_ROOT, "ga4-admin-analytics.test.js"), "stage44c-ga4-admin-analytics.test.js", true],
    [path.join(SERVER_ROOT, "ga4-admin-analytics-integration.test.js"), "stage44c-ga4-admin-analytics-integration.test.js", true],
    [path.join(SERVER_ROLLBACK, "stage44b-index.js"), "ROLLBACK_stage44b-index.js", true],
    [path.join(SERVER_ROLLBACK, "stage44b-ga4-admin-analytics.js"), "ROLLBACK_stage44b-ga4-admin-analytics.js", true]
  ];
  const files = inputs.map(([source, name, syntax]) => writeFile(SERVER_OUTPUT, name, readRequired(source), syntax));
  const manifest = {
    schema: "golfjoin-stage44c-ga4-comparison-filters-v1",
    generatedAt: new Date().toISOString(),
    propertyId: "552152254",
    features: ["previous-period-comparison", "custom-date-range", "device-filter", "member-state-filter", "source-medium-filter"],
    compatibility: "golfjoin-ga4-admin-dashboard-v1",
    files
  };
  fs.writeFileSync(path.join(SERVER_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(SERVER_OUTPUT, "README.md"), `# Stage 44c - GA4 비교기간·선택 필터 API

관리자 화면보다 서버를 먼저 배포합니다. 기존 응답 스키마 v1을 유지하므로 현재 운영 화면과 호환됩니다.

## 업로드·검증

다음 6개 파일을 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다.

${files.map((file) => `- \`${file.fileName}\``).join("\n")}

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function

sha256sum \\
  stage44c-index.js \\
  stage44c-ga4-admin-analytics.js \\
  stage44c-ga4-admin-analytics.test.js \\
  stage44c-ga4-admin-analytics-integration.test.js \\
  ROLLBACK_stage44b-index.js \\
  ROLLBACK_stage44b-ga4-admin-analytics.js

cp -f stage44c-index.js index.js
cp -f stage44c-ga4-admin-analytics.js ga4-admin-analytics.js
cp -f stage44c-ga4-admin-analytics.test.js ga4-admin-analytics.test.js
cp -f stage44c-ga4-admin-analytics-integration.test.js ga4-admin-analytics-integration.test.js

node --check index.js
node --check ga4-admin-analytics.js
node --test ga4-admin-analytics.test.js ga4-admin-analytics-integration.test.js
\`\`\`

정상 결과는 \`tests 14\`, \`pass 14\`, \`fail 0\`입니다.

## 배포

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

배포 후 관리자 로그인 브라우저 콘솔에서 \`admin_ga4_dashboard&days=7&compare=1&device=mobile\`을 호출해 HTTP 200, \`comparison.summary\`, \`filters.device=mobile\`을 확인합니다.

## 복구

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function
cp -f ROLLBACK_stage44b-index.js index.js
cp -f ROLLBACK_stage44b-ga4-admin-analytics.js ga4-admin-analytics.js
\`\`\`

두 파일을 되돌린 뒤 동일한 gcloud 배포 명령을 실행합니다.
`);
  return { output: SERVER_OUTPUT, manifest };
}

function prepareAdmin() {
  if (fs.existsSync(ADMIN_OUTPUT)) throw new Error(`output_exists:${ADMIN_OUTPUT}`);
  fs.mkdirSync(ADMIN_OUTPUT, { recursive: true });
  const deploy = readRequired(path.join(ROOT, "golfjoin_admin_dashboard.html"));
  const rollback = readRequired(ADMIN_ROLLBACK);
  const deployHash = sha256(deploy);
  const rollbackHash = sha256(rollback);
  const names = {
    deploy: `DEPLOY_golfjoin_admin_dashboard_${deployHash.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_admin_dashboard_${rollbackHash.slice(0, 8).toUpperCase()}.html`,
    test: "stage46a-ga4-admin-dashboard-filters.test.js"
  };
  const testSource = Buffer.from(`"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const deploy=fs.readFileSync(path.join(__dirname,${JSON.stringify(names.deploy)}));
const rollback=fs.readFileSync(path.join(__dirname,${JSON.stringify(names.rollback)}));
const html=deploy.toString("utf8");
const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
test("v46a 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v46a 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new Function(html.slice(a+8,b)));});
test("v46a 직접 기간과 이전 기간 비교를 제공한다",()=>{assert.match(html,/value="custom"/);assert.match(html,/id="analyticsStartDate"/);assert.match(html,/id="analyticsEndDate"/);assert.match(html,/id="analyticsCompareFilter"/);assert.match(html,/comparison\\?\\.summary/);});
test("v46a 기기·회원·유입경로 필터를 제공한다",()=>{["analyticsDeviceFilter","analyticsMemberFilter","analyticsSourceFilter"].forEach((id)=>assert.match(html,new RegExp('id="'+id+'"')));["device","memberState","sourceMedium"].forEach((name)=>assert.match(html,new RegExp('searchParams\\\\.set\\\\("'+name+'"')));});
test("v46a는 인라인 파비콘과 기존 이용자 분석 화면을 유지한다",()=>{assert.match(html,/data-menu="user-analytics"/);assert.match(html,/data:image\\/svg\\+xml/);assert.doesNotMatch(html,/href=["']\\/favicon\\.ico/);});
`, "utf8");
  const files = [
    writeFile(ADMIN_OUTPUT, names.deploy, deploy),
    writeFile(ADMIN_OUTPUT, names.rollback, rollback),
    writeFile(ADMIN_OUTPUT, names.test, testSource, true)
  ];
  const manifest = {
    schema: "golfjoin-ga4-admin-dashboard-v46a",
    generatedAt: new Date().toISOString(),
    projectId: "dashboad-golfjoin-secrettour",
    features: ["previous-period-kpi-delta", "custom-date-range", "device-filter", "member-state-filter", "source-medium-filter"],
    names,
    files
  };
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(ADMIN_OUTPUT, "RUNBOOK.md"), `# Stage 46a - GA4 비교기간·선택 필터 관리자 UI

Stage 44c 서버 배포와 운영 응답 확인 후 진행합니다.

## 업로드·검증

다음 3개 파일을 \`/home/llno95ll/golfjoin-admin-hosting\`에 업로드합니다.

- \`${names.deploy}\`
- \`${names.rollback}\`
- \`${names.test}\`

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
sha256sum ${names.deploy} ${names.rollback} ${names.test}
node --test ${names.test}
\`\`\`

## 교체·배포

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f public/index.html BACKUP_pre_stage46a_admin_dashboard.html
cp -f ${names.deploy} public/index.html
sha256sum public/index.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`

정상 배포 SHA-256: \`${deployHash}\`

## 복구

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f ${names.rollback} public/index.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`
`);
  return { output: ADMIN_OUTPUT, manifest };
}

console.log(JSON.stringify({ server: prepareServer(), admin: prepareAdmin() }, null, 2));
