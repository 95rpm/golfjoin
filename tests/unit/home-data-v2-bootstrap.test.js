"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const SOURCE_PATH = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/data/35-release-v2-bootstrap.js"
);
const SOURCE = fs.readFileSync(SOURCE_PATH, "utf8");
const BOOT_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../src/golfjoin-main/source/scripts/boot/40-initialize.js"),
  "utf8"
);

function jsonText(value) {
  return `${JSON.stringify(value)}\n`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function response(value, status = 200) {
  const text = typeof value === "string" ? value : jsonText(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text
  };
}

function createFixture(options = {}) {
  const releaseRevision = "gjr_111111111111111111111111";
  const watermark = "gjs_222222222222222222222222";
  const staticRevision = "ghc_333333333333333333333333";
  const liveRevision = "ghl_444444444444444444444444";
  const availabilityRevision = "gpa_555555555555555555555555";
  const familyRevision = "pfc_666666666666666666666666";
  const productFamilyCatalog = {
    schema: "golfjoin-product-family-catalog-v1",
    publicationRevision: familyRevision,
    familyCount: 0,
    memberCount: 0,
    families: [],
    familyIdByGoodSeq: {},
    diagnostics: []
  };
  const homeCards = {
    schema: "secret-golf-join-home-cards-v2",
    publicationRevision: staticRevision,
    availabilityRevision,
    items: [{ goodSeq: "30000001", homeProductSummary: true }],
    releaseRevision,
    sourceSnapshotWatermark: watermark,
    releaseRole: "homeCards",
    releaseDataRevision: staticRevision,
    ...(options.omitEmbeddedFamily ? {} : { productFamilyCatalog })
  };
  const liveHome = {
    schema: "secret-golf-join-home-live-v1",
    liveRevision,
    newScheduleSummaries: [],
    participantSummaries: [],
    displayRules: [],
    releaseRevision,
    sourceSnapshotWatermark: watermark,
    releaseRole: "liveHome",
    releaseDataRevision: liveRevision
  };
  const homeCardsText = jsonText(options.homeCards || homeCards);
  const liveHomeText = jsonText(options.liveHome || liveHome);
  const productFamilyText = jsonText(productFamilyCatalog);
  const objectReference = (role, revision, schema, text) => ({
    role,
    revision,
    schema,
    objectName: `web/releases/${releaseRevision}/objects/${role}-${sha256(text)}.json`,
    url: `https://storage.googleapis.com/golfjoin-bucket/web/releases/${releaseRevision}/objects/${role}-${sha256(text)}.json`,
    contentSha256: sha256(text),
    bytes: Buffer.byteLength(text),
    contentType: "application/json; charset=utf-8",
    contentEncoding: "identity"
  });
  const manifest = {
    schema: "secret-golf-join-release-manifest-v2",
    releaseRevision,
    sourceSnapshotWatermark: watermark,
    staticRevision,
    liveRevision,
    familyRevision,
    availabilityRevision,
    detailRevision: "gpdi_777777777777777777777777",
    browserReadEnabled: options.browserReadEnabled !== false,
    objects: {
      homeCards: objectReference("homeCards", staticRevision, homeCards.schema, homeCardsText),
      liveHome: objectReference("liveHome", liveRevision, liveHome.schema, liveHomeText),
      productFamily: objectReference(
        "productFamily",
        familyRevision,
        productFamilyCatalog.schema,
        productFamilyText
      )
    }
  };
  return {
    manifest,
    homeCards,
    liveHome,
    productFamilyCatalog,
    homeCardsText,
    liveHomeText,
    productFamilyText
  };
}

function createSessionStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function createLocalStorage(initialBucket = null) {
  const values = new Map();
  if (Number.isInteger(initialBucket)) {
    values.set("golfjoin_home_data_v2_rollout_bucket_v1", String(initialBucket));
  }
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function createContext(options = {}) {
  const requests = [];
  const fixture = options.fixture || createFixture();
  const counters = {
    staticApply: 0,
    liveApply: 0,
    familyApply: 0,
    render: 0,
    performance: 0
  };
  const productMeta = new Map([["legacy", { image: "https://example.com/legacy.jpg" }]]);
  let context;
  const localStorage = options.localStorage || createLocalStorage(
    options.rolloutBucket === undefined ? 9999 : options.rolloutBucket
  );
  const fetchImpl = options.fetch || (async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("release-manifest-v2.json")) return response(fixture.manifest);
    if (String(url) === fixture.manifest.objects.homeCards.url) return response(fixture.homeCardsText);
    if (String(url) === fixture.manifest.objects.liveHome.url) return response(fixture.liveHomeText);
    return response({ error: "not_found" }, 404);
  });
  context = vm.createContext({
    AbortController,
    TextEncoder,
    URL,
    console,
    fetch: fetchImpl,
    getJoinWishMemberKey: () => options.memberKey || "",
    sessionStorage: options.sessionStorage || createSessionStorage(),
    localStorage,
    homeGolfJoinProducts: options.homeGolfJoinProducts === undefined
      ? [{ goodSeq: "30009999", title: "legacy product" }]
      : options.homeGolfJoinProducts,
    homeGolfJoinProductsLoadPromise: options.homeGolfJoinProductsLoadPromise || null,
    homeGolfJoinProductsLoadFailed: false,
    homeGolfJoinMinimumAdvanceDays: 7,
    golfJoinProductFamilyManifest: { activePublicationRevision: "pfc_legacy" },
    golfJoinProductFamilyCatalog: options.productFamilyCatalog === undefined
      ? { schema: "golfjoin-product-family-catalog-v1", publicationRevision: "pfc_legacy" }
      : options.productFamilyCatalog,
    golfJoinProductFamilyLoadPromise: null,
    golfJoinProductFamilyLoadFailed: false,
    golfJoinProductFamilyIdByGoodSeq: new Map([["30009999", "pf_legacy"]]),
    golfJoinProductFamilyById: new Map([["pf_legacy", { familyId: "pf_legacy" }]]),
    golfJoinProductMetaByGoodSeq: productMeta,
    golfJoinDestinationSummary: { countries: [{ name: "legacy" }] },
    joins: [{ id: "legacy-join", participants: [{ id: "legacy-member" }] }],
    pendingHomeBootstrapLightData: { source: "legacy" },
    pendingHomeBootstrapLightOptions: { fromCache: true },
    homeBootstrapLightAuthoritativeApplied: false,
    homeBootstrapLightApplySignature: "legacy-signature",
    homeBootstrapSnapshotNeedsRefresh: true,
    homeInitialExternalProductsLoading: true,
    homeInitialExternalProductsLoadedOnce: false,
    homeBootstrapLoading: true,
    googleSheetBuilderApplicationsLoading: true,
    googleSheetJoinApplicationsLoading: true,
    googleSheetBuilderApplicationsReadCompleted: false,
    googleSheetJoinApplicationsReadCompleted: false,
    googleSheetBuilderApplicationsReadFailed: false,
    googleSheetJoinApplicationsReadFailed: false,
    mdPickListCacheSourceSignature: "legacy-cache",
    mdPickListElementCache: new Map([["legacy", {}]]),
    mdPickRegionCache: { sourceRef: "legacy", availability: new Map([["legacy", true]]) },
    normalizeExternalGolfJoinProduct: options.normalizeExternalGolfJoinProduct || ((item) => ({
      ...item,
      normalized: true
    })),
    applyGolfJoinProductFamilyCatalog: (manifest, catalog) => {
      counters.familyApply += 1;
      context.golfJoinProductFamilyManifest = manifest;
      context.golfJoinProductFamilyCatalog = catalog;
      context.golfJoinProductFamilyIdByGoodSeq.clear();
      Object.entries(catalog.familyIdByGoodSeq || {}).forEach(([goodSeq, familyId]) => {
        context.golfJoinProductFamilyIdByGoodSeq.set(goodSeq, familyId);
      });
      context.golfJoinProductFamilyById.clear();
      (catalog.families || []).forEach((family) => {
        context.golfJoinProductFamilyById.set(family.familyId, family);
      });
      return catalog;
    },
    applyHomeBootstrapLightFromHomeSummaryPayload: (payload) => {
      counters.staticApply += 1;
      productMeta.clear();
      productMeta.set("v2", { image: "https://example.com/v2.jpg" });
      context.golfJoinDestinationSummary = payload.destinations || { countries: [] };
      if (options.throwDuringStaticApply) throw new Error("static apply failed");
      return true;
    },
    applyHomeBootstrapLightRows: (payload) => {
      counters.liveApply += 1;
      context.joins[0] = {
        id: payload.newScheduleSummaries[0]?.scheduleId || "v2-live-join",
        participants: [{ id: "v2-member" }]
      };
      context.pendingHomeBootstrapLightData = payload;
      context.homeBootstrapLightAuthoritativeApplied = true;
      if (options.throwDuringLiveApply) throw new Error("live apply failed");
      return payload;
    },
    hasOpenBlockingModal: () => options.blockingModal === true,
    scheduleHomeRender: () => {
      counters.render += 1;
    },
    markGolfJoinPerformanceOnce: () => {
      counters.performance += 1;
    },
    window: {
      GOLFJOIN_HOME_DATA_V2_ENABLED: options.enabled === true,
      crypto: crypto.webcrypto,
      localStorage,
      setTimeout,
      clearTimeout
    }
  });
  vm.runInContext(SOURCE, context);
  return { context, fixture, requests, counters, productMeta };
}

function run(context, expression) {
  return vm.runInContext(expression, context);
}

test("기본 OFF에서는 V2 네트워크 요청이 0건이다", async () => {
  const { context, requests } = createContext();
  const result = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(result.disabled, true);
  assert.equal(result.reason, "local_gate_off");
  assert.equal(requests.length, 0);
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "LEGACY_READY");
});

test("14-5 초기화는 고정 100% 익명 rollout과 원격 gate를 함께 사용한다", () => {
  assert.match(SOURCE, /const GOLFJOIN_HOME_DATA_V2_AUTO_BOOT_ENABLED = true;/);
  assert.match(SOURCE, /const GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS = 10000;/);
  assert.equal((BOOT_SOURCE.match(/runGolfJoinHomeDataV2Startup\(\)/g) || []).length, 1);
  assert.match(
    BOOT_SOURCE,
    /const releaseV2LiveReconciliationPromise = useGolfJoinHomeDataV2[\s\S]*?hydrateHomeBootstrapLightFromGoogleSheet\(\{ render: false \}\)/
  );
  assert.match(BOOT_SOURCE, /scheduleHomeRender\(\{ deferWhileModalOpen: true \}\);/);
  assert.equal((SOURCE.match(/runGolfJoinHomeDataV2Transaction\(/g) || []).length, 2);
});

test("initial local render defers Legacy network until the V2 decision is released", () => {
  const beginIndex = BOOT_SOURCE.indexOf("beginGolfJoinHomeDataV2StartupDecision()");
  const localRenderIndex = BOOT_SOURCE.indexOf("renderJoins({ skipQuickMobileCarousel: true })");
  const startupIndex = BOOT_SOURCE.indexOf("runGolfJoinHomeDataV2Startup()");
  const completeIndex = BOOT_SOURCE.indexOf("completeGolfJoinHomeDataV2StartupDecision()");
  assert.ok(beginIndex >= 0 && beginIndex < localRenderIndex);
  assert.ok(localRenderIndex < startupIndex);
  assert.ok(startupIndex < completeIndex);
  assert.match(
    BOOT_SOURCE,
    /try\s*\{[\s\S]*runGolfJoinHomeDataV2Startup\(\)[\s\S]*\}\s*finally\s*\{[\s\S]*completeGolfJoinHomeDataV2StartupDecision\(\)/
  );
  assert.match(SOURCE, /startupDecisionPending:\s*golfJoinHomeDataV2StartupDecisionPending/);
});

test("100% rollout은 최고 유효 bucket 9999도 포함한다", async () => {
  const { context, requests } = createContext({ rolloutBucket: 9999 });
  const result = await run(context, "runGolfJoinHomeDataV2Startup()");
  assert.equal(result.ok, true);
  assert.equal(result.useLegacy, false);
  assert.equal(result.state, "V2_RUNNING");
  assert.equal(requests.length, 3);
});

test("100% rollout 경계는 유효 bucket 0과 9999를 모두 포함한다", async () => {
  for (const bucket of [0, 9999]) {
    const candidate = createContext({ rolloutBucket: bucket });
    const result = await run(candidate.context, "runGolfJoinHomeDataV2Startup()");
    assert.equal(result.ok, true);
    assert.equal(result.useLegacy, false);
    assert.equal(candidate.requests.length, 3);
  }
});

test("rollout 대상 익명 사용자는 원격 ON일 때 static·live·상품군을 원자 적용한다", async () => {
  const { context, requests, counters } = createContext({ rolloutBucket: 0 });
  const result = await run(context, "runGolfJoinHomeDataV2Startup()");
  assert.equal(result.ok, true);
  assert.equal(result.useLegacy, false);
  assert.equal(result.state, "V2_RUNNING");
  assert.equal(requests.length, 3);
  assert.equal(counters.familyApply, 1);
  assert.equal(counters.staticApply, 1);
  assert.equal(counters.liveApply, 1);
  assert.equal(counters.render, 1);
});

test("rollout 대상이어도 원격 OFF이면 manifest 한 건만 읽고 legacy를 유지한다", async () => {
  const fixture = createFixture({ browserReadEnabled: false });
  const { context, requests } = createContext({ fixture, rolloutBucket: 0 });
  const result = await run(context, "runGolfJoinHomeDataV2Startup()");
  assert.equal(result.disabled, true);
  assert.equal(result.useLegacy, true);
  assert.equal(result.reason, "remote_gate_off");
  assert.equal(requests.length, 1);
});

test("로그인 회원도 공용 카드 원본은 V2 Release를 사용한다", async () => {
  const { context, requests } = createContext({ memberKey: "seq:member", rolloutBucket: 0 });
  const result = await run(context, "runGolfJoinHomeDataV2Startup()");
  assert.equal(result.ok, true);
  assert.equal(result.useLegacy, false);
  assert.equal(result.state, "V2_RUNNING");
  assert.equal(requests.length, 3);
});

test("구 Release에 embedded 상품군이 없고 Legacy 상품군도 없으면 안전하게 fallback한다", async () => {
  const fixture = createFixture({ omitEmbeddedFamily: true });
  const { context, counters } = createContext({ fixture, productFamilyCatalog: null });
  const result = await run(context, "runGolfJoinHomeDataV2Startup({ forceAutoBoot: true })");
  assert.equal(result.ok, false);
  assert.equal(result.fallback, true);
  assert.equal(result.useLegacy, true);
  assert.equal(result.reason, "home_data_v2_family_catalog_missing");
  assert.equal(counters.familyApply, 0);
  assert.equal(counters.staticApply, 0);
  assert.equal(counters.liveApply, 0);
  assert.equal(counters.render, 0);
});

test("로그인 회원도 로컬 플래그가 켜지면 V2 candidate를 읽는다", async () => {
  const { context, requests } = createContext({ enabled: true, memberKey: "seq:member" });
  const result = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(result.ok, true);
  assert.equal(result.candidate.liveHome.schema, "secret-golf-join-home-live-v1");
  assert.equal(requests.length, 3);
});

test("원격 플래그 OFF이면 manifest 한 건만 읽고 legacy를 유지한다", async () => {
  const fixture = createFixture({ browserReadEnabled: false });
  const { context, requests } = createContext({ enabled: true, fixture });
  const result = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(result.disabled, true);
  assert.equal(result.reason, "remote_gate_off");
  assert.equal(requests.length, 1);
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "LEGACY_READY");
});

test("manifest 검증 후 home-static과 home-live를 병렬 요청하고 bytes·hash·stamp를 검증한다", async () => {
  const fixture = createFixture();
  const started = [];
  const releases = new Map();
  const fetchImpl = async (url, init = {}) => {
    const key = String(url);
    started.push(key);
    if (key.endsWith("release-manifest-v2.json")) return response(fixture.manifest);
    return new Promise((resolve, reject) => {
      releases.set(key, resolve);
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  };
  const { context } = createContext({ enabled: true, fixture, fetch: fetchImpl });
  const candidatePromise = run(context, "loadGolfJoinHomeDataV2Candidate()");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started.length, 3);
  assert.equal(releases.has(fixture.manifest.objects.homeCards.url), true);
  assert.equal(releases.has(fixture.manifest.objects.liveHome.url), true);
  releases.get(fixture.manifest.objects.homeCards.url)(response(fixture.homeCardsText));
  releases.get(fixture.manifest.objects.liveHome.url)(response(fixture.liveHomeText));
  const result = await candidatePromise;
  assert.equal(result.ok, true);
  assert.equal(result.candidate.homeCards.items.length, 1);
  assert.equal(result.candidate.liveHome.liveRevision, fixture.manifest.liveRevision);
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "V2_VALIDATING");
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().hasCandidate"), true);
});

test("신뢰하지 않는 객체 URL은 객체 요청 전에 차단하고 세션 회로를 연다", async () => {
  const fixture = createFixture();
  fixture.manifest.objects.homeCards.url = "https://example.com/untrusted.json";
  const sessionStorage = createSessionStorage();
  const { context, requests } = createContext({ enabled: true, fixture, sessionStorage });
  const result = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(result.fallback, true);
  assert.equal(result.reason, "home_data_v2_object_url_untrusted");
  assert.equal(requests.length, 1);
  assert.equal(sessionStorage.getItem("golfjoin_home_data_v2_failed_v1"), "1");
  const retried = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(retried.reason, "circuit_open");
  assert.equal(requests.length, 1);
});

test("한 객체가 실패하면 같은 owner의 병렬 요청을 중단하고 candidate를 남기지 않는다", async () => {
  const fixture = createFixture();
  let liveAborted = false;
  const fetchImpl = async (url, init = {}) => {
    const key = String(url);
    if (key.endsWith("release-manifest-v2.json")) return response(fixture.manifest);
    if (key === fixture.manifest.objects.homeCards.url) return response({ error: "missing" }, 404);
    return new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        liveAborted = true;
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    });
  };
  const { context } = createContext({ enabled: true, fixture, fetch: fetchImpl });
  const result = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(result.fallback, true);
  assert.equal(result.reason, "home_data_v2_request_failed");
  assert.equal(liveAborted, true);
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().hasCandidate"), false);
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "V2_FALLBACK");
});

test("bytes 또는 SHA-256이 다르면 검증 전 candidate를 폐기한다", async () => {
  const fixture = createFixture();
  fixture.manifest.objects.homeCards.contentSha256 = "a".repeat(64);
  const { context } = createContext({ enabled: true, fixture });
  const result = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(result.fallback, true);
  assert.equal(result.reason, "home_data_v2_object_hash_mismatch");
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().hasCandidate"), false);
});

test("명시적 owner 폐기 후 늦게 끝난 응답은 candidate가 될 수 없다", async () => {
  const fixture = createFixture();
  const releases = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).endsWith("release-manifest-v2.json")) return response(fixture.manifest);
    return new Promise((resolve) => {
      releases.push(() => resolve(response(
        String(url) === fixture.manifest.objects.homeCards.url ? fixture.homeCardsText : fixture.liveHomeText
      )));
      init.signal.addEventListener("abort", () => {});
    });
  };
  const { context } = createContext({ enabled: true, fixture, fetch: fetchImpl });
  const pending = run(context, "loadGolfJoinHomeDataV2Candidate()");
  await new Promise((resolve) => setImmediate(resolve));
  run(context, "cancelGolfJoinHomeDataV2Candidate('test_cancel')");
  releases.forEach((release) => release());
  const result = await pending;
  assert.equal(result.fallback, true);
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().hasCandidate"), false);
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().reason"), "test_cancel");
});

test("검증된 static과 live를 한 번에 커밋하고 전체 렌더를 한 번만 예약한다", async () => {
  const fixture = createFixture();
  fixture.homeCards.destinations = { countries: [{ name: "v2" }] };
  const { context, counters, productMeta } = createContext({ enabled: true, fixture });
  const loaded = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(loaded.ok, true);
  context.testCandidate = loaded.candidate;

  const committed = run(context, "commitGolfJoinHomeDataV2Candidate(testCandidate)");
  assert.equal(committed.ok, true);
  assert.equal(committed.productCount, 1);
  assert.equal(run(context, "homeGolfJoinProducts[0].goodSeq"), "30000001");
  assert.equal(run(context, "homeGolfJoinProducts[0].normalized"), true);
  assert.equal(run(context, "joins[0].id"), "v2-live-join");
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "V2_COMMITTED");
  assert.equal(
    run(context, "getGolfJoinHomeDataV2Diagnostics().committedReleaseRevision"),
    fixture.manifest.releaseRevision
  );
  assert.equal(productMeta.has("legacy"), false);
  assert.equal(productMeta.has("v2"), true);
  assert.equal(counters.familyApply, 1);
  assert.equal(counters.staticApply, 1);
  assert.equal(counters.liveApply, 1);
  assert.equal(counters.render, 1);

  const reused = run(context, "commitGolfJoinHomeDataV2Candidate(testCandidate)");
  assert.equal(reused.ok, true);
  assert.equal(reused.reused, true);
  assert.equal(counters.staticApply, 1);
  assert.equal(counters.liveApply, 1);
  assert.equal(counters.render, 1);
});

test("live 적용 중 실패하면 static과 live 상태를 모두 Legacy 스냅샷으로 되돌린다", async () => {
  const sessionStorage = createSessionStorage();
  const { context, counters, productMeta } = createContext({
    enabled: true,
    sessionStorage,
    throwDuringLiveApply: true
  });
  const loaded = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(loaded.ok, true);
  context.testRollbackCandidate = loaded.candidate;

  const committed = run(context, "commitGolfJoinHomeDataV2Candidate(testRollbackCandidate)");
  assert.equal(committed.ok, false);
  assert.equal(committed.fallback, true);
  assert.equal(run(context, "homeGolfJoinProducts[0].goodSeq"), "30009999");
  assert.equal(run(context, "joins[0].id"), "legacy-join");
  assert.equal(run(context, "joins[0].participants[0].id"), "legacy-member");
  assert.equal(run(context, "homeBootstrapLightApplySignature"), "legacy-signature");
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "V2_FALLBACK");
  assert.equal(productMeta.has("legacy"), true);
  assert.equal(productMeta.has("v2"), false);
  assert.equal(run(context, "golfJoinProductFamilyCatalog.publicationRevision"), "pfc_legacy");
  assert.equal(sessionStorage.getItem("golfjoin_home_data_v2_failed_v1"), "1");
  assert.equal(counters.familyApply, 1);
  assert.equal(counters.staticApply, 1);
  assert.equal(counters.liveApply, 1);
  assert.equal(counters.render, 0);
});

test("상호작용 모달이 열려 있으면 상태를 건드리지 않고 커밋을 보류한다", async () => {
  const sessionStorage = createSessionStorage();
  const { context, counters } = createContext({
    enabled: true,
    sessionStorage,
    blockingModal: true
  });
  const loaded = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(loaded.ok, true);
  context.testDeferredCandidate = loaded.candidate;

  const committed = run(context, "commitGolfJoinHomeDataV2Candidate(testDeferredCandidate)");
  assert.equal(committed.ok, false);
  assert.equal(committed.deferred, true);
  assert.equal(committed.reason, "interaction_open");
  assert.equal(run(context, "homeGolfJoinProducts[0].goodSeq"), "30009999");
  assert.equal(run(context, "joins[0].id"), "legacy-join");
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "V2_VALIDATING");
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().hasCandidate"), true);
  assert.equal(sessionStorage.getItem("golfjoin_home_data_v2_failed_v1"), null);
  assert.equal(counters.staticApply, 0);
  assert.equal(counters.liveApply, 0);
  assert.equal(counters.render, 0);
});

test("Legacy 상품 요청이 진행 중이면 V2가 경합하지 않고 fallback한다", async () => {
  const legacyPromise = new Promise(() => {});
  const { context, counters } = createContext({
    enabled: true,
    homeGolfJoinProducts: null,
    homeGolfJoinProductsLoadPromise: legacyPromise
  });
  const loaded = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(loaded.ok, true);
  context.testRacingCandidate = loaded.candidate;

  const committed = run(context, "commitGolfJoinHomeDataV2Candidate(testRacingCandidate)");
  assert.equal(committed.ok, false);
  assert.equal(committed.fallback, true);
  assert.equal(committed.reason, "home_data_v2_legacy_products_in_flight");
  assert.equal(run(context, "homeGolfJoinProducts"), null);
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "V2_FALLBACK");
  assert.equal(counters.staticApply, 0);
  assert.equal(counters.liveApply, 0);
  assert.equal(counters.render, 0);
});

test("상품 정규화가 하나라도 실패하면 static·live 상태를 적용하지 않는다", async () => {
  const { context, counters } = createContext({
    enabled: true,
    normalizeExternalGolfJoinProduct: () => {
      throw new Error("bad product");
    }
  });
  const loaded = await run(context, "loadGolfJoinHomeDataV2Candidate()");
  assert.equal(loaded.ok, true);
  context.testInvalidProductCandidate = loaded.candidate;

  const committed = run(context, "commitGolfJoinHomeDataV2Candidate(testInvalidProductCandidate)");
  assert.equal(committed.ok, false);
  assert.equal(committed.fallback, true);
  assert.equal(committed.reason, "home_data_v2_product_normalize_failed");
  assert.equal(run(context, "homeGolfJoinProducts[0].goodSeq"), "30009999");
  assert.equal(run(context, "joins[0].id"), "legacy-join");
  assert.equal(counters.staticApply, 0);
  assert.equal(counters.liveApply, 0);
  assert.equal(counters.render, 0);
});

test("전체 트랜잭션은 커밋 성공 뒤에만 V2_RUNNING으로 전환한다", async () => {
  const { context, counters } = createContext({ enabled: true });
  const result = await run(context, "runGolfJoinHomeDataV2Transaction()");
  assert.equal(result.ok, true);
  assert.equal(result.state, "V2_RUNNING");
  assert.equal(run(context, "getGolfJoinHomeDataV2Diagnostics().state"), "V2_RUNNING");
  assert.equal(counters.render, 1);
});
