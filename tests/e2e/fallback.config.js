"use strict";

const { defineConfig } = require("@playwright/test");
const baseConfig = require("./playwright.config");

module.exports = defineConfig({
  ...baseConfig,
  testDir: "./fallback",
  outputDir: "../../test-results/e2e-fallback",
  timeout: 90_000
});
