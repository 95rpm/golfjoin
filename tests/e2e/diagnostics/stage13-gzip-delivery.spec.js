"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const { test, expect } = require("@playwright/test");
const { buildExternalAssetBundle } = require("../../../tools/golfjoin-main/external-assets");

const bundle = buildExternalAssetBundle({
  generatedAt: "2026-08-13T12:00:00+09:00",
  contentEncoding: "gzip"
});

function replaceAssetUrls(html, baseUrl) {
  return html
    .replaceAll(bundle.publication.assets.css.url, `${baseUrl}/golfjoin-main.css`)
    .replaceAll(bundle.publication.assets.js.url, `${baseUrl}/golfjoin-main.js`);
}

function startServer() {
  return new Promise((resolve, reject) => {
    let listeningPort = 0;
    const server = http.createServer((request, response) => {
      const baseUrl = `http://127.0.0.1:${listeningPort}`;
      if (request.url === "/golfjoin-main.css") {
        response.writeHead(200, {
          "content-type": bundle.publication.assets.css.contentType,
          "content-encoding": "gzip",
          "access-control-allow-origin": "*",
          "cache-control": bundle.publication.assets.css.cacheControl,
          "content-length": bundle.artifacts.cssDelivery.buffer.length
        });
        response.end(bundle.artifacts.cssDelivery.buffer);
        return;
      }
      if (request.url === "/golfjoin-main.js") {
        response.writeHead(200, {
          "content-type": bundle.publication.assets.js.contentType,
          "content-encoding": "gzip",
          "access-control-allow-origin": "*",
          "cache-control": bundle.publication.assets.js.cacheControl,
          "content-length": bundle.artifacts.jsDelivery.buffer.length
        });
        response.end(bundle.artifacts.jsDelivery.buffer);
        return;
      }
      if (request.url === "/" || request.url.startsWith("/?")) {
        const html = replaceAssetUrls(bundle.artifacts.html.buffer.toString("utf8"), baseUrl);
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        });
        response.end(html);
        return;
      }
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      listeningPort = server.address().port;
      resolve(server);
    });
  });
}

test("gzip 전송 자산은 브라우저 네트워크 계층에서 해제되고 같은 코드를 실행한다", async ({ page }) => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const pageErrors = [];
  const consoleErrors = [];
  const assetResponses = [];
  const assetFailures = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/integrity|valid digest|golfjoin-main\.(css|js)|unexpected token/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    if (/golfjoin-main\.(css|js)$/.test(request.url())) {
      assetFailures.push({ url: request.url(), error: request.failure()?.errorText || "" });
    }
  });
  page.on("response", (response) => {
    if (!/golfjoin-main\.(css|js)$/.test(response.url())) return;
    const record = {
      url: response.url(),
      status: response.status(),
      contentEncoding: response.headers()["content-encoding"] || "identity",
      contentLength: Number(response.headers()["content-length"] || 0)
    };
    assetResponses.push(record);
    response.body().then((body) => {
      record.browserBodyBytes = body.length;
      record.browserBodySha256 = crypto.createHash("sha256").update(body).digest("hex");
    }).catch((error) => {
      record.bodyError = error.message;
    });
  });

  try {
    await page.route("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator("#secret-golf-join")).toBeAttached();
    await page.waitForTimeout(1_000);
    const earlyFailure = await page.evaluate(() => window.__GOLFJOIN_EXTERNAL_ASSET_FAILURE__ || null);
    expect(
      earlyFailure,
      JSON.stringify({ assetResponses, assetFailures, pageErrors, consoleErrors }, null, 2)
    ).toBeNull();
    expect(pageErrors, JSON.stringify({ assetResponses, assetFailures, consoleErrors }, null, 2)).toEqual([]);
    await expect.poll(() => page.evaluate(() => typeof initializeGolfJoinHome)).toBe("function");
    await expect.poll(() => page.evaluate(() => typeof window.openMdPickProductDetail)).toBe("function");
    await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeHidden();
    await expect(page.locator("html")).not.toHaveAttribute("data-golfjoin-external-asset-failure", /.+/);
    expect(assetResponses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: `${baseUrl}/golfjoin-main.css`,
        status: 200,
        contentEncoding: "gzip",
        contentLength: bundle.publication.assets.css.encodedBytes
      }),
      expect.objectContaining({
        url: `${baseUrl}/golfjoin-main.js`,
        status: 200,
        contentEncoding: "gzip",
        contentLength: bundle.publication.assets.js.encodedBytes
      })
    ]));
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
