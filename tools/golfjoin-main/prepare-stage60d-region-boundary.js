"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const vm = require("node:vm");
const { minify } = require("terser");
const ROOT = path.resolve(__dirname, "../..");
const BASE = path.join(ROOT, "deploy/stage60c-admin-recommendation-card/admin-recommendation-card-20260907-v60c10");
const OUTPUT = path.join(ROOT, "deploy/stage60d-region-panel-boundary/region-panel-boundary-20260907-v60d");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const sri = value => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;

function segment(text, start, end, includeEnd = false) {
  const a = text.indexOf(start), b = text.indexOf(end, a);
  if (a < 0 || b <= a) throw new Error(`Missing segment: ${start}`);
  return text.slice(a, b + (includeEnd ? end.length : 0));
}
function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`Expected one match: ${from.slice(0, 100)}`);
  return text.replace(from, () => to);
}

async function build() {
  const base = JSON.parse(fs.readFileSync(path.join(BASE, "manifest.json")));
  const old = Object.fromEntries(["deployHtml", "css", "js"].map(k => [k, fs.readFileSync(path.join(BASE, base.names[k]))]));
  for (const [key, bytes] of Object.entries(old)) {
    if (hash(bytes) !== base.files[key].sha256) throw new Error(`Baseline hash mismatch: ${key}`);
  }
  const source = name => fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source", name), "utf8");
  const cssPatch = Buffer.from(`\n${segment(source("styles/10-main.css"), "/* v60d:", "/* end v60d region boundary */").trim()}\n`);
  const oldCss = zlib.gunzipSync(old.css);
  const css = Buffer.concat([oldCss, cssPatch]);
  const oldJs = zlib.brotliDecompressSync(old.js).toString();
  const startFn = "function setRegionSearchPanelMode(", nextFn = "function toggleRegionSearchPanel(";
  const oldFunction = segment(oldJs, startFn, nextFn);
  const newFunction = (await minify(segment(source("scripts/detail/37-detail-builder-calendar.js"), startFn, nextFn), { compress: false, mangle: false, format: { comments: false } })).code;
  const js = Buffer.from(replaceOnce(oldJs, oldFunction, newFunction));
  new vm.Script(js.toString());
  const oldHtml = old.deployHtml.toString();
  const buttonStart = '<button type="button" class="region-search-all-button"';
  const markupReplacements = [
    { from: segment(oldHtml, buttonStart, "</button>", true), to: segment(source("markup/20-main.html"), buttonStart, "</button>", true) },
    { from: '<div class="region-desktop-title">주요도시</div>', to: '<div class="region-desktop-title">지역 선택</div>' }
  ];
  let html = oldHtml;
  for (const { from, to } of markupReplacements) html = replaceOnce(html, from, to);
  const revision = `gha_${hash(Buffer.concat([css, Buffer.from("\n--v60d--\n"), js])).slice(0, 24)}`;
  const assets = { cssObjectName: `web/home-assets/${revision}/golfjoin-main.css`, jsObjectName: `web/home-assets/${revision}/golfjoin-main.js` };
  const assetReplacements = [];
  for (const [kind, bytes] of Object.entries({ css, js })) {
    const from = `https://storage.googleapis.com/golfjoin-bucket/${base.files[kind].objectName}" integrity="${base.files[kind].logicalSri}`;
    const to = `https://storage.googleapis.com/golfjoin-bucket/${assets[`${kind}ObjectName`]}" integrity="${sri(bytes)}`;
    if (html.split(from).length - 1 !== (kind === "css" ? 2 : 1)) throw new Error(`Asset reference count: ${kind}`);
    html = html.split(from).join(to);
    assetReplacements.push({ from, to });
  }
  const buffers = { deployHtml: Buffer.from(html), rollbackHtml: old.deployHtml, css: zlib.gzipSync(css, { level: 9 }), js: zlib.brotliCompressSync(js, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }) };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_region_boundary_${hash(buffers.deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${hash(old.deployHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hash(buffers.css).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hash(buffers.js).slice(0, 8).toUpperCase()}.js.br`,
    cloudShellTest: "stage60d-region-boundary-cloudshell.test.js", packageTest: "stage60d-region-boundary.test.js"
  };
  const checks = { names, hashes: Object.fromEntries(Object.entries(buffers).map(([k, b]) => [k, hash(b)])), oldCssBytes: oldCss.length, oldCssHash: hash(oldCss), cssPatchHash: hash(cssPatch), oldJsHash: hash(oldJs), oldFunction, newFunction };
  const testSource = `"use strict";
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib"),crypto=require("node:crypto"),vm=require("node:vm"),assert=require("node:assert/strict"),test=require("node:test");
const expected=${JSON.stringify(checks)};
const read=k=>fs.readFileSync(path.join(__dirname,expected.names[k]));
const hash=v=>crypto.createHash("sha256").update(v).digest("hex");
const css=zlib.gunzipSync(read("css")),js=zlib.brotliDecompressSync(read("js")).toString();
test("v60d 압축파일 무결성 및 실행 문법",()=>{for(const k of ["css","js"])assert.equal(hash(read(k)),expected.hashes[k]);new vm.Script(js);});
test("v60c10 CSS 전체 보존 및 승인 패널 스타일 추가",()=>{assert.equal(hash(css.subarray(0,expected.oldCssBytes)),expected.oldCssHash);assert.equal(hash(css.subarray(expected.oldCssBytes)),expected.cssPatchHash);});
test("패널 상태 동기화 외 JavaScript 전체 보존",()=>{assert.equal(js.split(expected.newFunction).length,2);assert.equal(hash(js.replace(expected.newFunction,()=>expected.oldFunction)),expected.oldJsHash);});
test("지역 전체 펼침 상태와 스크롤 초기화",()=>{
 const state={classes:new Set(),scrollTop:100,expanded:null};
 const shell={classList:{remove:(...items)=>items.forEach(x=>state.classes.delete(x)),add:x=>state.classes.add(x)},set scrollTop(v){state.scrollTop=v;}};
 const button={setAttribute:(name,value)=>{assert.equal(name,"aria-expanded");state.expanded=value;}};
 const context=vm.createContext({document:{querySelector:s=>s.endsWith(".region-search-shell")?shell:button,querySelectorAll:()=>[]}});
 vm.runInContext(expected.newFunction,context);
 vm.runInContext('setRegionSearchPanelMode("cities")',context);assert.equal(state.expanded,"true");assert.equal(state.scrollTop,0);assert.ok(state.classes.has("region-panel-cities"));
 vm.runInContext('setRegionSearchPanelMode("")',context);assert.equal(state.expanded,"false");assert.ok(!state.classes.has("region-panel-cities"));
});
`;
  buffers.cloudShellTest = Buffer.from(testSource);
  buffers.packageTest = Buffer.from(`${testSource}
test("허용한 HTML 변경 외 배포 문서와 롤백 보존",()=>{
 for(const k of ["deployHtml","rollbackHtml"])assert.equal(hash(read(k)),expected.hashes[k]);
 let restored=read("deployHtml").toString();
 for(const {from,to} of ${JSON.stringify([...markupReplacements, ...assetReplacements])})restored=restored.split(to).join(from);
 assert.equal(hash(restored),expected.hashes.rollbackHtml);
});
`);
  for (const k of ["cloudShellTest", "packageTest"]) new vm.Script(buffers[k].toString());
  const files = Object.fromEntries(Object.entries(buffers).map(([key, bytes]) => [key, { fileName: names[key], bytes: bytes.length, sha256: hash(bytes), ...(["css", "js"].includes(key) ? { contentEncoding: key === "css" ? "gzip" : "br", objectName: assets[`${key}ObjectName`], logicalSri: sri(key === "css" ? css : js) } : {}) }]));
  const manifest = { schema: "golfjoin-region-boundary-v1", version: "v60d", status: "ready-for-validation", preparedAt: new Date().toISOString(), productionBaseline: "v60c10", assetRevision: revision, assets, names, files, serverDeploymentRequired: false };
  const runbook = `# v60d PC 여행지 검색 지역 선택 패널 경계 수정

기준: v60c10. 앞선 모집 카드 수정은 모두 포함합니다. 서버/API 재배포는 필요하지 않습니다.

- PC 검색 결과에서 지역 전체를 펼치면 패널 하단 테두리와 둥근 모서리가 잘리지 않습니다.
- 지역 선택 패널과 결과 사이 24px, 결과 정렬줄과 카드 사이 12px 간격입니다.
- 패널과 결과를 하나의 스크롤로 탐색합니다. 긴 도시 목록도 잘리지 않습니다.
- 제목을 지역 선택으로 바꾸고, 지역 전체 버튼에 펼침/접힘 화살표와 접근성 상태를 표시합니다.
- 641~800px의 좁은 PC 창에서만 국가 목록을 한 열로, 상품 요금/모집 영역을 다음 행으로 배치해 겹침을 방지합니다.
- 상품 정보·참여·예약 로직은 보존합니다. 모바일은 기존 레이아웃과 버튼 모양을 유지합니다.

## 1. Cloud Shell 업로드

아래 세 파일을 /home/llno95ll/google-sheet-proxy-function 폴더에 업로드합니다.

- ${names.css}
- ${names.js}
- ${names.cloudShellTest}

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function
node --test ${names.cloudShellTest}
\`\`\`

## 2. 검증 통과 후 새 GCS 자산 업로드

\`\`\`bash
gcloud storage cp ${names.css} gs://golfjoin-bucket/${assets.cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"
gcloud storage cp ${names.js} gs://golfjoin-bucket/${assets.jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"
curl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/${assets.cssObjectName}
curl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${assets.jsObjectName}
\`\`\`

HTTP 200, Content-Type과 Content-Encoding을 확인합니다. 412 오류는 같은 객체가 이미 존재한다는 의미입니다. 기존 객체를 덮어쓰지 말고 확인하세요.

## 3. ERP HTML 교체

eventPlanSeq=3의 HTML 전체를 ${names.deployHtml} 내용으로 교체합니다.
PC에서 여행지 검색 → 나트랑 검색/선택 → 지역 전체 → 패널 경계 및 간격 → 베트남/다른 도시 선택 → 결과 → 상품상세를 확인합니다.
창 높이가 낮을 때도 패널과 결과를 같은 스크롤로 끝까지 볼 수 있는지, 지역 전체 재클릭 시 접히는지 확인합니다.
모바일 지역 선택, 메인/검색/캘린더 추천 카드가 이전처럼 표시되는지도 확인합니다.

## 복구

${names.rollbackHtml} 전체 내용으로 되돌리면 v60c10으로 복구됩니다. 기존 GCS 자산은 삭제하지 않습니다.
`;
  return { buffers, names, manifest, runbook, markupReplacements };
}

if (require.main === module) {
  (async () => {
    if (fs.existsSync(OUTPUT)) throw new Error(`Output already exists: ${OUTPUT}`);
    const result = await build();
    fs.mkdirSync(OUTPUT, { recursive: true });
    for (const [key, bytes] of Object.entries(result.buffers)) fs.writeFileSync(path.join(OUTPUT, result.names[key]), bytes, { flag: "wx" });
    fs.writeFileSync(path.join(OUTPUT, "manifest.json"), JSON.stringify(result.manifest, null, 2) + "\n", { flag: "wx" });
    fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), result.runbook, { flag: "wx" });
    console.log(JSON.stringify({ output: OUTPUT, revision: result.manifest.assetRevision, names: result.names }, null, 2));
  })().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { build, OUTPUT };
