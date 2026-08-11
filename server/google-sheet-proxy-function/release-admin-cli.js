"use strict";

const fs = require("node:fs");
const { parseYamlScalar } = require("./recommended-schedule-migrate-cli");

const DEFAULT_ENDPOINT = "https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api";
const COMMAND_ACTIONS = Object.freeze({
  status: "admin_release_v2_status",
  publish: "admin_release_v2_publish",
  rollback: "admin_release_v2_rollback"
});

function text(value = "") {
  return String(value == null ? "" : value).trim();
}

function parseArgs(argv = []) {
  const command = text(argv[0]);
  const options = argv.slice(1).reduce((result, argument) => {
    if (argument.startsWith("--env-file=")) result.envFile = argument.slice("--env-file=".length);
    else if (argument.startsWith("--endpoint=")) result.endpoint = argument.slice("--endpoint=".length);
    else if (argument.startsWith("--target=")) result.targetReleaseRevision = argument.slice("--target=".length);
    return result;
  }, { command, envFile: "", endpoint: DEFAULT_ENDPOINT, targetReleaseRevision: "" });
  if (!COMMAND_ACTIONS[command]) throw new Error("command must be status, publish, or rollback");
  if (command === "rollback" && !/^gjr_[a-f0-9]{24}$/.test(options.targetReleaseRevision)) {
    throw new Error("rollback requires --target=gjr_<24 lowercase hex>");
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

async function requestRelease(options = {}, token = "") {
  const action = COMMAND_ACTIONS[options.command];
  const url = new URL(options.endpoint || DEFAULT_ENDPOINT);
  url.searchParams.set("action", action);
  const isStatus = options.command === "status";
  const response = await fetch(url, {
    method: isStatus ? "GET" : "POST",
    headers: {
      "Accept": "application/json",
      "Origin": "https://www.secret-tour.com",
      "X-Golfjoin-Admin-Token": token,
      ...(!isStatus ? { "Content-Type": "application/json" } : {})
    },
    ...(!isStatus ? {
      body: JSON.stringify(options.command === "rollback"
        ? { targetReleaseRevision: options.targetReleaseRevision }
        : {})
    } : {})
  });
  const responseText = await response.text();
  let result;
  try { result = JSON.parse(responseText || "{}"); }
  catch (error) { throw new Error(`Release API returned non-JSON (${response.status})`); }
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || result.message || `Release API failed (${response.status})`);
  }
  return result;
}

function assertSafeReleaseResult(command, result = {}) {
  const release = result.release || {};
  if (release.browserReadEnabled === true) throw new Error("browserReadEnabled must remain false");
  if (command === "status" && release.exists === false) return result;
  if (!/^gjr_[a-f0-9]{24}$/.test(text(release.releaseRevision))) {
    throw new Error("Release revision is missing or invalid");
  }
  if (Number(release.objectCount) !== 5) throw new Error("Expected five verified release objects");
  if (command === "publish" && result.rootUpdatedLast !== true) {
    throw new Error("Publish did not confirm root-last ordering");
  }
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = readAdminToken(options);
  const result = assertSafeReleaseResult(options.command, await requestRelease(options, token));
  console.log(JSON.stringify({ command: options.command, ...result }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Release command failed: ${error?.message || String(error)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_ENDPOINT,
  COMMAND_ACTIONS,
  parseArgs,
  assertSafeReleaseResult
};
