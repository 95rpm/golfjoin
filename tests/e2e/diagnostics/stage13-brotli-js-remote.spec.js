"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage13-home-assets/production-minified-brotli-bridged-20260813"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
const candidateHtml = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.deployHtml.fileName));

function candidateUrl(testInfo) {
  const host = testInfo.project.name.includes("mobile")
    ? "https://m.secret-tour.com"
    : "https://www.secret-tour.com";
  return `${host}/event/plan_view?eventPlanSeq=18&page=1&codex_brotli_remote=${Date.now()}`;
}

test("실제 GCS gzip CSS+Brotli JS가 PC·MO secret-tour 출처에서 SRI 검증 후 실행된다", async ({ page }, testInfo) => {
  const url = candidateUrl(testInfo);
  const pageErrors = [];
  const assetFailures = [];
  const consoleErrors = [];
  const responses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url() === manifest.files.css.url || request.url() === manifest.files.js.url) {
      assetFailures.push({ url: request.url(), error: request.failure()?.errorText || "" });
    }
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/integrity|valid digest|golfjoin-main\.(css|js)|unexpected token/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.url() !== manifest.files.css.url && response.url() !== manifest.files.js.url) return;
    responses.push({
      url: response.url(),
      status: response.status(),
      contentType: response.headers()["content-type"] || "",
      contentEncoding: response.headers()["content-encoding"] || "",
      cacheControl: response.headers()["cache-control"] || ""
    });
  });

  await page.route(url, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    headers: { "cache-control": "no-store" },
    body: candidateHtml
  }));
  await page.route(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css",
    (route) => route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
  );

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeAttached({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => typeof initializeGolfJoinHome)).toBe("function");
  await expect.poll(() => page.evaluate(() => typeof window.openMdPickProductDetail)).toBe("function");
  await expect.poll(() => page.evaluate(() => typeof window.switchJoinMyTab)).toBe("function");
  await expect.poll(() => page.evaluate(() => typeof window.setMyJoinFilter)).toBe("function");
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-golfjoin-full-css"))).toBe("loaded");
  await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeHidden();

  const state = await page.evaluate(() => ({
    criticalCssCount: document.querySelectorAll("style[data-golfjoin-critical-css]").length,
    externalFailure: window.__GOLFJOIN_EXTERNAL_ASSET_FAILURE__ || null,
    scrollable: document.documentElement.scrollHeight > innerHeight,
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    cssResources: performance.getEntriesByName(document.querySelector('link[as="style"]')?.href || "").length,
    jsResources: performance.getEntriesByName(document.querySelector('script[src*="golfjoin-main.js"]')?.src || "").length
  }));
  expect(state.criticalCssCount).toBe(1);
  expect(state.externalFailure).toBeNull();
  expect(state.scrollable).toBe(true);
  expect(state.cssResources).toBe(1);
  expect(state.jsResources).toBe(1);
  if (testInfo.project.name.includes("mobile")) expect(state.horizontalOverflow).toBeLessThanOrEqual(2);
  expect(responses).toEqual(expect.arrayContaining([
    expect.objectContaining({
      url: manifest.files.css.url,
      status: 200,
      contentType: manifest.files.css.contentType,
      contentEncoding: "gzip",
      cacheControl: manifest.files.css.cacheControl
    }),
    expect.objectContaining({
      url: manifest.files.js.url,
      status: 200,
      contentType: manifest.files.js.contentType,
      contentEncoding: "br",
      cacheControl: manifest.files.js.cacheControl
    })
  ]));
  expect(assetFailures).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
