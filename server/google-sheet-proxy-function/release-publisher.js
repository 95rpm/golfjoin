"use strict";

const crypto = require("crypto");
const zlib = require("zlib");
const { assertDataContract } = require("./data-contracts");

const RELEASE_SCHEMA = "secret-golf-join-release-manifest-v2";
const RELEASE_ROOT_OBJECT = "release-manifest-v2.json";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const ROOT_CACHE_CONTROL = "public, max-age=15, must-revalidate";

const RELEASE_ROLES = Object.freeze({
  homeCards: Object.freeze({ revisionField: "staticRevision" }),
  liveHome: Object.freeze({ revisionField: "liveRevision" }),
  productFamily: Object.freeze({ revisionField: "familyRevision" }),
  availability: Object.freeze({ revisionField: "availabilityRevision" }),
  productDetail: Object.freeze({ revisionField: "detailRevision" })
});

function releaseError(code, message, status = 500, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, details);
  return error;
}

function text(value) {
  return String(value ?? "").trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object" || Buffer.isBuffer(value)) return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function serializeJson(value) {
  return Buffer.from(`${JSON.stringify(canonicalize(value), null, 2)}\n`, "utf8");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function publicUrl(bucketName, objectName) {
  const encoded = text(objectName).replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/${text(bucketName)}/${encoded}`;
}

function normalizePrefix(prefix = "web") {
  return text(prefix).replace(/^\/+|\/+$/g, "");
}

function archiveManifestObjectName(prefix, releaseRevision) {
  return `${normalizePrefix(prefix)}/releases/${releaseRevision}/manifest.json`;
}

function rootManifestObjectName(prefix) {
  return `${normalizePrefix(prefix)}/${RELEASE_ROOT_OBJECT}`;
}

function requireReleaseInputs(input = {}) {
  const bucketName = text(input.bucketName);
  const sourceSnapshotWatermark = text(input.sourceSnapshotWatermark);
  const generatedAt = text(input.generatedAt);
  const publishedAt = text(input.publishedAt || generatedAt);
  if (!bucketName) throw releaseError("release_bucket_required", "Release bucket name is required", 400);
  if (!sourceSnapshotWatermark) throw releaseError("release_watermark_required", "Source snapshot watermark is required", 400);
  if (!generatedAt || !publishedAt) throw releaseError("release_timestamp_required", "Release timestamps are required", 400);
  Object.keys(RELEASE_ROLES).forEach((role) => {
    const candidate = input.objects?.[role];
    if (!candidate || typeof candidate !== "object") {
      throw releaseError("release_object_required", `Release object is required: ${role}`, 400, { role });
    }
    if (!text(candidate.revision)) {
      throw releaseError("release_object_revision_required", `Release object revision is required: ${role}`, 400, { role });
    }
    if (!candidate.payload || typeof candidate.payload !== "object" || Array.isArray(candidate.payload)) {
      throw releaseError("release_object_payload_required", `Release object payload is required: ${role}`, 400, { role });
    }
  });
  return { bucketName, sourceSnapshotWatermark, generatedAt, publishedAt };
}

function buildReleaseRevision(input, normalized) {
  const fingerprint = {
    generatedAt: normalized.generatedAt,
    publishedAt: normalized.publishedAt,
    previousStableRevision: text(input.previousStableRevision),
    sourceSnapshotWatermark: normalized.sourceSnapshotWatermark,
    objects: Object.fromEntries(Object.keys(RELEASE_ROLES).map((role) => {
      const candidate = input.objects[role];
      return [role, {
        revision: text(candidate.revision),
        payloadSha256: sha256(serializeJson(candidate.payload))
      }];
    }))
  };
  return `gjr_${sha256(serializeJson(fingerprint)).slice(0, 24)}`;
}

function createReleaseObject(role, candidate, context) {
  const contentEncoding = candidate.contentEncoding === "gzip" ? "gzip" : "identity";
  const payload = {
    ...candidate.payload,
    releaseRevision: context.releaseRevision,
    sourceSnapshotWatermark: context.sourceSnapshotWatermark,
    releaseRole: role,
    releaseDataRevision: text(candidate.revision)
  };
  const logicalBuffer = serializeJson(payload);
  const contentSha256 = sha256(logicalBuffer);
  const objectName = `${context.prefix}/releases/${context.releaseRevision}/objects/${role}-${contentSha256}.json${contentEncoding === "gzip" ? ".gz" : ""}`;
  const storageBuffer = contentEncoding === "gzip"
    ? zlib.gzipSync(logicalBuffer, { level: 9, mtime: 0 })
    : logicalBuffer;
  return {
    payload,
    logicalBuffer,
    storageBuffer,
    reference: {
      role,
      revision: text(candidate.revision),
      schema: text(payload.schema) || `golfjoin-${role}-release-object-v1`,
      objectName,
      url: publicUrl(context.bucketName, objectName),
      contentSha256,
      bytes: logicalBuffer.length,
      contentType: JSON_CONTENT_TYPE,
      contentEncoding
    }
  };
}

function createReleaseBundle(input = {}) {
  const normalized = requireReleaseInputs(input);
  const prefix = normalizePrefix(input.prefix || "web");
  const releaseRevision = buildReleaseRevision(input, normalized);
  const context = { ...normalized, prefix, releaseRevision };
  const entries = Object.fromEntries(Object.keys(RELEASE_ROLES).map((role) => (
    [role, createReleaseObject(role, input.objects[role], context)]
  )));
  const manifestObjectName = archiveManifestObjectName(prefix, releaseRevision);
  const manifest = {
    schema: RELEASE_SCHEMA,
    generatedAt: normalized.generatedAt,
    publishedAt: normalized.publishedAt,
    releaseRevision,
    previousStableRevision: text(input.previousStableRevision),
    sourceSnapshotWatermark: normalized.sourceSnapshotWatermark,
    staticRevision: entries.homeCards.reference.revision,
    liveRevision: entries.liveHome.reference.revision,
    familyRevision: entries.productFamily.reference.revision,
    availabilityRevision: entries.availability.reference.revision,
    detailRevision: entries.productDetail.reference.revision,
    browserReadEnabled: false,
    manifestObjectName,
    manifestUrl: publicUrl(normalized.bucketName, manifestObjectName),
    objects: Object.fromEntries(Object.entries(entries).map(([role, entry]) => [role, entry.reference]))
  };
  assertDataContract("releaseManifestV2", manifest);
  const bundle = {
    bucketName: normalized.bucketName,
    prefix,
    releaseRevision,
    rootObjectName: rootManifestObjectName(prefix),
    manifestObjectName,
    entries,
    manifest,
    manifestBuffer: serializeJson(manifest)
  };
  assertReleaseBundle(bundle);
  return bundle;
}

function decodeStoredBuffer(buffer, contentEncoding) {
  if (contentEncoding !== "gzip") return buffer;
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) return zlib.gunzipSync(buffer);
  return buffer;
}

function assertReleaseBundle(bundle = {}) {
  assertDataContract("releaseManifestV2", bundle.manifest);
  Object.keys(RELEASE_ROLES).forEach((role) => {
    const entry = bundle.entries?.[role];
    const reference = bundle.manifest?.objects?.[role];
    if (!entry || !reference) throw releaseError("release_bundle_object_missing", `Release bundle object missing: ${role}`);
    if (entry.payload.releaseRevision !== bundle.releaseRevision
      || entry.payload.sourceSnapshotWatermark !== bundle.manifest.sourceSnapshotWatermark
      || entry.payload.releaseRole !== role
      || entry.payload.releaseDataRevision !== reference.revision) {
      throw releaseError("release_bundle_stamp_mismatch", `Release object stamp mismatch: ${role}`, 500, { role });
    }
    if (entry.logicalBuffer.length !== reference.bytes || sha256(entry.logicalBuffer) !== reference.contentSha256) {
      throw releaseError("release_bundle_hash_mismatch", `Release object hash mismatch: ${role}`, 500, { role });
    }
    const decoded = decodeStoredBuffer(entry.storageBuffer, reference.contentEncoding);
    if (!decoded.equals(entry.logicalBuffer)) {
      throw releaseError("release_bundle_encoding_mismatch", `Release object encoding mismatch: ${role}`, 500, { role });
    }
  });

  const homePayload = bundle.entries.homeCards.payload;
  if (homePayload.publicationRevision && homePayload.publicationRevision !== bundle.manifest.staticRevision) {
    throw releaseError("release_static_revision_mismatch", "Home cards revision does not match release manifest");
  }
  if (homePayload.availabilityRevision && homePayload.availabilityRevision !== bundle.manifest.availabilityRevision) {
    throw releaseError("release_home_availability_mismatch", "Home cards availability revision does not match release manifest");
  }
  const familyPayload = bundle.entries.productFamily.payload;
  if (familyPayload.publicationRevision && familyPayload.publicationRevision !== bundle.manifest.familyRevision) {
    throw releaseError("release_family_revision_mismatch", "Product family revision does not match release manifest");
  }
  const availabilityPayload = bundle.entries.availability.payload;
  if (availabilityPayload.availabilityRevision && availabilityPayload.availabilityRevision !== bundle.manifest.availabilityRevision) {
    throw releaseError("release_availability_revision_mismatch", "Availability revision does not match release manifest");
  }
  const detailPayload = bundle.entries.productDetail.payload;
  if (detailPayload.detailRevision && detailPayload.detailRevision !== bundle.manifest.detailRevision) {
    throw releaseError("release_detail_revision_mismatch", "Product detail revision does not match release manifest");
  }
  return bundle;
}

function storageMetadata(reference, immutable = true) {
  return {
    cacheControl: immutable ? IMMUTABLE_CACHE_CONTROL : ROOT_CACHE_CONTROL,
    contentType: JSON_CONTENT_TYPE,
    ...(reference?.contentEncoding === "gzip" ? { contentEncoding: "gzip" } : {})
  };
}

function isStorageStatus(error, status) {
  return Number(error?.code || error?.status) === Number(status);
}

async function readFile(file) {
  const [[metadata], [buffer]] = await Promise.all([file.getMetadata(), file.download()]);
  return { metadata: metadata || {}, buffer: Buffer.from(buffer) };
}

async function readRootManifest(bucket, prefix = "web") {
  const objectName = rootManifestObjectName(prefix);
  const file = bucket.file(objectName);
  try {
    const { metadata, buffer } = await readFile(file);
    const payload = JSON.parse(buffer.toString("utf8") || "{}");
    assertDataContract("releaseManifestV2", payload);
    return { exists: true, generation: text(metadata.generation), objectName, payload };
  } catch (error) {
    if (isStorageStatus(error, 404)) return { exists: false, generation: "", objectName, payload: {} };
    throw error;
  }
}

async function verifyRemoteReference(bucket, reference, expectedRelease = {}) {
  const file = bucket.file(reference.objectName);
  let stored;
  try {
    stored = await readFile(file);
  } catch (error) {
    if (isStorageStatus(error, 404)) {
      throw releaseError("release_reference_missing", `Release object is missing: ${reference.role}`, 500, { role: reference.role });
    }
    throw error;
  }
  const metadataType = text(stored.metadata.contentType).toLowerCase();
  if (!metadataType.startsWith("application/json")) {
    throw releaseError("release_content_type_invalid", `Release object content type is invalid: ${reference.role}`, 500, { role: reference.role });
  }
  const metadataEncoding = text(stored.metadata.contentEncoding).toLowerCase() || "identity";
  if (metadataEncoding !== reference.contentEncoding) {
    throw releaseError("release_content_encoding_invalid", `Release object content encoding is invalid: ${reference.role}`, 500, { role: reference.role });
  }
  const logicalBuffer = decodeStoredBuffer(stored.buffer, reference.contentEncoding);
  if (logicalBuffer.length !== reference.bytes || sha256(logicalBuffer) !== reference.contentSha256) {
    throw releaseError("release_remote_hash_mismatch", `Release object content does not match its reference: ${reference.role}`, 500, { role: reference.role });
  }
  const payload = JSON.parse(logicalBuffer.toString("utf8") || "{}");
  if (payload.releaseRevision !== expectedRelease.releaseRevision
    || payload.sourceSnapshotWatermark !== expectedRelease.sourceSnapshotWatermark
    || payload.releaseRole !== reference.role
    || payload.releaseDataRevision !== reference.revision) {
    throw releaseError("release_remote_stamp_mismatch", `Release object stamp is invalid: ${reference.role}`, 500, { role: reference.role });
  }
  return { metadata: stored.metadata, payload };
}

async function saveImmutable(file, buffer, reference = {}) {
  try {
    await file.save(buffer, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: storageMetadata(reference, true)
    });
    return { alreadyExists: false };
  } catch (error) {
    if (!isStorageStatus(error, 412)) throw error;
    return { alreadyExists: true };
  }
}

async function uploadReleaseBundle(bucket, bundle) {
  assertReleaseBundle(bundle);
  const uploads = await Promise.all(Object.keys(RELEASE_ROLES).map(async (role) => {
    const entry = bundle.entries[role];
    const result = await saveImmutable(bucket.file(entry.reference.objectName), entry.storageBuffer, entry.reference);
    await verifyRemoteReference(bucket, entry.reference, bundle.manifest);
    return [role, result];
  }));

  const manifestReference = { contentEncoding: "identity" };
  const archiveResult = await saveImmutable(bucket.file(bundle.manifestObjectName), bundle.manifestBuffer, manifestReference);
  const archive = await readFile(bucket.file(bundle.manifestObjectName));
  if (sha256(archive.buffer) !== sha256(bundle.manifestBuffer)) {
    throw releaseError("release_archive_conflict", "Immutable release manifest does not match the prepared manifest", 409);
  }
  return { objects: Object.fromEntries(uploads), archive: archiveResult };
}

async function verifyRemoteRelease(bucket, manifest) {
  assertDataContract("releaseManifestV2", manifest);
  const payloads = {};
  for (const role of Object.keys(RELEASE_ROLES)) {
    payloads[role] = (await verifyRemoteReference(bucket, manifest.objects[role], manifest)).payload;
  }
  const pseudoBundle = {
    releaseRevision: manifest.releaseRevision,
    manifest,
    entries: Object.fromEntries(Object.keys(RELEASE_ROLES).map((role) => [role, {
      payload: payloads[role],
      logicalBuffer: serializeJson(payloads[role]),
      storageBuffer: manifest.objects[role].contentEncoding === "gzip"
        ? zlib.gzipSync(serializeJson(payloads[role]), { level: 9, mtime: 0 })
        : serializeJson(payloads[role])
    }]))
  };
  assertReleaseBundle(pseudoBundle);
  return { ok: true, objectCount: Object.keys(payloads).length, payloads };
}

async function switchRootManifest(bucket, manifest, expected = {}, prefix = "web") {
  assertDataContract("releaseManifestV2", manifest);
  await verifyRemoteRelease(bucket, manifest);
  const objectName = rootManifestObjectName(prefix);
  const file = bucket.file(objectName);
  try {
    await file.save(serializeJson(manifest), {
      resumable: false,
      // GCS generation은 JavaScript 안전 정수보다 클 수 있으므로 문자열 그대로 전달한다.
      preconditionOpts: { ifGenerationMatch: expected.exists ? text(expected.generation) : 0 },
      metadata: storageMetadata({ contentEncoding: "identity" }, false)
    });
  } catch (error) {
    if (isStorageStatus(error, 412)) {
      throw releaseError("release_manifest_generation_conflict", "Release manifest changed during publication", 409);
    }
    throw error;
  }
  const current = await readRootManifest(bucket, prefix);
  if (current.payload.releaseRevision !== manifest.releaseRevision) {
    throw releaseError("release_manifest_switch_mismatch", "Root release manifest did not switch to the expected revision");
  }
  return current;
}

async function publishRelease(bucket, input = {}) {
  const prefix = normalizePrefix(input.prefix || "web");
  const current = await readRootManifest(bucket, prefix);
  const bundle = createReleaseBundle({
    ...input,
    prefix,
    previousStableRevision: current.exists ? current.payload.releaseRevision : text(input.previousStableRevision)
  });
  const uploads = await uploadReleaseBundle(bucket, bundle);
  const root = await switchRootManifest(bucket, bundle.manifest, current, prefix);
  return { ok: true, bundle, uploads, root };
}

async function rollbackRelease(bucket, targetReleaseRevision, options = {}) {
  const prefix = normalizePrefix(options.prefix || "web");
  const targetRevision = text(targetReleaseRevision);
  if (!/^gjr_[a-f0-9]{24}$/.test(targetRevision)) {
    throw releaseError("release_rollback_target_invalid", "Rollback target release revision is invalid", 400);
  }
  const current = await readRootManifest(bucket, prefix);
  if (!current.exists) throw releaseError("release_manifest_missing", "Root release manifest does not exist", 404);
  if (current.payload.releaseRevision === targetRevision) {
    return { ok: true, unchanged: true, root: current };
  }
  const targetObjectName = archiveManifestObjectName(prefix, targetRevision);
  let target;
  try {
    const stored = await readFile(bucket.file(targetObjectName));
    target = JSON.parse(stored.buffer.toString("utf8") || "{}");
  } catch (error) {
    if (isStorageStatus(error, 404)) throw releaseError("release_rollback_target_missing", "Rollback target release does not exist", 404);
    throw error;
  }
  const switchedAt = text(options.publishedAt || new Date().toISOString());
  const rollbackManifest = {
    ...target,
    publishedAt: switchedAt,
    previousStableRevision: current.payload.releaseRevision,
    rollbackFromRevision: current.payload.releaseRevision,
    rollbackAt: switchedAt,
    browserReadEnabled: false
  };
  assertDataContract("releaseManifestV2", rollbackManifest);
  const root = await switchRootManifest(bucket, rollbackManifest, current, prefix);
  return { ok: true, unchanged: false, root };
}

module.exports = {
  RELEASE_SCHEMA,
  RELEASE_ROOT_OBJECT,
  RELEASE_ROLES,
  JSON_CONTENT_TYPE,
  archiveManifestObjectName,
  rootManifestObjectName,
  canonicalize,
  serializeJson,
  sha256,
  publicUrl,
  createReleaseBundle,
  assertReleaseBundle,
  readRootManifest,
  verifyRemoteReference,
  verifyRemoteRelease,
  uploadReleaseBundle,
  switchRootManifest,
  publishRelease,
  rollbackRelease
};
