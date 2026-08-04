"use strict";

const crypto = require("crypto");

const DEFAULT_ALIMTALK_RETRY_DELAYS_MS = Object.freeze([5000, 20000, 60000]);

function asText(value) {
  return String(value == null ? "" : value).trim();
}

function parseRetryDelays(value, fallback = DEFAULT_ALIMTALK_RETRY_DELAYS_MS) {
  const normalized = Array.isArray(value) ? value : asText(value);
  if (!normalized || (Array.isArray(normalized) && !normalized.length)) return [...fallback];
  const source = Array.isArray(normalized) ? normalized : normalized.split(",");
  const parsed = source
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .map((item) => Math.floor(item));
  return parsed.length ? parsed : [...fallback];
}

function createAlimtalkNotificationId(parts = []) {
  const source = (Array.isArray(parts) ? parts : [parts])
    .map(asText)
    .filter(Boolean)
    .join("|");
  return `at_${crypto.createHash("sha256").update(source || "unknown", "utf8").digest("hex").slice(0, 32)}`;
}

function serializeRetryError(error) {
  return {
    name: asText(error?.name || "Error"),
    message: asText(error?.message || error || "Unknown error"),
    code: asText(error?.code),
    status: Number(error?.status || 0) || 0
  };
}

function isRetryableAlimtalkError(error) {
  const detail = serializeRetryError(error);
  if (detail.status >= 500 && detail.status <= 599) return true;
  const haystack = `${detail.name} ${detail.code} ${detail.message}`.toLowerCase();
  return [
    "aborterror",
    "timeout",
    "timed out",
    "etimedout",
    "econnreset",
    "econnrefused",
    "enotfound",
    "eai_again",
    "socket",
    "network",
    "fetch failed"
  ].some((keyword) => haystack.includes(keyword));
}

function isRetryableAlimtalkResult(result = {}) {
  if (result?.ok) return false;
  if (result?.retryable === true) return true;
  const status = Number(result?.status || 0) || 0;
  return status >= 500 && status <= 599;
}

function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function runAlimtalkWithRetry(operation, options = {}) {
  if (typeof operation !== "function") throw new TypeError("operation must be a function");
  const retryDelaysMs = parseRetryDelays(options.retryDelaysMs);
  const sleep = typeof options.sleep === "function" ? options.sleep : waitFor;
  const onAttempt = typeof options.onAttempt === "function" ? options.onAttempt : null;
  const history = [];
  let attempt = 0;

  while (attempt <= retryDelaysMs.length) {
    attempt += 1;
    let result;
    let retryable = false;
    try {
      result = await operation(attempt);
      retryable = isRetryableAlimtalkResult(result);
    } catch (error) {
      const detail = serializeRetryError(error);
      retryable = isRetryableAlimtalkError(error);
      result = {
        ok: false,
        retryable,
        error: detail.message,
        errorName: detail.name,
        errorCode: detail.code,
        status: detail.status
      };
    }

    const willRetry = !result?.ok && retryable && attempt <= retryDelaysMs.length;
    const delayMs = willRetry ? retryDelaysMs[attempt - 1] : 0;
    history.push({
      attempt,
      ok: Boolean(result?.ok),
      retryable,
      status: Number(result?.status || 0) || 0,
      error: asText(result?.error || result?.reason),
      delayMs
    });
    if (onAttempt) await onAttempt({ attempt, result, retryable, willRetry, delayMs });

    if (result?.ok || !willRetry) {
      return {
        ...result,
        attempts: attempt,
        retryCount: Math.max(0, attempt - 1),
        retryHistory: history
      };
    }
    await sleep(delayMs);
  }

  return {
    ok: false,
    retryable: false,
    error: "Alimtalk retry loop ended unexpectedly",
    attempts: attempt,
    retryCount: Math.max(0, attempt - 1),
    retryHistory: history
  };
}

module.exports = {
  DEFAULT_ALIMTALK_RETRY_DELAYS_MS,
  parseRetryDelays,
  createAlimtalkNotificationId,
  serializeRetryError,
  isRetryableAlimtalkError,
  isRetryableAlimtalkResult,
  runAlimtalkWithRetry
};
