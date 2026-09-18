"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildProductDiscoveryArtifacts,
  serializePayload
} = require("../../../server/google-sheet-proxy-function/product-discovery");
const DESKTOP_HOME_URL = "https://www.secret-tour.com/__codex_stage12_candidate";
const MOBILE_HOME_URL = "https://m.secret-tour.com/__codex_stage12_candidate";
const LOADER_SOURCE = fs.readFileSync(path.resolve(
  __dirname,
  "../../../src/golfjoin-main/source/scripts/data/35-product-discovery.js"
), "utf8");

function event(goodSeq, eventSeq, departureDate, region) {
  return {
    id: `erp-${goodSeq}-${eventSeq}`,
    source: "erp",
    goodSeq,
    eventSeq,
    title: `브라우저 후보 상품 ${goodSeq}`,
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

function buildFixture() {
  return buildProductDiscoveryArtifacts({
    generatedAt: "2026-08-13T09:00:00+09:00",
    sourceGeneratedAt: "2026-08-13T08:59:00+09:00",
    items: [
      event("30000001", "301", "2026-08-20", "방콕"),
      event("30000002", "302", "2026-08-25", "치앙마이"),
      event("30000003", "303", "2026-09-02", "다낭")
    ]
  }, { browserReadEnabled: true });
}

async function installCandidate(page, homeUrl, options = {}) {
  const publication = buildFixture();
  const rootUrl = "https://storage.googleapis.com/golfjoin-bucket/web/product-discovery/manifest.json";
  const bodies = new Map([
    [rootUrl, serializePayload(publication.manifestPayload)],
    [publication.indexArtifact.url, serializePayload(publication.indexArtifact.payload)],
    [publication.lookupArtifact.url, serializePayload(publication.lookupArtifact.payload)],
    ...publication.monthArtifacts.map((artifact) => [artifact.url, serializePayload(artifact.payload)])
  ]);
  if (options.corruptAugust) {
    const august = publication.monthArtifacts.find((artifact) => artifact.month === "2026-08");
    bodies.set(august.url, `${bodies.get(august.url)} `);
  }
  const requests = [];
  await page.route(homeUrl, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><html><body><main id=\"stage12-candidate\">candidate</main></body></html>"
    });
  });
  await page.route("**/web/product-discovery/**", async (route) => {
    const url = route.request().url();
    requests.push(url);
    const body = bodies.get(url);
    if (!body) {
      await route.fulfill({ status: 404, body: "not found" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body });
  });
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => {
    window.normalizeExternalGolfJoinProduct = (item) => ({
      ...item,
      erpProductId: item.goodSeq,
      erpEventSeq: item.eventSeq
    });
    window.getSecretTourProductReference = (product) => ({
      goodSeq: String(product.goodSeq || product.erpProductId || ""),
      eventSeq: String(product.eventSeq || product.erpEventSeq || "")
    });
    window.__stage12FallbackCalls = 0;
    window.ensureExternalGolfJoinProductsLoaded = async () => {
      window.__stage12FallbackCalls += 1;
      return [{ id: "legacy", legacy: true }];
    };
    window.golfJoinSafeWarn = () => {};
  });
  await page.addScriptTag({ content: LOADER_SOURCE });
  await expect(page.locator("#stage12-candidate")).toBeVisible();
  return { publication, requests, rootUrl };
}

test("product-discovery는 사용자 동작 전 0요청이고 월·직접 조회를 실제 SHA-256으로 검증한다", async ({ page }) => {
  test.setTimeout(120_000);
  const homeUrl = test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
  const { publication, requests, rootUrl } = await installCandidate(page, homeUrl);
  expect(requests).toHaveLength(0);

  const result = await page.evaluate(async () => {
    const [first, second] = await Promise.all([
      loadGolfJoinProductDiscoveryMonths(["2026-08"], { consumer: "e2e-calendar", fallback: false }),
      loadGolfJoinProductDiscoveryMonths(["2026-08"], { consumer: "e2e-builder", fallback: false })
    ]);
    const direct = await loadGolfJoinProductDiscoveryDirect("30000003", "303", {
      consumer: "e2e-deeplink",
      fallback: false
    });
    return {
      firstCount: first.length,
      secondCount: second.length,
      direct: `${direct.goodSeq}:${direct.eventSeq}`,
      diagnostics: getGolfJoinProductDiscoveryDiagnostics()
    };
  });
  expect(result.firstCount).toBe(2);
  expect(result.secondCount).toBe(2);
  expect(result.direct).toBe("30000003:303");
  const august = publication.monthArtifacts.find((artifact) => artifact.month === "2026-08");
  const september = publication.monthArtifacts.find((artifact) => artifact.month === "2026-09");
  expect(requests.filter((url) => url === rootUrl)).toHaveLength(1);
  expect(requests.filter((url) => url === publication.indexArtifact.url)).toHaveLength(1);
  expect(requests.filter((url) => url === publication.lookupArtifact.url)).toHaveLength(1);
  expect(requests.filter((url) => url === august.url)).toHaveLength(1);
  expect(requests.filter((url) => url === september.url)).toHaveLength(1);
  expect(result.diagnostics.some((item) => item.fallback)).toBe(false);
});

test("손상된 월 shard는 해당 소비자만 기존 전체 로더로 복구한다", async ({ page }) => {
  test.setTimeout(120_000);
  const homeUrl = test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
  await installCandidate(page, homeUrl, { corruptAugust: true });
  const result = await page.evaluate(async () => {
    const products = await loadGolfJoinProductDiscoveryMonths(["2026-08"], {
      consumer: "e2e-calendar",
      reason: "corrupt-shard"
    });
    return {
      fallbackCalls: window.__stage12FallbackCalls,
      legacy: products[0]?.legacy === true,
      diagnostics: getGolfJoinProductDiscoveryDiagnostics()
    };
  });
  expect(result.fallbackCalls).toBe(1);
  expect(result.legacy).toBe(true);
  expect(result.diagnostics.some((item) => item.type === "fallback" && item.consumer === "e2e-calendar")).toBe(true);
});
