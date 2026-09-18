"use strict";

const { test, expect } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const RELEASE_ROOT_URL = "https://storage.googleapis.com/golfjoin-bucket/web/release-manifest-v2.json";
const LOCAL_MAIN_HTML = readLocalMainHtml();

function getHomeUrl() {
  return test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
}

async function installCandidateShell(page, options = {}) {
  const homeUrl = getHomeUrl();
  await page.addInitScript(({ rolloutBucket }) => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", String(rolloutBucket));
    window.GOLFJOIN_HOME_DATA_V2_ENABLED = true;
  }, { rolloutBucket: options.rolloutBucket ?? 9999 });
  await page.route((url) => {
    const target = new URL(homeUrl);
    return url.origin === target.origin
      && url.pathname === target.pathname
      && url.searchParams.get("eventPlanSeq") === target.searchParams.get("eventPlanSeq");
  }, async (route) => {
    await route.fulfill({
      status: 200,
      body: LOCAL_MAIN_HTML,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8"
      }
    });
  });
  await page.route(RELEASE_ROOT_URL, async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    const headers = {
      ...response.headers(),
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    };
    delete headers["content-length"];
    delete headers["content-encoding"];
    await route.fulfill({
      status: response.status(),
      headers,
      body: JSON.stringify({
        ...manifest,
        browserReadEnabled: options.browserGateEnabled !== false
      })
    });
  });
  if (options.corruptHomeCards === true) {
    await page.route((url) => (
      url.hostname === "storage.googleapis.com"
      && url.pathname.includes("/web/releases/")
      && url.pathname.includes("/objects/homeCards-")
    ), async (route) => {
      const response = await route.fetch();
      const body = `${await response.text()} `;
      const headers = { ...response.headers() };
      delete headers["content-length"];
      delete headers["content-encoding"];
      await route.fulfill({ response, headers, body });
    });
  }
}

function isReleaseV2Url(url) {
  return url.includes("/web/release-manifest-v2.json") || url.includes("/web/releases/");
}

function isLegacyHomeCoreUrl(url) {
  return url.includes("/web/golfjoin_home_cards.json")
    || url.includes("/web/product-family/manifest.json")
    || url.includes("action=home_bootstrap_light");
}

async function openLegacyReadyCandidate(page) {
  const homeUrl = getHomeUrl();
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  // `homeBootstrapLoading` is reset before the async bootstrap request starts,
  // so observing `false` alone can mistake the local-cache paint for the final
  // Legacy presentation (especially on a mobile context). The performance mark
  // is emitted only from the bootstrap promise's `finally` block.
  await expect.poll(() => page.evaluate(() => (
    performance.getEntriesByName("golfjoin:boot:bootstrap-settled").length
  )), { timeout: 60_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => ({
    cards: document.querySelectorAll("#joinMdPickSection .join-mdpick-card").length,
    productsLoading: Boolean(homeInitialExternalProductsLoading),
    bootstrapLoading: Boolean(homeBootstrapLoading),
    homeRenderScheduled: Boolean(homeRenderScheduled),
    mdPickRenderScheduled: Boolean(homeMdPickRenderScheduled),
    products: Array.isArray(homeGolfJoinProducts) ? homeGolfJoinProducts.length : 0,
    v2State: getGolfJoinHomeDataV2Diagnostics().state
  })), { timeout: 60_000 }).toEqual(expect.objectContaining({
    cards: expect.any(Number),
    productsLoading: false,
    bootstrapLoading: false,
    homeRenderScheduled: false,
    mdPickRenderScheduled: false,
    products: expect.any(Number),
    v2State: "LEGACY_READY"
  }));
  await expect.poll(() => page.evaluate(() => homeGolfJoinProducts?.length || 0), {
    timeout: 30_000
  }).toBeGreaterThan(0);
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 30_000
  }).toBeGreaterThan(0);
  await page.evaluate(() => {
    document.querySelector("#joinMdPickSection [data-mdpick-theme-deferred]")
      ?.scrollIntoView({ block: "center", behavior: "auto" });
  });
  await expect.poll(() => page.locator("#join-section-mdpick-theme .join-mdpick-theme-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  await page.evaluate(() => {
    stopMdPickThemeAutoSlide();
    if (typeof stopHeroAutoSlide === "function") stopHeroAutoSlide();
  });
  await page.waitForTimeout(250);
  await expect.poll(() => page.evaluate(() => ({
    homeRenderScheduled: Boolean(homeRenderScheduled),
    mdPickRenderScheduled: Boolean(homeMdPickRenderScheduled)
  })), { timeout: 30_000 }).toEqual({
    homeRenderScheduled: false,
    mdPickRenderScheduled: false
  });
}

async function capturePresentation(page) {
  return page.evaluate(() => {
    const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const productSignature = (product = {}) => {
      const reference = getSecretTourProductReference(product);
      return {
        groupKey: String(getProductGroupKey(product) || ""),
        goodSeq: String(reference.goodSeq || product.goodSeq || product.erpProductId || ""),
        eventSeq: String(reference.eventSeq || product.eventSeq || product.erpEventSeq || ""),
        title: cleanText(product.title),
        price: Number(product.priceFrom || product.price || 0),
        departureDate: String(product.departureDate || ""),
        returnDate: String(product.returnDate || ""),
        status: String(
          product.status
          || product.recruitmentStatus
          || (Number(product.priceFrom || product.price || 0) > 0 && product.departureDate ? "available" : "")
        ),
        country: cleanText(product.country),
        region: cleanText(product.region || product.category),
        image: String(product.image || product.thumb || "")
      };
    };
    const joinSignature = (join = {}) => ({
      id: String(join.id || join.scheduleId || join.sourceApplicationId || ""),
      title: cleanText(join.title),
      price: Number(join.price || 0),
      departureDate: String(join.departureDate || ""),
      returnDate: String(join.returnDate || ""),
      status: String(join.recruitmentStatus || join.status || ""),
      confirmedCount: Number(
        join.participantSummary?.confirmedCount
        ?? join.lightSummary?.confirmedCount
        ?? join.confirmedCount
        ?? getConfirmedParticipants(join).length
        ?? 0
      ),
      capacity: Number(getJoinRecruitmentCapacity(join) || 0),
      emptySlots: Number(join.emptySlots || 0),
      participantKeys: getConfirmedParticipants(join).map((participant) => cleanText(
        participant.memberKey
        || participant.memberSeq
        || participant.memberId
        || participant.mobile
        || participant.name
      ))
    });
    const domCardSignature = (card) => ({
      open: String(card.getAttribute("onclick") || ""),
      title: cleanText(card.querySelector(".join-title, .join-mdpick-title, .join-mdpick-theme-product")?.textContent),
      date: cleanText(card.querySelector(".card-meta-text-date")?.textContent),
      price: cleanText(card.querySelector(".join-price, .join-mdpick-price, .join-mdpick-theme-price")?.textContent),
      status: cleanText(card.querySelector(".join-card-feature-tag, .join-own-schedule-badge, .join-category-chip")?.textContent)
    });
    const mdPick = MD_PICK_COUNTRIES.map((country) => ({
      country: country.key,
      golf: getMdPickRepresentativeProducts(country, "golf").map((item) => ({
        key: String(item.key || ""),
        title: cleanText(item.title),
        price: Number(item.price || 0),
        departureDate: String(item.departureDate || "")
      })),
      air: getMdPickRepresentativeProducts(country, "air").map((item) => ({
        key: String(item.key || ""),
        title: cleanText(item.title),
        price: Number(item.price || 0),
        departureDate: String(item.departureDate || "")
      }))
    }));
    const themes = getVisibleMdPickThemes().map((theme) => ({
      key: String(theme.key || ""),
      items: (theme.items || []).map(productSignature)
    }));
    const sections = getHomeJoinSections().map((section) => ({
      key: String(section.key || ""),
      items: getSectionDisplayItems(section).map(joinSignature)
    }));
    const dom = {
      mdPick: [...document.querySelectorAll("#joinMdPickSection .join-mdpick-card")].map(domCardSignature),
      theme: [...document.querySelectorAll("#join-section-mdpick-theme .join-mdpick-theme-card")].map(domCardSignature),
      quick: [...document.querySelectorAll("#join-section-quick .join-card:not([data-quick-carousel-clone='true'])")].map(domCardSignature),
      soon: [...document.querySelectorAll("#join-section-soon .join-card:not([data-quick-carousel-clone='true'])")].map(domCardSignature),
      custom: [...document.querySelectorAll("#join-section-custom .join-card:not([data-quick-carousel-clone='true'])")].map(domCardSignature),
      overseas: [...document.querySelectorAll("#join-section-overseas .join-card:not([data-quick-carousel-clone='true'])")].map(domCardSignature)
    };
    return {
      inventory: {
        rowCount: homeGolfJoinProducts.length,
        uniqueGoodSeqCount: new Set(homeGolfJoinProducts.map((product) => (
          String(getSecretTourProductReference(product).goodSeq || product.goodSeq || product.erpProductId || "")
        )).filter(Boolean)).size
      },
      mdPick,
      themes,
      sections,
      dom
    };
  });
}

test("Release V2 keeps logged-out home order, price, date and status identical", async ({ page }) => {
  await installCandidateShell(page);
  await openLegacyReadyCandidate(page);
  const legacy = await capturePresentation(page);

  const transaction = await page.evaluate(() => runGolfJoinHomeDataV2Transaction({
    ignoreCircuit: true,
    timeoutMs: 30_000
  }));
  expect(transaction).toEqual(expect.objectContaining({ ok: true, state: "V2_RUNNING" }));
  await expect.poll(() => page.evaluate(() => getGolfJoinHomeDataV2Diagnostics()), {
    timeout: 30_000
  }).toEqual(expect.objectContaining({
    state: "V2_RUNNING",
    requestCount: 3,
    hasCandidate: false
  }));
  await page.waitForTimeout(750);
  await page.evaluate(() => stopMdPickThemeAutoSlide());
  const v2 = await capturePresentation(page);
  const { inventory: legacyInventory, ...legacyPresentation } = legacy;
  const { inventory: v2Inventory, ...v2Presentation } = v2;

  await test.info().attach("release-v2-parity.json", {
    body: Buffer.from(JSON.stringify({ project: test.info().project.name, transaction, legacy, v2 }, null, 2)),
    contentType: "application/json"
  });
  expect(v2Inventory.uniqueGoodSeqCount).toBe(legacyInventory.uniqueGoodSeqCount);
  expect(v2Presentation).toEqual(legacyPresentation);
});

test("Release V2 object corruption leaves the rendered Legacy home untouched", async ({ page }) => {
  await installCandidateShell(page, { corruptHomeCards: true });
  await openLegacyReadyCandidate(page);
  const legacy = await capturePresentation(page);

  const transaction = await page.evaluate(() => runGolfJoinHomeDataV2Transaction({
    ignoreCircuit: true,
    timeoutMs: 30_000
  }));
  expect(transaction).toEqual(expect.objectContaining({
    ok: false,
    fallback: true,
    reason: "home_data_v2_object_bytes_mismatch"
  }));
  const diagnostics = await page.evaluate(() => getGolfJoinHomeDataV2Diagnostics());
  expect(diagnostics).toEqual(expect.objectContaining({
    state: "V2_FALLBACK",
    requestCount: 3,
    hasCandidate: false,
    committedReleaseRevision: ""
  }));
  const afterFailure = await capturePresentation(page);

  await test.info().attach("release-v2-fallback.json", {
    body: Buffer.from(JSON.stringify({ project: test.info().project.name, transaction, diagnostics }, null, 2)),
    contentType: "application/json"
  });
  expect(afterFailure).toEqual(legacy);
});

test("automatic eligible rollout honors remote OFF with one manifest request", async ({ page }) => {
  const releaseRequests = [];
  page.on("request", (request) => {
    if (isReleaseV2Url(request.url())) releaseRequests.push(request.url());
  });
  await installCandidateShell(page, { rolloutBucket: 0, browserGateEnabled: false });
  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  const diagnostics = await page.evaluate(() => getGolfJoinHomeDataV2Diagnostics());
  expect(diagnostics).toEqual(expect.objectContaining({
    state: "LEGACY_READY",
    reason: "remote_gate_off",
    requestCount: 1,
    rolloutBucket: 0,
    rolloutEligible: true,
    hasCandidate: false,
    committedReleaseRevision: ""
  }));
  expect(releaseRequests).toHaveLength(1);
  expect(releaseRequests[0]).toContain("/web/release-manifest-v2.json");
});

test("automatic eligible rollout uses only manifest, static and live when remote ON", async ({ page }) => {
  const releaseRequests = [];
  const legacyCoreRequests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (isReleaseV2Url(url)) releaseRequests.push(url);
    if (isLegacyHomeCoreUrl(url)) legacyCoreRequests.push(url);
  });
  await installCandidateShell(page, { rolloutBucket: 0, browserGateEnabled: true });
  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => getGolfJoinHomeDataV2Diagnostics()), {
    timeout: 60_000
  }).toEqual(expect.objectContaining({
    state: "V2_RUNNING",
    reason: "running",
    requestCount: 3,
    rolloutBucket: 0,
    rolloutEligible: true,
    hasCandidate: false
  }));
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  expect(releaseRequests).toHaveLength(3);
  expect(legacyCoreRequests).toEqual([]);
});

test("candidate Release loads complete product-family availability from one family shard", async ({ page }) => {
  const shardRequests = [];
  const legacyCoreRequests = [];
  const pageErrors = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/web/product-availability/")) shardRequests.push(url);
    if (isLegacyHomeCoreUrl(url)) legacyCoreRequests.push(url);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installCandidateShell(page, { rolloutBucket: 0, browserGateEnabled: true });
  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => getGolfJoinHomeDataV2Diagnostics()), {
    timeout: 60_000
  }).toEqual(expect.objectContaining({
    state: "V2_RUNNING",
    reason: "running",
    requestCount: 3,
    rolloutBucket: 0,
    rolloutEligible: true
  }));

  const result = await page.evaluate(async () => {
    const summaries = (Array.isArray(homeGolfJoinProducts) ? homeGolfJoinProducts : [])
      .filter((product) => product?.homeProductSummary === true && product.availabilityObjectName);
    const groups = new Map();
    summaries.forEach((product) => {
      const key = getProductGroupKey(product);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    });
    const products = [...groups.values()]
      .sort((left, right) => right.length - left.length)[0] || [];
    const loaded = await loadGolfJoinProductGroupAvailability(products);
    const expectedGoodSeqs = [...new Set(products.map((product) => getGolfJoinProductGoodSeq(product)).filter(Boolean))];
    const loadedGoodSeqs = [...new Set(loaded.map((product) => getGolfJoinProductGoodSeq(product)).filter(Boolean))];
    return {
      summaryCount: products.length,
      expectedGoodSeqs,
      loadedGoodSeqs,
      loadedEventCount: loaded.length,
      uniqueDepartureCount: new Set(loaded.map((product) => product.departureDate).filter(Boolean)).size,
      allEventsBelongToGroup: loaded.every((product) => expectedGoodSeqs.includes(getGolfJoinProductGoodSeq(product)))
    };
  });

  expect(result.summaryCount).toBeGreaterThan(0);
  expect(result.expectedGoodSeqs.length).toBeGreaterThan(0);
  expect(result.loadedGoodSeqs.sort()).toEqual(result.expectedGoodSeqs.sort());
  expect(result.loadedEventCount).toBeGreaterThan(result.summaryCount);
  expect(result.uniqueDepartureCount).toBeGreaterThan(1);
  expect(result.allEventsBelongToGroup).toBe(true);
  expect(shardRequests.filter((url) => url.includes("/families/"))).toHaveLength(1);
  expect(shardRequests.filter((url) => !url.includes("/families/"))).toHaveLength(0);

  const firstCard = page.locator("#joinMdPickSection .join-mdpick-card").first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click();
  const detailModal = page.locator("#detailModal");
  await expect(detailModal).toHaveClass(/\bopen\b/, { timeout: 60_000 });
  const periodOptions = detailModal.locator(".detail-family-period-option");
  await expect.poll(() => periodOptions.count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
  const periodGoodSeqs = await periodOptions.evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("data-family-good-seq")).filter(Boolean)
  ));
  expect(new Set(periodGoodSeqs).size).toBeGreaterThanOrEqual(2);
  await expect(detailModal.locator(".detail-family-period-option.is-selected")).toHaveCount(1);
  const closeButton = detailModal.locator(".detail-slider-back:visible, .modal-close-icon:visible").first();
  await closeButton.click();
  await expect(detailModal).not.toHaveClass(/\bopen\b/);
  expect(legacyCoreRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
