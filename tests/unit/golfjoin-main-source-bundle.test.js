"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertWorkspacePath,
  sha256,
  splitAtAnchor,
  splitBetweenAnchors,
  splitMainHtml,
  splitMarkedRegion
} = require("../../tools/golfjoin-main/source-bundle");

test("CRLF와 한글을 포함한 단일 HTML을 손실 없이 분해하고 다시 합친다", () => {
  const source = Buffer.from([
    "<!doctype html>\r\n",
    "<script>early();</script>\r\n",
    "<style>\r\n.한글 { color: red; }\r\n</style>\r\n",
    "<main>화면</main>\r\n",
    "<script>\r\nfunction boot() { return '정상'; }\r\n</script>\r\n"
  ].join(""), "utf8");
  const parts = splitMainHtml(source);
  const rebuilt = Buffer.concat(parts);
  assert.equal(parts.length, 5);
  assert.equal(rebuilt.equals(source), true);
  assert.equal(sha256(rebuilt), sha256(source));
});

test("다음 기능 시작점에서 두 파일로 나누고 원래 바이트를 유지한다", () => {
  const source = Buffer.from("function member() {}\r\n  function detail() {}\r\n", "utf8");
  const parts = splitAtAnchor(source, "function detail");
  assert.equal(parts[0].toString("utf8"), "function member() {}\r\n");
  assert.equal(parts[1].toString("utf8"), "  function detail() {}\r\n");
  assert.equal(Buffer.concat(parts).equals(source), true);
});

test("기능 시작점이 없거나 중복되면 두 파일 분리를 중단한다", () => {
  assert.throws(() => splitAtAnchor(Buffer.from("none"), "detail"), /not_found/);
  assert.throws(() => splitAtAnchor(Buffer.from("before\ndetail\ndetail"), "detail"), /not_unique/);
});

test("두 함수 경계 사이를 다음 함수 직전까지 손실 없이 분리한다", () => {
  const source = Buffer.from([
    "function before() {}\r\n",
    "  function start() {\r\n    return true;\r\n  }\r\n",
    "  function next() {}\r\n"
  ].join(""), "utf8");
  const parts = splitBetweenAnchors(source, "function start", "function next");
  assert.equal(parts[1].toString("utf8"), "  function start() {\r\n    return true;\r\n  }\r\n");
  assert.equal(Buffer.concat(parts).equals(source), true);
});

test("함수 경계가 없거나 중복되면 구간 모듈을 분리하지 않는다", () => {
  assert.throws(() => splitBetweenAnchors(Buffer.from("none"), "start", "next"), /not_found/);
  assert.throws(
    () => splitBetweenAnchors(Buffer.from("start\nnext\nstart\nnext"), "start", "next"),
    /not_unique/
  );
});

test("style 또는 마지막 script 경계가 없으면 분해하지 않는다", () => {
  assert.throws(() => splitMainHtml(Buffer.from("<main>invalid</main>")), /boundaries_not_found/);
});

test("표식 블록을 줄바꿈까지 포함해 분리하고 원래 바이트 순서를 유지한다", () => {
  const source = Buffer.from("before\r\n  // START\r\n진단\r\n  // END\r\nafter\r\n", "utf8");
  const parts = splitMarkedRegion(source, "// START", "// END");
  assert.equal(parts[1].toString("utf8"), "  // START\r\n진단\r\n  // END\r\n");
  assert.equal(Buffer.concat(parts).equals(source), true);
});

test("표식이 없거나 중복되면 기능 모듈을 분리하지 않는다", () => {
  assert.throws(() => splitMarkedRegion(Buffer.from("none"), "START", "END"), /not_found/);
  assert.throws(
    () => splitMarkedRegion(Buffer.from("START\nEND\nSTART\nEND"), "START", "END"),
    /not_unique/
  );
});

test("빌드 출력은 작업공간 안에서만 허용한다", () => {
  assert.throws(() => assertWorkspacePath("D:/outside-golfjoin-main.html"), /output_outside_workspace/);
  assert.doesNotThrow(() => assertWorkspacePath("dist/golfjoin-main/golfjoin_main.html"));
});
