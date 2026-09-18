"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage45-ga4-admin-dashboard/golfjoin-ga4-admin-dashboard-typography-20260901-v45b");
const SOURCE = path.join(ROOT, "golfjoin_admin_dashboard.html");
const ROLLBACK = path.join(ROOT, "deploy/stage45-ga4-admin-dashboard/golfjoin-ga4-admin-dashboard-20260901-v45a/DEPLOY_golfjoin_admin_dashboard_8087D2FB.html");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function fileRecord(fileName, buffer) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer) };
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const deploy = fs.readFileSync(SOURCE);
  const rollback = fs.readFileSync(ROLLBACK);
  const deployHash = sha256(deploy);
  const rollbackHash = sha256(rollback);
  const names = {
    deploy: `DEPLOY_golfjoin_admin_dashboard_${deployHash.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_admin_dashboard_${rollbackHash.slice(0, 8).toUpperCase()}.html`,
    test: "stage45b-ga4-admin-dashboard-typography.test.js"
  };
  const testSource = Buffer.from(`"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const deployBuffer = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.deploy)}));
const rollbackBuffer = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.rollback)}));
const dashboard = deployBuffer.toString("utf8");
const rollback = rollbackBuffer.toString("utf8");
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

test("v45b 배포·복구 HTML 해시가 일치한다", () => {
  assert.equal(sha256(deployBuffer), ${JSON.stringify(deployHash)});
  assert.equal(sha256(rollbackBuffer), ${JSON.stringify(rollbackHash)});
});

test("v45b 관리자 인라인 JavaScript 문법이 유효하다", () => {
  const start = dashboard.indexOf("<script>");
  const end = dashboard.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new Function(dashboard.slice(start + 8, end)));
});

test("v45b 이용자 분석 타이포 규격을 포함한다", () => {
  [
    /\\.analytics-kpi \\.metric-label\\s*\\{[\\s\\S]*?font-size:\\s*17px;[\\s\\S]*?font-weight:\\s*700;/,
    /\\.analytics-kpi \\.metric-value\\s*\\{[\\s\\S]*?font-size:\\s*28px;[\\s\\S]*?font-weight:\\s*600;/,
    /\\.analytics-kpi-meta\\s*\\{[\\s\\S]*?font-size:\\s*16px;[\\s\\S]*?font-weight:\\s*600;/,
    /\\.analytics-card-title\\s*\\{[\\s\\S]*?font-size:\\s*20px;[\\s\\S]*?font-weight:\\s*700;/,
    /\\.analytics-funnel-label\\s*\\{[\\s\\S]*?font-size:\\s*16px;[\\s\\S]*?font-weight:\\s*700;/,
    /\\.analytics-funnel-value\\s*\\{[\\s\\S]*?font-size:\\s*22px;[\\s\\S]*?font-weight:\\s*600;/,
    /\\.analytics-table th,[\\s\\S]*?\\.analytics-table td\\s*\\{[\\s\\S]*?font-size:\\s*15px;[\\s\\S]*?font-weight:\\s*650;/,
    /\\.analytics-compare-value\\s*\\{[\\s\\S]*?font-size:\\s*15px;[\\s\\S]*?font-weight:\\s*800;/
  ].forEach((pattern) => assert.match(dashboard, pattern));
  assert.match(dashboard, /<span>분석기간<\\/span>/);
});

test("v45b 퍼널 하단 장식을 제거한다", () => {
  assert.doesNotMatch(dashboard, /\\.analytics-funnel-step::after/);
  assert.doesNotMatch(dashboard, /--funnel-width/);
});

test("v45b GA4 상태를 last-updated에 통합한다", () => {
  assert.doesNotMatch(dashboard, /class="analytics-status-bar"/);
  assert.doesNotMatch(dashboard, /\\.analytics-status-bar\\s*\\{/);
  assert.match(dashboard, /id="lastUpdated"/);
  assert.match(dashboard, /function setAnalyticsLastUpdated[\\s\\S]*?analytics-status-main[\\s\\S]*?analytics-status-side/);
  assert.match(dashboard, /analytics-status-inline/);
});

test("v45b 복구본은 직전 운영 v45a다", () => {
  assert.match(rollback, /data-menu="user-analytics"/);
  assert.match(rollback, /class="analytics-status-bar"/);
});
`, "utf8");

  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, names.deploy), deploy);
  fs.writeFileSync(path.join(OUTPUT, names.rollback), rollback);
  fs.writeFileSync(path.join(OUTPUT, names.test), testSource);

  const files = {
    deploy: fileRecord(names.deploy, deploy),
    rollback: fileRecord(names.rollback, rollback),
    test: fileRecord(names.test, testSource)
  };
  const manifest = {
    schema: "golfjoin-ga4-admin-dashboard-v45b",
    status: "ready-for-deploy",
    preparedAt: new Date().toISOString(),
    projectId: "dashboad-golfjoin-secrettour",
    features: {
      analyticsTypographyPolish: true,
      funnelBottomDecorationRemoved: true,
      analyticsPeriodLabelCompacted: true,
      analyticsStatusMovedToLastUpdated: true,
      serverRedeployRequired: false,
      mainPageRedeployRequired: false
    },
    names,
    files
  };
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const runbook = `# v45b 이용자 분석 타이포·상태 표시 보완

관리자 Firebase Hosting HTML만 교체합니다. Sheet API와 골프조인 메인 HTML은 재배포하지 않습니다.

## 업로드·검사

다음 3개 파일을 \`/home/llno95ll/golfjoin-admin-hosting\`에 업로드합니다.

- ${names.deploy}
- ${names.rollback}
- ${names.test}

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
sha256sum ${names.deploy} ${names.rollback} ${names.test}
node --test ${names.test}
\`\`\`

## 교체·배포

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f public/index.html BACKUP_pre_stage45b_admin_dashboard.html
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
`;
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook);
  console.log(JSON.stringify({ output: OUTPUT, names, files }, null, 2));
}

main();
