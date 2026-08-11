"use strict";

const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_MAIN_HTML_PATH = path.join(WORKSPACE_ROOT, "golfjoin_main.html");

function resolveLocalMainHtmlPath() {
  const requested = process.env.GOLFJOIN_E2E_MAIN_HTML_PATH || DEFAULT_MAIN_HTML_PATH;
  const resolved = path.resolve(WORKSPACE_ROOT, requested);
  const relative = path.relative(WORKSPACE_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`e2e_main_html_outside_workspace:${resolved}`);
  }
  if (!fs.existsSync(resolved)) throw new Error(`e2e_main_html_not_found:${relative}`);
  return resolved;
}

function readLocalMainHtml() {
  return fs.readFileSync(resolveLocalMainHtmlPath(), "utf8");
}

module.exports = {
  readLocalMainHtml,
  resolveLocalMainHtmlPath
};
