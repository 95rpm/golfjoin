"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dashboard = fs.readFileSync(path.resolve(__dirname, "../../golfjoin_admin_dashboard.html"), "utf8");

test("고객 취소는 전용 원자 작업과 취소 사유를 사용한다", () => {
  assert.match(dashboard, /action", "admin_participant_cancel"/);
  assert.match(dashboard, /inputLabel: "취소 사유"/);
  assert.match(dashboard, /inputRequired: true/);
  assert.match(dashboard, /expectedUpdatedAt: asText\(participant\.updatedAt\)/);
});

test("마지막 활성 인원 취소 결과는 일정취소 탭으로 이동한다", () => {
  assert.match(dashboard, /if \(response\.scheduleCancelled\)/);
  assert.match(dashboard, /statusFilter\.value = "cancelled"/);
  assert.match(dashboard, /메인페이지 노출도 차단했습니다/);
});

test("취소 참여자는 활성 집계에서 빠지고 명단 하단에 표시된다", () => {
  assert.match(dashboard, /function getActiveParticipantDisplayRows/);
  assert.match(dashboard, /Number\(isParticipantCancelled\(left\.row\)\) - Number\(isParticipantCancelled\(right\.row\)\)/);
  assert.match(dashboard, /participant-role-badge cancelled/);
  assert.match(dashboard, /참여 중 \$\{rosterCounts\.active\}\/\$\{capacity\}명/);
  assert.match(dashboard, /취소 \$\{rosterCounts\.cancelled\}명/);
});

test("결제 여부에 따라 환불 불필요·환불대기·환불완료를 구분한다", () => {
  assert.match(dashboard, /환불 불필요/);
  assert.match(dashboard, /환불대기/);
  assert.match(dashboard, /환불완료/);
  assert.match(dashboard, /renderParticipantPaymentReadonlyBadge/);
});

test("생성자 취소 후 참여자가 남으면 관리자 운영 상태를 보여준다", () => {
  assert.match(dashboard, /생성자 취소 · 관리자 운영/);
  assert.match(dashboard, /isParticipantCancelled\(schedule\.row \|\| \{\}\) && getParticipantRosterCounts\(schedule\)\.active > 0/);
});
