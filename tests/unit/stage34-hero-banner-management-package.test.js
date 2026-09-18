"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(ROOT, "deploy/stage34-hero-banner-management/dashboard-hero-banners-20260821-v34j");
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sri(value) {
  return `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;
}

function readByName(name) {
  return fs.readFileSync(path.join(PACKAGE_ROOT, name));
}

test("34단계 배포 파일은 선언한 크기와 해시를 모두 보존한다", () => {
  assert.equal(manifest.schema, "secret-golf-join-hero-banner-management-v1");
  Object.values(manifest.files).forEach((record) => {
    const buffer = readByName(record.fileName);
    assert.equal(buffer.length, record.bytes, record.fileName);
    assert.equal(sha256(buffer), record.sha256, record.fileName);
  });
});

test("메인 후보 HTML은 gzip CSS·Brotli JS의 논리 SRI와 신규 불변 경로를 사용한다", () => {
  const css = zlib.gunzipSync(readByName(manifest.names.css));
  const js = zlib.brotliDecompressSync(readByName(manifest.names.js));
  const html = readByName(manifest.names.mainDeploy).toString("utf8");
  new vm.Script(js.toString("utf8"), { filename: "stage34-golfjoin-main.js" });
  assert.match(html, new RegExp(manifest.assetRevision));
  assert.match(html, new RegExp(sri(css).replace(/[+\/]/g, "\\$&")));
  assert.match(html, new RegExp(sri(js).replace(/[+\/]/g, "\\$&")));
  assert.match(js.toString("utf8"), /hero-banners\/manifest\.json/);
  assert.match(js.toString("utf8"), /5e3/);
  assert.ok(html.length > 400000, "기존 critical HTML 구조를 보존해야 합니다.");
});

test("대시보드 후보는 배너관리 메뉴와 Secret Tour 상대경로 미리보기를 포함한다", () => {
  const html = readByName(manifest.names.dashboardDeploy).toString("utf8");
  assert.match(html, /data-menu="banner-management"/);
  assert.match(html, /function getHeroBannerPreviewUrl\(value = ""\)/);
  assert.match(html, /SECRET_TOUR_PUBLIC_ORIGIN/);
  assert.match(html, /admin_hero_banners_save/);
  const start = html.lastIndexOf("<script>") + "<script>".length;
  const end = html.lastIndexOf("</script>");
  new vm.Script(html.slice(start, end), { filename: "stage34-dashboard.js" });
});

test("서버 후보는 배너 API를 포함하고 복구본은 기존 견적 쉼표 보완만 보존한다", () => {
  const next = readByName(manifest.names.serverIndex).toString("utf8");
  const rollback = readByName(manifest.names.serverRollback).toString("utf8");
  assert.match(next, /admin_hero_banners_save/);
  assert.match(next, /require\("\.\/hero-banners"\)/);
  assert.doesNotMatch(rollback, /admin_hero_banners_save/);
  assert.match(rollback, /split\(\/\\r\?\\n\/\)/);
});

test("복구 파일은 검증된 직전 메인·대시보드 해시를 유지한다", () => {
  assert.equal(sha256(readByName(manifest.names.mainRollback)), "7502bfea9565366b1fae66944f2d76e882354a25a11d9f6999fe3cb1fad8ff89");
  assert.equal(sha256(readByName(manifest.names.dashboardRollback)), "e2fd6338610e7662a6b6ac33fcdd8e1fcf4543c31c7a3953b778aab524a0ed00");
});
