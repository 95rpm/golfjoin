"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE = path.join(
  ROOT,
  "deploy/stage37-member-identity/contact-pending-birthdate-20260828-v37l"
);
const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

test("v37l 배포 파일은 선언 해시와 압축 JavaScript 문법을 보존한다", () => {
  Object.values(manifest.files).forEach((entry) => {
    const buffer = fs.readFileSync(path.join(PACKAGE, entry.fileName));
    assert.equal(buffer.length, entry.bytes, entry.fileName);
    assert.equal(sha256(buffer), entry.sha256, entry.fileName);
  });
  const jsEntry = manifest.files.js;
  const js = zlib.brotliDecompressSync(fs.readFileSync(path.join(PACKAGE, jsEntry.fileName)));
  assert.doesNotThrow(() => new vm.Script(js.toString("utf8")));
});

test("v37l은 모바일 생년월일 전용 보완창 제목을 div로 배포한다", () => {
  const html = fs.readFileSync(path.join(PACKAGE, manifest.names.deployHtml), "utf8");
  const dashboard = fs.readFileSync(path.join(PACKAGE, manifest.names.dashboard), "utf8");
  const server = fs.readFileSync(path.join(PACKAGE, manifest.names.serverIndex), "utf8");
  const js = zlib.brotliDecompressSync(fs.readFileSync(path.join(PACKAGE, manifest.names.js))).toString("utf8");

  assert.match(html, /id="joinMemberSignupBirthYear"[^>]*aria-label="출생 연도"/);
  assert.match(html, /id="joinMemberSignupBirthMonth"[^>]*aria-label="출생 월"/);
  assert.match(html, /id="joinMemberSignupBirthDay"[^>]*aria-label="출생 일"/);
  assert.match(dashboard, /data-roster-field="contactPending"/);
  assert.match(dashboard, /placeholder="yyyymmdd"/);
  assert.match(server, /member_pending_roster_candidates/);
  assert.match(server, /name_birthdate_gender_confirmed/);
  assert.match(js, /맞아요, 내 일정이에요/);
  assert.match(js, /생년월일을 입력해주세요\./);
  assert.match(js, /원활한 여행 예약을 위해 생년월일이 필요해요\./);
  assert.match(js, /joinMemberBirthDateUpgradeYear/);
  assert.equal(manifest.features.legacyBirthYearProfileCompatibility, true);
  assert.equal(manifest.features.existingMemberBirthDateUpgradePrompt, true);
  assert.equal(manifest.features.profileManageBirthDateDropdownFix, true);
  assert.equal(manifest.features.profileManageBirthDateCustomDropdown, true);
  assert.equal(manifest.features.mobileBirthDateUpgradeHeaderFix, true);
  assert.equal(manifest.features.mobileBirthDateUpgradeSingleTitle, true);
  assert.equal(manifest.features.mobileBirthDateUpgradeCompactLayout, true);
  assert.equal(manifest.features.mobileBirthDateUpgradeDivTitle, true);
  assert.equal(manifest.features.serverRedeployRequired, false);
  assert.equal(manifest.features.dashboardRedeployRequired, false);
});
