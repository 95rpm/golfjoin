"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const MARKUP_PATH = path.join(ROOT, "src/golfjoin-main/source/markup/20-main.html");
const SLIDER_SCRIPT_PATH = path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js");
const BUILT_HTML_PATH = path.join(ROOT, "dist/golfjoin-main/golfjoin_main.html");
const DEPLOY_HTML_PATH = path.join(
  ROOT,
  "deploy/stage33-hero-slider/two-images-5seconds-20260821-v33/DEPLOY_golfjoin_main_hero_two_images_A9B524BA.html"
);
const PACKAGE_ROOT = path.dirname(DEPLOY_HTML_PATH);
const HERO_IMAGE_URLS = [
  "/upload/secrettour/ckeditor/202608/secrettour_1fd01910e10846ebbcd53030ed429ec7.jpg",
  "/upload/secrettour/ckeditor/202608/secrettour_66e037bdea874d74b3e980f755738cba.jpg"
];

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

test("Hero는 요청한 이미지 두 장만 원본 슬라이드로 사용한다", () => {
  const markup = fs.readFileSync(MARKUP_PATH, "utf8");
  const track = markup.match(/<div class="hero-slider-track" id="heroSliderTrack">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="hero-slick-dots"/);

  assert.ok(track, "Hero 슬라이더 마크업을 찾을 수 없습니다.");
  assert.equal(countOccurrences(track[1], 'class="hero-slide"'), 2);
  HERO_IMAGE_URLS.forEach((url) => assert.equal(countOccurrences(track[1], url), 1));
  assert.doesNotMatch(track[1], /hero_banner\.webp|openHeroOctoberMonthlyDetail/);
});

test("Hero 자동 슬라이드는 5초 간격을 유지한다", () => {
  const script = fs.readFileSync(SLIDER_SCRIPT_PATH, "utf8");

  assert.match(script, /setInterval\(\(\) => \{[\s\S]*?setHeroSlide\(heroSlideIndex \+ 1, \{ restartTimer: false \}\);[\s\S]*?\}, 5000\);/);
});

test("통합 메인 HTML에도 두 Hero 이미지가 각각 한 번 포함된다", () => {
  const html = fs.readFileSync(BUILT_HTML_PATH, "utf8");

  HERO_IMAGE_URLS.forEach((url) => assert.equal(countOccurrences(html, url), 1));
});

test("최신 운영본 기반 배포 HTML은 두 이미지와 기존 5초 슬라이더 자산을 사용한다", () => {
  const html = fs.readFileSync(DEPLOY_HTML_PATH, "utf8");

  HERO_IMAGE_URLS.forEach((url) => assert.equal(countOccurrences(html, url), 1));
  assert.equal(countOccurrences(html, 'class="hero-slide"'), 2);
  assert.doesNotMatch(html, /hero_banner\.webp|openHeroOctoberMonthlyDetail/);
  assert.match(html, /golfjoin-main\.js/);
});

test("Hero 배포 파일과 복구 파일은 선언한 크기와 해시를 보존한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

  Object.values(manifest.files).forEach((descriptor) => {
    const file = fs.readFileSync(path.join(PACKAGE_ROOT, descriptor.fileName));
    assert.equal(file.length, descriptor.bytes, descriptor.fileName);
    assert.equal(crypto.createHash("sha256").update(file).digest("hex"), descriptor.sha256, descriptor.fileName);
  });
  assert.equal(manifest.autoSlideIntervalMs, 5000);
  assert.equal(manifest.requiresGcsAssetUpload, false);
  assert.equal(manifest.requiresCloudFunctionDeploy, false);
});
