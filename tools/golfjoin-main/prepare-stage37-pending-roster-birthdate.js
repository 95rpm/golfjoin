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
  "deploy/stage37-member-identity/contact-pending-birthdate-20260828-v37l"
);
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage37-member-identity/contact-pending-birthdate-20260828-v37k/DEPLOY_golfjoin_main_pending_roster_BA66EA7E.html"
);
const SERVER_INDEX = path.join(ROOT, "server/google-sheet-proxy-function/index.js");
const SERVER_TEST = path.join(ROOT, "server/google-sheet-proxy-function/pending-roster-identity.test.js");
const SERVER_ROLLBACK = path.join(
  ROOT,
  "deploy/stage34-hero-banner-management/dashboard-hero-banners-20260821-v34m/stage34-index.js"
);
const SOURCE_TEST = path.join(ROOT, "tests/unit/stage37-birthdate-pending-roster-source.test.js");
const DASHBOARD = path.join(ROOT, "golfjoin_admin_dashboard.html");
const JAVASCRIPT_BUDGET = 215 * 1024;
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
  const scriptPaths = sourceManifest.sourceOrder.filter((value) => /^source\/scripts\/.+\.js$/.test(value));
  const rawJs = Buffer.concat(scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath))));
  const css = read(path.join(SOURCE_ROOT, "source/styles/10-main.css"));
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.v37l.source.js" });

  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.v37l.min.js" });

  const assetRevision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--stage37l-mobile-birthdate-div-title--\n")
  ])).slice(0, 24)}`;
  const cssObjectName = `web/home-assets/${assetRevision}/golfjoin-main.css`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const rollbackHtml = read(ROLLBACK_HTML);
  const rollbackText = rollbackHtml.toString("utf8");
  const oldRevision = rollbackText.match(/gha_[a-f0-9]{24}/)?.[0];
  const oldCssSri = rollbackText.match(/golfjoin-main\.css" integrity="([^"]+)"/)?.[1];
  const oldJsSri = rollbackText.match(/golfjoin-main\.js" integrity="([^"]+)"/)?.[1];
  if (!oldRevision || !oldCssSri || !oldJsSri) throw new Error("rollback_asset_reference_missing");
  let deployText = rollbackText.split(oldRevision).join(assetRevision);
  deployText = deployText.split(oldCssSri).join(sriSha256(css));
  deployText = deployText.split(oldJsSri).join(sriSha256(js));
  const currentBirthField = markup.match(/<div class="join-member-email-field" id="joinMemberSignupBirthYearField">[\s\S]*?<\/div>\s*(?=<div class="join-member-email-field" id="joinMemberSignupGenderField">)/)?.[0];
  const previousBirthFieldPattern = /<label class="join-member-email-field" for="joinMemberSignupBirthDate" id="joinMemberSignupBirthYearField">[\s\S]*?<\/label>/;
  const currentBirthFieldPattern = /<div class="join-member-email-field" id="joinMemberSignupBirthYearField">[\s\S]*?<\/div>\s*(?=<div class="join-member-email-field" id="joinMemberSignupGenderField">)/;
  if (!currentBirthField) throw new Error("signup_birthdate_source_markup_missing");
  if (previousBirthFieldPattern.test(deployText)) {
    deployText = deployText.replace(previousBirthFieldPattern, currentBirthField);
  } else if (currentBirthFieldPattern.test(deployText)) {
    deployText = deployText.replace(currentBirthFieldPattern, currentBirthField);
  } else {
    throw new Error("signup_birthdate_rollback_markup_missing");
  }
  if (!deployText.includes('id="joinMemberSignupBirthMonth"') || !deployText.includes('id="joinMemberSignupBirthDay"')) {
    throw new Error("signup_birthdate_markup_not_replaced");
  }

  const deployHtml = Buffer.from(deployText, "utf8");
  const cssGzip = zlib.gzipSync(css, { level: 9, mtime: 0 });
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) {
    throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);
  }

  const dashboard = read(DASHBOARD);
  const serverIndex = read(SERVER_INDEX);
  const serverTest = read(SERVER_TEST);
  const serverRollback = read(SERVER_ROLLBACK);
  const sourceTest = read(SOURCE_TEST);
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_pending_roster_${sha256(deployHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    dashboard: `DEPLOY_golfjoin_admin_dashboard_${sha256(dashboard).slice(0, 8).toUpperCase()}.html`,
    serverIndex: "stage37-index.js",
    serverTest: "stage37-pending-roster-identity.test.js",
    sourceTest: "stage37-birthdate-pending-roster-source.test.js",
    serverRollback: "ROLLBACK_stage37-index.js"
  };
  const buffers = {
    deployHtml,
    rollbackHtml,
    css: cssGzip,
    js: jsBrotli,
    dashboard,
    serverIndex,
    serverTest,
    sourceTest,
    serverRollback
  };
  const files = Object.fromEntries(Object.entries(buffers).map(([key, buffer]) => [
    key,
    record(names[key], buffer, key === "css"
      ? { contentEncoding: "gzip", objectName: cssObjectName }
      : key === "js" ? { contentEncoding: "br", objectName: jsObjectName } : {})
  ]));

  const manifest = {
    schema: "golfjoin-stage37-contact-pending-birthdate-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    stagingEventPlanSeq: 29,
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    features: {
      fullBirthDateSignupAndProfile: true,
      fullBirthDateErpAndSheetSync: true,
      adminContactPendingRoster: true,
      pendingRosterCountsImmediately: true,
      exactIdentityCandidateFields: ["memberName", "birthDate", "gender"],
      explicitMemberConfirmation: true,
      rejectSuppressionPerMember: true,
      legacyBirthYearProfileCompatibility: true,
      existingMemberBirthDateUpgradePrompt: true,
      profileManageBirthDateDropdownFix: true,
      profileManageBirthDateCustomDropdown: true,
      mobileBirthDateUpgradeHeaderFix: true,
      mobileBirthDateUpgradeSingleTitle: true,
      mobileBirthDateUpgradeCompactLayout: true,
      mobileBirthDateUpgradeDivTitle: true,
      serverRedeployRequired: false,
      dashboardRedeployRequired: false
    },
    assets: { cssObjectName, jsObjectName },
    names,
    files
  };

  const runbook = Buffer.from([
    "# 37l 모바일 생년월일 입력 모달 제목 요소 보완",
    "",
    "이번 보완은 프런트 자산과 ERP HTML만 교체합니다. Sheet API와 관리자 대시보드는 재배포하지 않습니다.",
    "",
    "## 1. 파일 업로드와 해시 확인",
    "",
    "아래 4개 파일만 `/home/llno95ll/google-sheet-proxy-function`에 업로드합니다.",
    "",
    `- ${names.css}`,
    `- ${names.js}`,
    `- ${names.deployHtml}`,
    `- ${names.rollbackHtml}`,
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `sha256sum ${names.css} ${names.js} ${names.deployHtml} ${names.rollbackHtml}`,
    "```",
    "",
    "기대 해시는 같은 폴더의 `manifest.json`에서 확인합니다.",
    "",
    "## 2. GCS 불변 자산 업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"`,
    "```",
    "",
    "헤더 확인:",
    "",
    "```bash",
    `curl -sSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/${cssObjectName}`,
    `curl -sSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${jsObjectName}`,
    "```",
    "",
    "## 3. 29번 테스트 페이지와 회귀 검사",
    "",
    `ERP 29번 HTML을 \`${names.deployHtml}\` 전체 내용으로 교체합니다.`,
    "",
    "1. 비로그인 메인·상품상세·스크롤과 콘솔 오류를 확인합니다.",
    "2. 프로필 관리에서 생년월일 변경 버튼을 누르면 연·월·일 커스텀 드롭다운이 모두 아래 방향으로 열리는지 확인합니다.",
    "3. 읽기 상태의 생년월일에만 회색 박스가 보이지 않고 다른 프로필 항목과 동일한지 확인합니다.",
    "4. 모바일 기존 회원 생년월일 보완 모달 상단에 닫기 버튼이 온전히 보이고 헤더 안에는 닫기 버튼만 있는지 확인합니다.",
    "5. 본문 제목은 h2가 아닌 div이고, 패딩·하단 보더 없이 왼쪽 정렬된 20px 글자로 표시되는지 확인합니다.",
    "6. 모바일에서 닫기 헤더 높이는 50px이고 헤더 하단 구분선이 없으며, 본문 상단 여백이 0인지 확인합니다.",
    "7. 8자리 생년월일이 이미 있는 기존 회원은 별도 보완 입력창이 나타나지 않는지 확인합니다.",
    "8. 출생연도만 있거나 생년월일이 비어 있는 기존 회원은 약관 화면 대신 생년월일 전용 입력창이 나타나는지 확인합니다.",
    "9. 연·월·일을 모두 선택하기 전에는 저장 버튼이 비활성인지 확인합니다.",
    "10. 저장 후 `join_member_profiles.birthDate`가 YYYYMMDD로 갱신되고 프로필의 기존 필드가 유지되는지 확인합니다.",
    "11. 새로고침·재로그인 후 입력창이 다시 나타나지 않고 나의모임·내예약이 정상인지 확인합니다.",
    "12. 카카오 회원과 일반회원에서 각각 한 번씩 확인합니다.",
    "13. 모두 정상일 때 운영 ERP HTML도 같은 파일로 교체합니다.",
    "",
    "## 4. 복구",
    "",
    "메인 HTML은 ERP에서 다음 파일로 즉시 원복합니다:",
    `- ${names.rollbackHtml}`,
    "",
    "신규 GCS 경로는 불변 파일이므로 삭제할 필요가 없습니다.",
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
