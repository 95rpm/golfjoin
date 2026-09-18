"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const {
  IMMUTABLE_CACHE_CONTROL,
  buildExternalAssetBundle,
  sha256,
  sriSha256
} = require("./external-assets");
const {
  BROTLI_QUALITY,
  JAVASCRIPT_BUDGET_BYTES,
  EXPECTED_TERSER_VERSION,
  collectInlineHandlerNames,
  minifyJavaScript,
  brotliCompressJavaScript
} = require("./prepare-stage13-brotli-js");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_SOURCE_PACKAGE = path.join(
  WORKSPACE_ROOT,
  "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25"
);
const DEFAULT_OUTPUT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage15-sms-member-auth/all-home-settled-layout-20260818-v28"
);
const DEFAULT_MEMBER_SEQ = "30002219";
const DEFAULT_STAGING_EVENT_PLAN_SEQ = 28;

function assertInsideWorkspace(input, label) {
  const resolved = path.resolve(input);
  const relative = path.relative(WORKSPACE_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_workspace:${resolved}`);
  }
  return resolved;
}

function parseArgs(argv = []) {
  const options = {};
  for (const argument of argv) {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match) throw new Error(`unknown_argument:${argument}`);
    const [, name, value] = match;
    if (name === "source-package") options.sourcePackage = value;
    else if (name === "output") options.output = value;
    else if (name === "generated-at") options.generatedAt = value;
    else if (name === "member-seq") options.memberSeq = value;
    else if (name === "staging-event-plan-seq") options.stagingEventPlanSeq = Number(value);
    else throw new Error(`unknown_argument:${argument}`);
  }
  return options;
}

function readVerifiedFile(root, record, label) {
  if (!record?.fileName || !record.sha256) throw new Error(`${label}_record_invalid`);
  const filePath = path.resolve(root, record.fileName);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_package:${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  if (sha256(buffer) !== String(record.sha256).toLowerCase()) {
    throw new Error(`${label}_hash_mismatch`);
  }
  return buffer;
}

function replaceExact(source, target, replacement, expectedCount, label) {
  const count = String(source).split(target).length - 1;
  if (count !== expectedCount) throw new Error(`${label}_count_invalid:${count}`);
  return String(source).split(target).join(replacement);
}

function replaceAllRequired(source, target, replacement, label) {
  const count = String(source).split(target).length - 1;
  if (!count) throw new Error(`${label}_missing`);
  return { value: String(source).split(target).join(replacement), count };
}

function publicUrl(objectName) {
  const encodedObject = objectName.split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/golfjoin-bucket/${encodedObject}`;
}

function extractCriticalCssBlock(html) {
  const match = String(html).match(/<style data-golfjoin-critical-css="[^"]+">[\s\S]*?<\/style>/);
  if (!match) throw new Error("production_critical_css_missing");
  return match[0];
}

function verifyInlineScripts(html) {
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = pattern.exec(html))) {
    const source = match[1].trim();
    if (!source) continue;
    new vm.Script(source, { filename: `stage15-inline-${count + 1}.js` });
    count += 1;
  }
  return count;
}

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function writeExclusive(root, fileName, buffer) {
  fs.writeFileSync(path.join(root, fileName), buffer, { flag: "wx" });
}

function buildBrowserFlag(memberSeq) {
  return `<script data-golfjoin-member-sms-auth-rollout="all-home-v1">\n`
    + `window.GOLFJOIN_MEMBER_SMS_AUTH_ENABLED = true;\n`
    + `window.GOLFJOIN_MEMBER_SMS_AUTH_MEMBER_SEQS = [];\n`
    + `window.GOLFJOIN_MEMBER_SIGNUP_PHONE_AUTH_ENABLED = true;\n`
    + `</script>\n`;
}

async function buildStage15Candidate(rawOptions = {}) {
  const sourcePackage = assertInsideWorkspace(
    rawOptions.sourcePackage || DEFAULT_SOURCE_PACKAGE,
    "source_package"
  );
  const sourceManifestBuffer = fs.readFileSync(path.join(sourcePackage, "manifest.json"));
  const sourceManifest = JSON.parse(sourceManifestBuffer.toString("utf8"));
  if (sourceManifest.status !== "production-deployed-verified") {
    throw new Error(`source_package_not_production_verified:${sourceManifest.status || "missing"}`);
  }
  if (sourceManifest.files?.js?.contentEncoding !== "br"
    || sourceManifest.files?.css?.contentEncoding !== "gzip") {
    throw new Error("source_package_encoding_invalid");
  }
  const rollbackHtml = readVerifiedFile(sourcePackage, sourceManifest.files.deployHtml, "rollback_html");
  const memberSeq = String(rawOptions.memberSeq || DEFAULT_MEMBER_SEQ).trim();
  if (!/^\d+$/.test(memberSeq)) throw new Error("member_seq_invalid");

  const generatedAt = String(rawOptions.generatedAt || new Date().toISOString());
  const external = buildExternalAssetBundle({ contentEncoding: "gzip", generatedAt });
  const css = external.artifacts.css.buffer;
  const cssGzip = zlib.gzipSync(css, { level: 9, mtime: 0 });
  const rawJs = external.artifacts.js.buffer;
  const rawHtml = external.artifacts.html.buffer.toString("utf8");
  const inlineHandlerNames = collectInlineHandlerNames(rawHtml, rawJs.toString("utf8"));
  const minifiedJs = await minifyJavaScript(rawJs.toString("utf8"), {
    handlerNames: inlineHandlerNames
  });
  const jsBrotli = brotliCompressJavaScript(minifiedJs);
  if (!zlib.brotliDecompressSync(jsBrotli).equals(minifiedJs)) {
    throw new Error("javascript_brotli_roundtrip_failed");
  }
  if (jsBrotli.length > JAVASCRIPT_BUDGET_BYTES) {
    throw new Error(`javascript_brotli_budget_exceeded:${jsBrotli.length}`);
  }

  const revisionMaterial = Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    minifiedJs,
    Buffer.from("\n--golfjoin-delivery-css-gzip-js-br-v1--\n")
  ]);
  const assetRevision = `gha_${sha256(revisionMaterial).slice(0, 24)}`;
  const objectPrefix = `web/home-assets/${assetRevision}`;
  const cssObjectName = `${objectPrefix}/golfjoin-main.css`;
  const jsObjectName = `${objectPrefix}/golfjoin-main.js`;
  const cssUrl = publicUrl(cssObjectName);
  const jsUrl = publicUrl(jsObjectName);
  const cssSri = sriSha256(css);
  const jsSri = sriSha256(minifiedJs);

  let candidateHtml = replaceAllRequired(
    rawHtml,
    external.assetRevision,
    assetRevision,
    "external_asset_revision"
  ).value;
  candidateHtml = replaceExact(
    candidateHtml,
    external.publication.assets.js.logicalSri,
    jsSri,
    1,
    "javascript_sri"
  );
  const blockingCss = `<link rel="stylesheet" href="${cssUrl}" integrity="${cssSri}" crossorigin="anonymous" onerror="handleGolfJoinExternalAssetFailure('css')">`;
  const criticalCss = extractCriticalCssBlock(rollbackHtml.toString("utf8"));
  const deferredCss = `${criticalCss}\n`
    + `<link rel="preload" as="style" href="${cssUrl}" integrity="${cssSri}" crossorigin="anonymous" onload="this.onload=null;this.rel='stylesheet';document.documentElement.setAttribute('data-golfjoin-full-css','loaded')" onerror="handleGolfJoinExternalAssetFailure('css')">\n`
    + `<noscript><link rel="stylesheet" href="${cssUrl}" integrity="${cssSri}" crossorigin="anonymous"></noscript>`;
  candidateHtml = replaceExact(candidateHtml, blockingCss, deferredCss, 1, "critical_css_link");

  const mainScript = `<script src="${jsUrl}" integrity="${jsSri}" crossorigin="anonymous" onerror="handleGolfJoinExternalAssetFailure('js')">`;
  candidateHtml = replaceExact(
    candidateHtml,
    mainScript,
    `${buildBrowserFlag(memberSeq)}${mainScript}`,
    1,
    "member_auth_browser_flag"
  );
  if (!candidateHtml.includes('id="joinMemberOtpForm"')
    || !candidateHtml.includes("GOLFJOIN_MEMBER_SMS_AUTH_MEMBER_SEQS")
    || !candidateHtml.includes("GOLFJOIN_MEMBER_SIGNUP_PHONE_AUTH_ENABLED")
    || !candidateHtml.includes('id="joinMemberSignupPhoneSendButton"')) {
    throw new Error("member_auth_ui_missing");
  }
  const inlineScriptCount = verifyInlineScripts(candidateHtml);

  return {
    generatedAt,
    sourcePackage,
    sourceManifest,
    sourceManifestBuffer,
    rollbackHtml,
    memberSeq,
    stagingEventPlanSeq: Number(rawOptions.stagingEventPlanSeq || DEFAULT_STAGING_EVENT_PLAN_SEQ),
    css,
    cssGzip,
    rawJs,
    minifiedJs,
    jsBrotli,
    candidateHtml: Buffer.from(candidateHtml, "utf8"),
    assetRevision,
    inlineHandlerNames,
    inlineScriptCount,
    assets: {
      css: { objectName: cssObjectName, url: cssUrl, sri: cssSri },
      js: { objectName: jsObjectName, url: jsUrl, sri: jsSri }
    }
  };
}

function buildRunbook(candidate, names, hashes) {
  return [
    "# 15단계 일반회원 SMS 인증 전체 HOME 배포",
    "",
    "일반 ID/PW(HOME)는 기존 SMS 인증을 유지하고, 카카오 회원은 저장된 카카오 토큰을 서버에서 검증해 GolfJoin 세션으로 교환합니다.",
    "서버 Gate는 반드시 `off`로 유지합니다. 신규 카카오 가입 부트스트랩까지 확인하기 전에는 `enforce`를 켜지 않습니다.",
    `화면 문제가 생기면 ${names.rollbackHtml} 전체 내용으로 즉시 복구합니다.`,
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. 비공개 인증 버킷과 운영 환경변수를 준비한다.",
    "- [ ] 2. 서버 파일과 24시간 환경설정 파일을 해시 확인 후 교체한다.",
    "- [ ] 3. Aligo 비공개 함수, 메인 공개 함수를 차례대로 배포한다.",
    "- [ ] 4. 비로그인·HOME SMS·카카오 무문자 세션 교환을 각각 확인한다.",
    "- [ ] 5. GCS에 CSS gzip과 JavaScript Brotli를 신규 업로드한다.",
    `- [ ] 6. eventPlanSeq ${candidate.stagingEventPlanSeq}에서 일반회원 SMS 인증과 카카오 자동 세션 교환을 함께 검사한다.`,
    "- [ ] 7. 잘못된 번호·재전송·인증 전 새로고침 시 비로그인 전환·로그아웃을 검사한다.",
    "- [ ] 8. 운영 HTML을 교체하고 PC·모바일 핵심 기능을 재검사한다.",
    "- [ ] 9. Gate OFF와 HTML 복구 절차를 실제로 확인한다.",
    "",
    "## Cloud Shell 업로드 파일과 해시",
    "",
    "```text",
    `${names.serverIndex}  ${hashes.serverIndex}`,
    `${names.serverAuth}  ${hashes.serverAuth}`,
    `${names.serverKakaoAuth}  ${hashes.serverKakaoAuth}`,
    `${names.serverKakaoAuthTest}  ${hashes.serverKakaoAuthTest}`,
    `${names.serverAuthTest}  ${hashes.serverAuthTest}`,
    `${names.serverAuthBrowserTest}  ${hashes.serverAuthBrowserTest}`,
    `${names.serverAuthIntegrationTest}  ${hashes.serverAuthIntegrationTest}`,
    `${names.privateCacheTest}  ${hashes.privateCacheTest}`,
    `${names.configureEnv}  ${hashes.configureEnv}`,
    "```",
    "",
    "## 24시간 인증 환경설정",
    "",
    "```bash",
    `python3 ${names.configureEnv}`,
    "```",
    "",
    "이 스크립트는 일반회원 인증 세션을 24시간(86400초)으로 설정하고 Gate는 `off`로 유지합니다.",
    "카카오 공식 API가 확인한 app_id 906676만 허용하며 액세스 토큰 원문은 저장하거나 로그에 남기지 않습니다.",
    "인증번호를 입력하기 전에 새로고침하면 Secret Tour 로그인 쿠키를 지우고 비로그인 메인으로 이동합니다.",
    "신규 일반회원은 회원정보 입력 단계에서 휴대폰을 1회 인증하며, 인증번호 유효시간은 3분입니다.",
    "가입 저장 직전에 인증 증명을 서버에서 다시 확인하고, 가입 후 같은 인증으로 24시간 세션을 연결하므로 두 번째 문자는 발송하지 않습니다.",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "",
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "```",
    "",
    "## 테스트 게시판",
    "",
    `eventPlanSeq ${candidate.stagingEventPlanSeq}의 전체 HTML을 ${names.deployHtml} 내용으로 교체합니다.`,
    "일반 HOME 회원은 SMS 인증 대상이며, 카카오 회원은 SMS 화면 없이 member_kakao_auth_exchange 1회 후 기존 화면으로 진입해야 합니다.",
    "",
    "## 즉시 복구",
    "",
    "1. 인증 API만 중단: 메인 환경파일의 `GOLFJOIN_MEMBER_AUTH_ENABLED`를 `N`으로 바꾸고 메인 함수를 재배포합니다.",
    "2. 회원 API 보호 중단: `GOLFJOIN_MEMBER_AUTH_GATE=off`를 유지하거나 되돌립니다.",
    `3. 화면 복구: 운영 이벤트 HTML 전체를 ${names.rollbackHtml} 내용으로 교체합니다. GCS 불변 객체는 삭제하지 않습니다.`,
    ""
  ].join("\n");
}

async function prepareStage15Package(rawOptions = {}) {
  const output = assertInsideWorkspace(rawOptions.output || DEFAULT_OUTPUT, "output");
  if (fs.existsSync(output)) throw new Error(`output_already_exists:${output}`);
  const candidate = await buildStage15Candidate(rawOptions);
  const serverRoot = path.join(WORKSPACE_ROOT, "server/google-sheet-proxy-function");
  const serverFiles = {
    index: fs.readFileSync(path.join(serverRoot, "index.js")),
    auth: fs.readFileSync(path.join(serverRoot, "member-sms-auth.js")),
    kakaoAuth: fs.readFileSync(path.join(serverRoot, "member-kakao-auth.js")),
    kakaoAuthTest: fs.readFileSync(path.join(serverRoot, "member-kakao-auth.test.js")),
    authTest: fs.readFileSync(path.join(serverRoot, "member-sms-auth.test.js")),
    authBrowserTest: fs.readFileSync(path.join(serverRoot, "member-sms-auth-browser.test.js")),
    authIntegrationTest: fs.readFileSync(path.join(serverRoot, "member-sms-auth-integration.test.js")),
    privateCacheTest: fs.readFileSync(path.join(serverRoot, "private-cache-control.test.js")),
    configureEnv: fs.readFileSync(path.join(__dirname, "stage15-configure-env.py"))
  };
  const hashes = {
    serverIndex: sha256(serverFiles.index),
    serverAuth: sha256(serverFiles.auth),
    serverKakaoAuth: sha256(serverFiles.kakaoAuth),
    serverKakaoAuthTest: sha256(serverFiles.kakaoAuthTest),
    serverAuthTest: sha256(serverFiles.authTest),
    serverAuthBrowserTest: sha256(serverFiles.authBrowserTest),
    serverAuthIntegrationTest: sha256(serverFiles.authIntegrationTest),
    privateCacheTest: sha256(serverFiles.privateCacheTest),
    configureEnv: sha256(serverFiles.configureEnv)
  };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_sms_auth_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(candidate.rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    auditJs: `AUDIT_golfjoin-main_${sha256(candidate.minifiedJs).slice(0, 8).toUpperCase()}.min.js`,
    serverIndex: "stage20-index.js",
    serverAuth: "stage20-member-sms-auth.js",
    serverKakaoAuth: "stage20-member-kakao-auth.js",
    serverKakaoAuthTest: "stage20-member-kakao-auth.test.js",
    serverAuthTest: "stage20-member-sms-auth.test.js",
    serverAuthBrowserTest: "stage20-member-sms-auth-browser.test.js",
    serverAuthIntegrationTest: "stage20-member-sms-auth-integration.test.js",
    privateCacheTest: "stage20-private-cache-control.test.js",
    configureEnv: "stage20-configure-env.py"
  };
  const runbook = Buffer.from(buildRunbook(candidate, names, hashes), "utf8");
  const files = {
    deployHtml: fileRecord(names.deployHtml, candidate.candidateHtml),
    rollbackHtml: fileRecord(names.rollbackHtml, candidate.rollbackHtml),
    css: fileRecord(names.css, candidate.cssGzip, {
      logicalBytes: candidate.css.length,
      logicalSha256: sha256(candidate.css),
      sri: candidate.assets.css.sri,
      objectName: candidate.assets.css.objectName,
      url: candidate.assets.css.url,
      contentEncoding: "gzip"
    }),
    js: fileRecord(names.js, candidate.jsBrotli, {
      logicalBytes: candidate.minifiedJs.length,
      logicalSha256: sha256(candidate.minifiedJs),
      originalLogicalBytes: candidate.rawJs.length,
      originalLogicalSha256: sha256(candidate.rawJs),
      sri: candidate.assets.js.sri,
      objectName: candidate.assets.js.objectName,
      url: candidate.assets.js.url,
      contentEncoding: "br"
    }),
    auditJs: fileRecord(names.auditJs, candidate.minifiedJs),
    serverIndex: fileRecord(names.serverIndex, serverFiles.index),
    serverAuth: fileRecord(names.serverAuth, serverFiles.auth),
    serverKakaoAuth: fileRecord(names.serverKakaoAuth, serverFiles.kakaoAuth),
    serverKakaoAuthTest: fileRecord(names.serverKakaoAuthTest, serverFiles.kakaoAuthTest),
    serverAuthTest: fileRecord(names.serverAuthTest, serverFiles.authTest),
    serverAuthBrowserTest: fileRecord(names.serverAuthBrowserTest, serverFiles.authBrowserTest),
    serverAuthIntegrationTest: fileRecord(names.serverAuthIntegrationTest, serverFiles.authIntegrationTest),
    privateCacheTest: fileRecord(names.privateCacheTest, serverFiles.privateCacheTest),
    configureEnv: fileRecord(names.configureEnv, serverFiles.configureEnv),
    sourcePackageManifest: fileRecord("SOURCE_production_package_manifest.json", candidate.sourceManifestBuffer),
    runbook: fileRecord("RUNBOOK.md", runbook)
  };
  const manifest = {
    schema: "secret-golf-join-stage15-sms-member-auth-v1",
    preparedAt: candidate.generatedAt,
    status: "ready-for-local-verification",
    stagingEventPlanSeq: candidate.stagingEventPlanSeq,
    productionEventPlanSeq: 3,
    limitedMemberSeq: candidate.memberSeq,
    sourceAssetRevision: candidate.sourceManifest.assetRevision,
    assetRevision: candidate.assetRevision,
    memberAuthServerEnabledTarget: true,
    memberAuthGateTarget: "off",
    memberAuthSessionTtlSeconds: 86400,
    loginOtpTtlSeconds: 180,
    pendingAuthenticationRefreshBehavior: "logout-to-public-home",
    signupPhoneVerificationIncluded: true,
    signupPhoneOtpTtlSeconds: 180,
    kakaoEnforceReady: false,
    kakaoSessionExchangeIncluded: true,
    kakaoAllowedAppIds: ["906676"],
    minifier: {
      name: "terser",
      version: EXPECTED_TERSER_VERSION,
      inlineHandlerNames: candidate.inlineHandlerNames
    },
    delivery: { css: "gzip", javascript: "br", brotliQuality: BROTLI_QUALITY },
    javascriptBudgetBytes: JAVASCRIPT_BUDGET_BYTES,
    javascriptBrotliBytes: candidate.jsBrotli.length,
    javascriptBudgetPassed: candidate.jsBrotli.length <= JAVASCRIPT_BUDGET_BYTES,
    inlineScriptCount: candidate.inlineScriptCount,
    recoveryTargetMinutes: 5,
    files
  };

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.mkdirSync(output, { recursive: false });
  writeExclusive(output, names.deployHtml, candidate.candidateHtml);
  writeExclusive(output, names.rollbackHtml, candidate.rollbackHtml);
  writeExclusive(output, names.css, candidate.cssGzip);
  writeExclusive(output, names.js, candidate.jsBrotli);
  writeExclusive(output, names.auditJs, candidate.minifiedJs);
  writeExclusive(output, names.serverIndex, serverFiles.index);
  writeExclusive(output, names.serverAuth, serverFiles.auth);
  writeExclusive(output, names.serverKakaoAuth, serverFiles.kakaoAuth);
  writeExclusive(output, names.serverKakaoAuthTest, serverFiles.kakaoAuthTest);
  writeExclusive(output, names.serverAuthTest, serverFiles.authTest);
  writeExclusive(output, names.serverAuthBrowserTest, serverFiles.authBrowserTest);
  writeExclusive(output, names.serverAuthIntegrationTest, serverFiles.authIntegrationTest);
  writeExclusive(output, names.privateCacheTest, serverFiles.privateCacheTest);
  writeExclusive(output, names.configureEnv, serverFiles.configureEnv);
  writeExclusive(output, "SOURCE_production_package_manifest.json", candidate.sourceManifestBuffer);
  writeExclusive(output, "RUNBOOK.md", runbook);
  writeExclusive(output, "manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  return { outputRoot: output, manifest };
}

async function main() {
  const result = await prepareStage15Package(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_MEMBER_SEQ,
  DEFAULT_STAGING_EVENT_PLAN_SEQ,
  parseArgs,
  buildBrowserFlag,
  buildStage15Candidate,
  prepareStage15Package
};
