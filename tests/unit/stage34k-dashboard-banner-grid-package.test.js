"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage34-hero-banner-management/dashboard-banner-grid-20260821-v34l"
);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v34l 대시보드 배포·복구 파일은 선언된 해시와 크기를 보존한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "MANIFEST.json"), "utf8"));
  assert.equal(manifest.schema, "golfjoin-dashboard-banner-grid-v1");
  assert.deepEqual(manifest.layout, { desktopColumns: 4, tabletColumns: 2, mobileColumns: 1 });
  Object.values(manifest.files).forEach((entry) => {
    const buffer = fs.readFileSync(path.join(PACKAGE_ROOT, entry.fileName));
    assert.equal(buffer.length, entry.bytes, `${entry.fileName} bytes`);
    assert.equal(sha256(buffer), entry.sha256, `${entry.fileName} sha256`);
  });
});

test("v34l 배포본은 배너관리 PC 4열·태블릿 2열·모바일 1열을 사용한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "MANIFEST.json"), "utf8"));
  const deployEntry = Object.values(manifest.files).find((entry) => entry.fileName.startsWith("DEPLOY_"));
  const html = fs.readFileSync(path.join(PACKAGE_ROOT, deployEntry.fileName), "utf8");
  assert.match(html, /\.banner-admin-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(html, /@media \(max-width: 1180px\)\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(html, /@media \(max-width: 780px\)\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(html, /\.banner-admin-card-foot\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(html, /\.banner-admin-card-actions\s*\{\s*display:\s*flex;\s*width:\s*100%/);
});

test("v34l 복구본은 현재 운영 대시보드 0FDC2D4B다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "MANIFEST.json"), "utf8"));
  const rollbackEntry = Object.values(manifest.files).find((entry) => entry.fileName.startsWith("ROLLBACK_"));
  assert.equal(rollbackEntry.sha256.slice(0, 8), "0fdc2d4b");
});
