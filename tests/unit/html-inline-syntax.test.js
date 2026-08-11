"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

test("all executable inline scripts in the main HTML parse successfully", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());

  assert.equal(scripts.length, 2);
  scripts.forEach((source, index) => {
    assert.doesNotThrow(
      () => new Function(source),
      `inline script ${index + 1} has invalid JavaScript syntax`
    );
  });
});
