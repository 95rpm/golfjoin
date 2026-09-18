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
  "deploy/stage66-airpack-thumbnail/quick-age-composition-20260915-v66c"
);
const OUTPUT = path.join(
  ROOT,
  "deploy/stage66-airpack-thumbnail/authoritative-age-composition-20260915-v66d"
);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sri(value) {
  return `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;
}

function readVerified(root, fileName, expectedHash, label) {
  const value = fs.readFileSync(path.join(root, fileName));
  if (sha256(value) !== expectedHash) throw new Error(`${label}_hash_mismatch`);
  return value;
}

function replaceExact(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count !== 1) throw new Error(`${label}_count_invalid:${count}`);
  return source.replace(target, replacement);
}

function replaceAllRequired(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count < 1) throw new Error(`${label}_missing`);
  return source.split(target).join(replacement);
}

function getNamedFunctionSource(source, name) {
  const program = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  const node = program.body.find((item) => item.type === "FunctionDeclaration" && item.id?.name === name);
  if (!node) throw new Error(`function_missing:${name}`);
  return source.slice(node.start, node.end);
}

function verifyInlineScripts(html) {
  [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim())
    .forEach((source, index) => new vm.Script(source, { filename: `main-inline-${index + 1}.js` }));
}

function makeCloudShellTest(names, hashes, functionContract) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),cssGz=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),css=zlib.gunzipSync(cssGz).toString("utf8"),js=zlib.brotliDecompressSync(jsBr).toString("utf8"),contract=${JSON.stringify(functionContract)};\n`
    + `test("v66d 업로드 자산 해시와 문법이 유효하다",()=>{assert.equal(hash(cssGz),${JSON.stringify(hashes.css)});assert.equal(hash(jsBr),${JSON.stringify(hashes.js)});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v66d 전체 연령대 집계를 우선하고 상위 두 구간으로 요약한다",()=>{assert.ok(js.includes(contract));for(const value of ["participantSummary?.ageDecadeCounts","new Map","slice(0,2)","중심 참여자 구성"])assert.ok(contract.includes(value),value);for(const value of ["flatMap","매너형"])assert.equal(contract.includes(value),false,value)});\n`
    + `test("v66d 실제 참여 인원과 잔여석 문구를 유지한다",()=>{for(const value of ["getJoinAuthoritativeConfirmedCount","현재 모집이 마감됐어요.","자리만 남았어요."])assert.ok(contract.includes(value),value)});\n`
    + `test("v66d 마감임박 배지와 해외 숨김 규칙을 유지한다",()=>{for(const value of ["height: 25px","padding: 4px 8px",".join-product-section.layout-quick .join-category-chip.overseas","display: none !important"])assert.ok(css.includes(value),value)});\n`
    + `test("v66d 항공팩 썸네일 보정과 취소 일정 차단을 유지한다",()=>{for(const value of ["adminRecommendedProductCache","admin-recommended-product-reconciliation","isPublicHomeJoinSchedule"])assert.ok(js.includes(value),value)});\n`;
}

function makePackageTest(names, hashes, revision) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.deploy)}),rollback=read(${JSON.stringify(names.rollback)}),cssGz=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr),index=read(${JSON.stringify(names.index)}),serverTest=read(${JSON.stringify(names.serverTest)});\n`
    + `test("v66d 산출물 해시가 일치한다",()=>{assert.deepEqual({deploy:hash(html),rollback:hash(rollback),css:hash(cssGz),js:hash(jsBr),index:hash(index),serverTest:hash(serverTest)},${JSON.stringify({ deploy: hashes.deploy, rollback: hashes.rollback, css: hashes.css, js: hashes.js, index: hashes.index, serverTest: hashes.serverTest })})});\n`
    + `test("v66d HTML과 서버 JavaScript 문법이 유효하다",()=>{const value=html.toString("utf8");assert.ok(value.includes(${JSON.stringify(revision)}));assert.ok(value.includes(${JSON.stringify(hashes.cssSri)}));assert.ok(value.includes(${JSON.stringify(hashes.jsSri)}));assert.doesNotThrow(()=>new vm.Script(js.toString("utf8")));assert.doesNotThrow(()=>new vm.Script(index.toString("utf8")))});\n`
    + `test("v66d 서버는 개인정보 없는 전체 연령대 집계를 공개한다",()=>{for(const value of ["countParticipantSummaryAgeDecades","ageDecadeCounts","normalizeParticipantSummaryAgeDecades"])assert.ok(index.toString("utf8").includes(value),value)});\n`
    + `test("v66d 복구본은 미리보기 연령 요약이 포함된 v66c이다",()=>{assert.equal(hash(rollback),"ae955971e91c193c7f09cff54fbc73d7e1306e3ddbde9eb2c890f3278bc707e0")});\n`;
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 66d - 마감임박 전체 참여자 나이대 구성\n\n`
    + `v66c까지의 실제 참여 인원·잔여석·배지·항공팩·썸네일 수정을 모두 포함합니다. 서버가 전체 확정 참여자의 개인정보 없는 10년 단위 연령 집계를 제공하고, 화면은 빈도가 높은 두 구간만 표시합니다.\n\n`
    + `## 1. Cloud Shell 업로드·검증\n\n`
    + `아래 5개 파일을 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다.\n\n`
    + `- ${names.index}\n- ${names.serverTest}\n- ${names.css}\n- ${names.js}\n- ${names.cloudTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.index} ${names.serverTest} ${names.css} ${names.js} ${names.cloudTest}\nnode --check ${names.index}\nnode --test ${names.serverTest} ${names.cloudTest}\n\`\`\`\n\n`
    + `정상 결과는 tests 8, pass 8, fail 0입니다.\n\n`
    + `## 2. 서버 교체·배포\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ncp -f index.js BACKUP_pre_stage66d_index.js\ncp -f ${names.index} index.js\nnode --check index.js\n\ngcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml --update-secrets=GOLFJOIN_APPS_SCRIPT_EMAIL_SECRET=golfjoin-apps-script-email-secret:latest,GOLFJOIN_EMAIL_VERIFICATION_SECRET=golfjoin-email-verification-secret:latest\ngcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest\n\`\`\`\n\n`
    + `## 3. GCS 불변 자산 업로드\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\ncurl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\ncurl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n\`\`\`\n\n`
    + `## 4. ERP HTML 교체\n\n${names.deploy} 전체 내용으로 메인페이지 HTML을 교체합니다.\n\n`
    + `## 5. 운영 확인\n\n`
    + `1. 59/60명 일정의 구성 문구가 전체 연령 집계 기준의 상위 두 나이대로 표시되는지 확인합니다.\n`
    + `2. 인원 문구가 ‘이미 59명 참여, 마지막 한 자리만 남았어요.’인지 확인합니다.\n`
    + `3. 마감임박 카드에서 해외 배지가 숨겨지고 마지막 1자리·추천일정 배지가 같은 규격인지 확인합니다.\n\n`
    + `## 6. 복구\n\n서버는 BACKUP_pre_stage66d_index.js로 되돌려 재배포하고, HTML은 ${names.rollback} 전체 내용으로 되돌립니다. GCS 객체는 삭제하지 않습니다.\n\n`
    + `- 서버 index SHA-256: ${hashes.index}\n- 배포 HTML SHA-256: ${hashes.deploy}\n- CSS 업로드 SHA-256: ${hashes.css}\n- JS 업로드 SHA-256: ${hashes.js}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(BASELINE, "manifest.json"), "utf8"));
  const rollback = readVerified(BASELINE, manifest.names.deploy, manifest.hashes.deploy, "baseline_html");
  const cssGzip = readVerified(BASELINE, manifest.names.css, manifest.hashes.css, "baseline_css");
  const oldJsBrotli = readVerified(BASELINE, manifest.names.js, manifest.hashes.js, "baseline_js");
  const css = zlib.gunzipSync(cssGzip);
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const parts = splitMainHtml(assembledHtml);
  const sourceJs = parts[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");
  const newRenderCopy = getNamedFunctionSource(minifiedSourceJs, "renderJoinParticipantCopy");
  const oldRenderCopy = getNamedFunctionSource(oldJs, "renderJoinParticipantCopy");
  const nextJsText = replaceExact(oldJs, oldRenderCopy, newRenderCopy, "participant_copy");
  new vm.Script(nextJsText, { filename: "golfjoin-main-v66d.js" });
  const js = Buffer.from(nextJsText, "utf8");
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
    Buffer.from("\n--golfjoin-authoritative-age-composition-v1--\n")
  ])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let deployText = rollback.toString("utf8").split(manifest.assetRevision).join(revision);
  deployText = replaceExact(deployText, manifest.hashes.jsSri, jsSri, "html_js_sri");
  verifyInlineScripts(deployText);
  const deploy = Buffer.from(deployText, "utf8");
  const serverIndex = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
  new vm.Script(serverIndex.toString("utf8"), { filename: "stage66d-index.js" });
  const serverTestSource = fs.readFileSync(
    path.join(ROOT, "server/google-sheet-proxy-function/participant-age-summary.test.js"),
    "utf8"
  );
  const serverTest = Buffer.from(
    replaceExact(serverTestSource, 'require("./index")', 'require("./stage66d-index")', "server_test_import"),
    "utf8"
  );

  const hashes = {
    deploy: sha256(deploy),
    rollback: sha256(rollback),
    css: sha256(cssGzip),
    js: sha256(jsBrotli),
    index: sha256(serverIndex),
    serverTest: sha256(serverTest),
    cssSri,
    jsSri
  };
  const names = {
    deploy: `DEPLOY_golfjoin_main_authoritative_age_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    index: "stage66d-index.js",
    serverTest: "stage66d-participant-age-summary.test.js",
    cloudTest: "stage66d-authoritative-age-cloudshell.test.js",
    packageTest: "stage66d-authoritative-age-package.test.js"
  };
  const cloudTest = Buffer.from(makeCloudShellTest(names, hashes, newRenderCopy), "utf8");
  const packageTest = Buffer.from(makePackageTest(names, hashes, revision), "utf8");
  const runbook = Buffer.from(makeRunbook(names, hashes, revision), "utf8");
  const outputManifest = {
    schema: "golfjoin-authoritative-age-composition-v1",
    version: "v66d",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    supersedes: "v66c",
    behavior: {
      serverPublishesFullAgeDecadeCounts: true,
      clientPrefersServerAgeDecadeCounts: true,
      ageCompositionUsesMostFrequentDecades: true,
      ageCompositionLimit: 2,
      detailedAgePhaseHidden: true,
      unrepresentativeStyleLabelRemoved: true,
      includesV66bParticipantAndBadgeFixes: true,
      includesV66aAirpackThumbnailFix: true
    },
    names,
    hashes
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  new Map([
    [names.deploy, deploy],
    [names.rollback, rollback],
    [names.css, cssGzip],
    [names.js, jsBrotli],
    [names.index, serverIndex],
    [names.serverTest, serverTest],
    [names.cloudTest, cloudTest],
    [names.packageTest, packageTest],
    ["RUNBOOK.md", runbook]
  ]).forEach((value, name) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));
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
