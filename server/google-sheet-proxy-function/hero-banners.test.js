"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HERO_BANNER_SCHEMA,
  DEFAULT_HERO_BANNERS,
  normalizeHeroBanners,
  buildHeroBannerManifest,
  assertHeroBannerManifest,
  readHeroBannerManifest,
  saveHeroBannerManifest
} = require("./hero-banners");

class MemoryFile {
  constructor() {
    this.buffer = null;
    this.generation = 0;
    this.metadata = {};
  }

  async download() {
    if (!this.buffer) throw Object.assign(new Error("not found"), { code: 404 });
    return [this.buffer];
  }

  async getMetadata() {
    if (!this.buffer) throw Object.assign(new Error("not found"), { code: 404 });
    return [{ generation: String(this.generation), ...this.metadata }];
  }

  async save(value, options = {}) {
    const expected = String(options.preconditionOpts?.ifGenerationMatch ?? "");
    const current = this.generation ? String(this.generation) : "0";
    if (expected && expected !== current) throw Object.assign(new Error("precondition"), { code: 412 });
    this.buffer = Buffer.from(value);
    this.generation += 1;
    this.metadata = options.metadata || {};
  }
}

class MemoryBucket {
  constructor() {
    this.files = new Map();
  }

  file(name) {
    if (!this.files.has(name)) this.files.set(name, new MemoryFile());
    return this.files.get(name);
  }
}

test("기본 Hero 배너 두 개는 이미지 URL과 빈 연결 링크를 보존한다", () => {
  const items = normalizeHeroBanners(DEFAULT_HERO_BANNERS);
  assert.equal(items.length, 2);
  assert.match(items[0].imageUrl, /^\/upload\/secrettour\/ckeditor\/202608\//);
  assert.equal(items[0].linkUrl, "");
});

test("배너 이미지와 연결 링크는 HTTPS 또는 홈페이지 내부 경로만 허용한다", () => {
  assert.doesNotThrow(() => normalizeHeroBanners([{ imageUrl: "/upload/banner.jpg", linkUrl: "/event/view" }]));
  assert.doesNotThrow(() => normalizeHeroBanners([{ imageUrl: "https://cdn.example.com/banner.jpg", linkUrl: "https://www.secret-tour.com/event" }]));
  assert.throws(() => normalizeHeroBanners([{ imageUrl: "http://cdn.example.com/banner.jpg" }]), /HTTPS/);
  assert.throws(() => normalizeHeroBanners([{ imageUrl: "javascript:alert(1)" }]), /HTTPS/);
  assert.throws(() => normalizeHeroBanners([]), /최소 1개/);
});

test("매니페스트는 내용 기반 리비전과 무결성을 검증한다", () => {
  const manifest = buildHeroBannerManifest(DEFAULT_HERO_BANNERS, { updatedAt: "2026-08-21T00:00:00.000Z" });
  assert.equal(manifest.schema, HERO_BANNER_SCHEMA);
  assert.match(manifest.revision, /^ghb_[a-f0-9]{24}$/);
  assert.equal(assertHeroBannerManifest(manifest).revision, manifest.revision);
  assert.throws(() => assertHeroBannerManifest({ ...manifest, count: 999 }), /무결성/);
});

test("저장 전에는 기본 배너를 반환하고 저장 후 세대값을 반환한다", async () => {
  const bucket = new MemoryBucket();
  const initial = await readHeroBannerManifest(bucket);
  assert.equal(initial.exists, false);
  assert.equal(initial.manifest.items.length, 2);

  const saved = await saveHeroBannerManifest(bucket, [{
    id: "hbn_custom_1",
    imageUrl: "https://cdn.example.com/a.jpg",
    linkUrl: "/event/plan_view?eventPlanSeq=3",
    alt: "테스트 배너"
  }], { expectedGeneration: "", updatedAt: "2026-08-21T01:00:00.000Z" });
  assert.equal(saved.generation, "1");
  assert.equal(saved.manifest.items[0].linkUrl, "/event/plan_view?eventPlanSeq=3");

  const current = await readHeroBannerManifest(bucket);
  assert.equal(current.exists, true);
  assert.equal(current.generation, "1");
  assert.equal(current.manifest.items[0].alt, "테스트 배너");
});

test("다른 관리자가 먼저 저장한 경우 세대값 충돌로 덮어쓰지 않는다", async () => {
  const bucket = new MemoryBucket();
  await saveHeroBannerManifest(bucket, DEFAULT_HERO_BANNERS, { expectedGeneration: "" });
  await assert.rejects(
    saveHeroBannerManifest(bucket, DEFAULT_HERO_BANNERS, { expectedGeneration: "0" }),
    (error) => error.code === "hero_banner_generation_conflict" && error.status === 409
  );
});
