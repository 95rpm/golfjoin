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
const BASE = path.join(ROOT, "deploy/stage71-my-reservation-loading/20260915-v71a");
const OUTPUT = path.join(ROOT, "deploy/stage72-family-golf-option-holes/20260915-v72");
const SERVER_SOURCE = path.join(ROOT, "server/google-sheet-proxy-function/product-family.js");
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

function verifyInlineScripts(html) {
  [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim())
    .forEach((source, index) => new vm.Script(source, { filename: `main-inline-${index + 1}.js` }));
}

function makeServerTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),api=require("./${names.server}");\n`
    + `const hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `test("v72 서버 파일 해시와 관광옵션 판정이 유효하다",()=>{assert.equal(hash(fs.readFileSync(${JSON.stringify(names.server)})),${JSON.stringify(hashes.server)});assert.deepEqual(api.analyzeGolfHoleLine("오전36홀 라운딩\\n[관광옵션]\\n18홀 라운드 후 관광"),{minHoles:36,maxHoles:36,condition:"fixed"})});\n`
    + `test("v72 1월 월례회 두 기간은 144홀과 252홀로 계산한다",()=>{const line={points:["오전36홀 라운딩"]},option={points:["오전36홀 라운딩\\n[관광옵션]\\n18홀 라운드 후 관광"]},four=api.buildGolfSummaryFromSchedule([line,line,option,line]),seven=api.buildGolfSummaryFromSchedule([line,line,option,line,line,line,line]);assert.deepEqual([four.golfDays,four.minTotalHoles,four.label],[4,144,"골프 4일 · 총 144홀"]);assert.deepEqual([seven.golfDays,seven.minTotalHoles,seven.label],[7,252,"골프 7일 · 총 252홀"])});\n`
    + `test("v72 조건부·보너스 홀 계산은 유지한다",()=>{assert.deepEqual(api.analyzeGolfHoleLine("18홀 또는 27홀"),{minHoles:18,maxHoles:27,condition:"alternative"});assert.deepEqual(api.analyzeGolfHoleLine("18홀 + 보너스 9홀"),{minHoles:18,maxHoles:27,condition:"optional_bonus"})});\n`,
    "utf8"
  );
}

function makeAssetTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(n),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `const extract=(name,next)=>{const start=js.indexOf("function "+name+"("),end=js.indexOf("function "+next+"(",start+1);assert.ok(start>=0,name+" missing");assert.ok(end>start,next+" boundary missing");return js.slice(start,end)};\n`
    + `test("v72 메인 자산 해시와 JavaScript 문법이 유효하다",()=>{assert.equal(hash(jsBr),${JSON.stringify(hashes.js)});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v72 메인 기간 버튼도 관광옵션 18홀을 추가 합산하지 않는다",()=>{const source=extract("analyzeDetailProductFamilyHoleLine","buildDetailProductFamilyGolfSummary"),fn=vm.runInNewContext("("+source+")");assert.deepEqual(JSON.parse(JSON.stringify(fn("오전36홀 라운딩\\n[관광옵션]\\n18홀 라운드 후 관광"))),{minHoles:36,maxHoles:36,condition:"fixed"})});\n`
    + `test("v72 통합 기간과 내예약 로딩 기능을 유지한다",()=>{for(const value of ["getAdminRecommendedDetailFamilyPeriodOptions","familyOptionSummaries","예약정보를 불러오고 있어요"])assert.ok(js.includes(value),value)});\n`,
    "utf8"
  );
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 72 - 통합 기간 골프 홀 수 보정\n\n`
    + `1월 월례회 일정의 기본 36홀과 같은 li 안의 [관광옵션] 18홀을 더하지 않습니다. 기간 버튼은 4일 144홀, 7일 252홀로 표시됩니다.\n\n`
    + `## Cloud Shell에 업로드할 4개 파일\n\n- ${names.server}\n- ${names.serverTest}\n- ${names.js}\n- ${names.assetTest}\n\n`
    + `메인 HTML은 서버에 업로드하지 않고 로컬 파일 ${names.deploy}의 전체 내용으로 ERP 편집기에서 직접 교체합니다.\n\n`
    + `## 해시\n\n- 서버: ${hashes.server}\n- 서버 시험: ${hashes.serverTest}\n- JS: ${hashes.js}\n- JS 시험: ${hashes.assetTest}\n- HTML: ${hashes.deploy}\n\n`
    + `## 자산 경로\n\n- gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n`;
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
  const nextJs = replaceNamedFunction(oldJs, minifiedSourceJs, "analyzeDetailProductFamilyHoleLine");
  new vm.Script(nextJs, { filename: "golfjoin-main-v72.js" });
  const js = Buffer.from(nextJs, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");

  const revision = `gha_${sha256(Buffer.concat([Buffer.from("stage72\n"), js])).slice(0, 24)}`;
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
  const server = fs.readFileSync(SERVER_SOURCE);

  const hashes = {
    deploy: sha256(deploy),
    rollback: sha256(rollback),
    js: sha256(jsBrotli),
    jsSri: nextJsSri,
    server: sha256(server)
  };
  const names = {
    deploy: `DEPLOY_golfjoin_main_family_golf_option_holes_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    server: "stage72-product-family.js",
    serverTest: "stage72-family-golf-option-holes.test.js",
    assetTest: "stage72-family-golf-option-holes-main-asset.test.js"
  };
  const serverTest = makeServerTest(names, hashes);
  const assetTest = makeAssetTest(names, hashes);
  hashes.serverTest = sha256(serverTest);
  hashes.assetTest = sha256(assetTest);

  const outputManifest = {
    schema: "golfjoin-family-golf-option-holes-v1",
    version: "v72",
    status: "ready-for-deployment",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    scope: { cloudFunction: true, appsScriptFallback: false, mainHtml: true, mainJavaScript: true, mainCss: false, dashboard: false },
    expected: { fourDay: "골프 4일 · 총 144홀", sevenDay: "골프 7일 · 총 252홀" },
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
    [names.serverTest, serverTest],
    [names.assetTest, assetTest],
    ["RUNBOOK.md", Buffer.from(makeRunbook(names, hashes, revision), "utf8")],
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
