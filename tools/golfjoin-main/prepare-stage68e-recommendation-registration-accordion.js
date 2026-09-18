"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const BASELINE = path.join(ROOT, "deploy/stage68-product-family-airpack/recommendation-layout-participant-first-load-20260915-v68d");
const OUTPUT = path.join(ROOT, "deploy/stage68-product-family-airpack/recommendation-calendar-performance-20260915-v68f");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function readVerified(fileName, expectedHash, label) {
  const value = fs.readFileSync(path.join(BASELINE, fileName));
  if (sha256(value) !== expectedHash) throw new Error(`${label}_hash_mismatch`);
  return value;
}

function verifyInlineScripts(html) {
  [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim())
    .forEach((source, index) => new vm.Script(source, { filename: `stage68f-inline-${index + 1}.js` }));
}

function makeCloudTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),deploy=read(${JSON.stringify(names.deploy)}),rollback=read(${JSON.stringify(names.rollback)}),firebase=read(${JSON.stringify(names.firebase)}),source=deploy.toString("utf8");\n`
    + `test("v68f 대시보드 배포·복구·캐시 파일 해시가 일치한다",()=>assert.deepEqual({deploy:hash(deploy),rollback:hash(rollback),firebase:hash(firebase)},${JSON.stringify({ deploy: hashes.deploy, rollback: hashes.rollback, firebase: hashes.firebase })}));\n`
    + `test("v68f 인라인 JavaScript 문법이 유효하다",()=>{const scripts=[...source.matchAll(/<script\\b(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(x=>x[1]).filter(Boolean);assert.equal(scripts.length,1);scripts.forEach(x=>assert.doesNotThrow(()=>new vm.Script(x)))});\n`
    + `test("v68f 등록상태는 클릭 때 저장한 동일 상품군 키로 펼친다",()=>{assert.ok(source.includes("state.expandedRecommendationGoodSeq === asText(group.key)"));assert.ok(source.includes("row?.dataset.recommendationProduct"));assert.ok(source.includes("registeredRules.map(renderRecommendationRegisteredItem)"));assert.ok(!source.includes("state.expandedRecommendationGoodSeq === asText(group.goodSeq)"))});\n`
    + `test("v68f 기간 2열·고정 헤더·지연 달력을 유지한다",()=>{for(const value of ["recommendation-period-list","grid-template-columns: repeat(2, minmax(0, 1fr))","z-index: 6","isolation: isolate","recommendation-calendar-months"])assert.ok(source.includes(value),value)});\n`
    + `test("v68f 기간은 상품보기와 같은 박스형 스타일이다",()=>{const block=source.match(/\\.recommendation-period-item\\s*\\{([\\s\\S]*?)\\}/)?.[1]||"";for(const value of ["display: inline-flex","height: 28px","border: 1px solid var(--line)","border-radius: 8px","background: var(--panel)","padding: 0 8px"])assert.ok(block.includes(value),value)});\n`
    + `test("v68f 달력은 화면의 상품군·상품 인덱스를 다시 계산하지 않는다",()=>{for(const value of ["recommendationCalendarRuntime","recommendationCalendarGroupIndexCache","indexRecommendationCalendarRuntime(allProductGroups)","recommendationCalendarRuntime.groupsByKey.get(asText(groupId))"])assert.ok(source.includes(value),value)});\n`
    + `test("v68f 달력은 월·날짜별 인덱스와 선택 상품을 렌더당 한 번 사용한다",()=>{for(const value of ["itemsByMonth","itemsByDate","const todayISO = getRecommendationTodayISO()","const dayOfWeek = (firstDay + day - 1) % 7"])assert.ok(source.includes(value),value)});\n`
    + `test("v68f 통합 추천일정·이메일·취소 관리 기능을 유지한다",()=>{for(const value of ["productFamilyId","familyOptionsJson","admin_email_settings_get","admin_participant_cancel"])assert.ok(source.includes(value),value)});\n`,
    "utf8"
  );
}

function makeRunbook(names, hashes) {
  return `# Stage 68f - 추천일정 달력 성능·등록상태·기간 박스 UI\n\n`
    + `추천일정 달력이 열기와 월 이동 때 전체 상품군을 다시 계산하던 병목을 제거합니다. 등록상태 펼침 키 오류를 수정하고 기간을 상품보기 버튼과 같은 박스형 UI로 표시합니다. 저장 데이터와 서버는 변경하지 않습니다.\n\n`
    + `## 업로드·검증·배포\n\n/home/llno95ll/golfjoin-admin-hosting 에 다음 파일을 업로드합니다.\n\n- ${names.deploy}\n- ${names.rollback}\n- ${names.test}\n- ${names.firebase}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/golfjoin-admin-hosting\nsha256sum ${names.deploy} ${names.rollback} ${names.test} ${names.firebase}\nnode --test ${names.test}\ncp -f public/index.html BACKUP_pre_stage68f_admin_dashboard.html\ncp -f ${names.deploy} public/index.html\ncp -f ${names.firebase} firebase.json\nsha256sum public/index.html firebase.json\nfirebase deploy --only hosting --project dashboad-golfjoin-secrettour\n\`\`\`\n\n`
    + `정상 결과는 tests 8, pass 8, fail 0입니다. 배포 후 추천일정 기간이 최대 2열·2행 박스로 표시되고, 달력이 즉시 열리며 다음 달 이동도 지연 없이 반응해야 합니다. 1개 등록 또는 2개 등록 배지를 누르면 해당 행 바로 아래에 등록 일정이 표시되어야 합니다.\n\n`
    + `## 복구\n\n${names.rollback}을 public/index.html로 교체해 다시 Firebase Hosting에 배포합니다.\n\n`
    + `- 배포 SHA-256: ${hashes.deploy}\n- 복구 SHA-256: ${hashes.rollback}\n`;
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const baselineManifest = JSON.parse(fs.readFileSync(path.join(BASELINE, "manifest.json"), "utf8"));
  const rollback = readVerified(baselineManifest.names.adminDeploy, baselineManifest.hashes.adminDeploy, "dashboard_baseline");
  const firebase = readVerified(baselineManifest.names.firebase, baselineManifest.hashes.firebase, "firebase_baseline");
  const deploy = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"));
  verifyInlineScripts(deploy.toString("utf8"));

  const hashes = {
    deploy: sha256(deploy),
    rollback: sha256(rollback),
    firebase: sha256(firebase)
  };
  const names = {
    deploy: `DEPLOY_golfjoin_admin_dashboard_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_admin_dashboard_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    test: "stage68f-dashboard-recommendation-calendar.test.js",
    firebase: "stage68f-firebase.json"
  };
  const test = makeCloudTest(names, hashes);
  hashes.test = sha256(test);
  const manifest = {
    schema: "golfjoin-dashboard-recommendation-calendar-performance-v1",
    version: "v68f",
    status: "ready-for-deployment",
    scope: "dashboard-only",
    names,
    hashes,
    behavior: {
      registrationBadgeExpandsMatchingGroup: true,
      recommendationPeriodsUseProductViewBoxStyle: true,
      calendarReusesRenderedGroupIndex: true,
      calendarReusesMonthAndDateIndexes: true,
      existingDisplayRulesUnchanged: true,
      stage68dLayoutMaintained: true
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  new Map([
    [names.deploy, deploy],
    [names.rollback, rollback],
    [names.test, test],
    [names.firebase, firebase],
    ["RUNBOOK.md", Buffer.from(makeRunbook(names, hashes), "utf8")],
    ["manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")]
  ]).forEach((value, name) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, names, hashes }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  }
}
