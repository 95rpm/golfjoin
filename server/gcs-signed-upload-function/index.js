"use strict";

const crypto = require("crypto");
const { Storage } = require("@google-cloud/storage");

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || "golfjoin-bucket";
const SIGNED_URL_TTL_MS = Number(process.env.SIGNED_URL_TTL_MS || 10 * 60 * 1000);
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "https://m.secret-tour.com,https://www.secret-tour.com")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const MAX_REVIEW_UPLOAD_ITEMS = 6;
const MAX_PROFILE_UPLOAD_ITEMS = 1;
const MAX_REVIEW_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_PROFILE_IMAGE_BYTES = 200 * 1024;
const UPLOAD_PREFIXES = {
  join_profile_image: "golfjoin_uploads/photos/profiles",
  join_review_images: "golfjoin_uploads/photos/reviews"
};
const ALLOWED_CONTENT_TYPES = new Set([
  "image/webp",
  "image/jpeg",
  "image/png"
]);
const CONTENT_TYPE_EXTENSIONS = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png"
};

function getAllowedOrigin(origin = "") {
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function setCorsHeaders(req, res) {
  const origin = getAllowedOrigin(req.headers.origin || "");
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Max-Age", "3600");
}

function safePathPart(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "item";
}

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
}

function validateUploadRequest(body) {
  const type = String(body.type || "");
  const images = Array.isArray(body.images) ? body.images : [];
  if (!Object.prototype.hasOwnProperty.call(UPLOAD_PREFIXES, type)) {
    throw new Error("Unsupported upload type");
  }
  if (type === "join_profile_image" && !String(body.profileId || "").trim()) {
    throw new Error("Missing profileId");
  }
  if (type === "join_review_images" && !String(body.reviewId || "").trim()) {
    throw new Error("Missing reviewId");
  }

  const maxItems = type === "join_profile_image" ? MAX_PROFILE_UPLOAD_ITEMS : MAX_REVIEW_UPLOAD_ITEMS;
  const maxBytes = type === "join_profile_image" ? MAX_PROFILE_IMAGE_BYTES : MAX_REVIEW_IMAGE_BYTES;
  if (!images.length || images.length > maxItems) {
    throw new Error("Invalid image count");
  }

  const seenRoles = new Set();
  images.forEach((image) => {
    const role = String(image.role || "");
    const contentType = String(image.contentType || "");
    const size = Number(image.size || 0);
    if (seenRoles.has(role)) {
      throw new Error("Duplicate image role");
    }
    seenRoles.add(role);
    if (type === "join_profile_image" && role !== "profile") {
      throw new Error("Invalid profile image role");
    }
    if (type === "join_review_images" && !/^(main|thumb)_[1-3]$/.test(role)) {
      throw new Error("Invalid review image role");
    }
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new Error("Unsupported image content type");
    }
    if (!Number.isFinite(size) || size < 1 || size > maxBytes) {
      throw new Error("Invalid image size");
    }
  });
}

function buildObjectName(body, image) {
  const type = String(body.type || "");
  const extension = CONTENT_TYPE_EXTENSIONS[String(image.contentType || "")] || "bin";
  const objectId = crypto.randomUUID();
  const role = safePathPart(image.role || "image");
  const fileName = `${objectId}-${role}.${extension}`;
  if (type === "join_profile_image") {
    return `${UPLOAD_PREFIXES.join_profile_image}/${safePathPart(body.profileId)}/${fileName}`;
  }
  return `${UPLOAD_PREFIXES.join_review_images}/${safePathPart(body.reviewId)}/${fileName}`;
}

exports.signGcsUpload = async (req, res) => {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (ALLOWED_ORIGINS.length && !getAllowedOrigin(req.headers.origin || "")) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  try {
    const body = getRequestBody(req);
    validateUploadRequest(body);

    const bucket = storage.bucket(BUCKET_NAME);
    const items = await Promise.all(body.images.map(async (image) => {
      const objectName = buildObjectName(body, image);
      const file = bucket.file(objectName);
      const contentType = String(image.contentType || "");
      const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + SIGNED_URL_TTL_MS,
        contentType
      });
      return {
        role: String(image.role || ""),
        fileName: String(image.fileName || ""),
        method: "PUT",
        uploadUrl,
        publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURI(objectName)}`,
        objectName,
        bucket: BUCKET_NAME
      };
    }));

    res.status(200).json({ items });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Bad request" });
  }
};
