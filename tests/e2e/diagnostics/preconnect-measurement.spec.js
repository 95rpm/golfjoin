"use strict";

const { test, expect } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = readLocalMainHtml();
const TARGET_ORIGINS = Object.freeze([
  "https://storage.googleapis.com",
  "https://asia-northeast3-golfjoin-499602.cloudfunctions.net"
]);
const PRECONNECT_HINTS = TARGET_ORIGINS
  .map((origin) => `  <link rel="preconnect" href="${origin}" crossorigin>`)
  .join("\n");

function replaceEmbeddedGolfJoinHtml(shellHtml, golfJoinHtml) {
  const marker = "<title>골프 조인 게시판</title>";
  const markerIndex = shellHtml.indexOf(marker);
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("preconnect_measurement_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${golfJoinHtml}${shellHtml.slice(closingIndex + 7)}`;
}

function addPreconnectHints(html) {
  return html.replace(
    "  <title>골프 조인 게시판</title>",
    `  <title>골프 조인 게시판</title>\n${PRECONNECT_HINTS}`
  );
}

function normalizeConnectionTiming(timing) {
  if (!timing) return null;
  const duration = (start, end) => (
    Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start
      ? Math.round((end - start) * 1000) / 1000
      : null
  );
  return {
    dnsMs: duration(timing.dnsStart, timing.dnsEnd),
    connectMs: duration(timing.connectStart, timing.connectEnd),
    sslMs: duration(timing.sslStart, timing.sslEnd),
    sendToHeadersMs: duration(timing.sendStart, timing.receiveHeadersEnd),
    reusedConnection: timing.dnsStart < 0 && timing.connectStart < 0,
    connectionId: timing.connectionId ?? null
  };
}

for (const variant of ["baseline", "preconnect"]) {
  test(`${variant} records first GCS and Cloud Function connection timing`, async ({ page }) => {
    const homeUrl = test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
    const candidateHtml = variant === "preconnect" ? addPreconnectHints(LOCAL_MAIN_HTML) : LOCAL_MAIN_HTML;
    const firstResponses = new Map();
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    client.on("Network.responseReceived", ({ response }) => {
      let origin = "";
      try {
        origin = new URL(response.url).origin;
      } catch (_) {
        return;
      }
      if (!TARGET_ORIGINS.includes(origin) || firstResponses.has(origin)) return;
      firstResponses.set(origin, {
        url: response.url,
        protocol: response.protocol,
        fromDiskCache: Boolean(response.fromDiskCache),
        fromServiceWorker: Boolean(response.fromServiceWorker),
        timing: normalizeConnectionTiming(response.timing)
      });
    });

    await page.addInitScript(() => {
      if (window.top !== window) return;
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.route((url) => {
      const target = new URL(homeUrl);
      return url.origin === target.origin
        && url.pathname === target.pathname
        && url.searchParams.get("eventPlanSeq") === target.searchParams.get("eventPlanSeq");
    }, async (route) => {
      const response = await route.fetch();
      const shellHtml = await response.text();
      await route.fulfill({
        response,
        body: replaceEmbeddedGolfJoinHtml(shellHtml, candidateHtml),
        headers: { ...response.headers(), "content-type": "text/html; charset=utf-8" }
      });
    });

    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator("#secret-golf-join")).toBeVisible();
    await expect.poll(() => TARGET_ORIGINS.every((origin) => firstResponses.has(origin)), {
      timeout: 60_000
    }).toBe(true);

    const result = {
      variant,
      project: test.info().project.name,
      responses: Object.fromEntries(firstResponses)
    };
    await test.info().attach("preconnect-timing.json", {
      body: Buffer.from(JSON.stringify(result, null, 2)),
      contentType: "application/json"
    });
    console.log(`PRECONNECT_RESULT ${JSON.stringify(result)}`);
  });
}
