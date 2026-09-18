"use strict";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const INDEX_PATH = path.join(__dirname, "index.js");
const MAIN_HTML_PATH = path.join(__dirname, "..", "..", "golfjoin_main.html");
const MAIN_RELEASE_SOURCE_PATH = path.join(__dirname, "..", "..", "src", "golfjoin-main", "source", "scripts", "data", "35-release-v2-bootstrap.js");
const MAIN_INITIALIZE_SOURCE_PATH = path.join(__dirname, "..", "..", "src", "golfjoin-main", "source", "scripts", "boot", "40-initialize.js");

test("Release V2는 관리자 전용 publish·status·shadow·rollback 경로로만 연결된다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  assert.match(source, /action === "admin_release_v2_status"/);
  assert.match(source, /action === "admin_release_v2_shadow_compare"/);
  assert.match(source, /action === "admin_release_v2_publish"/);
  assert.match(source, /action === "admin_release_v2_rollback"/);
  assert.match(source, /action === "admin_release_v2_browser_gate"/);
  assert.match(source, /async function proxyAdminReleaseV2Status[\s\S]*?assertGolfJoinReleaseAdmin\(req\)/);
  assert.match(source, /async function proxyAdminReleaseV2ShadowCompare[\s\S]*?assertGolfJoinReleaseAdmin\(req\)/);
  assert.match(source, /async function proxyAdminReleaseV2Publish[\s\S]*?assertGolfJoinReleaseAdmin\(req\)/);
  assert.match(source, /async function proxyAdminReleaseV2Rollback[\s\S]*?assertGolfJoinReleaseAdmin\(req\)/);
  assert.match(source, /async function proxyAdminReleaseV2BrowserGate[\s\S]*?assertGolfJoinReleaseAdmin\(req\)/);
});

test("Release V2 publish는 Shadow 비교를 통과한 뒤에만 객체 발행을 시작한다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const start = source.indexOf("async function proxyAdminReleaseV2Publish");
  const end = source.indexOf("async function proxyAdminReleaseV2ShadowCompare", start);
  const body = source.slice(start, end);
  const compareAt = body.indexOf("compareGolfJoinReleaseV2Context");
  const assertAt = body.indexOf("assertGolfJoinReleaseV2ShadowReport");
  const publishAt = body.indexOf("publishGolfJoinReleaseV2");

  assert.ok(start >= 0 && end > start);
  assert.ok(compareAt >= 0 && assertAt > compareAt && publishAt > assertAt);
});

test("관리자 상품업데이트는 최신 Release V2를 검증·발행·활성화하고 백그라운드 갱신은 발행하지 않는다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const refreshStart = source.indexOf("async function refreshSecretTourProducts");
  const proxyGetStart = source.indexOf("async function proxyGet", refreshStart);
  const refreshBody = source.slice(refreshStart, proxyGetStart);
  assert.ok(refreshStart >= 0 && proxyGetStart > refreshStart);
  const staleGateOffAt = refreshBody.indexOf("setGolfJoinReleaseV2BrowserGate(bucket, false");
  const shadowAt = refreshBody.indexOf("compareGolfJoinReleaseV2Context");
  const assertAt = refreshBody.indexOf("assertGolfJoinReleaseV2ShadowReport");
  const publishAt = refreshBody.indexOf("publishGolfJoinReleaseV2");
  const gateOnAt = refreshBody.indexOf("setGolfJoinReleaseV2BrowserGate(bucket, true");
  assert.ok(staleGateOffAt >= 0);
  assert.ok(shadowAt > staleGateOffAt && assertAt > shadowAt && publishAt > assertAt && gateOnAt > publishAt);
  assert.match(refreshBody, /expectedReleaseRevision:\s*releaseRevision/);
  assert.match(refreshBody, /verifyGolfJoinReleaseV2\(bucket, releaseActivation\.root\.payload\)/);

  const backgroundStart = source.indexOf("function refreshGolfJoinHomeSummaryInBackground");
  const refreshProductsStart = source.indexOf("async function refreshSecretTourProducts", backgroundStart);
  const backgroundBody = source.slice(backgroundStart, refreshProductsStart);
  assert.equal(backgroundBody.includes("publishGolfJoinReleaseV2("), false);
});

test("현재 메인 HTML은 익명 100% rollout만 연결하고 관리자 action은 읽지 않는다", (context) => {
  if (!fs.existsSync(MAIN_HTML_PATH)) {
    context.skip("Cloud Function 단독 배포 폴더에는 메인 HTML이 포함되지 않는다");
    return;
  }
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const releaseSource = fs.existsSync(MAIN_RELEASE_SOURCE_PATH)
    ? fs.readFileSync(MAIN_RELEASE_SOURCE_PATH, "utf8")
    : html;
  const initializeSource = fs.existsSync(MAIN_INITIALIZE_SOURCE_PATH)
    ? fs.readFileSync(MAIN_INITIALIZE_SOURCE_PATH, "utf8")
    : html;
  const clientSource = `${html}\n${releaseSource}\n${initializeSource}`;
  assert.match(releaseSource, /const GOLFJOIN_HOME_DATA_V2_AUTO_BOOT_ENABLED = true;/);
  assert.match(releaseSource, /const GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS = 10000;/);
  assert.match(releaseSource, /async function runGolfJoinHomeDataV2Startup\(options = \{\}\)/);
  assert.match(initializeSource, /await runGolfJoinHomeDataV2Startup\(\)/);
  assert.match(releaseSource, /release-manifest-v2\.json/);
  assert.equal(clientSource.includes("admin_release_v2_"), false);
});
