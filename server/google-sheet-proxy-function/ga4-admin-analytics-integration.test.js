"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

test("관리자 GA4 개요·상세 action은 전용 속성과 관리자 인증·비공개 캐시 정책을 사용한다", () => {
  assert.match(source, /GA4_PROPERTY_ID\s*=\s*String\(process\.env\.GA4_PROPERTY_ID\s*\|\|\s*"552152254"\)/);
  assert.match(source, /privateActions\s*=\s*new Set\(\[[\s\S]*?"admin_ga4_overview"/);
  assert.match(source, /privateActions\s*=\s*new Set\(\[[\s\S]*?"admin_ga4_dashboard"/);
  assert.match(source, /standaloneActions\s*=\s*new Set\(\[[\s\S]*?"admin_ga4_overview"/);
  assert.match(source, /standaloneActions\s*=\s*new Set\(\[[\s\S]*?"admin_ga4_dashboard"/);
  assert.match(
    source,
    /async function proxyAdminGa4Overview\(req, res\) \{[\s\S]*?if \(!isAdminReadRequest\(req\)\)[\s\S]*?ga4AdminAnalytics\.requestOverview/
  );
  assert.match(
    source,
    /req\.query\?\.action === "admin_ga4_overview"[\s\S]*?await proxyAdminGa4Overview\(req, res\);[\s\S]*?return;/
  );
  assert.match(
    source,
    /async function proxyAdminGa4Dashboard\(req, res\) \{[\s\S]*?if \(!isAdminReadRequest\(req\)\)[\s\S]*?ga4AdminAnalytics\.requestDashboard/
  );
  assert.match(
    source,
    /req\.query\?\.action === "admin_ga4_dashboard"[\s\S]*?await proxyAdminGa4Dashboard\(req, res\);[\s\S]*?return;/
  );
});
