"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(
  root,
  "deploy/stage31-owner-quote-integrity/member-private-bootstrap-readiness-20260820-v31p"
);

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v31p는 공개 부트스트랩과 현재 회원의 생성·참여 조회 상태를 분리한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.schema, "secret-golf-join-member-private-bootstrap-readiness-v1");
  assert.equal(manifest.features.publicBootstrapDoesNotOwnMemberPrivateLoading, true);
  assert.equal(manifest.features.currentMemberPrivateReadAlwaysStarts, true);
  assert.equal(manifest.features.companionGroupExcludedFromParticipantIdentity, true);
  assert.equal(manifest.features.oneApplicationTwoPeopleKeptDistinct, true);
  assert.equal(manifest.features.materializedAndSummaryParticipantsAlignedOneToOne, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, false);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v31p 파일·압축 JavaScript·C205AD56 복구본이 모두 정상이다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });
  const jsRecord = manifest.files.js;
  const source = zlib.brotliDecompressSync(
    fs.readFileSync(path.join(packageRoot, jsRecord.fileName))
  ).toString("utf8");
  new vm.Script(source, { filename: "v31p-golfjoin-main.js" });
  assert.match(
    source,
    /function hydrateHomeBootstrapLightFromGoogleSheet[\s\S]{0,500}Boolean\(getJoinWishMemberKey\(getJoinCachedCurrentMember\(\)\)\)/
  );
  assert.match(
    source,
    /function hydrateHomeSecondaryData[\s\S]{0,1000}googleSheetBuilderApplicationsReadMemberKey===/
  );
  assert.match(
    source,
    /function hydrateHomeSecondaryData[\s\S]{0,1000}googleSheetJoinApplicationsReadMemberKey===/
  );
  assert.ok(jsRecord.bytes <= 204800);
  assert.equal(
    manifest.files.rollbackHtml.sha256,
    "c205ad56eb726224f502bca34e235ad447d1f95aa89d941ca2b5010fa316a5df"
  );
});
