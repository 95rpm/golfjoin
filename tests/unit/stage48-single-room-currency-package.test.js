"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage48-hotfix/single-room-surcharge-currency-20260901-v48a");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(OUTPUT, "manifest.json"), "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("v48a 배포·복구 HTML과 기능 계약이 일치한다", () => {
  assert.equal(MANIFEST.schema, "golfjoin-stage48a-single-room-surcharge-currency-v1");
  assert.equal(MANIFEST.features.japaneseYenPreserved, true);
  assert.equal(MANIFEST.features.foreignCurrencyExcludedFromWonTotal, true);
  assert.equal(MANIFEST.features.wonSurchargePreserved, true);
  assert.equal(MANIFEST.features.v47aAnalyticsPreserved, true);

  const deploy = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.deployHtml));
  const rollback = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.rollbackHtml));
  assert.equal(sha256(deploy), MANIFEST.files.deployHtml.sha256);
  assert.equal(sha256(rollback), MANIFEST.files.rollbackHtml.sha256);
  assert.equal(sha256(rollback), "3ee35546aa842aec18dd7be95cbe963b0673d8f80d566e5315c7bf5bd120bc47");
});

test("v48a ERP HTML은 새 불변 JavaScript와 정확한 SRI를 참조한다", () => {
  const deploy = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.deployHtml), "utf8");
  assert.match(deploy, new RegExp(MANIFEST.assetRevision));
  assert.match(deploy, new RegExp(MANIFEST.files.js.logicalSri.replace(/[+]/g, "\\+")));
  assert.match(deploy, /gha_4eafdfbf84a3563fdf9aeb9e\/golfjoin-main\.css/);
});

test("v48a 압축 JavaScript는 통화 수정과 v47a GA4 계약을 함께 보존한다", () => {
  const compressed = fs.readFileSync(path.join(OUTPUT, MANIFEST.names.js));
  assert.equal(sha256(compressed), MANIFEST.files.js.sha256);
  const javascript = zlib.brotliDecompressSync(compressed).toString("utf8");
  new vm.Script(javascript, { filename: "golfjoin-main.v48a.js" });
  [
    "singleRoomSurchargeDisplayText",
    "manual_check",
    "JPY",
    "엔",
    "golfjoin_apply_step_view",
    "golfjoin_create_step_view",
    "generate_lead"
  ].forEach((value) => assert.match(javascript, new RegExp(value)));
});
