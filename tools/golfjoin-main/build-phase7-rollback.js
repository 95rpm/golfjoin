"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(WORKSPACE_ROOT, "src/golfjoin-main");
const MANIFEST_PATH = path.join(SOURCE_ROOT, "source-manifest.json");
const TARGET_SOURCE = "source/scripts/sections/38-home-sections.js";
const OUTPUT_PATH = path.join(
  WORKSPACE_ROOT,
  "backups/home-optimization/phase7/golfjoin_main_before_phase7_CE547BE5.html"
);
const EXPECTED_CANDIDATE_SHA256 = "582BE8819751E26AE839B8262A63E38AE4FB6A793449B05B970C969670A395F5";
const EXPECTED_ROLLBACK_SHA256 = "CE547BE550F820C39DD33156DDB0C26EDE8B95B61B46EDAD5596D547DCF9FA5A";
const EXPECTED_ROLLBACK_BYTES = 2_802_222;

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function replaceOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`${label}_match_count:${matches?.length || 0}`);
  }
  return source.replace(pattern, replacement);
}

function buildCurrent(manifest) {
  return Buffer.concat(manifest.sourceOrder.map((relativePath) => (
    fs.readFileSync(path.join(SOURCE_ROOT, relativePath))
  )));
}

function createRolledBackSection() {
  let source = fs.readFileSync(path.join(SOURCE_ROOT, TARGET_SOURCE), "utf8");
  source = replaceOnce(
    source,
    /      replaceHomeRenderHtml\(host, html\);/,
    "      host.innerHTML = html;",
    "my_join_in_place"
  );
  source = replaceOnce(
    source,
    /\r?\n    let lastRenderedJoinSectionFingerprints = new Map\(\);/,
    "",
    "fingerprint_state"
  );
  source = replaceOnce(
    source,
    /\r?\n    const HOME_RENDER_SCROLL_STATE_SELECTOR = \[[\s\S]*?\r?\n    function isHomeRenderBlockingInteractionActive/,
    "\n    function isHomeRenderBlockingInteractionActive",
    "selective_render_helpers"
  );
  source = replaceOnce(
    source,
    /        replaceHomeRenderHtml\(myJoinSection, myJoinSectionHtml\);/,
    "        myJoinSection.innerHTML = myJoinSectionHtml;",
    "my_join_full"
  );
  source = replaceOnce(
    source,
    /          joinSectionListChanged = reconcileHomeJoinSectionList\(sectionList, sectionListHtml\);\r?\n          lastRenderedJoinSectionListHtml = sectionListHtml;/,
    "          sectionList.innerHTML = sectionListHtml;\n"
      + "          lastRenderedJoinSectionListHtml = sectionListHtml;\n"
      + "          joinSectionListChanged = true;",
    "section_list_reconcile"
  );

  const loadingResetPattern = /\r?\n        lastRenderedJoinSectionFingerprints = new Map\(\);/g;
  const loadingResetMatches = source.match(loadingResetPattern) || [];
  if (loadingResetMatches.length !== 1) {
    throw new Error(`loading_reset_match_count:${loadingResetMatches.length}`);
  }
  source = source.replace(loadingResetPattern, "");

  const errorResetPattern = /\r?\n      lastRenderedJoinSectionFingerprints = new Map\(\);/g;
  const errorResetMatches = source.match(errorResetPattern) || [];
  if (errorResetMatches.length !== 1) {
    throw new Error(`error_reset_match_count:${errorResetMatches.length}`);
  }
  return source.replace(errorResetPattern, "");
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const current = buildCurrent(manifest);
  const currentSha256 = sha256(current);
  if (currentSha256 !== EXPECTED_CANDIDATE_SHA256) {
    throw new Error(`candidate_sha256_mismatch:${currentSha256}`);
  }

  const rolledBackSection = Buffer.from(createRolledBackSection(), "utf8");
  const rollback = Buffer.concat(manifest.sourceOrder.map((relativePath) => (
    relativePath === TARGET_SOURCE
      ? rolledBackSection
      : fs.readFileSync(path.join(SOURCE_ROOT, relativePath))
  )));
  const rollbackSha256 = sha256(rollback);
  if (rollback.length !== EXPECTED_ROLLBACK_BYTES || rollbackSha256 !== EXPECTED_ROLLBACK_SHA256) {
    throw new Error(`rollback_artifact_mismatch:${rollback.length}:${rollbackSha256}`);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rollback);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    outputPath: OUTPUT_PATH,
    bytes: rollback.length,
    sha256: rollbackSha256
  }, null, 2)}\n`);
}

main();
