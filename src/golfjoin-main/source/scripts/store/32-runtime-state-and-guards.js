
    function isProductionDummyJoin(join = {}) {
      const id = String(join.id || "");
      if (PRODUCTION_DUMMY_JOIN_ID_PATTERN.test(id)) return true;
      if (join.isRecommendationFixture || join.isSoonLoadMoreFixture) return true;
      const text = [
        join.title,
        join.region,
        join.badge,
        join.customTheme,
        join.sourceApplicationId
      ].filter(Boolean).join(" ");
      return PRODUCTION_DUMMY_PAYLOAD_PATTERN.test(text);
    }

    function removeProductionDummyJoins() {
      for (let index = joins.length - 1; index >= 0; index -= 1) {
        if (isProductionDummyJoin(joins[index])) {
          joins.splice(index, 1);
        }
      }
    }

    function containsProductionDummyPayload(value) {
      try {
        return PRODUCTION_DUMMY_PAYLOAD_PATTERN.test(JSON.stringify(value));
      } catch (error) {
        return false;
      }
    }

    function filterProductionDummyPayload(value) {
      if (Array.isArray(value)) {
        return value.filter((item) => !containsProductionDummyPayload(item));
      }
      if (value && typeof value === "object") {
        if (Array.isArray(value.rows)) {
          return {
            ...value,
            rows: value.rows.filter((item) => !containsProductionDummyPayload(item))
          };
        }
        return Object.fromEntries(
          Object.entries(value).filter(([, item]) => !containsProductionDummyPayload(item))
        );
      }
      return value;
    }

    function purgeProductionDummyLocalStorage() {
      [
        BUILDER_APPLICATIONS_STORAGE_KEY,
        JOIN_APPLICATIONS_STORAGE_KEY,
        JOIN_WISH_STORAGE_KEY,
        JOIN_RECENT_VIEW_STORAGE_KEY,
        GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY,
        GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY,
        GOOGLE_SHEET_JOIN_REVIEWS_READ_CACHE_KEY,
        GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY,
        JOIN_REVIEW_STORAGE_KEY
      ].forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw || !PRODUCTION_DUMMY_PAYLOAD_PATTERN.test(raw)) return;
          const filtered = filterProductionDummyPayload(JSON.parse(raw));
          localStorage.setItem(key, JSON.stringify(filtered));
        } catch (error) {
          golfJoinSafeWarn("Failed to purge production dummy local storage.", key, error);
        }
      });
    }
    const BUILDER_APPLICATION_GENDER_ICON_POOLS = {
      male: [
        "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/man1.webp",
        "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/man2.webp",
        "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/man3.webp",
        "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/man4.webp"
      ],
      female: [
        "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/woman1.webp",
        "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/woman2.webp",
        "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/woman3.webp",
        "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/woman4.webp"
      ]
    };
    const HERO_CALENDAR_AVATAR_POOL = [
      ...BUILDER_APPLICATION_GENDER_ICON_POOLS.male,
      ...BUILDER_APPLICATION_GENDER_ICON_POOLS.female
    ];
    let builderStep = 1;
    let suppressBuilderNextUntil = 0;
    let joinActionLoadingCount = 0;
    const joinActionLoadingOwners = new Map();
    let joinActionLoadingGeneration = 0;
    const joinReadLoadingOwners = new Map();
    let joinReadLoadingGeneration = 0;
    let joinActionLoadingIconIndex = 0;
    let joinActionLoadingTimer = null;
    let joinActionLoadingOpenedAt = 0;
    let homeInitialLoadingIconTimer = null;
    let homeInitialLoadingIconIndex = 0;
    let builderCalendarLoadingIconTimer = null;
    let builderCalendarLoadingIconIndex = 0;
    let joinActionLoadingMessageBase = "";
    let joinActionLoadingMessageDotIndex = 0;
    let homeInitialLoadingMessageBase = "상품을 확인하고 있어요";
    let homeInitialLoadingMaxTimer = null;
    const HOME_INITIAL_LOADING_MAX_VISIBLE_MS = 12000;
    const homeInitialLoadingMessages = [
      "상품을 확인하고 있어요",
      "조인모임을 확인중이에요",
      "멤버 정보를 확인중이에요"
    ];
    let homeInitialLoadingMessageIndex = 0;
    let homeInitialLoadingMessageDotIndex = 0;
    const JOIN_ACTION_LOADING_MIN_VISIBLE_MS = 450;
    const JOIN_READ_LOADING_DELAY_MS = 150;
    const JOIN_ACTION_LOADING_ICON_INTERVAL_MS = 400;
    const BUILDER_CALENDAR_LOADING_MESSAGE = "가능한 출발일을 확인하고 있어요";
    const JOIN_LOADING_DOT_SUFFIXES = ["", ".", "..", "..."];
    let joinActionLoadingMinVisibleMs = JOIN_ACTION_LOADING_MIN_VISIBLE_MS;
    let lastJoinAsyncClickButton = null;
    const joinActionLoadingIcons = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-binoculars-icon lucide-binoculars"><path d="M10 10h4"/><path d="M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3"/><path d="M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z"/><path d="M 22 16 L 2 16"/><path d="M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z"/><path d="M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3"/></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tickets-plane-icon lucide-tickets-plane"><path d="M10.5 17h1.227a2 2 0 0 0 1.345-.52L18 12"/><path d="m12 13.5 3.794.506"/><path d="m3.173 8.18 11-5a2 2 0 0 1 2.647.993L18.56 8"/><path d="M6 10V8"/><path d="M6 14v1"/><path d="M6 19v2"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-luggage-icon lucide-luggage"><path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/><path d="M10 20h4"/><circle cx="16" cy="20" r="2"/><circle cx="8" cy="20" r="2"/></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sailboat-icon lucide-sailboat"><path d="M10 2v15"/><path d="M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z"/><path d="M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z"/></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plane-icon lucide-plane"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`
    ];
    let activeBuilderFlexTarget = "start";
    let activeBuilderPopoverTarget = "start";
    let activeBuilderPopoverDay = null;
    let activeBuilderPopoverFlexOpen = false;
    let builderPopoverFlexSnapshot = null;
    let activeBuilderPopoverTrigger = null;
    function getBuilderInitialMonthState() {
      const firstAvailableDate = new Date(`${getBuilderMinDepartureISO()}T00:00:00`);
      return {
        viewYear: firstAvailableDate.getFullYear(),
        viewMonth: firstAvailableDate.getMonth()
      };
    }
    const builderState = {
      ...getBuilderInitialMonthState(),
      startDay: null,
      endDay: null,
      startBefore: 0,
      startAfter: 0,
      endBefore: 0,
      endAfter: 0,
      dateSelectionComplete: false,
      regionSelectionComplete: false,
      region: "",
      regions: [],
      dateConstraintRegions: [],
      durationFilter: "",
      productId: "",
      productName: "",
      productFamilyId: "",
      fixedProductGoodSeq: "",
      mdPickDateChangeMode: false,
      mdPickRecruitDirectMode: false
    };

    const JOIN_FULLSCREEN_MODAL_SELECTOR = [
      "#calendarSheet.open",
      "#builderModal.open",
      "#detailModal.open",
      "#regionSearchModal.open",
      "#globalApplyOverlay.open",
      "#joinMyMenuModal.open"
    ].join(", ");
    let joinFullscreenModalCoverUpdateFrame = 0;
    let joinFullscreenModalCoverObserver = null;

