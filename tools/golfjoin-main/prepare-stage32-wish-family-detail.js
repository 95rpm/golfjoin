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
  "deploy/stage32-wish-family-detail/wish-family-detail-20260821-v32"
);
const CURRENT_PRODUCTION_HTML = path.join(
  WORKSPACE_ROOT,
  "deploy/stage31-owner-quote-integrity/reservation-group-finalization-20260821-v31q/DEPLOY_golfjoin_main_reservation_group_finalization_49CBEB0C.html"
);
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

function assertCandidate(logicalSource, cssSource) {
  new vm.Script(logicalSource, { filename: "stage32-golfjoin-main.js" });

  if (!/async function resolveJoinWishProductDetail\(/.test(logicalSource)) {
    throw new Error("wish_product_family_resolver_missing");
  }
  const resolverStart = logicalSource.indexOf("async function resolveJoinWishProductDetail");
  const resolverEnd = logicalSource.indexOf("async function openJoinWishProduct", resolverStart);
  const resolver = logicalSource.slice(resolverStart, resolverEnd);
  if (!/ensureGolfJoinProductFamilyCatalogLoaded/.test(resolver)
    || !/loadGolfJoinProductGroupAvailability/.test(resolver)
    || !/goodSeq/.test(resolver)
    || !/eventSeq/.test(resolver)) {
    throw new Error("wish_product_exact_family_event_resolution_missing");
  }

  const openerStart = logicalSource.indexOf("async function openJoinWishProduct");
  const openerEnd = logicalSource.indexOf("function closeJoinMyMenu", openerStart);
  const opener = logicalSource.slice(openerStart, openerEnd);
  if (!/showMdPickDetailProduct/.test(opener)
    || !/wish-products/.test(opener)
    || !/resolveJoinWishProductDetail/.test(opener)) {
    throw new Error("wish_product_modal_route_missing");
  }

  const familyPeriodsMatch = cssSource.match(/\.detail-family-periods\s*\{([^}]*)\}/);
  if (!familyPeriodsMatch) throw new Error("detail_family_periods_rule_missing");
  if (/\bbackground(?:-color)?\s*:/.test(familyPeriodsMatch[1])) {
    throw new Error("detail_family_periods_background_must_be_transparent");
  }
}

async function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);

  const candidate = await buildStage15Candidate({
    sourcePackage: SOURCE_PACKAGE,
    stagingEventPlanSeq: 29,
    generatedAt: new Date().toISOString()
  });
  const logicalCss = zlib.gunzipSync(candidate.cssGzip).toString("utf8");
  const logicalJs = zlib.brotliDecompressSync(candidate.jsBrotli).toString("utf8");
  assertCandidate(logicalJs, logicalCss);

  const rollbackHtml = fs.readFileSync(CURRENT_PRODUCTION_HTML);
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_wish_family_detail_${sha256(candidate.candidateHtml).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${sha256(rollbackHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(candidate.cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(candidate.jsBrotli).slice(0, 8).toUpperCase()}.js.br`
  };
  const hashes = {
    deployHtml: sha256(candidate.candidateHtml),
    rollbackHtml: sha256(rollbackHtml),
    css: sha256(candidate.cssGzip),
    js: sha256(candidate.jsBrotli)
  };
  const runbook = Buffer.from([
    "# v32 상품군 찜 상세 정확도 및 기간 영역 배경 제거",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 1. CSS·JS 두 파일을 Cloud Shell에 업로드하고 SHA-256을 확인한다.",
    "- [ ] 2. GCS 불변 경로에 CSS·JS를 업로드한다.",
    "- [ ] 3. CSS gzip·JS Brotli·immutable 응답 헤더를 확인한다.",
    "- [ ] 4. 신규 HTML 전체 내용을 시험 페이지에 저장한다.",
    "- [ ] 5. 상품군의 대표상품이 아닌 기간 상품을 찜하고 찜한상품에서 연다.",
    "- [ ] 6. 찜한 goodSeq·eventSeq의 상품명·기간·가격·이미지가 상세 모달에 표시되는지 확인한다.",
    "- [ ] 7. 상품군 기간 선택 영역에 별도 회색 배경이 없는지 확인한다.",
    "- [ ] 8. 상세 모달을 닫으면 찜한상품 화면과 기존 스크롤 위치로 복귀하는지 확인한다.",
    "- [ ] 9. 상품군 없는 일반상품 찜 상세도 정상인지 확인한다.",
    "- [ ] 10. PC·모바일, 비로그인·카카오·일반회원 핵심 회귀와 콘솔 오류를 확인한다.",
    "- [ ] 11. 시험 정상 후 같은 HTML을 운영 페이지에 저장한다.",
    `- [ ] 12. 문제가 있으면 ${names.rollbackHtml}로 즉시 복구한다.`,
    "",
    "## 파일 해시",
    "",
    "```text",
    `${names.css}  ${hashes.css}`,
    `${names.js}  ${hashes.js}`,
    `${names.deployHtml}  ${hashes.deployHtml}`,
    `${names.rollbackHtml}  ${hashes.rollbackHtml}`,
    "```",
    "",
    "## GCS 업로드",
    "",
    "```bash",
    `gcloud storage cp ${names.css} gs://golfjoin-bucket/${candidate.assets.css.objectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    `gcloud storage cp ${names.js} gs://golfjoin-bucket/${candidate.assets.js.objectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="${IMMUTABLE_CACHE_CONTROL}"`,
    "```",
    "",
    `신규 HTML: ${names.deployHtml}`,
    `즉시 복구 HTML: ${names.rollbackHtml}`,
    "Cloud Function과 알리고 API는 재배포하지 않습니다.",
    "회원 인증 Gate는 report 상태를 유지합니다.",
    ""
  ].join("\n"), "utf8");

  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false });
  writeExclusive(names.deployHtml, candidate.candidateHtml);
  writeExclusive(names.rollbackHtml, rollbackHtml);
  writeExclusive(names.css, candidate.cssGzip);
  writeExclusive(names.js, candidate.jsBrotli);
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "secret-golf-join-wish-family-detail-v1",
    status: "ready-for-local-verification",
    preparedAt: candidate.generatedAt,
    productionEventPlanSeq: 3,
    assetRevision: candidate.assetRevision,
    javascriptBudgetPassed: candidate.jsBrotli.length <= 204800,
    features: {
      wishedExactGoodSeqResolved: true,
      wishedExactEventSeqPreferred: true,
      familyAvailabilityUsed: true,
      existingDetailModalUsed: true,
      wishMenuReturnContextPreserved: true,
      nonFamilySnapshotFallbackPreserved: true,
      detailFamilyPeriodsBackgroundRemoved: true,
      sheetApiRedeployRequired: false,
      aligoApiRedeployRequired: false,
      memberAuthGateRemainsReport: true
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
