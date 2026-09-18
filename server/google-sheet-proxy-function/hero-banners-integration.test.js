"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const indexSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

test("Hero 배너 관리는 관리자 세션이 필요한 독립 action으로 연결된다", () => {
  assert.match(indexSource, /require\("\.\/hero-banners"\)/);
  assert.match(indexSource, /"admin_hero_banners_get"/);
  assert.match(indexSource, /"admin_hero_banners_save"/);
  assert.match(indexSource, /async function proxyAdminHeroBannersGet\(req, res\)/);
  assert.match(indexSource, /async function proxyAdminHeroBannersSave\(req, res\)/);
  assert.match(indexSource, /assertHeroBannerAdminRequest\(req\)/);
  assert.match(indexSource, /saveHeroBannerManifest\(context\.bucket, payload\.items/);
});
