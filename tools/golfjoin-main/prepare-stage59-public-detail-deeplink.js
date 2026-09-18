"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage59-public-detail-deeplink/public-detail-deeplink-20260903-v59a");
const V58_ROOT = path.join(ROOT, "deploy/stage58-kakao-signup/kakao-signup-critical-path-20260903-v58a");
const BASELINE_HTML = path.join(V58_ROOT, "DEPLOY_golfjoin_main_kakao_signup_critical_path_8526DB12.html");
const BASELINE_JS = path.join(V58_ROOT, "UPLOAD_golfjoin-main_B1DEFB28.js.br");
const JAVASCRIPT_BUDGET = 220 * 1024;

const read = (target) => fs.readFileSync(target);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const PRIVATE_DETAIL_GATE = 'if(!getJoinLoginState().isLogin){const e=new URLSearchParams(location.search),t={joinId:e.get("joinId")||"",scheduleId:e.get("scheduleId")||"",productId:e.get("productId")||"",goodSeq:e.get("goodSeq")||"",eventSeq:e.get("eventSeq")||""};return clearJoinExternalDeepLinkTarget(),requireJoinLogin("detail",t),!0}';

function replaceOnce(source, before, after = "") {
  const first = source.indexOf(before);
  if (first < 0) throw new Error("public_detail_login_gate_missing");
  if (source.indexOf(before, first + before.length) >= 0) throw new Error("public_detail_login_gate_duplicated");
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function replaceJavascriptReference(html, objectName, integrity) {
  const pattern = /(<script\s+src=")https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[a-f0-9]+\/golfjoin-main\.js("\s+integrity=")[^"]+("[^>]*>)/;
  if (!pattern.test(html)) throw new Error("baseline_javascript_asset_reference_missing");
  return html.replace(pattern, `$1https://storage.googleapis.com/golfjoin-bucket/${objectName}$2${integrity}$3`);
}

function functionSlice(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end <= start) throw new Error(`function_slice_missing:${startToken}`);
  return source.slice(start, end);
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function buildContractTest(names, hashes, assetRevision, cloudShell = false) {
  const header = [
    '"use strict";',
    'const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");',
    'const file=(name)=>fs.readFileSync(path.join(__dirname,name));',
    'const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");',
    `const compressed=file(${JSON.stringify(names.js)}),js=zlib.brotliDecompressSync(compressed).toString("utf8");`,
    'const slice=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b)};'
  ];
  if (!cloudShell) {
    header.push(`const deploy=file(${JSON.stringify(names.deployHtml)}),rollback=file(${JSON.stringify(names.rollbackHtml)});`);
  }
  const tests = [
    `test("v59a ${cloudShell ? "Cloud Shell " : ""}JavaScript 해시와 문법이 유효하다",()=>{assert.equal(hash(compressed),${JSON.stringify(hashes.js)});new vm.Script(js)});`,
    'test("v59a 공개 상품상세 딥링크는 로그인 게이트 없이 직접 조회한다",()=>{const source=slice(js,"async function resumeJoinExternalDeepLinkOnce()","let joinExternalDeepLinkResumePromise");const a=source.indexOf("detail"),b=source.indexOf("my-section",a);assert.ok(a>=0&&b>a);const detail=source.slice(a,b);assert.doesNotMatch(detail,/requireJoinLogin\\(\"detail\"/);assert.doesNotMatch(detail,/getJoinLoginState\\(\\)\\.isLogin/);assert.match(detail,/initial-detail-deeplink/);assert.match(detail,/openJoinExternalDeepLinkDetailTarget/)});',
    'test("v59a 회원 전용 딥링크와 상세 내부 보호 동작은 유지한다",()=>{const source=slice(js,"async function resumeJoinExternalDeepLinkOnce()","let joinExternalDeepLinkResumePromise");assert.match(source,/requireJoinLogin\\(\"my-menu\"/);assert.match(source,/requireJoinLogin\\(\"my-section\"/);assert.match(js,/redirectToJoinLogin\\(\"detail-wish\"/);assert.match(js,/requireJoinLogin\\(\"apply\"/)});',
    'test("v59a는 v58 카카오 가입 단축 계약을 보존한다",()=>{assert.match(js,/member_kakao_signup_complete/);assert.match(js,/가입정보를 확인하고 있어요/);const signup=slice(js,"async function submitJoinMemberProfileOnly","async function submitJoinMemberSignup");assert.doesNotMatch(signup,/getJoinKakaoErpMemberAfterSignup/)});'
  ];
  if (!cloudShell) {
    tests.push(`test("v59a HTML은 새 자산을 가리키고 v58 운영본으로 복구한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.deployHtml)});assert.equal(hash(rollback),${JSON.stringify(hashes.rollbackHtml)});assert.match(deploy.toString("utf8"),/${assetRevision}/);assert.match(rollback.toString("utf8"),/gha_742a85824b8b154a3a724ddb/)});`);
  }
  return Buffer.from([...header, ...tests, ""].join("\n"), "utf8");
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const baselineHtml = read(BASELINE_HTML);
  const rollbackHtml = Buffer.from(baselineHtml);
  const baselineJsCompressed = read(BASELINE_JS);
  const baselineJs = zlib.brotliDecompressSync(baselineJsCompressed).toString("utf8");
  const jsSource = replaceOnce(baselineJs, PRIVATE_DETAIL_GATE);
  new vm.Script(jsSource, { filename: "golfjoin-main.v59a.min.js" });

  const deepLinkSource = functionSlice(
    jsSource,
    "async function resumeJoinExternalDeepLinkOnce()",
    "let joinExternalDeepLinkResumePromise"
  );
  if (/requireJoinLogin\("detail"/.test(deepLinkSource) || /getJoinLoginState\(\)\.isLogin/.test(
    deepLinkSource.slice(deepLinkSource.indexOf('"detail"'), deepLinkSource.indexOf('"my-section"'))
  )) throw new Error("public_detail_login_gate_still_present");
  for (const contract of [
    "initial-detail-deeplink",
    "loadGolfJoinProductDiscoveryDirect",
    "openJoinExternalDeepLinkDetailTarget",
    'requireJoinLogin("my-menu"',
    'requireJoinLogin("my-section"',
    'redirectToJoinLogin("detail-wish"',
    'requireJoinLogin("apply"',
    "member_kakao_signup_complete",
    "가입정보를 확인하고 있어요"
  ]) {
    if (!jsSource.includes(contract)) throw new Error(`javascript_contract_missing:${contract}`);
  }

  const logicalJs = Buffer.from(jsSource, "utf8");
  const assetRevision = `gha_${sha256(Buffer.concat([logicalJs, Buffer.from("\n--stage59a-public-detail-deeplink--\n")])).slice(0, 24)}`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const deployHtml = Buffer.from(
    replaceJavascriptReference(baselineHtml.toString("utf8"), jsObjectName, sriSha256(logicalJs)),
    "utf8"
  );
  const jsBrotli = zlib.brotliCompressSync(logicalJs, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_public_detail_deeplink_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    packageTest: "stage59a-public-detail-deeplink.test.js",
    cloudShellTest: "stage59a-public-detail-deeplink-cloudshell.test.js"
  };
  const hashes = {
    deployHtml: sha256(deployHtml),
    rollbackHtml: sha256(rollbackHtml),
    js: sha256(jsBrotli)
  };
  const buffers = { deployHtml, rollbackHtml, js: jsBrotli };
  buffers.packageTest = buildContractTest(names, hashes, assetRevision, false);
  buffers.cloudShellTest = buildContractTest(names, hashes, assetRevision, true);

  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "js" ? {
      objectName: jsObjectName,
      contentEncoding: "br",
      logicalSri: sriSha256(logicalJs)
    } : {})
  ]));
  const manifest = {
    schema: "golfjoin-stage59a-public-detail-deeplink-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    productionBaseline: "v58a",
    isolatedPatch: true,
    serverDeploymentRequired: false,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      anonymousProductDetailDeepLink: true,
      directProductDiscoveryLookupPreserved: true,
      protectedDetailActionsRemainAuthenticated: true,
      memberDeepLinksRemainAuthenticated: true,
      kakaoSignupCriticalPathPreserved: true,
      campaignQueryParametersPreserved: true
    },
    assets: { jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v59a 비로그인 광고 상품상세 딥링크",
    "",
    "현재 운영 v58a 자산에서 공개 상품상세의 로그인 강제 분기만 제거한 격리 패치입니다. Cloud Function 배포는 필요하지 않습니다.",
    "",
    "## 1. Cloud Shell 업로드 파일",
    "",
    `- ${names.js}`,
    `- ${names.cloudShellTest}`,
    "",
    `HTML은 서버에 업로드하지 않고 ERP 편집기에서 ${names.deployHtml} 전체 내용으로 직접 교체합니다.`,
    "",
    "## 2. 업로드 파일 검증",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.js} ${names.cloudShellTest}`,
    `node --test ${names.cloudShellTest}`,
    "```",
    "",
    "## 3. GCS JavaScript 업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type=\"application/javascript; charset=utf-8\" --content-encoding=br --cache-control=\"public, max-age=31536000, immutable\"`,
    `curl -sSI -H \"Accept-Encoding: br\" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 4. HTML 직접 교체",
    "",
    `ERP 편집기에서 ${names.deployHtml} 전체 내용으로 교체합니다.`,
    "",
    "## 5. 운영 확인",
    "",
    "1. 로그아웃 상태 또는 시크릿 창에서 광고 URL을 엽니다.",
    "2. 로그인 모달이 나오지 않고 지정 상품 상세가 열리는지 확인합니다.",
    "3. 상품상세의 참여 신청 또는 찜을 누르면 로그인 모달이 나오는지 확인합니다.",
    "4. URL에 utm_source, utm_medium, utm_campaign을 추가했을 때 상세가 열린 뒤에도 해당 값이 남는지 확인합니다.",
    "",
    "확인 URL:",
    "",
    "```text",
    "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1&golfjoinOpen=detail&goodSeq=30001104&eventSeq=30285516",
    "```",
    "",
    "## 6. 복구",
    "",
    `문제가 있으면 ERP 편집기 내용을 ${names.rollbackHtml} 전체 내용으로 되돌립니다. GCS의 기존 v58a 자산은 변경하지 않습니다.`,
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

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
}
