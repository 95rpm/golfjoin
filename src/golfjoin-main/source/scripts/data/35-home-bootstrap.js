    async function hydrateHomeBootstrapFromGoogleSheet() {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return { ok: false };
      const member = getJoinCachedCurrentMember();
      const memberKey = getJoinWishMemberKey(member);
      const memberLookupParams = getJoinSheetMemberLookupParams(member);
      googleSheetBuilderApplicationsLoading = true;
      googleSheetJoinApplicationsLoading = true;
      googleSheetJoinWishesLoading = Boolean(getJoinWishMemberKey(member));
      googleSheetBuilderApplicationsReadFailed = false;
      googleSheetJoinApplicationsReadFailed = false;
      googleSheetJoinWishesReadFailed = false;
      renderJoins();
      const payload = {
        ...memberLookupParams,
        newScheduleLimit: 100,
        joinApplicationLimit: 50,
        reviewLimit: 200,
        wishLimit: 200
      };
      try {
        const data = await postGolfJoinSheetAction("home_bootstrap", payload, "Home bootstrap");
        applyHomeBootstrapRows(data || {}, { wishMemberKey: memberKey });
        return { ok: true, data };
      } catch (error) {
        googleSheetBuilderApplicationsLoading = false;
        googleSheetJoinApplicationsLoading = false;
        googleSheetJoinWishesLoading = false;
        googleSheetBuilderApplicationsReadCompleted = true;
        googleSheetJoinApplicationsReadCompleted = true;
        googleSheetJoinWishesReadCompleted = true;
        googleSheetBuilderApplicationsReadFailed = true;
        googleSheetJoinApplicationsReadFailed = true;
        googleSheetJoinWishesReadFailed = true;
        renderJoins();
        throw error;
      }
    }

    function getHomeSheetMemberPayload() {
      const member = getJoinCachedCurrentMember();
      const memberLookupParams = getJoinSheetMemberLookupParams(member);
      return {
        member,
        memberKey: getJoinWishMemberKey(member),
        payload: memberLookupParams
      };
    }

    function applyHomeStatsPayload(data = {}, options = {}) {
      const visitorCount = Number(data.recent30DayVisitors ?? data.visitorCount);
      const activeCount = Number(data.activeUsersNow ?? data.activeUserCount);
      if (options.render !== false) {
        if (Number.isFinite(visitorCount) && visitorCount >= 0) {
          queueHeroCalendarProfileCount(visitorCount);
        }
        if (Number.isFinite(activeCount) && activeCount >= 0) {
          queueHeroCalendarActiveCount(activeCount);
        }
      }
      if (options.cache !== false) {
        writeJoinJsonCache(HOME_STATS_CACHE_KEY, {
          recent30DayVisitors: Number.isFinite(visitorCount) && visitorCount >= 0 ? visitorCount : joinMemberProfileCompletedCount,
          activeUsersNow: Number.isFinite(activeCount) && activeCount >= 0 ? activeCount : heroCalendarActiveCountValue,
          updatedAt: data.updatedAt || nowKstISOString()
        });
      }
    }

    function hydrateHomeStatsFromLocalCache(options = {}) {
      const cached = readJoinJsonCache(HOME_STATS_CACHE_KEY, Math.max(HOME_STATS_VISITOR_TTL_MS, HOME_STATS_ACTIVE_TTL_MS));
      const payload = cached?.payload || {};
      const fetchedAt = Number(cached?.fetchedAt || 0);
      if (!payload || !fetchedAt) return false;
      const visitorFresh = Date.now() - fetchedAt <= HOME_STATS_VISITOR_TTL_MS;
      const activeFresh = Date.now() - fetchedAt <= HOME_STATS_ACTIVE_TTL_MS;
      const hasVisitorCount = visitorFresh && Number.isFinite(Number(payload.recent30DayVisitors));
      const hasActiveCount = activeFresh && Number.isFinite(Number(payload.activeUsersNow));
      if (options.requireComplete === true && (!hasVisitorCount || !hasActiveCount)) return false;
      if (hasVisitorCount) {
        queueHeroCalendarProfileCount(Number(payload.recent30DayVisitors));
      }
      if (hasActiveCount) {
        queueHeroCalendarActiveCount(Number(payload.activeUsersNow));
      }
      return hasVisitorCount || hasActiveCount;
    }

    async function hydrateHomeStatsFromGoogleSheet(options = {}) {
      const renderedFreshCache = hydrateHomeStatsFromLocalCache({ requireComplete: true });
      if (renderedFreshCache && options.preferCache === true) {
        return { ok: true, cached: true };
      }
      if (!GOLFJOIN_SHEET_API_ENDPOINT) {
        if (!renderedFreshCache) hydrateHomeStatsFromLocalCache();
        return { ok: false };
      }
      try {
        const data = await postGolfJoinSheetAction("home_stats", {}, "Home stats");
        applyHomeStatsPayload(data || {}, { render: !renderedFreshCache });
        return { ok: true, data };
      } catch (error) {
        golfJoinSafeWarn("Failed to load home stats.", error);
        if (!renderedFreshCache) hydrateHomeStatsFromLocalCache();
        return { ok: false, error };
      }
    }

    function hydrateHomeBootstrapLightFromLocalCache() {
      const cached = readJoinJsonCache(HOME_BOOTSTRAP_LIGHT_CACHE_KEY, HOME_BOOTSTRAP_LIGHT_LOCAL_CACHE_TTL_MS);
      if (!cached?.payload) return false;
      applyHomeBootstrapLightRows(cached.payload, { fromCache: true, render: false });
      return true;
    }

    function getGolfJoinHomeSummaryUrls() {
      const summaryCacheBust = `v=${encodeURIComponent(GOLFJOIN_PRODUCTS_SUMMARY_VERSION)}`;
      return [
        `https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_home_summary.json?${summaryCacheBust}`,
        `web/golfjoin_home_summary.json?${summaryCacheBust}`
      ];
    }

    function getGolfJoinHomeCardsUrls() {
      const cardsCacheBust = `v=${encodeURIComponent(GOLFJOIN_HOME_CARDS_VERSION)}`;
      return [
        `https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_home_cards.json?${cardsCacheBust}`,
        `web/golfjoin_home_cards.json?${cardsCacheBust}`
      ];
    }

    function getGolfJoinHomeManifestUrls() {
      return [
        `https://storage.googleapis.com/golfjoin-bucket/${GOLFJOIN_HOME_MANIFEST_PATH}`,
        GOLFJOIN_HOME_MANIFEST_PATH
      ];
    }

    function fetchGolfJoinHomeJson(url, label = "Home data", options = {}) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), GOLFJOIN_HOME_JSON_FETCH_TIMEOUT_MS);
      return fetch(url, { cache: options.cache || "force-cache", signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`${label} load failed: ${response.status}`);
          return response.json();
        })
        .catch((error) => {
          if (error?.name === "AbortError") {
            throw new Error(`${label} load timed out.`);
          }
          throw error;
        })
        .finally(() => window.clearTimeout(timeout));
    }

    function raceJoinPromises(promises = []) {
      const candidates = Array.isArray(promises) ? promises : [];
      return new Promise((resolve, reject) => {
        candidates.forEach((candidate) => {
          if (candidate && typeof candidate.then === "function") {
            candidate.then(resolve, reject);
            return;
          }
          resolve(candidate);
        });
      });
    }

    function withGolfJoinHomeProductsReadyTimeout(promise) {
      let timeout = null;
      const timeoutPromise = new Promise((_, reject) => {
        timeout = window.setTimeout(() => {
          reject(new Error("Home product cards did not become ready in time."));
        }, GOLFJOIN_HOME_PRODUCTS_READY_TIMEOUT_MS);
      });
      return raceJoinPromises([promise, timeoutPromise])
        .finally(() => window.clearTimeout(timeout));
    }

    function loadGolfJoinHomeCardsJson() {
      if (!GOLFJOIN_HOME_CARDS_ENABLED) return loadGolfJoinHomeSummaryJson();
      if (!golfJoinHomeCardsLoadPromise) {
        const loadLegacyCards = () => getGolfJoinHomeCardsUrls().reduce((promise, url) => {
          return promise.catch(() => fetchGolfJoinHomeJson(url, "Home cards"));
        }, Promise.reject(new Error("Home cards load not started.")));
        golfJoinHomeCardsLoadPromise = loadGolfJoinHomeManifestJson()
          .then((manifest) => {
            const urls = [...new Set([
              manifest.activeCardsUrl,
              manifest.activeCardsObjectName
                ? `https://storage.googleapis.com/golfjoin-bucket/${String(manifest.activeCardsObjectName).replace(/^\/+/, "")}`
                : "",
              manifest.activeCardsObjectName || ""
            ].filter(Boolean))];
            if (!urls.length) throw new Error("Home manifest has no active cards URL.");
            return urls.reduce((promise, url) => (
              promise.catch(() => fetchGolfJoinHomeJson(url, "Versioned home cards"))
            ), Promise.reject(new Error("Versioned home cards load not started.")));
          })
          .catch(loadLegacyCards)
          .catch((error) => {
            golfJoinHomeCardsLoadPromise = null;
            throw error;
          });
      }
      return golfJoinHomeCardsLoadPromise;
    }

    function loadGolfJoinHomeManifestJson() {
      if (golfJoinHomeManifest) return Promise.resolve(golfJoinHomeManifest);
      if (!golfJoinHomeManifestLoadPromise) {
        golfJoinHomeManifestLoadPromise = getGolfJoinHomeManifestUrls().reduce((promise, url) => (
          promise.catch(() => fetchGolfJoinHomeJson(url, "Home manifest", { cache: "no-cache" }))
        ), Promise.reject(new Error("Home manifest load not started."))).then((manifest) => {
          if (manifest?.schema !== "secret-golf-join-home-manifest-v1" || !manifest.activePublicationRevision) {
            throw new Error("Home manifest is invalid.");
          }
          golfJoinHomeManifest = manifest;
          const minimumAdvanceDays = Number(manifest.minimumAdvanceDays);
          if (Number.isFinite(minimumAdvanceDays) && minimumAdvanceDays >= 0) {
            homeGolfJoinMinimumAdvanceDays = minimumAdvanceDays;
          }
          return manifest;
        }).catch((error) => {
          golfJoinHomeManifestLoadPromise = null;
          throw error;
        });
      }
      return golfJoinHomeManifestLoadPromise;
    }

    function loadGolfJoinHomeSummaryJson() {
      if (!golfJoinHomeSummaryLoadPromise) {
        golfJoinHomeSummaryLoadPromise = getGolfJoinHomeSummaryUrls().reduce((promise, url) => {
          return promise.catch(() => fetchGolfJoinHomeJson(url, "Home summary"));
        }, Promise.reject(new Error("Home summary load not started."))).catch((error) => {
          golfJoinHomeSummaryLoadPromise = null;
          throw error;
        });
      }
      return golfJoinHomeSummaryLoadPromise;
    }

    function normalizeGolfJoinProductImageUrl(value = "") {
      const imageUrl = String(value || "").trim();
      return /^https:\/\//i.test(imageUrl) ? imageUrl : "";
    }

    function hydrateBuilderJoinImagesFromProductMeta() {
      let updatedCount = 0;
      joins.forEach((join) => {
        if (!join?.isBuilderApplicationJoin || normalizeGolfJoinProductImageUrl(join.image)) return;
        const reference = getSecretTourProductReference({
          ...join,
          erpProductId: join.erpProductId || join.goodSeq || getNestedValue(join, "sheetApplication.trip.erpProductId"),
          erpEventSeq: join.erpEventSeq || join.eventSeq || getNestedValue(join, "sheetApplication.trip.erpEventSeq")
        });
        const productMeta = golfJoinProductMetaByGoodSeq.get(String(reference.goodSeq || "").trim()) || {};
        const imageUrl = normalizeGolfJoinProductImageUrl(productMeta.image);
        if (!imageUrl) return;
        join.image = imageUrl;
        updatedCount += 1;
      });
      return updatedCount;
    }

    function applyHomeBootstrapLightFromHomeSummaryPayload(payload = {}, options = {}) {
      let applied = false;
      const minimumAdvanceDays = Number(payload.minimumAdvanceDays);
      if (Number.isFinite(minimumAdvanceDays) && minimumAdvanceDays >= 0) {
        homeGolfJoinMinimumAdvanceDays = minimumAdvanceDays;
      }
      if (payload?.productMetaByGoodSeq && typeof payload.productMetaByGoodSeq === "object") {
        golfJoinProductMetaByGoodSeq.clear();
        Object.entries(payload.productMetaByGoodSeq).forEach(([goodSeq, meta]) => {
          const normalizedGoodSeq = String(goodSeq || "").trim();
          if (!/^\d+$/.test(normalizedGoodSeq) || !meta || typeof meta !== "object") return;
          golfJoinProductMetaByGoodSeq.set(normalizedGoodSeq, {
            detailTitleCopy: String(meta.detailTitleCopy || "").trim(),
            image: normalizeGolfJoinProductImageUrl(meta.image),
            departureAirport: normalizeSecretTourAirportName(meta.departureAirport)
          });
        });
        if (hydrateBuilderJoinImagesFromProductMeta() > 0) applied = true;
      }
      if (payload?.destinations && Array.isArray(payload.destinations.countries)) {
        golfJoinDestinationSummary = payload.destinations;
        applied = true;
      }
      const data = payload?.homeBootstrapLight;
      if (!data || !Array.isArray(data.newScheduleSummaries)) return applied;
      if (!homeBootstrapLightAuthoritativeApplied) {
        writeJoinJsonCache(HOME_BOOTSTRAP_LIGHT_CACHE_KEY, data);
      }
      applyHomeBootstrapLightRows(data, { fromCache: true, ...options });
      return true;
    }

    function hydrateHomeBootstrapLightFromHomeSummaryJson() {
      return loadGolfJoinHomeSummaryJson().then((payload) => {
        if (!applyHomeBootstrapLightFromHomeSummaryPayload(payload, { source: "home-summary" })) {
          throw new Error("Home summary bootstrap payload is empty.");
        }
        return payload.homeBootstrapLight;
      }).catch((error) => {
        golfJoinSafeWarn("Failed to load home bootstrap from home summary JSON.", error);
        return null;
      });
    }

    function hydrateHomeBootstrapLightFromHomeCardsJson(options = {}) {
      return loadGolfJoinHomeCardsJson().then((payload) => {
        if (!applyHomeBootstrapLightFromHomeSummaryPayload(payload, { source: "home-cards", ...options })) {
          throw new Error("Home cards bootstrap payload is empty.");
        }
        return payload.homeBootstrapLight;
      }).catch((error) => {
        golfJoinSafeWarn("Failed to load home bootstrap from home cards JSON.", error);
        return null;
      });
    }

    async function hydrateHomeBootstrapLightFromGoogleSheet(options = {}) {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return { ok: false };
      googleSheetBuilderApplicationsLoading = true;
      googleSheetJoinApplicationsLoading = true;
      googleSheetBuilderApplicationsReadFailed = false;
      googleSheetJoinApplicationsReadFailed = false;
      try {
        const data = await postGolfJoinSheetAction("home_bootstrap_light", {
          newScheduleLimit: 100,
          joinApplicationLimit: 100
        }, "Home bootstrap light");
        const isSnapshotFallback = data?.cache?.status === "snapshot";
        homeBootstrapSnapshotNeedsRefresh = isSnapshotFallback;
        writeJoinJsonCache(HOME_BOOTSTRAP_LIGHT_CACHE_KEY, data || {});
        applyHomeBootstrapLightRows(data || {}, {
          fromCache: isSnapshotFallback,
          render: options.render
        });
        return { ok: true, data };
      } catch (error) {
        googleSheetBuilderApplicationsLoading = false;
        googleSheetJoinApplicationsLoading = false;
        googleSheetBuilderApplicationsReadCompleted = true;
        googleSheetJoinApplicationsReadCompleted = true;
        googleSheetBuilderApplicationsReadFailed = true;
        googleSheetJoinApplicationsReadFailed = true;
        throw error;
      }
    }

    function waitForHomeBootstrapBeforeSecondaryHydration(bootstrapPromise) {
      let timeout = null;
      const settledBootstrap = new Promise((resolve) => {
        if (bootstrapPromise && typeof bootstrapPromise.then === "function") {
          bootstrapPromise.then(resolve, resolve);
          return;
        }
        resolve();
      });
      const timeoutPromise = new Promise((resolve) => {
        timeout = window.setTimeout(resolve, HOME_SECONDARY_BOOTSTRAP_WAIT_MS);
      });
      return raceJoinPromises([settledBootstrap, timeoutPromise])
        .finally(() => window.clearTimeout(timeout));
    }

    async function hydrateHomeSecondaryData() {
      if (homeBootstrapSnapshotNeedsRefresh) {
        try {
          await hydrateHomeBootstrapLightFromGoogleSheet();
        } catch (error) {
          golfJoinSafeWarn("Failed to refresh the stored home bootstrap snapshot.", error);
        }
      }
      const member = getJoinCachedCurrentMember();
      const memberKey = getJoinWishMemberKey(member);
      if (memberKey) {
        markGolfJoinPerformanceOnce("golfjoin:private:start");
        const memberCacheOptions = { memberKey };
        try {
          if (
            !googleSheetBuilderApplicationsLoading
            && !hasFreshGoogleSheetRowsCache(GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY, memberCacheOptions)
          ) {
            await hydrateBuilderApplicationJoinsFromGoogleSheet({ renderStart: false, renderHome: false });
          }
          if (
            !googleSheetJoinApplicationsLoading
            && !hasFreshGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY, memberCacheOptions)
          ) {
            await hydrateJoinApplicationsFromGoogleSheet({ renderStart: false, renderHome: false });
          }
          if (!googleSheetJoinWishesLoading) {
            await hydrateJoinWishesFromGoogleSheet();
          }
          scheduleHomeRender();
          refreshDetailWishButtons();
          refreshOpenJoinMyMenu();
        } catch (error) {
          golfJoinSafeWarn("Failed to refresh secondary member data after home startup.", error);
        }
        markGolfJoinPerformanceOnce(
          "golfjoin:private:ready",
          "golfjoin:duration:private-data",
          "golfjoin:private:start"
        );
      }
      await resumeJoinExternalDeepLink();
      await hydrateHomeStatsFromGoogleSheet({ preferCache: true });
    }

    function scheduleHomeSecondaryHydration(bootstrapPromise) {
      if (homeSecondaryHydrationScheduled) return;
      homeSecondaryHydrationScheduled = true;
      window.setTimeout(() => {
        const run = () => {
          waitForHomeBootstrapBeforeSecondaryHydration(bootstrapPromise)
            .then(() => hydrateHomeSecondaryData())
            .catch((error) => golfJoinSafeWarn("Failed to hydrate deferred home data.", error));
        };
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(run, { timeout: 2500 });
        } else {
          run();
        }
      }, HOME_SECONDARY_HYDRATION_DELAY_MS);
    }

