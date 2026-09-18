"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("@playwright/test");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_CANDIDATE_ROOT = path.resolve(
  process.env.GOLFJOIN_CRITICAL_CANDIDATE_ROOT
    || path.join(WORKSPACE_ROOT, "dist/golfjoin-main/critical-css/ghc_c303d9e05653fdaf53381195")
);
const DEFAULT_RUNS = 5;
const NETWORK = Object.freeze({ latencyMs: 150, bytesPerSecond: 200 * 1024 });
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+NQZJAAAAAElFTkSuQmCC",
  "base64"
);

function median(values) {
  const ordered = values.slice().sort((left, right) => left - right);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function transferDelay(encodedBytes, network = NETWORK) {
  return Math.round(network.latencyMs + encodedBytes / network.bytesPerSecond * 1000);
}

async function delayedFulfill(route, delayMs, response) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  await route.fulfill(response);
}

function readCandidate(root = DEFAULT_CANDIDATE_ROOT) {
  const publication = JSON.parse(fs.readFileSync(path.join(root, "publication.json"), "utf8"));
  const candidateHtml = fs.readFileSync(path.join(root, "golfjoin_main_critical_candidate.html"));
  const rollbackHtml = fs.readFileSync(path.join(root, "golfjoin_main_gzip_rollback.html"));
  const css = fs.readFileSync(path.join(WORKSPACE_ROOT, "src/golfjoin-main/source/styles/10-main.css"));
  const js = fs.readFileSync(path.join(
    WORKSPACE_ROOT,
    `dist/golfjoin-main/external-assets/${publication.fullAssetRevision}/golfjoin-main.js`
  ));
  const assetPublication = JSON.parse(fs.readFileSync(path.join(
    WORKSPACE_ROOT,
    `dist/golfjoin-main/external-assets/${publication.fullAssetRevision}/publication.json`
  ), "utf8"));
  return { publication, assetPublication, candidateHtml, rollbackHtml, css, js };
}

async function runSample(browser, assets, options) {
  const mobile = Boolean(options.mobile);
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    userAgent: mobile
      ? "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36"
      : undefined
  });
  const page = await context.newPage();
  const host = mobile ? "https://m.secret-tour.com" : "https://www.secret-tour.com";
  const url = `${host}/event/plan_view?eventPlanSeq=3&page=1&codex_stage13=critical_perf_${options.variant}_${Date.now()}_${options.iteration}`;
  const cssUrl = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${assets.publication.fullAssetRevision}/golfjoin-main.css`;
  const jsUrl = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${assets.publication.fullAssetRevision}/golfjoin-main.js`;
  const html = options.variant === "critical" ? assets.candidateHtml : assets.rollbackHtml;
  const htmlEncodedBytes = zlib.gzipSync(html, { level: 9, mtime: 0 }).length;
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route(url, (route) => delayedFulfill(route, transferDelay(htmlEncodedBytes), {
    status: 200,
    contentType: "text/html; charset=utf-8",
    headers: { "cache-control": "no-store" },
    body: html
  }));
  await page.route(cssUrl, (route) => delayedFulfill(route, transferDelay(assets.assetPublication.assets.css.encodedBytes), {
    status: 200,
    contentType: "text/css; charset=utf-8",
    headers: { "access-control-allow-origin": "*" },
    body: assets.css
  }));
  await page.route(jsUrl, (route) => delayedFulfill(route, transferDelay(assets.assetPublication.assets.js.encodedBytes), {
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    headers: { "access-control-allow-origin": "*" },
    body: assets.js
  }));
  await page.route("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css", (route) => route.fulfill({
    status: 200,
    contentType: "text/css; charset=utf-8",
    body: ""
  }));
  await page.route(/\.(?:png|jpe?g|webp|gif)(?:\?|$)/i, (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: TRANSPARENT_PNG
  }));

  const startedAt = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(500);
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]));
    return {
      firstPaintMs: Number((paints["first-paint"] || 0).toFixed(1)),
      firstContentfulPaintMs: Number((paints["first-contentful-paint"] || 0).toFixed(1)),
      domContentLoadedMs: Number((navigation?.domContentLoadedEventEnd || 0).toFixed(1)),
      loadEventMs: Number((navigation?.loadEventEnd || 0).toFixed(1)),
      fullCssLoaded: document.documentElement.getAttribute("data-golfjoin-full-css") === "loaded",
      criticalStyleCount: document.querySelectorAll("style[data-golfjoin-critical-css]").length,
      externalFailure: document.documentElement.getAttribute("data-golfjoin-external-asset-failure") || ""
    };
  });
  const elapsedMs = Date.now() - startedAt;
  await context.close();
  return { ...metrics, elapsedMs, pageErrorCount: pageErrors.length };
}

function summarize(samples) {
  return {
    runs: samples.length,
    firstPaintMedianMs: median(samples.map((sample) => sample.firstPaintMs)),
    firstContentfulPaintMedianMs: median(samples.map((sample) => sample.firstContentfulPaintMs)),
    domContentLoadedMedianMs: median(samples.map((sample) => sample.domContentLoadedMs)),
    elapsedMedianMs: median(samples.map((sample) => sample.elapsedMs)),
    pageErrorCount: samples.reduce((sum, sample) => sum + sample.pageErrorCount, 0),
    samples
  };
}

async function measureCriticalPerformance(options = {}) {
  const assets = readCandidate(options.candidateRoot || DEFAULT_CANDIDATE_ROOT);
  const runs = Number(options.runs || DEFAULT_RUNS);
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const result = { schema: "golfjoin-stage13-critical-css-performance-v1", network: NETWORK, viewports: {} };
  try {
    for (const mobile of [false, true]) {
      const viewport = mobile ? "mobile" : "pc";
      const variants = { current: [], critical: [] };
      for (let iteration = 1; iteration <= runs; iteration += 1) {
        for (const variant of ["current", "critical"]) {
          variants[variant].push(await runSample(browser, assets, { mobile, variant, iteration }));
        }
      }
      const current = summarize(variants.current);
      const critical = summarize(variants.critical);
      const improvementMs = current.firstContentfulPaintMedianMs - critical.firstContentfulPaintMedianMs;
      result.viewports[viewport] = {
        current,
        critical,
        firstContentfulPaintImprovementMs: Number(improvementMs.toFixed(1)),
        firstContentfulPaintImprovementPercent: current.firstContentfulPaintMedianMs
          ? Number((improvementMs / current.firstContentfulPaintMedianMs * 100).toFixed(1))
          : 0
      };
    }
  } finally {
    await browser.close();
  }
  return result;
}

async function main() {
  const result = await measureCriticalPerformance();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { measureCriticalPerformance, median, transferDelay };
