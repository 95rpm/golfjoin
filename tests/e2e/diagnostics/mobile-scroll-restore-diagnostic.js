"use strict";

const { chromium, devices } = require("@playwright/test");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const ITERATIONS = Math.max(1, Number(process.env.GOLFJOIN_DIAGNOSTIC_ITERATIONS) || 3);
const CHROME_EXECUTABLE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function waitForStableHomeLayout(page) {
  let previousSignature = "";
  let stableSamples = 0;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const metrics = await page.evaluate(() => {
      const root = document.getElementById("secret-golf-join");
      return {
        rootHeight: root?.scrollHeight || 0,
        pageHeight: document.scrollingElement?.scrollHeight || 0,
        sectionCount: root?.querySelectorAll(".join-product-section").length || 0,
        mdPickCount: root?.querySelectorAll("#joinMdPickSection .join-mdpick-card").length || 0,
        loadingCount: root?.querySelectorAll(".join-product-section.layout-loading").length || 0
      };
    });
    const signature = JSON.stringify(metrics);
    stableSamples = metrics.loadingCount === 0 && signature === previousSignature ? stableSamples + 1 : 0;
    if (stableSamples >= 4) return;
    previousSignature = signature;
    await page.waitForTimeout(400);
  }
  throw new Error("home_layout_not_stable");
}

async function captureMetrics(page, label) {
  return page.evaluate((sampleLabel) => {
    const root = document.getElementById("secret-golf-join");
    const card = document.querySelector("#joinMdPickSection .join-mdpick-card");
    const scrollingElement = document.scrollingElement || document.documentElement;
    const viewport = window.visualViewport;
    const rect = card?.getBoundingClientRect();
    return {
      label: sampleLabel,
      elapsedMs: Math.round(performance.now() - (window.__golfjoinScrollDiagnostic?.startedAt || performance.now())),
      windowScrollY: window.scrollY,
      documentScrollTop: scrollingElement?.scrollTop || 0,
      viewportPageTop: viewport?.pageTop ?? null,
      viewportOffsetTop: viewport?.offsetTop ?? null,
      viewportHeight: viewport?.height ?? null,
      innerHeight: window.innerHeight,
      pageHeight: scrollingElement?.scrollHeight || 0,
      rootHeight: root?.scrollHeight || 0,
      cardTop: rect?.top ?? null,
      bodyPosition: document.body?.style.position || "",
      bodyTop: document.body?.style.top || "",
      bodyLeft: document.body?.style.left || "",
      bodyWidth: document.body?.style.width || "",
      bodyLocked: document.body?.classList.contains("detail-modal-page-scroll-locked") || false,
      modalOpen: document.getElementById("detailModal")?.classList.contains("open") || false
    };
  }, label);
}

async function runIteration(browser, iteration) {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "ko-KR",
    timezoneId: "Asia/Seoul"
  });
  const page = await context.newPage();
  const result = { iteration, samples: [], scrollToCalls: [] };

  try {
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForFunction(
      () => document.querySelectorAll("#joinMdPickSection .join-mdpick-card").length > 0,
      null,
      { timeout: 30_000 }
    );
    await waitForStableHomeLayout(page);

    const card = page.locator("#joinMdPickSection .join-mdpick-card").first();
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const diagnostic = {
        startedAt: performance.now(),
        click: null,
        scrollToCalls: []
      };
      window.__golfjoinScrollDiagnostic = diagnostic;

      const originalScrollTo = window.scrollTo.bind(window);
      window.scrollTo = (...args) => {
        let left = null;
        let top = null;
        if (typeof args[0] === "object" && args[0] !== null) {
          left = Number(args[0].left ?? window.scrollX);
          top = Number(args[0].top ?? window.scrollY);
        } else {
          left = Number(args[0] ?? window.scrollX);
          top = Number(args[1] ?? window.scrollY);
        }
        diagnostic.scrollToCalls.push({
          elapsedMs: Math.round(performance.now() - diagnostic.startedAt),
          left: Number.isFinite(left) ? left : null,
          top: Number.isFinite(top) ? top : null
        });
        return originalScrollTo(...args);
      };

      const captureClick = (event) => {
        if (!event.target?.closest?.("#joinMdPickSection .join-mdpick-card")) return;
        const scrollingElement = document.scrollingElement || document.documentElement;
        const viewport = window.visualViewport;
        diagnostic.click = {
          elapsedMs: Math.round(performance.now() - diagnostic.startedAt),
          windowScrollY: window.scrollY,
          documentScrollTop: scrollingElement?.scrollTop || 0,
          viewportPageTop: viewport?.pageTop ?? null,
          viewportOffsetTop: viewport?.offsetTop ?? null,
          pageHeight: scrollingElement?.scrollHeight || 0,
          rootHeight: document.getElementById("secret-golf-join")?.scrollHeight || 0
        };
        document.removeEventListener("click", captureClick, true);
      };
      document.addEventListener("click", captureClick, true);
    });

    result.samples.push(await captureMetrics(page, "before-click"));
    await card.click();
    await page.locator("#detailModal.open").waitFor({ state: "visible", timeout: 15_000 });
    result.samples.push(await captureMetrics(page, "modal-open"));

    const closeButton = page.locator(
      "#detailModal .detail-slider-back:visible, #detailModal .modal-close-icon:visible"
    ).first();
    await closeButton.waitFor({ state: "visible", timeout: 15_000 });
    await closeButton.click();
    await page.locator("#detailModal").waitFor({ state: "hidden", timeout: 15_000 });

    result.samples.push(await captureMetrics(page, "closed-immediate"));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    result.samples.push(await captureMetrics(page, "closed-raf-1"));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    result.samples.push(await captureMetrics(page, "closed-raf-2"));

    for (const delay of [50, 250, 1000, 5000]) {
      await page.waitForTimeout(delay);
      result.samples.push(await captureMetrics(page, `closed-after-${delay}ms`));
    }

    const diagnostic = await page.evaluate(() => window.__golfjoinScrollDiagnostic || {});
    result.click = diagnostic.click || null;
    result.scrollToCalls = Array.isArray(diagnostic.scrollToCalls) ? diagnostic.scrollToCalls : [];
    result.delta = result.click
      ? result.samples[result.samples.length - 1].windowScrollY - result.click.windowScrollY
      : null;
    result.status = Math.abs(result.delta ?? Infinity) <= 3 ? "pass" : "fail";
  } catch (error) {
    result.status = "error";
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE,
    headless: true
  });
  const results = [];
  try {
    for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
      results.push(await runIteration(browser, iteration));
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(`${JSON.stringify({ iterations: ITERATIONS, results }, null, 2)}\n`);
  if (results.some((result) => result.status === "error")) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
