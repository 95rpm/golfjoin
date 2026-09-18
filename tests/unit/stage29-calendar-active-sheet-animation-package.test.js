"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "../..");
const packageRoot = path.join(
  root,
  "deploy/stage29-calendar-alimtalk/calendar-active-sheet-animation-20260820-v29g"
);
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readRecord(name) {
  const record = manifest.files[name];
  assert.ok(record?.fileName, `${name} fileName`);
  const buffer = fs.readFileSync(path.join(packageRoot, record.fileName));
  assert.equal(buffer.length, record.bytes, `${name} bytes`);
  assert.equal(sha256(buffer), record.sha256, `${name} sha256`);
  return { record, buffer };
}

test("29번 최초 카드 애니메이션 보완은 새 불변 리비전과 29번 HTML을 사용한다", () => {
  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.stagingEventPlanSeq, 29);
  assert.equal(manifest.assetRevision, "gha_e3e4167205a06e55851f526f");
  assert.equal(manifest.javascriptBudgetPassed, true);
});

test("29번 최초 카드 애니메이션 보완 파일은 크기와 해시가 모두 일치한다", () => {
  Object.keys(manifest.files).forEach(readRecord);
});

test("후보 JavaScript는 닫힌 좌표를 확정한 후 다음 프레임에 세로 열림을 시작한다", () => {
  const js = readRecord("js");
  const source = zlib.brotliDecompressSync(js.buffer).toString("utf8");
  assert.equal(sha256(Buffer.from(source, "utf8")), js.record.logicalSha256);
  new vm.Script(source, { filename: js.record.fileName });
  assert.match(source, /function cancelBuilderActiveScheduleOpenAnimation/);
  assert.match(source, /function startBuilderActiveScheduleOpenAnimation/);
  assert.match(source, /style\.setProperty\("transition","none"\)/);
  assert.match(source, /getBoundingClientRect\(\);const [A-Za-z_$][\w$]*=requestAnimationFrame/);
  assert.match(source, /requestAnimationFrame\(\(\)=>\{[\s\S]*?requestAnimationFrame\(\(\)=>/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /startBuilderActiveScheduleOpenAnimation\([A-Za-z_$][\w$]*\)/);

  const html = readRecord("deployHtml").buffer.toString("utf8");
  assert.match(html, /gha_e3e4167205a06e55851f526f/);
});
