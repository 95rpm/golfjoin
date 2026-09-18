"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { IMMUTABLE_CACHE_CONTROL, sha256 } = require("./external-assets");
const { buildStage15Candidate } = require("./prepare-stage15-sms-auth");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_ROOT = path.join(
  ROOT,
  "deploy/stage32-wish-family-detail/all-modal-scroll-lock-20260821-v32c-final"
);
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage32-wish-family-detail/wish-delete-backdrop-20260821-v32b/DEPLOY_golfjoin_main_wish_delete_backdrop_1200AB07.html"
);
const SOURCE_PACKAGE = path.join(
  ROOT,
  "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25"
);

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function writeExclusive(fileName, buffer) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), buffer, { flag: "wx" });
}

function assertBrowserCandidate(js) {
  new vm.Script(js, { filename: "stage32c-golfjoin-main.js" });
  [
    /function captureWidgetModalPageScrollState\(/,
    /function lockWidgetModalPageScroll\(/,
    /function unlockWidgetModalPageScroll\(/,
    /join-widget-page-scroll-locked/,
    /setProperty\("overflow","visible","important"\)/,
    /setProperty\("overflow","hidden","important"\)/,
    /hasOpenBlockingModal\(\)/,
    /setWidgetModalOpen\((?:true|!0)\)/
  ].forEach((pattern) => {
    if (!pattern.test(js)) throw new Error(`browser_candidate_missing:${pattern}`);
  });
  if (/lockDetailModalPageScroll|lockJoinProfileManagePageScroll/.test(js)) {
    throw new Error("legacy_modal_scroll_lock_must_be_removed");
  }
}

async function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);

  const candidate = await buildStage15Candidate({
    sourcePackage: SOURCE_PACKAGE,
    stagingEventPlanSeq: 29,
    generatedAt: new Date().toISOString()
  });
  const logicalJs = zlib.brotliDecompressSync(candidate.jsBrotli).toString("utf8");
  assertBrowserCandidate(logicalJs);

  const rollbackHtml = fs.readFileSync(ROLLBACK_HTML);
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_all_modal_scroll_lock_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`
  };
  const files = {
    deployHtml: candidate.candidateHtml,
    rollbackHtml,
    css: candidate.cssGzip,
    js: candidate.jsBrotli
  };

  const runbook = Buffer.from([
    "# v32c 전체 모달 원위치 스크롤 잠금",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. CSS·JS 두 파일을 Cloud Shell에 업로드하고 해시를 확인한다.",
    "- [ ] 2. CSS·JS를 신규 GCS 불변 경로에 업로드한다.",
    "- [ ] 3. gzip·Brotli 응답 헤더를 확인한다.",
    "- [ ] 4. 신규 HTML을 29번 시험 페이지에 저장한다.",
    "- [ ] 5. PC 페이지 중간에서 상품상세를 열어 뒤 메인이 같은 위치인지 확인한다.",
    "- [ ] 6. PC에서 모임만들기·모임찾기·로그인·나의모임·내예약을 각각 열고 닫는다.",
    "- [ ] 7. 각 모달이 열려 있는 동안 뒤 메인이 같은 위치로 고정되는지 확인한다.",
    "- [ ] 8. 각 모달을 닫은 뒤 열기 전 스크롤 위치가 그대로인지 확인한다.",
    "- [ ] 9. 상세→참여신청·내예약→상세 등 중첩 모달을 열고 순서대로 닫는다.",
    "- [ ] 10. 모바일에서도 상품상세·모임만들기·모임찾기·나의모임·내예약을 반복한다.",
    "- [ ] 11. 콘솔 오류·배경 스크롤·가로 위치 이동이 없는지 확인한다.",
    "- [ ] 12. 모두 정상일 때 같은 HTML을 운영 페이지에 저장한다.",
    "- [ ] 13. 문제 시 v32b HTML로 즉시 복구한다.",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "```",
    "",
    `신규 HTML: ${names.deployHtml}`,
    `HTML 복구: ${names.rollbackHtml}`,
    "Sheet API는 현재 배포본을 그대로 유지하며 재배포하지 않습니다.",
    "Aligo API도 배포하지 않습니다. 회원 인증 Gate는 report를 유지합니다.",
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false });
  Object.entries(names).forEach(([key, fileName]) => writeExclusive(fileName, files[key]));
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "secret-golf-join-all-modal-scroll-lock-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    stagingEventPlanSeq: 29,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      allBlockingModalsPreserveOpeningScroll: true,
      allBlockingModalsRestoreOpeningScroll: true,
      nestedModalsKeepFirstScrollAnchor: true,
      fullDocumentBackdropPreserved: true,
      detailSpecificScrollLockRemoved: true,
      profileSpecificScrollLockRemoved: true,
      mobileParticipantSheetUsesCommonLock: true,
      wishlistV32bFixPreserved: true,
      sheetApiRedeployRequired: false,
      aligoApiRedeployRequired: false,
      memberAuthGateRemainsReport: true
    },
    assets: {
      css: { objectName: candidate.assets.css.objectName },
      js: { objectName: candidate.assets.js.objectName }
    },
    files: {
      deployHtml: fileRecord(names.deployHtml, files.deployHtml),
      rollbackHtml: fileRecord(names.rollbackHtml, files.rollbackHtml),
      css: fileRecord(names.css, files.css, { contentEncoding: "gzip", objectName: candidate.assets.css.objectName }),
      js: fileRecord(names.js, files.js, { contentEncoding: "br", objectName: candidate.assets.js.objectName }),
      runbook: fileRecord("RUNBOOK.md", runbook)
    }
  };
  writeExclusive("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot: OUTPUT_ROOT, manifest }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
