"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCriticalHtml,
  cssRangesFromMeasurements,
  extractCriticalCss,
  parseCssNodes,
  revisionForCriticalCss
} = require("../../tools/golfjoin-main/critical-css");
const { buildExternalAssetBundle } = require("../../tools/golfjoin-main/external-assets");
const { median, transferDelay } = require("../../tools/golfjoin-main/measure-stage13-critical-performance");

test("critical CSS는 사용 규칙과 media wrapper를 완전한 규칙으로 보존한다", () => {
  const source = [
    '@import url("font.css");',
    ".hero{display:block;color:red}",
    ".unused{display:none}",
    "@media (max-width:600px){.hero{padding:8px}.unused{opacity:0}}",
    "@keyframes pulse{from{opacity:0}to{opacity:1}}"
  ].join("\n");
  const desktopStart = source.indexOf(".hero{display");
  const mobileStart = source.indexOf(".hero{padding");
  const result = extractCriticalCss(source, [
    { start: desktopStart, end: desktopStart + 8 },
    { start: mobileStart, end: mobileStart + 8 }
  ]);

  assert.match(result.css, /\.hero\{display:block;color:red\}/);
  assert.match(result.css, /@media \(max-width:600px\)\{\.hero\{padding:8px\}/);
  assert.match(result.css, /@keyframes pulse/);
  assert.doesNotMatch(result.css, /@import/);
  assert.doesNotMatch(result.css, /\.unused\{/);
  assert.ok(result.gzipBytes > 0);
  assert.doesNotThrow(() => parseCssNodes(result.css));
});

test("문자열·주석·괄호 안의 중괄호는 CSS 블록 경계를 깨지 않는다", () => {
  const source = '.icon::before{content:"}";background:url("data:image/svg+xml,{x}")}/* } */.next{color:blue}';
  const nodes = parseCssNodes(source);
  assert.equal(nodes.length, 2);
  const result = extractCriticalCss(source, [{ start: source.indexOf(".next"), end: source.length }], {
    includeAllKeyframes: false
  });
  assert.equal(result.css.trim(), ".next{color:blue}");
});

test("PC·MO의 중복 coverage 범위는 하나의 합집합으로 만든다", () => {
  const url = "https://storage.googleapis.com/test/golfjoin-main.css";
  assert.deepEqual(cssRangesFromMeasurements([
    { css: [{ url, ranges: [{ start: 0, end: 10 }] }] },
    { css: [{ url, ranges: [{ start: 8, end: 20 }] }] }
  ], url), [{ start: 0, end: 20 }]);
});

test("critical HTML은 인라인 최소 CSS와 비차단 전체 CSS 및 noscript 복구를 갖는다", () => {
  const bundle = buildExternalAssetBundle({
    contentEncoding: "gzip",
    generatedAt: "2026-08-13T15:00:00+09:00"
  });
  const html = buildCriticalHtml(bundle, ".hero{display:block}\n").toString("utf8");
  assert.match(html, /data-golfjoin-critical-css=/);
  assert.match(html, /rel="preload" as="style"/);
  assert.match(html, /this\.rel='stylesheet'/);
  assert.match(html, /<noscript><link rel="stylesheet"/);
  assert.equal((html.match(/golfjoin-main\.css/g) || []).length, 2);
  assert.match(html, /handleGolfJoinExternalAssetFailure\('css'\)/);
});

test("critical revision은 전체 자산과 critical CSS 내용에 따라 결정된다", () => {
  assert.equal(revisionForCriticalCss("gha_a", ".a{}"), revisionForCriticalCss("gha_a", ".a{}"));
  assert.notEqual(revisionForCriticalCss("gha_a", ".a{}"), revisionForCriticalCss("gha_a", ".b{}"));
});

test("성능 비교는 여러 실행의 중간값과 압축 전송 지연을 사용한다", () => {
  assert.equal(median([30, 10, 20]), 20);
  assert.equal(median([40, 10, 30, 20]), 25);
  assert.equal(transferDelay(204800, { latencyMs: 150, bytesPerSecond: 204800 }), 1150);
});
