"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = path.join(
  WORKSPACE_ROOT,
  "deploy/stage13-home-assets/production-minified-brotli-bridged-20260813"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
const candidateHtml = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.deployHtml.fileName), "utf8");
const cssGzip = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.css.fileName));
const jsBrotli = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.js.fileName));

function localizeHtml(html, baseUrl) {
  return html
    .replaceAll(manifest.files.css.url, `${baseUrl}/golfjoin-main.css`)
    .replaceAll(manifest.files.js.url, `${baseUrl}/golfjoin-main.js`);
}

function startServer(options = {}) {
  return new Promise((resolve, reject) => {
    let port = 0;
    const server = http.createServer((request, response) => {
      const baseUrl = `http://127.0.0.1:${port}`;
      if (request.url === "/golfjoin-main.css") {
        response.writeHead(200, {
          "content-type": manifest.files.css.contentType,
          "content-encoding": "gzip",
          "access-control-allow-origin": "*",
          "cache-control": manifest.files.css.cacheControl,
          "content-length": cssGzip.length
        });
        response.end(cssGzip);
        return;
      }
      if (request.url === "/golfjoin-main.js") {
        if (options.failJavaScript) {
          response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
          response.end("intentional-brotli-js-failure");
          return;
        }
        response.writeHead(200, {
          "content-type": manifest.files.js.contentType,
          "content-encoding": "br",
          "access-control-allow-origin": "*",
          "cache-control": manifest.files.js.cacheControl,
          "content-length": jsBrotli.length
        });
        response.end(jsBrotli);
        return;
      }
      if (request.url === "/" || request.url.startsWith("/?")) {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        });
        response.end(localizeHtml(candidateHtml, baseUrl));
        return;
      }
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolve(server);
    });
  });
}

async function stubFont(page) {
  await page.route(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css",
    (route) => route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
  );
}

test("축소+Brotli 후보는 PC·MO에서 해제·SRI 검증 후 기존 전역 기능을 실행한다", async ({ page }, testInfo) => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const pageErrors = [];
  const assetFailures = [];
  const assetResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (/golfjoin-main\.(css|js)$/.test(request.url())) {
      assetFailures.push({ url: request.url(), error: request.failure()?.errorText || "" });
    }
  });
  page.on("response", (response) => {
    if (!/golfjoin-main\.(css|js)$/.test(response.url())) return;
    assetResponses.push({
      url: response.url(),
      status: response.status(),
      contentEncoding: response.headers()["content-encoding"] || "identity",
      contentLength: Number(response.headers()["content-length"] || 0)
    });
  });

  try {
    await stubFont(page);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator("#secret-golf-join")).toBeAttached();
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
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth
    }));
    expect(state.criticalCssCount).toBe(1);
    expect(state.externalFailure).toBeNull();
    expect(state.scrollable).toBe(true);
    if (testInfo.project.name.includes("mobile")) expect(state.horizontalOverflow).toBeLessThanOrEqual(2);
    expect(assetResponses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: `${baseUrl}/golfjoin-main.css`,
        status: 200,
        contentEncoding: "gzip",
        contentLength: cssGzip.length
      }),
      expect.objectContaining({
        url: `${baseUrl}/golfjoin-main.js`,
        status: 200,
        contentEncoding: "br",
        contentLength: jsBrotli.length
      })
    ]));
    expect(assetFailures).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Brotli JS 응답이 실패하면 빈 화면 대신 기존 외부 자산 복구 안내를 표시한다", async ({ page }) => {
  const server = await startServer({ failJavaScript: true });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await stubFont(page);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeVisible({ timeout: 15_000 });
    const state = await page.evaluate(() => ({
      kind: window.__GOLFJOIN_EXTERNAL_ASSET_FAILURE__?.kind || "",
      loading: document.body.classList.contains("home-initial-loading"),
      modal: document.body.classList.contains("modal-open"),
      overlayHidden: document.getElementById("homeInitialLoadingOverlay")?.getAttribute("aria-hidden") === "true"
    }));
    expect(state).toEqual({ kind: "js", loading: false, modal: false, overlayHidden: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
