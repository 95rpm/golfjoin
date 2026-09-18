"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "../..");
const VERSION = "v60c10";
const BASE_VERSION = "v60c9";
const BASE = path.join(ROOT, "deploy/stage60c-admin-recommendation-card/admin-recommendation-card-20260907-v60c9");
const OUTPUT = path.join(ROOT, "deploy/stage60c-admin-recommendation-card/admin-recommendation-card-20260907-v60c10");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const sri = value => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;

function build() {
  const read = name => fs.readFileSync(path.join(BASE, name));
  const base = JSON.parse(read("manifest.json"));
  const old = Object.fromEntries(["deployHtml", "css", "js"].map(key => [key, read(base.names[key])]));
  for (const [key, bytes] of Object.entries(old)) {
    if (hash(bytes) !== base.files[key].sha256) throw new Error(`Baseline hash mismatch: ${key}`);
  }
  const source = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css"), "utf8");
  const start = source.indexOf("/* v60c10:");
  const end = source.indexOf("/* end v60c10 recruitment layout */");
  if (start < 0 || end <= start) throw new Error("Recruitment row CSS patch missing");
  const oldCss = zlib.gunzipSync(old.css);
  const cssPatch = Buffer.from(`\n${source.slice(start, end).trim()}\n`);
  const css = Buffer.concat([oldCss, cssPatch]);
  const js = zlib.brotliDecompressSync(old.js);
  new vm.Script(js.toString());
  const revision = `gha_${hash(Buffer.concat([css, Buffer.from(`\n--${VERSION}--\n`), js])).slice(0, 24)}`;
  const assets = {
    cssObjectName: `web/home-assets/${revision}/golfjoin-main.css`,
    jsObjectName: `web/home-assets/${revision}/golfjoin-main.js`
  };
  let html = old.deployHtml.toString();
  for (const [kind, bytes] of Object.entries({ css, js })) {
    const from = `https://storage.googleapis.com/golfjoin-bucket/${base.files[kind].objectName}" integrity="${base.files[kind].logicalSri}`;
    const to = `https://storage.googleapis.com/golfjoin-bucket/${assets[`${kind}ObjectName`]}" integrity="${sri(bytes)}`;
    if (html.split(from).length - 1 !== (kind === "css" ? 2 : 1)) throw new Error(`Asset reference count mismatch: ${kind}`);
    html = html.split(from).join(to);
  }
  // This release changes only CSS. Preserve the verified v60c9 JavaScript bytes.
  const buffers = { deployHtml: Buffer.from(html), rollbackHtml: old.deployHtml, css: zlib.gzipSync(css, { level: 9 }), js: old.js };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_recruitment_row_${hash(buffers.deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${hash(old.deployHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hash(buffers.css).slice(0, 8).toUpperCase()}.css.gz`,
    js: base.names.js,
    cloudShellTest: "stage60c10-recruitment-row-cloudshell.test.js",
    packageTest: "stage60c10-recruitment-row.test.js"
  };
  const expected = {
    names, assets, hashes: Object.fromEntries(Object.entries(buffers).map(([k, v]) => [k, hash(v)])),
    logicalSri: { css: sri(css), js: sri(js) },
    oldCssBytes: oldCss.length, oldCssHash: hash(oldCss), cssPatchHash: hash(cssPatch), oldJsHash: hash(old.js)
  };
  const testSource = `"use strict";
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib"),crypto=require("node:crypto"),vm=require("node:vm"),assert=require("node:assert/strict"),test=require("node:test");
const expected=${JSON.stringify(expected)};
const read=k=>fs.readFileSync(path.join(__dirname,expected.names[k]));
const hash=v=>crypto.createHash("sha256").update(v).digest("hex");
const css=zlib.gunzipSync(read("css")),js=zlib.brotliDecompressSync(read("js"));
test("${VERSION} 업로드 파일 무결성 및 JS 실행 문법",()=>{for(const k of ["css","js"])assert.equal(hash(read(k)),expected.hashes[k]);new vm.Script(js.toString());});
test("${BASE_VERSION} CSS 전체 보존 및 모집 행 스타일 추가",()=>{assert.equal(hash(css.subarray(0,expected.oldCssBytes)),expected.oldCssHash);assert.equal(hash(css.subarray(expected.oldCssBytes)),expected.cssPatchHash);});
test("${BASE_VERSION} JavaScript 압축 파일과 완전히 동일",()=>assert.equal(hash(read("js")),expected.oldJsHash));
test("모집 행 스타일은 검색/캘린더로 한정",()=>{const patch=css.subarray(expected.oldCssBytes).toString();assert.ok(patch.includes(".region-product-team.admin-recommended-empty .recommended-recruitment-summary"));assert.ok(patch.includes("align-items: center"));assert.ok(patch.includes("justify-content: space-between"));assert.ok(!patch.includes(".team-row"));assert.ok(!patch.includes(".join-card"));});
`;
  buffers.cloudShellTest = Buffer.from(testSource);
  buffers.packageTest = Buffer.from(`${testSource}
test("HTML 자산 참조와 ${BASE_VERSION} 복구본 무결성",()=>{
 for(const k of ["deployHtml","rollbackHtml"])assert.equal(hash(read(k)),expected.hashes[k]);
 const html=read("deployHtml").toString();
 for(const k of ["css","js"]){const ref='https://storage.googleapis.com/golfjoin-bucket/'+expected.assets[k+"ObjectName"]+'" integrity="'+expected.logicalSri[k];assert.equal(html.split(ref).length-1,k==="css"?2:1);}
});
`);
  for (const key of ["cloudShellTest", "packageTest"]) new vm.Script(buffers[key].toString());
  const files = Object.fromEntries(Object.entries(buffers).map(([key, bytes]) => [key, {
    fileName: names[key], bytes: bytes.length, sha256: hash(bytes),
    ...(["css", "js"].includes(key) ? { contentEncoding: key === "css" ? "gzip" : "br", objectName: assets[`${key}ObjectName`], logicalSri: sri(key === "css" ? css : js) } : {})
  }]));
  const manifest = { schema: "golfjoin-recruitment-row-v1", version: VERSION, status: "ready-for-validation", preparedAt: new Date().toISOString(), productionBaseline: BASE_VERSION, assetRevision: revision, assets, names, files, serverDeploymentRequired: false };
  const runbook = `# ${VERSION} 검색·참여가능한 모임 모집 행 정렬

기준: ${BASE_VERSION}. 참여자 없는 관리자 추천일정 카드만 수정합니다.

- 첫 참여 혜택은 왼쪽, 멤버 모집 중 NEW는 오른쪽. 같은 행에서 세로 중앙 정렬합니다.
- 모바일은 카드 내부 여백과 구분선 아래·혜택 행 아래 여백을 15px로 통일합니다. 기존 위로 이동(transform)을 제거합니다.
- 389px 이하 좁은 화면은 해당 행의 글자 크기만 소폭 줄여 겹침을 방지합니다.
- 메인페이지 상품카드, 월례회, 참여자가 있는 카드와 JavaScript는 변경하지 않습니다.

## 1. Cloud Shell에 업로드할 파일

- ${names.css}
- ${names.js} (v60c9와 같은 파일이지만 새 자산 경로에도 업로드해야 합니다.)
- ${names.cloudShellTest}

세 파일을 아래 작업 폴더에 업로드한 후 검증합니다.

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function
node --test ${names.cloudShellTest}
\`\`\`

## 2. 검증 성공 후 GCS 업로드

기존 파일을 덮어쓰지 않는 새 버전 경로입니다. 412 오류는 이미 해당 객체가 존재한다는 의미이므로 덮어쓰지 말고 확인합니다.

\`\`\`bash
gcloud storage cp ${names.css} gs://golfjoin-bucket/${assets.cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"
gcloud storage cp ${names.js} gs://golfjoin-bucket/${assets.jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"
curl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/${assets.cssObjectName}
curl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${assets.jsObjectName}
\`\`\`

두 응답의 HTTP 200과 Content-Type/Content-Encoding을 확인한 뒤 ERP를 수정합니다.

## 3. ERP HTML 반영

eventPlanSeq=3의 기존 HTML 전체를 ${names.deployHtml} 내용으로 교체합니다.
모바일·PC에서 여행지 검색 → 청도 검색 → 모집 카드 정렬 → 카드 클릭 시 상세 열기를 확인합니다.
참여가능한 모임 캘린더에서도 추천일정 카드의 정렬을 확인합니다. 메인카드는 기존 2줄/왼쪽 정렬을 유지해야 합니다.

## 복구

${names.rollbackHtml} 전체 내용으로 교체하면 ${BASE_VERSION}로 복구됩니다. 기존 GCS 자산은 삭제하지 않습니다.
`;
  return { buffers, names, manifest, runbook };
}

if (require.main === module) {
  try {
    if (fs.existsSync(OUTPUT)) throw new Error(`Output already exists: ${OUTPUT}`);
    const result = build();
    fs.mkdirSync(OUTPUT, { recursive: true });
    for (const [key, bytes] of Object.entries(result.buffers)) fs.writeFileSync(path.join(OUTPUT, result.names[key]), bytes, { flag: "wx" });
    fs.writeFileSync(path.join(OUTPUT, "manifest.json"), JSON.stringify(result.manifest, null, 2) + "\n", { flag: "wx" });
    fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), result.runbook, { flag: "wx" });
    console.log(JSON.stringify({ output: OUTPUT, assetRevision: result.manifest.assetRevision, names: result.names }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build, OUTPUT };
