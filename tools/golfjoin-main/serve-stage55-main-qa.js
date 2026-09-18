"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const builtHtml = fs.readFileSync(path.join(root, "dist/golfjoin-main/golfjoin_main.html"), "utf8");
const port = Number(process.argv[2]) || 4175;
const qaState = { goodsListRequests: 0, goodsEventRequests: 0, flightScheduleRequests: 0 };

const product = {
  goodSeq: 30001242,
  goodNm: "[항공팩-인천LJ] 태국 치앙마이 가산쿤탄 7박9일 월출발 가산쿤탄 (신관)",
  imagePath: "/upload/secrettour/image/goods/main/30001242/secrettour_cm9900_30010639.jpg",
  minStartDay: "20260914",
  dayCnt: 9,
  period: "7박9일",
  dpPrice: 1150000,
  minPrice: 1080000,
  tourCity: "치앙마이",
  areaCdNm: "태국",
  productType: "항공팩",
  goodDetailCdNm: "항공팩",
  air2Cd: "LJ",
  air2Nm: "진에어"
};

const event = {
  eventSeq: 30269530,
  goodSeq: 30001242,
  goodTransportSeq: 0,
  eventNm: product.goodNm,
  imagePath: product.imagePath,
  startDay: "20260914",
  endDay: "20260922",
  depStartDay: "20260914",
  depEndDay: "20260914",
  arrStartDay: "20260922",
  arrEndDay: "20260922",
  depStartTime: "17:00",
  depEndTime: "20:45",
  arrStartTime: "21:45",
  arrEndTime: "05:05",
  air2Cd: "LJ",
  air2Nm: "진에어",
  period: "7박9일",
  adultPrice: 1150000,
  minPrice: 1080000,
  restCnt: 20,
  productType: "항공팩",
  goodDetailCdNm: "항공팩"
};

const inlineProduct = {
  id: "secret-tour-30001242-30269530",
  goodSeq: "30001242",
  eventSeq: "30269530",
  erpProductId: "30001242",
  erpEventSeq: "30269530",
  title: product.goodNm,
  region: "치앙마이",
  category: "해외",
  country: "태국",
  airport: "인천",
  departureAirport: "인천",
  arrivalAirport: "치앙마이",
  airline: "진에어",
  air2Cd: "LJ",
  productType: "항공팩",
  packType: "air",
  packTypeName: "항공팩",
  departureDate: "2026-09-14",
  returnDate: "2026-09-22",
  duration: "7박9일",
  price: 1150000,
  generalPrice: 1150000,
  memberPrice: 1080000,
  image: product.imagePath,
  source: "secret-tour-goods-event",
  flightScheduleItems: [
    { label: "출발", airline: "진에어", code: "LJ", fromDate: "2026-09-14", fromTime: "17:00", toDate: "2026-09-14", toTime: "20:45" },
    { label: "도착", airline: "진에어", code: "LJ", fromDate: "2026-09-22", fromTime: "21:45", toDate: "2026-09-22", toTime: "05:05" }
  ]
};

const initScript = `<script>
  window.GOLFJOIN_SHEET_API_ENDPOINT = "/golfjoin-sheet-api";
  window.SECRET_GOLF_JOIN_PRODUCTS = ${JSON.stringify({
    schema: "secret-golf-join-products-v1",
    range: { startDate: "2026-09-01", endDate: "2026-12-31" },
    items: [inlineProduct]
  })};
  const qaNativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const target = String(typeof input === "string" ? input : input?.url || "");
    if (target.includes("storage.googleapis.com/golfjoin-bucket/web/golfjoin_local_data.json")
      || target.includes("storage.googleapis.com/golfjoin-bucket/web/product-discovery/")) {
      return Promise.reject(new Error("qa_use_inline_product_catalog"));
    }
    return qaNativeFetch(input, init);
  };
  sessionStorage.setItem("joinTempAdminLogin", JSON.stringify({
    memberSeq: "TEMP_ADMIN",
    memberId: "admin@admin.com",
    memberName: "관리자",
    memberChannel: "TEMP",
    gender: "남성",
    birthday: "1969",
    isTempAdmin: true
  }));
</script>`;
const html = builtHtml.replace("</head>", `${initScript}</head>`);

function json(response, payload, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(payload));
}

function detailHtml() {
  return `<!doctype html><html><body>
    <script>const oGoodsView={eventNm:${JSON.stringify(product.goodNm)},goodTransportSeq:"0",startDay:"20260914",endDay:"20260922",adultPrice:1150000,air2Cd:"LJ",air2Nm:"진에어"};</script>
    <div class="detail_title_copy">행사 응답 항공정보 QA 상품</div>
    <div class="detail_box"><div class="title">포함사항</div><ul><li>왕복항공권</li></ul></div>
    <div class="detail_box"><div class="title">불포함사항</div><ul><li>캐디팁</li></ul></div>
    <div class="detail_box"><div class="title">참고사항</div><ul><li>여권 유효기간 확인</li></ul></div>
  </body></html>`;
}

http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/" || url.pathname === "/golfjoin_main.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(html);
    return;
  }
  if (url.pathname === "/qa-state.json") {
    json(response, qaState);
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
        serverTime: "2026-09-02T12:00:00+09:00",
        synthetic: true
      });
      return;
    }
    json(response, { ok: true, rows: [], newSchedules: [], joinApplications: [], reviews: [], wishes: [], displayRules: [], synthetic: true });
    return;
  }
  if (url.pathname === "/goods/getGoodsList.json") {
    qaState.goodsListRequests += 1;
    json(response, { status: 200, message: "SUCCESS", list: [product], count: 1 });
    return;
  }
  if (url.pathname === "/goods/getGoodsEventList.json") {
    qaState.goodsEventRequests += 1;
    json(response, { status: 200, message: "SUCCESS", list: [event], count: 1 });
    return;
  }
  if (url.pathname === "/goods/goods_view") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(detailHtml());
    return;
  }
  if (url.pathname === "/goods/add/flight_schedule") {
    qaState.flightScheduleRequests += 1;
    json(response, { error: "flight_schedule_must_not_be_called_for_event_payload" }, 500);
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Stage55 main QA server: http://127.0.0.1:${port}/\n`);
});
