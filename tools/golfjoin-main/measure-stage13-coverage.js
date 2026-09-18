"use strict";

const { chromium } = require("@playwright/test");
const zlib = require("node:zlib");

const DEFAULT_URL = "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const ASSET_PATTERN = /\/web\/home-assets\/[^/]+\/golfjoin-main\.(css|js)(?:\?|$)/;

function parseArgs(argv = []) {
  return argv.reduce((options, argument) => {
    if (argument.startsWith("--url=")) options.url = argument.slice("--url=".length);
    else if (argument.startsWith("--wait=")) options.waitMs = Number(argument.slice("--wait=".length));
    else if (argument.startsWith("--channel=")) options.channel = argument.slice("--channel=".length);
    else if (argument === "--mobile") options.mobile = true;
    else if (argument === "--include-ranges") options.includeRanges = true;
    else throw new Error(`unknown_argument:${argument}`);
    return options;
  }, {});
}

function mergeRanges(ranges = []) {
  const ordered = ranges
    .map(({ start, end }) => ({ start: Number(start) || 0, end: Number(end) || 0 }))
    .filter(({ start, end }) => end > start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  ordered.forEach((range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) merged.push({ ...range });
    else previous.end = Math.max(previous.end, range.end);
  });
  return merged;
}

function summarizeEntry(entry, options = {}) {
  const sourceText = String(entry.text || entry.source || "");
  const source = Buffer.from(sourceText, "utf8");
  const ranges = mergeRanges(entry.ranges);
  const covered = Buffer.from(ranges.map(({ start, end }) => sourceText.slice(start, end)).join(""), "utf8");
  const summary = {
    url: entry.url,
    rawBytes: source.length,
    coveredBytes: covered.length,
    coveredPercent: source.length ? Number((covered.length / source.length * 100).toFixed(1)) : 0,
    rawGzipBytes: zlib.gzipSync(source, { level: 9 }).length,
    coveredGzipApproxBytes: zlib.gzipSync(covered, { level: 9 }).length,
    rangeCount: ranges.length
  };
  if (options.includeRanges) summary.ranges = ranges;
  return summary;
}

function executedRanges(functions = []) {
  const points = [];
  functions.flatMap((fn) => fn.ranges || []).forEach((range) => {
    points.push({ offset: range.startOffset, type: 0, range });
    points.push({ offset: range.endOffset, type: 1, range });
  });
  points.sort((left, right) => {
    if (left.offset !== right.offset) return left.offset - right.offset;
    if (left.type !== right.type) return right.type - left.type;
    const leftLength = left.range.endOffset - left.range.startOffset;
    const rightLength = right.range.endOffset - right.range.startOffset;
    return left.type === 0 ? rightLength - leftLength : leftLength - rightLength;
  });
  const hitCountStack = [];
  const results = [];
  let lastOffset = 0;
  points.forEach((point) => {
    if (hitCountStack.length && lastOffset < point.offset && hitCountStack[hitCountStack.length - 1] > 0) {
      const previous = results[results.length - 1];
      if (previous && previous.end === lastOffset) previous.end = point.offset;
      else results.push({ start: lastOffset, end: point.offset });
    }
    lastOffset = point.offset;
    if (point.type === 0) hitCountStack.push(point.range.count);
    else hitCountStack.pop();
  });
  return results.filter((range) => range.end - range.start > 1);
}

async function measure(options = {}) {
  const mobile = Boolean(options.mobile);
  const browser = await chromium.launch({ headless: true, channel: options.channel || "chrome" });
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
  const cdp = await context.newCDPSession(page);
  const scriptIdsByUrl = new Map();
  const consoleErrors = [];
  const assetResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error.message || error).slice(0, 300)));
  page.on("response", (response) => {
    if (!ASSET_PATTERN.test(response.url())) return;
    const headers = response.headers();
    assetResponses.push({
      url: response.url(),
      status: response.status(),
      contentType: headers["content-type"] || "",
      contentEncoding: headers["content-encoding"] || "identity",
      contentLength: Number(headers["content-length"] || 0),
      cacheControl: headers["cache-control"] || ""
    });
  });

  cdp.on("Debugger.scriptParsed", (event) => {
    if (event.url) scriptIdsByUrl.set(event.url, event.scriptId);
  });
  await Promise.all([
    page.coverage.startCSSCoverage({ resetOnNavigation: false }),
    cdp.send("Debugger.enable"),
    cdp.send("Profiler.enable")
  ]);
  await cdp.send("Profiler.startPreciseCoverage", { callCount: false, detailed: true });
  const startedAt = Date.now();
  await page.goto(options.url || DEFAULT_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(Number.isFinite(options.waitMs) ? options.waitMs : 8_000);
  const [cssCoverage, preciseCoverage] = await Promise.all([
    page.coverage.stopCSSCoverage(),
    cdp.send("Profiler.takePreciseCoverage")
  ]);
  const jsCoverage = [];
  for (const entry of preciseCoverage.result.filter((candidate) => ASSET_PATTERN.test(candidate.url))) {
    const scriptId = scriptIdsByUrl.get(entry.url) || entry.scriptId;
    const scriptSource = await cdp.send("Debugger.getScriptSource", { scriptId });
    jsCoverage.push({
      url: entry.url,
      source: scriptSource.scriptSource || "",
      ranges: executedRanges(entry.functions)
    });
  }
  await Promise.all([
    cdp.send("Profiler.stopPreciseCoverage"),
    cdp.send("Profiler.disable"),
    cdp.send("Debugger.disable")
  ]);
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => ({
    url: entry.name,
    transferSize: entry.transferSize,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize,
    duration: Number(entry.duration.toFixed(1))
  })));
  const result = {
    schema: "golfjoin-stage13-coverage-v1",
    measuredAt: new Date().toISOString(),
    url: options.url || DEFAULT_URL,
    viewport: mobile ? "mobile" : "pc",
    elapsedMs: Date.now() - startedAt,
    css: cssCoverage.filter((entry) => ASSET_PATTERN.test(entry.url)).map((entry) => summarizeEntry(entry, options)),
    js: jsCoverage.filter((entry) => ASSET_PATTERN.test(entry.url)).map((entry) => summarizeEntry(entry, options)),
    resources: resources.filter((entry) => ASSET_PATTERN.test(entry.url)),
    assetResponses,
    consoleErrorCount: consoleErrors.length,
    consoleErrorSamples: consoleErrors.slice(0, 5)
  };
  await browser.close();
  return result;
}

async function main() {
  const result = await measure(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  ASSET_PATTERN,
  executedRanges,
  mergeRanges,
  summarizeEntry,
  measure
};
