"use strict";

const ERP_ORIGIN = "https://secrettour.toursoft.co.kr";
const ERP_BASE_URL = `${ERP_ORIGIN}/erp`;

const ERP_LOGIN_URL = `${ERP_BASE_URL}/login`;
const ERP_LOGIN_COOKIE_URL = `${ERP_BASE_URL}/login_cookie`;
const ERP_MAIN_URL = `${ERP_BASE_URL}/main/main`;

const ERP_SESSION_TTL_MS = Number(
  process.env.ERP_SESSION_TTL_MS || 10 * 60 * 1000
);

let cachedCookieHeader = "";
let cachedCookieExpiresAt = 0;
let pendingLogin = null;

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const value = headers.get("set-cookie");
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
}

function mergeCookies(cookieJar, response) {
  getSetCookieHeaders(response.headers).forEach((setCookie) => {
    const cookiePair = String(setCookie || "").split(";", 1)[0];
    const separatorIndex = cookiePair.indexOf("=");
    if (separatorIndex <= 0) return;

    const name = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();
    if (!name) return;

    if (value) cookieJar.set(name, value);
    else cookieJar.delete(name);
  });
}

function buildCookieHeader(cookieJar) {
  return [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function isLoginPageHtml(text = "") {
  return (
    /id=["']loginSend["']/i.test(text)
    || /name=["']empPw["']/i.test(text)
    || /id=["']empNo["']/i.test(text)
  );
}

function invalidateErpSession() {
  cachedCookieHeader = "";
  cachedCookieExpiresAt = 0;
}

async function loginErp() {
  const officeId = requiredEnv("ERP_OFFICE_ID");
  const empNo = requiredEnv("ERP_EMP_NO");
  const empPw = requiredEnv("ERP_EMP_PW");
  const cookieJar = new Map();

  const loginPageResponse = await fetch(ERP_LOGIN_URL, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      "User-Agent": "Golfjoin ERP Client/1.0"
    }
  });

  if (!loginPageResponse.ok) {
    throw new Error(`ERP login page failed: ${loginPageResponse.status}`);
  }
  mergeCookies(cookieJar, loginPageResponse);

  const loginResponse = await fetch(ERP_LOGIN_COOKIE_URL, {
    method: "POST",
    redirect: "manual",
    body: new URLSearchParams({ officeId, empNo, empPw }),
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "text/html,application/xhtml+xml,application/json,*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: ERP_ORIGIN,
      Referer: ERP_LOGIN_URL,
      Cookie: buildCookieHeader(cookieJar),
      "User-Agent": "Golfjoin ERP Client/1.0"
    }
  });

  mergeCookies(cookieJar, loginResponse);
  const location = String(loginResponse.headers.get("location") || "");
  const hasJsessionCookie = cookieJar.has("JSESSIONID");
  const hasMtbsCookie = cookieJar.has("MTBS_COOKIE");
  const redirectedToMain = /\/erp\/main\/main/i.test(location);

  if (!hasJsessionCookie && !hasMtbsCookie && !redirectedToMain) {
    throw new Error(`ERP login failed: status=${loginResponse.status}`);
  }

  const mainResponse = await fetch(ERP_MAIN_URL, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "text/html,application/xhtml+xml,*/*",
      Cookie: buildCookieHeader(cookieJar),
      Referer: ERP_LOGIN_URL,
      "User-Agent": "Golfjoin ERP Client/1.0"
    }
  });

  mergeCookies(cookieJar, mainResponse);
  const mainLocation = String(mainResponse.headers.get("location") || "");
  if (/\/erp\/login/i.test(mainLocation) || mainResponse.status >= 400) {
    throw new Error(`ERP session validation failed: ${mainResponse.status}`);
  }

  const mainHtml = await mainResponse.text();
  if (isLoginPageHtml(mainHtml)) {
    throw new Error("ERP session returned the login page");
  }

  cachedCookieHeader = buildCookieHeader(cookieJar);
  cachedCookieExpiresAt = Date.now() + ERP_SESSION_TTL_MS;
  return cachedCookieHeader;
}

async function getErpSessionCookie(options = {}) {
  const force = Boolean(options.force);
  if (!force && cachedCookieHeader && Date.now() < cachedCookieExpiresAt) {
    return cachedCookieHeader;
  }
  if (pendingLogin) return pendingLogin;

  pendingLogin = loginErp().finally(() => {
    pendingLogin = null;
  });
  return pendingLogin;
}

async function postErpFormJson(path, formData = {}, options = {}) {
  const url = path.startsWith("http")
    ? path
    : `${ERP_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const cookieHeader = await getErpSessionCookie({ force: attempt > 0 });
    const form = Object.entries(formData).reduce((result, [key, value]) => {
      result[key] = value == null ? "" : String(value);
      return result;
    }, {});

    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(Number(options.timeoutMs || 20_000)),
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Origin: ERP_ORIGIN,
        Referer: options.referer || ERP_MAIN_URL,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader,
        "User-Agent": "Golfjoin ERP Client/1.0"
      }
    });

    const location = String(response.headers.get("location") || "");
    const text = await response.text();
    const sessionExpired = (
      response.status === 401
      || response.status === 403
      || /\/erp\/login/i.test(location)
      || isLoginPageHtml(text)
    );

    if (sessionExpired && attempt === 0) {
      invalidateErpSession();
      continue;
    }
    if (!response.ok) {
      throw new Error(`ERP request failed: ${response.status} ${text.slice(0, 150)}`);
    }

    try {
      return JSON.parse(text || "{}");
    } catch {
      throw new Error(`ERP response is not JSON: ${text.slice(0, 150)}`);
    }
  }

  throw new Error("ERP session could not be established");
}

module.exports = {
  ERP_BASE_URL,
  getErpSessionCookie,
  invalidateErpSession,
  postErpFormJson
};
