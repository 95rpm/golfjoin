"use strict";

const path = require("path");
const PDFDocument = require("pdfkit");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const COLORS = {
  ink: "#172033",
  text: "#373A3C",
  muted: "#697386",
  faint: "#98A2B3",
  line: "#DDE3EC",
  panel: "#F6F8FB",
  blue: "#3489F8",
  blueDark: "#1769D2",
  blueSoft: "#EAF3FF",
  white: "#FFFFFF"
};

const FONT_PATHS = {
  regular: path.join(__dirname, "assets", "fonts", "Pretendard-Regular.otf"),
  semibold: path.join(__dirname, "assets", "fonts", "Pretendard-SemiBold.otf"),
  bold: path.join(__dirname, "assets", "fonts", "Pretendard-Bold.otf")
};

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

function registerFonts(doc) {
  doc.registerFont("Pretendard", FONT_PATHS.regular);
  doc.registerFont("Pretendard-SemiBold", FONT_PATHS.semibold);
  doc.registerFont("Pretendard-Bold", FONT_PATHS.bold);
}

function roundedPanel(doc, x, y, width, height, options = {}) {
  const radius = options.radius == null ? 8 : options.radius;
  doc.save();
  doc.roundedRect(x, y, width, height, radius);
  if (options.fill) doc.fill(options.fill);
  if (options.stroke) {
    doc.lineWidth(options.lineWidth || 0.8).strokeColor(options.stroke).stroke();
  }
  doc.restore();
}

function drawLabelValue(doc, label, value, x, y, width, options = {}) {
  doc.font("Pretendard").fontSize(options.labelSize || 9.5).fillColor(COLORS.muted)
    .text(asText(label, ""), x, y, { width, lineBreak: false });
  doc.font(options.bold ? "Pretendard-Bold" : "Pretendard-SemiBold")
    .fontSize(options.valueSize || 11.8).fillColor(options.color || COLORS.text)
    .text(asText(value), x, y + 18, {
      width,
      height: options.height || 30,
      ellipsis: options.ellipsis !== false,
      lineGap: 2
    });
}

function drawSectionHeading(doc, number, title, y) {
  doc.font("Pretendard-Bold").fontSize(10).fillColor(COLORS.blue)
    .text(String(number).padStart(2, "0"), MARGIN, y + 1, { width: 24, lineBreak: false });
  doc.font("Pretendard-Bold").fontSize(14).fillColor(COLORS.ink)
    .text(title, MARGIN + 32, y, { width: 200, lineBreak: false });
  doc.moveTo(MARGIN + 32, y + 24).lineTo(MARGIN + CONTENT_WIDTH, y + 24)
    .lineWidth(0.7).strokeColor(COLORS.line).stroke();
}

function drawAmountRow(doc, y, label, detail, amount, options = {}) {
  const x = MARGIN + 16;
  const width = CONTENT_WIDTH - 32;
  const rowHeight = options.height || 28;
  if (options.highlight) {
    roundedPanel(doc, x, y, width, rowHeight, { fill: COLORS.blueSoft, radius: 5 });
  }
  doc.font(options.highlight ? "Pretendard-Bold" : "Pretendard-SemiBold")
    .fontSize(options.highlight ? 12.5 : 11.2).fillColor(COLORS.text)
    .text(label, x + 12, y + 7, { width: 128, lineBreak: false });
  doc.font("Pretendard").fontSize(9.8).fillColor(COLORS.muted)
    .text(detail, x + 148, y + 8, { width: 142, lineBreak: false, ellipsis: true });
  doc.font(options.highlight ? "Pretendard-Bold" : "Pretendard-SemiBold")
    .fontSize(options.highlight ? 14 : 11.5).fillColor(options.highlight ? COLORS.blueDark : COLORS.ink)
    .text(amount, x + 302, y + (options.highlight ? 5 : 7), {
      width: width - 314,
      align: "right",
      lineBreak: false,
      ellipsis: true
    });
  if (!options.last && !options.highlight) {
    doc.moveTo(x + 12, y + rowHeight).lineTo(x + width - 12, y + rowHeight)
      .lineWidth(0.5).strokeColor(COLORS.line).stroke();
  }
}

function drawStep(doc, index, title, description, x, y, width, active = false) {
  doc.circle(x + 13, y + 13, 13).fill(active ? COLORS.blue : COLORS.blueSoft);
  doc.font("Pretendard-Bold").fontSize(10).fillColor(active ? COLORS.white : COLORS.blueDark)
    .text(String(index), x + 8, y + 6.5, { width: 10, align: "center", lineBreak: false });
  doc.font("Pretendard-SemiBold").fontSize(10.5).fillColor(COLORS.ink)
    .text(title, x + 34, y + 1, { width: width - 34, lineBreak: false });
  doc.font("Pretendard").fontSize(8.6).fillColor(COLORS.muted)
    .text(description, x + 34, y + 18, { width: width - 34, lineBreak: false, ellipsis: true });
}

function drawBulletList(doc, title, items, x, y, width, height) {
  roundedPanel(doc, x, y, width, height, { fill: COLORS.panel, radius: 7 });
  doc.font("Pretendard-Bold").fontSize(14).fillColor(COLORS.ink)
    .text(title, x + 18, y + 18, { width: width - 36, lineBreak: false });
  const list = Array.isArray(items) && items.length ? items.slice(0, 7) : ["담당자 확인 후 안내"];
  let cursorY = y + 51;
  list.forEach((item) => {
    doc.circle(x + 22, cursorY + 6, 2.7).fill(COLORS.blue);
    doc.font("Pretendard").fontSize(10.5).fillColor(COLORS.text)
      .text(asText(item), x + 33, cursorY, {
        width: width - 51,
        height: 31,
        ellipsis: true,
        lineGap: 2
      });
    cursorY += 29;
  });
}

function createGolfjoinQuotePdfBuffer(quote = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: true,
      bufferPages: true,
      compress: true,
      info: {
        Title: "골프조인 예약요청 견적서",
        Author: "시크릿투어",
        Subject: asText(quote.productName, "골프조인 견적서")
      },
      margin: 0,
      size: "A4"
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    registerFonts(doc);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.white);
    doc.rect(0, 0, PAGE_WIDTH, 9).fill(COLORS.blue);

    doc.font("Pretendard-Bold").fontSize(9.5).fillColor(COLORS.blue)
      .text("SECRET TOUR  ·  GOLF JOIN", MARGIN, 35, { characterSpacing: 0.7, lineBreak: false });
    doc.font("Pretendard-Bold").fontSize(25).fillColor(COLORS.ink)
      .text("예약요청 견적서", MARGIN, 57, { lineBreak: false });
    doc.font("Pretendard").fontSize(9.2).fillColor(COLORS.muted)
      .text(`견적번호  ${asText(quote.quoteNo)}`, MARGIN, 93, { width: 285, lineBreak: false, ellipsis: true });
    doc.text(`생성일  ${formatGeneratedDate(quote.generatedAt)}`, MARGIN + 294, 93, {
      width: CONTENT_WIDTH - 294,
      align: "right",
      lineBreak: false
    });

    roundedPanel(doc, 437, 39, 114, 32, { fill: COLORS.blueSoft, radius: 16 });
    doc.circle(455, 55, 4).fill(COLORS.blue);
    doc.font("Pretendard-SemiBold").fontSize(10.5).fillColor(COLORS.blueDark)
      .text("담당자 확인 전", 466, 47.5, { width: 72, align: "center", lineBreak: false });

    roundedPanel(doc, MARGIN, 120, CONTENT_WIDTH, 78, { fill: COLORS.blue, radius: 9 });
    doc.font("Pretendard").fontSize(9.6).fillColor("#DCEBFF")
      .text("신청 일정", MARGIN + 20, 136, { lineBreak: false });
    const summaryTitle = [quote.country, quote.region].filter(Boolean).join(" · ") || asText(quote.productName);
    doc.font("Pretendard-Bold").fontSize(17).fillColor(COLORS.white)
      .text(summaryTitle, MARGIN + 20, 155, { width: 280, height: 24, ellipsis: true, lineBreak: false });
    doc.font("Pretendard").fontSize(10).fillColor("#DCEBFF")
      .text(`${asText(quote.departureDate)} - ${asText(quote.returnDate)}`, MARGIN + 20, 179, {
        width: 280,
        lineBreak: false
      });
    doc.font("Pretendard").fontSize(9.6).fillColor("#DCEBFF")
      .text("예상 총액", MARGIN + 326, 136, { width: 160, align: "right", lineBreak: false });
    doc.font("Pretendard-Bold").fontSize(20).fillColor(COLORS.white)
      .text(asText(quote.formattedEstimatedTotal), MARGIN + 306, 158, {
        width: 180,
        align: "right",
        lineBreak: false,
        ellipsis: true
      });

    drawSectionHeading(doc, 1, "신청 정보", 220);
    const applicantY = 254;
    const applicantGap = 16;
    const applicantWidth = (CONTENT_WIDTH - (applicantGap * 2)) / 3;
    drawLabelValue(doc, "신청자", quote.applicantName, MARGIN, applicantY, applicantWidth);
    drawLabelValue(doc, "연락처", quote.applicantPhone, MARGIN + applicantWidth + applicantGap, applicantY, applicantWidth);
    drawLabelValue(doc, "신청 유형", quote.applicationType, MARGIN + ((applicantWidth + applicantGap) * 2), applicantY, applicantWidth);
    drawLabelValue(doc, "신청 인원", `${quote.people || 1}명`, MARGIN, applicantY + 48, applicantWidth);
    drawLabelValue(doc, "숙소 타입", quote.roomType, MARGIN + applicantWidth + applicantGap, applicantY + 48, applicantWidth);
    drawLabelValue(doc, "항공", quote.airline, MARGIN + ((applicantWidth + applicantGap) * 2), applicantY + 48, applicantWidth);

    drawSectionHeading(doc, 2, "일정 정보", 354);
    roundedPanel(doc, MARGIN, 388, CONTENT_WIDTH, 98, { fill: COLORS.panel, radius: 7 });
    drawLabelValue(doc, "상품명", quote.productName, MARGIN + 16, 403, CONTENT_WIDTH - 32, {
      bold: true,
      valueSize: 12.4,
      height: 34,
      ellipsis: true
    });
    const scheduleWidth = (CONTENT_WIDTH - 32 - 36) / 3;
    drawLabelValue(doc, "지역", [quote.country, quote.region].filter(Boolean).join(" / "), MARGIN + 16, 449, scheduleWidth, { valueSize: 10.8 });
    drawLabelValue(doc, "출발일", quote.departureDate, MARGIN + 16 + scheduleWidth + 18, 449, scheduleWidth, { valueSize: 10.8 });
    drawLabelValue(doc, "도착일", quote.returnDate, MARGIN + 16 + ((scheduleWidth + 18) * 2), 449, scheduleWidth, { valueSize: 10.8 });

    drawSectionHeading(doc, 3, "견적 금액", 507);
    roundedPanel(doc, MARGIN, 541, CONTENT_WIDTH, 164, { fill: COLORS.white, stroke: COLORS.line, radius: 7 });
    drawAmountRow(doc, 551, "상품가", `1인 기준 × ${quote.people || 1}명`, asText(quote.formattedProductSubtotal));
    drawAmountRow(doc, 580, "1인 1실 추가요금", quote.singleRoomSurcharge ? "신청 기준" : "해당 없음", asText(quote.formattedSingleRoomSurcharge));
    drawAmountRow(doc, 610, "예상 총액", "자동 산출", asText(quote.formattedEstimatedTotal), { highlight: true, height: 32 });
    drawAmountRow(doc, 646, "예약금", `1인 ${asText(quote.formattedDepositPerPerson)}`, asText(quote.formattedDeposit));
    drawAmountRow(doc, 675, "잔금", "예약금 제외", asText(quote.formattedBalance), { last: true });

    doc.font("Pretendard").fontSize(8.8).fillColor(COLORS.muted)
      .text("※ 항공 좌석, 객실 가능 여부 및 현지 상황에 따라 담당자 확인 후 최종 금액이 변경될 수 있습니다.", MARGIN, 715, {
        width: CONTENT_WIDTH,
        lineBreak: false,
        ellipsis: true
      });

    roundedPanel(doc, MARGIN, 738, CONTENT_WIDTH, 58, { fill: COLORS.panel, radius: 7 });
    drawStep(doc, 1, "신청 접수", "현재 단계", MARGIN + 16, 753, 142, true);
    drawStep(doc, 2, "견적 확정", "담당자 확인", MARGIN + 177, 753, 142);
    drawStep(doc, 3, "예약금 입금", "입금 후 예약 진행", MARGIN + 338, 753, 153);
    doc.moveTo(MARGIN + 154, 766).lineTo(MARGIN + 170, 766).lineWidth(1).strokeColor(COLORS.line).stroke();
    doc.moveTo(MARGIN + 315, 766).lineTo(MARGIN + 331, 766).lineWidth(1).strokeColor(COLORS.line).stroke();

    doc.font("Pretendard-SemiBold").fontSize(9.2).fillColor(COLORS.ink)
      .text(`입금 안내  ${asText(quote.accountText, "담당자 확인 후 안내")}`, MARGIN, 813, {
        width: 300,
        lineBreak: false,
        ellipsis: true
      });
    doc.font("Pretendard").fontSize(8.8).fillColor(COLORS.muted)
      .text("시크릿투어 · 카카오채널 문의 · www.secret-tour.com", MARGIN + 300, 813, {
        width: CONTENT_WIDTH - 300,
        align: "right",
        lineBreak: false
      });

    doc.addPage({ size: "A4", margin: 0 });
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.white);
    doc.rect(0, 0, PAGE_WIDTH, 9).fill(COLORS.blue);
    doc.font("Pretendard-Bold").fontSize(9.5).fillColor(COLORS.blue)
      .text("SECRET TOUR  ·  GOLF JOIN", MARGIN, 35, { characterSpacing: 0.7, lineBreak: false });
    doc.font("Pretendard-Bold").fontSize(24).fillColor(COLORS.ink)
      .text("여행 조건 및 예약 안내", MARGIN, 58, { lineBreak: false });
    doc.font("Pretendard").fontSize(9.2).fillColor(COLORS.muted)
      .text(`견적번호  ${asText(quote.quoteNo)}`, MARGIN, 94, { width: 300, lineBreak: false });
    doc.text("2 / 2", MARGIN + 390, 94, { width: CONTENT_WIDTH - 390, align: "right", lineBreak: false });

    roundedPanel(doc, MARGIN, 124, CONTENT_WIDTH, 80, { fill: COLORS.blue, radius: 8 });
    doc.font("Pretendard").fontSize(9.5).fillColor("#DCEBFF")
      .text("해외 골프 조인 상품", MARGIN + 20, 140, { lineBreak: false });
    doc.font("Pretendard-Bold").fontSize(15.5).fillColor(COLORS.white)
      .text(asText(quote.productName), MARGIN + 20, 161, {
        width: CONTENT_WIDTH - 40,
        height: 36,
        ellipsis: true,
        lineGap: 3
      });

    drawSectionHeading(doc, 4, "포함 및 불포함 사항", 230);
    const columnGap = 16;
    const columnWidth = (CONTENT_WIDTH - columnGap) / 2;
    drawBulletList(doc, "포함 사항", quote.includedItems, MARGIN, 266, columnWidth, 225);
    drawBulletList(doc, "불포함 사항", quote.excludedItems, MARGIN + columnWidth + columnGap, 266, columnWidth, 225);

    drawSectionHeading(doc, 5, "견적 및 예약 안내", 522);
    roundedPanel(doc, MARGIN, 558, CONTENT_WIDTH, 116, { fill: COLORS.panel, radius: 7 });
    doc.font("Pretendard").fontSize(10.5).fillColor(COLORS.text)
      .text(asText(quote.specialNotes), MARGIN + 20, 578, {
        width: CONTENT_WIDTH - 40,
        height: 75,
        lineGap: 5,
        ellipsis: true
      });

    roundedPanel(doc, MARGIN, 696, CONTENT_WIDTH, 55, { fill: COLORS.blueSoft, radius: 7 });
    doc.font("Pretendard-Bold").fontSize(12.5).fillColor(COLORS.blueDark)
      .text("입금 안내", MARGIN + 18, 715, { width: 70, lineBreak: false });
    doc.font("Pretendard-SemiBold").fontSize(12).fillColor(COLORS.ink)
      .text(asText(quote.accountText, "담당자 확인 후 안내"), MARGIN + 100, 715, {
        width: CONTENT_WIDTH - 118,
        lineBreak: false,
        ellipsis: true
      });

    drawStep(doc, 1, "견적 확인", "상품·일정·금액 확인", MARGIN, 777, 150, true);
    drawStep(doc, 2, "예약금 입금", "담당자 계좌 안내", MARGIN + 174, 777, 150);
    drawStep(doc, 3, "예약 진행", "확정 내용 별도 안내", MARGIN + 348, 777, 159);
    doc.moveTo(MARGIN + 153, 790).lineTo(MARGIN + 168, 790).lineWidth(1).strokeColor(COLORS.line).stroke();
    doc.moveTo(MARGIN + 327, 790).lineTo(MARGIN + 342, 790).lineWidth(1).strokeColor(COLORS.line).stroke();
    doc.font("Pretendard").fontSize(8.8).fillColor(COLORS.muted)
      .text("시크릿투어 · 카카오채널 문의 · www.secret-tour.com", MARGIN, 822, {
        width: CONTENT_WIDTH,
        align: "right",
        lineBreak: false
      });

    doc.end();
  });
}

module.exports = {
  createGolfjoinQuotePdfBuffer
};
