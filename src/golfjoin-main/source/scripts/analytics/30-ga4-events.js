    // Golfjoin analytics is isolated from the existing Secret Tour property.
    // Only product and interaction metadata may be sent. Never add member IDs,
    // names, contact details, authentication values, birthdays, or form values.
    const GOLFJOIN_GA4_MEASUREMENT_ID = "G-LLY6DLP23E";
    const GOLFJOIN_GA4_PROPERTY_ID = "552152254";
    const GOLFJOIN_GA4_GROUP = "golfjoin";
    const GOLFJOIN_GA4_EVENT_ALIASES = Object.freeze({
      golfjoin_detail_view: "view_item",
      golfjoin_wish_add: "add_to_wishlist",
      golfjoin_apply_start: "begin_checkout",
      golfjoin_apply_complete: "generate_lead",
      golfjoin_create_complete: "generate_lead"
    });
    const GOLFJOIN_GA4_FLOW_TYPES = Object.freeze({
      golfjoin_apply_start: "join_apply",
      golfjoin_apply_complete: "join_apply",
      golfjoin_create_start: "new_schedule",
      golfjoin_create_complete: "new_schedule"
    });
    const GOLFJOIN_GA4_ALLOWED_PARAMETERS = new Set([
      "apply_step",
      "builder_step",
      "error_type",
      "filter_type",
      "filter_value",
      "flow_type",
      "item_category",
      "item_id",
      "item_list_id",
      "item_list_name",
      "item_name",
      "item_type",
      "login_method",
      "member_state",
      "method",
      "page_location",
      "page_path",
      "page_referrer",
      "page_title",
      "participant_count",
      "promotion_id",
      "promotion_name",
      "result_count_bucket",
      "return_action",
      "section_name",
      "signup_step",
      "source_area",
      "source_section"
    ]);
    const GOLFJOIN_GA4_ITEM_EVENTS = new Set([
      "add_to_wishlist",
      "begin_checkout",
      "generate_lead",
      "select_item",
      "view_item_list",
      "view_item"
    ]);
    const GOLFJOIN_GA4_HOME_DETAIL_CARD_SELECTOR = [
      ".join-card",
      ".join-soon-compact-card",
      ".join-mdpick-card",
      ".join-mdpick-theme-card"
    ].join(", ");
    const GOLFJOIN_GA4_SEARCH_RESULT_CARD_SELECTOR = "#regionSearchResults .region-product-card";
    const golfJoinGa4ObservedSections = new WeakSet();
    const golfJoinGa4ViewedSections = new Set();
    const golfJoinGa4TrackedOnceKeys = new Set();
    const GOLFJOIN_GA4_PAGE_VIEW_FALLBACK_MS = 30000;
    let golfJoinGa4Initialized = false;
    let golfJoinGa4PageViewSent = false;
    let golfJoinGa4MemberStateReady = false;
    let golfJoinGa4DomTrackingBound = false;
    let golfJoinGa4PageViewFallbackTimer = 0;
    let golfJoinGa4SectionObserver = null;
    let golfJoinGa4MutationObserver = null;
    let golfJoinGa4SectionScanTimer = 0;

    function isGolfJoinGa4DebugMode() {
      try {
        return new URLSearchParams(window.location.search || "").get("eventPlanSeq") === "29";
      } catch (error) {
        return false;
      }
    }

    function normalizeGolfJoinGa4String(value, maxLength = 100) {
      return String(value ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
    }

    function normalizeGolfJoinGa4Dimension(value, maxLength = 60) {
      return normalizeGolfJoinGa4String(value, maxLength)
        .toLowerCase()
        .replace(/[^a-z0-9_\-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
    }

    function sanitizeGolfJoinGa4Item(rawItem = {}, fallbackIndex = 0) {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return null;
      const item = {};
      const id = normalizeGolfJoinGa4String(rawItem.item_id, 100);
      const name = normalizeGolfJoinGa4String(rawItem.item_name, 120);
      const category = normalizeGolfJoinGa4String(rawItem.item_category, 100);
      const itemType = normalizeGolfJoinGa4Dimension(rawItem.item_type);
      const listId = normalizeGolfJoinGa4Dimension(rawItem.item_list_id, 100);
      const listName = normalizeGolfJoinGa4String(rawItem.item_list_name, 100);
      const numericIndex = Number(rawItem.index);
      if (id) item.item_id = id;
      if (name) item.item_name = name;
      if (category) item.item_category = category;
      if (itemType) item.item_type = itemType;
      if (listId) item.item_list_id = listId;
      if (listName) item.item_list_name = listName;
      item.index = Number.isFinite(numericIndex)
        ? Math.max(0, Math.min(199, Math.round(numericIndex)))
        : Math.max(0, Math.min(199, Math.round(Number(fallbackIndex) || 0)));
      return item.item_id || item.item_name ? item : null;
    }

    function sanitizeGolfJoinGa4Items(rawItems = []) {
      if (!Array.isArray(rawItems)) return [];
      return rawItems
        .slice(0, 50)
        .map((item, index) => sanitizeGolfJoinGa4Item(item, index))
        .filter(Boolean);
    }

    function getGolfJoinGa4MemberState() {
      try {
        const loginState = typeof getJoinLoginState === "function" ? getJoinLoginState() : null;
        if (loginState && !loginState.isLogin) return "guest";
        const member = loginState?.member
          || (typeof getJoinSessionMember === "function" ? getJoinSessionMember() : null);
        if (!member) return "guest";
        const channel = String(member.memberChannel || member.userChnCd || "").trim().toUpperCase();
        return channel === "KAKAO" ? "kakao" : "homepage";
      } catch (error) {
        return "guest";
      }
    }

    function ensureGolfJoinGtag() {
      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag !== "function") {
        window.gtag = function golfJoinGtag() {
          window.dataLayer.push(arguments);
        };
      }
      const selector = 'script[src*="googletagmanager.com/gtag/js"]';
      if (!document.querySelector(selector)) {
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOLFJOIN_GA4_MEASUREMENT_ID)}`;
        script.dataset.golfjoinGa4 = "true";
        document.head?.appendChild(script);
      }
      return window.gtag;
    }

    function sanitizeGolfJoinGa4Parameters(parameters = {}) {
      const safe = {};
      Object.entries(parameters || {}).forEach(([rawKey, value]) => {
        const key = String(rawKey || "").trim();
        if (key === "items") {
          const items = sanitizeGolfJoinGa4Items(value);
          if (items.length) safe.items = items;
          return;
        }
        if (!GOLFJOIN_GA4_ALLOWED_PARAMETERS.has(key)) return;
        if (value === undefined || value === null || value === "") return;
        if (key === "participant_count") {
          const count = Math.max(1, Math.min(20, Math.round(Number(value) || 1)));
          safe[key] = count;
          return;
        }
        if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return;
        if ([
          "apply_step", "builder_step", "error_type", "filter_type", "filter_value", "flow_type", "item_list_id", "item_type",
          "login_method", "member_state", "method", "result_count_bucket", "return_action",
          "section_name", "signup_step", "source_area", "source_section"
        ].includes(key)) {
          const normalized = normalizeGolfJoinGa4Dimension(value);
          if (normalized) safe[key] = normalized;
          return;
        }
        safe[key] = normalizeGolfJoinGa4String(value, key === "item_name" ? 120 : 200);
      });
      if (safe.source_section && !safe.source_area) safe.source_area = safe.source_section;
      if (safe.login_method && !safe.method) safe.method = safe.login_method;
      delete safe.source_section;
      delete safe.login_method;
      return safe;
    }

    function moveGolfJoinGa4ItemToItems(parameters = {}) {
      const item = {};
      ["item_id", "item_name", "item_category", "item_type"].forEach((key) => {
        if (!parameters[key]) return;
        item[key] = parameters[key];
        delete parameters[key];
      });
      if (item.item_id || item.item_name) parameters.items = [item];
      return parameters;
    }

    function initializeGolfJoinGa4() {
      if (golfJoinGa4Initialized) return true;
      try {
        const gtag = ensureGolfJoinGtag();
        gtag("config", GOLFJOIN_GA4_MEASUREMENT_ID, {
          groups: GOLFJOIN_GA4_GROUP,
          send_page_view: false
        });
        golfJoinGa4Initialized = true;
        return true;
      } catch (error) {
        return false;
      }
    }

    function trackGolfJoinGa4Event(eventName, parameters = {}) {
      try {
        if (!golfJoinGa4Initialized && !initializeGolfJoinGa4()) return false;
        const sourceEvent = normalizeGolfJoinGa4Dimension(eventName, 40);
        if (!sourceEvent) return false;
        const event = GOLFJOIN_GA4_EVENT_ALIASES[sourceEvent] || sourceEvent;
        const safeParameters = sanitizeGolfJoinGa4Parameters(parameters);
        if (GOLFJOIN_GA4_FLOW_TYPES[sourceEvent] && !safeParameters.flow_type) {
          safeParameters.flow_type = GOLFJOIN_GA4_FLOW_TYPES[sourceEvent];
        }
        if (GOLFJOIN_GA4_ITEM_EVENTS.has(event)) moveGolfJoinGa4ItemToItems(safeParameters);
        if (!safeParameters.member_state) safeParameters.member_state = getGolfJoinGa4MemberState();
        safeParameters.send_to = GOLFJOIN_GA4_GROUP;
        if (isGolfJoinGa4DebugMode()) safeParameters.debug_mode = true;
        window.gtag("event", event, safeParameters);
        return true;
      } catch (error) {
        // Analytics must never affect the booking flow.
        return false;
      }
    }

    function trackGolfJoinGa4EventOnce(eventKey, eventName, parameters = {}) {
      const key = normalizeGolfJoinGa4String(eventKey, 240);
      if (!key) return trackGolfJoinGa4Event(eventName, parameters);
      if (golfJoinGa4TrackedOnceKeys.has(key)) return false;
      const tracked = trackGolfJoinGa4Event(eventName, parameters);
      if (tracked) golfJoinGa4TrackedOnceKeys.add(key);
      return tracked;
    }

    function sendGolfJoinGa4PageView() {
      if (golfJoinGa4PageViewSent) return;
      golfJoinGa4PageViewSent = true;
      trackGolfJoinGa4Event("page_view", {
        page_location: window.location.href,
        page_path: `${window.location.pathname || ""}${window.location.search || ""}`,
        page_referrer: document.referrer || "",
        page_title: document.title || "골프조인",
        source_area: "golfjoin_home"
      });
    }

    function getGolfJoinGa4SectionName(element) {
      if (!element) return "";
      if (element.matches?.(".sgj-section.hero")) return "hero";
      if (element.id === "create") return "new_schedule";
      return normalizeGolfJoinGa4Dimension(element.dataset?.joinSection || element.id || "");
    }

    function getGolfJoinGa4CardText(card, selectors = []) {
      for (const selector of selectors) {
        const text = normalizeGolfJoinGa4String(card?.querySelector?.(selector)?.textContent || "", 120);
        if (text) return text;
      }
      return "";
    }

    function getGolfJoinGa4CardItem(card, index = 0, listId = "", listName = "") {
      if (!card) return null;
      const handler = String(card.getAttribute?.("onclick") || "");
      const handlerMatch = handler.match(/\b(?:openDetail|openMdPickProductDetail(?:FromRegion)?)\(\s*['"]([^'"]+)['"]/);
      const itemId = normalizeGolfJoinGa4String(card.dataset?.joinGa4ItemId || handlerMatch?.[1] || "", 100);
      const itemName = normalizeGolfJoinGa4String(
        card.dataset?.joinGa4ItemName
          || card.querySelector?.("img")?.alt
          || getGolfJoinGa4CardText(card, [
            ".join-title",
            ".join-soon-compact-title",
            ".join-mdpick-title",
            ".join-mdpick-theme-product",
            ".region-product-name"
          ]),
        120
      );
      const category = normalizeGolfJoinGa4String(
        card.dataset?.joinGa4ItemCategory
          || getGolfJoinGa4CardText(card, [
            ".join-mdpick-region",
            ".join-mdpick-theme-region",
            ".region-product-location",
            ".card-meta-text-location"
          ]),
        100
      );
      const isProduct = /^good-/i.test(itemId)
        || /openMdPickProductDetail/.test(handler)
        || Boolean(card.matches?.(".join-mdpick-card, .join-mdpick-theme-card"));
      return sanitizeGolfJoinGa4Item({
        item_id: itemId,
        item_name: itemName,
        item_category: category,
        item_type: isProduct ? "product" : "join_schedule",
        item_list_id: listId,
        item_list_name: listName,
        index
      }, index);
    }

    function isGolfJoinGa4CardVisible(card) {
      if (!card || card.matches?.(".join-card-skeleton, [data-quick-carousel-clone='true']")) return false;
      if (card.closest?.("[hidden], [aria-hidden='true']")) return false;
      const soonPanel = card.closest?.(".join-soon-panel");
      if (soonPanel && !soonPanel.classList?.contains("active")) return false;
      const themeGroup = card.closest?.("[data-mdpick-theme-group]");
      if (themeGroup && !themeGroup.classList?.contains("active")) return false;
      if (typeof window.getComputedStyle === "function") {
        const style = window.getComputedStyle(card);
        if (style?.display === "none" || style?.visibility === "hidden") return false;
      }
      return true;
    }

    function isGolfJoinGa4ElementInViewport(element) {
      if (!element?.getBoundingClientRect) return true;
      const rect = element.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return true;
      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
      const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
      return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
    }

    function getGolfJoinGa4ListName(section, sectionName) {
      return normalizeGolfJoinGa4String(
        section?.querySelector?.(".join-product-section-title, .join-mdpick-theme-title")?.textContent
          || section?.getAttribute?.("aria-label")
          || sectionName,
        100
      );
    }

    function trackGolfJoinGa4DomItemList(container, options = {}) {
      if (!container || !isGolfJoinGa4ElementInViewport(container)) return false;
      const listId = normalizeGolfJoinGa4Dimension(options.listId || "", 100);
      const listName = normalizeGolfJoinGa4String(options.listName || listId, 100);
      if (!listId) return false;
      const cards = Array.from(container.querySelectorAll?.(options.cardSelector || GOLFJOIN_GA4_HOME_DETAIL_CARD_SELECTOR) || [])
        .filter((card) => isGolfJoinGa4CardVisible(card) && (!options.cardFilter || options.cardFilter(card)));
      const items = cards
        .map((card, index) => getGolfJoinGa4CardItem(card, index, listId, listName))
        .filter(Boolean);
      if (!items.length) return false;
      const fingerprint = items.map((item) => item.item_id || item.item_name).join("|");
      return trackGolfJoinGa4EventOnce(`item-list:${listId}:${fingerprint}`, "view_item_list", {
        item_list_id: listId,
        item_list_name: listName,
        source_area: options.sourceArea || listId,
        items
      });
    }

    function trackGolfJoinGa4SectionItemList(section) {
      const sectionName = getGolfJoinGa4SectionName(section);
      if (!sectionName || !isGolfJoinGa4ElementInViewport(section)) return false;
      return trackGolfJoinGa4DomItemList(section, {
        listId: `home_${sectionName}`,
        listName: getGolfJoinGa4ListName(section, sectionName),
        sourceArea: sectionName,
        cardFilter(card) {
          return card.closest?.("[data-join-section]") === section;
        }
      });
    }

    function getGolfJoinGa4SearchListContext() {
      const shell = document.querySelector("#regionSearchModal .region-search-shell");
      if (shell?.classList?.contains("mdpick-context")) return "mdpick";
      if (shell?.classList?.contains("builder-context")) return "builder";
      return "main";
    }

    function trackGolfJoinGa4SearchResultList() {
      const modal = document.getElementById?.("regionSearchModal");
      const results = document.getElementById?.("regionSearchResults");
      if (!modal?.classList?.contains("open") || !results) return false;
      const context = getGolfJoinGa4SearchListContext();
      return trackGolfJoinGa4DomItemList(results, {
        listId: `destination_search_${context}`,
        listName: "여행지 검색 결과",
        sourceArea: "destination_search",
        cardSelector: ".region-product-card"
      });
    }

    function trackGolfJoinGa4SearchResultSelection(target) {
      const card = target?.closest?.(GOLFJOIN_GA4_SEARCH_RESULT_CARD_SELECTOR);
      if (!card) return false;
      const context = getGolfJoinGa4SearchListContext();
      const listId = `destination_search_${context}`;
      const cards = Array.from(card.parentElement?.querySelectorAll?.(".region-product-card") || []);
      const item = getGolfJoinGa4CardItem(card, Math.max(0, cards.indexOf(card)), listId, "여행지 검색 결과");
      if (!item) return false;
      return trackGolfJoinGa4Event("select_item", {
        item_list_id: listId,
        item_list_name: "여행지 검색 결과",
        source_area: "destination_search",
        items: [item]
      });
    }

    function getGolfJoinGa4PromotionParameters(slide) {
      if (!slide) return null;
      const promotionId = normalizeGolfJoinGa4String(slide.dataset?.heroBannerId || "hero_banner", 100);
      const promotionName = normalizeGolfJoinGa4String(slide.querySelector?.("img")?.alt || "hero_banner", 100);
      return promotionId ? {
        promotion_id: promotionId,
        promotion_name: promotionName || promotionId,
        source_area: "hero"
      } : null;
    }

    function trackGolfJoinGa4PromotionView(slide) {
      if (!golfJoinGa4MemberStateReady) return false;
      const parameters = getGolfJoinGa4PromotionParameters(slide);
      if (!parameters) return false;
      return trackGolfJoinGa4EventOnce(
        `promotion-view:${parameters.promotion_id}`,
        "view_promotion",
        parameters
      );
    }

    function trackGolfJoinGa4PromotionSelect(slide) {
      const parameters = getGolfJoinGa4PromotionParameters(slide);
      return parameters ? trackGolfJoinGa4Event("select_promotion", parameters) : false;
    }

    function trackGolfJoinGa4ActiveHeroPromotion() {
      const track = document.getElementById?.("heroSliderTrack");
      if (!track) return false;
      const slides = Array.from(track.children || []).filter((slide) => slide.dataset?.heroSlideClone !== "true");
      const activeDot = Array.from(document.querySelectorAll?.("#heroSlickDots .hero-slick-dot") || [])
        .findIndex((dot) => dot.classList?.contains("active"));
      return trackGolfJoinGa4PromotionView(slides[Math.max(0, activeDot)] || slides[0]);
    }

    function ensureGolfJoinGa4SectionObserver() {
      if (golfJoinGa4SectionObserver || typeof window.IntersectionObserver !== "function") return;
      golfJoinGa4SectionObserver = new window.IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.35) return;
          const sectionName = getGolfJoinGa4SectionName(entry.target);
          golfJoinGa4SectionObserver.unobserve(entry.target);
          if (!sectionName || golfJoinGa4ViewedSections.has(sectionName)) return;
          golfJoinGa4ViewedSections.add(sectionName);
          trackGolfJoinGa4Event("golfjoin_section_view", {
            section_name: sectionName,
            source_area: "home"
          });
          trackGolfJoinGa4SectionItemList(entry.target);
        });
      }, { threshold: [0.35] });
    }

    function scanGolfJoinGa4Sections() {
      ensureGolfJoinGa4SectionObserver();
      if (!golfJoinGa4SectionObserver) return;
      document.querySelectorAll(".sgj-section.hero, [data-join-section], #create").forEach((element) => {
        if (golfJoinGa4ObservedSections.has(element)) return;
        golfJoinGa4ObservedSections.add(element);
        golfJoinGa4SectionObserver.observe(element);
      });
      document.querySelectorAll("[data-join-section]").forEach((section) => {
        const sectionName = getGolfJoinGa4SectionName(section);
        if (golfJoinGa4ViewedSections.has(sectionName)) trackGolfJoinGa4SectionItemList(section);
      });
      trackGolfJoinGa4SearchResultList();
      trackGolfJoinGa4ActiveHeroPromotion();
    }

    function scheduleGolfJoinGa4SectionScan() {
      if (golfJoinGa4SectionScanTimer) return;
      golfJoinGa4SectionScanTimer = window.setTimeout(() => {
        golfJoinGa4SectionScanTimer = 0;
        scanGolfJoinGa4Sections();
      }, 0);
    }

    function scheduleGolfJoinGa4SectionDetailView(target) {
      const card = target?.closest?.(GOLFJOIN_GA4_HOME_DETAIL_CARD_SELECTOR);
      if (!card) return;
      const nestedInteractive = target?.closest?.("a, button, input, select, textarea, [role='button']");
      if (nestedInteractive && nestedInteractive !== card) return;
      const section = card.closest?.("[data-join-section]");
      const sectionName = getGolfJoinGa4SectionName(section);
      if (!sectionName) return;
      const listId = `home_${sectionName}`;
      const listName = getGolfJoinGa4ListName(section, sectionName);
      const siblingCards = Array.from(card.parentElement?.querySelectorAll?.(GOLFJOIN_GA4_HOME_DETAIL_CARD_SELECTOR) || [])
        .filter(isGolfJoinGa4CardVisible);
      const item = getGolfJoinGa4CardItem(card, Math.max(0, siblingCards.indexOf(card)), listId, listName);
      const wasAlreadyOpen = Boolean(document.querySelector("#detailModal")?.classList?.contains("open"));
      if (wasAlreadyOpen) return;
      window.setTimeout(() => {
        if (!document.querySelector("#detailModal")?.classList?.contains("open")) return;
        if (item) {
          trackGolfJoinGa4Event("select_item", {
            item_list_id: listId,
            item_list_name: listName,
            source_area: sectionName,
            items: [item]
          });
        }
        trackGolfJoinGa4Event("golfjoin_section_detail_view", {
          section_name: sectionName,
          source_area: sectionName
        });
      }, 0);
    }

    function bindGolfJoinGa4DomTracking() {
      if (golfJoinGa4DomTrackingBound) return;
      golfJoinGa4DomTrackingBound = true;
      scanGolfJoinGa4Sections();
      if (!golfJoinGa4MutationObserver && typeof window.MutationObserver === "function" && document.body) {
        golfJoinGa4MutationObserver = new window.MutationObserver(scheduleGolfJoinGa4SectionScan);
        golfJoinGa4MutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "hidden"]
        });
      }
      document.addEventListener("click", (event) => {
        scheduleGolfJoinGa4SectionDetailView(event.target);
        trackGolfJoinGa4SearchResultSelection(event.target);
        const slide = event.target?.closest?.("[data-hero-banner-id]");
        if (!slide) return;
        window.setTimeout(() => {
          if (event.defaultPrevented) return;
          trackGolfJoinGa4PromotionSelect(slide);
        }, 0);
      }, true);
      trackGolfJoinGa4ActiveHeroPromotion();
    }

    function bindGolfJoinGa4DomTrackingWhenReady() {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindGolfJoinGa4DomTracking, { once: true });
      } else {
        bindGolfJoinGa4DomTracking();
      }
    }

    function markGolfJoinGa4MemberStateReady() {
      if (golfJoinGa4MemberStateReady) return;
      golfJoinGa4MemberStateReady = true;
      if (golfJoinGa4PageViewFallbackTimer) {
        window.clearTimeout(golfJoinGa4PageViewFallbackTimer);
        golfJoinGa4PageViewFallbackTimer = 0;
      }
      sendGolfJoinGa4PageView();
      bindGolfJoinGa4DomTrackingWhenReady();
    }

    function scheduleGolfJoinGa4PageViewFallback() {
      if (golfJoinGa4MemberStateReady || golfJoinGa4PageViewFallbackTimer) return;
      golfJoinGa4PageViewFallbackTimer = window.setTimeout(() => {
        golfJoinGa4PageViewFallbackTimer = 0;
        markGolfJoinGa4MemberStateReady();
      }, GOLFJOIN_GA4_PAGE_VIEW_FALLBACK_MS);
    }

    function getGolfJoinGa4Item(join = {}) {
      const source = join && typeof join === "object" ? join : {};
      return {
        item_id: String(source.id || ""),
        item_name: String(source.title || ""),
        item_category: String(source.region || source.country || "")
      };
    }

    function getGolfJoinGa4Status() {
      return {
        measurementId: GOLFJOIN_GA4_MEASUREMENT_ID,
        propertyId: GOLFJOIN_GA4_PROPERTY_ID,
        group: GOLFJOIN_GA4_GROUP,
        initialized: golfJoinGa4Initialized,
        pageViewSent: golfJoinGa4PageViewSent,
        memberStateReady: golfJoinGa4MemberStateReady,
        debugMode: isGolfJoinGa4DebugMode()
      };
    }

    window.trackGolfJoinGa4Event = trackGolfJoinGa4Event;
    window.trackGolfJoinGa4EventOnce = trackGolfJoinGa4EventOnce;
    window.trackGolfJoinGa4PromotionView = trackGolfJoinGa4PromotionView;
    window.trackGolfJoinGa4PromotionSelect = trackGolfJoinGa4PromotionSelect;
    window.trackGolfJoinGa4SectionItemList = trackGolfJoinGa4SectionItemList;
    window.trackGolfJoinGa4SearchResultList = trackGolfJoinGa4SearchResultList;
    window.getGolfJoinGa4Item = getGolfJoinGa4Item;
    window.getGolfJoinGa4Status = getGolfJoinGa4Status;
    window.initializeGolfJoinGa4 = initializeGolfJoinGa4;
    window.markGolfJoinGa4MemberStateReady = markGolfJoinGa4MemberStateReady;

    initializeGolfJoinGa4();
    scheduleGolfJoinGa4PageViewFallback();
