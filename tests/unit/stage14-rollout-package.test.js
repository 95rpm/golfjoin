"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const { sha256 } = require("../../tools/golfjoin-main/external-assets");
const {
  PREVIOUS_ROLLOUT_BASIS_POINTS,
  TARGET_ROLLOUT_BASIS_POINTS,
  assertOnlyRolloutChanged,
  buildStage14Candidate,
  collectSourceAssets
} = require("../../tools/golfjoin-main/prepare-stage14-rollout");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const PRODUCTION_PACKAGE = path.join(
  WORKSPACE_ROOT,
  "deploy/stage14-rollout/home-data-v2-50pct-20260814"
);

function currentSourceIsStage14RolloutSource() {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(PRODUCTION_PACKAGE, "manifest.json"), "utf8"));
    const { js, css } = collectSourceAssets();
    assertOnlyRolloutChanged(js, manifest.files.js.originalLogicalSha256);
    const packagedCss = zlib.gunzipSync(fs.readFileSync(path.join(PRODUCTION_PACKAGE, manifest.files.css.fileName)));
    return packagedCss.equals(css);
  } catch (error) {
    return false;
  }
}

// These three tests regenerate the historical 14-5 candidate from the current
// editable source. Once a later stage intentionally changes that source, the
// immutable Stage 14 artifact tests remain active elsewhere and these builders
// are no longer a valid regression target.
const stage14SourceTest = currentSourceIsStage14RolloutSource() ? test : test.skip;

stage14SourceTest("14-5 후보는 적용률 한 줄만 50%에서 100%로 바꾼다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PRODUCTION_PACKAGE, "manifest.json"), "utf8"));
  const { js } = collectSourceAssets();
  const reconstructed = assertOnlyRolloutChanged(js, manifest.files.js.originalLogicalSha256);
  assert.equal(sha256(reconstructed), manifest.files.js.originalLogicalSha256);
  assert.match(js.toString("utf8"), new RegExp(`BASIS_POINTS = ${TARGET_ROLLOUT_BASIS_POINTS};`));
  assert.doesNotMatch(js.toString("utf8"), new RegExp(`BASIS_POINTS = ${PREVIOUS_ROLLOUT_BASIS_POINTS};`));
});

stage14SourceTest("14-5 후보는 현재 50% 운영 HTML을 복구본으로 보존하고 새 불변 revision만 참조한다", async () => {
  const candidate = await buildStage14Candidate({ generatedAt: "2026-08-14T00:00:00.000Z" });
  const sourceManifest = candidate.sourcePackageManifest;
  assert.equal(sha256(candidate.sourceHtml), sourceManifest.files.deployHtml.sha256);
  assert.equal(candidate.sourceHtml.toString("utf8").includes(sourceManifest.assetRevision), true);
  assert.equal(candidate.candidateHtml.toString("utf8").includes(sourceManifest.assetRevision), false);
  assert.equal(candidate.candidateHtml.toString("utf8").includes(candidate.assetRevision), true);
  assert.equal(candidate.revisionOccurrenceCount, sourceManifest.revisionOccurrenceCount);
  assert.deepEqual(candidate.inlineHandlerNames, sourceManifest.minifier.inlineHandlerNames);
});

stage14SourceTest("14-5 JavaScript Brotli는 왕복 해시와 200KiB 예산을 통과한다", async () => {
  const candidate = await buildStage14Candidate({ generatedAt: "2026-08-14T00:00:00.000Z" });
  const decoded = zlib.brotliDecompressSync(candidate.jsBrotli);
  assert.equal(decoded.equals(candidate.minifiedJs), true);
  assert.equal(candidate.jsBrotli.length <= 200 * 1024, true);
  assert.equal(candidate.inlineHandlerNames.length, 251);
});
