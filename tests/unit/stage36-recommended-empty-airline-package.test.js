"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "deploy/stage36-recommended-schedule-detail/calendar-availability-cleanup-20260824-v36e"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readRecord(key) {
  const record = manifest.files[key];
  assert.ok(record?.fileName, `${key} record`);
  const value = fs.readFileSync(path.join(PACKAGE_ROOT, record.fileName));
  assert.equal(value.length, record.bytes, `${key} bytes`);
  assert.equal(sha256(value), record.sha256, `${key} sha256`);
  return value;
}

test("v36e는 신규 불변 자산과 18E75B58 복구본을 자체 보존한다", () => {
  assert.equal(manifest.javascriptBudget.passed, true);
  Object.keys(manifest.files).forEach(readRecord);
  assert.equal(
    sha256(readRecord("rollbackHtml")),
    "18e75b588af269ff78e9fb240e05d5a036a3e61b3996ff6815d62e69a6885453"
  );
  const html = readRecord("deployHtml").toString("utf8");
  assert.match(html, new RegExp(manifest.assetRevision));
  assert.match(html, /golfjoin-main\.css" integrity="sha256-/);
  assert.match(html, /golfjoin-main\.js" integrity="sha256-/);
});

test("v36e JavaScript는 빈 추천일정 UI와 캘린더 초록 원 표시를 함께 지원한다", () => {
  const js = zlib.brotliDecompressSync(readRecord("js")).toString("utf8");
  new vm.Script(js, { filename: manifest.names.js });
  assert.match(js, /isAdminRecommendedSchedule/);
  assert.match(js, /detail-participant-status-pills/);
  assert.match(js, /team-row detail-team/);
  assert.match(js, /detail-participant-gender/);
  assert.match(js, /detail-participant-match-reasons/);
  assert.match(js, /join-recommended-schedule-chip/);
  assert.match(js, /&#x2728;추천일정/);
  assert.match(js, /join-flight-chip-airline-image/);
  assert.match(js, /golfjoin_img\/air_/);
  assert.match(js, /항공포함/);
  assert.match(js, /항공불포함/);
  assert.doesNotMatch(js, /calendar-event monthly|calendar-event domestic|calendar-event overseas/);
});

test("v36e CSS는 통일 칩과 PC 캘린더 스크롤·공휴일 간격을 적용한다", () => {
  const css = zlib.gunzipSync(readRecord("css")).toString("utf8");
  assert.equal((css.match(/--font-card-category:\s*13px;/g) || []).length, 3);
  assert.match(
    css,
    /\.join-flight-chip\s*\{[\s\S]*?height:\s*25px;[\s\S]*?border:\s*1px solid var\(--border\);[\s\S]*?background:\s*#ffffff;[\s\S]*?color:\s*#373a3c;/
  );
  assert.match(
    css,
    /\.join-flight-chip-airline-image\s*\{[\s\S]*?width:\s*15px;[\s\S]*?height:\s*15px;[\s\S]*?flex:\s*0 0 15px;[\s\S]*?border-radius:\s*50%;[\s\S]*?object-fit:\s*cover;[\s\S]*?background:\s*#ffffff;/
  );
  assert.match(css, /\.join-flight-chip\.excluded\s*\{[\s\S]*?background:\s*#ffffff;[\s\S]*?color:\s*#373a3c;/);
  assert.match(css, /\.join-recommended-schedule-chip\s*\{[\s\S]*?height:\s*25px;[\s\S]*?border:\s*1px solid var\(--border\);[\s\S]*?background:\s*#ffffff;[\s\S]*?color:\s*#373a3c;/);
  assert.match(css, /\.calendar-cell\.has-data \.calendar-day-button strong::after\s*\{[\s\S]*?background:\s*var\(--calendar-available-color\);/);
  assert.match(css, /@media \(min-width: 641px\)\s*\{[\s\S]*?\.calendar-sheet-body\s*\{[\s\S]*?padding-right:\s*0;/);
  assert.match(css, /\.calendar-sheet-body > \.calendar-desktop-months,[\s\S]*?margin-right:\s*20px;/);
  assert.match(css, /@media \(min-width: 641px\)\s*\{[\s\S]*?\.calendar-holiday-label\s*\{[\s\S]*?top:\s*calc\(50% \+ -0px\);/);
});
