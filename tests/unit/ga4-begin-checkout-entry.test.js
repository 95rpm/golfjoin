"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);

function extractFunction(name, nextName) {
  const start = SOURCE.indexOf(`function ${name}`);
  const end = SOURCE.indexOf(`function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} start`);
  assert.ok(end > start, `${name} end`);
  return SOURCE.slice(start, end);
}

test("참여 신청 추적은 실제 공통 신청 모달이 열린 뒤 실행한다", () => {
  const openDetailApply = extractFunction("openDetailApply", "closeDetailApply");
  const openGlobalApply = extractFunction("openGlobalApply", "refreshGlobalApplyProductDataInBackground");
  const overlayOpen = openGlobalApply.indexOf('overlay.classList.add("open")');
  const tracking = openGlobalApply.indexOf('trackGolfJoinGa4Event("golfjoin_apply_start"');

  assert.doesNotMatch(openDetailApply, /golfjoin_apply_start/);
  assert.ok(overlayOpen >= 0);
  assert.ok(tracking > overlayOpen);
  assert.match(openGlobalApply, /item_type:\s*"join_schedule"/);
  assert.match(openGlobalApply, /source_area:\s*"detail"/);
});
