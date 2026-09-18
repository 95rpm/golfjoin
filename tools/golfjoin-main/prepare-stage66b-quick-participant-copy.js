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
  "deploy/stage66-airpack-thumbnail/january-airpack-thumbnail-20260914-v66a"
);
const OUTPUT = path.join(
  ROOT,
  "deploy/stage66-airpack-thumbnail/quick-participant-copy-badges-20260915-v66b"
);
const CSS_MARKER_START = "/* v66b: keep quick-card urgency badges consistent with recommendation badges. */";
const CSS_MARKER_END = "/* end v66b quick-card badge consistency */";

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

function getMarkedCss(source) {
  const start = source.indexOf(CSS_MARKER_START);
  const end = source.indexOf(CSS_MARKER_END, start);
  if (start < 0 || end < start) throw new Error("css_marker_missing");
  return source.slice(start, end + CSS_MARKER_END.length);
}

function verifyInlineScripts(html) {
  [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim())
    .forEach((source, index) => new vm.Script(source, { filename: `main-inline-${index + 1}.js` }));
}

function makeCloudShellTest(names, hashes, functionContract) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const hash=v=>crypto.createHash("sha256").update(v).digest("hex"),cssGz=fs.readFileSync(${JSON.stringify(names.css)}),jsBr=fs.readFileSync(${JSON.stringify(names.js)}),css=zlib.gunzipSync(cssGz).toString("utf8"),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `test("v66b 업로드 자산 해시와 문법이 유효하다",()=>{assert.equal(hash(cssGz),${JSON.stringify(hashes.css)});assert.equal(hash(jsBr),${JSON.stringify(hashes.js)});assert.doesNotThrow(()=>new vm.Script(js))});\n`
    + `test("v66b 참여 문구는 실제 일정 집계와 잔여석을 사용한다",()=>{assert.ok(js.includes(${JSON.stringify(functionContract)}));for(const value of ["getJoinAuthoritativeConfirmedCount","현재 모집이 마감됐어요.","자리만 남았어요."])assert.ok(js.includes(value),value);assert.equal(js.includes("이미 ${'${confirmed.length}'}명 참여"),false)});\n`
    + `test("v66b 마지막 1자리 배지는 추천일정 배지와 같은 규격이다",()=>{for(const value of ["height: 25px","min-height: 25px","padding: 4px 8px","border: 1px solid var(--border)","background: #ffffff","font-size: var(--font-card-category)"])assert.ok(css.includes(value),value)});\n`
    + `test("v66b 마감임박 카드에서 해외 범용 배지를 숨긴다",()=>{assert.ok(css.includes(".join-product-section.layout-quick .join-category-chip.overseas"));assert.ok(css.includes("display: none !important"))});\n`
    + `test("v66b 항공팩 썸네일 보정과 취소 일정 차단을 유지한다",()=>{for(const value of ["adminRecommendedProductCache","admin-recommended-product-reconciliation","isPublicHomeJoinSchedule"])assert.ok(js.includes(value),value)});\n`;
}

function makePackageTest(names, hashes, revision) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),html=read(${JSON.stringify(names.deploy)}),rollback=read(${JSON.stringify(names.rollback)}),css=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(jsBr);\n`
    + `test("v66b 산출물 해시가 일치한다",()=>{assert.deepEqual({deploy:hash(html),rollback:hash(rollback),css:hash(css),js:hash(jsBr)},${JSON.stringify({ deploy: hashes.deploy, rollback: hashes.rollback, css: hashes.css, js: hashes.js })})});\n`
    + `test("v66b HTML은 새 불변 자산과 논리 SRI를 사용한다",()=>{const value=html.toString("utf8");assert.ok(value.includes(${JSON.stringify(revision)}));assert.ok(value.includes(${JSON.stringify(hashes.cssSri)}));assert.ok(value.includes(${JSON.stringify(hashes.jsSri)}));assert.doesNotThrow(()=>new vm.Script(js.toString("utf8")))});\n`
    + `test("v66b 복구본은 항공팩·썸네일 수정이 포함된 v66a이다",()=>{assert.equal(hash(rollback),"084d40131b4698526d9669df6546497f07f7006c7fd778389e83000efacbb25e")});\n`;
}

function makeRunbook(names, hashes, revision) {
  return `# Stage 66b - 마감임박 실제 참여 문구·배지 정리\n\n`
    + `v66a 항공팩·썸네일 보정을 포함한 최신 통합본입니다. 마감임박 카드의 참여 숫자와 잔여석을 실제 일정 집계로 표시하고, 해외 범용 배지는 숨기며, 마지막 1자리 배지를 추천일정 배지와 같은 규격으로 표시합니다. v66a를 별도로 배포할 필요가 없습니다.\n\n`
    + `## 1. Cloud Shell 업로드·검증\n\n`
    + `아래 3개 파일을 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다.\n\n`
    + `- ${names.css}\n- ${names.js}\n- ${names.cloudTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.css} ${names.js} ${names.cloudTest}\nnode --test ${names.cloudTest}\n\`\`\`\n\n`
    + `정상 결과는 tests 5, pass 5, fail 0입니다.\n\n`
    + `## 2. GCS 불변 자산 업로드\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\ncurl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\ncurl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n\`\`\`\n\n`
    + `## 3. ERP HTML 교체\n\n`
    + `${names.deploy} 전체 내용으로 메인페이지 HTML을 교체합니다.\n\n`
    + `## 4. 운영 확인\n\n`
    + `1. 마감임박 59/60명 일정이 ‘이미 59명 참여, 마지막 한 자리만 남았어요.’로 표시되는지 확인합니다.\n`
    + `2. 마지막 1자리와 추천일정 배지의 높이·배경·테두리가 동일한지 확인합니다.\n`
    + `3. 마감임박 카드에서 해외 배지가 보이지 않는지 확인합니다.\n`
    + `4. PC와 모바일에서 카드 클릭 후 상품상세가 정상적으로 열리는지 확인합니다.\n\n`
    + `## 5. 복구\n\n`
    + `문제가 있으면 ${names.rollback} 전체 내용으로 ERP HTML을 되돌립니다. GCS 객체는 삭제하지 않습니다.\n\n`
    + `- 배포 HTML SHA-256: ${hashes.deploy}\n- CSS 업로드 SHA-256: ${hashes.css}\n- JS 업로드 SHA-256: ${hashes.js}\n`;
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(BASELINE, "manifest.json"), "utf8"));
  const rollback = readVerified(BASELINE, manifest.names.deploy, manifest.hashes.deploy, "baseline_html");
  const oldCssGzip = readVerified(BASELINE, manifest.names.css, manifest.hashes.css, "baseline_css");
  const oldJsBrotli = readVerified(BASELINE, manifest.names.js, manifest.hashes.js, "baseline_js");
  const oldCss = zlib.gunzipSync(oldCssGzip).toString("utf8");
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");

  const assembledHtml = assembleFromSource();
  const parts = splitMainHtml(assembledHtml);
  const sourceCss = parts[1].toString("utf8");
  const sourceJs = parts[3].toString("utf8");
  const handlerNames = collectInlineHandlerNames(assembledHtml.toString("utf8"), sourceJs);
  const minifiedSourceJs = (await minifyJavaScript(sourceJs, { handlerNames })).toString("utf8");
  const newRenderCopy = getNamedFunctionSource(minifiedSourceJs, "renderJoinParticipantCopy");
  const oldRenderCopy = getNamedFunctionSource(oldJs, "renderJoinParticipantCopy");
  const nextJs = replaceExact(oldJs, oldRenderCopy, newRenderCopy, "participant_copy");
  const cssPatch = getMarkedCss(sourceCss);
  if (oldCss.includes(CSS_MARKER_START)) throw new Error("css_patch_already_present");
  const nextCss = `${oldCss.trimEnd()}\n\n${cssPatch}\n`;
  new vm.Script(nextJs, { filename: "golfjoin-main-v66b.js" });

  const css = Buffer.from(nextCss, "utf8");
  const js = Buffer.from(nextJs, "utf8");
  const cssGzip = zlib.gzipSync(css, { level: 9 });
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.gunzipSync(cssGzip).equals(css)) throw new Error("css_gzip_roundtrip_failed");
  if (!zlib.brotliDecompressSync(jsBrotli).equals(js)) throw new Error("js_brotli_roundtrip_failed");

  const revision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--golfjoin-quick-participant-copy-badges-v1--\n")
  ])).slice(0, 24)}`;
  const cssSri = sri(css);
  const jsSri = sri(js);
  let deployText = rollback.toString("utf8").split(manifest.assetRevision).join(revision);
  deployText = replaceAllRequired(deployText, manifest.hashes.cssSri, cssSri, "html_css_sri");
  deployText = replaceExact(deployText, manifest.hashes.jsSri, jsSri, "html_js_sri");
  verifyInlineScripts(deployText);
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
    deploy: `DEPLOY_golfjoin_main_quick_participant_copy_${hashes.deploy.slice(0, 8).toUpperCase()}.html`,
    rollback: `ROLLBACK_golfjoin_main_${hashes.rollback.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    cloudTest: "stage66b-quick-participant-copy-cloudshell.test.js",
    packageTest: "stage66b-quick-participant-copy-package.test.js"
  };
  const cloudTest = Buffer.from(makeCloudShellTest(names, hashes, newRenderCopy), "utf8");
  const packageTest = Buffer.from(makePackageTest(names, hashes, revision), "utf8");
  const runbook = Buffer.from(makeRunbook(names, hashes, revision), "utf8");
  const outputManifest = {
    schema: "golfjoin-quick-participant-copy-badges-v1",
    version: "v66b",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    assetRevision: revision,
    supersedes: "v66a",
    behavior: {
      participantCopyUsesAuthoritativeCount: true,
      remainingSeatCopyIsDynamic: true,
      overseasCategoryHiddenInQuickSection: true,
      urgencyBadgeMatchesRecommendationBadge: true,
      includesAirpackThumbnailFix: true
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
