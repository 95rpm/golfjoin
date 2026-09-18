"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const BASELINE_ROOT = path.join(
  ROOT,
  "deploy/stage60e-calendar-scrollbar/calendar-scrollbar-20260907-v60e"
);
const OUTPUT_ROOT = path.join(
  ROOT,
  "deploy/stage61-overseas-best-window/overseas-best-window-20260907-v61"
);
const SOURCE_PATH = path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/sections/38-home-sections.js"
);
const DETAIL_SOURCE_PATH = path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
);

const OLD_FUNCTION = "function getOverseasBestItems(e){const t=e.filter(isOverseasJoin);return";
const NEW_FUNCTION = "function getOverseasBestItems(e){const t=e.filter(isOverseasJoin).filter(isSoonCandidate);return";

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

function verifyInlineScripts(html) {
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  scripts.forEach((source, index) => new vm.Script(source, { filename: `inline-${index + 1}.js` }));
  return scripts.length;
}

function makeCloudShellTest(names, hashes, revision, jsSri) {
  return `"use strict";\n\n`
    + `const assert = require("node:assert/strict");\n`
    + `const crypto = require("node:crypto");\n`
    + `const fs = require("node:fs");\n`
    + `const test = require("node:test");\n`
    + `const vm = require("node:vm");\n`
    + `const zlib = require("node:zlib");\n\n`
    + `const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");\n\n`
    + `test("v61 업로드 파일 해시와 해외조인 BEST 7일 기준이 일치한다", () => {\n`
    + `  const css = fs.readFileSync(${JSON.stringify(names.css)});\n`
    + `  const jsBr = fs.readFileSync(${JSON.stringify(names.js)});\n`
    + `  assert.equal(sha256(css), ${JSON.stringify(hashes.css)});\n`
    + `  assert.equal(sha256(jsBr), ${JSON.stringify(hashes.js)});\n`
    + `  const js = zlib.brotliDecompressSync(jsBr).toString("utf8");\n`
    + `  assert.equal(js.split(${JSON.stringify(NEW_FUNCTION)}).length - 1, 1);\n`
    + `  assert.equal(js.includes(${JSON.stringify(OLD_FUNCTION)}), false);\n`
    + `  assert.doesNotThrow(() => new vm.Script(js));\n`
    + `});\n`;
}

function makePackageTest(names, hashes, revision, jsSri) {
  return `"use strict";\n\n`
    + `const assert = require("node:assert/strict");\n`
    + `const crypto = require("node:crypto");\n`
    + `const fs = require("node:fs");\n`
    + `const path = require("node:path");\n`
    + `const test = require("node:test");\n`
    + `const vm = require("node:vm");\n`
    + `const zlib = require("node:zlib");\n\n`
    + `const ROOT = path.resolve(__dirname, "../../..");\n`
    + `const read = (name) => fs.readFileSync(path.join(__dirname, name));\n`
    + `const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");\n\n`
    + `test("v61 배포·복구 파일과 자산 해시가 일치한다", () => {\n`
    + `  assert.equal(sha256(read(${JSON.stringify(names.deployHtml)})), ${JSON.stringify(hashes.deployHtml)});\n`
    + `  assert.equal(sha256(read(${JSON.stringify(names.rollbackHtml)})), ${JSON.stringify(hashes.rollbackHtml)});\n`
    + `  assert.equal(sha256(read(${JSON.stringify(names.css)})), ${JSON.stringify(hashes.css)});\n`
    + `  assert.equal(sha256(read(${JSON.stringify(names.js)})), ${JSON.stringify(hashes.js)});\n`
    + `});\n\n`
    + `test("v61은 배포 JavaScript 문법과 인라인 스크립트 문법이 유효하다", () => {\n`
    + `  const js = zlib.brotliDecompressSync(read(${JSON.stringify(names.js)})).toString("utf8");\n`
    + `  assert.doesNotThrow(() => new vm.Script(js));\n`
    + `  const html = read(${JSON.stringify(names.deployHtml)}).toString("utf8");\n`
    + `  const scripts = [...html.matchAll(/<script\\b(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)<\\/script>/gi)]\n`
    + `    .map((match) => match[1]).filter((source) => source.trim());\n`
    + `  scripts.forEach((source) => assert.doesNotThrow(() => new vm.Script(source)));\n`
    + `});\n\n`
    + `test("v61 해외조인 BEST는 출발 7일 이상 일정만 사용한다", () => {\n`
    + `  const js = zlib.brotliDecompressSync(read(${JSON.stringify(names.js)})).toString("utf8");\n`
    + `  assert.equal(js.split(${JSON.stringify(NEW_FUNCTION)}).length - 1, 1);\n`
    + `  assert.equal(js.includes(${JSON.stringify(OLD_FUNCTION)}), false);\n`
    + `  const sections = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/sections/38-home-sections.js"), "utf8");\n`
    + `  const detail = fs.readFileSync(path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");\n`
    + `  assert.match(sections, /function getOverseasBestItems[\\s\\S]*?\\.filter\\(isOverseasJoin\\)[\\s\\S]*?\\.filter\\(isSoonCandidate\\)/);\n`
    + `  assert.match(detail, /function isSoonCandidate\\(join\\) \\{[\\s\\S]*?getJoinDaysFromToday\\(join\\) >= 7/);\n`
    + `});\n\n`
    + `test("v61 HTML은 새 불변 자산 경로와 JavaScript 무결성 값을 사용한다", () => {\n`
    + `  const html = read(${JSON.stringify(names.deployHtml)}).toString("utf8");\n`
    + `  assert.match(html, /${revision.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/);\n`
    + `  assert.match(html, /${jsSri.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/);\n`
    + `});\n`;
}

function makeRunbook(names, revision) {
  return `# v61 해외조인 BEST 출발 7일 기준 통일\n\n`
    + `해외조인 BEST에서 출발일까지 7일 미만 남은 관리자 추천일정과 일반 모임을 제외합니다. 비로그인·로그인에 동일하게 적용되며 서버/API 재배포는 필요 없습니다.\n\n`
    + `## 1. Cloud Shell 업로드\n\n`
    + `아래 세 파일을 \`/home/llno95ll/google-sheet-proxy-function\` 폴더에 업로드하세요.\n\n`
    + `- ${names.css}\n- ${names.js}\n- ${names.cloudShellTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nnode --test ${names.cloudShellTest}\n\`\`\`\n\n`
    + `## 2. GCS 업로드\n\n`
    + `\`\`\`bash\n`
    + `gcloud storage cp ${names.css} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\n`
    + `gcloud storage cp ${names.js} gs://golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\n`
    + `curl -fsSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.css\n`
    + `curl -fsSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${revision}/golfjoin-main.js\n`
    + `\`\`\`\n\n`
    + `## 3. HTML 교체 및 확인\n\n`
    + `eventPlanSeq=3 HTML 전체를 ${names.deployHtml} 내용으로 교체합니다. 2026-09-07 기준 9월 7~13일 출발 카드는 보이지 않고 9월 14일 이후 카드만 보여야 합니다. 비로그인과 로그인에서 각각 해외조인 BEST를 확인하세요.\n\n`
    + `## 복구\n\n`
    + `${names.rollbackHtml} 전체 내용으로 교체하면 v60e로 복구됩니다. GCS 객체는 삭제하지 않습니다.\n`;
}

function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);
  const baselineManifest = JSON.parse(fs.readFileSync(path.join(BASELINE_ROOT, "manifest.json"), "utf8"));
  const rollbackHtml = readVerified(BASELINE_ROOT, baselineManifest.files.deployHtml, "baseline_html");
  const cssGzip = readVerified(BASELINE_ROOT, baselineManifest.files.css, "baseline_css");
  const oldJsBrotli = readVerified(BASELINE_ROOT, baselineManifest.files.js, "baseline_js");
  const css = zlib.gunzipSync(cssGzip);
  const oldJs = zlib.brotliDecompressSync(oldJsBrotli).toString("utf8");
  const newJs = Buffer.from(replaceExact(oldJs, OLD_FUNCTION, NEW_FUNCTION, "overseas_best_function"), "utf8");
  new vm.Script(newJs.toString("utf8"), { filename: "golfjoin-main-v61.js" });
  const newJsBrotli = zlib.brotliCompressSync(newJs, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (!zlib.brotliDecompressSync(newJsBrotli).equals(newJs)) throw new Error("brotli_roundtrip_failed");

  const revisionMaterial = Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    newJs,
    Buffer.from("\n--golfjoin-overseas-best-7-day-window-v1--\n")
  ]);
  const revision = `gha_${sha256(revisionMaterial).slice(0, 24)}`;
  const oldRevision = baselineManifest.assetRevision;
  const oldJsSri = baselineManifest.files.js.logicalSri;
  const newJsSri = sri(newJs);
  let deployHtmlText = rollbackHtml.toString("utf8");
  const revisionCount = deployHtmlText.split(oldRevision).length - 1;
  if (revisionCount < 3) throw new Error(`baseline_revision_count_invalid:${revisionCount}`);
  deployHtmlText = deployHtmlText.split(oldRevision).join(revision);
  deployHtmlText = replaceExact(deployHtmlText, oldJsSri, newJsSri, "javascript_sri");
  if (deployHtmlText.includes(oldRevision)) throw new Error("old_revision_remains");
  verifyInlineScripts(deployHtmlText);
  const deployHtml = Buffer.from(deployHtmlText, "utf8");

  const hashes = {
    deployHtml: sha256(deployHtml),
    rollbackHtml: sha256(rollbackHtml),
    css: sha256(cssGzip),
    js: sha256(newJsBrotli)
  };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_overseas_best_window_${hashes.deployHtml.slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${hashes.rollbackHtml.slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hashes.css.slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hashes.js.slice(0, 8).toUpperCase()}.js.br`,
    cloudShellTest: "stage61-overseas-best-window-cloudshell.test.js",
    packageTest: "stage61-overseas-best-window.test.js"
  };
  const cloudShellTest = Buffer.from(makeCloudShellTest(names, hashes, revision, newJsSri), "utf8");
  const packageTest = Buffer.from(makePackageTest(names, hashes, revision, newJsSri), "utf8");
  const runbook = Buffer.from(makeRunbook(names, revision), "utf8");
  const manifest = {
    schema: "golfjoin-overseas-best-window-v1",
    version: "v61",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    productionBaseline: "v60e",
    rule: {
      section: "overseas",
      minimumDaysBeforeDeparture: 7,
      loginScope: "public-shared"
    },
    assetRevision: revision,
    assets: {
      cssObjectName: `web/home-assets/${revision}/golfjoin-main.css`,
      jsObjectName: `web/home-assets/${revision}/golfjoin-main.js`
    },
    names,
    files: {
      deployHtml: { fileName: names.deployHtml, bytes: deployHtml.length, sha256: hashes.deployHtml },
      rollbackHtml: { fileName: names.rollbackHtml, bytes: rollbackHtml.length, sha256: hashes.rollbackHtml },
      css: { fileName: names.css, bytes: cssGzip.length, sha256: hashes.css, contentEncoding: "gzip", logicalSri: baselineManifest.files.css.logicalSri },
      js: { fileName: names.js, bytes: newJsBrotli.length, sha256: hashes.js, contentEncoding: "br", logicalSri: newJsSri },
      cloudShellTest: { fileName: names.cloudShellTest, bytes: cloudShellTest.length, sha256: sha256(cloudShellTest) },
      packageTest: { fileName: names.packageTest, bytes: packageTest.length, sha256: sha256(packageTest) },
      runbook: { fileName: "RUNBOOK.md", bytes: runbook.length, sha256: sha256(runbook) }
    },
    serverDeploymentRequired: false
  };

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.deployHtml), deployHtml);
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.rollbackHtml), rollbackHtml);
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.css), cssGzip);
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.js), newJsBrotli);
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.cloudShellTest), cloudShellTest);
  fs.writeFileSync(path.join(OUTPUT_ROOT, names.packageTest), packageTest);
  fs.writeFileSync(path.join(OUTPUT_ROOT, "RUNBOOK.md"), runbook);
  fs.writeFileSync(path.join(OUTPUT_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot: OUTPUT_ROOT, ...manifest }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  }
}
