"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../..");
const detail = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/scripts/detail/39-detail-actions-participants.js"),
  "utf8"
);
const loading = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/scripts/loading/33-loading-and-modal-layer.js"),
  "utf8"
);
const css = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/styles/10-main.css"),
  "utf8"
);

test("상세 모달의 wheel 상태 초기화는 passive 리스너를 한 번만 등록한다", () => {
  assert.doesNotMatch(detail, /\.onwheel\s*=/);
  assert.match(detail, /dataset\.passiveAnchorResetBound !== "true"/);
  assert.match(
    detail,
    /addEventListener\("wheel", clearDetailForcedAnchorState, \{ passive: true \}\)/
  );
  assert.match(
    detail,
    /addEventListener\("touchstart", clearDetailForcedAnchorState, \{ passive: true \}\)/
  );
});

test("문서 전체에는 non-passive wheel 차단기를 등록하지 않는다", () => {
  assert.doesNotMatch(detail, /\["wheel", "touchmove"\]/);
  assert.doesNotMatch(
    detail,
    /addEventListener\(\s*"wheel"[\s\S]{0,200}?passive:\s*false/
  );
});

test("모바일 touchmove 차단과 CSS 스크롤 잠금은 유지한다", () => {
  assert.match(detail, /isJoinActionLoadingOpen\(\)[\s\S]{0,180}?passive: false, capture: true/);
  assert.match(detail, /isParticipantModalBackgroundScrollBlocked\(\)[\s\S]{0,260}?passive: false, capture: true/);
  assert.match(loading, /function openJoinActionLoading[\s\S]*?setWidgetModalOpen\(true\)/);
  assert.match(css, /html\.modal-open,[\s\S]{0,220}?overflow: hidden !important;[\s\S]{0,120}?touch-action: none;/);
  assert.match(css, /body\.join-participant-scroll-locked[\s\S]{0,160}?overflow: hidden !important;/);
});
