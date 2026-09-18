"use strict";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const INDEX_PATH = path.join(__dirname, "index.js");
const MAIN_HTML_PATH = path.join(__dirname, "..", "..", "golfjoin_main.html");

test("Release V2는 관리자 전용 publish·status·rollback 경로로만 연결된다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  assert.match(source, /action === "admin_release_v2_status"/);
  assert.match(source, /action === "admin_release_v2_publish"/);
  assert.match(source, /action === "admin_release_v2_rollback"/);
  assert.match(source, /async function proxyAdminReleaseV2Status[\s\S]*?assertGolfJoinReleaseAdmin\(req\)/);
  assert.match(source, /async function proxyAdminReleaseV2Publish[\s\S]*?assertGolfJoinReleaseAdmin\(req\)/);
  assert.match(source, /async function proxyAdminReleaseV2Rollback[\s\S]*?assertGolfJoinReleaseAdmin\(req\)/);
});

test("기존 상품업데이트와 백그라운드 홈 갱신은 Release V2를 자동 발행하지 않는다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const refreshStart = source.indexOf("async function refreshSecretTourProducts");
  const proxyGetStart = source.indexOf("async function proxyGet", refreshStart);
  const refreshBody = source.slice(refreshStart, proxyGetStart);
  assert.ok(refreshStart >= 0 && proxyGetStart > refreshStart);
  assert.equal(refreshBody.includes("publishGolfJoinReleaseV2("), false);

  const backgroundStart = source.indexOf("function refreshGolfJoinHomeSummaryInBackground");
  const refreshProductsStart = source.indexOf("async function refreshSecretTourProducts", backgroundStart);
  const backgroundBody = source.slice(backgroundStart, refreshProductsStart);
  assert.equal(backgroundBody.includes("publishGolfJoinReleaseV2("), false);
});

test("현재 메인 HTML은 Release V2 root나 관리자 action을 읽지 않는다", (context) => {
  if (!fs.existsSync(MAIN_HTML_PATH)) {
    context.skip("Cloud Function 단독 배포 폴더에는 메인 HTML이 포함되지 않는다");
    return;
  }
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  assert.equal(html.includes("release-manifest-v2.json"), false);
  assert.equal(html.includes("admin_release_v2_"), false);
});
