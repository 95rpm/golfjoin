"use strict";

const QUOTE_HERO_IMAGE_URL = "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/bg_invoice.webp";

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

function formatPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return asText(value);
}

function formatTripPeriod(value = "", departureDate = "", returnDate = "") {
  const text = asText(value, "");
  if (text) {
    return text.replace(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/, "$1 ~ $2");
  }
  return `${asText(departureDate)} ~ ${asText(returnDate)}`;
}

function renderList(items = [], emptyText = "담당자 확인 후 안내") {
  const list = Array.isArray(items) ? items.map((item) => asText(item, "")).filter(Boolean) : [];
  const safeList = list.length ? list : [emptyText];
  return safeList.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function normalizeScheduleItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 15).map((item, index) => {
    if (!item || typeof item !== "object") return null;
    const meals = Array.isArray(item.meals)
      ? item.meals.slice(0, 6).map((meal) => ({
        label: asText(meal?.label, ""),
        menu: asText(meal?.menu, "")
      })).filter((meal) => meal.label || meal.menu)
      : [];
    const rawPoints = Array.isArray(item.points) ? item.points : [];
    const points = rawPoints.map((point) => {
      if (point && typeof point === "object") {
        return {
          title: asText(point.title || point.main || point.name || point.text || point.content, ""),
          description: asText(point.description || point.subText || point.subtitle || point.detail, "")
        };
      }
      return { title: asText(point, ""), description: "" };
    }).filter((point) => point.title).slice(0, 20);
    const content = asText(item.content || item.rawText, "");
    return {
      day: asText(item.day, `${index + 1}일차`),
      dateText: asText(item.dateText, ""),
      points: points.length ? points : (content ? [{ title: content, description: "" }] : []),
      hotel: asText(item.hotel, ""),
      meals
    };
  }).filter(Boolean);
}

function formatScheduleDateText(value = "") {
  const text = asText(value, "");
  const fullDate = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(\s*\([^)]+\))?/);
  if (fullDate) {
    return `${fullDate[1].slice(-2)}.${String(Number(fullDate[2])).padStart(2, "0")}.${String(Number(fullDate[3])).padStart(2, "0")}${fullDate[4] || ""}`;
  }
  return text;
}

function renderScheduleTimeline(scheduleItems = [], fallbackItems = []) {
  const schedule = normalizeScheduleItems(scheduleItems);
  if (!schedule.length) {
    const fallback = Array.isArray(fallbackItems) ? fallbackItems : [];
    return `<div class="quote-schedule-empty"><ul>${renderList(fallback, "상품 상세 확인 필요")}</ul></div>`;
  }
  return `<div class="quote-schedule">${schedule.map((item) => `
    <article class="quote-schedule-item">
      <div class="quote-schedule-head"><strong>${escapeHtml(item.day)}</strong>${item.dateText ? `<span>${escapeHtml(formatScheduleDateText(item.dateText))}</span>` : ""}</div>
      ${(item.hotel || item.meals.length) ? `<div class="quote-schedule-extras">
        ${item.hotel ? `<div><span class="quote-extra-label">숙소</span><p>${escapeHtml(item.hotel)}</p></div>` : ""}
        ${item.meals.length ? `<div><span class="quote-extra-label">식사</span><p>${item.meals.map((meal) => escapeHtml([meal.label, meal.menu].filter(Boolean).join(" "))).join(" · ")}</p></div>` : ""}
      </div>` : ""}
      <div class="quote-schedule-points">${item.points.length
        ? item.points.map((point) => `<div class="quote-schedule-point${point.description ? " has-description" : ""}"><span class="quote-schedule-dot"></span><div class="quote-schedule-copy"><strong>${escapeHtml(point.title)}</strong>${point.description ? `<p>${escapeHtml(point.description)}</p>` : ""}</div></div>`).join("")
        : `<div class="quote-schedule-point"><span class="quote-schedule-dot"></span><div class="quote-schedule-copy"><strong>상품 상세 확인 필요</strong></div></div>`}
      </div>
    </article>`).join("")}</div>`;
}

function renderQuoteFlightInfo(quote = {}) {
  const structuredRows = getQuoteStructuredFlightRows(quote);
  if (structuredRows.length) {
    const rows = structuredRows.map((row) => `
      <article class="quote-flight-journey">
        <header class="quote-flight-journey-head">
          <span><b>${escapeHtml(row.label)}</b> ${escapeHtml(row.dateText)}</span>
          <span class="quote-flight-airline"><i>${renderQuoteAirlineIcon()}</i>${escapeHtml(row.airline || "-")}</span>
        </header>
        <div class="quote-flight-route">
          <div class="quote-flight-stop"><strong>${escapeHtml(row.departureTime || "-")}</strong><span>${escapeHtml(row.origin)}</span></div>
          <div class="quote-flight-route-center"><i></i><span>${escapeHtml(row.flightName || "-")}</span></div>
          <div class="quote-flight-stop"><strong>${escapeHtml(row.arrivalTime || "-")}</strong><span>${escapeHtml(row.destination)}</span></div>
        </div>
      </article>
    `).join("");
    return `<div class="quote-flight-schedule-details">${rows}</div>`;
  }
  if (!quote.flightExcluded) {
    return `<strong>${escapeHtml(quote.airline)}</strong><ul>${renderList(quote.flightScheduleItems, "상품 상세 확인 필요")}</ul>`;
  }
  const requestType = asText(quote.flightRequestType, "") === "직접예약" ? "직접예약" : "대행요청";
  const guideLines = getQuoteFlightGuideLines(requestType);
  return `<strong>${requestType}</strong><div class="quote-flight-request-guide"><p>${guideLines.map(escapeHtml).join(" ")}</p></div>`;
}

function getQuoteStructuredFlightRows(quote = {}) {
  const normalizedAirline = asText(quote.airline).replace(/\s+/g, "");
  const hasActualAirline = Boolean(normalizedAirline) && ![
    "-", "담당자확인", "개별항공", "항공불포함", "불포함", "대행요청", "직접예약"
  ].includes(normalizedAirline);
  if (!hasActualAirline || (quote.flightExcluded && asText(quote.flightRequestType) !== "대행요청")) return [];
  const details = quote.flightDetails && typeof quote.flightDetails === "object" ? quote.flightDetails : quote;
  return [
    {
      label: "가는편",
      dateText: formatQuoteFlightDate(quote.departureDate),
      airline: asText(quote.airline, ""),
      flightName: asText(details.outboundFlightName, ""),
      departureTime: asText(details.outboundDepartureTime, ""),
      arrivalTime: asText(details.outboundArrivalTime, ""),
      origin: asText(quote.departureAirport, "출발공항"),
      destination: asText(quote.arrivalAirport, "도착공항")
    },
    {
      label: "오는편",
      dateText: formatQuoteFlightDate(quote.returnDate),
      airline: asText(quote.airline, ""),
      flightName: asText(details.inboundFlightName, ""),
      departureTime: asText(details.inboundDepartureTime, ""),
      arrivalTime: asText(details.inboundArrivalTime, ""),
      origin: asText(quote.arrivalAirport, "출발공항"),
      destination: asText(quote.departureAirport, "도착공항")
    }
  ].filter((row) => row.flightName || row.departureTime || row.arrivalTime);
}

function formatQuoteFlightDate(value = "") {
  const match = asText(value, "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return asText(value, "날짜 확인 필요");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${Number(match[2])}월 ${Number(match[3])}일(${weekdays[date.getUTCDay()]})`;
}

function renderQuoteAirlineIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 19 9 15.5V19l-2 1v-5.5L2 12v-2l5-2.5V4l2 1v3.5L17.8 5c.7-.3 1.5.2 1.5 1v12c0 .8-.8 1.3-1.5 1Z"/></svg>';
}

function getQuoteFlightGuideLines(requestType = "") {
  return requestType === "직접예약"
    ? [
      "모임 인원 모집이 완료되면 알림톡이 발송됩니다.",
      "담당자가 항공 예약 관련하여 별도 안내드립니다.",
      "내용 확인 후 항공 예약을 진행해주세요."
    ]
    : [
      "모임 인원모집 완료 후 항공 예약이 진행되며,",
      "담당자가 항공 예약 관련하여 별도 안내드립니다."
    ];
}

function hasQuoteAirfare(quote = {}) {
  if (Number(quote.airfare) > 0 || quote.airfareIncluded === true) return true;
  return (Array.isArray(quote.additionalAmounts) ? quote.additionalAmounts : []).some((item) => (
    asText(item?.label, "").replace(/\s+/g, "") === "항공료" && Number(item?.amount) > 0
  ));
}

function createGolfjoinQuoteHtml(quote = {}, options = {}) {
  const pdfUrl = asText(options.pdfUrl, "");
  const quoteHeroImageUrl = safeHttpUrl(QUOTE_HERO_IMAGE_URL);
  const quoteNo = asText(quote.quoteNo, "");
  const regionText = [quote.country, quote.region].filter(Boolean).join(" · ") || "해외 골프 조인";
  const dateText = `${asText(quote.departureDate)} ~ ${asText(quote.returnDate)}`;
  const isGolfPack = Boolean(quote.flightExcluded);
  const flightRequestType = asText(quote.flightRequestType, "") === "직접예약" ? "직접예약" : "대행요청";
  const isFlightAgencyRequest = isGolfPack && flightRequestType === "대행요청";
  const airfareIncluded = !isGolfPack || hasQuoteAirfare(quote);
  const airfareStatusText = airfareIncluded ? "항공료 포함" : "항공료 미포함";
  const airfarePending = isGolfPack && !airfareIncluded;
  const balanceFlightGuide = isFlightAgencyRequest && airfarePending
    ? `<div class="quote-price-flight-guide"><p>${getQuoteFlightGuideLines(flightRequestType).map(escapeHtml).join(" ")}</p></div>`
    : "";
  const additionalPriceRows = (Array.isArray(quote.additionalAmounts) ? quote.additionalAmounts : [])
    .map((item) => `<div class="quote-price-row"><div class="quote-price-copy"><strong>${escapeHtml(item.label)}</strong></div><div class="quote-price-amount">${escapeHtml(item.formattedAmount)}</div></div>`)
    .join("");
  const hasStructuredFlight = getQuoteStructuredFlightRows(quote).length > 0;
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
  <title>${escapeHtml(quote.productName)} | 견적서</title>
  <style>
    @font-face{font-family:Pretendard;src:url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:Pretendard;src:url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-SemiBold.woff2') format('woff2');font-weight:600;font-display:swap}
    @font-face{font-family:Pretendard;src:url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
    :root{--accent:#5b55c6;--accent-soft:#eeecff;--blue:var(--accent);--blue-dark:var(--accent);--blue-soft:var(--accent-soft);--ink:#171927;--text:var(--ink);--muted:var(--ink);--line:#e6e7ee;--panel:#f4f4f6;--white:#fff}
    *{box-sizing:border-box}
    html{background:#f3f4f8}
    body{margin:0;color:var(--text);font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;letter-spacing:0;background:#f3f4f8}
    button,a{font:inherit}
    .quote-topbar{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(23,32,51,.08);background:rgba(255,255,255,.96);backdrop-filter:blur(14px)}
    .quote-topbar-inner{width:min(1120px,100%);height:76px;margin:0 auto;padding:0 30px;display:flex;align-items:center;justify-content:space-between;gap:20px}
    .quote-brand{display:flex;align-items:center;gap:12px;color:var(--ink);font-size:15px;font-weight:700}
    .quote-brand-mark{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:var(--accent);color:#fff;font-size:17px;box-shadow:0 8px 20px rgba(91,85,198,.2)}
    .quote-brand-copy small{display:block;margin-top:2px;color:var(--muted);font-size:11px;font-weight:400}
    .quote-actions{display:flex;align-items:center;gap:8px}
    .quote-action{height:44px;padding:0 18px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:14px;font-weight:700;text-decoration:none;cursor:pointer}
    .quote-action.primary{border-color:var(--blue);background:var(--blue);color:#fff}
    .quote-action svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .quote-page{width:min(1120px,calc(100% - 40px));margin:34px auto 68px}
    .quote-hero{position:relative;min-height:430px;padding:58px 60px;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);align-items:stretch;gap:56px;border:0;border-radius:30px;background:#fff;box-shadow:0 22px 60px rgba(34,38,63,.08);overflow:hidden}
    .quote-hero::after{content:"";position:absolute;right:24px;top:20px;width:128px;height:76px;opacity:.42;background-image:radial-gradient(var(--accent) 1.5px,transparent 1.5px);background-size:14px 14px;pointer-events:none}
    .quote-hero-content{position:relative;z-index:1;align-self:center;padding:10px 0}
    .quote-hero-logo{width:116px;height:auto;display:block;margin:0 0 32px;object-fit:contain}
    .quote-hero h1{max-width:560px;margin:0;color:var(--ink);font-size:36px;line-height:1.3;font-weight:700;word-break:keep-all}
    .quote-hero h1 span{display:block}
    .quote-hero-product{max-width:560px;margin:18px 0 0;color:var(--text);font-size:20px;font-weight:600;line-height:1.4;word-break:keep-all}
    .quote-hero-meta{margin-top:20px;display:flex;flex-wrap:wrap;gap:7px;color:var(--ink);font-size:16px;font-weight:600}
    .quote-hero-meta>span{padding:8px 14px;border-radius:999px;background:var(--accent-soft)}
    .quote-hero-meta>span+span{background:var(--panel)}
    .quote-hero-document-meta{flex:0 0 100%;margin:12px 0 0;color:#667085;font-size:13px;font-weight:400;line-height:1.7}
    .quote-number-line{display:flex;align-items:center;gap:6px}.quote-number-copy{width:26px;height:26px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:#667085;cursor:pointer}.quote-number-copy:hover{background:var(--accent-soft);color:var(--accent)}.quote-number-copy:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.quote-number-copy svg{width:16px;height:16px}.quote-number-copy.is-copied{background:var(--accent-soft);color:var(--accent)}.quote-copy-status{min-width:36px;color:var(--accent);font-size:12px;font-weight:600}
    .quote-hero-media{position:relative;z-index:1;min-height:310px;overflow:visible;background:transparent}
    .quote-hero-media::before{content:none;position:absolute;z-index:2;left:0;top:0;width:116px;height:42px;background:url("https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/logo2.png") left top/contain no-repeat;pointer-events:none}
    .quote-hero-media img{width:100%;height:100%;display:block;object-fit:contain}
    .quote-hero-placeholder{width:100%;height:100%;display:grid;place-items:center;color:var(--blue-dark);font-size:15px;font-weight:700}
    .quote-body{padding:0}
    .quote-total-callout{margin:34px 0 42px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px;background:var(--accent-soft);color:var(--accent)}
    .quote-total-callout span{color:var(--accent);font-size:14px}.quote-total-callout strong{font-size:30px}
    .quote-summary{display:grid;grid-template-columns:1.35fr .65fr;margin:34px 0 42px;background:var(--accent-soft)}
    .quote-summary-main,.quote-summary-total{padding:25px 28px}
    .quote-summary-total{border-left:1px solid rgba(255,255,255,.24);text-align:right}
    .quote-summary-label{display:block;margin-bottom:8px;color:var(--accent);font-size:13px}
    .quote-summary strong{display:block;color:var(--accent);font-size:24px;line-height:1.35}
    .quote-summary-main span:last-child{display:block;margin-top:7px;color:var(--ink);font-size:15px}
    .quote-summary-total strong{font-size:30px}
    .quote-section{margin-top:24px;padding:50px 52px;border:0;border-radius:28px;background:#fff;box-shadow:0 18px 48px rgba(34,38,63,.06)}
    .quote-section-title{display:flex;align-items:center;gap:14px;margin:0 0 30px;color:var(--ink);font-size:25px;letter-spacing:-.025em}
    .quote-section-number{width:34px;height:25px;display:inline-grid;place-items:center;margin-right:0;border-radius:7px;background:var(--accent-soft);color:var(--accent);font-size:16px;font-weight:700}
    .quote-info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .quote-info-item{min-height:128px;padding:24px;border:0;border-radius:20px;background:var(--panel)}
    .quote-info-item:nth-child(2),.quote-info-item:nth-child(3){background:var(--panel)}
    .quote-info-item span{display:block;margin-bottom:22px;color:var(--muted);font-size:13px}
    .quote-info-item:nth-child(2) span{color:var(--ink)}
    .quote-info-item strong{color:var(--ink);font-size:19px;line-height:1.45;word-break:keep-all}
    .quote-info-item:nth-child(2) strong{color:var(--ink)}
    .quote-product-name{padding:4px 0 28px;border-bottom:1px solid var(--line)}
    .quote-product-name span{display:block;margin-bottom:8px;color:var(--muted);font-size:13px}
    .quote-product-name strong{display:block;color:var(--ink);font-size:24px;line-height:1.4;word-break:keep-all}
    .quote-product-basics{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px;border:0}
    .quote-product-basic{padding:26px;border-radius:20px;background:var(--panel)}
    .quote-product-basic + .quote-product-basic{border-left:0;background:var(--panel)}
    .quote-product-basic>span{display:block;margin-bottom:8px;color:var(--muted);font-size:13px}
    .quote-product-basic>strong{display:block;color:var(--ink);font-size:17px;line-height:1.5}
    .quote-product-basic ul{margin:13px 0 0;padding:0;list-style:none;display:grid;gap:8px}
    .quote-product-basic li{position:relative;padding-left:18px;font-size:14px;line-height:1.6}
    .quote-product-basic li::before{content:"";position:absolute;left:1px;top:.68em;width:6px;height:6px;border-radius:50%;background:var(--blue)}
    .quote-flight-request-guide{margin:12px 0 0;padding:15px 16px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-size:16px;line-height:1.5;word-break:keep-all}.quote-flight-request-guide p{margin:0}.quote-flight-schedule-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:20px;border:1px solid #e4e7ec;border-radius:13px;background:#fff;box-shadow:0 6px 16px rgba(15,23,42,.11)}.quote-flight-journey{min-width:0}.quote-flight-journey+ .quote-flight-journey{margin-left:18px;padding-left:18px;border-left:1px solid #e4e7ec}.quote-flight-journey-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px;color:#171927;font-size:15px;line-height:1.4}.quote-flight-journey-head>span:first-child{font-weight:700;white-space:nowrap}.quote-flight-journey-head b{color:#667085;font-weight:500}.quote-flight-airline{display:flex;align-items:center;gap:5px;color:#475467;font-weight:500;white-space:nowrap}.quote-flight-airline i{width:17px;height:17px;display:inline-grid;place-items:center;border-radius:50%;background:#ff6b00}.quote-flight-airline svg{width:10px;height:10px;fill:#fff;stroke:none}.quote-flight-route{min-height:72px;padding:11px 14px;display:grid;grid-template-columns:minmax(66px,1fr) minmax(76px,1.15fr) minmax(66px,1fr);align-items:center;gap:8px;border-radius:11px;background:#f7f7f8}.quote-flight-stop{text-align:center}.quote-flight-stop strong{display:block;color:#171927;font-size:20px;line-height:1.2}.quote-flight-stop span{display:block;margin-top:4px;color:#344054;font-size:13px;line-height:1.35;word-break:keep-all}.quote-flight-route-center{min-width:0;text-align:center}.quote-flight-route-center i{position:relative;display:block;height:1px;margin:0 3px 7px;background:#c7cdd5}.quote-flight-route-center i::after{content:"";position:absolute;right:0;top:-3px;width:6px;height:6px;border-top:1px solid #c7cdd5;border-right:1px solid #c7cdd5;transform:rotate(45deg)}.quote-flight-route-center span{display:block;color:#8a94a6;font-size:14px;font-weight:500;white-space:nowrap}
    .quote-price-table{width:100%;border-collapse:separate;border-spacing:0 8px;border-top:0}
    .quote-price-table th,.quote-price-table td{height:62px;padding:0 18px;border:0;background:var(--panel);text-align:left}
    .quote-price-table th:first-child{border-radius:12px 0 0 12px}.quote-price-table td:last-child{border-radius:0 12px 12px 0}
    .quote-price-table th{width:27%;color:var(--text);font-size:16px}
    .quote-price-table td:nth-child(2){color:var(--muted);font-size:14px}
    .quote-price-table td:last-child{width:25%;color:var(--ink);font-size:17px;font-weight:700;text-align:right}
    .quote-price-table tr.total{background:transparent}
    .quote-price-table tr.total th,.quote-price-table tr.total td{background:var(--accent-soft);color:var(--accent)}
    .quote-price-table tr.total th,.quote-price-table tr.total td:last-child{color:var(--accent);font-size:20px}
    .quote-price-groups{display:grid;gap:14px}.quote-price-card{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:#fff}.quote-price-row{position:relative;padding:20px 22px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px}.quote-price-row + .quote-price-row::before{content:"";position:absolute;left:22px;right:22px;top:0;height:1px;background:#eceef2}.quote-price-row.total{background:transparent}.quote-price-row.total::before{height:2px;background:#8e95a7}.quote-price-copy strong{display:block;color:var(--ink);font-size:17px;font-weight:600;line-height:1.45}.quote-price-copy span,.quote-price-amount span{display:block;margin-top:5px;color:#667085;font-size:15px;font-weight:400;line-height:1.5}.quote-price-amount{color:var(--ink);font-size:17px;font-weight:700;text-align:right;white-space:nowrap}.quote-price-amount strong{display:block;color:inherit;font:inherit}.quote-price-row.total .quote-price-copy strong,.quote-price-row.total .quote-price-amount{color:var(--accent)}.quote-price-flight-guide{margin:0 22px 20px;padding:15px 16px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-size:16px;line-height:1.5;word-break:keep-all}.quote-price-flight-guide p{margin:0}
    .quote-detail-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;border:0}
    .quote-detail-block{padding:26px;border-radius:20px;background:var(--accent-soft)}
    .quote-detail-block + .quote-detail-block{border-left:0;background:var(--panel)}
    .quote-detail-block h4{margin:0 0 15px;color:var(--ink);font-size:16px}
    .quote-detail-block ul{margin:0;padding:0;list-style:none;display:grid;gap:0}
    .quote-detail-block li{position:relative;padding-left:18px;color:var(--text);font-size:14px;line-height:1.65}
    .quote-detail-block li::before{content:"";position:absolute;left:1px;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--blue)}
    .quote-product-details{overflow:visible;border:0;border-radius:0;background:#fff}
    .quote-flight-block{margin-top:14px;padding:26px;border:0;border-radius:20px;background:#f4f4f6}.quote-flight-block.is-structured{padding:0;background:transparent}
    .quote-flight-block h4{margin:0 0 15px;color:var(--ink);font-size:18px}.quote-schedule-heading{margin:0 0 15px;color:var(--ink);font-size:16px}
    .quote-flight-block ul,.quote-schedule-empty ul{margin:0;padding:0;list-style:none;display:grid;gap:10px}
    .quote-flight-block li,.quote-schedule-empty li{position:relative;padding-left:18px;font-size:14px;line-height:1.65}
    .quote-flight-block li::before,.quote-schedule-empty li::before{content:"";position:absolute;left:1px;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--blue)}
    .quote-schedule-wrap{margin-top:14px;padding:0;border:1px solid var(--line);border-radius:20px;background:#fff;overflow:hidden}
    .quote-schedule-title{margin:30px 0 14px;color:var(--ink);font-size:20px;font-weight:700;line-height:1.4}.quote-schedule-title + .quote-schedule-wrap{margin-top:0}
    .quote-schedule-heading{margin:0;padding:24px 26px;border-bottom:1px solid var(--line)}
    .quote-schedule-item + .quote-schedule-item{border-top:1px solid var(--line)}
    .quote-schedule-head{min-height:66px;padding:20px 26px;display:flex;align-items:center;gap:12px;background:#fff}
    .quote-schedule-head strong{color:var(--ink);font-size:18px}.quote-schedule-head span{color:var(--ink);font-size:17px;font-weight:600}
    .quote-schedule-extras{padding:18px 26px;display:grid;gap:8px;background:var(--panel)}
    .quote-schedule-extras>div{display:grid;grid-template-columns:30px minmax(0,1fr);gap:6px;align-items:start;font-size:16px;line-height:1.55}.quote-extra-label{color:var(--ink);font-size:16px;font-weight:700}.quote-schedule-extras p{margin:0;color:var(--ink);font-size:16px;line-height:1.55}
    .quote-schedule-points{padding:6px 26px 12px;display:grid;gap:0;background:#fff}.quote-schedule-point{position:relative;display:grid;grid-template-columns:12px minmax(0,1fr);gap:7px;min-height:0;padding:7px 0}
    .quote-schedule-point.has-description::before{content:"";position:absolute;left:3px;top:30px;bottom:12px;width:1px;background:#dfe3ea}
    .quote-schedule-dot{position:relative;z-index:1;width:8px;height:8px;margin:7px 0 0;border:0;border-radius:50%;background:var(--ink);top:2px}
    .quote-schedule-copy strong{display:block;color:var(--ink);font-size:17px;font-weight:600;line-height:1.45}.quote-schedule-copy p{margin:7px 0 0;padding:0;color:#717381;font-size:17px;line-height:1.4;white-space:pre-line}
    .quote-notes-panel{margin-top:14px;border:0;border-radius:20px;background:var(--panel)}
    .quote-note-group{margin-top:14px;padding:26px;border-radius:20px;background:var(--panel)}.quote-note-group + .quote-note-group{border-top:1px solid var(--line)}
    .quote-note-group h4{margin:0 0 14px;color:var(--ink);font-size:17px}.quote-note-group ul{margin:0;padding:0;list-style:none;display:grid;gap:0}.quote-note-group li{position:relative;padding-left:18px;font-size:17px;line-height:1.65}.quote-note-group li::before{content:"";position:absolute;left:1px;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--blue)}
    .quote-process{margin-top:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;background:transparent}
    .quote-step{position:relative;padding:25px 22px 25px 66px;border-radius:18px;background:var(--panel)}
    .quote-step:nth-child(2),.quote-step:nth-child(3){background:var(--panel)}
    .quote-step + .quote-step{border-left:0}
    .quote-step-number{position:absolute;left:24px;top:25px;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--blue-soft);color:var(--blue-dark);font-size:13px;font-weight:700}
    .quote-step:first-child .quote-step-number{background:var(--accent-soft);color:var(--accent)}
    .quote-step strong{display:block;margin-bottom:5px;color:var(--ink);font-size:15px}
    .quote-step span{color:var(--muted);font-size:12px}
    .quote-notice{margin-top:0;padding:22px 24px;border:0;border-radius:16px;background:var(--accent-soft);color:var(--ink);font-size:14px;line-height:1.75;white-space:pre-line}
    .quote-detail-block .quote-notice{margin-top:0;padding:0;border-left:0;background:transparent}
    .quote-policy{margin-top:14px;padding:26px;border:0;border-radius:18px;background:var(--panel)}
    .quote-policy h4,.quote-account h4{margin:0 0 14px;color:var(--ink);font-size:16px}
    .quote-policy h5{margin:18px 0 9px;color:var(--text);font-size:14px}
    .quote-policy h5:first-of-type{margin-top:0}
    .quote-policy-lead{margin:0 0 14px;color:var(--blue-dark);font-size:14px;font-weight:700;line-height:1.65;text-align:center}
    .quote-policy-subtitle{margin:0 0 12px;color:var(--text);font-size:14px;font-weight:700;line-height:1.65}
    .quote-policy-list{margin:0;padding:0;list-style:none;display:grid;gap:8px}
    .quote-policy-list li{position:relative;padding-left:18px;color:var(--text);font-size:13px;line-height:1.65}
    .quote-policy-list li::before{content:"";position:absolute;left:2px;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--blue)}
    .quote-guide-list{margin:0;padding:0;list-style:none;display:grid;gap:8px}
    .quote-guide-list li{position:relative;padding-left:18px;color:var(--text);font-size:13px;line-height:1.65}
    .quote-guide-list li::before{content:"";position:absolute;left:2px;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--blue)}
    .quote-account{margin-top:14px;padding:24px;display:grid;grid-template-columns:160px minmax(0,1fr);align-items:center;gap:26px;border:1px solid var(--line);border-radius:16px;background:#fff}
    .quote-account-brand h4{margin:0;color:var(--ink);font-size:20px;font-weight:600}
    .quote-account-details{display:grid;gap:12px}.quote-account-row{display:grid;grid-template-columns:70px minmax(0,1fr);align-items:center;gap:12px}.quote-account-row span{color:#667085;font-size:15px;font-weight:500}.quote-account-row strong{color:var(--ink);font-size:18px;line-height:1.5;text-align:left}.quote-account-bank-logo{width:84px;height:auto;display:block;object-fit:contain}
    .quote-footer{margin-top:0;padding:38px 42px;border:1px solid var(--line);border-radius:28px;background:#fff;color:var(--ink);font-size:16px;line-height:1.7}
    .quote-footer strong{display:block;margin-bottom:10px;color:var(--ink);font-size:16px}
    .quote-footer-info{display:flex;flex-wrap:wrap;gap:2px 16px}
    .quote-community-actions{margin:24px 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.quote-community-link{padding:10px;display:flex;flex-direction:column;align-items:stretch;gap:9px;border:1px solid var(--line);border-radius:16px;background:#fff;color:var(--ink);text-align:center;text-decoration:none;transition:border-color .18s ease,transform .18s ease}.quote-community-link:hover{border-color:var(--accent);transform:translateY(-1px)}.quote-community-link:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.quote-community-link img{width:100%;height:auto;aspect-ratio:16/9;display:block;border-radius:11px;background:var(--panel);object-fit:cover}.quote-community-link span{font-size:16px;font-weight:600;line-height:1.4}
    .quote-body .quote-info-item span,.quote-body .quote-product-name span,.quote-body .quote-product-basic>span{font-size:16px}
    .quote-body .quote-info-item strong,.quote-body .quote-product-basic>strong,.quote-body .quote-schedule-date strong,.quote-body .quote-step strong,.quote-body .quote-account strong,.quote-body .quote-footer strong{font-size:18px}
    .quote-body .quote-product-basic li,.quote-body .quote-detail-block li,.quote-body .quote-flight-block li,.quote-body .quote-schedule-empty li,.quote-body .quote-note-group li,.quote-body .quote-notice,.quote-body .quote-policy h5,.quote-body .quote-policy-lead,.quote-body .quote-policy-subtitle,.quote-body .quote-policy-list li,.quote-body .quote-guide-list li{font-size:16px}
    .quote-body .quote-policy h5{font-size:18px}
    .quote-body .quote-info-item{min-height:0}
    .quote-body .quote-info-item span,.quote-body .quote-info-item:nth-child(2) span,.quote-body .quote-product-name span,.quote-body .quote-product-basic>span,.quote-body .quote-detail-block h4{display:block;margin-bottom:10px;color:#9092a2;font-size:16px;font-weight:500}
    .quote-body .quote-flight-block h4{display:block;margin-bottom:15px;color:#9092a2;font-size:18px;font-weight:500}.quote-body .quote-note-group h4{font-size:17px}.quote-body .quote-note-group li{font-size:17px}
    .quote-body .quote-detail-columns .quote-detail-block:first-child h4{color:var(--accent);font-size:17px;font-weight:600}.quote-body .quote-detail-columns .quote-detail-block:last-child h4{color:#667085;font-size:17px;font-weight:600}.quote-body .quote-detail-columns .quote-detail-block:first-child li,.quote-body .quote-detail-columns .quote-detail-block:last-child li{color:var(--ink);font-size:17px}.quote-body .quote-detail-columns .quote-detail-block:first-child li::before{background:var(--accent)}.quote-body .quote-detail-columns .quote-detail-block:last-child li::before{background:#98a2b3}
    .quote-footer-copy{margin-top:12px;color:var(--ink);font-size:11px}
    @media(max-width:700px){
      body{padding-bottom:82px}
      .quote-topbar{position:fixed;top:auto;bottom:0;left:0;right:0;border-top:1px solid var(--line);border-bottom:0}
      .quote-topbar-inner{height:74px;padding:10px 16px}.quote-brand{display:none}.quote-actions{width:100%}.quote-action{min-width:0;flex:1;height:50px;padding:0 12px;font-size:13px}
      .quote-page{width:calc(100% - 24px);margin:12px auto 28px}.quote-hero{min-height:auto;padding:24px;grid-template-columns:1fr;gap:20px;border-radius:22px}.quote-hero::after{display:none}.quote-hero-content{padding:0 2px}.quote-hero-logo{display:none}.quote-hero h1{font-size:29px}.quote-hero-product{font-size:18px}.quote-hero-meta{font-size:14px}.quote-hero-document-meta{font-size:12px}.quote-hero-media{min-height:220px;order:-1}.quote-hero-media::before{content:"";width:96px;height:34px}.quote-hero-media img{width:75%;margin-left:auto;object-position:right center}
      .quote-body{padding:0}
      .quote-section{margin-top:12px;padding:30px 22px;border-radius:20px}
      .quote-total-callout{align-items:flex-start;flex-direction:column;padding:22px}.quote-total-callout strong{font-size:27px}
      .quote-info-grid{grid-template-columns:1fr}.quote-info-item{min-height:104px}.quote-info-item span{margin-bottom:14px}
      .quote-price-table{display:block;border-spacing:0}.quote-price-table tbody{display:grid;gap:8px}.quote-price-table tr{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;padding:16px;border-radius:13px;background:var(--panel)}.quote-price-table th,.quote-price-table td{width:auto!important;height:auto;padding:0;border-radius:0!important;background:transparent;text-align:left}.quote-price-table th{grid-column:1;font-size:14px}.quote-price-table td:nth-child(2){grid-column:1;margin-top:5px;font-size:12px}.quote-price-table td:last-child{grid-column:2;grid-row:1/span 2;align-self:center;margin-left:12px;font-size:14px;white-space:nowrap}.quote-price-table tr.total{background:var(--accent-soft)}.quote-price-table tr.total th,.quote-price-table tr.total td{background:transparent;color:var(--accent)}.quote-price-table tr.total th,.quote-price-table tr.total td:last-child{font-size:16px}
      .quote-price-row{padding:17px 16px;gap:12px}.quote-price-row + .quote-price-row::before{left:16px;right:16px}.quote-price-copy strong,.quote-price-amount{font-size:17px}.quote-price-copy span,.quote-price-amount span{font-size:15px}.quote-price-flight-guide{margin:0 16px 16px;padding:14px}
      .quote-product-basics,.quote-detail-columns,.quote-process{grid-template-columns:1fr}.quote-product-basic + .quote-product-basic,.quote-detail-block + .quote-detail-block,.quote-step + .quote-step{border-left:0;border-top:0}
      .quote-schedule-wrap{padding:0}.quote-flight-block{padding-left:18px;padding-right:18px}.quote-flight-block.is-structured{min-width:0;padding-left:0;padding-right:0}.quote-flight-schedule-details{width:100%;max-width:100%;min-width:0;grid-template-columns:minmax(0,1fr);padding:16px}.quote-flight-journey{min-width:0;overflow:hidden}.quote-flight-journey+ .quote-flight-journey{margin:22px 0 0;padding:22px 0 0;border-left:0;border-top:1px solid #e4e7ec}.quote-flight-journey-head{min-width:0;font-size:13px}.quote-flight-airline{font-size:12px}.quote-flight-route{min-width:0;padding:10px 6px;grid-template-columns:minmax(54px,1fr) minmax(56px,.9fr) minmax(54px,1fr);gap:3px}.quote-flight-stop strong{font-size:18px}.quote-flight-stop span{font-size:12px}.quote-flight-route-center span{font-size:13px}.quote-schedule-heading,.quote-schedule-head,.quote-schedule-extras{padding-left:18px;padding-right:18px}.quote-schedule-points{padding-left:18px;padding-right:18px}.quote-schedule-head{gap:9px}.quote-schedule-head strong{font-size:18px}.quote-schedule-head span{font-size:17px}.quote-extra-label,.quote-schedule-extras p{font-size:16px}.quote-schedule-copy strong{font-size:16px;font-weight:600}
      .quote-account{display:grid;grid-template-columns:1fr;gap:18px}.quote-account strong{display:block;margin-top:0;text-align:left}.quote-account-row{grid-template-columns:64px minmax(0,1fr)}
      .quote-footer{margin-top:0;padding:30px 24px;border-radius:20px}.quote-footer-info{display:block}.quote-footer-info span{display:block}
    }
    @media print{html,body{background:#fff}.quote-topbar{display:none}.quote-page{width:100%;margin:0}.quote-hero{min-height:270px}.quote-hero,.quote-section{box-shadow:none}.quote-body{padding-top:0}}
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
    <section class="quote-hero">
      <div class="quote-hero-content">
        <img class="quote-hero-logo" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/logo2.png" alt="SECRET TOUR">
        <h1><span>${escapeHtml(quote.applicantName)}님,</span>견적서가 도착했어요.</h1>
        <p class="quote-hero-product">${escapeHtml(quote.productName)}</p>
        <div class="quote-hero-meta"><span>${escapeHtml(regionText)}</span><span>${escapeHtml(dateText)}</span><p class="quote-hero-document-meta">${quoteNo ? `<span class="quote-number-line">견적번호 ${escapeHtml(quoteNo)}<button class="quote-number-copy" type="button" data-copy-quote-number="${escapeHtml(quoteNo)}" aria-label="견적번호 복사" title="견적번호 복사"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button><span class="quote-copy-status" aria-live="polite"></span></span>` : ""}<span class="quote-generated-line">생성일 ${escapeHtml(formatGeneratedAt(quote.generatedAt))}</span></p></div>
      </div>
      <div class="quote-hero-media">${quoteHeroImageUrl
        ? `<img src="${escapeHtml(quoteHeroImageUrl)}" alt="골프조인 견적서 안내 이미지">`
        : `<div class="quote-hero-placeholder">SECRET TOUR GOLF JOIN</div>`}</div>
    </section>
    <div class="quote-body">
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">01</span>고객정보</h3>
        <div class="quote-info-grid">
          <div class="quote-info-item"><span>고객명</span><strong>${escapeHtml(quote.applicantName)}</strong></div>
          <div class="quote-info-item"><span>연락처</span><strong>${escapeHtml(formatPhone(quote.applicantPhone))}</strong></div>
          <div class="quote-info-item"><span>인원</span><strong>${escapeHtml(quote.people)}명</strong></div>
        </div>
      </section>
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">02</span>상품정보</h3>
        <div class="quote-product-details">
          <div class="quote-product-name"><span>상품명</span><strong>${escapeHtml(quote.productName)}</strong></div>
          <div class="quote-product-basics">
            <div class="quote-product-basic"><span>방문지역</span><strong>${escapeHtml(regionText)}</strong></div>
            <div class="quote-product-basic"><span>여행기간</span><strong>${escapeHtml(formatTripPeriod(quote.tripDuration, quote.departureDate, quote.returnDate))}</strong></div>
          </div>
          <div class="quote-flight-block${hasStructuredFlight ? " is-structured" : ""}"><h4>항공</h4>${renderQuoteFlightInfo(quote)}</div>
          <div class="quote-detail-columns">
            <div class="quote-detail-block"><h4>포함사항</h4><ul>${renderList(quote.includedItems)}</ul></div>
            <div class="quote-detail-block"><h4>불포함사항</h4><ul>${renderList(quote.excludedItems)}</ul></div>
          </div>
          <div class="quote-note-group"><h4>참고사항</h4><ul>${renderList(quote.productNotes, "등록된 상품 참고사항 없음")}</ul></div>
          <h3 class="quote-schedule-title">일정표</h3><div class="quote-schedule-wrap">${renderScheduleTimeline(quote.itinerarySchedule, quote.itineraryItems)}</div>
        </div>
      </section>
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">03</span>요금안내</h3>
        <div class="quote-price-groups">
          <div class="quote-price-card">
            <div class="quote-price-row"><div class="quote-price-copy"><strong>기본가</strong><span>1인 기준 × ${escapeHtml(quote.people)}명</span></div><div class="quote-price-amount">${escapeHtml(quote.formattedProductSubtotal)}</div></div>
            ${additionalPriceRows}
            <div class="quote-price-row"><div class="quote-price-copy"><strong>객실 1인1실 사용요금</strong><span>${quote.singleRoomSurcharge ? `1인 1실 · 1박 ${escapeHtml(quote.formattedSingleRoomSurchargePerNight)} × ${escapeHtml(quote.nightCount)}박` : "해당 없음"}</span></div><div class="quote-price-amount">${escapeHtml(quote.formattedSingleRoomSurcharge)}</div></div>
            <div class="quote-price-row total"><div class="quote-price-copy"><strong>예상 총액</strong><span>${airfareStatusText}</span></div><div class="quote-price-amount"><strong>${escapeHtml(quote.formattedEstimatedTotal)}</strong>${airfarePending ? "<span>+ 항공료</span>" : ""}</div></div>
          </div>
          <div class="quote-price-card">
            <div class="quote-price-row"><div class="quote-price-copy"><strong>예약금</strong><span>1인 ${escapeHtml(quote.formattedDepositPerPerson)}</span></div><div class="quote-price-amount">${escapeHtml(quote.formattedDeposit)}</div></div>
            <div class="quote-price-row"><div class="quote-price-copy"><strong>잔금</strong><span>예약금 제외 · ${airfareStatusText}</span></div><div class="quote-price-amount"><strong>${escapeHtml(quote.formattedBalance)}</strong>${isFlightAgencyRequest && airfarePending ? "<span>+ 항공료</span>" : ""}</div></div>
            ${balanceFlightGuide}
          </div>
        </div>
        <div class="quote-account"><div class="quote-account-brand"><h4>입금계좌</h4></div><div class="quote-account-details"><div class="quote-account-row"><span>은행</span><img class="quote-account-bank-logo" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/logo_shinhanbank.jpg" alt="신한은행"></div><div class="quote-account-row"><span>계좌번호</span><strong>140-013-991111</strong></div><div class="quote-account-row"><span>예금주</span><strong>(주)시크릿투어</strong></div></div></div>
      </section>
      <section class="quote-section">
        <h3 class="quote-section-title"><span class="quote-section-number">04</span>유의사항</h3>
        <div class="quote-notice">${escapeHtml(quote.specialNotes)}</div>
        <div class="quote-policy">
          <h4>유의사항</h4>
          <h5>예약 전 꼭 확인해주세요</h5>
          <ul class="quote-guide-list">
            <li>본 상품은 4인 1팀으로 운영되는 골프조인 상품입니다.</li>
            <li>예약 신청 후 참가 인원, 항공 좌석, 숙소 및 골프장 예약이 모두 확정되면 최종 출발이 확정됩니다.</li>
            <li>조인 인원이 충족되지 않아 출발이 취소되는 경우 예약금은 전액 환불됩니다.</li>
          </ul>
          <h5>이용 안내</h5>
          <ul class="quote-guide-list">
            <li>1인 예약 시 룸조인 또는 싱글룸 추가요금이 발생할 수 있습니다.</li>
            <li>참가자 취소로 조인 인원 변동이 발생할 경우 여행사는 대체 참가자 모집을 위해 최선을 다합니다.</li>
            <li>영문명, 여권정보, 생년월일 등 예약정보 오류로 발생하는 비용은 고객 부담입니다.</li>
            <li>천재지변, 항공기 결항 등 불가항력적 상황은 항공사 및 현지 업체 규정에 따라 처리됩니다.</li>
            <li>취소 및 변경 접수는 평일 영업시간(09:00~18:00) 기준으로 적용됩니다.</li>
          </ul>
        </div>
        <div class="quote-policy">
          <h4>취소 수수료 관련 규정</h4>
          <p class="quote-policy-subtitle">제5조(여행출발 전 계약해제) 이 상품은 특별약관을 기준으로 진행됩니다.</p>
          <ul class="quote-policy-list">
            <li>여행확정일~여행출발일 20일 전 취소 요청 시 - 항공위약금 + 여행요금의 20% 배상</li>
            <li>여행출발일 19~10일 전까지 취소 요청 시 - 항공위약금 + 여행요금의 30% 배상</li>
            <li>여행출발일 9~8일 전까지 취소 요청 시 - 항공위약금 + 여행요금의 50% 배상</li>
            <li>여행출발일 7~4일 전까지 취소 요청 시 - 항공위약금 + 여행요금의 70% 배상</li>
            <li>여행출발일 3일 전~출발 당일까지 취소 요청 시 - 여행요금의 100% 배상</li>
          </ul>
        </div>
        <div class="quote-process">
          <div class="quote-step"><span class="quote-step-number">1</span><strong>견적 확인</strong><span>상품·일정·금액 확인</span></div>
          <div class="quote-step"><span class="quote-step-number">2</span><strong>예약금 입금</strong><span>요금안내의 입금계좌 확인</span></div>
          <div class="quote-step"><span class="quote-step-number">3</span><strong>예약 진행</strong><span>담당자 확인 후 확정 안내</span></div>
        </div>
      </section>
    </div>
    <div class="quote-community-actions" aria-label="추가 상담 채널"><a class="quote-community-link" href="https://pf.kakao.com/_lRbYxj/chat" target="_blank" rel="noopener noreferrer"><img src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/banner_kakao.webp" alt=""><span>채팅으로 문의</span></a><a class="quote-community-link" href="https://band.us/@secrettour" target="_blank" rel="noopener noreferrer"><img src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/banner_band.webp" alt=""><span>밴드 가입하기</span></a></div>
    <footer class="quote-footer">
      <strong>(주)시크릿투어</strong>
      <div class="quote-footer-info">
        <span>대표이사 권태호</span>
        <span>서울시 마포구 동교로 255-1 501호</span>
        <span>사업자등록번호 105-88-00661</span>
        <span>관광사업등록 제2022-000036호</span>
        <span>통신판매업 제2022-서울마포-2119호</span>
        <span>대표전화 02-3446-1119</span>
        <span>팩스 02-555-1319</span>
      </div>
    </footer>
  </main>
  <script>
    (() => {
      const button = document.querySelector("[data-copy-quote-number]");
      if (!button) return;
      const status = button.parentElement?.querySelector(".quote-copy-status");
      const fallbackCopy = (text) => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("copy failed");
      };
      button.addEventListener("click", async () => {
        const quoteNumber = button.dataset.copyQuoteNumber || "";
        if (!quoteNumber) return;
        try {
          if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(quoteNumber);
          else fallbackCopy(quoteNumber);
          button.classList.add("is-copied");
          button.setAttribute("aria-label", "견적번호 복사 완료");
          button.title = "복사됨";
          if (status) status.textContent = "복사됨";
          window.setTimeout(() => {
            button.classList.remove("is-copied");
            button.setAttribute("aria-label", "견적번호 복사");
            button.title = "견적번호 복사";
            if (status) status.textContent = "";
          }, 1600);
        } catch (error) {
          if (status) status.textContent = "복사 실패";
        }
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = {
  createGolfjoinQuoteHtml,
  QUOTE_HERO_IMAGE_URL
};
