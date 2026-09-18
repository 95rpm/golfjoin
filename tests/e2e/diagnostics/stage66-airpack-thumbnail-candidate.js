"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage66-airpack-thumbnail/january-airpack-thumbnail-20260914-v66a"
);
const HTML = fs.readFileSync(
  path.join(PACKAGE_ROOT, "DEPLOY_golfjoin_main_airpack_thumbnail_084D4013.html"),
  "utf8"
);
const CSS = zlib.gunzipSync(fs.readFileSync(
  path.join(PACKAGE_ROOT, "UPLOAD_golfjoin-main_01BAA29A.css.gz")
));
const JS = zlib.brotliDecompressSync(fs.readFileSync(
  path.join(PACKAGE_ROOT, "UPLOAD_golfjoin-main_58FC228F.js.br")
));
const TARGET_URL = "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const TARGET_IDS = ["30001287", "30001288"];

async function runScenario(browser, name, viewport) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.route("**/event/plan_view?**", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: HTML });
  });
  await page.route("**/home-assets/gha_9a93873d175b093478d342dd/golfjoin-main.css", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: CSS });
  });
  await page.route("**/home-assets/gha_9a93873d175b093478d342dd/golfjoin-main.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: JS });
  });

  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  try {
    await page.waitForFunction((ids) => {
      const cards = [...document.querySelectorAll("[data-join-section='overseas'] .join-card")];
      return ids.every((id) => cards.some((card) => card.innerHTML.includes(id)))
        || cards.filter((card) => card.querySelector(".join-title")?.textContent?.includes("[1월 월례회]")).length >= 2;
    }, TARGET_IDS, { timeout: 60_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      readyState: document.readyState,
      sectionCount: document.querySelectorAll("[data-join-section]").length,
      overseasCardCount: document.querySelectorAll("[data-join-section='overseas'] .join-card").length,
      titles: [...document.querySelectorAll("[data-join-section='overseas'] .join-title")]
        .slice(0, 20)
        .map((node) => node.textContent?.trim() || ""),
      bodyText: document.body?.innerText?.slice(0, 500) || ""
    }));
    throw new Error(`candidate_cards_timeout:${JSON.stringify({ diagnostic, consoleErrors })}`, { cause: error });
  }

  const targetCards = page.locator("[data-join-section='overseas'] .join-card").filter({ hasText: "[1월 월례회]" });
  const count = await targetCards.count();
  if (count < 2) throw new Error(`january_cards_missing:${count}`);
  await targetCards.first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("[data-join-section='overseas'] .join-card")]
      .filter((card) => card.querySelector(".join-title")?.textContent?.includes("[1월 월례회]"));
    return cards.length >= 2 && cards.every((card) => {
      const image = card.querySelector(".join-thumb img");
      return image?.getAttribute("src") && image.complete && image.naturalWidth > 0
        && card.querySelector(".join-flight-chip")?.textContent?.trim() !== "항공불포함";
    });
  }, null, { timeout: 60_000 });

  const cards = await targetCards.evaluateAll((nodes) => nodes.slice(0, 2).map((card) => {
    const image = card.querySelector(".join-thumb img");
    return {
      title: card.querySelector(".join-title")?.textContent?.trim() || "",
      flightChip: card.querySelector(".join-flight-chip")?.textContent?.trim() || "",
      imageSrc: image?.getAttribute("src") || "",
      imageNaturalWidth: image?.naturalWidth || 0,
      imageNaturalHeight: image?.naturalHeight || 0
    };
  }));

  const cardScreenshot = path.join(os.tmpdir(), `golfjoin-stage66-airpack-cards-${name}.png`);
  await page.screenshot({ path: cardScreenshot, fullPage: false });
  await targetCards.first().click();
  await page.locator("#detailModal.open").waitFor({ state: "visible", timeout: 30_000 });
  const modalTitle = (await page.locator("#detailModalTitle").textContent())?.trim() || "";
  const modalScreenshot = path.join(os.tmpdir(), `golfjoin-stage66-airpack-modal-${name}.png`);
  await page.screenshot({ path: modalScreenshot, fullPage: false });
  await context.close();
  return { name, viewport, count, cards, modalTitle, consoleErrors, cardScreenshot, modalScreenshot };
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const results = [];
    results.push(await runScenario(browser, "desktop", { width: 1440, height: 1000 }));
    results.push(await runScenario(browser, "mobile", { width: 390, height: 844 }));
    process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
