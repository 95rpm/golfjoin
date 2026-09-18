const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dashboard = fs.readFileSync(path.resolve(__dirname, "../../golfjoin_admin_dashboard.html"), "utf8");

test("v78 추천일정 상태 탭은 넓은 고정 폭과 한 줄 제목을 사용한다", () => {
  assert.match(dashboard, /\.metrics\.with-action\s*\{[^}]*grid-template-columns:\s*repeat\(2, 172px\)/s);
  assert.match(dashboard, /\.metrics\.with-action \.metric-label\s*\{[^}]*white-space:\s*nowrap/s);
});

test("v78 추천일정·상품군 관리 탭은 일정관리와 동일한 활성 스타일을 사용한다", () => {
  assert.match(dashboard, /classList\.toggle\("management-tab-mode", \["recommended-schedules", "product-families"\]\.includes\(state\.currentMenu\)\)/);
  assert.match(dashboard, /\.metrics\.management-tab-mode \.metric\.actionable\.active\s*\{[^}]*border-color:\s*#5ba8f5;[^}]*background:\s*#fff;[^}]*box-shadow:\s*inset 0 0 0 1px #5ba8f5/s);
  assert.match(dashboard, /\.schedule-status-card\.active\s*\{[^}]*border-color:\s*#5ba8f5;[^}]*background:\s*#fff;[^}]*box-shadow:\s*inset 0 0 0 1px #5ba8f5/s);
});

test("v78 추천일정 등록은 상품업데이트 왼쪽의 상단 버튼에서 후보 목록을 연다", () => {
  assert.match(dashboard, /data-action="recommendation-show-candidates">추천일정 등록<\/button>\s*<button[^>]*data-action="recommendation-refresh-products">상품업데이트/s);
  assert.doesNotMatch(dashboard, />상품 후보 보기<\/button>/);
  assert.match(dashboard, /recommendationShowCandidatesButton[\s\S]*state\.recommendationSchedulePhase = "";[\s\S]*renderTable\(\);/);
});

test("v78 진행·종료 목록은 중복 제목·상태 없이 일정 유형을 상품명 바로 옆에 표시한다", () => {
  assert.doesNotMatch(dashboard, /class="recommendation-status-view-title"/);
  assert.doesNotMatch(dashboard, /class="recommendation-manager-status"/);
  assert.match(dashboard, /recommendation-registered-title[^\n]*\$\{escapeHtml\(title\)\}[^\n]*\n\s*<span class="recommendation-type-badge">\$\{escapeHtml\(typeLabel\)\}<\/span>/);
  assert.match(dashboard, /isMonthlyRecommendationRule\(rule\) \? "단체" : "일반"/);
  assert.doesNotMatch(dashboard, /class="recommendation-status-badge/);
  assert.doesNotMatch(dashboard, /현재 \$\{currentPeople\}명 · 행사/);
});

test("v78 등록 일정 제목과 메타 글자 스타일이 요청값과 일치한다", () => {
  assert.match(dashboard, /\.recommendation-registered-title\s*\{[^}]*font-size:\s*18px;[^}]*font-weight:\s*700;[^}]*line-height:\s*1\.4;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap/s);
  assert.match(dashboard, /\.recommendation-registered-meta\s*\{[^}]*color:\s*var\(--muted\);[^}]*font-size:\s*15px;[^}]*font-weight:\s*600;[^}]*line-height:\s*1\.4/s);
  assert.match(dashboard, /\.recommendation-type-badge\s*\{[^}]*min-height:\s*25px;[^}]*border:\s*1px solid var\(--line\);[^}]*border-radius:\s*8px;[^}]*background:\s*var\(--panel\);[^}]*padding:\s*0 6px/s);
  assert.match(dashboard, /\.recommendation-capacity-input\s*\{[^}]*font-size:\s*17px;[^}]*font-weight:\s*700;[^}]*text-align:\s*right/s);
  assert.doesNotMatch(dashboard, /\.recommendation-capacity-editor \.recommendation-capacity-input\s*\{/);
});
