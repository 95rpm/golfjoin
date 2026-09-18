"use strict";

const { chromium } = require("@playwright/test");
const {
  buildProductGolfSummaryFromHtml
} = require("../../../server/google-sheet-proxy-function/product-detail-meta");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const SAMPLE_LIMIT = Math.max(1, Math.min(12, Number(process.env.GOLFJOIN_DETAIL_SAMPLE_LIMIT || 6)));

function comparableSummary(summary = {}) {
  return {
    golfDays: Number(summary.golfDays || 0),
    minTotalHoles: Number(summary.minTotalHoles || 0),
    maxTotalHoles: Number(summary.maxTotalHoles || 0),
    label: String(summary.label || ""),
    status: String(summary.status || "empty")
  };
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => typeof ensureExternalGolfJoinProductsLoaded === "function", null, { timeout: 60_000 });
    const samples = await page.evaluate(async (limit) => {
      await ensureExternalGolfJoinProductsLoaded();
      const seen = new Set();
      const products = getBuilderProductSource().filter((product) => {
        const goodSeq = getGolfJoinProductGoodSeq(product);
        const eventSeq = getGolfJoinProductEventSeq(product);
        if (!goodSeq || !eventSeq || seen.has(goodSeq)) return false;
        seen.add(goodSeq);
        return true;
      }).slice(0, limit);
      const output = [];
      for (const product of products) {
        const response = await fetch(buildSecretTourGoodsViewUrl(product), { credentials: "same-origin" });
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        output.push({
          goodSeq: getGolfJoinProductGoodSeq(product),
          eventSeq: getGolfJoinProductEventSeq(product),
          status: response.status,
          html,
          browserSummary: buildDetailProductFamilyGolfSummary(parseSecretTourSchedule(doc))
        });
      }
      return output;
    }, SAMPLE_LIMIT);

    const comparisons = samples.map((sample) => {
      const browserSummary = comparableSummary(sample.browserSummary);
      const serverSummary = comparableSummary(buildProductGolfSummaryFromHtml(sample.html));
      return {
        goodSeq: sample.goodSeq,
        eventSeq: sample.eventSeq,
        httpStatus: sample.status,
        valid: JSON.stringify(browserSummary) === JSON.stringify(serverSummary),
        browserSummary,
        serverSummary
      };
    });
    const result = {
      sampleCount: comparisons.length,
      validCount: comparisons.filter((item) => item.valid).length,
      mismatchCount: comparisons.filter((item) => !item.valid).length,
      comparisons
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!comparisons.length || result.mismatchCount) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
