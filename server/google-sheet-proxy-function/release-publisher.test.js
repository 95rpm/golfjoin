"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDataContract } = require("./data-contracts");
const {
  createReleaseBundle,
  assertReleaseBundle,
  publishRelease,
  rollbackRelease,
  verifyRemoteRelease,
  rootManifestObjectName
} = require("./release-publisher");

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
    if (this.name === rootManifestObjectName(this.bucket.prefix)) {
      await this.bucket.beforeRootSave?.();
    }
    const expected = options.preconditionOpts?.ifGenerationMatch;
    const current = this.bucket.objects.get(this.name);
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
    if (this.name === rootManifestObjectName(this.bucket.prefix)) {
      await this.bucket.beforeRootRead?.();
    }
    const stored = this.bucket.objects.get(this.name);
    if (!stored) throw storageError(404, "not found");
    return [{ ...stored.metadata }];
  }

  async download() {
    const stored = this.bucket.objects.get(this.name);
    if (!stored) throw storageError(404, "not found");
    return [Buffer.from(stored.buffer)];
  }
}

class FakeBucket {
  constructor(prefix = "web") {
    this.prefix = prefix;
    this.objects = new Map();
    this.generation = 0;
    this.saveOrder = [];
    this.beforeRootRead = null;
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

function fixtureInput(seed = "one", overrides = {}) {
  const token = seed.padEnd(24, seed[0] || "a").slice(0, 24).replace(/[^a-f0-9]/g, "a");
  const availabilityRevision = `gpa_${token}`;
  return {
    bucketName: "golfjoin-test-bucket",
    prefix: "web",
    generatedAt: "2026-08-11T12:00:00+09:00",
    publishedAt: `2026-08-11T12:00:0${seed === "one" ? "1" : "2"}+09:00`,
    sourceSnapshotWatermark: `sheet-snapshot-${seed}`,
    objects: {
      homeCards: {
        revision: `ghc_${token}`,
        payload: {
          schema: "secret-golf-join-home-cards-v2",
          publicationRevision: `ghc_${token}`,
          availabilityRevision,
          items: [{ goodSeq: "30001104", eventSeq: "30285494" }]
        }
      },
      liveHome: {
        revision: `ghl_${token}`,
        payload: {
          schema: "secret-golf-join-home-live-v1",
          participantSummaries: []
        }
      },
      productFamily: {
        revision: `pfc_${token}`,
        payload: {
          schema: "golfjoin-product-family-catalog-v1",
          publicationRevision: `pfc_${token}`,
          familyIdByGoodSeq: { "30001104": "pf_fixture" }
        }
      },
      availability: {
        revision: availabilityRevision,
        payload: {
          schema: "secret-golf-join-product-availability-index-v1",
          availabilityRevision,
          products: [{ goodSeq: "30001104" }]
        }
      },
      productDetail: {
        revision: `gpd_${token}`,
        payload: {
          schema: "secret-golf-join-product-detail-index-v1",
          detailRevision: `gpd_${token}`,
          products: []
        }
      }
    },
    ...overrides
  };
}

test("release-manifest-v2는 다섯 리비전, 절대 URL, hash와 브라우저 OFF를 강제한다", () => {
  const bundle = createReleaseBundle(fixtureInput());
  const contract = validateDataContract("releaseManifestV2", bundle.manifest);
  assert.equal(contract.valid, true, JSON.stringify(contract.issues));
  assert.match(bundle.releaseRevision, /^gjr_[a-f0-9]{24}$/);
  assert.equal(bundle.manifest.browserReadEnabled, false);
  assert.equal(Object.keys(bundle.manifest.objects).length, 5);
  Object.values(bundle.manifest.objects).forEach((reference) => {
    assert.match(reference.url, /^https:\/\/storage\.googleapis\.com\/golfjoin-test-bucket\//);
    assert.match(reference.contentSha256, /^[a-f0-9]{64}$/);
    assert.ok(reference.bytes > 0);
    assert.ok(reference.objectName.includes(`/releases/${bundle.releaseRevision}/`));
  });
});

test("모든 객체에 같은 release ID와 snapshot watermark를 기록한다", () => {
  const bundle = createReleaseBundle(fixtureInput());
  Object.entries(bundle.entries).forEach(([role, entry]) => {
    assert.equal(entry.payload.releaseRevision, bundle.releaseRevision);
    assert.equal(entry.payload.sourceSnapshotWatermark, "sheet-snapshot-one");
    assert.equal(entry.payload.releaseRole, role);
    assert.equal(entry.payload.releaseDataRevision, bundle.manifest.objects[role].revision);
  });
  assert.doesNotThrow(() => assertReleaseBundle(bundle));
});

test("홈 카드와 가용일 리비전이 다르면 발행 묶음 생성을 중단한다", () => {
  const input = fixtureInput();
  input.objects.homeCards.payload.availabilityRevision = "gpa_ffffffffffffffffffffffff";
  assert.throws(() => createReleaseBundle(input), (error) => error.code === "release_home_availability_mismatch");
});

test("gzip 객체는 JSON Content-Type과 gzip Content-Encoding으로 검증된다", async () => {
  const input = fixtureInput();
  input.objects.availability.contentEncoding = "gzip";
  const bucket = new FakeBucket();
  const result = await publishRelease(bucket, input);
  const reference = result.bundle.manifest.objects.availability;
  const stored = bucket.objects.get(reference.objectName);
  assert.equal(stored.metadata.contentType, "application/json; charset=utf-8");
  assert.equal(stored.metadata.contentEncoding, "gzip");
  assert.equal((await verifyRemoteRelease(bucket, result.root.payload)).objectCount, 5);
});

test("버전 객체와 archive를 모두 검증한 뒤 root manifest를 마지막에 저장한다", async () => {
  const bucket = new FakeBucket();
  const result = await publishRelease(bucket, fixtureInput());
  const rootName = rootManifestObjectName("web");
  assert.equal(bucket.saveOrder.at(-1), rootName);
  assert.equal(result.root.payload.releaseRevision, result.bundle.releaseRevision);
  assert.equal(result.root.payload.previousStableRevision, "");
  assert.equal((await verifyRemoteRelease(bucket, result.root.payload)).objectCount, 5);
});

test("동시에 두 번 발행하면 generation 조건으로 하나만 root를 교체한다", async () => {
  const bucket = new FakeBucket();
  bucket.beforeRootSave = makeBarrier(2);
  const settled = await Promise.allSettled([
    publishRelease(bucket, fixtureInput("one")),
    publishRelease(bucket, fixtureInput("bee"))
  ]);
  const fulfilled = settled.filter((item) => item.status === "fulfilled");
  const rejected = settled.filter((item) => item.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "release_manifest_generation_conflict");
  const rootStored = bucket.objects.get(rootManifestObjectName("web"));
  const rootPayload = JSON.parse(rootStored.buffer.toString("utf8"));
  assert.equal((await verifyRemoteRelease(bucket, rootPayload)).objectCount, 5);
});

test("직전 정상 리비전의 archive를 검증한 뒤 generation 조건으로 되돌린다", async () => {
  const bucket = new FakeBucket();
  const first = await publishRelease(bucket, fixtureInput("one"));
  const second = await publishRelease(bucket, fixtureInput("bee"));
  assert.equal(second.root.payload.previousStableRevision, first.bundle.releaseRevision);

  const rollback = await rollbackRelease(bucket, first.bundle.releaseRevision, {
    prefix: "web",
    publishedAt: "2026-08-11T13:00:00+09:00"
  });
  assert.equal(rollback.root.payload.releaseRevision, first.bundle.releaseRevision);
  assert.equal(rollback.root.payload.previousStableRevision, second.bundle.releaseRevision);
  assert.equal(rollback.root.payload.rollbackFromRevision, second.bundle.releaseRevision);
  assert.equal(rollback.root.payload.browserReadEnabled, false);
  assert.equal((await verifyRemoteRelease(bucket, rollback.root.payload)).objectCount, 5);
});

test("원격 객체 하나가 사라지면 root 교체 전에 실패한다", async () => {
  const bucket = new FakeBucket();
  const result = await publishRelease(bucket, fixtureInput());
  const missing = result.root.payload.objects.liveHome.objectName;
  bucket.objects.delete(missing);
  await assert.rejects(
    () => verifyRemoteRelease(bucket, result.root.payload),
    (error) => error.code === "release_reference_missing"
  );
});
