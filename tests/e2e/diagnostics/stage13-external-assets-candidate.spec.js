"use strict";

const { test, expect } = require("@playwright/test");
const {
  buildExternalAssetBundle
} = require("../../../tools/golfjoin-main/external-assets");

const DESKTOP_HOME_URL = "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const ASSET_ENCODING = process.env.GOLFJOIN_STAGE13_ASSET_ENCODING === "gzip" ? "gzip" : "identity";
const bundle = buildExternalAssetBundle({
  generatedAt: "2026-08-13T12:00:00+09:00",
  contentEncoding: ASSET_ENCODING
});
const USE_REAL_ASSETS = process.env.GOLFJOIN_STAGE13_REAL_ASSETS === "1";
const EXPECTED_CONTENT_ENCODING = USE_REAL_ASSETS ? ASSET_ENCODING : "identity";

function homeUrl() {
  return test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
}

test("13단계 외부 CSS/JS 후보는 원래 실행 위치에서 로드되고 메인 DOM을 유지한다", async ({ page }) => {
  const url = homeUrl();
  const assetResponses = [];
  const assetFailures = [];
  const pageErrors = [];
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.url() === bundle.publication.assets.css.url || response.url() === bundle.publication.assets.js.url) {
      assetResponses.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()["content-type"] || "",
        contentEncoding: response.headers()["content-encoding"] || "identity"
      });
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url() === bundle.publication.assets.css.url || request.url() === bundle.publication.assets.js.url) {
      assetFailures.push({ url: request.url(), error: request.failure()?.errorText || "" });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      headers: { "cache-control": "no-store" },
      body: bundle.artifacts.html.buffer
    });
  });
  if (!USE_REAL_ASSETS) {
    await page.route(bundle.publication.assets.css.url, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: bundle.publication.assets.css.contentType,
        headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=31536000, immutable" },
        body: bundle.artifacts.css.buffer
      });
    });
    await page.route(bundle.publication.assets.js.url, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: bundle.publication.assets.js.contentType,
        headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=31536000, immutable" },
        body: bundle.artifacts.js.buffer
      });
    });
  }
  await page.route("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" });
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeAttached();
  await page.waitForTimeout(1_000);
  const earlyFailure = await page.evaluate(() => window.__GOLFJOIN_EXTERNAL_ASSET_FAILURE__ || null);
  expect(earlyFailure, JSON.stringify({ assetResponses, assetFailures, pageErrors, consoleErrors }, null, 2)).toBeNull();
  expect(pageErrors, JSON.stringify({ assetResponses, assetFailures, consoleErrors }, null, 2)).toEqual([]);
  await expect.poll(() => page.evaluate(() => typeof initializeGolfJoinHome)).toBe("function");
  await expect.poll(() => page.evaluate(() => typeof window.openMdPickProductDetail)).toBe("function");

  const loaded = await page.evaluate(({ cssUrl, jsUrl }) => ({
    css: performance.getEntriesByName(cssUrl).length,
    js: performance.getEntriesByName(jsUrl).length,
    rootDisplay: getComputedStyle(document.getElementById("secret-golf-join")).display,
    externalScriptCount: document.querySelectorAll(`script[src="${jsUrl}"]`).length,
    externalStyleCount: document.querySelectorAll(`link[href="${cssUrl}"]`).length
  }), {
    cssUrl: bundle.publication.assets.css.url,
    jsUrl: bundle.publication.assets.js.url
  });

  expect(assetFailures).toEqual([]);
  expect(assetResponses).toEqual(expect.arrayContaining([
    expect.objectContaining({
      url: bundle.publication.assets.css.url,
      status: 200,
      contentType: expect.stringMatching(/^text\/css/),
      contentEncoding: EXPECTED_CONTENT_ENCODING
    }),
    expect.objectContaining({
      url: bundle.publication.assets.js.url,
      status: 200,
      contentType: expect.stringMatching(/^application\/javascript/),
      contentEncoding: EXPECTED_CONTENT_ENCODING
    })
  ]));
  expect(loaded).toEqual({ css: 1, js: 1, rootDisplay: "block", externalScriptCount: 1, externalStyleCount: 1 });
  expect(pageErrors).toEqual([]);
});

test("13단계 외부 JavaScript가 실패해도 로딩 잠금 대신 복구 안내를 표시한다", async ({ page }) => {
  const url = homeUrl();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      headers: { "cache-control": "no-store" },
      body: bundle.artifacts.html.buffer
    });
  });
  await page.route(bundle.publication.assets.css.url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: bundle.publication.assets.css.contentType,
      headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=31536000, immutable" },
      body: bundle.artifacts.css.buffer
    });
  });
  await page.route(bundle.publication.assets.js.url, async (route) => {
    await route.fulfill({ status: 503, contentType: "text/plain", body: "intentional-stage13-test-failure" });
  });
  await page.route("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" });
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-golfjoin-external-asset-failure", "js");
  await expect(page.locator("body")).not.toHaveClass(/modal-open|home-initial-loading/);
  await expect(page.locator("#homeInitialLoadingOverlay")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#homeInitialLoadingOverlay")).toBeHidden();
  expect(pageErrors).toEqual([]);
});
