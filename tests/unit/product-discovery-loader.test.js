"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const {
  buildProductDiscoveryArtifacts,
  serializePayload
} = require("../../server/google-sheet-proxy-function/product-discovery");

const LOADER_PATH = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/data/35-product-discovery.js"
);

function event(goodSeq, eventSeq, departureDate, region) {
  return {
    id: `erp-${goodSeq}-${eventSeq}`,
    source: "erp",
    goodSeq,
    eventSeq,
    title: `테스트 상품 ${goodSeq}`,
    region,
    category: "해외",
    departureDate,
    returnDate: departureDate,
    price: 259000,
    airport: "인천",
    status: "예약",
    emptySlots: 4
  };
}

function buildFixture(options = {}) {
  return buildProductDiscoveryArtifacts({
    generatedAt: "2026-08-13T09:00:00+09:00",
    sourceGeneratedAt: "2026-08-13T08:59:00+09:00",
    items: [
      event("30000001", "301", "2026-08-20", "방콕"),
      event("30000002", "302", "2026-08-25", "치앙마이"),
      event("30000003", "303", "2026-09-02", "다낭")
    ]
  }, { browserReadEnabled: options.browserReadEnabled !== false });
}

function createLoader(options = {}) {
  const publication = buildFixture({ browserReadEnabled: options.manifestEnabled !== false });
  const rootUrl = "https://storage.googleapis.com/golfjoin-bucket/web/product-discovery/manifest.json";
  const bodies = new Map([
    [rootUrl, serializePayload(publication.manifestPayload)],
    [publication.indexArtifact.url, serializePayload(publication.indexArtifact.payload)],
    [publication.lookupArtifact.url, serializePayload(publication.lookupArtifact.payload)],
    ...publication.monthArtifacts.map((artifact) => [artifact.url, serializePayload(artifact.payload)])
  ]);
  if (options.corruptMonth) {
    const august = publication.monthArtifacts.find((artifact) => artifact.month === "2026-08");
    bodies.set(august.url, `${serializePayload(august.payload)} `);
  }
  const counters = { fetch: new Map(), fallback: 0, warn: 0 };
  const sandbox = {
    AbortController,
    Date,
    Error,
    JSON,
    Map,
    Number,
    Promise,
    Set,
    String,
    TextEncoder,
    Uint8Array,
    URL,
    console,
    encodeURIComponent,
    window: {
      GOLFJOIN_PRODUCT_DISCOVERY_ENABLED: options.enabled !== false,
      location: { hostname: "www.secret-tour.com" },
      crypto: crypto.webcrypto,
      setTimeout,
      clearTimeout
    },
    async fetch(url) {
      counters.fetch.set(url, Number(counters.fetch.get(url) || 0) + 1);
      if (!bodies.has(url)) return { ok: false, status: 404, async text() { return ""; } };
      return { ok: true, status: 200, async text() { return bodies.get(url); } };
    },
    normalizeExternalGolfJoinProduct(item) {
      return { ...item, erpProductId: item.goodSeq, erpEventSeq: item.eventSeq };
    },
    getSecretTourProductReference(product) {
      return {
        goodSeq: String(product.goodSeq || product.erpProductId || ""),
        eventSeq: String(product.eventSeq || product.erpEventSeq || "")
      };
    },
    async ensureExternalGolfJoinProductsLoaded() {
      counters.fallback += 1;
      return [{ ...event("39999999", "999", "2026-08-01", "기존경로"), legacy: true }];
    },
    golfJoinSafeWarn() {
      counters.warn += 1;
    }
  };
  sandbox.globalThis = sandbox;
  const source = fs.readFileSync(LOADER_PATH, "utf8");
  vm.runInNewContext(`${source}\n;globalThis.__api = {
    loadMonths: loadGolfJoinProductDiscoveryMonths,
    loadRegion: loadGolfJoinProductDiscoveryRegion,
    loadDirect: loadGolfJoinProductDiscoveryDirect,
    beginConsumer: beginGolfJoinProductDiscoveryConsumer,
    isCurrent: isGolfJoinProductDiscoveryConsumerCurrent,
    invalidateConsumer: invalidateGolfJoinProductDiscoveryConsumer,
    getDiagnostics: getGolfJoinProductDiscoveryDiagnostics,
    getCached: getCachedGolfJoinProductDiscoveryProducts
  };`, sandbox);
  return { api: sandbox.__api, counters, publication, rootUrl };
}

test("페이지 진입만으로는 product-discovery를 요청하지 않는다", () => {
  const { counters } = createLoader();
  assert.equal(counters.fetch.size, 0);
  assert.equal(counters.fallback, 0);
});

test("같은 월의 동시 요청은 root·index·월 shard Promise를 한 번만 공유한다", async () => {
  const { api, counters, publication, rootUrl } = createLoader();
  const [first, second] = await Promise.all([
    api.loadMonths(["2026-08"], { consumer: "calendar", fallback: false }),
    api.loadMonths(["2026-08"], { consumer: "builder", fallback: false })
  ]);
  const august = publication.monthArtifacts.find((artifact) => artifact.month === "2026-08");
  assert.equal(first.length, 2);
  assert.equal(second.length, 2);
  assert.equal(counters.fetch.get(rootUrl), 1);
  assert.equal(counters.fetch.get(publication.indexArtifact.url), 1);
  assert.equal(counters.fetch.get(august.url), 1);
  assert.equal(counters.fetch.get(publication.lookupArtifact.url) || 0, 0);
  assert.equal(counters.fallback, 0);
  assert.equal(api.getCached().length, 2);
});

test("발행 범위 밖 인접 월은 오류나 전체 상품 fallback 없이 건너뛴다", async () => {
  const { api, counters, publication, rootUrl } = createLoader();
  const products = await api.loadMonths(
    ["2026-07", "2026-08", "2026-09"],
    { consumer: "calendar", reason: "adjacent-months" }
  );
  const august = publication.monthArtifacts.find((artifact) => artifact.month === "2026-08");
  const september = publication.monthArtifacts.find((artifact) => artifact.month === "2026-09");
  assert.equal(products.length, 3);
  assert.equal(counters.fetch.get(rootUrl), 1);
  assert.equal(counters.fetch.get(publication.indexArtifact.url), 1);
  assert.equal(counters.fetch.get(august.url), 1);
  assert.equal(counters.fetch.get(september.url), 1);
  assert.equal(counters.fallback, 0);
  assert.equal(counters.warn, 0);
  assert.equal(api.getDiagnostics().some((item) => item.type === "fallback"), false);
});

test("딥링크 직접 조회는 lookup과 대상 월만 읽고 정확한 행사를 반환한다", async () => {
  const { api, counters, publication } = createLoader();
  const product = await api.loadDirect("30000003", "303", { consumer: "deeplink", fallback: false });
  const september = publication.monthArtifacts.find((artifact) => artifact.month === "2026-09");
  assert.equal(product.goodSeq, "30000003");
  assert.equal(product.eventSeq, "303");
  assert.equal(counters.fetch.get(publication.lookupArtifact.url), 1);
  assert.equal(counters.fetch.get(publication.indexArtifact.url), 1);
  assert.equal(counters.fetch.get(september.url), 1);
  assert.equal(counters.fallback, 0);
});

test("지역 조회는 index의 해당 지역 월만 선택해 가져온다", async () => {
  const { api, counters, publication } = createLoader();
  const products = await api.loadRegion("다낭", { consumer: "region", fallback: false });
  const september = publication.monthArtifacts.find((artifact) => artifact.month === "2026-09");
  const august = publication.monthArtifacts.find((artifact) => artifact.month === "2026-08");
  assert.equal(products.length, 1);
  assert.equal(products[0].region, "다낭");
  assert.equal(counters.fetch.get(september.url), 1);
  assert.equal(counters.fetch.get(august.url) || 0, 0);
});

test("월 shard 해시가 다르면 화면별 기존 전체 로더로 복구한다", async () => {
  const { api, counters } = createLoader({ corruptMonth: true });
  const products = await api.loadMonths(["2026-08"], { consumer: "calendar", reason: "initial-month" });
  assert.equal(products[0].legacy, true);
  assert.equal(counters.fallback, 1);
  assert.equal(counters.warn, 1);
  assert.equal(api.getDiagnostics().some((item) => item.type === "fallback" && item.consumer === "calendar"), true);
});

test("서버 root의 브라우저 gate가 OFF이면 신규 객체를 읽지 않고 기존 경로로 복구한다", async () => {
  const { api, counters, publication } = createLoader({ manifestEnabled: false });
  const products = await api.loadMonths(["2026-08"], { consumer: "calendar", reason: "gate-off" });
  assert.equal(products[0].legacy, true);
  assert.equal(counters.fallback, 1);
  assert.equal(counters.fetch.get(publication.indexArtifact.url) || 0, 0);
  assert.equal(counters.fetch.get(publication.lookupArtifact.url) || 0, 0);
});

test("지역 조회도 서버 gate가 OFF이면 기존 전체 로더로 복구한다", async () => {
  const { api, counters, publication } = createLoader({ manifestEnabled: false });
  const products = await api.loadRegion("태국", { consumer: "empty-my-meetings", reason: "gate-off" });
  assert.equal(products[0].legacy, true);
  assert.equal(counters.fallback, 1);
  assert.equal(counters.fetch.get(publication.indexArtifact.url) || 0, 0);
  assert.equal(api.getDiagnostics().some((item) => (
    item.type === "fallback" && item.consumer === "empty-my-meetings"
  )), true);
});

test("소비자 generation은 늦은 이전 응답의 화면 반영을 구분한다", () => {
  const { api } = createLoader();
  const first = api.beginConsumer("builder");
  assert.equal(api.isCurrent("builder", first), true);
  const second = api.invalidateConsumer("builder");
  assert.equal(api.isCurrent("builder", first), false);
  assert.equal(api.isCurrent("builder", second), true);
});
