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
const BASE = path.join(ROOT, "deploy/stage69-integrated-period-capacity/period-capacity-20260915-v69");
const OUTPUT = path.join(ROOT, "deploy/stage69-integrated-period-capacity/detail-golf-summary-20260915-v69b");
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

function makeTest(names, hashes, revision) {
  return Buffer.from(
    `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(n),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.deploy)}),rollback=read(${JSON.stringify(names.rollback)}),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v69b 배포 파일 해시와 압축 자산 문법이 유효하다",()=>{assert.deepEqual({html:hash(html),rollback:hash(rollback),js:hash(jsBr)},${JSON.stringify({ html: hashes.deploy, rollback: hashes.rollback, js: hashes.js })});assert.ok(html.toString("utf8").includes(${JSON.stringify(revision)}));assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v69b 통합 상세는 지연 상품군 카탈로그를 즉시 불러와 골프 요약을 갱신한다",()=>{for(const value of ["deferWhileHomeDataV2Startup","requireGolfSummaryForFamilyId","golfSummaryRefreshAttempts",".detail-family-period-golf","Failed to refresh integrated recommendation golf summaries."])assert.ok(js.includes(value),value)});\n`
    + `test("v69b 통합 기간·기간별 정원·선택 ERP 행사 기능을 유지한다",()=>{for(const value of ["getAdminRecommendedDetailFamilyPeriodOptions","familyOptionSummaries","targetProductKey","familyOptionsJson"])assert.ok(js.includes(value),value)});\n`,
    "utf8"
  );
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 69b - 통합 상품상세 골프 일정 문구 갱신\n\n`
    + `통합 추천일정 상품상세를 처음 열 때 상품군 카탈로그를 즉시 불러오고, 기간 버튼의 임시 문구인 \`골프 일정 확인 중\`을 실제 골프 일정 요약으로 바꿉니다. Cloud Function, 대시보드, Apps Script 변경은 없습니다.\n\n`
    + `## 필요한 파일\n\n- GCS 업로드: ${names.js}\n- ERP 편집기 직접 교체: ${names.deploy}\n- 복구용: ${names.rollback}\n\n`
    + `## 검증\n\n\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.deploy} ${names.rollback} ${names.js} ${names.test}\nnode --test ${names.test}\n\`\`\`\n\n`
    + `## 자산 업로드\n\n\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\n\`\`\`\n\n`
    + `${names.deploy} 전체 내용으로 ERP 편집기의 골프조인 메인 HTML을 직접 교체합니다. 서버 폴더에 HTML을 올릴 필요는 없습니다.\n\n`
    + `- HTML SHA-256: ${hashes.deploy}\n- JavaScript SHA-256: ${hashes.js}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(BASE, "manifest.json"), "utf8"));
  const rollback = readVerified(manifest.names.mainDeploy, manifest.hashes.mainDeploy, "baseline_html");
  const oldJsBrotli = readVerified(manifest.names.js, manifest.hashes.js, "baseline_js");
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const sourceJs = splitMainHtml(assembledHtml)[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");
  let nextJs = replaceNamedFunction(oldJs, minifiedSourceJs, "ensureGolfJoinProductFamilyCatalogLoaded");
  nextJs = replaceNamedFunction(nextJs, minifiedSourceJs, "openDetail");
  new vm.Script(nextJs, { filename: "golfjoin-main-v69b.js" });
  const js = Buffer.from(nextJs, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");
  const revision = `gha_${sha256(Buffer.concat([Buffer.from("stage69b\n"), js])).slice(0, 24)}`;
  const nextJsSri = sri(js);
  const oldJsPath = `/web/home-assets/${manifest.assetRevision}/golfjoin-main.js`;
  const nextJsPath = `/web/home-assets/${revision}/golfjoin-main.js`;
  let deployText = rollback.toString("utf8");
  const jsPathCount = deployText.split(oldJsPath).length - 1;
  if (!jsPathCount) throw new Error("js_asset_path_missing");
  deployText = deployText.split(oldJsPath).join(nextJsPath);
  const sriCount = deployText.split(manifest.hashes.jsSri).length - 1;
  if (!sriCount) throw new Error("js_sri_missing");
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
    deploy: `DEPLOY_golfjoin_main_family_golf_summary_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    test: "stage69b-main-family-golf-summary.test.js"
  };
  const testFile = makeTest(names, hashes, revision);
  hashes.test = sha256(testFile);
  const outputManifest = {
    schema: "golfjoin-family-golf-summary-refresh-v1",
    version: "v69b",
    status: "ready-for-deployment",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    scope: { mainHtml: true, mainCss: false, mainJavaScript: true, cloudFunction: false, dashboard: false, appsScript: false },
    names,
    hashes
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  [
    [names.deploy, deploy],
    [names.rollback, rollback],
    [names.js, jsBrotli],
    [names.test, testFile],
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
