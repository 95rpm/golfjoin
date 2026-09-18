"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage43-ga4/golfjoin-ga4-item-attribution-20260831-v43a");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(OUTPUT, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v43a는 v42d UI를 보존하고 GA4 신청 완료의 상품 귀속을 보완한다", () => {
  assert.equal(MANIFEST.features.generateLeadUsesStandardItems, true);
  assert.equal(MANIFEST.features.failedSaveNeverGeneratesLead, true);
  assert.equal(MANIFEST.features.piiAllowlistPreserved, true);
  assert.equal(MANIFEST.features.v42dSoonCarouselPreserved, true);
  assert.equal(MANIFEST.features.serverRedeployRequired, false);
  assert.equal(MANIFEST.features.cssRedeployRequired, false);

  const deploy = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.deployHtml), "utf8");
  const rollback = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.rollbackHtml));
  assert.equal(sha256(rollback), "a00f1173d115bea239e96da2ab026060211d7fbd8f0716df1e9567d36e29c848");
  assert.match(deploy, new RegExp(MANIFEST.assetRevision));
  assert.match(deploy, /gha_4eafdfbf84a3563fdf9aeb9e\/golfjoin-main\.css/);
});

test("v43a 압축 JavaScript는 추적 계약과 문법을 보존한다", () => {
  const compressed = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.js));
  assert.equal(sha256(compressed), MANIFEST.files.js.sha256);
  const javascript = zlib.brotliDecompressSync(compressed).toString("utf8");
  new vm.Script(javascript, { filename: "golfjoin-main.v43a.js" });
  assert.match(javascript, /G-LLY6DLP23E/);
  assert.match(javascript, /generate_lead/);
  assert.match(javascript, /participant_count/);
  assert.match(javascript, /golfjoin_apply_error/);
  assert.match(javascript, /trackGolfJoinGa4EventOnce/);
});
