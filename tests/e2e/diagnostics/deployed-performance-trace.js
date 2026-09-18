"use strict";

const { chromium } = require("@playwright/test");
const { summarizeTrace } = require("../../../docs/home-optimization/measurement/analyze-trace");
const { readLocalMainHtml } = require("../support/local-main-html");

const DESKTOP_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || DESKTOP_URL.replace("https://www.", "https://m.");
const RUNS = Math.max(1, Number(process.env.GOLFJOIN_TRACE_RUNS || 1));
const SETTLE_MS = Math.max(2_000, Number(process.env.GOLFJOIN_TRACE_SETTLE_MS || 5_000));
const ONLY_MOBILE = process.argv.includes("--mobile");
const ONLY_DESKTOP = process.argv.includes("--desktop");
const USE_LOCAL_CANDIDATE = process.argv.includes("--candidate");
const LOCAL_MAIN_HTML = USE_LOCAL_CANDIDATE
  ? readLocalMainHtml()
  : "";

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function safeFunctionCall(call) {
  return {
    functionName: String(call.functionName || "").slice(0, 120),
    script: String(call.script || "").slice(0, 160),
    line: Number.isFinite(call.line) ? call.line : null,
    durationMs: round(call.durationMs),
    calls: Number(call.calls || 0)
  };
}

function safeTraceEvent(event) {
  return {
    name: String(event.name || "").slice(0, 120),
    detail: String(event.detail || "").slice(0, 160),
    startMs: round(event.startMs),
    durationMs: round(event.durationMs),
    overlapMs: round(event.overlapMs)
  };
}

function compactTask(task) {
  return {
    startMs: round(task.startMs),
    durationMs: round(task.durationMs),
    eventBreakdownMs: Object.fromEntries(
      Object.entries(task.eventBreakdownMs || {})
        .slice(0, 12)
        .map(([name, duration]) => [name, round(duration)])
    ),
    topFunctionCalls: (task.topFunctionCalls || []).slice(0, 8).map(safeFunctionCall),
    topEvents: (task.topEvents || []).slice(0, 12).map(safeTraceEvent)
  };
}

function replaceEmbeddedGolfJoinHtml(shellHtml) {
  const markerIndex = shellHtml.indexOf("normalizeEmbeddedBoardShellBeforeFirstPaint");
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("candidate_production_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

async function readTraceStream(client, handle) {
  const chunks = [];
  try {
    while (true) {
      const result = await client.send("IO.read", { handle });
      chunks.push(result.base64Encoded
        ? Buffer.from(result.data, "base64").toString("utf8")
        : result.data);
      if (result.eof) break;
    }
  } finally {
    await client.send("IO.close", { handle }).catch(() => {});
  }
  return chunks.join("");
}

async function runTrace(project, run) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: project.viewport,
    userAgent: project.userAgent
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
  });
  if (USE_LOCAL_CANDIDATE) {
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

  const tracingComplete = new Promise((resolve) => {
    client.once("Tracing.tracingComplete", resolve);
  });
  await client.send("Tracing.start", {
    transferMode: "ReturnAsStream",
    categories: [
      "-*",
      "blink.user_timing",
      "devtools.timeline",
      "disabled-by-default-devtools.timeline",
      "loading",
      "rail",
      "toplevel",
      "v8.execute"
    ].join(",")
  });

  let traceText;
  let pageState;
  try {
    await page.goto(project.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("#secret-golf-join", { timeout: 60_000 });
    await page.waitForSelector("#joinMdPickSection .join-mdpick-card", { timeout: 60_000 });
    await page.waitForTimeout(SETTLE_MS);
    pageState = await page.evaluate(() => ({
      canScroll: document.documentElement.scrollHeight > innerHeight,
      failedImages: Array.from(document.images)
        .filter((image) => image.complete && image.naturalWidth === 0).length
    }));
    await client.send("Tracing.end");
    const completed = await tracingComplete;
    traceText = await readTraceStream(client, completed.stream);
  } finally {
    await context.close();
    await browser.close();
  }

  const analysis = summarizeTrace(JSON.parse(traceText));
  return {
    project: project.name,
    run,
    eventCount: analysis.events,
    lcpMs: round(analysis.webVitalsTrace?.lcpMs),
    cls: round(analysis.webVitalsTrace?.cls, 6),
    longTaskCount: analysis.longTasks.count,
    longTaskTotalMs: round(analysis.longTasks.totalDurationMs),
    maxLongTaskMs: round(analysis.longTasks.maxDurationMs),
    longTasks: analysis.longTasks.tasks.map(compactTask),
    pageState,
    pageErrorCount: pageErrors.length
  };
}

async function main() {
  if (ONLY_MOBILE && ONLY_DESKTOP) {
    throw new Error("Use only one project filter: --mobile or --desktop");
  }
  let projects = [
    {
      name: "desktop-chrome",
      url: DESKTOP_URL,
      viewport: { width: 1440, height: 1000 }
    },
    {
      name: "mobile-chrome",
      url: MOBILE_URL,
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"
    }
  ];
  if (ONLY_MOBILE) projects = projects.filter((project) => project.name === "mobile-chrome");
  if (ONLY_DESKTOP) projects = projects.filter((project) => project.name === "desktop-chrome");

  const results = [];
  for (const project of projects) {
    for (let run = 1; run <= RUNS; run += 1) {
      results.push(await runTrace(project, run));
    }
  }
  process.stdout.write(`${JSON.stringify({
    source: USE_LOCAL_CANDIDATE ? "local-candidate-production-shell-trace" : "deployed-public-devtools-trace",
    runs: RUNS,
    settleMs: SETTLE_MS,
    browserPerRun: true,
    results
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
