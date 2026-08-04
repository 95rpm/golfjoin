"use strict";

const fs = require("node:fs");

const DEFAULT_ENDPOINT = "https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api";
const MIGRATION_PAYLOAD = Object.freeze({
  sourceGoodSeq: "30001278",
  sourceEventSeq: "30284707",
  targetGoodSeq: "30001279",
  targetEventSeq: "30285966",
  expectedParticipantCount: 27
});
const EXPECTED_MIGRATION_KEY = "recommended-schedule:30001278:30284707->30001279:30285966";

function text(value = "") {
  return String(value == null ? "" : value).trim();
}

function parseArgs(argv = []) {
  return argv.reduce((options, argument) => {
    if (argument === "--apply") options.apply = true;
    else if (argument.startsWith("--env-file=")) options.envFile = argument.slice("--env-file=".length);
    else if (argument.startsWith("--endpoint=")) options.endpoint = argument.slice("--endpoint=".length);
    return options;
  }, { apply: false, envFile: "", endpoint: DEFAULT_ENDPOINT });
}

function parseYamlScalar(content = "", key = "") {
  const line = String(content).split(/\r?\n/).find((item) => item.trimStart().startsWith(`${key}:`));
  if (!line) return "";
  let value = line.slice(line.indexOf(":") + 1).trim();
  if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/''/g, "'");
  else if (value.startsWith('"') && value.endsWith('"')) {
    try { value = JSON.parse(value); } catch (error) { value = value.slice(1, -1); }
  }
  return text(value);
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

async function requestMigration(endpoint = "", token = "", body = {}) {
  const url = new URL(endpoint);
  url.searchParams.set("action", "admin_recommended_schedule_migrate");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Origin": "https://www.secret-tour.com",
      "X-Golfjoin-Admin-Token": token
    },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  let result;
  try { result = JSON.parse(responseText || "{}"); }
  catch (error) { throw new Error(`Migration API returned non-JSON (${response.status})`); }
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || result.message || `Migration API failed (${response.status})`);
  }
  return result;
}

function assertDryRun(dryRun = {}) {
  const migration = dryRun.migration || {};
  if (migration.migrationKey !== EXPECTED_MIGRATION_KEY) throw new Error("Unexpected migration key");
  if (migration.alreadyMigrated) return;
  const counts = migration.counts || {};
  if (Number(counts.recommended_schedules || 0) !== 1) throw new Error("Expected exactly one recommended schedule row");
  if (Number(counts.join_applications || 0) !== MIGRATION_PAYLOAD.expectedParticipantCount) {
    throw new Error(`Expected ${MIGRATION_PAYLOAD.expectedParticipantCount} participant rows`);
  }
  if (Number(counts.schedule_participant_summary || 0) !== 1) throw new Error("Expected exactly one participant summary row");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = readAdminToken(options);
  const dryRun = await requestMigration(options.endpoint, token, MIGRATION_PAYLOAD);
  assertDryRun(dryRun);
  console.log(JSON.stringify({ phase: "dry-run", ...dryRun }, null, 2));
  if (!options.apply) return;
  const applied = await requestMigration(options.endpoint, token, {
    ...MIGRATION_PAYLOAD,
    apply: true,
    confirmationKey: EXPECTED_MIGRATION_KEY
  });
  if (!applied.verification?.ok || Number(applied.verification?.targetParticipantCount || 0) !== MIGRATION_PAYLOAD.expectedParticipantCount) {
    throw new Error("Migration verification did not confirm all 27 participants");
  }
  console.log(JSON.stringify({ phase: "apply", ...applied }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Migration failed: ${error?.message || String(error)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  MIGRATION_PAYLOAD,
  EXPECTED_MIGRATION_KEY,
  parseArgs,
  parseYamlScalar,
  assertDryRun
};
