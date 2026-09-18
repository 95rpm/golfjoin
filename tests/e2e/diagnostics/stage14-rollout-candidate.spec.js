"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = process.env.STAGE14_PACKAGE_ROOT
  ? path.resolve(WORKSPACE_ROOT, process.env.STAGE14_PACKAGE_ROOT)
  : path.join(WORKSPACE_ROOT, "deploy/stage14-rollout/home-data-v2-100pct-20260814");
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
const candidateHtml = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.deployHtml.fileName), "utf8");
const cssGzip = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.css.fileName));
const jsBrotli = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.js.fileName));
const RELEASE_ROOT_URL = "https://storage.googleapis.com/golfjoin-bucket/web/release-manifest-v2.json";
const ELIGIBLE_BOUNDARY = manifest.rollout.targetBasisPoints - 1;
const INELIGIBLE_BOUNDARY = manifest.rollout.targetBasisPoints;

function createRemoteGateOffManifest() {
  const releaseRevision = "gjr_aaaaaaaaaaaaaaaaaaaaaaaa";
  const revisions = {
    homeCards: "ghc_bbbbbbbbbbbbbbbbbbbbbbbb",
    liveHome: "ghl_cccccccccccccccccccccccc",
    productFamily: "pfc_dddddddddddddddddddddddd"
  };
  const schemas = {
    homeCards: "secret-golf-join-home-cards-v2",
    liveHome: "secret-golf-join-home-live-v1",
    productFamily: "golfjoin-product-family-catalog-v1"
  };
  const objects = Object.fromEntries(Object.keys(revisions).map((role) => {
    const objectName = `web/releases/${releaseRevision}/objects/${role}.json`;
    return [role, {
      role,
      revision: revisions[role],
      schema: schemas[role],
      objectName,
      url: `https://storage.googleapis.com/golfjoin-bucket/${objectName}`,
      contentSha256: "e".repeat(64),
      bytes: 1,
      contentType: "application/json; charset=utf-8",
      contentEncoding: "identity"
    }];
  }));
  return {
    schema: "secret-golf-join-release-manifest-v2",
    releaseRevision,
    sourceSnapshotWatermark: "gjs_eeeeeeeeeeeeeeeeeeeeeeee",
    staticRevision: revisions.homeCards,
    liveRevision: revisions.liveHome,
    familyRevision: revisions.productFamily,
    browserReadEnabled: false,
    objects
  };
}

function localizeHtml(html, baseUrl) {
  return html
    .replaceAll(manifest.files.css.url, `${baseUrl}/golfjoin-main.css`)
    .replaceAll(manifest.files.js.url, `${baseUrl}/golfjoin-main.js`);
}

function startServer() {
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

async function preparePage(page, bucket) {
  await page.addInitScript((value) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", String(value));
  }, bucket);
  await page.route(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css",
    (route) => route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" })
  );
  await page.route(RELEASE_ROOT_URL, (route) => route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(createRemoteGateOffManifest())
  }));
}

async function openCandidate(page, bucket) {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  await preparePage(page, bucket);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeAttached();
  await expect.poll(() => page.evaluate(() => typeof getGolfJoinHomeDataV2Diagnostics)).toBe("function");
  await expect.poll(() => page.evaluate(() => (
    getGolfJoinHomeDataV2Diagnostics().startupDecisionPending
  ))).toBe(false);
  return { server, baseUrl };
}

test(`bucket ${ELIGIBLE_BOUNDARY}는 ${manifest.rollout.targetPercent}% 대상이며 원격 OFF 때 안전하게 Legacy를 유지한다`, async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const { server } = await openCandidate(page, ELIGIBLE_BOUNDARY);
  try {
    const diagnostics = await page.evaluate(() => getGolfJoinHomeDataV2Diagnostics());
    expect(diagnostics).toEqual(expect.objectContaining({
      rolloutBasisPoints: manifest.rollout.targetBasisPoints,
      rolloutBucket: ELIGIBLE_BOUNDARY,
      rolloutEligible: true,
      state: "LEGACY_READY",
      reason: "remote_gate_off",
      requestCount: 1
    }));
    await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeHidden();
    await expect.poll(() => page.evaluate(() => typeof window.switchJoinMyTab)).toBe("function");
    await expect.poll(() => page.evaluate(() => typeof window.openMdPickProductDetail)).toBe("function");
    const layout = await page.evaluate(() => ({
      scrollable: document.documentElement.scrollHeight > innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
      criticalCssCount: document.querySelectorAll("style[data-golfjoin-critical-css]").length
    }));
    expect(layout.scrollable).toBe(true);
    expect(layout.criticalCssCount).toBe(1);
    if (testInfo.project.name.includes("mobile")) expect(layout.overflow).toBeLessThanOrEqual(2);
    expect(pageErrors).toEqual([]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test(`bucket ${INELIGIBLE_BOUNDARY}은 ${manifest.rollout.targetPercent}% 비대상이며 Release 요청을 만들지 않는다`, async ({ page }) => {
  test.skip(
    manifest.rollout.targetBasisPoints >= 10000,
    "100% rollout에는 유효한 익명 미대상 bucket이 없으며 회원 제외는 단위·로그인 검사에서 확인한다"
  );
  const releaseRequests = [];
  const pageErrors = [];
  page.on("request", (request) => {
    if (request.url() === RELEASE_ROOT_URL) releaseRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const { server } = await openCandidate(page, INELIGIBLE_BOUNDARY);
  try {
    const diagnostics = await page.evaluate(() => getGolfJoinHomeDataV2Diagnostics());
    expect(diagnostics).toEqual(expect.objectContaining({
      rolloutBasisPoints: manifest.rollout.targetBasisPoints,
      rolloutBucket: INELIGIBLE_BOUNDARY,
      rolloutEligible: false,
      state: "LEGACY_READY",
      reason: "rollout_not_eligible",
      requestCount: 0
    }));
    expect(releaseRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
