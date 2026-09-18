"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const dashboard = read("golfjoin_admin_dashboard.html");
const serverIndex = read("server/google-sheet-proxy-function/index.js");
const heroModule = read("server/google-sheet-proxy-function/hero-banners.js");
const heroScript = read("src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js");
const heroBoot = read("src/golfjoin-main/source/scripts/boot/40-initialize.js");
const heroStyles = read("src/golfjoin-main/source/styles/10-main.css");

test("대시보드 왼쪽 메뉴에 배너관리와 일관된 관리 화면이 연결된다", () => {
  assert.match(dashboard, /data-menu="banner-management"/);
  assert.match(dashboard, /<span class="nav-label">배너관리<\/span>/);
  assert.match(dashboard, /function renderHeroBannerManager\(\)/);
  assert.match(dashboard, /data-action="hero-banner-add"/);
  assert.match(dashboard, /data-action="hero-banner-save"/);
  assert.match(dashboard, /data-action="hero-banner-delete"/);
  assert.match(dashboard, /data-hero-banner-field="imageUrl"/);
  assert.match(dashboard, /data-hero-banner-field="linkUrl"/);
});

test("배너관리 목록은 PC 4열이며 좁은 화면에서는 2열과 1열로 반응한다", () => {
  assert.match(dashboard, /\.banner-admin-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(dashboard, /@media \(max-width: 1180px\)\s*\{[\s\S]*?\.banner-admin-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(dashboard, /@media \(max-width: 780px\)\s*\{[\s\S]*?\.banner-admin-grid\s*\{\s*grid-template-columns:\s*1fr;/);
  assert.match(dashboard, /\.banner-admin-card-foot\s*\{[\s\S]*?flex-direction:\s*column;/);
  assert.match(dashboard, /\.banner-admin-card-actions\s*\{\s*display:\s*flex;\s*width:\s*100%;/);
});

test("관리자 배너 API는 인증 조회와 세대값 기반 저장을 사용한다", () => {
  assert.match(serverIndex, /admin_hero_banners_get/);
  assert.match(serverIndex, /admin_hero_banners_save/);
  assert.match(serverIndex, /assertHeroBannerAdminRequest\(req\)/);
  assert.match(serverIndex, /expectedGeneration:\s*payload\.expectedGeneration/);
  assert.match(heroModule, /preconditionOpts:\s*\{\s*ifGenerationMatch:\s*expectedGeneration\s*\|\|\s*0\s*\}/);
  assert.match(heroModule, /hero_banner_generation_conflict/);
});

test("메인 Hero는 공개 배너를 비차단 로드하고 실패하면 HTML 기본 배너를 유지한다", () => {
  assert.match(heroScript, /HERO_BANNER_MANIFEST_URL/);
  assert.match(heroScript, /hero-banners\/manifest\.json/);
  assert.match(heroScript, /async function loadManagedHeroBanners\(\)/);
  assert.match(heroScript, /if \(!response\.ok\) return false/);
  assert.match(heroScript, /if \(!items\.length\) return false/);
  assert.match(heroScript, /track\.replaceChildren/);
  assert.match(heroScript, /startHeroSlider\(\)/);
  assert.match(heroBoot, /startHeroSlider\(\);\s*loadManagedHeroBanners\(\);/);
});

test("10월 월례회 관리 배너는 비로그인 상태에서도 기존 상품 모달 함수를 직접 사용한다", () => {
  assert.match(heroScript, /function getManagedHeroModalTarget\(linkUrl = ""\)/);
  assert.match(heroScript, /scheduleId === HERO_OCTOBER_MONTHLY_SCHEDULE_ID/);
  assert.match(heroScript, /slide\.dataset\.heroModalTarget = modalTarget/);
  assert.match(heroScript, /track\.addEventListener\("click", handleManagedHeroLinkClick\)/);
  assert.match(heroScript, /event\.preventDefault\(\);\s*openHeroOctoberMonthlyDetail\(\);/);
});

test("슬라이더 재시작은 기존 타이머와 복제 슬라이드를 정리한다", () => {
  assert.match(heroScript, /window\.clearInterval\(heroSliderTimer\)/);
  assert.match(heroScript, /data-hero-slide-clone="true"/);
  assert.match(heroScript, /track\.removeEventListener\("transitionend", normalizeHeroSlidePosition\)/);
  assert.match(heroScript, /}, 5000\);/);
});

test("모바일 Hero 섹션은 하단 도트 높이까지 내부 여백으로 포함한다", () => {
  assert.match(heroStyles, /\.sgj-page \.hero\.sgj-section \{[\s\S]*?padding:\s*5px 0 28px;[\s\S]*?border-radius:\s*20px;/);
  assert.match(heroStyles, /\.sgj-page \.hero-slick-dots \{[\s\S]*?bottom:\s*-20px;[\s\S]*?gap:\s*3px;/);
});

test("모바일 Hero 스와이프는 세로 스크롤을 보존하고 완료 시 5초 타이머를 다시 시작한다", () => {
  assert.match(heroStyles, /\.hero-slider-viewport \{[\s\S]*?touch-action:\s*pan-y;/);
  assert.match(heroScript, /function bindHeroSwipeNavigation\(track\)/);
  assert.match(heroScript, /addEventListener\("pointermove", handleHeroSwipePointerMove, \{ passive: false \}\)/);
  assert.match(heroScript, /state\.axis = Math\.abs\(deltaX\) > Math\.abs\(deltaY\) \? "horizontal" : "vertical"/);
  assert.match(heroScript, /heroSuppressClickUntil = Date\.now\(\) \+ 500/);
  assert.match(heroScript, /setHeroSlide\(nextIndex, \{ restartTimer: false \}\);\s*restartHeroSliderTimer\(\);/);
  assert.match(heroScript, /setHeroSlide\(heroSlideIndex \+ 1, \{ restartTimer: false \}\);\s*\}, 5000\);/);
});

test("브라우저 탭이 숨겨지면 Hero 타이머를 멈추고 복귀 시 원본 슬라이드로 복구한다", () => {
  assert.match(heroScript, /if \(document\.visibilityState === "hidden"\) \{[\s\S]*?clearHeroSliderTimer\(\);[\s\S]*?return;/);
  assert.match(heroScript, /function normalizeHeroRealSlideIndex\(index = heroSlideIndex, count = heroRealSlideCount\)/);
  assert.match(heroScript, /heroSlideIndex = normalizeHeroRealSlideIndex\(\);/);
  assert.match(heroScript, /track\.style\.transition = "none";[\s\S]*?track\.style\.transform = `translateX\(-\$\{heroSlideIndex \* 100\}%\)`;/);
  assert.match(heroScript, /document\.addEventListener\("visibilitychange", restoreHeroSliderAfterVisibilityChange\)/);
  assert.match(heroScript, /window\.addEventListener\("pageshow", restoreHeroSliderAfterVisibilityChange\)/);
});
