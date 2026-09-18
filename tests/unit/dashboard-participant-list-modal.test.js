"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dashboard = fs.readFileSync(
  path.resolve(__dirname, "../../golfjoin_admin_dashboard.html"),
  "utf8"
);

test("일정 참여자 명단은 표 내부 아코디언이 아닌 독립 모달로 표시한다", () => {
  assert.match(dashboard, /id="participantListBackdrop"/);
  assert.match(dashboard, /class="participant-list-shell" role="dialog" aria-modal="true"/);
  assert.match(dashboard, /id="participantListBody"/);
  assert.match(dashboard, /function openParticipantListModal\(schedule\)/);
  assert.match(dashboard, /openParticipantListModal\(schedule\);/);
  assert.doesNotMatch(dashboard, /participant-accordion-row/);
  assert.doesNotMatch(dashboard, /renderParticipantAccordionRow/);
});

test("참여자 모달은 일정 정보와 최신 참여자 표를 렌더링한다", () => {
  assert.match(dashboard, /function renderOpenParticipantListModal\(\)/);
  assert.match(dashboard, /getTitle\(schedule\.row \|\| \{\}\)/);
  assert.match(dashboard, /`참여 중 \$\{rosterCounts\.active\}\/\$\{capacity\}명`/);
  assert.match(dashboard, /`취소 \$\{rosterCounts\.cancelled\}명`/);
  assert.match(dashboard, /body\.innerHTML = renderParticipantTable\(schedule\)/);
  assert.match(dashboard, /async function refreshOpenParticipantListModal\(\)/);
  assert.match(dashboard, /await refreshScheduleParticipants\(schedule\)/);
  assert.match(dashboard, /id="participantListRefresh"/);
});

test("참여자 모달 안에서도 견적·상태·명단 관리 기능을 사용할 수 있다", () => {
  assert.match(dashboard, /document\.getElementById\("participantListBody"\)\?\.addEventListener\("click"/);
  [
    "quote-view",
    "quote-editor",
    "quote-send",
    "participant-roster-add",
    "participant-roster-edit",
    "participant-roster-delete",
    "participant-status-update"
  ].forEach((action) => {
    assert.match(dashboard, new RegExp(`data-action=\\"${action}\\"`));
  });
});

test("참여자 모달은 닫기·드래그 안전 바깥 클릭·ESC와 키보드 일정 행 열기를 지원한다", () => {
  assert.match(dashboard, /participantListClose"\)\?\.addEventListener\("click", closeParticipantListModal\)/);
  assert.match(dashboard, /bindModalBackdropDismiss\(document\.getElementById\("participantListBackdrop"\), closeParticipantListModal\)/);
  assert.match(dashboard, /participantListBackdrop"\)\?\.classList\.contains\("open"\)/);
  assert.match(dashboard, /\["Enter", " "\]\.includes\(event\.key\)/);
  assert.match(dashboard, /tabindex="0" aria-label="\$\{escapeHtml\(`\$\{getTitle\(row\)\} 참여자 명단 보기`\)\}"/);
});

test("참여자 모달은 가로 스크롤 없이 전체 열과 모바일 카드 목록을 표시한다", () => {
  assert.match(dashboard, /\.participant-list-shell\s*\{[\s\S]*?width:\s*min\(1900px, calc\(100vw - 24px\)\)/);
  assert.match(dashboard, /\.participant-list-body \.participant-table-wrap\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(dashboard, /\.participant-list-body \.participant-table\s*\{\s*width:\s*100%;\s*min-width:\s*0/);
  assert.match(dashboard, /data-label="핸드폰번호"/);
  assert.match(dashboard, /data-label="취소\/환불"/);
  assert.match(dashboard, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.participant-list-backdrop\s*\{\s*padding:\s*0;\s*align-items:\s*flex-end/);
  assert.match(dashboard, /\.participant-list-body \.participant-table tbody tr\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});
