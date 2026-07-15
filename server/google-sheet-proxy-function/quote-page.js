"use strict";

function escapeHtml(value = "") {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function asText(value, fallback = "-") {
  const text = String(value == null ? "" : value).trim();
  return text || fallback;
}

function safeHttpUrl(value = "") {
  try {
    const source = String(value || "").trim();
    const url = source.startsWith("/")
      ? new URL(source, "https://www.secret-tour.com")
      : new URL(source);
    return url.protocol === "https:" ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

function formatGeneratedAt(value = "") {
  const text = asText(value, "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2})?:?(\d{2})?/);
  if (!match) return text || "-";
  return `${match[1]}.${match[2]}.${match[3]}${match[4] && match[5] ? ` ${match[4]}:${match[5]}` : ""}`;
}

function maskPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 10) return asText(value);
  return `${digits.slice(0, 3)}-${digits.slice(3, 7).replace(/./g, "*")}-${digits.slice(-4)}`;
}

function renderList(items = [], emptyText = "담당자 확인 후 안내") {
  const list = Array.isArray(items) ? items.map((item) => asText(item, "")).filter(Boolean) : [];
  const safeList = list.length ? list : [emptyText];
  return safeList.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function createGolfjoinQuoteHtml(quote = {}, options = {}) {
  const pdfUrl = asText(options.pdfUrl, "");
  const productImageUrl = safeHttpUrl(quote.productImageUrl);
  const heroStyle = productImageUrl ? ` style="background-image:url('${escapeHtml(productImageUrl)}')"` : "";
  const regionText = [quote.country, quote.region].filter(Boolean).join(" · ") || "해외 골프 조인";
  const dateText = `${asText(quote.departureDate)} - ${asText(quote.returnDate)}`;
  const downloadButton = pdfUrl
    ? `<a class="quote-action primary" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener" download>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>
        PDF 다운로드
      </a>`
    : "";
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>${escapeHtml(quote.productName)} | 예약요청 견적서</title>
  <style>
    @font-face{font-family:Pretendard;src:url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:Pretendard;src:url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-SemiBold.woff2') format('woff2');font-weight:600;font-display:swap}
    @font-face{font-family:Pretendard;src:url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
    :root{--blue:#3489f8;--blue-dark:#1769d2;--blue-soft:#eaf3ff;--ink:#172033;--text:#373a3c;--muted:#697386;--line:#dde3ec;--panel:#f4f7fa;--white:#fff}
    *{box-sizing:border-box}
    html{background:#edf2f7}
    body{margin:0;color:var(--text);font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;letter-spacing:0;background:#edf2f7}
    button,a{font:inherit}
    .quote-topbar{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(23,32,51,.08);background:rgba(255,255,255,.96);backdrop-filter:blur(14px)}
    .quote-topbar-inner{width:min(1040px,100%);height:72px;margin:0 auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between;gap:20px}
    .quote-brand{display:flex;align-items:center;gap:12px;color:var(--ink);font-size:15px;font-weight:700}
    .quote-brand-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:8px;background:var(--blue);color:#fff;font-size:17px}
    .quote-brand-copy small{display:block;margin-top:2px;color:var(--muted);font-size:11px;font-weight:400}
    .quote-actions{display:flex;align-items:center;gap:8px}
    .quote-action{height:42px;padding:0 17px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line);border-radius:7px;background:#fff;color:var(--ink);font-size:14px;font-weight:700;text-decoration:none;cursor:pointer}
    .quote-action.primary{border-color:var(--blue);background:var(--blue);color:#fff}
    .quote-action svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .quote-page{width:min(1040px,calc(100% - 32px));margin:28px auto 56px;background:#fff;box-shadow:0 18px 50px rgba(23,32,51,.10)}
    .quote-hero{position:relative;min-height:330px;padding:44px 48px;display:flex;align-items:flex-end;background:#245b9d center/cover no-repeat;color:#fff;overflow:hidden}
    .quote-hero::before{content:"";position:absolute;inset:0;background:rgba(7,24,47,.58)}
    .quote-hero-content{position:relative;z-index:1;max-width:760px}
    .quote-kicker{margin:0 0 14px;color:#dcecff;font-size:15px;font-weight:700}
    .quote-hero h1{margin:0;font-size:38px;line-height:1.28;font-weight:700;word-break:keep-all}
    .quote-hero-meta{margin-top:20px;display:flex;flex-wrap:wrap;gap:10px 20px;color:#f1f6ff;font-size:17px;font-weight:600}
    .quote-body{padding:46px 48px 52px}
    .quote-document-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:34px;border-bottom:1px solid var(--line)}
    .quote-document-head h2{margin:0 0 10px;color:var(--ink);font-size:29px;line-height:1.3}
    .quote-document-head p{margin:0;color:var(--muted);font-size:14px;line-height:1.7}
    .quote-status{flex:none;padding:9px 13px;border-radius:5px;background:var(--blue-soft);color:var(--blue-dark);font-size:13px;font-weight:700}
    .quote-total-callout{margin:34px 0 42px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px;background:var(--blue);color:#fff}
    .quote-total-callout span{color:#dcecff;font-size:14px}.quote-total-callout strong{font-size:30px}
    .quote-summary{display:grid;grid-template-columns:1.35fr .65fr;margin:34px 0 42px;background:var(--blue)}
    .quote-summary-main,.quote-summary-total{padding:25px 28px}
    .quote-summary-total{border-left:1px solid rgba(255,255,255,.24);text-align:right}
    .quote-summary-label{display:block;margin-bottom:8px;color:#dcecff;font-size:13px}
    .quote-summary strong{display:block;color:#fff;font-size:24px;line-height:1.35}
    .quote-summary-main span:last-child{display:block;margin-top:7px;color:#eef6ff;font-size:15px}
    .quote-summary-total strong{font-size:30px}
    .quote-section{margin-top:42px}
    .quote-section-title{display:flex;align-items:center;gap:13px;margin:0 0 20px;color:var(--ink);font-size:21px}
    .quote-section-number{color:var(--blue);font-size:13px;font-weight:700}
    .quote-info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .quote-info-item{min-height:88px;padding:20px 18px;border-right:1px solid var(--line)}
    .quote-info-item:nth-child(3n){border-right:0}
    .quote-info-item:nth-child(n+4){border-top:1px solid var(--line)}
    .quote-info-item span{display:block;margin-bottom:8px;color:var(--muted);font-size:13px}
    .quote-info-item strong{color:var(--text);font-size:17px;line-height:1.45;word-break:keep-all}
    .quote-product-name{padding:24px 0 22px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .quote-product-name span{display:block;margin-bottom:8px;color:var(--muted);font-size:13px}
    .quote-product-name strong{display:block;color:var(--ink);font-size:19px;line-height:1.55;word-break:keep-all}
    .quote-price-table{width:100%;border-collapse:collapse;border-top:2px solid var(--ink)}
    .quote-price-table th,.quote-price-table td{height:62px;padding:0 18px;border-bottom:1px solid var(--line);text-align:left}
    .quote-price-table th{width:27%;color:var(--text);font-size:16px}
    .quote-price-table td:nth-child(2){color:var(--muted);font-size:14px}
    .quote-price-table td:last-child{width:25%;color:var(--ink);font-size:17px;font-weight:700;text-align:right}
    .quote-price-table tr.total{background:var(--blue-soft)}
    .quote-price-table tr.total th,.quote-price-table tr.total td:last-child{color:var(--blue-dark);font-size:20px}
    .quote-detail-columns{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .quote-detail-block{padding:25px 26px}
    .quote-detail-block + .quote-detail-block{border-left:1px solid var(--line)}
    .quote-detail-block h4{margin:0 0 15px;color:var(--ink);font-size:16px}
    .quote-detail-block ul{margin:0;padding:0;list-style:none;display:grid;gap:10px}
    .quote-detail-block li{position:relative;padding-left:18px;color:var(--text);font-size:14px;line-height:1.65}
    .quote-detail-block li::before{content:"";position:absolute;left:1px;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--blue)}
    .quote-process{margin-top:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:0;background:var(--panel)}
    .quote-step{position:relative;padding:25px 25px 25px 66px}
    .quote-step + .quote-step{border-left:1px solid var(--line)}
    .quote-step-number{position:absolute;left:24px;top:25px;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--blue-soft);color:var(--blue-dark);font-size:13px;font-weight:700}
    .quote-step:first-child .quote-step-number{background:var(--blue);color:#fff}
    .quote-step strong{display:block;margin-bottom:5px;color:var(--ink);font-size:15px}
    .quote-step span{color:var(--muted);font-size:12px}
    .quote-notice{margin-top:28px;padding:22px 24px;border-left:4px solid var(--blue);background:var(--panel);color:var(--muted);font-size:14px;line-height:1.75;white-space:pre-line}
    .quote-detail-block .quote-notice{margin-top:0;padding:0;border-left:0;background:transparent}
    .quote-footer{padding:28px 48px;display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
    @media(max-width:700px){
      body{padding-bottom:82px}
      .quote-topbar{position:fixed;top:auto;bottom:0;left:0;right:0;border-top:1px solid var(--line);border-bottom:0}
      .quote-topbar-inner{height:74px;padding:10px 16px}.quote-brand{display:none}.quote-actions{width:100%}.quote-action{flex:1;height:50px}
      .quote-page{width:100%;margin:0;box-shadow:none}.quote-hero{min-height:290px;padding:32px 22px}.quote-hero h1{font-size:28px}.quote-hero-meta{font-size:15px}
      .quote-body{padding:32px 20px 38px}.quote-document-head{display:block}.quote-status{display:inline-block;margin-top:18px}
      .quote-total-callout{align-items:flex-start;flex-direction:column;padding:22px}.quote-total-callout strong{font-size:27px}
      .quote-info-grid{grid-template-columns:1fr 1fr}.quote-info-item:nth-child(3n){border-right:1px solid var(--line)}.quote-info-item:nth-child(2n){border-right:0}.quote-info-item:nth-child(n+3){border-top:1px solid var(--line)}
      .quote-price-table th,.quote-price-table td{padding:0 10px}.quote-price-table th{width:34%;font-size:14px}.quote-price-table td:nth-child(2){font-size:12px}.quote-price-table td:last-child{width:32%;font-size:14px}.quote-price-table tr.total th,.quote-price-table tr.total td:last-child{font-size:17px}
      .quote-detail-columns,.quote-process{grid-template-columns:1fr}.quote-detail-block + .quote-detail-block,.quote-step + .quote-step{border-left:0;border-top:1px solid var(--line)}
      .quote-footer{padding:25px 20px;display:block;line-height:1.8}
    }
    @media print{html,body{background:#fff}.quote-topbar{display:none}.quote-page{width:100%;margin:0;box-shadow:none}.quote-hero{min-height:270px}.quote-body{padding-top:34px}}
  </style>
</head>
<body>
  <header class="quote-topbar">
    <div class="quote-topbar-inner">
      <div class="quote-brand"><span class="quote-brand-mark">S</span><span class="quote-brand-copy">SECRET TOUR<small>해외 골프 조인</small></span></div>
      <div class="quote-actions">
        <button class="quote-action" type="button" onclick="window.print()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>인쇄</button>
        ${downloadButton}
      </div>
    </div>
  </header>
  <main class="quote-page">
    <section class="quote-hero"${heroStyle}>
      <div class="quote-hero-content">
        <p class="quote-kicker">SECRET TOUR · OVERSEAS GOLF JOIN</p>
        <h1>${escapeHtml(quote.productName)}</h1>
        <div class="quote-hero-meta"><span>${escapeHtml(regionText)}</span><span>${escapeHtml(dateText)}</span></div>
      </div>
    </section>
    <div class="quote-body">
      <header class="quote-document-head">
        <div><h2>예약요청 견적서</h2><p>견적번호 ${escapeHtml(quote.quoteNo)}<br>생성일 ${escapeHtml(formatGeneratedAt(quote.generatedAt))}</p></div>
        <span class="quote-status">담당자 확인 견적</span>
      </header>
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">01</span>예약 정보</h3>
        <div class="quote-info-grid">
          <div class="quote-info-item"><span>신청자</span><strong>${escapeHtml(quote.applicantName)}</strong></div>
          <div class="quote-info-item"><span>연락처</span><strong>${escapeHtml(maskPhone(quote.applicantPhone))}</strong></div>
          <div class="quote-info-item"><span>신청 유형</span><strong>${escapeHtml(quote.applicationType)}</strong></div>
          <div class="quote-info-item"><span>숙소 타입</span><strong>${escapeHtml(quote.roomType)}</strong></div>
          <div class="quote-info-item"><span>항공</span><strong>${escapeHtml(quote.airline)}</strong></div>
          <div class="quote-info-item"><span>이용 공항</span><strong>${escapeHtml([quote.departureAirport, quote.arrivalAirport].filter(Boolean).join(" → ") || "-")}</strong></div>
        </div>
      </section>
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">02</span>실제 상품 정보</h3>
        <div class="quote-detail-columns">
          <div class="quote-detail-block"><h4>항공 일정</h4><ul>${renderList(quote.flightScheduleItems, "상품 상세 확인 필요")}</ul></div>
          <div class="quote-detail-block"><h4>주요 일정</h4><ul>${renderList(quote.itineraryItems, "상품 상세 확인 필요")}</ul></div>
        </div>
      </section>
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">03</span>견적 금액</h3>
        <table class="quote-price-table">
          <tbody>
            <tr><th>상품가</th><td>1인 기준 × ${escapeHtml(quote.people)}명</td><td>${escapeHtml(quote.formattedProductSubtotal)}</td></tr>
            <tr><th>1인 1실 추가요금</th><td>${quote.singleRoomSurcharge ? "신청 기준" : "해당 없음"}</td><td>${escapeHtml(quote.formattedSingleRoomSurcharge)}</td></tr>
            <tr class="total"><th>예상 총액</th><td>담당자 산출</td><td>${escapeHtml(quote.formattedEstimatedTotal)}</td></tr>
            <tr><th>예약금</th><td>1인 ${escapeHtml(quote.formattedDepositPerPerson)}</td><td>${escapeHtml(quote.formattedDeposit)}</td></tr>
            <tr><th>잔금</th><td>예약금 제외</td><td>${escapeHtml(quote.formattedBalance)}</td></tr>
          </tbody>
        </table>
      </section>
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">04</span>실제 상품 포함·불포함 사항</h3>
        <div class="quote-detail-columns">
          <div class="quote-detail-block"><h4>포함 사항</h4><ul>${renderList(quote.includedItems)}</ul></div>
          <div class="quote-detail-block"><h4>불포함 사항</h4><ul>${renderList(quote.excludedItems)}</ul></div>
        </div>
      </section>
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">05</span>상품 참고 및 예약 안내</h3>
        <div class="quote-detail-columns">
          <div class="quote-detail-block"><h4>상품 참고사항</h4><ul>${renderList(quote.productNotes, "등록된 상품 참고사항 없음")}</ul></div>
          <div class="quote-detail-block"><h4>견적 유의사항</h4><div class="quote-notice">${escapeHtml(quote.specialNotes)}</div></div>
        </div>
        <div class="quote-process">
          <div class="quote-step"><span class="quote-step-number">1</span><strong>견적 확인</strong><span>상품·일정·금액 확인</span></div>
          <div class="quote-step"><span class="quote-step-number">2</span><strong>예약금 입금</strong><span>${escapeHtml(quote.accountText)}</span></div>
          <div class="quote-step"><span class="quote-step-number">3</span><strong>예약 진행</strong><span>담당자 확인 후 확정 안내</span></div>
        </div>
      </section>
    </div>
    <footer class="quote-footer"><strong>시크릿투어 해외 골프 조인</strong><span>카카오채널 문의 · www.secret-tour.com</span></footer>
  </main>
</body>
</html>`;
}

module.exports = {
  createGolfjoinQuoteHtml
};
