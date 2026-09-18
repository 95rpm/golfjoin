"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SOURCE_PATH = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/sections/38-home-sections.js"
);
const SOURCE = fs.readFileSync(SOURCE_PATH, "utf8");

test("home rendering reconciles keyed sections and preserves interaction state", () => {
  assert.match(SOURCE, /function captureHomeRenderInteractionState\(container\)/);
  assert.match(SOURCE, /function restoreHomeRenderInteractionState\(container, state, options = \{\}\)/);
  assert.match(SOURCE, /function reconcileHomeJoinSectionList\(container, html, options = \{\}\)/);
  assert.match(SOURCE, /lastRenderedJoinSectionFingerprints\.get\(entry\.key\) !== entry\.fingerprint/);
  assert.match(
    SOURCE,
    /joinSectionListChanged = reconcileHomeJoinSectionList\(sectionList, sectionListHtml, \{\s*resetSoonRail: options\.resetSoonRail === true\s*\}\)/
  );
  assert.doesNotMatch(
    SOURCE,
    /if \(lastRenderedJoinSectionListHtml !== sectionListHtml\) \{\s*sectionList\.innerHTML = sectionListHtml/
  );
});

test("home interaction snapshot includes horizontal scroll and keyboard focus", () => {
  assert.match(SOURCE, /left: node\.scrollLeft \|\| 0/);
  assert.match(SOURCE, /focusableNodes\.indexOf\(document\.activeElement\)/);
  assert.match(SOURCE, /node\.scrollLeft = Number\(left\) \|\| 0/);
  assert.match(SOURCE, /\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(SOURCE, /restoreHomeRenderInteractionStateAfterLayout\(container, state\)/);
  assert.match(SOURCE, /activeIndex: getHomeRenderScrollActiveIndex\(node\)/);
  assert.match(SOURCE, /function alignHomeRenderScrollActiveItem\(container, activeIndex\)/);
  assert.match(SOURCE, /\{ focus: false, alignActive: true \}/);
});

test("deferred home rendering splits member and remaining sections across separate frames", () => {
  assert.match(SOURCE, /const renderMySectionFirst = \(\) =>/);
  assert.match(SOURCE, /renderMyJoinSectionInPlace\(\{ updateNavigation: false \}\)/);
  assert.match(SOURCE, /window\.requestIdleCallback\(renderRemainingSections, \{ timeout: 700 \}\)/);
  assert.match(SOURCE, /skipMyJoinSection: true/);
  assert.match(SOURCE, /memberScopesAlreadySynced: true/);
});

test("member-only rendering avoids rebuilding unchanged markup and full section discovery", () => {
  assert.match(SOURCE, /const changed = lastRenderedMyJoinSectionHtml !== html/);
  assert.match(SOURCE, /if \(changed\) replaceHomeRenderHtml\(host, html\)/);
  assert.match(SOURCE, /function updateMyJoinSectionNavVisibility\(\)/);
  assert.doesNotMatch(
    SOURCE,
    /function renderMyJoinSectionInPlace\(options = \{\}\)[\s\S]*?updateJoinSectionNavVisibility\(getHomeJoinSections\(\)/
  );
});

test("post-render geometry reads wait until the browser has completed a paint", () => {
  assert.match(
    SOURCE,
    /function scheduleHomeSlideDotsRefresh\(\)[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?homeSlideDotsRefreshFrame = requestAnimationFrame\(\(\) => \{[\s\S]*?updateQuickSectionControls\(\)/
  );
  assert.match(
    SOURCE,
    /function scheduleQuickMobileCarouselSetup\(\)[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?quickMobileCarouselSetupFrame = requestAnimationFrame\(\(\) => \{[\s\S]*?setupQuickMobileCarousel\(\)/
  );
  assert.match(
    SOURCE,
    /if \(quickMobileCarouselSetupPending && !options\.skipQuickMobileCarousel\) \{\s*scheduleQuickMobileCarouselSetup\(\)/
  );
  assert.doesNotMatch(
    SOURCE,
    /if \(quickMobileCarouselSetupPending && !options\.skipQuickMobileCarousel\) \{\s*setupQuickMobileCarousel\(\)/
  );
});
