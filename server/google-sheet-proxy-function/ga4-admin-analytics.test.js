"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeGa4DateRange,
  normalizeGa4ComparisonRange,
  normalizeGa4Filters,
  buildGa4OverviewRequest,
  buildGa4DashboardRequests,
  buildGa4OverviewPayload,
  buildGa4DashboardPayload,
  buildGa4InternalFunnel,
  buildGa4EventFunnel,
  buildGa4LoginReturnActions,
  buildGa4CompletionValidation,
  buildGa4AnalysisReadiness,
  createGa4AdminAnalyticsService
} = require("./ga4-admin-analytics");

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload);
    }
  };
}

const REPORT = {
  dimensionHeaders: [{ name: "eventName" }],
  metricHeaders: [{ name: "activeUsers" }, { name: "eventCount" }],
  rows: [
    { dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "20" }, { value: "30" }] },
    { dimensionValues: [{ value: "view_item" }], metricValues: [{ value: "10" }, { value: "15" }] },
    { dimensionValues: [{ value: "begin_checkout" }], metricValues: [{ value: "4" }, { value: "5" }] },
    { dimensionValues: [{ value: "join_apply_complete" }], metricValues: [{ value: "2" }, { value: "2" }] },
    { dimensionValues: [{ value: "golfjoin_create_start" }], metricValues: [{ value: "5" }, { value: "6" }] },
    { dimensionValues: [{ value: "new_schedule_complete" }], metricValues: [{ value: "1" }, { value: "1" }] },
    { dimensionValues: [{ value: "unapproved_private_event" }], metricValues: [{ value: "99" }, { value: "99" }] }
  ],
  rowCount: 7,
  metadata: { dataLossFromOtherRow: false }
};

function report(dimensions, metrics, rows) {
  return {
    dimensionHeaders: dimensions.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows: rows.map(({ dimensions: dimensionValues, metrics: metricValues }) => ({
      dimensionValues: dimensionValues.map((value) => ({ value: String(value) })),
      metricValues: metricValues.map((value) => ({ value: String(value) }))
    })),
    rowCount: rows.length,
    metadata: { dataLossFromOtherRow: false, subjectToThresholding: false }
  };
}

const DASHBOARD_REPORTS = {
  sections: report(
    ["customEvent:section_name", "customEvent:source_area", "eventName"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["mdpick", "home", "golfjoin_section_view"], metrics: [20, 22] },
      { dimensions: ["(not set)", "mdpick", "select_item"], metrics: [8, 9] },
      { dimensions: ["mdpick", "mdpick", "golfjoin_section_detail_view"], metrics: [7, 8] },
      { dimensions: ["soon", "home", "golfjoin_section_view"], metrics: [10, 11] },
      { dimensions: ["(not set)", "soon", "select_item"], metrics: [4, 4] },
      { dimensions: ["soon", "soon", "golfjoin_section_detail_view"], metrics: [3, 3] },
      { dimensions: ["new_schedule", "home", "golfjoin_section_view"], metrics: [30, 32] },
      { dimensions: ["(not set)", "new_schedule", "select_item"], metrics: [12, 13] }
    ]
  ),
  devices: report(
    ["deviceCategory", "eventName"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["mobile", "page_view"], metrics: [15, 20] },
      { dimensions: ["mobile", "view_item"], metrics: [6, 8] },
      { dimensions: ["mobile", "begin_checkout"], metrics: [2, 2] },
      { dimensions: ["mobile", "join_apply_complete"], metrics: [1, 1] },
      { dimensions: ["desktop", "page_view"], metrics: [5, 8] },
      { dimensions: ["desktop", "view_item"], metrics: [4, 5] }
    ]
  ),
  members: report(
    ["customEvent:member_state", "eventName"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["guest", "page_view"], metrics: [12, 18] },
      { dimensions: ["guest", "view_item"], metrics: [3, 4] },
      { dimensions: ["kakao", "page_view"], metrics: [8, 10] },
      { dimensions: ["kakao", "view_item"], metrics: [7, 8] },
      { dimensions: ["kakao", "begin_checkout"], metrics: [2, 2] }
    ]
  ),
  trend: report(
    ["date", "eventName"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["20260831", "page_view"], metrics: [9, 12] },
      { dimensions: ["20260831", "view_item"], metrics: [4, 5] },
      { dimensions: ["20260901", "page_view"], metrics: [11, 16] },
      { dimensions: ["20260901", "view_item"], metrics: [6, 8] }
    ]
  ),
  acquisition: report(
    ["sessionSourceMedium", "sessionCampaignName"],
    ["activeUsers", "sessions"],
    [
      { dimensions: ["google / organic", "(organic)"], metrics: [13, 18] },
      { dimensions: ["(direct) / (none)", "(not set)"], metrics: [7, 9] }
    ]
  ),
  applySteps: report(
    ["customEvent:apply_step", "eventName"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["form_view", "golfjoin_apply_step_view"], metrics: [8, 10] },
      { dimensions: ["review", "golfjoin_apply_step_view"], metrics: [6, 7] },
      { dimensions: ["submit_start", "golfjoin_apply_step_view"], metrics: [4, 4] },
      { dimensions: ["complete", "golfjoin_apply_step_view"], metrics: [3, 3] }
    ]
  ),
  builderSteps: report(
    ["customEvent:builder_step", "eventName"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["date_selection", "golfjoin_create_step_view"], metrics: [10, 12] },
      { dimensions: ["destination_selection", "golfjoin_create_step_view"], metrics: [9, 10] },
      { dimensions: ["participant_info", "golfjoin_create_step_view"], metrics: [7, 8] },
      { dimensions: ["review", "golfjoin_create_step_view"], metrics: [5, 5] },
      { dimensions: ["submit_start", "golfjoin_create_step_view"], metrics: [4, 4] },
      { dimensions: ["complete", "golfjoin_create_step_view"], metrics: [2, 2] }
    ]
  ),
  searchFunnel: report(
    ["eventName", "customEvent:source_area"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["golfjoin_destination_search_open", "main"], metrics: [12, 16] },
      { dimensions: ["golfjoin_destination_search_submit", "main"], metrics: [8, 10] },
      { dimensions: ["view_item_list", "destination_search"], metrics: [6, 7] },
      { dimensions: ["select_item", "destination_search"], metrics: [4, 5] },
      { dimensions: ["view_item", "destination_search"], metrics: [3, 3] },
      { dimensions: ["view_item", "home"], metrics: [20, 30] }
    ]
  ),
  loginFunnel: report(
    ["eventName"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["golfjoin_login_required"], metrics: [5, 7] },
      { dimensions: ["golfjoin_login_start"], metrics: [4, 5] },
      { dimensions: ["login"], metrics: [3, 3] },
      { dimensions: ["golfjoin_login_return_complete"], metrics: [3, 3] }
    ]
  ),
  loginReturnActions: report(
    ["customEvent:return_action", "eventName"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["builder", "golfjoin_login_required"], metrics: [3, 4] },
      { dimensions: ["builder", "golfjoin_login_return_complete"], metrics: [2, 2] },
      { dimensions: ["apply", "golfjoin_login_required"], metrics: [2, 3] },
      { dimensions: ["apply", "golfjoin_login_return_complete"], metrics: [1, 1] }
    ]
  )
};

function getDashboardReportsForBatch(requests = []) {
  return requests.map((request) => {
    const dimensions = (request.dimensions || []).map((item) => item.name).join(",");
    if (dimensions.includes("section_name")) return DASHBOARD_REPORTS.sections;
    if (dimensions === "deviceCategory,eventName") return DASHBOARD_REPORTS.devices;
    if (dimensions.includes("member_state")) return DASHBOARD_REPORTS.members;
    if (dimensions.startsWith("date,")) return DASHBOARD_REPORTS.trend;
    if (dimensions.includes("sessionSourceMedium")) return DASHBOARD_REPORTS.acquisition;
    if (dimensions.includes("apply_step")) return DASHBOARD_REPORTS.applySteps;
    if (dimensions.includes("builder_step")) return DASHBOARD_REPORTS.builderSteps;
    if (dimensions === "eventName,customEvent:source_area") return DASHBOARD_REPORTS.searchFunnel;
    if (dimensions === "eventName") return DASHBOARD_REPORTS.loginFunnel;
    if (dimensions.includes("return_action")) return DASHBOARD_REPORTS.loginReturnActions;
    throw new Error(`unexpected dashboard dimensions: ${dimensions}`);
  });
}

test("최근 기간과 직접 선택 기간을 안전하게 정규화한다", () => {
  assert.deepEqual(normalizeGa4DateRange({ days: 7 }), {
    startDate: "6daysAgo",
    endDate: "today",
    days: 7
  });
  assert.deepEqual(normalizeGa4DateRange({ startDate: "2026-08-01", endDate: "2026-08-31" }), {
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    days: null
  });
  assert.equal(normalizeGa4DateRange({ days: 999 }).days, 90);
  assert.equal(normalizeGa4DateRange({ startDate: "2026-01-01", endDate: "2026-08-31" }).days, 7);
  assert.equal(normalizeGa4DateRange({ startDate: "2026-02-31", endDate: "2026-03-01" }).days, 7);
});

test("이전 기간은 현재 기간과 겹치지 않는 동일 길이로 계산한다", () => {
  assert.deepEqual(normalizeGa4ComparisonRange({ days: 7, compare: "1" }), {
    startDate: "13daysAgo",
    endDate: "7daysAgo",
    days: 7
  });
  assert.deepEqual(normalizeGa4ComparisonRange({
    startDate: "2026-08-25",
    endDate: "2026-08-31",
    compare: true
  }), {
    startDate: "2026-08-18",
    endDate: "2026-08-24",
    days: null
  });
  assert.equal(normalizeGa4ComparisonRange({ days: 7 }), null);
});

test("기기·회원상태·유입경로 필터를 허용된 집계값으로 정규화한다", () => {
  assert.deepEqual(normalizeGa4Filters({
    device: "MOBILE",
    memberState: "kakao",
    sourceMedium: " google / organic\n"
  }), {
    device: "mobile",
    memberState: "kakao",
    sourceMedium: "google / organic"
  });
  assert.deepEqual(normalizeGa4Filters({ device: "watch", memberState: "administrator" }), {
    device: "",
    memberState: "",
    sourceMedium: ""
  });
});

test("GA4 요청은 허용 이벤트와 집계 지표만 포함한다", () => {
  const request = buildGa4OverviewRequest({ days: 30 });
  assert.equal(request.body.dimensions[0].name, "eventName");
  assert.deepEqual(request.body.metrics.map((item) => item.name), ["activeUsers", "eventCount"]);
  assert.ok(request.body.dimensionFilter.filter.inListFilter.values.includes("join_apply_complete"));
  assert.equal(request.body.dimensionFilter.filter.inListFilter.values.includes("member_id"), false);
});

test("상세 대시보드는 열 개 집계 보고서를 구성하고 개인 식별자를 포함하지 않는다", () => {
  const request = buildGa4DashboardRequests({ days: 30 });
  assert.equal(request.reports.length, 10);
  assert.deepEqual(request.reports.map((item) => item.name), ["sections", "devices", "members", "trend", "acquisition", "applySteps", "builderSteps", "searchFunnel", "loginFunnel", "loginReturnActions"]);
  assert.deepEqual(
    request.reports.find((item) => item.name === "acquisition").body.dimensions.map((item) => item.name),
    ["sessionSourceMedium", "sessionCampaignName"]
  );
  assert.doesNotMatch(JSON.stringify(request), /member_id|member_seq|email|mobile|userId/i);
});

test("상세 대시보드의 모든 보고서에 선택 필터를 AND 조건으로 적용한다", () => {
  const params = { days: 30, device: "mobile", memberState: "kakao", sourceMedium: "google / organic" };
  const overview = buildGa4OverviewRequest(params);
  const request = buildGa4DashboardRequests(params);
  [overview.body, ...request.reports.map((item) => item.body)].forEach((body) => {
    const expressions = body.dimensionFilter.andGroup.expressions;
    assert.deepEqual(expressions.slice(1).map((item) => item.filter.fieldName), [
      "deviceCategory",
      "customEvent:member_state",
      "sessionSourceMedium"
    ]);
    assert.equal(expressions[1].filter.stringFilter.value, "mobile");
    assert.equal(expressions[2].filter.stringFilter.value, "kakao");
    assert.equal(expressions[3].filter.stringFilter.value, "google / organic");
  });
  assert.deepEqual(request.filters, {
    device: "mobile",
    memberState: "kakao",
    sourceMedium: "google / organic"
  });
});

test("대시보드 요약은 분모·분자를 보존하고 허용 이벤트만 반환한다", () => {
  const payload = buildGa4OverviewPayload(REPORT, {
    propertyId: "552152254",
    generatedAt: "2026-09-01T00:00:00.000Z",
    dateRange: { startDate: "6daysAgo", endDate: "today", days: 7 }
  });
  assert.equal(payload.summary.visitors, 20);
  assert.equal(payload.summary.detailRate, 50);
  assert.equal(payload.summary.applyStartRate, 40);
  assert.equal(payload.summary.applyCompleteRate, 50);
  assert.equal(payload.summary.createCompleteRate, 20);
  assert.equal(payload.events.some((item) => item.eventName === "unapproved_private_event"), false);
});

test("상세 대시보드 응답은 섹션·기기·회원·일자·유입경로 집계를 안정적으로 구성한다", () => {
  const overview = buildGa4OverviewPayload(REPORT, {
    propertyId: "552152254",
    generatedAt: "2026-09-01T00:00:00.000Z",
    dateRange: { startDate: "6daysAgo", endDate: "today", days: 7 }
  });
  const payload = buildGa4DashboardPayload(overview, DASHBOARD_REPORTS, {
    propertyId: "552152254",
    generatedAt: "2026-09-01T00:00:00.000Z"
  });

  assert.equal(payload.schema, "golfjoin-ga4-admin-dashboard-v1");
  assert.deepEqual(payload.sections[0], {
    sectionName: "mdpick",
    sectionViewUsers: 20,
    itemSelectionUsers: 8,
    detailViewUsers: 7,
    eventCount: 39,
    selectionRate: 40,
    detailRate: 35
  });
  assert.equal(payload.devices.find((item) => item.key === "mobile").applyCompleteRate, 50);
  assert.equal(payload.members.find((item) => item.key === "guest").detailRate, 25);
  assert.equal(payload.trend[0].date, "2026-08-31");
  assert.equal(payload.acquisition[0].sourceMedium, "google / organic");
  assert.equal(payload.internalFunnels.apply.startUsers, 8);
  assert.equal(payload.internalFunnels.apply.completeUsers, 3);
  assert.equal(payload.internalFunnels.apply.completionRate, 37.5);
  assert.equal(payload.internalFunnels.apply.steps[0].dropOffUsers, 2);
  assert.equal(payload.internalFunnels.builder.steps[2].fromPreviousRate, 77.8);
  assert.equal(payload.journeyFunnels.search.startUsers, 12);
  assert.equal(payload.journeyFunnels.search.completeUsers, 3);
  assert.equal(payload.journeyFunnels.search.steps[4].fromPreviousRate, 75);
  assert.equal(payload.journeyFunnels.loginReturn.startUsers, 5);
  assert.equal(payload.journeyFunnels.loginReturn.completionRate, 60);
  assert.deepEqual(payload.loginReturnActions[0], {
    key: "builder",
    requiredUsers: 3,
    completeUsers: 2,
    eventCount: 6,
    completionRate: 66.7
  });
  assert.equal(payload.completionValidation.overallStatus, "verified");
  assert.equal(payload.completionValidation.verifiedFlows, 2);
  assert.deepEqual(
    payload.completionValidation.flows[0].checks.map((item) => [item.key, item.observed]),
    [["submit_start", true], ["step_complete", true], ["business_complete", true]]
  );
  assert.equal(payload.analysisReadiness.status, "collecting");
  assert.equal(payload.analysisReadiness.period.activeDataDays, 2);
  assert.equal(payload.analysisReadiness.metrics[0].denominator, 20);
  assert.equal(payload.sections.some((item) => item.sectionName === "new_schedule"), false);
  assert.equal(payload.comparisonAvailable, false);
  assert.equal(payload.quality.partial, false);
});

test("내부 퍼널은 정의된 단계만 순서대로 집계하고 독립 사용자 기준 감소를 계산한다", () => {
  const payload = buildGa4InternalFunnel(DASHBOARD_REPORTS.applySteps, {
    dimensionName: "customEvent:apply_step",
    eventName: "golfjoin_apply_step_view",
    definitions: [
      { key: "form_view", label: "신청서 진입" },
      { key: "review", label: "신청 내용 확인" },
      { key: "complete", label: "참여 신청 완료" }
    ]
  });
  assert.deepEqual(payload.steps.map((step) => step.key), ["form_view", "review", "complete"]);
  assert.equal(payload.steps[1].fromPreviousRate, 75);
  assert.equal(payload.steps[1].dropOffUsers, 3);
  assert.equal(payload.observedSteps, 3);
});

test("검색 퍼널은 메인 검색과 destination_search 후속 행동만 연결한다", () => {
  const payload = buildGa4EventFunnel(DASHBOARD_REPORTS.searchFunnel, [
    { key: "open", label: "검색 열기", eventName: "golfjoin_destination_search_open", sourceAreas: ["main"] },
    { key: "submit", label: "검색 실행", eventName: "golfjoin_destination_search_submit", sourceAreas: ["main"] },
    { key: "detail", label: "상세 열람", eventName: "view_item", sourceAreas: ["destination_search"] }
  ]);
  assert.deepEqual(payload.steps.map((step) => step.activeUsers), [12, 8, 3]);
  assert.equal(payload.completionRate, 25);
  assert.equal(payload.nonMonotonic, false);
  assert.equal(payload.actionable, true);
});

test("독립 이벤트 도달 사용자가 역전되면 100% 초과 비율 대신 진단 상태를 반환한다", () => {
  const reversed = report(
    ["eventName", "customEvent:source_area"],
    ["activeUsers", "eventCount"],
    [
      { dimensions: ["golfjoin_destination_search_open", "main"], metrics: [2, 2] },
      { dimensions: ["golfjoin_destination_search_submit", "main"], metrics: [5, 6] },
      { dimensions: ["view_item", "destination_search"], metrics: [3, 4] }
    ]
  );
  const payload = buildGa4EventFunnel(reversed, [
    { key: "open", label: "검색 열기", eventName: "golfjoin_destination_search_open", sourceAreas: ["main"] },
    { key: "submit", label: "검색 실행", eventName: "golfjoin_destination_search_submit", sourceAreas: ["main"] },
    { key: "detail", label: "상세 열람", eventName: "view_item", sourceAreas: ["destination_search"] }
  ]);

  assert.equal(payload.nonMonotonic, true);
  assert.equal(payload.actionable, false);
  assert.equal(payload.completionRate, null);
  assert.equal(payload.steps[1].fromPreviousRate, null);
  assert.equal(payload.steps[1].sequenceMismatch, true);
  assert.equal(payload.steps[0].dropOffRate, null);
  assert.equal(payload.diagnostic.code, "non_monotonic_active_users");
});

test("이전 기간 방문자가 0명이면 비교 가능 상태를 내리지 않는다", () => {
  const emptyComparison = buildGa4DashboardPayload({ summary: { visitors: 0 } }, {}, {});
  const populatedComparison = buildGa4DashboardPayload({ summary: { visitors: 9 } }, {}, {});
  const withoutData = buildGa4DashboardPayload({ summary: { visitors: 20 } }, {}, { comparison: emptyComparison });
  const withData = buildGa4DashboardPayload({ summary: { visitors: 20 } }, {}, { comparison: populatedComparison });

  assert.equal(withoutData.comparisonAvailable, false);
  assert.equal(withData.comparisonAvailable, true);
});

test("로그인 복귀 행동별 요구·완료 사용자를 개인정보 없이 비교한다", () => {
  const actions = buildGa4LoginReturnActions(DASHBOARD_REPORTS.loginReturnActions);
  assert.deepEqual(actions.map((item) => item.key), ["builder", "apply"]);
  assert.equal(actions[1].completionRate, 50);
  assert.doesNotMatch(JSON.stringify(actions), /member_id|email|mobile|birth/i);
});

test("완료 이벤트 검증은 수집 대기·부분 수집·신호 불일치를 구분한다", () => {
  const waiting = buildGa4CompletionValidation({}, {});
  assert.equal(waiting.overallStatus, "waiting");
  assert.equal(waiting.verifiedFlows, 0);

  const collecting = buildGa4CompletionValidation({}, {
    apply: { steps: [{ key: "submit_start", activeUsers: 2, eventCount: 2 }] }
  });
  assert.equal(collecting.flows[0].status, "collecting");

  const needsReview = buildGa4CompletionValidation({
    events: [{ eventName: "join_apply_complete", activeUsers: 1, eventCount: 1 }]
  }, {
    apply: { steps: [{ key: "complete", activeUsers: 1, eventCount: 1 }] }
  });
  assert.equal(needsReview.flows[0].status, "needs_review");
  assert.deepEqual(needsReview.flows[0].issueCodes, ["submit_start_missing"]);
  assert.doesNotMatch(JSON.stringify(needsReview), /member_id|email|mobile|birth/i);
});

test("분석 준비 상태는 기간·분모 30명·100명 기준과 분자·분모를 보존한다", () => {
  const readiness = buildGa4AnalysisReadiness({
    dateRange: { startDate: "6daysAgo", endDate: "today", days: 7 },
    summary: {
      visitors: 140,
      detailUsers: 65,
      detailRate: 46.4,
      applyStartUsers: 34,
      applyStartRate: 52.3,
      applyCompleteUsers: 8,
      applyCompleteRate: 23.5,
      createStartUsers: 25,
      createCompleteUsers: 5,
      createCompleteRate: 20
    }
  }, Array.from({ length: 7 }, (_, index) => ({ date: `2026-09-0${index + 1}`, visitors: 20 })));

  assert.equal(readiness.status, "collecting");
  assert.deepEqual(readiness.thresholds, {
    minimumDays: 7,
    directionalDenominator: 30,
    stableDenominator: 100
  });
  assert.equal(readiness.period.ready, true);
  assert.equal(readiness.directionalMetrics, 3);
  assert.equal(readiness.stableMetrics, 1);
  assert.deepEqual(
    readiness.metrics.map((metric) => [metric.key, metric.numerator, metric.denominator, metric.sampleStatus]),
    [
      ["detail_rate", 65, 140, "stable"],
      ["apply_start_rate", 34, 65, "directional"],
      ["apply_complete_rate", 8, 34, "directional"],
      ["create_complete_rate", 5, 25, "collecting"]
    ]
  );
  assert.doesNotMatch(JSON.stringify(readiness), /member_id|email|mobile|birth/i);
});

test("관리자 GA4 서비스는 서비스 계정 토큰·속성 ID를 사용하고 15분형 캐시를 재사용한다", async () => {
  let fetchCount = 0;
  let requestedUrl = "";
  let requestedBody = null;
  let clock = Date.parse("2026-09-01T00:00:00.000Z");
  const service = createGa4AdminAnalyticsService({
    propertyId: "552152254",
    getAccessToken: async () => "metadata-token",
    fetchWithTimeout: async (url, options) => {
      fetchCount += 1;
      requestedUrl = url;
      requestedBody = JSON.parse(options.body);
      assert.equal(options.headers.Authorization, "Bearer metadata-token");
      return response(REPORT);
    },
    now: () => clock,
    cacheTtlMs: 1_000,
    staleTtlMs: 10_000
  });

  const first = await service.requestOverview({ days: 7 });
  clock += 500;
  const second = await service.requestOverview({ days: 7 });

  assert.equal(fetchCount, 1);
  assert.match(requestedUrl, /properties\/552152254:runReport$/);
  assert.equal(requestedBody.dateRanges[0].startDate, "6daysAgo");
  assert.equal(first.cache.status, "miss");
  assert.equal(second.cache.status, "hit");
});

test("GA4 일시 실패 시 허용 시간 안의 마지막 정상 데이터만 반환한다", async () => {
  let clock = Date.parse("2026-09-01T00:00:00.000Z");
  let fail = false;
  const service = createGa4AdminAnalyticsService({
    propertyId: "552152254",
    getAccessToken: async () => "metadata-token",
    fetchWithTimeout: async () => fail ? response({ error: "denied" }, 503) : response(REPORT),
    now: () => clock,
    cacheTtlMs: 1_000,
    staleTtlMs: 10_000
  });

  const first = await service.requestOverview({ days: 7 });
  fail = true;
  clock += 2_000;
  const stale = await service.requestOverview({ days: 7 });

  assert.equal(first.cache.status, "miss");
  assert.equal(stale.cache.status, "stale");
  assert.equal(stale.summary.visitors, 20);
  assert.equal(stale.warning.code, "ga4_data_api_failed");
  assert.doesNotMatch(stale.warning.message, /denied|token/i);
});

test("상세 대시보드는 개요와 열 개 보고서를 5개 이하 배치로 호출하고 캐시를 재사용한다", async () => {
  let fetchCount = 0;
  let clock = Date.parse("2026-09-01T00:00:00.000Z");
  const service = createGa4AdminAnalyticsService({
    propertyId: "552152254",
    getAccessToken: async () => "metadata-token",
    fetchWithTimeout: async (url, options) => {
      fetchCount += 1;
      assert.equal(options.headers.Authorization, "Bearer metadata-token");
      if (url.endsWith(":batchRunReports")) {
        const body = JSON.parse(options.body);
        assert.ok(body.requests.length <= 5);
        return response({ reports: getDashboardReportsForBatch(body.requests) });
      }
      return response(REPORT);
    },
    now: () => clock,
    cacheTtlMs: 1_000,
    staleTtlMs: 10_000
  });

  const first = await service.requestDashboard({ days: 7 });
  clock += 500;
  const second = await service.requestDashboard({ days: 7 });

  assert.equal(fetchCount, 3);
  assert.equal(first.cache.status, "miss");
  assert.equal(second.cache.status, "hit");
  assert.equal(first.sections[0].sectionName, "mdpick");
});

test("비교 요청은 직전 동일 기간을 집계하고 필터별 캐시를 분리한다", async () => {
  let fetchCount = 0;
  const requestBodies = [];
  const service = createGa4AdminAnalyticsService({
    propertyId: "552152254",
    getAccessToken: async () => "metadata-token",
    fetchWithTimeout: async (url, options) => {
      fetchCount += 1;
      const body = JSON.parse(options.body);
      requestBodies.push(body);
      if (url.endsWith(":batchRunReports")) return response({ reports: getDashboardReportsForBatch(body.requests) });
      return response(REPORT);
    },
    now: () => Date.parse("2026-09-01T00:00:00.000Z")
  });

  const mobile = await service.requestDashboard({ days: 7, compare: "1", device: "mobile" });
  const desktop = await service.requestDashboard({ days: 7, compare: "1", device: "desktop" });

  assert.equal(fetchCount, 12);
  assert.equal(mobile.comparison.dateRange.startDate, "13daysAgo");
  assert.equal(mobile.comparison.dateRange.endDate, "7daysAgo");
  assert.equal(mobile.comparison.summary.visitors, 20);
  assert.equal(mobile.filters.device, "mobile");
  assert.equal(desktop.filters.device, "desktop");
  assert.ok(requestBodies.some((body) => body.dateRanges?.[0]?.startDate === "13daysAgo"));
  assert.ok(requestBodies.some((body) => body.dateRanges?.[0]?.endDate === "7daysAgo"));
});

test("배치 호출 실패 시 개별 보고서로 복구하고 실패한 영역만 partial 처리한다", async () => {
  const service = createGa4AdminAnalyticsService({
    propertyId: "552152254",
    getAccessToken: async () => "metadata-token",
    fetchWithTimeout: async (url, options) => {
      if (url.endsWith(":batchRunReports")) return response({ error: "temporary" }, 503);
      const body = JSON.parse(options.body);
      const dimensions = body.dimensions.map((item) => item.name).join(",");
      if (dimensions === "eventName") return response(REPORT);
      if (dimensions.includes("member_state")) return response({ error: "denied" }, 403);
      if (dimensions.includes("section_name")) return response(DASHBOARD_REPORTS.sections);
      if (dimensions.includes("deviceCategory")) return response(DASHBOARD_REPORTS.devices);
      if (dimensions.startsWith("date,")) return response(DASHBOARD_REPORTS.trend);
      if (dimensions.includes("apply_step")) return response(DASHBOARD_REPORTS.applySteps);
      if (dimensions.includes("builder_step")) return response(DASHBOARD_REPORTS.builderSteps);
      if (dimensions === "eventName,customEvent:source_area") return response(DASHBOARD_REPORTS.searchFunnel);
      if (dimensions === "eventName") return response(DASHBOARD_REPORTS.loginFunnel);
      if (dimensions.includes("return_action")) return response(DASHBOARD_REPORTS.loginReturnActions);
      return response(DASHBOARD_REPORTS.acquisition);
    },
    now: () => Date.parse("2026-09-01T00:00:00.000Z")
  });

  const payload = await service.requestDashboard({ days: 7 });
  assert.equal(payload.quality.partial, true);
  assert.equal(payload.members.length, 0);
  assert.equal(payload.sections[0].sectionName, "mdpick");
  assert.equal(payload.internalFunnels.apply.completeUsers, 3);
  assert.deepEqual(payload.warnings.map((item) => item.report), ["members"]);
  assert.doesNotMatch(JSON.stringify(payload.warnings), /denied|token/i);
});
