"use strict";

const { test, expect } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = readLocalMainHtml();
const USE_DEPLOYED_HTML = process.env.GOLFJOIN_STAGE7_USE_DEPLOYED === "1";

function getHomeUrl() {
  return test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
}

function replaceEmbeddedGolfJoinHtml(shellHtml) {
  const marker = "<title>골프 조인 게시판</title>";
  const markerIndex = shellHtml.indexOf(marker);
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("stage7_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", "0");
  });
  if (USE_DEPLOYED_HTML) return;
  await page.route((url) => {
    const target = new URL(getHomeUrl());
    return url.origin === target.origin
      && url.pathname === target.pathname
      && url.searchParams.get("eventPlanSeq") === target.searchParams.get("eventPlanSeq");
  }, async (route) => {
    const response = await route.fetch();
    const shellHtml = await response.text();
    const headers = { ...response.headers(), "content-type": "text/html; charset=utf-8" };
    delete headers["content-length"];
    delete headers["content-encoding"];
    await route.fulfill({ status: response.status(), headers, body: replaceEmbeddedGolfJoinHtml(shellHtml) });
  });
});

test("one public schedule mutation only replaces related sections and preserves interaction state", async ({ page }) => {
  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.evaluate(() => getGolfJoinHomeDataV2Diagnostics()), {
    timeout: 60_000
  }).toEqual(expect.objectContaining({ state: "V2_RUNNING", rolloutEligible: true }));
  await expect.poll(() => page.locator("#joinSectionList [data-join-section]").count(), {
    timeout: 60_000
  }).toBeGreaterThan(0);
  expect(await page.evaluate(() => ({
    reconcile: typeof reconcileHomeJoinSectionList,
    capture: typeof captureHomeRenderInteractionState,
    restore: typeof restoreHomeRenderInteractionStateAfterLayout
  }))).toEqual({ reconcile: "function", capture: "function", restore: "function" });

  const result = await page.evaluate(async () => {
    const source = cloneGolfJoinHomeDataV2Value(pendingHomeBootstrapLightData || {});
    const summaries = Array.isArray(source.newScheduleSummaries) ? source.newScheduleSummaries : [];
    const targetIndex = summaries.findIndex((summary) => {
      const scheduleId = String(summary.scheduleId || "");
      const join = joins.find((item) => String(item.scheduleId || "") === scheduleId);
      return join && document.body.textContent.includes(String(join.title || summary.title || ""));
    });
    if (targetIndex < 0) throw new Error("stage7_visible_schedule_not_found");
    const targetTitle = String(summaries[targetIndex].title || "");

    const sectionList = document.getElementById("joinSectionList");
    const myJoinHost = document.getElementById("joinMyHomeSection");
    const mdPickHost = document.getElementById("joinMdPickSection");
    const beforeSections = new Map(
      Array.from(sectionList.querySelectorAll(":scope > [data-join-section]"))
        .map((node) => [node.dataset.joinSection, node])
    );
    const beforeMyNode = myJoinHost?.firstElementChild || null;
    const beforeMdPickNode = mdPickHost?.firstElementChild || null;
    const targetSection = Array.from(sectionList.querySelectorAll(":scope > [data-join-section]"))
      .find((node) => targetTitle && node.textContent.includes(targetTitle)) || null;
    const scrollGrid = targetSection?.querySelector(".join-grid") || null;
    if (scrollGrid && scrollGrid.scrollWidth > scrollGrid.clientWidth + 4) {
      const maxScroll = scrollGrid.scrollWidth - scrollGrid.clientWidth;
      // Simulate the middle of a user's horizontal drag. The browser's mandatory
      // snap is disabled only on this disposable diagnostic DOM so the second
      // card can be measured before the data mutation replaces the section.
      scrollGrid.style.scrollSnapType = "none";
      scrollGrid.style.scrollBehavior = "auto";
      scrollGrid.scrollLeft = Math.min(maxScroll, scrollGrid.clientWidth + 80);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    const scrollSectionKey = scrollGrid?.closest("[data-join-section]")?.dataset?.joinSection || "";
    const focusTarget = Array.from(sectionList.querySelectorAll("button, [tabindex]:not([tabindex='-1'])"))
      .find((node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden") || null;
    focusTarget?.focus({ preventScroll: true });
    const focusTextBefore = String(focusTarget?.textContent || "").trim();
    const scrollBefore = scrollGrid?.scrollLeft || 0;
    const scrollMaxBefore = scrollGrid
      ? Math.max(0, scrollGrid.scrollWidth - scrollGrid.clientWidth)
      : 0;
    const capturedTargetInteraction = targetSection
      ? captureHomeRenderInteractionState(targetSection)
      : null;

    let renderCount = 0;
    const originalRenderJoins = renderJoins;
    renderJoins = function observedStage7RenderJoins(...args) {
      renderCount += 1;
      return originalRenderJoins(...args);
    };

    const next = cloneGolfJoinHomeDataV2Value(source);
    next.serverTime = new Date(Date.now() + 60_000).toISOString();
    next.newScheduleSummaries[targetIndex] = {
      ...next.newScheduleSummaries[targetIndex],
      title: `${next.newScheduleSummaries[targetIndex].title || "일정"} [stage7-audit]`
    };
    const startedAt = performance.now();
    applyHomeBootstrapLightRows(next, { fromCache: false, render: true, source: "stage7-audit" });
    const getCurrentScrollLeft = () => (scrollSectionKey
      ? sectionList.querySelector(`:scope > [data-join-section="${scrollSectionKey}"] .join-grid`)?.scrollLeft || 0
      : 0);
    const scrollImmediate = getCurrentScrollLeft();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const scrollAfterOneFrame = getCurrentScrollLeft();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const elapsedMs = performance.now() - startedAt;

    const afterSections = new Map(
      Array.from(sectionList.querySelectorAll(":scope > [data-join-section]"))
        .map((node) => [node.dataset.joinSection, node])
    );
    const replacedSectionKeys = [...new Set([...beforeSections.keys(), ...afterSections.keys()])]
      .filter((key) => beforeSections.get(key) !== afterSections.get(key));
    const restoredScrollGrid = scrollSectionKey
      ? sectionList.querySelector(`:scope > [data-join-section="${scrollSectionKey}"] .join-grid`)
      : null;
    const scrollMaxAfter = restoredScrollGrid
      ? Math.max(0, restoredScrollGrid.scrollWidth - restoredScrollGrid.clientWidth)
      : 0;
    const scrollActiveIndexAfter = restoredScrollGrid
      ? getHomeRenderScrollActiveIndex(restoredScrollGrid)
      : -1;
    const scrollGeometryAfter = restoredScrollGrid ? {
      containerLeft: restoredScrollGrid.getBoundingClientRect().left,
      containerWidth: restoredScrollGrid.getBoundingClientRect().width,
      cards: Array.from(restoredScrollGrid.querySelectorAll(".join-card:not([hidden]):not([data-quick-carousel-clone='true'])"))
        .slice(0, 3)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, width: rect.width };
        })
    } : null;

    const focusedTextAfter = String(document.activeElement?.textContent || "").trim();
    const scrollHandlerSamples = [];
    for (let index = 0; index < 120; index += 1) {
      const sampleStartedAt = performance.now();
      updateBestSectionControls("overseas");
      scrollHandlerSamples.push(performance.now() - sampleStartedAt);
    }
    scrollHandlerSamples.sort((left, right) => left - right);
    const scrollHandlerP95Ms = scrollHandlerSamples[
      Math.min(scrollHandlerSamples.length - 1, Math.ceil(scrollHandlerSamples.length * 0.95) - 1)
    ];
    const navActiveSamples = [];
    for (let index = 0; index < 120; index += 1) {
      const sampleStartedAt = performance.now();
      updateJoinSectionNavActive();
      navActiveSamples.push(performance.now() - sampleStartedAt);
    }
    navActiveSamples.sort((left, right) => left - right);
    const navActiveP95Ms = navActiveSamples[
      Math.min(navActiveSamples.length - 1, Math.ceil(navActiveSamples.length * 0.95) - 1)
    ];
    return {
      renderCount,
      elapsedMs,
      sectionCount: afterSections.size,
      replacedSectionKeys,
      myJoinReplaced: beforeMyNode !== (myJoinHost?.firstElementChild || null),
      mdPickReplaced: beforeMdPickNode !== (mdPickHost?.firstElementChild || null),
      scrollSectionKey,
      scrollBefore,
      scrollMaxBefore,
      scrollMaxAfter,
      capturedTargetScrollStates: capturedTargetInteraction?.scrollStates || [],
      scrollActiveIndexAfter,
      scrollGeometryAfter,
      scrollImmediate,
      scrollAfterOneFrame,
      scrollAfter: restoredScrollGrid?.scrollLeft || 0,
      focusTextBefore,
      focusNodeReused: document.activeElement === focusTarget,
      focusPreserved: sectionList.contains(document.activeElement)
        && focusedTextAfter === focusTextBefore,
      focusedTagAfter: String(document.activeElement?.tagName || ""),
      focusInsideSectionListAfter: sectionList.contains(document.activeElement),
      scrollHandlerP95Ms,
      navActiveP95Ms
    };
  });

  console.log(`STAGE7_RENDER_AUDIT ${test.info().project.name} ${JSON.stringify(result)}`);
  expect(result.renderCount).toBe(1);
  expect(result.replacedSectionKeys.length).toBeGreaterThan(0);
  expect(result.mdPickReplaced).toBe(false);
  expect(result.focusPreserved).toBe(true);
  expect(result.scrollHandlerP95Ms).toBeLessThanOrEqual(4);
  expect(result.navActiveP95Ms).toBeLessThanOrEqual(4);
  if (result.scrollSectionKey && result.scrollBefore > 0) {
    const expectedActiveIndex = result.capturedTargetScrollStates[0]?.activeIndex ?? -1;
    expect(result.scrollAfter).toBeGreaterThanOrEqual(0);
    expect(result.scrollAfter).toBeLessThanOrEqual(result.scrollMaxAfter);
    expect(result.scrollActiveIndexAfter).toBe(expectedActiveIndex);
  }
});
