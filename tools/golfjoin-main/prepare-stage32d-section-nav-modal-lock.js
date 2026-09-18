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
  "deploy/stage32-wish-family-detail/modal-section-nav-stability-20260821-v32d"
);
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage32-wish-family-detail/all-modal-scroll-lock-20260821-v32c-final/DEPLOY_golfjoin_main_all_modal_scroll_lock_5CF06D68.html"
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
  new vm.Script(js, { filename: "stage32d-golfjoin-main.js" });
  [
    /function isJoinSectionNavScrollSyncSuspended\(/,
    /join-widget-page-scroll-locked/,
    /function updateJoinSectionNavActive\(\)\s*\{\s*if\s*\(isJoinSectionNavScrollSyncSuspended\(\)\)\s*return/,
    /function scheduleJoinSectionNavActiveUpdate\(\)\s*\{(?:\s*if\s*\(isJoinSectionNavScrollSyncSuspended\(\)\)\s*return|isJoinSectionNavScrollSyncSuspended\(\)\|\|)/,
    /function setJoinSectionNavActive\(/
  ].forEach((pattern) => {
    if (!pattern.test(js)) throw new Error(`browser_candidate_missing:${pattern}`);
  });
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
    deployHtml: `DEPLOY_golfjoin_main_modal_section_nav_stability_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
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
    "# v32d 모달 실행 중 섹션 칩 상태 고정",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. CSS·JS 두 파일을 Cloud Shell에 업로드하고 해시를 확인한다.",
    "- [ ] 2. CSS·JS를 신규 GCS 불변 경로에 업로드한다.",
    "- [ ] 3. gzip·Brotli 응답 헤더를 확인한다.",
    "- [ ] 4. 신규 HTML을 29번 시험 페이지에 저장한다.",
    "- [ ] 5. 메인 중간 섹션으로 이동해 해당 join-section-nav 칩이 활성인지 확인한다.",
    "- [ ] 6. 그 섹션의 상품상세를 열고 활성 칩이 첫 칩으로 바뀌지 않는지 확인한다.",
    "- [ ] 7. 상품상세를 닫고 기존 활성 칩과 화면 위치가 그대로인지 확인한다.",
    "- [ ] 8. 같은 위치에서 하단 메뉴의 모임만들기·모임찾기·나의모임을 각각 연다.",
    "- [ ] 9. 각 모달 실행 중과 닫은 뒤 모두 기존 섹션 칩이 유지되는지 확인한다.",
    "- [ ] 10. PC와 모바일에서 위 검사를 각각 반복한다.",
    "- [ ] 11. 직접 섹션 칩을 누르면 해당 섹션으로 정상 이동하는지 확인한다.",
    "- [ ] 12. 모달 배경 위치·닫기 후 위치·콘솔 오류가 모두 정상인지 확인한다.",
    "- [ ] 13. 모두 정상일 때 같은 HTML을 운영 페이지에 저장한다.",
    "- [ ] 14. 문제 시 v32c HTML로 즉시 복구한다.",
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
    "Sheet API와 Aligo API는 재배포하지 않습니다. 회원 인증 Gate는 report를 유지합니다.",
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false });
  Object.entries(names).forEach(([key, fileName]) => writeExclusive(fileName, files[key]));
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "secret-golf-join-modal-section-nav-stability-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    stagingEventPlanSeq: 29,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      modalLockSuspendsSectionNavAutoSync: true,
      pendingSectionNavFrameRechecksModalLock: true,
      explicitSectionNavSelectionPreserved: true,
      commonModalScrollLockV32cPreserved: true,
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
