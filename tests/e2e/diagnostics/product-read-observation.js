"use strict";

const { chromium } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = readLocalMainHtml();

function replaceEmbeddedGolfJoinHtml(shellHtml) {
  const marker = "<title>골프 조인 게시판</title>";
  const markerIndex = shellHtml.indexOf(marker);
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("product_read_observation_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

async function waitForSettledObservation(page) {
  try {
    await page.waitForFunction(() => {
      const observation = window.__golfJoinProductReadObservation;
      if (!observation?.detailCalls?.length) return false;
      const allSettled = observation.detailCalls.every((item) => item.status !== "pending");
      return allSettled && performance.now() - observation.lastDetailCallAt >= 750;
    }, null, { timeout: 60_000 });
  } catch (_error) {
    // A slow upstream read is itself an observation. Return pending entries below.
  }
}

async function observeProject(browser, project, options = {}) {
  const context = await browser.newContext({
    viewport: project.viewport,
    userAgent: project.userAgent
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
  });
  if (options.candidate) {
    await page.route((url) => {
      const target = new URL(project.url);
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
  }
  await page.goto(project.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#joinMdPickSection .join-mdpick-card", { timeout: 60_000 });

  await page.evaluate(() => {
    const observation = {
      startedAt: performance.now(),
      lastDetailCallAt: 0,
      availabilityCalls: [],
      detailCalls: [],
      fetches: [],
      hotspots: {},
      timeline: []
    };
    window.__golfJoinProductReadObservation = observation;
    const initializeSource = String(initializeGolfJoinHome);
    const hydrateBootstrapSource = String(hydrateHomeBootstrapLightFromGoogleSheet);
    const homeProductsLoaderSource = String(ensureHomeGolfJoinProductsLoaded);
    const scheduleHomeRenderSource = String(scheduleHomeRender);
    const interactionGuardSource = String(isHomeRenderBlockingInteractionActive);
    const readLoadingEndSource = String(endJoinReadLoading);
    observation.sourceMarkers = {
      bootstrapStartupRenderDisabled: initializeSource.includes(
        "hydrateHomeBootstrapLightFromGoogleSheet({ render: false })"
      ),
      bootstrapCompletionDefersForModal: initializeSource.includes(
        "scheduleHomeRender({ deferWhileModalOpen: true })"
      ),
      bootstrapHydratorForwardsRenderOption: hydrateBootstrapSource.includes(
        "render: options.render"
      ),
      startupWaitsForProductsAndBootstrap: initializeSource.includes(
        "Promise.all([homeProductsPromise, bootstrapPromise])"
      ),
      startupProductFullRenderDisabled: initializeSource.includes(
        "ensureHomeGolfJoinProductsLoaded({ renderHome: false })"
      ) && homeProductsLoaderSource.includes("options.renderHome !== false"),
      startupLocalSnapshotRendersBeforeNetwork: initializeSource.includes(
        "renderJoins({ skipQuickMobileCarousel: true })"
      ) && initializeSource.indexOf(
        "renderJoins({ skipQuickMobileCarousel: true })"
      ) < initializeSource.indexOf("const homeProductsPromise"),
      mdPickAvailabilityBlocksHomeRender: interactionGuardSource.includes(
        "startsWith(\"mdpick-availability:\")"
      ),
      schedulerUsesInteractionGuard: scheduleHomeRenderSource.includes(
        "isHomeRenderBlockedByModalOrInteraction()"
      ),
      readCompletionFlushesDeferredRender: readLoadingEndSource.includes(
        "flushDeferredHomeRenderIfReady()"
      )
    };
    const now = () => Math.round((performance.now() - observation.startedAt) * 10) / 10;
    const mark = (name, detail = {}) => observation.timeline.push({ name, at: now(), ...detail });
    const observeSyncHotspot = (name, original) => function observedSyncHotspot(...args) {
      const startedAt = performance.now();
      try {
        return original.apply(this, args);
      } finally {
        const durationMs = performance.now() - startedAt;
        const entry = observation.hotspots[name] || { calls: 0, totalMs: 0, maxMs: 0 };
        entry.calls += 1;
        entry.totalMs = Math.round((entry.totalMs + durationMs) * 10) / 10;
        entry.maxMs = Math.max(entry.maxMs, Math.round(durationMs * 10) / 10);
        observation.hotspots[name] = entry;
      }
    };
    const getObservationCallPath = () => String(new Error().stack || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => (
        line.startsWith("at ")
        && !line.includes("getObservationCallPath")
        && !line.includes("observedScheduleHomeRender")
        && !line.includes("observedRenderJoins")
      ))
      .slice(0, 6)
      .join(" | ");
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) mark("mdpick-card-click");
    }, true);

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const rawUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const url = new URL(rawUrl || "", location.href);
      const isDetail = url.pathname === "/goods/goods_view";
      const isAvailability = /availability/i.test(url.pathname);
      if (!isDetail && !isAvailability) return originalFetch(...args);
      const entry = {
        kind: isDetail ? "goods-view" : "availability",
        host: url.host,
        path: url.pathname,
        goodSeq: url.searchParams.get("goodSeq") || "",
        eventSeq: url.searchParams.get("eventSeq") || "",
        startedAt: Math.round((performance.now() - observation.startedAt) * 10) / 10,
        durationMs: null,
        status: "pending"
      };
      observation.fetches.push(entry);
      const startedAt = performance.now();
      try {
        const response = await originalFetch(...args);
        entry.durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        entry.status = String(response.status);
        return response;
      } catch (error) {
        entry.durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        entry.status = error?.name || "failed";
        throw error;
      }
    };

    const originalAvailability = loadGolfJoinProductAvailability;
    loadGolfJoinProductAvailability = async function observedAvailability(product = {}) {
      const goodSeq = getGolfJoinProductGoodSeq(product);
      const entry = {
        goodSeq,
        urls: getGolfJoinProductAvailabilityUrls(product),
        cacheBefore: golfJoinProductAvailabilityCache.has(goodSeq),
        promiseBefore: golfJoinProductAvailabilityPromiseCache.has(goodSeq),
        durationMs: null,
        eventCount: null,
        status: "pending"
      };
      observation.availabilityCalls.push(entry);
      const startedAt = performance.now();
      try {
        const products = await originalAvailability(product);
        entry.durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        entry.eventCount = Array.isArray(products) ? products.length : 0;
        entry.status = "loaded";
        return products;
      } catch (error) {
        entry.durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        entry.status = error?.name || "failed";
        throw error;
      }
    };

    const originalGroupAvailability = loadGolfJoinProductGroupAvailability;
    loadGolfJoinProductGroupAvailability = async function observedGroupAvailability(products = []) {
      mark("group-availability-start", { productCount: Array.isArray(products) ? products.length : 0 });
      try {
        const result = await originalGroupAvailability(products);
        mark("group-availability-end", { eventCount: Array.isArray(result) ? result.length : 0 });
        return result;
      } catch (error) {
        mark("group-availability-failed", { errorName: error?.name || "failed" });
        throw error;
      }
    };

    const originalSelectBookable = selectGolfJoinBookableProduct;
    selectGolfJoinBookableProduct = function observedSelectBookable(...args) {
      const startedAt = performance.now();
      const result = originalSelectBookable(...args);
      mark("select-bookable", {
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        candidateCount: Array.isArray(args[0]) ? args[0].length : 0,
        selectedKey: result ? getSecretTourGoodsDetailCacheKey(result) : ""
      });
      return result;
    };

    const originalRenderDetail = renderDetailContent;
    renderDetailContent = function observedRenderDetail(...args) {
      const startedAt = performance.now();
      mark("render-detail-start", { mode: currentDetailMode || "" });
      const result = originalRenderDetail(...args);
      mark("render-detail-end", {
        mode: currentDetailMode || "",
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10
      });
      return result;
    };

    const originalOpenModal = openModal;
    openModal = function observedOpenModal(modalId, ...args) {
      const startedAt = performance.now();
      const result = originalOpenModal(modalId, ...args);
      mark("open-modal-return", {
        modalId,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10
      });
      return result;
    };

    const originalShowMdPickDetail = showMdPickDetailProduct;
    showMdPickDetailProduct = function observedShowMdPickDetail(product, ...args) {
      mark("show-mdpick-detail-call", { key: getSecretTourGoodsDetailCacheKey(product) });
      return originalShowMdPickDetail(product, ...args);
    };

    const originalRenderBuilderCalendar = renderBuilderCalendar;
    renderBuilderCalendar = function observedRenderBuilderCalendar(...args) {
      const startedAt = performance.now();
      const result = originalRenderBuilderCalendar(...args);
      mark("render-builder-calendar", { durationMs: Math.round((performance.now() - startedAt) * 10) / 10 });
      return result;
    };

    const originalScheduleHomeRender = scheduleHomeRender;
    scheduleHomeRender = function observedScheduleHomeRender(options = {}) {
      mark("schedule-home-render", {
        deferWhileModalOpen: Boolean(options?.deferWhileModalOpen),
        callPath: getObservationCallPath()
      });
      return originalScheduleHomeRender(options);
    };

    const originalRenderJoins = renderJoins;
    getHomeJoinSections = observeSyncHotspot("getHomeJoinSections", getHomeJoinSections);
    renderMyHomeJoinSection = observeSyncHotspot("renderMyHomeJoinSection", renderMyHomeJoinSection);
    renderMyHomeJoinPanel = observeSyncHotspot("renderMyHomeJoinPanel", renderMyHomeJoinPanel);
    getMyHomeJoinItems = observeSyncHotspot("getMyHomeJoinItems", getMyHomeJoinItems);
    getSectionDisplayItems = observeSyncHotspot("getSectionDisplayItems", getSectionDisplayItems);
    getSoonFilteredItems = observeSyncHotspot("getSoonFilteredItems", getSoonFilteredItems);
    getSoonDisplayItems = observeSyncHotspot("getSoonDisplayItems", getSoonDisplayItems);
    getOverseasBestFilteredItems = observeSyncHotspot(
      "getOverseasBestFilteredItems",
      getOverseasBestFilteredItems
    );
    renderCustomJoinSection = observeSyncHotspot("renderCustomJoinSection", renderCustomJoinSection);
    renderJoinProductSection = observeSyncHotspot("renderJoinProductSection", renderJoinProductSection);
    renderJoinCard = observeSyncHotspot("renderJoinCard", renderJoinCard);
    getSheetDetailReviews = observeSyncHotspot("getSheetDetailReviews", getSheetDetailReviews);
    renderJoinOwnScheduleBadge = observeSyncHotspot(
      "renderJoinOwnScheduleBadge",
      renderJoinOwnScheduleBadge
    );
    renderCardDateMeta = observeSyncHotspot("renderCardDateMeta", renderCardDateMeta);
    renderCardTeamSlots = observeSyncHotspot("renderCardTeamSlots", renderCardTeamSlots);
    getConfirmedParticipants = observeSyncHotspot(
      "getConfirmedParticipants",
      getConfirmedParticipants
    );
    updateJoinSectionNavVisibility = observeSyncHotspot(
      "updateJoinSectionNavVisibility",
      updateJoinSectionNavVisibility
    );
    applyGolfJoinImageFallbacks = observeSyncHotspot("applyGolfJoinImageFallbacks", applyGolfJoinImageFallbacks);
    setupQuickMobileCarousel = observeSyncHotspot("setupQuickMobileCarousel", setupQuickMobileCarousel);
    setupCustomThemeRailScrollSync = observeSyncHotspot(
      "setupCustomThemeRailScrollSync",
      setupCustomThemeRailScrollSync
    );
    renderJoins = function observedRenderJoins(...args) {
      const startedAt = performance.now();
      const relativeStartedAt = Math.round((startedAt - observation.startedAt) * 10) / 10;
      const modalOpenAtStart = Boolean(
        document.getElementById("detailModal")?.classList.contains("open")
        || document.getElementById("builderModal")?.classList.contains("open")
        || document.getElementById("regionSearchModal")?.classList.contains("open")
      );
      const result = originalRenderJoins(...args);
      mark("render-joins", {
        startedAt: relativeStartedAt,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        modalOpenAtStart,
        callPath: getObservationCallPath()
      });
      return result;
    };

    const originalEnsureExternal = ensureExternalGolfJoinProductsLoaded;
    ensureExternalGolfJoinProductsLoaded = function observedEnsureExternal(...args) {
      const startedAt = performance.now();
      const result = originalEnsureExternal(...args);
      mark("ensure-external-return", { durationMs: Math.round((performance.now() - startedAt) * 10) / 10 });
      return result;
    };

    const originalDetail = loadSecretTourGoodsDetail;
    loadSecretTourGoodsDetail = function observedDetail(product = {}) {
      const reference = getSecretTourProductReference(product);
      const key = getSecretTourGoodsDetailCacheKey(product);
      const stack = String(new Error().stack || "");
      const entry = {
        key,
        goodSeq: reference.goodSeq,
        eventSeq: reference.eventSeq,
        role: stack.includes("hydrateDetailProductFamilyPeriodMetadata")
          ? "family-period-metadata"
          : stack.includes("showMdPickDetailProduct")
            ? "selected-product-detail"
            : stack.includes("enrichOpenDetailWithSecretTourData")
              ? "join-detail"
              : "other",
        cacheBefore: secretTourGoodsDetailCache.has(key),
        durationMs: null,
        status: "pending"
      };
      observation.detailCalls.push(entry);
      observation.lastDetailCallAt = performance.now();
      mark("detail-loader-call", { key, role: entry.role, cacheBefore: entry.cacheBefore });
      const startedAt = performance.now();
      return originalDetail(product).then((detail) => {
        entry.durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        entry.status = "loaded";
        return detail;
      }, (error) => {
        entry.durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        entry.status = error?.name || "failed";
        throw error;
      });
    };
  });

  await page.locator("#joinMdPickSection .join-mdpick-card").first().click();
  await page.waitForSelector("#detailModal.open", { timeout: 60_000 });
  await waitForSettledObservation(page);
  if (options.closeCheck) {
    await page.evaluate(() => {
      const observation = window.__golfJoinProductReadObservation;
      observation.modalClosedAt = Math.round((performance.now() - observation.startedAt) * 10) / 10;
      closeModal("detailModal");
    });
    try {
      await page.waitForFunction(() => {
        const observation = window.__golfJoinProductReadObservation;
        return observation.timeline.filter((item) => (
          item.name === "render-joins" && item.at > observation.modalClosedAt
        )).length >= 1;
      }, null, { timeout: 20_000 });
    } catch (_error) {
      // The result below reports zero if a deferred render was lost.
    }
  }
  const result = await page.evaluate(() => {
    const observation = window.__golfJoinProductReadObservation;
    const detailNetworkKeys = observation.fetches
      .filter((item) => item.kind === "goods-view")
      .map((item) => `${item.goodSeq}:${item.eventSeq}`);
    const cardClickAt = observation.timeline.find((item) => item.name === "mdpick-card-click")?.at || 0;
    const modalClosedAt = observation.modalClosedAt || Number.POSITIVE_INFINITY;
    const localSnapshotRenderMeasure = performance.getEntriesByName(
      "golfjoin:duration:home-local-render",
      "measure"
    )[0];
    return {
      ...observation,
      sourceMarkers: observation.sourceMarkers,
      detailNetworkRequestCount: detailNetworkKeys.length,
      detailNetworkUniqueCount: new Set(detailNetworkKeys).size,
      detailNetworkDuplicateCount: detailNetworkKeys.length - new Set(detailNetworkKeys).size,
      preClickRenderCount: observation.timeline.filter((item) => (
        item.name === "render-joins" && item.startedAt < cardClickAt
      )).length,
      preClickRenderDurationMs: observation.timeline
        .filter((item) => item.name === "render-joins" && item.startedAt < cardClickAt)
        .reduce((sum, item) => sum + Number(item.durationMs || 0), 0),
      localSnapshotRenderDurationMs: localSnapshotRenderMeasure
        ? Math.round(localSnapshotRenderMeasure.duration * 10) / 10
        : null,
      renderDuringOpenCount: observation.timeline.filter((item) => (
        item.name === "render-joins" && item.modalOpenAtStart
      )).length,
      renderDuringInteractionCount: observation.timeline.filter((item) => (
        item.name === "render-joins" && item.startedAt > cardClickAt && item.startedAt < modalClosedAt
      )).length,
      renderAfterCloseCount: observation.timeline.filter((item) => (
        item.name === "render-joins" && item.startedAt > modalClosedAt
      )).length
    };
  });
  await context.close();
  return { project: project.name, source: options.candidate ? "local-candidate" : "deployed", ...result };
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const projects = [
      {
        name: "desktop-chrome",
        url: HOME_URL,
        viewport: { width: 1440, height: 1000 }
      },
      {
        name: "mobile-chrome",
        url: HOME_URL.replace("https://www.", "https://m."),
        viewport: { width: 390, height: 844 },
        userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"
      }
    ].filter((project) => (
      (!process.argv.includes("--desktop") || project.name === "desktop-chrome")
      && (!process.argv.includes("--mobile") || project.name === "mobile-chrome")
    ));
    const candidate = process.argv.includes("--candidate");
    const closeCheck = process.argv.includes("--close-check");
    const results = [];
    for (const project of projects) results.push(await observeProject(browser, project, { candidate, closeCheck }));
    const output = process.argv.includes("--summary")
      ? results.map((result) => ({
        project: result.project,
        source: result.source,
        sourceMarkers: result.sourceMarkers,
        preClickRenderCount: result.preClickRenderCount,
        preClickRenderDurationMs: result.preClickRenderDurationMs,
        localSnapshotRenderDurationMs: result.localSnapshotRenderDurationMs,
        renderDuringOpenCount: result.renderDuringOpenCount,
        renderDuringInteractionCount: result.renderDuringInteractionCount,
        renderAfterCloseCount: result.renderAfterCloseCount,
        detailNetworkRequestCount: result.detailNetworkRequestCount,
        detailNetworkDuplicateCount: result.detailNetworkDuplicateCount,
        hotspots: result.hotspots
      }))
      : results;
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
