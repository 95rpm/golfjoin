"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const BASELINE_ROOT = path.join(
  ROOT,
  "deploy/stage61-overseas-best-window/overseas-best-window-20260907-v61"
);
const OUTPUT_ROOT = path.join(
  ROOT,
  "deploy/stage62-recommended-detail-sticky-tabs/recommended-detail-sticky-tabs-20260907-v62"
);

const OLD_REFERENCE_INPUT = "erpEventSeq:e.erpEventSeq||t?.erpEventSeq})";
const NEW_REFERENCE_INPUT = "erpEventSeq:e.erpEventSeq||t?.erpEventSeq,eventSeq:e.erpEventSeq||t?.eventSeq})";
const OLD_REFERENCE_OUTPUT = "eventSeq:t?.eventSeq||n.eventSeq||e.erpEventSeq||\"\",erpProductId:normalizeJoinCanonicalErpProductId(e.erpProductId||t?.goodSeq||n.goodSeq||t?.erpProductId,t?.erpEventSeq||n.eventSeq||e.erpEventSeq)||\"\",erpEventSeq:normalizeJoinCanonicalErpEventSeq(t?.erpEventSeq||n.eventSeq||e.erpEventSeq),";
const NEW_REFERENCE_OUTPUT = "eventSeq:n.eventSeq||t?.eventSeq||\"\",erpProductId:normalizeJoinCanonicalErpProductId(e.erpProductId||t?.goodSeq||n.goodSeq||t?.erpProductId,n.eventSeq||t?.erpEventSeq)||\"\",erpEventSeq:normalizeJoinCanonicalErpEventSeq(n.eventSeq||t?.erpEventSeq),";
const OLD_DESKTOP_SPACING = `#detailModal #detailContent,
      body > #detailModal.sgj-portal-overlay #detailContent {
        padding-top: 20px !important;
      }`;
const NEW_DESKTOP_SPACING = `#detailModal #detailContent,
      body > #detailModal.sgj-portal-overlay #detailContent {
        padding-top: 0 !important;
      }
      #detailModal #detailContent > .detail-slider,
      body > #detailModal.sgj-portal-overlay #detailContent > .detail-slider {
        margin-top: 20px;
      }`;

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sri(buffer) {
  return `sha256-${crypto.createHash("sha256").update(buffer).digest("base64")}`;
}

function readVerified(root, record, label) {
  const filePath = path.join(root, record.fileName);
  const buffer = fs.readFileSync(filePath);
  if (sha256(buffer) !== record.sha256) throw new Error(`${label}_hash_mismatch`);
  return buffer;
}

function replaceExact(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count !== 1) throw new Error(`${label}_count_invalid:${count}`);
  return source.replace(target, replacement);
}

function replaceDesktopSpacing(source, label) {
  const pattern = /#detailModal #detailContent,\r?\n\s*body > #detailModal\.sgj-portal-overlay #detailContent \{\r?\n\s*padding-top: 20px !important;\r?\n\s*\}/g;
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) throw new Error(`${label}_count_invalid:${matches.length}`);
  return source.replace(pattern, NEW_DESKTOP_SPACING);
}

function replaceAllExact(source, target, replacement, expectedCount, label) {
  const count = source.split(target).length - 1;
  if (count !== expectedCount) throw new Error(`${label}_count_invalid:${count}`);
  return source.split(target).join(replacement);
}

function verifyInlineScripts(html) {
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  scripts.forEach((source, index) => new vm.Script(source, { filename: `inline-${index + 1}.js` }));
  return scripts.length;
}

function updateCriticalCss(html) {
  const pattern = /<style data-golfjoin-critical-css="[a-f0-9]+">([\s\S]*?)<\/style>/i;
  const match = html.match(pattern);
  if (!match) throw new Error("critical_css_missing");
  const css = replaceDesktopSpacing(match[1], "critical_desktop_spacing");
  const cssHash = sha256(Buffer.from(css, "utf8")).slice(0, 16);
  return html.replace(pattern, `<style data-golfjoin-critical-css="${cssHash}">${css}</style>`);
}

function makeCloudShellTest(names, hashes) {
  return `"use strict";\n\n`
    + `const assert=require("node:assert/strict");\n`
    + `const crypto=require("node:crypto");\n`
    + `const fs=require("node:fs");\n`
    + `const test=require("node:test");\n`
    + `const vm=require("node:vm");\n`
    + `const zlib=require("node:zlib");\n\n`
    + `const sha256=(value)=>crypto.createHash("sha256").update(value).digest("hex");\n`
    + `const cssGz=fs.readFileSync(${JSON.stringify(names.css)});\n`
    + `const jsBr=fs.readFileSync(${JSON.stringify(names.js)});\n`
    + `const css=zlib.gunzipSync(cssGz).toString("utf8");\n`
    + `const js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n\n`
    + `test("v62 업로드 자산 해시와 JavaScript 문법이 유효하다",()=>{\n`
    + `  assert.equal(sha256(cssGz),${JSON.stringify(hashes.css)});\n`
    + `  assert.equal(sha256(jsBr),${JSON.stringify(hashes.js)});\n`
    + `  assert.doesNotThrow(()=>new vm.Script(js));\n`
    + `});\n`
    + `test("v62 관리자 추천일정은 등록된 행사번호를 상세 조회에 유지한다",()=>{\n`
    + `  assert.equal(js.includes(${JSON.stringify(NEW_REFERENCE_INPUT)}),true);\n`
    + `  assert.equal(js.includes(${JSON.stringify(NEW_REFERENCE_OUTPUT)}),true);\n`
    + `  assert.equal(js.includes(${JSON.stringify(OLD_REFERENCE_OUTPUT)}),false);\n`
    + `});\n`
    + `test("v62 PC 상세 첫 화면 20px과 고정 탭 0px를 함께 유지한다",()=>{\n`
    + `  assert.equal(css.includes(${JSON.stringify(NEW_DESKTOP_SPACING)}),true);\n`
    + `  assert.equal(css.includes(${JSON.stringify(OLD_DESKTOP_SPACING)}),false);\n`
    + `  assert.match(css,/\\.detail-anchor-tabs \\{\\s*position: sticky;\\s*top: 0;/);\n`
    + `});\n`;
}

function makePackageTest(names, hashes, revision, cssSri, jsSri) {
  return `"use strict";\n\n`
    + `const assert=require("node:assert/strict");\n`
    + `const crypto=require("node:crypto");\n`
    + `const fs=require("node:fs");\n`
    + `const path=require("node:path");\n`
    + `const test=require("node:test");\n`
    + `const vm=require("node:vm");\n`
    + `const zlib=require("node:zlib");\n\n`
    + `const read=(name)=>fs.readFileSync(path.join(__dirname,name));\n`
    + `const sha256=(value)=>crypto.createHash("sha256").update(value).digest("hex");\n`
    + `const deploy=read(${JSON.stringify(names.deployHtml)}),rollback=read(${JSON.stringify(names.rollbackHtml)});\n`
    + `const cssGz=read(${JSON.stringify(names.css)}),jsBr=read(${JSON.stringify(names.js)});\n`
    + `const css=zlib.gunzipSync(cssGz).toString("utf8"),js=zlib.brotliDecompressSync(jsBr).toString("utf8");\n\n`
    + `test("v62 배포·복구·자산 해시가 일치한다",()=>{\n`
    + `  assert.equal(sha256(deploy),${JSON.stringify(hashes.deployHtml)});\n`
    + `  assert.equal(sha256(rollback),${JSON.stringify(hashes.rollbackHtml)});\n`
    + `  assert.equal(sha256(cssGz),${JSON.stringify(hashes.css)});\n`
    + `  assert.equal(sha256(jsBr),${JSON.stringify(hashes.js)});\n`
    + `});\n`
    + `test("v62 JavaScript와 인라인 스크립트 문법이 유효하다",()=>{\n`
    + `  assert.doesNotThrow(()=>new vm.Script(js));\n`
    + `  const scripts=[...deploy.toString("utf8").matchAll(/<script\\b(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map((m)=>m[1]).filter((value)=>value.trim());\n`
    + `  scripts.forEach((source)=>assert.doesNotThrow(()=>new vm.Script(source)));\n`
    + `});\n`
    + `test("v62 추천일정 상세 참조와 PC 고정 탭 계약을 포함한다",()=>{\n`
    + `  assert.equal(js.includes(${JSON.stringify(NEW_REFERENCE_INPUT)}),true);\n`
    + `  assert.equal(js.includes(${JSON.stringify(NEW_REFERENCE_OUTPUT)}),true);\n`
    + `  assert.equal(css.includes(${JSON.stringify(NEW_DESKTOP_SPACING)}),true);\n`
    + `});\n`
    + `test("v62 HTML은 신규 리비전·SRI·인라인 탭 간격을 사용한다",()=>{\n`
    + `  const html=deploy.toString("utf8");\n`
    + `  assert.equal(html.includes(${JSON.stringify(revision)}),true);\n`
    + `  assert.equal(html.includes(${JSON.stringify(cssSri)}),true);\n`
    + `  assert.equal(html.includes(${JSON.stringify(jsSri)}),true);\n`
    + `  assert.equal(html.includes(${JSON.stringify(NEW_DESKTOP_SPACING)}),true);\n`
    + `});\n`
    + `test("v62 복구본은 운영 v61 리비전이다",()=>{assert.equal(rollback.toString("utf8").includes("gha_0862b8f752df57b5ddd11352"),true)});\n`;
}

function makeRunbook(names, revision) {
  return `# v62 추천일정 상세 참조 및 PC 고정 탭 수정\n\n`
    + `관리자 추천일정의 정확한 ERP 행사번호를 보존하고, PC 상품상세의 첫 화면 20px 여백은 유지하면서 고정 탭을 헤더 바로 아래에 붙입니다. 서버 재배포는 필요 없습니다.\n\n`
    + `## 1. Cloud Shell 업로드\n\n`
    + `아래 세 파일만 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다. HTML은 Cloud Shell에 올릴 필요가 없습니다.\n\n`
    + `- ${names.css}\n- ${names.js}\n- ${names.cloudShellTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.css} ${names.js} ${names.cloudShellTest}\nnode --test ${names.cloudShellTest}\n\`\`\`\n\n`
    + `## 2. GCS 업로드\n\n`
    + `\`\`\`bash\n`
    + `gcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\n`
    + `gcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\n`
    + `curl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\n`
    + `curl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n`
    + `\`\`\`\n\n`
    + `## 3. HTML 교체\n\n`
    + `ERP 편집기에서 eventPlanSeq=3 HTML 전체를 ${names.deployHtml} 내용으로 교체합니다.\n\n`
    + `## 4. 운영 확인\n\n`
    + `1. 해외골프 BEST의 태국 방콕 2색 5박7일 9.14~9.20 추천일정을 엽니다.\n`
    + `2. '일부 상품상세 정보를 불러오지 못했습니다' 경고가 없고 상품요약·포함사항·일정표가 표시되는지 확인합니다.\n`
    + `3. PC에서 상세를 아래로 스크롤해 탭이 헤더와 빈 공간 없이 붙는지 확인합니다.\n`
    + `4. 모달을 다시 열었을 때 첫 이미지 위 20px 여백이 유지되는지 확인합니다.\n\n`
    + `## 복구\n\n`
    + `${names.rollbackHtml} 전체 내용으로 교체하면 현재 운영 v61로 복구됩니다. GCS 객체는 삭제하지 않습니다.\n`;
}

function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);
  const baselineManifest = JSON.parse(fs.readFileSync(path.join(BASELINE_ROOT, "manifest.json"), "utf8"));
  const rollbackHtml = readVerified(BASELINE_ROOT, baselineManifest.files.deployHtml, "baseline_html");
  const oldCssGzip = readVerified(BASELINE_ROOT, baselineManifest.files.css, "baseline_css");
  const oldJsBrotli = readVerified(BASELINE_ROOT, baselineManifest.files.js, "baseline_js");

  const oldCss = zlib.gunzipSync(oldCssGzip).toString("utf8");
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");
  const newCss = Buffer.from(replaceDesktopSpacing(oldCss, "desktop_spacing"), "utf8");
  let nextJs = replaceExact(oldJs, OLD_REFERENCE_INPUT, NEW_REFERENCE_INPUT, "reference_input");
  nextJs = replaceExact(nextJs, OLD_REFERENCE_OUTPUT, NEW_REFERENCE_OUTPUT, "reference_output");
  const newJs = Buffer.from(nextJs, "utf8");
  new vm.Script(nextJs, { filename: "golfjoin-main-v62.js" });

  const cssGzip = zlib.gzipSync(newCss, { level: 9, mtime: 0 });
  const jsBrotli = zlib.brotliCompressSync(newJs, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.gunzipSync(cssGzip).equals(newCss)) throw new Error("gzip_roundtrip_failed");
  if (!zlib.brotliDecompressSync(jsBrotli).equals(newJs)) throw new Error("brotli_roundtrip_failed");

  const revisionMaterial = Buffer.concat([
    newCss,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    newJs,
    Buffer.from("\n--golfjoin-recommended-detail-sticky-tabs-v1--\n")
  ]);
  const revision = `gha_${sha256(revisionMaterial).slice(0, 24)}`;
  const cssSri = sri(newCss);
  const jsSri = sri(newJs);
  let deployHtmlText = updateCriticalCss(rollbackHtml.toString("utf8"));
  deployHtmlText = deployHtmlText.split(baselineManifest.assetRevision).join(revision);
  deployHtmlText = replaceAllExact(deployHtmlText, baselineManifest.files.css.logicalSri, cssSri, 2, "css_sri");
  deployHtmlText = replaceExact(deployHtmlText, baselineManifest.files.js.logicalSri, jsSri, "js_sri");
  verifyInlineScripts(deployHtmlText);
  const deployHtml = Buffer.from(deployHtmlText, "utf8");

  const hashes = {
    deployHtml: sha256(deployHtml),
    rollbackHtml: sha256(rollbackHtml),
    css: sha256(cssGzip),
    js: sha256(jsBrotli)
  };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_recommended_detail_sticky_tabs_${hashes.deployHtml.slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${hashes.rollbackHtml.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    cloudShellTest: "stage62-recommended-detail-sticky-tabs-cloudshell.test.js",
    packageTest: "stage62-recommended-detail-sticky-tabs.test.js"
  };
  const cloudShellTest = Buffer.from(makeCloudShellTest(names, hashes), "utf8");
  const packageTest = Buffer.from(makePackageTest(names, hashes, revision, cssSri, jsSri), "utf8");
  const runbook = Buffer.from(makeRunbook(names, revision), "utf8");
  const manifest = {
    schema: "golfjoin-recommended-detail-sticky-tabs-v1",
    version: "v62",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    productionBaseline: "v61",
    assetRevision: revision,
    fixes: {
      adminRecommendedErpEventSeqPreserved: true,
      desktopInitialTopSpacingPx: 20,
      desktopStickyTabsHeaderGapPx: 0,
      mobileDetailLayoutPreserved: true
    },
    assets: {
      cssObjectName: `web/home-assets/${revision}/golfjoin-main.css`,
      jsObjectName: `web/home-assets/${revision}/golfjoin-main.js`
    },
    names,
    files: {
      deployHtml: { fileName: names.deployHtml, bytes: deployHtml.length, sha256: hashes.deployHtml },
      rollbackHtml: { fileName: names.rollbackHtml, bytes: rollbackHtml.length, sha256: hashes.rollbackHtml },
      css: { fileName: names.css, bytes: cssGzip.length, sha256: hashes.css, contentEncoding: "gzip", logicalSri: cssSri },
      js: { fileName: names.js, bytes: jsBrotli.length, sha256: hashes.js, contentEncoding: "br", logicalSri: jsSri },
      cloudShellTest: { fileName: names.cloudShellTest, bytes: cloudShellTest.length, sha256: sha256(cloudShellTest) },
      packageTest: { fileName: names.packageTest, bytes: packageTest.length, sha256: sha256(packageTest) },
      runbook: { fileName: "RUNBOOK.md", bytes: runbook.length, sha256: sha256(runbook) }
    },
    serverDeploymentRequired: false,
    dashboardDeploymentRequired: false
  };

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.deployHtml), deployHtml, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.rollbackHtml), rollbackHtml, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.css), cssGzip, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.js), jsBrotli, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.cloudShellTest), cloudShellTest, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.packageTest), packageTest, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT_ROOT, "RUNBOOK.md"), runbook, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot: OUTPUT_ROOT, manifest }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  }
}
