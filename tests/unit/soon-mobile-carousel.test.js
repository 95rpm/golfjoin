"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const SECTION_SOURCE = read("src/golfjoin-main/source/scripts/sections/38-home-sections.js");
const DETAIL_SOURCE = read("src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js");
const CSS_SOURCE = read("src/golfjoin-main/source/styles/10-main.css");

test("곧 출발해요 모바일 탭은 전체 상품을 스와이프 레일로 제공한다", () => {
  assert.match(
    DETAIL_SOURCE,
    /function getSoonDisplayItems\(items\) \{[\s\S]*?if \(isSoonMobilePagedLayout\(\)\) return filteredItems;/
  );
  assert.match(
    SECTION_SOURCE,
    /function renderSoonMoreButton\(visibleCount, totalCount\) \{\s*if \(isMobileSlideDotsViewport\(\) \|\| visibleCount >= totalCount\) return "";/
  );
});

test("곧 출발해요는 해외골프 BEST와 같은 공통 도트와 스크롤 동기화를 사용한다", () => {
  assert.match(SECTION_SOURCE, /function isHomeJoinCardRailKey\(key\) \{\s*return key === "soon" \|\| isBestJoinSectionKey\(key\);/);
  assert.match(SECTION_SOURCE, /updateBestSectionControls\("soon"\);/);
  assert.match(SECTION_SOURCE, /isHomeJoinCardRailKey\(section\.key\) && displayItems\.length \? renderSlideDots\(section\.key\)/);
  assert.match(SECTION_SOURCE, /isHomeJoinCardRailKey\(section\.key\) \? ` onscroll="updateBestSectionControls\('\$\{section\.key\}'\)"`/);
});

test("곧 출발해요 모바일 기간 탭을 바꾸면 새 탭의 첫 카드와 첫 도트에서 시작한다", () => {
  assert.match(
    SECTION_SOURCE,
    /function setSoonRangeFilter\(key\) \{[\s\S]*?const resetSoonRail = isMobileSlideDotsViewport\(\);[\s\S]*?renderJoins\(\{ skipQuickMobileCarousel: true, resetSoonRail \}\);[\s\S]*?alignHomeRenderScrollActiveItem\(grid, 0\);[\s\S]*?updateBestSectionControls\("soon"\);/
  );
  assert.match(
    SECTION_SOURCE,
    /function reconcileHomeJoinSectionList\(container, html, options = \{\}\)[\s\S]*?options\.resetSoonRail === true && entry\.key === "soon";[\s\S]*?if \(!resetSectionInteraction\) \{\s*restoreHomeRenderInteractionStateAfterLayout\(entry\.node, interactionState\);/
  );
});

test("곧 출발해요 모바일 카드 위치와 마지막 여백은 해외골프 BEST 레일 규칙을 공유한다", () => {
  assert.match(
    CSS_SOURCE,
    /\.sgj-page \.join-product-section\.layout-soon \.join-grid,\s*\.sgj-page \.join-product-section\.layout-overseas \.join-grid,[\s\S]*?scroll-snap-type: x mandatory;/
  );
  assert.match(
    CSS_SOURCE,
    /\.sgj-page \.join-product-section\.layout-soon \.join-grid::before,\s*\.sgj-page \.join-product-section\.layout-soon \.join-grid::after,[\s\S]*?flex: 0 0 calc\(var\(--mobile-page-gutter\) \+ 1px\);/
  );
  assert.match(
    CSS_SOURCE,
    /\.sgj-page \.join-product-section\.layout-soon \.join-grid::before \{[\s\S]*?position: static;[\s\S]*?width: auto;[\s\S]*?background: transparent;/
  );
  assert.match(
    CSS_SOURCE,
    /\.sgj-page \.join-product-section\.layout-soon \.join-card,\s*\.sgj-page \.join-product-section\.layout-overseas \.join-card,[\s\S]*?scroll-snap-align: center;/
  );
});
