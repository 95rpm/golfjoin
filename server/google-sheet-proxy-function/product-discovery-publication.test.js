"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const {
  publishProductDiscovery,
  setProductDiscoveryBrowserGate,
  verifyRemoteProductDiscovery,
  readProductDiscoveryRoot
} = require("./product-discovery-publication");
const { PRODUCT_DISCOVERY_ROOT_OBJECT_NAME } = require("./product-discovery");

function storageError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

class FakeFile {
  constructor(bucket, name) {
    this.bucket = bucket;
    this.name = name;
  }

  async save(value, options = {}) {
    if (this.name === PRODUCT_DISCOVERY_ROOT_OBJECT_NAME) await this.bucket.beforeRootSave?.();
    const current = this.bucket.objects.get(this.name);
    const expected = options.preconditionOpts?.ifGenerationMatch;
    if (expected !== undefined) {
      const actual = current ? String(current.metadata.generation) : "0";
      if (String(expected) !== actual) throw storageError(412, "precondition failed");
    }
    const generation = ++this.bucket.generation;
    this.bucket.objects.set(this.name, {
      buffer: Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(String(value), "utf8"),
      metadata: { ...(options.metadata || {}), generation: String(generation) }
    });
    this.bucket.saveOrder.push(this.name);
  }

  async getMetadata() {
    const stored = this.bucket.objects.get(this.name);
    if (!stored) throw storageError(404, "not found");
    return [{ ...stored.metadata }];
  }

  async download(options = {}) {
    const stored = this.bucket.objects.get(this.name);
    if (!stored) throw storageError(404, "not found");
    this.bucket.downloadOptions.push({ ...options });
    const buffer = Buffer.from(stored.buffer);
    if (stored.metadata.contentEncoding === "gzip" && options.decompress !== false) {
      return [zlib.gunzipSync(buffer)];
    }
    return [buffer];
  }
}

class FakeBucket {
  constructor() {
    this.objects = new Map();
    this.generation = 0;
    this.saveOrder = [];
    this.downloadOptions = [];
    this.beforeRootSave = null;
  }

  file(name) {
    return new FakeFile(this, name);
  }
}

function makeBarrier(target) {
  let arrivals = 0;
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return async () => {
    arrivals += 1;
    if (arrivals >= target) release();
    await promise;
  };
}

function source(seed = "a") {
  return {
    generatedAt: `2026-08-13T10:00:0${seed === "a" ? "1" : "2"}+09:00`,
    sourceGeneratedAt: `2026-08-13T10:00:0${seed === "a" ? "1" : "2"}+09:00`,
    items: [
      {
        goodSeq: "30000001",
        eventSeq: seed === "a" ? "301" : "311",
        title: "태국 골프 3박5일",
        region: "태국",
        departureDate: "2026-08-20",
        returnDate: "2026-08-24",
        price: 100000
      },
      {
        goodSeq: "30000002",
        eventSeq: seed === "a" ? "302" : "312",
        title: "일본 골프 3박4일",
        region: "일본",
        departureDate: "2026-09-02",
        returnDate: "2026-09-05",
        price: 200000
      }
    ]
  };
}

test("불변 객체와 archive를 검증한 뒤 브라우저 OFF root를 마지막에 저장한다", async () => {
  const bucket = new FakeBucket();
  const result = await publishProductDiscovery(bucket, source(), { bucketName: "golfjoin-test-bucket" });
  assert.equal(bucket.saveOrder.at(-1), PRODUCT_DISCOVERY_ROOT_OBJECT_NAME);
  assert.equal(result.root.payload.browserReadEnabled, false);
  assert.equal(result.root.payload.discoveryRevision, result.publication.discoveryRevision);
  assert.equal(result.rootUpdatedLast, true);
  assert.equal((await verifyRemoteProductDiscovery(bucket, result.root.payload)).objectCount, 4);
  const storedIndex = bucket.objects.get(result.publication.indexArtifact.objectName);
  assert.equal(storedIndex.metadata.contentEncoding, "gzip");
  assert.equal(storedIndex.metadata.cacheControl, "public, max-age=31536000, immutable");
  assert.equal(JSON.parse(zlib.gunzipSync(storedIndex.buffer).toString("utf8")).eventCount, 2);
  assert.ok(bucket.downloadOptions.length > 0);
  assert.ok(bucket.downloadOptions.every((options) => options.decompress === false));
});

test("정확한 현재 리비전을 지정한 관리자만 독립 브라우저 gate를 켠다", async () => {
  const bucket = new FakeBucket();
  const published = await publishProductDiscovery(bucket, source(), { bucketName: "golfjoin-test-bucket" });
  await assert.rejects(
    () => setProductDiscoveryBrowserGate(bucket, true),
    (error) => error.code === "product_discovery_gate_target_required"
  );
  await assert.rejects(
    () => setProductDiscoveryBrowserGate(bucket, true, { expectedDiscoveryRevision: "gpd_ffffffffffffffffffffffff" }),
    (error) => error.code === "product_discovery_gate_target_mismatch"
  );
  const beforeObjects = [...bucket.objects.keys()].sort();
  const enabled = await setProductDiscoveryBrowserGate(bucket, true, {
    expectedDiscoveryRevision: published.publication.discoveryRevision,
    updatedAt: "2026-08-13T11:00:00+09:00"
  });
  assert.equal(enabled.root.payload.browserReadEnabled, true);
  assert.equal(enabled.root.payload.browserGateUpdatedAt, "2026-08-13T11:00:00+09:00");
  assert.deepEqual([...bucket.objects.keys()].sort(), beforeObjects);
  const disabled = await setProductDiscoveryBrowserGate(bucket, false);
  assert.equal(disabled.root.payload.browserReadEnabled, false);
});

test("새 상품 스냅샷 발행은 기존 ON root를 새 리비전 OFF root로 교체한다", async () => {
  const bucket = new FakeBucket();
  const first = await publishProductDiscovery(bucket, source("a"), { bucketName: "golfjoin-test-bucket" });
  await setProductDiscoveryBrowserGate(bucket, true, {
    expectedDiscoveryRevision: first.publication.discoveryRevision
  });
  const second = await publishProductDiscovery(bucket, source("b"), { bucketName: "golfjoin-test-bucket" });
  assert.notEqual(second.publication.discoveryRevision, first.publication.discoveryRevision);
  assert.equal(second.root.payload.browserReadEnabled, false);
});

test("동시 발행은 generation 조건으로 하나의 root 교체만 허용한다", async () => {
  const bucket = new FakeBucket();
  bucket.beforeRootSave = makeBarrier(2);
  const results = await Promise.allSettled([
    publishProductDiscovery(bucket, source("a"), { bucketName: "golfjoin-test-bucket" }),
    publishProductDiscovery(bucket, source("b"), { bucketName: "golfjoin-test-bucket" })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected.reason.code, "product_discovery_root_generation_conflict");
  const root = await readProductDiscoveryRoot(bucket);
  assert.equal((await verifyRemoteProductDiscovery(bucket, root.payload)).objectCount, 4);
});

test("원격 불변 객체가 손상되면 gate ON과 root 교체 전에 중단한다", async () => {
  const bucket = new FakeBucket();
  const published = await publishProductDiscovery(bucket, source(), { bucketName: "golfjoin-test-bucket" });
  const stored = bucket.objects.get(published.publication.monthArtifacts[0].objectName);
  stored.buffer = Buffer.from("corrupt", "utf8");
  await assert.rejects(
    () => setProductDiscoveryBrowserGate(bucket, true, {
      expectedDiscoveryRevision: published.publication.discoveryRevision
    })
  );
  const root = await readProductDiscoveryRoot(bucket);
  assert.equal(root.payload.browserReadEnabled, false);
});

test("논리 JSON이 같아도 원문 바이트가 달라지면 원격 검증을 거부한다", async () => {
  const bucket = new FakeBucket();
  const published = await publishProductDiscovery(bucket, source(), { bucketName: "golfjoin-test-bucket" });
  const stored = bucket.objects.get(published.publication.monthArtifacts[0].objectName);
  const logical = zlib.gunzipSync(stored.buffer).toString("utf8");
  stored.buffer = zlib.gzipSync(Buffer.from(`${logical} `, "utf8"), { level: 9, mtime: 0 });
  await assert.rejects(
    () => verifyRemoteProductDiscovery(bucket, published.root.payload),
    (error) => error.code === "product_discovery_hash_mismatch"
  );
});

test("root가 없는 초기 상태의 gate OFF는 안전한 no-op이다", async () => {
  const result = await setProductDiscoveryBrowserGate(new FakeBucket(), false, { allowMissing: true });
  assert.equal(result.unchanged, true);
  assert.equal(result.root.exists, false);
});
