"use strict";

const { chromium } = require("@playwright/test");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const RUNS = Math.max(1, Number(process.env.GOLFJOIN_VITALS_RUNS || 3));
const SETTLE_MS = Math.max(5_000, Number(process.env.GOLFJOIN_VITALS_SETTLE_MS || 15_000));
const ONLY_MOBILE = process.argv.includes("--mobile");
const ONLY_DESKTOP = process.argv.includes("--desktop");
const EARLY_BOARD_NORMALIZATION = process.argv.includes("--early-board-normalization");

function median(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

function relativeRange(values) {
  const valid = values.filter(Number.isFinite);
  const middle = median(valid);
  if (!valid.length || !middle) return null;
  return ((Math.max(...valid) - Math.min(...valid)) / middle) * 100;
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function buildClsSessionWindows(shifts) {
  const windows = [];
  shifts
    .filter((entry) => !entry.hadRecentInput && Number(entry.value) > 0)
    .sort((a, b) => a.startTime - b.startTime)
    .forEach((entry) => {
      const previous = windows[windows.length - 1];
      const gapMs = previous ? entry.startTime - previous.endTime : Infinity;
      const windowMs = previous ? entry.startTime - previous.startTime : Infinity;
      if (!previous || gapMs > 1_000 || windowMs > 5_000) {
        windows.push({
          startTime: entry.startTime,
          endTime: entry.startTime,
          score: entry.value,
          shifts: 1
        });
        return;
      }
      previous.endTime = entry.startTime;
      previous.score += entry.value;
      previous.shifts += 1;
    });
  return windows;
}

async function measureRun(browser, project, run) {
  const context = await browser.newContext({
    viewport: project.viewport,
    userAgent: project.userAgent
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    window.__golfJoinThreeRunVitals = {
      lcp: [],
      shifts: [],
      longTasks: []
    };
    const observe = (type, target, mapEntry) => {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => target.push(mapEntry(entry)));
        });
        observer.observe({ type, buffered: true });
      } catch (_error) {
        // Unsupported entry types stay empty and are reported below.
      }
    };
    observe("largest-contentful-paint", window.__golfJoinThreeRunVitals.lcp, (entry) => ({
      startTime: entry.startTime,
      size: entry.size || 0,
      tagName: entry.element?.tagName || ""
    }));
    observe("layout-shift", window.__golfJoinThreeRunVitals.shifts, (entry) => ({
      startTime: entry.startTime,
      value: entry.value || 0,
      hadRecentInput: Boolean(entry.hadRecentInput),
      sources: Array.from(entry.sources || []).map((source) => {
        const node = source.node;
        const className = typeof node?.className === "string"
          ? node.className.replace(/\s+/g, " ").trim().slice(0, 160)
          : "";
        const copyRect = (rect) => rect ? {
          x: Math.round(rect.x || 0),
          y: Math.round(rect.y || 0),
          width: Math.round(rect.width || 0),
          height: Math.round(rect.height || 0)
        } : null;
        return {
          tagName: node?.tagName || "",
          id: String(node?.id || "").slice(0, 80),
          className,
          previousRect: copyRect(source.previousRect),
          currentRect: copyRect(source.currentRect)
        };
      })
    }));
    observe("longtask", window.__golfJoinThreeRunVitals.longTasks, (entry) => ({
      startTime: entry.startTime,
      duration: entry.duration || 0
    }));
  });
  if (EARLY_BOARD_NORMALIZATION) {
    await page.addInitScript(() => {
      const normalize = () => {
        const host = document.querySelector(".read_contens");
        if (!host) return false;
        host.classList.add("sgj-board-host");
        host.closest(".boardread_type1")?.classList.add("sgj-board-root");
        host.closest(".middle_wrap")?.classList.add("sgj-board-page");
        return true;
      };
      const observer = new MutationObserver(() => {
        if (normalize()) observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
      normalize();
    });
  }

  const startedAt = Date.now();
  await page.goto(project.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#secret-golf-join", { timeout: 60_000 });
  await page.waitForSelector("#joinMdPickSection .join-mdpick-card", { timeout: 60_000 });
  await page.waitForTimeout(SETTLE_MS);
  const raw = await page.evaluate(() => {
    const values = window.__golfJoinThreeRunVitals || { lcp: [], shifts: [], longTasks: [] };
    const measures = typeof window.getGolfJoinPerformanceSnapshot === "function"
      ? window.getGolfJoinPerformanceSnapshot()
        .filter((entry) => entry.entryType === "measure")
        .map((entry) => ({ name: entry.name, duration: entry.duration }))
      : [];
    return {
      ...values,
      measures,
      canScroll: document.documentElement.scrollHeight > innerHeight,
      failedImages: Array.from(document.images)
        .filter((image) => image.complete && image.naturalWidth === 0).length
    };
  });
  await context.close();

  const clsWindows = buildClsSessionWindows(raw.shifts || []);
  const longTasks = raw.longTasks || [];
  const localRender = (raw.measures || [])
    .find((entry) => entry.name === "golfjoin:duration:home-local-render");
  return {
    project: project.name,
    run,
    wallMs: Date.now() - startedAt,
    lcpMs: round(raw.lcp?.at(-1)?.startTime),
    cls: round(clsWindows.length ? Math.max(...clsWindows.map((item) => item.score)) : 0, 6),
    clsShiftCount: (raw.shifts || []).filter((entry) => !entry.hadRecentInput).length,
    clsShifts: (raw.shifts || [])
      .filter((entry) => !entry.hadRecentInput && Number(entry.value) > 0)
      .map((entry) => ({
        startTime: round(entry.startTime),
        value: round(entry.value, 6),
        sources: entry.sources || []
      })),
    longTaskCount: longTasks.length,
    longTaskTotalMs: round(longTasks.reduce((sum, entry) => sum + entry.duration, 0)),
    maxLongTaskMs: round(longTasks.length ? Math.max(...longTasks.map((entry) => entry.duration)) : 0),
    localRenderMs: round(localRender?.duration),
    canScroll: raw.canScroll,
    failedImages: raw.failedImages,
    pageErrorCount: pageErrors.length
  };
}

function summarize(results, project) {
  const selected = results.filter((result) => result.project === project);
  const fields = ["lcpMs", "cls", "longTaskTotalMs", "maxLongTaskMs", "localRenderMs"];
  return Object.fromEntries(fields.map((field) => {
    const values = selected.map((result) => result[field]).filter(Number.isFinite);
    return [field, {
      values,
      median: round(median(values), field === "cls" ? 6 : 3),
      relativeRangePct: round(relativeRange(values), 1)
    }];
  }));
}

async function main() {
  let projects = [
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
  ];
  if (ONLY_MOBILE && ONLY_DESKTOP) {
    throw new Error("Use only one project filter: --mobile or --desktop");
  }
  if (ONLY_MOBILE) projects = projects.filter((project) => project.name === "mobile-chrome");
  if (ONLY_DESKTOP) projects = projects.filter((project) => project.name === "desktop-chrome");
  const results = [];
  for (const project of projects) {
    for (let run = 1; run <= RUNS; run += 1) {
      const browser = await chromium.launch({ channel: "chrome", headless: true });
      try {
        results.push(await measureRun(browser, project, run));
      } finally {
        await browser.close();
      }
    }
  }
  process.stdout.write(`${JSON.stringify({
    source: "deployed-public",
    url: HOME_URL,
    runs: RUNS,
    settleMs: SETTLE_MS,
    browserPerRun: true,
    earlyBoardNormalization: EARLY_BOARD_NORMALIZATION,
    results,
    summary: Object.fromEntries(projects.map((project) => [
      project.name,
      summarize(results, project.name)
    ]))
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
