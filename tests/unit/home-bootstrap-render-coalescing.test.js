"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function getFunctionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const next = source.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} not found`);
  assert.notEqual(next, -1, `${nextName} boundary not found`);
  return source.slice(start, next);
}

test("embedded board shell is normalized before the first inline stylesheet can paint", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const earlyNormalizeIndex = html.indexOf("normalizeEmbeddedBoardShellBeforeFirstPaint");
  const firstStyleIndex = html.indexOf("<style>");
  const rootMarkupIndex = html.indexOf('<div id="secret-golf-join"');
  const fallbackNormalizeIndex = html.indexOf("function normalizeEmbeddedBoardContainer");

  assert.notEqual(earlyNormalizeIndex, -1, "early board-shell normalization not found");
  assert.ok(earlyNormalizeIndex < firstStyleIndex, "normalization must run before the first stylesheet");
  assert.ok(earlyNormalizeIndex < rootMarkupIndex, "normalization must run before the embedded home markup");
  assert.ok(fallbackNormalizeIndex > rootMarkupIndex, "the idempotent late fallback must remain available");
  assert.match(
    html.slice(earlyNormalizeIndex, firstStyleIndex),
    /document\.currentScript[\s\S]*?sgj-board-host[\s\S]*?sgj-board-root[\s\S]*?sgj-board-page/
  );
});

test("section navigation skips full-page layout reads at the initial scroll position", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const block = getFunctionBlock(
    html,
    "updateJoinSectionNavActive",
    "scheduleJoinSectionNavActiveUpdate"
  );
  const topFastPathIndex = block.indexOf("currentScrollY <= 1");
  const fixedLayoutIndex = block.indexOf("updateJoinSectionNavFixed()");
  const sectionRectIndex = block.indexOf("section.getBoundingClientRect()");

  assert.notEqual(topFastPathIndex, -1, "initial-scroll fast path not found");
  assert.ok(topFastPathIndex < fixedLayoutIndex, "the fast path must return before fixed-nav layout reads");
  assert.ok(topFastPathIndex < sectionRectIndex, "the fast path must return before section layout reads");
  assert.match(block, /joinSectionNavLastScrollY = currentScrollY;[\s\S]*?return;[\s\S]*?updateJoinSectionNavFixed\(\)/);
});

test("startup bootstrap applies rows without an immediate duplicate full home render", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const hydrateBlock = getFunctionBlock(
    html,
    "hydrateHomeBootstrapLightFromGoogleSheet",
    "waitForHomeBootstrapBeforeSecondaryHydration"
  );
  const initializeStart = html.indexOf("async function initializeGolfJoinHome");
  const initializeEnd = html.indexOf("initializeGolfJoinHome().catch", initializeStart + 1);
  assert.notEqual(initializeStart, -1, "initializeGolfJoinHome not found");
  assert.notEqual(initializeEnd, -1, "initializeGolfJoinHome boundary not found");
  const initializeBlock = html.slice(initializeStart, initializeEnd);
  const homeProductsBlock = getFunctionBlock(
    html,
    "ensureHomeGolfJoinProductsLoaded",
    "getHomeProductSource"
  );

  assert.match(hydrateBlock, /options = \{\}/);
  assert.match(hydrateBlock, /render:\s*options\.render/);
  assert.match(homeProductsBlock, /options = \{\}/);
  assert.equal((homeProductsBlock.match(/options\.renderHome !== false/g) || []).length, 2);
  assert.match(initializeBlock, /ensureHomeGolfJoinProductsLoaded\(\{ renderHome: false \}\)/);
  assert.match(initializeBlock, /hydrateHomeBootstrapLightFromGoogleSheet\(\{ render: false \}\)/);
  const productsStartIndex = initializeBlock.indexOf("const homeProductsPromise");
  const localSnapshotRenderIndex = initializeBlock.indexOf("renderJoins({ skipQuickMobileCarousel: true });");
  assert.notEqual(localSnapshotRenderIndex, -1, "startup local snapshot render not found");
  assert.ok(
    localSnapshotRenderIndex < productsStartIndex,
    "the local snapshot must render before network product loading starts"
  );
  assert.doesNotMatch(
    initializeBlock.slice(0, productsStartIndex),
    /scheduleHomeRender\(\);/,
    "startup must not leave its local snapshot on the idle full-render scheduler"
  );
  assert.match(initializeBlock, /golfjoin:duration:home-local-render/);
  assert.match(
    initializeBlock,
    /Promise\.all\(\[homeProductsPromise, bootstrapPromise\]\)[\s\S]*?scheduleHomeRender\(\{ deferWhileModalOpen: true \}\)/
  );
  assert.match(initializeBlock, /void initialHomeDataRenderPromise/);
});

test("anonymous home rendering skips member-only schedule identity scans", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const cookieBlock = getFunctionBlock(html, "getRenderedCookieDataString", "parseJoinCookieData");
  const myItemsBlock = getFunctionBlock(html, "getMyHomeJoinItems", "getQuickDeadlineItems");
  const sectionsBlock = getFunctionBlock(html, "getHomeJoinSections", "hasActiveJoinScheduleItems");

  assert.match(cookieBlock, /renderedCookieDataStringCache !== undefined/);
  assert.match(cookieBlock, /if \(match\)[\s\S]*renderedCookieDataStringCache = `CookieData/);
  assert.match(cookieBlock, /renderedCookieDataStringScannedWhileLoading/);
  assert.match(cookieBlock, /DOMContentLoaded/);
  assert.match(html, /await waitForRenderedCookieDataReady\(\);[\s\S]*scheduleJoinMyMemberPreload\(\);/);
  assert.match(myItemsBlock, /if \(!getJoinWishMemberKey\(\)\) return \[\];/);
  assert.match(sectionsBlock, /const currentMemberKey = getJoinWishMemberKey\(\);/);
  assert.match(
    sectionsBlock,
    /const scheduleItems = currentMemberKey\s*\? upcomingScheduleItems\.filter\(isHomeJoinScheduleVisibleForCurrentMember\)\s*:\s*upcomingScheduleItems;/
  );
});

test("server-rendered CookieData scans the document only once per navigation", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const cacheStart = html.indexOf("let renderedCookieDataStringCache;");
  const cacheEnd = html.indexOf("function parseJoinCookieData", cacheStart + 1);
  assert.notEqual(cacheStart, -1, "rendered cookie cache declaration not found");
  assert.notEqual(cacheEnd, -1, "rendered cookie cache boundary not found");

  let documentHtmlReads = 0;
  const context = vm.createContext({
    document: {
      documentElement: {
        get innerHTML() {
          documentHtmlReads += 1;
          return "<script>CookieData(userSeq=30002047,userId=test-member)</script>";
        }
      }
    }
  });
  vm.runInContext(html.slice(cacheStart, cacheEnd), context);

  assert.equal(
    vm.runInContext("getRenderedCookieDataString()", context),
    "CookieData(userSeq=30002047,userId=test-member)"
  );
  assert.equal(
    vm.runInContext("getRenderedCookieDataString()", context),
    "CookieData(userSeq=30002047,userId=test-member)"
  );
  assert.equal(documentHtmlReads, 1);
});

test("a CookieData marker parsed after the embedded script is rescanned once after DOM ready", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const cacheStart = html.indexOf("let renderedCookieDataStringCache;");
  const cacheEnd = html.indexOf("function parseJoinCookieData", cacheStart + 1);
  assert.notEqual(cacheStart, -1, "rendered cookie cache declaration not found");
  assert.notEqual(cacheEnd, -1, "rendered cookie cache boundary not found");

  let documentHtmlReads = 0;
  let documentHtml = "<div>event page is still parsing</div>";
  let readyState = "loading";
  let domContentLoaded;
  const context = vm.createContext({
    document: {
      get readyState() {
        return readyState;
      },
      documentElement: {
        get innerHTML() {
          documentHtmlReads += 1;
          return documentHtml;
        }
      },
      addEventListener(name, listener) {
        if (name === "DOMContentLoaded") domContentLoaded = listener;
      }
    }
  });
  vm.runInContext(html.slice(cacheStart, cacheEnd), context);

  assert.equal(vm.runInContext("getRenderedCookieDataString()", context), "");
  assert.equal(vm.runInContext("getRenderedCookieDataString()", context), "");
  assert.equal(documentHtmlReads, 1, "a loading-time miss must not rescan per card");
  assert.equal(typeof domContentLoaded, "function");

  documentHtml = "<div>CookieData(userSeq=30002047,userId=late-member)</div>";
  readyState = "interactive";
  domContentLoaded();

  assert.equal(
    vm.runInContext("getRenderedCookieDataString()", context),
    "CookieData(userSeq=30002047,userId=late-member)"
  );
  assert.equal(
    vm.runInContext("getRenderedCookieDataString()", context),
    "CookieData(userSeq=30002047,userId=late-member)"
  );
  assert.equal(documentHtmlReads, 2, "DOM-ready CookieData must be scanned exactly once");
});
