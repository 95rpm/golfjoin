"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage52-ga4-dashboard/ga4-admin-mobile-layout-20260901-v52a");
const DEPLOY = path.join(ROOT, "golfjoin_admin_dashboard.html");
const ROLLBACK = path.join(
  ROOT,
  "deploy/stage51-ga4-dashboard/ga4-journey-funnels-admin-20260901-v51b/DEPLOY_golfjoin_admin_dashboard_D2C600A6.html"
);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`required_file_missing:${filePath}`);
  return fs.readFileSync(filePath);
}

if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
fs.mkdirSync(OUTPUT, { recursive: true });

const deploy = readRequired(DEPLOY);
const rollback = readRequired(ROLLBACK);
const deployHash = sha256(deploy);
const rollbackHash = sha256(rollback);
const names = {
  deploy: `DEPLOY_golfjoin_admin_dashboard_${deployHash.slice(0, 8).toUpperCase()}.html`,
  rollback: `ROLLBACK_golfjoin_admin_dashboard_${rollbackHash.slice(0, 8).toUpperCase()}.html`,
  test: "stage52a-ga4-admin-mobile-layout.test.js"
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
test("v52a 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v52a 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new Function(html.slice(a+8,b)));});
test("v52a 최소 폭 해제는 이용자 분석 메뉴에만 적용된다",()=>{assert.ok(html.includes('classList.toggle("analytics-layout-active", isAnalyticsMenu)'));assert.ok(html.includes("body.analytics-layout-active { min-width: 0; }"));});
test("v52a 태블릿·모바일 분석 레이아웃을 단계적으로 축소한다",()=>{for(const value of ["@media (max-width: 860px)","grid-template-columns: 64px minmax(0, 1fr)","@media (max-width: 520px)","grid-template-columns: 52px minmax(0, 1fr)",".metrics.analytics-mode { grid-template-columns: 1fr"])assert.ok(html.includes(value),value);});
test("v52a 긴 복귀 행동명과 표 내부 터치 스크롤을 지원한다",()=>{for(const value of ["overscroll-behavior-inline: contain","-webkit-overflow-scrolling: touch",".analytics-login-return-table th:first-child","overflow-wrap: anywhere"])assert.ok(html.includes(value),value);});
test("v52a v51 검색·로그인 복귀 카드와 기존 필터를 유지한다",()=>{for(const value of ["여행지 검색 퍼널","로그인 복귀 퍼널","로그인 복귀 행동별 성과","analyticsPeriodFilter","analyticsCompareFilter","analyticsDeviceFilter","analyticsMemberFilter","analyticsSourceFilter","data:image/svg+xml"])assert.ok(html.includes(value),value);});
`, "utf8");

new vm.Script(testSource.toString("utf8"), { filename: names.test });
fs.writeFileSync(path.join(OUTPUT, names.deploy), deploy);
fs.writeFileSync(path.join(OUTPUT, names.rollback), rollback);
fs.writeFileSync(path.join(OUTPUT, names.test), testSource);

const files = [
  { fileName: names.deploy, sha256: deployHash, bytes: deploy.length },
  { fileName: names.rollback, sha256: rollbackHash, bytes: rollback.length },
  { fileName: names.test, sha256: sha256(testSource), bytes: testSource.length }
];
const manifest = {
  schema: "golfjoin-stage52a-ga4-admin-mobile-layout-v1",
  generatedAt: new Date().toISOString(),
  projectId: "dashboad-golfjoin-secrettour",
  requires: "stage51b-ga4-journey-funnels-admin",
  supersedes: "stage51b-ga4-journey-funnels-admin",
  features: [
    "analytics-only-mobile-min-width-release",
    "responsive-sidebar-and-content",
    "single-column-mobile-kpi-and-funnels",
    "responsive-filter-grid",
    "long-return-action-wrapping",
    "touch-horizontal-table-scroll"
  ],
  names,
  files
};
fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const runbook = [
  "# Stage 52a - GA4 관리자 이용자 분석 모바일 레이아웃",
  "",
  "v51b 운영 화면을 기준으로 다른 관리자 메뉴는 유지하고 이용자 분석이 활성화된 경우에만 모바일 최소 폭과 반응형 레이아웃을 적용합니다.",
  "",
  "## 1. 업로드·검증",
  "",
  "아래 3개 파일을 /home/llno95ll/golfjoin-admin-hosting에 업로드합니다.",
  "",
  `- ${names.deploy}`,
  `- ${names.rollback}`,
  `- ${names.test}`,
  "",
  "```bash",
  "cd /home/llno95ll/golfjoin-admin-hosting",
  `sha256sum ${names.deploy} ${names.rollback} ${names.test}`,
  `node --test ${names.test}`,
  "```",
  "",
  "정상 결과는 tests 6, pass 6, fail 0입니다.",
  "",
  "## 2. 교체·배포",
  "",
  "```bash",
  "cd /home/llno95ll/golfjoin-admin-hosting",
  "cp -f public/index.html BACKUP_pre_stage52a_admin_dashboard.html",
  `cp -f ${names.deploy} public/index.html`,
  "sha256sum public/index.html BACKUP_pre_stage52a_admin_dashboard.html",
  "firebase deploy --only hosting --project dashboad-golfjoin-secrettour",
  "```",
  "",
  `정상 배포 SHA-256: ${deployHash}`,
  "",
  "## 3. 운영 확인",
  "",
  "1. PC 이용자 분석 화면이 v51b와 동일한지 확인합니다.",
  "2. 모바일 폭에서 페이지 전체 가로 스크롤 없이 KPI가 한 열로 보이는지 확인합니다.",
  "3. 분석기간·비교·기기·회원상태·유입경로 필터가 한 열로 보이고 조작 가능한지 확인합니다.",
  "4. 여행지 검색 퍼널과 로그인 복귀 퍼널이 한 단계씩 세로로 보이는지 확인합니다.",
  "5. 로그인 복귀 행동별 성과의 긴 행동명은 줄바꿈되고, 숫자 열은 표 내부 가로 스크롤로 확인 가능한지 확인합니다.",
  "6. 단계 상세 서랍이 모바일 폭에서 열리고 닫히며 콘솔에 새 오류가 없는지 확인합니다.",
  "",
  "## 4. 복구",
  "",
  "```bash",
  "cd /home/llno95ll/golfjoin-admin-hosting",
  `cp -f ${names.rollback} public/index.html`,
  "firebase deploy --only hosting --project dashboad-golfjoin-secrettour",
  "```",
  ""
].join("\n");
fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook);

console.log(JSON.stringify({ output: OUTPUT, manifest }, null, 2));
