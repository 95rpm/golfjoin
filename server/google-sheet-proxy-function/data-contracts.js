"use strict";

const HOME_MANIFEST_V1 = require("./contracts/home-manifest-v1.schema.json");
const HOME_CARDS_V2 = require("./contracts/home-cards-v2.schema.json");
const PRODUCT_AVAILABILITY_V1 = require("./contracts/product-availability-v1.schema.json");
const PRODUCT_FAMILY_CATALOG_V1 = require("./contracts/product-family-catalog-v1.schema.json");
const PRODUCT_FAMILY_MANIFEST_V1 = require("./contracts/product-family-manifest-v1.schema.json");
const HOME_BOOTSTRAP_LIGHT_V1 = require("./contracts/home-bootstrap-light-v1.schema.json");
const SCHEDULE_PARTICIPANT_SUMMARY_V1 = require("./contracts/schedule-participant-summary-v1.schema.json");
const PRODUCT_DETAIL_SNAPSHOT_V1 = require("./contracts/product-detail-snapshot-v1.schema.json");
const RELEASE_MANIFEST_V2 = require("./contracts/release-manifest-v2.schema.json");
const PRODUCT_AVAILABILITY_INDEX_V1 = require("./contracts/product-availability-index-v1.schema.json");
const PRODUCT_DETAIL_INDEX_V1 = require("./contracts/product-detail-index-v1.schema.json");

const DATA_CONTRACTS = Object.freeze({
  homeManifestV1: HOME_MANIFEST_V1,
  homeCardsV2: HOME_CARDS_V2,
  productAvailabilityV1: PRODUCT_AVAILABILITY_V1,
  productFamilyCatalogV1: PRODUCT_FAMILY_CATALOG_V1,
  productFamilyManifestV1: PRODUCT_FAMILY_MANIFEST_V1,
  homeBootstrapLightV1: HOME_BOOTSTRAP_LIGHT_V1,
  scheduleParticipantSummaryV1: SCHEDULE_PARTICIPANT_SUMMARY_V1,
  productDetailSnapshotV1: PRODUCT_DETAIL_SNAPSHOT_V1,
  releaseManifestV2: RELEASE_MANIFEST_V2,
  productAvailabilityIndexV1: PRODUCT_AVAILABILITY_INDEX_V1,
  productDetailIndexV1: PRODUCT_DETAIL_INDEX_V1
});

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value, expected) {
  if (expected === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (expected === "array") return Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === expected;
}

function resolveLocalRef(rootSchema, ref = "") {
  if (!ref.startsWith("#/$defs/")) return null;
  const key = ref.slice("#/$defs/".length);
  return rootSchema.$defs?.[key] || null;
}

function addIssue(issues, path, code, details = {}) {
  issues.push({ path, code, ...details });
}

function validateSchemaNode(schema, value, path, issues, rootSchema) {
  if (!schema || typeof schema !== "object") return;
  if (schema.$ref) {
    const resolved = resolveLocalRef(rootSchema, schema.$ref);
    if (!resolved) addIssue(issues, path, "unsupported_ref", { ref: schema.$ref });
    else validateSchemaNode(resolved, value, path, issues, rootSchema);
    return;
  }

  if (Object.prototype.hasOwnProperty.call(schema, "const") && value !== schema.const) {
    addIssue(issues, path, "const_mismatch", { expected: schema.const });
    return;
  }

  const expectedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (expectedTypes.length && !expectedTypes.some((expected) => matchesType(value, expected))) {
    addIssue(issues, path, "type_mismatch", { expected: expectedTypes, actual: valueType(value) });
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    addIssue(issues, path, "enum_mismatch", { expected: schema.enum });
  }

  if (typeof value === "string") {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      addIssue(issues, path, "min_length", { minimum: schema.minLength });
    }
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) {
      addIssue(issues, path, "pattern_mismatch", { pattern: schema.pattern });
    }
    if (schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      addIssue(issues, path, "date_format");
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isFinite(schema.minimum) && value < schema.minimum) {
      addIssue(issues, path, "minimum", { minimum: schema.minimum });
    }
    if (Number.isFinite(schema.exclusiveMinimum) && value <= schema.exclusiveMinimum) {
      addIssue(issues, path, "exclusive_minimum", { minimum: schema.exclusiveMinimum });
    }
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      addIssue(issues, path, "min_items", { minimum: schema.minItems });
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
      addIssue(issues, path, "max_items", { maximum: schema.maxItems });
    }
    if (schema.items) {
      value.forEach((item, index) => validateSchemaNode(schema.items, item, `${path}[${index}]`, issues, rootSchema));
    }
    return;
  }

  if (value && typeof value === "object") {
    (schema.required || []).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        addIssue(issues, `${path}.${key}`, "required");
      }
    });
    Object.entries(schema.properties || {}).forEach(([key, childSchema]) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateSchemaNode(childSchema, value[key], `${path}.${key}`, issues, rootSchema);
      }
    });
  }
}

function validateHomeManifest(payload, issues) {
  const revision = String(payload?.activePublicationRevision || "");
  if (revision && !String(payload?.activeCardsObjectName || "").includes(revision)) {
    addIssue(issues, "$.activeCardsObjectName", "publication_revision_mismatch");
  }
}

function validateHomeCards(payload, issues) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (Number(payload?.count) !== items.length) addIssue(issues, "$.count", "count_mismatch");
  const summaries = items.filter((item) => item?.homeProductSummary === true);
  if (Number(payload?.productSummaryCount) !== summaries.length) {
    addIssue(issues, "$.productSummaryCount", "count_mismatch");
  }
  summaries.forEach((item, index) => {
    const itemIndex = items.indexOf(item);
    ["eventSeq", "departureDate", "returnDate", "price", "status", "availabilityRevision"].forEach((key) => {
      if (item[key] === undefined || item[key] === null || item[key] === "") {
        addIssue(issues, `$.items[${itemIndex}].${key}`, "summary_field_required");
      }
    });
    if (item.availabilityRevision && item.availabilityRevision !== payload.availabilityRevision) {
      addIssue(issues, `$.items[${itemIndex}].availabilityRevision`, "availability_revision_mismatch");
    }
    if (item.availabilityObjectName && !String(item.availabilityObjectName).endsWith(`/${item.goodSeq}.json`)) {
      addIssue(issues, `$.items[${itemIndex}].availabilityObjectName`, "good_seq_path_mismatch");
    }
  });
}

function validateProductAvailability(payload, issues) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  if (Number(payload?.count) !== events.length) addIssue(issues, "$.count", "count_mismatch");
  events.forEach((event, index) => {
    if (String(event?.goodSeq || "") !== String(payload?.goodSeq || "")) {
      addIssue(issues, `$.events[${index}].goodSeq`, "good_seq_mismatch");
    }
    if (event?.departureDate && event?.returnDate && event.returnDate < event.departureDate) {
      addIssue(issues, `$.events[${index}].returnDate`, "return_before_departure");
    }
  });
}

function validateProductFamilyCatalog(payload, issues) {
  const families = Array.isArray(payload?.families) ? payload.families : [];
  const mapping = payload?.familyIdByGoodSeq && typeof payload.familyIdByGoodSeq === "object"
    ? payload.familyIdByGoodSeq
    : {};
  if (Number(payload?.familyCount) !== families.length) addIssue(issues, "$.familyCount", "count_mismatch");
  if (Number(payload?.memberCount) !== Object.keys(mapping).length) addIssue(issues, "$.memberCount", "count_mismatch");
  const seenGoodSeqs = new Set();
  families.forEach((family, familyIndex) => {
    const members = Array.isArray(family?.members) ? family.members : [];
    const memberGoodSeqs = new Set(members.map((member) => String(member?.goodSeq || "")));
    if (!memberGoodSeqs.has(String(family?.representativeGoodSeq || ""))) {
      addIssue(issues, `$.families[${familyIndex}].representativeGoodSeq`, "representative_not_member");
    }
    if (String(family?.representative?.goodSeq || "") !== String(family?.representativeGoodSeq || "")) {
      addIssue(issues, `$.families[${familyIndex}].representative.goodSeq`, "representative_mismatch");
    }
    members.forEach((member, memberIndex) => {
      const goodSeq = String(member?.goodSeq || "");
      if (seenGoodSeqs.has(goodSeq)) {
        addIssue(issues, `$.families[${familyIndex}].members[${memberIndex}].goodSeq`, "duplicate_family_member");
      }
      seenGoodSeqs.add(goodSeq);
      if (mapping[goodSeq] !== family.familyId) {
        addIssue(issues, `$.familyIdByGoodSeq.${goodSeq}`, "family_mapping_mismatch");
      }
    });
  });
}

function validateProductFamilyManifest(payload, issues) {
  const revision = String(payload?.activePublicationRevision || "");
  if (revision && !String(payload?.activeCatalogObjectName || "").includes(revision)) {
    addIssue(issues, "$.activeCatalogObjectName", "publication_revision_mismatch");
  }
}

const RELEASE_OBJECT_REVISION_FIELDS = Object.freeze({
  homeCards: "staticRevision",
  liveHome: "liveRevision",
  productFamily: "familyRevision",
  availability: "availabilityRevision",
  productDetail: "detailRevision"
});

function validateReleaseManifest(payload, issues) {
  if (payload?.previousStableRevision && payload.previousStableRevision === payload.releaseRevision) {
    addIssue(issues, "$.previousStableRevision", "previous_revision_matches_active");
  }
  const objectNames = new Set();
  Object.entries(RELEASE_OBJECT_REVISION_FIELDS).forEach(([role, revisionField]) => {
    const reference = payload?.objects?.[role];
    if (!reference || typeof reference !== "object") return;
    if (reference.role !== role) addIssue(issues, `$.objects.${role}.role`, "release_role_mismatch");
    if (String(reference.revision || "") !== String(payload?.[revisionField] || "")) {
      addIssue(issues, `$.objects.${role}.revision`, "release_revision_field_mismatch");
    }
    if (!String(reference.objectName || "").includes(`/releases/${payload?.releaseRevision}/`)) {
      addIssue(issues, `$.objects.${role}.objectName`, "release_object_path_mismatch");
    }
    if (objectNames.has(reference.objectName)) {
      addIssue(issues, `$.objects.${role}.objectName`, "duplicate_release_object");
    }
    if (reference.objectName) objectNames.add(reference.objectName);
    try {
      const url = new URL(String(reference.url || ""));
      const decodedPath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (!decodedPath.endsWith(String(reference.objectName || ""))) {
        addIssue(issues, `$.objects.${role}.url`, "release_object_url_mismatch");
      }
    } catch (error) {
      addIssue(issues, `$.objects.${role}.url`, "release_object_url_invalid");
    }
  });
}

function validateProductAvailabilityIndex(payload, issues) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (Number(payload?.productCount) !== items.length) {
    addIssue(issues, "$.productCount", "count_mismatch");
  }
  const seenGoodSeqs = new Set();
  items.forEach((item, index) => {
    if (item?.availabilityRevision !== payload?.availabilityRevision) {
      addIssue(issues, `$.items[${index}].availabilityRevision`, "availability_revision_mismatch");
    }
    if (Number(item?.count) !== (Array.isArray(item?.events) ? item.events.length : 0)) {
      addIssue(issues, `$.items[${index}].count`, "count_mismatch");
    }
    const goodSeq = String(item?.goodSeq || "");
    if (seenGoodSeqs.has(goodSeq)) addIssue(issues, `$.items[${index}].goodSeq`, "duplicate_good_seq");
    if (goodSeq) seenGoodSeqs.add(goodSeq);
    (Array.isArray(item?.events) ? item.events : []).forEach((event, eventIndex) => {
      if (String(event?.goodSeq || "") !== goodSeq) {
        addIssue(issues, `$.items[${index}].events[${eventIndex}].goodSeq`, "good_seq_mismatch");
      }
    });
  });
}

function validateProductDetailIndex(payload, issues) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (Number(payload?.count) !== items.length) addIssue(issues, "$.count", "count_mismatch");
  if (payload?.status === "legacy-on-demand" && items.length > 0) {
    addIssue(issues, "$.status", "legacy_detail_index_has_items");
  }
}

const PRIVATE_PREVIEW_KEYS = new Set([
  "phone",
  "mobile",
  "email",
  "memberid",
  "memberseq",
  "memberkey",
  "membermobile",
  "memberphone",
  "memberemail",
  "kakaoid",
  "birthdate",
  "applicantmobile"
]);

function validatePreviewPrivacy(preview, path, issues) {
  if (!preview || typeof preview !== "object") return;
  Object.keys(preview).forEach((key) => {
    if (PRIVATE_PREVIEW_KEYS.has(String(key).toLowerCase())) {
      addIssue(issues, `${path}.${key}`, "private_field_present");
    }
  });
}

function validatePreviewSet(previews, path, issues, expectedCount) {
  const items = Array.isArray(previews) ? previews : [];
  if (Number.isInteger(expectedCount) && items.length !== expectedCount) {
    addIssue(issues, path, "preview_count_mismatch", { expectedCount });
  }
  const seenSeeds = new Set();
  items.forEach((preview, index) => {
    validatePreviewPrivacy(preview, `${path}[${index}]`, issues);
    const seed = String(preview?.iconSeed || "");
    if (seed && seenSeeds.has(seed)) addIssue(issues, `${path}[${index}].iconSeed`, "duplicate_preview_seed");
    if (seed) seenSeeds.add(seed);
  });
  return seenSeeds;
}

function previewProfileMatches(left = {}, right = {}) {
  const scalarKeys = ["displayName", "gender", "ageDisplay", "profession", "level"];
  if (!String(left.displayName || "").trim()) return false;
  if (!scalarKeys.every((key) => String(left[key] || "").trim() === String(right[key] || "").trim())) return false;
  const arrayKeys = ["styles", "memberPreferences"];
  return arrayKeys.every((key) => JSON.stringify(Array.isArray(left[key]) ? left[key] : [])
    === JSON.stringify(Array.isArray(right[key]) ? right[key] : []));
}

function countPreviewGenders(previews = []) {
  return previews.reduce((counts, preview = {}) => {
    const gender = String(preview.gender || "").trim().toLowerCase();
    if (gender.includes("여") || gender === "female") counts.female += 1;
    else if (gender.includes("남") || gender === "male") counts.male += 1;
    return counts;
  }, { male: 0, female: 0 });
}

function validateHomeBootstrapLight(payload, issues) {
  const schedules = Array.isArray(payload?.newScheduleSummaries) ? payload.newScheduleSummaries : [];
  const summaries = Array.isArray(payload?.participantSummaries) ? payload.participantSummaries : [];
  const scheduleById = new Map();
  const scheduleByApplicationId = new Map();

  schedules.forEach((schedule, index) => {
    const path = `$.newScheduleSummaries[${index}]`;
    if (scheduleById.has(schedule?.scheduleId)) addIssue(issues, `${path}.scheduleId`, "duplicate_schedule_id");
    if (scheduleByApplicationId.has(schedule?.applicationId)) addIssue(issues, `${path}.applicationId`, "duplicate_application_id");
    if (schedule?.scheduleId) scheduleById.set(String(schedule.scheduleId), schedule);
    if (schedule?.applicationId) scheduleByApplicationId.set(String(schedule.applicationId), schedule);
    const confirmedCount = Number(schedule?.confirmedCount);
    const remainingSlots = Number(schedule?.remainingSlots);
    if (Number.isInteger(confirmedCount) && Number.isInteger(remainingSlots) && confirmedCount + remainingSlots !== 4) {
      addIssue(issues, `${path}.remainingSlots`, "schedule_capacity_mismatch", { expectedCapacity: 4 });
    }
    validatePreviewSet(schedule?.participantsPreview, `${path}.participantsPreview`, issues, confirmedCount);
    validatePreviewPrivacy(schedule?.creatorPreview, `${path}.creatorPreview`, issues);
    const creatorPreview = schedule?.creatorPreview || {};
    const schedulePreviews = Array.isArray(schedule?.participantsPreview) ? schedule.participantsPreview : [];
    if (!schedulePreviews.some((preview) => previewProfileMatches(creatorPreview, preview))) {
      addIssue(issues, `${path}.creatorPreview`, "creator_preview_missing");
    }
    if (schedule?.departureDate && schedule?.returnDate && schedule.returnDate < schedule.departureDate) {
      addIssue(issues, `${path}.returnDate`, "return_before_departure");
    }
  });

  summaries.forEach((summary, index) => {
    const path = `$.participantSummaries[${index}]`;
    const capacity = Number(summary?.capacity);
    const confirmedCount = Number(summary?.confirmedCount);
    const remainingSlots = Number(summary?.remainingSlots);
    if (Number.isInteger(capacity) && Number.isInteger(confirmedCount) && confirmedCount > capacity) {
      addIssue(issues, `${path}.confirmedCount`, "confirmed_over_capacity");
    }
    if (Number.isInteger(capacity) && Number.isInteger(confirmedCount) && Number.isInteger(remainingSlots)
      && remainingSlots !== Math.max(0, capacity - confirmedCount)) {
      addIssue(issues, `${path}.remainingSlots`, "remaining_slots_mismatch");
    }
    const expectedPreviewCount = Number.isInteger(capacity) && Number.isInteger(confirmedCount)
      ? Math.min(capacity, confirmedCount, 40)
      : undefined;
    const previewSeeds = validatePreviewSet(summary?.participantsPreview, `${path}.participantsPreview`, issues, expectedPreviewCount);
    const genders = countPreviewGenders(Array.isArray(summary?.participantsPreview) ? summary.participantsPreview : []);
    if (capacity <= 40 && (Number(summary?.maleCount) !== genders.male || Number(summary?.femaleCount) !== genders.female)) {
      addIssue(issues, path, "gender_count_mismatch");
    }
    if (Number(summary?.maleCount || 0) + Number(summary?.femaleCount || 0) > confirmedCount) {
      addIssue(issues, path, "gender_count_overflow");
    }

    if (summary?.targetType !== "new_schedule") return;
    const bySchedule = scheduleById.get(String(summary?.targetScheduleId || ""));
    const byApplication = scheduleByApplicationId.get(String(summary?.targetApplicationId || ""));
    const schedule = bySchedule || byApplication;
    if (!schedule) {
      addIssue(issues, path, "orphan_participant_summary");
      return;
    }
    if (bySchedule && byApplication && bySchedule !== byApplication) {
      addIssue(issues, path, "target_identity_conflict");
    }
    if (String(summary.targetScheduleId || "") !== String(schedule.scheduleId || "")
      || String(summary.targetApplicationId || "") !== String(schedule.applicationId || "")) {
      addIssue(issues, path, "target_identity_mismatch");
    }
    if (String(summary.erpProductId || "") !== String(schedule.erpProductId || "")
      || String(summary.erpEventSeq || "") !== String(schedule.erpEventSeq || "")) {
      addIssue(issues, path, "product_identity_mismatch");
    }
    if (confirmedCount < Number(schedule.confirmedCount || 0)) {
      addIssue(issues, `${path}.confirmedCount`, "summary_below_creator_count");
    }
    (Array.isArray(schedule.participantsPreview) ? schedule.participantsPreview : []).forEach((preview) => {
      const seed = String(preview?.iconSeed || "");
      if (seed && !previewSeeds.has(seed)) addIssue(issues, `${path}.participantsPreview`, "creator_participant_missing");
    });
  });
}

function countCommaSeparated(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean).length;
}

function countSummaryPeople(value) {
  return [...String(value || "").matchAll(/(?:^|\/)[^/]*?\s(\d+)(?=\s*(?:\/|$))/g)]
    .reduce((sum, match) => sum + Number(match[1] || 0), 0);
}

function validateScheduleParticipantSummary(payload, issues) {
  const capacity = Number(payload?.capacity);
  const confirmedPeople = Number(payload?.confirmedPeople);
  if (Number(payload?.joinedPeople) !== confirmedPeople) {
    addIssue(issues, "$.joinedPeople", "joined_people_mismatch");
  }
  if (confirmedPeople > capacity) addIssue(issues, "$.confirmedPeople", "confirmed_over_capacity");
  if (Number(payload?.remainingSeats) !== Math.max(0, capacity - confirmedPeople)) {
    addIssue(issues, "$.remainingSeats", "remaining_slots_mismatch");
  }
  if (capacity <= 40 && countCommaSeparated(payload?.participantNames) !== confirmedPeople) {
    addIssue(issues, "$.participantNames", "participant_name_count_mismatch");
  }
  const genderPeople = countSummaryPeople(payload?.genderSummary);
  if (capacity <= 40 && genderPeople !== confirmedPeople) {
    addIssue(issues, "$.genderSummary", "gender_count_mismatch");
  }
}

function validateSectionState(state, count, path, issues) {
  if (state === "available" && count === 0) addIssue(issues, path, "available_section_empty");
  if ((state === "empty" || state === "unavailable") && count > 0) {
    addIssue(issues, path, "inactive_section_has_content");
  }
}

function validateUniqueStrings(values, path, issues) {
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value, index) => {
    const normalized = String(value || "").trim();
    if (normalized && seen.has(normalized)) addIssue(issues, `${path}[${index}]`, "duplicate_value");
    if (normalized) seen.add(normalized);
  });
}

function validateProductDetailSnapshot(payload, issues) {
  if (String(payload?.goodSeq || "") !== String(payload?.erpProductId || "")) {
    addIssue(issues, "$.erpProductId", "product_identity_mismatch");
  }
  if (String(payload?.eventSeq || "") !== String(payload?.erpEventSeq || "")) {
    addIssue(issues, "$.erpEventSeq", "product_identity_mismatch");
  }
  if (payload?.departureDate && payload?.returnDate && payload.returnDate < payload.departureDate) {
    addIssue(issues, "$.returnDate", "return_before_departure");
  }

  try {
    const sourceUrl = new URL(String(payload?.sourceUrl || ""));
    if (sourceUrl.searchParams.get("goodSeq") !== String(payload?.goodSeq || "")
      || sourceUrl.searchParams.get("eventSeq") !== String(payload?.eventSeq || "")) {
      addIssue(issues, "$.sourceUrl", "source_product_identity_mismatch");
    }
  } catch (error) {
    addIssue(issues, "$.sourceUrl", "source_url_invalid");
  }

  const sectionStatus = payload?.sectionStatus || {};
  validateSectionState(sectionStatus.includes, Array.isArray(payload?.includes) ? payload.includes.length : 0, "$.sectionStatus.includes", issues);
  validateSectionState(sectionStatus.excludes, Array.isArray(payload?.excludes) ? payload.excludes.length : 0, "$.sectionStatus.excludes", issues);
  validateSectionState(sectionStatus.notes, Array.isArray(payload?.notes) ? payload.notes.length : 0, "$.sectionStatus.notes", issues);
  validateSectionState(sectionStatus.schedule, Array.isArray(payload?.schedule) ? payload.schedule.length : 0, "$.sectionStatus.schedule", issues);
  const imageCount = (payload?.heroImage ? 1 : 0)
    + (Array.isArray(payload?.slides) ? payload.slides.length : 0)
    + (Array.isArray(payload?.introImages) ? payload.introImages.length : 0);
  validateSectionState(sectionStatus.images, imageCount, "$.sectionStatus.images", issues);

  if (payload?.detailStatus === "ready" && Object.values(sectionStatus).includes("unavailable")) {
    addIssue(issues, "$.detailStatus", "ready_detail_has_unavailable_section");
  }
  if ((payload?.detailStatus === "partial" || payload?.detailStatus === "unavailable")
    && (!Array.isArray(payload?.warnings) || payload.warnings.length === 0)) {
    addIssue(issues, "$.warnings", "detail_warning_required");
  }

  validateUniqueStrings(payload?.includes, "$.includes", issues);
  validateUniqueStrings(payload?.excludes, "$.excludes", issues);
  validateUniqueStrings(payload?.slides, "$.slides", issues);
  validateUniqueStrings(payload?.introImages, "$.introImages", issues);

  const seenDays = new Set();
  (Array.isArray(payload?.schedule) ? payload.schedule : []).forEach((day, index) => {
    const label = String(day?.day || "").trim();
    if (label && seenDays.has(label)) addIssue(issues, `$.schedule[${index}].day`, "duplicate_schedule_day");
    if (label) seenDays.add(label);
  });

  const flight = payload?.flight || {};
  const flightItems = Array.isArray(flight.items) ? flight.items : [];
  if (flight.state === "loaded" && flightItems.length === 0) {
    addIssue(issues, "$.flight.items", "loaded_flight_empty");
  }
  if ((flight.state === "not_required" || flight.state === "unavailable") && flightItems.length > 0) {
    addIssue(issues, "$.flight.items", "inactive_flight_has_content");
  }
  const seenFlightLabels = new Set();
  flightItems.forEach((item, index) => {
    const label = String(item?.label || "");
    if (label && seenFlightLabels.has(label)) addIssue(issues, `$.flight.items[${index}].label`, "duplicate_flight_label");
    if (label) seenFlightLabels.add(label);
    const from = `${item?.fromDate || ""}T${item?.fromTime || ""}`;
    const to = `${item?.toDate || ""}T${item?.toTime || ""}`;
    if (from.length === 16 && to.length === 16 && to < from) {
      addIssue(issues, `$.flight.items[${index}].toDate`, "flight_arrival_before_departure");
    }
  });
}

const INVARIANT_VALIDATORS = Object.freeze({
  homeManifestV1: validateHomeManifest,
  homeCardsV2: validateHomeCards,
  productAvailabilityV1: validateProductAvailability,
  productFamilyCatalogV1: validateProductFamilyCatalog,
  productFamilyManifestV1: validateProductFamilyManifest,
  homeBootstrapLightV1: validateHomeBootstrapLight,
  scheduleParticipantSummaryV1: validateScheduleParticipantSummary,
  productDetailSnapshotV1: validateProductDetailSnapshot,
  releaseManifestV2: validateReleaseManifest,
  productAvailabilityIndexV1: validateProductAvailabilityIndex,
  productDetailIndexV1: validateProductDetailIndex
});

function validateDataContract(contractName, payload) {
  const schema = DATA_CONTRACTS[contractName];
  if (!schema) {
    const error = new Error(`Unknown data contract: ${contractName}`);
    error.code = "data_contract_unknown";
    throw error;
  }
  const issues = [];
  validateSchemaNode(schema, payload, "$", issues, schema);
  INVARIANT_VALIDATORS[contractName]?.(payload, issues);
  return { valid: issues.length === 0, issues };
}

function assertDataContract(contractName, payload) {
  const result = validateDataContract(contractName, payload);
  if (result.valid) return payload;
  const error = new Error(`Data contract validation failed: ${contractName}`);
  error.code = "data_contract_invalid";
  error.contractName = contractName;
  error.issues = result.issues;
  throw error;
}

module.exports = {
  DATA_CONTRACTS,
  validateDataContract,
  assertDataContract
};
