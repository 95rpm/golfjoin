"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const ASSET_REVISION = "gha_74b1bc7a8f3c58bfe927ac4f";
const SOURCE_ROOT = path.join(WORKSPACE_ROOT, "dist/golfjoin-main/external-assets", ASSET_REVISION);
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, "deploy/stage13-home-assets/production-hotfix2-20260813");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function describe(fileName) {
  const buffer = fs.readFileSync(path.join(OUTPUT_ROOT, fileName));
  return { fileName, bytes: buffer.length, sha256: sha256(buffer) };
}

function copy(sourceName, targetName) {
  const sourcePath = path.join(SOURCE_ROOT, sourceName);
  if (!fs.existsSync(sourcePath)) throw new Error(`source_missing:${sourcePath}`);
  fs.copyFileSync(sourcePath, path.join(OUTPUT_ROOT, targetName), fs.constants.COPYFILE_EXCL);
}

function writeExclusive(fileName, contents) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), contents, { encoding: "utf8", flag: "wx" });
}

function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  const publication = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, "publication.json"), "utf8"));
  if (publication.assetRevision !== ASSET_REVISION) throw new Error("publication_revision_mismatch");

  const deployName = `DEPLOY_golfjoin_main_external_${publication.candidateHtmlSha256.slice(0, 8).toUpperCase()}.html`;
  const rollbackName = `ROLLBACK_golfjoin_main_legacy_${publication.sourceHtmlSha256.slice(0, 8).toUpperCase()}.html`;
  const cssName = `ASSET_golfjoin-main_${publication.assets.css.sha256.slice(0, 8).toUpperCase()}.css`;
  const jsName = `ASSET_golfjoin-main_${publication.assets.js.sha256.slice(0, 8).toUpperCase()}.js`;

  copy("golfjoin_main_external.html", deployName);
  copy("golfjoin_main_legacy.html", rollbackName);
  copy("golfjoin-main.css", cssName);
  copy("golfjoin-main.js", jsName);
  copy("publication.json", "SOURCE_publication.json");

  const runbook = `# Stage 13 운영 보완 배포\n\n`
    + `이 패키지는 로그인 회원의 내예약 카드가 \`displayRule: null\` 일정에서 로딩 상태로 멈추는 문제만 안전하게 보완합니다.\n\n`
    + `## 배포 순서\n\n`
    + `- [ ] \`${cssName}\`을 \`${publication.assets.css.objectName}\`에 신규 업로드\n`
    + `- [ ] \`${jsName}\`을 \`${publication.assets.js.objectName}\`에 신규 업로드\n`
    + `- [ ] \`npm.cmd run home:assets:verify-production -- --remote\` 통과\n`
    + `- [ ] 운영 eventPlanSeq=3 HTML을 \`${deployName}\` 전체 내용으로 교체\n`
    + `- [ ] 로그인 > 나의모임 > 내 예약에서 공통 로딩이 종료되고 카드가 표시되는지 확인\n`
    + `- [ ] 내가 만든 일정은 모집완료 우선, 참여중은 모집완료가 있으면 모집완료 우선인지 확인\n`
    + `- [ ] 참여자 아이콘, 모임장/나 배지, 현재인원, 성별구성, 상세 모달을 확인\n\n`
    + `## 즉시 복구\n\n`
    + `문제가 생기면 운영 HTML을 \`${rollbackName}\` 전체 내용으로 교체합니다. 이 복구본에도 이번 null 안전 처리가 포함되어 있어 외부 자산 장애와 내예약 예외를 함께 피합니다.\n`;
  writeExclusive("RUNBOOK.md", runbook);

  const precheck = `# Stage 13 보완 사전 점검\n\n`
    + `- [x] 운영 로그인 화면에서 내예약 오류 재현\n`
    + `- [x] 원인: getJoinRecruitmentCapacity(null)에서 displayRule 접근 예외\n`
    + `- [x] null 일정·null displayRule 회귀 테스트 추가\n`
    + `- [x] 소스 조립본과 golfjoin_main.html 일치 확인\n`
    + `- [ ] 패키지 로컬 검증과 전체 단위 테스트\n`
    + `- [ ] GCS 업로드 후 PC/MO 원격 자산 검증\n`
    + `- [ ] 운영 로그인 내예약 재검증\n`;
  writeExclusive("PRECHECK_RESULT.md", precheck);

  const files = {
    deployHtml: describe(deployName),
    rollbackHtml: describe(rollbackName),
    css: {
      ...describe(cssName),
      sri: publication.assets.css.sri,
      url: publication.assets.css.url,
      contentType: publication.assets.css.contentType,
      cacheControl: publication.assets.css.cacheControl
    },
    js: {
      ...describe(jsName),
      sri: publication.assets.js.sri,
      url: publication.assets.js.url,
      contentType: publication.assets.js.contentType,
      cacheControl: publication.assets.js.cacheControl
    },
    sourcePublication: describe("SOURCE_publication.json"),
    runbook: describe("RUNBOOK.md"),
    precheckResult: describe("PRECHECK_RESULT.md")
  };
  const manifest = {
    schema: "secret-golf-join-stage13-production-cutover-v1",
    preparedAt: new Date().toISOString(),
    status: "ready-for-preflight",
    changeType: "member-reservation-participant-summary-null-safety-hotfix",
    assetRevision: ASSET_REVISION,
    productionPage: {
      eventPlanSeq: 3,
      pcUrl: "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1",
      mobileUrl: "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1"
    },
    validatedTestPage: {
      eventPlanSeq: 18,
      url: "https://www.secret-tour.com/event/event_view?eventPlanSeq=18&page=0"
    },
    recoveryTargetMinutes: 5,
    files
  };
  writeExclusive("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot: OUTPUT_ROOT, assetRevision: ASSET_REVISION, files }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
