"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage40-kakao-resignup/kakao-resignup-session-hydration-20260831-v40g");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage40-kakao-resignup/kakao-resignup-live-home-20260831-v40d/DEPLOY_golfjoin_main_kakao_resignup_live_home_CE3DB4D4.html"
);
const JAVASCRIPT_BUDGET = 216 * 1024;
const ANALYTICS_SOURCE = "source/scripts/analytics/30-ga4-events.js";
const ANALYTICS_NOOP_BRIDGE = `
/* GA4 remains inactive in the stage40 Kakao resignup recovery rollout. */
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
  new vm.Script(bridged, { filename: "golfjoin-main.v40g.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v40g.min.js" });
  if (!js.includes(Buffer.from("member_kakao_signup_complete"))) {
    throw new Error("kakao_signup_complete_action_missing");
  }
  if (!js.includes(Buffer.from("getMemberExternalLoginCheck.json"))) {
    throw new Error("kakao_erp_resume_probe_missing");
  }
  if (!js.includes(Buffer.from("requestJoinKakaoCurrentUser"))) {
    throw new Error("kakao_user_identity_hydration_missing");
  }
  if (!js.includes(Buffer.from("fetchJoinMemberDetail"))) {
    throw new Error("erp_session_identity_hydration_missing");
  }
  if (!js.includes(Buffer.from("Failed to refresh live home schedule data"))) {
    throw new Error("live_home_schedule_refresh_missing");
  }

  const assetRevision = `gha_${sha256(Buffer.concat([
    js,
    Buffer.from("\n--stage40g-kakao-resignup-session-hydration--\n")
  ])).slice(0, 24)}`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  const rollbackText = rollbackHtml.toString("utf8");
  const scriptPattern = /(<script\s+src=")https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[a-f0-9]+\/golfjoin-main\.js("\s+integrity=")[^"]+("[^>]*>)/;
  if (!scriptPattern.test(rollbackText)) throw new Error("rollback_javascript_asset_reference_missing");
  const deployText = rollbackText.replace(
    scriptPattern,
    `$1https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}$2${sriSha256(js)}$3`
  );
  const deployHtml = Buffer.from(deployText, "utf8");
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
    js: jsBrotli
  };
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_kakao_resignup_live_home_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`
  };
  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "js"
      ? { contentEncoding: "br", objectName: jsObjectName, logicalSri: sriSha256(js) }
      : {})
  ]));

  const manifest = {
    schema: "golfjoin-stage40-kakao-resignup-live-home-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    stagingEventPlanSeq: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      kakaoResignupRecovery: true,
      erpPartialSignupResume: true,
      startupErpSessionIdentityHydration: true,
      startupKakaoUserIdentityHydration: true,
      verifiedKakaoErpIdentityBinding: true,
      existingKakaoProfileRowReuse: true,
      liveHomeBootstrapReconciliation: true,
      monthlyCapacityParticipantRefresh: true,
      anonymousAndMemberCardParity: true,
      cssRedeployRequired: false,
      dashboardRedeployRequired: false,
      ga4TrackingActivatedByThisRelease: false
    },
    assets: { jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# 40g 카카오 재가입 부분완료 세션 복구",
    "",
    "배포 순서: GCS JavaScript → ERP 29번 HTML 직접 교체 → 운영 HTML 직접 교체",
    "",
    "## 1. Cloud Shell 업로드 파일",
    "",
    ...Object.values(names).map((name) => `- ${name}`),
    "",
    `Cloud Shell에는 \`${names.js}\`만 \`/home/llno95ll/google-sheet-proxy-function\`에 업로드합니다. HTML은 서버에 올리지 않고 편집기에서 직접 교체합니다.`,
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
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"`,
    `curl -sSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 4. ERP 29번 HTML 직접 교체와 복구 시험",
    "",
    `편집기에서 29번 테스트 페이지 HTML 전체를 \`${names.deployHtml}\` 내용으로 직접 교체·저장합니다.`,
    "",
    "1. 기존 ERP 회원번호 `30002268`은 삭제하지 않습니다.",
    "2. Network의 Preserve log를 켜고 같은 카카오 회원 상태에서 페이지를 새로고침합니다.",
    "3. `member_kakao_auth_exchange` 404 직후 `member_kakao_signup_complete`가 호출되는지 확인합니다.",
    "4. `member_kakao_signup_complete` 200 후 `member_profile_lookup` 및 프로필 저장이 200인지 확인합니다.",
    "5. `join_member_profiles`에 새 ERP memberSeq, KAKAO 채널, kakaoId, 추가정보가 한 행으로 저장됐는지 확인합니다.",
    "6. 새로고침 후 추가정보 입력 화면이 다시 나오지 않는지 확인합니다.",
    "7. 10월 월례회 57/60명, 비로그인·일반회원·기존 카카오회원 회귀를 확인합니다.",
    "8. 모두 정상이면 운영 ERP HTML도 같은 파일로 직접 교체합니다.",
    "",
    "## 5. 복구",
    "",
    `ERP HTML은 \`${names.rollbackHtml}\` 내용으로 직접 원복합니다.`,
    "",
    "신규 GCS 불변 JavaScript는 삭제하지 않아도 됩니다.",
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
