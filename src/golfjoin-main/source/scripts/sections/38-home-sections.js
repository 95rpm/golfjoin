    function isLargeDesktopQuickLayout() {
      return window.matchMedia?.("(min-width: 1170px)")?.matches || window.innerWidth >= 1170;
    }

    function isBestJoinSectionKey(key) {
      return key === "my" || key === "overseas" || key === "domestic";
    }

    function getMyHomeJoinRelationship(join = {}) {
      const activeSchedule = findOwnActiveJoinSchedule(join);
      const isCreated = isCurrentMemberCreatedJoinSchedule(join) || activeSchedule?.scheduleGroup === "created";
      const isJoined = !isCreated && (
        isCurrentMemberJoinedJoinSchedule(join)
        || activeSchedule?.scheduleGroup === "joined"
      );
      return { isCreated, isJoined };
    }

    function resetMyJoinVisibleCounts() {
      myJoinVisibleCounts = {
        complete: MY_JOIN_INITIAL_VISIBLE_COUNT,
        created: MY_JOIN_INITIAL_VISIBLE_COUNT,
        joined: MY_JOIN_INITIAL_VISIBLE_COUNT
      };
    }

    function syncMyHomeJoinMemberScope() {
      const member = typeof getJoinCachedCurrentMember === "function" ? getJoinCachedCurrentMember() : null;
      const nextMemberKey = getJoinMyMemberIdentity(member || {}).memberKey;
      if (myJoinMemberScopeKey !== null && myJoinMemberScopeKey !== nextMemberKey) {
        myJoinFilter = "complete";
        resetMyJoinVisibleCounts();
        myJoinLastMobileLayout = null;
      }
      myJoinMemberScopeKey = nextMemberKey;
      return nextMemberKey;
    }

    function isMyHomeJoinSchedule(join = {}) {
      const relationship = getMyHomeJoinRelationship(join);
      return relationship.isCreated || relationship.isJoined;
    }

    function getMyHomeJoinGroups(items = []) {
      return items.reduce((groups, join) => {
        const relationship = getMyHomeJoinRelationship(join);
        if (!relationship.isCreated && !relationship.isJoined) return groups;
        if (isJoinFullyBooked(join)) groups.complete.push(join);
        else if (relationship.isCreated) groups.created.push(join);
        else groups.joined.push(join);
        return groups;
      }, { complete: [], created: [], joined: [] });
    }

    function getAvailableMyHomeJoinFilters(groups = {}) {
      return [
        ...(groups.complete?.length ? [{ key: "complete", label: "모집완료" }] : []),
        ...(groups.created?.length ? [{ key: "created", label: "내가 만든 모임" }] : []),
        ...(groups.joined?.length ? [{ key: "joined", label: "참여중인 모임" }] : [])
      ];
    }

    function resolveMyJoinFilter(groups) {
      const availableFilters = getAvailableMyHomeJoinFilters(groups);
      if (!availableFilters.some((filter) => filter.key === myJoinFilter)) {
        myJoinFilter = availableFilters[0]?.key || "created";
      }
      return myJoinFilter;
    }

    function normalizeMyHomeJoinFilter(value = "", fallback = "created") {
      const filter = String(value || "").trim().toLowerCase();
      return ["complete", "created", "joined"].includes(filter) ? filter : fallback;
    }

    function getMyJoinFilteredItems(groups) {
      const filter = resolveMyJoinFilter(groups);
      return groups[filter] || [];
    }

    function getMyJoinVisibleCount(filter = myJoinFilter, totalCount = 0) {
      const isMobileLayout = isMobileSlideDotsViewport();
      myJoinLastMobileLayout = isMobileLayout;
      if (isMobileLayout) return totalCount;
      return Math.min(
        totalCount,
        Math.max(MY_JOIN_INITIAL_VISIBLE_COUNT, Number(myJoinVisibleCounts[filter]) || 0)
      );
    }

    function getOverseasBestFilteredItems(items = []) {
      return items.filter((join) => !isMyHomeJoinSchedule(join));
    }

    function setMyJoinFilter(filter = "created") {
      const nextFilter = normalizeMyHomeJoinFilter(filter, "created");
      myJoinFilter = nextFilter;
      const section = document.getElementById("join-section-my");
      if (!section) return;
      section.querySelectorAll("[data-my-join-filter]").forEach((button) => {
        const active = button.dataset.myJoinFilter === nextFilter;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      section.querySelectorAll("[data-my-join-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.myJoinPanel !== nextFilter;
      });
      const activeGrid = section.querySelector(`[data-my-join-panel="${nextFilter}"] .join-grid`);
      if (activeGrid) activeGrid.scrollLeft = 0;
      requestAnimationFrame(() => {
        updateBestSectionControls("my");
        scheduleHomeSlideDotsRefresh();
      });
    }

    function loadMoreMyJoinItems() {
      const section = document.getElementById("join-section-my");
      const panel = section?.querySelector(`[data-my-join-panel="${myJoinFilter}"]`);
      const cards = Array.from(panel?.querySelectorAll(`[data-my-join-card="${myJoinFilter}"]`) || []);
      if (!cards.length) return;
      const currentCount = Math.max(
        MY_JOIN_INITIAL_VISIBLE_COUNT,
        Number(myJoinVisibleCounts[myJoinFilter]) || 0
      );
      const nextCount = Math.min(
        cards.length,
        currentCount <= MY_JOIN_INITIAL_VISIBLE_COUNT ? MY_JOIN_PAGE_SIZE : currentCount + MY_JOIN_PAGE_SIZE
      );
      myJoinVisibleCounts[myJoinFilter] = nextCount;
      cards.forEach((card, index) => {
        card.hidden = index >= nextCount;
      });
      const more = panel.querySelector("[data-my-join-more]");
      if (more) more.hidden = nextCount >= cards.length;
      requestAnimationFrame(() => updateBestSectionControls("my"));
    }

    function loadMoreOverseasBestItems() {
      overseasBestVisibleCount = overseasBestVisibleCount <= OVERSEAS_BEST_INITIAL_VISIBLE_COUNT
        ? OVERSEAS_BEST_PAGE_SIZE
        : overseasBestVisibleCount + OVERSEAS_BEST_PAGE_SIZE;
      renderOverseasBestSectionInPlace();
    }

    window.setMyJoinFilter = setMyJoinFilter;
    window.loadMoreMyJoinItems = loadMoreMyJoinItems;
    window.loadMoreOverseasBestItems = loadMoreOverseasBestItems;

    function renderSlideDots(key) {
      return `<div class="join-slide-dots" data-slide-dots="${key}" data-dot-click="handleHomeSlideDotClick" aria-hidden="true"></div>`;
    }

    function getFallbackSlideDotPageCount(key, dots) {
      if (key === "mdpick-country") {
        return document.querySelectorAll("[data-mdpick-country-option]").length;
      }
      if (key === "mdpick-theme") {
        return document.querySelectorAll("[data-mdpick-theme-group]").length;
      }
      if (key === "custom") {
        return dots?.closest("[data-join-section]")?.querySelectorAll(".join-custom-panel.active .join-card:not([data-quick-carousel-clone='true'])").length || 0;
      }
      if (key === "my") {
        return dots?.closest("[data-join-section]")?.querySelectorAll("[data-my-join-panel]:not([hidden]) .join-card:not([hidden]):not([data-quick-carousel-clone='true'])").length || 0;
      }
      if (key === "detail") {
        return document.querySelectorAll("#detailContent .detail-thumb").length || 0;
      }
      return dots?.closest("[data-join-section]")?.querySelectorAll(".join-grid .join-card:not([data-quick-carousel-clone='true'])").length || 0;
    }

    function isMobileSlideDotsViewport() {
      return window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640;
    }

    function getScrollStepFromCards(container, visibleCardCount = 1) {
      const card = container?.querySelector(".join-card");
      if (!container || !card) return container?.clientWidth || 1;
      const styles = window.getComputedStyle(container);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return (card.getBoundingClientRect().width * visibleCardCount) + (gap * Math.max(0, visibleCardCount - 1));
    }

    function getInstagramSlideDotState(currentIndex, pageCount, visibleCount = 5) {
      const total = Math.max(0, Number(pageCount) || 0);
      const current = Math.min(Math.max(Number(currentIndex) || 0, 0), total - 1);
      const dotSpacing = 14;
      const viewportCount = Math.min(total, visibleCount);
      const half = Math.floor(visibleCount / 2);
      const start = total <= visibleCount
        ? 0
        : Math.max(0, Math.min(total - visibleCount, current - half));
      const hasMoreLeft = start > 0;
      const hasMoreRight = start + visibleCount < total;
      const states = Array.from({ length: total }, (_, index) => {
        const isInside = index >= start && index < start + viewportCount;
        if (!isInside) return { index, scale: 0, opacity: 0, isActive: false };
        if (index === current) return { index, scale: 1, opacity: 1, isActive: true };
        const isLeftEdge = index === start;
        const isRightEdge = index === start + viewportCount - 1;
        const isLeftSecond = index === start + 1;
        const isRightSecond = index === start + viewportCount - 2;
        let scale = .65;
        if (isLeftEdge && hasMoreLeft) scale = .4;
        else if (isRightEdge && hasMoreRight) scale = .4;
        else if (isLeftSecond && hasMoreLeft) scale = .75;
        else if (isRightSecond && hasMoreRight) scale = .75;
        return { index, scale, opacity: .5, isActive: false };
      });
      return {
        states,
        start,
        translation: -start * dotSpacing,
        viewportWidth: viewportCount * dotSpacing,
        dotSpacing
      };
    }

    function updateSlideDots(key, currentIndex, pageCount, isScrollable = true) {
      const dots = document.querySelector(`[data-slide-dots="${key}"]`);
      if (!dots) return;
      let total = Math.max(0, Number(pageCount) || 0);
      if (total <= 1) {
        total = Math.max(total, getFallbackSlideDotPageCount(key, dots));
      }
      if (total > 1 && !isScrollable) {
        isScrollable = true;
      }
      dots.classList.toggle("is-visible", Boolean(isScrollable && total > 1));
      if (!isScrollable || total <= 1) {
        dots.innerHTML = "";
        delete dots.dataset.dotStart;
        delete dots.dataset.dotTotal;
        return;
      }
      const current = Math.min(Math.max(Number(currentIndex) || 0, 0), total - 1);
      const dotClickHandler = dots.dataset.dotClick || "";
      const dotState = getInstagramSlideDotState(current, total);
      const renderTrackHtml = () => `
        <div class="join-slide-dots-viewport" style="width:${dotState.viewportWidth}px; --join-slide-dot-spacing:${dotState.dotSpacing}px;">
          <div class="join-slide-dots-track" style="transform:translateX(${dotState.translation}px);">
            ${dotState.states.map((dot) => {
              const activeClass = dot.isActive ? " active" : "";
              const dotStyle = `--dot-scale:${dot.scale}; --dot-opacity:${dot.opacity};`;
              if (dotClickHandler) {
                const prefetchAttributes = key === "mdpick-country" || key === "mdpick-theme"
                  ? ` onmouseenter="prefetchMdPickSlideTarget('${key}', ${dot.index})" onfocus="prefetchMdPickSlideTarget('${key}', ${dot.index})" ontouchstart="prefetchMdPickSlideTarget('${key}', ${dot.index})"`
                  : "";
                return `<div class="join-slide-dot-slot"><button type="button" class="join-slide-dot${activeClass}" data-dot-index="${dot.index}" style="${dotStyle}" onclick="${dotClickHandler}(${dot.index}, event)"${prefetchAttributes} aria-label="${dot.index + 1}번 보기"></button></div>`;
              }
              return `<div class="join-slide-dot-slot"><div class="join-slide-dot${activeClass}" data-dot-index="${dot.index}" style="${dotStyle}"></div></div>`;
            }).join("")}
          </div>
        </div>
      `;
      const viewport = dots.querySelector(".join-slide-dots-viewport");
      const track = dots.querySelector(".join-slide-dots-track");
      const existingDots = Array.from(dots.querySelectorAll(".join-slide-dot[data-dot-index]"));
      if (!viewport || !track || existingDots.length !== total || dots.dataset.dotClickRendered !== dotClickHandler) {
        dots.innerHTML = renderTrackHtml();
      } else {
        viewport.style.width = `${dotState.viewportWidth}px`;
        viewport.style.setProperty("--join-slide-dot-spacing", `${dotState.dotSpacing}px`);
        track.style.transform = `translateX(${dotState.translation}px)`;
        dotState.states.forEach((dot) => {
          const dotElement = track.querySelector(`.join-slide-dot[data-dot-index="${dot.index}"]`);
          if (!dotElement) return;
          dotElement.classList.toggle("active", dot.isActive);
          dotElement.style.setProperty("--dot-scale", String(dot.scale));
          dotElement.style.setProperty("--dot-opacity", String(dot.opacity));
        });
      }
      dots.dataset.activeIndex = String(current);
      dots.dataset.dotStart = String(dotState.start);
      dots.dataset.dotTotal = String(total);
      dots.dataset.dotClickRendered = dotClickHandler;
    }

    function updateContainerSlideDots(key, container, stepCardCount = 1) {
      if (!container) {
        updateSlideDots(key, 0, 0, false);
        return;
      }
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      const isScrollable = maxScroll > 4;
      const cards = Array.from(container.querySelectorAll(".join-card:not([data-quick-carousel-clone='true'])"));
      const cardCount = cards.length || 1;
      const step = Math.max(1, getScrollStepFromCards(container, stepCardCount));
      const isAtEnd = isScrollable && container.scrollLeft >= maxScroll - 4;
      const stepIndex = Math.max(0, Math.round(container.scrollLeft / step));
      const currentIndex = isAtEnd ? cardCount - 1 : Math.min(cardCount - 1, stepIndex * Math.max(1, stepCardCount));
      updateSlideDots(key, currentIndex, cardCount, isScrollable && cardCount > 1);
    }

    function scrollHomeDotContainerToIndex(key, container, index, afterScroll) {
      if (!container) return;
      const cards = Array.from(container.querySelectorAll(".join-card:not([data-quick-carousel-clone='true'])"));
      if (!cards.length) return;
      const targetIndex = Math.min(cards.length - 1, Math.max(0, Number(index) || 0));
      const target = cards[targetIndex];
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const left = container.scrollLeft + targetRect.left - containerRect.left;
      updateSlideDots(key, targetIndex, cards.length, cards.length > 1);
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
      window.setTimeout(() => {
        if (typeof afterScroll === "function") afterScroll();
      }, 280);
    }

    function handleHomeSlideDotClick(index, event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const dots = event?.currentTarget?.closest("[data-slide-dots]");
      const key = dots?.dataset.slideDots || "";
      if (key === "mdpick-country") {
        const country = MD_PICK_COUNTRIES[Math.min(MD_PICK_COUNTRIES.length - 1, Math.max(0, Number(index) || 0))];
        if (country) selectMdPickCountry(country.key);
        return;
      }
      if (key === "mdpick-theme") {
        const themes = getVisibleMdPickThemes();
        const theme = themes[Math.min(themes.length - 1, Math.max(0, Number(index) || 0))];
        if (theme) setMdPickTheme(theme.key);
        return;
      }
      if (key === "custom") {
        scrollHomeDotContainerToIndex(key, getActiveCustomJoinPanel(), index, updateCustomSectionControls);
        return;
      }
      if (isBestJoinSectionKey(key)) {
        const grid = document.querySelector(`#join-section-${key} .join-grid`);
        scrollHomeDotContainerToIndex(key, grid, index, () => updateBestSectionControls(key));
      }
    }

    function updateMdPickCountryDots() {
      updateSlideDots("mdpick-country", getMdPickCountryIndex(), MD_PICK_COUNTRIES.length, isMobileSlideDotsViewport());
    }

    function getVisibleMdPickThemes() {
      syncMdPickListCacheWithProductSource();
      if (mdPickVisibleThemesCache) return mdPickVisibleThemesCache;
      mdPickVisibleThemesCache = MD_PICK_THEMES
        .map((theme) => ({ ...theme, items: getMdPickThemeProducts(theme, new Set()) }))
        .filter((theme) => theme.items.length);
      return mdPickVisibleThemesCache;
    }

    function updateMdPickThemeDots() {
      const themes = getVisibleMdPickThemes();
      let activeKey = mdPickActiveThemeKey;
      if (isMobileSlideDotsViewport()) {
        const rail = document.querySelector(".join-mdpick-theme-groups");
        const groups = Array.from(rail?.querySelectorAll(".join-mdpick-theme-group[data-mdpick-theme-group]") || []);
        if (rail && groups.length) {
          const railRect = rail.getBoundingClientRect();
          const centerX = railRect.left + (railRect.width / 2);
          const nearest = groups.reduce((best, group) => {
            const rect = group.getBoundingClientRect();
            const distance = Math.abs((rect.left + rect.width / 2) - centerX);
            return !best || distance < best.distance ? { key: group.dataset.mdpickThemeGroup, distance } : best;
          }, null);
          if (nearest?.key) {
            activeKey = nearest.key;
            const nearestTheme = themes.find((theme) => theme.key === nearest.key);
            const nearestGroup = groups.find((group) => group.dataset.mdpickThemeGroup === nearest.key);
            prefetchMdPickThemeImages(nearest.key);
            ensureMdPickThemeGroupRendered(nearestGroup, nearestTheme, { eager: true });
          }
        }
      }
      const activeIndex = Math.max(0, themes.findIndex((theme) => theme.key === activeKey));
      updateSlideDots("mdpick-theme", activeIndex, themes.length, isMobileSlideDotsViewport());
    }
    window.updateMdPickThemeDots = updateMdPickThemeDots;

    function getNextMdPickThemeKey() {
      const themes = getVisibleMdPickThemes();
      if (themes.length <= 1) return "";
      const activeIndex = themes.findIndex((theme) => theme.key === mdPickActiveThemeKey);
      const nextIndex = ((activeIndex >= 0 ? activeIndex : 0) + 1) % themes.length;
      return themes[nextIndex]?.key || "";
    }

    function stopMdPickThemeAutoSlide() {
      if (mdPickThemeAutoTimer) clearInterval(mdPickThemeAutoTimer);
      mdPickThemeAutoTimer = null;
    }

    function advanceMdPickThemeAuto() {
      const section = document.getElementById("join-section-mdpick-theme");
      if (!section?.querySelector(".join-mdpick-theme-card")) {
        stopMdPickThemeAutoSlide();
        return;
      }
      const nextThemeKey = getNextMdPickThemeKey();
      if (nextThemeKey) setMdPickTheme(nextThemeKey);
    }

    function startMdPickThemeAutoSlide(options = {}) {
      stopMdPickThemeAutoSlide();
      const section = document.getElementById("join-section-mdpick-theme");
      if (!section?.querySelector(".join-mdpick-theme-card") || getVisibleMdPickThemes().length <= 1) return;
      mdPickThemeAutoTimer = window.setInterval(() => {
        if (document.hidden || hasOpenModalOrSheet()) return;
        advanceMdPickThemeAuto();
      }, MD_PICK_THEME_AUTO_INTERVAL_MS);
    }

    function updateMdPickSlideDots() {
      updateMdPickCountryDots();
      updateMdPickThemeDots();
    }

    function updateBestSectionControls(key) {
      if (!isBestJoinSectionKey(key)) return;
      const section = document.getElementById(`join-section-${key}`);
      const grid = key === "my"
        ? section?.querySelector("[data-my-join-panel]:not([hidden]) .join-grid")
        : section?.querySelector(".join-grid");
      const controls = section?.querySelector(".join-section-controls");
      if (!grid) {
        controls?.classList.add("is-not-scrollable", "is-at-start", "is-at-end");
        updateSlideDots(key, 0, 0, false);
        return;
      }
      const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
      const isScrollable = maxScroll > 4;
      const isAtStart = grid.scrollLeft <= 4 || !isScrollable;
      const isAtEnd = grid.scrollLeft >= maxScroll - 4 || !isScrollable;
      controls?.classList.toggle("is-not-scrollable", !isScrollable);
      controls?.classList.toggle("is-at-start", isAtStart);
      controls?.classList.toggle("is-at-end", isAtEnd);
      updateContainerSlideDots(key, grid, 1);
    }

    function updateBestSectionControlsAll() {
      updateBestSectionControls("my");
      updateBestSectionControls("overseas");
      updateBestSectionControls("domestic");
    }
    window.updateBestSectionControls = updateBestSectionControls;
    window.updateBestSectionControlsAll = updateBestSectionControlsAll;

    let homeSlideDotsRefreshFrame = 0;

    function scheduleHomeSlideDotsRefresh() {
      if (homeSlideDotsRefreshFrame) return;
      homeSlideDotsRefreshFrame = requestAnimationFrame(() => {
        homeSlideDotsRefreshFrame = 0;
        updateQuickSectionControls();
        updateCustomSectionControls();
        updateBestSectionControlsAll();
        updateMdPickSlideDots();
      });
    }

    function getQuickSectionGrid() {
      return document.querySelector("#join-section-quick .join-grid");
    }

    function updateQuickSectionControls() {
      const section = document.getElementById("join-section-quick");
      const grid = getQuickSectionGrid();
      const controls = section?.querySelector(".join-section-controls");
      if (!grid || !controls) return;
      const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
      const isScrollable = maxScroll > 4;
      const isAtStart = grid.scrollLeft <= 4 || !isScrollable;
      const isAtEnd = grid.scrollLeft >= maxScroll - 4 || !isScrollable;
      controls.classList.toggle("is-not-scrollable", !isScrollable);
      controls.classList.toggle("is-at-start", isAtStart);
      controls.classList.toggle("is-at-end", isAtEnd);
    }
    window.updateQuickSectionControls = updateQuickSectionControls;

    function getActiveCustomJoinPanel() {
      return document.querySelector("#join-section-custom .join-custom-panel.active");
    }

    function updateCustomSectionControls() {
      const section = document.getElementById("join-section-custom");
      const panel = getActiveCustomJoinPanel();
      const controls = section?.querySelector(".join-custom-section-controls");
      if (!panel || !controls) return;
      const sectionRect = section.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      section.style.setProperty("--custom-controls-top", `${panelRect.top - sectionRect.top + (panelRect.height / 2)}px`);
      const maxScroll = Math.max(0, panel.scrollWidth - panel.clientWidth);
      const isScrollable = maxScroll > 4;
      const isAtStart = panel.scrollLeft <= 4 || !isScrollable;
      const isAtEnd = panel.scrollLeft >= maxScroll - 4 || !isScrollable;
      controls.classList.toggle("is-not-scrollable", !isScrollable);
      controls.classList.toggle("is-at-start", isAtStart);
      controls.classList.toggle("is-at-end", isAtEnd);
      updateContainerSlideDots("custom", panel, 2);
    }
    window.updateCustomSectionControls = updateCustomSectionControls;

    function scrollCustomJoinSection(direction) {
      const panel = getActiveCustomJoinPanel();
      if (!panel) return;
      const cards = Array.from(panel.querySelectorAll(".join-card:not([data-quick-carousel-clone='true'])"));
      const cardCount = cards.length || 1;
      const dots = document.querySelector(`[data-slide-dots="custom"]`);
      const activeIndex = Math.min(cardCount - 1, Math.max(0, Number(dots?.dataset.activeIndex || 0)));
      const nextIndex = Math.min(cardCount - 1, Math.max(0, activeIndex + (direction * 2)));
      if (nextIndex !== activeIndex) {
        updateSlideDots("custom", nextIndex, cardCount, cardCount > 1);
      }
      const card = panel.querySelector(".join-card");
      const styles = window.getComputedStyle(panel);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const step = card ? (card.getBoundingClientRect().width * 2) + (gap * 2) : panel.clientWidth;
      panel.scrollBy({ left: direction * step, behavior: "smooth" });
      setTimeout(updateCustomSectionControls, 260);
    }

    function changeQuickFeatured(delta) {
      const quickSection = getHomeJoinSections().find((section) => section.key === "quick");
      const count = quickSection?.items.length || 0;
      if (count < 2) return;
      const grid = getQuickSectionGrid();
      if (isLargeDesktopQuickLayout() && grid && grid.scrollWidth > grid.clientWidth + 4) {
        const card = grid.querySelector(".join-card");
        const styles = window.getComputedStyle(grid);
        const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
        const step = card ? card.getBoundingClientRect().width + gap : grid.clientWidth;
        grid.scrollBy({ left: delta * step, behavior: "smooth" });
        setTimeout(updateQuickSectionControls, 260);
        return;
      }
      quickSectionFeaturedIndex = (quickSectionFeaturedIndex + delta + count) % count;
      renderJoins();
      requestAnimationFrame(() => {
        document.getElementById("join-section-quick")?.scrollIntoView({ block: "nearest" });
      });
    }

    function scrollBestJoinSection(key, direction) {
      if (!isBestJoinSectionKey(key)) return;
      const section = document.getElementById(`join-section-${key}`);
      const grid = key === "my"
        ? section?.querySelector("[data-my-join-panel]:not([hidden]) .join-grid")
        : section?.querySelector(".join-grid");
      if (!grid) return;
      const cards = Array.from(grid.querySelectorAll(".join-card:not([hidden]):not([data-quick-carousel-clone='true'])"));
      const cardCount = cards.length || 1;
      const dots = document.querySelector(`[data-slide-dots="${key}"]`);
      const activeIndex = Math.min(cardCount - 1, Math.max(0, Number(dots?.dataset.activeIndex || 0)));
      const nextIndex = Math.min(cardCount - 1, Math.max(0, activeIndex + direction));
      if (nextIndex !== activeIndex) {
        updateSlideDots(key, nextIndex, cardCount, cardCount > 1);
      }
      const firstCardOffset = cards[0]?.offsetLeft || 0;
      const targetCardOffset = cards[nextIndex]?.offsetLeft;
      const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
      const targetLeft = Number.isFinite(targetCardOffset)
        ? Math.max(0, Math.min(maxScroll, targetCardOffset - firstCardOffset))
        : grid.scrollLeft;
      grid.scrollTo({ left: targetLeft, behavior: "smooth" });
      setTimeout(() => updateBestSectionControls(key), 260);
    }

    function renderJoinSectionControlIcon() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
    }

    function renderBestJoinControls(section, itemCount) {
      if (!isBestJoinSectionKey(section.key) || itemCount <= 4) return "";
      const sectionLabel = section.key === "my" ? "나의 모임" : (section.key === "overseas" ? "해외조인 BEST" : "국내조인 BEST");
      const label = `${sectionLabel} 상품 이동`;
      const prevLabel = `이전 ${sectionLabel} 상품`;
      const nextLabel = `다음 ${sectionLabel} 상품`;
      return `
        <div class="join-section-controls is-at-start" aria-label="${label}">
          <button type="button" class="join-section-control prev" onclick="scrollBestJoinSection('${section.key}', -1)" aria-label="${prevLabel}">${renderJoinSectionControlIcon()}</button>
          <button type="button" class="join-section-control next" onclick="scrollBestJoinSection('${section.key}', 1)" aria-label="${nextLabel}">${renderJoinSectionControlIcon()}</button>
        </div>
      `;
    }

    function isJoinProductCardsLoading() {
      return false;
    }

    function shouldShowHomeInitialLoading() {
      return Boolean(
        (homeInitialExternalProductsLoading && !homeInitialExternalProductsLoadedOnce)
        || homeBootstrapLoading
      );
    }

    function isMdPickProductsLoading() {
      return Boolean(!homeGolfJoinProducts && !homeGolfJoinProductsLoadFailed);
    }

    function renderJoinCardSkeleton(index = 0) {
      return `
        <article class="join-card join-card-skeleton" aria-hidden="true">
          <div class="join-thumb skeleton-glass-shimmer"></div>
          <div class="join-body">
            <div class="join-category-row">
              <div class="join-skeleton-pill skeleton-glass-shimmer"></div>
              <div class="join-skeleton-pill skeleton-glass-shimmer" style="width:${index % 2 ? 64 : 82}px;"></div>
            </div>
            <div class="join-skeleton-line title skeleton-glass-shimmer"></div>
            <div class="join-skeleton-line meta skeleton-glass-shimmer"></div>
            <div class="join-skeleton-line price skeleton-glass-shimmer"></div>
            <div class="team-row">
              ${Array.from({ length: 4 }).map(() => `<div class="join-skeleton-avatar skeleton-glass-shimmer"></div>`).join("")}
            </div>
          </div>
        </article>
      `;
    }

    function renderJoinLoadingSection() {
      return `
        <section class="join-product-section layout-overseas layout-loading" id="join-section-loading" aria-label="상품 로딩">
          <div class="join-product-section-head">
            <div class="join-product-section-copy">
              <div class="join-product-section-title">상품 정보를 확인하고 있어요</div>
              <p class="join-product-section-desc">상품 정보를 확인하고 있어요.</p>
            </div>
          </div>
          <div class="join-grid">
            ${Array.from({ length: 4 }).map((_, index) => renderJoinCardSkeleton(index)).join("")}
          </div>
        </section>
      `;
    }

    function renderMdPickLoadingListHtml(listKey = "loading") {
      return `
        <div class="join-mdpick-list join-mdpick-loading-list" data-mdpick-list-key="${escapeHtml(listKey)}" aria-hidden="true">
          ${Array.from({ length: 4 }).map(() => '<div class="join-mdpick-loading-card join-soft-shimmer"></div>').join("")}
        </div>
      `;
    }

    function renderMdPickThemeLoadingSection() {
      return `
        <div class="join-mdpick-theme-section" id="join-section-mdpick-theme" data-join-section="mdpick-theme" aria-busy="true">
          <div class="join-mdpick-theme-title">취향맞춤 TOP3</div>
          <div class="join-mdpick-theme-copy">라운드 스타일 따라 떠나는 여행</div>
          <div class="join-mdpick-theme-loading-shell" aria-hidden="true">
            <div class="join-mdpick-theme-loading-feature join-soft-shimmer"></div>
            <div class="join-mdpick-theme-loading-cards">
              ${Array.from({ length: 3 }).map(() => '<div class="join-mdpick-theme-loading-card join-soft-shimmer"></div>').join("")}
            </div>
          </div>
        </div>
      `;
    }

    function renderMdPickLoadingSection() {
      return `
        <section class="join-product-section layout-mdpick layout-loading" id="join-section-mdpick" data-join-section="mdpick" aria-label="MD PICK! 추천여행" aria-busy="true">
          <div class="join-product-section-head">
            <div class="join-product-section-copy">
              <div class="join-product-section-title">MD PICK! 추천여행<div class="join-product-section-icon popular" aria-hidden="true"></div></div>
              <p class="join-product-section-desc">인기 상품으로 멤버를 모집해보세요.</p>
            </div>
          </div>
          <div class="join-mdpick-countries">
            <div class="join-mdpick-country">
              <div class="join-mdpick-loading-controls" aria-hidden="true">
                <div class="join-mdpick-loading-country join-soft-shimmer"></div>
                <div class="join-mdpick-loading-pack join-soft-shimmer"></div>
              </div>
              ${renderMdPickLoadingListHtml()}
            </div>
          </div>
          ${renderMdPickThemeLoadingSection()}
        </section>
      `;
    }

    function renderJoinIncludeTags(join) {
      return (join.includes || []).slice(0, 4).map((item) => `<div>${item}</div>`).join("");
    }

    function renderJoinParticipantCopy(join) {
      const confirmed = getConfirmedParticipants(join);
      if (!confirmed.length) return "";
      const ageText = [...new Set(confirmed.map((participant) => participant.age).filter(Boolean))].slice(0, 3).join("·");
      const styleText = confirmed
        .flatMap((participant) => participant.preferences || [])
        .find((item) => item.includes("매너") || item.includes("친목") || item.includes("실력")) || "매너형";
      const summary = `${ageText ? `${ageText} ` : ""}${styleText} 참여자 구성`;
      return `
        <div class="join-card-participant-copy">
          <strong>${summary}</strong>
          이미 ${confirmed.length}명 참여, 마지막 한 자리만 남았어요.
        </div>
      `;
    }

    function renderSoonCompactTeam(join) {
      return renderCardTeamSlots(join);
    }

    function renderSoonCompactCard(join) {
      return `
        <article class="join-soon-compact-card ${getJoinCategoryClass(join)}" onclick="openDetail('${join.id}')">
          <div class="join-soon-compact-thumb">
            <img src="${join.image}" alt="${join.title}" loading="lazy" decoding="async">
            ${renderJoinLocationBadge(join)}
          </div>
          <div class="join-soon-compact-body">
            <div class="card-meta card-meta-row join-soon-compact-region">
              <div class="card-meta-item">
                <svg class="card-meta-icon card-meta-icon-location" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="2"/>
                </svg>
                <div class="card-meta-text card-meta-text-location">${getJoinLocationLabel(join)}</div>
                ${renderJoinCategoryChip(join)}
              </div>
            </div>
            <div class="join-category-row join-soon-category-row">
              ${renderJoinCategoryChip(join)}
              ${renderJoinFlightChip(join)}
            </div>
            <div class="join-title join-soon-compact-title">${join.title}</div>
            <div class="join-soon-compact-date">${renderCardDateMeta(join)}</div>
            <div class="join-price join-soon-compact-price">
              <div class="join-price-value">${formatPrice(join.price)}</div>
              <div class="join-price-unit">원</div>
            </div>
            <div class="team-row join-soon-compact-team">
              ${renderSoonCompactTeam(join)}
            </div>
          </div>
        </article>
      `;
    }

    function renderSoonMobileSection(items) {
      const groups = sortByDeparture(items).reduce((acc, join) => {
        const key = getJoinDateKey(join);
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key).push(join);
        return acc;
      }, new Map());
      const entries = Array.from(groups.entries());
      const monthEntries = Array.from(entries.reduce((acc, [key, group]) => {
        const monthKey = key.slice(0, 7);
        if (!acc.has(monthKey)) acc.set(monthKey, group[0]);
        return acc;
      }, new Map()).entries());
      if (!entries.length) return "";
      const html = `
        <div class="join-soon-mobile">
          ${monthEntries.length > 1 ? `
            <div class="join-soon-month-controls" aria-label="곧출발 월 이동">
              <div class="join-soon-month-track">
                ${monthEntries.map(([monthKey], index) => `
                  <button type="button" class="join-soon-month-chip${index === 0 ? " active" : ""}" data-soon-month="${monthKey}" onclick="selectSoonMonth('${monthKey}')">${formatSoonMonthLabel(monthKey)}</button>
                `).join("")}
              </div>
            </div>
          ` : ""}
          ${entries.length > 1 ? `
            <div class="join-section-controls" aria-label="곧출발 날짜 이동">
              <button type="button" class="join-section-control prev" onclick="scrollSoonDateRailBy(-1)" aria-label="이전 날짜">${renderJoinSectionControlIcon()}</button>
              <button type="button" class="join-section-control next" onclick="scrollSoonDateRailBy(1)" aria-label="다음 날짜">${renderJoinSectionControlIcon()}</button>
            </div>
          ` : ""}
          <div class="join-soon-date-rail" aria-label="곧 출발 날짜 선택" onscroll="updateSoonDateControls()">
            <div class="join-soon-date-line" aria-hidden="true"></div>
            ${entries.map(([key, group], index) => `
              <button type="button" class="join-soon-date-chip${index === 0 ? " active" : ""}${getJoinDateRailWeekdayClass(group[0])}" data-soon-date="${key}" onclick="selectSoonDate('${key}')">
                <div class="join-soon-date-main">${getJoinDateRailLabelHtml(group[0])}</div>
                <div class="join-soon-date-count"><div class="join-soon-date-count-number">${group.length}</div><div class="join-soon-date-count-unit">개 일정</div></div>
              </button>
            `).join("")}
          </div>
          <div class="join-soon-panels">
            ${entries.map(([key, group], index) => `
              <div class="join-soon-panel${index === 0 ? " active" : ""}" data-soon-panel="${key}">
                ${group.map(renderSoonCompactCard).join("")}
              </div>
            `).join("")}
          </div>
        </div>
      `;
      requestAnimationFrame(() => {
        updateSoonDateLine();
        updateSoonDateControls();
        if (monthEntries.length) syncSoonMonth(monthEntries[0][0]);
      });
      return html;
    }

    function selectSoonDate(key) {
      const rail = document.querySelector(".join-soon-date-rail");
      document.querySelectorAll(".join-soon-date-chip").forEach((button) => {
        button.classList.toggle("active", button.dataset.soonDate === key);
        if (button.dataset.soonDate === key && rail) {
          positionSoonDateChip(button, "smooth");
        }
      });
      document.querySelectorAll(".join-soon-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.soonPanel === key);
        if (panel.dataset.soonPanel === key) {
          panel.scrollLeft = 0;
        }
      });
      syncSoonMonth(key.slice(0, 7));
      setTimeout(updateSoonDateControls, 260);
      setTimeout(updateSoonDateControls, 520);
    }

    function positionSoonDateChip(button, behavior = "smooth") {
      const rail = button?.closest(".join-soon-date-rail");
      if (!button || !rail) return;
      const chips = Array.from(rail.querySelectorAll(".join-soon-date-chip"));
      const index = chips.indexOf(button);
      const secondSlotLeft = chips[1] ? chips[1].offsetLeft - chips[0].offsetLeft : 0;
      const left = index <= 0 ? 0 : button.offsetLeft - secondSlotLeft;
      rail.scrollTo({ left: Math.max(0, left), behavior });
    }

    function syncSoonMonth(monthKey) {
      const section = document.getElementById("join-section-soon");
      const track = section?.querySelector(".join-soon-month-track");
      const buttons = Array.from(section?.querySelectorAll(".join-soon-month-chip") || []);
      const activeButton = buttons.find((button) => button.dataset.soonMonth === monthKey);
      if (!activeButton) return;
      buttons.forEach((button) => {
        button.classList.toggle("active", button === activeButton);
      });
      if (track) {
        const left = activeButton.offsetLeft - ((track.clientWidth - activeButton.offsetWidth) / 2);
        track.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
      }
    }

    function updateSoonDateLine() {
      document.querySelectorAll(".join-soon-date-rail").forEach((rail) => {
        const chips = Array.from(rail.querySelectorAll(".join-soon-date-chip"));
        const line = rail.querySelector(".join-soon-date-line");
        if (!chips.length || !line) return;
        const first = chips[0];
        const last = chips[chips.length - 1];
        const start = first.offsetLeft;
        const end = last.offsetLeft + last.offsetWidth;
        line.style.left = `${start}px`;
        line.style.setProperty("--soon-date-line-width", `${Math.max(0, end - start)}px`);
      });
    }

    function updateSoonDateControls() {
      const section = document.getElementById("join-section-soon");
      const rail = section?.querySelector(".join-soon-date-rail");
      const controls = section?.querySelector(".join-section-controls");
      if (!rail || !controls) return;
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const isAtStart = rail.scrollLeft <= 4 || maxScroll <= 4;
      const isAtEnd = rail.scrollLeft >= maxScroll - 4 || maxScroll <= 4;
      controls.classList.toggle("is-at-start", isAtStart);
      controls.classList.toggle("is-at-end", isAtEnd);
      rail.classList.toggle("is-at-start", isAtStart);
      rail.classList.toggle("is-at-end", isAtEnd);
    }

    function scrollSoonDateRailBy(direction) {
      const rail = document.querySelector("#join-section-soon .join-soon-date-rail");
      const chips = Array.from(rail?.querySelectorAll(".join-soon-date-chip") || []);
      if (!rail || !chips.length) return;
      const activeIndex = Math.max(0, chips.findIndex((chip) => chip.classList.contains("active")));
      const nextIndex = Math.max(0, Math.min(chips.length - 1, activeIndex + direction));
      const key = chips[nextIndex]?.dataset.soonDate;
      if (key) selectSoonDate(key);
    }

    function scrollSoonMonthBy(direction) {
      const section = document.getElementById("join-section-soon");
      const buttons = Array.from(section?.querySelectorAll(".join-soon-month-chip") || []);
      if (!buttons.length) return;
      const activeIndex = Math.max(0, buttons.findIndex((button) => button.classList.contains("active")));
      const nextIndex = Math.max(0, Math.min(buttons.length - 1, activeIndex + direction));
      const monthKey = buttons[nextIndex]?.dataset.soonMonth;
      if (monthKey) selectSoonMonth(monthKey);
    }

    function selectSoonMonth(monthKey) {
      const section = document.getElementById("join-section-soon");
      const rail = section?.querySelector(".join-soon-date-rail");
      const target = Array.from(rail?.querySelectorAll(".join-soon-date-chip") || [])
        .find((chip) => chip.dataset.soonDate?.startsWith(monthKey));
      syncSoonMonth(monthKey);
      if (!rail || !target) return;
      selectSoonDate(target.dataset.soonDate);
    }


    function collectCustomThemeSources(join = {}) {
      return [
        join,
        join.applicant,
        join.sheetApplication,
        join.sheetApplication?.applicant,
        join.creator,
        join.host
      ].filter(Boolean);
    }

    function getJoinMemberPreferences(join = {}) {
      const values = [];
      collectCustomThemeSources(join).forEach((source) => {
        [source.preferredMemberComposition, source.memberPreferences, source.preferredMembers].forEach((raw) => {
          if (Array.isArray(raw)) {
            values.push(...raw);
          } else if (typeof raw === "string") {
            values.push(...raw.split(/[;,]/));
          }
        });
      });
      return values.map((value) => String(value || "").trim()).filter(Boolean);
    }

    function getJoinApplicantText(join = {}) {
      return collectCustomThemeSources(join)
        .map((source) => [source.gender, source.age, source.ageDisplay, source.birthYear, source.level, source.handicap, source.styles, source.title, source.badge].flat().join(" "))
        .join(" ");
    }

    function getJoinCustomFieldText(join = {}, fields = []) {
      return collectCustomThemeSources(join)
        .map((source) => fields.map((field) => source[field]).flat().join(" "))
        .join(" ");
    }

    function hasJoinMemberPreference(preferences, target) {
      const normalizedTarget = normalizeRegionKeyword(target);
      return preferences.some((preference) => normalizeRegionKeyword(preference) === normalizedTarget);
    }

    function isSeniorCustomJoin(join = {}) {
      const text = getJoinCustomFieldText(join, ["age", "ageDisplay", "birthYear"]);
      return /60\s*대|70\s*대\s*이상|70\s*대|80\s*대|90\s*대|19[0-5]\d|196[0-6]/.test(text);
    }

    function isBeginnerCustomJoin(join = {}) {
      const text = getJoinCustomFieldText(join, ["level", "handicap"]);
      return /입문|초보|편안한\s*보기\s*플레이|90\s*대/.test(text);
    }

    function isWomenCustomJoin(join = {}) {
      const text = getJoinApplicantText(join);
      const participants = Array.isArray(join.participants) ? join.participants : [];
      const hasFemaleOnlyParticipants = participants.length > 0 && participants.every((participant) => participant.gender === "여성");
      return /여성|여자|여성전용|여성끼리/.test(text) || hasFemaleOnlyParticipants;
    }

    function getJoinCustomTheme(join = {}) {
      if (["beginner", "women", "senior"].includes(join.customTheme)) return join.customTheme;
      const preferences = getJoinMemberPreferences(join);
      if (hasJoinMemberPreference(preferences, "같은 성별끼리") && isWomenCustomJoin(join)) return "women";
      if (hasJoinMemberPreference(preferences, "같은 연령대") && isSeniorCustomJoin(join)) return "senior";
      if (hasJoinMemberPreference(preferences, "비슷한 실력끼리") && isBeginnerCustomJoin(join)) return "beginner";
      return "";
    }

    function getCustomJoinThemes(sourceItems = null) {
      const visibleJoins = Array.isArray(sourceItems) ? sourceItems : getVisibleJoinProducts();
      return [
        {
          key: "beginner",
          label: "초보전용",
          title: '처음도<br class="join-custom-mobile-break"> 편하게',
          desc: "비슷한 속도의 안심 일정",
          color: "#70d516",
          soft: "#eaf7f4",
          items: visibleJoins.filter((join) => getJoinCustomTheme(join) === "beginner")
        },
        {
          key: "women",
          label: "여성끼리",
          title: '여성끼리<br class="join-custom-mobile-break"> 안심',
          desc: "편안한 분위기의 여성 조인",
          color: "#ff58c6",
          soft: "#fff0f6",
          items: visibleJoins.filter((join) => getJoinCustomTheme(join) === "women")
        },
        {
          key: "senior",
          label: "시니어전용",
          title: '여유로운<br class="join-custom-mobile-break"> 템포',
          desc: "50·60세대 맞춤 일정",
          color: "#c89318",
          soft: "#fff3d6",
          items: visibleJoins.filter((join) => getJoinCustomTheme(join) === "senior")
        }
      ].filter((theme) => theme.items.length > 0);
    }

    function updateCustomThemeFromRailScroll() {
      if (!window.matchMedia?.("(max-width: 640px)")?.matches && window.innerWidth > 640) return;
      const section = document.getElementById("join-section-custom");
      const rail = section?.querySelector(".join-custom-themes");
      const cards = Array.from(rail?.querySelectorAll(".join-custom-theme-card") || []);
      if (!rail || !cards.length) return;
      const railRect = rail.getBoundingClientRect();
      const targetX = railRect.left + (railRect.width / 2);
      const nearest = cards.reduce((best, card) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs((rect.left + rect.width / 2) - targetX);
        return !best || distance < best.distance ? { card, distance } : best;
      }, null);
      const key = nearest?.card?.dataset.customTheme;
      const activeKey = section.querySelector(".join-custom-theme-card.active")?.dataset.customTheme;
      if (key && key !== activeKey) {
        selectCustomTheme(key);
      }
    }

    function handleCustomThemeRailScroll() {
      clearTimeout(handleCustomThemeRailScroll.timer);
      handleCustomThemeRailScroll.timer = setTimeout(updateCustomThemeFromRailScroll, 90);
    }

    function setupCustomThemeRailScrollSync() {
      const rail = document.querySelector("#join-section-custom .join-custom-themes");
      if (!rail || rail.dataset.scrollSyncBound === "true") return;
      rail.dataset.scrollSyncBound = "true";
      rail.addEventListener("scroll", handleCustomThemeRailScroll, { passive: true });
    }

    function selectCustomTheme(key) {
      const section = document.getElementById("join-section-custom");
      if (!section) return;
      const activeTheme = getCustomJoinThemes().find((theme) => theme.key === key);
      if (activeTheme) {
        section.style.setProperty("--active-theme-color", activeTheme.color);
      }
      section.querySelectorAll(".join-custom-theme-card").forEach((button) => {
        button.classList.toggle("active", button.dataset.customTheme === key);
        button.setAttribute("aria-selected", button.dataset.customTheme === key ? "true" : "false");
      });
      section.querySelectorAll(".join-custom-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.customPanel === key);
        if (panel.dataset.customPanel === key) {
          panel.scrollLeft = 0;
        }
      });
      requestAnimationFrame(updateCustomSectionControls);
    }

    function renderCustomJoinSection(section) {
      const themes = section.themes || [];
      if (!themes.length) return "";
      return `
        <section class="join-product-section layout-custom" id="join-section-${section.key}" data-join-section="${section.key}" aria-label="${section.title}" style="--active-theme-color:${themes[0].color};">
          <div class="join-product-section-head">
            <div class="join-product-section-copy">
              <div class="join-product-section-title">${section.title}<div class="join-product-section-icon ${section.key}" aria-hidden="true"></div></div>
              ${section.desc ? `<p class="join-product-section-desc">${section.desc}</p>` : ""}
            </div>
          </div>
          <div class="join-custom-themes" role="tablist" aria-label="맞춤형 조인 테마">
            ${themes.map((theme, index) => `
              <button type="button" class="join-custom-theme-card${index === 0 ? " active" : ""}" style="--theme-color:${theme.color};--theme-soft:${theme.soft};" data-custom-theme="${theme.key}" role="tab" aria-selected="${index === 0 ? "true" : "false"}" onclick="selectCustomTheme('${theme.key}')">
                <div class="join-custom-theme-copy">
                  <div class="join-custom-theme-label">${theme.label}</div>
                  <div class="join-custom-theme-title">${theme.title}</div>
                  <div class="join-custom-theme-desc">${theme.desc}</div>
                </div>
                <div class="join-custom-theme-visual" aria-hidden="true"></div>
              </button>
            `).join("")}
          </div>
          <div class="join-custom-panels">
            ${themes.map((theme, index) => `
              <div class="join-custom-panel${index === 0 ? " active" : ""}" style="--theme-color:${theme.color};--theme-soft:${theme.soft};" data-custom-panel="${theme.key}" role="tabpanel" onscroll="updateCustomSectionControls()">
                ${theme.items.map((join) => renderJoinCard(join, { featureTag: theme.label, featureTagColor: theme.color, featureTagSoft: theme.soft })).join("")}
              </div>
            `).join("")}
          </div>
          ${renderSlideDots("custom")}
          ${themes.some((theme) => theme.items.length > 2) ? `
            <div class="join-section-controls join-custom-section-controls is-at-start" aria-label="맞춤형 조인 상품 이동">
              <button type="button" class="join-section-control prev" onclick="scrollCustomJoinSection(-1)" aria-label="이전 맞춤형 조인 상품">${renderJoinSectionControlIcon()}</button>
              <button type="button" class="join-section-control next" onclick="scrollCustomJoinSection(1)" aria-label="다음 맞춤형 조인 상품">${renderJoinSectionControlIcon()}</button>
            </div>
          ` : ""}
        </section>
      `;
    }

    function getMdPickRegionProducts(query = "") {
      const products = getMdPickRegionProductSource();
      const tokens = getBuilderRegionAvailabilityTokens(query, { country: !String(query || "").includes(",") });
      if (!tokens.length) return [];
      const groups = new Map();
      products
        .filter((product) => builderProductMatchesTokens(product, tokens))
        .forEach((product) => {
          const key = getProductGroupKey(product);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(product);
        });
      const results = [...groups.values()].map(selectMdPickProductGroupRepresentative).filter(Boolean);
      if (regionProductSort === "price") {
        results.sort((a, b) => (Number(a.priceFrom || a.price) || 0) - (Number(b.priceFrom || b.price) || 0));
      } else if (regionProductSort === "deadline") {
        results.sort((a, b) => parseJoinDate(a.departureDate) - parseJoinDate(b.departureDate));
      }
      return results.slice(0, 24);
    }

    function getMdPickProductCountryKey(product = {}) {
      const text = normalizeRegionKeyword([product.region, product.category, product.title].filter(Boolean).join(" "));
      const match = MD_PICK_COUNTRIES.find((country) => text.includes(normalizeRegionKeyword(country.name)));
      return match?.key || "";
    }

    function renderMdPickRegionProductCard(product) {
      const groupKey = getProductGroupKey(product);
      const countryKey = getMdPickProductCountryKey(product);
      return `
        <article class="region-product-card" onclick="openMdPickProductDetailFromRegion('${escapeJsString(groupKey)}', '${escapeJsString(countryKey)}')">
          <div class="region-product-thumb">
            <img src="${escapeHtml(product.image || product.thumb || "")}" alt="${escapeHtml(product.title || "상품")}">
          </div>
          <div class="region-product-info">
            <div class="region-product-meta">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="2"/>
              </svg>
              <div class="region-product-location">${escapeHtml(product.region || product.category || "")}</div>
            </div>
            <div class="region-product-name">${escapeHtml(product.title || "상품명 없음")}</div>
            <div class="region-product-date">${formatCardDateRange(product)}${renderScheduleOverlapBadge(product, "", { includeOwn: true })}</div>
          </div>
          <div class="region-product-side">
            <div class="region-product-price">
              <div class="region-product-price-value">${formatPrice(product.priceFrom || product.price)}</div>
              <div class="region-product-price-unit">원~</div>
            </div>
          </div>
        </article>
      `;
    }

    function openMdPickProductDetailFromRegion(groupKey, countryKey) {
      closeRegionSearchModal();
      openMdPickProductDetail(groupKey, countryKey);
    }

    const mdPickPackFilters = {};
    let mdPickActiveCountryKey = "thailand";
    const mdPickCountryMenuOpen = false;
    const mdPickCountryMenuNoMotion = false;
    let mdPickCountryMenuOrder = ["thailand", "japan", "china"];
    let mdPickSwipeStartX = 0;
    let mdPickSwipeStartY = 0;
    let mdPickSwipeMoved = false;
    let mdPickSwipePrefetchDirection = 0;
    let mdPickSuppressCardClick = false;
    let mdPickListAnimating = false;
    let mdPickActiveThemeKey = "relax";
    let mdPickThemeAutoTimer = null;
    let mdPickThemeSectionObserver = null;
    const MD_PICK_THEME_AUTO_INTERVAL_MS = 5000;
    const mdPickListElementCache = new Map();
    let mdPickListCacheSourceSignature = "";
    let mdPickListCacheSourceRef = null;
    const mdPickRepresentativeProductsCache = new Map();
    const mdPickThemeProductsCache = new Map();
    let mdPickThemeRepresentativeCandidatesCache = null;
    let mdPickVisibleThemesCache = null;
    const MD_PICK_IMAGE_PREFETCH_MAX_CONCURRENCY = 2;
    const mdPickImagePrefetchQueue = [];
    const mdPickImagePrefetchUrls = new Set();
    const mdPickImagePrefetchInFlight = new Map();
    const MD_PICK_COUNTRIES = [
      { key: "thailand", name: "태국", tokens: ["태국", "방콕", "파타야", "치앙마이", "후아힌"] },
      { key: "japan", name: "일본", tokens: ["일본", "후쿠오카", "기타큐슈", "나고야", "가고시마", "오사카", "삿포로", "구마모토", "나리타"] },
      { key: "china", name: "중국", tokens: ["중국", "청도", "연태", "위해", "장가계", "북경", "남경", "대련", "제남"] }
    ];
    const MD_PICK_COUNTRY_FLAGS = {
      thailand: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/flag_thai.png",
      japan: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/flag_japan.png",
      china: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/flag_china.png"
    };

    function getMdPickPackType(product = {}) {
      const source = [product.title, product.includes, product.notes].flat().filter(Boolean).join(" ");
      if (/\[?\s*항공팩|항공권|항공\s*포함/i.test(source)) return "air";
      return "golf";
    }

    function selectMdPickProductGroupRepresentative(products = []) {
      const source = (Array.isArray(products) ? products : []).filter(Boolean);
      return selectGolfJoinProductGroupRepresentative(source, { ignoreRepresentativeEvent: true });
    }

    function syncMdPickListCacheWithProductSource() {
      const productSource = getHomeProductSource();
      const familyRevision = String(golfJoinProductFamilyManifest?.activePublicationRevision || "individual-products");
      const signature = `${familyRevision}::${productSource.length}::${getBuilderMinDepartureISO()}`;
      if (productSource === mdPickListCacheSourceRef && signature === mdPickListCacheSourceSignature) return;
      mdPickListCacheSourceRef = productSource;
      mdPickListCacheSourceSignature = signature;
      mdPickListElementCache.clear();
      mdPickRepresentativeProductsCache.clear();
      mdPickThemeProductsCache.clear();
      mdPickThemeRepresentativeCandidatesCache = null;
      mdPickVisibleThemesCache = null;
      mdPickRegionCache.availability = new Map();
      mdPickRegionCache.searchItems = null;
      mdPickRegionCache.themeCandidates = null;
    }

    function productMatchesMdPickCountry(product, country) {
      const haystack = normalizeRegionKeyword([product.title, product.region, product.category, product.airport].filter(Boolean).join(" "));
      return country.tokens.some((token) => haystack.includes(normalizeRegionKeyword(token)));
    }

    function getMdPickDisplayDedupKey(item = {}) {
      const title = normalizeRegionKeyword(item.title || "");
      const region = normalizeRegionKeyword(item.region || "");
      const packType = String(item.packType || "").trim().toLowerCase();
      return [item.countryKey || "", packType, title || region].join("|");
    }

    function getMdPickRepresentativeProducts(country, packTypeOverride = "") {
      const minDepartureIso = getBuilderMinDepartureISO();
      const activePack = packTypeOverride || mdPickPackFilters[country.key] || "golf";
      const cacheKey = `${country.key}:${activePack}:${minDepartureIso}`;
      if (mdPickRepresentativeProductsCache.has(cacheKey)) {
        return mdPickRepresentativeProductsCache.get(cacheKey);
      }
      const groups = new Map();
      getMdPickRegionProductSource().forEach((product) => {
        if (!productMatchesMdPickCountry(product, country)) return;
        const hasDynamicAvailability = Boolean(product.homeProductSummary && product.availabilityObjectName);
        if ((!product.departureDate || product.departureDate < minDepartureIso) && !hasDynamicAvailability) return;
        if (!product.returnDate) return;
        if (!(Number(product.price) > 0)) return;
        const packType = getMdPickPackType(product);
        if (activePack && packType !== activePack) return;
        const key = getProductGroupKey(product);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(product);
      });
      const seenDisplayKeys = new Set();
      const results = [...groups.entries()]
        .map(([key, products]) => {
          const product = selectMdPickProductGroupRepresentative(products);
          if (!product) return null;
          return {
            key,
            countryKey: country.key,
            packType: getMdPickPackType(product),
            title: product.title,
            region: product.region || country.name,
            image: product.image || "",
            price: Number(product.priceFrom || product.price),
            departureDate: product.departureDate,
            products
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.price - b.price || String(a.departureDate).localeCompare(String(b.departureDate)) || String(a.title).localeCompare(String(b.title), "ko"))
        .filter((item) => {
          const displayKey = getMdPickDisplayDedupKey(item);
          if (seenDisplayKeys.has(displayKey)) return false;
          seenDisplayKeys.add(displayKey);
          return true;
        })
        .slice(0, 4);
      mdPickRepresentativeProductsCache.set(cacheKey, results);
      return results;
    }

    const MD_PICK_THEMES = [
      {
        key: "relax",
        name: "휴양형",
        emoji: "&#x1F334;",
        desc: "무조건 힐링! 스파랑 리조트가 좋아",
        keywords: ["힐링", "스파", "리조트", "휴양", "온천", "풀빌라", "비치", "해변", "바다", "오션", "휴식"]
      },
      {
        key: "city",
        name: "시내형",
        emoji: "&#x1F6CD;&#xFE0F;",
        desc: "라운드 끝나고 맛집이랑 쇼핑은 필수",
        keywords: ["시내", "도심", "맛집", "쇼핑", "야시장", "관광", "자유", "번화가", "나이트", "몰", "상권"]
      },
      {
        key: "passion",
        name: "열정형",
        emoji: "&#x26F3;",
        desc: "하루 36홀 올인! 무제한 라운드",
        keywords: ["36홀", "36", "무제한", "올인", "열정", "라운드", "라운딩", "골프텔", "1일36", "하루36"]
      }
    ];

    function getMdPickThemeProductText(product = {}) {
      return [
        product.title,
        product.region,
        product.category,
        product.airport,
        product.badge,
        product.includes,
        product.excludes,
        product.notes
      ].flat().filter(Boolean).join(" ");
    }

    function productMatchesMdPickTheme(product, theme) {
      const haystack = normalizeRegionKeyword(getMdPickThemeProductText(product));
      return theme.keywords.some((keyword) => haystack.includes(normalizeRegionKeyword(keyword)));
    }

    function getMdPickThemeCandidates() {
      getMdPickRegionProductSource();
      if (mdPickRegionCache.themeCandidates) return mdPickRegionCache.themeCandidates;
      mdPickRegionCache.themeCandidates = mdPickRegionCache.products
        .filter((product) => product.returnDate && Number(product.price) > 0)
        .sort((a, b) => (Number(a.priceFrom || a.price) || 0) - (Number(b.priceFrom || b.price) || 0) || String(a.departureDate).localeCompare(String(b.departureDate)));
      return mdPickRegionCache.themeCandidates;
    }

    function getMdPickThemeProducts(theme, usedKeys = new Set()) {
      const canUseCache = usedKeys.size === 0;
      const cached = canUseCache ? mdPickThemeProductsCache.get(theme.key) : null;
      if (cached) {
        cached.forEach((product) => usedKeys.add(getProductGroupKey(product)));
        return cached;
      }
      if (!mdPickThemeRepresentativeCandidatesCache) {
        const availableGroups = new Map();
        getMdPickThemeCandidates()
          .forEach((product) => {
            const key = getProductGroupKey(product);
            if (!availableGroups.has(key)) availableGroups.set(key, []);
            availableGroups.get(key).push(product);
          });
        mdPickThemeRepresentativeCandidatesCache = [...availableGroups.values()]
          .map(selectMdPickProductGroupRepresentative)
          .filter(Boolean)
          .sort((a, b) => (Number(a.priceFrom || a.price) || 0) - (Number(b.priceFrom || b.price) || 0) || String(a.departureDate).localeCompare(String(b.departureDate)));
      }
      const candidates = mdPickThemeRepresentativeCandidatesCache;
      const matched = candidates.filter((product) => productMatchesMdPickTheme(product, theme));
      const fallback = candidates.filter((product) => !matched.includes(product));
      const selected = [];
      const appendProduct = (product, allowUsed = false) => {
        const key = getProductGroupKey(product);
        if ((!allowUsed && usedKeys.has(key)) || selected.some((item) => getProductGroupKey(item) === key)) return;
        selected.push(product);
      };
      [...matched, ...fallback].forEach((product) => appendProduct(product, false));
      if (selected.length < 3) {
        [...matched, ...fallback].forEach((product) => appendProduct(product, true));
      }
      const results = selected.slice(0, 3);
      results.forEach((product) => usedKeys.add(getProductGroupKey(product)));
      if (canUseCache) mdPickThemeProductsCache.set(theme.key, results);
      return results;
    }

    function getMdPickThemePills(theme) {
      const fallback = theme.desc ? [theme.desc] : [];
      const pillMap = {
        relax: ["고래와 함께! 블루오션", "에메랄드빛 휴양지", "서핑 & 다이빙 성지"],
        city: ["라운드 끝나고 맛집투어", "쇼핑과 관광까지", "편안한 시내 휴양"],
        passion: ["하루 36홀 도전", "골프 집중 일정", "알찬 라운드 구성"]
      };
      return pillMap[theme.key] || fallback;
    }

    function getMdPickThemeSubcopy(theme) {
      const subcopyMap = {
        relax: "푸른 바다와 리조트에서 쉬어가는 여유로운 골프여행",
        city: "라운드 후 맛집, 쇼핑, 관광까지 함께 즐기는 도심형 일정",
        passion: "라운드에 집중하고 싶은 골퍼를 위한 알찬 골프 일정"
      };
      return subcopyMap[theme.key] || theme.desc || "";
    }

    function renderMdPickThemeSubcopy(theme) {
      const subcopy = escapeHtml(getMdPickThemeSubcopy(theme));
      if (theme.key !== "relax") return subcopy;
      return subcopy.replace("푸른 바다와 리조트에서 ", "푸른 바다와 리조트에서<br>");
    }

    function getMdPickThemeTabLabel(theme) {
      const labelMap = {
        relax: "쉼이 있는 바다 라운드",
        city: "라운드 후 도심 산책",
        passion: "하루 꽉 찬 집중 라운드"
      };
      return labelMap[theme.key] || theme.name || "";
    }

    function canPrefetchMdPickImages() {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection?.saveData) return false;
      return !/^(slow-)?2g$/i.test(String(connection?.effectiveType || ""));
    }

    function drainMdPickImagePrefetchQueue() {
      if (!canPrefetchMdPickImages()) {
        mdPickImagePrefetchQueue.length = 0;
        return;
      }
      while (
        mdPickImagePrefetchInFlight.size < MD_PICK_IMAGE_PREFETCH_MAX_CONCURRENCY
        && mdPickImagePrefetchQueue.length
      ) {
        const url = mdPickImagePrefetchQueue.shift();
        if (!url || mdPickImagePrefetchInFlight.has(url)) continue;
        const image = new Image();
        const complete = () => {
          if (!mdPickImagePrefetchInFlight.has(url)) return;
          mdPickImagePrefetchInFlight.delete(url);
          image.onload = null;
          image.onerror = null;
          drainMdPickImagePrefetchQueue();
        };
        image.decoding = "async";
        image.fetchPriority = "low";
        image.onload = complete;
        image.onerror = complete;
        mdPickImagePrefetchInFlight.set(url, image);
        image.src = url;
      }
    }

    function queueMdPickImagePrefetch(urls = []) {
      if (!canPrefetchMdPickImages()) return false;
      let queued = false;
      (Array.isArray(urls) ? urls : [urls]).forEach((value) => {
        const url = String(value || "").trim();
        if (!url || mdPickImagePrefetchUrls.has(url)) return;
        mdPickImagePrefetchUrls.add(url);
        mdPickImagePrefetchQueue.push(url);
        queued = true;
      });
      if (queued) drainMdPickImagePrefetchQueue();
      return queued;
    }

    function prefetchMdPickCountryImages(countryKey, packType = "") {
      const country = MD_PICK_COUNTRIES.find((item) => item.key === countryKey);
      if (!country) return false;
      const activePack = packType || mdPickPackFilters[country.key] || "golf";
      return queueMdPickImagePrefetch(
        getMdPickRepresentativeProducts(country, activePack).map((item) => item.image)
      );
    }

    function prefetchMdPickThemeImages(themeKey) {
      const theme = getVisibleMdPickThemes().find((item) => item.key === themeKey);
      if (!theme) return false;
      return queueMdPickImagePrefetch(
        theme.items.map((product) => product.image || product.thumb || "")
      );
    }

    function prefetchMdPickSlideTarget(key, index) {
      const targetIndex = Math.max(0, Number(index) || 0);
      if (key === "mdpick-country") {
        const country = MD_PICK_COUNTRIES[targetIndex];
        return country ? prefetchMdPickCountryImages(country.key) : false;
      }
      if (key === "mdpick-theme") {
        const theme = getVisibleMdPickThemes()[targetIndex];
        return theme ? prefetchMdPickThemeImages(theme.key) : false;
      }
      return false;
    }

    window.prefetchMdPickCountryImages = prefetchMdPickCountryImages;
    window.prefetchMdPickThemeImages = prefetchMdPickThemeImages;
    window.prefetchMdPickSlideTarget = prefetchMdPickSlideTarget;

    function ensureMdPickThemeGroupRendered(group, theme, options = {}) {
      if (!group || !theme) return false;
      const grid = group.querySelector(".join-mdpick-theme-grid");
      if (!grid) return false;
      if (!grid.querySelector(".join-mdpick-theme-card")) {
        grid.innerHTML = theme.items
          .map((product) => renderMdPickThemeCard(product, theme, { eager: options.eager !== false }))
          .join("");
        applyGolfJoinImageFallbacks(grid);
      }
      group.classList.add("is-theme-ready");
      group.removeAttribute("aria-busy");
      return true;
    }

    function setMdPickTheme(themeKey) {
      if (!MD_PICK_THEMES.some((theme) => theme.key === themeKey)) return;
      mdPickActiveThemeKey = themeKey;
      const themeSection = document.getElementById("join-section-mdpick-theme");
      if (themeSection) {
        let activeGroup = null;
        themeSection.querySelectorAll("[data-mdpick-theme-group]").forEach((group) => {
          const active = group.dataset.mdpickThemeGroup === themeKey;
          if (active) {
            activeGroup = group;
            const theme = getVisibleMdPickThemes().find((item) => item.key === themeKey);
            ensureMdPickThemeGroupRendered(group, theme, { eager: true });
          }
          group.classList.toggle("active", active);
          group.querySelectorAll(".join-mdpick-theme-tab").forEach((tab) => {
            const target = (tab.getAttribute("onclick") || "").match(/setMdPickTheme\('([^']+)'\)/)?.[1] || "";
            const isCurrent = target === themeKey;
            tab.classList.toggle("active", isCurrent);
            tab.setAttribute("aria-selected", isCurrent ? "true" : "false");
          });
        });
        activeGroup?.querySelectorAll?.(".join-mdpick-theme-card img").forEach((image) => {
          image.loading = "eager";
        });
        if (isMobileSlideDotsViewport() && activeGroup) {
          const rail = themeSection.querySelector(".join-mdpick-theme-groups");
          if (rail) {
            const railRect = rail.getBoundingClientRect();
            const groupRect = activeGroup.getBoundingClientRect();
            const targetLeft = rail.scrollLeft
              + groupRect.left
              - railRect.left
              - Math.max(0, (rail.clientWidth - groupRect.width) / 2);
            rail.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
          }
        }
        updateJoinSectionNavFixed();
        requestAnimationFrame(updateMdPickSlideDots);
        startMdPickThemeAutoSlide({ reset: true });
        return;
      }
      const themeSectionHtml = renderMdPickThemeSection();
      if (themeSection && !themeSectionHtml) {
        themeSection.remove();
        updateJoinSectionNavFixed();
        requestAnimationFrame(updateMdPickSlideDots);
        startMdPickThemeAutoSlide({ reset: true });
        return;
      }
      const mdPickSection = document.getElementById("joinMdPickSection");
      if (mdPickSection) {
        mdPickSection.innerHTML = renderMdPickSection();
        updateJoinSectionNavVisibility(getHomeJoinSections(), Boolean(mdPickSection.innerHTML));
        updateJoinSectionNavFixed();
        requestAnimationFrame(updateMdPickSlideDots);
        startMdPickThemeAutoSlide({ reset: true });
      }
    }
    window.setMdPickTheme = setMdPickTheme;

    function renderMdPickThemeCard(product, theme, options = {}) {
      const groupKey = getProductGroupKey(product);
      const countryKey = getMdPickProductCountryKey(product);
      const image = product.image || product.thumb || "";
      return `
        <button type="button" class="join-mdpick-theme-card" onclick="openMdPickProductDetail('${escapeJsString(groupKey)}', '${escapeJsString(countryKey)}')">
          <div class="join-mdpick-theme-thumb"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.title || "추천상품")}" loading="${options.eager ? "eager" : "lazy"}" decoding="async"></div>
          <div class="join-mdpick-theme-meta">
            <div class="join-mdpick-theme-region">${escapeHtml(product.region || product.category || "")}</div>
            <div class="join-mdpick-theme-product">${escapeHtml(product.title || "상품명 없음")}</div>
            <div class="join-mdpick-theme-price">${formatPrice(product.priceFrom || product.price)}<i class="join-mdpick-theme-price-unit">원~</i></div>
          </div>
        </button>
      `;
    }

    function renderMdPickThemeSection() {
      const themes = getVisibleMdPickThemes();
      if (!themes.length) return "";
      const activeTheme = themes.find((theme) => theme.key === mdPickActiveThemeKey) || themes[0];
      mdPickActiveThemeKey = activeTheme.key;
      const renderThemeGroup = (theme) => {
        const isActive = theme.key === activeTheme.key;
        return `
              <div class="join-mdpick-theme-group theme-${escapeHtml(theme.key)}${isActive ? " active is-theme-ready" : ""}" data-mdpick-theme-group="${escapeHtml(theme.key)}"${isActive ? "" : " aria-busy=\"true\""}>
                <div class="join-mdpick-theme-head">
                  <div class="join-mdpick-theme-name">${theme.name} ${theme.emoji}</div>
                  <div class="join-mdpick-theme-subcopy">${renderMdPickThemeSubcopy(theme)}</div>
                  <div class="join-mdpick-theme-pills" role="tablist" aria-label="취향맞춤 테마 선택">
                    ${themes.map((item) => `
                      <button
                        type="button"
                        class="join-mdpick-theme-tab${item.key === theme.key ? " active" : ""}"
                        onclick="setMdPickTheme('${escapeJsString(item.key)}')"
                        onmouseenter="prefetchMdPickThemeImages('${escapeJsString(item.key)}')"
                        onfocus="prefetchMdPickThemeImages('${escapeJsString(item.key)}')"
                        ontouchstart="prefetchMdPickThemeImages('${escapeJsString(item.key)}')"
                        role="tab"
                        aria-selected="${item.key === theme.key ? "true" : "false"}"
                      >${item.emoji} ${escapeHtml(getMdPickThemeTabLabel(item))}</button>
                    `).join("")}
                  </div>
                </div>
                <div class="join-mdpick-theme-grid">
                  ${isActive ? theme.items.map((product) => renderMdPickThemeCard(product, theme, { eager: true })).join("") : ""}
                </div>
              </div>
      `;
      };
      return `
        <div class="join-mdpick-theme-section" id="join-section-mdpick-theme" data-join-section="mdpick-theme">
          <div class="join-mdpick-theme-title">취향맞춤 TOP3</div>
          <div class="join-mdpick-theme-copy">라운드 스타일 따라 떠나는 여행</div>
          <div class="join-mdpick-theme-groups" onscroll="updateMdPickThemeDots()">
            ${themes.map(renderThemeGroup).join("")}
          </div>
          ${renderSlideDots("mdpick-theme")}
        </div>
      `;
    }

    function renderMdPickThemeDeferredPlaceholder() {
      return `<div class="join-mdpick-theme-deferred" id="join-section-mdpick-theme" data-mdpick-theme-deferred aria-busy="true"></div>`;
    }

    function renderMdPickThemeSectionInPlace() {
      const host = document.getElementById("joinMdPickSection");
      const placeholder = host?.querySelector?.("[data-mdpick-theme-deferred]");
      if (!placeholder) return false;
      const html = renderMdPickThemeSection();
      if (!html) {
        placeholder.remove();
        updateMdPickSectionNavVisibility(Boolean(host.querySelector("#join-section-mdpick")));
        return false;
      }
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html.trim();
      const section = wrapper.firstElementChild;
      if (!section) return false;
      placeholder.replaceWith(section);
      applyGolfJoinImageFallbacks(section);
      updateMdPickSectionNavVisibility(true);
      scheduleHomeSlideDotsRefresh();
      startMdPickThemeAutoSlide();
      scheduleJoinSectionNavActiveUpdate();
      return true;
    }

    function observeMdPickThemeSection() {
      const placeholder = document.querySelector("#joinMdPickSection [data-mdpick-theme-deferred]");
      if (!placeholder) return;
      mdPickThemeSectionObserver?.disconnect?.();
      mdPickThemeSectionObserver = null;
      const render = () => requestAnimationFrame(() => renderMdPickThemeSectionInPlace());
      if (!("IntersectionObserver" in window)) {
        render();
        return;
      }
      mdPickThemeSectionObserver = new IntersectionObserver((entries, observer) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        mdPickThemeSectionObserver = null;
        render();
      }, { rootMargin: "1200px 0px 1200px 0px" });
      mdPickThemeSectionObserver.observe(placeholder);
    }

    function setMdPickPackFilter(countryKey, packType) {
      mdPickPackFilters[countryKey] = packType;
      if (countryKey === mdPickActiveCountryKey && renderMdPickCountryContentInPlace(countryKey)) return;
      renderMdPickCountryInPlace(countryKey);
    }

    function getBuilderDayOffsetFromISO(isoDate, baseYear, baseMonth) {
      if (!isoDate) return null;
      const date = new Date(`${isoDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return null;
      const base = new Date(baseYear, baseMonth, 1);
      const dayMs = 24 * 60 * 60 * 1000;
      return Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - base.getTime()) / dayMs) + 1;
    }

    function setupMdPickBuilderState(productGroupKey, countryKey, options = {}) {
      const country = MD_PICK_COUNTRIES.find((item) => item.key === countryKey);
      const products = getBuilderProductSource().filter((product) => getProductGroupKey(product) === productGroupKey);
      const currentProduct = options.product || currentDetailJoinData;
      const product = currentProduct && getProductGroupKey(currentProduct) === productGroupKey
        ? currentProduct
        : selectGolfJoinBookableProduct(products, { avoidActiveScheduleOverlap: true });
      const fixedProductGoodSeq = product ? getGolfJoinProductGoodSeq(product) : "";
      const selectedPeriodProducts = fixedProductGoodSeq
        ? products.filter((item) => getGolfJoinProductGoodSeq(item) === fixedProductGoodSeq)
        : products;
      Object.assign(builderState, {
        fixedProductGroupKey: productGroupKey,
        fixedProductGoodSeq,
        mdPickMode: true,
        mdPickDateChangeMode: Boolean(options.dateChangeMode),
        mdPickRecruitDirectMode: Boolean(options.recruitDirectMode),
        productId: options.selectProduct ? (product?.id || "") : "",
        productName: product?.title || "",
        productFamilyId: product ? getGolfJoinProductFamilyId(product) : "",
        region: product?.region || country?.name || "",
        regions: product?.region ? [product.region] : (country ? [country.name] : []),
        dateConstraintRegions: country ? [country.name] : [],
        startBefore: 0,
        startAfter: 0,
        endBefore: 0,
        endAfter: 0,
        dateSelectionComplete: Boolean(options.useProductDates && product?.departureDate),
        regionSelectionComplete: Boolean(options.selectProduct && product?.id),
        durationFilter: ""
      });
      builderRegionSelectorMode = false;
      const minDate = selectedPeriodProducts
        .filter((item) => item.departureDate && item.departureDate >= getBuilderMinDepartureISO())
        .sort((a, b) => String(a.departureDate).localeCompare(String(b.departureDate)))[0]?.departureDate;
      const targetDate = options.useProductDates ? product?.departureDate : minDate;
      if (targetDate) {
        const date = new Date(`${targetDate}T00:00:00`);
        builderState.viewYear = date.getFullYear();
        builderState.viewMonth = date.getMonth();
      }
      if (options.useProductDates && product?.departureDate) {
        builderState.startDay = getBuilderDayOffsetFromISO(product.departureDate, builderState.viewYear, builderState.viewMonth);
        builderState.endDay = getBuilderDayOffsetFromISO(product.returnDate || product.departureDate, builderState.viewYear, builderState.viewMonth);
        if (options.selectProduct) {
          builderState.productId = product.id || "";
          builderState.productName = product.title || "";
          builderState.productFamilyId = getGolfJoinProductFamilyId(product);
        }
      } else {
        builderState.startDay = null;
        builderState.endDay = null;
      }
      renderBuilderCalendar();
      updateBuilderRegionDisplay();
      updateBuilderSummary();
      return { product, products: selectedPeriodProducts };
    }

    async function openMdPickBuilder(productGroupKey, countryKey, options = {}) {
      await ensureExternalGolfJoinProductsLoaded();
      const resolvedProduct = options.product || currentDetailJoinData;
      const resolvedGroupKey = resolvedProduct ? getProductGroupKey(resolvedProduct) : productGroupKey;
      setupMdPickBuilderState(resolvedGroupKey, countryKey, options);
      const opened = await openModal("builderModal", { preserveBuilderState: true });
      if (!opened) return false;
      setBuilderStep(1);
      return true;
    }

    async function openMdPickBuilderWithCurrentDate(productGroupKey, countryKey, product, options = {}) {
      await ensureExternalGolfJoinProductsLoaded();
      const resolvedProduct = product || currentDetailJoinData;
      const resolvedGroupKey = resolvedProduct ? getProductGroupKey(resolvedProduct) : productGroupKey;
      setupMdPickBuilderState(resolvedGroupKey, countryKey, {
        product: resolvedProduct,
        useProductDates: true,
        selectProduct: true,
        recruitDirectMode: true
      });
      const opened = await openModal("builderModal", { preserveBuilderState: true, skipProfileCheck: Boolean(options.skipProfileCheck) });
      if (!opened) return false;
      setBuilderStep(3);
      return true;
    }

    async function openMdPickProductDetail(productGroupKey, countryKey, trigger = null) {
      const pageScrollState = capturePageScrollState();
      const products = getHomeProductSource().filter((product) => (
        !product.homeReferenceOnly
        && getProductGroupKey(product) === productGroupKey
      ));
      return runJoinReadLoading(async () => {
        const hasAvailabilityMetadata = products.some((item) => item.availabilityObjectName || item.availabilityUrl);
        const availabilityProducts = await loadGolfJoinProductGroupAvailability(products);
        const candidates = availabilityProducts.length ? availabilityProducts : products;
        const product = selectGolfJoinBookableProduct(candidates, { avoidActiveScheduleOverlap: true })
          || (!hasAvailabilityMetadata
            ? selectGolfJoinProductGroupRepresentative(candidates, { ignoreRepresentativeEvent: true })
            : null);
        if (!product) {
          openBuilderAlert("현재 선택 가능한 출발일이 없습니다. 잠시 후 다시 확인해 주세요.");
          return;
        }
        void ensureExternalGolfJoinProductsLoaded();
        return showMdPickDetailProduct(product, productGroupKey, countryKey, { pageScrollState });
      }, {
        ownerKey: `mdpick-availability:${productGroupKey}`,
        target: trigger,
        message: "출발 가능한 일정을 확인하고 있어요"
      });
    }

    function renderMdPickCard(item) {
      return `
        <button type="button" class="join-mdpick-card" onclick="if (consumeMdPickSwipeClick()) return; openMdPickProductDetail('${escapeJsString(item.key)}', '${escapeJsString(item.countryKey)}', event.currentTarget)">
          <div class="join-mdpick-thumb"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="eager" decoding="async"></div>
          <div class="join-mdpick-info">
            <div class="join-mdpick-region">${escapeHtml(item.region)}</div>
            <div class="join-mdpick-title">${escapeHtml(item.title)}</div>
            <div class="join-mdpick-price">${formatPrice(item.price)}<i class="join-mdpick-price-unit">원~</i></div>
          </div>
        </button>
      `;
    }

    function consumeMdPickSwipeClick() {
      if (!mdPickSuppressCardClick) return false;
      mdPickSuppressCardClick = false;
      return true;
    }

    function getMdPickActiveCountry() {
      return MD_PICK_COUNTRIES.find((item) => item.key === mdPickActiveCountryKey) || MD_PICK_COUNTRIES[0];
    }

    function renderMdPickCountryName(country) {
      const flag = MD_PICK_COUNTRY_FLAGS[country.key];
      return `${escapeHtml(country.name)}${flag ? `<img class="join-mdpick-country-flag${country.key === "japan" ? " join-mdpick-country-flag-japan" : ""}" src="${escapeHtml(flag)}" alt="">` : ""}`;
    }

    function selectMdPickCountry(countryKey, event) {
      event?.stopPropagation?.();
      if (!MD_PICK_COUNTRIES.some((item) => item.key === countryKey)) return;
      mdPickListAnimating = false;
      mdPickActiveCountryKey = countryKey;
      if (renderMdPickCountryContentInPlace(countryKey)) return;
      renderMdPickCountryInPlace(countryKey);
    }

    function getMdPickCountryIndex(countryKey = mdPickActiveCountryKey) {
      return Math.max(0, MD_PICK_COUNTRIES.findIndex((item) => item.key === countryKey));
    }

    function syncMdPickCountryButtons(countryKey) {
      document.querySelectorAll("[data-mdpick-country-option]").forEach((button) => {
        const isActive = button.dataset.mdpickCountryOption === countryKey;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-current", isActive ? "true" : "false");
      });
    }

    function getMdPickListNode(container) {
      return Array.from(container?.children || []).find((element) =>
        element.classList?.contains("join-mdpick-list") ||
        element.classList?.contains("join-mdpick-list-swipe-viewport") ||
        element.classList?.contains("join-mdpick-empty")
      );
    }

    function renderMdPickCountryContentInPlace(countryKey) {
      const country = MD_PICK_COUNTRIES.find((item) => item.key === countryKey);
      const current = document.querySelector(".join-mdpick-country");
      if (!country || !current) return false;
      current.dataset.mdpickCountry = country.key;
      syncMdPickCountryButtons(country.key);
      current.querySelectorAll(".join-mdpick-pack-chip").forEach((button) => {
        const packType = button.dataset.mdpickPackFilter;
        const isActive = packType === (mdPickPackFilters[country.key] || "golf");
        button.classList.toggle("active", isActive);
        button.setAttribute("onclick", `setMdPickPackFilter('${country.key}', '${packType}')`);
        button.setAttribute("onmouseenter", `prefetchMdPickCountryImages('${country.key}', '${packType}')`);
        button.setAttribute("onfocus", `prefetchMdPickCountryImages('${country.key}', '${packType}')`);
        button.setAttribute("ontouchstart", `prefetchMdPickCountryImages('${country.key}', '${packType}')`);
      });
      current.querySelector(".join-mdpick-pack-info-button")?.setAttribute("onclick", `toggleMdPickPackTooltip(event, '${country.key}')`);
      const tooltip = current.querySelector(".join-mdpick-pack-tooltip");
      if (tooltip) tooltip.id = `mdPickPackTooltip-${country.key}`;
      const currentList = getMdPickListNode(current);
      const currentListKey = currentList?.dataset?.mdpickListKey;
      if (currentListKey) mdPickListElementCache.set(currentListKey, currentList);
      const nextList = getMdPickListElement(country, mdPickPackFilters[country.key] || "golf");
      if (!currentList || !nextList) return false;
      if (currentList === nextList) return true;
      currentList.replaceWith(nextList);
      requestAnimationFrame(updateMdPickCountryDots);
      return true;
    }

    function changeMdPickCountryBySwipe(direction) {
      if (mdPickListAnimating) return;
      const currentIndex = getMdPickCountryIndex();
      const nextIndex = Math.min(MD_PICK_COUNTRIES.length - 1, Math.max(0, currentIndex + direction));
      const nextCountry = MD_PICK_COUNTRIES[nextIndex];
      if (!nextCountry || nextCountry.key === mdPickActiveCountryKey) return;
      const currentList = document.querySelector(".join-mdpick-list");
      if (!currentList) {
        mdPickActiveCountryKey = nextCountry.key;
        renderMdPickCountryInPlace(nextCountry.key);
        return;
      }
      const currentCountry = document.querySelector(".join-mdpick-country");
      const nextListHtml = renderMdPickListHtml(nextCountry, mdPickPackFilters[nextCountry.key] || "golf");
      const viewport = document.createElement("div");
      const track = document.createElement("div");
      mdPickListAnimating = true;
      mdPickActiveCountryKey = nextCountry.key;
      if (currentCountry) currentCountry.dataset.mdpickCountry = nextCountry.key;
      syncMdPickCountryButtons(nextCountry.key);
      viewport.className = "join-mdpick-list-swipe-viewport";
      viewport.style.height = `${currentList.offsetHeight}px`;
      track.className = "join-mdpick-list-swipe-track";
      if (direction > 0) {
        track.innerHTML = `${currentList.outerHTML}${nextListHtml}`;
      } else {
        track.innerHTML = `${nextListHtml}${currentList.outerHTML}`;
        track.style.transform = "translateX(-100%)";
      }
      viewport.appendChild(track);
      currentList.replaceWith(viewport);
      const finishSwipe = () => {
        renderMdPickCountryInPlace(nextCountry.key);
        mdPickListAnimating = false;
      };
      track.addEventListener("transitionend", finishSwipe, { once: true });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          track.classList.add("animating");
          track.style.transform = direction > 0 ? "translateX(-100%)" : "translateX(0)";
          window.setTimeout(() => {
            if (mdPickListAnimating) finishSwipe();
          }, 520);
        });
      });
    }

    function handleMdPickListTouchStart(event) {
      const touch = event.touches?.[0];
      if (!touch) return;
      mdPickSwipeStartX = touch.clientX;
      mdPickSwipeStartY = touch.clientY;
      mdPickSwipeMoved = false;
      mdPickSwipePrefetchDirection = 0;
    }

    function handleMdPickListTouchMove(event) {
      const touch = event.touches?.[0];
      if (!touch) return;
      const deltaX = touch.clientX - mdPickSwipeStartX;
      const deltaY = touch.clientY - mdPickSwipeStartY;
      if (Math.abs(deltaX) > 24 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        mdPickSwipeMoved = true;
        const direction = deltaX < 0 ? 1 : -1;
        if (direction !== mdPickSwipePrefetchDirection) {
          mdPickSwipePrefetchDirection = direction;
          const nextIndex = Math.min(MD_PICK_COUNTRIES.length - 1, Math.max(0, getMdPickCountryIndex() + direction));
          const nextCountry = MD_PICK_COUNTRIES[nextIndex];
          if (nextCountry && nextCountry.key !== mdPickActiveCountryKey) {
            prefetchMdPickCountryImages(nextCountry.key);
          }
        }
      }
    }

    function handleMdPickListTouchEnd(event) {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const deltaX = touch.clientX - mdPickSwipeStartX;
      const deltaY = touch.clientY - mdPickSwipeStartY;
      const horizontalSwipe = Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3;
      if (!horizontalSwipe || mdPickListAnimating) return;
      event.preventDefault?.();
      mdPickSuppressCardClick = true;
      window.setTimeout(() => {
        mdPickSuppressCardClick = false;
      }, 350);
      changeMdPickCountryBySwipe(deltaX < 0 ? 1 : -1);
    }

    function getMdPickListCacheKey(country, packType = "") {
      return `${country?.key || ""}:${packType || mdPickPackFilters[country?.key] || "golf"}`;
    }

    function renderMdPickListHtml(country, packType = "") {
      const activePack = packType || mdPickPackFilters[country.key] || "golf";
      const items = getMdPickRepresentativeProducts(country, activePack);
      const listKey = getMdPickListCacheKey(country, activePack);
      if (items.length) {
        return `<div class="join-mdpick-list" data-mdpick-list-key="${escapeHtml(listKey)}" ontouchstart="handleMdPickListTouchStart(event)" ontouchmove="handleMdPickListTouchMove(event)" ontouchend="handleMdPickListTouchEnd(event)">${items.map(renderMdPickCard).join("")}</div>`;
      }
      if (isMdPickProductsLoading()) return renderMdPickLoadingListHtml(listKey);
      return `<div class="join-mdpick-list join-mdpick-empty" data-mdpick-list-key="${escapeHtml(listKey)}" aria-hidden="true"></div>`;
    }

    function getMdPickListElement(country, packType = "") {
      const activePack = packType || mdPickPackFilters[country.key] || "golf";
      const key = getMdPickListCacheKey(country, activePack);
      const cached = mdPickListElementCache.get(key);
      if (cached) return cached;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderMdPickListHtml(country, activePack).trim();
      const node = wrapper.firstElementChild;
      if (node) mdPickListElementCache.set(key, node);
      return node;
    }

    function renderMdPickCountry(country) {
      const activePack = mdPickPackFilters[country.key] || "golf";
      let unusedCountrySwitcherHtml = mdPickCountryMenuOpen
        ? `<div class="join-mdpick-country-options open" role="group" aria-label="MD PICK 국가 선택">
            ${MD_PICK_COUNTRIES.map((item) => `<button type="button" class="join-mdpick-country-option ${item.key === country.key ? "join-mdpick-country-option-current active" : "join-mdpick-country-option-alt"}" onclick="selectMdPickCountry('${item.key}', event)" aria-current="${item.key === country.key ? "true" : "false"}">${item.name}</button>`).join("")}
            <button type="button" class="join-mdpick-country-close" onclick="closeMdPickCountryMenu(event)" aria-label="국가 선택 닫기">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="mrt-web-icons" aria-hidden="true"><path d="M10.8 12 15.4 7.4a1.12 1.12 0 0 0 0-1.6 1.12 1.12 0 0 0-1.6 0l-5.4 5.4a1.12 1.12 0 0 0 0 1.6l5.4 5.4a1.12 1.12 0 0 0 1.6 0 1.12 1.12 0 0 0 0-1.6L10.8 12Z"></path></svg>
            </button>
          </div>`
        : `<button type="button" class="join-mdpick-country-trigger" onclick="toggleMdPickCountryMenu(event)" aria-expanded="false">
            <i class="join-mdpick-country-current">${country.name}</i>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="mrt-web-icons" aria-hidden="true"><path d="M12 15.838a1.2 1.2 0 0 1-.8-.3l-4.625-4.626a1.03 1.03 0 0 1-.312-.788c.008-.308.12-.57.337-.787.217-.216.483-.325.8-.325.317 0 .583.109.8.325l3.8 3.8 3.825-3.825c.217-.216.48-.32.788-.311.308.008.57.12.787.337.217.216.325.483.325.8 0 .316-.108.583-.325.8l-4.6 4.6a1.2 1.2 0 0 1-.8.3Z"></path></svg>
          </button>`;
      const countryMenuItems = (mdPickCountryMenuOrder.length ? mdPickCountryMenuOrder : MD_PICK_COUNTRIES.map((item) => item.key))
        .map((key) => MD_PICK_COUNTRIES.find((item) => item.key === key))
        .filter(Boolean);
      const primaryCountry = countryMenuItems[0] || country;
      const optionCountries = countryMenuItems.slice(1);
      const countrySwitcherHtml = `
        <button type="button" class="join-mdpick-country-trigger${primaryCountry.key === country.key ? " active" : ""}" data-mdpick-country-option="${primaryCountry.key}" onclick="selectMdPickCountry('${primaryCountry.key}', event)" onmouseenter="prefetchMdPickCountryImages('${primaryCountry.key}')" onfocus="prefetchMdPickCountryImages('${primaryCountry.key}')" ontouchstart="prefetchMdPickCountryImages('${primaryCountry.key}')" aria-current="${primaryCountry.key === country.key ? "true" : "false"}">
          <i class="join-mdpick-country-current">${renderMdPickCountryName(primaryCountry)}</i>
        </button>
        <div class="join-mdpick-country-options" role="group" aria-label="MD PICK 국가 선택">
          ${optionCountries.map((item) => `<button type="button" class="join-mdpick-country-option join-mdpick-country-option-alt${item.key === country.key ? " active" : ""}" data-mdpick-country-option="${item.key}" onclick="selectMdPickCountry('${item.key}', event)" onmouseenter="prefetchMdPickCountryImages('${item.key}')" onfocus="prefetchMdPickCountryImages('${item.key}')" ontouchstart="prefetchMdPickCountryImages('${item.key}')" aria-current="${item.key === country.key ? "true" : "false"}">${renderMdPickCountryName(item)}</button>`).join("")}
        </div>
        <button type="button" class="join-mdpick-country-toggle${mdPickCountryMenuOpen ? " open" : ""}${mdPickCountryMenuNoMotion ? " no-motion" : ""}" onclick="toggleMdPickCountryMenu(event)" aria-expanded="${mdPickCountryMenuOpen ? "true" : "false"}" aria-label="국가 선택 ${mdPickCountryMenuOpen ? "닫기" : "열기"}">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="mrt-web-icons" aria-hidden="true"><path d="M12 15.838a1.2 1.2 0 0 1-.8-.3l-4.625-4.626a1.03 1.03 0 0 1-.312-.788c.008-.308.12-.57.337-.787.217-.216.483-.325.8-.325.317 0 .583.109.8.325l3.8 3.8 3.825-3.825c.217-.216.48-.32.788-.311.308.008.57.12.787.337.217.216.325.483.325.8 0 .316-.108.583-.325.8l-4.6 4.6a1.2 1.2 0 0 1-.8.3Z"></path></svg>
        </button>`;
      unusedCountrySwitcherHtml = mdPickCountryMenuOpen ? `
        <div class="join-mdpick-country-options open${mdPickCountryMenuNoMotion ? " no-motion" : ""}" role="group" aria-label="MD PICK 국가 선택">
          ${MD_PICK_COUNTRIES.map((item) => `<button type="button" class="join-mdpick-country-option join-mdpick-country-option-alt${item.key === country.key ? " active" : ""}" onclick="selectMdPickCountry('${item.key}', event)" aria-current="${item.key === country.key ? "true" : "false"}">${item.name}</button>`).join("")}
        </div>
        <button type="button" class="join-mdpick-country-toggle open${mdPickCountryMenuNoMotion ? " no-motion" : ""}" onclick="toggleMdPickCountryMenu(event)" aria-expanded="true" aria-label="국가 선택 닫기">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="mrt-web-icons" aria-hidden="true"><path d="M12 15.838a1.2 1.2 0 0 1-.8-.3l-4.625-4.626a1.03 1.03 0 0 1-.312-.788c.008-.308.12-.57.337-.787.217-.216.483-.325.8-.325.317 0 .583.109.8.325l3.8 3.8 3.825-3.825c.217-.216.48-.32.788-.311.308.008.57.12.787.337.217.216.325.483.325.8 0 .316-.108.583-.325.8l-4.6 4.6a1.2 1.2 0 0 1-.8.3Z"></path></svg>
        </button>` : `
        <button type="button" class="join-mdpick-country-trigger" onclick="toggleMdPickCountryMenu(event)" aria-current="true" aria-expanded="false">
          <i class="join-mdpick-country-current">${country.name}</i>
        </button>
        <button type="button" class="join-mdpick-country-toggle" onclick="toggleMdPickCountryMenu(event)" aria-expanded="false" aria-label="국가 선택 열기">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="mrt-web-icons" aria-hidden="true"><path d="M12 15.838a1.2 1.2 0 0 1-.8-.3l-4.625-4.626a1.03 1.03 0 0 1-.312-.788c.008-.308.12-.57.337-.787.217-.216.483-.325.8-.325.317 0 .583.109.8.325l3.8 3.8 3.825-3.825c.217-.216.48-.32.788-.311.308.008.57.12.787.337.217.216.325.483.325.8 0 .316-.108.583-.325.8l-4.6 4.6a1.2 1.2 0 0 1-.8.3Z"></path></svg>
        </button>`;
      return `
        <div class="join-mdpick-country" data-mdpick-country="${country.key}">
          <div class="join-mdpick-country-head">
            <div class="join-mdpick-country-name">
              ${countrySwitcherHtml}
            </div>
            <div class="join-mdpick-pack-chips" aria-label="${country.name} 상품 유형">
              <button type="button" class="join-mdpick-pack-chip${activePack === "golf" ? " active" : ""}" data-mdpick-pack-filter="golf" onclick="setMdPickPackFilter('${country.key}', 'golf')" onmouseenter="prefetchMdPickCountryImages('${country.key}', 'golf')" onfocus="prefetchMdPickCountryImages('${country.key}', 'golf')" ontouchstart="prefetchMdPickCountryImages('${country.key}', 'golf')">골프팩</button>
              <button type="button" class="join-mdpick-pack-chip${activePack === "air" ? " active" : ""}" data-mdpick-pack-filter="air" onclick="setMdPickPackFilter('${country.key}', 'air')" onmouseenter="prefetchMdPickCountryImages('${country.key}', 'air')" onfocus="prefetchMdPickCountryImages('${country.key}', 'air')" ontouchstart="prefetchMdPickCountryImages('${country.key}', 'air')">항공팩</button>
              <button type="button" class="join-mdpick-pack-info-button" onclick="toggleMdPickPackTooltip(event, '${country.key}')" aria-label="상품 유형 안내">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M8 7.1v4.1" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>
                  <circle cx="8" cy="4.95" r=".85" fill="currentColor"/>
                </svg>
              </button>
              <div class="join-mdpick-pack-tooltip" id="mdPickPackTooltip-${country.key}" role="tooltip">
                <div class="join-mdpick-pack-info-list">
                  <div><strong>골프팩</strong><span>골프 + 숙박이 포함된 상품입니다.</span></div>
                  <div><strong>항공팩</strong><span>항공 + 골프 + 숙박이 포함된 상품입니다.</span></div>
                </div>
              </div>
            </div>
          </div>
          ${renderMdPickListHtml(country, activePack)}
        </div>
      `;
    }

    function renderMdPickCountryInPlace(countryKey) {
      const country = MD_PICK_COUNTRIES.find((item) => item.key === countryKey) || getMdPickActiveCountry();
      if (!country) return;
      const current = document.querySelector(".join-mdpick-country");
      if (!current) {
        renderJoins();
        return;
      }
      const currentList = getMdPickListNode(current);
      const currentListKey = currentList?.dataset?.mdpickListKey;
      if (currentListKey) mdPickListElementCache.set(currentListKey, currentList);
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderMdPickCountry(country).trim();
      const next = wrapper.firstElementChild;
      if (next) current.replaceWith(next);
      requestAnimationFrame(updateMdPickCountryDots);
    }

    function renderMdPickSection(options = {}) {
      syncMdPickListCacheWithProductSource();
      const isLoading = isMdPickProductsLoading();
      if (isLoading) return renderMdPickLoadingSection();
      const themeSectionHtml = options.deferTheme
        ? renderMdPickThemeDeferredPlaceholder()
        : renderMdPickThemeSection();
      const hasProducts = MD_PICK_COUNTRIES.some((country) => getMdPickRepresentativeProducts(country).length);
      if (!hasProducts && !themeSectionHtml) return "";
      return `
        <section class="join-product-section layout-mdpick" id="join-section-mdpick" data-join-section="mdpick" aria-label="MD PICK! 추천여행">
          <div class="join-product-section-head">
            <div class="join-product-section-copy">
              <div class="join-product-section-title">MD PICK! 추천여행<div class="join-product-section-icon popular" aria-hidden="true"></div></div>
              <p class="join-product-section-desc">인기 상품으로 멤버를 모집해보세요.</p>
            </div>
          </div>
          <div class="join-mdpick-countries">
            ${renderMdPickCountry(getMdPickActiveCountry())}
          </div>
          ${renderSlideDots("mdpick-country")}
          ${themeSectionHtml}
        </section>
      `;
    }

    function setSoonRangeFilter(key) {
      if (!SOON_RANGE_FILTERS.some((item) => item.key === key)) return;
      activeSoonRangeKey = key;
      resetSoonVisibleCount();
      renderJoins({ skipQuickMobileCarousel: true });
    }

    window.setSoonRangeFilter = setSoonRangeFilter;

    function loadMoreSoonItems() {
      increaseSoonVisibleCount();
      renderJoins();
    }

    window.loadMoreSoonItems = loadMoreSoonItems;

    function renderSoonRangeTabs(items = []) {
      const filters = getAvailableSoonRangeFilters(items);
      if (filters.length <= 1) return "";
      const activeFilter = getActiveSoonRangeFilter(items);
      return `
        <div class="join-soon-range-tabs" role="tablist" aria-label="곧출발 상품 기간 선택">
          ${filters.map((item) => `
            <button
              type="button"
              class="join-mdpick-pack-chip join-soon-range-tab${item.key === activeFilter.key ? " active" : ""}"
              onclick="setSoonRangeFilter('${item.key}')"
              role="tab"
              aria-selected="${item.key === activeFilter.key ? "true" : "false"}"
            >${item.label}</button>
          `).join("")}
        </div>
      `;
    }

    function renderSoonMoreButton(visibleCount, totalCount) {
      if (visibleCount >= totalCount) return "";
      return `
        <div class="join-soon-more">
          <button type="button" class="join-soon-more-button" onclick="loadMoreSoonItems()">
            <div class="join-soon-more-button-text">다음 모임 더보기</div>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `;
    }

    function renderMyJoinFilterControls(groups, placement = "desktop") {
      const placementClass = placement === "mobile"
        ? "join-my-home-filters-mobile"
        : "join-my-home-filters-desktop";
      const filters = getAvailableMyHomeJoinFilters(groups);
      if (!filters.length) return "";
      return `
        <div class="join-mdpick-pack-chips join-my-home-filters ${placementClass}" role="tablist" aria-label="나의 모임 필터">
          ${filters.map((filter) => `
            <button type="button" class="join-mdpick-pack-chip${myJoinFilter === filter.key ? " active" : ""}" data-my-join-filter="${filter.key}" onclick="setMyJoinFilter('${filter.key}')" role="tab" aria-selected="${myJoinFilter === filter.key ? "true" : "false"}">${filter.label}</button>
          `).join("")}
        </div>
      `;
    }

    function renderMyJoinMoreButton(visibleCount, totalCount, filter) {
      if (isMobileSlideDotsViewport() || visibleCount >= totalCount) return "";
      return `
        <div class="join-soon-more join-overseas-best-more join-my-home-more" data-my-join-more="${filter}">
          <button type="button" class="join-soon-more-button" onclick="loadMoreMyJoinItems()">
            <div class="join-soon-more-button-text">모임 더보기</div>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `;
    }

    function renderMyJoinEmptyState(filter = myJoinFilter) {
      const messages = {
        complete: "현재 모집완료된 모임이 없습니다.",
        created: "현재 내가 만든 모임이 없습니다.",
        joined: "현재 참여중인 모임이 없습니다."
      };
      return `<div class="join-overseas-best-empty" role="status">${escapeHtml(messages[filter] || messages.created)}</div>`;
    }

    function renderMyHomeJoinPanel(filter, items = []) {
      const visibleCount = getMyJoinVisibleCount(filter, items.length);
      const active = myJoinFilter === filter;
      return `
        <div class="join-my-home-panel" data-my-join-panel="${filter}" role="tabpanel"${active ? "" : " hidden"}>
          ${items.length ? `
            <div class="join-grid" onscroll="updateBestSectionControls('my')">
              ${items.map((join, index) => renderJoinCard(join, {
                allowUnavailable: filter === "complete",
                myJoinFilter: filter,
                showCurrentMemberBadge: true,
                hidden: index >= visibleCount
              })).join("")}
            </div>
          ` : renderMyJoinEmptyState(filter)}
          ${renderMyJoinMoreButton(visibleCount, items.length, filter)}
        </div>
      `;
    }

    function renderMyHomeJoinSection() {
      const items = getMyHomeJoinItems();
      if (!items.length) return "";
      const groups = getMyHomeJoinGroups(items);
      const availableFilters = getAvailableMyHomeJoinFilters(groups);
      if (!availableFilters.length) return "";
      resolveMyJoinFilter(groups);
      const section = { key: "my", title: "나의 모임" };
      const largestGroupCount = Math.max(groups.complete.length, groups.created.length, groups.joined.length);
      return `
        <section class="join-product-section layout-overseas layout-my" id="join-section-my" data-join-section="my" aria-label="나의 모임">
          <div class="join-product-section-head">
            <div class="join-product-section-copy">
              <div class="join-product-section-title">나의 모임<div class="join-product-section-icon my" aria-hidden="true"></div></div>
              <p class="join-product-section-desc">내가 생성 및 참여 중인 모임을 확인해보세요.</p>
            </div>
            ${renderMyJoinFilterControls(groups, "desktop")}
            ${renderBestJoinControls(section, largestGroupCount)}
          </div>
          ${renderMyJoinFilterControls(groups, "mobile")}
          <div class="join-my-home-panels">
            ${availableFilters.map((filter) => renderMyHomeJoinPanel(filter.key, groups[filter.key])).join("")}
          </div>
          ${renderSlideDots("my")}
        </section>
      `;
    }

    function renderOverseasBestMoreButton(visibleCount, totalCount) {
      if (isMobileSlideDotsViewport() || visibleCount >= totalCount) return "";
      return `
        <div class="join-soon-more join-overseas-best-more">
          <button type="button" class="join-soon-more-button" onclick="loadMoreOverseasBestItems()">
            <div class="join-soon-more-button-text">모임 더보기</div>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `;
    }

    function renderOverseasBestEmptyState() {
      return `<div class="join-overseas-best-empty" role="status">현재 확인할 수 있는 해외 모임이 없습니다.</div>`;
    }

    function renderJoinProductSection(section) {
      if (!section.items.length) return "";
      if (section.key === "custom") {
        return renderCustomJoinSection(section);
      }
      const displayItems = getSectionDisplayItems(section);
      const soonTotalItems = section.key === "soon" ? getSoonFilteredItems(section.items) : [];
      const soonDateCount = section.key === "soon"
        ? new Set(displayItems.map(getJoinDateKey)).size
        : 0;
      const overseasTotalCount = section.key === "overseas"
        ? getOverseasBestFilteredItems(section.items).length
        : 0;
      return `
        <section class="join-product-section layout-${section.key}" id="join-section-${section.key}" data-join-section="${section.key}" aria-label="${section.title}">
          <div class="join-product-section-head">
            <div class="join-product-section-copy">
              <div class="join-product-section-title">${section.title}<div class="join-product-section-icon ${section.key}" aria-hidden="true"></div></div>
              ${section.desc ? `<p class="join-product-section-desc">${section.desc}</p>` : ""}
            </div>
            ${section.key === "soon" ? `
              <button type="button" class="button secondary calendar-open-button join-section-calendar-button" onclick="openCalendarSheet()">
                <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <div class="calendar-label-full">조인일정 캘린더로 보기</div>
                <div class="calendar-label-short">캘린더</div>
              </button>
            ` : ""}
            ${section.key === "quick" && section.items.length > 1 ? `
              <div class="join-section-controls" aria-label="마감임박 대표 상품 이동">
                <button type="button" class="join-section-control prev" onclick="changeQuickFeatured(-1)" aria-label="이전 마감임박 상품">${renderJoinSectionControlIcon()}</button>
                <button type="button" class="join-section-control next" onclick="changeQuickFeatured(1)" aria-label="다음 마감임박 상품">${renderJoinSectionControlIcon()}</button>
              </div>
            ` : ""}
            ${renderBestJoinControls(section, displayItems.length)}
          </div>
          ${section.key === "soon" ? renderSoonRangeTabs(section.items) : ""}
          ${displayItems.length ? `
            <div class="join-grid"${section.key === "quick" ? ` onscroll="updateQuickSectionControls()"` : isBestJoinSectionKey(section.key) ? ` onscroll="updateBestSectionControls('${section.key}')"` : ""}>
              ${displayItems.map((join, index) => renderJoinCard(join, getJoinCardOptions(section, join, index))).join("")}
            </div>
          ` : (section.key === "overseas" ? renderOverseasBestEmptyState() : "")}
          ${isBestJoinSectionKey(section.key) && displayItems.length ? renderSlideDots(section.key) : ""}
          ${section.key === "soon" ? renderSoonMoreButton(displayItems.length, soonTotalItems.length) : ""}
          ${section.key === "overseas" ? renderOverseasBestMoreButton(displayItems.length, overseasTotalCount) : ""}
        </section>
      `;
    }

    function renderOverseasBestSectionInPlace() {
      const current = document.getElementById("join-section-overseas");
      const section = getHomeJoinSections().find((item) => item.key === "overseas");
      if (!current || !section) {
        renderJoins({ skipQuickMobileCarousel: true });
        return;
      }
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderJoinProductSection(section).trim();
      const next = wrapper.firstElementChild;
      if (!next) return;
      current.replaceWith(next);
      applyGolfJoinImageFallbacks(next);
      requestAnimationFrame(() => {
        updateBestSectionControls("overseas");
        updateJoinSectionNavActive();
      });
    }

    function renderMyJoinSectionInPlace() {
      const host = document.getElementById("joinMyHomeSection");
      if (!host) return;
      const html = renderMyHomeJoinSection();
      host.innerHTML = html;
      host.hidden = !html;
      lastRenderedMyJoinSectionHtml = html;
      applyGolfJoinImageFallbacks(host);
      updateJoinSectionNavVisibility(getHomeJoinSections(), Boolean(document.getElementById("joinMdPickSection")?.innerHTML));
      requestAnimationFrame(() => {
        updateBestSectionControls("my");
        updateJoinSectionNavActive();
        scheduleHomeSlideDotsRefresh();
      });
    }


    function getOverseasBestItems(sortedItems) {
      const overseasItems = sortedItems.filter(isOverseasJoin);
      const builderApplicationItems = overseasItems
        .filter((join) => join.isBuilderApplicationJoin)
        .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
      const regularItems = overseasItems.filter((join) => !join.isBuilderApplicationJoin);
      return [...builderApplicationItems, ...regularItems];
    }

    function getMyHomeJoinItems() {
      // Anonymous visitors cannot own or join a member schedule. Avoid walking
      // every schedule and participant identity only to produce an empty list.
      if (!getJoinWishMemberKey()) return [];
      return sortByDeparture(joins)
        .filter(isUserCreatedJoinSchedule)
        .filter((join) => getJoinDaysFromToday(join) >= 0)
        .filter(isMyHomeJoinSchedule);
    }

    function getQuickDeadlineItems(sortedItems) {
      return sortedItems
        .filter((join) => Number(join.emptySlots) === 1 || join.badgeKind === "justgo")
        .sort((a, b) => {
          const aLastSeat = Number(a.emptySlots) === 1 ? 0 : 1;
          const bLastSeat = Number(b.emptySlots) === 1 ? 0 : 1;
          if (aLastSeat !== bLastSeat) return aLastSeat - bLastSeat;
          const aJustGo = a.badgeKind === "justgo" ? 0 : 1;
          const bJustGo = b.badgeKind === "justgo" ? 0 : 1;
          if (aJustGo !== bJustGo) return aJustGo - bJustGo;
          return parseJoinDate(a.departureDate) - parseJoinDate(b.departureDate);
        });
    }

    function getHomeJoinSections() {
      const currentMemberKey = getJoinWishMemberKey();
      const upcomingScheduleItems = sortByDeparture(joins)
        .filter(isUserCreatedJoinSchedule)
        .filter((join) => getJoinDaysFromToday(join) >= 0);
      // Own/overlapping-schedule exclusion only has meaning for a signed-in
      // member. The anonymous path used to repeat the full identity scan for
      // every card even though it could never exclude anything.
      const scheduleItems = currentMemberKey
        ? upcomingScheduleItems.filter(isHomeJoinScheduleVisibleForCurrentMember)
        : upcomingScheduleItems;
      const homeSectionItems = scheduleItems
        .filter(shouldDisplayJoinProduct)
        .filter(isSoonCandidate);
      const customThemes = getCustomJoinThemes(homeSectionItems);
      return [
        {
          key: "quick",
          title: "마감임박",
          desc: "마지막 한 자리, 지금 합류하세요",
          items: getQuickDeadlineItems(homeSectionItems)
        },
        {
          key: "soon",
          title: "곧 출발해요!",
          desc: "출발임박! 서둘러 확인하세요",
          items: homeSectionItems
        },
        {
          key: "custom",
          title: "맞춤형 조인",
          desc: "비슷한 눈높이로 부담없이",
          themes: customThemes,
          items: customThemes.flatMap((theme) => theme.items)
        },
        {
          key: "overseas",
          title: "해외조인 BEST",
          desc: "검증된 해외골프 추천여행",
          items: getOverseasBestItems(scheduleItems)
        }
      ].filter((section) => section.items.length > 0);
    }

    function hasActiveJoinScheduleItems(sections = []) {
      return sections.some((section) => (section.items || []).some((join) => {
        if (!join) return false;
        if (join.isBuilderApplicationJoin || join.scheduleId || join.sourceApplicationId) return true;
        return (join.participants || []).some((participant) => participant?.status === "confirmed");
      }));
    }

    let lastRenderedMdPickSectionHtml = null;
    let lastRenderedMyJoinSectionHtml = null;
    let lastRenderedJoinSectionListHtml = null;
    let lastRenderedLegacyJoinGridHtml = null;
    let quickMobileCarouselSetupPending = false;
    let homeRenderScheduled = false;
    let homeRenderPendingOptions = {};
    let homeRenderDeferredUntilModalClose = false;
    let homeMdPickRenderScheduled = false;

    function isHomeRenderBlockingInteractionActive() {
      return [...joinReadLoadingOwners.keys()].some((ownerKey) => (
        String(ownerKey).startsWith("mdpick-availability:")
      ));
    }

    function isHomeRenderBlockedByModalOrInteraction() {
      return Boolean(
        isHomeRenderBlockingInteractionActive()
        || document.getElementById("detailModal")?.classList.contains("open")
        || document.getElementById("builderModal")?.classList.contains("open")
        || document.getElementById("regionSearchModal")?.classList.contains("open")
      );
    }

    function flushDeferredHomeRenderIfReady() {
      if (!homeRenderDeferredUntilModalClose || isHomeRenderBlockedByModalOrInteraction()) return false;
      homeRenderDeferredUntilModalClose = false;
      scheduleHomeRender();
      return true;
    }

    function scheduleHomeRender(options = {}) {
      homeRenderPendingOptions = {
        ...homeRenderPendingOptions,
        ...options,
        skipQuickMobileCarousel: Boolean(
          homeRenderPendingOptions.skipQuickMobileCarousel
          || options.skipQuickMobileCarousel
        ),
        deferWhileModalOpen: Boolean(
          homeRenderPendingOptions.deferWhileModalOpen
          || options.deferWhileModalOpen
        )
      };
      if (homeRenderScheduled) return;
      homeRenderScheduled = true;
      window.setTimeout(() => {
        const run = () => {
          const pendingOptions = homeRenderPendingOptions;
          if (
            pendingOptions.deferWhileModalOpen
            && isHomeRenderBlockedByModalOrInteraction()
          ) {
            homeRenderScheduled = false;
            homeRenderDeferredUntilModalClose = true;
            return;
          }
          homeRenderPendingOptions = {};
          homeRenderScheduled = false;
          try {
            renderJoins(pendingOptions);
          } catch (error) {
            golfJoinSafeWarn("Failed to render the deferred golf join home.", error);
          }
        };
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(run, { timeout: 700 });
        } else {
          requestAnimationFrame(run);
        }
      }, 0);
    }

    function renderMdPickSectionOnly() {
      if (shouldShowHomeInitialLoading()) return false;
      const mdPickSection = document.getElementById("joinMdPickSection");
      if (!mdPickSection) return false;
      const mdPickDataReady = golfJoinPerformanceOnceMarks.has("golfjoin:mdpick:data-ready");
      const primaryRenderMarked = mdPickDataReady
        ? markGolfJoinPerformanceOnce("golfjoin:mdpick:primary-render-start")
        : false;
      const mdPickSectionHtml = renderMdPickSection({ deferTheme: true });
      const changed = lastRenderedMdPickSectionHtml !== mdPickSectionHtml;
      if (changed) {
        mdPickSection.innerHTML = mdPickSectionHtml;
        lastRenderedMdPickSectionHtml = mdPickSectionHtml;
        applyGolfJoinImageFallbacks(mdPickSection);
      }
      const primaryDomMarked = primaryRenderMarked
        ? markGolfJoinPerformanceOnce(
          "golfjoin:mdpick:primary-dom-ready",
          "golfjoin:duration:mdpick-primary-render",
          "golfjoin:mdpick:primary-render-start"
        )
        : false;
      if (primaryDomMarked) {
        measureGolfJoinPerformance(
          "golfjoin:duration:mdpick-data-to-dom",
          "golfjoin:mdpick:data-ready",
          "golfjoin:mdpick:primary-dom-ready"
        );
      }
      updateMdPickSectionNavVisibility(Boolean(mdPickSectionHtml));
      if (changed) {
        scheduleHomeSlideDotsRefresh();
        startMdPickThemeAutoSlide();
      }
      if (mdPickDataReady) observeGolfJoinMdPickFirstImageReady(mdPickSection);
      observeMdPickThemeSection();
      scheduleJoinSectionNavActiveUpdate();
      return true;
    }

    function scheduleMdPickSectionRender() {
      if (homeMdPickRenderScheduled) return;
      homeMdPickRenderScheduled = true;
      const run = () => {
        homeMdPickRenderScheduled = false;
        try {
          renderMdPickSectionOnly();
        } catch (error) {
          golfJoinSafeWarn("Failed to render the deferred MD PICK section.", error);
        }
      };
      requestAnimationFrame(run);
    }

    function renderJoins(options = {}) {
      syncActiveJoinMySchedulesMemberScope();
      syncMyHomeJoinMemberScope();
      const sections = getHomeJoinSections();
      const hasActiveJoinSchedules = hasActiveJoinScheduleItems(sections);
      const isLoading = isJoinProductCardsLoading();
      const quickSection = sections.find((section) => section.key === "quick");
      if (quickSection && quickSectionFeaturedIndex >= quickSection.items.length) {
        quickSectionFeaturedIndex = 0;
      }
      const sectionList = document.getElementById("joinSectionList");
      const myJoinSection = document.getElementById("joinMyHomeSection");
      const mdPickSection = document.getElementById("joinMdPickSection");
      const activeSectionHead = document.getElementById("joinActiveSectionHead");
      const legacyGrid = document.getElementById("joinGrid");
      if (shouldShowHomeInitialLoading()) {
        if (activeSectionHead) activeSectionHead.hidden = true;
        if (myJoinSection) {
          myJoinSection.innerHTML = "";
          myJoinSection.hidden = true;
        }
        if (mdPickSection) mdPickSection.innerHTML = renderMdPickLoadingSection();
        if (sectionList) {
          sectionList.classList.remove("is-loading-products");
          sectionList.innerHTML = "";
        }
        lastRenderedMdPickSectionHtml = null;
        lastRenderedMyJoinSectionHtml = null;
        lastRenderedJoinSectionListHtml = null;
        lastRenderedLegacyJoinGridHtml = null;
        quickMobileCarouselSetupPending = false;
        updateJoinSectionNavVisibility([], true);
        scheduleJoinSectionNavActiveUpdate();
        return;
      }
      const deferMdPick = options.deferMdPick !== false;
      const mdPickSectionHtml = deferMdPick ? null : renderMdPickSection();
      const myJoinSectionHtml = renderMyHomeJoinSection();
      let mdPickSectionChanged = false;
      let myJoinSectionChanged = false;
      if (myJoinSection) myJoinSection.hidden = !myJoinSectionHtml;
      if (myJoinSection && lastRenderedMyJoinSectionHtml !== myJoinSectionHtml) {
        myJoinSection.innerHTML = myJoinSectionHtml;
        lastRenderedMyJoinSectionHtml = myJoinSectionHtml;
        myJoinSectionChanged = true;
      }
      if (!deferMdPick && mdPickSection) {
        if (lastRenderedMdPickSectionHtml !== mdPickSectionHtml) {
          mdPickSection.innerHTML = mdPickSectionHtml;
          lastRenderedMdPickSectionHtml = mdPickSectionHtml;
          mdPickSectionChanged = true;
        }
      }
      let joinSectionListChanged = false;
      let legacyJoinGridChanged = false;
      if (sectionList) {
        if (activeSectionHead) activeSectionHead.hidden = !hasActiveJoinSchedules;
        sectionList.classList.toggle("is-loading-products", isLoading);
        const sectionListHtml = sections.length
          ? sections.map(renderJoinProductSection).join("")
          : (isLoading ? renderJoinLoadingSection() : "");
        if (lastRenderedJoinSectionListHtml !== sectionListHtml) {
          sectionList.innerHTML = sectionListHtml;
          lastRenderedJoinSectionListHtml = sectionListHtml;
          joinSectionListChanged = true;
        }
      } else if (legacyGrid) {
        const filtered = sortJoins(getVisibleJoinProducts()
          .filter(matchesPeriod)
          .filter(isUserCreatedJoinSchedule)
          .filter(isHomeJoinScheduleVisibleForCurrentMember));
        legacyGrid.classList.toggle("is-loading-products", isLoading);
        const legacyGridHtml = filtered.map(renderJoinCard).join("");
        if (lastRenderedLegacyJoinGridHtml !== legacyGridHtml) {
          legacyGrid.innerHTML = legacyGridHtml;
          lastRenderedLegacyJoinGridHtml = legacyGridHtml;
          legacyJoinGridChanged = true;
        }
      }
      if (mdPickSectionChanged && mdPickSection) {
        applyGolfJoinImageFallbacks(mdPickSection);
      }
      if (myJoinSectionChanged && myJoinSection) {
        applyGolfJoinImageFallbacks(myJoinSection);
      }
      if (joinSectionListChanged && sectionList) {
        applyGolfJoinImageFallbacks(sectionList);
      }
      if (legacyJoinGridChanged && legacyGrid) {
        applyGolfJoinImageFallbacks(legacyGrid);
      }
      const hasMdPickSection = deferMdPick
        ? hasRenderedJoinSectionContent("mdpick")
        : Boolean(mdPickSectionHtml);
      updateJoinSectionNavVisibility(sections, hasMdPickSection);
      if (joinSectionListChanged) quickMobileCarouselSetupPending = true;
      if (quickMobileCarouselSetupPending && !options.skipQuickMobileCarousel) {
        setupQuickMobileCarousel();
        quickMobileCarouselSetupPending = false;
      }
      if (joinSectionListChanged) {
        setupCustomThemeRailScrollSync();
        ensureJoinReservationCountdownTimer();
      }
      if (myJoinSectionChanged || mdPickSectionChanged || joinSectionListChanged) scheduleHomeSlideDotsRefresh();
      if (mdPickSectionChanged) startMdPickThemeAutoSlide();
      if (deferMdPick) scheduleMdPickSectionRender();
      scheduleJoinSectionNavActiveUpdate();
    }

    function renderHomeInitialLoading() {
      if (!shouldShowHomeInitialLoading()) {
        renderJoins();
        return;
      }
      const sectionList = document.getElementById("joinSectionList");
      const myJoinSection = document.getElementById("joinMyHomeSection");
      const mdPickSection = document.getElementById("joinMdPickSection");
      if (myJoinSection) {
        myJoinSection.innerHTML = "";
        myJoinSection.hidden = true;
      }
      const activeSectionHead = document.getElementById("joinActiveSectionHead");
      if (mdPickSection) mdPickSection.innerHTML = renderMdPickLoadingSection();
      if (activeSectionHead) activeSectionHead.hidden = true;
      if (sectionList) {
        sectionList.classList.remove("is-loading-products");
        sectionList.innerHTML = "";
      }
      lastRenderedMdPickSectionHtml = null;
      lastRenderedMyJoinSectionHtml = null;
      lastRenderedJoinSectionListHtml = null;
      lastRenderedLegacyJoinGridHtml = null;
      quickMobileCarouselSetupPending = false;
      updateJoinSectionNavVisibility([], true);
    }

    function stopQuickMobileCarousel() {
      clearInterval(quickMobileCarouselTimer);
      quickMobileCarouselTimer = null;
      clearTimeout(quickMobileCarouselScrollTimer);
      quickMobileCarouselScrollTimer = null;
      quickMobileCarouselSuppressAlign = false;
      quickMobileCarouselTargetLeft = null;
      quickMobileCarouselTouching = false;
    }

    function getQuickMobileCarouselGrid() {
      if (!window.matchMedia("(max-width: 640px)").matches) return null;
      return document.querySelector("#join-section-quick .join-grid");
    }

    function getQuickMobileCarouselPositions(grid) {
      return Array.from(grid.querySelectorAll(".join-card:not([data-quick-carousel-clone='true'])")).map((card) => card.offsetLeft - grid.offsetLeft);
    }

    function getNearestQuickMobileCarouselIndex(grid, positions) {
      return positions.reduce((nearest, position, index) => (
        Math.abs(position - grid.scrollLeft) < Math.abs(positions[nearest] - grid.scrollLeft) ? index : nearest
      ), 0);
    }

    function alignQuickMobileCarousel(grid, behavior = "smooth") {
      const positions = getQuickMobileCarouselPositions(grid);
      if (!positions.length) return;
      const nearest = getNearestQuickMobileCarouselIndex(grid, positions);
      grid.scrollTo({ left: positions[nearest], behavior });
    }

    function startQuickMobileCarouselTimer() {
      clearInterval(quickMobileCarouselTimer);
      quickMobileCarouselTimer = null;
      if (quickMobileCarouselTouching) return;
      quickMobileCarouselTimer = setInterval(advanceQuickMobileCarousel, 5000);
    }

    function settleQuickMobileCarouselScroll(grid) {
      if (!grid || quickMobileCarouselTargetLeft === null) return;
      if (Math.abs(grid.scrollLeft - quickMobileCarouselTargetLeft) > 1) {
        grid.scrollTo({ left: quickMobileCarouselTargetLeft, behavior: "auto" });
      }
      quickMobileCarouselTargetLeft = null;
      quickMobileCarouselSuppressAlign = false;
      clearTimeout(quickMobileCarouselScrollTimer);
      quickMobileCarouselScrollTimer = null;
    }

    function advanceQuickMobileCarousel() {
      if (quickMobileCarouselTouching) return;
      const grid = getQuickMobileCarouselGrid();
      if (!grid) {
        stopQuickMobileCarousel();
        return;
      }
      const positions = getQuickMobileCarouselPositions(grid);
      if (positions.length < 2) return;
      let current = getNearestQuickMobileCarouselIndex(grid, positions);
      const next = current >= positions.length - 1 ? 0 : current + 1;
      quickMobileCarouselSuppressAlign = true;
      quickMobileCarouselTargetLeft = positions[next];
      grid.scrollTo({ left: positions[next], behavior: "smooth" });
      window.setTimeout(() => {
        quickMobileCarouselTargetLeft = null;
        quickMobileCarouselSuppressAlign = false;
      }, 700);
    }

    function setupQuickMobileCarousel() {
      stopQuickMobileCarousel();
      const grid = getQuickMobileCarouselGrid();
      if (!grid) return;
      grid.querySelectorAll(".join-card[data-quick-carousel-clone='true']").forEach((clone) => clone.remove());
      const realCards = Array.from(grid.querySelectorAll(".join-card:not([data-quick-carousel-clone='true'])"));
      if (realCards.length <= 1) return;
      if (realCards.length > 1 && Math.abs(realCards[1].offsetTop - realCards[0].offsetTop) > 4) return;
      if (grid.dataset.quickCarouselBound !== "true") {
        grid.dataset.quickCarouselBound = "true";
        grid.addEventListener("touchstart", () => {
          quickMobileCarouselTouching = true;
          settleQuickMobileCarouselScroll(grid);
          clearInterval(quickMobileCarouselTimer);
          quickMobileCarouselTimer = null;
        }, { passive: true });
        grid.addEventListener("touchend", () => {
          quickMobileCarouselTouching = false;
          startQuickMobileCarouselTimer();
        }, { passive: true });
        grid.addEventListener("touchcancel", () => {
          quickMobileCarouselTouching = false;
          startQuickMobileCarouselTimer();
        }, { passive: true });
        grid.addEventListener("scroll", () => {
          if (quickMobileCarouselSuppressAlign) return;
          clearTimeout(quickMobileCarouselScrollTimer);
          quickMobileCarouselScrollTimer = setTimeout(() => {
            alignQuickMobileCarousel(grid);
          }, 140);
        }, { passive: true });
      }
      startQuickMobileCarouselTimer();
    }

    function hasOpenModalOrSheet() {
      return Boolean(document.querySelector(
        ".overlay.open, .calendar-sheet-overlay.open, .global-apply-overlay.open, #participantModal.open, #detailApplyPanel.open"
      ));
    }

    function resumeQuickMobileCarouselIfIdle() {
      if (hasOpenModalOrSheet()) return;
      setupQuickMobileCarousel();
    }

    function hasRenderedJoinSectionContent(key) {
      const section = document.getElementById(`join-section-${key}`);
      if (!section || section.hidden) return false;
      if (key === "mdpick-theme") {
        return Boolean(section.querySelector(".join-mdpick-theme-card"));
      }
      if (key === "mdpick") {
        return Boolean(section.querySelector(".join-mdpick-card, .join-mdpick-theme-card"));
      }
      if (key === "my") {
        return Boolean(section.querySelector(".join-my-home-panel .join-card"));
      }
      if (key === "custom") {
        return Boolean(section.querySelector(".join-custom-theme-card, .join-card"));
      }
      return Boolean(section.querySelector(".join-card, .join-soon-compact-card"));
    }

    function updateJoinSectionNavVisibility(sections, hasMdPickSection = false) {
      const visibleKeys = new Set(sections.map((section) => section.key));
      if (hasRenderedJoinSectionContent("my")) visibleKeys.add("my");
      if (hasMdPickSection) {
        visibleKeys.add("mdpick");
        visibleKeys.add("mdpick-theme");
      }
      const buttons = Array.from(document.querySelectorAll("#joinSectionNav [data-join-section-target]"));
      buttons.forEach((button) => {
        const key = button.dataset.joinSectionTarget;
        const shouldHide = !visibleKeys.has(key) || !hasRenderedJoinSectionContent(key);
        button.hidden = shouldHide;
        button.style.display = shouldHide ? "none" : "";
      });
      const hasVisibleButton = buttons.some((button) => !button.hidden);
      const nav = document.getElementById("joinSectionNav");
      const slot = document.getElementById("joinSectionNavSlot");
      if (nav) {
        nav.hidden = !hasVisibleButton;
        nav.style.display = hasVisibleButton ? "" : "none";
      }
      if (slot) {
        slot.hidden = !hasVisibleButton;
        slot.style.display = hasVisibleButton ? "" : "none";
      }
      scheduleJoinSectionNavActiveUpdate();
    }

    function updateMdPickSectionNavVisibility(hasMdPickSection = false) {
      const buttons = Array.from(document.querySelectorAll(
        "#joinSectionNav [data-join-section-target='mdpick'], #joinSectionNav [data-join-section-target='mdpick-theme']"
      ));
      buttons.forEach((button) => {
        const key = button.dataset.joinSectionTarget;
        const shouldHide = !hasMdPickSection || !hasRenderedJoinSectionContent(key);
        button.hidden = shouldHide;
        button.style.display = shouldHide ? "none" : "";
      });
      const allButtons = Array.from(document.querySelectorAll("#joinSectionNav [data-join-section-target]"));
      const hasVisibleButton = allButtons.some((button) => !button.hidden && button.style.display !== "none");
      const nav = document.getElementById("joinSectionNav");
      const slot = document.getElementById("joinSectionNavSlot");
      if (nav) {
        nav.hidden = !hasVisibleButton;
        nav.style.display = hasVisibleButton ? "" : "none";
      }
      if (slot) {
        slot.hidden = !hasVisibleButton;
        slot.style.display = hasVisibleButton ? "" : "none";
      }
      scheduleJoinSectionNavActiveUpdate();
    }

    function keepJoinSectionNavButtonInView(button) {
      const nav = document.getElementById("joinSectionNav");
      if (!nav || !button || window.innerWidth > 640) return;
      const padding = 12;
      const visibleStart = nav.scrollLeft;
      const visibleEnd = visibleStart + nav.clientWidth;
      const prevButton = button.previousElementSibling?.matches("[data-join-section-target]:not([hidden])")
        ? button.previousElementSibling
        : null;
      const nextButton = button.nextElementSibling?.matches("[data-join-section-target]:not([hidden])")
        ? button.nextElementSibling
        : null;
      if (!prevButton) {
        if (nav.scrollLeft > 0) nav.scrollTo({ left: 0, behavior: "auto" });
        return;
      }
      const targetStartButton = prevButton || button;
      const targetEndButton = nextButton || button;
      const buttonStart = targetStartButton.offsetLeft;
      const buttonEnd = targetEndButton.offsetLeft + targetEndButton.offsetWidth;
      if (buttonStart < visibleStart + padding) {
        nav.scrollTo({ left: Math.max(0, buttonStart - padding), behavior: "smooth" });
      } else if (buttonEnd > visibleEnd - padding) {
        nav.scrollTo({ left: buttonEnd - nav.clientWidth + padding, behavior: "smooth" });
      }
    }

    function setJoinSectionNavActive(key) {
      const currentButton = document.querySelector(`#joinSectionNav [data-join-section-target="${key}"]`);
      if (
        joinSectionNavActiveKey === key
        && currentButton?.classList.contains("active")
        && currentButton.getAttribute("aria-current") === "true"
      ) return;
      document.querySelectorAll("#joinSectionNav [data-join-section-target]").forEach((button) => {
        const active = button.dataset.joinSectionTarget === key;
        button.classList.toggle("active", active);
        button.setAttribute("aria-current", active ? "true" : "false");
        if (active) keepJoinSectionNavButtonInView(button);
      });
      joinSectionNavActiveKey = key;
    }

    function resetJoinSectionNavToStart() {
      const nav = document.getElementById("joinSectionNav");
      if (!nav || window.innerWidth > 640) return;
      nav.scrollTo({ left: 0, behavior: "auto" });
    }

    function getJoinSectionNavScrollOffset(nav) {
      const root = document.getElementById("secret-golf-join") || document.documentElement;
      const mobileHeaderOffset = Number.parseFloat(getComputedStyle(root).getPropertyValue("--mobile-home-header-height")) || 0;
      const pcHeaderOffset = Number.parseFloat(getComputedStyle(root).getPropertyValue("--join-pc-header-zone-offset")) || 187;
      const navHeight = nav?.offsetHeight || 0;
      if (window.innerWidth > 640) return pcHeaderOffset + navHeight + 32;
      return mobileHeaderOffset + navHeight + 12;
    }

    function scrollHomeJoinSection(key) {
      const section = document.getElementById(`join-section-${key}`);
      if (!section) return;
      const nav = document.getElementById("joinSectionNav");
      const offset = getJoinSectionNavScrollOffset(nav);
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      const targetY = Math.max(0, top);
      joinSectionNavLockedKey = key;
      joinSectionNavLockedTargetY = targetY;
      clearTimeout(joinSectionNavUnlockTimer);
      joinSectionNavUnlockTimer = setTimeout(() => {
        if (joinSectionNavLockedKey !== key) return;
        joinSectionNavLockedKey = "";
        joinSectionNavLockedTargetY = null;
        setJoinSectionNavActive(key);
      }, 1400);
      window.scrollTo({ top: targetY, behavior: "smooth" });
      setJoinSectionNavActive(key);
    }

    function updateJoinSectionNavFixed() {
      const nav = document.getElementById("joinSectionNav");
      const list = document.getElementById("joinSectionList");
      const slot = document.getElementById("joinSectionNavSlot") || nav?.parentElement;
      const container = slot?.parentElement;
      if (!nav || !list || !slot || !container) return;
      if (window.innerWidth > 640) {
        nav.classList.remove("is-fixed");
        slot.classList.remove("is-nav-fixed");
        list.classList.remove("is-nav-fixed");
        joinSectionNavLastScrollY = window.scrollY || 0;
        return;
      }
      const currentScrollY = window.scrollY || 0;
      const scrollDelta = currentScrollY - joinSectionNavLastScrollY;
      const scrollingDown = scrollDelta > 1;
      const scrollingUp = scrollDelta < -1;
      const containerRect = container.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const navHeight = nav.offsetHeight;
      const headerOffset = Number.parseFloat(getComputedStyle(document.getElementById("secret-golf-join") || document.documentElement).getPropertyValue("--mobile-home-header-height")) || 55;
      const firstSectionTitle = document.querySelector("#join-section-my .join-product-section-title, #join-section-mdpick .join-product-section-title");
      const firstSectionTitleTop = firstSectionTitle?.getBoundingClientRect().top ?? Number.NEGATIVE_INFINITY;
      const isFixed = nav.classList.contains("is-fixed");
      const compactNavHeight = isFixed ? navHeight : 46;
      const fixedReleaseLine = headerOffset + compactNavHeight + 74;
      const fixedAcquireLine = headerOffset + compactNavHeight + 54;
      const hasFixedRoom = containerRect.bottom > headerOffset + navHeight + 16;
      const shouldFix = isFixed
        ? hasFixedRoom && !(scrollingUp && firstSectionTitleTop > fixedReleaseLine)
        : scrollingDown && navRect.top <= headerOffset && firstSectionTitleTop <= fixedAcquireLine && hasFixedRoom;
      if (isFixed !== shouldFix) {
        nav.classList.toggle("is-fixed", shouldFix);
        slot.classList.toggle("is-nav-fixed", shouldFix);
        list.classList.toggle("is-nav-fixed", shouldFix);
      }
      joinSectionNavLastScrollY = currentScrollY;
    }

    function updateJoinSectionNavActive() {
      const sections = Array.from(document.querySelectorAll("[data-join-section]"))
        .filter((section) => {
          const key = section.dataset.joinSection;
          const button = document.querySelector(`#joinSectionNav [data-join-section-target="${key}"]`);
          return !section.hidden && !button?.hidden;
        });
      const currentScrollY = window.scrollY || 0;
      if (!joinSectionNavLockedKey && currentScrollY <= 1 && sections.length) {
        const topKey = sections[0].dataset.joinSection;
        const nav = document.getElementById("joinSectionNav");
        const list = document.getElementById("joinSectionList");
        const slot = document.getElementById("joinSectionNavSlot") || nav?.parentElement;
        nav?.classList.remove("is-fixed");
        slot?.classList.remove("is-nav-fixed");
        list?.classList.remove("is-nav-fixed");
        joinSectionNavLastScrollY = currentScrollY;
        const topButton = document.querySelector(`#joinSectionNav [data-join-section-target="${topKey}"]`);
        if (topButton?.classList.contains("active") && topButton.getAttribute("aria-current") === "true") {
          joinSectionNavActiveKey = topKey;
        } else {
          setJoinSectionNavActive(topKey);
        }
        if (topKey === "mdpick") resetJoinSectionNavToStart();
        return;
      }
      updateJoinSectionNavFixed();
      if (!sections.length) return;
      const nav = document.getElementById("joinSectionNav");
      if (joinSectionNavLockedKey) {
        const targetButton = document.querySelector(`#joinSectionNav [data-join-section-target="${joinSectionNavLockedKey}"]`);
        const targetExists = Boolean(document.getElementById(`join-section-${joinSectionNavLockedKey}`)) && !targetButton?.hidden;
        if (!targetExists) {
          joinSectionNavLockedKey = "";
          joinSectionNavLockedTargetY = null;
          clearTimeout(joinSectionNavUnlockTimer);
        } else {
          setJoinSectionNavActive(joinSectionNavLockedKey);
          if (
            Number.isFinite(Number(joinSectionNavLockedTargetY))
            && Math.abs((window.scrollY || 0) - Number(joinSectionNavLockedTargetY)) <= 6
          ) {
            const completedKey = joinSectionNavLockedKey;
            clearTimeout(joinSectionNavUnlockTimer);
            joinSectionNavUnlockTimer = setTimeout(() => {
              if (joinSectionNavLockedKey !== completedKey) return;
              joinSectionNavLockedKey = "";
              joinSectionNavLockedTargetY = null;
              setJoinSectionNavActive(completedKey);
            }, 120);
          }
          return;
        }
      }
      const headerOffset = Number.parseFloat(getComputedStyle(document.getElementById("secret-golf-join") || document.documentElement).getPropertyValue("--mobile-home-header-height")) || 55;
      const offset = window.innerWidth > 640
        ? getJoinSectionNavScrollOffset(nav)
        : headerOffset + (nav?.offsetHeight || 0) + 24;
      const activationLine = offset + 8;
      let activeKey = sections[0].dataset.joinSection;
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= activationLine) {
          activeKey = section.dataset.joinSection;
        }
      });
      const documentHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      if ((window.scrollY || 0) + window.innerHeight >= documentHeight - 4) {
        activeKey = sections[sections.length - 1].dataset.joinSection;
      }
      const mdPickSection = document.getElementById("join-section-mdpick");
      const firstContentSection = sections.find((section) => !["mdpick", "mdpick-theme"].includes(section.dataset.joinSection));
      if (activeKey === "mdpick" && mdPickSection && (!firstContentSection || firstContentSection.getBoundingClientRect().top > activationLine)) {
        activeKey = "mdpick";
        resetJoinSectionNavToStart();
      }
      setJoinSectionNavActive(activeKey);
    }

    function scheduleJoinSectionNavActiveUpdate() {
      if (joinSectionNavScrollFrame) return;
      joinSectionNavScrollFrame = requestAnimationFrame(() => {
        joinSectionNavScrollFrame = 0;
        updateJoinSectionNavActive();
      });
    }

