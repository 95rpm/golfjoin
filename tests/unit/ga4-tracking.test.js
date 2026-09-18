"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(
  path.join(ROOT, "src/golfjoin-main/source/scripts/analytics/30-ga4-events.js"),
  "utf8"
);

function loadAnalytics(search = "?eventPlanSeq=29&page=1", memberState = null, sessionMember = null) {
  const calls = [];
  const listeners = new Map();
  const listenerOptions = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  let detailModalOpen = false;
  const document = {
    body: {},
    documentElement: { clientHeight: 1080, clientWidth: 1920 },
    head: { appendChild() {} },
    readyState: "complete",
    referrer: "https://www.secret-tour.com/main",
    title: "시크릿투어 골프조인",
    addEventListener(type, listener, options) {
      listeners.set(type, listener);
      listenerOptions.set(type, options);
    },
    createElement() {
      return { dataset: {} };
    },
    getElementById() {
      return null;
    },
    querySelector(selector) {
      if (selector === "#detailModal") {
        return {
          classList: {
            contains(value) {
              return value === "open" && detailModalOpen;
            }
          }
        };
      }
      return selector.includes("googletagmanager.com/gtag/js") ? { src: "existing-tag.js" } : null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const window = {
    dataLayer: [],
    document,
    location: {
      href: `https://www.secret-tour.com/event/plan_view${search}`,
      pathname: "/event/plan_view",
      search
    },
    gtag(...args) {
      calls.push(args);
    },
    setTimeout(callback) {
      const timerId = nextTimerId++;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout(timerId) {
      timers.delete(timerId);
    }
  };
  window.window = window;
  const context = vm.createContext({
    URLSearchParams,
    WeakSet,
    Set,
    Object,
    String,
    Number,
    Boolean,
    Math,
    encodeURIComponent,
    document,
    window,
    getJoinLoginState() {
      return memberState || { isLogin: false, member: {} };
    },
    getJoinSessionMember() {
      return sessionMember;
    }
  });
  new vm.Script(SOURCE, { filename: "30-ga4-events.js" }).runInContext(context);
  return {
    calls,
    context,
    listeners,
    listenerOptions,
    document,
    window,
    setDetailModalOpen(value) {
      detailModalOpen = Boolean(value);
    },
    runTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    }
  };
}

test("골프조인 페이지뷰는 회원 상태가 확정된 뒤 한 번만 전송한다", () => {
  const { calls, window } = loadAnalytics();
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), [
    "config",
    "G-LLY6DLP23E",
    { groups: "golfjoin", send_page_view: false }
  ]);
  assert.equal(calls.length, 1);
  assert.equal(window.getGolfJoinGa4Status().memberStateReady, false);
  assert.equal(window.getGolfJoinGa4Status().propertyId, "552152254");

  window.markGolfJoinGa4MemberStateReady();
  assert.equal(calls[1][0], "event");
  assert.equal(calls[1][1], "page_view");
  assert.equal(calls[1][2].send_to, "golfjoin");
  assert.equal(calls[1][2].debug_mode, true);
  assert.equal(calls[1][2].member_state, "guest");
  assert.equal(window.getGolfJoinGa4Status().memberStateReady, true);

  window.markGolfJoinGa4MemberStateReady();
  window.initializeGolfJoinGa4();
  assert.equal(calls.filter(([command]) => command === "config").length, 1);
  assert.equal(calls.filter(([, event]) => event === "page_view").length, 1);
});

test("카카오 로그인 상태가 복원된 뒤 페이지뷰를 보내면 kakao로 기록한다", () => {
  const { calls, window } = loadAnalytics("?eventPlanSeq=3&page=1", {
    isLogin: true,
    member: { memberSeq: "30002268", memberChannel: "KAKAO" }
  });

  assert.equal(calls.length, 1);
  window.markGolfJoinGa4MemberStateReady();

  const pageView = calls.find(([, event]) => event === "page_view");
  assert.ok(pageView);
  assert.equal(pageView[2].member_state, "kakao");
  assert.equal(pageView[2].debug_mode, undefined);
});

test("로그아웃 판정은 남아 있는 세션 회원 캐시보다 우선한다", () => {
  const { calls, window } = loadAnalytics(
    "?eventPlanSeq=3&page=1",
    { isLogin: false, member: {} },
    { memberSeq: "30002268", memberChannel: "KAKAO" }
  );

  window.markGolfJoinGa4MemberStateReady();

  const pageView = calls.find(([, event]) => event === "page_view");
  assert.ok(pageView);
  assert.equal(pageView[2].member_state, "guest");
});

test("부팅 완료 신호가 없으면 안전 타이머가 페이지뷰 누락을 방지한다", () => {
  const { calls, runTimers, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  assert.equal(window.getGolfJoinGa4Status().pageViewSent, false);
  runTimers();
  assert.equal(calls.filter(([, event]) => event === "page_view").length, 1);
  assert.equal(window.getGolfJoinGa4Status().pageViewSent, true);
});

test("상품상세 이벤트는 권장 이벤트와 items 형식으로 전송하고 개인정보는 제거한다", () => {
  const { calls, window } = loadAnalytics();
  window.trackGolfJoinGa4Event("golfjoin_detail_view", {
    item_id: "sch_123",
    item_name: "오키나와 골프 4일",
    item_category: "일본",
    item_type: "join_schedule",
    source_section: "MD PICK",
    memberSeq: "30009999",
    memberMobile: "01012345678",
    email: "private@example.com"
  });

  const [, event, parameters] = calls.at(-1);
  assert.equal(event, "view_item");
  assert.equal(parameters.send_to, "golfjoin");
  assert.equal(parameters.source_area, "md_pick");
  assert.equal(parameters.member_state, "guest");
  assert.deepEqual(JSON.parse(JSON.stringify(parameters.items)), [{
    item_id: "sch_123",
    item_name: "오키나와 골프 4일",
    item_category: "일본",
    item_type: "join_schedule"
  }]);
  assert.equal("memberSeq" in parameters, false);
  assert.equal("memberMobile" in parameters, false);
  assert.equal("email" in parameters, false);
});

test("메인 상품카드가 실제 상세를 열면 노출 섹션을 별도 상세 이벤트로 기록한다", () => {
  const { calls, listeners, listenerOptions, runTimers, setDetailModalOpen, window } = loadAnalytics();
  window.markGolfJoinGa4MemberStateReady();
  assert.equal(listenerOptions.get("click"), true);
  const section = {
    dataset: { joinSection: "soon" },
    id: "join-section-soon",
    querySelector() {
      return { textContent: "곧 출발해요" };
    }
  };
  const card = {
    dataset: {},
    parentElement: {
      querySelectorAll() {
        return [card];
      }
    },
    getAttribute(name) {
      return name === "onclick" ? "openDetail('sch_soon_1')" : "";
    },
    matches() {
      return false;
    },
    querySelector(selector) {
      if (selector === "img") return { alt: "태국 방콕 골프 5일" };
      if (selector === ".card-meta-text-location") return { textContent: "방콕" };
      return null;
    },
    closest(selector) {
      return selector === "[data-join-section]" ? section : null;
    }
  };
  const target = {
    closest(selector) {
      if (selector.includes(".join-card")) return card;
      if (selector.includes("button")) return null;
      if (selector === "[data-hero-banner-id]") return null;
      return null;
    }
  };

  setDetailModalOpen(false);
  listeners.get("click")({ target });
  setDetailModalOpen(true);
  runTimers();

  const detail = calls.find(([, event]) => event === "golfjoin_section_detail_view");
  const selection = calls.find(([, event]) => event === "select_item");
  assert.ok(selection);
  assert.equal(selection[2].item_list_id, "home_soon");
  assert.equal(selection[2].item_list_name, "곧 출발해요");
  assert.deepEqual(JSON.parse(JSON.stringify(selection[2].items)), [{
    item_id: "sch_soon_1",
    item_name: "태국 방콕 골프 5일",
    item_category: "방콕",
    item_type: "join_schedule",
    item_list_id: "home_soon",
    item_list_name: "곧 출발해요",
    index: 0
  }]);
  assert.ok(detail);
  assert.equal(detail[2].section_name, "soon");
  assert.equal(detail[2].source_area, "soon");
  assert.equal(detail[2].member_state, "guest");
});

test("스와이프 등으로 카드 클릭 뒤 상세가 열리지 않으면 섹션 상세 이벤트를 만들지 않는다", () => {
  const { calls, listeners, runTimers, setDetailModalOpen, window } = loadAnalytics();
  window.markGolfJoinGa4MemberStateReady();
  const section = { dataset: { joinSection: "mdpick" }, id: "join-section-mdpick" };
  const card = {
    closest(selector) {
      return selector === "[data-join-section]" ? section : null;
    }
  };
  const target = {
    closest(selector) {
      if (selector.includes(".join-card")) return card;
      if (selector.includes("button")) return card;
      if (selector === "[data-hero-banner-id]") return null;
      return null;
    }
  };

  setDetailModalOpen(false);
  listeners.get("click")({ target });
  runTimers();

  assert.equal(calls.some(([, event]) => event === "golfjoin_section_detail_view"), false);
  assert.equal(calls.some(([, event]) => event === "select_item"), false);
});

test("섹션 상품 목록 노출은 표준 view_item_list로 한 번만 기록한다", () => {
  const { calls, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  const section = {
    dataset: { joinSection: "mdpick" },
    id: "join-section-mdpick",
    getBoundingClientRect() {
      return { top: 100, left: 0, right: 1200, bottom: 700, width: 1200, height: 600 };
    },
    querySelector(selector) {
      return selector.includes("join-product-section-title") ? { textContent: "MD PICK 추천여행" } : null;
    },
    querySelectorAll() {
      return cards;
    }
  };
  function makeCard(id, title, region) {
    return {
      dataset: {},
      getAttribute(name) {
        return name === "onclick" ? `openMdPickProductDetail('${id}', 'thailand')` : "";
      },
      matches(selector) {
        return selector === ".join-mdpick-card, .join-mdpick-theme-card";
      },
      closest(selector) {
        return selector === "[data-join-section]" ? section : null;
      },
      querySelector(selector) {
        if (selector === "img") return { alt: title };
        if (selector === ".join-mdpick-region") return { textContent: region };
        return null;
      }
    };
  }
  const cards = [
    makeCard("good-101", "방콕 골프 5일", "방콕"),
    makeCard("good-102", "치앙마이 골프 5일", "치앙마이")
  ];

  window.trackGolfJoinGa4SectionItemList(section);
  window.trackGolfJoinGa4SectionItemList(section);

  const listViews = calls.filter(([, event]) => event === "view_item_list");
  assert.equal(listViews.length, 1);
  assert.equal(listViews[0][2].item_list_id, "home_mdpick");
  assert.equal(listViews[0][2].items.length, 2);
  assert.equal(listViews[0][2].items[0].item_type, "product");
  assert.equal(listViews[0][2].items[1].index, 1);
});

test("여행지 검색 결과 카드는 destination_search 목록의 select_item으로 기록한다", () => {
  const { calls, document, listeners, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  window.markGolfJoinGa4MemberStateReady();
  const originalQuerySelector = document.querySelector.bind(document);
  document.querySelector = (selector) => {
    if (selector === "#regionSearchModal .region-search-shell") {
      return { classList: { contains(value) { return value === "mdpick-context"; } } };
    }
    return originalQuerySelector(selector);
  };
  const card = {
    dataset: {},
    parentElement: { querySelectorAll() { return [card]; } },
    getAttribute(name) {
      return name === "onclick" ? "openMdPickProductDetailFromRegion('good-501', 'japan')" : "";
    },
    matches() {
      return false;
    },
    closest() {
      return null;
    },
    querySelector(selector) {
      if (selector === "img") return { alt: "미야자키 골프 3일" };
      if (selector === ".region-product-location") return { textContent: "미야자키" };
      return null;
    }
  };
  const target = {
    closest(selector) {
      if (selector === "#regionSearchResults .region-product-card") return card;
      return null;
    }
  };

  listeners.get("click")({ target });

  const selection = calls.find(([, event]) => event === "select_item");
  assert.ok(selection);
  assert.equal(selection[2].item_list_id, "destination_search_mdpick");
  assert.equal(selection[2].source_area, "destination_search");
  assert.equal(selection[2].items[0].item_id, "good-501");
});

test("히어로 배너 노출은 배너별 한 번, 실제 선택은 매번 기록한다", () => {
  const { calls, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  window.markGolfJoinGa4MemberStateReady();
  const slide = {
    dataset: { heroBannerId: "hero_august" },
    querySelector(selector) {
      return selector === "img" ? { alt: "8월 골프조인 기획전" } : null;
    }
  };

  window.trackGolfJoinGa4PromotionView(slide);
  window.trackGolfJoinGa4PromotionView(slide);
  window.trackGolfJoinGa4PromotionSelect(slide);

  assert.equal(calls.filter(([, event]) => event === "view_promotion").length, 1);
  assert.equal(calls.filter(([, event]) => event === "select_promotion").length, 1);
  const view = calls.find(([, event]) => event === "view_promotion");
  assert.equal(view[2].promotion_id, "hero_august");
  assert.equal(view[2].promotion_name, "8월 골프조인 기획전");
});

test("히어로 스와이프로 취소된 클릭은 배너 선택으로 기록하지 않는다", () => {
  const { calls, listeners, runTimers, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  window.markGolfJoinGa4MemberStateReady();
  const slide = {
    dataset: { heroBannerId: "hero_swipe" },
    querySelector(selector) {
      return selector === "img" ? { alt: "스와이프 배너" } : null;
    }
  };
  const target = {
    closest(selector) {
      return selector === "[data-hero-banner-id]" ? slide : null;
    }
  };

  listeners.get("click")({ target, defaultPrevented: true });
  runTimers();
  assert.equal(calls.some(([, event]) => event === "select_promotion"), false);

  listeners.get("click")({ target, defaultPrevented: false });
  runTimers();
  assert.equal(calls.filter(([, event]) => event === "select_promotion").length, 1);
});

test("신청 완료는 flow_type을 포함한 generate_lead로 전송한다", () => {
  const { calls, window } = loadAnalytics("?eventPlanSeq=3&page=1", {
    isLogin: true,
    member: { memberSeq: "30002268", memberChannel: "KAKAO" }
  });
  window.trackGolfJoinGa4Event("golfjoin_apply_complete", {
    item_id: "sch_456",
    item_name: "다낭 골프 5일",
    item_category: "베트남",
    item_type: "join_schedule",
    source_area: "detail",
    apply_step: "Complete Step",
    participant_count: 99
  });

  const [, event, parameters] = calls.at(-1);
  assert.equal(event, "generate_lead");
  assert.equal(parameters.flow_type, "join_apply");
  assert.equal(parameters.participant_count, 20);
  assert.equal(parameters.member_state, "kakao");
  assert.equal(parameters.source_area, "detail");
  assert.equal(parameters.apply_step, "complete_step");
  assert.equal(parameters.debug_mode, undefined);
  assert.equal(parameters.send_to, "golfjoin");
  assert.deepEqual(JSON.parse(JSON.stringify(parameters.items)), [{
    item_id: "sch_456",
    item_name: "다낭 골프 5일",
    item_category: "베트남",
    item_type: "join_schedule"
  }]);
  assert.equal("item_id" in parameters, false);
  assert.equal("item_name" in parameters, false);
});

test("참여 신청·새 모임 내부 단계는 익명화된 맞춤 측정기준으로 전송한다", () => {
  const { calls, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  window.trackGolfJoinGa4Event("golfjoin_apply_step_view", {
    apply_step: "Form View",
    flow_type: "join_apply",
    source_area: "detail",
    name: "홍길동",
    phone: "01012345678"
  });
  window.trackGolfJoinGa4Event("golfjoin_create_step_view", {
    builder_step: "Destination Selection",
    flow_type: "new_schedule",
    source_area: "builder"
  });

  const apply = calls.find(([, event]) => event === "golfjoin_apply_step_view");
  const builder = calls.find(([, event]) => event === "golfjoin_create_step_view");
  assert.equal(apply[2].apply_step, "form_view");
  assert.equal(apply[2].flow_type, "join_apply");
  assert.equal("name" in apply[2], false);
  assert.equal("phone" in apply[2], false);
  assert.equal(builder[2].builder_step, "destination_selection");
  assert.equal(builder[2].flow_type, "new_schedule");
});

test("신청 실패는 완료 이벤트를 만들지 않고 오류 유형만 익명화해 전송한다", () => {
  const { calls, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  window.trackGolfJoinGa4Event("golfjoin_apply_error", {
    flow_type: "join_apply",
    source_area: "detail",
    error_type: "HTTP 502 / Sync Failed",
    memberSeq: "30009999",
    memberMobile: "01012345678",
    email: "private@example.com"
  });

  const events = calls.filter(([command]) => command === "event");
  assert.equal(events.filter(([, event]) => event === "generate_lead").length, 0);
  const [, event, parameters] = events.at(-1);
  assert.equal(event, "golfjoin_apply_error");
  assert.equal(parameters.flow_type, "join_apply");
  assert.equal(parameters.source_area, "detail");
  assert.equal(parameters.error_type, "http_502_sync_failed");
  assert.equal("memberSeq" in parameters, false);
  assert.equal("memberMobile" in parameters, false);
  assert.equal("email" in parameters, false);
});

test("일정 참조가 사라져도 상품 파라미터 정규화가 신청 완료 흐름을 중단하지 않는다", () => {
  const { window } = loadAnalytics("?eventPlanSeq=3&page=1");
  assert.deepEqual(JSON.parse(JSON.stringify(window.getGolfJoinGa4Item(null))), {
    item_id: "",
    item_name: "",
    item_category: ""
  });
});

test("같은 저장 식별키의 완료 이벤트는 현재 화면 수명 동안 한 번만 전송한다", () => {
  const { calls, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  const first = window.trackGolfJoinGa4EventOnce(
    "join_apply:ja_test_1",
    "golfjoin_apply_complete",
    { participant_count: 2 }
  );
  const second = window.trackGolfJoinGa4EventOnce(
    "join_apply:ja_test_1",
    "golfjoin_apply_complete",
    { participant_count: 2 }
  );

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(calls.filter(([, event]) => event === "generate_lead").length, 1);
});

test("로그인·가입 완료는 리디렉션 전에도 확정된 회원 유형을 명시할 수 있다", () => {
  const { calls, window } = loadAnalytics("?eventPlanSeq=3&page=1");
  window.trackGolfJoinGa4Event("login", {
    method: "email",
    member_state: "homepage"
  });

  const [, event, parameters] = calls.at(-1);
  assert.equal(event, "login");
  assert.equal(parameters.method, "email");
  assert.equal(parameters.member_state, "homepage");
});
