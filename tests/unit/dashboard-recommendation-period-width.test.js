const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const dashboard = fs.readFileSync(
  path.join(__dirname, "..", "..", "golfjoin_admin_dashboard.html"),
  "utf8"
);

test("추천일정 기간 열은 최소 172px을 유지한다", () => {
  assert.match(
    dashboard,
    /\.recommendation-table th:nth-child\(5\),\s*\.recommendation-table td:nth-child\(5\)\s*\{[^}]*width:\s*172px;[^}]*min-width:\s*172px;[^}]*white-space:\s*normal;/s
  );
  assert.doesNotMatch(
    dashboard,
    /\.recommendation-table th:nth-child\(5\),\s*\.recommendation-table td:nth-child\(5\)\s*\{[^}]*max-width:/s
  );
});

test("추천일정 기간은 기존 두 열 배치와 최대 네 항목 표시를 유지한다", () => {
  assert.match(
    dashboard,
    /\.recommendation-period-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s
  );
  assert.match(
    dashboard,
    /const visibleLabels = labels\.length > 4\s*\? \[\.\.\.labels\.slice\(0, 3\), `외 \$\{labels\.length - 3\}개`\]\s*:\s*labels;/s
  );
});
