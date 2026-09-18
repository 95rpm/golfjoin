    async function initializeGolfJoinHome() {
      markGolfJoinPerformance("golfjoin:boot:start", { once: true });
      openHomeInitialLoading();
      markGolfJoinPerformance("golfjoin:boot:overlay-open", { once: true });
      const startupParams = new URLSearchParams(location.search);
      const startupAfterLogin = startupParams.get("afterLogin");
      const startupAfterLoginParams = getJoinAfterLoginExtraParams(startupParams);
      await waitForRenderedCookieDataReady();
      if (await resetPendingJoinMemberSmsAuthOnStartup()) return;
      await ensureJoinKakaoMemberAuthSessionOnStartup();
      markGolfJoinGa4MemberStateReady();
      removeProductionDummyJoins();
      purgeProductionDummyLocalStorage();
      randomizeHeroCalendarThumbs();
      initializeHeroCalendarShape();
      startHeroSlider();
      loadManagedHeroBanners();
      initializeJoinMobileBottomNav();
      initializeJoinFullscreenModalCoverObserver();
      hydrateBuilderApplicationJoinsFromLocalCache();
      hydrateJoinApplicationsFromLocalCache();
      hydrateJoinReviewsFromLocalCache();
      hydrateOverseasJoinsWithSecretProducts();
      hydrateHomeBootstrapLightFromLocalCache();
      homeInitialExternalProductsLoading = false;
      homeInitialExternalProductsLoadedOnce = true;
      homeBootstrapLoading = false;
      if (!startupAfterLogin) closeHomeInitialLoading();
      // Render the already-hydrated local snapshot before starting the network
      // loaders. Leaving this on the idle scheduler lets the product catalog
      // arrive first and turns the lightweight cache paint into another full,
      // multi-second render. The coordinated network result below still owns
      // the single authoritative deferred render.
      beginGolfJoinHomeDataV2StartupDecision();
      markGolfJoinPerformance("golfjoin:home:local-render-start", { once: true });
      renderJoins({ skipQuickMobileCarousel: true });
      markGolfJoinPerformanceOnce(
        "golfjoin:home:local-render-ready",
        "golfjoin:duration:home-local-render",
        "golfjoin:home:local-render-start"
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      scheduleHomeSlideDotsRefresh();
      window.refreshInitialJoinSlideDots?.();
      scheduleJoinMyMemberPreload();
      let homeDataV2StartupResult;
      try {
        homeDataV2StartupResult = await runGolfJoinHomeDataV2Startup();
      } finally {
        completeGolfJoinHomeDataV2StartupDecision();
      }
      const useGolfJoinHomeDataV2 = Boolean(
        homeDataV2StartupResult?.ok
        && homeDataV2StartupResult?.state === GOLFJOIN_HOME_DATA_V2_STATES.V2_RUNNING
        && homeDataV2StartupResult?.useLegacy === false
      );
      const canFastCloseAfterLoginLoading = ["my-menu", "my-drawer", "profile-manage", "return-url"].includes(startupAfterLogin);
      let earlyAfterLoginResumeHandled = false;
      const earlyAfterLoginResumePromise = canFastCloseAfterLoginLoading
        ? Promise.resolve()
          .then(() => resumeJoinMyMenuAfterLogin())
          .then((handled) => {
            earlyAfterLoginResumeHandled = Boolean(handled);
            if (earlyAfterLoginResumeHandled) {
              homeInitialExternalProductsLoading = false;
              homeBootstrapLoading = false;
              renderJoinsAndCloseHomeInitialLoading();
            }
            return earlyAfterLoginResumeHandled;
          })
          .catch((error) => {
            golfJoinSafeWarn("Failed to resume join login flow before home bootstrap.", error);
            return false;
          })
        : Promise.resolve(false);
      const earlyProfileRequirementPromise = startupAfterLogin && !canFastCloseAfterLoginLoading
        ? Promise.resolve()
          .then(() => ensureJoinMemberProfileReady(startupAfterLogin, startupAfterLoginParams, { refresh: true }))
          .then((member) => {
            if (member) return false;
            earlyAfterLoginResumeHandled = true;
            homeInitialExternalProductsLoading = false;
            homeBootstrapLoading = false;
            renderJoinsAndCloseHomeInitialLoading();
            return true;
          })
          .catch((error) => {
            golfJoinSafeWarn("Failed to check join member profile before after-login resume.", error);
            return false;
          })
        : Promise.resolve(false);
      const startupProfilePromptPromise = startupAfterLogin
        ? Promise.resolve(false)
        : Promise.resolve()
          .then(() => promptRequiredJoinMemberProfileOnStartup())
          .then((opened) => {
            if (opened) {
              homeInitialExternalProductsLoading = false;
              homeBootstrapLoading = false;
              renderJoinsAndCloseHomeInitialLoading();
            }
            return opened;
          });
      const homeProductsPromise = useGolfJoinHomeDataV2
        ? Promise.resolve(homeGolfJoinProducts || [])
        : ensureHomeGolfJoinProductsLoaded({ renderHome: false }).catch((error) => {
          golfJoinSafeWarn("Failed to load compact golf join home products during home init.", error);
        }).finally(() => {
          homeInitialExternalProductsLoadedOnce = true;
        });
      // The release-v2 live object is an intentionally fast first-paint snapshot.
      // Capacity, participant counts and dashboard display rules can change after
      // that release is published, so every navigation must reconcile it with the
      // current public bootstrap response. This applies equally to anonymous and
      // signed-in visitors and prevents an old 27/40 card from surviving after the
      // dashboard has already moved the schedule to 57/60.
      const releaseV2LiveReconciliationPromise = useGolfJoinHomeDataV2
        ? hydrateHomeBootstrapLightFromGoogleSheet({ render: false }).catch((error) => {
          homeBootstrapSnapshotNeedsRefresh = true;
          golfJoinSafeWarn("Failed to refresh live home schedule data. Keeping the release snapshot until retry.", error);
          return pendingHomeBootstrapLightData;
        })
        : null;
      const homeBootstrapDataPromise = useGolfJoinHomeDataV2
        ? Promise.resolve(pendingHomeBootstrapLightData)
        : hydrateHomeBootstrapLightFromGoogleSheet({ render: false }).catch((error) => {
          homeBootstrapSnapshotNeedsRefresh = true;
          golfJoinSafeWarn("Failed to load home bootstrap light data. Falling back to the stored home snapshot.", error);
          return hydrateHomeBootstrapLightFromHomeCardsJson({ render: false }).then((snapshot) => {
            if (snapshot) return snapshot;
            return Promise.all([
              hydrateBuilderApplicationJoinsFromGoogleSheet(),
              hydrateJoinApplicationsFromGoogleSheet(),
              hydrateAdminRecommendedSchedulesFromGoogleSheet()
            ]);
          });
        });
      const bootstrapPromise = homeBootstrapDataPromise.then(async () => {
        refreshDetailWishButtons();
        refreshOpenJoinMyMenu();
        await earlyProfileRequirementPromise;
        await earlyAfterLoginResumePromise;
        if (!earlyAfterLoginResumeHandled) {
          await resumeJoinMyMenuAfterLogin();
        }
        await resumeJoinExternalDeepLink();
        await resumeJoinKakaoProfileAfterLogin();
      }).catch(async (error) => {
        golfJoinSafeWarn("Failed to hydrate join sheet data.", error);
        await earlyProfileRequirementPromise;
        await earlyAfterLoginResumePromise;
        if (!earlyAfterLoginResumeHandled) {
          await resumeJoinMyMenuAfterLogin();
        }
        await resumeJoinExternalDeepLink();
        await resumeJoinKakaoProfileAfterLogin();
      }).finally(() => {
        markGolfJoinPerformanceOnce(
          "golfjoin:boot:bootstrap-settled",
          "golfjoin:duration:home-bootstrap",
          "golfjoin:boot:start"
        );
        homeBootstrapLoading = false;
        if (startupAfterLogin) closeHomeInitialLoading();
      });
      const initialHomeDataRenderPromise = Promise.all([
        homeProductsPromise,
        bootstrapPromise,
        releaseV2LiveReconciliationPromise
      ])
        .finally(() => {
          scheduleHomeRender({ deferWhileModalOpen: true });
        });
      scheduleHomeSecondaryHydration(bootstrapPromise);
      void bootstrapPromise;
      void homeProductsPromise;
      void initialHomeDataRenderPromise;
      await resumeJoinExternalDeepLink();
      await startupProfilePromptPromise;
    }

    initializeGolfJoinHome().catch((error) => {
      golfJoinSafeWarn("Failed to initialize golf join home.", error);
      homeInitialExternalProductsLoading = false;
      homeInitialExternalProductsLoadedOnce = true;
      homeBootstrapLoading = false;
      closeHomeInitialLoading();
      scheduleHomeRender();
      Promise.resolve()
        .then(() => resumeJoinMyMenuAfterLogin())
        .then(() => resumeJoinExternalDeepLink())
        .then(() => promptRequiredJoinMemberProfileOnStartup())
        .finally(() => closeHomeInitialLoading());
    });
