/*
 * Secret Tour 회원 토큰 엔드포인트 수동 점검기
 *
 * 사용 위치: 로그인한 https://www.secret-tour.com 페이지의 Chrome DevTools Console
 * 주의: 토큰 원문은 콘솔에 출력하지 않는다.
 */
(async () => {
  "use strict";

  const endpoint = "/event/web/golfjoin/member-token";
  const expectedIssuer = "secret-tour-member-auth";
  const expectedAudience = "golfjoin-sheet-api";
  const maximumLifetimeSeconds = 5 * 60;
  const forbiddenClaimPattern = /(phone|mobile|email|birthday|birth|gender|name)/i;

  function decodeBase64UrlJson(value = "") {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function includesAudience(audience, expected) {
    if (Array.isArray(audience)) return audience.includes(expected);
    return audience === expected;
  }

  const response = await fetch(endpoint, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  const contentType = response.headers.get("content-type") || "";
  const cacheControl = response.headers.get("cache-control") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : {};
  const token = String(body.token || body.memberToken || body.accessToken || "");
  const parts = token.split(".");
  let header = {};
  let claims = {};
  let decodeError = "";

  if (parts.length === 3) {
    try {
      header = decodeBase64UrlJson(parts[0]);
      claims = decodeBase64UrlJson(parts[1]);
    } catch (error) {
      decodeError = error?.message || String(error);
    }
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const issuedAt = Number(claims.iat || 0);
  const expiresAt = Number(claims.exp || 0);
  const lifetimeSeconds = expiresAt && issuedAt ? expiresAt - issuedAt : 0;
  const claimKeys = Object.keys(claims);
  const checks = {
    "HTTPS same-origin": location.protocol === "https:"
      && new URL(response.url, location.href).origin === location.origin,
    "HTTP 200": response.status === 200,
    "JSON 응답": contentType.includes("application/json"),
    "private 캐시": /(?:^|,)\s*private\b/i.test(cacheControl),
    "no-store 캐시": /(?:^|,)\s*no-store\b/i.test(cacheControl),
    "JWT 3부분": parts.length === 3,
    "디코딩 성공": parts.length === 3 && !decodeError,
    "alg none 금지": Boolean(header.alg) && String(header.alg).toLowerCase() !== "none",
    "발급자 일치": claims.iss === expectedIssuer,
    "대상 서버 일치": includesAudience(claims.aud, expectedAudience),
    "memberSeq 존재": /^\d+$/.test(String(claims.sub || "")),
    "memberKey 일치": claims.memberKey === `seq:${claims.sub || ""}`,
    "현재 유효": issuedAt <= nowSeconds && expiresAt > nowSeconds,
    "수명 5분 이내": lifetimeSeconds > 0 && lifetimeSeconds <= maximumLifetimeSeconds,
    "개인정보 claim 없음": claimKeys.every((key) => !forbiddenClaimPattern.test(key))
  };
  const rows = Object.entries(checks).map(([name, passed]) => ({
    검사: name,
    결과: passed ? "통과" : "실패"
  }));
  console.table(rows);

  const result = {
    ok: Object.values(checks).every(Boolean),
    status: response.status,
    endpoint: new URL(response.url, location.href).pathname,
    cacheControl,
    expiresInSeconds: Math.max(0, expiresAt - nowSeconds),
    header: { alg: header.alg || "", kid: header.kid || "", typ: header.typ || "" },
    claims: {
      iss: claims.iss || "",
      aud: claims.aud || "",
      subPresent: Boolean(claims.sub),
      memberKeyMatchesSub: claims.memberKey === `seq:${claims.sub || ""}`,
      iat: issuedAt || 0,
      exp: expiresAt || 0,
      claimKeys
    },
    decodeError
  };
  console.info("GolfJoin 회원 토큰 검사 결과(토큰 원문 미출력)", result);
  return result;
})().catch((error) => {
  console.error("GolfJoin 회원 토큰 검사 실패", {
    name: error?.name || "Error",
    message: error?.message || String(error)
  });
});
