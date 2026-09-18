"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dashboardPath = path.resolve(__dirname, "../../golfjoin_admin_dashboard.html");
const source = fs.readFileSync(dashboardPath, "utf8");

test("상품업데이트는 조인페이지용 discovery와 Release V2 활성화를 모두 확인한다", () => {
  assert.match(source, /data\.productDiscovery\?\.browserReadEnabled !== true/);
  assert.match(source, /data\.productDiscovery\?\.rootUpdatedLast !== true/);
  assert.match(source, /data\.releaseV2\?\.browserReadEnabled !== true/);
  assert.match(source, /data\.releaseV2\?\.rootUpdatedLast !== true/);
  assert.match(source, /data\.releaseV2\?\.shadow\?\.valid !== true/);
  assert.match(source, /Number\(data\.releaseV2\?\.shadow\?\.issueCount \|\| 0\) !== 0/);
});

test("상품업데이트 성공 시 조인페이지 반영 완료를 운영자에게 알린다", () => {
  assert.match(source, /showDashboardLoading\("상품정보를 업데이트하고 조인페이지에 반영하는 중입니다\."\)/);
  assert.match(source, /showFamilyPrototypeToast\("상품정보를 업데이트하고 조인페이지에 반영했습니다\."\)/);
});
