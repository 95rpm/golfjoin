"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(
  ROOT,
  "deploy/stage40-kakao-resignup/kakao-first-signup-server-derived-20260831-v40j"
);
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage40-kakao-resignup/kakao-first-signup-atomic-20260831-v40h/DEPLOY_golfjoin_main_kakao_first_signup_atomic_501BD06A.html"
);
const ROLLBACK_SERVER_ROOT = path.join(
  ROOT,
  "deploy/stage40-kakao-resignup/kakao-first-signup-atomic-20260831-v40h"
);
const JAVASCRIPT_BUDGET = 216 * 1024;
const ANALYTICS_SOURCE = "source/scripts/analytics/30-ga4-events.js";
const ANALYTICS_NOOP_BRIDGE = `
/* GA4 remains inactive in the stage40 Kakao signup atomic rollout. */
function trackGolfJoinGa4Event() {}
function getGolfJoinGa4Item(join = {}) {
  return {
    item_id: String(join.id || ""),
    item_name: String(join.title || ""),
    item_category: String(join.region || join.country || "")
  };
}
window.trackGolfJoinGa4Event = trackGolfJoinGa4Event;
window.getGolfJoinGa4Item = getGolfJoinGa4Item;
`;
const RESERVED_WORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "implements", "import", "in", "instanceof",
  "interface", "let", "new", "null", "package", "private", "protected", "public",
  "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "yield"
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function read(target) {
  return fs.readFileSync(target);
}

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

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function assertContains(buffer, text, code) {
  if (!buffer.includes(Buffer.from(text))) throw new Error(code);
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const sourceManifest = JSON.parse(read(SOURCE_MANIFEST).toString("utf8"));
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => (
    /^source\/scripts\/.+\.js$/.test(value) && value !== ANALYTICS_SOURCE
  ));
  const rawJs = Buffer.concat([
    Buffer.from(ANALYTICS_NOOP_BRIDGE, "utf8"),
    ...scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath)))
  ]);
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v40j.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v40j.min.js" });
  assertContains(js, "member_kakao_signup_complete", "kakao_signup_complete_action_missing");
  assertContains(js, "profilePayload", "atomic_profile_payload_missing");
  assertContains(js, "serverFinalized", "server_finalized_result_missing");
  assertContains(js, "joinPendingKakaoProfile", "signup_resume_draft_missing");
  assertContains(js, "getMemberExternalLoginCheck.json", "erp_resume_probe_missing");
  assertContains(js, "Kakao signup server recovery after ERP save response failed.", "server_recovery_fallback_missing");

  const serverIndex = read(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
  const serverKakaoAuth = read(path.join(ROOT, "server/google-sheet-proxy-function/member-kakao-auth.js"));
  const serverKakaoAuthTest = read(path.join(ROOT, "server/google-sheet-proxy-function/member-kakao-auth.test.js"));
  const serverSimulationTest = read(path.join(ROOT, "server/google-sheet-proxy-function/member-kakao-first-signup-simulation.test.js"));
  const rollbackIndex = read(path.join(ROLLBACK_SERVER_ROOT, "stage40h-index.js"));
  const rollbackKakaoAuth = read(path.join(ROLLBACK_SERVER_ROOT, "stage40h-member-kakao-auth.js"));
  assertContains(serverIndex, "persistVerifiedKakaoSignupProfile", "server_atomic_profile_writer_missing");
  assertContains(serverIndex, "member-kakao-signup:", "server_signup_lock_missing");
  assertContains(serverKakaoAuth, "persistVerifiedProfile", "server_profile_before_session_missing");
  assertContains(serverKakaoAuth, "(!memberSeq || text(candidate.custSeq) === memberSeq)", "server_member_seq_derivation_missing");
  new vm.Script(serverIndex.toString("utf8"), { filename: "stage40j-index.js" });
  new vm.Script(serverKakaoAuth.toString("utf8"), { filename: "stage40j-member-kakao-auth.js" });

  const assetRevision = `gha_${sha256(Buffer.concat([
    js,
    Buffer.from("\n--stage40j-kakao-first-signup-server-derived--\n")
  ])).slice(0, 24)}`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  const scriptPattern = /(<script\s+src=")https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[a-f0-9]+\/golfjoin-main\.js("\s+integrity=")[^"]+("[^>]*>)/;
  if (!scriptPattern.test(rollbackHtml.toString("utf8"))) {
    throw new Error("rollback_javascript_asset_reference_missing");
  }
  const deployHtml = Buffer.from(
    rollbackHtml.toString("utf8").replace(
      scriptPattern,
      `$1https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}$2${sriSha256(js)}$3`
    ),
    "utf8"
  );
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) {
    throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);
  }

  const buffers = {
    deployHtml,
    rollbackHtml,
    js: jsBrotli,
    serverIndex,
    serverKakaoAuth,
    serverKakaoAuthTest,
    serverSimulationTest,
    rollbackIndex,
    rollbackKakaoAuth
  };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_kakao_first_signup_server_derived_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    serverIndex: "stage40j-index.js",
    serverKakaoAuth: "stage40j-member-kakao-auth.js",
    serverKakaoAuthTest: "stage40j-member-kakao-auth.test.js",
    serverSimulationTest: "stage40j-member-kakao-first-signup-simulation.test.js",
    rollbackIndex: "ROLLBACK_stage40h-index.js",
    rollbackKakaoAuth: "ROLLBACK_stage40h-member-kakao-auth.js"
  };
  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "js"
      ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) }
      : {})
  ]));

  const manifest = {
    schema: "golfjoin-stage40-kakao-first-signup-server-derived-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    stagingEventPlanSeq: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      erpNewKakaoSignup: true,
      verifiedProfileAtomicPersistence: true,
      profilePersistenceBeforeSession: true,
      erpPropagationRetry: true,
      idempotentProfileUpsert: true,
      interruptedSignupResume: true,
      staleProfileCacheIsolation: true,
      browserErpRecheckOptional: true,
      serverMemberSeqResolution: true,
      cssRedeployRequired: false,
      dashboardRedeployRequired: false,
      ga4TrackingActivatedByThisRelease: false
    },
    assets: { jsObjectName },
    names,
    files
  };

  const serverUploadNames = [
    names.serverIndex,
    names.serverKakaoAuth,
    names.serverKakaoAuthTest,
    names.serverSimulationTest,
    names.rollbackIndex,
    names.rollbackKakaoAuth
  ];
  const runbook = Buffer.from([
    "# 40j ERP 미가입 카카오 최초가입 서버 최종 확정",
    "",
    "배포 순서: 서버 → GCS JavaScript → ERP 29번 HTML 직접 교체 → 시험 → 운영 HTML 직접 교체",
    "",
    "## 1. Cloud Shell 업로드",
    "",
    `Cloud Shell 작업 폴더에는 JavaScript와 서버 파일만 업로드합니다. HTML은 편집기에서 직접 교체합니다.`,
    "",
    ...[names.js, ...serverUploadNames].map((name) => `- ${name}`),
    "",
    "## 2. 해시 확인·서버 교체·테스트",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${[names.js, ...serverUploadNames].join(" \\\n  ")}`,
    `cp -f ${names.serverIndex} index.js`,
    `cp -f ${names.serverKakaoAuth} member-kakao-auth.js`,
    `cp -f ${names.serverKakaoAuthTest} member-kakao-auth.test.js`,
    `cp -f ${names.serverSimulationTest} member-kakao-first-signup-simulation.test.js`,
    "node --check index.js",
    "node --check member-kakao-auth.js",
    "node --test member-kakao-auth.test.js member-kakao-first-signup-simulation.test.js",
    "npm test",
    "```",
    "",
    "## 3. 서버 배포",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "PREVIOUS_STAGE40J_REVISION=\"$(gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='value(serviceConfig.revision)')\"",
    "printf 'PREVIOUS_STAGE40J_REVISION=%s\\n' \"$PREVIOUS_STAGE40J_REVISION\"",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "gcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest",
    "gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(state,updateTime,serviceConfig.revision,serviceConfig.environmentVariables.GOLFJOIN_MEMBER_AUTH_GATE,serviceConfig.uri)'",
    "gcloud run services describe golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(status.latestReadyRevisionName,status.traffic)'",
    "```",
    "",
    "## 4. GCS 불변 JavaScript 업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"`,
    `curl -sSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 5. 29번 HTML 직접 교체·시험",
    "",
    `편집기에서 29번 테스트 페이지 HTML 전체를 \`${names.deployHtml}\` 내용으로 교체합니다.`,
    "",
    "1. ERP에 없는 시험용 카카오 계정으로 카카오 가입을 시작합니다.",
    "2. 약관과 추가정보를 입력하고 완료합니다.",
    "3. ERP에 회원 1건, join_member_profiles에 profileStatus=active인 1행이 생성됐는지 확인합니다.",
    "4. Network에서 saveExternalMember.json 뒤 member_kakao_signup_complete가 반드시 호출되고 200인지 확인합니다. getMemberExternalLoginCheck.json이 실패해도 가입 완료 요청은 계속되어야 합니다.",
    "5. 별도 member_profile_upsert 중복 요청이 없고 member_kakao_signup_complete 응답 profile.profileStatus가 active인지 확인합니다.",
    "6. 새로고침 후 member_kakao_auth_exchange 200, 추가정보·생년월일 모달 미노출을 확인합니다.",
    "7. 기존 카카오·일반·비로그인 메인, 나의모임, 내예약 회귀를 확인합니다.",
    "8. 모두 정상이면 운영 HTML도 같은 파일로 직접 교체합니다.",
    "",
    "## 6. 서버 복구",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `cp -f ${names.rollbackIndex} index.js`,
    `cp -f ${names.rollbackKakaoAuth} member-kakao-auth.js`,
    "node --check index.js",
    "node --check member-kakao-auth.js",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "gcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest",
    "```",
    "",
    `HTML 복구는 \`${names.rollbackHtml}\` 내용을 편집기에 직접 적용합니다.`,
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(OUTPUT, { recursive: true });
  Object.entries(buffers).forEach(([key, buffer]) => {
    fs.writeFileSync(path.join(OUTPUT, names[key]), buffer, { flag: "wx" });
  });
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ output: OUTPUT, manifest }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
