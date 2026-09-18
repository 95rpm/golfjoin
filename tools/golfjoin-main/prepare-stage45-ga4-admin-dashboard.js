"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(
  ROOT,
  "deploy/stage45-ga4-admin-dashboard/golfjoin-ga4-admin-dashboard-20260901-v45a"
);
const DASHBOARD = path.join(ROOT, "golfjoin_admin_dashboard.html");
const ROLLBACK = path.join(
  ROOT,
  "deploy/stage37-member-identity/dashboard-birthdate-validation-20260828-v37n/DEPLOY_golfjoin_admin_dashboard_597D4850.html"
);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function record(fileName, buffer) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer) };
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const deploy = fs.readFileSync(DASHBOARD);
  const rollback = fs.readFileSync(ROLLBACK);
  const deployHash = sha256(deploy);
  const rollbackHash = sha256(rollback);
  const names = {
    deploy: `DEPLOY_golfjoin_admin_dashboard_${deployHash.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_admin_dashboard_${rollbackHash.slice(0, 8).toUpperCase()}.html`,
    test: "stage45a-ga4-admin-dashboard-ui.test.js"
  };

  const packageTest = Buffer.from(`"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = __dirname;
const DEPLOY_NAME = ${JSON.stringify(names.deploy)};
const ROLLBACK_NAME = ${JSON.stringify(names.rollback)};
const DEPLOY_SHA256 = ${JSON.stringify(deployHash)};
const ROLLBACK_SHA256 = ${JSON.stringify(rollbackHash)};

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const deployBuffer = fs.readFileSync(path.join(ROOT, DEPLOY_NAME));
const rollbackBuffer = fs.readFileSync(path.join(ROOT, ROLLBACK_NAME));
const dashboard = deployBuffer.toString("utf8");
const rollback = rollbackBuffer.toString("utf8");

test("v45a 배포·복구 HTML 해시가 일치한다", () => {
  assert.equal(sha256(deployBuffer), DEPLOY_SHA256);
  assert.equal(sha256(rollbackBuffer), ROLLBACK_SHA256);
});

test("v45a 관리자 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});

test("v45a 이용자 분석 메뉴와 GA4 상세 응답 화면 계약을 포함한다", () => {
  assert.match(dashboard, /data-menu="user-analytics"/);
  assert.match(dashboard, /admin_ga4_dashboard/);
  assert.match(dashboard, /golfjoin-ga4-admin-dashboard-v1/);
  assert.match(dashboard, /id="analyticsPeriodFilter"[\\s\\S]*?value="7"[\\s\\S]*?value="30"[\\s\\S]*?value="90"/);
  ["참여 신청 퍼널", "새 모임 생성 퍼널", "개선 기회", "섹션 성과", "기기별 상세 열람률", "회원상태별 상세 열람률", "일별 추이", "유입경로"]
    .forEach((label) => assert.match(dashboard, new RegExp(label)));
  assert.match(dashboard, /data-action="analytics-retry"/);
  assert.match(dashboard, /X-Golfjoin-Admin-Token/);
});

test("v45a는 favicon.ico 요청 없이 인라인 파비콘을 사용한다", () => {
  assert.match(dashboard, /<link rel="icon" href="data:image\\/svg\\+xml,/);
  assert.doesNotMatch(dashboard, /href=["']\\/favicon\\.ico/);
});

test("v45a 복구본은 직전 운영 관리자 화면이다", () => {
  assert.doesNotMatch(rollback, /data-menu="user-analytics"/);
  assert.match(rollback, /placeholder="예: 19630824"/);
});
`, "utf8");

  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, names.deploy), deploy);
  fs.writeFileSync(path.join(OUTPUT, names.rollback), rollback);
  fs.writeFileSync(path.join(OUTPUT, names.test), packageTest);

  const files = {
    deploy: record(names.deploy, deploy),
    rollback: record(names.rollback, rollback),
    test: record(names.test, packageTest)
  };
  const manifest = {
    schema: "golfjoin-ga4-admin-dashboard-v45a",
    status: "ready-for-deploy",
    preparedAt: new Date().toISOString(),
    projectId: "dashboad-golfjoin-secrettour",
    features: {
      userAnalyticsMenu: true,
      periods: [7, 30, 90],
      kpiCards: 4,
      applyFunnel: true,
      createFunnel: true,
      opportunityCards: true,
      sectionPerformance: true,
      deviceMemberAcquisitionComparisons: true,
      dailyTrend: true,
      loadingEmptyPartialErrorStates: true,
      inlineFavicon: true,
      serverRedeployRequired: false,
      mainPageRedeployRequired: false
    },
    names,
    files
  };
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const runbook = [
    "# v45a GA4 이용자 분석 관리자 대시보드",
    "",
    "관리자 Firebase Hosting HTML만 교체합니다. Sheet API와 골프조인 메인 HTML은 재배포하지 않습니다.",
    "",
    "## 1. Cloud Shell 업로드·검사",
    "",
    "다음 3개 파일을 `/home/llno95ll/golfjoin-admin-hosting`에 업로드합니다.",
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
    "기대 해시는 `manifest.json`과 일치하며 테스트는 5개 모두 통과해야 합니다.",
    "",
    "## 2. 현재 운영본 보관·교체",
    "",
    "```bash",
    "cd /home/llno95ll/golfjoin-admin-hosting",
    "cp -f public/index.html BACKUP_pre_stage45a_admin_dashboard.html",
    `cp -f ${names.deploy} public/index.html`,
    "sha256sum public/index.html",
    "```",
    "",
    `정상 기대 SHA-256: \`${deployHash}\``,
    "",
    "## 3. Firebase Hosting 배포",
    "",
    "```bash",
    "firebase deploy --only hosting --project dashboad-golfjoin-secrettour",
    "```",
    "",
    "## 4. 운영 확인",
    "",
    "1. `https://admin.secret-tour.com`에 로그인합니다.",
    "2. 왼쪽 `이용자 분석` 메뉴를 엽니다.",
    "3. KPI 4개, 참여 신청·새 모임 퍼널, 개선 기회, 섹션·기기·회원·유입·일별 추이를 확인합니다.",
    "4. 분석 기간을 7일 → 30일 → 90일로 바꾸고 화면이 다시 집계되는지 확인합니다.",
    "5. 개발자도구 Network에서 `action=admin_ga4_dashboard`가 200인지 확인합니다.",
    "6. 콘솔에 `GET https://admin.secret-tour.com/favicon.ico 404`가 더 이상 나타나지 않는지 확인합니다.",
    "7. 새로고침 후 일정관리·배너관리·고객관리도 정상인지 확인합니다.",
    "",
    "## 5. 복구",
    "",
    "```bash",
    "cd /home/llno95ll/golfjoin-admin-hosting",
    `cp -f ${names.rollback} public/index.html`,
    "firebase deploy --only hosting --project dashboad-golfjoin-secrettour",
    "```",
    ""
  ].join("\n");
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook);

  console.log(JSON.stringify({ output: OUTPUT, names, files }, null, 2));
}

main();
