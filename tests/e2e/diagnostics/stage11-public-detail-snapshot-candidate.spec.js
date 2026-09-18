"use strict";

const { test, expect } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = readLocalMainHtml();
const DETAIL_REVISION = "gpd_333333333333333333333333";

function replaceEmbeddedGolfJoinHtml(shellHtml) {
  const marker = "<title>골프 조인 게시판</title>";
  const markerIndex = shellHtml.indexOf(marker);
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("stage11_snapshot_candidate_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

async function openCandidate(page) {
  const homeUrl = test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
  await page.route((url) => {
    const target = new URL(homeUrl);
    return url.origin === target.origin
      && url.pathname === target.pathname
      && url.searchParams.get("eventPlanSeq") === target.searchParams.get("eventPlanSeq");
  }, async (route) => {
    const response = await route.fetch();
    const shellHtml = await response.text();
    await route.fulfill({
      response,
      body: replaceEmbeddedGolfJoinHtml(shellHtml),
      headers: { ...response.headers(), "content-type": "text/html; charset=utf-8" }
    });
  });
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => typeof loadSecretTourGoodsDetail === "function", null, { timeout: 60_000 });
}

function detailUrl(goodSeq) {
  return `https://storage.googleapis.com/golfjoin-bucket/web/product-detail/${DETAIL_REVISION}/${goodSeq}.json`;
}

function buildSnapshot(goodSeq, eventSeq, overrides = {}) {
  return {
    schema: "secret-golf-join-product-detail-v1",
    generatedAt: "2026-08-12T10:00:00+09:00",
    detailRevision: DETAIL_REVISION,
    goodSeq,
    eventSeq,
    erpProductId: goodSeq,
    erpEventSeq: eventSeq,
    goodTransportSeq: "30002073",
    title: "공개 상세 테스트",
    detailTitleCopy: "스냅샷 상세 설명",
    departureDate: "2026-09-07",
    returnDate: "2026-09-11",
    price: 1000000,
    detailStatus: "ready",
    sectionStatus: {
      includes: "available",
      excludes: "available",
      notes: "available",
      schedule: "available",
      images: "available"
    },
    flight: {
      state: "not_required",
      packType: "골프팩",
      airline: "",
      departureAirport: "인천",
      arrivalAirport: "치앙마이",
      items: []
    },
    includes: ["그린피"],
    excludes: ["캐디팁"],
    notes: [{ text: "여권 확인", source: "secret-tour-goods-view" }],
    schedule: [{
      day: "1일차",
      dateText: "9/07(월)",
      content: "인천공항 출발",
      rawText: "1일차 인천공항 출발",
      extra: { hotel: "테스트 호텔", meals: [] }
    }],
    slides: ["https://www.secret-tour.com/images/detail.jpg"],
    introImages: ["https://www.secret-tour.com/images/intro.jpg"],
    sourceUrl: `https://www.secret-tour.com/goods/goods_view?goodSeq=${goodSeq}&eventSeq=${eventSeq}`,
    source: "secret-tour-goods-view",
    warnings: [],
    ...overrides
  };
}

function buildProduct(goodSeq, eventSeq) {
  return {
    id: `erp-${goodSeq}-${eventSeq}`,
    goodSeq,
    eventSeq,
    erpProductId: goodSeq,
    erpEventSeq: eventSeq,
    title: "공개 상세 테스트",
    departureDate: "2026-09-07",
    returnDate: "2026-09-11",
    price: 1000000,
    productType: "골프팩",
    detailRevision: DETAIL_REVISION,
    detailStatus: "ready",
    detailObjectName: `web/product-detail/${DETAIL_REVISION}/${goodSeq}.json`,
    detailUrl: detailUrl(goodSeq)
  };
}

test("public detail snapshot succeeds once and invalid or missing snapshots fall back exactly once", async ({ page }) => {
  test.setTimeout(180_000);
  await openCandidate(page);
  const snapshotCounts = new Map();
  const legacyCounts = new Map();
  const success = { goodSeq: "39990001", eventSeq: "49990001" };
  const invalid = { goodSeq: "39990002", eventSeq: "49990002" };
  const missing = { goodSeq: "39990003", eventSeq: "49990003" };

  await page.route("https://storage.googleapis.com/golfjoin-bucket/web/product-detail/**", async (route) => {
    const url = new URL(route.request().url());
    const goodSeq = url.pathname.split("/").pop().replace(/\.json$/, "");
    snapshotCounts.set(goodSeq, (snapshotCounts.get(goodSeq) || 0) + 1);
    if (goodSeq === missing.goodSeq) {
      await route.fulfill({ status: 404, body: "not found", headers: { "access-control-allow-origin": "*" } });
      return;
    }
    const snapshot = goodSeq === invalid.goodSeq
      ? buildSnapshot("39999999", invalid.eventSeq)
      : buildSnapshot(success.goodSeq, success.eventSeq);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snapshot),
      headers: { "access-control-allow-origin": "*" }
    });
  });
  await page.route("**/goods/goods_view?**", async (route) => {
    const url = new URL(route.request().url());
    const goodSeq = url.searchParams.get("goodSeq");
    legacyCounts.set(goodSeq, (legacyCounts.get(goodSeq) || 0) + 1);
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<html><body><script>const oGoodsView={eventNm:'legacy',goodTransportSeq:'30002073'};</script></body></html>`
    });
  });

  const results = await page.evaluate(async ({ success, invalid, missing, revision }) => {
    const makeProduct = ({ goodSeq, eventSeq }) => ({
      id: `erp-${goodSeq}-${eventSeq}`,
      goodSeq,
      eventSeq,
      erpProductId: goodSeq,
      erpEventSeq: eventSeq,
      title: "공개 상세 테스트",
      departureDate: "2026-09-07",
      returnDate: "2026-09-11",
      price: 1000000,
      productType: "골프팩",
      detailRevision: revision,
      detailStatus: "ready",
      detailObjectName: `web/product-detail/${revision}/${goodSeq}.json`,
      detailUrl: `https://storage.googleapis.com/golfjoin-bucket/web/product-detail/${revision}/${goodSeq}.json`
    });
    const successProduct = makeProduct(success);
    const firstSuccess = await loadSecretTourGoodsDetail(successProduct);
    const secondSuccess = await loadSecretTourGoodsDetail(successProduct);
    const invalidResult = await loadSecretTourGoodsDetail(makeProduct(invalid));
    const missingResult = await loadSecretTourGoodsDetail(makeProduct(missing));
    return {
      firstSuccessSnapshot: firstSuccess.secretTourPublicDetailSnapshot === true,
      secondSuccessSnapshot: secondSuccess.secretTourPublicDetailSnapshot === true,
      invalidUsedLegacy: invalidResult.secretTourPublicDetailSnapshot !== true,
      missingUsedLegacy: missingResult.secretTourPublicDetailSnapshot !== true
    };
  }, { success, invalid, missing, revision: DETAIL_REVISION });

  expect(results).toEqual({
    firstSuccessSnapshot: true,
    secondSuccessSnapshot: true,
    invalidUsedLegacy: true,
    missingUsedLegacy: true
  });
  expect(snapshotCounts.get(success.goodSeq)).toBe(1);
  expect(snapshotCounts.get(invalid.goodSeq)).toBe(1);
  expect(snapshotCounts.get(missing.goodSeq)).toBe(1);
  expect(legacyCounts.get(success.goodSeq) || 0).toBe(0);
  expect(legacyCounts.get(invalid.goodSeq)).toBe(1);
  expect(legacyCounts.get(missing.goodSeq)).toBe(1);
});

test("MD PICK, builder, normal join and my reservation details share the public snapshot path", async ({ page }) => {
  test.setTimeout(180_000);
  await openCandidate(page);
  const products = [
    { route: "mdpick", goodSeq: "39990101", eventSeq: "49990101" },
    { route: "builder", goodSeq: "39990102", eventSeq: "49990102" },
    { route: "normal", goodSeq: "39990103", eventSeq: "49990103" },
    { route: "reservation", goodSeq: "39990104", eventSeq: "49990104" }
  ];
  const snapshotCounts = new Map();
  let legacyCount = 0;

  await page.route("https://storage.googleapis.com/golfjoin-bucket/web/product-detail/**", async (route) => {
    const url = new URL(route.request().url());
    const goodSeq = url.pathname.split("/").pop().replace(/\.json$/, "");
    const product = products.find((item) => item.goodSeq === goodSeq);
    snapshotCounts.set(goodSeq, (snapshotCounts.get(goodSeq) || 0) + 1);
    await route.fulfill({
      status: product ? 200 : 404,
      contentType: "application/json",
      body: product ? JSON.stringify(buildSnapshot(product.goodSeq, product.eventSeq)) : "{}",
      headers: { "access-control-allow-origin": "*" }
    });
  });
  await page.route("**/goods/goods_view?**", async (route) => {
    legacyCount += 1;
    await route.fulfill({ status: 500, body: "legacy path must not run" });
  });
  await page.route("**/goods/add/flight_schedule?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const routeResults = await page.evaluate(async ({ products, revision }) => {
    const makeProduct = (item) => ({
      id: `${item.route}-${item.goodSeq}-${item.eventSeq}`,
      goodSeq: item.goodSeq,
      eventSeq: item.eventSeq,
      erpProductId: item.goodSeq,
      erpEventSeq: item.eventSeq,
      title: `${item.route} detail`,
      region: "test region",
      category: "test category",
      departureDate: "2026-09-07",
      returnDate: "2026-09-11",
      price: 1000000,
      generalPrice: 1000000,
      productType: "golf",
      status: "open",
      maxPeople: 4,
      joinedPeople: 1,
      remaining: 3,
      participants: [],
      detailRevision: revision,
      detailStatus: "ready",
      detailObjectName: `web/product-detail/${revision}/${item.goodSeq}.json`,
      detailUrl: `https://storage.googleapis.com/golfjoin-bucket/web/product-detail/${revision}/${item.goodSeq}.json`
    });
    const waitUntil = async (predicate, timeout = 5000) => {
      const startedAt = performance.now();
      while (!predicate()) {
        if (performance.now() - startedAt > timeout) throw new Error("detail route hydration timeout");
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };
    const result = {};

    secretTourGoodsDetailCache.clear();
    const mdPickProduct = makeProduct(products.find((item) => item.route === "mdpick"));
    await showMdPickDetailProduct(mdPickProduct, `good-${mdPickProduct.goodSeq}`, "thailand");
    result.mdpick = document.getElementById("detailModal")?.classList.contains("open")
      && currentDetailMode === "mdPickProduct"
      && currentDetailJoinData?.secretTourDetailLoaded === true;
    closeModal("detailModal");

    const builderProduct = makeProduct(products.find((item) => item.route === "builder"));
    await showBuilderProductDetailProduct(builderProduct);
    result.builder = document.getElementById("detailModal")?.classList.contains("open")
      && currentDetailMode === "builderProduct"
      && currentDetailJoinData?.secretTourDetailLoaded === true;
    closeModal("detailModal");

    const normalJoin = makeProduct(products.find((item) => item.route === "normal"));
    joins.push(normalJoin);
    openDetail(normalJoin.id, { allowUnavailable: true });
    await waitUntil(() => normalJoin.secretTourDetailLoaded === true);
    result.normal = {
      open: document.getElementById("detailModal")?.classList.contains("open") === true,
      mode: currentDetailMode,
      sameJoinId: currentDetailJoinData?.id === normalJoin.id,
      loaded: normalJoin.secretTourDetailLoaded === true
    };
    closeModal("detailModal");

    const reservationJoin = makeProduct(products.find((item) => item.route === "reservation"));
    joins.push(reservationJoin);
    handleJoinMyReservationProduct(reservationJoin.id, reservationJoin.title, false);
    await waitUntil(() => reservationJoin.secretTourDetailLoaded === true);
    result.reservation = {
      open: document.getElementById("detailModal")?.classList.contains("open") === true,
      reservationMode: document.getElementById("detailModal")?.classList.contains("my-reservation-view-mode") === true,
      mode: currentDetailMode,
      sameJoinId: currentDetailJoinData?.id === reservationJoin.id,
      loaded: reservationJoin.secretTourDetailLoaded === true
    };
    closeModal("detailModal");

    return result;
  }, { products, revision: DETAIL_REVISION });

  expect(routeResults).toEqual({
    mdpick: true,
    builder: true,
    normal: { open: true, mode: "normal", sameJoinId: true, loaded: true },
    reservation: { open: true, reservationMode: true, mode: "normal", sameJoinId: true, loaded: true }
  });
  products.forEach((product) => expect(snapshotCounts.get(product.goodSeq)).toBe(1));
  expect(legacyCount).toBe(0);
});
