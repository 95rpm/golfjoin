"use strict";

const { chromium } = require("@playwright/test");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const EXPECTED_RELEASE_REVISION = String(
  process.env.GOLFJOIN_V2_RELEASE_REVISION || ""
).trim();
const SETTLE_MS = Math.max(1_000, Number(process.env.GOLFJOIN_V2_MEASURE_SETTLE_MS || 3_000));
const RUNS = Math.max(1, Number(process.env.GOLFJOIN_V2_MEASURE_RUNS || 3));

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function percentile(values, ratio) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function summarize(results, projectName, phase) {
  const selected = results
    .filter((result) => result.project === projectName)
    .map((result) => result[phase]);
  const metric = (name, digits = 3) => {
    const values = selected.map((item) => item[name]).filter(Number.isFinite);
    return {
      values,
      median: round(percentile(values, 0.5), digits),
      p75: round(percentile(values, 0.75), digits)
    };
  };
  return {
    lcpMs: metric("lcpMs"),
    cls: metric("cls", 6),
    longTaskTotalMs: metric("longTaskTotalMs"),
    wallMs: metric("wallMs"),
    releaseRequestCounts: selected.map((item) => item.releaseRequestCount),
    staticNetworkDownloadCounts: selected.map((item) => item.staticNetworkDownloadCount),
    legacyCoreRequestCounts: selected.map((item) => item.legacyCoreRequestCount),
    pageErrorCounts: selected.map((item) => item.pageErrors.length),
    failedVisibleImageCounts: selected.map((item) => item.failedVisibleImages),
    canScroll: selected.map((item) => item.canScroll)
  };
}

function releaseRole(url) {
  if (url.includes("/web/release-manifest-v2.json")) return "manifest";
  if (url.includes("/objects/homeCards-")) return "home-static";
  if (url.includes("/objects/liveHome-")) return "home-live";
  if (url.includes("/web/releases/")) return "other-release";
  return "";
}

function isLegacyCoreUrl(url) {
  return url.includes("/web/golfjoin_home_cards.json")
    || url.includes("/web/product-family/manifest.json")
    || url.includes("action=home_bootstrap_light");
}

async function waitForV2Ready(page) {
  await page.waitForSelector("#secret-golf-join", { timeout: 60_000 });
  await page.waitForFunction((revision) => {
    const diagnostics = window.getGolfJoinHomeDataV2Diagnostics?.();
    return diagnostics?.state === "V2_RUNNING"
      && (!revision || diagnostics?.committedReleaseRevision === revision)
      && diagnostics?.requestCount === 3
      && diagnostics?.startupDecisionPending === false;
  }, EXPECTED_RELEASE_REVISION, { timeout: 60_000 });
  await page.waitForSelector("#joinMdPickSection .join-mdpick-card", { timeout: 60_000 });
  await page.waitForFunction(() => {
    const image = document.querySelector("#joinMdPickSection .join-mdpick-card img");
    return Boolean(image?.complete && image?.naturalWidth > 0);
  }, null, { timeout: 60_000 });
  await page.waitForFunction(() => (
    typeof homeRenderScheduled === "undefined"
    || (!homeRenderScheduled && !homeMdPickRenderScheduled)
  ), null, { timeout: 30_000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function readPageMetrics(page) {
  return page.evaluate(() => {
    const diagnostics = getGolfJoinHomeDataV2Diagnostics();
    const vitals = window.__golfJoinV2RolloutMetrics || { lcp: [], shifts: [], longTasks: [] };
    const shifts = (vitals.shifts || []).filter((entry) => !entry.hadRecentInput);
    const snapshot = typeof getGolfJoinPerformanceSnapshot === "function"
      ? getGolfJoinPerformanceSnapshot()
      : [];
    return {
      diagnostics,
      lcpMs: vitals.lcp.at(-1)?.startTime ?? null,
      cls: shifts.reduce((sum, entry) => sum + Number(entry.value || 0), 0),
      longTaskCount: (vitals.longTasks || []).length,
      longTaskTotalMs: (vitals.longTasks || []).reduce((sum, entry) => sum + Number(entry.duration || 0), 0),
      localRenderMarkCount: performance.getEntriesByName("golfjoin:home:local-render-ready").length,
      v2CommitMarkCount: performance.getEntriesByName("golfjoin:v2:committed").length,
      mdPickPrimaryRenderMarkCount: performance.getEntriesByName("golfjoin:mdpick:primary-render-ready").length,
      performanceSnapshotCount: snapshot.length,
      canScroll: document.documentElement.scrollHeight > innerHeight,
      failedVisibleImages: Array.from(document.querySelectorAll("#joinMdPickSection img"))
        .filter((image) => image.complete && image.naturalWidth === 0).length
    };
  });
}

async function measureProject(browser, project, run) {
  const context = await browser.newContext({
    viewport: project.viewport,
    userAgent: project.userAgent
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const pageErrors = { cold: [], warm: [] };
  const legacyRequests = { cold: [], warm: [] };
  const network = { cold: [], warm: [] };
  const requestPhase = new Map();
  const requestRows = new Map();
  let phase = "cold";

  page.on("pageerror", (error) => pageErrors[phase].push(String(error?.message || error)));
  page.on("request", (request) => {
    const url = request.url();
    if (isLegacyCoreUrl(url)) legacyRequests[phase].push(url);
  });
  client.on("Network.requestWillBeSent", (event) => {
    const role = releaseRole(event.request.url);
    if (!role) return;
    requestPhase.set(event.requestId, phase);
    requestRows.set(event.requestId, {
      role,
      url: event.request.url,
      fromCache: false,
      fromDiskCache: false,
      fromPrefetchCache: false,
      status: null,
      encodedDataLength: 0
    });
  });
  client.on("Network.requestServedFromCache", (event) => {
    const row = requestRows.get(event.requestId);
    if (row) row.fromCache = true;
  });
  client.on("Network.responseReceived", (event) => {
    const row = requestRows.get(event.requestId);
    if (!row) return;
    row.status = event.response.status;
    row.fromDiskCache = Boolean(event.response.fromDiskCache);
    row.fromPrefetchCache = Boolean(event.response.fromPrefetchCache);
  });
  client.on("Network.loadingFinished", (event) => {
    const row = requestRows.get(event.requestId);
    const rowPhase = requestPhase.get(event.requestId);
    if (!row || !rowPhase) return;
    row.encodedDataLength = Number(event.encodedDataLength || 0);
    network[rowPhase].push(row);
    requestRows.delete(event.requestId);
    requestPhase.delete(event.requestId);
  });
  await client.send("Network.enable");
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", "0");
    sessionStorage.removeItem("golfjoin_home_data_v2_failed_v1");
    window.__golfJoinV2RolloutMetrics = { lcp: [], shifts: [], longTasks: [] };
    const observe = (type, target, mapEntry) => {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => target.push(mapEntry(entry)));
        });
        observer.observe({ type, buffered: true });
      } catch (_error) {
        // Unsupported performance entry types remain empty.
      }
    };
    observe("largest-contentful-paint", window.__golfJoinV2RolloutMetrics.lcp, (entry) => ({
      startTime: entry.startTime,
      size: entry.size || 0,
      tagName: entry.element?.tagName || ""
    }));
    observe("layout-shift", window.__golfJoinV2RolloutMetrics.shifts, (entry) => ({
      startTime: entry.startTime,
      value: entry.value || 0,
      hadRecentInput: Boolean(entry.hadRecentInput)
    }));
    observe("longtask", window.__golfJoinV2RolloutMetrics.longTasks, (entry) => ({
      startTime: entry.startTime,
      duration: entry.duration || 0
    }));
  });

  const runPhase = async (name, navigate) => {
    phase = name;
    const startedAt = Date.now();
    await navigate();
    await waitForV2Ready(page);
    const metrics = await readPageMetrics(page);
    return {
      phase: name,
      wallMs: Date.now() - startedAt,
      ...metrics,
      lcpMs: round(metrics.lcpMs),
      cls: round(metrics.cls, 6),
      longTaskTotalMs: round(metrics.longTaskTotalMs),
      releaseRequests: network[name].map((row) => ({
        role: row.role,
        status: row.status,
        fromCache: row.fromCache || row.fromDiskCache || row.fromPrefetchCache,
        encodedDataLength: row.encodedDataLength
      })),
      releaseRequestCount: network[name].length,
      releaseNetworkTransferBytes: network[name].reduce((sum, row) => sum + row.encodedDataLength, 0),
      staticNetworkDownloadCount: network[name].filter((row) => (
        row.role === "home-static"
        && !(row.fromCache || row.fromDiskCache || row.fromPrefetchCache)
        && row.encodedDataLength > 0
      )).length,
      legacyCoreRequestCount: legacyRequests[name].length,
      pageErrors: pageErrors[name]
    };
  };

  const cold = await runPhase("cold", () => page.goto(project.url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  }));
  const warm = await runPhase("warm", () => page.reload({
    waitUntil: "domcontentloaded",
    timeout: 60_000
  }));
  await context.close();
  return { project: project.name, run, cold, warm };
}

async function main() {
  const projects = [
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
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const results = [];
    for (const project of projects) {
      for (let run = 1; run <= RUNS; run += 1) {
        results.push(await measureProject(browser, project, run));
      }
    }
    const releaseRevisions = Array.from(new Set(
      results.flatMap((result) => [
        result.cold?.diagnostics?.committedReleaseRevision,
        result.warm?.diagnostics?.committedReleaseRevision
      ]).filter(Boolean)
    ));
    if (releaseRevisions.length !== 1) {
      throw new Error(`mixed_release_revisions:${releaseRevisions.join(",")}`);
    }
    const activeReleaseRevision = releaseRevisions[0];
    if (EXPECTED_RELEASE_REVISION && activeReleaseRevision !== EXPECTED_RELEASE_REVISION) {
      throw new Error(
        `unexpected_release_revision:${activeReleaseRevision}:${EXPECTED_RELEASE_REVISION}`
      );
    }
    process.stdout.write(`${JSON.stringify({
      schema: "golfjoin-release-v2-rollout-measurement-v1",
      measuredAt: new Date().toISOString(),
      releaseRevision: activeReleaseRevision,
      settleMs: SETTLE_MS,
      runs: RUNS,
      results,
      summary: Object.fromEntries(projects.map((project) => [
        project.name,
        {
          cold: summarize(results, project.name, "cold"),
          warm: summarize(results, project.name, "warm")
        }
      ]))
    }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
