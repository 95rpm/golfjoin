"use strict";

const { test, expect } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = readLocalMainHtml();

function replaceEmbeddedGolfJoinHtml(shellHtml) {
  const marker = "<title>골프 조인 게시판</title>";
  const markerIndex = shellHtml.indexOf(marker);
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("candidate_production_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

test("local candidate requests its first MD PICK image within 100ms inside the production shell", async ({ page }) => {
  const homeUrl = test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    window.__golfJoinThemeFirstCardCount = null;
    window.__golfJoinCandidateLayoutShifts = [];
    try {
      const layoutShiftObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput && Number(entry.value) > 0) {
            window.__golfJoinCandidateLayoutShifts.push({
              startTime: entry.startTime,
              value: entry.value
            });
          }
        });
      });
      layoutShiftObserver.observe({ type: "layout-shift", buffered: true });
    } catch (_error) {
      // Chromium supports layout-shift; keep the diagnostic non-blocking elsewhere.
    }
    const observeFirstThemeCards = () => {
      const observer = new MutationObserver(() => {
        if (window.__golfJoinThemeFirstCardCount !== null) return;
        if (!performance.getEntriesByName("golfjoin:mdpick:data-ready").length) return;
        const count = document.querySelectorAll("#join-section-mdpick-theme .join-mdpick-theme-card").length;
        if (count > 0) {
          window.__golfJoinThemeFirstCardCount = count;
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) observeFirstThemeCards();
    else document.addEventListener("DOMContentLoaded", observeFirstThemeCards, { once: true });
  });
  await page.route((url) => {
    const target = new URL(homeUrl);
    return url.origin === target.origin
      && url.pathname === target.pathname
      && url.searchParams.get("eventPlanSeq") === target.searchParams.get("eventPlanSeq");
  }, async (route) => {
    const response = await route.fetch();
    const shellHtml = await response.text();
    const body = replaceEmbeddedGolfJoinHtml(shellHtml);
    await route.fulfill({
      response,
      body,
      headers: { ...response.headers(), "content-type": "text/html; charset=utf-8" }
    });
  });

  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    typeof scheduleMdPickSectionRenderWhenDataReady
  )), { timeout: 30_000 }).toBe("function");
  await expect.poll(() => page.locator("#joinMdPickSection .join-mdpick-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => {
    const dataReady = window.getGolfJoinPerformanceSnapshot?.()
      .find((entry) => entry.name === "golfjoin:mdpick:data-ready");
    const imagePaths = new Set([...document.querySelectorAll("#joinMdPickSection .join-mdpick-card img")]
      .map((image) => image.currentSrc || image.getAttribute("src") || "")
      .filter(Boolean)
      .map((url) => new URL(url, location.href).pathname));
    const request = window.performance.getEntriesByType("resource")
      .filter((entry) => imagePaths.has(new URL(entry.name).pathname))
      .sort((a, b) => a.startTime - b.startTime)[0];
    return request && dataReady ? Math.max(0, request.startTime - dataReady.startTime) : null;
  }), { timeout: 60_000 }).not.toBeNull();

  const timing = await page.evaluate(() => {
    const snapshot = window.getGolfJoinPerformanceSnapshot();
    const productsReady = snapshot
      .find((entry) => entry.name === "golfjoin:boot:products-ready");
    const dataReady = snapshot
      .find((entry) => entry.name === "golfjoin:mdpick:data-ready");
    const primaryRenderStart = snapshot
      .find((entry) => entry.name === "golfjoin:mdpick:primary-render-start");
    const primaryDomReady = snapshot
      .find((entry) => entry.name === "golfjoin:mdpick:primary-dom-ready");
    const imagePaths = new Set([...document.querySelectorAll("#joinMdPickSection .join-mdpick-card img")]
      .map((image) => image.currentSrc || image.getAttribute("src") || "")
      .filter(Boolean)
      .map((url) => new URL(url, location.href).pathname));
    const request = window.performance.getEntriesByType("resource")
      .filter((entry) => imagePaths.has(new URL(entry.name).pathname))
      .sort((a, b) => a.startTime - b.startTime)[0];
    const rawDataReadyToRequest = request.startTime - dataReady.startTime;
    return {
      productsReadyToRequest: request.startTime - productsReady.startTime,
      rawDataReadyToRequest,
      dataReadyToRequest: Math.max(0, rawDataReadyToRequest),
      dataReadyToRenderStart: primaryRenderStart.startTime - dataReady.startTime,
      primaryRenderToDom: primaryDomReady.startTime - primaryRenderStart.startTime,
      primaryDomToRequest: request.startTime - primaryDomReady.startTime,
      dataToDomMeasureCount: snapshot.filter((entry) => (
        entry.name === "golfjoin:duration:mdpick-data-to-dom"
      )).length
    };
  });
  await test.info().attach("mdpick-timing.json", {
    body: Buffer.from(JSON.stringify(timing, null, 2)),
    contentType: "application/json"
  });
  expect(timing.dataReadyToRequest).toBeGreaterThanOrEqual(0);
  expect(timing.dataReadyToRequest, JSON.stringify(timing)).toBeLessThanOrEqual(100);
  expect(timing.dataToDomMeasureCount).toBe(1);
  await expect(page.locator("#joinMdPickSection .join-mdpick-card img").first()).toHaveAttribute("loading", "eager");
  if (test.info().project.name === "mobile-chrome") {
    await page.waitForTimeout(1_000);
    const mobileCls = await page.evaluate(() => (
      window.__golfJoinCandidateLayoutShifts
        .reduce((sum, entry) => sum + Number(entry.value || 0), 0)
    ));
    expect(mobileCls, `candidate mobile CLS: ${mobileCls}`).toBeLessThanOrEqual(0.1);
  }
  const initialNavFastPath = await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    const mdPickSection = document.querySelector('[data-join-section="mdpick"]');
    const myButton = document.querySelector('#joinSectionNav [data-join-section-target="my"]');
    const syntheticMySection = document.createElement("section");
    syntheticMySection.id = "join-section-my-fast-path-test";
    syntheticMySection.dataset.joinSection = "my";
    mdPickSection?.before(syntheticMySection);
    if (myButton) {
      myButton.hidden = false;
      myButton.style.display = "";
    }
    joinSectionNavActiveKey = "";
    updateJoinSectionNavActive();
    const state = {
      myActive: Boolean(myButton?.classList.contains("active")),
      myCurrent: myButton?.getAttribute("aria-current") || "",
      navFixed: Boolean(document.getElementById("joinSectionNav")?.classList.contains("is-fixed"))
    };
    syntheticMySection.remove();
    if (myButton) {
      myButton.hidden = true;
      myButton.style.display = "none";
    }
    joinSectionNavActiveKey = "";
    updateJoinSectionNavActive();
    return state;
  });
  expect(initialNavFastPath).toEqual({ myActive: true, myCurrent: "true", navFixed: false });
  await expect(page.locator("#joinSectionNav [data-join-section-target='mdpick']")).toBeVisible();
  const deferredTheme = page.locator("#joinMdPickSection [data-mdpick-theme-deferred]");
  if (await deferredTheme.count()) {
    await deferredTheme.scrollIntoViewIfNeeded();
  }
  await expect.poll(() => page.locator("#join-section-mdpick-theme .join-mdpick-theme-card").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  await page.evaluate(() => stopMdPickThemeAutoSlide());
  await expect.poll(() => page.evaluate(() => window.__golfJoinThemeFirstCardCount)).toBe(3);
  await expect(page.locator("#join-section-mdpick-theme [data-mdpick-theme-group].active .join-mdpick-theme-card")).toHaveCount(3);

  const nextTheme = await page.evaluate(() => {
    const themes = getVisibleMdPickThemes();
    const activeKey = document.querySelector("#join-section-mdpick-theme [data-mdpick-theme-group].active")
      ?.dataset?.mdpickThemeGroup || "";
    const theme = themes.find((item) => item.key !== activeKey);
    return theme ? {
      key: theme.key,
      images: theme.items.map((product) => product.image || product.thumb || "").filter(Boolean)
    } : null;
  });
  expect(nextTheme).not.toBeNull();
  await page.evaluate(({ key, images }) => {
    images.forEach((url) => mdPickImagePrefetchUrls.delete(url));
    const tab = [...document.querySelectorAll("#join-section-mdpick-theme .join-mdpick-theme-tab")]
      .find((button) => (button.getAttribute("onclick") || "").includes(`'${key}'`));
    tab?.dispatchEvent(new MouseEvent("mouseenter"));
  }, nextTheme);
  await expect.poll(() => page.evaluate(({ images }) => (
    images.length > 0 && images.every((url) => mdPickImagePrefetchUrls.has(url))
  ), nextTheme)).toBe(true);

  await page.evaluate(({ key }) => setMdPickTheme(key), nextTheme);
  await expect(page.locator(`#join-section-mdpick-theme [data-mdpick-theme-group="${nextTheme.key}"].active .join-mdpick-theme-card`)).toHaveCount(3);

  const brokenThemeImage = page.locator(`#join-section-mdpick-theme [data-mdpick-theme-group="${nextTheme.key}"] .join-mdpick-theme-thumb img`).first();
  await brokenThemeImage.evaluate((image) => {
    image.src = "data:image/png;base64,broken-image";
  });
  await expect(brokenThemeImage.locator("..")).toHaveClass(/is-image-fallback/);

  const brokenPrimaryImage = page.locator("#joinMdPickSection .join-mdpick-card .join-mdpick-thumb img").first();
  await brokenPrimaryImage.evaluate((image) => {
    image.src = "data:image/png;base64,broken-image";
  });
  await expect(brokenPrimaryImage.locator("..")).toHaveClass(/is-image-fallback/);
  await expect(page.locator("#joinSectionNav [data-join-section-target='mdpick-theme']")).toBeVisible();
});
