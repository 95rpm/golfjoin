"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  buildAppsScriptSignaturePayload
} = require("../../server/google-sheet-proxy-function/admin-email-notifications");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "doc/google-sheet-web-app.gs"), "utf8");

function signedBytes(buffer) {
  return Array.from(buffer, (value) => value > 127 ? value - 256 : value);
}

function createContext(secret) {
  const cache = new Map();
  const properties = new Map([["GOLFJOIN_EMAIL_RELAY_SECRET", secret]]);
  const sent = [];
  const context = {
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.get(key) || "",
        setProperty: (key, value) => properties.set(key, value)
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cache.get(key) || null,
        put: (key, value) => cache.set(key, value)
      })
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} })
    },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail: (message) => sent.push(message)
    },
    Utilities: {
      Charset: { UTF_8: "UTF_8" },
      DigestAlgorithm: { SHA_256: "SHA_256" },
      computeDigest: (_algorithm, value) => signedBytes(crypto.createHash("sha256").update(String(value), "utf8").digest()),
      computeHmacSha256Signature: (value, key) => signedBytes(crypto.createHmac("sha256", String(key)).update(String(value), "utf8").digest())
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (content) => ({ content, setMimeType() { return this; } })
    }
  };
  vm.createContext(context);
  new vm.Script(source).runInContext(context);
  return { context, cache, properties, sent };
}

test("v65b Apps Script 전체 문법과 메일 전용 라우팅 순서가 유효하다", () => {
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /if \(String\(payload\.action[\s\S]{0,180}handleGolfjoinAdminEmailSend_\(payload\)[\s\S]{0,100}setupGolfJoinSheets\(\)/);
  assert.match(source, /PropertiesService\.getScriptProperties\(\)\.getProperty\("GOLFJOIN_EMAIL_RELAY_SECRET"\)/);
});

test("v65b Node와 Apps Script가 동일한 서명 원문과 HMAC을 계산한다", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const { context } = createContext(secret);
  const payload = {
    action: "admin_email_send",
    version: 1,
    timestamp: 1789344000000,
    nonce: "0123456789abcdef0123456789abcdef",
    idempotencyKey: "aem_example",
    to: "admin@secret-tour.com",
    subject: "신규 신청",
    plainText: "본문",
    html: "<p>본문</p>",
    fromName: "시크릿투어 골프조인"
  };
  const nodeCanonical = buildAppsScriptSignaturePayload(payload);
  const gasCanonical = context.golfjoinAdminEmailSignaturePayload_(payload);
  assert.equal(gasCanonical, nodeCanonical);
  assert.equal(
    context.golfjoinAdminEmailHmacHex_(gasCanonical, secret),
    crypto.createHmac("sha256", secret).update(nodeCanonical, "utf8").digest("hex")
  );
});

test("v65b 유효한 요청은 한 번만 발송하고 캐시가 사라져도 영속 멱등 기록으로 중복을 막는다", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const { context, cache, sent } = createContext(secret);
  const payload = {
    action: "admin_email_send",
    version: 1,
    timestamp: Date.now(),
    nonce: "0123456789abcdef0123456789abcdef",
    idempotencyKey: "aem_example_once",
    to: "admin@secret-tour.com",
    subject: "신규 신청",
    plainText: "본문",
    html: "<p>본문</p>",
    fromName: "시크릿투어 골프조인"
  };
  payload.signature = crypto.createHmac("sha256", secret)
    .update(buildAppsScriptSignaturePayload(payload), "utf8")
    .digest("hex");
  const first = JSON.parse(context.handleGolfjoinAdminEmailSend_(payload).content);
  cache.clear();
  const second = JSON.parse(context.handleGolfjoinAdminEmailSend_(payload).content);
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "admin@secret-tour.com");
});

test("v65b 잘못된 서명과 만료 요청은 메일을 발송하지 않는다", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const { context, sent } = createContext(secret);
  const base = {
    action: "admin_email_send",
    version: 1,
    nonce: "0123456789abcdef0123456789abcdef",
    idempotencyKey: "aem_rejected",
    to: "admin@secret-tour.com",
    subject: "신규 신청",
    plainText: "본문",
    html: "",
    fromName: "시크릿투어 골프조인"
  };
  const invalid = JSON.parse(context.handleGolfjoinAdminEmailSend_({ ...base, timestamp: Date.now(), signature: "0".repeat(64) }).content);
  const expiredPayload = { ...base, timestamp: Date.now() - 10 * 60 * 1000 };
  expiredPayload.signature = crypto.createHmac("sha256", secret)
    .update(buildAppsScriptSignaturePayload(expiredPayload), "utf8")
    .digest("hex");
  const expired = JSON.parse(context.handleGolfjoinAdminEmailSend_(expiredPayload).content);
  assert.equal(invalid.error, "apps_script_signature_invalid");
  assert.equal(expired.error, "apps_script_request_expired");
  assert.equal(sent.length, 0);
});
