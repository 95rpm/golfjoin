"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "../..");
const VERSION = "v60c9";
const BASE_VERSION = "v60c8";
const BASE = path.join(ROOT, "deploy/stage60c-admin-recommendation-card/admin-recommendation-card-20260904-v60c8");
const OUTPUT = path.join(ROOT, "deploy/stage60c-admin-recommendation-card/admin-recommendation-card-20260907-v60c9");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const sri = value => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;
const read = name => fs.readFileSync(path.join(BASE, name));
const baseManifest = JSON.parse(read("manifest.json"));

function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`Expected one match: ${from.slice(0, 90)}`);
  return text.replace(from, () => to);
}

function build() {
  const oldHtml = read(baseManifest.names.deployHtml);
  const oldCssGz = read(baseManifest.names.css);
  const oldJsBr = read(baseManifest.names.js);
  for (const [key, bytes] of Object.entries({ deployHtml: oldHtml, css: oldCssGz, js: oldJsBr })) {
    if (hash(bytes) !== baseManifest.files[key].sha256) throw new Error(`Baseline hash mismatch: ${key}`);
  }
  const cssSource = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css"), "utf8");
  const start = cssSource.indexOf("/* v60c9:");
  const end = cssSource.indexOf("/* end v60c9 recruitment layout */");
  if (start < 0 || end <= start) throw new Error("Mobile recruitment CSS patch missing");
  const cssPatch = cssSource.slice(start, end).trim();
  const oldCss = zlib.gunzipSync(oldCssGz);
  const css = Buffer.concat([oldCss, Buffer.from(`\n${cssPatch}\n`)]);
  const oldJs = zlib.brotliDecompressSync(oldJsBr).toString("utf8");
  const fnStart = oldJs.indexOf("function renderRegionProductCard(e,t={})");
  const fnEnd = oldJs.indexOf("function sortRegionProductResults", fnStart);
  if (fnStart < 0 || fnEnd <= fnStart) throw new Error("Region card function missing");
  const oldFunction = oldJs.slice(fnStart, fnEnd);
  // v60c3 renamed o to a boolean but left the article click bound to o.
  // r is the existing escaped openDetail/custom action in this exact baseline.
  if (!oldFunction.includes('r=t.onClick||`openDetail(')) throw new Error("Region card action binding mismatch");
  const fixedFunction = replaceOnce(oldFunction, 'class="region-product-card" onclick="${o}"', 'class="region-product-card" onclick="${r}"');
  const js = Buffer.from(oldJs.slice(0, fnStart) + fixedFunction + oldJs.slice(fnEnd));
  new vm.Script(js.toString("utf8"));
  const revision = `gha_${hash(Buffer.concat([css, Buffer.from(`\n--${VERSION}--\n`), js])).slice(0, 24)}`;
  const assets = {
    cssObjectName: `web/home-assets/${revision}/golfjoin-main.css`,
    jsObjectName: `web/home-assets/${revision}/golfjoin-main.js`
  };
  let html = oldHtml.toString("utf8");
  for (const [kind, bytes] of Object.entries({ css, js })) {
    const oldFile = baseManifest.files[kind];
    const from = `https://storage.googleapis.com/golfjoin-bucket/${oldFile.objectName}" integrity="${oldFile.logicalSri}`;
    const to = `https://storage.googleapis.com/golfjoin-bucket/${assets[`${kind}ObjectName`]}" integrity="${sri(bytes)}`;
    const expected = kind === "css" ? 2 : 1; // stylesheet + noscript stylesheet
    if (html.split(from).length - 1 !== expected) throw new Error(`Asset reference count: ${kind}`);
    html = html.split(from).join(to);
  }
  const buffers = {
    deployHtml: Buffer.from(html), rollbackHtml: oldHtml,
    css: zlib.gzipSync(css, { level: 9 }),
    js: zlib.brotliCompressSync(js, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } })
  };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_mobile_recruitment_${hash(buffers.deployHtml).slice(0,8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${hash(oldHtml).slice(0,8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hash(buffers.css).slice(0,8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hash(buffers.js).slice(0,8).toUpperCase()}.js.br`,
    cloudShellTest: "stage60c9-mobile-recruitment-cloudshell.test.js",
    packageTest: "stage60c9-mobile-recruitment.test.js"
  };
  const checks = {
    version: VERSION, names,
    hashes: Object.fromEntries(Object.entries(buffers).map(([k,v])=>[k,hash(v)])),
    logicalSri: { css: sri(css), js: sri(js) },
    oldCssBytes: oldCss.length, oldCssHash: hash(oldCss), oldJsHash: hash(oldJs),
    revision, assets
  };
  const testSource = `"use strict";
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib"),crypto=require("node:crypto"),vm=require("node:vm"),assert=require("node:assert/strict"),test=require("node:test");
const expected=${JSON.stringify(checks)};
const read=k=>fs.readFileSync(path.join(__dirname,expected.names[k]));
const hash=v=>crypto.createHash("sha256").update(v).digest("hex");
const css=zlib.gunzipSync(read("css")),js=zlib.brotliDecompressSync(read("js"));
test("v60c9 압축 파일 무결성과 실행 문법",()=>{for(const k of ["css","js"])assert.equal(hash(read(k)),expected.hashes[k]);new vm.Script(js.toString());});
test("CSS는 v60c8 전체를 보존하고 모바일 충돌 수정만 추가",()=>{assert.equal(hash(css.subarray(0,expected.oldCssBytes)),expected.oldCssHash);});
test("검색 카드 클릭 수정 외 JavaScript 동일",()=>{const text=js.toString();const a=text.indexOf("function renderRegionProductCard(e,t={})"),b=text.indexOf("function sortRegionProductResults",a);const fn=text.slice(a,b);assert.ok(fn.includes('class="region-product-card" onclick="\u0024{r}"'));const restored=fn.replace('class="region-product-card" onclick="\u0024{r}"','class="region-product-card" onclick="\u0024{o}"');assert.equal(hash(text.slice(0,a)+restored+text.slice(b)),expected.oldJsHash);});
`;
  buffers.cloudShellTest = Buffer.from(testSource);
  buffers.packageTest = Buffer.from(`${testSource}
test("배포 HTML의 CSS·JS 무결성 참조와 v60c8 롤백",()=>{
 for(const k of ["deployHtml","rollbackHtml"])assert.equal(hash(read(k)),expected.hashes[k]);
 const html=read("deployHtml").toString();
 for(const k of ["css","js"]){const ref='https://storage.googleapis.com/golfjoin-bucket/'+expected.assets[k+"ObjectName"]+'" integrity="'+expected.logicalSri[k];assert.equal(html.split(ref).length-1,k==="css"?2:1);}
});
`);
  for (const key of ["cloudShellTest", "packageTest"]) new vm.Script(buffers[key].toString());
  const files = Object.fromEntries(Object.entries(buffers).map(([k,b])=>[k,{fileName:names[k],bytes:b.length,sha256:hash(b),...(["css","js"].includes(k)?{contentEncoding:k==="css"?"gzip":"br",objectName:assets[`${k}ObjectName`],logicalSri:sri(k==="css"?css:js)}:{})}]));
  const manifest = { schema:"golfjoin-mobile-recruitment-v1",version:VERSION,status:"ready-for-validation",preparedAt:new Date().toISOString(),productionBaseline:BASE_VERSION,assetRevision:revision,assets,names,files,serverDeploymentRequired:false };
  const runbook = `# ${VERSION} 모바일 모집·혜택 UI 수정

기준: ${BASE_VERSION}. 모바일 ERP 게시판의 span 공통 스타일 충돌을 해결합니다. 메인은 왼쪽, 여행지 검색·캘린더는 오른쪽 정렬합니다. 모바일 혜택 박스 좌우 여백은 8px, 아이콘·문구 간격은 4px, 문구·증정 배지 간격은 6px입니다. 검색·캘린더 카드의 상세 열기 클릭 연결도 복구합니다.

## 1. Cloud Shell 업로드

- ${names.css}
- ${names.js}
- ${names.cloudShellTest}

아래 명령은 세 파일을 같은 폴더에 업로드한 후 실행합니다. 검증 성공 후 GCS 업로드, 원격 확인 후 ERP 순서입니다.

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function
node --test ${names.cloudShellTest}
\`\`\`

## 2. 새 GCS 자산 업로드

\`\`\`bash
gcloud storage cp ${names.css} gs://golfjoin-bucket/${assets.cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"
gcloud storage cp ${names.js} gs://golfjoin-bucket/${assets.jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"
curl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/${assets.cssObjectName}
curl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${assets.jsObjectName}
\`\`\`

## 3. ERP 교체

eventPlanSeq=3의 HTML 전체를 ${names.deployHtml} 내용으로 교체합니다. PC·모바일의 메인 카드, 여행지 검색, 캘린더에서 배지 폭·한 줄 배치·정렬과 카드 클릭 시 상세 열기를 확인합니다.

## 복구

${names.rollbackHtml} 전체 내용으로 교체하면 ${BASE_VERSION}로 복구됩니다. 기존 GCS 자산을 보존합니다.
`;
  return {buffers,names,manifest,runbook};
}

if (require.main === module) {
  try {
    if (fs.existsSync(OUTPUT)) throw new Error(`Output already exists: ${OUTPUT}`);
    const result=build();
    fs.mkdirSync(OUTPUT,{recursive:true});
    for(const [key,bytes] of Object.entries(result.buffers))fs.writeFileSync(path.join(OUTPUT,result.names[key]),bytes,{flag:"wx"});
    fs.writeFileSync(path.join(OUTPUT,"manifest.json"),JSON.stringify(result.manifest,null,2)+"\n",{flag:"wx"});
    fs.writeFileSync(path.join(OUTPUT,"RUNBOOK.md"),result.runbook,{flag:"wx"});
    console.log(JSON.stringify({output:OUTPUT,assetRevision:result.manifest.assetRevision,names:result.names},null,2));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={build,OUTPUT};
