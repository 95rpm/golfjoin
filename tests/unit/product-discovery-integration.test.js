"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const DETAIL_PATH = path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js");
const SECTIONS_PATH = path.join(ROOT, "src/golfjoin-main/source/scripts/sections/38-home-sections.js");
const MEMBER_PATH = path.join(ROOT, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js");
const BOOT_PATH = path.join(ROOT, "src/golfjoin-main/source/scripts/boot/40-initialize.js");
const MANIFEST_PATH = path.join(ROOT, "src/golfjoin-main/source-manifest.json");

function extractFunction(source, functionName) {
  const declarations = [`async function ${functionName}(`, `function ${functionName}(`];
  const start = declarations.map((value) => source.indexOf(value)).find((value) => value >= 0);
  assert.notEqual(start, undefined, `${functionName} declaration not found`);
  const bodyStart = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

test("product-discovery 모듈은 회원·상세 소비자보다 먼저 조립되고 초기 부팅에서는 호출되지 않는다", () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const discoveryIndex = manifest.sourceOrder.indexOf("source/scripts/data/35-product-discovery.js");
  const memberIndex = manifest.sourceOrder.indexOf("source/scripts/member/36-member-reservations-deeplinks.js");
  const detailIndex = manifest.sourceOrder.indexOf("source/scripts/detail/37-detail-builder-calendar.js");
  assert.ok(discoveryIndex > 0);
  assert.ok(discoveryIndex < memberIndex);
  assert.ok(discoveryIndex < detailIndex);
  const boot = fs.readFileSync(BOOT_PATH, "utf8");
  assert.doesNotMatch(boot, /ensureGolfJoinProductDiscovery|loadGolfJoinProductDiscovery/);
});

test("MD PICK Builder는 선택 상품 캐시를 사용하고 전체 상품 로더를 기다리지 않는다", () => {
  const source = fs.readFileSync(SECTIONS_PATH, "utf8");
  ["openMdPickBuilder", "openMdPickBuilderWithCurrentDate"].forEach((name) => {
    const functionSource = extractFunction(source, name);
    assert.doesNotMatch(functionSource, /ensureExternalGolfJoinProductsLoaded/);
    assert.match(functionSource, /setupMdPickBuilderState/);
  });
});

test("캘린더·Builder·지역 진입은 월 또는 지역 shard를 사용한다", () => {
  const detail = fs.readFileSync(DETAIL_PATH, "utf8");
  const cases = [
    ["openCalendarSheet", /refreshCalendarProductDiscovery/],
    ["resetBuilderModal", /refreshBuilderProductDiscovery/],
    ["openBuilderFromRegionSearch", /loadGolfJoinProductDiscoveryRegion/],
    ["changeBuilderMonth", /refreshBuilderProductDiscovery/],
    ["changeCalendarMonth", /refreshCalendarProductDiscovery/]
  ];
  cases.forEach(([name, expected]) => {
    const functionSource = extractFunction(detail, name);
    assert.match(functionSource, expected);
    assert.doesNotMatch(functionSource, /ensureExternalGolfJoinProductsLoaded/);
  });
  const builderSource = extractFunction(detail, "getBuilderProductSource");
  assert.match(builderSource, /getCachedGolfJoinProductDiscoveryProducts/);
});

test("빈 추천·로그인 복귀·초기 딥링크는 신규 경로를 먼저 사용한다", () => {
  const member = fs.readFileSync(MEMBER_PATH, "utf8");
  assert.match(extractFunction(member, "openJoinMyEmptyRecommendRegion"), /loadGolfJoinProductDiscoveryRegion/);
  assert.match(extractFunction(member, "continueJoinExternalDetailAfterLogin"), /loadGolfJoinProductDiscoveryDirect/);
  assert.match(extractFunction(member, "resumeJoinExternalDeepLinkOnce"), /loadGolfJoinProductDiscoveryDirect/);
});

test("공개 상품상세 딥링크는 로그인 없이 직접 상품을 조회하고 연다", () => {
  const member = fs.readFileSync(MEMBER_PATH, "utf8");
  const resumeSource = extractFunction(member, "resumeJoinExternalDeepLinkOnce");
  const detailStart = resumeSource.indexOf('if (target === "detail")');
  const mySectionStart = resumeSource.indexOf('if (target === "my-section")', detailStart);
  assert.ok(detailStart >= 0 && mySectionStart > detailStart);
  const detailBranch = resumeSource.slice(detailStart, mySectionStart);
  assert.doesNotMatch(detailBranch, /getJoinLoginState|requireJoinLogin|openJoinMemberLoginModal/);
  assert.match(detailBranch, /loadGolfJoinProductDiscoveryDirect/);
  assert.match(detailBranch, /openJoinExternalDeepLinkDetailTarget/);
  assert.match(detailBranch, /if \(!join\) return false;\s*clearJoinExternalDeepLinkTarget\(\)/);
});

test("회원 전용 딥링크는 기존 로그인 보호를 유지한다", () => {
  const member = fs.readFileSync(MEMBER_PATH, "utf8");
  const resumeSource = extractFunction(member, "resumeJoinExternalDeepLinkOnce");
  assert.match(resumeSource, /target === "my-menu"[\s\S]*requireJoinLogin\("my-menu"/);
  assert.match(resumeSource, /target === "my-section"[\s\S]*requireJoinLogin\("my-section"/);
});

test("기존 전체 상품 로더 직접 호출은 식별자 없는 딥링크 fallback 두 곳만 남는다", () => {
  const detail = fs.readFileSync(DETAIL_PATH, "utf8");
  const sections = fs.readFileSync(SECTIONS_PATH, "utf8");
  const member = fs.readFileSync(MEMBER_PATH, "utf8");
  const calls = [detail, sections, member].flatMap((source) => (
    [...source.matchAll(/ensureExternalGolfJoinProductsLoaded\s*\(/g)]
  ));
  assert.equal(calls.length, 3, "definition one plus two explicit fallback calls are expected");
  assert.equal((member.match(/ensureExternalGolfJoinProductsLoaded\s*\(/g) || []).length, 2);
  assert.equal((sections.match(/ensureExternalGolfJoinProductsLoaded\s*\(/g) || []).length, 0);
});
