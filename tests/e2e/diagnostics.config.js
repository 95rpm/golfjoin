"use strict";

const { defineConfig } = require("@playwright/test");
const baseConfig = require("./playwright.config");

module.exports = defineConfig({
  ...baseConfig,
  testDir: "./diagnostics",
  outputDir: "../../test-results/e2e-diagnostics",
  timeout: 90_000,
  expect: { timeout: 30_000 }
});
