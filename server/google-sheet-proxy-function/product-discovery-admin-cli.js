"use strict";

const fs = require("node:fs");
const { parseYamlScalar } = require("./recommended-schedule-migrate-cli");

const DEFAULT_ENDPOINT = "https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api";
const COMMAND_ACTIONS = Object.freeze({
  status: "admin_product_discovery_status",
  shadow: "admin_product_discovery_shadow_compare",
  "gate-on": "admin_product_discovery_browser_gate",
  "gate-off": "admin_product_discovery_browser_gate"
});

function text(value = "") {
  return String(value == null ? "" : value).trim();
}

function parseArgs(argv = []) {
  const command = text(argv[0]);
  const options = argv.slice(1).reduce((result, argument) => {
    if (argument.startsWith("--env-file=")) result.envFile = argument.slice("--env-file=".length);
    else if (argument.startsWith("--endpoint=")) result.endpoint = argument.slice("--endpoint=".length);
    else if (argument.startsWith("--target=")) result.targetDiscoveryRevision = argument.slice("--target=".length);
    return result;
  }, { command, envFile: "", endpoint: DEFAULT_ENDPOINT, targetDiscoveryRevision: "" });
  if (!COMMAND_ACTIONS[command]) throw new Error("command must be status, shadow, gate-on, or gate-off");
  if (command === "gate-on" && !/^gpd_[a-f0-9]{24}$/.test(options.targetDiscoveryRevision)) {
    throw new Error("gate-on requires --target=gpd_<24 lowercase hex>");
  }
  return options;
}

function readAdminToken(options = {}) {
  const environmentToken = text(process.env.ADMIN_READ_TOKEN);
  if (environmentToken) return environmentToken;
  const envFile = text(options.envFile);
  if (!envFile) throw new Error("--env-file is required when ADMIN_READ_TOKEN is not set");
  const token = parseYamlScalar(fs.readFileSync(envFile, "utf8"), "ADMIN_READ_TOKEN");
  if (!token) throw new Error("ADMIN_READ_TOKEN was not found in the env file");
  return token;
}

async function requestProductDiscovery(options = {}, token = "") {
  const url = new URL(options.endpoint || DEFAULT_ENDPOINT);
  url.searchParams.set("action", COMMAND_ACTIONS[options.command]);
  const isRead = options.command === "status" || options.command === "shadow";
  const body = isRead ? null : {
    browserReadEnabled: options.command === "gate-on",
    ...(options.command === "gate-on"
      ? { expectedDiscoveryRevision: options.targetDiscoveryRevision }
      : {})
  };
  const response = await fetch(url, {
    method: isRead ? "GET" : "POST",
    headers: {
      "Accept": "application/json",
      "Origin": "https://www.secret-tour.com",
      "X-Golfjoin-Admin-Token": token,
      ...(!isRead ? { "Content-Type": "application/json" } : {})
    },
    ...(!isRead ? { body: JSON.stringify(body) } : {})
  });
  const responseText = await response.text();
  let result;
  try { result = JSON.parse(responseText || "{}"); }
  catch (error) { throw new Error(`Product discovery API returned non-JSON (${response.status})`); }
  if (!response.ok || result.ok === false) {
    const error = new Error(result.error || result.message || `Product discovery API failed (${response.status})`);
    error.result = result;
    throw error;
  }
  return result;
}

function assertSafeResult(command, result = {}) {
  if (command === "shadow") {
    const shadow = result.shadow || {};
    if (shadow.browserExecuted !== false) throw new Error("Product discovery shadow must run on the server");
    if (shadow.valid !== true || Number(shadow.issueCount) !== 0) {
      throw new Error(`Product discovery shadow found ${Number(shadow.issueCount || 0)} issue(s)`);
    }
    return result;
  }
  const discovery = result.productDiscovery || {};
  if (command === "status" && discovery.exists === false) return result;
  if (!/^gpd_[a-f0-9]{24}$/.test(text(discovery.discoveryRevision))) {
    throw new Error("Product discovery revision is missing or invalid");
  }
  if (Number(discovery.objectCount) !== Number(discovery.monthCount) + 2) {
    throw new Error("Product discovery object verification count is invalid");
  }
  if (command === "gate-on" && discovery.browserReadEnabled !== true) {
    throw new Error("gate-on did not enable product discovery browser reads");
  }
  if (command === "gate-off" && discovery.browserReadEnabled === true) {
    throw new Error("gate-off did not disable product discovery browser reads");
  }
  if ((command === "gate-on" || command === "gate-off") && result.rootUpdatedLast !== true) {
    throw new Error("Product discovery gate did not confirm root-last ordering");
  }
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = readAdminToken(options);
  const result = assertSafeResult(options.command, await requestProductDiscovery(options, token));
  console.log(JSON.stringify({ command: options.command, ...result }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Product discovery command failed: ${error?.message || String(error)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_ENDPOINT,
  COMMAND_ACTIONS,
  parseArgs,
  assertSafeResult
};
