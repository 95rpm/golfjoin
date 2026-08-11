"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function extractFunction(source, functionName) {
  const declaration = `function ${functionName}`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const signatureEnd = source.indexOf(") {", start);
  assert.notEqual(signatureEnd, -1, `${functionName} signature not found`);
  const bodyStart = signatureEnd + 2;
  assert.notEqual(bodyStart, -1, `${functionName} body not found`);

  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${functionName} body is incomplete`);
}

test("최신 참여자 요약을 적용할 때 이전 공개 미리보기 아이콘을 먼저 제거한다", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = extractFunction(html, "applyLightParticipantSummary");
  const join = {
    id: "sheet-builder-application-sch_test",
    scheduleId: "sch_test",
    sourceApplicationId: "nsa_test",
    isBuilderApplicationJoin: true,
    participants: [
      { id: "creator", status: "confirmed", isHost: true },
      { id: "creator-companion", status: "confirmed" },
      {
        id: "stale-cancelled-preview",
        source: "participant_summary_preview",
        previewSeed: "preview_cancelled_b",
        status: "confirmed"
      }
    ],
    emptySlots: 1
  };
  let mergeExistingIds = [];

  const sandbox = {
    findJoinForParticipantSummary() {
      return join;
    },
    isJoinMyBuilderApplicationJoin() {
      return true;
    },
    getJoinRecruitmentCapacity() {
      return 4;
    },
    MAX_DETAIL_PARTICIPANT_PREVIEWS: 4,
    BUILDER_APPLICATION_MAX_CAPACITY: 4,
    getConfirmedParticipants(target) {
      return (target.participants || []).filter((participant) => participant.status === "confirmed");
    },
    getLightCreatorPreviewPrefixCount() {
      return 2;
    },
    buildLightPreviewParticipant(preview) {
      return { ...preview, source: "participant_summary_preview", status: "confirmed" };
    },
    isJoinParticipantPreviewSource(participant) {
      return participant.source === "participant_summary_preview";
    },
    mergeJoinParticipantsByIdentity(existing, previews) {
      mergeExistingIds = existing.map((participant) => participant.id);
      return [...existing, ...previews];
    },
    ensureJoinParticipantSummaryCount(target, participants) {
      return participants;
    },
    applyLightParticipantsToJoin() {
      throw new Error("unexpected non-builder path");
    }
  };

  vm.runInNewContext(`${source}; globalThis.applyForTest = applyLightParticipantSummary;`, sandbox);
  sandbox.applyForTest({
    targetScheduleId: "sch_test",
    capacity: 4,
    confirmedCount: 2,
    remainingSlots: 2,
    participantsPreview: [{ id: "creator" }, { id: "creator-companion" }]
  });

  assert.deepEqual(mergeExistingIds, ["creator", "creator-companion"]);
  assert.deepEqual(join.participants.map((participant) => participant.id), ["creator", "creator-companion"]);
  assert.equal(join.emptySlots, 2);
});
