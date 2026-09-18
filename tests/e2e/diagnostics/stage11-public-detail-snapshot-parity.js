"use strict";

const { chromium } = require("@playwright/test");
const {
  buildPublicProductDetailSnapshot
} = require("../../../server/google-sheet-proxy-function/product-detail-meta");
const { validateDataContract } = require("../../../server/google-sheet-proxy-function/data-contracts");

const HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const SAMPLE_LIMIT = Math.max(1, Math.min(12, Number(process.env.GOLFJOIN_DETAIL_SAMPLE_LIMIT || 6)));
const VERBOSE = process.env.GOLFJOIN_DETAIL_PARITY_VERBOSE === "1";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function comparableSchedule(schedule = []) {
  return (Array.isArray(schedule) ? schedule : []).map((day) => ({
    day: clean(day?.day),
    dateText: clean(day?.dateText),
    content: clean(day?.content),
    rawText: clean(day?.rawText),
    extra: {
      hotel: clean(day?.extra?.hotel),
      meals: (Array.isArray(day?.extra?.meals) ? day.extra.meals : []).map((meal) => ({
        label: clean(meal?.label),
        menu: clean(meal?.menu)
      }))
    }
  }));
}

function comparableDetail(value = {}) {
  return {
    detailTitleCopy: clean(value.detailTitleCopy),
    goodDescription: clean(value.goodDescription),
    goodTransportSeq: clean(value.goodTransportSeq),
    includes: (value.includes || []).map(clean),
    excludes: (value.excludes || []).map(clean),
    notes: (value.notes || []).map((note) => clean(note?.text || note)),
    schedule: comparableSchedule(value.schedule),
    slides: value.slides || [],
    introImages: value.introImages || []
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
      const products = (externalGolfJoinProducts || []).filter((product) => {
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
        output.push({
          product: {
            goodSeq: getGolfJoinProductGoodSeq(product),
            eventSeq: getGolfJoinProductEventSeq(product),
            title: product.title,
            departureDate: product.departureDate,
            returnDate: product.returnDate,
            duration: product.duration,
            price: product.generalPrice || product.price,
            image: product.image,
            productType: product.productType,
            goodsType: product.goodsType,
            airline: product.airline,
            departureAirport: product.departureAirport,
            arrivalAirport: product.arrivalAirport
          },
          status: response.status,
          html,
          browserDetail: parseSecretTourGoodsDetailHtml(html)
        });
      }
      return output;
    }, SAMPLE_LIMIT);

    const comparisons = samples.map((sample) => {
      const snapshot = buildPublicProductDetailSnapshot(sample.html, sample.product, {
        generatedAt: "2026-08-12T00:00:00+09:00"
      });
      const contract = validateDataContract("productDetailSnapshotV1", snapshot);
      const browserDetail = comparableDetail(sample.browserDetail);
      const serverDetail = comparableDetail(snapshot);
      const mismatchFields = Object.keys(browserDetail).filter((key) => (
        JSON.stringify(browserDetail[key]) !== JSON.stringify(serverDetail[key])
      ));
      return {
        goodSeq: sample.product.goodSeq,
        eventSeq: sample.product.eventSeq,
        httpStatus: sample.status,
        detailStatus: snapshot.detailStatus,
        contractValid: contract.valid,
        contractIssues: contract.issues,
        valid: contract.valid && mismatchFields.length === 0,
        mismatchFields,
        sectionStatus: snapshot.sectionStatus,
        ...(VERBOSE ? { browserDetail, serverDetail } : {})
      };
    });
    const result = {
      sampleCount: comparisons.length,
      validCount: comparisons.filter((item) => item.valid).length,
      readyCount: comparisons.filter((item) => item.detailStatus === "ready").length,
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
