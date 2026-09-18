"use strict";

const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { assertDataContract } = require("./data-contracts");
const {
  PRODUCT_DISCOVERY_ROOT_OBJECT_NAME,
  serializePayload,
  buildProductDiscoveryArtifacts
} = require("./product-discovery");

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const ROOT_CACHE_CONTROL = "public, max-age=60";

function text(value) {
  return String(value ?? "").trim();
}

function publicationError(code, message, status = 500, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, details);
  return error;
}

function isStorageStatus(error, status) {
  return Number(error?.code || error?.status) === Number(status);
}

function archiveManifestObjectName(discoveryRevision, prefix = "web/product-discovery") {
  return `${text(prefix).replace(/\/+$/, "")}/releases/${text(discoveryRevision)}/manifest.json`;
}

function gzipPayload(payload) {
  return zlib.gzipSync(Buffer.from(serializePayload(payload), "utf8"), { level: 9, mtime: 0 });
}

function immutableMetadata(artifact) {
  return {
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    contentType: JSON_CONTENT_TYPE,
    contentEncoding: "gzip",
    metadata: {
      discoveryRevision: text(artifact.payload?.discoveryRevision),
      contentSha256: text(artifact.sha256),
      logicalBytes: String(artifact.rawBytes)
    }
  };
}

function rootMetadata() {
  return {
    cacheControl: ROOT_CACHE_CONTROL,
    contentType: JSON_CONTENT_TYPE
  };
}

async function readStoredFile(file) {
  const [[metadata], [buffer]] = await Promise.all([
    file.getMetadata(),
    file.download({ decompress: false })
  ]);
  return { metadata: metadata || {}, buffer: Buffer.from(buffer) };
}

async function readProductDiscoveryRoot(bucket, rootObjectName = PRODUCT_DISCOVERY_ROOT_OBJECT_NAME) {
  const objectName = text(rootObjectName) || PRODUCT_DISCOVERY_ROOT_OBJECT_NAME;
  try {
    const stored = await readStoredFile(bucket.file(objectName));
    const payload = JSON.parse(stored.buffer.toString("utf8") || "{}");
    assertDataContract("productDiscoveryManifestV1", payload);
    return {
      exists: true,
      generation: text(stored.metadata.generation),
      objectName,
      payload
    };
  } catch (error) {
    if (isStorageStatus(error, 404)) {
      return { exists: false, generation: "", objectName, payload: {} };
    }
    throw error;
  }
}

function logicalBuffer(stored = {}) {
  const encoding = text(stored.metadata?.contentEncoding).toLowerCase() || "identity";
  if (encoding === "gzip") return zlib.gunzipSync(stored.buffer);
  if (encoding === "identity") return stored.buffer;
  throw publicationError("product_discovery_content_encoding_invalid", "Product discovery object encoding is invalid");
}

async function verifyProductDiscoveryArtifact(bucket, artifact, contractName) {
  let stored;
  try {
    stored = await readStoredFile(bucket.file(artifact.objectName));
  } catch (error) {
    if (isStorageStatus(error, 404)) {
      throw publicationError("product_discovery_object_missing", `Product discovery object is missing: ${artifact.objectName}`);
    }
    throw error;
  }
  if (!text(stored.metadata.contentType).toLowerCase().startsWith("application/json")) {
    throw publicationError("product_discovery_content_type_invalid", `Product discovery object type is invalid: ${artifact.objectName}`);
  }
  const buffer = logicalBuffer(stored);
  if (buffer.length !== artifact.rawBytes
    || artifact.sha256 !== crypto.createHash("sha256").update(buffer).digest("hex")) {
    throw publicationError("product_discovery_hash_mismatch", `Product discovery object content is invalid: ${artifact.objectName}`);
  }
  const payload = JSON.parse(buffer.toString("utf8") || "{}");
  assertDataContract(contractName, payload);
  return payload;
}

async function saveImmutableArtifact(bucket, artifact, contractName) {
  try {
    await bucket.file(artifact.objectName).save(gzipPayload(artifact.payload), {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: immutableMetadata(artifact)
    });
  } catch (error) {
    if (!isStorageStatus(error, 412)) throw error;
  }
  return verifyProductDiscoveryArtifact(bucket, artifact, contractName);
}

function artifactFromReference(reference, payload) {
  return {
    objectName: text(reference.objectName),
    sha256: text(reference.sha256),
    rawBytes: Number(reference.rawBytes),
    payload
  };
}

async function verifyRemoteProductDiscovery(bucket, manifest) {
  assertDataContract("productDiscoveryManifestV1", manifest);
  const indexStored = await readStoredFile(bucket.file(manifest.index.objectName));
  const indexPayload = JSON.parse(logicalBuffer(indexStored).toString("utf8") || "{}");
  await verifyProductDiscoveryArtifact(
    bucket,
    artifactFromReference(manifest.index, indexPayload),
    "productDiscoveryIndexV1"
  );
  const lookupStored = await readStoredFile(bucket.file(manifest.lookup.objectName));
  const lookupPayload = JSON.parse(logicalBuffer(lookupStored).toString("utf8") || "{}");
  await verifyProductDiscoveryArtifact(
    bucket,
    artifactFromReference(manifest.lookup, lookupPayload),
    "productDiscoveryLookupV1"
  );
  if (indexPayload.discoveryRevision !== manifest.discoveryRevision
    || lookupPayload.discoveryRevision !== manifest.discoveryRevision) {
    throw publicationError("product_discovery_revision_mismatch", "Product discovery object revisions do not match root");
  }
  await Promise.all(indexPayload.months.map(async (reference) => {
    const stored = await readStoredFile(bucket.file(reference.objectName));
    const payload = JSON.parse(logicalBuffer(stored).toString("utf8") || "{}");
    await verifyProductDiscoveryArtifact(
      bucket,
      artifactFromReference(reference, payload),
      "productDiscoveryMonthV1"
    );
    if (payload.discoveryRevision !== manifest.discoveryRevision || payload.month !== reference.month) {
      throw publicationError("product_discovery_month_revision_mismatch", `Product discovery month stamp is invalid: ${reference.month}`);
    }
  }));
  return {
    ok: true,
    objectCount: 2 + indexPayload.months.length,
    monthCount: indexPayload.months.length,
    eventCount: indexPayload.eventCount,
    indexPayload,
    lookupPayload
  };
}

async function saveArchiveManifest(bucket, manifest, objectName) {
  const buffer = Buffer.from(serializePayload(manifest), "utf8");
  try {
    await bucket.file(objectName).save(buffer, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { ...rootMetadata(), cacheControl: IMMUTABLE_CACHE_CONTROL }
    });
  } catch (error) {
    if (!isStorageStatus(error, 412)) throw error;
  }
  const stored = await readStoredFile(bucket.file(objectName));
  if (!stored.buffer.equals(buffer)) {
    throw publicationError("product_discovery_archive_conflict", "Product discovery archive manifest conflicts with its revision", 409);
  }
}

async function switchProductDiscoveryRoot(bucket, manifest, current) {
  await verifyRemoteProductDiscovery(bucket, manifest);
  try {
    await bucket.file(current.objectName).save(Buffer.from(serializePayload(manifest), "utf8"), {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: current.exists ? text(current.generation) : 0 },
      metadata: rootMetadata()
    });
  } catch (error) {
    if (isStorageStatus(error, 412)) {
      throw publicationError("product_discovery_root_generation_conflict", "Product discovery root changed during publication", 409);
    }
    throw error;
  }
  const next = await readProductDiscoveryRoot(bucket, current.objectName);
  if (next.payload.discoveryRevision !== manifest.discoveryRevision) {
    throw publicationError("product_discovery_root_switch_mismatch", "Product discovery root did not switch to the expected revision");
  }
  return next;
}

async function publishProductDiscovery(bucket, summaryPayload, options = {}) {
  const rootObjectName = text(options.rootObjectName || PRODUCT_DISCOVERY_ROOT_OBJECT_NAME);
  const current = await readProductDiscoveryRoot(bucket, rootObjectName);
  const publication = buildProductDiscoveryArtifacts(summaryPayload, {
    ...options,
    rootObjectName,
    browserReadEnabled: false
  });
  assertDataContract("productDiscoveryManifestV1", publication.manifestPayload);
  assertDataContract("productDiscoveryIndexV1", publication.indexArtifact.payload);
  assertDataContract("productDiscoveryLookupV1", publication.lookupArtifact.payload);
  publication.monthArtifacts.forEach((artifact) => assertDataContract("productDiscoveryMonthV1", artifact.payload));

  const uploads = await Promise.all([
    saveImmutableArtifact(bucket, publication.indexArtifact, "productDiscoveryIndexV1"),
    saveImmutableArtifact(bucket, publication.lookupArtifact, "productDiscoveryLookupV1"),
    ...publication.monthArtifacts.map((artifact) => (
      saveImmutableArtifact(bucket, artifact, "productDiscoveryMonthV1")
    ))
  ]);
  const prefix = rootObjectName.replace(/\/manifest\.json$/, "");
  const archiveObjectName = archiveManifestObjectName(publication.discoveryRevision, prefix);
  await saveArchiveManifest(bucket, publication.manifestPayload, archiveObjectName);
  const root = await switchProductDiscoveryRoot(bucket, publication.manifestPayload, current);
  return { ok: true, publication, uploads, archiveObjectName, root, rootUpdatedLast: true };
}

async function setProductDiscoveryBrowserGate(bucket, enabled, options = {}) {
  if (typeof enabled !== "boolean") {
    throw publicationError("product_discovery_browser_gate_invalid", "Product discovery browser gate must be a boolean", 400);
  }
  const current = await readProductDiscoveryRoot(bucket, options.rootObjectName);
  if (!current.exists) {
    if (!enabled && options.allowMissing === true) return { ok: true, unchanged: true, root: current };
    throw publicationError("product_discovery_root_missing", "Product discovery root does not exist", 404);
  }
  const expectedRevision = text(options.expectedDiscoveryRevision);
  if (enabled && !expectedRevision) {
    throw publicationError("product_discovery_gate_target_required", "Enabling product discovery requires its current revision", 400);
  }
  if (expectedRevision && expectedRevision !== current.payload.discoveryRevision) {
    throw publicationError("product_discovery_gate_target_mismatch", "Product discovery root does not match the requested revision", 409);
  }
  await verifyRemoteProductDiscovery(bucket, current.payload);
  if (current.payload.browserReadEnabled === enabled) {
    return { ok: true, unchanged: true, root: current };
  }
  const manifest = {
    ...current.payload,
    browserReadEnabled: enabled,
    browserGateUpdatedAt: text(options.updatedAt || new Date().toISOString())
  };
  assertDataContract("productDiscoveryManifestV1", manifest);
  const root = await switchProductDiscoveryRoot(bucket, manifest, current);
  return { ok: true, unchanged: false, root };
}

module.exports = {
  JSON_CONTENT_TYPE,
  IMMUTABLE_CACHE_CONTROL,
  ROOT_CACHE_CONTROL,
  archiveManifestObjectName,
  readProductDiscoveryRoot,
  verifyProductDiscoveryArtifact,
  verifyRemoteProductDiscovery,
  publishProductDiscovery,
  setProductDiscoveryBrowserGate
};
