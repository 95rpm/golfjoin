const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(path.join(ROOT, "golfjoin_admin_dashboard.html"), "utf8");
const server = require(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
const api = server.__test;

function response(status, body = "{}", headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] || null },
    text: async () => body
  };
}

test("v76 대시보드 인라인 JavaScript 문법이 유효하다", () => {
  const scripts = [...dashboard.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  assert.equal(scripts.length, 1);
  scripts.forEach((script) => assert.doesNotThrow(() => new vm.Script(script)));
});

test("v76 Sheets 쓰기는 명시적인 429만 자동 재시도한다", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return calls === 1 ? response(429, "quota") : response(200, '{"ok":true}');
  };
  try {
    const result = await api.fetchGoogleSheetsWriteWithRetry("https://example.invalid", {}, {
      retryDelaysMs: [0],
      timeoutMs: 1000,
      label: "test write"
    });
    assert.equal(calls, 2);
    assert.equal(result.text, '{"ok":true}');
  } finally {
    global.fetch = originalFetch;
  }
});

test("v76 모호한 서버 오류는 중복 저장 위험 때문에 자동 재시도하지 않는다", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return response(500, "upstream error");
  };
  try {
    await assert.rejects(
      api.fetchGoogleSheetsWriteWithRetry("https://example.invalid", {}, {
        retryDelaysMs: [0, 0],
        timeoutMs: 1000,
        label: "test write"
      }),
      (error) => error.status === 500
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("v76 추천일정은 0원 저장을 거부하고 형식화된 실제 가격은 허용한다", () => {
  assert.equal(api.validateRecommendedScheduleProductPrice({ productPrice: "1,290,000원", isVisible: true }), 1290000);
  assert.throws(
    () => api.validateRecommendedScheduleProductPrice({ productPrice: "0", isVisible: true }),
    (error) => error.status === 422 && error.code === "recommended_schedule_price_missing"
  );
  assert.equal(api.validateRecommendedScheduleProductPrice({ productPrice: "0", isVisible: false }), 0);
});

test("v76 추천일정 취소는 활성 참여자가 0명일 때만 허용한다", () => {
  assert.equal(api.assertRecommendedScheduleCancellationAllowed({ isVisible: false }, 0), true);
  assert.throws(
    () => api.assertRecommendedScheduleCancellationAllowed({ isVisible: false }, 1),
    (error) => error.status === 409 && error.code === "recommended_schedule_has_participants"
  );
});

test("v76 대시보드는 실제 상세 가격 보정과 일정취소 UI를 제공한다", () => {
  assert.match(dashboard, /price:\s*adultPrice \+ oilPrice/);
  assert.match(dashboard, /firstPositiveRecommendationPrice\([\s\S]*actualDetail\.price/);
  assert.match(dashboard, /data-action="recommendation-cancel"/);
  assert.match(dashboard, /현재 참여자가 \$\{currentPeople\}명 있어 일정취소를 할 수 없습니다/);
});
