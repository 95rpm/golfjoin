"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/detail/37-detail-builder-calendar.js"),
  "utf8"
);

function loadStepTracking() {
  const start = SOURCE.indexOf("function getBuilderGa4StepName");
  const end = SOURCE.indexOf("function getDetailGa4SourceArea", start);
  assert.ok(start >= 0, "step helper start");
  assert.ok(end > start, "step helper end");

  const calls = [];
  const context = vm.createContext({
    Set,
    Number,
    String,
    golfJoinApplyGa4Steps: new Set(),
    golfJoinBuilderGa4Steps: new Set(),
    golfJoinBuilderGa4SourceArea: "hero",
    builderState: {
      productId: "schedule_1",
      productName: "다낭 3박 5일",
      region: "다낭"
    },
    getBuilderSelectedFixedProduct() {
      return null;
    },
    getCurrentApplyJoin() {
      return { id: "join_1", title: "후쿠오카 조인", region: "후쿠오카" };
    },
    getGolfJoinGa4Item(join) {
      return {
        item_id: join?.id || "",
        item_name: join?.title || "",
        item_category: join?.region || ""
      };
    },
    trackGolfJoinGa4Event(eventName, parameters) {
      calls.push({ eventName, parameters });
      return true;
    }
  });

  new vm.Script(SOURCE.slice(start, end), {
    filename: "ga4-internal-step-helpers.js"
  }).runInContext(context);
  return { context, calls };
}

test("새 모임 단계 번호를 안정된 이름으로 바꾸고 같은 단계는 한 번만 전송한다", () => {
  const { context, calls } = loadStepTracking();

  assert.equal(context.trackGolfJoinBuilderStep(1), true);
  assert.equal(context.trackGolfJoinBuilderStep(1), false);
  assert.equal(context.trackGolfJoinBuilderStep(2), true);
  assert.equal(context.trackGolfJoinBuilderStep("review"), true);

  assert.deepEqual(calls.map((call) => call.parameters.builder_step), [
    "date_selection",
    "destination_selection",
    "review"
  ]);
  assert.equal(calls[0].parameters.flow_type, "new_schedule");
  assert.equal(calls[0].parameters.source_area, "hero");
  assert.equal(calls[0].parameters.item_id, "schedule_1");
});

test("참여 신청은 모달 1회 안에서 단계별 한 번만 전송하고 새 모달에서는 다시 센다", () => {
  const { context, calls } = loadStepTracking();

  assert.equal(context.trackGolfJoinApplyStep("form_view"), true);
  assert.equal(context.trackGolfJoinApplyStep("form_view"), false);
  assert.equal(context.trackGolfJoinApplyStep("submit_start", { participant_count: 2 }), true);
  context.golfJoinApplyGa4Steps.clear();
  assert.equal(context.trackGolfJoinApplyStep("form_view"), true);

  const applyCalls = calls.filter((call) => call.eventName === "golfjoin_apply_step_view");
  assert.deepEqual(applyCalls.map((call) => call.parameters.apply_step), [
    "form_view",
    "submit_start",
    "form_view"
  ]);
  assert.equal(applyCalls[1].parameters.participant_count, 2);
  assert.equal(applyCalls[0].parameters.flow_type, "join_apply");
  assert.equal(applyCalls[0].parameters.item_id, "join_1");
});
