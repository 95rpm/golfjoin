    function hasOpenJoinFullscreenModal() {
      return Boolean(document.querySelector(JOIN_FULLSCREEN_MODAL_SELECTOR));
    }

    function getJoinFullscreenModalFillElement() {
      if (!document.body) return null;
      let fill = document.getElementById("joinFullscreenModalFill");
      if (!fill) {
        fill = document.createElement("div");
        fill.id = "joinFullscreenModalFill";
        fill.setAttribute("aria-hidden", "true");
        document.body.appendChild(fill);
      }
      return fill;
    }

    function updateJoinFullscreenModalCoverState() {
      const isOpen = hasOpenJoinFullscreenModal();
      document.documentElement.classList.toggle("join-fullscreen-modal-open", isOpen);
      document.body.classList.toggle("join-fullscreen-modal-open", isOpen);
      getJoinFullscreenModalFillElement()?.classList.toggle("open", isOpen);
      if (isOpen && typeof scheduleJoinMobileVisualViewportVarsUpdate === "function") {
        scheduleJoinMobileVisualViewportVarsUpdate({ settle: true });
      }
    }

    function scheduleJoinFullscreenModalCoverStateUpdate() {
      updateJoinFullscreenModalCoverState();
      if (joinFullscreenModalCoverUpdateFrame) {
        window.cancelAnimationFrame(joinFullscreenModalCoverUpdateFrame);
      }
      joinFullscreenModalCoverUpdateFrame = window.requestAnimationFrame(() => {
        joinFullscreenModalCoverUpdateFrame = 0;
        updateJoinFullscreenModalCoverState();
      });
    }

    function initializeJoinFullscreenModalCoverObserver() {
      if (joinFullscreenModalCoverObserver || typeof MutationObserver === "undefined") {
        scheduleJoinFullscreenModalCoverStateUpdate();
        return;
      }
      joinFullscreenModalCoverObserver = new MutationObserver(scheduleJoinFullscreenModalCoverStateUpdate);
      ["calendarSheet", "builderModal", "detailModal", "regionSearchModal", "globalApplyOverlay", "joinMyMenuModal"].forEach((id) => {
        const node = document.getElementById(id);
        if (node) {
          joinFullscreenModalCoverObserver.observe(node, { attributes: true, attributeFilter: ["class"] });
        }
      });
      scheduleJoinFullscreenModalCoverStateUpdate();
    }

    let widgetModalPageScrollLockState = null;

    function captureWidgetModalPageScrollState() {
      const scrollingElement = document.scrollingElement || document.documentElement;
      return {
        top: Math.max(0, Number(window.scrollY || scrollingElement?.scrollTop) || 0),
        left: Math.max(0, Number(window.scrollX || scrollingElement?.scrollLeft) || 0)
      };
    }

    function captureInlineStyleProperty(style, property) {
      return {
        value: style.getPropertyValue(property),
        priority: style.getPropertyPriority(property)
      };
    }

    function restoreInlineStyleProperty(style, property, snapshot = {}) {
      if (snapshot.value) {
        style.setProperty(property, snapshot.value, snapshot.priority || "");
        return;
      }
      style.removeProperty(property);
    }

    function lockWidgetModalPageScroll(scrollState = captureWidgetModalPageScrollState()) {
      if (widgetModalPageScrollLockState || !document.body) return;
      const body = document.body;
      const root = document.documentElement;
      const top = Math.max(0, Number(scrollState.top) || 0);
      const left = Math.max(0, Number(scrollState.left) || 0);
      const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
      const bodyPaddingRight = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
      const pageHeight = Math.max(
        Number(root.scrollHeight) || 0,
        Number(root.offsetHeight) || 0,
        Number(body.scrollHeight) || 0,
        Number(body.offsetHeight) || 0,
        Number(window.innerHeight) || 0
      );
      widgetModalPageScrollLockState = {
        top,
        left,
        body: {
          position: captureInlineStyleProperty(body.style, "position"),
          top: captureInlineStyleProperty(body.style, "top"),
          left: captureInlineStyleProperty(body.style, "left"),
          right: captureInlineStyleProperty(body.style, "right"),
          width: captureInlineStyleProperty(body.style, "width"),
          height: captureInlineStyleProperty(body.style, "height"),
          minHeight: captureInlineStyleProperty(body.style, "min-height"),
          overflow: captureInlineStyleProperty(body.style, "overflow"),
          paddingRight: captureInlineStyleProperty(body.style, "padding-right")
        },
        root: {
          overflow: captureInlineStyleProperty(root.style, "overflow"),
          scrollBehavior: captureInlineStyleProperty(root.style, "scroll-behavior")
        }
      };

      body.style.setProperty("position", "fixed");
      body.style.setProperty("top", `-${top}px`);
      body.style.setProperty("left", `-${left}px`);
      body.style.setProperty("right", "0");
      body.style.setProperty("width", "100%");
      body.style.setProperty("height", `${pageHeight}px`);
      body.style.setProperty("min-height", `${pageHeight}px`);
      // body.modal-open의 overflow:hidden이 위로 이동한 본문까지 잘라내지 않도록
      // 전체 문서는 그대로 보이게 두고 실제 스크롤 루트(html)만 잠근다.
      body.style.setProperty("overflow", "visible", "important");
      root.style.setProperty("overflow", "hidden", "important");
      if (scrollbarWidth) {
        body.style.setProperty("padding-right", `${bodyPaddingRight + scrollbarWidth}px`);
      }
      body.classList.add("join-widget-page-scroll-locked");
    }

    function unlockWidgetModalPageScroll() {
      const lockState = widgetModalPageScrollLockState;
      if (!lockState || !document.body) return;
      const body = document.body;
      const root = document.documentElement;
      Object.entries(lockState.body).forEach(([property, snapshot]) => {
        const cssProperty = property === "minHeight" ? "min-height" : property === "paddingRight" ? "padding-right" : property;
        restoreInlineStyleProperty(body.style, cssProperty, snapshot);
      });
      restoreInlineStyleProperty(root.style, "overflow", lockState.root.overflow);
      root.style.setProperty("scroll-behavior", "auto");
      body.classList.remove("join-widget-page-scroll-locked");
      widgetModalPageScrollLockState = null;

      const scrollingElement = document.scrollingElement || root;
      window.scrollTo(lockState.left, lockState.top);
      if (scrollingElement) {
        scrollingElement.scrollLeft = lockState.left;
        scrollingElement.scrollTop = lockState.top;
      }
      window.requestAnimationFrame(() => {
        window.scrollTo(lockState.left, lockState.top);
        restoreInlineStyleProperty(root.style, "scroll-behavior", lockState.root.scrollBehavior);
      });
    }

    function setWidgetModalOpen(isOpen) {
      const shouldKeepOpen = Boolean(isOpen || hasOpenBlockingModal() || hasOpenJoinFullscreenModal());
      if (shouldKeepOpen) lockWidgetModalPageScroll();
      document.documentElement.classList.toggle("modal-open", shouldKeepOpen);
      document.body.classList.toggle("modal-open", shouldKeepOpen);
      document.getElementById("secret-golf-join")?.classList.toggle("modal-open", shouldKeepOpen);
      if (!shouldKeepOpen) unlockWidgetModalPageScroll();
      if (!shouldKeepOpen) document.documentElement.classList.remove("join-mobile-modal-chrome-collapsed");
      if (shouldKeepOpen) {
        setJoinMobileBottomNavVisible(shouldKeepJoinMobileBottomNavOverModal(), { force: true, reason: "modal-sync" });
      }
      scheduleJoinFullscreenModalCoverStateUpdate();
    }

    function isJoinActionLoadingOpen() {
      return Boolean(document.getElementById("joinActionLoadingOverlay")?.classList.contains("open"));
    }

    function isHomeInitialLoadingOpen() {
      return Boolean(document.getElementById("homeInitialLoadingOverlay")?.classList.contains("open"));
    }

    function hasOpenBlockingModal() {
      return Boolean(document.querySelector(
        "#detailModal.open, #globalApplyOverlay.open, #joinMyMenuModal.open, #joinMyDrawerOverlay.open, #privacyApplyModal.open, #waitlistApplyModal.open, #applySubmitConfirmModal.open, .overlay.open, .calendar-sheet-overlay.open"
      ));
    }

    function shouldKeepJoinMobileBottomNavOverModal() {
      const nav = document.getElementById("joinMobileBottomNav");
      if (!nav || nav.classList.contains("is-scroll-hidden")) return false;
      if (!nav.classList.contains("is-nav-layer-active") && !nav.classList.contains("is-my-layer-active")) return false;
      const layerKey = nav.dataset.mobileNavLayerKey || "";
      if (!hasOpenBlockingModal()) return false;
      if (layerKey === "my") {
        const drawerOpen = Boolean(document.getElementById("joinMyDrawerOverlay")?.classList.contains("open"));
        const myMenuOpen = Boolean(document.getElementById("joinMyMenuModal")?.classList.contains("open"));
        return drawerOpen && !myMenuOpen;
      }
      if (layerKey === "create" || layerKey === "find") {
        const isMobileViewport = window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640;
        return isMobileViewport;
      }
      return layerKey === "phone";
    }

    function setJoinMobileBottomNavLayerActive(key = "") {
      const nav = document.getElementById("joinMobileBottomNav");
      if (!nav) return;
      const normalizedKey = String(key || "").trim();
      nav.classList.toggle("is-nav-layer-active", Boolean(normalizedKey));
      nav.classList.toggle("is-my-layer-active", normalizedKey === "my");
      if (normalizedKey) {
        nav.dataset.mobileNavLayerKey = normalizedKey;
        nav.classList.remove("is-scroll-hidden");
      } else {
        delete nav.dataset.mobileNavLayerKey;
        nav.classList.remove("is-nav-layer-active", "is-my-layer-active", "is-modal-visible");
      }
    }

    function setJoinHostHeaderCovered(covered = false) {
      document.documentElement.classList.remove("join-my-menu-open");
      document.body.classList.remove("join-my-menu-open");
      document.querySelectorAll(".header_wrap, .mobile_mainmenu_zone, .mobile_mainmenu_wrap, .mainmenu_dim").forEach((element) => {
        element.style.removeProperty("display");
        element.style.removeProperty("opacity");
        element.style.removeProperty("visibility");
        element.style.removeProperty("pointer-events");
        element.style.removeProperty("z-index");
        element.style.removeProperty("height");
        element.style.removeProperty("min-height");
        element.style.removeProperty("margin");
        element.style.removeProperty("padding");
        element.style.removeProperty("overflow");
      });
    }

    function portalOverlayToBody(id) {
      const overlay = document.getElementById(id);
      overlay?.classList.add("sgj-portal-overlay");
      if (overlay && overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
      }
      const zIndex = id === "participantModal"
        ? "2147483700"
          : id === "globalApplyOverlay"
            ? "2147483644"
            : id === "detailModal"
              ? "2147483643"
              : id === "regionSearchModal"
                ? "2147483642"
              : id === "calendarSheet"
                ? "2147483632"
              : id === "builderActiveScheduleBackdrop"
                ? "2147483638"
              : id === "builderActiveScheduleSheet"
                ? "2147483639"
              : id === "phoneModal"
                ? "2147483800"
              : id === "joinMyReviewModal"
                ? "2147483646"
              : id === "joinMyDrawerOverlay"
                ? "2147483647"
              : id === "joinProfileManageOverlay"
                ? "2147483960"
              : id === "joinMyMenuModal"
                ? "2147483632"
                : id === "joinMemberLoginModal"
                  ? "2147483940"
                  : id === "privacyApplyModal" || id === "waitlistApplyModal"
                    ? "2147483950"
                    : id === "applySubmitConfirmModal"
                      ? "2147483647"
                    : id === "builderAlertModal"
                      ? "2147483647"
                      : id === "joinActionLoadingOverlay"
                        ? "2147483647"
                        : "2147483000";
      overlay?.style.setProperty("z-index", zIndex, "important");
      if (id === "phoneModal") {
        overlay?.querySelector(".modal")?.style.setProperty("z-index", "2147483801", "important");
      }
      if (id === "joinMyReviewModal") {
        overlay?.querySelector(".modal")?.style.setProperty("z-index", "2147483647", "important");
      }
      return overlay;
    }

    function renderJoinActionLoadingIcon() {
      const target = document.getElementById("joinActionLoadingIcon");
      if (target) target.innerHTML = joinActionLoadingIcons[joinActionLoadingIconIndex % joinActionLoadingIcons.length] || "";
      joinActionLoadingIconIndex += 1;
      renderAnimatedLoadingMessage("joinActionLoadingMessage", joinActionLoadingMessageBase, joinActionLoadingMessageDotIndex);
      joinActionLoadingMessageDotIndex = (joinActionLoadingMessageDotIndex + 1) % JOIN_LOADING_DOT_SUFFIXES.length;
    }

    function renderHomeInitialLoadingIcon() {
      const target = document.getElementById("homeInitialLoadingIcon");
      if (target) target.innerHTML = joinActionLoadingIcons[homeInitialLoadingIconIndex % joinActionLoadingIcons.length] || "";
      homeInitialLoadingMessageBase = homeInitialLoadingMessages[Math.floor(homeInitialLoadingIconIndex / 4) % homeInitialLoadingMessages.length] || homeInitialLoadingMessages[0];
      homeInitialLoadingIconIndex += 1;
      renderAnimatedLoadingMessage("homeInitialLoadingMessage", homeInitialLoadingMessageBase, homeInitialLoadingMessageDotIndex);
      homeInitialLoadingMessageDotIndex = (homeInitialLoadingMessageDotIndex + 1) % JOIN_LOADING_DOT_SUFFIXES.length;
    }

    function renderBuilderCalendarLoadingIcon() {
      const target = document.getElementById("builderCalendarLoadingIcon");
      if (target) target.innerHTML = joinActionLoadingIcons[builderCalendarLoadingIconIndex % joinActionLoadingIcons.length] || "";
      builderCalendarLoadingIconIndex += 1;
      renderAnimatedLoadingMessage("builderCalendarLoadingMessage", BUILDER_CALENDAR_LOADING_MESSAGE);
    }

    function syncBuilderCalendarLoading(isLoading = false) {
      if (isLoading) {
        if (!builderCalendarLoadingIconTimer) {
          builderCalendarLoadingIconIndex = 0;
          renderBuilderCalendarLoadingIcon();
          builderCalendarLoadingIconTimer = setInterval(renderBuilderCalendarLoadingIcon, JOIN_ACTION_LOADING_ICON_INTERVAL_MS);
        }
        return;
      }
      if (builderCalendarLoadingIconTimer) {
        clearInterval(builderCalendarLoadingIconTimer);
        builderCalendarLoadingIconTimer = null;
      }
    }

    function normalizeLoadingMessageBase(message = "") {
      return String(message || "").trim().replace(/[.。…]+$/g, "");
    }

    function renderAnimatedLoadingMessage(elementId, baseMessage = "", dotIndex = 0) {
      const target = document.getElementById(elementId);
      const base = normalizeLoadingMessageBase(baseMessage);
      if (!target || !base) return;
      if (target.dataset.loadingBase === base && target.querySelector(".join-loading-dots")) return;
      target.dataset.loadingBase = base;
      target.innerHTML = `<div class="join-loading-text">${escapeHtml(base)}<div class="join-loading-dots" aria-hidden="true"><div class="join-loading-dot">.</div><div class="join-loading-dot">.</div><div class="join-loading-dot">.</div></div></div>`;
    }

    function updateHomeInitialLoadingMessageWidth() {
      const target = document.getElementById("homeInitialLoadingMessage");
      if (!target) return;
      const style = window.getComputedStyle(target);
      const canvas = updateHomeInitialLoadingMessageWidth.canvas || (updateHomeInitialLoadingMessageWidth.canvas = document.createElement("canvas"));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
      const longestWidth = homeInitialLoadingMessages
        .map((message) => context.measureText(normalizeLoadingMessageBase(message)).width)
        .reduce((max, width) => Math.max(max, width), 0);
      const dotsWidth = context.measureText("...").width;
      target.style.setProperty("--home-initial-loading-message-width", `${Math.ceil(longestWidth + dotsWidth + 12)}px`);
    }

    function openHomeInitialLoading() {
      const overlay = document.getElementById("homeInitialLoadingOverlay");
      const box = overlay?.querySelector(".join-action-loading-box");
      if (homeInitialLoadingMaxTimer) {
        clearTimeout(homeInitialLoadingMaxTimer);
        homeInitialLoadingMaxTimer = null;
      }
      document.documentElement.classList.add("home-initial-loading", "modal-open");
      document.body.classList.add("home-initial-loading", "modal-open");
      document.getElementById("secret-golf-join")?.classList.add("modal-open");
      box?.classList.add("has-message");
      homeInitialLoadingMessageBase = homeInitialLoadingMessages[0] || homeInitialLoadingMessageBase;
      box?.setAttribute("aria-label", normalizeLoadingMessageBase(homeInitialLoadingMessageBase));
      homeInitialLoadingIconIndex = 0;
      homeInitialLoadingMessageIndex = 0;
      homeInitialLoadingMessageDotIndex = 0;
      overlay?.classList.add("open");
      overlay?.setAttribute("aria-hidden", "false");
      updateHomeInitialLoadingMessageWidth();
      renderHomeInitialLoadingIcon();
      if (!homeInitialLoadingIconTimer) {
        homeInitialLoadingIconTimer = setInterval(renderHomeInitialLoadingIcon, JOIN_ACTION_LOADING_ICON_INTERVAL_MS);
      }
      homeInitialLoadingMaxTimer = setTimeout(() => {
        homeInitialExternalProductsLoading = false;
        homeInitialExternalProductsLoadedOnce = true;
        homeBootstrapLoading = false;
        renderJoinsAndCloseHomeInitialLoading();
      }, HOME_INITIAL_LOADING_MAX_VISIBLE_MS);
    }

    function closeHomeInitialLoading() {
      const overlay = document.getElementById("homeInitialLoadingOverlay");
      overlay?.classList.remove("open");
      overlay?.setAttribute("aria-hidden", "true");
      markGolfJoinPerformanceOnce(
        "golfjoin:boot:interactive",
        "golfjoin:duration:boot-interactive",
        "golfjoin:boot:start"
      );
      document.documentElement.classList.remove("home-initial-loading");
      document.body.classList.remove("home-initial-loading");
      if (!hasOpenBlockingModal() && !isJoinActionLoadingOpen()) {
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
        document.getElementById("secret-golf-join")?.classList.remove("modal-open");
        setJoinMobileBottomNavVisible(true);
      }
      if (homeInitialLoadingIconTimer) {
        clearInterval(homeInitialLoadingIconTimer);
        homeInitialLoadingIconTimer = null;
      }
      if (homeInitialLoadingMaxTimer) {
        clearTimeout(homeInitialLoadingMaxTimer);
        homeInitialLoadingMaxTimer = null;
      }
      homeInitialLoadingMessageDotIndex = 0;
      startHeroCalendarProfileCountAnimation();
    }

    function renderJoinsAndCloseHomeInitialLoading() {
      // 홈 렌더가 오래 걸리더라도 초기 오버레이가 페이지 스크롤을 계속
      // 잠그지 않도록 잠금 해제와 동적 렌더를 서로 분리한다.
      closeHomeInitialLoading();
      scheduleHomeRender();
    }

    function openJoinActionLoading(message = "", options = {}) {
      const ownerToken = String(options.ownerToken || `action-${++joinActionLoadingGeneration}`);
      if (joinActionLoadingOwners.has(ownerToken)) return ownerToken;
      if (isHomeInitialLoadingOpen()) {
        closeHomeInitialLoading();
      }
      const overlay = portalOverlayToBody("joinActionLoadingOverlay");
      if (!overlay) return ownerToken;
      const minVisibleMs = Number(options.minVisibleMs);
      const owner = {
        token: ownerToken,
        openedAt: Date.now(),
        minVisibleMs: Number.isFinite(minVisibleMs) ? minVisibleMs : JOIN_ACTION_LOADING_MIN_VISIBLE_MS,
        message: normalizeLoadingMessageBase(message)
      };
      joinActionLoadingOwners.set(ownerToken, owner);
      joinActionLoadingCount = joinActionLoadingOwners.size;
      joinActionLoadingMinVisibleMs = owner.minVisibleMs;
      document.body.appendChild(overlay);
      const box = overlay.querySelector(".join-action-loading-box");
      const messageEl = document.getElementById("joinActionLoadingMessage");
      box?.style.setProperty("z-index", "2147483647", "important");
      const cleanMessage = owner.message;
      joinActionLoadingMessageBase = cleanMessage;
      joinActionLoadingMessageDotIndex = 0;
      if (messageEl) {
        renderAnimatedLoadingMessage("joinActionLoadingMessage", cleanMessage, joinActionLoadingMessageDotIndex);
      }
      joinActionLoadingMessageDotIndex = (joinActionLoadingMessageDotIndex + 1) % JOIN_LOADING_DOT_SUFFIXES.length;
      box?.classList.toggle("has-message", Boolean(cleanMessage));
      box?.setAttribute("aria-label", cleanMessage || "처리 중");
      joinActionLoadingOpenedAt = owner.openedAt;
      renderJoinActionLoadingIcon();
      overlay.style.setProperty("display", "flex", "important");
      overlay.style.setProperty("visibility", "visible", "important");
      overlay.style.setProperty("opacity", "1", "important");
      overlay.style.setProperty("pointer-events", "auto", "important");
      overlay.style.setProperty("z-index", "2147483647", "important");
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      setWidgetModalOpen(true);
      if (!joinActionLoadingTimer) {
        joinActionLoadingTimer = setInterval(renderJoinActionLoadingIcon, JOIN_ACTION_LOADING_ICON_INTERVAL_MS);
      }
      return ownerToken;
    }

    async function closeJoinActionLoading(ownerToken = null) {
      const resolvedToken = ownerToken == null
        ? [...joinActionLoadingOwners.keys()].pop()
        : String(ownerToken);
      if (!resolvedToken || !joinActionLoadingOwners.has(resolvedToken)) return;
      const closingOwner = joinActionLoadingOwners.get(resolvedToken);
      joinActionLoadingOwners.delete(resolvedToken);
      joinActionLoadingCount = joinActionLoadingOwners.size;
      if (joinActionLoadingCount > 0) {
        const activeOwner = [...joinActionLoadingOwners.values()].pop();
        joinActionLoadingOpenedAt = activeOwner.openedAt;
        joinActionLoadingMinVisibleMs = activeOwner.minVisibleMs;
        joinActionLoadingMessageBase = activeOwner.message;
        joinActionLoadingMessageDotIndex = 0;
        const box = document.querySelector("#joinActionLoadingOverlay .join-action-loading-box");
        box?.classList.toggle("has-message", Boolean(activeOwner.message));
        box?.setAttribute("aria-label", activeOwner.message || "처리 중");
        renderAnimatedLoadingMessage("joinActionLoadingMessage", activeOwner.message, 0);
        return;
      }
      const elapsed = Date.now() - closingOwner.openedAt;
      const remaining = closingOwner.minVisibleMs - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      joinActionLoadingMinVisibleMs = JOIN_ACTION_LOADING_MIN_VISIBLE_MS;
      const overlay = document.getElementById("joinActionLoadingOverlay");
      const box = overlay?.querySelector(".join-action-loading-box");
      const messageEl = document.getElementById("joinActionLoadingMessage");
      overlay?.classList.remove("open");
      overlay?.setAttribute("aria-hidden", "true");
      overlay?.style.setProperty("visibility", "hidden", "important");
      overlay?.style.setProperty("opacity", "0", "important");
      overlay?.style.setProperty("pointer-events", "none", "important");
      box?.classList.remove("has-message");
      box?.setAttribute("aria-label", "처리 중");
      if (messageEl) messageEl.textContent = "";
      joinActionLoadingMessageBase = "";
      joinActionLoadingMessageDotIndex = 0;
      setWidgetModalOpen(hasOpenBlockingModal());
      if (joinActionLoadingTimer) {
        clearInterval(joinActionLoadingTimer);
        joinActionLoadingTimer = null;
      }
    }

    function getLastJoinAsyncClickButton() {
      const button = lastJoinAsyncClickButton;
      if (!button || !document.documentElement.contains(button)) return null;
      return button;
    }

    async function runJoinActionLoading(action, options = {}) {
      const button = options.button === undefined ? getLastJoinAsyncClickButton() : options.button;
      if (button?.dataset?.joinLoadingLocked === "true") return undefined;
      if (button) {
        button.dataset.joinLoadingLocked = "true";
        button.setAttribute("aria-disabled", "true");
      }
      const loadingToken = openJoinActionLoading(options.message, { minVisibleMs: options.minVisibleMs });
      try {
        return await action();
      } finally {
        await closeJoinActionLoading(loadingToken);
        if (button) {
          button.removeAttribute("aria-disabled");
          delete button.dataset.joinLoadingLocked;
        }
      }
    }

    function resolveJoinReadLoadingTarget(options = {}) {
      const target = typeof options.getTarget === "function" ? options.getTarget() : options.target;
      return target?.nodeType === 1 ? target : null;
    }

    function attachJoinReadLoadingTarget(state, target) {
      if (!state || !target) return;
      const ownerToken = String(state.token);
      if (!state.previousAriaBusy.has(target)) {
        state.previousAriaBusy.set(target, target.getAttribute("aria-busy"));
      }
      state.targets.add(target);
      target.classList.add("join-read-loading-target");
      target.setAttribute("aria-busy", "true");
      target.dataset.joinReadLoadingOwner = ownerToken;
      target.querySelectorAll(":scope > .join-read-loading-indicator").forEach((indicator) => indicator.remove());
      const indicator = document.createElement("div");
      indicator.className = "join-read-loading-indicator";
      indicator.dataset.joinReadLoadingOwner = ownerToken;
      indicator.setAttribute("role", "status");
      indicator.setAttribute("aria-live", "polite");
      const content = document.createElement("div");
      content.className = "join-read-loading-content";
      const icon = document.createElement("span");
      icon.className = "join-read-loading-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = joinActionLoadingIcons[1] || joinActionLoadingIcons[0] || "";
      const message = document.createElement("span");
      message.textContent = state.message;
      content.append(icon, message);
      indicator.appendChild(content);
      target.appendChild(indicator);
    }

    function beginJoinReadLoading(options = {}) {
      const ownerKey = String(options.ownerKey || `read-${++joinReadLoadingGeneration}`);
      const state = {
        ownerKey,
        token: ++joinReadLoadingGeneration,
        message: normalizeLoadingMessageBase(options.message) || "정보를 확인하고 있어요",
        options,
        timer: null,
        promise: null,
        targets: new Set(),
        previousAriaBusy: new Map()
      };
      const initialTarget = resolveJoinReadLoadingTarget(options);
      if (initialTarget) {
        state.targets.add(initialTarget);
        state.previousAriaBusy.set(initialTarget, initialTarget.getAttribute("aria-busy"));
        initialTarget.setAttribute("aria-busy", "true");
        initialTarget.dataset.joinReadLoadingOwner = String(state.token);
      }
      const delayMs = Number.isFinite(Number(options.delayMs))
        ? Math.max(0, Number(options.delayMs))
        : JOIN_READ_LOADING_DELAY_MS;
      state.timer = setTimeout(() => {
        state.timer = null;
        attachJoinReadLoadingTarget(state, resolveJoinReadLoadingTarget(options));
      }, delayMs);
      joinReadLoadingOwners.set(ownerKey, state);
      return state;
    }

    function endJoinReadLoading(state) {
      if (!state) return;
      if (state.timer) clearTimeout(state.timer);
      const currentTarget = resolveJoinReadLoadingTarget(state.options);
      if (currentTarget) state.targets.add(currentTarget);
      state.targets.forEach((target) => {
        if (target.dataset.joinReadLoadingOwner !== String(state.token)) return;
        target.querySelectorAll(`:scope > .join-read-loading-indicator[data-join-read-loading-owner="${state.token}"]`)
          .forEach((indicator) => indicator.remove());
        target.classList.remove("join-read-loading-target");
        const previousAriaBusy = state.previousAriaBusy.get(target);
        if (previousAriaBusy == null) target.removeAttribute("aria-busy");
        else target.setAttribute("aria-busy", previousAriaBusy);
        delete target.dataset.joinReadLoadingOwner;
      });
      if (joinReadLoadingOwners.get(state.ownerKey) === state) {
        joinReadLoadingOwners.delete(state.ownerKey);
      }
      flushDeferredHomeRenderIfReady();
    }

    function runJoinReadLoading(action, options = {}) {
      const ownerKey = String(options.ownerKey || `read-${joinReadLoadingGeneration + 1}`);
      const existing = joinReadLoadingOwners.get(ownerKey);
      if (existing?.promise) return existing.promise;
      const state = beginJoinReadLoading({ ...options, ownerKey });
      state.promise = Promise.resolve()
        .then(action)
        .finally(() => endJoinReadLoading(state));
      return state.promise;
    }

    function getJoinActionLoadingMessage(actionName = "") {
      const messages = {
        submitJoinMemberKakaoLogin: "카카오 로그인을 확인하고 있어요",
        submitJoinMemberFindId: "아이디를 찾고 있어요",
        submitJoinMemberFindPw: "비밀번호 재설정을 확인하고 있어요",
        submitJoinMemberResetPassword: "새 비밀번호를 변경하고 있어요",
        submitJoinMemberSignup: "회원가입을 진행하고 있어요",
        openJoinMyDrawer: "내 모임을 확인하고 있어요",
        openJoinMyMenu: "내 모임을 확인하고 있어요",
        handleJoinMyWishClick: "찜한 상품을 확인하고 있어요",
        handleJoinWishRemove: "찜한 상품에서 삭제하고 있어요",
        handleJoinMyLogout: "로그아웃하고 있어요",
        showMdPickDetailProduct: "상품 정보를 확인하고 있어요",
        openBuilderProductDetailModal: "상품 정보를 확인하고 있어요",
        openGlobalApply: "참여 정보를 확인하고 있어요",
        submitGlobalApply: "참여 신청을 접수하고 있어요",
        openMdPickProductDetail: "상품 정보를 확인하고 있어요",
        handleDetailWish: "찜한 상품에 담고 있어요",
        copyDetailShareUrl: "공유 링크를 만들고 있어요",
        handleDetailShare: "공유할 내용을 열고 있어요"
      };
      return messages[actionName] || "잠시만 기다려 주세요";
    }

    function wrapJoinAsyncFunction(original) {
      if (typeof original !== "function" || original.__joinLoadingWrapped) return original;
      const wrapped = function(...args) {
        if (wrapped.__joinActionRunning) return undefined;
        wrapped.__joinActionRunning = true;
        return runJoinActionLoading(
          () => original.apply(this, args),
          { message: getJoinActionLoadingMessage(original.name) }
        ).finally(() => {
          wrapped.__joinActionRunning = false;
        });
      };
      wrapped.__joinLoadingWrapped = true;
      return wrapped;
    }

    document.addEventListener("click", (event) => {
      if (isJoinActionLoadingOpen() && !event.target.closest?.("#joinActionLoadingOverlay")) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const button = event.target?.closest?.("button");
      if (!button) return;
      if (button.dataset.joinLoadingLocked === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      lastJoinAsyncClickButton = button;
      window.setTimeout(() => {
        if (lastJoinAsyncClickButton === button) lastJoinAsyncClickButton = null;
      }, 1000);
    }, true);
    document.addEventListener("click", handleGlobalApplySubmitButtonActivation, true);

    const joinMyMenuState = {
      memberPromise: null,
      loginRedirecting: false,
      pendingAfterLogin: "my-menu",
      pendingLoginParams: {},
      pendingKakaoSignup: null,
      pendingProfileAfterLogin: "my-menu",
      pendingProfileParams: {},
      pendingProfileMember: null,
      signupCompleteAction: "continue",
      foundMemberId: "",
      findMemberName: "",
      findMemberMobile: "",
      resetPasswordToken: null,
      signupDuplicateLocks: {},
      signupDuplicateTimers: {},
      signupDuplicateCheckedValues: {},
      lastSignupDuplicateField: "",
      pendingSmsAuth: null,
      smsAuthTimerId: 0,
      smsAuthBusy: false,
      signupPhoneAuth: null,
      signupPhoneAuthTimerId: 0,
      signupPhoneAuthBusy: false
    };
    const JOIN_TEMP_ADMIN_LOGIN_KEY = "joinTempAdminLogin";
    const JOIN_SESSION_MEMBER_KEY = "joinSessionMember";
    const JOIN_MEMBER_AUTH_SESSION_KEY = "joinMemberAuthSessionV1";
    const JOIN_MEMBER_AUTH_PENDING_LOGIN_KEY = "joinMemberAuthPendingLoginV1";
    const GOLFJOIN_MEMBER_SMS_AUTH_ENABLED = window.GOLFJOIN_MEMBER_SMS_AUTH_ENABLED === true;
    const GOLFJOIN_MEMBER_SIGNUP_PHONE_AUTH_ENABLED = window.GOLFJOIN_MEMBER_SIGNUP_PHONE_AUTH_ENABLED === true;
    const JOIN_LOGOUT_MARKER_KEY = "joinMemberLoggedOutCookieData";
    const JOIN_AUTH_DOCUMENT_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const JOIN_MEMBER_PROFILE_COMPLETION_KEY = "joinMemberProfileCompletion";
    const JOIN_MEMBER_PROFILE_COMPLETION_TTL_MS = 10 * 60 * 1000;
    const JOIN_KAKAO_JS_KEY = "3925751273a92614723fe138c525f646";
    let renderedCookieDataStringCache;
    let renderedCookieDataStringScannedWhileLoading = false;
    let renderedCookieDataStringRescanScheduled = false;
