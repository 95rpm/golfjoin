"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { resolveLocalMainHtmlPath } = require("../e2e/support/local-main-html");

test("E2E HTML 기본값은 루트 운영 기준 파일이다", () => {
  const previous = process.env.GOLFJOIN_E2E_MAIN_HTML_PATH;
  delete process.env.GOLFJOIN_E2E_MAIN_HTML_PATH;
  try {
    assert.equal(path.basename(resolveLocalMainHtmlPath()), "golfjoin_main.html");
  } finally {
    if (previous === undefined) delete process.env.GOLFJOIN_E2E_MAIN_HTML_PATH;
    else process.env.GOLFJOIN_E2E_MAIN_HTML_PATH = previous;
  }
});

test("E2E HTML은 작업공간 내부 경로만 허용한다", () => {
  const previous = process.env.GOLFJOIN_E2E_MAIN_HTML_PATH;
  process.env.GOLFJOIN_E2E_MAIN_HTML_PATH = "D:/outside-golfjoin-main.html";
  try {
    assert.throws(() => resolveLocalMainHtmlPath(), /outside_workspace/);
  } finally {
    if (previous === undefined) delete process.env.GOLFJOIN_E2E_MAIN_HTML_PATH;
    else process.env.GOLFJOIN_E2E_MAIN_HTML_PATH = previous;
  }
});

test("빌드된 dist HTML을 명시적으로 선택할 수 있다", () => {
  const previous = process.env.GOLFJOIN_E2E_MAIN_HTML_PATH;
  process.env.GOLFJOIN_E2E_MAIN_HTML_PATH = "dist/golfjoin-main/golfjoin_main.html";
  try {
    assert.match(resolveLocalMainHtmlPath(), /dist[\\/]golfjoin-main[\\/]golfjoin_main\.html$/);
  } finally {
    if (previous === undefined) delete process.env.GOLFJOIN_E2E_MAIN_HTML_PATH;
    else process.env.GOLFJOIN_E2E_MAIN_HTML_PATH = previous;
  }
});
