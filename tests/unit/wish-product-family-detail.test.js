"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const memberPath = path.join(root, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js");
const stylePath = path.join(root, "src/golfjoin-main/source/styles/10-main.css");
const memberSource = fs.readFileSync(memberPath, "utf8");
const styleSource = fs.readFileSync(stylePath, "utf8");

function extractFunction(source, functionName) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`);
  const match = pattern.exec(source);
  assert.ok(match, `${functionName} declaration not found`);
  const start = match.index;
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.ok(bodyStart > 1, `${functionName} body start not found`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

test("상품군에서 선택해 찜한 goodSeq와 eventSeq를 가용일 데이터에서 다시 찾는다", async () => {
  const summary = { goodSeq: "30001000", group: "family-pf-test" };
  const wishedEvent = { goodSeq: "30001001", eventSeq: "30280001", group: "family-pf-test", country: "태국" };
  const sandbox = {
    getJoinWishTargetKey: (item) => item.targetKey,
    ensureHomeGolfJoinProductsLoaded: async () => [summary],
    ensureGolfJoinProductFamilyCatalogLoaded: async () => ({}),
    getHomeProductSource: () => [summary],
    golfJoinProductFamilyIdByGoodSeq: new Map([["30001001", "pf-test"]]),
    getProductGroupKey: (product) => product.group,
    getGolfJoinProductGoodSeq: (product) => String(product.goodSeq || ""),
    loadGolfJoinProductGroupAvailability: async () => [wishedEvent],
    mergeGolfJoinProductSources: (...sources) => sources.flat(),
    getCachedGolfJoinAvailabilityProducts: () => [],
    getBuilderProductSource: () => [],
    getGolfJoinProductEventSeq: (product) => String(product.eventSeq || ""),
    selectGolfJoinBookableProduct: (products) => products[0] || null,
    selectGolfJoinProductGroupRepresentative: (products) => products[0] || null,
    normalizeExternalGolfJoinProduct: (product) => product,
    getMdPickProductCountryKey: () => "thailand"
  };
  vm.runInNewContext(`${extractFunction(memberSource, "resolveJoinWishProductDetail")}
    globalThis.resolveWish = resolveJoinWishProductDetail;`, sandbox);

  const resolved = await sandbox.resolveWish({ targetKey: "30001001", eventSeq: "30280001" }, "30001001");

  assert.equal(resolved.product, wishedEvent);
  assert.equal(resolved.productGroupKey, "family-pf-test");
  assert.equal(resolved.countryKey, "thailand");
});

test("찜한 상품은 외부 상품 페이지로 보내지 않고 기존 상세 모달과 복귀 문맥을 사용한다", () => {
  const source = extractFunction(memberSource, "openJoinWishProduct");
  assert.match(source, /resolveJoinWishProductDetail/);
  assert.match(source, /showMdPickDetailProduct/);
  assert.match(source, /currentDetailReturnContext\s*=\s*\{\s*menu:\s*"wish",\s*tab:\s*"wish-products"\s*\}/);
  assert.doesNotMatch(source, /location\.href/);
  assert.doesNotMatch(source, /\/goods\/goods_view/);
});

test("상품군 기간 선택 영역은 별도 배경색을 사용하지 않는다", () => {
  const block = styleSource.match(/\.detail-family-periods\s*\{([\s\S]*?)\}/);
  assert.ok(block, "detail-family-periods style block");
  assert.doesNotMatch(block[1], /background(?:-color)?\s*:/);
});
