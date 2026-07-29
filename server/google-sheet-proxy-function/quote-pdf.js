"use strict";

const path = require("path");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const MARGIN = 60;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const CONTENT_BOTTOM = 796;
const PRODUCT_CARD_GAP = 10;
const COMPANY_LINE_HEIGHT = 16;
const COMPANY_HEIGHT = COMPANY_LINE_HEIGHT * 5;
const COMPANY_BOTTOM = 760;
const COMPANY_TOP = COMPANY_BOTTOM - COMPANY_HEIGHT;

const COLORS = {
  ink: "#171927",
  muted: "#717381",
  label: "#9092A2",
  line: "#E6E7EE",
  lineStrong: "#B8BEC9",
  border: "#D7DBE3",
  panel: "#F4F4F6",
  accent: "#5B55C6",
  accentSoft: "#EEECFF",
  white: "#FFFFFF",
  page: "#F3F4F8"
};

const FONT_PATHS = {
  regular: path.join(__dirname, "assets", "fonts", "Pretendard-Regular.otf"),
  semibold: path.join(__dirname, "assets", "fonts", "Pretendard-SemiBold.otf"),
  bold: path.join(__dirname, "assets", "fonts", "Pretendard-Bold.otf")
};

const IMAGE_URLS = {
  logo: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/logo2.png",
  bank: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/logo_shinhanbank.jpg",
  hero: "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/bg_invoice.webp"
};

let pdfImageAssetsPromise = null;

async function downloadPdfImageAsset(name) {
  const response = await fetch(IMAGE_URLS[name], { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${name} image download failed: HTTP ${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  return name === "hero" ? sharp(source).png().toBuffer() : source;
}

async function loadPdfImageAssets() {
  if (pdfImageAssetsPromise) return pdfImageAssetsPromise;
  pdfImageAssetsPromise = (async () => {
    const failures = [];
    const entries = await Promise.all(Object.keys(IMAGE_URLS).map(async (name) => {
      try {
        return [name, await downloadPdfImageAsset(name)];
      } catch (error) {
        failures.push(`${name}: ${error.message || error}`);
        return [name, null];
      }
    }));
    if (failures.length) {
      throw new Error(`PDF images could not be loaded from the bucket.\n${failures.join("\n")}`);
    }
    return Object.fromEntries(entries);
  })().catch((error) => {
    pdfImageAssetsPromise = null;
    throw error;
  });
  return pdfImageAssetsPromise;
}

function asText(value, fallback = "-") {
  const text = String(value == null ? "" : value).trim();
  return text || fallback;
}

function formatGeneratedDate(value) {
  const text = asText(value, "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2})?:?(\d{2})?/);
  if (!match) return text || "-";
  const time = match[4] && match[5] ? ` ${match[4]}:${match[5]}` : "";
  return `${match[1]}.${match[2]}.${match[3]}${time}`;
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return asText(value);
}

function formatTripDate(value = "") {
  const text = asText(value, "");
  const match = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return text || "-";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return text;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getUTCDay()];
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}(${weekday})`;
}

function formatTripPeriod(quote = {}) {
  const departure = formatTripDate(quote.departureDate);
  const arrival = formatTripDate(quote.returnDate);
  return `${departure} ~ ${arrival}`;
}

function formatScheduleDateText(value = "") {
  const text = asText(value, "");
  const fullDate = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(\s*\([^)]+\))?/);
  if (!fullDate) return text;
  return `${fullDate[1].slice(-2)}.${String(Number(fullDate[2])).padStart(2, "0")}.${String(Number(fullDate[3])).padStart(2, "0")}${fullDate[4] || ""}`;
}

function normalizeScheduleItems(schedule = []) {
  if (!Array.isArray(schedule)) return [];
  return schedule.slice(0, 15).map((item, index) => {
    if (!item || typeof item !== "object") return null;
    const points = Array.isArray(item.points) ? item.points.map((point) => {
      if (point && typeof point === "object") {
        return {
          title: asText(point.title || point.main || point.name || point.text || point.content, ""),
          description: asText(point.description || point.subText || point.subtitle || point.detail, "")
        };
      }
      return { title: asText(point, ""), description: "" };
    }).filter((point) => point.title) : [];
    const content = asText(item.content || item.rawText, "");
    return {
      day: asText(item.day, `${index + 1}일차`),
      dateText: asText(item.dateText, ""),
      points: points.length ? points : (content ? [{ title: content, description: "" }] : []),
      hotel: asText(item.hotel, ""),
      meals: Array.isArray(item.meals)
        ? item.meals.map((meal) => [meal?.label, meal?.menu].map((value) => asText(value, "")).filter(Boolean).join(" ")).filter(Boolean)
        : []
    };
  }).filter(Boolean);
}

function registerFonts(doc) {
  doc.registerFont("Pretendard", FONT_PATHS.regular);
  doc.registerFont("Pretendard-SemiBold", FONT_PATHS.semibold);
  doc.registerFont("Pretendard-Bold", FONT_PATHS.bold);
}

function roundedPanel(doc, x, y, width, height, options = {}) {
  doc.save();
  doc.roundedRect(x, y, width, height, options.radius == null ? 12 : options.radius);
  if (options.fill) doc.fill(options.fill);
  if (options.stroke) doc.lineWidth(options.lineWidth || 0.8).strokeColor(options.stroke).stroke();
  doc.restore();
}

function textHeight(doc, text, width, font = "Pretendard", size = 11.5, lineGap = 3) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(asText(text), { width, lineGap });
}

function startPage(doc, state, title, assets, first = false) {
  if (!first) doc.addPage({ size: "A4", margin: 0 });
  state.page += 1;
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.page);
  roundedPanel(doc, 24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48, { fill: COLORS.white, radius: 20 });
  if (assets.logo) {
    try {
      doc.image(assets.logo, MARGIN, 43, { width: 76 });
    } catch (error) {
      doc.font("Pretendard-Bold").fontSize(9).fillColor(COLORS.accent).text("SECRET TOUR", MARGIN, 46);
    }
  } else {
    doc.font("Pretendard-Bold").fontSize(9).fillColor(COLORS.accent).text("SECRET TOUR", MARGIN, 46);
  }
  doc.font("Pretendard-SemiBold").fontSize(10).fillColor(COLORS.muted)
    .text(title, MARGIN + 210, 47, { width: CONTENT_WIDTH - 210, align: "right", lineBreak: false });
  doc.moveTo(MARGIN, 75).lineTo(MARGIN + CONTENT_WIDTH, 75).lineWidth(0.6).strokeColor(COLORS.line).stroke();
  state.y = 92;
  state.pageTitle = title;
}

function ensureSpace(doc, state, height, assets, title = state.pageTitle) {
  if (state.y + height <= CONTENT_BOTTOM) return;
  startPage(doc, state, title, assets);
}

function drawSectionHeading(doc, state, number, title, assets) {
  ensureSpace(doc, state, 38, assets, title);
  roundedPanel(doc, MARGIN, state.y, 34, 25, { fill: COLORS.accentSoft, radius: 7 });
  doc.font("Pretendard-Bold").fontSize(12).fillColor(COLORS.accent)
    .text(String(number).padStart(2, "0"), MARGIN, state.y + 5, { width: 34, align: "center", lineBreak: false });
  doc.font("Pretendard-Bold").fontSize(18).fillColor(COLORS.ink)
    .text(title, MARGIN + 45, state.y + 1, { width: 300, lineBreak: false });
  state.y += 35;
  state.pageTitle = `${String(number).padStart(2, "0")} ${title}`;
}

function beginMajorSection(doc, state, number, title, assets, minimumContentHeight = 0, gapBefore = 24) {
  const requiredHeight = 35 + minimumContentHeight;
  if (gapBefore > 0 && state.y + gapBefore + requiredHeight <= CONTENT_BOTTOM) {
    state.y += gapBefore;
  } else if (state.y + requiredHeight > CONTENT_BOTTOM || (gapBefore > 0 && state.y + gapBefore + requiredHeight > CONTENT_BOTTOM)) {
    startPage(doc, state, `${String(number).padStart(2, "0")} ${title}`, assets);
  }
  drawSectionHeading(doc, state, number, title, assets);
}

function drawInfoCards(doc, state, items, assets) {
  const width = CONTENT_WIDTH / items.length;
  const height = 70;
  ensureSpace(doc, state, height + 8, assets);
  roundedPanel(doc, MARGIN, state.y, CONTENT_WIDTH, height, { fill: COLORS.panel, radius: 12 });
  items.forEach((item, index) => {
    const x = MARGIN + (width * index);
    if (index > 0) {
      doc.moveTo(x, state.y + 14).lineTo(x, state.y + height - 14)
        .lineWidth(0.7).strokeColor(COLORS.line).stroke();
    }
    doc.font("Pretendard").fontSize(11).fillColor(COLORS.label)
      .text(item.label, x + 16, state.y + 14, { width: width - 32, lineBreak: false });
    doc.font("Pretendard-SemiBold").fontSize(14).fillColor(COLORS.ink)
      .text(asText(item.value), x + 16, state.y + 35, { width: width - 32, height: 22, ellipsis: true });
  });
  state.y += height + 6;
}

function drawLabeledCard(doc, state, label, value, assets, options = {}) {
  const width = options.width || CONTENT_WIDTH;
  const valueWidth = width - 36;
  const valueHeight = textHeight(doc, value, valueWidth, "Pretendard-SemiBold", options.valueSize || 14, 3);
  const height = Math.max(62, valueHeight + 41);
  ensureSpace(doc, state, height + 8, assets);
  roundedPanel(doc, options.x || MARGIN, state.y, width, height, { fill: options.fill || COLORS.panel, radius: 12, stroke: options.stroke });
  const x = options.x || MARGIN;
  doc.font("Pretendard").fontSize(11).fillColor(COLORS.label)
    .text(label, x + 16, state.y + 12, { width: valueWidth, lineBreak: false });
  doc.font("Pretendard-SemiBold").fontSize(options.valueSize || 14).fillColor(COLORS.ink)
    .text(asText(value), x + 16, state.y + 32, { width: valueWidth, lineGap: 3 });
  state.y += height + 6;
}

function measureBulletItems(doc, items, width, size = 12) {
  const list = Array.isArray(items) && items.length ? items : ["담당자 확인 후 안내"];
  return list.reduce((height, item) => height + Math.max(17, textHeight(doc, item, width - 25, "Pretendard", size, 2)) + 5, 0);
}

function measurePolicyItems(doc, items, width) {
  return (Array.isArray(items) ? items : []).reduce(
    (height, item) => height + Math.max(15, textHeight(doc, item, width, "Pretendard", 11.25, 1)) + 4,
    0
  );
}

function drawBulletCardAt(doc, title, items, x, y, width, options = {}) {
  const size = options.size || 12;
  const list = Array.isArray(items) && items.length ? items : [options.fallback || "담당자 확인 후 안내"];
  const listHeight = measureBulletItems(doc, list, width - 32, size);
  const height = 48 + listHeight;
  roundedPanel(doc, x, y, width, height, { fill: options.fill || COLORS.panel, radius: 12, stroke: options.stroke });
  doc.font("Pretendard-SemiBold").fontSize(13).fillColor(options.titleColor || COLORS.ink)
    .text(title, x + 16, y + 14, { width: width - 32, lineBreak: false });
  let cursorY = y + 40;
  list.forEach((item) => {
    const itemHeight = Math.max(17, textHeight(doc, item, width - 57, "Pretendard", size, 2));
    doc.circle(x + 21, cursorY + 7, 2.4).fill(options.bulletColor || COLORS.accent);
    doc.font("Pretendard").fontSize(size).fillColor(options.textColor || COLORS.ink)
      .text(asText(item), x + 32, cursorY, { width: width - 49, lineGap: 2 });
    cursorY += itemHeight + 5;
  });
  return height;
}

function drawBulletPair(doc, state, left, right, assets) {
  const gap = 8;
  const width = (CONTENT_WIDTH - gap) / 2;
  const leftHeight = 48 + measureBulletItems(doc, left.items, width - 32, left.size || 12);
  const rightHeight = 48 + measureBulletItems(doc, right.items, width - 32, right.size || 12);
  const height = Math.max(leftHeight, rightHeight);
  if (height > 470) {
    ensureSpace(doc, state, Math.min(leftHeight, 650) + 8, assets);
    state.y += drawBulletCardAt(doc, left.title, left.items, MARGIN, state.y, CONTENT_WIDTH, left) + PRODUCT_CARD_GAP;
    ensureSpace(doc, state, Math.min(rightHeight, 650) + 8, assets);
    state.y += drawBulletCardAt(doc, right.title, right.items, MARGIN, state.y, CONTENT_WIDTH, right) + PRODUCT_CARD_GAP;
    return;
  }
  ensureSpace(doc, state, height + 8, assets);
  drawBulletCardAt(doc, left.title, left.items, MARGIN, state.y, width, left);
  drawBulletCardAt(doc, right.title, right.items, MARGIN + width + gap, state.y, width, right);
  state.y += height + PRODUCT_CARD_GAP;
}

function drawProductSummary(doc, state, quote, assets) {
  const padding = 16;
  const productWidth = CONTENT_WIDTH - (padding * 2);
  const productNameHeight = Math.max(20, textHeight(doc, quote.productName, productWidth, "Pretendard-SemiBold", 14, 2));
  const productNameOffset = 35;
  const dividerOffset = productNameOffset + productNameHeight + 13;
  const metaLabelOffset = dividerOffset + 11;
  const metaValueOffset = metaLabelOffset + 20;
  const metaValues = [
    [quote.country, quote.region].filter(Boolean).join(" · ") || "-",
    formatTripPeriod(quote)
  ];
  const columnWidth = CONTENT_WIDTH / 2;
  const columnContentWidth = columnWidth - (padding * 2);
  const metaValueHeight = Math.max(...metaValues.map((value) => textHeight(doc, value, columnContentWidth, "Pretendard-SemiBold", 13.5, 2)));
  const height = metaValueOffset + metaValueHeight + padding;
  ensureSpace(doc, state, height + 8, assets);
  const productNameY = state.y + productNameOffset;
  const dividerY = state.y + dividerOffset;
  const metaLabelY = state.y + metaLabelOffset;
  const metaValueY = state.y + metaValueOffset;
  roundedPanel(doc, MARGIN, state.y, CONTENT_WIDTH, height, { fill: COLORS.panel, radius: 12 });
  doc.font("Pretendard").fontSize(11).fillColor(COLORS.label)
    .text("상품명", MARGIN + padding, state.y + 14, { width: productWidth, lineBreak: false });
  doc.font("Pretendard-SemiBold").fontSize(14).fillColor(COLORS.ink)
    .text(asText(quote.productName), MARGIN + padding, productNameY, { width: productWidth, lineGap: 2 });
  doc.moveTo(MARGIN + padding, dividerY).lineTo(MARGIN + CONTENT_WIDTH - padding, dividerY)
    .lineWidth(0.7).strokeColor(COLORS.line).stroke();
  [
    { label: "방문지역", value: metaValues[0] },
    { label: "여행기간", value: metaValues[1] }
  ].forEach((item, index) => {
    const x = MARGIN + (columnWidth * index);
    if (index > 0) {
      doc.moveTo(x, metaLabelY).lineTo(x, state.y + height - padding)
        .lineWidth(0.7).strokeColor(COLORS.line).stroke();
    }
    doc.font("Pretendard").fontSize(11).fillColor(COLORS.label)
      .text(item.label, x + padding, metaLabelY, { width: columnContentWidth, lineBreak: false });
    doc.font("Pretendard-SemiBold").fontSize(13.5).fillColor(COLORS.ink)
      .text(item.value, x + padding, metaValueY, { width: columnContentWidth, lineGap: 2 });
  });
  state.y += height + PRODUCT_CARD_GAP;
}

function getFlightLines(quote = {}) {
  const structuredLines = getStructuredFlightLines(quote);
  if (structuredLines.length) {
    return {
      title: asText(quote.airline) || "항공",
      lines: structuredLines
    };
  }
  if (!quote.flightExcluded) {
    return {
      title: asText(quote.airline),
      lines: Array.isArray(quote.flightScheduleItems) && quote.flightScheduleItems.length ? quote.flightScheduleItems : ["상품 상세 확인 필요"]
    };
  }
  const requestType = asText(quote.flightRequestType, "") === "직접예약" ? "직접예약" : "대행요청";
  return {
    title: requestType,
    lines: requestType === "직접예약"
      ? ["모임 인원 모집이 완료되면 알림톡이 발송됩니다. 담당자가 항공 예약 관련하여 별도 안내드립니다. 내용 확인 후 항공 예약을 진행해주세요."]
      : ["모임 인원모집 완료 후 항공 예약이 진행되며, 담당자가 항공 예약 관련하여 별도 안내드립니다."]
  };
}

function formatFlightCardDate(value = "") {
  const match = asText(value, "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return asText(value, "날짜 확인 필요");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getUTCDay()];
  return `${Number(match[2])}월 ${Number(match[3])}일(${weekday})`;
}

function getStructuredFlightRows(quote = {}) {
  const normalizedAirline = asText(quote.airline).replace(/\s+/g, "");
  const hasActualAirline = Boolean(normalizedAirline) && ![
    "-", "담당자확인", "개별항공", "항공불포함", "불포함", "대행요청", "직접예약"
  ].includes(normalizedAirline);
  if (!hasActualAirline || (quote.flightExcluded && asText(quote.flightRequestType) !== "대행요청")) return [];
  const details = quote.flightDetails && typeof quote.flightDetails === "object" ? quote.flightDetails : quote;
  return [
    {
      label: "가는편",
      dateText: formatFlightCardDate(quote.departureDate),
      airline: asText(quote.airline, ""),
      flightName: asText(details.outboundFlightName, ""),
      departureTime: asText(details.outboundDepartureTime, ""),
      arrivalTime: asText(details.outboundArrivalTime, ""),
      origin: asText(quote.departureAirport, "출발공항"),
      destination: asText(quote.arrivalAirport, "도착공항")
    },
    {
      label: "오는편",
      dateText: formatFlightCardDate(quote.returnDate),
      airline: asText(quote.airline, ""),
      flightName: asText(details.inboundFlightName, ""),
      departureTime: asText(details.inboundDepartureTime, ""),
      arrivalTime: asText(details.inboundArrivalTime, ""),
      origin: asText(quote.arrivalAirport, "출발공항"),
      destination: asText(quote.departureAirport, "도착공항")
    }
  ].filter((row) => row.flightName || row.departureTime || row.arrivalTime);
}

function getStructuredFlightLines(quote = {}) {
  return getStructuredFlightRows(quote).map((row) => {
    const times = [
      row.departureTime ? `출발 ${row.departureTime}` : "",
      row.arrivalTime ? `도착 ${row.arrivalTime}` : ""
    ].filter(Boolean).join(" · ");
    return [row.label, row.flightName, times].filter(Boolean).join("   ");
  });
}

function drawPdfAirlineMark(doc, x, y) {
  doc.save().circle(x, y, 5).fill("#FF6B00").restore();
  doc.save().lineWidth(0.8).strokeColor(COLORS.white)
    .moveTo(x - 3, y).lineTo(x + 3, y)
    .moveTo(x - 1.5, y - 1.6).lineTo(x - 3, y)
    .moveTo(x - 1.5, y + 1.6).lineTo(x - 3, y)
    .stroke().restore();
}

function drawStructuredFlightCard(doc, state, quote, rows, assets) {
  const height = 144;
  ensureSpace(doc, state, height + 8, assets);
  const x = MARGIN;
  const y = state.y;
  roundedPanel(doc, x, y, CONTENT_WIDTH, height, { fill: COLORS.white, radius: 12 });
  roundedPanel(doc, x, y, CONTENT_WIDTH, height, { stroke: COLORS.line, lineWidth: 0.8, radius: 12 });
  doc.font("Pretendard").fontSize(11).fillColor(COLORS.label).text("항공", x + 16, y + 14);
  const contentX = x + 16;
  const contentY = y + 42;
  const gap = 18;
  const columnWidth = (CONTENT_WIDTH - 32 - gap) / 2;
  rows.slice(0, 2).forEach((row, index) => {
    const columnX = contentX + index * (columnWidth + gap);
    if (index > 0) {
      doc.save().lineWidth(0.7).strokeColor(COLORS.line)
        .moveTo(columnX - gap / 2, contentY).lineTo(columnX - gap / 2, y + height - 14).stroke().restore();
    }
    doc.font("Pretendard").fontSize(9.5).fillColor(COLORS.muted).text(row.label, columnX, contentY, { continued: true });
    doc.font("Pretendard-SemiBold").fillColor(COLORS.ink).text(` ${row.dateText}`);
    const airlineWidth = doc.font("Pretendard").fontSize(9.2).widthOfString(row.airline);
    const airlineX = columnX + columnWidth - airlineWidth;
    drawPdfAirlineMark(doc, airlineX - 8, contentY + 5);
    doc.fillColor("#475467").text(row.airline, airlineX, contentY, { width: airlineWidth, align: "right" });

    const routeY = contentY + 19;
    const routeHeight = 65;
    roundedPanel(doc, columnX, routeY, columnWidth, routeHeight, { fill: "#F7F7F8", radius: 9 });
    const stopWidth = 62;
    const leftX = columnX + 8;
    const rightX = columnX + columnWidth - stopWidth - 8;
    doc.font("Pretendard-SemiBold").fontSize(12.5).fillColor(COLORS.ink)
      .text(row.departureTime || "-", leftX, routeY + 14, { width: stopWidth, align: "center" })
      .text(row.arrivalTime || "-", rightX, routeY + 14, { width: stopWidth, align: "center" });
    doc.font("Pretendard").fontSize(8.5).fillColor("#344054")
      .text(row.origin, leftX, routeY + 34, { width: stopWidth, align: "center" })
      .text(row.destination, rightX, routeY + 34, { width: stopWidth, align: "center" });
    const lineStart = leftX + stopWidth + 5;
    const lineEnd = rightX - 5;
    const lineY = routeY + 27;
    doc.save().lineWidth(0.8).strokeColor("#C7CDD5")
      .moveTo(lineStart, lineY).lineTo(lineEnd, lineY)
      .moveTo(lineEnd - 4, lineY - 3).lineTo(lineEnd, lineY).lineTo(lineEnd - 4, lineY + 3)
      .stroke().restore();
    doc.font("Pretendard").fontSize(8.8).fillColor("#8A94A6")
      .text(row.flightName || "-", lineStart, routeY + 35, { width: Math.max(20, lineEnd - lineStart), align: "center" });
  });
  state.y += height + PRODUCT_CARD_GAP;
}

function drawFlightCard(doc, state, quote, assets) {
  const structuredRows = getStructuredFlightRows(quote);
  if (structuredRows.length) {
    drawStructuredFlightCard(doc, state, quote, structuredRows, assets);
    return;
  }
  const flight = getFlightLines(quote);
  const guideWidth = CONTENT_WIDTH - 32;
  const guideLines = flight.lines.map((line) => ({
    text: asText(line),
    height: Math.max(17, textHeight(doc, line, guideWidth - 28, "Pretendard", 12, 2))
  }));
  const guideHeight = 24 + guideLines.reduce((total, line, index) => total + line.height + (index < guideLines.length - 1 ? 6 : 0), 0);
  const height = 62 + guideHeight + 14;
  ensureSpace(doc, state, height + 8, assets);
  roundedPanel(doc, MARGIN, state.y, CONTENT_WIDTH, height, { fill: COLORS.panel, radius: 12 });
  doc.font("Pretendard").fontSize(11).fillColor(COLORS.label).text("항공", MARGIN + 16, state.y + 14);
  doc.font("Pretendard-SemiBold").fontSize(14).fillColor(COLORS.ink).text(flight.title, MARGIN + 16, state.y + 36);
  const guideX = MARGIN + 16;
  const guideY = state.y + 62;
  roundedPanel(doc, guideX, guideY, guideWidth, guideHeight, { fill: COLORS.white, radius: 10 });
  roundedPanel(doc, guideX, guideY, guideWidth, guideHeight, { stroke: COLORS.line, lineWidth: 0.8, radius: 10 });
  let cursorY = guideY + 12;
  guideLines.forEach((line, index) => {
    doc.font("Pretendard").fontSize(12).fillColor(COLORS.ink)
      .text(line.text, guideX + 14, cursorY, { width: guideWidth - 28, lineGap: 2 });
    cursorY += line.height + (index < guideLines.length - 1 ? 6 : 0);
  });
  state.y += height + PRODUCT_CARD_GAP;
}

function getScheduleLayoutMetrics(doc, item) {
  const detailOffset = 116;
  const detailWidth = CONTENT_WIDTH - detailOffset;
  const points = item.points.length ? item.points : [{ title: "상품 상세 확인 필요", description: "" }];
  const pointMetrics = points.map((point) => {
    const titleHeight = Math.max(18, textHeight(doc, point.title, detailWidth, "Pretendard-SemiBold", 12.75, 2));
    const descriptionHeight = point.description
      ? textHeight(doc, point.description, detailWidth, "Pretendard", 12.5, 2)
      : 0;
    return { point, titleHeight, descriptionHeight };
  });
  const pointsHeight = pointMetrics.reduce((total, metric, index) => (
    total + metric.titleHeight + (metric.descriptionHeight ? metric.descriptionHeight + 4 : 0) + (index < pointMetrics.length - 1 ? 12 : 0)
  ), 0);
  const extraRows = [];
  if (item.hotel) extraRows.push({ label: "숙소", value: item.hotel });
  if (item.meals.length) extraRows.push({ label: "식사", value: item.meals.join(" · ") });
  const extraValueWidth = detailWidth - 76;
  const extraMetrics = extraRows.map((row) => ({
    ...row,
    height: Math.max(17, textHeight(doc, row.value, extraValueWidth, "Pretendard", 12, 2))
  }));
  const extraHeight = extraMetrics.length
    ? 22 + extraMetrics.reduce((total, row, index) => total + row.height + (index < extraMetrics.length - 1 ? 7 : 0), 0)
    : 0;
  const detailHeight = pointsHeight + (extraHeight ? 15 + extraHeight : 0);
  const contentHeight = Math.max(76, detailHeight);
  return {
    detailOffset,
    detailWidth,
    pointMetrics,
    extraMetrics,
    extraHeight,
    contentHeight,
    height: contentHeight + 34
  };
}

function measureScheduleItem(doc, item) {
  return getScheduleLayoutMetrics(doc, item).height;
}

function drawScheduleItem(doc, state, item, assets, isLast = false) {
  const metrics = getScheduleLayoutMetrics(doc, item);
  const height = metrics.height;
  ensureSpace(doc, state, Math.min(height, 670), assets, "03 일정표");
  const y = state.y;
  const timelineX = MARGIN + 8;
  const dayTextX = MARGIN + 23;
  const detailX = MARGIN + metrics.detailOffset;
  const detailBottom = y + 14 + metrics.contentHeight;

  doc.circle(timelineX, y + 23, 4).fill(COLORS.accent);
  doc.font("Pretendard-Bold").fontSize(13.5).fillColor(COLORS.accent)
    .text(item.day, dayTextX, y + 13, { width: 76, lineBreak: false });
  doc.font("Pretendard-SemiBold").fontSize(11.5).fillColor(COLORS.muted)
    .text(formatScheduleDateText(item.dateText), dayTextX, y + 39, { width: 82, lineGap: 2 });
  doc.moveTo(timelineX, y + 31)
    .lineTo(timelineX, isLast ? detailBottom : y + height)
    .lineWidth(1.2)
    .strokeColor("#D9D5FF")
    .stroke();

  let cursorY = y + 14;
  metrics.pointMetrics.forEach((metric, index) => {
    doc.font("Pretendard-SemiBold").fontSize(12.75).fillColor(COLORS.ink)
      .text(metric.point.title, detailX, cursorY, { width: metrics.detailWidth, lineGap: 2 });
    cursorY += metric.titleHeight;
    if (metric.descriptionHeight) {
      cursorY += 4;
      doc.font("Pretendard").fontSize(12.5).fillColor(COLORS.muted)
        .text(metric.point.description, detailX, cursorY, { width: metrics.detailWidth, lineGap: 2 });
      cursorY += metric.descriptionHeight;
    }
    if (index < metrics.pointMetrics.length - 1) cursorY += 12;
  });

  if (metrics.extraHeight) {
    cursorY += 15;
    roundedPanel(doc, detailX, cursorY, metrics.detailWidth, metrics.extraHeight, {
      fill: COLORS.panel,
      radius: 10
    });
    let extraY = cursorY + 11;
    metrics.extraMetrics.forEach((row, index) => {
      doc.font("Pretendard-Bold").fontSize(12).fillColor(COLORS.accent)
        .text(row.label, detailX + 14, extraY, { width: 36, lineBreak: false });
      doc.font("Pretendard").fontSize(12).fillColor(COLORS.ink)
        .text(row.value, detailX + 56, extraY, { width: metrics.detailWidth - 70, lineGap: 2 });
      extraY += row.height + (index < metrics.extraMetrics.length - 1 ? 7 : 0);
    });
  }

  if (!isLast) {
    doc.moveTo(detailX, y + height - 10).lineTo(MARGIN + CONTENT_WIDTH, y + height - 10)
      .lineWidth(0.7).strokeColor(COLORS.line).stroke();
  }
  state.y += height;
}

function getPriceGuideMetrics(doc, lines = []) {
  const text = (Array.isArray(lines) ? lines : []).map((line) => asText(line, "")).filter(Boolean).join(" ");
  if (!text) return { text: "", boxHeight: 0, outerHeight: 0 };
  const textWidth = CONTENT_WIDTH - 64;
  const textContentHeight = Math.max(17, textHeight(doc, text, textWidth, "Pretendard", 12, 2));
  const boxHeight = textContentHeight + 24;
  return { text, boxHeight, outerHeight: boxHeight + 20 };
}

function hasQuoteAirfare(quote = {}) {
  if (Number(quote.airfare) > 0 || quote.airfareIncluded === true) return true;
  return (Array.isArray(quote.additionalAmounts) ? quote.additionalAmounts : []).some((item) => (
    asText(item?.label, "").replace(/\s+/g, "") === "항공료" && Number(item?.amount) > 0
  ));
}

function getUnifiedPriceCardHeight(doc, primaryRows = [], paymentRows = [], options = {}) {
  const totalRowHeight = options.totalLabelDetail || options.totalAmountDetail ? 62 : 44;
  const rowHeight = 52;
  const guideMetrics = getPriceGuideMetrics(doc, options.guideLines);
  return totalRowHeight + ((primaryRows.length + paymentRows.length) * rowHeight) + guideMetrics.outerHeight;
}

function drawUnifiedPriceRows(doc, rows, startY) {
  const rowHeight = 52;
  const labelSize = 12.75;
  const detailSize = 11.25;
  const textGap = 3;
  rows.forEach((row, index) => {
    const y = startY + (index * rowHeight);
    if (index > 0) {
      doc.moveTo(MARGIN + 18, y).lineTo(MARGIN + CONTENT_WIDTH - 18, y)
        .lineWidth(0.7).strokeColor(COLORS.line).stroke();
    }
    const labelHeight = textHeight(doc, row.label, 250, "Pretendard-SemiBold", labelSize, 0);
    const detailHeight = row.detail ? textHeight(doc, row.detail, 285, "Pretendard", detailSize, 0) : 0;
    const textGroupHeight = labelHeight + (row.detail ? textGap + detailHeight : 0);
    const textY = y + ((rowHeight - textGroupHeight) / 2);
    doc.font("Pretendard-SemiBold").fontSize(labelSize).fillColor(COLORS.ink)
      .text(row.label, MARGIN + 18, textY, { width: 250, lineBreak: false });
    if (row.detail) {
      doc.font("Pretendard").fontSize(detailSize).fillColor(COLORS.muted)
        .text(row.detail, MARGIN + 18, textY + labelHeight + textGap, { width: 285, lineBreak: false, ellipsis: true });
    }
    const amountHeight = textHeight(doc, row.amount, CONTENT_WIDTH - 303, "Pretendard-Bold", labelSize, 0);
    const amountDetailHeight = row.amountDetail ? textHeight(doc, row.amountDetail, CONTENT_WIDTH - 303, "Pretendard", detailSize, 0) : 0;
    const amountGroupHeight = amountHeight + (row.amountDetail ? textGap + amountDetailHeight : 0);
    const amountY = y + ((rowHeight - amountGroupHeight) / 2);
    doc.font("Pretendard-Bold").fontSize(labelSize).fillColor(COLORS.ink)
      .text(asText(row.amount), MARGIN + 285, amountY, {
        width: CONTENT_WIDTH - 303,
        align: "right",
        lineBreak: false
      });
    if (row.amountDetail) {
      doc.font("Pretendard").fontSize(detailSize).fillColor(COLORS.muted)
        .text(row.amountDetail, MARGIN + 285, amountY + amountHeight + textGap, {
          width: CONTENT_WIDTH - 303,
          align: "right",
          lineBreak: false
        });
    }
  });
}

function drawUnifiedPriceCard(doc, state, totalAmount, primaryRows, paymentRows, assets, options = {}) {
  const totalRowHeight = options.totalLabelDetail || options.totalAmountDetail ? 62 : 44;
  const rowHeight = 52;
  const guideMetrics = getPriceGuideMetrics(doc, options.guideLines);
  const height = getUnifiedPriceCardHeight(doc, primaryRows, paymentRows, options);
  ensureSpace(doc, state, height + 8, assets, "04 요금안내");
  const y = state.y;
  roundedPanel(doc, MARGIN, y, CONTENT_WIDTH, height, { fill: COLORS.white, radius: 12 });
  roundedPanel(doc, MARGIN, y, CONTENT_WIDTH, height, { stroke: COLORS.border, lineWidth: 1.1, radius: 12 });

  const totalCenterY = y + (totalRowHeight / 2);
  const labelHeight = textHeight(doc, "예상 총액", 150, "Pretendard-SemiBold", 14, 0);
  const labelDetailHeight = options.totalLabelDetail ? textHeight(doc, options.totalLabelDetail, 150, "Pretendard", 11.25, 0) : 0;
  const labelGroupHeight = labelHeight + (options.totalLabelDetail ? 3 + labelDetailHeight : 0);
  const labelY = totalCenterY - (labelGroupHeight / 2);
  const amountHeight = textHeight(doc, totalAmount, CONTENT_WIDTH - 210, "Pretendard-Bold", 18, 0);
  const amountDetailHeight = options.totalAmountDetail ? textHeight(doc, options.totalAmountDetail, CONTENT_WIDTH - 208, "Pretendard", 11.25, 0) : 0;
  const amountGroupHeight = amountHeight + (options.totalAmountDetail ? 3 + amountDetailHeight : 0);
  const amountY = totalCenterY - (amountGroupHeight / 2);
  doc.font("Pretendard-SemiBold").fontSize(14).fillColor(COLORS.accent)
    .text("예상 총액", MARGIN + 18, labelY, { width: 150, lineBreak: false });
  if (options.totalLabelDetail) {
    doc.font("Pretendard").fontSize(11.25).fillColor(COLORS.muted)
      .text(options.totalLabelDetail, MARGIN + 18, labelY + labelHeight + 3, { width: 150, lineBreak: false });
  }
  doc.font("Pretendard-Bold").fontSize(18).fillColor(COLORS.ink)
    .text(asText(totalAmount), MARGIN + 190, amountY, {
      width: CONTENT_WIDTH - 208,
      align: "right",
      lineBreak: false
    });
  if (options.totalAmountDetail) {
    doc.font("Pretendard").fontSize(11.25).fillColor(COLORS.muted)
      .text(options.totalAmountDetail, MARGIN + 190, amountY + amountHeight + 3, {
        width: CONTENT_WIDTH - 208,
        align: "right",
        lineBreak: false
      });
  }

  const firstDividerY = y + totalRowHeight;
  doc.moveTo(MARGIN + 18, firstDividerY).lineTo(MARGIN + CONTENT_WIDTH - 18, firstDividerY)
    .lineWidth(2).strokeColor(COLORS.lineStrong).stroke();
  const primaryStartY = firstDividerY;
  drawUnifiedPriceRows(doc, primaryRows, primaryStartY);

  const secondDividerY = primaryStartY + (primaryRows.length * rowHeight);
  doc.moveTo(MARGIN + 18, secondDividerY).lineTo(MARGIN + CONTENT_WIDTH - 18, secondDividerY)
    .lineWidth(2).strokeColor(COLORS.lineStrong).stroke();
  drawUnifiedPriceRows(doc, paymentRows, secondDividerY);
  if (guideMetrics.text) {
    const guideX = MARGIN + 18;
    const guideY = secondDividerY + (paymentRows.length * rowHeight) + 10;
    const guideWidth = CONTENT_WIDTH - 36;
    roundedPanel(doc, guideX, guideY, guideWidth, guideMetrics.boxHeight, { fill: COLORS.white, radius: 10 });
    roundedPanel(doc, guideX, guideY, guideWidth, guideMetrics.boxHeight, { stroke: COLORS.line, lineWidth: 0.8, radius: 10 });
    doc.font("Pretendard").fontSize(12).fillColor(COLORS.ink)
      .text(guideMetrics.text, guideX + 14, guideY + 12, { width: guideWidth - 28, lineGap: 2 });
  }
  state.y += height + 8;
}

function drawAccountCard(doc, state, assets) {
  const height = 104;
  ensureSpace(doc, state, height + 8, assets);
  roundedPanel(doc, MARGIN, state.y, CONTENT_WIDTH, height, { fill: COLORS.white, radius: 12 });
  roundedPanel(doc, MARGIN, state.y, CONTENT_WIDTH, height, {
    stroke: COLORS.border,
    lineWidth: 1.1,
    radius: 12
  });
  doc.font("Pretendard-SemiBold").fontSize(15).fillColor(COLORS.ink)
    .text("입금계좌", MARGIN + 18, state.y + 16, { width: 105, lineBreak: false });
  const labelX = MARGIN + 138;
  const valueX = labelX + 68;
  const rows = [
    { label: "은행", image: assets.bank, value: "신한은행" },
    { label: "계좌번호", value: "140-013-991111" },
    { label: "예금주", value: "(주)시크릿투어" }
  ];
  rows.forEach((row, index) => {
    const y = state.y + 13 + (index * 27);
    doc.font("Pretendard").fontSize(11.25).fillColor(COLORS.muted).text(row.label, labelX, y + 3, { width: 64, lineBreak: false });
    if (row.image) {
      try {
        doc.image(row.image, valueX, y, { width: 63 });
      } catch (error) {
        doc.font("Pretendard-SemiBold").fontSize(12).fillColor(COLORS.ink).text("신한은행", valueX, y + 2);
      }
    } else {
      doc.font("Pretendard-SemiBold").fontSize(13.5).fillColor(COLORS.ink).text(row.value, valueX, y, { width: 210, lineBreak: false });
    }
  });
  state.y += height + 8;
}

function getPolicyCardHeight(doc, title, groups) {
  const hasTitle = Boolean(asText(title, ""));
  const paragraphTextWidth = CONTENT_WIDTH - 32;
  const itemTextWidth = CONTENT_WIDTH - 52;
  let height = hasTitle ? 48 : 26;
  groups.forEach((group) => {
    if (group.heading) height += 24;
    if (group.paragraph) height += textHeight(doc, group.paragraph, paragraphTextWidth, "Pretendard", 11.25, 1) + 6;
    if (group.items) height += measurePolicyItems(doc, group.items, itemTextWidth);
  });
  return height;
}

function drawPolicyCard(doc, state, title, groups, assets) {
  const hasTitle = Boolean(asText(title, ""));
  const paragraphTextWidth = CONTENT_WIDTH - 32;
  const itemTextWidth = CONTENT_WIDTH - 52;
  const height = getPolicyCardHeight(doc, title, groups);
  ensureSpace(doc, state, Math.min(height + PRODUCT_CARD_GAP, 680), assets);
  roundedPanel(doc, MARGIN, state.y, CONTENT_WIDTH, height, { fill: COLORS.panel, radius: 12 });
  if (hasTitle) {
    doc.font("Pretendard-SemiBold").fontSize(13.5).fillColor(COLORS.ink)
      .text(title, MARGIN + 16, state.y + 14, { width: CONTENT_WIDTH - 32, lineBreak: false });
  }
  let cursorY = state.y + (hasTitle ? 38 : 16);
  groups.forEach((group) => {
    if (group.heading) {
      doc.font("Pretendard-SemiBold").fontSize(12.75).fillColor(COLORS.ink)
        .text(group.heading, MARGIN + 16, cursorY, { width: CONTENT_WIDTH - 32, lineBreak: false });
      cursorY += 24;
    }
    if (group.paragraph) {
      const h = textHeight(doc, group.paragraph, paragraphTextWidth, "Pretendard", 11.25, 1);
      doc.font("Pretendard").fontSize(11.25).fillColor(COLORS.ink)
        .text(group.paragraph, MARGIN + 16, cursorY, { width: paragraphTextWidth, lineGap: 1 });
      cursorY += h + 6;
    }
    if (group.items) {
      group.items.forEach((item) => {
        const h = Math.max(15, textHeight(doc, item, itemTextWidth, "Pretendard", 11.25, 1));
        doc.circle(MARGIN + 23, cursorY + 7, 2.3).fill(COLORS.accent);
        doc.font("Pretendard").fontSize(11.25).fillColor(COLORS.ink)
          .text(item, MARGIN + 34, cursorY, { width: itemTextWidth, lineGap: 1 });
        cursorY += h + 4;
      });
    }
  });
  state.y += height + PRODUCT_CARD_GAP;
}

function drawCompany(doc, state, assets) {
  const lines = [
    "대표이사 권태호",
    "서울시 마포구 동교로 255-1 501호",
    "사업자등록번호 105-88-00661 · 관광사업등록 제2022-000036호",
    "통신판매업 제2022-서울마포-2119호",
    "대표전화 02-3446-1119 · 팩스 02-555-1319"
  ];
  const leftWidth = 112;
  const columnGap = 18;
  const rightX = MARGIN + leftWidth + columnGap;
  const rightWidth = CONTENT_WIDTH - leftWidth - columnGap;
  const lineHeight = COMPANY_LINE_HEIGHT;
  const height = COMPANY_HEIGHT;
  if (state.y > COMPANY_TOP) startPage(doc, state, "05 유의사항", assets);
  state.y = COMPANY_TOP;
  const companyNameHeight = textHeight(doc, "(주)시크릿투어", leftWidth, "Pretendard-SemiBold", 11.25, 1);
  const logoWidth = 84;
  const logoHeight = 16;
  const logoGap = 8;
  const leftGroupHeight = logoHeight + logoGap + companyNameHeight;
  const logoX = MARGIN + ((leftWidth - logoWidth) / 2);
  const logoY = state.y + ((height - leftGroupHeight) / 2);
  const companyNameY = logoY + logoHeight + logoGap;
  if (assets.logo) {
    try {
      doc.image(assets.logo, logoX, logoY, { width: logoWidth });
    } catch (error) {
      doc.font("Pretendard-Bold").fontSize(8.5).fillColor(COLORS.accent)
        .text("SECRET TOUR", MARGIN, logoY + 2, { width: leftWidth, align: "center", lineBreak: false });
    }
  }
  doc.font("Pretendard-SemiBold").fontSize(11.25).fillColor(COLORS.ink)
    .text("(주)시크릿투어", MARGIN, companyNameY, { width: leftWidth, align: "center", lineBreak: false });
  lines.forEach((line, index) => {
    doc.font("Pretendard").fontSize(11.25).fillColor(COLORS.muted)
      .text(line, rightX, state.y + (lineHeight * index), { width: rightWidth, lineBreak: false });
  });
  state.y += height + 4;
}

function drawHero(doc, state, quote, assets) {
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.page);
  roundedPanel(doc, 24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48, { fill: COLORS.white, radius: 20 });
  const x = PAGE_MARGIN;
  const y = 42;
  if (assets.logo) {
    try {
      doc.image(assets.logo, x + 18, y + 15, { width: 86 });
    } catch (error) {
      doc.font("Pretendard-Bold").fontSize(10).fillColor(COLORS.accent).text("SECRET TOUR", x + 18, y + 18);
    }
  } else {
    doc.font("Pretendard-Bold").fontSize(10).fillColor(COLORS.accent).text("SECRET TOUR", x + 18, y + 18);
  }
  if (assets.hero) {
    try {
      doc.image(assets.hero, 382, 36, { fit: [165, 174], align: "center", valign: "center" });
    } catch (error) {}
  }
  doc.font("Pretendard-Bold").fontSize(25).fillColor(COLORS.ink)
    .text(`${asText(quote.applicantName, "고객")}님,\n견적서가 도착했어요.`, x + 18, y + 55, { width: 315, lineGap: 5 });
  doc.font("Pretendard").fontSize(9.5).fillColor(COLORS.muted)
    .text(`견적번호 ${asText(quote.quoteNo)}\n생성일 ${formatGeneratedDate(quote.generatedAt)}`, x + 18, y + 123, { width: 315, lineGap: 3 });
  state.y = 216;
  state.pageTitle = "견적서";
  state.page = 1;
}

function addPageFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.font("Pretendard").fontSize(8.5).fillColor(COLORS.muted)
      .text("(주)시크릿투어 · 02-3446-1119", MARGIN, 790, { width: 260, lineBreak: false });
    doc.text(`${index - range.start + 1} / ${range.count}`, MARGIN + CONTENT_WIDTH - 120, 790, { width: 120, align: "right", lineBreak: false });
  }
}

async function createGolfjoinQuotePdfBuffer(quote = {}) {
  const assets = await loadPdfImageAssets();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: true,
      bufferPages: true,
      compress: true,
      info: {
        Title: `${asText(quote.productName, "골프조인")} 견적서`,
        Author: "시크릿투어",
        Subject: "골프조인 견적서"
      },
      margin: 0,
      size: "A4"
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    registerFonts(doc);

    const state = { y: 0, page: 0, pageTitle: "견적서" };
    drawHero(doc, state, quote, assets);
    beginMajorSection(doc, state, 1, "고객정보", assets, 70, 0);
    drawInfoCards(doc, state, [
      { label: "고객명", value: quote.applicantName },
      { label: "연락처", value: formatPhone(quote.applicantPhone) },
      { label: "인원", value: `${quote.people || 1}명` }
    ], assets);

    beginMajorSection(doc, state, 2, "상품정보", assets, 90);
    drawProductSummary(doc, state, quote, assets);
    drawFlightCard(doc, state, quote, assets);
    drawBulletPair(doc, state,
      { title: "포함사항", items: quote.includedItems, fill: COLORS.accentSoft, titleColor: COLORS.accent, size: 13.5 },
      { title: "불포함사항", items: quote.excludedItems, fill: COLORS.panel, titleColor: COLORS.muted, bulletColor: "#98A2B3", size: 13.5 },
      assets);
    const notesHeight = 48 + measureBulletItems(doc, quote.productNotes, CONTENT_WIDTH - 32, 13.5);
    ensureSpace(doc, state, notesHeight + PRODUCT_CARD_GAP, assets, "02 상품정보");
    state.y += drawBulletCardAt(doc, "참고사항", quote.productNotes, MARGIN, state.y, CONTENT_WIDTH, { fill: COLORS.panel, size: 13.5, fallback: "등록된 상품 참고사항 없음" }) + PRODUCT_CARD_GAP;

    const schedule = normalizeScheduleItems(quote.itinerarySchedule);
    beginMajorSection(doc, state, 3, "일정표", assets, 100);
    if (schedule.length) {
      schedule.forEach((item, index) => {
        drawScheduleItem(doc, state, item, assets, index === schedule.length - 1);
      });
    } else {
      const itineraryHeight = 48 + measureBulletItems(doc, quote.itineraryItems, CONTENT_WIDTH - 32, 12);
      ensureSpace(doc, state, itineraryHeight + 8, assets, "03 일정표");
      state.y += drawBulletCardAt(doc, "주요 일정", quote.itineraryItems, MARGIN, state.y, CONTENT_WIDTH, { fill: COLORS.panel, size: 12 }) + 8;
    }

    const primaryPriceRows = [
      { label: "기본가", detail: `1인 기준 × ${quote.people || 1}명`, amount: quote.formattedProductSubtotal },
      ...(Array.isArray(quote.additionalAmounts) ? quote.additionalAmounts.map((item) => ({ label: asText(item.label), amount: asText(item.formattedAmount) })) : []),
      { label: "객실 1인1실 사용요금", detail: quote.singleRoomSurcharge ? `1인 1실 · 1박 ${asText(quote.formattedSingleRoomSurchargePerNight)} × ${quote.nightCount || 1}박` : "해당 없음", amount: quote.formattedSingleRoomSurcharge }
    ];
    const isGolfPack = Boolean(quote.flightExcluded);
    const isFlightAgencyRequest = isGolfPack && asText(quote.flightRequestType, "") !== "직접예약";
    const airfareIncluded = !isGolfPack || hasQuoteAirfare(quote);
    const airfareStatusText = airfareIncluded ? "항공료 포함" : "항공료 미포함";
    const airfarePending = isGolfPack && !airfareIncluded;
    const paymentPriceRows = [
      { label: "예약금", detail: `1인 ${asText(quote.formattedDepositPerPerson)}`, amount: quote.formattedDeposit },
      { label: "잔금", detail: `예약금 제외 · ${airfareStatusText}`, amount: quote.formattedBalance, amountDetail: isFlightAgencyRequest && airfarePending ? "+ 항공료" : "" }
    ];
    const priceCardOptions = {
      totalLabelDetail: airfareStatusText,
      totalAmountDetail: airfarePending ? "+ 항공료" : "",
      guideLines: isFlightAgencyRequest && airfarePending ? getFlightLines(quote).lines : []
    };
    const unifiedPriceCardHeight = getUnifiedPriceCardHeight(doc, primaryPriceRows, paymentPriceRows, priceCardOptions);
    beginMajorSection(doc, state, 4, "요금안내", assets, unifiedPriceCardHeight);
    drawUnifiedPriceCard(doc, state, quote.formattedEstimatedTotal, primaryPriceRows, paymentPriceRows, assets, priceCardOptions);
    drawAccountCard(doc, state, assets);

    beginMajorSection(doc, state, 5, "유의사항", assets, 95);
    drawPolicyCard(doc, state, "", [
      {
        paragraph: asText(quote.specialNotes, "본 견적서는 현재 신청 정보와 조회 가능한 상품 조건을 기준으로 작성되었습니다.")
      }
    ], assets);
    drawPolicyCard(doc, state, "예약 전 꼭 확인해주세요.", [
      {
        items: [
          "본 상품은 4인 1팀으로 운영되는 골프조인 상품입니다.",
          "예약 신청 후 참가 인원, 항공 좌석, 숙소 및 골프장 예약이 모두 확정되면 최종 출발이 확정됩니다.",
          "조인 인원이 충족되지 않아 출발이 취소되는 경우 예약금은 전액 환불됩니다."
        ]
      }
    ], assets);
    drawPolicyCard(doc, state, "이용안내", [
      {
        items: [
          "1인 예약 시 룸조인 또는 싱글룸 추가요금이 발생할 수 있습니다.",
          "참가자 취소로 조인 인원 변동이 발생할 경우 여행사는 대체 참가자 모집을 위해 최선을 다합니다.",
          "영문명, 여권정보, 생년월일 등 예약정보 오류로 발생하는 비용은 고객 부담입니다.",
          "천재지변, 항공기 결항 등 불가항력적 상황은 항공사 및 현지 업체 규정에 따라 처리됩니다.",
          "취소 및 변경 접수는 평일 영업시간(09:00~18:00) 기준으로 적용됩니다."
        ]
      }
    ], assets);
    const cancellationPolicyGroups = [
      { paragraph: "제5조(여행출발 전 계약해제) 이 상품은 특별약관을 기준으로 진행됩니다." },
      {
        items: [
          "여행확정일~여행출발일 20일 전 취소 요청 시 - 항공위약금 + 여행요금의 20% 배상",
          "여행출발일 19~10일 전까지 취소 요청 시 - 항공위약금 + 여행요금의 30% 배상",
          "여행출발일 9~8일 전까지 취소 요청 시 - 항공위약금 + 여행요금의 50% 배상",
          "여행출발일 7~4일 전까지 취소 요청 시 - 항공위약금 + 여행요금의 70% 배상",
          "여행출발일 3일 전~출발 당일까지 취소 요청 시 - 여행요금의 100% 배상"
        ]
      }
    ];
    const cancellationPolicyHeight = getPolicyCardHeight(doc, "취소 수수료 관련 규정", cancellationPolicyGroups);
    if (state.y + cancellationPolicyHeight + PRODUCT_CARD_GAP > COMPANY_TOP) {
      startPage(doc, state, "05 유의사항", assets);
    }
    drawPolicyCard(doc, state, "취소 수수료 관련 규정", cancellationPolicyGroups, assets);
    drawCompany(doc, state, assets);

    addPageFooters(doc);
    doc.end();
  });
}

module.exports = {
  createGolfjoinQuotePdfBuffer
};
