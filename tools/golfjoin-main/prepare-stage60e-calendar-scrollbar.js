"use strict";

const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), zlib = require("node:zlib"), vm = require("node:vm");
const ROOT = path.resolve(__dirname, "../..");
const BASE = path.join(ROOT, "deploy/stage60d-region-panel-boundary/region-panel-boundary-20260907-v60d");
const OUTPUT = path.join(ROOT, "deploy/stage60e-calendar-scrollbar/calendar-scrollbar-20260907-v60e");
const hash = b => crypto.createHash("sha256").update(b).digest("hex");
const sri = b => `sha256-${crypto.createHash("sha256").update(b).digest("base64")}`;

function build() {
  const base = JSON.parse(fs.readFileSync(path.join(BASE, "manifest.json")));
  const old = Object.fromEntries(["deployHtml", "css", "js"].map(k => [k, fs.readFileSync(path.join(BASE, base.names[k]))]));
  for (const [k, b] of Object.entries(old)) if (hash(b) !== base.files[k].sha256) throw new Error(`Baseline hash mismatch: ${k}`);
  const source = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css"), "utf8");
  const a = source.indexOf("/* v60e:"), b = source.indexOf("/* end v60e calendar scrollbar */");
  if (a < 0 || b <= a) throw new Error("Calendar scrollbar CSS missing");
  const oldCss = zlib.gunzipSync(old.css), patch = Buffer.from(`\n${source.slice(a, b).trim()}\n`);
  const css = Buffer.concat([oldCss, patch]), js = zlib.brotliDecompressSync(old.js);
  new vm.Script(js.toString());
  const revision = `gha_${hash(Buffer.concat([css, Buffer.from("\n--v60e--\n"), js])).slice(0, 24)}`;
  const assets = { cssObjectName: `web/home-assets/${revision}/golfjoin-main.css`, jsObjectName: `web/home-assets/${revision}/golfjoin-main.js` };
  let html = old.deployHtml.toString();
  const replacements = [];
  for (const [kind, bytes] of Object.entries({ css, js })) {
    const from = `https://storage.googleapis.com/golfjoin-bucket/${base.files[kind].objectName}" integrity="${base.files[kind].logicalSri}`;
    const to = `https://storage.googleapis.com/golfjoin-bucket/${assets[`${kind}ObjectName`]}" integrity="${sri(bytes)}`;
    if (html.split(from).length - 1 !== (kind === "css" ? 2 : 1)) throw new Error(`Asset count mismatch: ${kind}`);
    html = html.split(from).join(to); replacements.push({ from, to });
  }
  const buffers = { deployHtml: Buffer.from(html), rollbackHtml: old.deployHtml, css: zlib.gzipSync(css, { level: 9 }), js: old.js };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_calendar_scrollbar_${hash(buffers.deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${hash(old.deployHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hash(buffers.css).slice(0, 8).toUpperCase()}.css.gz`, js: base.names.js,
    cloudShellTest: "stage60e-calendar-scrollbar-cloudshell.test.js", packageTest: "stage60e-calendar-scrollbar.test.js"
  };
  const expected = { names, hashes: Object.fromEntries(Object.entries(buffers).map(([k, v]) => [k, hash(v)])), oldCssBytes: oldCss.length, oldCssHash: hash(oldCss), patchHash: hash(patch), oldJsHash: hash(old.js) };
  const testSource = `"use strict";
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib"),crypto=require("node:crypto"),vm=require("node:vm"),assert=require("node:assert/strict"),test=require("node:test");
const expected=${JSON.stringify(expected)};
const read=k=>fs.readFileSync(path.join(__dirname,expected.names[k]));
const hash=v=>crypto.createHash("sha256").update(v).digest("hex");
const css=zlib.gunzipSync(read("css")),js=zlib.brotliDecompressSync(read("js"));
test("v60e 압축 파일 무결성과 JS 문법",()=>{for(const k of ["css","js"])assert.equal(hash(read(k)),expected.hashes[k]);new vm.Script(js.toString());});
test("v60d CSS 전체 보존 및 스크롤 위치 수정만 추가",()=>{assert.equal(hash(css.subarray(0,expected.oldCssBytes)),expected.oldCssHash);assert.equal(hash(css.subarray(expected.oldCssBytes)),expected.patchHash);});
test("v60d JavaScript 압축 파일과 완전히 동일",()=>assert.equal(hash(read("js")),expected.oldJsHash));
test("PC 캘린더 범위 및 카드 안쪽 여백 보존",()=>{const patch=css.subarray(expected.oldCssBytes).toString();assert.ok(patch.includes("@media (min-width: 641px)"));assert.ok(patch.includes("#calendarSheet"));assert.ok(patch.includes("margin-right: -20px"));assert.ok(patch.includes("padding-right: 20px"));assert.ok(patch.includes("min-height: 0"));assert.ok(!patch.includes("#regionSearchModal"));});
`;
  buffers.cloudShellTest = Buffer.from(testSource);
  buffers.packageTest = Buffer.from(`${testSource}
test("자산 참조 외 HTML 변경 없음 및 v60d 복구본",()=>{for(const k of ["deployHtml","rollbackHtml"])assert.equal(hash(read(k)),expected.hashes[k]);let html=read("deployHtml").toString();for(const {from,to} of ${JSON.stringify(replacements)})html=html.split(to).join(from);assert.equal(hash(html),expected.hashes.rollbackHtml);});
`);
  for (const k of ["cloudShellTest", "packageTest"]) new vm.Script(buffers[k].toString());
  const files = Object.fromEntries(Object.entries(buffers).map(([key, bytes]) => [key, { fileName: names[key], bytes: bytes.length, sha256: hash(bytes), ...(["css", "js"].includes(key) ? { contentEncoding: key === "css" ? "gzip" : "br", objectName: assets[`${key}ObjectName`], logicalSri: sri(key === "css" ? css : js) } : {}) }]));
  const manifest = { schema: "golfjoin-calendar-scrollbar-v1", version: "v60e", status: "ready-for-validation", preparedAt: new Date().toISOString(), productionBaseline: "v60d", assetRevision: revision, assets, names, files, serverDeploymentRequired: false };
  const runbook = `# v60e PC 참여 가능한 모임 상품 목록 스크롤바 위치 수정

기준 v60d. 앞선 여행지 검색 패널과 추천 카드 변경을 모두 포함합니다.
PC에서 날짜를 선택했을 때 상품 목록 스크롤바를 모달 오른쪽 끝에 맞춥니다. 카드의 좌우 위치와 상단 달력은 유지합니다. 낮은 창 높이에서도 마지막 상품까지 스크롤할 수 있도록 목록 최소 높이를 조정했습니다. 모바일과 JavaScript는 변경하지 않습니다.

## 1. Cloud Shell 업로드

아래 세 파일을 /home/llno95ll/google-sheet-proxy-function 폴더에 업로드하세요.

- ${names.css}
- ${names.js} (v60d와 같은 파일이지만 새 자산 경로에도 업로드)
- ${names.cloudShellTest}

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function
node --test ${names.cloudShellTest}
\`\`\`

## 2. 검증 성공 후 GCS 업로드

\`\`\`bash
gcloud storage cp ${names.css} gs://golfjoin-bucket/${assets.cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"
gcloud storage cp ${names.js} gs://golfjoin-bucket/${assets.jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"
curl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/${assets.cssObjectName}
curl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${assets.jsObjectName}
\`\`\`

두 응답의 HTTP 200, Content-Type, Content-Encoding을 확인합니다. 412 오류는 같은 객체가 이미 존재한다는 의미이므로 기존 객체를 덮어쓰지 말고 확인하세요.

## 3. ERP HTML 반영

eventPlanSeq=3 HTML 전체를 ${names.deployHtml} 내용으로 교체합니다.
참여 가능한 모임 → 여러 상품이 있는 날짜 → 상품 목록 스크롤 → 마지막 카드 → 상품상세를 확인하세요. 스크롤 중 상단 달력은 고정되고 스크롤바는 모달 오른쪽 끝에 붙어야 합니다. 달력 펼침/접힘과 모바일 기존 화면도 확인하세요.

## 복구

${names.rollbackHtml} 전체 내용으로 교체하면 v60d로 복구됩니다. 기존 GCS 자산은 삭제하지 않습니다. 서버/API 재배포는 필요 없습니다.
`;
  return { buffers, names, manifest, runbook };
}
if (require.main === module) {
  try {
    if (fs.existsSync(OUTPUT)) throw new Error(`Output already exists: ${OUTPUT}`);
    const result = build(); fs.mkdirSync(OUTPUT, { recursive: true });
    for (const [k, bytes] of Object.entries(result.buffers)) fs.writeFileSync(path.join(OUTPUT, result.names[k]), bytes, { flag: "wx" });
    fs.writeFileSync(path.join(OUTPUT, "manifest.json"), JSON.stringify(result.manifest, null, 2) + "\n", { flag: "wx" });
    fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), result.runbook, { flag: "wx" });
    console.log(JSON.stringify({ output: OUTPUT, revision: result.manifest.assetRevision, names: result.names }, null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = { build, OUTPUT };
