"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const INDEX_PATH = path.resolve(__dirname, "index.js");
const RELEASE_PATH = path.resolve(__dirname, "release-publisher.js");

function functionBlock(source, startName, nextName) {
  const start = source.indexOf(`async function ${startName}`);
  const end = source.indexOf(`async function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${startName} is missing`);
  assert.notEqual(end, -1, `${nextName} is missing`);
  return source.slice(start, end);
}

test("상품업데이트는 기존 discovery를 먼저 끄고 검증된 신규 root를 발행한다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const block = functionBlock(source, "saveGolfJoinProductsPayload", "readGolfJoinProductsPayloadFromStorage");
  const gateIndex = block.indexOf("setProductDiscoveryBrowserGate(bucket, false");
  const legacyIndex = block.indexOf("saveGolfJoinHomeArtifactsToStorage");
  const discoveryIndex = block.indexOf("publishProductDiscovery(bucket, summaryPayload");
  assert.ok(gateIndex >= 0 && gateIndex < legacyIndex);
  assert.ok(legacyIndex < discoveryIndex);
  assert.match(block, /return \{ homeArtifacts, productDiscovery \}/);
  assert.match(source, /browserReadEnabled:\s*discoveryActivation\.root\.payload\.browserReadEnabled === true/);
  assert.doesNotMatch(block, /publishGolfJoinReleaseV2/);
});

test("관리자 상품업데이트는 최신 discovery 검증 후 브라우저 gate를 다시 켠다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const block = functionBlock(source, "refreshSecretTourProducts", "proxySecretTourJson");
  const publishAt = block.indexOf("saveGolfJoinProductsPayload(payload)");
  const familyAt = block.indexOf("publishProductFamilyCatalogSnapshotViaApi");
  const discoveryGateAt = block.indexOf("setProductDiscoveryBrowserGate(bucket, true");
  const releaseGateAt = block.indexOf("setGolfJoinReleaseV2BrowserGate(bucket, true");
  assert.ok(publishAt >= 0 && familyAt > publishAt);
  assert.ok(discoveryGateAt > familyAt && releaseGateAt > discoveryGateAt);
  assert.match(block, /expectedDiscoveryRevision:\s*discoveryRevision/);
  assert.match(block, /verifyRemoteProductDiscovery\(bucket, discoveryActivation\.root\.payload\)/);
});

test("product discovery status·shadow·gate는 관리자 전용 독립 action으로만 연결된다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  assert.match(source, /admin_product_discovery_status/);
  assert.match(source, /admin_product_discovery_shadow_compare/);
  assert.match(source, /admin_product_discovery_browser_gate/);
  assert.match(source, /assertGolfJoinReleaseAdmin\(req\);[\s\S]*?readProductDiscoveryRoot/);
  assert.match(source, /expectedDiscoveryRevision:\s*asText\(payload\.expectedDiscoveryRevision\)/);
});

test("Release V2의 다섯 객체와 product discovery root는 서로 독립이다", () => {
  const releaseSource = fs.readFileSync(RELEASE_PATH, "utf8");
  assert.doesNotMatch(releaseSource, /product-discovery|productDiscovery/);
  const roles = /const RELEASE_ROLES = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(releaseSource)?.[1] || "";
  assert.equal((roles.match(/Object\.freeze/g) || []).length, 5);
});
