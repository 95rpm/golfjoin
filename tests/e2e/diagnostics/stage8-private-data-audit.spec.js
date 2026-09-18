"use strict";

const { test, expect } = require("@playwright/test");
const { readLocalMainHtml } = require("../support/local-main-html");

const DESKTOP_HOME_URL = process.env.GOLFJOIN_E2E_URL
  || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const MOBILE_HOME_URL = process.env.GOLFJOIN_E2E_MOBILE_URL
  || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const LOCAL_MAIN_HTML = readLocalMainHtml();
const USE_DEPLOYED_HTML = process.env.GOLFJOIN_STAGE8_USE_DEPLOYED === "1";
const SYNTHETIC_MEMBER = Object.freeze({
  memberSeq: "39999998",
  memberId: "stage8_member",
  memberName: "STAGE8_MEMBER"
});

function getHomeUrl() {
  return test.info().project.name === "mobile-chrome" ? MOBILE_HOME_URL : DESKTOP_HOME_URL;
}

function replaceEmbeddedGolfJoinHtml(shellHtml) {
  const markerIndex = shellHtml.indexOf("normalizeEmbeddedBoardShellBeforeFirstPaint");
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) {
    throw new Error("stage8_shell_boundary_not_found");
  }
  return `${shellHtml.slice(0, startIndex)}${LOCAL_MAIN_HTML}${shellHtml.slice(closingIndex + 7)}`;
}

test("same-member private reads coalesce, run in parallel and reuse public bootstrap rows", async ({ page }) => {
  const calls = {
    builderPublic: 0,
    builderMember: 0,
    joinMember: 0,
    wishes: 0
  };
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.clear();
    sessionStorage.clear();
    // Keep the application's deferred private hydration queued. This diagnostic
    // invokes the same functions explicitly after the public bootstrap is ready.
    window.requestIdleCallback = () => 1;
    window.cancelIdleCallback = () => {};
  });

  const homeUrl = new URL(getHomeUrl());
  await page.route((url) => (
    url.origin === homeUrl.origin
    && url.pathname === homeUrl.pathname
    && url.searchParams.get("eventPlanSeq") === homeUrl.searchParams.get("eventPlanSeq")
  ), async (route) => {
    const response = await route.fetch();
    const shellHtml = await response.text();
    const candidateHtml = USE_DEPLOYED_HTML ? shellHtml : replaceEmbeddedGolfJoinHtml(shellHtml);
    if (USE_DEPLOYED_HTML && (
      !candidateHtml.includes("joinPrivateRequestRegistry")
      || !candidateHtml.includes("function runJoinPrivateRequestOnce")
      || !candidateHtml.includes("Promise.allSettled(privateRefreshes)")
    )) {
      throw new Error("stage8_deployed_private_optimization_not_found");
    }
    const memberMarker = `<div hidden>CookieData(userSeq=${SYNTHETIC_MEMBER.memberSeq},userId=${SYNTHETIC_MEMBER.memberId},userNm=${SYNTHETIC_MEMBER.memberName},userChnCd=E2E)</div>`;
    const headers = { ...response.headers(), "content-type": "text/html; charset=utf-8" };
    delete headers["content-length"];
    delete headers["content-encoding"];
    await route.fulfill({
      status: response.status(),
      headers,
      body: candidateHtml.replace("</body>", `${memberMarker}</body>`)
    });
  });

  await page.route("**/golfjoin-sheet-api?**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("action") || "";
    const sheet = url.searchParams.get("sheet") || "";
    const hasMemberLookup = ["memberKey", "memberSeq", "memberId", "memberMobile", "memberEmail"]
      .some((key) => Boolean(url.searchParams.get(key)));
    if (action === "home_bootstrap_light") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          serverTime: new Date().toISOString(),
          newScheduleSummaries: [],
          participantSummaries: [],
          displayRules: []
        })
      });
      return;
    }
    if (action === "home_stats") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }
    if (action === "join_wishes_lookup") calls.wishes += 1;
    if (sheet === "new_schedule_applications") {
      if (hasMemberLookup) calls.builderMember += 1;
      else calls.builderPublic += 1;
    }
    if (sheet === "join_applications" && hasMemberLookup) calls.joinMember += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(action ? { rows: [] } : { rows: [] })
    });
  });

  await page.goto(getHomeUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#secret-golf-join")).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    login: getJoinLoginState().isLogin,
    authoritative: homeBootstrapLightAuthoritativeApplied
  })), { timeout: 60_000 }).toEqual({ login: true, authoritative: true });

  const startedAt = Date.now();
  const result = await page.evaluate(async () => {
    const member = getJoinCachedCurrentMember();
    const [builderA, builderB, joinA, joinB, wishesA, wishesB] = await Promise.all([
      hydrateBuilderApplicationJoinsFromGoogleSheet({ renderStart: false, renderHome: false }),
      hydrateBuilderApplicationJoinsFromGoogleSheet({ renderStart: false, renderHome: false }),
      hydrateJoinApplicationsFromGoogleSheet({ renderStart: false, renderHome: false }),
      hydrateJoinApplicationsFromGoogleSheet({ renderStart: false, renderHome: false }),
      hydrateJoinWishesFromGoogleSheet({ force: true }),
      hydrateJoinWishesFromGoogleSheet({ force: true })
    ]);
    const menuStartedAt = performance.now();
    const menuPromise = openJoinMyMenu({ member, skipProfileCheck: true });
    const menuImmediateMs = performance.now() - menuStartedAt;
    const menuVisible = Boolean(document.getElementById("joinMyMenuModal")?.classList.contains("open"));
    const menuHasContent = Boolean(document.getElementById("joinMyMenuBody")?.children.length);
    await menuPromise;
    closeJoinMyMenu();

    const memberKey = getJoinWishMemberKey(member);
    const cacheMetadata = [
      GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY,
      GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY,
      GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY
    ].map((key) => {
      const cached = JSON.parse(localStorage.getItem(key) || "null");
      return {
        key,
        memberMatches: String(cached?.memberKey || "") === memberKey,
        hasGeneration: Number.isFinite(Number(cached?.sessionGeneration)),
        dataTypeMatches: String(cached?.dataType || "") === key
      };
    });
    return {
      sameBuilderPromiseResult: builderA === builderB,
      sameJoinPromiseResult: joinA === joinB,
      sameWishPromiseResult: wishesA === wishesB,
      registrySize: joinPrivateRequestRegistry.size,
      menuImmediateMs,
      menuVisible,
      menuHasContent,
      cacheMetadata
    };
  });
  const elapsedMs = Date.now() - startedAt;

  console.log("STAGE8_PRIVATE_AUDIT", test.info().project.name, JSON.stringify({
    calls,
    elapsedMs,
    result
  }));
  expect(calls).toEqual({
    builderPublic: 0,
    builderMember: 1,
    joinMember: 1,
    wishes: 1
  });
  expect(elapsedMs).toBeLessThan(750);
  expect(result).toEqual(expect.objectContaining({
    sameBuilderPromiseResult: true,
    sameJoinPromiseResult: true,
    sameWishPromiseResult: true,
    registrySize: 0,
    menuVisible: true,
    menuHasContent: true
  }));
  expect(result.menuImmediateMs).toBeLessThanOrEqual(100);
  expect(result.cacheMetadata).toEqual([
    expect.objectContaining({ memberMatches: true, hasGeneration: true, dataTypeMatches: true }),
    expect.objectContaining({ memberMatches: true, hasGeneration: true, dataTypeMatches: true }),
    expect.objectContaining({ memberMatches: true, hasGeneration: true, dataTypeMatches: true })
  ]);
});
