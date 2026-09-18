"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage56-kakao-signup/kakao-signup-latency-20260902-v56b");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage55-main/golfjoin-flight-calendar-normalization-20260902-v55c/DEPLOY_golfjoin_main_flight_calendar_3F0824AB.html"
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

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const read = (target) => fs.readFileSync(target);

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

function replaceJavascriptReference(html, objectName, integrity) {
  const pattern = /(<script\s+src=")https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[a-f0-9]+\/golfjoin-main\.js("\s+integrity=")[^"]+("[^>]*>)/;
  if (!pattern.test(html)) throw new Error("rollback_javascript_asset_reference_missing");
  return html.replace(
    pattern,
    `$1https://storage.googleapis.com/golfjoin-bucket/${objectName}$2${integrity}$3`
  );
}

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end <= start) throw new Error(`source_range_missing:${startToken}`);
  return source.slice(start, end);
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const sourceManifest = JSON.parse(read(SOURCE_MANIFEST).toString("utf8"));
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => /^source\/scripts\/.+\.js$/.test(value));
  const rawJs = Buffer.concat(scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath))));
  const rawSource = rawJs.toString("utf8");
  const signupCompletionSource = sourceBetween(
    rawSource,
    "async function saveJoinMemberKakaoProfileAndContinue",
    "function buildJoinMemberProfilePayload"
  );
  if (signupCompletionSource.includes("promptJoinPendingRosterCandidates")) {
    throw new Error("signup_completion_still_waits_for_pending_roster");
  }
  if (!rawSource.includes('await promptJoinPendingRosterCandidates({ source: "my-reservations" })')) {
    throw new Error("my_reservations_reconciliation_trigger_missing");
  }

  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawSource);
  const bridged = `${rawSource}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v56b.source.js" });
  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v56b.min.js" });

  const minifiedSignupCompletion = sourceBetween(
    js.toString("utf8"),
    "async function saveJoinMemberKakaoProfileAndContinue",
    "function buildJoinMemberProfilePayload"
  );
  if (minifiedSignupCompletion.includes("promptJoinPendingRosterCandidates")) {
    throw new Error("minified_signup_completion_still_waits_for_pending_roster");
  }
  for (const needle of [
    "member_kakao_signup_complete",
    "serverFinalized",
    "golfjoin_destination_search_open",
    "golfjoin_apply_step_view",
    "golfjoin_create_step_view",
    "singleRoomSurcharge"
  ]) {
    if (!js.includes(Buffer.from(needle))) throw new Error(`javascript_contract_missing:${needle}`);
  }

  const serverIndex = read(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
  const reconciliationModule = read(path.join(ROOT, "server/google-sheet-proxy-function/member-profile-reconciliation.js"));
  const reconciliationTest = Buffer.from(
    read(path.join(ROOT, "server/google-sheet-proxy-function/member-profile-reconciliation.test.js"))
      .toString("utf8")
      .replace(
        'require("./member-profile-reconciliation")',
        'require("./stage56b-member-profile-reconciliation")'
      ),
    "utf8"
  );
  new vm.Script(serverIndex.toString("utf8"), { filename: "stage56b-index.js" });
  new vm.Script(reconciliationModule.toString("utf8"), { filename: "stage56b-member-profile-reconciliation.js" });
  for (const needle of [
    'require("./member-profile-reconciliation")',
    "deferApplicationSync: true",
    "reconciliationState",
    "reconciliationRevision",
    "reconcilePendingMemberProfileApplications(identity)"
  ]) {
    if (!serverIndex.includes(Buffer.from(needle))) throw new Error(`server_contract_missing:${needle}`);
  }

  const assetRevision = `gha_${sha256(Buffer.concat([
    js,
    Buffer.from("\n--stage56b-kakao-signup-latency--\n")
  ])).slice(0, 24)}`;
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
    deployHtml: `DEPLOY_golfjoin_main_kakao_signup_latency_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    serverIndex: "stage56b-index.js",
    reconciliationModule: "stage56b-member-profile-reconciliation.js",
    reconciliationTest: "stage56b-member-profile-reconciliation.test.js",
    packageTest: "stage56b-kakao-signup-latency.test.js"
  };
  const buffers = {
    deployHtml,
    rollbackHtml,
    js: jsBrotli,
    serverIndex,
    reconciliationModule,
    reconciliationTest
  };

  buffers.packageTest = Buffer.from([
    '"use strict";',
    "",
    'const assert = require("node:assert/strict");',
    'const crypto = require("node:crypto");',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const test = require("node:test");',
    'const vm = require("node:vm");',
    'const zlib = require("node:zlib");',
    "",
    'const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");',
    `const deploy = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.deployHtml)}));`,
    `const rollback = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.rollbackHtml)}));`,
    `const compressedJs = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.js)}));`,
    `const server = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.serverIndex)}), "utf8");`,
    `const reconciliation = fs.readFileSync(path.join(__dirname, ${JSON.stringify(names.reconciliationModule)}), "utf8");`,
    'const js = zlib.brotliDecompressSync(compressedJs).toString("utf8");',
    "",
    'test("v56b 산출물 해시가 일치한다", () => {',
    `  assert.equal(sha256(deploy), ${JSON.stringify(sha256(deployHtml))});`,
    `  assert.equal(sha256(rollback), ${JSON.stringify(sha256(rollbackHtml))});`,
    `  assert.equal(sha256(compressedJs), ${JSON.stringify(sha256(jsBrotli))});`,
    `  assert.equal(sha256(Buffer.from(server)), ${JSON.stringify(sha256(serverIndex))});`,
    `  assert.equal(sha256(Buffer.from(reconciliation)), ${JSON.stringify(sha256(reconciliationModule))});`,
    "});",
    "",
    'test("v56b 브라우저 가입 완료는 과거 신청 후보를 기다리지 않는다", () => {',
    '  new vm.Script(js, { filename: "golfjoin-main.v56b.js" });',
    '  const start = js.indexOf("async function saveJoinMemberKakaoProfileAndContinue");',
    '  const end = js.indexOf("function buildJoinMemberProfilePayload", start);',
    '  assert.ok(start >= 0 && end > start);',
    '  assert.doesNotMatch(js.slice(start, end), /promptJoinPendingRosterCandidates/);',
    '  assert.match(js, /member_kakao_signup_complete/);',
    "});",
    "",
    'test("v56b 서버는 핵심 저장 후 신청서 동기화를 pending으로 분리한다", () => {',
    '  new vm.Script(server, { filename: "stage56b-index.js" });',
    '  assert.match(server, /deferApplicationSync: true/);',
    '  assert.match(server, /buildPendingReconciliationFields/);',
    '  assert.match(server, /reconciliationRevision/);',
    '  assert.ok(server.includes("reconcilePendingMemberProfileApplications(identity)"));',
    '  assert.match(server, /claimAdminRosterApplicationsForProfile/);',
    "});",
    "",
    'test("v56b 후속 동기화는 작업 버전·재시도·오류 코드 상태를 가진다", () => {',
    '  new vm.Script(reconciliation, { filename: "stage56b-member-profile-reconciliation.js" });',
    '  ["reconciliationState", "reconciliationRevision", "reconciliationAttempts", "reconciliationNextAt", "reconciliationErrorCode", "reconciliationUpdatedAt"].forEach((value) => assert.match(reconciliation, new RegExp(value)));',
    '  assert.match(reconciliation, /canCommitReconciliationResult/);',
    "});",
    "",
    'test("v56b HTML은 신규 불변 JavaScript와 SRI를 참조한다", () => {',
    `  assert.match(deploy.toString("utf8"), /${assetRevision}/);`,
    `  assert.match(deploy.toString("utf8"), /${sriSha256(js).replace(/[\-\/\\^$*+?.()|[\]{}]/g, "\\$&")}/);`,
    "});",
    ""
  ].join("\n"), "utf8");

  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "js"
      ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) }
      : {})
  ]));
  const manifest = {
    schema: "golfjoin-stage56b-kakao-signup-latency-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      signupCriticalPathApplicationSyncRemoved: true,
      pendingRosterPromptMovedToMyReservations: true,
      durableReconciliationState: true,
      revisionGuardedIdempotentRetry: true,
      adminRosterClaimRemainsSynchronous: true,
      verifiedProfileBeforeSessionPreserved: true,
      realSignupTestRequired: false,
      cssRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { jsObjectName },
    names,
    files
  };

  const uploadNames = [
    names.js,
    names.serverIndex,
    names.reconciliationModule,
    names.reconciliationTest,
    names.packageTest
  ];
  const runbook = Buffer.from([
    "# v56b 카카오 신규가입 완료 지연 분리",
    "",
    "실가입·탈퇴 반복 없이 정적 계약과 상태 시뮬레이션으로 검증합니다.",
    "배포 순서: 서버 → GCS JavaScript → ERP HTML 직접 교체 → 기존 계정 회귀 확인.",
    "",
    "## 1. Cloud Shell 업로드",
    "",
    ...uploadNames.map((name) => `- ${name}`),
    "",
    `HTML은 서버에 업로드하지 않고 편집기에서 ${names.deployHtml} 내용으로 직접 교체합니다.`,
    "",
    "## 2. 서버 파일 백업·교체·검증",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "cp -f index.js BACKUP_pre_stage56b_index.js",
    "test ! -f member-profile-reconciliation.js || cp -f member-profile-reconciliation.js BACKUP_pre_stage56b_member-profile-reconciliation.js",
    `sha256sum ${uploadNames.join(" \\\n  ")}`,
    `cp -f ${names.serverIndex} index.js`,
    `cp -f ${names.reconciliationModule} member-profile-reconciliation.js`,
    "node --check index.js",
    "node --check member-profile-reconciliation.js",
    `node --test ${names.reconciliationTest} ${names.packageTest}`,
    "```",
    "",
    "로컬 전체 소스 계약 테스트는 패키징 전에 통과했으며 Cloud Shell에는 독립 실행 가능한 테스트만 업로드합니다.",
    "",
    "## 3. 서버 배포",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "PREVIOUS_STAGE56B_REVISION=\"$(gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='value(serviceConfig.revision)')\"",
    "printf 'PREVIOUS_STAGE56B_REVISION=%s\\n' \"$PREVIOUS_STAGE56B_REVISION\"",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "gcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest",
    "gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(state,updateTime,serviceConfig.revision,serviceConfig.uri)'",
    "gcloud run services describe golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --format='yaml(status.latestCreatedRevisionName,status.latestReadyRevisionName,status.traffic)'",
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
    "## 5. HTML 직접 교체와 무가입 검증",
    "",
    `ERP 편집기에서 ${names.deployHtml} 전체 내용으로 교체합니다.`,
    "",
    "1. 기존 카카오 회원으로 로그인·새로고침·로그아웃이 정상인지 확인합니다.",
    "2. 내 예약을 열어 오류 없이 기존 일정이 표시되는지 확인합니다. 이 호출은 pending 작업이 있을 때만 후속 동기화를 재시도합니다.",
    "3. 일반회원 로그인과 비로그인 메인·상품상세를 확인합니다.",
    "4. 신규 가입·탈퇴는 반복하지 않습니다. 다음 실제 신규 가입 1건에서만 완료 체감과 오류 여부를 관찰합니다.",
    "5. join_member_profiles 헤더 끝에 reconciliationState, reconciliationRevision, reconciliationAttempts, reconciliationNextAt, reconciliationErrorCode, reconciliationUpdatedAt이 자동 추가되는지 확인합니다.",
    "",
    "## 6. 복구",
    "",
    `HTML은 ${names.rollbackHtml} 내용으로 직접 복구합니다.`,
    "",
    "서버 즉시 복구는 3단계에서 출력한 정확한 이전 리비전을 사용합니다.",
    "",
    "```bash",
    "gcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-revisions=PREVIOUS_REVISION_NAME=100",
    "cd /home/llno95ll/google-sheet-proxy-function",
    "cp -f BACKUP_pre_stage56b_index.js index.js",
    "test ! -f BACKUP_pre_stage56b_member-profile-reconciliation.js || cp -f BACKUP_pre_stage56b_member-profile-reconciliation.js member-profile-reconciliation.js",
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
