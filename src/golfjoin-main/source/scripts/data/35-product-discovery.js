
    const GOLFJOIN_PRODUCT_DISCOVERY_ENABLED = window.GOLFJOIN_PRODUCT_DISCOVERY_ENABLED !== false;
    const GOLFJOIN_PRODUCT_DISCOVERY_ROOT_PATH = "web/product-discovery/manifest.json";
    const GOLFJOIN_PRODUCT_DISCOVERY_TIMEOUT_MS = 5000;
    let golfJoinProductDiscoveryManifest = null;
    let golfJoinProductDiscoveryIndex = null;
    let golfJoinProductDiscoveryLookup = null;
    let golfJoinProductDiscoveryManifestPromise = null;
    let golfJoinProductDiscoveryIndexPromise = null;
    let golfJoinProductDiscoveryLookupPromise = null;
    let golfJoinProductDiscoveryUnavailable = false;
    let golfJoinProductDiscoveryLoadingCount = 0;
    const golfJoinProductDiscoveryMonthCache = new Map();
    const golfJoinProductDiscoveryMonthPromiseCache = new Map();
    const golfJoinProductDiscoveryProductCache = new Map();
    let golfJoinProductDiscoveryProductCacheRevision = 0;
    let golfJoinProductDiscoveryProductSnapshotRevision = -1;
    let golfJoinProductDiscoveryProductSnapshot = [];
    const golfJoinProductDiscoveryConsumerGeneration = new Map();
    const golfJoinProductDiscoveryDiagnostics = [];

    function recordGolfJoinProductDiscoveryDiagnostic(type, detail = {}) {
      golfJoinProductDiscoveryDiagnostics.push({
        type: String(type || "unknown"),
        consumer: String(detail.consumer || ""),
        reason: String(detail.reason || ""),
        revision: String(detail.revision || golfJoinProductDiscoveryManifest?.discoveryRevision || ""),
        monthCount: Number(detail.monthCount || 0),
        fallback: detail.fallback === true,
        at: new Date().toISOString()
      });
      if (golfJoinProductDiscoveryDiagnostics.length > 50) golfJoinProductDiscoveryDiagnostics.shift();
    }

    function getGolfJoinProductDiscoveryDiagnostics() {
      return golfJoinProductDiscoveryDiagnostics.map((item) => ({ ...item }));
    }

    function beginGolfJoinProductDiscoveryConsumer(consumer = "default") {
      const key = String(consumer || "default");
      const generation = Number(golfJoinProductDiscoveryConsumerGeneration.get(key) || 0) + 1;
      golfJoinProductDiscoveryConsumerGeneration.set(key, generation);
      return generation;
    }

    function isGolfJoinProductDiscoveryConsumerCurrent(consumer = "default", generation = 0) {
      return Number(golfJoinProductDiscoveryConsumerGeneration.get(String(consumer || "default")) || 0) === Number(generation);
    }

    function invalidateGolfJoinProductDiscoveryConsumer(consumer = "default") {
      return beginGolfJoinProductDiscoveryConsumer(consumer);
    }

    function getGolfJoinProductDiscoveryRootUrls() {
      const urls = [`https://storage.googleapis.com/golfjoin-bucket/${GOLFJOIN_PRODUCT_DISCOVERY_ROOT_PATH}`];
      if (/^(?:localhost|127\.0\.0\.1)$/i.test(String(window.location?.hostname || ""))) {
        urls.push(`/${GOLFJOIN_PRODUCT_DISCOVERY_ROOT_PATH}`);
      }
      return urls;
    }

    function getGolfJoinProductDiscoveryReferenceUrls(reference = {}) {
      const objectName = String(reference.objectName || "").replace(/^\/+/, "").trim();
      return [...new Set([
        String(reference.url || "").trim(),
        objectName ? `https://storage.googleapis.com/golfjoin-bucket/${objectName.split("/").map(encodeURIComponent).join("/")}` : "",
        /^(?:localhost|127\.0\.0\.1)$/i.test(String(window.location?.hostname || "")) && objectName ? `/${objectName}` : ""
      ].filter(Boolean))];
    }

    async function sha256GolfJoinProductDiscoveryText(value = "") {
      if (!window.crypto?.subtle?.digest) throw new Error("Product discovery SHA-256 is unavailable");
      const bytes = new TextEncoder().encode(String(value));
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    async function fetchGolfJoinProductDiscoveryJson(url, options = {}) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), GOLFJOIN_PRODUCT_DISCOVERY_TIMEOUT_MS);
      try {
        const response = await fetch(url, { cache: options.cache || "force-cache", signal: controller.signal });
        if (!response.ok) throw new Error(`Product discovery load failed: ${response.status}`);
        const source = await response.text();
        if (options.sha256) {
          const actualHash = await sha256GolfJoinProductDiscoveryText(source);
          if (actualHash !== options.sha256) throw new Error("Product discovery SHA-256 mismatch");
        }
        return JSON.parse(source || "{}");
      } finally {
        window.clearTimeout(timeout);
      }
    }

    async function loadGolfJoinProductDiscoveryFromUrls(urls = [], options = {}) {
      let lastError = new Error("Product discovery URL is missing");
      for (const url of urls) {
        try {
          return await fetchGolfJoinProductDiscoveryJson(url, options);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    }

    function isGolfJoinProductDiscoveryRevision(value = "") {
      return /^gpd_[a-f0-9]{24}$/.test(String(value || ""));
    }

    function validateGolfJoinProductDiscoveryReference(reference = {}, revision = "", role = "") {
      const suffix = `/product-discovery/${revision}/${role}.json`;
      let decodedUrl = "";
      try {
        decodedUrl = decodeURIComponent(String(reference.url || ""));
      } catch (error) {
        return false;
      }
      return String(reference.objectName || "").endsWith(suffix)
        && decodedUrl.endsWith(suffix)
        && /^[a-f0-9]{64}$/.test(String(reference.sha256 || ""))
        && Number(reference.rawBytes) > 0;
    }

    function validateGolfJoinProductDiscoveryManifest(payload = {}) {
      const revision = String(payload.discoveryRevision || "");
      return payload.schema === "secret-golf-join-product-discovery-manifest-v1"
        && isGolfJoinProductDiscoveryRevision(revision)
        && payload.browserReadEnabled === true
        && /^\d{4}-\d{2}-\d{2}$/.test(String(payload.range?.startDate || ""))
        && /^\d{4}-\d{2}-\d{2}$/.test(String(payload.range?.endDate || ""))
        && payload.range.endDate >= payload.range.startDate
        && Number(payload.eventCount) > 0
        && Number(payload.monthCount) > 0
        && Number(payload.regionCount) >= 0
        && validateGolfJoinProductDiscoveryReference(payload.index, revision, "index")
        && validateGolfJoinProductDiscoveryReference(payload.lookup, revision, "lookup");
    }

    function validateGolfJoinProductDiscoveryIndex(payload = {}, manifest = golfJoinProductDiscoveryManifest) {
      const months = Array.isArray(payload.months) ? payload.months : [];
      const regions = Array.isArray(payload.regions) ? payload.regions : [];
      if (!manifest || payload.schema !== "secret-golf-join-product-discovery-index-v1"
        || payload.discoveryRevision !== manifest.discoveryRevision
        || Number(payload.eventCount) !== Number(manifest.eventCount)
        || Number(payload.monthCount) !== months.length
        || Number(payload.monthCount) !== Number(manifest.monthCount)
        || Number(payload.regionCount) !== regions.length
        || Number(payload.regionCount) !== Number(manifest.regionCount)) return false;
      const seenMonths = new Set();
      let eventCount = 0;
      for (const entry of months) {
        const month = String(entry?.month || "");
        const suffix = `/product-discovery/${manifest.discoveryRevision}/months/${month}.json`;
        let decodedUrl = "";
        try {
          decodedUrl = decodeURIComponent(String(entry?.url || ""));
        } catch (error) {
          return false;
        }
        if (!/^\d{4}-\d{2}$/.test(month) || seenMonths.has(month)
          || !String(entry?.objectName || "").endsWith(suffix) || !decodedUrl.endsWith(suffix)
          || !/^[a-f0-9]{64}$/.test(String(entry?.sha256 || "")) || !(Number(entry?.rawBytes) > 0)
          || !(Number(entry?.count) > 0)) return false;
        seenMonths.add(month);
        eventCount += Number(entry.count);
      }
      if (eventCount !== Number(payload.eventCount)) return false;
      return regions.every((entry) => String(entry?.name || "").trim()
        && Number(entry?.count) > 0
        && Array.isArray(entry?.months)
        && entry.months.length > 0
        && entry.months.every((month) => seenMonths.has(String(month))));
    }

    function validateGolfJoinProductDiscoveryLookup(payload = {}, manifest = golfJoinProductDiscoveryManifest) {
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!manifest || payload.schema !== "secret-golf-join-product-discovery-lookup-v1"
        || payload.discoveryRevision !== manifest.discoveryRevision
        || Number(payload.count) !== Number(manifest.eventCount)
        || Number(payload.count) !== items.length) return false;
      const seenKeys = new Set();
      return items.every((entry) => {
        const key = `${entry?.goodSeq || ""}:${entry?.eventSeq || ""}`;
        if (!/^\d+$/.test(String(entry?.goodSeq || "")) || entry?.key !== key
          || !/^\d{4}-\d{2}$/.test(String(entry?.month || "")) || seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });
    }

    function validateGolfJoinProductDiscoveryMonth(payload = {}, monthMeta = {}, manifest = golfJoinProductDiscoveryManifest) {
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!manifest || payload.schema !== "secret-golf-join-product-discovery-month-v1"
        || payload.discoveryRevision !== manifest.discoveryRevision
        || payload.month !== monthMeta.month
        || Number(payload.count) !== Number(monthMeta.count)
        || Number(payload.count) !== items.length) return false;
      const seenKeys = new Set();
      return items.every((entry) => {
        const key = `${entry?.goodSeq || ""}:${entry?.eventSeq || ""}`;
        if (!/^\d+$/.test(String(entry?.goodSeq || "")) || !String(entry?.eventSeq || "")
          || !String(entry?.departureDate || "").startsWith(`${payload.month}-`)
          || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry?.returnDate || ""))
          || String(entry.returnDate) < String(entry.departureDate)
          || !(Number(entry?.price) > 0) || seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });
    }

    function ensureGolfJoinProductDiscoveryManifest() {
      if (!GOLFJOIN_PRODUCT_DISCOVERY_ENABLED || golfJoinProductDiscoveryUnavailable) {
        return Promise.reject(new Error("Product discovery is unavailable"));
      }
      if (golfJoinProductDiscoveryManifest) return Promise.resolve(golfJoinProductDiscoveryManifest);
      if (!golfJoinProductDiscoveryManifestPromise) {
        golfJoinProductDiscoveryManifestPromise = loadGolfJoinProductDiscoveryFromUrls(
          getGolfJoinProductDiscoveryRootUrls(),
          { cache: "no-cache" }
        ).then((payload) => {
          if (!validateGolfJoinProductDiscoveryManifest(payload)) throw new Error("Product discovery manifest validation failed");
          golfJoinProductDiscoveryManifest = payload;
          recordGolfJoinProductDiscoveryDiagnostic("manifest-ready", { revision: payload.discoveryRevision });
          return payload;
        }).catch((error) => {
          golfJoinProductDiscoveryUnavailable = true;
          throw error;
        });
      }
      return golfJoinProductDiscoveryManifestPromise;
    }

    function ensureGolfJoinProductDiscoveryIndex() {
      if (golfJoinProductDiscoveryIndex) return Promise.resolve(golfJoinProductDiscoveryIndex);
      if (!golfJoinProductDiscoveryIndexPromise) {
        golfJoinProductDiscoveryIndexPromise = ensureGolfJoinProductDiscoveryManifest().then((manifest) => (
          loadGolfJoinProductDiscoveryFromUrls(getGolfJoinProductDiscoveryReferenceUrls(manifest.index), {
            sha256: manifest.index.sha256,
            cache: "force-cache"
          }).then((payload) => {
            if (!validateGolfJoinProductDiscoveryIndex(payload, manifest)) throw new Error("Product discovery index validation failed");
            golfJoinProductDiscoveryIndex = payload;
            return payload;
          })
        ));
      }
      return golfJoinProductDiscoveryIndexPromise;
    }

    function ensureGolfJoinProductDiscoveryLookup() {
      if (golfJoinProductDiscoveryLookup) return Promise.resolve(golfJoinProductDiscoveryLookup);
      if (!golfJoinProductDiscoveryLookupPromise) {
        golfJoinProductDiscoveryLookupPromise = ensureGolfJoinProductDiscoveryManifest().then((manifest) => (
          loadGolfJoinProductDiscoveryFromUrls(getGolfJoinProductDiscoveryReferenceUrls(manifest.lookup), {
            sha256: manifest.lookup.sha256,
            cache: "force-cache"
          }).then((payload) => {
            if (!validateGolfJoinProductDiscoveryLookup(payload, manifest)) throw new Error("Product discovery lookup validation failed");
            golfJoinProductDiscoveryLookup = payload;
            return payload;
          })
        ));
      }
      return golfJoinProductDiscoveryLookupPromise;
    }

    function cacheGolfJoinProductDiscoveryItems(items = []) {
      const products = items.map((item, index) => {
        const product = normalizeExternalGolfJoinProduct(item, index);
        const reference = getSecretTourProductReference(product);
        const key = reference.goodSeq && reference.eventSeq
          ? `${reference.goodSeq}:${reference.eventSeq}`
          : String(product.id || "");
        if (key) golfJoinProductDiscoveryProductCache.set(key, product);
        return product;
      });
      if (products.length) golfJoinProductDiscoveryProductCacheRevision += 1;
      return products;
    }

    function getCachedGolfJoinProductDiscoveryProducts() {
      if (golfJoinProductDiscoveryProductSnapshotRevision !== golfJoinProductDiscoveryProductCacheRevision) {
        golfJoinProductDiscoveryProductSnapshot = [...golfJoinProductDiscoveryProductCache.values()];
        golfJoinProductDiscoveryProductSnapshotRevision = golfJoinProductDiscoveryProductCacheRevision;
      }
      return golfJoinProductDiscoveryProductSnapshot;
    }

    function loadGolfJoinProductDiscoveryMonth(month = "") {
      const monthKey = String(month || "");
      if (golfJoinProductDiscoveryMonthCache.has(monthKey)) {
        return Promise.resolve(golfJoinProductDiscoveryMonthCache.get(monthKey));
      }
      if (golfJoinProductDiscoveryMonthPromiseCache.has(monthKey)) {
        return golfJoinProductDiscoveryMonthPromiseCache.get(monthKey);
      }
      const loadPromise = ensureGolfJoinProductDiscoveryIndex().then((index) => {
        const monthMeta = index.months.find((entry) => entry.month === monthKey);
        if (!monthMeta) throw new Error(`Product discovery month is unavailable: ${monthKey}`);
        return loadGolfJoinProductDiscoveryFromUrls(getGolfJoinProductDiscoveryReferenceUrls(monthMeta), {
          sha256: monthMeta.sha256,
          cache: "force-cache"
        }).then((payload) => {
          if (!validateGolfJoinProductDiscoveryMonth(payload, monthMeta)) throw new Error("Product discovery month validation failed");
          const products = cacheGolfJoinProductDiscoveryItems(payload.items);
          golfJoinProductDiscoveryMonthCache.set(monthKey, products);
          return products;
        });
      }).finally(() => golfJoinProductDiscoveryMonthPromiseCache.delete(monthKey));
      golfJoinProductDiscoveryMonthPromiseCache.set(monthKey, loadPromise);
      return loadPromise;
    }

    async function loadGolfJoinProductDiscoveryMonths(months = [], options = {}) {
      const monthKeys = [...new Set(months.map((month) => String(month || "")).filter((month) => /^\d{4}-\d{2}$/.test(month)))];
      const consumer = String(options.consumer || "unknown");
      if (!monthKeys.length) return [];
      golfJoinProductDiscoveryLoadingCount += 1;
      try {
        const index = await ensureGolfJoinProductDiscoveryIndex();
        const publishedMonths = new Set((index.months || []).map((entry) => String(entry?.month || "")));
        const availableMonthKeys = monthKeys.filter((month) => publishedMonths.has(month));
        if (!availableMonthKeys.length) {
          recordGolfJoinProductDiscoveryDiagnostic("months-ready", {
            consumer,
            reason: options.reason,
            monthCount: 0
          });
          return [];
        }
        const products = (await Promise.all(availableMonthKeys.map(loadGolfJoinProductDiscoveryMonth))).flat();
        recordGolfJoinProductDiscoveryDiagnostic("months-ready", {
          consumer,
          reason: options.reason,
          monthCount: availableMonthKeys.length
        });
        return products;
      } catch (error) {
        recordGolfJoinProductDiscoveryDiagnostic("fallback", {
          consumer,
          reason: options.reason || error?.message,
          monthCount: monthKeys.length,
          fallback: true
        });
        if (options.fallback === false) throw error;
        golfJoinSafeWarn("Product discovery failed. The full product loader will be used for this consumer.", {
          consumer,
          message: error?.message || ""
        });
        return ensureExternalGolfJoinProductsLoaded();
      } finally {
        golfJoinProductDiscoveryLoadingCount = Math.max(0, golfJoinProductDiscoveryLoadingCount - 1);
      }
    }

    function getGolfJoinProductDiscoveryMonthKey(value = new Date()) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    function getGolfJoinProductDiscoveryAdjacentMonths(value = new Date()) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return [];
      return [-1, 0, 1].map((offset) => getGolfJoinProductDiscoveryMonthKey(
        new Date(date.getFullYear(), date.getMonth() + offset, 1)
      ));
    }

    async function loadGolfJoinProductDiscoveryRegion(region = "", options = {}) {
      const consumer = String(options.consumer || "region");
      try {
        const index = await ensureGolfJoinProductDiscoveryIndex();
        const rawRegion = String(region || "").trim();
        const normalize = typeof normalizeRegionKeyword === "function"
          ? normalizeRegionKeyword
          : (value) => String(value || "").replace(/[^0-9a-z가-힣]/gi, "").toLowerCase();
        const tokens = typeof getRegionSearchTokens === "function"
          ? getRegionSearchTokens(rawRegion)
          : [normalize(rawRegion)].filter(Boolean);
        const matchedMonths = new Set();
        index.regions.forEach((entry) => {
          const key = normalize(entry.name);
          if (!key || !tokens.some((token) => key.includes(token) || token.includes(key))) return;
          entry.months.forEach((month) => matchedMonths.add(month));
        });
        const requestedMonths = Array.isArray(options.months) && options.months.length
          ? options.months.filter((month) => !matchedMonths.size || matchedMonths.has(month))
          : [...matchedMonths];
        const months = requestedMonths.length
          ? requestedMonths
          : getGolfJoinProductDiscoveryAdjacentMonths(options.date || new Date());
        return loadGolfJoinProductDiscoveryMonths(months, {
          ...options,
          consumer,
          reason: options.reason || "region-search"
        });
      } catch (error) {
        recordGolfJoinProductDiscoveryDiagnostic("fallback", {
          consumer,
          reason: options.reason || error?.message,
          fallback: true
        });
        if (options.fallback === false) throw error;
        return ensureExternalGolfJoinProductsLoaded();
      }
    }

    function findCachedGolfJoinProductDiscoveryProduct(goodSeq = "", eventSeq = "") {
      const key = `${String(goodSeq || "").trim()}:${String(eventSeq || "").trim()}`;
      return golfJoinProductDiscoveryProductCache.get(key) || null;
    }

    async function loadGolfJoinProductDiscoveryDirect(goodSeq = "", eventSeq = "", options = {}) {
      const normalizedGoodSeq = String(goodSeq || "").trim();
      const normalizedEventSeq = String(eventSeq || "").trim();
      const cached = findCachedGolfJoinProductDiscoveryProduct(normalizedGoodSeq, normalizedEventSeq);
      if (cached) return cached;
      const consumer = String(options.consumer || "direct");
      try {
        const lookup = await ensureGolfJoinProductDiscoveryLookup();
        const entry = lookup.items.find((item) => item.goodSeq === normalizedGoodSeq && item.eventSeq === normalizedEventSeq);
        if (!entry) throw new Error("Product discovery direct target is missing");
        await loadGolfJoinProductDiscoveryMonths([entry.month], { consumer, reason: options.reason, fallback: false });
        const product = findCachedGolfJoinProductDiscoveryProduct(normalizedGoodSeq, normalizedEventSeq);
        if (!product) throw new Error("Product discovery direct target did not load");
        return product;
      } catch (error) {
        recordGolfJoinProductDiscoveryDiagnostic("fallback", {
          consumer,
          reason: options.reason || error?.message,
          fallback: true
        });
        if (options.fallback === false) throw error;
        const products = await ensureExternalGolfJoinProductsLoaded();
        return products.find((product) => {
          const reference = getSecretTourProductReference(product);
          return reference.goodSeq === normalizedGoodSeq && reference.eventSeq === normalizedEventSeq;
        }) || null;
      }
    }
