"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const acorn = require("acorn");

const { assembleFromSource, splitMainHtml } = require("./source-bundle");
const { collectInlineHandlerNames, minifyJavaScript } = require("./prepare-stage13-brotli-js");

const ROOT = path.resolve(__dirname, "../..");
const MAIN_BASE = path.join(ROOT, "deploy/stage68-product-family-airpack/monthly-participant-hydration-hotfix-20260915-v68g");
const DASHBOARD_BASE = path.join(ROOT, "deploy/stage68-product-family-airpack/recommendation-calendar-performance-20260915-v68f");
const OUTPUT = path.join(ROOT, "deploy/stage69-integrated-period-capacity/period-capacity-20260915-v69");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sri = (value) => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;

function readVerified(root, name, expected, label) {
  const value = fs.readFileSync(path.join(root, name));
  if (sha256(value) !== expected) throw new Error(`${label}_hash_mismatch`);
  return value;
}

function getNamedFunctionSource(source, name) {
  const program = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  const node = program.body.find((item) => item.type === "FunctionDeclaration" && item.id?.name === name);
  if (!node) throw new Error(`function_missing:${name}`);
  return source.slice(node.start, node.end);
}

function replaceNamedFunction(target, source, name) {
  const before = getNamedFunctionSource(target, name);
  const after = getNamedFunctionSource(source, name);
  const count = target.split(before).length - 1;
  if (count !== 1) throw new Error(`function_replace_count_invalid:${name}:${count}`);
  return target.replace(before, after);
}

function replaceAllRequired(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (!count) throw new Error(`${label}_missing`);
  return source.split(target).join(replacement);
}

function verifyInlineScripts(html, label) {
  [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim())
    .forEach((source, index) => new vm.Script(source, { filename: `${label}-${index + 1}.js` }));
}

function makeMainTest(names, hashes, revision) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(n),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.mainDeploy)}),rollback=read(${JSON.stringify(names.mainRollback)}),css=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v69 메인 배포 파일 해시와 문법이 유효하다",()=>{assert.deepEqual({html:hash(html),rollback:hash(rollback),css:hash(css),js:hash(jsBr)},${JSON.stringify({ html: hashes.mainDeploy, rollback: hashes.mainRollback, css: hashes.css, js: hashes.js })});assert.ok(html.toString("utf8").includes(${JSON.stringify(revision)}));assert.doesNotThrow(()=>zlib.gunzipSync(css));assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v69 통합 카드는 합산 정원, 상세는 기간별 정원을 사용한다",()=>{for(const value of ["familyOptionSummaries","familyParticipantSummary","remainingSlots","getAdminRecommendedDetailFamilyPeriodOptions"])assert.ok(js.includes(value),value)});\n`
    + `test("v69 신청은 선택한 기간 ERP 상품과 행사를 유지한다",()=>{for(const value of ["targetProductKey","productFamilyId","familyOptionsJson","join_schedule_option_invalid"])assert.ok(js.includes(value),value)});\n`,
    "utf8"
  );
}

function makeDashboardTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm");\n`
    + `const read=n=>fs.readFileSync(n),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.dashboardDeploy)}),rollback=read(${JSON.stringify(names.dashboardRollback)});\n`
    + `test("v69 대시보드 배포·복구 해시가 일치한다",()=>assert.deepEqual({deploy:hash(html),rollback:hash(rollback)},${JSON.stringify({ deploy: hashes.dashboardDeploy, rollback: hashes.dashboardRollback })}));\n`
    + `test("v69 대시보드 인라인 JavaScript 문법이 유효하다",()=>{[...html.toString("utf8").matchAll(/<script\\b(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1]).filter(Boolean).forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s,{filename:"dashboard-"+i+".js"})))});\n`
    + `test("v69 총 정원을 기간별 정원으로 손실 없이 배분해 저장한다",()=>{const source=html.toString("utf8");for(const value of ["distributeRecommendationFamilyOptionCapacities","familyOptionsJson: JSON.stringify","기간별 "])assert.ok(source.includes(value),value)});\n`,
    "utf8"
  );
}

function makeServerTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");\n`
    + `process.env.NODE_PATH=[path.resolve(__dirname,"../../../server/google-sheet-proxy-function/node_modules"),process.env.NODE_PATH||""].filter(Boolean).join(path.delimiter);require("node:module").Module._initPaths();\n`
    + `const hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `test("v69 서버와 Apps Script 파일 해시·문법이 유효하다",()=>{const server=fs.readFileSync(${JSON.stringify(names.server)}),apps=fs.readFileSync(${JSON.stringify(names.appsScript)});assert.deepEqual({server:hash(server),apps:hash(apps)},${JSON.stringify({ server: hashes.server, apps: hashes.appsScript })});assert.doesNotThrow(()=>new vm.Script(server.toString("utf8")));assert.doesNotThrow(()=>new vm.Script(apps.toString("utf8")))});\n`
    + `test("v69 서버는 통합 60명을 두 기간 30명씩 분리한다",()=>{const localSource=path.resolve(__dirname,"../../../server/google-sheet-proxy-function/index.js"),runtimePath=fs.existsSync(localSource)?localSource:"./${names.server}",api=require(runtimePath).__test;const familyOptions=[{goodSeq:"30001287",eventSeq:"30286551",departureDate:"2027-01-16",returnDate:"2027-01-21",durationLabel:"4박6일"},{goodSeq:"30001288",eventSeq:"30286552",departureDate:"2027-01-16",returnDate:"2027-01-24",durationLabel:"7박9일"}];const schedule={scheduleId:"admin-recommended-family",applicationId:"rs-family",isAdminRecommendedSchedule:true,productFamilyId:"pf_3562d40bd7cd449fa80eabc859faec63",capacity:60,familyOptionsJson:JSON.stringify(familyOptions)};assert.deepEqual(api.getRecommendedScheduleFamilyOptions(schedule).map(o=>o.capacity),[30,30]);const rows=[{applicationId:"a",targetScheduleId:schedule.scheduleId,erpProductId:"30001287",erpEventSeq:"30286551",applicantPeople:"2"},{applicationId:"b",targetScheduleId:schedule.scheduleId,erpProductId:"30001288",erpEventSeq:"30286552",applicantPeople:"3"}];const summary=api.buildScheduleParticipantSummary(schedule,rows);assert.equal(summary.confirmedPeople,5);assert.deepEqual(summary.familyOptionSummaries.map(o=>[o.confirmedCount,o.remainingSlots]),[[2,28],[3,27]])});\n`,
    "utf8"
  );
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 69 - 통합 추천일정 기간별 정원·참여자 분리\n\n`
    + `통합 카드에는 전체 참여자/전체 정원(예: 15/60명)을 표시하고, 상품상세의 4박6일·7박9일 탭에는 해당 ERP 행사 참여자와 기간별 정원(예: 11/30명, 4/30명)을 각각 표시합니다. 신청 저장과 마감 검증도 선택한 기간 단위로 처리합니다.\n\n`
    + `## 1. 서버 파일 업로드·검증\n\n/home/llno95ll/google-sheet-proxy-function 에 ${names.server}, ${names.appsScript}, ${names.serverTest}, ${names.mainDeploy}, ${names.mainRollback}, ${names.css}, ${names.js}, ${names.mainTest} 파일을 업로드합니다.\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.server} ${names.appsScript} ${names.serverTest} ${names.mainDeploy} ${names.mainRollback} ${names.css} ${names.js} ${names.mainTest}\nnode --check ${names.server}\nnode --test ${names.serverTest} ${names.mainTest}\ngzip -t ${names.css}\n\`\`\`\n\n`
    + `## 2. Cloud Function 교체·배포\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ncp -f index.js BACKUP_pre_stage69_index.js\ncp -f ${names.server} index.js\nnode --check index.js\ngcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml --update-secrets=GOLFJOIN_APPS_SCRIPT_EMAIL_SECRET=golfjoin-apps-script-email-secret:latest,GOLFJOIN_EMAIL_VERIFICATION_SECRET=golfjoin-email-verification-secret:latest\ngcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest\n\`\`\`\n\n`
    + `## 3. Apps Script 폴백 반영\n\n${names.appsScript} 전체 내용으로 현재 Apps Script 코드를 교체한 뒤 새 버전으로 웹앱을 다시 배포합니다. 기존 /exec URL은 유지합니다. 이 단계는 Google Sheets API 장애 시에도 기간별 참여 현황이 합산으로 되돌아가지 않게 합니다.\n\n`
    + `## 4. 메인 자산 업로드·HTML 교체\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\n\`\`\`\n\n${names.mainDeploy} 전체 내용으로 ERP 편집기의 골프조인 메인 HTML을 직접 교체합니다.\n\n`
    + `## 5. 대시보드 배포\n\n/home/llno95ll/golfjoin-admin-hosting 에 ${names.dashboardDeploy}, ${names.dashboardRollback}, ${names.dashboardTest}를 업로드합니다.\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/golfjoin-admin-hosting\nsha256sum ${names.dashboardDeploy} ${names.dashboardRollback} ${names.dashboardTest}\nnode --test ${names.dashboardTest}\ncp -f public/index.html BACKUP_pre_stage69_admin_dashboard.html\ncp -f ${names.dashboardDeploy} public/index.html\nfirebase deploy --only hosting --project dashboad-golfjoin-secrettour\n\`\`\`\n\n`
    + `## 6. 기존 1월 월례회 행 갱신\n\n대시보드 추천일정의 통합 1월 월례회에서 정원 60을 그대로 두고 저장을 한 번 누릅니다. familyOptionsJson에 4박6일 30명, 7박9일 30명이 명시적으로 저장됩니다.\n\n`
    + `## 7. 운영 확인\n\n- 통합 카드: 전체 신청 합계/60명\n- 4박6일 탭: 4박6일 행사 신청자/30명\n- 7박9일 탭: 7박9일 행사 신청자/30명\n- 한 기간이 30명 마감돼도 다른 기간은 잔여석만큼 신청 가능\n- 7박9일에서 신청한 행의 erpProductId/eventSeq가 30001288/30286552로 저장\n\n`
    + `## 복구\n\n서버는 BACKUP_pre_stage69_index.js로 재배포하고, 메인은 ${names.mainRollback}, 대시보드는 ${names.dashboardRollback}으로 되돌립니다. Apps Script는 배포 관리에서 직전 버전으로 되돌립니다.\n\n`
    + `- 서버 SHA-256: ${hashes.server}\n- 메인 HTML SHA-256: ${hashes.mainDeploy}\n- 대시보드 HTML SHA-256: ${hashes.dashboardDeploy}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const mainManifest = JSON.parse(fs.readFileSync(path.join(MAIN_BASE, "manifest.json"), "utf8"));
  const rollbackMain = readVerified(MAIN_BASE, mainManifest.names.deploy, mainManifest.hashes.deploy, "main_baseline");
  const cssGzip = readVerified(MAIN_BASE, mainManifest.names.css, mainManifest.hashes.css, "main_css");
  const oldJsBrotli = readVerified(MAIN_BASE, mainManifest.names.js, mainManifest.hashes.js, "main_js");
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const sourceJs = splitMainHtml(assembledHtml)[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");
  const changedFunctions = [
    "applyScheduleMutationParticipantResponse",
    "getCurrentApplyTargetInfo",
    "buildJoinApplyPayload",
    "getAdminRecommendedFamilyOptions",
    "enrichOpenDetailWithSecretTourData",
    "getAdminRecommendedDetailFamilyPeriodOptions",
    "submitGlobalApply",
    "openDetail"
  ];
  let nextJs = oldJs;
  changedFunctions.forEach((name) => { nextJs = replaceNamedFunction(nextJs, minifiedSourceJs, name); });
  new vm.Script(nextJs, { filename: "golfjoin-main-v69.js" });
  const js = Buffer.from(nextJs, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");
  const css = zlib.gunzipSync(cssGzip);
  const revision = `gha_${sha256(Buffer.concat([css, Buffer.from("\n--stage69--\n"), js])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let mainDeployText = rollbackMain.toString("utf8").split(mainManifest.assetRevision).join(revision);
  mainDeployText = replaceAllRequired(mainDeployText, mainManifest.hashes.cssSri, cssSri, "css_sri");
  mainDeployText = replaceAllRequired(mainDeployText, mainManifest.hashes.jsSri, jsSri, "js_sri");
  verifyInlineScripts(mainDeployText, "main");
  const mainDeploy = Buffer.from(mainDeployText, "utf8");

  const dashboardManifest = JSON.parse(fs.readFileSync(path.join(DASHBOARD_BASE, "manifest.json"), "utf8"));
  const rollbackDashboard = readVerified(DASHBOARD_BASE, dashboardManifest.names.deploy, dashboardManifest.hashes.deploy, "dashboard_baseline");
  const dashboardDeploy = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"));
  verifyInlineScripts(dashboardDeploy.toString("utf8"), "dashboard");
  const server = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
  const appsScript = fs.readFileSync(path.join(ROOT, "doc/google-sheet-web-app.gs"));
  new vm.Script(server.toString("utf8"), { filename: "stage69-index.js" });
  new vm.Script(appsScript.toString("utf8"), { filename: "stage69-google-sheet-web-app.gs" });

  const hashes = {
    mainDeploy: sha256(mainDeploy),
    mainRollback: sha256(rollbackMain),
    css: sha256(cssGzip),
    js: sha256(jsBrotli),
    cssSri,
    jsSri,
    dashboardDeploy: sha256(dashboardDeploy),
    dashboardRollback: sha256(rollbackDashboard),
    server: sha256(server),
    appsScript: sha256(appsScript)
  };
  const names = {
    server: "stage69-index.js",
    appsScript: "stage69-google-sheet-web-app.gs",
    serverTest: "stage69-integrated-period-capacity-server.test.js",
    mainDeploy: `DEPLOY_golfjoin_main_integrated_period_capacity_${hashes.mainDeploy.slice(0, 8).toUpperCase()}.html`,
    mainRollback: `ROLLBACK_golfjoin_main_${hashes.mainRollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    mainTest: "stage69-main-integrated-period-capacity.test.js",
    dashboardDeploy: `DEPLOY_golfjoin_admin_dashboard_${hashes.dashboardDeploy.slice(0, 8).toUpperCase()}.html`,
    dashboardRollback: `ROLLBACK_golfjoin_admin_dashboard_${hashes.dashboardRollback.slice(0, 8).toUpperCase()}.html`,
    dashboardTest: "stage69-dashboard-integrated-period-capacity.test.js"
  };
  const serverTest = makeServerTest(names, hashes);
  const mainTest = makeMainTest(names, hashes, revision);
  const dashboardTest = makeDashboardTest(names, hashes);
  hashes.serverTest = sha256(serverTest);
  hashes.mainTest = sha256(mainTest);
  hashes.dashboardTest = sha256(dashboardTest);

  const manifest = {
    schema: "golfjoin-integrated-period-capacity-v1",
    version: "v69",
    status: "ready-for-deployment",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    behavior: {
      combinedCardCapacity: true,
      periodSpecificDetailCapacity: true,
      periodSpecificParticipants: true,
      periodSpecificCapacityEnforcement: true,
      selectedErpOptionPersistence: true,
      singleScheduleCompatibility: true,
      appsScriptReadFallbackParity: true
    },
    names,
    hashes
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  [
    [names.server, server],
    [names.appsScript, appsScript],
    [names.serverTest, serverTest],
    [names.mainDeploy, mainDeploy],
    [names.mainRollback, rollbackMain],
    [names.css, cssGzip],
    [names.js, jsBrotli],
    [names.mainTest, mainTest],
    [names.dashboardDeploy, dashboardDeploy],
    [names.dashboardRollback, rollbackDashboard],
    [names.dashboardTest, dashboardTest],
    ["RUNBOOK.md", Buffer.from(makeRunbook(names, hashes, revision), "utf8")],
    ["manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")]
  ].forEach(([name, value]) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));

  fs.writeFileSync(path.join(ROOT, "golfjoin_main.html"), mainDeploy);
  fs.writeFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), dashboardDeploy);
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, revision, names, hashes }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
