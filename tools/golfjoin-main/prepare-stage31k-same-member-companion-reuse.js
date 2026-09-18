"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const { IMMUTABLE_CACHE_CONTROL, sha256 } = require("./external-assets");
const { buildStage15Candidate } = require("./prepare-stage15-sms-auth");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage31-owner-quote-integrity/same-member-companion-reuse-20260820-v31k"
);
const CURRENT_PRODUCTION_HTML = path.join(
  WORKSPACE_ROOT,
  "deploy/stage31-owner-quote-integrity/owner-quote-integrity-20260820-v31h/DEPLOY_golfjoin_main_owner_quote_A45D2C3C.html"
);
const CURRENT_PRODUCTION_SERVER = path.join(
  WORKSPACE_ROOT,
  "deploy/stage31-owner-quote-integrity/owner-quote-integrity-20260820-v31h/stage31-index.js"
);
const SERVER_INDEX = path.join(WORKSPACE_ROOT, "server/google-sheet-proxy-function/index.js");
const SERVER_TEST = path.join(WORKSPACE_ROOT, "server/google-sheet-proxy-function/participant-owner-companion-group.test.js");
const SOURCE_PACKAGE = path.join(
  WORKSPACE_ROOT,
  "deploy/stage15-sms-member-auth/all-home-password-reset-ui-20260818-v25"
);

function publicUrl(objectName) {
  return `https://storage.googleapis.com/golfjoin-bucket/${objectName}`;
}

function fileRecord(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function writeExclusive(fileName, buffer) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), buffer, { flag: "wx" });
}

async function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);
  const candidate = await buildStage15Candidate({
    sourcePackage: SOURCE_PACKAGE,
    stagingEventPlanSeq: 29,
    generatedAt: new Date().toISOString()
  });
  zlib.gunzipSync(candidate.cssGzip);
  const logicalJs = zlib.brotliDecompressSync(candidate.jsBrotli);
  new vm.Script(logicalJs.toString("utf8"), { filename: "stage31k-golfjoin-main.js" });

  const rollbackHtml = fs.readFileSync(CURRENT_PRODUCTION_HTML);
  const serverIndex = fs.readFileSync(SERVER_INDEX);
  const serverTest = fs.readFileSync(SERVER_TEST);
  const rollbackServerIndex = fs.readFileSync(CURRENT_PRODUCTION_SERVER);
  new vm.Script(serverIndex.toString("utf8"), { filename: "stage31k-index.js" });
  new vm.Script(serverTest.toString("utf8"), { filename: "stage31k-participant-owner-companion-group.test.js" });
  new vm.Script(rollbackServerIndex.toString("utf8"), { filename: "rollback-stage31h-index.js" });
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_same_member_group_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    serverIndex: "stage31k-index.js",
    serverTest: "stage31k-participant-owner-companion-group.test.js",
    rollbackServerIndex: "ROLLBACK_stage31h-index.js"
  };
  const hashes = {
    deployHtml: sha256(candidate.candidateHtml),
    rollbackHtml: sha256(rollbackHtml),
    css: sha256(candidate.cssGzip),
    js: sha256(candidate.jsBrotli),
    serverIndex: sha256(serverIndex),
    serverTest: sha256(serverTest),
    rollbackServerIndex: sha256(rollbackServerIndex)
  };
  const runbook = Buffer.from([
    "# v31k 동일 회원 멤버 그룹·최초 신청값 재사용",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. 서버 후보 2개와 CSS·JS 압축 파일 2개를 Cloud Shell에 업로드한다.",
    "- [ ] 2. 아래 SHA-256 해시를 확인한다.",
    "- [ ] 3. 서버 후보를 index.js와 테스트 파일로 교체하고 npm test를 실행한다.",
    "- [ ] 4. golfjoin-sheet-api만 배포한다. Aligo API는 배포하지 않는다.",
    "- [ ] 5. GCS 불변 경로에 CSS·JS를 업로드한다.",
    "- [ ] 6. 응답 헤더의 200·Content-Encoding·immutable을 확인한다.",
    "- [ ] 7. 신규 HTML 전체 내용을 저장한다.",
    "- [ ] 8. 생성자 A가 1명 일정을 만든 뒤 같은 A 계정으로 멤버 2명을 추가한다.",
    "- [ ] 9. 새로고침 전·후 모두 A와 추가 멤버 2명이 하나의 가로선 그룹이고 인원은 3명인지 확인한다.",
    "- [ ] 10. A 일정에 B가 1명 참여한 뒤 B 계정으로 멤버 1명을 추가한다.",
    "- [ ] 11. B의 두 아이콘이 이어지고 첫 B 아이콘 한 곳에만 나 배지가 보이는지 확인한다.",
    "- [ ] 12. B의 후속 참여 모달에 최초 B 참여의 라운딩스타일·선호멤버구성·한 줄 인사가 복원되는지 확인한다.",
    "- [ ] 13. A의 후속 참여 모달에는 최초 생성 신청의 같은 세 필드가 복원되는지 확인한다.",
    "- [ ] 14. 문제가 있으면 A45D2C3C HTML과 stage31h 서버 파일로 즉시 복구한다.",
    "",
    "## 파일 해시",
    "",
    "```text",
    `${names.css}  ${hashes.css}`,
    `${names.js}  ${hashes.js}`,
    `${names.deployHtml}  ${hashes.deployHtml}`,
    `${names.rollbackHtml}  ${hashes.rollbackHtml}`,
    `${names.serverIndex}  ${hashes.serverIndex}`,
    `${names.serverTest}  ${hashes.serverTest}`,
    `${names.rollbackServerIndex}  ${hashes.rollbackServerIndex}`,
    "```",
    "",
    "## 서버 교체·검사·배포",
    "",
    "```bash",
    "cd /home/llno95ll/google-sheet-proxy-function",
    `cp -f ${names.serverIndex} index.js`,
    `cp -f ${names.serverTest} participant-owner-companion-group.test.js`,
    "node --check index.js",
    "node --check participant-owner-companion-group.test.js",
    "npm test",
    "gcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml",
    "```",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "```",
    "",
    `HTML은 ${names.deployHtml} 전체 내용을 사용합니다.`,
    `복구 시 ${names.rollbackHtml} 전체 내용을 사용합니다.`,
    `서버 복구 시 ${names.rollbackServerIndex}를 index.js로 교체해 같은 배포 명령을 실행합니다.`,
    "golfjoin-aligo-api 재배포는 필요하지 않습니다.",
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false });
  writeExclusive(names.deployHtml, candidate.candidateHtml);
  writeExclusive(names.rollbackHtml, rollbackHtml);
  writeExclusive(names.css, candidate.cssGzip);
  writeExclusive(names.js, candidate.jsBrotli);
  writeExclusive(names.serverIndex, serverIndex);
  writeExclusive(names.serverTest, serverTest);
  writeExclusive(names.rollbackServerIndex, rollbackServerIndex);
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "secret-golf-join-same-member-companion-reuse-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      serverMutationParticipantMarkers: true,
      immediateParticipantDeduplication: true,
      creatorOwnedCompanionGrouping: true,
      sameMemberCompanionGrouping: true,
      singleCurrentMemberBadge: true,
      earliestApplicationPreferenceReuse: true,
      chronologicalApplicationReplay: true,
      refreshedParticipantGrouping: true,
      ownerRelationshipPrecedencePreserved: true,
      sheetApiRedeployRequired: true,
      aligoApiRedeployRequired: false
    },
    assets: {
      css: { objectName: candidate.assets.css.objectName, url: publicUrl(candidate.assets.css.objectName) },
      js: { objectName: candidate.assets.js.objectName, url: publicUrl(candidate.assets.js.objectName) }
    },
    files: {
      deployHtml: fileRecord(names.deployHtml, candidate.candidateHtml),
      rollbackHtml: fileRecord(names.rollbackHtml, rollbackHtml),
      css: fileRecord(names.css, candidate.cssGzip, {
        contentEncoding: "gzip",
        objectName: candidate.assets.css.objectName
      }),
      js: fileRecord(names.js, candidate.jsBrotli, {
        contentEncoding: "br",
        objectName: candidate.assets.js.objectName
      }),
      serverIndex: fileRecord(names.serverIndex, serverIndex),
      serverTest: fileRecord(names.serverTest, serverTest),
      rollbackServerIndex: fileRecord(names.rollbackServerIndex, rollbackServerIndex),
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
