    // GOLFJOIN_HOME_DATA_V2_BOOTSTRAP_START
    const GOLFJOIN_HOME_DATA_V2_ROOT_URL = "https://storage.googleapis.com/golfjoin-bucket/web/release-manifest-v2.json";
    const GOLFJOIN_HOME_DATA_V2_FETCH_TIMEOUT_MS = 12000;
    const GOLFJOIN_HOME_DATA_V2_STARTUP_TIMEOUT_MS = 3500;
    const GOLFJOIN_HOME_DATA_V2_AUTO_BOOT_ENABLED = true;
    const GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS = 10000;
    const GOLFJOIN_HOME_DATA_V2_ROLLOUT_BUCKET_KEY = "golfjoin_home_data_v2_rollout_bucket_v1";
    const GOLFJOIN_HOME_DATA_V2_FAILURE_KEY = "golfjoin_home_data_v2_failed_v1";
    const GOLFJOIN_HOME_DATA_V2_STATES = Object.freeze({
      LEGACY_READY: "LEGACY_READY",
      V2_FETCHING: "V2_FETCHING",
      V2_VALIDATING: "V2_VALIDATING",
      V2_COMMITTED: "V2_COMMITTED",
      V2_RUNNING: "V2_RUNNING",
      V2_FALLBACK: "V2_FALLBACK"
    });
    let golfJoinHomeDataV2State = GOLFJOIN_HOME_DATA_V2_STATES.LEGACY_READY;
    let golfJoinHomeDataV2Generation = 0;
    let golfJoinHomeDataV2Controller = null;
    let golfJoinHomeDataV2CandidatePromise = null;
    let golfJoinHomeDataV2Candidate = null;
    let golfJoinHomeDataV2LastReason = "not_started";
    let golfJoinHomeDataV2RequestCount = 0;
    let golfJoinHomeDataV2CommittedReleaseRevision = "";
    let golfJoinHomeDataV2RolloutBucket = null;
    let golfJoinHomeDataV2RolloutEligible = false;
    let golfJoinHomeDataV2StartupDecisionPending = false;

    function beginGolfJoinHomeDataV2StartupDecision() {
      golfJoinHomeDataV2StartupDecisionPending = true;
    }

    function completeGolfJoinHomeDataV2StartupDecision() {
      golfJoinHomeDataV2StartupDecisionPending = false;
    }

    function isGolfJoinHomeDataV2StartupDecisionPending() {
      return golfJoinHomeDataV2StartupDecisionPending === true;
    }

    function createGolfJoinHomeDataV2Error(code, message) {
      const error = new Error(message || code || "GolfJoin Home Data V2 failed.");
      error.code = String(code || "home_data_v2_failed");
      return error;
    }

    function setGolfJoinHomeDataV2State(state, reason = "") {
      golfJoinHomeDataV2State = state;
      if (reason) golfJoinHomeDataV2LastReason = String(reason);
    }

    function getGolfJoinHomeDataV2Diagnostics() {
      return {
        state: golfJoinHomeDataV2State,
        generation: golfJoinHomeDataV2Generation,
        reason: golfJoinHomeDataV2LastReason,
        requestCount: golfJoinHomeDataV2RequestCount,
        hasCandidate: Boolean(golfJoinHomeDataV2Candidate),
        committedReleaseRevision: golfJoinHomeDataV2CommittedReleaseRevision,
        localGateEnabled: window.GOLFJOIN_HOME_DATA_V2_ENABLED === true,
        autoBootEnabled: GOLFJOIN_HOME_DATA_V2_AUTO_BOOT_ENABLED,
        rolloutBasisPoints: GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS,
        rolloutBucket: golfJoinHomeDataV2RolloutBucket,
        rolloutEligible: golfJoinHomeDataV2RolloutEligible,
        startupDecisionPending: golfJoinHomeDataV2StartupDecisionPending
      };
    }

    function readOrCreateGolfJoinHomeDataV2RolloutBucket() {
      if (Number.isInteger(golfJoinHomeDataV2RolloutBucket)) return golfJoinHomeDataV2RolloutBucket;
      try {
        const stored = Number.parseInt(localStorage.getItem(GOLFJOIN_HOME_DATA_V2_ROLLOUT_BUCKET_KEY) || "", 10);
        if (Number.isInteger(stored) && stored >= 0 && stored < 10000) {
          golfJoinHomeDataV2RolloutBucket = stored;
          return stored;
        }
        if (!window.crypto?.getRandomValues) return null;
        const random = new Uint32Array(1);
        window.crypto.getRandomValues(random);
        const bucket = Number(random[0] % 10000);
        localStorage.setItem(GOLFJOIN_HOME_DATA_V2_ROLLOUT_BUCKET_KEY, String(bucket));
        golfJoinHomeDataV2RolloutBucket = bucket;
        return bucket;
      } catch (error) {
        return null;
      }
    }

    function isGolfJoinHomeDataV2RolloutEligible() {
      const bucket = readOrCreateGolfJoinHomeDataV2RolloutBucket();
      golfJoinHomeDataV2RolloutEligible = Number.isInteger(bucket)
        && bucket >= 0
        && bucket < GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS;
      return golfJoinHomeDataV2RolloutEligible;
    }

    function readGolfJoinHomeDataV2CircuitFailure() {
      try {
        return sessionStorage.getItem(GOLFJOIN_HOME_DATA_V2_FAILURE_KEY) === "1";
      } catch (error) {
        return false;
      }
    }

    function writeGolfJoinHomeDataV2CircuitFailure(failed) {
      try {
        if (failed) sessionStorage.setItem(GOLFJOIN_HOME_DATA_V2_FAILURE_KEY, "1");
        else sessionStorage.removeItem(GOLFJOIN_HOME_DATA_V2_FAILURE_KEY);
      } catch (error) {
        // Storage can be unavailable in private or embedded browser contexts.
      }
    }

    function assertGolfJoinHomeDataV2Owner(owner) {
      if (owner !== golfJoinHomeDataV2Generation || golfJoinHomeDataV2Controller?.signal?.aborted) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_owner_stale", "Home Data V2 owner is stale.");
      }
    }

    function cancelGolfJoinHomeDataV2Candidate(reason = "cancelled") {
      golfJoinHomeDataV2Generation += 1;
      golfJoinHomeDataV2Controller?.abort?.();
      golfJoinHomeDataV2Controller = null;
      golfJoinHomeDataV2CandidatePromise = null;
      golfJoinHomeDataV2Candidate = null;
      setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.V2_FALLBACK, reason);
    }

    function normalizeGolfJoinHomeDataV2ObjectUrl(reference = {}, manifest = {}) {
      const objectName = String(reference.objectName || "").replace(/^\/+/, "");
      const releaseRevision = String(manifest.releaseRevision || "");
      const expectedPrefix = `web/releases/${releaseRevision}/objects/`;
      if (!objectName.startsWith(expectedPrefix)) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_path_invalid", "Release object path is invalid.");
      }
      let url;
      try {
        url = new URL(String(reference.url || ""));
      } catch (error) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_url_invalid", "Release object URL is invalid.");
      }
      if (
        url.protocol !== "https:"
        || url.hostname !== "storage.googleapis.com"
        || decodeURIComponent(url.pathname.replace(/^\/+/, "")) !== `golfjoin-bucket/${objectName}`
      ) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_url_untrusted", "Release object URL is not trusted.");
      }
      return url.toString();
    }

    function validateGolfJoinHomeDataV2ObjectReference(manifest = {}, role = "", revision = "", schema = "") {
      const reference = manifest.objects?.[role];
      if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_reference_missing", `Release object is missing: ${role}`);
      }
      if (
        String(reference.role || "") !== role
        || String(reference.revision || "") !== String(revision || "")
        || String(reference.schema || "") !== schema
        || !/^[a-f0-9]{64}$/.test(String(reference.contentSha256 || ""))
        || !Number.isInteger(Number(reference.bytes))
        || Number(reference.bytes) <= 0
        || String(reference.contentType || "").toLowerCase() !== "application/json; charset=utf-8"
        || String(reference.contentEncoding || "") !== "identity"
      ) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_reference_invalid", `Release object reference is invalid: ${role}`);
      }
      return {
        ...reference,
        url: normalizeGolfJoinHomeDataV2ObjectUrl(reference, manifest)
      };
    }

    function validateGolfJoinHomeDataV2Manifest(manifest = {}) {
      if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_manifest_invalid", "Release manifest is invalid.");
      }
      if (
        manifest.schema !== "secret-golf-join-release-manifest-v2"
        || !/^gjr_[a-f0-9]{24}$/.test(String(manifest.releaseRevision || ""))
        || !/^gjs_[a-f0-9]{24}$/.test(String(manifest.sourceSnapshotWatermark || ""))
        || typeof manifest.browserReadEnabled !== "boolean"
      ) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_manifest_contract_invalid", "Release manifest contract is invalid.");
      }
      const homeCards = validateGolfJoinHomeDataV2ObjectReference(
        manifest,
        "homeCards",
        manifest.staticRevision,
        "secret-golf-join-home-cards-v2"
      );
      const liveHome = validateGolfJoinHomeDataV2ObjectReference(
        manifest,
        "liveHome",
        manifest.liveRevision,
        "secret-golf-join-home-live-v1"
      );
      const productFamily = validateGolfJoinHomeDataV2ObjectReference(
        manifest,
        "productFamily",
        manifest.familyRevision,
        "golfjoin-product-family-catalog-v1"
      );
      return { manifest, homeCards, liveHome, productFamily };
    }

    function validateGolfJoinHomeDataV2FamilyCatalog(catalog = {}, manifest = {}) {
      if (
        !catalog
        || typeof catalog !== "object"
        || Array.isArray(catalog)
        || catalog.schema !== "golfjoin-product-family-catalog-v1"
        || catalog.publicationRevision !== manifest.familyRevision
        || !Array.isArray(catalog.families)
        || !catalog.familyIdByGoodSeq
        || typeof catalog.familyIdByGoodSeq !== "object"
        || Array.isArray(catalog.familyIdByGoodSeq)
        || Number(catalog.familyCount) !== catalog.families.length
        || Number(catalog.memberCount) !== Object.keys(catalog.familyIdByGoodSeq).length
      ) {
        throw createGolfJoinHomeDataV2Error(
          "home_data_v2_family_catalog_invalid",
          "Embedded product family catalog is invalid."
        );
      }
      const mappedGoodSeqs = new Set();
      catalog.families.forEach((family) => {
        const familyId = String(family?.familyId || "").trim();
        const members = Array.isArray(family?.members) ? family.members : [];
        const memberGoodSeqs = new Set(members.map((member) => String(member?.goodSeq || "").trim()).filter(Boolean));
        if (
          !familyId
          || members.length < 2
          || !memberGoodSeqs.has(String(family?.representativeGoodSeq || "").trim())
          || String(family?.representative?.goodSeq || "").trim() !== String(family?.representativeGoodSeq || "").trim()
        ) {
          throw createGolfJoinHomeDataV2Error(
            "home_data_v2_family_catalog_invalid",
            "Embedded product family is invalid."
          );
        }
        memberGoodSeqs.forEach((goodSeq) => {
          if (mappedGoodSeqs.has(goodSeq) || catalog.familyIdByGoodSeq[goodSeq] !== familyId) {
            throw createGolfJoinHomeDataV2Error(
              "home_data_v2_family_catalog_invalid",
              "Embedded product family mapping is invalid."
            );
          }
          mappedGoodSeqs.add(goodSeq);
        });
      });
      return catalog;
    }

    function bytesToGolfJoinHomeDataV2Hex(buffer) {
      return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
    }

    async function parseAndValidateGolfJoinHomeDataV2Object(text = "", reference = {}, manifest = {}) {
      if (!window.crypto?.subtle || typeof TextEncoder !== "function") {
        throw createGolfJoinHomeDataV2Error("home_data_v2_crypto_unavailable", "Release object verification is unavailable.");
      }
      const bytes = new TextEncoder().encode(String(text));
      if (bytes.byteLength !== Number(reference.bytes)) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_bytes_mismatch", `Release object size is invalid: ${reference.role}`);
      }
      const digest = bytesToGolfJoinHomeDataV2Hex(await window.crypto.subtle.digest("SHA-256", bytes));
      if (digest !== String(reference.contentSha256 || "")) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_hash_mismatch", `Release object hash is invalid: ${reference.role}`);
      }
      let payload;
      try {
        payload = JSON.parse(String(text));
      } catch (error) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_json_invalid", `Release object JSON is invalid: ${reference.role}`);
      }
      if (
        payload?.schema !== reference.schema
        || payload?.releaseRevision !== manifest.releaseRevision
        || payload?.sourceSnapshotWatermark !== manifest.sourceSnapshotWatermark
        || payload?.releaseRole !== reference.role
        || payload?.releaseDataRevision !== reference.revision
      ) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_object_stamp_mismatch", `Release object stamp is invalid: ${reference.role}`);
      }
      if (reference.role === "homeCards") {
        if (
          payload.publicationRevision !== manifest.staticRevision
          || payload.availabilityRevision !== manifest.availabilityRevision
          || !Array.isArray(payload.items)
          || payload.items.length === 0
          || Object.prototype.hasOwnProperty.call(payload, "homeBootstrapLight")
        ) {
          throw createGolfJoinHomeDataV2Error("home_data_v2_static_contract_invalid", "Home static data is invalid.");
        }
        if (payload.productFamilyCatalog !== undefined) {
          validateGolfJoinHomeDataV2FamilyCatalog(payload.productFamilyCatalog, manifest);
        }
      }
      if (reference.role === "liveHome") {
        if (
          payload.liveRevision !== manifest.liveRevision
          || !Array.isArray(payload.newScheduleSummaries)
          || !Array.isArray(payload.participantSummaries)
          || !Array.isArray(payload.displayRules)
        ) {
          throw createGolfJoinHomeDataV2Error("home_data_v2_live_contract_invalid", "Home live data is invalid.");
        }
      }
      return payload;
    }

    async function fetchGolfJoinHomeDataV2Text(url, label, signal, cache = "force-cache") {
      golfJoinHomeDataV2RequestCount += 1;
      const response = await fetch(url, { cache, signal });
      if (!response.ok) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_request_failed", `${label} load failed: ${response.status}`);
      }
      return response.text();
    }

    async function loadGolfJoinHomeDataV2Candidate(options = {}) {
      if (window.GOLFJOIN_HOME_DATA_V2_ENABLED !== true && options.force !== true) {
        setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.LEGACY_READY, "local_gate_off");
        return { ok: false, disabled: true, reason: "local_gate_off" };
      }
      if (readGolfJoinHomeDataV2CircuitFailure() && options.ignoreCircuit !== true) {
        setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.V2_FALLBACK, "circuit_open");
        return { ok: false, disabled: true, reason: "circuit_open" };
      }
      if (golfJoinHomeDataV2Candidate) return { ok: true, candidate: golfJoinHomeDataV2Candidate, reused: true };
      if (golfJoinHomeDataV2CandidatePromise) return golfJoinHomeDataV2CandidatePromise;

      const owner = golfJoinHomeDataV2Generation + 1;
      golfJoinHomeDataV2Generation = owner;
      const controller = new AbortController();
      golfJoinHomeDataV2Controller?.abort?.();
      golfJoinHomeDataV2Controller = controller;
      golfJoinHomeDataV2RequestCount = 0;
      setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.V2_FETCHING, "manifest");
      const timeout = window.setTimeout(() => controller.abort(), Math.max(1000, Number(options.timeoutMs) || GOLFJOIN_HOME_DATA_V2_FETCH_TIMEOUT_MS));
      const rootUrl = String(options.rootUrl || GOLFJOIN_HOME_DATA_V2_ROOT_URL);

      const transaction = (async () => {
        try {
          const manifestText = await fetchGolfJoinHomeDataV2Text(rootUrl, "Release manifest", controller.signal, "no-cache");
          assertGolfJoinHomeDataV2Owner(owner);
          let manifestPayload;
          try {
            manifestPayload = JSON.parse(manifestText);
          } catch (error) {
            throw createGolfJoinHomeDataV2Error("home_data_v2_manifest_json_invalid", "Release manifest JSON is invalid.");
          }
          const validated = validateGolfJoinHomeDataV2Manifest(manifestPayload);
          if (manifestPayload.browserReadEnabled !== true) {
            setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.LEGACY_READY, "remote_gate_off");
            return { ok: false, disabled: true, reason: "remote_gate_off", manifest: manifestPayload };
          }
          setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.V2_VALIDATING, "objects");
          const [homeCardsText, liveHomeText] = await Promise.all([
            fetchGolfJoinHomeDataV2Text(validated.homeCards.url, "Home static", controller.signal),
            fetchGolfJoinHomeDataV2Text(validated.liveHome.url, "Home live", controller.signal)
          ]);
          assertGolfJoinHomeDataV2Owner(owner);
          const [homeCards, liveHome] = await Promise.all([
            parseAndValidateGolfJoinHomeDataV2Object(homeCardsText, validated.homeCards, manifestPayload),
            parseAndValidateGolfJoinHomeDataV2Object(liveHomeText, validated.liveHome, manifestPayload)
          ]);
          assertGolfJoinHomeDataV2Owner(owner);
          const candidate = { owner, manifest: manifestPayload, homeCards, liveHome };
          golfJoinHomeDataV2Candidate = candidate;
          writeGolfJoinHomeDataV2CircuitFailure(false);
          setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.V2_VALIDATING, "candidate_ready");
          return { ok: true, candidate, reused: false };
        } catch (error) {
          if (owner === golfJoinHomeDataV2Generation) {
            controller.abort();
            golfJoinHomeDataV2Candidate = null;
            writeGolfJoinHomeDataV2CircuitFailure(true);
            setGolfJoinHomeDataV2State(
              GOLFJOIN_HOME_DATA_V2_STATES.V2_FALLBACK,
              error?.code || (error?.name === "AbortError" ? "request_aborted" : "candidate_failed")
            );
          }
          return { ok: false, fallback: true, reason: error?.code || error?.name || "candidate_failed", error };
        } finally {
          window.clearTimeout(timeout);
          if (owner === golfJoinHomeDataV2Generation) {
            golfJoinHomeDataV2Controller = null;
          }
        }
      })();
      golfJoinHomeDataV2CandidatePromise = transaction.finally(() => {
        if (golfJoinHomeDataV2CandidatePromise === transaction || owner === golfJoinHomeDataV2Generation) {
          golfJoinHomeDataV2CandidatePromise = null;
        }
      });
      return golfJoinHomeDataV2CandidatePromise;
    }

    function cloneGolfJoinHomeDataV2Value(value) {
      if (value === undefined || value === null) return value;
      if (typeof structuredClone === "function") {
        try {
          return structuredClone(value);
        } catch (error) {
          // Release payloads are JSON. Fall back to JSON cloning when a runtime
          // adds a non-cloneable value to an existing Legacy join object.
        }
      }
      return JSON.parse(JSON.stringify(value));
    }

    function prepareGolfJoinHomeDataV2Commit(candidate = golfJoinHomeDataV2Candidate) {
      if (!candidate || typeof candidate !== "object") {
        throw createGolfJoinHomeDataV2Error("home_data_v2_candidate_missing", "Home Data V2 candidate is missing.");
      }
      assertGolfJoinHomeDataV2Owner(candidate.owner);
      const manifest = candidate.manifest || {};
      const homeCards = cloneGolfJoinHomeDataV2Value(candidate.homeCards || {});
      const liveHome = cloneGolfJoinHomeDataV2Value(candidate.liveHome || {});
      if (
        homeCards.releaseRevision !== manifest.releaseRevision
        || liveHome.releaseRevision !== manifest.releaseRevision
        || homeCards.sourceSnapshotWatermark !== manifest.sourceSnapshotWatermark
        || liveHome.sourceSnapshotWatermark !== manifest.sourceSnapshotWatermark
      ) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_commit_stamp_mismatch", "Home Data V2 commit stamps do not match.");
      }
      if (!Array.isArray(homeCards.items) || !homeCards.items.length) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_commit_products_empty", "Home Data V2 products are empty.");
      }
      if (
        !Array.isArray(liveHome.newScheduleSummaries)
        || !Array.isArray(liveHome.participantSummaries)
        || !Array.isArray(liveHome.displayRules)
      ) {
        throw createGolfJoinHomeDataV2Error("home_data_v2_commit_live_invalid", "Home Data V2 live data is invalid.");
      }
      if (typeof normalizeExternalGolfJoinProduct !== "function") {
        throw createGolfJoinHomeDataV2Error("home_data_v2_product_normalizer_missing", "Home product normalizer is unavailable.");
      }
      const familyCatalog = cloneGolfJoinHomeDataV2Value(
        homeCards.productFamilyCatalog || golfJoinProductFamilyCatalog
      );
      if (!familyCatalog) {
        throw createGolfJoinHomeDataV2Error(
          "home_data_v2_family_catalog_missing",
          "Home Data V2 product family catalog is missing."
        );
      }
      validateGolfJoinHomeDataV2FamilyCatalog(familyCatalog, manifest);
      const products = homeCards.items.map((item, index) => {
        let normalized;
        try {
          normalized = normalizeExternalGolfJoinProduct(cloneGolfJoinHomeDataV2Value(item));
        } catch (error) {
          throw createGolfJoinHomeDataV2Error("home_data_v2_product_normalize_failed", `Home product normalization failed: ${index}`);
        }
        const goodSeq = String(normalized?.goodSeq || normalized?.erpProductId || item?.goodSeq || "").trim();
        if (!/^\d+$/.test(goodSeq)) {
          throw createGolfJoinHomeDataV2Error("home_data_v2_product_identity_invalid", `Home product identity is invalid: ${index}`);
        }
        return normalized;
      });
      return { candidate, manifest, homeCards, liveHome, familyCatalog, products };
    }

    function captureGolfJoinHomeDataV2LegacyState() {
      return {
        homeGolfJoinProducts,
        homeGolfJoinProductsLoadPromise,
        homeGolfJoinProductsLoadFailed,
        homeGolfJoinMinimumAdvanceDays,
        productFamilyManifest: cloneGolfJoinHomeDataV2Value(golfJoinProductFamilyManifest),
        productFamilyCatalog: cloneGolfJoinHomeDataV2Value(golfJoinProductFamilyCatalog),
        productFamilyLoadPromise: golfJoinProductFamilyLoadPromise,
        productFamilyLoadFailed: golfJoinProductFamilyLoadFailed,
        productFamilyIdEntries: [...golfJoinProductFamilyIdByGoodSeq.entries()],
        productFamilyEntries: [...golfJoinProductFamilyById.entries()]
          .map(([key, value]) => [key, cloneGolfJoinHomeDataV2Value(value)]),
        productMetaEntries: [...golfJoinProductMetaByGoodSeq.entries()]
          .map(([key, value]) => [key, cloneGolfJoinHomeDataV2Value(value)]),
        destinationSummary: golfJoinDestinationSummary,
        joins: joins.map((join) => cloneGolfJoinHomeDataV2Value(join)),
        pendingHomeBootstrapLightData,
        pendingHomeBootstrapLightOptions: cloneGolfJoinHomeDataV2Value(pendingHomeBootstrapLightOptions),
        homeBootstrapLightAuthoritativeApplied,
        homeBootstrapLightApplySignature,
        homeBootstrapSnapshotNeedsRefresh,
        homeInitialExternalProductsLoading,
        homeInitialExternalProductsLoadedOnce,
        homeBootstrapLoading,
        googleSheetBuilderApplicationsLoading,
        googleSheetJoinApplicationsLoading,
        googleSheetBuilderApplicationsReadCompleted,
        googleSheetJoinApplicationsReadCompleted,
        googleSheetBuilderApplicationsReadFailed,
        googleSheetJoinApplicationsReadFailed
      };
    }

    function restoreGolfJoinHomeDataV2LegacyState(snapshot = {}) {
      homeGolfJoinProducts = snapshot.homeGolfJoinProducts;
      homeGolfJoinProductsLoadPromise = snapshot.homeGolfJoinProductsLoadPromise;
      homeGolfJoinProductsLoadFailed = snapshot.homeGolfJoinProductsLoadFailed;
      homeGolfJoinMinimumAdvanceDays = snapshot.homeGolfJoinMinimumAdvanceDays;
      golfJoinProductFamilyManifest = cloneGolfJoinHomeDataV2Value(snapshot.productFamilyManifest);
      golfJoinProductFamilyCatalog = cloneGolfJoinHomeDataV2Value(snapshot.productFamilyCatalog);
      golfJoinProductFamilyLoadPromise = snapshot.productFamilyLoadPromise;
      golfJoinProductFamilyLoadFailed = snapshot.productFamilyLoadFailed;
      golfJoinProductFamilyIdByGoodSeq.clear();
      (snapshot.productFamilyIdEntries || []).forEach(([key, value]) => {
        golfJoinProductFamilyIdByGoodSeq.set(key, value);
      });
      golfJoinProductFamilyById.clear();
      (snapshot.productFamilyEntries || []).forEach(([key, value]) => {
        golfJoinProductFamilyById.set(key, cloneGolfJoinHomeDataV2Value(value));
      });
      golfJoinProductMetaByGoodSeq.clear();
      (snapshot.productMetaEntries || []).forEach(([key, value]) => {
        golfJoinProductMetaByGoodSeq.set(key, cloneGolfJoinHomeDataV2Value(value));
      });
      golfJoinDestinationSummary = snapshot.destinationSummary;
      joins.splice(0, joins.length, ...(snapshot.joins || []).map((join) => cloneGolfJoinHomeDataV2Value(join)));
      pendingHomeBootstrapLightData = snapshot.pendingHomeBootstrapLightData;
      pendingHomeBootstrapLightOptions = cloneGolfJoinHomeDataV2Value(snapshot.pendingHomeBootstrapLightOptions);
      homeBootstrapLightAuthoritativeApplied = snapshot.homeBootstrapLightAuthoritativeApplied;
      homeBootstrapLightApplySignature = snapshot.homeBootstrapLightApplySignature;
      homeBootstrapSnapshotNeedsRefresh = snapshot.homeBootstrapSnapshotNeedsRefresh;
      homeInitialExternalProductsLoading = snapshot.homeInitialExternalProductsLoading;
      homeInitialExternalProductsLoadedOnce = snapshot.homeInitialExternalProductsLoadedOnce;
      homeBootstrapLoading = snapshot.homeBootstrapLoading;
      googleSheetBuilderApplicationsLoading = snapshot.googleSheetBuilderApplicationsLoading;
      googleSheetJoinApplicationsLoading = snapshot.googleSheetJoinApplicationsLoading;
      googleSheetBuilderApplicationsReadCompleted = snapshot.googleSheetBuilderApplicationsReadCompleted;
      googleSheetJoinApplicationsReadCompleted = snapshot.googleSheetJoinApplicationsReadCompleted;
      googleSheetBuilderApplicationsReadFailed = snapshot.googleSheetBuilderApplicationsReadFailed;
      googleSheetJoinApplicationsReadFailed = snapshot.googleSheetJoinApplicationsReadFailed;
    }

    function invalidateGolfJoinHomeDataV2RenderCaches() {
      if (typeof mdPickListCacheSourceSignature !== "undefined") mdPickListCacheSourceSignature = "";
      if (typeof mdPickListElementCache !== "undefined") mdPickListElementCache?.clear?.();
      if (typeof mdPickRegionCache !== "undefined") {
        mdPickRegionCache = {
          sourceRef: null,
          minDepartureIso: "",
          products: [],
          availability: new Map(),
          searchItems: null,
          themeCandidates: null
        };
      }
    }

    function commitGolfJoinHomeDataV2Candidate(candidate = golfJoinHomeDataV2Candidate, options = {}) {
      const releaseRevision = String(candidate?.manifest?.releaseRevision || "");
      if (
        releaseRevision
        && releaseRevision === golfJoinHomeDataV2CommittedReleaseRevision
        && [GOLFJOIN_HOME_DATA_V2_STATES.V2_COMMITTED, GOLFJOIN_HOME_DATA_V2_STATES.V2_RUNNING].includes(golfJoinHomeDataV2State)
      ) {
        return { ok: true, reused: true, releaseRevision };
      }
      if (typeof hasOpenBlockingModal === "function" && hasOpenBlockingModal()) {
        return { ok: false, deferred: true, reason: "interaction_open" };
      }

      let snapshot = null;
      try {
        const prepared = prepareGolfJoinHomeDataV2Commit(candidate);
        if (homeGolfJoinProductsLoadPromise && !homeGolfJoinProducts) {
          throw createGolfJoinHomeDataV2Error("home_data_v2_legacy_products_in_flight", "Legacy products are still loading.");
        }
        snapshot = captureGolfJoinHomeDataV2LegacyState();
        homeGolfJoinProducts = prepared.products;
        homeGolfJoinProductsLoadPromise = Promise.resolve(prepared.products);
        homeGolfJoinProductsLoadFailed = false;
        applyGolfJoinProductFamilyCatalog({
          activePublicationRevision: prepared.familyCatalog.publicationRevision
        }, prepared.familyCatalog, { render: false });
        golfJoinProductFamilyLoadPromise = Promise.resolve(prepared.familyCatalog);
        golfJoinProductFamilyLoadFailed = false;
        applyHomeBootstrapLightFromHomeSummaryPayload(prepared.homeCards, {
          source: "release-v2-static",
          render: false
        });
        applyHomeBootstrapLightRows(prepared.liveHome, {
          fromCache: false,
          render: false,
          source: "release-v2-live"
        });
        homeBootstrapSnapshotNeedsRefresh = false;
        homeInitialExternalProductsLoading = false;
        homeInitialExternalProductsLoadedOnce = true;
        homeBootstrapLoading = false;
        invalidateGolfJoinHomeDataV2RenderCaches();
        golfJoinHomeDataV2CommittedReleaseRevision = releaseRevision;
        golfJoinHomeDataV2Candidate = null;
        setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.V2_COMMITTED, "commit_complete");
        if (options.render !== false && typeof scheduleHomeRender === "function") {
          scheduleHomeRender({ deferWhileModalOpen: true, source: "release-v2" });
        }
        try {
          if (typeof markGolfJoinPerformanceOnce === "function") markGolfJoinPerformanceOnce(
            "golfjoin:v2:committed",
            "golfjoin:duration:v2-commit",
            "golfjoin:boot:start"
          );
        } catch (error) {
          // Diagnostics must never invalidate an otherwise complete data commit.
        }
        return {
          ok: true,
          reused: false,
          releaseRevision,
          productCount: prepared.products.length,
          newScheduleCount: prepared.liveHome.newScheduleSummaries.length,
          participantSummaryCount: prepared.liveHome.participantSummaries.length
        };
      } catch (error) {
        if (snapshot) {
          try {
            restoreGolfJoinHomeDataV2LegacyState(snapshot);
          } catch (restoreError) {
            error.restoreError = restoreError;
          }
        }
        golfJoinHomeDataV2Candidate = null;
        golfJoinHomeDataV2CommittedReleaseRevision = "";
        writeGolfJoinHomeDataV2CircuitFailure(true);
        setGolfJoinHomeDataV2State(
          GOLFJOIN_HOME_DATA_V2_STATES.V2_FALLBACK,
          error?.code || "home_data_v2_commit_failed"
        );
        return {
          ok: false,
          fallback: true,
          reason: error?.code || "home_data_v2_commit_failed",
          error
        };
      }
    }

    async function runGolfJoinHomeDataV2Transaction(options = {}) {
      const loaded = await loadGolfJoinHomeDataV2Candidate(options);
      if (!loaded?.ok) return loaded;
      const committed = commitGolfJoinHomeDataV2Candidate(loaded.candidate, options);
      if (!committed?.ok || committed.deferred) return committed;
      setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.V2_RUNNING, "running");
      return { ...committed, state: GOLFJOIN_HOME_DATA_V2_STATES.V2_RUNNING };
    }

    async function runGolfJoinHomeDataV2Startup(options = {}) {
      if (!GOLFJOIN_HOME_DATA_V2_AUTO_BOOT_ENABLED && options.forceAutoBoot !== true) {
        setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.LEGACY_READY, "auto_boot_off");
        return { ok: false, disabled: true, useLegacy: true, reason: "auto_boot_off" };
      }
      if (options.forceAutoBoot !== true && !isGolfJoinHomeDataV2RolloutEligible()) {
        setGolfJoinHomeDataV2State(GOLFJOIN_HOME_DATA_V2_STATES.LEGACY_READY, "rollout_not_eligible");
        return { ok: false, disabled: true, useLegacy: true, reason: "rollout_not_eligible" };
      }
      const result = await runGolfJoinHomeDataV2Transaction({
        ...options,
        force: true,
        timeoutMs: Math.max(1000, Number(options.timeoutMs) || GOLFJOIN_HOME_DATA_V2_STARTUP_TIMEOUT_MS)
      });
      return {
        ...result,
        useLegacy: !(result?.ok && result?.state === GOLFJOIN_HOME_DATA_V2_STATES.V2_RUNNING)
      };
    }
    // GOLFJOIN_HOME_DATA_V2_BOOTSTRAP_END
