"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const WISH_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"
), "utf8");
const STATE_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/store/30-state-and-presets.js"
), "utf8");
const DETAIL_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
), "utf8");
const LOADING_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/loading/33-loading-and-modal-layer.js"
), "utf8");
const SERVER_SOURCE = fs.readFileSync(path.join(
  ROOT,
  "server/google-sheet-proxy-function/index.js"
), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.ok(bodyStart > 1, `${name} body not found`);
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
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} is incomplete`);
}

test("서버의 회원 찜 조회는 active와 deleted를 모두 반환해 삭제 표식을 전달한다", () => {
  const sheetsRead = extractFunction(SERVER_SOURCE, "readJoinWishesForMemberViaSheetsApi");
  const appsRead = extractFunction(SERVER_SOURCE, "readJoinWishesForMemberViaAppsScript");
  const bootstrapStart = SERVER_SOURCE.indexOf("const wishes = canReadWishes");
  const bootstrapEnd = SERVER_SOURCE.indexOf("return {", bootstrapStart);
  const bootstrap = SERVER_SOURCE.slice(bootstrapStart, bootstrapEnd);

  assert.doesNotMatch(sheetsRead, /row\.status[\s\S]{0,100}active|status \|\| "active"\) === "active"/);
  assert.doesNotMatch(appsRead, /status:\s*"active"/);
  assert.doesNotMatch(bootstrap, /status \|\| "active"\) === "active"/);
});

test("최신 deleted 표식은 이전 로컬 active 상품을 세 종류 모두 제거한다", () => {
  const recordsSource = extractFunction(WISH_SOURCE, "mergeJoinWishProductRecords");
  const visibleSource = extractFunction(WISH_SOURCE, "mergeJoinWishProducts");
  const sandbox = {
    normalizeJoinWishProduct(item) {
      return { ...item, status: String(item.status || "active").toLowerCase() };
    },
    getJoinWishTargetKey(item) {
      return String(item.targetKey || item.goodSeq || "");
    }
  };
  vm.runInNewContext(
    `${recordsSource};${visibleSource};globalThis.mergeForTest=mergeJoinWishProducts;globalThis.recordsForTest=mergeJoinWishProductRecords;`,
    sandbox
  );

  const local = ["family-a", "family-b", "single-c"].map((targetKey) => ({
    wishType: "product",
    targetKey,
    status: "active",
    updatedAt: "2026-08-21T10:00:00+09:00"
  }));
  const sheet = local.map((item) => ({
    ...item,
    status: "deleted",
    updatedAt: "2026-08-21T10:01:00+09:00"
  }));

  assert.equal(sandbox.mergeForTest(local, sheet).length, 0);
  assert.deepEqual(
    Array.from(sandbox.recordsForTest(local, sheet), (item) => item.status),
    ["deleted", "deleted", "deleted"]
  );
});

test("브라우저는 삭제 표식과 새 캐시 버전을 보존한다", () => {
  const removeSource = extractFunction(WISH_SOURCE, "removeJoinWishProduct");
  const updateCacheSource = extractFunction(WISH_SOURCE, "updateJoinWishRowsCache");
  const applyRowsSource = extractFunction(WISH_SOURCE, "applyJoinWishesFromGoogleSheetRows");
  const hydrateSource = extractFunction(WISH_SOURCE, "hydrateJoinWishesFromGoogleSheetUncoalesced");

  assert.match(STATE_SOURCE, /GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY\s*=\s*"joinWishesSheetReadCacheV2"/);
  assert.match(removeSource, /status:\s*"deleted"/);
  assert.match(removeSource, /saveJoinWishProducts\(\[tombstone,/);
  assert.match(updateCacheSource, /nextRows\.unshift/);
  assert.match(updateCacheSource, /status:\s*String\(status/);
  assert.match(applyRowsSource, /const sheetItems = rows\.map\(normalizeJoinWishSheetRow\);/);
  assert.match(applyRowsSource, /saveJoinWishProducts\(records\)/);
  assert.doesNotMatch(hydrateSource, /rows\.map\(normalizeJoinWishSheetRow\)\.filter/);
});

test("상품상세도 전체 모달 공통 원위치 스크롤 잠금을 사용한다", () => {
  const lockSource = extractFunction(LOADING_SOURCE, "lockWidgetModalPageScroll");
  const setOpenSource = extractFunction(LOADING_SOURCE, "setWidgetModalOpen");
  assert.match(lockSource, /body\.style\.setProperty\("position", "fixed"\)/);
  assert.match(lockSource, /body\.style\.setProperty\("top", `-\$\{top\}px`\)/);
  assert.match(lockSource, /body\.style\.setProperty\("overflow", "visible", "important"\)/);
  assert.match(lockSource, /root\.style\.setProperty\("overflow", "hidden", "important"\)/);
  assert.match(setOpenSource, /hasOpenBlockingModal\(\)/);
  assert.match(setOpenSource, /lockWidgetModalPageScroll\(\)/);
  assert.match(setOpenSource, /unlockWidgetModalPageScroll\(\)/);
  assert.doesNotMatch(DETAIL_SOURCE, /lockDetailModalPageScroll|detailModalPageScrollLockState/);
});
