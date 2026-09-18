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
const BASELINE = path.join(
  ROOT,
  "deploy/stage64-participant-cancellation/participant-cancellation-20260909-v64"
);
const OUTPUT = path.join(
  ROOT,
  "deploy/stage66-airpack-thumbnail/january-airpack-thumbnail-20260914-v66a"
);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sri(value) {
  return `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;
}

function readVerified(root, record, label) {
  const value = fs.readFileSync(path.join(root, record.fileName));
  if (sha256(value) !== record.sha256) throw new Error(`${label}_hash_mismatch`);
  return value;
}

function replaceExact(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count !== 1) throw new Error(`${label}_count_invalid:${count}`);
  return source.replace(target, replacement);
}

function parseProgram(source) {
  return acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
}

function getNamedFunctionSource(source, name) {
  const node = parseProgram(source).body.find((item) => (
    item.type === "FunctionDeclaration" && item.id?.name === name
  ));
  if (!node) throw new Error(`function_missing:${name}`);
  return source.slice(node.start, node.end);
}

function replaceNamedFunction(source, name, replacement) {
  const current = getNamedFunctionSource(source, name);
  return replaceExact(source, current, replacement, `function_${name}`);
}

function verifyInlineScripts(html, label) {
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  scripts.forEach((source, index) => new vm.Script(source, { filename: `${label}-inline-${index + 1}.js` }));
}

function makeCloudShellTest(names, hashes, functionContracts) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const hash=v=>crypto.createHash("sha256").update(v).digest("hex"),css=fs.readFileSync(${JSON.stringify(names.css)}),jsBr=fs.readFileSync(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v66a 업로드 자산 해시와 JavaScript 문법이 유효하다",()=>{assert.equal(hash(css),${JSON.stringify(hashes.css)});assert.equal(hash(jsBr),${JSON.stringify(hashes.js)});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v66a 항공팩 명시값을 항공포함 배지의 우선 근거로 사용한다",()=>{assert.ok(js.includes(${JSON.stringify(functionContracts.hasIncludedFlight)}));for(const value of ["항공팩","골프팩","airpack","golfpack"])assert.ok(js.includes(value),value)});\n`
    + `test("v66a 관리자 추천일정은 최신 홈 카드로 상품 이미지와 메타데이터를 보정한다",()=>{for(const value of ["adminRecommendedProductCache","loadGolfJoinHomeCardsJson","admin-recommended-product-reconciliation"])assert.ok(js.includes(value),value);assert.ok(js.includes(${JSON.stringify(functionContracts.reconcileAdminRecommendedProducts)}))});\n`
    + `test("v66a 기존 취소·숨김 일정 공개 차단을 유지한다",()=>{for(const value of ["isPublicHomeJoinSchedule","isAdminRecommendedSchedule","isPublicHomeSchedule"])assert.ok(js.includes(value),value)});\n`;
}

function makePackageTest(names, hashes, revision) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.deploy)}),rollback=read(${JSON.stringify(names.rollback)}),css=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr);\n`
    + `test("v66a 전체 산출물 해시가 일치한다",()=>{assert.deepEqual({deploy:hash(html),rollback:hash(rollback),css:hash(css),js:hash(jsBr)},${JSON.stringify({ deploy: hashes.deploy, rollback: hashes.rollback, css: hashes.css, js: hashes.js })})});\n`
    + `test("v66a HTML은 새 불변 자산 경로와 논리 SRI를 사용한다",()=>{const value=html.toString("utf8");assert.ok(value.includes(${JSON.stringify(revision)}));assert.ok(value.includes(${JSON.stringify(hashes.cssSri)}));assert.ok(value.includes(${JSON.stringify(hashes.jsSri)}));assert.doesNotThrow(()=>new vm.Script(js.toString("utf8")))});\n`
    + `test("v66a 복구본은 직전 v64 메인 HTML이다",()=>{assert.equal(hash(rollback),"cb76ac0764e70cd5039b276e3399351c9abf7d7a65501e71f15a3aaf36291728")});\n`;
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 66a - 1월 월례회 항공팩 배지·썸네일 보정\n\n`
    + `관리자 추천일정의 명시된 상품군(항공팩/골프팩)을 카드 배지의 우선 근거로 사용합니다. 정적 Release에 아직 없는 신규 추천상품은 현재 홈 카드 원본에서 같은 goodSeq/eventSeq를 찾아 이미지와 상품 메타데이터를 다시 결합합니다.\n\n`
    + `## 1. Cloud Shell 업로드·검증\n\n`
    + `아래 3개 파일을 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다.\n\n`
    + `- ${names.css}\n- ${names.js}\n- ${names.cloudTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.css} ${names.js} ${names.cloudTest}\nnode --test ${names.cloudTest}\n\`\`\`\n\n`
    + `정상 결과는 tests 4, pass 4, fail 0입니다.\n\n`
    + `## 2. GCS 불변 자산 업로드\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\ncurl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\ncurl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n\`\`\`\n\n`
    + `## 3. ERP HTML 교체\n\n`
    + `${names.deploy} 전체 내용으로 메인페이지 HTML을 교체합니다.\n\n`
    + `## 4. 운영 확인\n\n`
    + `1. 로그아웃 상태에서 메인페이지를 강력 새로고침합니다.\n`
    + `2. 해외골프 BEST에서 두 1월 월례회 바탐 카드에 썸네일이 보이는지 확인합니다.\n`
    + `3. 두 카드의 배지가 ‘항공포함’인지 확인합니다.\n`
    + `4. 로그인 상태에서도 같은 결과인지 확인하고 카드 클릭 시 상품상세가 열리는지 확인합니다.\n\n`
    + `## 5. 복구\n\n`
    + `문제가 있으면 ${names.rollback} 전체 내용으로 ERP HTML을 되돌립니다. GCS 객체는 삭제하지 않습니다.\n\n`
    + `- 배포 HTML SHA-256: ${hashes.deploy}\n`
    + `- CSS 업로드 SHA-256: ${hashes.css}\n`
    + `- JS 업로드 SHA-256: ${hashes.js}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const manifest = JSON.parse(fs.readFileSync(path.join(BASELINE, "manifest.json"), "utf8"));
  const rollback = readVerified(BASELINE, {
    fileName: manifest.names.mainDeploy,
    sha256: manifest.hashes.mainDeploy
  }, "baseline_html");
  const cssGzip = readVerified(BASELINE, {
    fileName: manifest.names.css,
    sha256: manifest.hashes.css
  }, "baseline_css");
  const oldJsBrotli = readVerified(BASELINE, {
    fileName: manifest.names.js,
    sha256: manifest.hashes.js
  }, "baseline_js");
  const css = zlib.gunzipSync(cssGzip);
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const sourceParts = splitMainHtml(assembledHtml);
  const sourceHtmlText = assembledHtml.toString("utf8");
  const sourceJs = sourceParts[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(sourceHtmlText, sourceJs);
  const nextMinified = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");

  const hasIncludedFlight = getNamedFunctionSource(nextMinified, "hasIncludedFlight");
  const getAdminRecommendedProductKey = getNamedFunctionSource(nextMinified, "getAdminRecommendedProductKey");
  const findAdminRecommendedProduct = getNamedFunctionSource(nextMinified, "findAdminRecommendedProduct");
  const reconcileAdminRecommendedProducts = getNamedFunctionSource(nextMinified, "reconcileAdminRecommendedProducts");
  const applyAdminRecommendedScheduleRows = getNamedFunctionSource(nextMinified, "applyAdminRecommendedScheduleRows");
  const adminState = "const adminRecommendedProductCache=new Map;let adminRecommendedProductReconciliationPromise=null,pendingAdminRecommendedProductRows=[];";

  let nextJs = replaceNamedFunction(oldJs, "hasIncludedFlight", hasIncludedFlight);
  nextJs = replaceNamedFunction(
    nextJs,
    "findAdminRecommendedProduct",
    `${adminState}${getAdminRecommendedProductKey}${findAdminRecommendedProduct}${reconcileAdminRecommendedProducts}`
  );
  nextJs = replaceNamedFunction(nextJs, "applyAdminRecommendedScheduleRows", applyAdminRecommendedScheduleRows);
  new vm.Script(nextJs, { filename: "golfjoin-main-v66a.js" });
  for (const marker of [
    "adminRecommendedProductCache",
    "loadGolfJoinHomeCardsJson",
    "admin-recommended-product-reconciliation"
  ]) {
    if (!nextJs.includes(marker)) throw new Error(`reconciliation_marker_missing:${marker}`);
  }

  const js = Buffer.from(nextJs, "utf8");
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");

  const revision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--golfjoin-airpack-thumbnail-v1--\n")
  ])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let deployText = rollback.toString("utf8").split(manifest.assetRevision).join(revision);
  deployText = replaceExact(deployText, manifest.hashes.jsSri, jsSri, "html_js_sri");
  verifyInlineScripts(deployText, "main");
  const deploy = Buffer.from(deployText, "utf8");

  const hashes = {
    deploy: sha256(deploy),
    rollback: sha256(rollback),
    css: sha256(cssGzip),
    js: sha256(jsBrotli),
    cssSri,
    jsSri
  };
  const names = {
    deploy: `DEPLOY_golfjoin_main_airpack_thumbnail_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    cloudTest: "stage66a-airpack-thumbnail-cloudshell.test.js",
    packageTest: "stage66a-airpack-thumbnail-package.test.js"
  };
  const functionContracts = { hasIncludedFlight, reconcileAdminRecommendedProducts };
  const cloudTest = Buffer.from(makeCloudShellTest(names, hashes, functionContracts), "utf8");
  const packageTest = Buffer.from(makePackageTest(names, hashes, revision), "utf8");
  const runbook = Buffer.from(makeRunbook(names, hashes, revision), "utf8");
  const outputManifest = {
    schema: "golfjoin-airpack-thumbnail-v1",
    version: "v66a",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    behavior: {
      explicitAirPackUsesIncludedBadge: true,
      individualAirStillUsesExcludedBadge: true,
      currentHomeCardsHydrateMissingRecommendedProduct: true,
      productIdentity: "goodSeq:eventSeq",
      cssChanged: false
    },
    names,
    hashes
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  const files = new Map([
    [names.deploy, deploy],
    [names.rollback, rollback],
    [names.css, cssGzip],
    [names.js, jsBrotli],
    [names.cloudTest, cloudTest],
    [names.packageTest, packageTest],
    ["RUNBOOK.md", runbook]
  ]);
  files.forEach((value, name) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(outputManifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(ROOT, "golfjoin_main.html"), deploy);
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, revision, names, hashes }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
