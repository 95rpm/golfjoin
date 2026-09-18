"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const PACKAGE = path.join(ROOT, "deploy/stage59-public-detail-deeplink/public-detail-deeplink-20260903-v59a");
const HTML_FILE = path.join(PACKAGE, "DEPLOY_golfjoin_main_public_detail_deeplink_158E2AC6.html");
const JS_FILE = path.join(PACKAGE, "UPLOAD_golfjoin-main_A388D58C.js.br");
const port = Number(process.argv[2]) || 4176;

const candidateJs = zlib.brotliDecompressSync(fs.readFileSync(JS_FILE));
const candidateJsText = candidateJs.toString("utf8");
const deepLinkFunctionStart = candidateJsText.indexOf("async function resumeJoinExternalDeepLinkOnce()");
const deepLinkFunctionEnd = candidateJsText.indexOf("let joinExternalDeepLinkResumePromise", deepLinkFunctionStart);
if (deepLinkFunctionStart < 0 || deepLinkFunctionEnd <= deepLinkFunctionStart) {
  throw new Error("stage59_deeplink_function_missing");
}
const deepLinkFunction = candidateJsText.slice(deepLinkFunctionStart, deepLinkFunctionEnd);
const runtimeConfig = `<script>
  window.GOLFJOIN_SHEET_API_ENDPOINT = "/golfjoin-sheet-api";
  window.GOLFJOIN_HOME_DATA_V2_ENABLED = false;
</script>`;
const html = fs.readFileSync(HTML_FILE, "utf8")
  .replace(/<script src="https:\/\/storage\.googleapis\.com\/golfjoin-bucket\/web\/home-assets\/gha_[^"]+\/golfjoin-main\.js"[^>]*>\s*<\/script>/, '<script src="/golfjoin-main.js"></script>')
  .replace("</head>", `${runtimeConfig}</head>`);

const harnessHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>v59a public detail QA</title></head><body>
  <div id="joinMemberLoginModal" aria-hidden="true">로그인</div>
  <div id="detailModal" aria-hidden="true"><h1 id="detailTitle"></h1></div>
  <script>
    const qa = window.__qa = { loginCalls: 0, detailCalls: 0, loadedGoodSeq: "", loadedEventSeq: "" };
    function getJoinExternalDeepLinkTarget() { return new URLSearchParams(location.search).get("golfjoinOpen") === "detail" ? "detail" : ""; }
    function normalizeJoinMyReservationTab() { return "created"; }
    function normalizeMyHomeJoinFilter() { return "created"; }
    function getJoinAfterLoginExtraParams() { return {}; }
    function setJoinMobileNavActive() {}
    async function openJoinMyMenu() { return true; }
    function getJoinLoginState() { return { isLogin: false }; }
    function requireJoinLogin() { qa.loginCalls += 1; document.getElementById("joinMemberLoginModal").setAttribute("aria-hidden", "false"); return false; }
    function findJoinExternalDeepLinkDetailTarget() { return null; }
    async function ensureHomeGolfJoinProductsLoaded() { return []; }
    function parseSecretTourProductReference(goodSeq, eventSeq) { return { goodSeq, eventSeq }; }
    async function loadGolfJoinProductDiscoveryDirect(goodSeq, eventSeq) {
      qa.loadedGoodSeq = goodSeq; qa.loadedEventSeq = eventSeq;
      return { id: "secret-tour-" + goodSeq + "-" + eventSeq, goodSeq, eventSeq, title: "광고 대상 상품" };
    }
    async function ensureExternalGolfJoinProductsLoaded() { return []; }
    function clearJoinExternalDeepLinkTarget() {
      const params = new URLSearchParams(location.search);
      ["golfjoinOpen", "joinOpen", "joinId", "scheduleId", "productId", "goodSeq", "eventSeq"].forEach((key) => params.delete(key));
      history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params.toString() : ""));
    }
    function openJoinExternalDeepLinkDetailTarget(join) {
      qa.detailCalls += 1;
      const modal = document.getElementById("detailModal");
      modal.setAttribute("aria-hidden", "false");
      modal.dataset.productId = join.id;
      document.getElementById("detailTitle").textContent = join.title;
      return true;
    }
    async function continueMyHomeJoinDeepLinkAfterLogin() { return true; }
    ${deepLinkFunction}
    window.__qaPromise = resumeJoinExternalDeepLinkOnce().then((result) => { window.__qaResult = result; });
  </script>
</body></html>`;

function json(response, payload, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(payload));
}

http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/" || url.pathname === "/event/plan_view") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(html);
    return;
  }
  if (url.pathname === "/harness") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(harnessHtml);
    return;
  }
  if (url.pathname === "/golfjoin-main.js") {
    response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
    response.end(candidateJs);
    return;
  }
  if (url.pathname === "/golfjoin-sheet-api") {
    const action = url.searchParams.get("action") || "";
    if (action === "home_stats") {
      json(response, { recent30DayVisitors: 0, activeUsersNow: 0, synthetic: true });
      return;
    }
    if (action === "home_bootstrap_light") {
      json(response, {
        ok: true,
        newScheduleSummaries: [],
        participantSummaries: [],
        displayRules: [],
        serverTime: "2026-09-03T15:00:00+09:00",
        synthetic: true
      });
      return;
    }
    json(response, { ok: true, rows: [], newSchedules: [], joinApplications: [], reviews: [], wishes: [], displayRules: [], synthetic: true });
    return;
  }
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Stage59 public detail QA server: http://127.0.0.1:${port}/event/plan_view\n`);
});
