"use strict";

const { test, expect } = require("@playwright/test");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const RUNS = Math.max(1, Number(process.env.GOLFJOIN_INP_RUNS) || 3);

function getHomeUrl() {
  return test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
}

function percentile(values, percentileValue) {
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[index];
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("golfjoin_home_data_v2_rollout_bucket_v1", "0");
  });
});

test("deployed selective schedule update has an interaction p75 at or below 200ms", async ({ page }) => {
  const samples = [];
  for (let run = 1; run <= RUNS; run += 1) {
    await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator("#secret-golf-join")).toBeVisible();
    await expect.poll(() => page.evaluate(() => getGolfJoinHomeDataV2Diagnostics()), {
      timeout: 60_000
    }).toEqual(expect.objectContaining({ state: "V2_RUNNING", rolloutEligible: true }));
    await expect.poll(() => page.locator("#joinSectionList [data-join-section]").count(), {
      timeout: 60_000
    }).toBeGreaterThan(0);

    const prepared = await page.evaluate((runNumber) => {
      const source = cloneGolfJoinHomeDataV2Value(pendingHomeBootstrapLightData || {});
      const summaries = Array.isArray(source.newScheduleSummaries) ? source.newScheduleSummaries : [];
      const targetIndex = summaries.findIndex((summary) => {
        const scheduleId = String(summary.scheduleId || "");
        const join = joins.find((item) => String(item.scheduleId || "") === scheduleId);
        return join && document.body.textContent.includes(String(join.title || summary.title || ""));
      });
      if (targetIndex < 0) return { ok: false, reason: "visible_schedule_not_found" };

      window.__stage7InpEntries = [];
      window.__stage7InpRendered = false;
      window.__stage7InpRenderCount = 0;
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.interactionId) return;
          window.__stage7InpEntries.push({
            name: entry.name,
            duration: entry.duration,
            interactionId: entry.interactionId,
            startTime: entry.startTime
          });
        });
      });
      observer.observe({ type: "event", buffered: true, durationThreshold: 16 });
      window.__stage7InpObserver = observer;

      const originalRenderJoins = renderJoins;
      renderJoins = function measuredStage7RenderJoins(...args) {
        window.__stage7InpRenderCount += 1;
        return originalRenderJoins(...args);
      };

      const next = cloneGolfJoinHomeDataV2Value(source);
      next.serverTime = new Date(Date.now() + runNumber * 60_000).toISOString();
      next.newScheduleSummaries[targetIndex] = {
        ...next.newScheduleSummaries[targetIndex],
        title: `${next.newScheduleSummaries[targetIndex].title || "일정"} [stage7-inp-${runNumber}]`
      };

      const button = document.createElement("button");
      button.id = "stage7DeployedInpProbe";
      button.type = "button";
      button.textContent = "Stage 7 INP probe";
      Object.assign(button.style, {
        position: "fixed",
        left: "12px",
        top: "100px",
        zIndex: "2147483647",
        width: "180px",
        height: "44px"
      });
      button.addEventListener("click", () => {
        window.__stage7InpInteractionStartedAt = performance.now();
        applyHomeBootstrapLightRows(next, {
          fromCache: false,
          render: true,
          source: `stage7-inp-${runNumber}`
        });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          window.__stage7InpRendered = true;
        }));
      }, { once: true });
      document.body.appendChild(button);
      return { ok: true };
    }, run);
    expect(prepared).toEqual({ ok: true });

    await page.locator("#stage7DeployedInpProbe").click();
    await expect.poll(() => page.evaluate(() => window.__stage7InpRendered), {
      timeout: 10_000
    }).toBe(true);
    await page.waitForTimeout(250);

    const sample = await page.evaluate(() => {
      window.__stage7InpObserver?.takeRecords?.().forEach((entry) => {
        if (!entry.interactionId) return;
        window.__stage7InpEntries.push({
          name: entry.name,
          duration: entry.duration,
          interactionId: entry.interactionId,
          startTime: entry.startTime
        });
      });
      window.__stage7InpObserver?.disconnect?.();
      const startedAt = Number(window.__stage7InpInteractionStartedAt || 0);
      const entries = (window.__stage7InpEntries || [])
        .filter((entry) => entry.startTime >= startedAt - 50);
      const durationMs = entries.length
        ? Math.max(...entries.map((entry) => Number(entry.duration) || 0))
        : 16;
      return {
        durationMs,
        belowObserverThreshold: entries.length === 0,
        renderCount: window.__stage7InpRenderCount,
        entries
      };
    });
    expect(sample.renderCount).toBe(1);
    samples.push(sample);
  }

  const durations = samples.map((sample) => sample.durationMs);
  const p75Ms = percentile(durations, 0.75);
  console.log("STAGE7_DEPLOYED_INP", test.info().project.name, JSON.stringify({
    durations,
    p75Ms,
    samples
  }));
  expect(p75Ms).toBeLessThanOrEqual(200);
});
