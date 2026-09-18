"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage49-ga4-dashboard/ga4-internal-funnel-admin-typography-20260901-v49c");
const SOURCE = path.join(ROOT, "golfjoin_admin_dashboard.html");
const ROLLBACK = path.join(ROOT, "deploy/stage49-ga4-dashboard/ga4-internal-funnel-admin-20260901-v49b/ROLLBACK_golfjoin_admin_dashboard_1E83D49D.html");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`required_file_missing:${filePath}`);
  return fs.readFileSync(filePath);
}

if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
fs.mkdirSync(OUTPUT, { recursive: true });

const deploy = readRequired(SOURCE);
const rollback = readRequired(ROLLBACK);
const deployHash = sha256(deploy);
const rollbackHash = sha256(rollback);
const names = {
  deploy: `DEPLOY_golfjoin_admin_dashboard_${deployHash.slice(0, 8).toUpperCase()}.html`,
  rollback: `ROLLBACK_golfjoin_admin_dashboard_${rollbackHash.slice(0, 8).toUpperCase()}.html`,
  test: "stage49c-ga4-internal-funnel-typography.test.js"
};

const html = deploy.toString("utf8");
const scriptStart = html.indexOf("<script>");
const scriptEnd = html.lastIndexOf("</script>");
if (scriptStart < 0 || scriptEnd <= scriptStart) throw new Error("dashboard_inline_script_missing");
new vm.Script(html.slice(scriptStart + 8, scriptEnd), { filename: names.deploy });

const testSource = Buffer.from(`"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const file=(name)=>fs.readFileSync(path.join(__dirname,name));
const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
const deploy=file(${JSON.stringify(names.deploy)}),rollback=file(${JSON.stringify(names.rollback)}),html=deploy.toString("utf8");
test("v49c 배포·복구 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)});});
test("v49c 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new Function(html.slice(a+8,b)));});
test("v49c 두 퍼널의 단계 상세 기능을 유지한다",()=>{assert.match(html,/data-action="analytics-funnel-detail"/);assert.match(html,/function renderAnalyticsInternalFunnelDrawer/);assert.match(html,/다음 단계 이탈/);});
test("v49c 단계 상세에만 전용 상태 클래스를 적용하고 닫을 때 제거한다",()=>{assert.match(html,/analyticsInternalDetail: true/);assert.match(html,/classList\\.toggle\\("analytics-internal-detail", Boolean\\(options\\.analyticsInternalDetail\\)\\)/);assert.match(html,/classList\\.remove\\("analytics-internal-detail"\\)/);});
test("v49c 단계 상세 제목·부제·요약 수치 스타일이 요청값과 일치한다",()=>{assert.match(html,/\\.drawer\\.analytics-internal-detail \\.drawer-sub \\{[\\s\\S]*?font-size: 16px;[\\s\\S]*?font-weight: 600;/);assert.match(html,/\\.drawer\\.analytics-internal-detail \\.drawer-title \\{[\\s\\S]*?font-size: 22px;[\\s\\S]*?font-weight: 700;/);assert.match(html,/\\.drawer\\.analytics-internal-detail \\.analytics-drawer-metric span \\{[\\s\\S]*?font-size: 16px;[\\s\\S]*?font-weight: 700;/);assert.match(html,/\\.drawer\\.analytics-internal-detail \\.analytics-drawer-metric strong \\{[\\s\\S]*?font-size: 22px;[\\s\\S]*?font-weight: 600;/);});
test("v49c 단계 상세 비율 셀만 700으로 조정하고 공용 서랍은 유지한다",()=>{assert.match(html,/\\.drawer\\.analytics-internal-detail \\.analytics-rate-cell \\{[\\s\\S]*?color: #2679d8 !important;[\\s\\S]*?font-weight: 700 !important;/);assert.match(html,/^    \\.drawer-title \\{[\\s\\S]*?font-weight: 800;/m);assert.match(html,/^    \\.drawer-sub \\{[\\s\\S]*?font-size: 20px;/m);});
`, "utf8");

fs.writeFileSync(path.join(OUTPUT, names.deploy), deploy);
fs.writeFileSync(path.join(OUTPUT, names.rollback), rollback);
fs.writeFileSync(path.join(OUTPUT, names.test), testSource);

const files = [
  { fileName: names.deploy, sha256: deployHash, bytes: deploy.length },
  { fileName: names.rollback, sha256: rollbackHash, bytes: rollback.length },
  { fileName: names.test, sha256: sha256(testSource), bytes: testSource.length }
];

const manifest = {
  schema: "golfjoin-stage49c-ga4-internal-funnel-typography-v1",
  generatedAt: new Date().toISOString(),
  projectId: "dashboad-golfjoin-secrettour",
  requires: "stage49a-ga4-internal-funnel-api",
  supersedes: "stage49b-ga4-internal-funnel-admin",
  features: ["internal-detail-scoped-typography", "internal-detail-scoped-rate-weight", "shared-drawer-style-preservation"],
  names,
  files
};
fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), `# Stage 49c - GA4 단계 상세 전용 CSS

Stage 49b 관리자 후보에 단계 상세 전용 타이포그래피를 합친 대체 배포본입니다. 아직 Stage 49b를 배포하지 않았다면 이 패키지만 사용합니다.

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

정상 결과는 \`tests 6\`, \`pass 6\`, \`fail 0\`입니다.

## 2. 교체·배포

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f public/index.html BACKUP_pre_stage49c_admin_dashboard.html
cp -f ${names.deploy} public/index.html
sha256sum public/index.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`

정상 배포 SHA-256: \`${deployHash}\`

## 3. 운영 확인

1. 관리자 로그인 후 \`이용자 분석\` 메뉴로 이동합니다.
2. 참여 신청 퍼널과 새 모임 생성 퍼널의 \`단계 상세\`를 각각 엽니다.
3. 제목·기간·요약 수치·이전 단계 대비 비율의 글자 크기와 굵기를 확인합니다.
4. 다른 일반 상세 서랍에는 이번 스타일이 적용되지 않는지 확인합니다.
5. 콘솔에 새 오류가 없는지 확인합니다.

## 4. 복구

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f ${names.rollback} public/index.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`
`);

console.log(JSON.stringify({ output: OUTPUT, manifest }, null, 2));
