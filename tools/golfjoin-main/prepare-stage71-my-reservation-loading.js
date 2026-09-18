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
const BASE = path.join(ROOT, "deploy/stage70-integrated-apply-consistency/20260915-v70");
const OUTPUT = path.join(ROOT, "deploy/stage71-my-reservation-loading/20260915-v71a");
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

function makeAssetTest(names, hashes) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(n),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `const boundaries={handleJoinMyTripClick:"getJoinLogoutUrl",promptJoinPendingRosterCandidates:"resetJoinMemberSignupValidation",openJoinMyMenu:"closeJoinMyMenu"};\n`
    + `const fn=name=>{const start=js.indexOf("function "+name+"("),end=js.indexOf("function "+boundaries[name]+"(",start+1);assert.ok(start>=0,name+" missing");assert.ok(end>start,name+" boundary missing");return js.slice(start,end)};\n`
    + `test("v71 메인 자산 해시와 JavaScript 문법이 유효하다",()=>{assert.equal(hash(jsBr),${JSON.stringify(hashes.js)});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v71 내예약 클릭은 공통 로딩과 요청 문구를 사용한다",()=>{const s=fn("handleJoinMyTripClick");assert.match(s,/예약정보를 불러오고 있어요/);assert.match(s,/beforePendingRosterPrompt/);assert.match(s,/closeJoinActionLoading/)});\n`
    + `test("v71 과거 신청 확인창은 공통 로딩을 먼저 닫고 표시한다",()=>{const p=fn("promptJoinPendingRosterCandidates"),m=fn("openJoinMyMenu"),callbacks=p.match(/beforePromptOpen/g)||[];assert.ok(callbacks.length>=2);assert.ok(p.lastIndexOf("beforePromptOpen")<p.indexOf('.classList.add("open")'));assert.match(m,/beforePromptOpen/);assert.match(m,/beforePendingRosterPrompt/)});\n`
    + `test("v71 내예약 중복 클릭과 캐시 재사용을 유지한다",()=>{const h=fn("handleJoinMyTripClick"),m=fn("openJoinMyMenu");assert.match(h,/joinMyReservationOpening/);assert.match(m,/hasFreshGoogleSheetRowsCache/);assert.match(m,/Promise.allSettled/)});\n`,
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
    "promptJoinPendingRosterCandidates",
    "handleJoinMyTripClick",
    "openJoinMyMenu"
  ].forEach((name) => { nextJs = replaceNamedFunction(nextJs, minifiedSourceJs, name); });
  new vm.Script(nextJs, { filename: "golfjoin-main-v71.js" });

  const js = Buffer.from(nextJs, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");

  const revision = `gha_${sha256(Buffer.concat([Buffer.from("stage71\n"), js])).slice(0, 24)}`;
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

  const hashes = {
    deploy: sha256(deploy),
    rollback: sha256(rollback),
    js: sha256(jsBrotli),
    jsSri: nextJsSri
  };
  const names = {
    deploy: `DEPLOY_golfjoin_main_my_reservation_loading_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    assetTest: "stage71a-my-reservation-loading-cloudshell.test.js"
  };
  const assetTest = makeAssetTest(names, hashes);
  hashes.assetTest = sha256(assetTest);

  const outputManifest = {
    schema: "golfjoin-my-reservation-loading-v1",
    version: "v71a",
    status: "ready-for-deployment",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    scope: { cloudFunction: false, appsScriptFallback: false, mainHtml: true, mainJavaScript: true, mainCss: false, dashboard: false },
    names,
    hashes
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  [
    [names.deploy, deploy],
    [names.rollback, rollback],
    [names.js, jsBrotli],
    [names.assetTest, assetTest],
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
