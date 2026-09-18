"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { IMMUTABLE_CACHE_CONTROL, sha256 } = require("./external-assets");
const { buildStage15Candidate } = require("./prepare-stage15-sms-auth");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_ROOT = path.join(
  ROOT,
  "deploy/stage30-member-auth-gate/legacy-profile-alias-ui-20260821-v30c"
);
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const MEMBER_SOURCE = path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"
);
const SOURCE_PACKAGE = path.join(
  ROOT,
  "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25"
);
const ROLLBACK_HTML = path.join(
  ROOT,
  "deploy/stage32-wish-family-detail/modal-section-nav-stability-20260821-v32d/DEPLOY_golfjoin_main_modal_section_nav_stability_7502BFEA.html"
);

const serverSources = {
  index: path.join(SERVER_ROOT, "index.js"),
  memberSmsAuth: path.join(SERVER_ROOT, "member-sms-auth.js"),
  memberSmsAuthTest: path.join(SERVER_ROOT, "member-sms-auth.test.js"),
  legacyAliasTest: path.join(SERVER_ROOT, "member-auth-legacy-profile-alias.test.js")
};

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: digest(buffer), ...extra };
}

function writeExclusive(fileName, buffer) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), buffer, { flag: "wx" });
}

function assertProfileLookupOrdering() {
  const source = fs.readFileSync(MEMBER_SOURCE, "utf8");
  const functionStart = source.indexOf("async function ensureJoinMemberProfileReady");
  const functionEnd = source.indexOf("async function promptRequiredJoinMemberProfileOnStartup", functionStart);
  if (functionStart < 0 || functionEnd < 0) throw new Error("profile_ready_function_missing");
  const body = source.slice(functionStart, functionEnd);
  const cachedBranch = body.indexOf("cachedCompletion === false");
  const refresh = body.indexOf("await getJoinCurrentMember({ refresh: true })", cachedBranch);
  const open = body.indexOf("openJoinMemberRequiredProfileForm(refreshedMember", cachedBranch);
  if (cachedBranch < 0 || refresh < 0 || open < 0 || open < refresh) {
    throw new Error("required_profile_form_opens_before_refresh");
  }
  if (/cachedCompletion === false[\s\S]{0,200}openJoinMemberRequiredProfileForm\(cachedMember/.test(body)) {
    throw new Error("cached_incomplete_profile_flash_path_present");
  }
}

function assertServerFiles(files) {
  Object.entries(files).forEach(([key, buffer]) => {
    new vm.Script(buffer.toString("utf8"), { filename: `stage30c-${key}.js` });
  });
  const index = files.index.toString("utf8");
  const auth = files.memberSmsAuth.toString("utf8");
  if (!/const memberId = asText\(identity\.memberId\)/.test(index)) {
    throw new Error("trusted_member_id_binding_missing");
  }
  if (!/createMemberAccessToken\(\{ secret, memberSeq, memberId, nowMs/.test(auth)) {
    throw new Error("signed_member_id_claim_missing");
  }
}

async function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);
  assertProfileLookupOrdering();

  const candidate = await buildStage15Candidate({
    sourcePackage: SOURCE_PACKAGE,
    stagingEventPlanSeq: 29,
    generatedAt: new Date().toISOString()
  });
  const logicalJs = zlib.brotliDecompressSync(candidate.jsBrotli).toString("utf8");
  new vm.Script(logicalJs, { filename: "stage30c-golfjoin-main.js" });

  const serverFiles = Object.fromEntries(
    Object.entries(serverSources).map(([key, fileName]) => [key, fs.readFileSync(fileName)])
  );
  assertServerFiles(serverFiles);
  const rollbackHtml = fs.readFileSync(ROLLBACK_HTML);

  const names = {
    deployHtml: `DEPLOY_golfjoin_main_member_profile_gate_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    index: "stage30c-index.js",
    memberSmsAuth: "stage30c-member-sms-auth.js",
    memberSmsAuthTest: "stage30c-member-sms-auth.test.js",
    legacyAliasTest: "stage30c-member-auth-legacy-profile-alias.test.js"
  };

  const runbook = Buffer.from([
    "# 30c단계 — 기존 일반회원 Enforce 호환 및 추가정보 화면 깜빡임 제거",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. 서버 4개 파일과 GCS 2개 파일의 해시를 확인한다.",
    "- [ ] 2. 현재 Cloud Run 트래픽이 Report 리비전 100%인지 확인한다.",
    "- [ ] 3. 환경파일 GOLFJOIN_MEMBER_AUTH_GATE=report를 확인한다.",
    "- [ ] 4. 서버 4개 파일을 실제 파일명으로 교체하고 npm test를 통과한다.",
    "- [ ] 5. Sheet API를 Report 상태로 배포한다.",
    "- [ ] 6. GCS CSS·JS를 신규 불변 경로에 업로드하고 응답 헤더를 확인한다.",
    "- [ ] 7. 신규 HTML을 29번 시험 페이지에 저장한다.",
    "- [ ] 8. 기존 일반회원 재로그인에서 추가정보 화면이 한 프레임도 나타나지 않는지 확인한다.",
    "- [ ] 9. 실제 미완료 시험회원은 추가정보 화면이 정상 표시되는지 확인한다.",
    "- [ ] 10. 카카오회원·비로그인·나의모임·내예약 회귀를 확인한다.",
    "- [ ] 11. Report 배포 후 최소 5분이 지난 뒤 Gate를 Enforce로 재배포한다.",
    "- [ ] 12. 무토큰 401, 기존 일반회원, 카카오회원, 찜 쓰기를 다시 검사한다.",
    "- [ ] 13. 모두 정상일 때 같은 HTML을 운영 페이지에 저장한다.",
    "- [ ] 14. 문제 시 Report 리비전으로 트래픽을 복구하고 v32d HTML로 되돌린다.",
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
    "Aligo API와 Google Sheet 데이터는 변경하지 않습니다.",
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  writeExclusive(names.deployHtml, candidate.candidateHtml);
  writeExclusive(names.rollbackHtml, rollbackHtml);
  writeExclusive(names.css, candidate.cssGzip);
  writeExclusive(names.js, candidate.jsBrotli);
  Object.entries(serverFiles).forEach(([key, buffer]) => writeExclusive(names[key], buffer));
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "golfjoin-stage30c-member-profile-gate-v1",
    status: "ready-for-cloud-shell-verification",
    preparedAt: candidate.generatedAt,
    stagingEventPlanSeq: 29,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    rollout: {
      firstGate: "report",
      accessTokenDrainSeconds: 300,
      finalGate: "enforce",
      rollback: "saved-report-revision-traffic-and-v32d-html"
    },
    features: {
      signedLegacyMemberIdAlias: true,
      cachedIncompleteProfileWaitsForRefresh: true,
      completeLegacyProfileNeverOpensRequiredForm: true,
      trueIncompleteProfileStillOpensRequiredForm: true,
      aligoDeployRequired: false,
      sheetDataMigrationRequired: false
    },
    assets: {
      css: { objectName: candidate.assets.css.objectName },
      js: { objectName: candidate.assets.js.objectName }
    },
    files: {
      deployHtml: record(names.deployHtml, candidate.candidateHtml),
      rollbackHtml: record(names.rollbackHtml, rollbackHtml),
      css: record(names.css, candidate.cssGzip, { contentEncoding: "gzip", objectName: candidate.assets.css.objectName }),
      js: record(names.js, candidate.jsBrotli, { contentEncoding: "br", objectName: candidate.assets.js.objectName }),
      index: record(names.index, serverFiles.index),
      memberSmsAuth: record(names.memberSmsAuth, serverFiles.memberSmsAuth),
      memberSmsAuthTest: record(names.memberSmsAuthTest, serverFiles.memberSmsAuthTest),
      legacyAliasTest: record(names.legacyAliasTest, serverFiles.legacyAliasTest),
      runbook: record("RUNBOOK.md", runbook)
    }
  };
  writeExclusive("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot: OUTPUT_ROOT, manifest }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
