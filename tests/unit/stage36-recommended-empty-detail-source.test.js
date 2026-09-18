"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const DETAIL_SOURCE_PATH = path.join(
  ROOT,
  "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"
);
const STYLE_SOURCE_PATH = path.join(ROOT, "src/golfjoin-main/source/styles/10-main.css");
const detailSource = fs.readFileSync(DETAIL_SOURCE_PATH, "utf8");
const styleSource = fs.readFileSync(STYLE_SOURCE_PATH, "utf8");

function sourceBetween(source, startToken, endToken, options = {}) {
  const start = options.last ? source.lastIndexOf(startToken) : source.indexOf(startToken);
  assert.notEqual(start, -1, `missing start token: ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `missing end token: ${endToken}`);
  return source.slice(start, end);
}

test("골프조인 상세 소스 JavaScript가 유효하다", () => {
  new vm.Script(detailSource, { filename: DETAIL_SOURCE_PATH });
});

test("참여자가 없는 관리자 추천일정은 상태·스타일 칩을 유지하고 빈 아이콘·성별·적합도만 렌더링하지 않는다", () => {
  const monthlyRenderer = sourceBetween(
    detailSource,
    "function renderDetailMonthlyParticipantStatus(",
    "function renderDetailParticipantStatus("
  );
  const standardRenderer = sourceBetween(
    detailSource,
    "function renderDetailParticipantStatus(",
    "function getDetailFlightRouteParts(",
    { last: true }
  );

  for (const renderer of [monthlyRenderer, standardRenderer]) {
    assert.match(renderer, /Boolean\(join\?\.isAdminRecommendedSchedule\)/);
    assert.match(renderer, /<div class="detail-participant-status-pills">/);
    assert.doesNotMatch(renderer, /isEmptyAdminRecommendation \? "" : `<div class="detail-participant-status-pills">/);
    assert.match(renderer, /isEmptyAdminRecommendation \? "" : `<div class="detail-participant-gender">/);
    assert.match(renderer, /<div class="detail-participant-divider" aria-hidden="true"><\/div>/);
    assert.match(renderer, /isEmptyAdminRecommendation \? "" : `<div class="detail-participant-match">/);
    assert.match(renderer, /detail-participant-style-chips/);
    assert.doesNotMatch(renderer, /isEmptyAdminRecommendation \? "" : `<div class="detail-participant-style-chips/);
  }

  assert.match(
    standardRenderer,
    /isEmptyAdminRecommendation \? "" : `<div class="team-row detail-team">/
  );
  assert.match(standardRenderer, /participantInfoBubble = isEmptyAdminRecommendation \? ""/);
});

test("추천일정 칩은 엔티티 별표를 사용하고 항공포함 뱃지는 원형 항공사 이미지와 항공사명을 표시한다", () => {
  assert.match(
    detailSource,
    /join-recommended-schedule-chip">&#x2728;추천일정<\/div>/
  );
  assert.match(
    detailSource,
    /class="join-flight-chip-airline-image"[^>]+air_\$\{normalizedAirlineCode\}\.png/
  );
  assert.doesNotMatch(detailSource, /lucide-tickets-plane[^\n]+join-flight-chip/);
  assert.match(detailSource, /const flight = isIncluded \? getDetailFlightRouteParts\(join\) : \{\}/);
  assert.match(detailSource, /const resolvedAirline = isIncluded[\s\S]*?resolveSecretTourAirline\(join\)[\s\S]*?getDetailAirlineNameFromCode\(flight\.airlineCode\)[\s\S]*?flight\.airline !== "항공사 확인 중"/);
  assert.match(detailSource, /const includedLabel = resolvedAirline && !isIndividualAirName\(resolvedAirline\) \? resolvedAirline : "항공포함"/);
  assert.match(detailSource, /`\$\{airlineImage\}<span>\$\{escapeHtml\(includedLabel\)\}<\/span>`/);
  assert.match(
    styleSource,
    /\.join-flight-chip-airline-image\s*\{[\s\S]*?width:\s*15px;[\s\S]*?height:\s*15px;[\s\S]*?flex:\s*0 0 15px;[\s\S]*?border-radius:\s*50%;[\s\S]*?object-fit:\s*cover;[\s\S]*?background:\s*#ffffff;/
  );
  assert.match(
    styleSource,
    /\.join-flight-chip\s*\{[\s\S]*?height:\s*25px;[\s\S]*?border:\s*1px solid var\(--border\);[\s\S]*?background:\s*#ffffff;[\s\S]*?color:\s*#373a3c;/
  );
  assert.match(styleSource, /\.join-flight-chip\.excluded\s*\{[\s\S]*?background:\s*#ffffff;[\s\S]*?color:\s*#373a3c;/);
  assert.match(styleSource, /\.join-recommended-schedule-chip\s*\{[\s\S]*?height:\s*25px;[\s\S]*?border:\s*1px solid var\(--border\);[\s\S]*?background:\s*#ffffff;[\s\S]*?color:\s*#373a3c;/);
  assert.equal((styleSource.match(/--font-card-category:\s*13px;/g) || []).length, 3);
});

test("항공 뱃지는 포함 상품의 실제 항공사명을 표시하고 누락 시에만 항공포함으로 대체한다", () => {
  const rendererSource = sourceBetween(
    detailSource,
    "function renderJoinFlightChip(",
    "function getJoinAirportDepartureLabel("
  );
  const renderWith = ({ included, airline }) => {
    const context = {
      hasIncludedFlight: () => included,
      getDetailFlightRouteParts: () => ({ airline, airlineCode: airline ? "ke" : "" }),
      resolveSecretTourAirline: () => airline,
      normalizeDetailAirlineCode: (value) => String(value || "").toLowerCase(),
      getDetailAirlineCodeFromName: () => "",
      getDetailAirlineNameFromCode: () => "",
      isSecretTourAirlineName: (value) => /항공/.test(String(value || "")),
      isIndividualAirName: (value) => /개별/.test(String(value || "")),
      escapeHtml: (value) => String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;"),
      result: ""
    };
    vm.runInNewContext(`${rendererSource}; result = renderJoinFlightChip({});`, context);
    return context.result;
  };

  const included = renderWith({ included: true, airline: "대한항공" });
  assert.match(included, /join-flight-chip included/);
  assert.match(included, /join-flight-chip-airline-image/);
  assert.match(included, /air_ke\.png/);
  assert.match(included, /<span>대한항공<\/span>/);
  assert.doesNotMatch(included, />항공포함</);

  const fallback = renderWith({ included: true, airline: "" });
  assert.match(fallback, /<span>항공포함<\/span>/);

  const excluded = renderWith({ included: false, airline: "" });
  assert.match(excluded, /join-flight-chip excluded/);
  assert.match(excluded, />항공불포함<\/div>/);
  assert.doesNotMatch(excluded, /join-flight-chip-airline-image/);
});

test("참여 가능 캘린더는 개수 뱃지 대신 초록 원만 표시하고 PC 스크롤·공휴일 간격을 보정한다", () => {
  const calendarRenderer = sourceBetween(
    detailSource,
    "function renderCalendarMonth(",
    "function renderCalendarSheetLoading("
  );

  assert.doesNotMatch(calendarRenderer, /calendar-event monthly|calendar-event domestic|calendar-event overseas/);
  assert.match(calendarRenderer, /events\.length \? " has-data"/);
  assert.match(
    styleSource,
    /\.calendar-cell\.has-data \.calendar-day-button strong::after\s*\{[\s\S]*?width:\s*10px;[\s\S]*?height:\s*10px;[\s\S]*?background:\s*var\(--calendar-available-color\);/
  );
  assert.match(
    styleSource,
    /@media \(min-width: 641px\)\s*\{[\s\S]*?\.calendar-sheet-body\s*\{[\s\S]*?padding-right:\s*0;[\s\S]*?scrollbar-gutter:\s*auto;/
  );
  assert.match(
    styleSource,
    /\.calendar-sheet-body > \.calendar-desktop-months,[\s\S]*?\.calendar-sheet-body > \.calendar-sheet-loading,[\s\S]*?\.calendar-sheet-body > \.calendar-desktop-selection\s*\{[\s\S]*?margin-right:\s*20px;/
  );
  assert.match(
    styleSource,
    /@media \(min-width: 641px\)\s*\{[\s\S]*?\.calendar-holiday-label\s*\{[\s\S]*?top:\s*calc\(50% \+ -0px\);/
  );
  assert.match(
    styleSource,
    /@media \(max-width: 640px\)\s*\{[\s\S]*?\.calendar-holiday-label\s*\{[\s\S]*?top:\s*38px;/
  );
});
