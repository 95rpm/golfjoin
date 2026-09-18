"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage58-kakao-signup/kakao-signup-critical-path-20260903-v58a");
const V56_ROOT = path.join(ROOT, "deploy/stage56-kakao-signup/kakao-signup-latency-20260902-v56b");
const ROLLBACK_HTML = path.join(V56_ROOT, "DEPLOY_golfjoin_main_kakao_signup_latency_349C7263.html");
const ROLLBACK_JS = path.join(V56_ROOT, "UPLOAD_golfjoin-main_6A2CCB59.js.br");
const ROLLBACK_SERVER = path.join(V56_ROOT, "stage56b-index.js");
const MEMBER_SOURCE = path.join(ROOT, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js");
const KAKAO_AUTH_SOURCE = path.join(ROOT, "server/google-sheet-proxy-function/member-kakao-auth.js");
const KAKAO_AUTH_TEST_SOURCE = path.join(ROOT, "server/google-sheet-proxy-function/member-kakao-auth.test.js");
const JAVASCRIPT_BUDGET = 220 * 1024;

const read = (target) => fs.readFileSync(target);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end <= start) throw new Error(`source_range_missing:${startToken}`);
  return source.slice(start, end);
}

function replaceRange(target, replacementSource, startToken, endToken) {
  const start = target.indexOf(startToken);
  const end = target.indexOf(endToken, start + startToken.length);
  if (start < 0 || end <= start) throw new Error(`target_range_missing:${startToken}`);
  return `${target.slice(0, start)}${sourceBetween(replacementSource, startToken, endToken)}${target.slice(end)}`;
}

function replaceJavascriptReference(html, objectName, integrity) {
  const pattern = /(<script\s+src=")https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[a-f0-9]+\/golfjoin-main\.js("\s+integrity=")[^"]+("[^>]*>)/;
  if (!pattern.test(html)) throw new Error("rollback_javascript_asset_reference_missing");
  return html.replace(pattern, `$1https://storage.googleapis.com/golfjoin-bucket/${objectName}$2${integrity}$3`);
}

function patchServerIndex(baseline) {
  const before = [
    "  persistVerifiedProfile: (context) => persistVerifiedKakaoSignupProfile(context),",
    "  issueVerifiedSession: (member) => golfjoinMemberSmsAuth.issueVerifiedSession(member)",
    "});"
  ].join("\n");
  const after = [
    "  persistVerifiedProfile: (context) => persistVerifiedKakaoSignupProfile(context),",
    "  issueVerifiedSession: (member) => golfjoinMemberSmsAuth.issueVerifiedSession(member),",
    "  recordMetrics: (metrics) => console.info(\"golfjoin_kakao_signup_completion\", metrics)",
    "});"
  ].join("\n");
  if (!baseline.includes(before)) throw new Error("stage56b_server_signup_constructor_missing");
  return baseline.replace(before, after);
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const memberSource = read(MEMBER_SOURCE).toString("utf8");
  let jsSource = zlib.brotliDecompressSync(read(ROLLBACK_JS)).toString("utf8");
  jsSource = replaceRange(
    jsSource,
    memberSource,
    "async function checkJoinMemberKakaoSignupDuplicates",
    "function buildJoinMemberKakaoSignupData"
  );
  jsSource = replaceRange(
    jsSource,
    memberSource,
    "async function submitJoinMemberProfileOnly",
    "async function submitJoinMemberSignup"
  );
  new vm.Script(jsSource, { filename: "golfjoin-main.v58a.source.js" });
  const minified = await terser.minify(jsSource, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v58a.min.js" });

  const completion = sourceBetween(
    js.toString("utf8"),
    "async function submitJoinMemberProfileOnly",
    "async function submitJoinMemberSignup"
  );
  if (completion.includes("getJoinKakaoErpMemberAfterSignup")) {
    throw new Error("browser_erp_recheck_still_in_critical_path");
  }
  for (const contract of [
    "가입정보를 확인하고 있어요.",
    "회원정보를 생성하고 있어요.",
    "로그인을 연결하고 있어요.",
    "member_kakao_signup_complete",
    "/member/saveExternalMember.json"
  ]) {
    if (!js.includes(Buffer.from(contract))) throw new Error(`javascript_contract_missing:${contract}`);
  }
  const duplicateCheck = sourceBetween(
    js.toString("utf8"),
    "async function checkJoinMemberKakaoSignupDuplicates",
    "function buildJoinMemberKakaoSignupData"
  );
  if (!duplicateCheck.includes("Promise.allSettled")) throw new Error("parallel_duplicate_check_missing");

  const serverIndex = Buffer.from(patchServerIndex(read(ROLLBACK_SERVER).toString("utf8")), "utf8");
  const kakaoAuth = read(KAKAO_AUTH_SOURCE);
  const kakaoAuthTest = Buffer.from(
    read(KAKAO_AUTH_TEST_SOURCE).toString("utf8").replace(
      'require("./member-kakao-auth")',
      'require("./stage58a-member-kakao-auth")'
    ),
    "utf8"
  );
  new vm.Script(serverIndex.toString("utf8"), { filename: "stage58a-index.js" });
  new vm.Script(kakaoAuth.toString("utf8"), { filename: "stage58a-member-kakao-auth.js" });
  for (const contract of [
    "Promise.all",
    "erpLookupAttempts",
    "profilePersistMs",
    "sessionIssueMs",
    "await persistVerifiedProfile",
    "await issueVerifiedSession"
  ]) {
    if (!kakaoAuth.includes(Buffer.from(contract))) throw new Error(`server_contract_missing:${contract}`);
  }
  if (!serverIndex.includes(Buffer.from("golfjoin_kakao_signup_completion"))) {
    throw new Error("server_metrics_logger_missing");
  }

  const assetRevision = `gha_${sha256(Buffer.concat([js, Buffer.from("\n--stage58a-kakao-signup-critical-path--\n")])).slice(0, 24)}`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  const deployHtml = Buffer.from(
    replaceJavascriptReference(rollbackHtml.toString("utf8"), jsObjectName, sriSha256(js)),
    "utf8"
  );
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_kakao_signup_critical_path_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    serverIndex: "stage58a-index.js",
    kakaoAuth: "stage58a-member-kakao-auth.js",
    kakaoAuthTest: "stage58a-member-kakao-auth.test.js",
    packageTest: "stage58a-kakao-signup-critical-path.test.js",
    cloudShellTest: "stage58a-kakao-signup-critical-path-cloudshell.test.js"
  };
  const buffers = { deployHtml, rollbackHtml, js: jsBrotli, serverIndex, kakaoAuth, kakaoAuthTest };

  buffers.packageTest = Buffer.from([
    '"use strict";',
    'const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");',
    'const file=(name)=>fs.readFileSync(path.join(__dirname,name));',
    'const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");',
    `const deploy=file(${JSON.stringify(names.deployHtml)}),rollback=file(${JSON.stringify(names.rollbackHtml)}),compressed=file(${JSON.stringify(names.js)}),server=file(${JSON.stringify(names.serverIndex)}).toString("utf8"),auth=file(${JSON.stringify(names.kakaoAuth)}).toString("utf8"),js=zlib.brotliDecompressSync(compressed).toString("utf8");`,
    'const between=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b)};',
    'test("v58a 배포 산출물 해시가 일치한다",()=>{',
    `assert.equal(hash(deploy),${JSON.stringify(sha256(deployHtml))});assert.equal(hash(rollback),${JSON.stringify(sha256(rollbackHtml))});assert.equal(hash(compressed),${JSON.stringify(sha256(jsBrotli))});assert.equal(hash(Buffer.from(server)),${JSON.stringify(sha256(serverIndex))});assert.equal(hash(Buffer.from(auth)),${JSON.stringify(sha256(kakaoAuth))});`,
    '});',
    'test("v58a 브라우저 최종 경로는 ERP 재조회를 제거하고 복구 경로를 유지한다",()=>{new vm.Script(js);const source=between(js,"async function submitJoinMemberProfileOnly","async function submitJoinMemberSignup");assert.doesNotMatch(source,/getJoinKakaoErpMemberAfterSignup/);assert.match(source,/finalizeJoinKakaoSignupAndContinue/);assert.match(source,/saveExternalMember\\.json/);assert.match(source,/가입정보를 확인하고 있어요/);assert.match(source,/회원정보를 생성하고 있어요/);assert.match(source,/로그인을 연결하고 있어요/)});',
    'test("v58a 중복 확인은 병렬이고 ID·휴대폰·이메일 우선순위를 유지한다",()=>{const source=between(js,"async function checkJoinMemberKakaoSignupDuplicates","function buildJoinMemberKakaoSignupData");assert.match(source,/Promise\\.allSettled/);assert.match(source,/rejected/);const a=source.indexOf("id"),b=source.indexOf("mobile",a),c=source.indexOf("email",b);assert.ok(a>=0&&b>a&&c>b)});',
    'test("v58a 서버 검증은 병렬이고 프로필 저장 뒤 세션을 발급한다",()=>{new vm.Script(auth);assert.match(auth,/Promise\\.all/);const a=auth.indexOf("await persistVerifiedProfile"),b=auth.indexOf("await issueVerifiedSession",a);assert.ok(a>=0&&b>a);assert.match(auth,/erpLookupAttempts/);assert.match(server,/golfjoin_kakao_signup_completion/)});',
    'test("v58a는 v56b 운영 HTML만 롤백 기준으로 사용한다",()=>{assert.match(rollback.toString("utf8"),/gha_1d89b64124ca9a47190d9a98/);assert.match(deploy.toString("utf8"),/' + assetRevision + '/)});',
    ''
  ].join("\n"), "utf8");

  buffers.cloudShellTest = Buffer.from([
    '"use strict";',
    'const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");',
    'const file=(name)=>fs.readFileSync(path.join(__dirname,name));',
    'const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");',
    `const compressed=file(${JSON.stringify(names.js)}),server=file(${JSON.stringify(names.serverIndex)}),auth=file(${JSON.stringify(names.kakaoAuth)}),js=zlib.brotliDecompressSync(compressed).toString("utf8");`,
    'const between=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b)};',
    'test("v58a Cloud Shell 실행 파일 해시가 일치한다",()=>{',
    `assert.equal(hash(compressed),${JSON.stringify(sha256(jsBrotli))});assert.equal(hash(server),${JSON.stringify(sha256(serverIndex))});assert.equal(hash(auth),${JSON.stringify(sha256(kakaoAuth))});`,
    '});',
    'test("v58a Cloud Shell 자산은 브라우저 ERP 재조회 제거와 복구 경로를 포함한다",()=>{new vm.Script(js);const source=between(js,"async function submitJoinMemberProfileOnly","async function submitJoinMemberSignup");assert.doesNotMatch(source,/getJoinKakaoErpMemberAfterSignup/);assert.match(source,/finalizeJoinKakaoSignupAndContinue/);assert.match(source,/saveExternalMember\\.json/);assert.match(source,/로그인을 연결하고 있어요/)});',
    'test("v58a Cloud Shell 자산은 병렬 중복 확인과 판정 우선순위를 포함한다",()=>{const source=between(js,"async function checkJoinMemberKakaoSignupDuplicates","function buildJoinMemberKakaoSignupData");assert.match(source,/Promise\\.allSettled/);assert.match(source,/rejected/);const a=source.indexOf("id"),b=source.indexOf("mobile",a),c=source.indexOf("email",b);assert.ok(a>=0&&b>a&&c>b)});',
    'test("v58a Cloud Shell 서버는 병렬 카카오 검증·안전한 저장 순서·PII 없는 지표를 포함한다",()=>{const serverText=server.toString("utf8"),authText=auth.toString("utf8");new vm.Script(serverText);new vm.Script(authText);assert.match(authText,/Promise\\.all/);const a=authText.indexOf("await persistVerifiedProfile"),b=authText.indexOf("await issueVerifiedSession",a);assert.ok(a>=0&&b>a);assert.match(authText,/erpLookupAttempts/);assert.match(serverText,/golfjoin_kakao_signup_completion/)});',
    ''
  ].join("\n"), "utf8");

  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "js" ? {
      objectName: jsObjectName,
      contentEncoding: "br",
      logicalSri: sriSha256(js)
    } : {})
  ]));
  const manifest = {
    schema: "golfjoin-stage58a-kakao-signup-critical-path-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    isolatedFromDeferredStage57: true,
    rollbackBaseline: "v56b",
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      browserErpPrecheckRemoved: true,
      browserErpPostcheckRemoved: true,
      duplicateChecksParallel: true,
      kakaoVerificationParallel: true,
      piiFreeStageMetrics: true,
      profileBeforeSessionPreserved: true,
      responseLossRecoveryPreserved: true,
      realSignupTestRequired: false
    },
    assets: { jsObjectName },
    names,
    files
  };

  const uploadNames = [names.js, names.serverIndex, names.kakaoAuth, names.kakaoAuthTest, names.cloudShellTest];
  const runbook = Buffer.from([
    "# v58a 카카오 회원가입 최종 경로 단축",
    "",
    "실가입·탈퇴 반복 없이 시뮬레이션과 정적 계약으로 검증합니다. v57 미배포 변경은 포함하지 않으며 v56b 운영본을 기준으로 패치했습니다.",
    "",
    "## 1. Cloud Shell 업로드 파일",
    "",
    ...uploadNames.map((name) => `- ${name}`),
    "",
    `HTML은 서버에 업로드하지 않고 ERP 편집기에서 ${names.deployHtml} 전체 내용으로 직접 교체합니다.`,
    "",
    "## 2. 서버 백업·교체·검증",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "cp -f index.js BACKUP_pre_stage58a_index.js",
    "cp -f member-kakao-auth.js BACKUP_pre_stage58a_member-kakao-auth.js",
    `sha256sum ${uploadNames.join(" \\\n  ")}`,
    `cp -f ${names.serverIndex} index.js`,
    `cp -f ${names.kakaoAuth} member-kakao-auth.js`,
    "node --check index.js",
    "node --check member-kakao-auth.js",
    `node --test ${names.kakaoAuthTest} ${names.cloudShellTest}`,
    "```",
    "",
    `\`${names.packageTest}\`는 HTML·복구 HTML까지 확인하는 로컬 패키지 전용이므로 Cloud Shell에서는 실행하지 않습니다.`,
    "",
    "## 3. Cloud Function 배포",
    "",
    "```bash",
    "PREVIOUS_STAGE58A_REVISION=\"$(gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='value(serviceConfig.revision)')\"",
    "printf 'PREVIOUS_STAGE58A_REVISION=%s\\n' \"$PREVIOUS_STAGE58A_REVISION\"",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "gcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest",
    "gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(state,updateTime,serviceConfig.revision,serviceConfig.uri)'",
    "gcloud run services describe golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(status.latestCreatedRevisionName,status.latestReadyRevisionName,status.traffic)'",
    "```",
    "",
    "## 4. GCS JavaScript 업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type=\"application/javascript; charset=utf-8\" --content-encoding=br --cache-control=\"public, max-age=31536000, immutable\"`,
    `curl -sSI -H \"Accept-Encoding: br\" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 5. HTML 직접 교체 및 무가입 회귀 확인",
    "",
    `ERP 편집기에서 ${names.deployHtml} 전체 내용으로 교체합니다.`,
    "",
    "1. 비로그인 메인·상품상세·로그인 모달을 확인합니다.",
    "2. 기존 카카오 회원 로그인·새로고침·로그아웃을 확인합니다.",
    "3. 일반회원 로그인을 확인합니다.",
    "4. 가입·탈퇴 반복은 하지 않습니다. 다음 자연 신규가입 1건에서 진행 문구와 최종 체감만 확인합니다.",
    "5. 자연 신규가입 후 아래 로그에서 totalMs와 가장 큰 단계를 확인합니다.",
    "",
    "```bash",
    "gcloud logging read 'resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"golfjoin-sheet-api\" AND textPayload:\"golfjoin_kakao_signup_completion\"' --project=golfjoin-499602 --limit=20 --freshness=24h --format='value(textPayload)'",
    "```",
    "",
    "## 6. 복구",
    "",
    `HTML은 ${names.rollbackHtml} 전체 내용으로 되돌립니다.`,
    "",
    "```bash",
    "gcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-revisions=PREVIOUS_REVISION_NAME=100",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "cp -f BACKUP_pre_stage58a_index.js index.js",
    "cp -f BACKUP_pre_stage58a_member-kakao-auth.js member-kakao-auth.js",
    "```",
    "",
    "`PREVIOUS_REVISION_NAME`은 3단계에서 출력된 실제 리비전명으로 바꿉니다.",
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
