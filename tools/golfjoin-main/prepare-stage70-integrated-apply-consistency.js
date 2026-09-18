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
const BASE = path.join(ROOT, "deploy/stage69-integrated-period-capacity/detail-golf-summary-20260915-v69b");
const OUTPUT = path.join(ROOT, "deploy/stage70-integrated-apply-consistency/20260915-v70");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sri = (value) => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;

function readVerified(name, expected, label) {
  const value = fs.readFileSync(path.join(BASE, name));
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

function replaceFunctionWithGroup(target, targetName, source, names) {
  const before = getNamedFunctionSource(target, targetName);
  const after = names.map((name) => getNamedFunctionSource(source, name)).join("");
  const count = target.split(before).length - 1;
  if (count !== 1) throw new Error(`function_group_replace_count_invalid:${targetName}:${count}`);
  return target.replace(before, after);
}

function verifyInlineScripts(html) {
  [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim())
    .forEach((source, index) => new vm.Script(source, { filename: `main-inline-${index + 1}.js` }));
}

function makeServerTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");\n`
    + `process.env.NODE_PATH=[path.resolve("/home/llno95ll/google-sheet-proxy-function/node_modules"),process.env.NODE_PATH||""].filter(Boolean).join(path.delimiter);require("node:module").Module._initPaths();\n`
    + `const hash=v=>crypto.createHash("sha256").update(v).digest("hex"),server=fs.readFileSync(${JSON.stringify(names.server)}),api=require(path.resolve(${JSON.stringify(names.server)})).__test;\n`
    + `test("v70 서버 파일 해시와 문법이 유효하다",()=>{assert.equal(hash(server),${JSON.stringify(hashes.server)});assert.doesNotThrow(()=>new vm.Script(server.toString("utf8")))});\n`
    + `test("v70 기간별 잔여석은 서버 마감 검사가 읽는 remainingSeats를 제공한다",()=>{const schedule={scheduleId:"admin-recommended-rs-family",applicationId:"rs-family",sourceApplicationId:"rs-family",isAdminRecommendedSchedule:true,productFamilyId:"pf_3562d40bd7cd449fa80eabc859faec63",capacity:60,familyOptionsJson:JSON.stringify([{goodSeq:"30001287",eventSeq:"30286551",departureDate:"2027-01-16",returnDate:"2027-01-21",durationLabel:"4박6일",capacity:30},{goodSeq:"30001288",eventSeq:"30286552",departureDate:"2027-01-16",returnDate:"2027-01-24",durationLabel:"7박9일",capacity:30}])};const options=api.getRecommendedScheduleFamilyOptions(schedule),rows=[{applicationId:"a",targetType:"recommended_schedule",targetScheduleId:schedule.scheduleId,erpProductId:"30001287",erpEventSeq:"30286551",applicantPeople:"1"}];const first=api.buildRecommendedFamilyOptionParticipantSummary(schedule,rows,options[0]),second=api.buildRecommendedFamilyOptionParticipantSummary(schedule,rows,options[1]);assert.deepEqual([first.capacity,first.confirmedPeople,first.remainingSeats],[30,1,29]);assert.deepEqual([second.capacity,second.confirmedPeople,second.remainingSeats],[30,0,30])});\n`,
    "utf8"
  );
}

function makeMainTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(n),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v70 메인 자산 해시와 JavaScript 문법이 유효하다",()=>{assert.equal(hash(jsBr),${JSON.stringify(hashes.js)});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v70 기간 정원과 카카오 로그인 복귀 보정이 포함된다",()=>{for(const value of ["getJoinApplyResumeParams","restoreJoinApplyTarget","productFamilyId","join_schedule_option_invalid","신청할 상품 정보를 확인하지 못했습니다"])assert.ok(js.includes(value),value)});\n`,
    "utf8"
  );
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(BASE, "manifest.json"), "utf8"));
  const rollback = readVerified(manifest.names.deploy, manifest.hashes.deploy, "baseline_html");
  const oldJsBrotli = readVerified(manifest.names.js, manifest.hashes.js, "baseline_js");
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");
  const assembledHtml = assembleFromSource();
  const sourceJs = splitMainHtml(assembledHtml)[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");

  let nextJs = oldJs;
  [
    "getAdminRecommendedFamilyOptions",
    "reloadJoinMainPage",
    "openGlobalApply",
    "getJoinAfterLoginExtraParams",
    "continueAfterJoinMemberLogin",
    "clearJoinExternalDeepLinkTarget",
    "getJoinCanonicalPageUrl",
    "resumeJoinMyMenuAfterLogin"
  ].forEach((name) => { nextJs = replaceNamedFunction(nextJs, minifiedSourceJs, name); });
  nextJs = replaceFunctionWithGroup(nextJs, "getCurrentApplyJoin", minifiedSourceJs, [
    "getCurrentApplyJoin",
    "getJoinApplyResumeParams",
    "findJoinApplyResumeTarget",
    "restoreJoinApplyTarget"
  ]);
  new vm.Script(nextJs, { filename: "golfjoin-main-v70.js" });
  const js = Buffer.from(nextJs, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");
  const revision = `gha_${sha256(Buffer.concat([Buffer.from("stage70\n"), js])).slice(0, 24)}`;
  const nextJsSri = sri(js);
  const oldJsPath = `/web/home-assets/${manifest.assetRevision}/golfjoin-main.js`;
  const nextJsPath = `/web/home-assets/${revision}/golfjoin-main.js`;
  let deployText = rollback.toString("utf8");
  if (!deployText.includes(oldJsPath)) throw new Error("js_asset_path_missing");
  deployText = deployText.split(oldJsPath).join(nextJsPath);
  if (!deployText.includes(manifest.hashes.jsSri)) throw new Error("js_sri_missing");
  deployText = deployText.split(manifest.hashes.jsSri).join(nextJsSri);
  verifyInlineScripts(deployText);
  const deploy = Buffer.from(deployText, "utf8");
  const server = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
  const appsScript = fs.readFileSync(path.join(ROOT, "doc/google-sheet-web-app.gs"));
  new vm.Script(server.toString("utf8"), { filename: "stage70-index.js" });
  new vm.Script(appsScript.toString("utf8"), { filename: "stage70-google-sheet-web-app.gs" });

  const hashes = {
    deploy: sha256(deploy),
    rollback: sha256(rollback),
    js: sha256(jsBrotli),
    jsSri: nextJsSri,
    server: sha256(server),
    appsScript: sha256(appsScript)
  };
  const names = {
    deploy: `DEPLOY_golfjoin_main_integrated_apply_consistency_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    server: "stage70-index.js",
    appsScript: "stage70-google-sheet-web-app.gs",
    serverTest: "stage70-integrated-apply-server.test.js",
    mainTest: "stage70-integrated-apply-main-asset.test.js"
  };
  const serverTest = makeServerTest(names, hashes);
  const mainTest = makeMainTest(names, hashes);
  hashes.serverTest = sha256(serverTest);
  hashes.mainTest = sha256(mainTest);
  const outputManifest = {
    schema: "golfjoin-integrated-apply-consistency-v1",
    version: "v70",
    status: "ready-for-deployment",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    scope: { cloudFunction: true, appsScriptFallback: true, mainHtml: true, mainJavaScript: true, mainCss: false, dashboard: false },
    names,
    hashes
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  [
    [names.deploy, deploy],
    [names.rollback, rollback],
    [names.js, jsBrotli],
    [names.server, server],
    [names.appsScript, appsScript],
    [names.serverTest, serverTest],
    [names.mainTest, mainTest],
    ["manifest.json", Buffer.from(`${JSON.stringify(outputManifest, null, 2)}\n`, "utf8")]
  ].forEach(([name, value]) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));
  fs.writeFileSync(path.join(ROOT, "golfjoin_main.html"), deploy);
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, revision, names, hashes }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
