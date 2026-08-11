"use strict";

const { defineConfig } = require("@playwright/test");
const baseConfig = require("./playwright.config");

module.exports = defineConfig({
  ...baseConfig,
  testDir: "./member",
  testMatch: "member-participant-state.spec.js",
  outputDir: "../../test-results/e2e-participation",
  timeout: 120_000,
  expect: { timeout: 30_000 }
});
