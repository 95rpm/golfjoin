"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage63-consultation-cutover/admin-consultation-cutover-new-badge-modal-drag-new-schedule-three-day-20260909-v63d");
const DEPLOY_SOURCE = path.join(ROOT, "golfjoin_admin_dashboard.html");
const ROLLBACK_SOURCE = path.join(ROOT, "deploy/stage54-ga4-dashboard/ga4-analysis-readiness-admin-20260901-v54b/DEPLOY_golfjoin_admin_dashboard_161061C3.html");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function write(name, value) {
  fs.writeFileSync(path.join(OUTPUT, name), value);
  return { name, bytes: value.length, sha256: sha256(value) };
}

if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
fs.mkdirSync(OUTPUT, { recursive: true });

const deploy = fs.readFileSync(DEPLOY_SOURCE);
const rollback = fs.readFileSync(ROLLBACK_SOURCE);
const deployHash = sha256(deploy);
const rollbackHash = sha256(rollback);
const deployName = `DEPLOY_golfjoin_admin_dashboard_${deployHash.slice(0, 8).toUpperCase()}.html`;
const rollbackName = `ROLLBACK_golfjoin_admin_dashboard_${rollbackHash.slice(0, 8).toUpperCase()}.html`;
const testName = "stage63d-consultation-cutover-new-badge-modal-drag-three-day.test.js";

const contractTest = Buffer.from(`"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");
const file=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex");
const deploy=file(${JSON.stringify(deployName)}),rollback=file(${JSON.stringify(rollbackName)}),html=deploy.toString("utf8");
function fn(name){const token="function "+name+"(",start=html.indexOf(token);assert.notEqual(start,-1,name);const body=html.indexOf(") {",start)+2;let depth=0,quote="",escaped=false;for(let i=body;i<html.length;i+=1){const c=html[i];if(escaped){escaped=false;continue}if(quote){if(c==="\\\\")escaped=true;else if(c===quote)quote="";continue}if(c==='"'||c==="'"||c==="\u0060"){quote=c;continue}if(c==="{")depth+=1;if(c==="}"&&--depth===0)return html.slice(start,i+1)}throw new Error(name+" incomplete")}
test("v63d 배포·복구 HTML 해시가 일치한다",()=>{assert.equal(hash(deploy),${JSON.stringify(deployHash)});assert.equal(hash(rollback),${JSON.stringify(rollbackHash)})});
test("v63d 관리자 인라인 JavaScript 문법이 유효하다",()=>{const a=html.indexOf("<script>"),b=html.lastIndexOf("</script>");assert.ok(a>=0&&b>a);assert.doesNotThrow(()=>new Function(html.slice(a+8,b)))});
test("v63d 상담대기는 2026-09-07 21:11 KST부터 표시한다",()=>{assert.ok(html.includes('const CONSULTATION_QUEUE_VISIBLE_FROM = "2026-09-07T21:11:00+09:00";'));assert.ok(fn("getConsultationApplicants").includes("if (!isConsultationApplicantVisible(item.createdAt)) return false;"))});
test("v63d 기준 신청과 이후 신청만 포함한다",()=>{const sandbox={Date};vm.runInNewContext('const CONSULTATION_QUEUE_VISIBLE_FROM="2026-09-07T21:11:00+09:00";function parseDateTime(){return null;}'+fn("getTimeValue")+';'+fn("isConsultationApplicantVisible")+';globalThis.visible=isConsultationApplicantVisible;',sandbox);assert.equal(sandbox.visible("2026-09-07T21:10:59+09:00"),false);assert.equal(sandbox.visible("2026-09-07T21:11:00+09:00"),true);assert.equal(sandbox.visible("2026-09-08T00:00:00+09:00"),true);assert.equal(sandbox.visible(""),false)});
test("v63d 상담대기 숫자와 목록은 같은 필터를 쓰고 개인정보를 하드코딩하지 않는다",()=>{assert.ok(html.includes("const consultationApplicants = getConsultationApplicants({ useKeyword: false });"));assert.ok(html.includes("const consultationCount = consultationApplicants.length;"));assert.ok(html.includes("function renderConsultationApplicantsTable() {\\n      const rows = getConsultationApplicants();"));assert.doesNotMatch(html,/최유선|010[- ]?9654[- ]?0966/)});
test("v63d 미생성 견적이 있을 때만 숫자 옆에 NEW를 표시한다",()=>{for(const value of ["hasUnquotedConsultation","hasGeneratedConsultationQuote","schedule-work-new-badge","NEW"])assert.ok(html.includes(value),value);assert.ok(html.includes('!hasGeneratedConsultationQuote(item.row)'));assert.ok(html.includes('row.quotePageUrl || row.quoteUrl'));const css=html.slice(html.indexOf(".schedule-work-new-badge {"),html.indexOf("}",html.indexOf(".schedule-work-new-badge {"))+1);for(const value of ["background: var(--red);","font-size: 11px;","border-radius: 999px;"])assert.ok(css.includes(value),value)});
test("v63d 신규 숫자와 목록은 한국시간 기준 최근 3일을 동일하게 사용한다",()=>{for(const value of ['const NEW_SCHEDULE_RECENT_DAYS = 3;','const newRecent = state.schedules.filter((schedule) => !schedule.isRecommendationSchedule && isRecentlyCreatedSchedule(schedule)).length;','!state.scheduleCreatedRecentOnly || (!schedule.isRecommendationSchedule && isRecentlyCreatedSchedule(schedule))','data-metric-action="new-recent"'])assert.ok(html.includes(value),value);const sandbox={Date,Intl};vm.runInNewContext('const NEW_SCHEDULE_RECENT_DAYS=3;const KST_CALENDAR_DAY_FORMATTER=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"});const asText=v=>String(v==null?"":v).trim(),firstText=(...v)=>v.map(asText).find(Boolean)||"";'+fn("parseDateTime")+';'+fn("getKstCalendarDayValue")+';'+fn("getScheduleCreatedDate")+';'+fn("isRecentlyCreatedSchedule")+';globalThis.matches=isRecentlyCreatedSchedule;',sandbox);const now=new Date("2026-09-09T23:59:59+09:00"),schedule=v=>({row:{createdAt:v}});assert.equal(sandbox.matches(schedule("2026-09-07T00:00:00+09:00"),3,now),true);assert.equal(sandbox.matches(schedule("2026-09-06T23:59:59+09:00"),3,now),false);assert.equal(sandbox.matches(schedule("2026-09-10T00:00:00+09:00"),3,now),false)});
test("v63d 모달 본문에서 배경으로 끝난 드래그는 닫지 않고 정상 배경 클릭만 닫는다",()=>{const sandbox={};vm.runInNewContext(fn("bindModalBackdropDismiss")+";globalThis.bind=bindModalBackdropDismiss;",sandbox);const listeners=new Map(),backdrop={addEventListener(t,f){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(f)},removeEventListener(t,f){listeners.get(t)?.delete(f)}};const fire=(t,target)=>[...(listeners.get(t)||[])].forEach(f=>f({target,pointerId:1,isPrimary:true}));let closes=0;sandbox.bind(backdrop,()=>closes++);fire("pointerdown",{});fire("pointerup",backdrop);fire("click",backdrop);assert.equal(closes,0);fire("pointerdown",backdrop);fire("pointerup",backdrop);fire("click",backdrop);assert.equal(closes,1)});
test("v63d 배경 닫기를 제공하는 모든 모달은 공통 드래그 안전 처리기를 사용한다",()=>{for(const value of ['bindModalBackdropDismiss($("#drawerBackdrop"), closeDrawer);','bindModalBackdropDismiss($("#familyReviewBackdrop"), closeFamilyReviewModal);','bindModalBackdropDismiss($("#familyGroupAssignBackdrop"), closeFamilyGroupAssignModal);','bindModalBackdropDismiss(document.getElementById("quoteEditorBackdrop"), closeQuoteEditor);','bindModalBackdropDismiss(document.getElementById("participantListBackdrop"), closeParticipantListModal);'])assert.ok(html.includes(value),value);assert.ok(fn("openConfirmDialog").includes("bindModalBackdropDismiss(backdrop, () => cleanup(false))"));for(const oldValue of ['$("#drawerBackdrop").addEventListener("click"','$("#familyReviewBackdrop")?.addEventListener("click"','$("#familyGroupAssignBackdrop")?.addEventListener("click"','document.getElementById("quoteEditorBackdrop")?.addEventListener("click"','document.getElementById("participantListBackdrop")?.addEventListener("click"'])assert.equal(html.includes(oldValue),false,oldValue)});
`, "utf8");

new vm.Script(contractTest.toString("utf8"), { filename: testName });

const files = [
  write(deployName, deploy),
  write(rollbackName, rollback),
  write(testName, contractTest)
];

const manifest = {
  schema: "golfjoin-stage63d-admin-consultation-cutover-new-badge-modal-drag-three-day-v1",
  generatedAt: new Date().toISOString(),
  projectId: "dashboad-golfjoin-secrettour",
  visibleFrom: "2026-09-07T21:11:00+09:00",
  behavior: "display-only consultation cutover; NEW marks an ungenerated quote; new schedules use a KST 3-day window; modal text drag cannot dismiss the modal",
  files
};
fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), `# Stage 63d - 상담대기 운영 전환·NEW 뱃지·신규 최근 3일·모달 드래그 안전화

상담대기 카드 숫자와 목록에서 2026-09-07 21:11(KST) 이전 누적 신청을 숨깁니다. 원본 구글시트 행은 삭제하지 않으며, 기준 신청과 이후 신규 신청만 표시합니다. 표시 목록에 견적서가 아직 생성되지 않은 신청이 하나라도 있으면 상담대기 숫자 옆에 NEW 뱃지를 표시합니다. 신규 카드 숫자와 목록은 한국시간 기준 오늘·어제·그제에 생성된 일정만 표시하며 관리자 추천일정은 제외합니다. 모달 내부 텍스트 선택을 배경까지 드래그해 놓아도 모달이 닫히지 않으며, 배경에서 누르고 놓은 정상 클릭은 기존처럼 닫힙니다.

## 1. 업로드·검증

아래 3개 파일을 \`/home/llno95ll/golfjoin-admin-hosting\`에 업로드합니다.

- \`${deployName}\`
- \`${rollbackName}\`
- \`${testName}\`

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
sha256sum ${deployName} ${rollbackName} ${testName}
node --test ${testName}
\`\`\`

정상 결과는 tests 9, pass 9, fail 0입니다.

## 2. 교체·배포

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f public/index.html BACKUP_pre_stage63d_admin_dashboard.html
cp -f ${deployName} public/index.html
sha256sum public/index.html BACKUP_pre_stage63d_admin_dashboard.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`

정상 배포 SHA-256: \`${deployHash}\`

## 3. 운영 확인

1. 일정관리의 상담대기 카드 숫자와 목록 행 수가 같은지 확인합니다.
2. 기존 8월·10월 월례회 누적 고객은 보이지 않는지 확인합니다.
3. 26.09.07(월) 21:11 생성자 신청은 보이는지 확인합니다.
4. 이후 신규 신청이 추가되면 자동으로 목록에 나타나는지 확인합니다.
5. 견적생성 전 신청이 있으면 상담대기 숫자 옆에 NEW가 표시되는지 확인합니다.
6. 모든 표시 신청의 견적을 생성하면 NEW가 사라지고 상담대기 숫자는 유지되는지 확인합니다.
7. 임의 모달 본문 텍스트를 선택해 배경까지 드래그한 뒤 놓아도 모달이 유지되는지 확인합니다.
8. 모달 배경을 직접 클릭하면 기존처럼 모달이 닫히는지 확인합니다.
9. 신규 카드 숫자와 목록이 한국시간 기준 오늘·어제·그제 생성 일정만 포함하고 더 오래된 일정과 관리자 추천일정을 제외하는지 확인합니다.

## 4. 복구

\`\`\`bash
cd /home/llno95ll/golfjoin-admin-hosting
cp -f ${rollbackName} public/index.html
firebase deploy --only hosting --project dashboad-golfjoin-secrettour
\`\`\`
`);

console.log(JSON.stringify({ output: OUTPUT, deployName, rollbackName, testName, files }, null, 2));
