"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function extractFunction(source, functionName) {
  const candidates = [`async function ${functionName}(`, `function ${functionName}(`];
  const start = candidates.map((declaration) => source.indexOf(declaration)).find((index) => index >= 0);
  assert.notEqual(start, undefined, `${functionName} declaration not found`);
  const bodyStart = source.indexOf("{", source.indexOf(")", start));
  assert.notEqual(bodyStart, -1, `${functionName} body not found`);
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
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

function createGroupLoader(overrides = {}) {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = extractFunction(html, "loadGolfJoinProductGroupAvailability");
  const counters = { fetch: 0, legacy: 0, apply: 0, warn: 0 };
  const context = {
    familyId: "pf_fixture",
    familyRevision: "pfc_111111111111111111111111",
    availabilityRevision: "gpa_222222222222222222222222",
    cacheKey: "gpa_222222222222222222222222:pfc_111111111111111111111111:pf_fixture",
    urls: ["https://storage.googleapis.com/golfjoin-bucket/web/product-availability/family.json"]
  };
  const sandbox = {
    Promise,
    Error,
    golfJoinProductFamilyAvailabilityCache: new Map(),
    golfJoinProductFamilyAvailabilityPromiseCache: new Map(),
    getGolfJoinProductFamilyId: () => "pf_fixture",
    getGolfJoinProductFamilyAvailabilityContext: () => context,
    async fetchGolfJoinHomeJson() {
      counters.fetch += 1;
      return { schema: "secret-golf-join-family-availability-v1" };
    },
    applyGolfJoinProductFamilyAvailabilityPayload() {
      counters.apply += 1;
      return [{ id: "merged" }];
    },
    async loadGolfJoinProductGroupAvailabilityLegacy() {
      counters.legacy += 1;
      return [{ id: "legacy" }];
    },
    golfJoinSafeWarn() {
      counters.warn += 1;
    },
    ...overrides
  };
  vm.runInNewContext(`${source}; globalThis.loadForTest = loadGolfJoinProductGroupAvailability;`, sandbox);
  return { load: sandbox.loadForTest, sandbox, counters, context };
}

test("같은 상품군을 동시에 열면 상품군 가용일 요청 한 건과 Promise 하나를 공유한다", async () => {
  const { load, counters, sandbox } = createGroupLoader();
  const summaries = [{ goodSeq: "30001104" }, { goodSeq: "30001242" }];
  const first = load(summaries);
  const second = load(summaries);
  assert.equal(first, second);
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.deepEqual(firstResult, [{ id: "merged" }]);
  assert.deepEqual(secondResult, [{ id: "merged" }]);
  assert.equal(counters.fetch, 1);
  assert.equal(counters.apply, 1);
  assert.equal(counters.legacy, 0);
  assert.equal(sandbox.golfJoinProductFamilyAvailabilityPromiseCache.size, 0);
  assert.equal(sandbox.golfJoinProductFamilyAvailabilityCache.size, 1);
});

test("상품군 객체 요청이나 검증이 실패하면 기존 상품별 경로로 자동 복구한다", async () => {
  const { load, counters } = createGroupLoader({
    async fetchGolfJoinHomeJson() {
      counters.fetch += 1;
      throw new Error("404");
    }
  });
  const result = await load([{ goodSeq: "30001104" }, { goodSeq: "30001242" }]);
  assert.deepEqual(result, [{ id: "legacy" }]);
  assert.equal(counters.fetch, 1);
  assert.equal(counters.legacy, 1);
  assert.equal(counters.warn, 1);
});

test("상품군이 없는 단독 상품은 새 요청 없이 기존 goodSeq 경로를 유지한다", async () => {
  const { load, counters } = createGroupLoader({ getGolfJoinProductFamilyId: () => "" });
  const result = await load([{ goodSeq: "30009999" }]);
  assert.deepEqual(result, [{ id: "legacy" }]);
  assert.equal(counters.fetch, 0);
  assert.equal(counters.legacy, 1);
});

test("상품군 객체 주소는 가용일·상품군 리비전을 모두 포함한다", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = extractFunction(html, "getGolfJoinProductFamilyAvailabilityContext");
  const sandbox = {
    encodeURIComponent,
    golfJoinProductFamilyCatalog: { publicationRevision: "pfc_111111111111111111111111" },
    golfJoinProductFamilyManifest: null,
    golfJoinHomeManifest: null
  };
  vm.runInNewContext(`${source}; globalThis.contextForTest = getGolfJoinProductFamilyAvailabilityContext;`, sandbox);
  const context = sandbox.contextForTest([{
    availabilityRevision: "gpa_222222222222222222222222",
    availabilityObjectName: "web/product-availability/gpa_222222222222222222222222/30001104.json"
  }], "pf_fixture");
  assert.equal(context.cacheKey, "gpa_222222222222222222222222:pfc_111111111111111111111111:pf_fixture");
  assert.equal(
    context.urls[0],
    "https://storage.googleapis.com/golfjoin-bucket/web/product-availability/gpa_222222222222222222222222/families/pfc_111111111111111111111111/pf_fixture.json"
  );
  assert.equal(context.urls.length, 1);
});

test("브라우저 검증기는 스키마·두 리비전·구성원·행사 수를 모두 확인한다", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = extractFunction(html, "applyGolfJoinProductFamilyAvailabilityPayload");
  assert.match(source, /secret-golf-join-family-availability-v1/);
  assert.match(source, /payload\.familyRevision/);
  assert.match(source, /payload\.availabilityRevision/);
  assert.match(source, /members do not match the active catalog/);
  assert.match(source, /Number\(payload\.count\) !== eventCount/);
});
