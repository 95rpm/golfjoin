
    const GOLFJOIN_SHEET_API_ENDPOINT = window.GOLFJOIN_SHEET_API_ENDPOINT || "https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api";
    const GOLFJOIN_SHEET_READ_TIMEOUT_MS = 20000;
    const JOIN_MEMBER_PROFILE_LOOKUP_TIMEOUT_MS = 5000;
    const GOLFJOIN_PRODUCTS_DATA_VERSION = window.GOLFJOIN_PRODUCTS_DATA_VERSION || "20260512095231";
    const GOLFJOIN_PRODUCTS_SUMMARY_VERSION = window.GOLFJOIN_PRODUCTS_SUMMARY_VERSION || "202607070902";
    const GOLFJOIN_HOME_CARDS_VERSION = window.GOLFJOIN_HOME_CARDS_VERSION || "2026080301";
    const GOLFJOIN_HOME_CARDS_ENABLED = window.GOLFJOIN_HOME_CARDS_ENABLED !== false;
    const GOLFJOIN_HOME_MANIFEST_PATH = "web/golfjoin_home_manifest.json";
    const GOLFJOIN_DEFAULT_MINIMUM_ADVANCE_DAYS = 7;
    const GOLFJOIN_HOME_JSON_FETCH_TIMEOUT_MS = 12000;
    const GOLFJOIN_HOME_PRODUCTS_READY_TIMEOUT_MS = 15000;
    const GOLFJOIN_PRODUCT_FAMILY_ENABLED = window.GOLFJOIN_PRODUCT_FAMILY_ENABLED !== false;
    const GOLFJOIN_PRODUCT_FAMILY_MANIFEST_PATH = "web/product-family/manifest.json";
    const GOLFJOIN_PRODUCT_FAMILY_LOAD_TIMEOUT_MS = 5000;

    const BADGE_IMAGES = {
      justgo: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/badge_justgo.png",
      special: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/badge_special.png",
      limit: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/badge_limit.png",
      lowest: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/badge_lowest.png"
    };
    const BADGE_TOOLTIPS = {
      justgo: {
        title: "바로출발",
        value: "인원 모집 완료! 출발 확정된 일정",
        summary: "더 기다릴 필요 없이 바로 확정 상품"
      },
      limit: {
        title: "기간한정",
        value: "놓치면 끝, 지금 가격만 적용되는 특가 일정",
        summary: "이번 달만 제공되는 한정 타입"
      },
      special: {
        title: "시크릿특가",
        value: "시크릿투어 단독! 어디서도 볼 수 없는 일정",
        summary: "회원 전용으로 공개되는 특별가"
      },
      lowest: {
        title: "최저가보장",
        value: "같은 상품을 더 낮은 가격으로 발견하면, 예약 후 24시간 이내 신청 시 차액을 보장해 드립니다.",
        summary: "가격까지 안심할 수 있는 시크릿투어 약속"
      }
    };

    const LOCAL_FALLBACK_JOINS = [
      { id: "erp-30001104-30265790", title: "태국 우돈타니 로얄크릭 3박5일 로얄크릭", region: "우돈타니", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 259000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001104", eventSeq: "30265790" },
      { id: "erp-30001089-30269803", title: "태국 방콕 2색 3박5일 썬라이즈 호텔", region: "방콕", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 274000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001089", eventSeq: "30269803" },
      { id: "erp-30001224-30268185", title: "라오스 비엔티안 덴사반 3박5일 덴사반카지노 구관", region: "비엔티안", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 310000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001224", eventSeq: "30268185" },
      { id: "erp-30001106-30258166", title: "필리핀 클락 파인우드 3박5일 아이온", region: "클락", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 310000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001106", eventSeq: "30258166" },
      { id: "erp-30001243-30269615", title: "태국 치앙마이 가산쿤탄 3박5일 가산쿤탄 (신관)", region: "치앙마이", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 370000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001243", eventSeq: "30269615" },
      { id: "erp-30001097-30263569", title: "태국 치앙마이 메조 3박5일 메조", region: "치앙마이", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 385000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001097", eventSeq: "30263569" },
      { id: "erp-30001123-30269991", title: "태국 방콕 2색 5박7일 썬라이즈 호텔", region: "방콕", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-11", date: "2026.07.05 - 2026.07.11", duration: "5박 7일", price: 400000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001123", eventSeq: "30269991" },
      { id: "erp-30001092-30262585", title: "태국 치앙마이 아티타야 3박5일 아티타야", region: "치앙마이", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 400000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001092", eventSeq: "30262585" },
      { id: "erp-30001096-30263360", title: "태국 치앙마이 로얄치앙마이 3박5일 로얄 카트비", region: "치앙마이", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 415000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001096", eventSeq: "30263360" },
      { id: "erp-30001107-30258375", title: "필리핀 마닐라 썬밸리 3박5일 썬밸리 레이트체크아웃(20시까지)", region: "마닐라", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 415000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001107", eventSeq: "30258375" },
      { id: "erp-30001084-30216722", title: "태국 방콕 아티타야 3박5일", region: "방콕", category: "해외", departureDate: "2026-07-05", returnDate: "2026-07-09", date: "2026.07.05 - 2026.07.09", duration: "3박 5일", price: 420000, airport: "인천", badge: "시크릿특가", badgeKind: "special", status: "예약", image: "", includes: [], excludes: [], notes: [], schedule: [], participants: [], emptySlots: 4, goodSeq: "30001084", eventSeq: "30216722" }
    ];
    const joins = LOCAL_FALLBACK_JOINS.map((join) => ({ ...join }));
    const domesticJoinTemplate = {};
    const overseasJoinTemplate = {};

    const REGION_SCHEDULE_EXTRA_PRESETS = {
      "\uC81C\uC8FC": {
        hotel: "\uC81C\uC8FC \uC624\uC158\uBDF0 \uB9AC\uC870\uD2B8",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uACBD\uAE30": {
        hotel: "\uC218\uB3C4\uAD8C \uBE44\uC988\uB2C8\uC2A4 \uD638\uD154",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uC790\uC720\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uAC15\uC6D0": {
        hotel: "\uD558\uC774\uC6D0 \uB9AC\uC870\uD2B8",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uB9AC\uC870\uD2B8\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uACBD\uB0A8": {
        hotel: "\uB0A8\uD574 \uC544\uB09C\uD2F0 \uB9AC\uC870\uD2B8",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uB9AC\uC870\uD2B8\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uBC29\uCF55": {
        hotel: "\uBC29\uCF55 \uC2DC\uB0B4 5\uC131\uAE09 \uD638\uD154",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uC790\uC720\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uB2E4\uB0AD": {
        hotel: "\uB2E4\uB0AD \uBE44\uCE58 \uB9AC\uC870\uD2B8",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uC790\uC720\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uAD0C": {
        hotel: "\uAD0C \uB808\uC624\uD314\uB808\uC2A4 \uB9AC\uC870\uD2B8",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC11D\uC2DD", menu: "\uB9AC\uC870\uD2B8\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uC790\uC720\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uCE58\uC559\uB9C8\uC774": {
        hotel: "\uCE58\uC559\uB9C8\uC774 \uB9AC\uBC84\uC0AC\uC774\uB4DC \uD638\uD154",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uC790\uC720\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uD6C4\uCFE0\uC624\uCE74": {
        hotel: "\uD6C4\uCFE0\uC624\uCE74 \uC2DC\uB0B4 \uD638\uD154",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC11D\uC2DD", menu: "\uC790\uC720\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uC790\uC720\uC2DD" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      },
      "\uC624\uD0A4\uB098\uC640": {
        hotel: "\uC624\uD0A4\uB098\uC640 \uBE44\uCE58 \uD638\uD154",
        meals: [
          [{ label: "\uC870\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uBD88\uD3EC\uD568" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uD074\uB7FD\uD558\uC6B0\uC2A4" }, { label: "\uC11D\uC2DD", menu: "\uC790\uC720\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uC790\uC720\uC2DD" }, { label: "\uC11D\uC2DD", menu: "\uD604\uC9C0\uC2DD" }],
          [{ label: "\uC870\uC2DD", menu: "\uD638\uD154\uC2DD" }, { label: "\uC911\uC2DD", menu: "\uAE30\uB0B4\uC2DD" }, { label: "\uC11D\uC2DD", menu: "\uBD88\uD3EC\uD568" }]
        ]
      }
    };

    function getDummyScheduleExtraPreset(join = {}) {
      const region = String(join.region || "").split(",")[0].trim();
      return REGION_SCHEDULE_EXTRA_PRESETS[region] || (join.category === "\uD574\uC678"
        ? REGION_SCHEDULE_EXTRA_PRESETS["\uBC29\uCF55"]
        : REGION_SCHEDULE_EXTRA_PRESETS["\uACBD\uAE30"]);
    }

    function applyDummyScheduleExtraInfo() {
      joins.forEach((join) => {
        if (!Array.isArray(join.schedule) || !join.schedule.length) return;
        const preset = getDummyScheduleExtraPreset(join);
        join.schedule = join.schedule.map((item, index) => ({
          ...item,
          extra: item.extra || {
            hotel: preset.hotel,
            meals: preset.meals[index] || preset.meals[preset.meals.length - 1] || []
          }
        }));
      });
    }

    applyDummyScheduleExtraInfo();

    const participantMessagePool = [
      "처음 뵙지만 편하게 인사 나누며 즐겁게 치고 싶어요.",
      "스코어보다 좋은 분위기를 더 중요하게 생각합니다.",
      "시간 약속 잘 지키고 매너 있게 라운딩하겠습니다.",
      "사진도 남기고 여유롭게 즐기는 라운딩이면 좋겠습니다.",
      "초보 분들도 편하게 함께할 수 있는 분위기를 좋아해요.",
      "좋은 코스에서 기분 좋은 하루 만들고 싶습니다.",
      "진행은 빠르게, 분위기는 편안하게 치는 편입니다.",
      "서로 배려하면서 즐거운 조인 되었으면 합니다."
    ];
    const participantProfessionPool = ["경영", "사업", "부동산", "건설", "금융", "보험", "세무", "법률", "의료", "제조", "유통", "무역", "영업", "교육", "공공"];

    joins.forEach((join, joinIndex) => {
      (join.participants || []).forEach((participant, participantIndex) => {
        if (!participant.profession) {
          participant.profession = participantProfessionPool[(joinIndex + participantIndex) % participantProfessionPool.length];
        }
        if (!participant.message) {
          participant.message = participantMessagePool[(joinIndex + participantIndex) % participantMessagePool.length];
        }
      });
    });

    const state = {
      period: "departure-soon",
      sort: "departure-asc"
    };
    const HERO_CALENDAR_PROFILE_COUNT_TEST_VALUE = null;
    let joinMemberProfileCompletedCount = 0;
    let heroCalendarActiveCountValue = 0;
    let heroCalendarProfileCountQueuedValue = 0;
    let heroCalendarActiveCountQueuedValue = 0;
    let heroCalendarProfileCountAnimationReady = false;
    let heroCalendarProfileCountAnimationStarted = false;

    function normalizeEmbeddedBoardContainer() {
      const root = document.getElementById("secret-golf-join");
      if (!root) return;
      const host = root.closest(".read_contens");
      if (!host) return;
      host.classList.add("sgj-board-host");
      const board = host.closest(".boardread_type1");
      board?.classList.add("sgj-board-root");
      host.closest(".middle_wrap")?.classList.add("sgj-board-page");
    }

    normalizeEmbeddedBoardContainer();

    function randomizeHeroCalendarThumbs() {
      const images = Array.from(document.querySelectorAll(".hero-calendar-thumb img"));
      if (!images.length || !HERO_CALENDAR_AVATAR_POOL.length) return;
      const shuffled = HERO_CALENDAR_AVATAR_POOL
        .map((src) => ({ src, order: Math.random() }))
        .sort((a, b) => a.order - b.order)
        .map((item) => item.src);
      images.forEach((image, index) => {
        image.src = shuffled[index % shuffled.length];
        image.alt = "";
      });
    }

    function roundedRectPath(x, y, width, height, radius) {
      const r = Math.max(0, Math.min(radius, width / 2, height / 2));
      const right = x + width;
      const bottom = y + height;
      return [
        `M${x + r} ${y}`,
        `H${right - r}`,
        `Q${right} ${y} ${right} ${y + r}`,
        `V${bottom - r}`,
        `Q${right} ${bottom} ${right - r} ${bottom}`,
        `H${x + r}`,
        `Q${x} ${bottom} ${x} ${bottom - r}`,
        `V${y + r}`,
        `Q${x} ${y} ${x + r} ${y}`,
        "Z"
      ].join(" ");
    }

    function updateHeroCalendarShape() {
      const svg = document.querySelector(".hero-calendar-shape");
      const button = svg?.closest(".hero-calendar-button");
      const mainPath = svg?.querySelector(".hero-calendar-main-shape");
      const ctaPath = svg?.querySelector(".hero-calendar-cta-shape");
      const chevron = button?.querySelector(".button-chevron");
      if (!svg || !button || !mainPath || !ctaPath) return;
      const width = Math.max(1, button.clientWidth);
      const height = Math.max(1, button.clientHeight);
      const outerRadius = 14;
      const notchRadius = 18;
      const ctaRadius = 25;
      const notchWidth = width * 0.3215;
      const notchHeight = height * 0.3182;
      const notchLeft = width - notchWidth;
      const notchTop = height - notchHeight;
      const ctaHeight = height * 0.25758;
      const ctaTop = height - ctaHeight;
      const ctaGap = Math.max(0, ctaTop - notchTop);
      const ctaLeft = notchLeft + ctaGap;
      const ctaWidth = width - ctaLeft;
      const mainD = [
        `M${outerRadius} 0`,
        `H${width - outerRadius}`,
        `Q${width} 0 ${width} ${outerRadius}`,
        `V${Math.max(outerRadius, notchTop - notchRadius)}`,
        `Q${width} ${notchTop} ${width - notchRadius} ${notchTop}`,
        `H${notchLeft + notchRadius}`,
        `Q${notchLeft} ${notchTop} ${notchLeft} ${notchTop + notchRadius}`,
        `V${height - notchRadius}`,
        `Q${notchLeft} ${height} ${notchLeft - notchRadius} ${height}`,
        `H${outerRadius}`,
        `Q0 ${height} 0 ${height - outerRadius}`,
        `V${outerRadius}`,
        `Q0 0 ${outerRadius} 0`,
        "Z"
      ].join(" ");
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      mainPath.setAttribute("d", mainD);
      ctaPath.setAttribute("d", roundedRectPath(ctaLeft, ctaTop, ctaWidth, ctaHeight, ctaRadius));
      if (chevron) {
        chevron.style.left = `${ctaLeft + (ctaWidth / 2) - (chevron.offsetWidth / 2)}px`;
        chevron.style.top = `${ctaTop + (ctaHeight / 2)}px`;
        chevron.style.right = "auto";
      }
    }

    function initializeHeroCalendarShape() {
      updateHeroCalendarShape();
      if (window.ResizeObserver) {
        const button = document.querySelector(".hero-calendar-button");
        if (button) {
          const observer = new ResizeObserver(() => updateHeroCalendarShape());
          observer.observe(button);
        }
      }
      window.addEventListener("resize", updateHeroCalendarShape, { passive: true });
    }

    let participantCloseTimer = null;
    let activeParticipantTrigger = null;
    let currentDetailJoinId = null;
    let currentDetailMode = "normal";
    let currentDetailJoinData = null;
    let currentSharePayload = null;
    const GOLFJOIN_KAKAO_COMMERCE_TEMPLATE_ID = 134859;
    let latestBuilderApplicationShareJoin = null;
    let currentDetailReturnContext = null;
    let currentMdPickProductGroupKey = "";
    let currentMdPickCountryKey = "";
    let detailProductFamilyPeriodSwitching = false;
    let currentDetailSlideIndex = 0;
    let detailParticipantTooltipTimer = null;
    let detailAnchorForcedActiveTimer = null;
    let globalApplyWaitlistApproved = false;
    let currentAgreementDetailKey = null;
    let waitlistConfirmAction = null;
    let waitlistSoloAction = null;
    let detailReviewAutoTimer = null;
    let detailReviewResetTimer = null;
    let heroSlideIndex = 1;
    let heroRealSlideCount = 0;
    const QUICK_SECTION_DISPLAY_LIMIT = 2;
    let quickSectionFeaturedIndex = 0;
    const OVERSEAS_BEST_INITIAL_VISIBLE_COUNT = 4;
    const OVERSEAS_BEST_PAGE_SIZE = 16;
    let overseasBestVisibleCount = OVERSEAS_BEST_INITIAL_VISIBLE_COUNT;
    let overseasBestLastMobileLayout = null;
    const MY_JOIN_INITIAL_VISIBLE_COUNT = 4;
    const MY_JOIN_PAGE_SIZE = 16;
    let myJoinFilter = "complete";
    let myJoinVisibleCounts = {
      complete: MY_JOIN_INITIAL_VISIBLE_COUNT,
      created: MY_JOIN_INITIAL_VISIBLE_COUNT,
      joined: MY_JOIN_INITIAL_VISIBLE_COUNT
    };
    let myJoinLastMobileLayout = null;
    let myJoinMemberScopeKey = null;
    const SOON_RANGE_FILTERS = [
      { key: "soon", label: "곧 떠나요", minDays: 7, maxDays: 14 },
      { key: "month", label: "한달 이내", minDays: 14, maxDays: 30 },
      { key: "relaxed", label: "여유있게 준비", minDays: 31, maxDays: null }
    ];
    const SOON_MOBILE_PAGE_SIZE = 4;
    const SOON_DESKTOP_PAGE_SIZE = 8;
    const JOIN_COUNTDOWN_BASE_TIMESTAMP = new Date("2026-04-24T00:00:00").getTime();
    const JOIN_COUNTDOWN_REAL_START_TIMESTAMP = Date.now();
    let activeSoonRangeKey = "soon";
    let soonMobileVisibleCount = SOON_MOBILE_PAGE_SIZE;
    let soonDesktopVisibleCount = SOON_DESKTOP_PAGE_SIZE;
    let joinReservationCountdownTimer = null;
    let quickMobileCarouselTimer = null;
    let quickMobileCarouselScrollTimer = null;
    let quickMobileCarouselSuppressAlign = false;
    let quickMobileCarouselTargetLeft = null;
    let quickMobileCarouselTouching = false;
    let joinSectionNavLastScrollY = 0;
    let joinSectionNavLockedKey = "";
    let joinSectionNavLockedTargetY = null;
    let joinSectionNavUnlockTimer = null;
    let joinSectionNavScrollFrame = 0;
    let joinSectionNavActiveKey = "";
    let selectedTravelRegion = "";
    let selectedTravelStart = null;
    let selectedTravelEnd = null;
    let pendingBuilderRegion = "";
    let externalGolfJoinProducts = null;
    let externalGolfJoinProductsLoadPromise = null;
    let externalGolfJoinProductsLoadFailed = false;
    let externalGolfJoinProductsLoading = false;
    let golfJoinHomeSummaryLoadPromise = null;
    let homeGolfJoinProducts = null;
    let homeGolfJoinProductsLoadPromise = null;
    let homeGolfJoinProductsLoadFailed = false;
    let golfJoinHomeCardsLoadPromise = null;
    let golfJoinHomeManifestLoadPromise = null;
    let golfJoinHomeManifest = null;
    let homeGolfJoinMinimumAdvanceDays = GOLFJOIN_DEFAULT_MINIMUM_ADVANCE_DAYS;
    const golfJoinProductAvailabilityCache = new Map();
    const golfJoinProductAvailabilityPromiseCache = new Map();
    const golfJoinProductMetaByGoodSeq = new Map();
    let golfJoinProductFamilyManifest = null;
    let golfJoinProductFamilyCatalog = null;
    let golfJoinProductFamilyLoadPromise = null;
    let golfJoinProductFamilyLoadFailed = false;
    const golfJoinProductFamilyIdByGoodSeq = new Map();
    const golfJoinProductFamilyById = new Map();
    let golfJoinDestinationSummary = null;
    let homeInitialExternalProductsLoading = false;
    let homeInitialExternalProductsLoadedOnce = false;
    let homeBootstrapLoading = false;
    let googleSheetBuilderApplicationsLoading = false;
    let builderApplySubmitting = false;
    let builderAlertOpenedAt = 0;
    let builderAlertConfirmHandler = null;
    let pendingApplySubmitConfirmType = "";
    let applySubmitConfirmOpenedAt = 0;
    let applySubmitConfirmOpenFrame = 0;
    let googleSheetBuilderApplicationsReadCompleted = false;
    let googleSheetBuilderApplicationsReadFailed = false;
    let googleSheetBuilderApplicationsRequestGeneration = 0;
    let googleSheetJoinApplicationsLoading = false;
    let googleSheetJoinApplicationsReadCompleted = false;
    let googleSheetJoinApplicationsReadFailed = false;
    let googleSheetJoinApplicationsRequestGeneration = 0;
    let joinMyReservationsRefreshing = false;
    let joinMyReservationOpening = false;
    let joinMyMenuActiveView = "";
    let joinMyDrawerActiveMenu = "";
    let joinMyMenuReturnToDrawerOnClose = false;
    let googleSheetJoinWishesLoading = false;
    let googleSheetJoinWishesReadCompleted = false;
    let googleSheetJoinWishesReadFailed = false;
    let googleSheetJoinWishesReadMemberKey = "";
    let joinMyMenuViewGeneration = 0;
    let pendingHomeBootstrapLightData = null;
    let pendingHomeBootstrapLightOptions = { fromCache: true };
    let homeBootstrapLightAuthoritativeApplied = false;
    let homeBootstrapLightApplySignature = "";
    let homeBootstrapSnapshotNeedsRefresh = false;
    let homeSecondaryHydrationScheduled = false;
    const GOOGLE_SHEET_READ_CACHE_TTL_MS = 60 * 1000;
    const HOME_BOOTSTRAP_LIGHT_LOCAL_CACHE_TTL_MS = 5 * 60 * 1000;
    const GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY = "joinApplicationsSheetReadCache";
    const GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY = "builderApplicationsSheetReadCache";
    const GOOGLE_SHEET_JOIN_REVIEWS_READ_CACHE_KEY = "joinReviewsSheetReadCache";
    const GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY = "joinWishesSheetReadCache";
    const HOME_BOOTSTRAP_LIGHT_CACHE_KEY = "homeBootstrapLightPublicCache";
    const HOME_STATS_CACHE_KEY = "homeStatsCache";
    const HOME_STATS_VISITOR_TTL_MS = 10 * 60 * 1000;
    const HOME_STATS_ACTIVE_TTL_MS = 60 * 1000;
    const HOME_SECONDARY_HYDRATION_DELAY_MS = 1500;
    const HOME_SECONDARY_BOOTSTRAP_WAIT_MS = 4000;
    const REVIEW_IMAGE_SIGN_ENDPOINT = window.GOLFJOIN_IMAGE_SIGN_ENDPOINT || "https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sign-gcs-upload";
    const REVIEW_IMAGE_MAX_FILES = 3;
    const REVIEW_IMAGE_MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
    const REVIEW_IMAGE_MAIN_MAX_SIDE = 1280;
    const REVIEW_IMAGE_THUMB_MAX_SIDE = 480;
    const REVIEW_IMAGE_QUALITY = 0.76;
    let joinMyReviewSelectedPhotoItems = [];
    const PROFILE_IMAGE_MAX_SIDE = 180;
    const PROFILE_IMAGE_QUALITY = 0.68;
    const BUILDER_APPLICATION_JOIN_PREFIX = "sheet-builder-application-";
    const BUILDER_APPLICATIONS_STORAGE_KEY = "secretGolfJoinBuilderApplications";
    const BUILDER_APPLICATION_LOCAL_PRESERVE_MS = 7 * 24 * 60 * 60 * 1000;
    const JOIN_APPLICATIONS_STORAGE_KEY = "secretGolfJoinApplications";
    const JOIN_APPLICATION_AUTHORITATIVE_REFRESH_GRACE_MS = 5 * 60 * 1000;
    const JOIN_WISH_STORAGE_KEY = "secretGolfJoinWishProducts";
    const JOIN_RECENT_VIEW_STORAGE_KEY = "secretGolfJoinRecentViewedProducts";
    const BUILDER_APPLICATION_MAX_CAPACITY = 4;
    const BUILDER_APPLICATION_MAX_PARTICIPANT_ICONS = BUILDER_APPLICATION_MAX_CAPACITY;
    const JOIN_MAX_CAPACITY = 4;
    const MAX_DETAIL_PARTICIPANT_PREVIEWS = 40;
    const SHOW_DOMESTIC_JOIN_PRODUCTS = false;
    const joinApplicationPayloadMemory = new Map();
    const joinReviewPayloadMemory = new Map();
    const PRODUCTION_DUMMY_JOIN_ID_PATTERN = /^(?:j\d+|dummy-)/;
    const PRODUCTION_DUMMY_PAYLOAD_PATTERN = /dummy-|테스트|01000000000|j[1-8]p\d/;

