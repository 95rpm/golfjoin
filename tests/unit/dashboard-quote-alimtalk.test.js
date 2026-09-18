"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dashboard = fs.readFileSync(path.resolve(__dirname, "../../golfjoin_admin_dashboard.html"), "utf8");

function extractFunction(source, functionName) {
  const declaration = `function ${functionName}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const bodyStart = source.indexOf(") {", start) + 2;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

test("견적서 전송 버튼은 실제 알림톡 서버 action을 호출한다", () => {
  assert.match(dashboard, /data-action="quote-send"/);
  assert.doesNotMatch(dashboard, /data-action="quote-send-placeholder"/);
  assert.match(dashboard, /async function sendQuoteNotification\(button\)/);
  assert.match(dashboard, /url\.searchParams\.set\("action", "quote_send_notification"\)/);
  assert.match(dashboard, /quoteStatus: "sent"/);
});

test("견적서가 없는 전송 버튼만 흐린 비활성 스타일을 사용한다", () => {
  assert.match(dashboard, /\.quote-complete-button:disabled:not\(\.completed\)\s*\{/);
  assert.match(dashboard, /background:\s*#f3f4f6/);
  assert.match(dashboard, /color:\s*#9ca3af/);
  assert.match(dashboard, /cursor:\s*not-allowed/);
  assert.match(dashboard, /\.quote-complete-button\.completed\s*\{[\s\S]*?background:\s*var\(--green\)/);
});

test("견적서 목록은 줄바꿈으로만 나누고 금액의 천 단위 쉼표를 보존한다", () => {
  const sandbox = {
    asText: (value) => String(value == null ? "" : value).trim(),
    escapeHtml: (value) => String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  };
  vm.runInNewContext(`
    ${extractFunction(dashboard, "parseQuoteEditorList")}
    ${extractFunction(dashboard, "renderQuoteEditorPreviewList")}
    globalThis.parseQuoteList = parseQuoteEditorList;
    globalThis.renderQuoteList = renderQuoteEditorPreviewList;
  `, sandbox);
  const items = sandbox.parseQuoteList([
    "왕복항공권 (유류할증료&TAX 포함)",
    "캐디피(30,000원/18홀)",
    "캐디팁(8$/18홀)",
    "미팅샌딩비(50$/4인시)",
    "중식&석식"
  ].join("\n"));

  assert.deepEqual(Array.from(items), [
    "왕복항공권 (유류할증료&TAX 포함)",
    "캐디피(30,000원/18홀)",
    "캐디팁(8$/18홀)",
    "미팅샌딩비(50$/4인시)",
    "중식&석식"
  ]);
  const rendered = sandbox.renderQuoteList(items.join("\n"), "없음");
  assert.match(rendered, /<li>캐디피\(30,000원\/18홀\)<\/li>/);
  assert.equal((rendered.match(/<li>/g) || []).length, 5);
  assert.doesNotMatch(rendered, /<li>캐디피\(30<\/li>|<li>000원\/18홀\)<\/li>/);
  assert.match(extractFunction(dashboard, "renderQuoteEditorPreviewList"), /parseQuoteEditorList\(value\)/);
  assert.doesNotMatch(extractFunction(dashboard, "renderQuoteEditorPreviewList"), /\n\|,/);
});
