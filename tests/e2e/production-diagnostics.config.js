"use strict";

const { defineConfig } = require("@playwright/test");
const baseConfig = require("./playwright.config");

module.exports = defineConfig({
  ...baseConfig,
  testDir: "./production-diagnostics",
  outputDir: "../../test-results/e2e-production-diagnostics",
  timeout: 120_000,
  expect: { timeout: 45_000 }
});
