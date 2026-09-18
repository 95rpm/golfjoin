"use strict";

const { chromium } = require("@playwright/test");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const EXPECTED_RELEASE_REVISION = String(
  process.env.GOLFJOIN_V2_RELEASE_REVISION || ""
).trim();
const RUNS = Math.max(1, Number(process.argv.find((value) => value.startsWith("--runs="))?.split("=")[1]) || 3);

const PROJECTS = [
  {
    name: "desktop-chrome",
    url: DESKTOP_HOME_URL,
    viewport: { width: 1440, height: 1000 }
  },
  {
    name: "mobile-chrome",
    url: MOBILE_HOME_URL,
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"
  }
];

function round(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value) * 10) / 10 : null;
}

function percentile(values, ratio) {
  const numbers = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!numbers.length) return null;
  return round(numbers[Math.max(0, Math.ceil(numbers.length * ratio) - 1)]);
}

async function installObservation(page) {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", "0");
    const observation = {
      cardClickAt: null,
      modalOpenAt: null,
      detailReadyAt: null,
      periodRuns: [],
      requests: [],
      pageErrors: []
    };
    window.__golfJoinStage11Observation = observation;
    document.addEventListener("click", (event) => {
      if (!event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) return;
      observation.cardClickAt = performance.now();
      observation.modalOpenAt = null;
      observation.detailReadyAt = null;
    }, true);
    const classify = (url) => {
      if (url.pathname === "/goods/goods_view") return "goods-view";
      if (url.pathname === "/goods/add/flight_schedule") return "flight-schedule";
      if (url.pathname.includes("/product-availability/") && url.pathname.includes("/families/")) return "family-availability";
      if (url.pathname.includes("/product-detail/") && url.pathname.endsWith(".json")) return "public-detail";
      if (url.pathname.endsWith("/golfjoin_home_summary.json")) return "full-home-summary";
      if (url.pathname.endsWith("/golfjoin_local_data.json")) return "full-local-data";
      return "";
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const rawUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const url = new URL(rawUrl || "", location.href);
      const kind = classify(url);
      if (!kind) return originalFetch(...args);
      const entry = {
        kind,
        path: url.pathname,
        goodSeq: url.searchParams.get("goodSeq") || "",
        eventSeq: url.searchParams.get("eventSeq") || "",
        startedAt: performance.now(),
        endedAt: null,
        durationMs: null,
        status: "pending"
      };
      observation.requests.push(entry);
      try {
        const response = await originalFetch(...args);
        entry.endedAt = performance.now();
        entry.durationMs = entry.endedAt - entry.startedAt;
        entry.status = String(response.status);
        return response;
      } catch (error) {
        entry.endedAt = performance.now();
        entry.durationMs = entry.endedAt - entry.startedAt;
        entry.status = error?.name || "failed";
        throw error;
      }
    };
    const observeModal = () => {
      const observer = new MutationObserver(() => {
        if (observation.cardClickAt == null || observation.modalOpenAt != null) return;
        if (document.getElementById("detailModal")?.classList.contains("open")) {
          observation.modalOpenAt = performance.now();
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true
      });
    };
    if (document.documentElement) observeModal();
    else document.addEventListener("DOMContentLoaded", observeModal, { once: true });
  });
  page.on("pageerror", (error) => {
    void page.evaluate((message) => {
      window.__golfJoinStage11Observation?.pageErrors?.push(message);
    }, error.message).catch(() => {});
  });
}

async function openHome(page, project) {
  await installObservation(page);
  await page.goto(project.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#secret-golf-join", { state: "visible", timeout: 60_000 });
  await page.waitForFunction((revision) => {
    const diagnostics = getGolfJoinHomeDataV2Diagnostics?.();
    return diagnostics?.state === "V2_RUNNING"
      && Boolean(diagnostics?.committedReleaseRevision)
      && (!revision || diagnostics.committedReleaseRevision === revision)
      && diagnostics?.requestCount === 3;
  }, EXPECTED_RELEASE_REVISION, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll("#joinMdPickSection .join-mdpick-card").length > 0, null, {
    timeout: 60_000
  });
  await page.evaluate(() => {
    const observation = window.__golfJoinStage11Observation;
    const originalPeriodSelector = window.selectDetailProductFamilyPeriod;
    window.selectDetailProductFamilyPeriod = async function observedPeriodSelector(goodSeq) {
      const entry = { goodSeq: String(goodSeq || ""), startedAt: performance.now(), endedAt: null, durationMs: null };
      observation.periodRuns.push(entry);
      try {
        return await originalPeriodSelector.apply(this, arguments);
      } finally {
        entry.endedAt = performance.now();
        entry.durationMs = entry.endedAt - entry.startedAt;
      }
    };
  });
}

async function readFamilyCardFixture(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll("#joinMdPickSection .join-mdpick-card")];
    const source = getHomeProductSource().filter((product) => !product.homeReferenceOnly);
    for (let buttonIndex = 0; buttonIndex < buttons.length; buttonIndex += 1) {
      const match = /openMdPickProductDetail\('([^']+)'/.exec(buttons[buttonIndex].getAttribute("onclick") || "");
      const groupKey = match?.[1] || "";
      if (!groupKey.startsWith("family-")) continue;
      const products = source.filter((product) => getProductGroupKey(product) === groupKey);
      const family = products.map(getGolfJoinProductFamily).find(Boolean);
      if ((family?.members || []).length < 2) continue;
      return { buttonIndex, groupKey, familyId: family.familyId, productCount: products.length };
    }
    return null;
  });
}

async function runFamilyScenario(browser, project, runIndex) {
  const context = await browser.newContext({ viewport: project.viewport, userAgent: project.userAgent });
  const page = await context.newPage();
  try {
    await openHome(page, project);
    const fixture = await readFamilyCardFixture(page);
    if (!fixture) throw new Error(`${project.name}: family fixture not found`);
    const card = page.locator("#joinMdPickSection .join-mdpick-card").nth(fixture.buttonIndex);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForSelector("#detailModal.open", { timeout: 60_000 });
    await page.waitForFunction(() => document.querySelectorAll("#detailModal .detail-family-period-option").length >= 2, null, {
      timeout: 60_000
    });
    await page.waitForFunction(() => currentDetailJoinData?.secretTourDetailLoaded === true, null, {
      timeout: 60_000
    });
    await page.evaluate(() => {
      window.__golfJoinStage11Observation.detailReadyAt = performance.now();
    });

    const initialGoodSeq = await page.locator("#detailModal .detail-family-period-option.is-selected")
      .getAttribute("data-family-good-seq");
    const alternate = page.locator("#detailModal .detail-family-period-option:not(.is-selected)").first();
    await alternate.click();
    await page.waitForFunction(() => window.__golfJoinStage11Observation.periodRuns.length >= 1
      && window.__golfJoinStage11Observation.periodRuns[0].endedAt != null, null, { timeout: 60_000 });

    const original = page.locator(`#detailModal .detail-family-period-option[data-family-good-seq="${initialGoodSeq}"]`);
    await original.click();
    await page.waitForFunction(() => window.__golfJoinStage11Observation.periodRuns.length >= 2
      && window.__golfJoinStage11Observation.periodRuns[1].endedAt != null, null, { timeout: 60_000 });
    await page.waitForTimeout(750);

    const result = await page.evaluate(() => {
      const observation = window.__golfJoinStage11Observation;
      const afterClick = observation.requests.filter((entry) => (
        observation.cardClickAt != null && entry.startedAt >= observation.cardClickAt
      ));
      const measures = Object.fromEntries((window.getGolfJoinPerformanceSnapshot?.() || [])
        .filter((entry) => entry.entryType === "measure" && entry.name.startsWith("golfjoin:duration:detail"))
        .map((entry) => [entry.name, entry.duration]));
      return {
        cardToModalMs: observation.modalOpenAt != null ? observation.modalOpenAt - observation.cardClickAt : null,
        cardToDetailReadyMs: observation.detailReadyAt != null
          ? observation.detailReadyAt - observation.cardClickAt
          : null,
        periodRuns: observation.periodRuns.map((entry) => entry.durationMs),
        requestCounts: afterClick.reduce((counts, entry) => {
          counts[entry.kind] = (counts[entry.kind] || 0) + 1;
          return counts;
        }, {}),
        requestDurations: afterClick.reduce((groups, entry) => {
          (groups[entry.kind] ||= []).push(entry.durationMs);
          return groups;
        }, {}),
        goodsViewKeys: afterClick.filter((entry) => entry.kind === "goods-view")
          .map((entry) => `${entry.goodSeq}:${entry.eventSeq}`),
        fullLoaderStarted: afterClick.some((entry) => ["full-home-summary", "full-local-data"].includes(entry.kind)),
        measures,
        pageErrors: observation.pageErrors
      };
    });
    return { project: project.name, scenario: "family-period", run: runIndex, fixture, ...result };
  } finally {
    await context.close();
  }
}

async function readAirGroupFixture(page) {
  return page.evaluate(() => {
    const source = getHomeProductSource().filter((product) => !product.homeReferenceOnly);
    const groups = new Map();
    source.forEach((product) => {
      const key = getProductGroupKey(product);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    });
    for (const [groupKey, products] of groups) {
      const product = selectGolfJoinBookableProduct(products, { avoidActiveScheduleOverlap: false })
        || selectGolfJoinProductGroupRepresentative(products, { ignoreRepresentativeEvent: true });
      if (!product || getDetailProductType(product) === "골프팩") continue;
      return {
        groupKey,
        countryKey: String(product.country || product.countryName || "").toLowerCase(),
        goodSeq: getGolfJoinProductGoodSeq(product),
        eventSeq: getGolfJoinProductEventSeq(product),
        productType: getDetailProductType(product),
        title: product.title
      };
    }
    return null;
  });
}

async function runFlightScenario(browser, project, runIndex) {
  const context = await browser.newContext({ viewport: project.viewport, userAgent: project.userAgent });
  const page = await context.newPage();
  try {
    await openHome(page, project);
    const fixture = await readAirGroupFixture(page);
    if (!fixture) throw new Error(`${project.name}: air fixture not found`);
    await page.evaluate(({ groupKey, countryKey }) => {
      const observation = window.__golfJoinStage11Observation;
      observation.cardClickAt = performance.now();
      void openMdPickProductDetail(groupKey, countryKey || "", null);
    }, fixture);
    await page.waitForSelector("#detailModal.open", { timeout: 60_000 });
    try {
      await page.waitForFunction(() => {
        const observation = window.__golfJoinStage11Observation;
        const requests = observation.requests.filter((entry) => (
          entry.kind === "flight-schedule" && entry.startedAt >= observation.cardClickAt
        ));
        return requests.length > 0 && requests.every((entry) => entry.status !== "pending");
      }, null, { timeout: 8_000 });
    } catch (_error) {
      // A missing or timed-out flight request is part of the baseline result.
    }
    const closeStartedAt = Date.now();
    await page.evaluate(() => closeModal("detailModal"));
    await page.waitForFunction(() => !document.getElementById("detailModal")?.classList.contains("open"), null, {
      timeout: 5_000
    });
    const closeDurationMs = Date.now() - closeStartedAt;
    const result = await page.evaluate(() => {
      const observation = window.__golfJoinStage11Observation;
      const afterClick = observation.requests.filter((entry) => entry.startedAt >= observation.cardClickAt);
      const flight = afterClick.find((entry) => entry.kind === "flight-schedule") || null;
      const measures = Object.fromEntries((window.getGolfJoinPerformanceSnapshot?.() || [])
        .filter((entry) => entry.entryType === "measure" && entry.name.startsWith("golfjoin:duration:detail"))
        .map((entry) => [entry.name, entry.duration]));
      return {
        cardToModalMs: observation.modalOpenAt != null ? observation.modalOpenAt - observation.cardClickAt : null,
        goodsViewCount: afterClick.filter((entry) => entry.kind === "goods-view").length,
        flight: flight ? { status: flight.status, durationMs: flight.durationMs } : null,
        fullLoaderStarted: afterClick.some((entry) => ["full-home-summary", "full-local-data"].includes(entry.kind)),
        measures,
        pageErrors: observation.pageErrors
      };
    });
    return { project: project.name, scenario: "air-flight", run: runIndex, fixture, closeDurationMs, ...result };
  } finally {
    await context.close();
  }
}

function summarize(results) {
  const summary = {};
  for (const project of PROJECTS) {
    const family = results.filter((item) => item.project === project.name && item.scenario === "family-period");
    const flight = results.filter((item) => item.project === project.name && item.scenario === "air-flight");
    summary[project.name] = {
      family: {
        cardToModalP75Ms: percentile(family.map((item) => item.cardToModalMs), 0.75),
        cardToDetailReadyP75Ms: percentile(family.map((item) => item.cardToDetailReadyMs), 0.75),
        coldPeriodP75Ms: percentile(family.map((item) => item.periodRuns[0]), 0.75),
        warmPeriodP75Ms: percentile(family.map((item) => item.periodRuns[1]), 0.75),
        goodsViewCounts: family.map((item) => item.requestCounts["goods-view"] || 0),
        fullLoaderStartedEveryRun: family.length > 0 && family.every((item) => item.fullLoaderStarted)
      },
      flight: {
        cardToModalP75Ms: percentile(flight.map((item) => item.cardToModalMs), 0.75),
        responseP75Ms: percentile(flight.map((item) => item.flight?.durationMs), 0.75),
        closeP75Ms: percentile(flight.map((item) => item.closeDurationMs), 0.75),
        requestStatuses: flight.map((item) => item.flight?.status || "not-requested"),
        fullLoaderStartedEveryRun: flight.length > 0 && flight.every((item) => item.fullLoaderStarted)
      },
      pageErrors: [...family, ...flight].flatMap((item) => item.pageErrors || [])
    };
  }
  return summary;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  try {
    for (const project of PROJECTS) {
      for (let runIndex = 1; runIndex <= RUNS; runIndex += 1) {
        results.push(await runFamilyScenario(browser, project, runIndex));
      }
      for (let runIndex = 1; runIndex <= RUNS; runIndex += 1) {
        results.push(await runFlightScenario(browser, project, runIndex));
      }
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(`${JSON.stringify({ runs: RUNS, summary: summarize(results), results }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
