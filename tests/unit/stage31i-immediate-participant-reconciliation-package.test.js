"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(root, "deploy/stage31-owner-quote-integrity/immediate-participant-reconciliation-20260820-v31i");
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v31i 묶음은 즉시 중복 제거와 생성자 동행 그룹을 서버·브라우저에 함께 배포한다", () => {
  assert.equal(manifest.features.immediateParticipantDeduplication, true);
  assert.equal(manifest.features.creatorOwnedCompanionGrouping, true);
  assert.equal(manifest.features.refreshedParticipantGrouping, true);
  assert.equal(manifest.features.sheetApiRedeployRequired, true);
  assert.equal(manifest.features.aligoApiRedeployRequired, false);
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("v31i 모든 파일은 선언 해시와 일치하고 압축 JavaScript 문법이 정상이다", () => {
  Object.values(manifest.files).forEach((record) => {
    const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(digest(buffer), record.sha256, record.fileName);
  });
  const jsRecord = manifest.files.js;
  const logicalJs = zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, jsRecord.fileName)));
  new vm.Script(logicalJs.toString("utf8"), { filename: "v31i-golfjoin-main.js" });
  assert.match(logicalJs.toString("utf8"), /attachJoinApplicationParticipantMarkersFromMutation/);
  assert.match(logicalJs.toString("utf8"), /creator-party/);
  assert.match(logicalJs.toString("utf8"), /participantCompanionGroup/);
  assert.ok(jsRecord.bytes <= 204800);
});

test("v31i는 당시 서버 후보와 v31h 서버·HTML 복구본을 자체 보존한다", () => {
  const serverCandidate = fs.readFileSync(path.join(packageRoot, manifest.files.serverIndex.fileName));
  assert.equal(digest(serverCandidate), manifest.files.serverIndex.sha256);
  assert.equal(manifest.files.rollbackServerIndex.sha256, "7e4a897cd246c3af1cdebf2ea69c3aeaf2fbf597aaf37534aa66f5e1bcca7f5c");
  assert.equal(manifest.files.rollbackHtml.sha256, "a45d2c3c6039f157c4bed89ab81fe61a2eb97ae03c20a97e59660adefac6b1ac");
});
