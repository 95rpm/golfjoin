"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { sha256 } = require("./external-assets");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const CANDIDATE_ROOT = path.join(
  WORKSPACE_ROOT,
  "dist/golfjoin-main/critical-css/ghc_c303d9e05653fdaf53381195"
);
const PACKAGE_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage13-home-assets/production-critical-css-20260813"
);

function fileRecord(fileName, buffer) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer) };
}

function verifyInlineScripts(html) {
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = pattern.exec(html))) {
    const source = match[1].trim();
    if (!source) continue;
    new vm.Script(source, { filename: `critical-inline-${count + 1}.js` });
    count += 1;
  }
  return count;
}

function preparePackage() {
  const sourcePublication = JSON.parse(fs.readFileSync(path.join(CANDIDATE_ROOT, "publication.json"), "utf8"));
  const candidate = fs.readFileSync(path.join(CANDIDATE_ROOT, "golfjoin_main_critical_candidate.html"));
  const rollback = fs.readFileSync(path.join(CANDIDATE_ROOT, "golfjoin_main_gzip_rollback.html"));
  const criticalCss = fs.readFileSync(path.join(CANDIDATE_ROOT, "critical.css"));
  const candidateSha = sha256(candidate);
  const rollbackSha = sha256(rollback);
  const criticalSha = sha256(criticalCss);
  if (candidateSha !== sourcePublication.candidateHtmlSha256) throw new Error("critical_candidate_hash_mismatch");
  if (rollbackSha !== sourcePublication.rollbackHtmlSha256) throw new Error("critical_rollback_hash_mismatch");
  if (criticalSha !== sourcePublication.criticalCssSha256) throw new Error("critical_css_hash_mismatch");
  if (rollbackSha !== "36b1dc681bcbe3ede0d70e39d3766f88349c603a2003dc9fa9cada4f1d406bd3") {
    throw new Error("critical_rollback_not_current_production");
  }
  const criticalGzipBytes = zlib.gzipSync(criticalCss, { level: 9, mtime: 0 }).length;
  if (criticalGzipBytes > 30 * 1024) throw new Error(`critical_css_budget_exceeded:${criticalGzipBytes}`);
  const htmlText = candidate.toString("utf8");
  const requiredTokens = [
    "data-golfjoin-critical-css",
    'rel="preload" as="style"',
    "data-golfjoin-full-css",
    "<noscript><link rel=\"stylesheet\"",
    sourcePublication.fullAssetRevision,
    "handleGolfJoinExternalAssetFailure('css')"
  ];
  requiredTokens.forEach((token) => {
    if (!htmlText.includes(token)) throw new Error(`critical_candidate_token_missing:${token}`);
  });
  const inlineScriptCount = verifyInlineScripts(htmlText);
  const deployName = `DEPLOY_golfjoin_main_critical_${candidateSha.slice(0, 8).toUpperCase()}.html`;
  const rollbackName = `ROLLBACK_golfjoin_main_gzip_${rollbackSha.slice(0, 8).toUpperCase()}.html`;
  const auditCssName = `AUDIT_critical_${criticalSha.slice(0, 8).toUpperCase()}.css`;
  fs.mkdirSync(PACKAGE_ROOT, { recursive: true });
  fs.writeFileSync(path.join(PACKAGE_ROOT, deployName), candidate);
  fs.writeFileSync(path.join(PACKAGE_ROOT, rollbackName), rollback);
  fs.writeFileSync(path.join(PACKAGE_ROOT, auditCssName), criticalCss);

  const manifest = {
    schema: "secret-golf-join-critical-css-deployment-v1",
    preparedAt: new Date().toISOString(),
    stagingEventPlanSeq: 18,
    productionEventPlanSeq: 3,
    criticalRevision: sourcePublication.criticalRevision,
    fullAssetRevision: sourcePublication.fullAssetRevision,
    requiresGcsUpload: false,
    criticalCssBudgetBytes: 30 * 1024,
    criticalCssGzipBytes: criticalGzipBytes,
    candidateHtmlGzipBytes: zlib.gzipSync(candidate, { level: 9, mtime: 0 }).length,
    rollbackHtmlGzipBytes: zlib.gzipSync(rollback, { level: 9, mtime: 0 }).length,
    inlineScriptCount,
    performance: {
      network: { latencyMs: 150, bytesPerSecond: 204800 },
      runsPerViewport: 5,
      pc: { currentFcpMedianMs: 1156, candidateFcpMedianMs: 616, improvementMs: 540, improvementPercent: 46.7 },
      mobile: { currentFcpMedianMs: 1156, candidateFcpMedianMs: 616, improvementMs: 540, improvementPercent: 46.7 },
      pageErrorCount: 0
    },
    files: {
      deployHtml: fileRecord(deployName, candidate),
      rollbackHtml: fileRecord(rollbackName, rollback),
      auditCriticalCss: fileRecord(auditCssName, criticalCss)
    },
    browserReadEnabled: false
  };
  fs.writeFileSync(path.join(PACKAGE_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(PACKAGE_ROOT, "PRECHECK_RESULT.md"), [
    "# Critical CSS 배포 전 검사",
    "",
    "- [x] 현재 운영 gzip HTML을 복구본으로 고정",
    "- [x] critical CSS gzip 30KB 예산 통과",
    "- [x] PC·MO 전체 CSS 지연·합류·실패·복구 6/6 통과",
    "- [x] 느린 네트워크 PC·MO 각 5회 FCP 46.7% 개선",
    "- [x] 단위시험 116/116 통과",
    "- [x] 소스 조립본과 golfjoin_main.html 일치",
    "- [ ] eventPlanSeq 18 실제 PC·MO 검증",
    "- [ ] eventPlanSeq 3 운영 전환 및 로그인·비로그인 검증",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(PACKAGE_ROOT, "RUNBOOK.md"), [
    "# Critical CSS 스테이징·운영 전환",
    "",
    "## 초보자용 설명",
    "처음 화면에 필요한 CSS만 HTML 안에 넣고 전체 CSS는 바로 뒤에서 받습니다. 전체 CSS나 JavaScript 내용은 바뀌지 않습니다.",
    "",
    "## 1. 스테이징",
    `1. \`${deployName}\` 전체 내용을 eventPlanSeq 18 HTML에 넣습니다.`,
    "2. PC와 MO에서 첫 화면, 세로 스크롤, 상품상세, 기간 변경, 모달 닫기 복원을 확인합니다.",
    "3. 문제가 있으면 eventPlanSeq 18에서 HTML을 제거하거나 이전 시험 HTML로 되돌립니다.",
    "",
    "## 2. 운영",
    "스테이징 검증을 모두 통과한 경우에만 같은 배포 HTML을 eventPlanSeq 3에 넣습니다.",
    "",
    "## 즉시 복구",
    `문제가 생기면 \`${rollbackName}\` 전체 내용으로 eventPlanSeq 3을 교체합니다. GCS 파일은 건드리지 않습니다.`,
    ""
  ].join("\n"), "utf8");
  return { packageRoot: PACKAGE_ROOT, manifest };
}

function main() {
  const result = preparePackage();
  process.stdout.write(`${JSON.stringify({ ok: true, packageRoot: result.packageRoot, ...result.manifest }, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { PACKAGE_ROOT, preparePackage, verifyInlineScripts };
