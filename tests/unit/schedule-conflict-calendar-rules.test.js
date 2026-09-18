"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const memberSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/member/36-member-reservations-deeplinks.js"), "utf8");
const detailSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"), "utf8");
const homeSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/sections/38-home-sections.js"), "utf8");
const discoverySource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/data/35-product-discovery.js"), "utf8");
const loadingSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/loading/33-loading-and-modal-layer.js"), "utf8");
const mainCss = fs.readFileSync(path.join(root, "src/golfjoin-main/source/styles/10-main.css"), "utf8");

function extractFunction(source, functionName) {
  const declaration = `function ${functionName}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.ok(bodyStart > 1, `${functionName} body start not found`);
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
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

function createConflictRules(activeRanges) {
  const names = [
    "getDateOnlyTime",
    "normalizeJoinScheduleRange",
    "doJoinScheduleRangesOverlap",
    "findActiveJoinScheduleOverlappingDateRange",
    "isJoinDateRangeBlockedByActiveSchedule",
    "isJoinDepartureBlockedByActiveScheduleLeadTime",
    "isJoinProductBlockedForNewSchedule"
  ];
  const sandbox = {
    getNestedValue: () => "",
    getActiveJoinMySchedules: () => activeRanges.map((range) => ({
      range: {
        ...range,
        startTime: new Date(`${range.start}T00:00:00`).getTime(),
        endTime: new Date(`${range.end}T00:00:00`).getTime()
      }
    }))
  };
  vm.runInNewContext(`${names.map((name) => extractFunction(memberSource, name)).join("\n")}
    globalThis.rules = {
      isJoinDateRangeBlockedByActiveSchedule,
      isJoinDepartureBlockedByActiveScheduleLeadTime,
      isJoinProductBlockedForNewSchedule
    };`, sandbox);
  return sandbox.rules;
}

test("새 모임 출발일은 참여 일정 시작일과 그 이전 2일까지 차단한다", () => {
  const rules = createConflictRules([{ start: "2026-09-10", end: "2026-09-15" }]);
  assert.equal(rules.isJoinDepartureBlockedByActiveScheduleLeadTime("2026-09-07", 2), false);
  assert.equal(rules.isJoinDepartureBlockedByActiveScheduleLeadTime("2026-09-08", 2), true);
  assert.equal(rules.isJoinDepartureBlockedByActiveScheduleLeadTime("2026-09-09", 2), true);
  assert.equal(rules.isJoinDepartureBlockedByActiveScheduleLeadTime("2026-09-10", 2), true);
  assert.equal(rules.isJoinDepartureBlockedByActiveScheduleLeadTime("2026-09-15", 2), true);
  assert.equal(rules.isJoinDepartureBlockedByActiveScheduleLeadTime("2026-09-16", 2), false);
});

test("출발일부터 도착일까지 참여 일정과 하루라도 겹치면 차단한다", () => {
  const rules = createConflictRules([{ start: "2026-09-10", end: "2026-09-15" }]);
  assert.equal(rules.isJoinDateRangeBlockedByActiveSchedule("2026-09-01", "2026-09-09"), false);
  assert.equal(rules.isJoinDateRangeBlockedByActiveSchedule("2026-09-01", "2026-09-10"), true);
  assert.equal(rules.isJoinDateRangeBlockedByActiveSchedule("2026-09-15", "2026-09-18"), true);
  assert.equal(rules.isJoinDateRangeBlockedByActiveSchedule("2026-09-16", "2026-09-18"), false);
});

test("상품 전체 여행기간 충돌과 최소 2박 출발 제한을 같은 판정에 적용한다", () => {
  const rules = createConflictRules([{ start: "2026-09-10", end: "2026-09-15" }]);
  assert.equal(rules.isJoinProductBlockedForNewSchedule({ departureDate: "2026-09-07", returnDate: "2026-09-09" }), false);
  assert.equal(rules.isJoinProductBlockedForNewSchedule({ departureDate: "2026-09-08", returnDate: "2026-09-09" }), true);
  assert.equal(rules.isJoinProductBlockedForNewSchedule({ departureDate: "2026-09-01", returnDate: "2026-09-10" }), true);
});

test("상품상세 일정표는 파싱된 과거 날짜보다 현재 선택 출발일을 우선한다", () => {
  const block = extractFunction(detailSource, "renderDetailSchedule");
  assert.match(block, /formatScheduleDate\(join, index\) \|\| item\.dateText/);
});

test("상품상세 날짜 변경은 충돌 상품을 가격·선택 후보 모두에서 제외한다", () => {
  assert.match(extractFunction(detailSource, "getBuilderDepartureDatePriceLabel"), /!isJoinProductBlockedForNewSchedule\(product\)/);
  assert.match(extractFunction(detailSource, "getMdPickProductByDepartureDate"), /!isJoinProductBlockedForNewSchedule\(product\)/);
  assert.match(extractFunction(homeSource, "setupMdPickBuilderState"), /availablePeriodProducts[\s\S]*!isJoinProductBlockedForNewSchedule/);
});

test("상품상세 날짜 변경 달력은 월 렌더마다 상품·일정 인덱스를 한 번만 만든다", () => {
  const renderBlock = extractFunction(detailSource, "renderBuilderCalendar");
  assert.match(renderBlock, /const renderContext = createBuilderCalendarRenderContext\(\)/);
  assert.match(renderBlock, /isBuilderDateSelectable\(date, renderContext\)/);
  assert.match(renderBlock, /getBuilderActiveScheduleForDate\(date, renderContext\.activeSchedules\)/);
  assert.match(renderBlock, /getBuilderDepartureDatePriceLabel\(iso, renderContext\)/);
});

test("상품 전체 날짜 범위는 캐시된 출발일 인덱스에서 읽는다", () => {
  const boundsBlock = extractFunction(detailSource, "getBuilderProductDateBounds");
  assert.doesNotMatch(boundsBlock, /\.sort\(/);
  assert.match(boundsBlock, /getBuilderProductDateIndex\(items\)/);
  assert.match(boundsBlock, /minimumDepartureDate/);
  assert.match(boundsBlock, /maximumDepartureDate/);
});

test("대용량 상품 원본과 출발·도착일 인덱스를 데이터 변경 전까지 재사용한다", () => {
  const sourceBlock = extractFunction(detailSource, "getBuilderProductSource");
  const indexBlock = extractFunction(detailSource, "getBuilderProductDateIndex");
  const registeredBlock = extractFunction(detailSource, "getBuilderRegisteredProductsForDateSelection");
  assert.match(sourceBlock, /builderProductSourceCache\.availabilityRef === availabilityProducts/);
  assert.match(sourceBlock, /builderProductSourceCache\.items = mergeGolfJoinProductSources/);
  assert.match(indexBlock, /builderProductDateIndexCache\.get\(source\)/);
  assert.match(indexBlock, /returnDatesByDeparture/);
  assert.match(registeredBlock, /builderRegisteredProductsCache\.activeScheduleKey === activeScheduleKey/);
  assert.match(registeredBlock, /isJoinProductBlockedForNewSchedule\(product, activeSchedules\)/);
  assert.match(discoverySource, /golfJoinProductDiscoveryProductSnapshotRevision !== golfJoinProductDiscoveryProductCacheRevision/);
});

test("날짜 선택완료와 지역선택은 날짜 후보를 한 번만 추려 같은 캐시를 사용한다", () => {
  const signatureBlock = extractFunction(detailSource, "getBuilderActiveScheduleSignature");
  const availableBlock = extractFunction(detailSource, "getBuilderAvailableProductsForSelectedDates");
  const regionAvailableBlock = extractFunction(detailSource, "isBuilderRegionAvailableForDate");
  const regionProductsBlock = extractFunction(detailSource, "getBuilderRegionProducts");
  const regionSearchBlock = extractFunction(detailSource, "renderBuilderRegionSearch");
  assert.match(regionAvailableBlock, /getBuilderAvailableProductsForSelectedDates\(\)/);
  assert.match(regionProductsBlock, /const products = getBuilderAvailableProductsForSelectedDates\(\)/);
  assert.doesNotMatch(regionProductsBlock, /filter\(builderProductMatchesSelectedDates\)/);
  assert.doesNotMatch(regionSearchBlock, /filter\(\(\{ category \}\) => isBuilderCategoryAvailable/);

  const products = Array.from({ length: 10000 }, (_, index) => ({
    id: `product-${index}`,
    departureDate: index === 7777 ? "2026-10-10" : "2026-11-01",
    returnDate: index === 7777 ? "2026-10-13" : "2026-11-04"
  }));
  let conflictChecks = 0;
  const sandbox = {
    products,
    builderState: { regionDateFirstMode: false },
    builderAvailableProductsCache: {
      sourceRef: null,
      sourceLength: -1,
      dateKey: "",
      activeScheduleKey: "",
      items: []
    },
    getBuilderProductSource: () => products,
    getActiveJoinMySchedules: () => [],
    getBuilderProductDateCriteria: () => ({
      departureDates: ["2026-10-10"],
      returnDates: ["2026-10-13"],
      departureDateSet: new Set(["2026-10-10"]),
      returnDateSet: new Set(["2026-10-13"])
    }),
    isJoinProductBlockedForNewSchedule: () => {
      conflictChecks += 1;
      return false;
    }
  };
  vm.runInNewContext(`${signatureBlock}\n${availableBlock}\n`
    + "globalThis.first = getBuilderAvailableProductsForSelectedDates();\n"
    + "globalThis.second = getBuilderAvailableProductsForSelectedDates();", sandbox);
  assert.equal(sandbox.first.length, 1);
  assert.equal(sandbox.first[0].id, "product-7777");
  assert.equal(sandbox.second, sandbox.first);
  assert.equal(conflictChecks, 1);
});

test("지역 상품 로딩 표시는 실제 로딩 중이고 사용할 원본이 없을 때만 유지한다", () => {
  const block = extractFunction(detailSource, "renderBuilderRegionProducts");
  assert.match(block, /const isLoading = isBuilderDateLoading\(\) && !getBuilderProductSource\(\)\.length/);
  assert.doesNotMatch(block, /const isLoading = !externalGolfJoinProducts/);
});

test("PC 지역 상품 정렬 버튼은 기본·열림 상태 모두 그림자를 사용하지 않는다", () => {
  assert.match(mainCss, /@media \(min-width: 641px\)[\s\S]*?\.builder-region-sort-custom\s*\{[\s\S]*?box-shadow:\s*none;/);
  assert.match(mainCss, /\.builder-region-product-sort\.open \.builder-region-sort-custom\s*\{[\s\S]*?box-shadow:\s*none;/);
});

test("월 이동은 캐시 화면을 먼저 그리고 상품 갱신을 다음 프레임에 실행한다", () => {
  const joinableMonth = extractFunction(detailSource, "changeCalendarMonth");
  const builderMonth = extractFunction(detailSource, "changeBuilderMonth");
  assert.match(joinableMonth, /renderCalendarSheet\(\);[\s\S]*requestAnimationFrame\(\(\) => void refreshCalendarProductDiscovery/);
  assert.match(builderMonth, /renderBuilderCalendar\(\);[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*refreshBuilderProductDiscovery/);
});

test("두 캘린더 초기 로딩은 흐르는 쉬머 없이 정적 회색 UI와 공통 로딩을 사용한다", () => {
  const joinableLoading = extractFunction(detailSource, "renderCalendarSheetLoading");
  const builderLoading = extractFunction(detailSource, "renderBuilderCalendarLoadingShell");
  const openBuilder = extractFunction(detailSource, "openBuilderModalFromMain");
  assert.doesNotMatch(joinableLoading, /skeleton-glass-shimmer/);
  assert.match(joinableLoading, /calendar-sheet-common-loading/);
  assert.match(builderLoading, /builder-calendar-loading-cell/);
  assert.match(builderLoading, /is-loading-shell/);
  assert.doesNotMatch(openBuilder, /runJoinActionLoading/);
  assert.match(openBuilder, /preserveBuilderState: true/);
  assert.match(openBuilder, /renderBuilderCalendarLoadingShell\(\)/);
});

test("참여중 연결선·일요일 끝점과 두 날짜 선택 화면의 TODAY UI를 같은 기준으로 표시한다", () => {
  assert.match(mainCss, /\.calendar-cell\.active-schedule \.calendar-day-button::before\s*\{[\s\S]*?top:\s*0;[\s\S]*?transform:\s*none;/);
  assert.match(mainCss, /\.calendar-sheet \.calendar-cell\.active-schedule\.active-schedule-start[\s\S]*?color:\s*#ffffff !important;/);
  assert.match(mainCss, /\.builder-day\.active-schedule\.active-schedule-start[\s\S]*?color:\s*#ffffff !important;/);
  assert.match(mainCss, /\.builder-day\.today \.builder-day-number\s*\{[\s\S]*?width:\s*34px;[\s\S]*?color:\s*#3689ff;/);
  assert.match(mainCss, /@media \(min-width: 641px\)\s*\{\s*\.calendar-today-label\s*\{\s*top:\s*calc\(50% \+ 0px\);\s*font-size:\s*14px;\s*\}\s*\.builder-day\.today \.builder-day-today-label\s*\{\s*top:\s*calc\(50% \+ 18px\);\s*font-size:\s*14px;/);
  assert.doesNotMatch(mainCss, /@media \(min-width: 641px\)\s*\{[\s\S]*?\.calendar-today-label\s*\{[\s\S]*?top:\s*calc\(50% \+ -5px\);/);
  assert.match(mainCss, /\.builder-day-holiday-label\s*\{[\s\S]*?top:\s*calc\(50% \+ 18px\);/);
  assert.match(mainCss, /@media \(max-width: 640px\)\s*\{[\s\S]*?\.calendar-today-label\s*\{[\s\S]*?top:\s*38px;[\s\S]*?font-size:\s*11px;/);
  assert.match(mainCss, /@media \(max-width: 640px\)\s*\{[\s\S]*?\.builder-day\.today \.builder-day-today-label\s*\{[\s\S]*?font-size:\s*11px;/);
  const joinableMonth = extractFunction(detailSource, "renderCalendarMonth");
  const builderMonth = extractFunction(detailSource, "renderBuilderCalendar");
  assert.match(joinableMonth, /const isHoliday = Boolean\(holidayName\) && dateKey !== todayKey/);
  assert.match(joinableMonth, /holidayName && dateKey !== todayKey \? `<div class="calendar-holiday-label">/);
  assert.match(builderMonth, /const isHoliday = Boolean\(holidayName\) && !isToday/);
  assert.match(builderMonth, /isToday \? '<div class="builder-day-today-label">TODAY<\/div>' : isHoliday \? `<div class="builder-day-holiday-label">/);
});

test("여행지 검색은 내 일정과 겹치는 모임을 제외하고 새 타이틀을 사용한다", () => {
  assert.match(extractFunction(detailSource, "getVisibleCalendarJoinProducts"), /!isJoinExcludedFromMyReservationRecommendations\(join\)/);
  assert.match(extractFunction(detailSource, "renderEmptyRegionRecommendations"), /바로 참여 가능한 모임/);
});

test("지역 빈 결과에서 여는 새 모임은 지역 출발일 우선 모드로 시작한다", () => {
  const block = extractFunction(detailSource, "openBuilderFromRegionSearch");
  const initialize = extractFunction(detailSource, "initializeBuilderFromRegionSearch");
  assert.match(block, /await openModal\("builderModal",/);
  assert.match(block, /analyticsSourceArea: "destination_search"/);
  assert.match(initialize, /regionDateFirstMode: true/);
  assert.match(initialize, /loadGolfJoinProductDiscoveryRegion\(targetRegion/);
  assert.match(initialize, /syncBuilderRegionDateFirstViewMonth\(true\)/);
  const selection = extractFunction(detailSource, "selectBuilderDate");
  assert.match(selection, /builderState\.regionDateFirstMode[\s\S]*builderState\.endDay = null[\s\S]*setBuilderStep\(2\)/);
});

test("참여 가능 캘린더는 참여중 범위를 주황색으로 표시하고 해당 날짜의 초록 이벤트를 제거한다", () => {
  const legend = extractFunction(detailSource, "renderCalendarAvailabilityLegend");
  const month = extractFunction(detailSource, "renderCalendarMonth");
  assert.match(legend, /참여중/);
  assert.match(month, /const activeSchedule =/);
  assert.match(month, /events = !isMutedMonth && !activeSchedule/);
  assert.match(month, /active-schedule-start/);
  assert.match(month, /getBuilderActiveScheduleForDate\(date, renderContext\.activeSchedules\)/);
  assert.doesNotMatch(month, /!isMutedMonth \? getBuilderActiveScheduleForDate/);
  assert.match(month, /calendar-week-start/);
  assert.match(month, /calendar-week-end/);
  assert.match(mainCss, /\.calendar-cell\.active-schedule/);
  assert.match(mainCss, /\.calendar-cell\.active-schedule\.calendar-week-start/);
  assert.doesNotMatch(month, /calendar-month-nav-label/);
});

test("참여 가능 캘린더의 비활성 날짜보다 참여중 표시가 우선하고 같은 일정 상품 시트를 연다", () => {
  const month = extractFunction(detailSource, "renderCalendarMonth");
  const openSheet = extractFunction(detailSource, "openBuilderActiveScheduleSheet");
  const startAnimation = extractFunction(detailSource, "startBuilderActiveScheduleOpenAnimation");
  const cancelAnimation = extractFunction(detailSource, "cancelBuilderActiveScheduleOpenAnimation");
  const closeActiveSheet = extractFunction(detailSource, "closeBuilderActiveScheduleSheet");
  const closeCalendar = extractFunction(detailSource, "closeCalendarSheet");
  assert.match(month, /const canClickActiveSchedule = Boolean\(activeSchedule\)/);
  assert.match(month, /onclick="openBuilderActiveScheduleSheet\('/);
  assert.match(openSheet, /portalOverlayToBody\("builderActiveScheduleSheet"\)/);
  assert.match(openSheet, /syncBuilderActiveScheduleLayerGeometry\(openedFromJoinableCalendar\)/);
  assert.match(openSheet, /startBuilderActiveScheduleOpenAnimation\(sheet\)/);
  assert.match(openSheet, /renderRegionProductCard\(cardJoin/);
  assert.match(startAnimation, /style\.setProperty\("transition", "none"\)/);
  assert.match(startAnimation, /sheet\.getBoundingClientRect\(\)/);
  assert.match(startAnimation, /requestAnimationFrame\(\(\) =>/);
  assert.match(startAnimation, /sheet\.classList\.add\("open"\)/);
  assert.match(cancelAnimation, /cancelAnimationFrame\(frameId\)/);
  assert.match(closeActiveSheet, /cancelBuilderActiveScheduleOpenAnimation\(sheet\)/);
  assert.match(closeCalendar, /closeBuilderActiveScheduleSheet\(\)/);
  assert.match(loadingSource, /id === "builderActiveScheduleBackdrop"[\s\S]*?2147483638/);
  assert.match(loadingSource, /id === "builderActiveScheduleSheet"[\s\S]*?2147483639/);
  assert.match(mainCss, /\.calendar-sheet \.calendar-cell\.unavailable\.active-schedule[\s\S]*?opacity:\s*1/);
  assert.match(mainCss, /\.calendar-sheet \.calendar-cell\.active-schedule \.calendar-day-button strong[\s\S]*?color:\s*#c2410c !important/);
  assert.match(mainCss, /width:\s*var\(--builder-active-origin-width/);
  assert.match(mainCss, /bottom:\s*var\(--builder-active-origin-bottom/);
  assert.match(mainCss, /body\s*>\s*#builderActiveScheduleBackdrop\.sgj-portal-overlay\s*\{[\s\S]*?inset:\s*auto\s*!important/);
  assert.match(mainCss, /body\s*>\s*#builderActiveScheduleSheet\.sgj-portal-overlay\s*\{[\s\S]*?width:\s*var\(--builder-active-origin-width,[^)]*\)\s*!important/);
  assert.match(mainCss, /body\s*>\s*#builderActiveScheduleSheet\.sgj-portal-overlay\s*\{[\s\S]*?bottom:\s*var\(--builder-active-origin-bottom,[^)]*\)\s*!important/);
});

test("참여 가능 캘린더는 월 렌더마다 상품·내 일정 컨텍스트를 한 번만 만든다", () => {
  const sheet = extractFunction(detailSource, "renderCalendarSheet");
  const month = extractFunction(detailSource, "renderCalendarMonth");
  const selectable = extractFunction(detailSource, "isCalendarBuilderDepartureSelectable");
  assert.match(sheet, /const renderContext = createJoinableCalendarRenderContext\(eventsByDate\)/);
  assert.match(sheet, /renderContext/);
  assert.doesNotMatch(sheet, /clearActiveJoinMySchedulesCache\(\)/);
  assert.match(month, /isCalendarBuilderDepartureSelectable\(date, renderContext\)/);
  assert.match(selectable, /registeredDepartureDates\.has\(iso\)/);
});

test("모바일 참여 가능 캘린더는 새 모임과 같은 한 달 페이징 헤더와 날짜 간격을 사용한다", () => {
  const sticky = extractFunction(detailSource, "renderCalendarMobileSticky");
  const sheet = extractFunction(detailSource, "renderCalendarSheet");
  assert.match(sticky, /const hasActiveSchedule = getActiveJoinMySchedules\(\)\.length > 0/);
  assert.match(sticky, /calendar-availability-legend-item active-schedule/);
  assert.match(sticky, /calendar-availability-legend-item available/);
  assert.doesNotMatch(sticky, /renderCalendarAvailabilityLegend\(\)/);
  assert.match(sticky, /calendar-mobile-month-navigation/);
  assert.match(sticky, /changeCalendarMonth\(-1\)/);
  assert.match(sticky, /changeCalendarMonth\(1\)/);
  assert.match(sheet, /renderCalendarMobileSticky\(calendarViewMonth, startMonth, endMonth\)/);
  assert.match(sheet, /hideMonthTitle: true/);
  assert.match(sheet, /mobilePaged: true/);
  assert.doesNotMatch(sheet, /mobileEndMonth|while \(getMonthKey\(cursor\)/);
  assert.match(mainCss, /\.calendar-mobile-month-head \.calendar-availability-legend-item\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(mainCss, /\.calendar-mobile-month-head\s*\{[\s\S]*?padding:\s*6px 9px 0;/);
  assert.match(mainCss, /\.calendar-mobile-month-head \.calendar-availability-legend-item\.available\s*\{[\s\S]*?grid-column:\s*3;[\s\S]*?justify-self:\s*end;/);
  assert.match(mainCss, /\.calendar-mobile-month-navigation\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1;/);
  assert.match(mainCss, /\.calendar-mobile-month-label\s*\{[\s\S]*?font-size:\s*18px;[\s\S]*?font-weight:\s*800;/);
  assert.match(mainCss, /\.calendar-mobile-sticky \.calendar-label\s*\{[\s\S]*?padding:\s*8px 0;[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*700;/);
  assert.match(mainCss, /\.calendar-mobile-paged-month \.calendar-cell,[\s\S]*?min-height:\s*60px;/);
  assert.match(mainCss, /\.calendar-mobile-paged-month \.calendar-cell\.active-schedule \.calendar-day-button::before\s*\{[\s\S]*?top:\s*3px;/);
  assert.match(mainCss, /\.calendar-mobile-paged-month \.calendar-holiday-label\s*\{[\s\S]*?top:\s*38px;/);
});

test("회원 일정 데이터가 늦게 도착해도 열려 있는 참여 가능 캘린더를 즉시 갱신한다", () => {
  const joinsHydration = extractFunction(detailSource, "hydrateJoinApplicationsFromGoogleSheetUncoalesced");
  const buildersHydration = extractFunction(detailSource, "hydrateBuilderApplicationJoinsFromGoogleSheetUncoalesced");
  assert.match(joinsHydration, /resetJoinApplicationsFromAuthoritativeRows\(rows\)[\s\S]*?refreshOpenCalendarSheetAfterJoinDataChange\(\)/);
  assert.match(buildersHydration, /clearActiveJoinMySchedulesCache\(\)[\s\S]*?refreshOpenCalendarSheetAfterJoinDataChange\(\)/);
});

test("참여중 일정 카드의 모바일 참여자 정보는 상위 레이어에 표시한다", () => {
  const participantSource = fs.readFileSync(path.join(root, "src/golfjoin-main/source/scripts/detail/39-detail-actions-participants.js"), "utf8");
  const openParticipant = extractFunction(participantSource, "openParticipant");
  assert.match(openParticipant, /"builderActiveScheduleSheet"/);
  assert.match(openParticipant, /2147483700/);
  assert.match(openParticipant, /2147483701/);
});

test("새 모임 달력은 출발 선행 2일과 출발·도착 사이 충돌을 각각 검사한다", () => {
  const selectable = extractFunction(detailSource, "isBuilderDateSelectable");
  const select = extractFunction(detailSource, "selectBuilderDate");
  assert.match(selectable, /isBuilderDepartureDateAllowedByActiveSchedules/);
  assert.match(selectable, /isBuilderReturnDateAllowedByActiveSchedules/);
  assert.match(select, /isBuilderReturnDateAllowedByActiveSchedules\(clickedIso\)/);
});
