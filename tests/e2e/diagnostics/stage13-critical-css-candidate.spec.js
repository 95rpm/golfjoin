"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const CANDIDATE_ROOT = path.resolve(
  process.env.GOLFJOIN_CRITICAL_CANDIDATE_ROOT
    || path.join(WORKSPACE_ROOT, "dist/golfjoin-main/critical-css/ghc_c303d9e05653fdaf53381195")
);
const candidateHtml = fs.readFileSync(path.join(CANDIDATE_ROOT, "golfjoin_main_critical_candidate.html"));
const rollbackHtml = fs.readFileSync(path.join(CANDIDATE_ROOT, "golfjoin_main_gzip_rollback.html"));
const publication = JSON.parse(fs.readFileSync(path.join(CANDIDATE_ROOT, "publication.json"), "utf8"));
const fullCss = fs.readFileSync(path.join(WORKSPACE_ROOT, "src/golfjoin-main/source/styles/10-main.css"));
const fullJs = fs.readFileSync(path.join(
  WORKSPACE_ROOT,
  `dist/golfjoin-main/external-assets/${publication.fullAssetRevision}/golfjoin-main.js`
));
const CSS_URL = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${publication.fullAssetRevision}/golfjoin-main.css`;
const JS_URL = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${publication.fullAssetRevision}/golfjoin-main.js`;

function homeUrl(testInfo, suffix) {
  const host = testInfo.project.name.includes("mobile") ? "https://m.secret-tour.com" : "https://www.secret-tour.com";
  return `${host}/event/plan_view?eventPlanSeq=3&page=1&codex_stage13=${suffix}_${Date.now()}`;
}

async function routeCommon(page, url, html) {
  await page.route(url, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    headers: { "cache-control": "no-store" },
    body: html
  }));
  await page.route(JS_URL, (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    headers: { "access-control-allow-origin": "*" },
    body: fullJs
  }));
  await page.route("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css", (route) => route.fulfill({
    status: 200,
    contentType: "text/css; charset=utf-8",
    body: ""
  }));
}

async function initialFingerprint(page) {
  return page.evaluate(() => {
    const selectors = [
      "#secret-golf-join",
      ".sgj-section.hero",
      ".hero-grid",
      ".hero-title",
      ".hero-calendar-button",
      "#join-section-mdpick",
      "#joinSectionNav"
    ];
    const round = (value) => Math.round(Number(value) * 10) / 10;
    return Object.fromEntries(selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return [selector, null];
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return [selector, {
        rect: [round(rect.x), round(rect.y), round(rect.width), round(rect.height)],
        display: style.display,
        position: style.position,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        padding: style.padding,
        margin: style.margin,
        gap: style.gap,
        overflow: style.overflow,
        borderRadius: style.borderRadius,
        color: style.color,
        backgroundColor: style.backgroundColor
      }];
    }));
  });
}

function compareFingerprints(before, after) {
  for (const [selector, beforeValue] of Object.entries(before)) {
    const afterValue = after[selector];
    expect(afterValue, selector).not.toBeNull();
    expect(beforeValue, selector).not.toBeNull();
    for (const property of Object.keys(beforeValue).filter((key) => key !== "rect")) {
      expect(afterValue[property], `${selector}:${property}`).toBe(beforeValue[property]);
    }
    beforeValue.rect.slice(0, 3).forEach((value, index) => {
      expect(Math.abs(afterValue.rect[index] - value), `${selector}:rect:${index}`).toBeLessThanOrEqual(2);
    });
  }
}

test("critical CSS만 있는 동안에도 PC·MO 첫 화면이 유지되고 전체 CSS 합류 시 이동하지 않는다", async ({ page }, testInfo) => {
  const url = homeUrl(testInfo, "critical_delay");
  const pageErrors = [];
  let releaseCss;
  const cssGate = new Promise((resolve) => { releaseCss = resolve; });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await routeCommon(page, url, candidateHtml);
  await page.route(CSS_URL, async (route) => {
    await cssGate;
    await route.fulfill({
      status: 200,
      contentType: "text/css; charset=utf-8",
      headers: { "access-control-allow-origin": "*" },
      body: fullCss
    });
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#join-section-mdpick")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeHidden();
  const before = await initialFingerprint(page);
  const criticalState = await page.evaluate(() => ({
    critical: document.querySelectorAll("style[data-golfjoin-critical-css]").length,
    preload: document.querySelectorAll('link[rel="preload"][as="style"]').length,
    fullCss: document.documentElement.getAttribute("data-golfjoin-full-css") || "",
    scrollable: document.documentElement.scrollHeight > innerHeight,
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth
  }));
  expect(criticalState.critical).toBe(1);
  expect(criticalState.preload).toBe(1);
  expect(criticalState.fullCss).toBe("");
  expect(criticalState.scrollable).toBe(true);
  if (testInfo.project.name.includes("mobile")) expect(criticalState.horizontalOverflow).toBeLessThanOrEqual(2);

  releaseCss();
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-golfjoin-full-css")))
    .toBe("loaded");
  // 화면 골격 비교는 실시간 상품 데이터 유무와 독립적이어야 한다. MD PICK 카드가
  // 비어 있는 시점에도 전체 CSS 합류 전후의 위치·스타일은 정확히 비교할 수 있다.
  await expect(page.locator("#join-section-mdpick")).toBeVisible();
  await page.waitForTimeout(150);
  const after = await initialFingerprint(page);
  compareFingerprints(before, after);
  expect(pageErrors).toEqual([]);
});

test("전체 CSS가 실패하면 빈 화면이나 스크롤 잠금 대신 복구 안내를 표시한다", async ({ page }, testInfo) => {
  const url = homeUrl(testInfo, "critical_failure");
  await routeCommon(page, url, candidateHtml);
  await page.route(CSS_URL, (route) => route.fulfill({ status: 503, contentType: "text/plain", body: "intentional-critical-css-failure" }));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#golfJoinExternalAssetFailureNotice")).toBeVisible({ timeout: 15_000 });
  const state = await page.evaluate(() => ({
    loading: document.body.classList.contains("home-initial-loading"),
    modal: document.body.classList.contains("modal-open"),
    overlayHidden: document.getElementById("homeInitialLoadingOverlay")?.getAttribute("aria-hidden") === "true",
    failure: document.documentElement.getAttribute("data-golfjoin-external-asset-failure") || ""
  }));
  expect(state).toEqual({ loading: false, modal: false, overlayHidden: true, failure: "css" });
});

test("현재 gzip HTML 복구본은 critical preload 없이 기존 차단 stylesheet를 유지한다", async ({ page }, testInfo) => {
  const url = homeUrl(testInfo, "critical_rollback");
  await routeCommon(page, url, rollbackHtml);
  await page.route(CSS_URL, (route) => route.fulfill({
    status: 200,
    contentType: "text/css; charset=utf-8",
    headers: { "access-control-allow-origin": "*" },
    body: fullCss
  }));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible({ timeout: 15_000 });
  const state = await page.evaluate(({ cssUrl }) => ({
    critical: document.querySelectorAll("style[data-golfjoin-critical-css]").length,
    preload: document.querySelectorAll('link[rel="preload"][as="style"]').length,
    stylesheet: document.querySelectorAll(`link[rel="stylesheet"][href="${cssUrl}"]`).length,
    failure: document.documentElement.getAttribute("data-golfjoin-external-asset-failure") || ""
  }), { cssUrl: CSS_URL });
  expect(state).toEqual({ critical: 0, preload: 0, stylesheet: 1, failure: "" });
});
