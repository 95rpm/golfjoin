"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function extractDiagnosticsSource(html) {
  const startMarker = "// GOLFJOIN_DIAGNOSTICS_START";
  const endMarker = "// GOLFJOIN_DIAGNOSTICS_END";
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  assert.notEqual(start, -1, "diagnostics start marker not found");
  assert.notEqual(end, -1, "diagnostics end marker not found");
  return html.slice(start, end);
}

function createPerformanceDouble() {
  const entries = [];
  let clock = 0;
  const findLastMark = (name) => entries.slice().reverse().find((entry) => entry.entryType === "mark" && entry.name === name);
  return {
    mark(name) {
      clock += 10;
      entries.push({ name, entryType: "mark", startTime: clock, duration: 0 });
    },
    measure(name, startName, endName) {
      const start = findLastMark(startName);
      const end = findLastMark(endName);
      if (!start || !end) throw new Error("missing performance mark");
      entries.push({
        name,
        entryType: "measure",
        startTime: start.startTime,
        duration: Math.max(0, end.startTime - start.startTime)
      });
    },
    clearMarks(name) {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        if (entries[index].entryType === "mark" && (!name || entries[index].name === name)) entries.splice(index, 1);
      }
    },
    clearMeasures(name) {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        if (entries[index].entryType === "measure" && (!name || entries[index].name === name)) entries.splice(index, 1);
      }
    },
    getEntriesByType(type) {
      return entries.filter((entry) => entry.entryType === type).map((entry) => ({ ...entry }));
    }
  };
}

function loadDiagnostics() {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const captured = { warn: [], error: [], log: [] };
  const performance = createPerformanceDouble();
  const window = {
    performance,
    console: {
      warn: (...args) => captured.warn.push(args),
      error: (...args) => captured.error.push(args),
      log: (...args) => captured.log.push(args)
    }
  };
  const sandbox = { window, document: {}, URL };
  vm.createContext(sandbox);
  vm.runInContext(`${extractDiagnosticsSource(html)}
    globalThis.__diagnostics = {
      registerGolfJoinDiagnosticPrivateValues,
      sanitizeGolfJoinDiagnosticString,
      sanitizeGolfJoinDiagnosticValue,
      golfJoinSafeWarn,
      golfJoinSafeError,
      golfJoinSafeLog,
      markGolfJoinPerformance,
      markGolfJoinPerformanceOnce,
      measureGolfJoinPerformance,
      beginGolfJoinDetailPerformance,
      finishGolfJoinDetailPerformance,
      getGolfJoinPerformanceSnapshot
    };`, sandbox);
  return { diagnostics: sandbox.__diagnostics, captured, performance };
}

test("diagnostic values redact member identity, contacts, IDs, and complete query strings", () => {
  const { diagnostics } = loadDiagnostics();
  diagnostics.registerGolfJoinDiagnosticPrivateValues({
    memberName: "테스트회원",
    memberKey: "seq:30002047",
    memberId: "2783624471",
    mobile: "010-6246-6167",
    email: "member@example.com"
  });

  const sanitized = diagnostics.sanitizeGolfJoinDiagnosticValue({
    stage: "join-save",
    status: "failed",
    memberName: "테스트회원",
    applicantMobile: "01062466167",
    memberEmail: "member@example.com",
    memberKey: "seq:30002047",
    requestUrl: "https://example.com/api/path?memberKey=seq%3A30002047&memberEmail=member%40example.com",
    relativeUrl: "/event/plan_view?eventPlanSeq=3&page=1",
    serverBody: JSON.stringify({ memberId: "2783624471", message: "테스트회원 01062466167 member@example.com" })
  });
  const serialized = JSON.stringify(sanitized);

  assert.equal(sanitized.stage, "join-save");
  assert.equal(sanitized.status, "failed");
  assert.equal(sanitized.memberName, "[redacted]");
  assert.equal(sanitized.applicantMobile, "[redacted]");
  assert.equal(sanitized.requestUrl, "https://example.com/api/path");
  assert.equal(sanitized.relativeUrl, "/event/plan_view");
  [
    "테스트회원", "01062466167", "010-6246-6167", "member@example.com",
    "seq:30002047", "2783624471", "eventPlanSeq=3", "memberKey=seq"
  ].forEach((secret) => assert.equal(serialized.includes(secret), false, `secret leaked: ${secret}`));
});

test("safe console wrappers only forward sanitized arguments", () => {
  const { diagnostics, captured } = loadDiagnostics();
  diagnostics.registerGolfJoinDiagnosticPrivateValues({ memberName: "테스트회원" });
  diagnostics.golfJoinSafeError("테스트회원 요청 실패", {
    phone: "01062466167",
    endpoint: "https://example.com/save?memberId=2783624471",
    status: 500
  });

  assert.equal(captured.error.length, 1);
  const serialized = JSON.stringify(captured.error[0]);
  assert.equal(serialized.includes("테스트회원"), false);
  assert.equal(serialized.includes("01062466167"), false);
  assert.equal(serialized.includes("memberId=2783624471"), false);
  assert.equal(serialized.includes("https://example.com/save"), true);
  assert.equal(serialized.includes("500"), true);
});

test("performance diagnostics accept static marks only and expose metadata without detail payloads", () => {
  const { diagnostics } = loadDiagnostics();

  assert.equal(diagnostics.markGolfJoinPerformance("golfjoin:detail:30001104"), false);
  assert.equal(diagnostics.markGolfJoinPerformance("golfjoin:boot:start", { once: true }), true);
  assert.equal(diagnostics.markGolfJoinPerformance("golfjoin:boot:interactive", { once: true }), true);
  assert.equal(diagnostics.measureGolfJoinPerformance(
    "golfjoin:duration:boot-interactive",
    "golfjoin:boot:start",
    "golfjoin:boot:interactive"
  ), true);
  const generation = diagnostics.beginGolfJoinDetailPerformance();
  assert.equal(diagnostics.finishGolfJoinDetailPerformance(
    generation,
    "golfjoin:detail:visible",
    "golfjoin:duration:detail-visible"
  ), true);
  assert.equal(diagnostics.finishGolfJoinDetailPerformance(
    generation - 1,
    "golfjoin:detail:erp-ready",
    "golfjoin:duration:detail-erp"
  ), false);

  const snapshot = diagnostics.getGolfJoinPerformanceSnapshot();
  assert.ok(snapshot.some((entry) => entry.name === "golfjoin:duration:boot-interactive"));
  assert.ok(snapshot.some((entry) => entry.name === "golfjoin:duration:detail-visible"));
  snapshot.forEach((entry) => {
    assert.deepEqual(Object.keys(entry), ["name", "entryType", "startTime", "duration"]);
    assert.match(entry.name, /^golfjoin:/);
  });
  assert.equal(JSON.stringify(snapshot).includes("30001104"), false);
});

test("main page routes diagnostic warn/error/log calls through the sanitizer and wires all stage marks", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  assert.doesNotMatch(html, /\bconsole\.(?:warn|error|log)\s*\(/);
  assert.match(html, /markGolfJoinPerformance\("golfjoin:boot:start", \{ once: true \}\)/);
  assert.match(html, /"golfjoin:boot:products-ready"/);
  assert.match(html, /"golfjoin:private:ready"/);
  assert.match(html, /"golfjoin:mdpick:data-ready"/);
  assert.match(html, /"golfjoin:mdpick:primary-dom-ready"/);
  assert.match(html, /observeGolfJoinMdPickFirstImageReady\(mdPickSection\)/);
  assert.ok((html.match(/beginGolfJoinDetailPerformance\(\)/g) || []).length >= 3);
  assert.match(html, /"golfjoin:detail:flight-ready"/);
});
