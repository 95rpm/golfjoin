"use strict";

const crypto = require("crypto");

const HERO_BANNER_SCHEMA = "golfjoin-hero-banners-v1";
const HERO_BANNER_OBJECT_NAME = "hero-banners/manifest.json";
const HERO_BANNER_MIN_COUNT = 1;
const HERO_BANNER_MAX_COUNT = 10;

const DEFAULT_HERO_BANNERS = Object.freeze([
  Object.freeze({
    id: "hero_secret_tour_1",
    imageUrl: "/upload/secrettour/ckeditor/202608/secrettour_1fd01910e10846ebbcd53030ed429ec7.jpg",
    linkUrl: "",
    alt: "시크릿투어 골프조인 배너 1"
  }),
  Object.freeze({
    id: "hero_secret_tour_2",
    imageUrl: "/upload/secrettour/ckeditor/202608/secrettour_66e037bdea874d74b3e980f755738cba.jpg",
    linkUrl: "",
    alt: "시크릿투어 골프조인 배너 2"
  })
]);

function text(value = "") {
  return String(value == null ? "" : value).trim();
}

function heroBannerError(code, message, status = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, details);
  return error;
}

function isStorageError(error, status) {
  return Number(error?.code || error?.statusCode || error?.status) === Number(status);
}

function normalizeWebUrl(value, options = {}) {
  const label = options.label || "URL";
  const raw = text(value);
  if (!raw) {
    if (options.required) throw heroBannerError("hero_banner_url_required", `${label}을 입력해 주세요.`);
    return "";
  }
  if (raw.length > 1600) {
    throw heroBannerError("hero_banner_url_too_long", `${label}이 너무 깁니다.`);
  }
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (error) {
    throw heroBannerError("hero_banner_url_invalid", `${label} 형식이 올바르지 않습니다.`);
  }
  if (parsed.protocol !== "https:") {
    throw heroBannerError("hero_banner_url_protocol_invalid", `${label}은 HTTPS 주소만 사용할 수 있습니다.`);
  }
  return parsed.toString();
}

function createHeroBannerId(seed = "") {
  return `hbn_${crypto.createHash("sha256").update(`${text(seed)}|${crypto.randomBytes(16).toString("hex")}`).digest("hex").slice(0, 20)}`;
}

function normalizeHeroBanner(item = {}, index = 0) {
  const imageUrl = normalizeWebUrl(item.imageUrl, { required: true, label: `배너 ${index + 1} 이미지 URL` });
  const suppliedId = text(item.id);
  const id = /^hbn?_[a-z0-9_-]{6,64}$/i.test(suppliedId)
    || /^hero_[a-z0-9_-]{6,64}$/i.test(suppliedId)
    ? suppliedId
    : createHeroBannerId(`${index}|${imageUrl}`);
  const alt = text(item.alt).slice(0, 160) || `시크릿투어 골프조인 배너 ${index + 1}`;
  return {
    id,
    imageUrl,
    linkUrl: normalizeWebUrl(item.linkUrl, { label: `배너 ${index + 1} 연결 링크` }),
    alt
  };
}

function normalizeHeroBanners(items = [], options = {}) {
  if (!Array.isArray(items)) {
    throw heroBannerError("hero_banner_items_invalid", "배너 목록 형식이 올바르지 않습니다.");
  }
  const minCount = options.allowEmpty ? 0 : HERO_BANNER_MIN_COUNT;
  if (items.length < minCount) {
    throw heroBannerError("hero_banner_minimum_required", "배너는 최소 1개 이상 등록해야 합니다.");
  }
  if (items.length > HERO_BANNER_MAX_COUNT) {
    throw heroBannerError("hero_banner_limit_exceeded", `배너는 최대 ${HERO_BANNER_MAX_COUNT}개까지 등록할 수 있습니다.`);
  }
  const normalized = items.map(normalizeHeroBanner);
  const ids = new Set();
  normalized.forEach((item) => {
    if (ids.has(item.id)) {
      throw heroBannerError("hero_banner_id_duplicate", "같은 배너 식별자가 중복되었습니다.");
    }
    ids.add(item.id);
  });
  return normalized;
}

function buildHeroBannerManifest(items = [], options = {}) {
  const normalized = normalizeHeroBanners(items);
  const revisionPayload = JSON.stringify(normalized.map(({ id, imageUrl, linkUrl, alt }) => ({ id, imageUrl, linkUrl, alt })));
  return {
    schema: HERO_BANNER_SCHEMA,
    revision: `ghb_${crypto.createHash("sha256").update(revisionPayload).digest("hex").slice(0, 24)}`,
    updatedAt: text(options.updatedAt) || new Date().toISOString(),
    count: normalized.length,
    items: normalized
  };
}

function assertHeroBannerManifest(payload = {}) {
  if (!payload || payload.schema !== HERO_BANNER_SCHEMA) {
    throw heroBannerError("hero_banner_manifest_invalid", "저장된 배너 정보 형식이 올바르지 않습니다.", 500);
  }
  const items = normalizeHeroBanners(payload.items);
  const expected = buildHeroBannerManifest(items, { updatedAt: payload.updatedAt });
  if (text(payload.revision) !== expected.revision || Number(payload.count) !== items.length) {
    throw heroBannerError("hero_banner_manifest_integrity_failed", "저장된 배너 정보 무결성 검사에 실패했습니다.", 500);
  }
  return { ...expected, updatedAt: text(payload.updatedAt) || expected.updatedAt };
}

async function readHeroBannerManifest(bucket, options = {}) {
  if (!bucket || typeof bucket.file !== "function") {
    throw heroBannerError("hero_banner_bucket_required", "배너 저장소가 설정되지 않았습니다.", 500);
  }
  const objectName = text(options.objectName) || HERO_BANNER_OBJECT_NAME;
  const file = bucket.file(objectName);
  try {
    const [[buffer], [metadata]] = await Promise.all([
      file.download(),
      file.getMetadata()
    ]);
    const manifest = assertHeroBannerManifest(JSON.parse(buffer.toString("utf8") || "{}"));
    return {
      exists: true,
      generation: text(metadata?.generation),
      objectName,
      manifest
    };
  } catch (error) {
    if (!isStorageError(error, 404)) throw error;
    return {
      exists: false,
      generation: "",
      objectName,
      manifest: buildHeroBannerManifest(options.defaults || DEFAULT_HERO_BANNERS, {
        updatedAt: text(options.defaultUpdatedAt) || "1970-01-01T00:00:00.000Z"
      })
    };
  }
}

async function saveHeroBannerManifest(bucket, items = [], options = {}) {
  if (!bucket || typeof bucket.file !== "function") {
    throw heroBannerError("hero_banner_bucket_required", "배너 저장소가 설정되지 않았습니다.", 500);
  }
  const objectName = text(options.objectName) || HERO_BANNER_OBJECT_NAME;
  const expectedGeneration = text(options.expectedGeneration);
  const manifest = buildHeroBannerManifest(items, { updatedAt: options.updatedAt });
  const file = bucket.file(objectName);
  try {
    await file.save(`${JSON.stringify(manifest, null, 2)}\n`, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: expectedGeneration || 0 },
      metadata: {
        cacheControl: "no-store, max-age=0",
        contentType: "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    if (isStorageError(error, 412)) {
      throw heroBannerError(
        "hero_banner_generation_conflict",
        "배너 정보가 다른 관리자 작업으로 변경되었습니다. 새로고침 후 다시 저장해 주세요.",
        409
      );
    }
    throw error;
  }
  const [metadata] = await file.getMetadata();
  return {
    exists: true,
    generation: text(metadata?.generation),
    objectName,
    manifest
  };
}

module.exports = {
  HERO_BANNER_SCHEMA,
  HERO_BANNER_OBJECT_NAME,
  HERO_BANNER_MIN_COUNT,
  HERO_BANNER_MAX_COUNT,
  DEFAULT_HERO_BANNERS,
  normalizeWebUrl,
  normalizeHeroBanner,
  normalizeHeroBanners,
  buildHeroBannerManifest,
  assertHeroBannerManifest,
  readHeroBannerManifest,
  saveHeroBannerManifest
};
