"use strict";

const DEFAULT_EVENT_NAMES = Object.freeze([
  "page_view",
  "view_item_list",
  "select_item",
  "view_item",
  "begin_checkout",
  "join_apply_complete",
  "golfjoin_create_start",
  "new_schedule_complete",
  "golfjoin_section_view",
  "golfjoin_section_detail_view",
  "golfjoin_destination_search_open",
  "golfjoin_destination_search_submit",
  "golfjoin_login_required",
  "golfjoin_login_start",
  "login",
  "golfjoin_login_return_complete",
  "view_promotion",
  "select_promotion"
]);
const FUNNEL_EVENT_NAMES = Object.freeze([
  "page_view",
  "view_item",
  "begin_checkout",
  "join_apply_complete",
  "golfjoin_create_start",
  "new_schedule_complete"
]);
const SECTION_EVENT_NAMES = Object.freeze([
  "golfjoin_section_view",
  "select_item",
  "golfjoin_section_detail_view"
]);
const SEARCH_FUNNEL_EVENT_NAMES = Object.freeze([
  "golfjoin_destination_search_open",
  "golfjoin_destination_search_submit",
  "view_item_list",
  "select_item",
  "view_item"
]);
const LOGIN_RETURN_FUNNEL_EVENT_NAMES = Object.freeze([
  "golfjoin_login_required",
  "golfjoin_login_start",
  "login",
  "golfjoin_login_return_complete"
]);
const LOGIN_RETURN_ACTION_EVENT_NAMES = Object.freeze([
  "golfjoin_login_required",
  "golfjoin_login_return_complete"
]);
const SEARCH_FUNNEL_STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "open", label: "검색 열기", eventName: "golfjoin_destination_search_open", sourceAreas: ["main"] }),
  Object.freeze({ key: "submit", label: "검색 실행", eventName: "golfjoin_destination_search_submit", sourceAreas: ["main"] }),
  Object.freeze({ key: "list_view", label: "결과 노출", eventName: "view_item_list", sourceAreas: ["destination_search"] }),
  Object.freeze({ key: "item_select", label: "상품 선택", eventName: "select_item", sourceAreas: ["destination_search"] }),
  Object.freeze({ key: "detail_view", label: "상세 열람", eventName: "view_item", sourceAreas: ["destination_search"] })
]);
const LOGIN_RETURN_FUNNEL_STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "required", label: "로그인 요구", eventName: "golfjoin_login_required" }),
  Object.freeze({ key: "start", label: "로그인 시작", eventName: "golfjoin_login_start" }),
  Object.freeze({ key: "success", label: "로그인 성공", eventName: "login" }),
  Object.freeze({ key: "return_complete", label: "원래 행동 복귀", eventName: "golfjoin_login_return_complete" })
]);
const APPLY_STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "form_view", label: "신청서 진입" }),
  Object.freeze({ key: "review", label: "신청 내용 확인" }),
  Object.freeze({ key: "submit_start", label: "신청 제출 시작" }),
  Object.freeze({ key: "complete", label: "참여 신청 완료" })
]);
const BUILDER_STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "date_selection", label: "날짜 선택" }),
  Object.freeze({ key: "destination_selection", label: "여행지 선택" }),
  Object.freeze({ key: "participant_info", label: "참여자 정보" }),
  Object.freeze({ key: "review", label: "생성 내용 확인" }),
  Object.freeze({ key: "submit_start", label: "생성 제출 시작" }),
  Object.freeze({ key: "complete", label: "새 모임 생성 완료" })
]);
const GA4_DASHBOARD_REPORT_NAMES = Object.freeze([
  "sections",
  "devices",
  "members",
  "trend",
  "acquisition",
  "applySteps",
  "builderSteps",
  "searchFunnel",
  "loginFunnel",
  "loginReturnActions"
]);
const GA4_DEVICE_FILTER_VALUES = Object.freeze(["mobile", "desktop", "tablet"]);
const GA4_MEMBER_FILTER_VALUES = Object.freeze(["guest", "homepage", "kakao", "member", "unknown"]);
const GA4_ANALYSIS_READINESS_THRESHOLDS = Object.freeze({
  minimumDays: 7,
  directionalDenominator: 30,
  stableDenominator: 100
});

function asText(value) {
  return String(value == null ? "" : value).trim();
}

function asCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(asText(value));
}

function parseIsoDate(value) {
  const text = asText(value);
  if (!isIsoDate(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

function formatIsoDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : "";
}

function getInclusiveDateDays(startDate, endDate) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || start > end) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function normalizeGa4DateRange(params = {}) {
  const internalRange = params.__dateRange;
  if (
    internalRange
    && typeof internalRange === "object"
    && (/^\d+daysAgo$/.test(asText(internalRange.startDate)) || isIsoDate(internalRange.startDate))
    && (/^(?:today|\d+daysAgo)$/.test(asText(internalRange.endDate)) || isIsoDate(internalRange.endDate))
  ) {
    return {
      startDate: asText(internalRange.startDate),
      endDate: asText(internalRange.endDate),
      days: Number.isFinite(Number(internalRange.days)) ? Number(internalRange.days) : null
    };
  }
  const startDate = asText(params.startDate);
  const endDate = asText(params.endDate);
  const explicitDays = getInclusiveDateDays(startDate, endDate);
  if (explicitDays && explicitDays <= 90) {
    return { startDate, endDate, days: null };
  }
  const days = clampInteger(params.days, 1, 90, 7);
  return {
    startDate: days === 1 ? "today" : `${days - 1}daysAgo`,
    endDate: "today",
    days
  };
}

function normalizeGa4ComparisonRange(params = {}, currentRange = normalizeGa4DateRange(params)) {
  const compare = [true, 1, "1", "true", "on", "yes"].includes(params.compare);
  if (!compare) return null;
  const explicitStart = asText(params.compareStartDate);
  const explicitEnd = asText(params.compareEndDate);
  const explicitDays = getInclusiveDateDays(explicitStart, explicitEnd);
  if (explicitDays && explicitDays <= 90) {
    return { startDate: explicitStart, endDate: explicitEnd, days: null };
  }
  if (currentRange.days) {
    const days = currentRange.days;
    return {
      startDate: `${days * 2 - 1}daysAgo`,
      endDate: `${days}daysAgo`,
      days
    };
  }
  const rangeDays = getInclusiveDateDays(currentRange.startDate, currentRange.endDate);
  const currentStart = parseIsoDate(currentRange.startDate);
  if (!rangeDays || !currentStart) return null;
  const previousEnd = new Date(currentStart.getTime() - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - (rangeDays - 1) * 86_400_000);
  return {
    startDate: formatIsoDate(previousStart),
    endDate: formatIsoDate(previousEnd),
    days: null
  };
}

function normalizeGa4Filters(params = {}) {
  const device = asText(params.device).toLowerCase();
  const memberState = asText(params.memberState).toLowerCase();
  const sourceMedium = normalizeLabel(params.sourceMedium, "");
  return {
    device: GA4_DEVICE_FILTER_VALUES.includes(device) ? device : "",
    memberState: GA4_MEMBER_FILTER_VALUES.includes(memberState) ? memberState : "",
    sourceMedium
  };
}

function createEventNameFilter(eventNames = DEFAULT_EVENT_NAMES) {
  return {
    filter: {
      fieldName: "eventName",
      inListFilter: {
        values: eventNames.map(asText).filter(Boolean),
        caseSensitive: true
      }
    }
  };
}

function createStringDimensionFilter(fieldName, value, caseSensitive = false) {
  return {
    filter: {
      fieldName,
      stringFilter: {
        matchType: "EXACT",
        value,
        caseSensitive
      }
    }
  };
}

function combineDimensionFilters(expressions = []) {
  const valid = expressions.filter(Boolean);
  if (valid.length <= 1) return valid[0] || undefined;
  return { andGroup: { expressions: valid } };
}

function createGa4DimensionFilter(eventNames, params = {}) {
  const filters = normalizeGa4Filters(params);
  return combineDimensionFilters([
    createEventNameFilter(eventNames),
    filters.device ? createStringDimensionFilter("deviceCategory", filters.device) : null,
    filters.memberState ? createStringDimensionFilter("customEvent:member_state", filters.memberState) : null,
    filters.sourceMedium ? createStringDimensionFilter("sessionSourceMedium", filters.sourceMedium) : null
  ]);
}

function buildGa4OverviewRequest(params = {}) {
  const dateRange = normalizeGa4DateRange(params);
  return {
    dateRange,
    filters: normalizeGa4Filters(params),
    body: {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "activeUsers" }, { name: "eventCount" }],
      dimensionFilter: createGa4DimensionFilter(DEFAULT_EVENT_NAMES, params),
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: "100",
      returnPropertyQuota: true
    }
  };
}

function buildGa4DashboardRequests(params = {}) {
  const dateRange = normalizeGa4DateRange(params);
  const dateRanges = [{ startDate: dateRange.startDate, endDate: dateRange.endDate }];
  const commonMetrics = [{ name: "activeUsers" }, { name: "eventCount" }];
  const funnelFilter = createGa4DimensionFilter(FUNNEL_EVENT_NAMES, params);
  return {
    dateRange,
    filters: normalizeGa4Filters(params),
    reports: [
      {
        name: "sections",
        body: {
          dateRanges,
          dimensions: [
            { name: "customEvent:section_name" },
            { name: "customEvent:source_area" },
            { name: "eventName" }
          ],
          metrics: commonMetrics,
          dimensionFilter: createGa4DimensionFilter(SECTION_EVENT_NAMES, params),
          limit: "250"
        }
      },
      {
        name: "devices",
        body: {
          dateRanges,
          dimensions: [{ name: "deviceCategory" }, { name: "eventName" }],
          metrics: commonMetrics,
          dimensionFilter: funnelFilter,
          limit: "100"
        }
      },
      {
        name: "members",
        body: {
          dateRanges,
          dimensions: [{ name: "customEvent:member_state" }, { name: "eventName" }],
          metrics: commonMetrics,
          dimensionFilter: funnelFilter,
          limit: "100"
        }
      },
      {
        name: "trend",
        body: {
          dateRanges,
          dimensions: [{ name: "date" }, { name: "eventName" }],
          metrics: commonMetrics,
          dimensionFilter: funnelFilter,
          orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
          limit: "1000"
        }
      },
      {
        name: "acquisition",
        body: {
          dateRanges,
          dimensions: [{ name: "sessionSourceMedium" }, { name: "sessionCampaignName" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          dimensionFilter: createGa4DimensionFilter(["page_view"], params),
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "50"
        }
      },
      {
        name: "applySteps",
        body: {
          dateRanges,
          dimensions: [{ name: "customEvent:apply_step" }, { name: "eventName" }],
          metrics: commonMetrics,
          dimensionFilter: createGa4DimensionFilter(["golfjoin_apply_step_view"], params),
          limit: "50"
        }
      },
      {
        name: "builderSteps",
        body: {
          dateRanges,
          dimensions: [{ name: "customEvent:builder_step" }, { name: "eventName" }],
          metrics: commonMetrics,
          dimensionFilter: createGa4DimensionFilter(["golfjoin_create_step_view"], params),
          limit: "50"
        }
      },
      {
        name: "searchFunnel",
        body: {
          dateRanges,
          dimensions: [{ name: "eventName" }, { name: "customEvent:source_area" }],
          metrics: commonMetrics,
          dimensionFilter: createGa4DimensionFilter(SEARCH_FUNNEL_EVENT_NAMES, params),
          limit: "100"
        }
      },
      {
        name: "loginFunnel",
        body: {
          dateRanges,
          dimensions: [{ name: "eventName" }],
          metrics: commonMetrics,
          dimensionFilter: createGa4DimensionFilter(LOGIN_RETURN_FUNNEL_EVENT_NAMES, params),
          limit: "50"
        }
      },
      {
        name: "loginReturnActions",
        body: {
          dateRanges,
          dimensions: [{ name: "customEvent:return_action" }, { name: "eventName" }],
          metrics: commonMetrics,
          dimensionFilter: createGa4DimensionFilter(LOGIN_RETURN_ACTION_EVENT_NAMES, params),
          limit: "100"
        }
      }
    ]
  };
}

function parseGa4ReportRows(payload = {}) {
  const dimensionHeaders = Array.isArray(payload.dimensionHeaders) ? payload.dimensionHeaders : [];
  const metricHeaders = Array.isArray(payload.metricHeaders) ? payload.metricHeaders : [];
  return (Array.isArray(payload.rows) ? payload.rows : []).map((row) => {
    const parsed = {};
    dimensionHeaders.forEach((header, index) => {
      parsed[asText(header?.name)] = asText(row?.dimensionValues?.[index]?.value);
    });
    metricHeaders.forEach((header, index) => {
      parsed[asText(header?.name)] = asCount(row?.metricValues?.[index]?.value);
    });
    return parsed;
  });
}

function rate(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function buildGa4OverviewPayload(payload = {}, options = {}) {
  const rows = parseGa4ReportRows(payload);
  const events = {};
  rows.forEach((row) => {
    const eventName = asText(row.eventName);
    if (!eventName || !DEFAULT_EVENT_NAMES.includes(eventName)) return;
    events[eventName] = {
      activeUsers: asCount(row.activeUsers),
      eventCount: asCount(row.eventCount)
    };
  });
  DEFAULT_EVENT_NAMES.forEach((eventName) => {
    if (!events[eventName]) events[eventName] = { activeUsers: 0, eventCount: 0 };
  });

  const visitors = events.page_view.activeUsers;
  const detailUsers = events.view_item.activeUsers;
  const applyStartUsers = events.begin_checkout.activeUsers;
  const applyCompleteUsers = events.join_apply_complete.activeUsers;
  const createStartUsers = events.golfjoin_create_start.activeUsers;
  const createCompleteUsers = events.new_schedule_complete.activeUsers;

  return {
    ok: true,
    schema: "golfjoin-ga4-admin-overview-v1",
    propertyId: asText(options.propertyId),
    generatedAt: asText(options.generatedAt),
    dateRange: options.dateRange || null,
    summary: {
      visitors,
      detailUsers,
      detailRate: rate(detailUsers, visitors),
      applyStartUsers,
      applyStartRate: rate(applyStartUsers, detailUsers),
      applyCompleteUsers,
      applyCompleteRate: rate(applyCompleteUsers, applyStartUsers),
      createStartUsers,
      createCompleteUsers,
      createCompleteRate: rate(createCompleteUsers, createStartUsers)
    },
    events: DEFAULT_EVENT_NAMES.map((eventName) => ({ eventName, ...events[eventName] })),
    quality: {
      dataLossFromOtherRow: Boolean(payload.metadata?.dataLossFromOtherRow),
      rowCount: asCount(payload.rowCount),
      thresholdingApplied: Boolean(payload.metadata?.subjectToThresholding)
    }
  };
}

function normalizeKey(value, fallback = "unknown") {
  const text = asText(value).toLowerCase();
  if (!text || /^\(.*\)$/.test(text)) return fallback;
  const normalized = text.replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
  return normalized || fallback;
}

function normalizeLabel(value, fallback = "(not set)") {
  const text = asText(value).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, 120) || fallback;
}

function createEmptyFunnelCounts() {
  return FUNNEL_EVENT_NAMES.reduce((counts, eventName) => {
    counts[eventName] = { activeUsers: 0, eventCount: 0 };
    return counts;
  }, {});
}

function summarizeFunnelCounts(events = {}) {
  const visitors = asCount(events.page_view?.activeUsers);
  const detailUsers = asCount(events.view_item?.activeUsers);
  const applyStartUsers = asCount(events.begin_checkout?.activeUsers);
  const applyCompleteUsers = asCount(events.join_apply_complete?.activeUsers);
  const createStartUsers = asCount(events.golfjoin_create_start?.activeUsers);
  const createCompleteUsers = asCount(events.new_schedule_complete?.activeUsers);
  return {
    visitors,
    detailUsers,
    detailRate: rate(detailUsers, visitors),
    applyStartUsers,
    applyStartRate: rate(applyStartUsers, detailUsers),
    applyCompleteUsers,
    applyCompleteRate: rate(applyCompleteUsers, applyStartUsers),
    createStartUsers,
    createCompleteUsers,
    createCompleteRate: rate(createCompleteUsers, createStartUsers)
  };
}

function buildGa4GroupedFunnel(payload = {}, dimensionName, normalizeDimension = normalizeKey) {
  const groups = new Map();
  parseGa4ReportRows(payload).forEach((row) => {
    const eventName = asText(row.eventName);
    if (!FUNNEL_EVENT_NAMES.includes(eventName)) return;
    const key = normalizeDimension(row[dimensionName]);
    if (!groups.has(key)) groups.set(key, createEmptyFunnelCounts());
    const event = groups.get(key)[eventName];
    event.activeUsers += asCount(row.activeUsers);
    event.eventCount += asCount(row.eventCount);
  });
  return Array.from(groups.entries())
    .map(([key, events]) => ({ key, ...summarizeFunnelCounts(events) }))
    .sort((a, b) => b.visitors - a.visitors || a.key.localeCompare(b.key));
}

function buildGa4Sections(payload = {}) {
  const excluded = new Set(["unknown", "home", "golfjoin_home", "detail", "builder", "main", "hero", "destination_search", "new_schedule"]);
  const sections = new Map();
  parseGa4ReportRows(payload).forEach((row) => {
    const eventName = asText(row.eventName);
    if (!SECTION_EVENT_NAMES.includes(eventName)) return;
    const sectionName = normalizeKey(row["customEvent:section_name"]);
    const sourceArea = normalizeKey(row["customEvent:source_area"]);
    const key = !excluded.has(sectionName) ? sectionName : sourceArea;
    if (excluded.has(key)) return;
    if (!sections.has(key)) {
      sections.set(key, {
        sectionName: key,
        sectionViewUsers: 0,
        itemSelectionUsers: 0,
        detailViewUsers: 0,
        eventCount: 0
      });
    }
    const section = sections.get(key);
    const users = asCount(row.activeUsers);
    section.eventCount += asCount(row.eventCount);
    if (eventName === "golfjoin_section_view") section.sectionViewUsers += users;
    if (eventName === "select_item") section.itemSelectionUsers += users;
    if (eventName === "golfjoin_section_detail_view") section.detailViewUsers += users;
  });
  return Array.from(sections.values())
    .map((section) => ({
      ...section,
      selectionRate: rate(section.itemSelectionUsers, section.sectionViewUsers),
      detailRate: rate(section.detailViewUsers, section.sectionViewUsers)
    }))
    .sort((a, b) => b.sectionViewUsers - a.sectionViewUsers || a.sectionName.localeCompare(b.sectionName));
}

function normalizeGa4Date(value) {
  const text = asText(value);
  const match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function buildGa4Trend(payload = {}) {
  return buildGa4GroupedFunnel(payload, "date", normalizeGa4Date)
    .filter((row) => row.key)
    .map(({ key, ...row }) => ({ date: key, ...row }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildGa4Acquisition(payload = {}) {
  return parseGa4ReportRows(payload)
    .map((row) => ({
      sourceMedium: normalizeLabel(row.sessionSourceMedium),
      campaign: normalizeLabel(row.sessionCampaignName),
      activeUsers: asCount(row.activeUsers),
      sessions: asCount(row.sessions)
    }))
    .filter((row) => row.activeUsers || row.sessions)
    .sort((a, b) => b.sessions - a.sessions || b.activeUsers - a.activeUsers)
    .slice(0, 25);
}

function buildGa4InternalFunnel(payload = {}, options = {}) {
  const dimensionName = asText(options.dimensionName);
  const eventName = asText(options.eventName);
  const definitions = Array.isArray(options.definitions) ? options.definitions : [];
  const allowedSteps = new Map(definitions.map((step) => [step.key, step]));
  const counts = new Map(definitions.map((step) => [step.key, { activeUsers: 0, eventCount: 0 }]));

  parseGa4ReportRows(payload).forEach((row) => {
    if (eventName && asText(row.eventName) !== eventName) return;
    const key = normalizeKey(row[dimensionName], "");
    if (!allowedSteps.has(key)) return;
    const count = counts.get(key);
    count.activeUsers += asCount(row.activeUsers);
    count.eventCount += asCount(row.eventCount);
  });

  const steps = definitions.map((definition, index) => {
    const current = counts.get(definition.key) || { activeUsers: 0, eventCount: 0 };
    const previous = index > 0 ? counts.get(definitions[index - 1].key) : null;
    const next = index < definitions.length - 1 ? counts.get(definitions[index + 1].key) : null;
    const dropOffUsers = next ? Math.max(0, current.activeUsers - next.activeUsers) : null;
    return {
      key: definition.key,
      label: definition.label,
      activeUsers: current.activeUsers,
      eventCount: current.eventCount,
      fromPreviousRate: previous ? rate(current.activeUsers, previous.activeUsers) : null,
      dropOffUsers,
      dropOffRate: next ? rate(dropOffUsers, current.activeUsers) : null
    };
  });
  const startUsers = steps[0]?.activeUsers || 0;
  const completeUsers = steps[steps.length - 1]?.activeUsers || 0;

  return {
    eventName,
    dimensionName,
    startUsers,
    completeUsers,
    completionRate: rate(completeUsers, startUsers),
    observedSteps: steps.filter((step) => step.activeUsers > 0).length,
    steps
  };
}

function buildGa4EventFunnel(payload = {}, definitions = []) {
  const counts = new Map(definitions.map((step) => [step.key, { activeUsers: 0, eventCount: 0 }]));
  parseGa4ReportRows(payload).forEach((row) => {
    const eventName = asText(row.eventName);
    const sourceArea = normalizeKey(row["customEvent:source_area"], "");
    definitions.forEach((definition) => {
      if (eventName !== definition.eventName) return;
      if (Array.isArray(definition.sourceAreas) && !definition.sourceAreas.includes(sourceArea)) return;
      const count = counts.get(definition.key);
      count.activeUsers += asCount(row.activeUsers);
      count.eventCount += asCount(row.eventCount);
    });
  });
  const steps = definitions.map((definition, index) => {
    const current = counts.get(definition.key) || { activeUsers: 0, eventCount: 0 };
    const previous = index > 0 ? counts.get(definitions[index - 1].key) : null;
    const next = index < definitions.length - 1 ? counts.get(definitions[index + 1].key) : null;
    const sequenceMismatch = Boolean(previous && current.activeUsers > previous.activeUsers);
    const nextSequenceMismatch = Boolean(next && next.activeUsers > current.activeUsers);
    const dropOffUsers = next && !nextSequenceMismatch ? current.activeUsers - next.activeUsers : null;
    return {
      key: definition.key,
      label: definition.label,
      eventName: definition.eventName,
      activeUsers: current.activeUsers,
      eventCount: current.eventCount,
      fromPreviousRate: previous && !sequenceMismatch ? rate(current.activeUsers, previous.activeUsers) : null,
      sequenceMismatch,
      dropOffUsers,
      dropOffRate: next && !nextSequenceMismatch ? rate(dropOffUsers, current.activeUsers) : null
    };
  });
  const startUsers = steps[0]?.activeUsers || 0;
  const completeUsers = steps[steps.length - 1]?.activeUsers || 0;
  const nonMonotonic = steps.some((step) => step.sequenceMismatch);
  return {
    startUsers,
    completeUsers,
    completionRate: nonMonotonic || completeUsers > startUsers ? null : rate(completeUsers, startUsers),
    observedSteps: steps.filter((step) => step.activeUsers > 0).length,
    measurementMode: "independent_event_reach",
    actionable: !nonMonotonic,
    nonMonotonic,
    diagnostic: nonMonotonic ? {
      code: "non_monotonic_active_users",
      message: "뒤 단계 사용자가 앞 단계보다 많아 순차 전환율을 표시하지 않습니다. 이벤트별 도달 사용자 수를 기준으로 수집 상태를 먼저 확인하세요."
    } : null,
    steps
  };
}

function buildGa4LoginReturnActions(payload = {}) {
  const actions = new Map();
  parseGa4ReportRows(payload).forEach((row) => {
    const eventName = asText(row.eventName);
    if (!LOGIN_RETURN_ACTION_EVENT_NAMES.includes(eventName)) return;
    const key = normalizeKey(row["customEvent:return_action"], "");
    if (!key) return;
    if (!actions.has(key)) {
      actions.set(key, { key, requiredUsers: 0, completeUsers: 0, eventCount: 0 });
    }
    const action = actions.get(key);
    const users = asCount(row.activeUsers);
    action.eventCount += asCount(row.eventCount);
    if (eventName === "golfjoin_login_required") action.requiredUsers += users;
    if (eventName === "golfjoin_login_return_complete") action.completeUsers += users;
  });
  return Array.from(actions.values())
    .map((action) => ({
      ...action,
      completionRate: rate(action.completeUsers, action.requiredUsers)
    }))
    .sort((a, b) => b.requiredUsers - a.requiredUsers || b.completeUsers - a.completeUsers || a.key.localeCompare(b.key));
}

function buildGa4CompletionValidation(overview = {}, internalFunnels = {}) {
  const eventCounts = new Map(
    (Array.isArray(overview.events) ? overview.events : []).map((event) => [
      asText(event.eventName),
      { activeUsers: asCount(event.activeUsers), eventCount: asCount(event.eventCount) }
    ])
  );
  const getStep = (flowKey, stepKey) => {
    const steps = Array.isArray(internalFunnels?.[flowKey]?.steps) ? internalFunnels[flowKey].steps : [];
    const step = steps.find((item) => asText(item.key) === stepKey) || {};
    return { activeUsers: asCount(step.activeUsers), eventCount: asCount(step.eventCount) };
  };
  const definitions = [
    {
      key: "apply",
      label: "참여 신청",
      stepEventName: "golfjoin_apply_step_view",
      stepParameter: "apply_step",
      businessEventName: "join_apply_complete"
    },
    {
      key: "builder",
      label: "새 모임 생성",
      stepEventName: "golfjoin_create_step_view",
      stepParameter: "builder_step",
      businessEventName: "new_schedule_complete"
    }
  ];
  const flows = definitions.map((definition) => {
    const submitStart = getStep(definition.key, "submit_start");
    const stepComplete = getStep(definition.key, "complete");
    const businessComplete = eventCounts.get(definition.businessEventName) || { activeUsers: 0, eventCount: 0 };
    const checks = [
      {
        key: "submit_start",
        label: "제출 시작",
        eventName: definition.stepEventName,
        parameter: `${definition.stepParameter}=submit_start`,
        ...submitStart,
        observed: submitStart.eventCount > 0
      },
      {
        key: "step_complete",
        label: "단계 완료",
        eventName: definition.stepEventName,
        parameter: `${definition.stepParameter}=complete`,
        ...stepComplete,
        observed: stepComplete.eventCount > 0
      },
      {
        key: "business_complete",
        label: "완료 이벤트",
        eventName: definition.businessEventName,
        parameter: "",
        ...businessComplete,
        observed: businessComplete.eventCount > 0
      }
    ];
    const observedSignals = checks.filter((check) => check.observed).length;
    const issueCodes = [];
    if ((stepComplete.eventCount > 0) !== (businessComplete.eventCount > 0)) {
      issueCodes.push("completion_signal_mismatch");
    }
    if ((stepComplete.eventCount > 0 || businessComplete.eventCount > 0) && submitStart.eventCount === 0) {
      issueCodes.push("submit_start_missing");
    }
    const status = observedSignals === 0
      ? "waiting"
      : issueCodes.length
        ? "needs_review"
        : observedSignals === checks.length
          ? "verified"
          : "collecting";
    return {
      key: definition.key,
      label: definition.label,
      status,
      observedSignals,
      totalSignals: checks.length,
      issueCodes,
      checks
    };
  });
  const statusPriority = ["needs_review", "collecting", "waiting", "verified"];
  const overallStatus = statusPriority.find((status) => flows.some((flow) => flow.status === status)) || "waiting";
  return {
    overallStatus,
    verifiedFlows: flows.filter((flow) => flow.status === "verified").length,
    totalFlows: flows.length,
    flows
  };
}

function buildGa4AnalysisReadiness(overview = {}, trend = [], options = {}) {
  const summary = overview.summary || {};
  const dateRange = options.dateRange || overview.dateRange || {};
  const thresholds = GA4_ANALYSIS_READINESS_THRESHOLDS;
  const requestedDays = asCount(dateRange.days)
    || getInclusiveDateDays(dateRange.startDate, dateRange.endDate)
    || 0;
  const activeDataDays = (Array.isArray(trend) ? trend : []).filter((row) => asCount(row.visitors) > 0).length;
  const requiredActiveDays = Math.min(thresholds.minimumDays, requestedDays || thresholds.minimumDays);
  const periodReady = requestedDays >= thresholds.minimumDays && activeDataDays >= requiredActiveDays;
  const definitions = [
    { key: "detail_rate", label: "상세 열람률", numeratorKey: "detailUsers", denominatorKey: "visitors", rateKey: "detailRate" },
    { key: "apply_start_rate", label: "신청 시작률", numeratorKey: "applyStartUsers", denominatorKey: "detailUsers", rateKey: "applyStartRate" },
    { key: "apply_complete_rate", label: "신청 완료율", numeratorKey: "applyCompleteUsers", denominatorKey: "applyStartUsers", rateKey: "applyCompleteRate" },
    { key: "create_complete_rate", label: "새 모임 완료율", numeratorKey: "createCompleteUsers", denominatorKey: "createStartUsers", rateKey: "createCompleteRate" }
  ];
  const metrics = definitions.map((definition) => {
    const numerator = asCount(summary[definition.numeratorKey]);
    const denominator = asCount(summary[definition.denominatorKey]);
    const sampleStatus = denominator === 0
      ? "waiting"
      : denominator >= thresholds.stableDenominator
        ? "stable"
        : denominator >= thresholds.directionalDenominator
          ? "directional"
          : "collecting";
    return {
      key: definition.key,
      label: definition.label,
      numerator,
      denominator,
      rate: Number.isFinite(Number(summary[definition.rateKey])) ? Number(summary[definition.rateKey]) : rate(numerator, denominator),
      sampleStatus,
      directionalMinimum: thresholds.directionalDenominator,
      stableMinimum: thresholds.stableDenominator
    };
  });
  const directionalMetrics = metrics.filter((metric) => ["directional", "stable"].includes(metric.sampleStatus)).length;
  const stableMetrics = metrics.filter((metric) => metric.sampleStatus === "stable").length;
  const visitors = asCount(summary.visitors);
  const status = visitors === 0
    ? "waiting"
    : !periodReady || directionalMetrics < metrics.length
      ? "collecting"
      : stableMetrics === metrics.length
        ? "stable"
        : "directional";
  return {
    status,
    period: {
      requestedDays,
      activeDataDays,
      minimumDays: thresholds.minimumDays,
      requiredActiveDays,
      ready: periodReady
    },
    thresholds: { ...thresholds },
    directionalMetrics,
    stableMetrics,
    totalMetrics: metrics.length,
    metrics
  };
}

function getReportQuality(payload = {}) {
  return {
    dataLossFromOtherRow: Boolean(payload.metadata?.dataLossFromOtherRow),
    thresholdingApplied: Boolean(payload.metadata?.subjectToThresholding),
    rowCount: asCount(payload.rowCount)
  };
}

function buildGa4DashboardPayload(overview = {}, reports = {}, options = {}) {
  const warnings = Array.isArray(options.warnings) ? options.warnings : [];
  const reportQuality = Object.fromEntries(
    GA4_DASHBOARD_REPORT_NAMES.map((name) => [name, getReportQuality(reports[name] || {})])
  );
  const internalFunnels = {
    apply: buildGa4InternalFunnel(reports.applySteps, {
      dimensionName: "customEvent:apply_step",
      eventName: "golfjoin_apply_step_view",
      definitions: APPLY_STEP_DEFINITIONS
    }),
    builder: buildGa4InternalFunnel(reports.builderSteps, {
      dimensionName: "customEvent:builder_step",
      eventName: "golfjoin_create_step_view",
      definitions: BUILDER_STEP_DEFINITIONS
    })
  };
  const trend = buildGa4Trend(reports.trend);
  const comparisonAvailable = Boolean(
    options.comparison && asCount(options.comparison?.summary?.visitors) > 0
  );
  return {
    ok: true,
    schema: "golfjoin-ga4-admin-dashboard-v1",
    propertyId: asText(options.propertyId || overview.propertyId),
    generatedAt: asText(options.generatedAt || overview.generatedAt),
    dateRange: options.dateRange || overview.dateRange || null,
    filters: options.filters || { device: "", memberState: "", sourceMedium: "" },
    summary: overview.summary || summarizeFunnelCounts(),
    events: Array.isArray(overview.events) ? overview.events : [],
    sections: buildGa4Sections(reports.sections),
    devices: buildGa4GroupedFunnel(reports.devices, "deviceCategory"),
    members: buildGa4GroupedFunnel(reports.members, "customEvent:member_state"),
    trend,
    acquisition: buildGa4Acquisition(reports.acquisition),
    internalFunnels: {
      apply: internalFunnels.apply,
      builder: internalFunnels.builder
    },
    completionValidation: buildGa4CompletionValidation(overview, internalFunnels),
    analysisReadiness: buildGa4AnalysisReadiness(overview, trend, {
      dateRange: options.dateRange || overview.dateRange || null
    }),
    journeyFunnels: {
      search: buildGa4EventFunnel(reports.searchFunnel, SEARCH_FUNNEL_STEP_DEFINITIONS),
      loginReturn: buildGa4EventFunnel(reports.loginFunnel, LOGIN_RETURN_FUNNEL_STEP_DEFINITIONS)
    },
    loginReturnActions: buildGa4LoginReturnActions(reports.loginReturnActions),
    quality: {
      overview: overview.quality || {},
      reports: reportQuality,
      partial: warnings.length > 0
    },
    comparisonAvailable,
    ...(warnings.length ? { warnings } : {}),
    ...(options.comparison ? { comparison: options.comparison } : {})
  };
}

function createGa4CacheKey(dateRange, filters = {}, comparisonRange = null) {
  return JSON.stringify({
    startDate: dateRange?.startDate || "",
    endDate: dateRange?.endDate || "",
    device: filters.device || "",
    memberState: filters.memberState || "",
    sourceMedium: filters.sourceMedium || "",
    compareStartDate: comparisonRange?.startDate || "",
    compareEndDate: comparisonRange?.endDate || ""
  });
}

function createGa4AdminAnalyticsService(options = {}) {
  const propertyId = asText(options.propertyId);
  const getAccessToken = options.getAccessToken;
  const fetchWithTimeout = options.fetchWithTimeout;
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const cacheTtlMs = clampInteger(options.cacheTtlMs, 1_000, 60 * 60_000, 15 * 60_000);
  const staleTtlMs = Math.max(cacheTtlMs, clampInteger(options.staleTtlMs, cacheTtlMs, 7 * 24 * 60 * 60_000, 24 * 60 * 60_000));
  const cache = new Map();
  const dashboardCache = new Map();

  if (typeof getAccessToken !== "function") throw new TypeError("getAccessToken is required");
  if (typeof fetchWithTimeout !== "function") throw new TypeError("fetchWithTimeout is required");

  function assertPropertyConfigured() {
    if (propertyId) return;
    const error = new Error("GA4_PROPERTY_ID is not configured");
    error.status = 500;
    error.code = "ga4_property_not_configured";
    throw error;
  }

  async function fetchGa4Json(url, token, body, label) {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(body)
    }, 10_000, label);
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`GA4 Data API request failed (${response.status})`);
      error.status = 502;
      error.code = "ga4_data_api_failed";
      error.reason = `upstream_${response.status}`;
      throw error;
    }
    return JSON.parse(text || "{}");
  }

  async function runReportWithToken(token, body, label) {
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
    return fetchGa4Json(url, token, body, label);
  }

  async function runBatchWithToken(token, reports) {
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:batchRunReports`;
    const chunks = [];
    for (let index = 0; index < reports.length; index += 5) chunks.push(reports.slice(index, index + 5));
    const entries = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const payload = await fetchGa4Json(url, token, {
        requests: chunk.map((report) => report.body)
      }, `GA4 admin dashboard batch ${index + 1}/${chunks.length}`);
      if (!Array.isArray(payload.reports) || payload.reports.length !== chunk.length) {
        const error = new Error("GA4 batch report response is incomplete");
        error.status = 502;
        error.code = "ga4_batch_incomplete";
        throw error;
      }
      chunk.forEach((report, reportIndex) => entries.push([report.name, payload.reports[reportIndex]]));
    }
    return Object.fromEntries(entries);
  }

  async function requestOverview(params = {}) {
    assertPropertyConfigured();
    const request = buildGa4OverviewRequest(params);
    const cacheKey = createGa4CacheKey(request.dateRange, request.filters);
    const cached = cache.get(cacheKey);
    const ageMs = cached ? now() - cached.updatedAt : Number.POSITIVE_INFINITY;
    if (cached && ageMs <= cacheTtlMs) {
      return {
        ...cached.payload,
        cache: { status: "hit", ageMs, updatedAt: cached.payload.generatedAt }
      };
    }

    try {
      const token = await getAccessToken();
      const reportPayload = await runReportWithToken(token, request.body, "GA4 admin overview");
      const generatedAt = new Date(now()).toISOString();
      const payload = buildGa4OverviewPayload(reportPayload, {
        propertyId,
        generatedAt,
        dateRange: request.dateRange
      });
      cache.set(cacheKey, { payload, updatedAt: now() });
      return {
        ...payload,
        cache: { status: "miss", ageMs: 0, updatedAt: generatedAt }
      };
    } catch (error) {
      if (cached && ageMs <= staleTtlMs) {
        return {
          ...cached.payload,
          warning: {
            code: asText(error?.code) || "ga4_data_api_failed",
            message: "최신 GA4 데이터를 불러오지 못해 마지막 정상 데이터를 표시합니다."
          },
          cache: { status: "stale", ageMs, updatedAt: cached.payload.generatedAt }
        };
      }
      throw error;
    }
  }

  async function requestDashboard(params = {}) {
    assertPropertyConfigured();
    const request = buildGa4DashboardRequests(params);
    const comparisonRange = normalizeGa4ComparisonRange(params, request.dateRange);
    const cacheKey = createGa4CacheKey(request.dateRange, request.filters, comparisonRange);
    const cached = dashboardCache.get(cacheKey);
    const ageMs = cached ? now() - cached.updatedAt : Number.POSITIVE_INFINITY;
    if (cached && ageMs <= cacheTtlMs) {
      return {
        ...cached.payload,
        cache: { status: "hit", ageMs, updatedAt: cached.payload.generatedAt }
      };
    }

    try {
      const [overview, token] = await Promise.all([
        requestOverview(params),
        getAccessToken()
      ]);
      let reports;
      const warnings = [];
      try {
        reports = await runBatchWithToken(token, request.reports);
      } catch (batchError) {
        const settled = await Promise.allSettled(
          request.reports.map((report) => runReportWithToken(token, report.body, `GA4 ${report.name} report`))
        );
        reports = {};
        settled.forEach((result, index) => {
          const name = request.reports[index].name;
          if (result.status === "fulfilled") {
            reports[name] = result.value;
            return;
          }
          reports[name] = {};
          warnings.push({
            report: name,
            code: asText(result.reason?.code) || "ga4_report_unavailable",
            message: `${name} 보고서를 불러오지 못했습니다.`
          });
        });
      }

      const generatedAt = new Date(now()).toISOString();
      let comparison = null;
      if (comparisonRange) {
        try {
          const comparisonParams = {
            ...params,
            compare: false,
            __dateRange: comparisonRange
          };
          const comparisonRequest = buildGa4DashboardRequests(comparisonParams);
          const comparisonOverview = await requestOverview(comparisonParams);
          let comparisonReports;
          const comparisonWarnings = [];
          try {
            comparisonReports = await runBatchWithToken(token, comparisonRequest.reports);
          } catch (batchError) {
            const settled = await Promise.allSettled(
              comparisonRequest.reports.map((report) => runReportWithToken(token, report.body, `GA4 comparison ${report.name} report`))
            );
            comparisonReports = {};
            settled.forEach((result, index) => {
              const name = comparisonRequest.reports[index].name;
              if (result.status === "fulfilled") {
                comparisonReports[name] = result.value;
                return;
              }
              comparisonReports[name] = {};
              comparisonWarnings.push({
                report: name,
                code: asText(result.reason?.code) || "ga4_report_unavailable",
                message: `이전 기간 ${name} 보고서를 불러오지 못했습니다.`
              });
            });
          }
          comparison = buildGa4DashboardPayload(comparisonOverview, comparisonReports, {
            propertyId,
            generatedAt,
            dateRange: comparisonRange,
            filters: request.filters,
            warnings: comparisonWarnings
          });
        } catch (comparisonError) {
          warnings.push({
            report: "comparison",
            code: asText(comparisonError?.code) || "ga4_comparison_unavailable",
            message: "이전 기간 비교 데이터를 불러오지 못했습니다."
          });
        }
      }
      const payload = buildGa4DashboardPayload(overview, reports, {
        propertyId,
        generatedAt,
        dateRange: request.dateRange,
        filters: request.filters,
        warnings,
        comparison
      });
      dashboardCache.set(cacheKey, { payload, updatedAt: now() });
      return {
        ...payload,
        cache: { status: "miss", ageMs: 0, updatedAt: generatedAt }
      };
    } catch (error) {
      if (cached && ageMs <= staleTtlMs) {
        return {
          ...cached.payload,
          warning: {
            code: asText(error?.code) || "ga4_data_api_failed",
            message: "최신 GA4 대시보드를 불러오지 못해 마지막 정상 데이터를 표시합니다."
          },
          cache: { status: "stale", ageMs, updatedAt: cached.payload.generatedAt }
        };
      }
      throw error;
    }
  }

  return Object.freeze({ requestOverview, requestDashboard });
}

module.exports = {
  DEFAULT_EVENT_NAMES,
  FUNNEL_EVENT_NAMES,
  SECTION_EVENT_NAMES,
  SEARCH_FUNNEL_EVENT_NAMES,
  LOGIN_RETURN_FUNNEL_EVENT_NAMES,
  LOGIN_RETURN_ACTION_EVENT_NAMES,
  SEARCH_FUNNEL_STEP_DEFINITIONS,
  LOGIN_RETURN_FUNNEL_STEP_DEFINITIONS,
  APPLY_STEP_DEFINITIONS,
  BUILDER_STEP_DEFINITIONS,
  GA4_DASHBOARD_REPORT_NAMES,
  GA4_DEVICE_FILTER_VALUES,
  GA4_MEMBER_FILTER_VALUES,
  normalizeGa4DateRange,
  normalizeGa4ComparisonRange,
  normalizeGa4Filters,
  createStringDimensionFilter,
  combineDimensionFilters,
  createGa4DimensionFilter,
  buildGa4OverviewRequest,
  buildGa4DashboardRequests,
  parseGa4ReportRows,
  buildGa4OverviewPayload,
  buildGa4GroupedFunnel,
  buildGa4Sections,
  buildGa4Trend,
  buildGa4Acquisition,
  buildGa4InternalFunnel,
  buildGa4EventFunnel,
  buildGa4LoginReturnActions,
  buildGa4CompletionValidation,
  buildGa4AnalysisReadiness,
  buildGa4DashboardPayload,
  createGa4AdminAnalyticsService
};
