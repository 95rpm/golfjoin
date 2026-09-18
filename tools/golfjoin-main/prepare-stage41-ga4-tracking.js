"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage41-ga4/golfjoin-ga4-final-audit-20260831-v41e");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage41-ga4/golfjoin-ga4-begin-checkout-20260831-v41c/DEPLOY_golfjoin_main_ga4_tracking_DF25F342.html"
);
const ANALYTICS_TEST = path.join(ROOT, "tests/unit/ga4-tracking.test.js");
const MEMBER_STATE_BOOT_TEST = path.join(ROOT, "tests/unit/ga4-member-state-boot.test.js");
const BEGIN_CHECKOUT_TEST = path.join(ROOT, "tests/unit/ga4-begin-checkout-entry.test.js");
const FUNNEL_INTEGRITY_TEST = path.join(ROOT, "tests/unit/ga4-funnel-integrity.test.js");
const JAVASCRIPT_BUDGET = 216 * 1024;
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

function assertContains(buffer, text, code) {
  if (!buffer.includes(Buffer.from(text))) throw new Error(code);
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);

  const sourceManifest = JSON.parse(read(SOURCE_MANIFEST).toString("utf8"));
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => /^source\/scripts\/.+\.js$/.test(value));
  const rawJs = Buffer.concat(scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath))));
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v41e.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v41e.min.js" });

  assertContains(js, "G-LLY6DLP23E", "golfjoin_measurement_id_missing");
  assertContains(js, "552152254", "golfjoin_property_id_missing");
  assertContains(js, "send_page_view", "isolated_page_view_config_missing");
  assertContains(js, "golfjoin_section_view", "section_view_event_missing");
  assertContains(js, "markGolfJoinGa4MemberStateReady", "member_state_ready_signal_missing");
  assertContains(js, "memberStateReady", "member_state_ready_status_missing");
  assertContains(js, "select_promotion", "hero_promotion_event_missing");
  assertContains(js, "add_to_wishlist", "wishlist_recommended_event_missing");
  assertContains(js, "begin_checkout", "apply_start_recommended_event_missing");
  assertContains(js, "generate_lead", "lead_completion_event_missing");
  assertContains(js, "trackGolfJoinGa4EventOnce", "completion_deduplication_missing");
  assertContains(js, "post_save_reconciliation_failed", "post_save_error_classification_missing");
  assertContains(js, "golfjoin_apply_error", "apply_error_event_missing");
  assertContains(js, "golfjoin_create_error", "create_error_event_missing");
  assertContains(js, "member_kakao_signup_complete", "v40j_kakao_signup_fix_missing");
  assertContains(js, "serverFinalized", "v40j_server_finalized_result_missing");

  const assetRevision = `gha_${sha256(Buffer.concat([
    js,
    Buffer.from("\n--stage41e-golfjoin-ga4-final-audit--\n")
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

  const analyticsTest = read(ANALYTICS_TEST);
  const memberStateBootTest = read(MEMBER_STATE_BOOT_TEST);
  const beginCheckoutTest = read(BEGIN_CHECKOUT_TEST);
  const funnelIntegrityTest = read(FUNNEL_INTEGRITY_TEST);
  const buffers = { deployHtml, rollbackHtml, js: jsBrotli, analyticsTest, memberStateBootTest, beginCheckoutTest, funnelIntegrityTest };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_ga4_tracking_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    analyticsTest: "stage41e-ga4-tracking.test.js",
    memberStateBootTest: "stage41e-ga4-member-state-boot.test.js",
    beginCheckoutTest: "stage41e-ga4-begin-checkout-entry.test.js",
    funnelIntegrityTest: "stage41e-ga4-funnel-integrity.test.js"
  };
  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "js"
      ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) }
      : {})
  ]));

  const manifest = {
    schema: "golfjoin-stage41-ga4-final-audit-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    cmsRevision: 29,
    assetRevision,
    analytics: {
      measurementId: "G-LLY6DLP23E",
      propertyId: "552152254",
      routingGroup: "golfjoin",
      existingHomepagePropertyPreserved: true,
      debugModeEventPlanSeq: 29
    },
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      isolatedGa4Destination: true,
      explicitEventRouting: true,
      singleGolfjoinPageView: true,
      sectionVisibilityTracking: true,
      heroPromotionClickTracking: true,
      recommendedItemAndLeadEvents: true,
      parameterAllowlist: true,
      memberStateWithoutIdentity: true,
      memberStateResolvedBeforePageView: true,
      pageViewFallback: true,
      beginCheckoutOnActualApplyModalOpen: true,
      allDetailModalEntryTracking: true,
      allBuilderModalEntryTracking: true,
      confirmedMutationCompletionTracking: true,
      completionDeduplication: true,
      nullSafeItemNormalization: true,
      loginAndSignupSeparation: true,
      mutationErrorClassification: true,
      v40jKakaoSignupFixPreserved: true,
      serverRedeployRequired: false,
      cssRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# v41e GA4 전체 퍼널 최종 보완",
    "",
    "배포 순서: GCS JavaScript → ERP HTML 직접 교체 → 로그인/비로그인 GA4 시험",
    "",
    "서버·CSS·대시보드는 이번 단계에서 배포하지 않습니다.",
    "",
    "## 1. Cloud Shell 업로드",
    "",
    `Cloud Shell에는 \`${names.js}\`만 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다. HTML은 편집기에서 직접 교체합니다.`,
    "",
    "## 2. 해시 확인",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.js}`,
    "```",
    "",
    "## 3. GCS 불변 JavaScript 업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type=\"application/javascript; charset=utf-8\" --content-encoding=br --cache-control=\"public, max-age=31536000, immutable\"`,
    `curl -sSI -H \"Accept-Encoding: br\" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 4. HTML 직접 교체",
    "",
    `편집기에서 현재 골프조인 HTML 전체를 \`${names.deployHtml}\` 내용으로 교체합니다.`,
    "",
    "## 5. 브라우저 확인",
    "",
    "골프조인 페이지에서 개발자도구 Console에 아래 코드를 실행합니다.",
    "",
    "```js",
    "getGolfJoinGa4Status()",
    "```",
    "",
    "정상값: measurementId=G-LLY6DLP23E, propertyId=552152254, group=golfjoin, initialized=true, pageViewSent=true, memberStateReady=true",
    "",
    "Network에서 `collect?v=2` 또는 `g/collect`로 필터한 뒤 `tid=G-LLY6DLP23E` 요청을 확인합니다.",
    "",
    "1. 로그아웃 새로고침: page_view 1회, member_state=guest",
    "2. 카카오 로그인 새로고침: page_view 1회, member_state=kakao",
    "3. 일반회원 로그인 새로고침: page_view 1회, member_state=homepage",
    "4. 최초 golfjoin_section_view의 member_state도 같은 값인지 확인",
    "5. 상품상세 열기: view_item",
    "6. 찜 추가: add_to_wishlist",
    "7. 참여 신청 모달 열기: begin_checkout 1회, flow_type=join_apply",
    "8. 참여 완료: generate_lead, flow_type=join_apply, participant_count 확인",
    "9. 새 모임 모달 열기: golfjoin_create_start, flow_type=new_schedule 확인",
    "10. 새 모임 완료: generate_lead, flow_type=new_schedule 확인",
    "11. 이메일 로그인: golfjoin_login_start(method=email) → login(method=email)",
    "12. 카카오 로그인: golfjoin_login_start(method=kakao) → login(method=kakao)",
    "13. 신규 가입만 sign_up이 전송되고 기존회원 추가정보 보완에는 sign_up이 없는지 확인",
    "14. 저장 실패 시 golfjoin_apply_error 또는 golfjoin_create_error의 error_type 확인",
    "15. 요청 Payload에 이름·휴대폰·이메일·memberSeq·생년월일·카카오 ID·토큰이 없는지 확인",
    "16. 동일 완료 버튼 재시도에서 같은 저장 식별키의 generate_lead가 중복되지 않는지 확인",
    "17. 콘솔 오류와 기존 카카오 가입·로그인 회귀가 없는지 확인",
    "",
    "GA4의 새 골프조인 속성 → 보고서 → 실시간에서도 같은 이벤트가 보이는지 확인합니다. 현재 실제 URL은 eventPlanSeq=3이므로 debugMode=false가 정상입니다.",
    "",
    "## 6. 복구",
    "",
    `문제가 있으면 편집기 HTML을 \`${names.rollbackHtml}\` 내용으로 되돌립니다. 신규 GCS 불변 JavaScript는 삭제하지 않아도 됩니다.`,
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
