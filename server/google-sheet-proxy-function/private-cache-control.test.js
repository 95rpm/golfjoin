"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { proxyGoogleSheet } = require("./index");

function createResponse() {
  const headers = new Map();
  return {
    headers,
    statusCode: 0,
    body: null,
    set(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
      return this;
    },
    status(value) {
      this.statusCode = Number(value);
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

async function runOptions(query = {}) {
  const req = {
    method: "OPTIONS",
    query,
    body: {},
    headers: { origin: "https://www.secret-tour.com" }
  };
  const res = createResponse();
  await proxyGoogleSheet(req, res);
  return res;
}

test("회원 전용 action 응답은 브라우저·공유 캐시에 저장하지 않는다", async () => {
  const response = await runOptions({ action: "join_wishes_lookup" });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
  assert.equal(response.headers.get("pragma"), "no-cache");
});

test("SMS 회원 인증 lifecycle 응답도 브라우저·공유 캐시에 저장하지 않는다", async () => {
  for (const action of [
    "member_auth_start",
    "member_auth_verify",
    "member_auth_refresh",
    "member_auth_logout",
    "member_signup_phone_start",
    "member_signup_phone_verify",
    "member_signup_phone_assert",
    "member_signup_phone_complete"
  ]) {
    const response = await runOptions({ action });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
    assert.equal(response.headers.get("pragma"), "no-cache");
  }
});

test("회원 식별자가 있는 sheet 조회 응답은 private no-store다", async () => {
  const response = await runOptions({ sheet: "join_applications", memberKey: "seq:30002047" });
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
});

test("공개 home_stats 응답에는 private 캐시 지시자를 붙이지 않는다", async () => {
  const response = await runOptions({ action: "home_stats" });
  assert.equal(response.headers.has("cache-control"), false);
});
