"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_CSS = path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css");
const V60A = path.join(
  ROOT,
  "deploy/stage60-destination-search-create-cta/destination-search-create-cta-20260904-v60a"
);
const BASE_HTML = path.join(V60A, "DEPLOY_golfjoin_main_destination_search_create_cta_246B7035.html");
const BASE_JS = path.join(V60A, "UPLOAD_golfjoin-main_0F5221D1.js.br");
const OUTPUT = path.join(
  ROOT,
  "deploy/stage60b-detail-modal-padding/detail-modal-padding-20260904-v60b"
);

const read = (target) => fs.readFileSync(target);
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sri = (value) => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;

function replaceAssetReference(html, assetName, objectName, integrity) {
  const pattern = new RegExp(
    `https://storage\\.googleapis\\.com/golfjoin-bucket/web/home-assets/gha_[a-f0-9]+/${assetName.replace(".", "\\.")}("\\s+integrity=")[^"]+`,
    "g"
  );
  const matches = html.match(pattern) || [];
  if (!matches.length) throw new Error(`${assetName}_asset_reference_missing`);
  return html.replace(
    pattern,
    `https://storage.googleapis.com/golfjoin-bucket/${objectName}$1${integrity}`
  );
}

function updateCriticalDetailPadding(html) {
  const stylePattern = /<style data-golfjoin-critical-css="[a-f0-9]+">([\s\S]*?)<\/style>/i;
  const styleMatch = html.match(stylePattern);
  if (!styleMatch) throw new Error("critical_css_missing");
  const desktopRule = /(@media \(min-width: 641px\) \{#detailModal #detailContent,\s*body > #detailModal\.sgj-portal-overlay #detailContent \{\s*padding-top:\s*)0(\s*!important;\s*\}\s*\})/;
  if (!desktopRule.test(styleMatch[1])) throw new Error("critical_detail_padding_rule_missing");
  const criticalCss = styleMatch[1].replace(
    desktopRule,
    (_match, prefix, suffix) => `${prefix}20px${suffix}`
  );
  const criticalHash = hash(Buffer.from(criticalCss, "utf8")).slice(0, 16);
  return html.replace(
    stylePattern,
    `<style data-golfjoin-critical-css="${criticalHash}">${criticalCss}</style>`
  );
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: hash(buffer), ...extra };
}

function buildTest(names, hashes, assetRevision, cloudShell) {
  const lines = [
    '"use strict";',
    'const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");',
    'const file=(name)=>fs.readFileSync(path.join(__dirname,name));',
    'const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");',
    `const compressedCss=file(${JSON.stringify(names.css)}),compressedJs=file(${JSON.stringify(names.js)});`,
    'const css=zlib.gunzipSync(compressedCss).toString("utf8"),js=zlib.brotliDecompressSync(compressedJs).toString("utf8");',
  ];
  if (!cloudShell) {
    lines.push(`const deploy=file(${JSON.stringify(names.deployHtml)}),rollback=file(${JSON.stringify(names.rollbackHtml)});`);
  }
  lines.push(
    `test("v60b ${cloudShell ? "Cloud Shell " : ""}압축 자산 해시와 JavaScript 문법이 유효하다",()=>{assert.equal(hash(compressedCss),${JSON.stringify(hashes.css)});assert.equal(hash(compressedJs),${JSON.stringify(hashes.js)});new vm.Script(js)});`,
    'test("v60b PC 상품상세 본문은 20px 상단 여백을 가진다",()=>{assert.match(css,/@media \\(min-width: 641px\\) \\{[\\s\\S]*?#detailModal #detailContent,[\\s\\S]*?body > #detailModal\\.sgj-portal-overlay #detailContent \\{\\s*padding-top: 20px !important;/)});',
    'test("v60b 모바일 상품상세 전체 너비 레이아웃을 유지한다",()=>{assert.match(css,/#detailModal\\.open #detailContent,[\\s\\S]*?body > #detailModal\\.sgj-portal-overlay\\.open #detailContent \\{\\s*padding-top: 0 !important;\\s*padding-left: 0 !important;\\s*padding-right: 0 !important;/)});',
    'test("v60b 여행지 검색 CTA와 공개 상세 딥링크를 유지한다",()=>{["원하는 일정이 없나요?","다른 지역에서 바로 참여 가능한 모임","initial-detail-deeplink","member_kakao_signup_complete"].forEach((value)=>assert.ok(js.includes(value)))});'
  );
  if (!cloudShell) {
    lines.push(
      `test("v60b HTML은 신규 자산과 인라인 20px 규칙을 사용하고 v60a로 복구한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.deployHtml)});assert.equal(hash(rollback),${JSON.stringify(hashes.rollbackHtml)});assert.match(deploy.toString("utf8"),/${assetRevision}/);assert.match(deploy.toString("utf8"),/@media \\(min-width: 641px\\) \\{#detailModal #detailContent,[\\s\\S]*?padding-top: 20px !important;/);assert.match(rollback.toString("utf8"),/padding-top: 0 !important/) });`
    );
  }
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const css = read(SOURCE_CSS);
  const cssText = css.toString("utf8");
  const jsBrotli = read(BASE_JS);
  const js = zlib.brotliDecompressSync(jsBrotli);
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v60b.min.js" });

  if (!/@media \(min-width: 641px\) \{[\s\S]*?#detailModal #detailContent,[\s\S]*?padding-top: 20px !important;/.test(cssText)) {
    throw new Error("desktop_detail_padding_contract_missing");
  }
  if (!/#detailModal\.open #detailContent,[\s\S]*?padding-top: 0 !important;\s*padding-left: 0 !important;\s*padding-right: 0 !important;/.test(cssText)) {
    throw new Error("mobile_detail_full_bleed_contract_missing");
  }

  const assetRevision = `gha_${hash(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--stage60b-detail-modal-padding--\n"),
  ])).slice(0, 24)}`;
  const cssObjectName = `web/home-assets/${assetRevision}/golfjoin-main.css`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(BASE_HTML);
  let deployText = updateCriticalDetailPadding(rollbackHtml.toString("utf8"));
  deployText = replaceAssetReference(deployText, "golfjoin-main.css", cssObjectName, sri(css));
  deployText = replaceAssetReference(deployText, "golfjoin-main.js", jsObjectName, sri(js));
  const deployHtml = Buffer.from(deployText, "utf8");
  const cssGzip = zlib.gzipSync(css, { level: 9, mtime: 0 });

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_detail_modal_padding_${hash(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${hash(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hash(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hash(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    packageTest: "stage60b-detail-modal-padding.test.js",
    cloudShellTest: "stage60b-detail-modal-padding-cloudshell.test.js",
  };
  const hashes = {
    deployHtml: hash(deployHtml),
    rollbackHtml: hash(rollbackHtml),
    css: hash(cssGzip),
    js: hash(jsBrotli),
  };
  const buffers = { deployHtml, rollbackHtml, css: cssGzip, js: jsBrotli };
  buffers.packageTest = buildTest(names, hashes, assetRevision, false);
  buffers.cloudShellTest = buildTest(names, hashes, assetRevision, true);

  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "css"
      ? { contentEncoding: "gzip", objectName: cssObjectName, logicalSri: sri(css) }
      : key === "js"
        ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sri(js) }
        : {})
  ]));
  const manifest = {
    schema: "golfjoin-stage60b-detail-modal-padding-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    productionBaseline: "v60a",
    serverDeploymentRequired: false,
    dashboardDeploymentRequired: false,
    assetRevision,
    features: {
      desktopDetailModalBodyPaddingPx: 20,
      mobileDetailModalFullBleedPreserved: true,
      criticalCssAligned: true,
      stage60DestinationSearchCreateCtaPreserved: true,
    },
    assets: { cssObjectName, jsObjectName },
    names,
    files,
  };
  const runbook = Buffer.from([
    "# v60b 상품상세 모달 본문 상단 여백 복구",
    "",
    "PC 상품상세 전체 모달의 헤더 아래 본문 상단 여백을 20px로 복구합니다. 모바일의 전체 너비 이미지 구조는 기존 0px를 유지합니다.",
    "",
    "## 1. Cloud Shell 업로드 파일",
    "",
    `- ${names.css}`,
    `- ${names.js}`,
    `- ${names.cloudShellTest}`,
    "",
    `HTML은 ERP 편집기에서 ${names.deployHtml} 전체 내용으로 직접 교체합니다.`,
    "",
    "## 2. 검증",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.css} ${names.js} ${names.cloudShellTest}`,
    `node --test ${names.cloudShellTest}`,
    "```",
    "",
    "## 3. GCS 불변 자산 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"`,
    `curl -sSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/${cssObjectName}`,
    `curl -sSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 4. 운영 확인",
    "",
    "1. PC에서 상품상세 모달을 열고 헤더 구분선 아래부터 상품 이미지까지 20px 간격인지 확인합니다.",
    "2. 모바일에서는 상품 이미지 상단이 기존처럼 0px 전체 너비로 시작하는지 확인합니다.",
    "3. 여행지 검색의 일정 있음·없음 모임 만들기 UI가 유지되는지 확인합니다.",
    "",
    "## 5. 복구",
    "",
    `문제가 있으면 ERP 편집기를 ${names.rollbackHtml} 전체 내용으로 되돌립니다.`,
    "",
  ].join("\n"), "utf8");

  fs.mkdirSync(OUTPUT, { recursive: true });
  for (const [key, buffer] of Object.entries(buffers)) {
    fs.writeFileSync(path.join(OUTPUT, names[key]), buffer, { flag: "wx" });
  }
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ output: OUTPUT, manifest }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
}
