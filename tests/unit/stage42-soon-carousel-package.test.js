"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(ROOT, "deploy/stage42-soon-carousel/soon-best-swipe-20260831-v42d");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("v42d 배포 묶음은 불변 CSS·JS와 v41e 복구본을 보존한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
  assert.match(manifest.assetRevision, /^gha_[a-f0-9]{24}$/);
  assert.equal(manifest.features.ga4V41ePreserved, true);
  assert.equal(manifest.javascriptBudget.passed, true);
  Object.values(manifest.files).forEach((record) => {
    const value = fs.readFileSync(path.join(PACKAGE_ROOT, record.fileName));
    assert.equal(value.length, record.bytes, `${record.fileName} bytes`);
    assert.equal(sha256(value), record.sha256, `${record.fileName} sha256`);
  });
});

test("v42d 압축 자산은 곧 출발 모바일 레일·공통 도트·탭 초기화를 포함한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
  const css = zlib.gunzipSync(fs.readFileSync(path.join(PACKAGE_ROOT, manifest.names.css))).toString("utf8");
  const js = zlib.brotliDecompressSync(fs.readFileSync(path.join(PACKAGE_ROOT, manifest.names.js))).toString("utf8");
  new vm.Script(js, { filename: manifest.names.js });
  assert.match(css, /\.layout-soon \.join-grid::after/);
  assert.match(css, /\.layout-soon \.join-card,[\s\S]*?scroll-snap-align: center/);
  assert.match(css, /\.layout-soon \.join-grid::before \{[\s\S]*?position: static;[\s\S]*?width: auto;/);
  assert.match(css, /@media \(min-width: 641px\)[\s\S]*?\.layout-soon \.join-slide-dots,[\s\S]*?display: none !important;/);
  assert.match(js, /data-slide-dots/);
  assert.match(js, /isHomeJoinCardRailKey/);
  assert.match(js, /resetSoonRail/);
  assert.match(js, /alignHomeRenderScrollActiveItem\([\w$]+,0\)/);
});
