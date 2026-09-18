"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const ASSET_REVISION = "gha_fa7df4e8e602419ba81a56ed";
const SOURCE_ROOT = path.join(WORKSPACE_ROOT, "dist/golfjoin-main/external-assets", ASSET_REVISION);
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, "deploy/stage13-home-assets/production-gzip-20260813");

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
  if (publication.contentEncoding !== "gzip") throw new Error("publication_encoding_mismatch");

  const deployName = `DEPLOY_golfjoin_main_gzip_${publication.candidateHtmlSha256.slice(0, 8).toUpperCase()}.html`;
  const rollbackName = `ROLLBACK_golfjoin_main_legacy_${publication.sourceHtmlSha256.slice(0, 8).toUpperCase()}.html`;
  const cssName = `UPLOAD_golfjoin-main_${publication.assets.css.encodedSha256.slice(0, 8).toUpperCase()}.css.gz`;
  const jsName = `UPLOAD_golfjoin-main_${publication.assets.js.encodedSha256.slice(0, 8).toUpperCase()}.js.gz`;

  copy("golfjoin_main_external.html", deployName);
  copy("golfjoin_main_legacy.html", rollbackName);
  copy("golfjoin-main.css.gz", cssName);
  copy("golfjoin-main.js.gz", jsName);
  copy("publication.json", "SOURCE_publication.json");

  const runbook = `# Stage 13 gzip 전송 배포\n\n`
    + `이 패키지는 CSS와 JavaScript 실행 내용을 바꾸지 않고 GCS 전송 크기만 줄입니다.\n\n`
    + `## 1. GCS 업로드\n\n`
    + `Cloud Shell의 같은 폴더에 \`${cssName}\`, \`${jsName}\`을 업로드한 뒤 아래 명령을 실행합니다.\n\n`
    + `\`\`\`bash\n`
    + `gcloud storage cp ${cssName} gs://golfjoin-bucket/${publication.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\n\n`
    + `gcloud storage cp ${jsName} gs://golfjoin-bucket/${publication.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\n`
    + `\`\`\`\n\n`
    + `## 2. 원격 검증\n\n`
    + `로컬 또는 동일 프로젝트에서 다음 검증을 통과해야 HTML을 교체할 수 있습니다.\n\n`
    + `\`\`\`bash\n`
    + `node tools/golfjoin-main/verify-stage13-production.js --package=deploy/stage13-home-assets/production-gzip-20260813 --remote\n`
    + `\`\`\`\n\n`
    + `## 3. 운영 HTML 전환\n\n`
    + `- [ ] eventPlanSeq=3의 HTML을 \`${deployName}\` 전체 내용으로 교체\n`
    + `- [ ] PC·MO 첫 진입에서 CSS·JS 응답의 Content-Encoding이 gzip인지 확인\n`
    + `- [ ] 로그인 내예약, 상품상세, 스크롤 복원을 확인\n\n`
    + `## 즉시 복구\n\n`
    + `문제가 생기면 운영 HTML을 \`${rollbackName}\` 전체 내용으로 교체합니다. 기존 \`EEB447F9\` 운영 파일도 그대로 정상 동작합니다.\n`;
  writeExclusive("RUNBOOK.md", runbook);

  const precheck = `# Stage 13 gzip 사전 점검\n\n`
    + `- [x] 운영 coverage PC·MO 측정\n`
    + `- [x] 현재 GCS 자산 Content-Encoding identity 확인\n`
    + `- [x] gzip 원본 복원 해시 2/2 일치\n`
    + `- [x] 실제 HTTP gzip PC·MO 2/2 통과\n`
    + `- [x] 기존 무압축 정상·실패 안전장치 PC·MO 4/4 통과\n`
    + `- [x] 전체 단위시험 107/107 통과\n`
    + `- [ ] GCS 업로드 후 PC·MO 원격 검증\n`
    + `- [ ] 운영 HTML 전환 후 로그인·비로그인 최종 확인\n`;
  writeExclusive("PRECHECK_RESULT.md", precheck);

  const files = {
    deployHtml: describe(deployName),
    rollbackHtml: describe(rollbackName),
    css: {
      ...describe(cssName),
      logicalBytes: publication.assets.css.bytes,
      logicalSha256: publication.assets.css.sha256,
      sri: publication.assets.css.sri,
      url: publication.assets.css.url,
      contentType: publication.assets.css.contentType,
      contentEncoding: "gzip",
      cacheControl: publication.assets.css.cacheControl,
      objectName: publication.assets.css.objectName
    },
    js: {
      ...describe(jsName),
      logicalBytes: publication.assets.js.bytes,
      logicalSha256: publication.assets.js.sha256,
      sri: publication.assets.js.sri,
      url: publication.assets.js.url,
      contentType: publication.assets.js.contentType,
      contentEncoding: "gzip",
      cacheControl: publication.assets.js.cacheControl,
      objectName: publication.assets.js.objectName
    },
    sourcePublication: describe("SOURCE_publication.json"),
    runbook: describe("RUNBOOK.md"),
    precheckResult: describe("PRECHECK_RESULT.md")
  };
  const manifest = {
    schema: "secret-golf-join-stage13-gzip-cutover-v1",
    preparedAt: new Date().toISOString(),
    status: "ready-for-preflight",
    changeType: "gzip-transport-only",
    assetRevision: ASSET_REVISION,
    contentEncoding: "gzip",
    expectedColdAssetBytes: files.css.bytes + files.js.bytes,
    previousColdAssetBytes: files.css.logicalBytes + files.js.logicalBytes,
    productionPage: {
      eventPlanSeq: 3,
      pcUrl: "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1",
      mobileUrl: "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1"
    },
    recoveryTargetMinutes: 5,
    files
  };
  writeExclusive("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    outputRoot: OUTPUT_ROOT,
    assetRevision: ASSET_REVISION,
    expectedColdAssetBytes: manifest.expectedColdAssetBytes,
    previousColdAssetBytes: manifest.previousColdAssetBytes,
    files
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
