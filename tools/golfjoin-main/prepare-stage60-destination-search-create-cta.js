"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const OUTPUT = path.join(
  ROOT,
  "deploy/stage60-destination-search-create-cta/destination-search-create-cta-20260904-v60a"
);
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage59-public-detail-deeplink/public-detail-deeplink-20260903-v59a/DEPLOY_golfjoin_main_public_detail_deeplink_158E2AC6.html"
);
const JAVASCRIPT_BUDGET = 220 * 1024;
const RESERVED_WORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "implements", "import", "in", "instanceof",
  "interface", "let", "new", "null", "package", "private", "protected", "public",
  "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "yield"
]);

const read = (target) => fs.readFileSync(target);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function collectInlineHandlerNames(...sources) {
  const names = new Set();
  const attributePattern = /\bon[a-z]+\s*=\s*["']([\s\S]*?)["']/gi;
  const callPattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (const input of sources) {
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(String(input || "")))) {
      let callMatch;
      while ((callMatch = callPattern.exec(attributeMatch[1]))) {
        if (!RESERVED_WORDS.has(callMatch[1])) names.add(callMatch[1]);
      }
    }
  }
  return [...names].sort();
}

function buildInlineHandlerBridge(handlerNames) {
  if (!handlerNames.length) return "";
  return `\n;/* golfjoin-inline-handler-bridge */${handlerNames
    .map((name) => `typeof ${name}==="function"&&(window[${JSON.stringify(name)}]=${name});`)
    .join("")}\n`;
}

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

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function buildContractTest(names, hashes, assetRevision, cloudShell = false) {
  const lines = [
    '"use strict";',
    'const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");',
    'const file=(name)=>fs.readFileSync(path.join(__dirname,name));',
    'const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");',
    `const compressedCss=file(${JSON.stringify(names.css)}),compressedJs=file(${JSON.stringify(names.js)});`,
    'const css=zlib.gunzipSync(compressedCss).toString("utf8"),js=zlib.brotliDecompressSync(compressedJs).toString("utf8");'
  ];
  if (!cloudShell) {
    lines.push(`const deploy=file(${JSON.stringify(names.deployHtml)}),rollback=file(${JSON.stringify(names.rollbackHtml)});`);
  }
  lines.push(
    `test("v60a ${cloudShell ? "Cloud Shell " : ""}압축 자산 해시와 JavaScript 문법이 유효하다",()=>{assert.equal(hash(compressedCss),${JSON.stringify(hashes.css)});assert.equal(hash(compressedJs),${JSON.stringify(hashes.js)});new vm.Script(js)});`,
    'test("v60a 일정 유무에 같은 생성 안내 UI와 버튼 색상을 사용한다",()=>{["원하는 일정이 없나요?","아직 참여 가능한 모임이 없어요.","원하는 상품과 날짜로 직접 모임을 만들어 보세요.","다른 지역에서 바로 참여 가능한 모임","region-result-create-prompt","region-result-empty-action"].forEach((value)=>assert.ok(js.includes(value)));assert.match(css,/#regionSearchModal \\.region-result-empty-action\\s*\\{[\\s\\S]*?background:\\s*#54abff/);assert.match(css,/#regionSearchModal \\.region-result-create-prompt\\.is-after-results\\s*\\{[\\s\\S]*?margin-top:\\s*18px/)});',
    'test("v60a 지역·로그인 복귀·출발일 우선 생성 계약을 포함한다",()=>{["region-search","builderRegion","destination_search","regionDateFirstMode","loadGolfJoinProductDiscoveryRegion","returnDate","departureDate"].forEach((value)=>assert.ok(js.includes(value)))});',
    'test("v60a 비로그인 공개 상품상세와 카카오 가입 단축 계약을 유지한다",()=>{assert.ok(js.includes("initial-detail-deeplink"));assert.ok(js.includes("openJoinExternalDeepLinkDetailTarget"));assert.ok(js.includes("member_kakao_signup_complete"));assert.ok(js.includes("가입정보를 확인하고 있어요"))});'
  );
  if (!cloudShell) {
    lines.push(
      `test("v60a HTML은 신규 CSS·JS를 가리키고 v59 운영본으로 복구한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.deployHtml)});assert.equal(hash(rollback),${JSON.stringify(hashes.rollbackHtml)});assert.match(deploy.toString("utf8"),/${assetRevision}/);assert.match(rollback.toString("utf8"),/gha_[a-f0-9]+/) });`
    );
  }
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const sourceManifest = JSON.parse(read(SOURCE_MANIFEST).toString("utf8"));
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => /^source\/scripts\/.+\.js$/.test(value));
  const rawJs = Buffer.concat(scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath))));
  const css = read(path.join(SOURCE_ROOT, "source/styles/10-main.css"));
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v60a.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v60a.min.js" });

  for (const contract of [
    "원하는 일정이 없나요?",
    "아직 참여 가능한 모임이 없어요.",
    "원하는 상품과 날짜로 직접 모임을 만들어 보세요.",
    "다른 지역에서 바로 참여 가능한 모임",
    "region-result-create-prompt",
    "region-search",
    "builderRegion",
    "destination_search",
    "regionDateFirstMode",
    "loadGolfJoinProductDiscoveryRegion",
    "initial-detail-deeplink",
    "member_kakao_signup_complete"
  ]) {
    if (!js.includes(Buffer.from(contract))) throw new Error(`javascript_contract_missing:${contract}`);
  }
  for (const contract of [
    "#regionSearchModal .region-result-empty-action",
    "background: #54abff",
    "#regionSearchModal .region-result-create-prompt.is-after-results",
    "margin-top: 18px"
  ]) {
    if (!css.includes(Buffer.from(contract))) throw new Error(`css_contract_missing:${contract}`);
  }

  const assetRevision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--stage60a-destination-search-create-cta--\n")
  ])).slice(0, 24)}`;
  const cssObjectName = `web/home-assets/${assetRevision}/golfjoin-main.css`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  let deployText = rollbackHtml.toString("utf8");
  deployText = replaceAssetReference(deployText, "golfjoin-main.css", cssObjectName, sriSha256(css));
  deployText = replaceAssetReference(deployText, "golfjoin-main.js", jsObjectName, sriSha256(js));
  const deployHtml = Buffer.from(deployText, "utf8");

  const cssGzip = zlib.gzipSync(css, { level: 9, mtime: 0 });
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_destination_search_create_cta_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    packageTest: "stage60a-destination-search-create-cta.test.js",
    cloudShellTest: "stage60a-destination-search-create-cta-cloudshell.test.js"
  };
  const hashes = {
    deployHtml: sha256(deployHtml),
    rollbackHtml: sha256(rollbackHtml),
    css: sha256(cssGzip),
    js: sha256(jsBrotli)
  };
  const buffers = { deployHtml, rollbackHtml, css: cssGzip, js: jsBrotli };
  buffers.packageTest = buildContractTest(names, hashes, assetRevision, false);
  buffers.cloudShellTest = buildContractTest(names, hashes, assetRevision, true);

  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "css"
      ? { contentEncoding: "gzip", objectName: cssObjectName, logicalSri: sriSha256(css) }
      : key === "js" ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) } : {})
  ]));
  const manifest = {
    schema: "golfjoin-stage60a-destination-search-create-cta-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    productionBaseline: "v59a",
    serverDeploymentRequired: false,
    dashboardDeploymentRequired: false,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      sharedRegionCreatePrompt: true,
      existingScheduleCreatePrompt: true,
      emptyScheduleDynamicRegionCopy: true,
      emptyScheduleRecommendationTitleUpdated: true,
      existingEmptyStateButtonStyleReused: true,
      regionDateFirstBuilder: true,
      loginReturnRegionPreserved: true,
      destinationSearchAttribution: true,
      publicProductDetailDeepLinkPreserved: true
    },
    assets: { cssObjectName, jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v60a 여행지 검색 지역 모임 만들기 CTA",
    "",
    "여행지 검색의 일정 있음·없음 화면에 같은 생성 안내 UI를 적용하고, 선택 지역을 보존한 출발일 우선 생성 흐름으로 연결합니다. Cloud Function과 관리자 대시보드는 배포하지 않습니다.",
    "",
    "## 1. Cloud Shell 업로드 파일",
    "",
    `- ${names.css}`,
    `- ${names.js}`,
    `- ${names.cloudShellTest}`,
    "",
    `HTML은 서버에 업로드하지 않고 ERP 편집기에서 ${names.deployHtml} 전체 내용으로 직접 교체합니다.`,
    "",
    "## 2. 업로드 파일 검증",
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
    "## 4. HTML 직접 교체",
    "",
    `ERP 편집기에서 ${names.deployHtml} 전체 내용으로 교체합니다.`,
    "",
    "## 5. 운영 확인",
    "",
    "1. 일정이 있는 지역을 검색해 상품카드 아래에 기존 일정 없음 화면과 같은 배경·문구·파란 버튼이 표시되는지 확인합니다.",
    "2. 일정이 없는 지역을 검색해 `{지역}에는 아직 참여 가능한 모임이 없어요.`와 `{지역}에 모임 만들기`가 표시되는지 확인합니다.",
    "3. 추천 제목이 `다른 지역에서 바로 참여 가능한 모임`인지 확인합니다.",
    "4. 로그인 상태에서 버튼을 누르면 선택 지역이 유지되고 출발일 선택 화면이 열리는지 확인합니다.",
    "5. 로그아웃 상태에서 버튼을 누르고 로그인한 뒤에도 같은 지역의 출발일 선택 화면으로 복귀하는지 확인합니다.",
    "6. 출발일 선택 후 상품을 고르면 상품의 도착일이 자동 적용되는지 확인합니다.",
    "7. PC·모바일에서 버튼 색상·크기·간격이 기존 일정 없음 화면과 같은지 확인합니다.",
    "",
    "## 6. 복구",
    "",
    `문제가 있으면 ERP 편집기 내용을 ${names.rollbackHtml} 전체 내용으로 되돌립니다. 기존 v59a 불변 자산은 변경하지 않습니다.`,
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(OUTPUT, { recursive: true });
  for (const [key, buffer] of Object.entries(buffers)) {
    fs.writeFileSync(path.join(OUTPUT, names[key]), buffer, { flag: "wx" });
  }
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ output: OUTPUT, manifest }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
