"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function extractFunction(html, name, nextName) {
  const start = html.indexOf(`function ${name}(`);
  const end = html.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} not found`);
  assert.notEqual(end, -1, `${nextName} not found after ${name}`);
  return html.slice(start, end);
}

test("MD PICK renders as soon as exact data is ready with a next-frame fallback", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const dataReadyScheduler = extractFunction(html, "scheduleMdPickSectionRenderWhenDataReady", "ensureHomeGolfJoinProductsLoaded");
  const scheduler = extractFunction(html, "scheduleMdPickSectionRender", "renderJoins");
  const homeProductsLoader = extractFunction(html, "ensureHomeGolfJoinProductsLoaded", "getHomeProductSource");

  assert.match(scheduler, /requestAnimationFrame\(run\)/);
  assert.doesNotMatch(scheduler, /requestIdleCallback|setTimeout/);
  assert.match(homeProductsLoader, /const homeGolfJoinProductsReadyPromise = productsPromise/);
  assert.match(homeProductsLoader, /homeGolfJoinProductsLoadPromise = homeGolfJoinProductsReadyPromise\s*\.finally/);
  assert.match(dataReadyScheduler, /"golfjoin:mdpick:data-ready"/);
  assert.match(dataReadyScheduler, /if \(!renderMdPickSectionOnly\(\)\) scheduleMdPickSectionRender\(\)/);
  assert.match(homeProductsLoader, /scheduleMdPickSectionRenderWhenDataReady\(\)/);
  assert.doesNotMatch(homeProductsLoader, /Promise\.all\(/);
  assert.doesNotMatch(html, /function scheduleMdPickImagePreload\s*\(/);
  assert.doesNotMatch(html, /function preloadMdPickCountryImages\s*\(/);
});

test("only the real hero gets high priority while active MD PICK cards load eagerly", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const renderCard = extractFunction(html, "renderMdPickCard", "consumeMdPickSwipeClick");

  assert.match(html, /hero_banner\.webp[^>]+loading="eager"[^>]+fetchpriority="high"/);
  assert.match(renderCard, /loading="eager" decoding="async"/);
  assert.doesNotMatch(renderCard, /fetchpriority="high"/);
});

test("dynamic preference rendering does not duplicate the active theme group", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const renderThemes = extractFunction(html, "renderMdPickThemeSection", "setMdPickPackFilter");
  const hydrateTheme = extractFunction(html, "ensureMdPickThemeGroupRendered", "setMdPickTheme");
  const renderPrimary = extractFunction(html, "renderMdPickSectionOnly", "scheduleMdPickSectionRender");

  assert.doesNotMatch(renderThemes, /legacy-active-hidden/);
  assert.match(renderThemes, /themes\.map\(renderThemeGroup\)\.join/);
  assert.match(renderThemes, /const isActive = theme\.key === activeTheme\.key/);
  assert.match(renderThemes, /isActive \? theme\.items\.map/);
  assert.match(renderThemes, /is-theme-ready/);
  assert.match(hydrateTheme, /if \(!grid\.querySelector\("\.join-mdpick-theme-card"\)\)/);
  assert.match(hydrateTheme, /renderMdPickThemeCard\(product, theme/);
  assert.match(html, /data-mdpick-theme-deferred/);
  assert.match(html, /rootMargin: "1200px 0px 1200px 0px"/);
  assert.match(html, /renderMdPickSection\(\{ deferTheme: true \}\)/);
  assert.match(renderThemes, /eager: true/);
  assert.match(renderPrimary, /updateMdPickSectionNavVisibility\(Boolean\(mdPickSectionHtml\)\)/);
  assert.doesNotMatch(renderPrimary, /getHomeJoinSections\(\)/);
  assert.match(renderPrimary, /golfJoinPerformanceOnceMarks\.has\("golfjoin:mdpick:data-ready"\)/);
  assert.match(renderPrimary, /if \(mdPickDataReady\) observeGolfJoinMdPickFirstImageReady\(mdPickSection\)/);
});

test("interaction prefetch is limited to two low-priority images and respects data saving", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const canPrefetch = extractFunction(html, "canPrefetchMdPickImages", "drainMdPickImagePrefetchQueue");
  const drainQueue = extractFunction(html, "drainMdPickImagePrefetchQueue", "queueMdPickImagePrefetch");

  assert.match(html, /MD_PICK_IMAGE_PREFETCH_MAX_CONCURRENCY = 2/);
  assert.match(canPrefetch, /connection\?\.saveData/);
  assert.match(canPrefetch, /\^\(slow-\)\?2g\$/);
  assert.match(drainQueue, /mdPickImagePrefetchInFlight\.size < MD_PICK_IMAGE_PREFETCH_MAX_CONCURRENCY/);
  assert.match(drainQueue, /image\.fetchPriority = "low"/);
  assert.match(html, /onmouseenter="prefetchMdPickCountryImages/);
  assert.match(html, /onfocus="prefetchMdPickCountryImages/);
  assert.match(html, /ontouchstart="prefetchMdPickCountryImages/);
  assert.match(html, /onmouseenter="prefetchMdPickThemeImages/);
});

test("broken MD PICK and preference images use the shared visible fallback", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const fallback = extractFunction(html, "markGolfJoinImageFallback", "applyGolfJoinImageFallbacks");

  assert.match(fallback, /\.join-mdpick-thumb/);
  assert.match(fallback, /\.join-mdpick-theme-thumb/);
  assert.match(fallback, /box\.classList\.add\("is-image-fallback"\)/);
  assert.match(html, /document\.addEventListener\("error", \(event\) => \{/);
  assert.match(html, /markGolfJoinImageFallback\(event\.target\)/);
  assert.match(html, /\.join-mdpick-theme-thumb\.is-image-fallback::after/);
});
