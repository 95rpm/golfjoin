"use strict";

const { HOME_PRODUCT_MINIMUM_ADVANCE_DAYS, buildGolfJoinHomeArtifacts } = require("./home-products");
const {
  compareHomeProductCollections,
  compareLiveScheduleCollections,
  compareProductFamilyCollections
} = require("./data-contract-comparison");

const SHADOW_SCHEMA = "golfjoin-release-shadow-comparison-v1";
const MAX_ISSUE_SAMPLES = 100;

function text(value) {
  return String(value ?? "").trim();
}

function normalizeSummaryStatus(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => (
    item?.homeProductSummary === true && !text(item.status)
      ? { ...item, status: "available" }
      : item
  ));
}

function flattenAvailabilityEvents(index = {}) {
  return (Array.isArray(index.items) ? index.items : [])
    .flatMap((item) => Array.isArray(item?.events) ? item.events : []);
}

function summarizeComparison(currentRows, candidateRows, result = {}) {
  const issues = Array.isArray(result.issues) ? result.issues : [];
  return {
    valid: result.valid === true,
    currentCount: Array.isArray(currentRows) ? currentRows.length : 0,
    candidateCount: Array.isArray(candidateRows) ? candidateRows.length : 0,
    issueCount: issues.length,
    missingCount: issues.filter((issue) => issue.code === "candidate_item_missing").length,
    unexpectedCount: issues.filter((issue) => issue.code === "candidate_item_unexpected").length,
    fieldMismatchCount: issues.filter((issue) => issue.code === "core_field_mismatch").length,
    issueSamples: issues.slice(0, MAX_ISSUE_SAMPLES)
  };
}

function buildReleaseShadowReport(options = {}) {
  const releaseInput = options.releaseInput || {};
  const summaryPayload = options.summaryPayload || {};
  const homeBootstrapLight = options.homeBootstrapLight || {};
  const familyCatalog = options.familyCatalog || {};
  const staticSummaryPayload = { ...summaryPayload };
  delete staticSummaryPayload.homeBootstrapLight;
  delete staticSummaryPayload.homeBootstrapLightUpdatedAt;

  const legacyArtifacts = buildGolfJoinHomeArtifacts(staticSummaryPayload, {
    minimumAdvanceDays: HOME_PRODUCT_MINIMUM_ADVANCE_DAYS
  });
  const legacyHomeRows = normalizeSummaryStatus(
    legacyArtifacts.homeCardsPayload.items.filter((item) => item?.homeProductSummary === true)
  );
  const candidateHomeRows = normalizeSummaryStatus(
    (releaseInput.objects?.homeCards?.payload?.items || []).filter((item) => item?.homeProductSummary === true)
  );
  const legacyAvailabilityRows = legacyArtifacts.availabilityArtifacts
    .flatMap((artifact) => artifact.payload.events || []);
  const candidateAvailabilityRows = flattenAvailabilityEvents(releaseInput.objects?.availability?.payload);
  const legacyNewSchedules = Array.isArray(homeBootstrapLight.newScheduleSummaries)
    ? homeBootstrapLight.newScheduleSummaries
    : [];
  const candidateNewSchedules = Array.isArray(releaseInput.objects?.liveHome?.payload?.newScheduleSummaries)
    ? releaseInput.objects.liveHome.payload.newScheduleSummaries
    : [];
  const legacyParticipantSummaries = Array.isArray(homeBootstrapLight.participantSummaries)
    ? homeBootstrapLight.participantSummaries
    : [];
  const candidateParticipantSummaries = Array.isArray(releaseInput.objects?.liveHome?.payload?.participantSummaries)
    ? releaseInput.objects.liveHome.payload.participantSummaries
    : [];
  const legacyFamilies = Array.isArray(familyCatalog.families) ? familyCatalog.families : [];
  const candidateFamilies = Array.isArray(releaseInput.objects?.productFamily?.payload?.families)
    ? releaseInput.objects.productFamily.payload.families
    : [];

  const comparisons = {
    homeProducts: summarizeComparison(
      legacyHomeRows,
      candidateHomeRows,
      compareHomeProductCollections(legacyHomeRows, candidateHomeRows)
    ),
    availabilityEvents: summarizeComparison(
      legacyAvailabilityRows,
      candidateAvailabilityRows,
      compareHomeProductCollections(legacyAvailabilityRows, candidateAvailabilityRows)
    ),
    newSchedules: summarizeComparison(
      legacyNewSchedules,
      candidateNewSchedules,
      compareLiveScheduleCollections(legacyNewSchedules, candidateNewSchedules)
    ),
    participantSummaries: summarizeComparison(
      legacyParticipantSummaries,
      candidateParticipantSummaries,
      compareLiveScheduleCollections(legacyParticipantSummaries, candidateParticipantSummaries)
    ),
    productFamilies: summarizeComparison(
      legacyFamilies,
      candidateFamilies,
      compareProductFamilyCollections(legacyFamilies, candidateFamilies)
    )
  };
  const issueCount = Object.values(comparisons).reduce((total, comparison) => total + comparison.issueCount, 0);

  return {
    schema: SHADOW_SCHEMA,
    mode: "server-prepublish",
    comparedAt: text(options.comparedAt),
    sourceSnapshotWatermark: text(releaseInput.sourceSnapshotWatermark),
    staticRevision: text(releaseInput.objects?.homeCards?.revision),
    liveRevision: text(releaseInput.objects?.liveHome?.revision),
    familyRevision: text(releaseInput.objects?.productFamily?.revision),
    availabilityRevision: text(releaseInput.objects?.availability?.revision),
    browserExecuted: false,
    valid: issueCount === 0,
    issueCount,
    comparisons
  };
}

function assertReleaseShadowReport(report = {}) {
  if (report.valid === true) return report;
  const error = new Error("Release shadow comparison failed");
  error.code = "release_shadow_mismatch";
  error.status = 409;
  error.shadow = report;
  throw error;
}

module.exports = {
  SHADOW_SCHEMA,
  MAX_ISSUE_SAMPLES,
  flattenAvailabilityEvents,
  buildReleaseShadowReport,
  assertReleaseShadowReport
};
