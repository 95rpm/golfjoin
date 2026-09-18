"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "golfjoin_admin_dashboard.html"), "utf8");
const step = (key, label, activeUsers, eventCount, fromPreviousRate, dropOffUsers, dropOffRate) => ({
  key, label, activeUsers, eventCount, fromPreviousRate, dropOffUsers, dropOffRate
});
const current = {
  ok: true,
  schema: "golfjoin-ga4-admin-dashboard-v1",
  comparisonAvailable: false,
  generatedAt: new Date().toISOString(),
  dateRange: { startDate: "6daysAgo", endDate: "today", days: 7 },
  cache: { status: "miss" },
  quality: { partial: false },
  summary: {
    visitors: 128,
    detailUsers: 54,
    detailRate: 42.2,
    applyStartUsers: 18,
    applyStartRate: 33.3,
    applyCompleteUsers: 8,
    applyCompleteRate: 44.4,
    createStartUsers: 16,
    createCompleteUsers: 5,
    createCompleteRate: 31.3
  },
  analysisReadiness: {
    status: "collecting",
    period: { requestedDays: 7, activeDataDays: 7, minimumDays: 7, requiredActiveDays: 7, ready: true },
    thresholds: { minimumDays: 7, directionalDenominator: 30, stableDenominator: 100 },
    directionalMetrics: 2,
    stableMetrics: 1,
    totalMetrics: 4,
    metrics: [
      { key: "detail_rate", label: "상세 열람률", numerator: 54, denominator: 128, rate: 42.2, sampleStatus: "stable", directionalMinimum: 30, stableMinimum: 100 },
      { key: "apply_start_rate", label: "신청 시작률", numerator: 18, denominator: 54, rate: 33.3, sampleStatus: "directional", directionalMinimum: 30, stableMinimum: 100 },
      { key: "apply_complete_rate", label: "신청 완료율", numerator: 8, denominator: 18, rate: 44.4, sampleStatus: "collecting", directionalMinimum: 30, stableMinimum: 100 },
      { key: "create_complete_rate", label: "새 모임 완료율", numerator: 5, denominator: 16, rate: 31.3, sampleStatus: "collecting", directionalMinimum: 30, stableMinimum: 100 }
    ]
  },
  internalFunnels: {
    apply: {
      startUsers: 18, completeUsers: 8, completionRate: 44.4, observedSteps: 4,
      steps: [
        step("form_view", "신청서 진입", 18, 21, null, 4, 22.2),
        step("review", "신청 내용 확인", 14, 15, 77.8, 3, 21.4),
        step("submit_start", "신청 제출 시작", 11, 11, 78.6, 3, 27.3),
        step("complete", "참여 신청 완료", 8, 8, 72.7, null, null)
      ]
    },
    builder: {
      startUsers: 16, completeUsers: 5, completionRate: 31.3, observedSteps: 6,
      steps: [
        step("date_selection", "날짜 선택", 16, 19, null, 2, 12.5),
        step("destination_selection", "여행지 선택", 14, 16, 87.5, 3, 21.4),
        step("participant_info", "참여자 정보", 11, 12, 78.6, 2, 18.2),
        step("review", "생성 내용 확인", 9, 9, 81.8, 2, 22.2),
        step("submit_start", "생성 제출 시작", 7, 7, 77.8, 2, 28.6),
        step("complete", "새 모임 생성 완료", 5, 5, 71.4, null, null)
      ]
    }
  },
  completionValidation: {
    overallStatus: "verified",
    verifiedFlows: 2,
    totalFlows: 2,
    flows: [
      {
        key: "apply", label: "참여 신청", status: "verified", observedSignals: 3, totalSignals: 3, issueCodes: [],
        checks: [
          { key: "submit_start", label: "제출 시작", eventName: "golfjoin_apply_step_view", parameter: "apply_step=submit_start", activeUsers: 11, eventCount: 11, observed: true },
          { key: "step_complete", label: "단계 완료", eventName: "golfjoin_apply_step_view", parameter: "apply_step=complete", activeUsers: 8, eventCount: 8, observed: true },
          { key: "business_complete", label: "완료 이벤트", eventName: "join_apply_complete", parameter: "", activeUsers: 8, eventCount: 8, observed: true }
        ]
      },
      {
        key: "builder", label: "새 모임 생성", status: "verified", observedSignals: 3, totalSignals: 3, issueCodes: [],
        checks: [
          { key: "submit_start", label: "제출 시작", eventName: "golfjoin_create_step_view", parameter: "builder_step=submit_start", activeUsers: 7, eventCount: 7, observed: true },
          { key: "step_complete", label: "단계 완료", eventName: "golfjoin_create_step_view", parameter: "builder_step=complete", activeUsers: 5, eventCount: 5, observed: true },
          { key: "business_complete", label: "완료 이벤트", eventName: "new_schedule_complete", parameter: "", activeUsers: 5, eventCount: 5, observed: true }
        ]
      }
    ]
  },
  journeyFunnels: {
    search: {
      startUsers: 8, completeUsers: 7, completionRate: null, observedSteps: 5,
      measurementMode: "independent_event_reach", actionable: false, nonMonotonic: true,
      diagnostic: { code: "non_monotonic_active_users", message: "뒤 단계 사용자가 앞 단계보다 많아 순차 전환율을 표시하지 않습니다. 이벤트별 도달 사용자 수를 기준으로 수집 상태를 먼저 확인하세요." },
      steps: [
        step("open", "검색 열기", 8, 10, null, null, null),
        { ...step("submit", "검색 실행", 19, 20, null, 4, 21.1), sequenceMismatch: true },
        step("list_view", "결과 노출", 15, 17, 78.9, 3, 20),
        step("item_select", "상품 선택", 12, 13, 80, 5, 41.7),
        step("detail_view", "상세 열람", 7, 8, 58.3, null, null)
      ]
    },
    loginReturn: {
      startUsers: 14, completeUsers: 8, completionRate: 57.1, observedSteps: 4,
      steps: [
        step("required", "로그인 요구", 14, 15, null, 2, 14.3),
        step("start", "로그인 시작", 12, 13, 85.7, 2, 16.7),
        step("success", "로그인 성공", 10, 10, 83.3, 2, 20),
        step("return_complete", "원래 행동 복귀", 8, 8, 80, null, null)
      ]
    }
  },
  loginReturnActions: [
    { key: "builder", requiredUsers: 7, completeUsers: 5, completionRate: 71.4 },
    { key: "join_apply", requiredUsers: 4, completeUsers: 2, completionRate: 50 },
    { key: "new_schedule_creation_after_external_login_profile_completion", requiredUsers: 2, completeUsers: 1, completionRate: 50 },
    { key: "wish", requiredUsers: 1, completeUsers: 0, completionRate: 0 }
  ],
  sections: [
    { sectionName: "overseas_best", sectionViewUsers: 60, itemSelectionUsers: 18, selectionRate: 30, detailViewUsers: 14, detailRate: 23.3 },
    { sectionName: "theme", sectionViewUsers: 42, itemSelectionUsers: 8, selectionRate: 19, detailViewUsers: 6, detailRate: 14.3 }
  ],
  devices: [
    { key: "mobile", visitors: 80, detailUsers: 30, detailRate: 37.5 },
    { key: "desktop", visitors: 48, detailUsers: 24, detailRate: 50 }
  ],
  members: [
    { key: "guest", visitors: 70, detailUsers: 25, detailRate: 35.7 },
    { key: "kakao", visitors: 58, detailUsers: 29, detailRate: 50 }
  ],
  trend: [
    { date: "2026-08-26", visitors: 14, detailUsers: 5 },
    { date: "2026-08-27", visitors: 18, detailUsers: 7 },
    { date: "2026-08-28", visitors: 16, detailUsers: 6 },
    { date: "2026-08-29", visitors: 21, detailUsers: 9 },
    { date: "2026-08-30", visitors: 17, detailUsers: 7 },
    { date: "2026-08-31", visitors: 20, detailUsers: 9 },
    { date: "2026-09-01", visitors: 22, detailUsers: 11 }
  ],
  acquisition: [
    { sourceMedium: "google / cpc", campaign: "golfjoin_autumn", activeUsers: 41, sessions: 48 },
    { sourceMedium: "kakao / referral", campaign: "(not set)", activeUsers: 26, sessions: 31 }
  ],
  comparison: {
    summary: { visitors: 110, detailUsers: 48, detailRate: 43.6, applyStartUsers: 15, applyStartRate: 31.3, applyCompleteUsers: 6, applyCompleteRate: 40 },
    internalFunnels: {
      apply: { steps: [step("form_view", "신청서 진입", 15, 17, null, 4, 26.7), step("review", "신청 내용 확인", 11, 12, 73.3, 3, 27.3), step("submit_start", "신청 제출 시작", 8, 8, 72.7, 2, 25), step("complete", "참여 신청 완료", 6, 6, 75, null, null)] },
      builder: { steps: [step("date_selection", "날짜 선택", 13, 15, null, 2, 15.4), step("destination_selection", "여행지 선택", 11, 12, 84.6, 2, 18.2), step("participant_info", "참여자 정보", 9, 10, 81.8, 2, 22.2), step("review", "생성 내용 확인", 7, 7, 77.8, 2, 28.6), step("submit_start", "생성 제출 시작", 5, 5, 71.4, 2, 40), step("complete", "새 모임 생성 완료", 3, 3, 60, null, null)] }
    },
    journeyFunnels: {
      search: { steps: [step("open", "검색 열기", 18, 20, null, 3, 16.7), step("submit", "검색 실행", 15, 16, 83.3, 4, 26.7), step("list_view", "결과 노출", 11, 12, 73.3, 2, 18.2), step("item_select", "상품 선택", 9, 9, 81.8, 4, 44.4), step("detail_view", "상세 열람", 5, 5, 55.6, null, null)] },
      loginReturn: { steps: [step("required", "로그인 요구", 11, 12, null, 2, 18.2), step("start", "로그인 시작", 9, 10, 81.8, 2, 22.2), step("success", "로그인 성공", 7, 7, 77.8, 2, 28.6), step("return_complete", "원래 행동 복귀", 5, 5, 71.4, null, null)] }
    },
    loginReturnActions: [
      { key: "builder", requiredUsers: 6, completeUsers: 4, completionRate: 66.7 },
      { key: "join_apply", requiredUsers: 3, completeUsers: 1, completionRate: 33.3 },
      { key: "new_schedule_creation_after_external_login_profile_completion", requiredUsers: 1, completeUsers: 0, completionRate: 0 },
      { key: "wish", requiredUsers: 1, completeUsers: 0, completionRate: 0 }
    ]
  }
};
const previewScript = `<script>
  const qaAnalyticsPayload = ${JSON.stringify(current)};
  sessionStorage.setItem("golfjoinAdminAuth", JSON.stringify({ token: "qa-admin-token", expiresAt: Date.now() + 3600000 }));
  const qaOriginalFetch = window.fetch.bind(window);
  window.__qaAnalyticsRequests = [];
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.searchParams.get("action") === "admin_ga4_dashboard") {
      const days = Number(url.searchParams.get("days")) || 7;
      window.__qaAnalyticsRequests.push({ days, device: url.searchParams.get("device") || "", memberState: url.searchParams.get("memberState") || "" });
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const payload = JSON.parse(JSON.stringify(qaAnalyticsPayload));
      payload.dateRange = { startDate: days === 1 ? "today" : String(days - 1) + "daysAgo", endDate: "today", days };
      payload.analysisReadiness.period.requestedDays = days;
      payload.analysisReadiness.period.minimumDays = 7;
      payload.generatedAt = new Date().toISOString();
      return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return qaOriginalFetch(input, init);
  };
  const qaInitialLoading = new URLSearchParams(location.search).get("initialLoading") === "1";
  state.currentMenu = "user-analytics";
  ga4AnalyticsState = { ...ga4AnalyticsState, loaded: !qaInitialLoading, loading: false, error: "", compare: true, data: qaInitialLoading ? null : qaAnalyticsPayload };
  showApp();
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.menu === "user-analytics"));
  document.getElementById("pageTitle").textContent = "이용자 분석";
  document.querySelector(".page-sub").textContent = "골프조인 이용자의 주요 전환과 내부 작성 단계 이탈을 분석합니다.";
  syncMenuToolbar();
  syncAnalyticsFilterControls();
  renderMetrics();
  renderTable();
  if (qaInitialLoading) loadGa4AnalyticsDashboard();
</script>`;
const bodyEnd = source.lastIndexOf("</body>");
if (bodyEnd < 0) throw new Error("dashboard_body_end_missing");
const html = `${source.slice(0, bodyEnd)}${previewScript}${source.slice(bodyEnd)}`;
const port = Number(process.argv[2]) || 4174;

http.createServer((request, response) => {
  if (request.url === "/" || request.url.startsWith("/golfjoin_admin_dashboard.html")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(html);
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Stage49 browser QA server: http://127.0.0.1:${port}/\n`);
});
