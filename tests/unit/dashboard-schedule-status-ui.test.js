"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dashboard = fs.readFileSync(
  path.resolve(__dirname, "../../golfjoin_admin_dashboard.html"),
  "utf8"
);

test("일정 현황은 진행 중·종료 그룹과 6개 운영 상태를 표시한다", () => {
  assert.match(dashboard, /class="schedule-status-columns"/);
  assert.match(dashboard, /진행 중인 일정/);
  assert.match(dashboard, /종료된 일정/);
  [
    ["recruiting", "모집중"],
    ["recruited", "모집완료"],
    ["confirmed", "출발확정"],
    ["completed", "여행완료"],
    ["ended", "모집종료"],
    ["cancelled", "일정취소"]
  ].forEach(([key, label]) => {
    assert.match(dashboard, new RegExp(`key: "${key}", label: "${label}"`));
    assert.match(dashboard, new RegExp(`<option value="${key}">${label}</option>`));
  });
  assert.match(dashboard, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(dashboard, /\.schedule-status-columns::after\s*\{/);
});

test("일정 현황은 지정된 Lucide 상태 아이콘을 사용한다", () => {
  assert.match(dashboard, /key: "recruiting", label: "모집중", icon: "users"/);
  assert.match(dashboard, /key: "ended", label: "모집종료", icon: "message-square-x"/);
  assert.match(dashboard, /"users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6/);
  assert.match(dashboard, /"circle-check-big": '<path d="M21\.801 10A10 10 0 1 1 17 3\.335"/);
  assert.match(dashboard, /"plane-takeoff": '<path d="M2 22h20"\/\><path d="M6\.36 17\.4/);
  assert.match(dashboard, /"flag": '<path d="M4 22V4a1 1 0 0 1 \.4-\.8/);
  assert.match(dashboard, /"message-square-x": '<path d="M22 17a2 2 0 0 1-2 2H6\.828/);
  assert.match(dashboard, /"circle-x": '<circle cx="12" cy="12" r="10"/);
});

test("신규와 상담 대기는 동일한 카드 구조로 실제 건수를 표시한다", () => {
  assert.match(dashboard, /<strong class="schedule-work-title">신규<\/strong>/);
  assert.match(dashboard, /<strong class="schedule-work-title">상담대기<\/strong>/);
  assert.match(dashboard, /<span class="schedule-work-count">\$\{escapeHtml\(newRecent\)\}<\/span>/);
  assert.match(dashboard, /<span class="schedule-work-count">\$\{escapeHtml\(consultationCount\)\}\$\{hasUnquotedConsultation \? '<span class="schedule-work-new-badge">NEW<\/span>' : ""\}<\/span>/);
  assert.match(dashboard, /data-metric-action="new-recent"/);
  assert.match(dashboard, /data-metric-action="consultation"/);
  assert.match(dashboard, /scheduleCreatedRecentOnly/);
  assert.match(dashboard, /!schedule\.isRecommendationSchedule && isRecentlyCreatedSchedule\(schedule\)/);
  assert.match(dashboard, /\.schedule-work-queue\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(dashboard, /\.schedule-work-count\s*\{[\s\S]*?font-size:\s*28px[\s\S]*?font-weight:\s*600/);
  assert.doesNotMatch(dashboard, /escapeHtml\((?:newRecent|consultationCount|ongoingTotal|endedTotal)\)\}건/);
  assert.doesNotMatch(dashboard, /schedule-work-description/);
});

test("상담 대기 목록은 일정 생성일과 같은 날짜·시간 형식을 사용한다", () => {
  assert.match(dashboard, /<table class="consultation-table">[\s\S]*?<th>생성일<\/th>/);
  assert.match(dashboard, /formatScheduleCreatedDateTime\(\{ createdAt: item\.createdAt \}\)/);
  assert.doesNotMatch(dashboard, /<th>신청시간<\/th>/);
});

test("일정 현황 카드는 설명 없이 32px 아이콘과 28px 건수를 사용한다", () => {
  assert.match(dashboard, /\.schedule-status-card\s*\{[\s\S]*?padding:\s*20px/);
  assert.match(dashboard, /\.schedule-status-card\s*\{[\s\S]*?min-height:\s*110px[\s\S]*?column-gap:\s*7px[\s\S]*?row-gap:\s*0/);
  assert.match(dashboard, /\.schedule-status-card\s*\{[\s\S]*?grid-template-rows:\s*auto auto/);
  assert.match(dashboard, /\.schedule-status-icon\s*\{[\s\S]*?width:\s*32px[\s\S]*?height:\s*32px/);
  assert.match(dashboard, /\.schedule-status-count\s*\{[\s\S]*?font-size:\s*28px[\s\S]*?font-weight:\s*600/);
  assert.match(dashboard, /\.schedule-status-group-head span\s*\{[\s\S]*?font-size:\s*16px[\s\S]*?font-weight:\s*700/);
  assert.match(dashboard, /\.schedule-status-name\s*\{[\s\S]*?font-size:\s*18px[\s\S]*?font-weight:\s*700/);
  assert.doesNotMatch(dashboard, /schedule-status-description/);
});

test("대시보드 탭의 숫자는 28px 600 굵기를 사용한다", () => {
  assert.match(dashboard, /\.metric-value\s*\{[\s\S]*?font-size:\s*28px[\s\S]*?font-weight:\s*600/);
  assert.match(dashboard, /\.schedule-work-count\s*\{[\s\S]*?font-size:\s*28px[\s\S]*?font-weight:\s*600/);
  assert.match(dashboard, /\.schedule-status-count\s*\{[\s\S]*?font-size:\s*28px[\s\S]*?font-weight:\s*600/);
});

test("상단 확인 카드는 제목·아이콘과 건수의 두 영역만 사용한다", () => {
  assert.match(dashboard, /\.schedule-work-card\s*\{[\s\S]*?grid-template-rows:\s*auto 1fr/);
  assert.match(dashboard, /\.schedule-work-card\s*\{[\s\S]*?min-height:\s*109px[\s\S]*?gap:\s*0/);
  assert.match(dashboard, /\.schedule-work-title\s*\{[\s\S]*?font-size:\s*18px[\s\S]*?font-weight:\s*700/);
  assert.match(dashboard, /\.schedule-work-icon\s*\{[\s\S]*?justify-self:\s*end/);
  assert.match(dashboard, /\.schedule-work-action\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*2/);
  assert.doesNotMatch(dashboard, /grid-row:\s*3/);
});

test("일정관리 표는 현재 화면 높이에 맞춘 내부 스크롤과 고정 헤더를 사용한다", () => {
  assert.match(dashboard, /\.table-wrap\.schedule-management-mode\s*\{[\s\S]*?height:\s*clamp\(220px, calc\(100vh - 492px\), 680px\)/);
  assert.match(dashboard, /\.table-wrap\.schedule-management-mode\s*\{[\s\S]*?overflow:\s*auto/);
  assert.match(dashboard, /\.schedule-table > thead > tr > th\s*\{[\s\S]*?z-index:\s*5/);
  assert.match(dashboard, /classList\.toggle\("schedule-management-mode", state\.currentMenu === "schedules"\)/);
});

test("일정 표 상태 배지는 흰 배경·회색 외곽선·상태별 도트를 사용한다", () => {
  assert.match(dashboard, /\.badge\.schedule-status-badge\s*\{[\s\S]*?border:\s*1px solid #d7dce3/);
  assert.match(dashboard, /\.badge\.schedule-status-badge\s*\{[\s\S]*?border-radius:\s*5px/);
  assert.match(dashboard, /\.badge\.schedule-status-badge\s*\{[\s\S]*?background:\s*#fff/);
  assert.match(dashboard, /\.badge\.schedule-status-badge\s*\{[\s\S]*?color:\s*#373a3c/);
  assert.match(dashboard, /\.badge\.schedule-status-badge::before\s*\{/);
  assert.match(dashboard, /class="badge schedule-status-badge \$\{escapeHtml\(getScheduleStatusClass\(operationStatus, schedule\)\)\}"/);
});

test("출발일이 시작된 일정은 여행 완료 또는 모집 종료로 분류한다", () => {
  assert.match(dashboard, /const hasStarted = Boolean\(departure && departure\.getTime\(\) <= today\.getTime\(\)\)/);
  assert.match(dashboard, /hasStarted[\s\S]*?isScheduleClosed\(schedule\) \|\| isScheduleDepartureConfirmed\(schedule\)[\s\S]*?"completed"[\s\S]*?: "ended"/);
  assert.match(dashboard, /if \(isScheduleDepartureConfirmed\(schedule\)\) return "confirmed"/);
  assert.match(dashboard, /if \(isScheduleClosed\(schedule\)\) return "recruited"/);
});
