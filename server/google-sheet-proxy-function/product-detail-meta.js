"use strict";

const crypto = require("node:crypto");
const { buildGolfSummaryFromSchedule } = require("./product-family");

const SECRET_TOUR_ORIGIN = "https://www.secret-tour.com";

function decodeHtmlText(value = "") {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|li|p|section|article|tr|td|th|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&nbsp;|&ensp;|&emsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getHtmlAttribute(tag = "", attributeName = "") {
  const safeName = String(attributeName || "").replace(/[^a-z0-9:_-]/gi, "");
  if (!safeName) return "";
  const pattern = new RegExp(`\\b${safeName}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, "i");
  const match = String(tag || "").match(pattern);
  return match?.[1] || match?.[2] || "";
}

function findElementEnd(html = "", tagName = "", contentStart = 0) {
  const pattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  pattern.lastIndex = contentStart;
  let depth = 1;
  let match;
  while ((match = pattern.exec(html))) {
    const tag = match[0];
    if (/^<\//.test(tag)) {
      depth -= 1;
      if (depth === 0) return pattern.lastIndex;
    } else if (!/\/\s*>$/.test(tag)) {
      depth += 1;
    }
  }
  return html.length;
}

function extractElementsByClass(html = "", classNames = []) {
  const source = String(html || "");
  const wanted = new Set(classNames);
  const tagPattern = /<([a-z][\w:-]*)\b[^>]*>/gi;
  const elements = [];
  let match;
  while ((match = tagPattern.exec(source))) {
    const classes = getHtmlAttribute(match[0], "class").split(/\s+/).filter(Boolean);
    if (!classes.some((className) => wanted.has(className))) continue;
    const end = findElementEnd(source, match[1], tagPattern.lastIndex);
    elements.push(source.slice(match.index, end));
    tagPattern.lastIndex = Math.max(tagPattern.lastIndex, end);
  }
  return elements;
}

function extractTagTexts(html = "", tagName = "") {
  const safeTagName = String(tagName || "").replace(/[^a-z0-9:_-]/gi, "");
  if (!safeTagName) return [];
  const pattern = new RegExp(`<${safeTagName}\\b[^>]*>([\\s\\S]*?)<\\/${safeTagName}\\s*>`, "gi");
  return [...String(html || "").matchAll(pattern)]
    .map((match) => decodeHtmlText(match[1]))
    .filter(Boolean);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function extractFirstClassText(html = "", classNames = []) {
  return decodeHtmlText(extractElementsByClass(html, classNames)[0] || "");
}

function normalizePublicImageUrl(value = "") {
  const source = decodeHtmlText(value).trim();
  if (!source || /^(?:data|javascript):/i.test(source)) return "";
  try {
    const url = new URL(source.startsWith("//") ? `https:${source}` : source, SECRET_TOUR_ORIGIN);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function extractImageUrls(html = "") {
  return unique((String(html || "").match(/<img\b[^>]*>/gi) || [])
    .map((tag) => normalizePublicImageUrl(
      getHtmlAttribute(tag, "data-src")
      || getHtmlAttribute(tag, "data-lazy-src")
      || getHtmlAttribute(tag, "src")
    )));
}

function extractSecretTourDetailBoxes(html = "") {
  return extractElementsByClass(html, ["detail_box", "data_note_item", "getdata_vertical_item"])
    .map((element) => {
      const title = extractFirstClassText(element, ["dbox_title", "note_title", "getdata_vertical_title"]);
      const content = extractElementsByClass(element, ["dbox_content_row", "data_note_cont", "data_note_content_row", "data_rendar_zone"])[0] || "";
      return title && content ? { title, content } : null;
    })
    .filter(Boolean);
}

function findSecretTourDetailBox(boxes = [], titleParts = [], fallbackIndex = -1) {
  return boxes.find((box) => titleParts.some((part) => box.title.includes(part)))
    || boxes[fallbackIndex]
    || null;
}

function extractSecretTourDetailList(containerHtml = "") {
  if (!containerHtml) return [];
  const pattern = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  const values = [...String(containerHtml).matchAll(pattern)]
    .map((match) => decodeHtmlText(match[2]).replace(/^[\s-]+/, "").trim())
    .filter(Boolean);
  return unique(values.length ? values : [decodeHtmlText(containerHtml)]);
}

function parseSecretTourMeals(text = "") {
  const raw = decodeHtmlText(text).replace(/\n/g, " ").trim();
  if (!raw) return [];
  const labelMap = { "아침": "조식", "점심": "중식", "저녁": "석식" };
  const simpleMatched = [...raw.matchAll(/(조식|중식|석식|아침|점심|저녁)\s*[:：]\s*([^|]+)/g)]
    .map((match) => ({ label: labelMap[match[1]] || match[1], menu: decodeHtmlText(match[2]) }))
    .filter((meal) => meal.label || meal.menu);
  if (simpleMatched.length) return simpleMatched;
  const labelPattern = /(조식|중식|석식|아침|점심|저녁)\s*[:：]?\s*([^|]+?)(?=\s*(?:조식|중식|석식|아침|점심|저녁|$|\|))/g;
  const matched = [...raw.matchAll(labelPattern)]
    .map((match) => ({ label: labelMap[match[1]] || match[1], menu: decodeHtmlText(match[2]) }))
    .filter((meal) => meal.label || meal.menu);
  if (matched.length) return matched;
  return raw.split(/\s*\|\s*/).map((part) => {
    const [label, ...rest] = part.split(/\s*[:：]\s*/);
    return { label: decodeHtmlText(label), menu: decodeHtmlText(rest.join(":")) };
  }).filter((meal) => meal.label || meal.menu);
}

function extractSecretTourScheduleExtra(element = "") {
  const extra = { hotel: "", meals: [] };
  const blocks = extractElementsByClass(element, [
    "timeline_elsedata_row", "elsedata_tb", "elsedata", "schedule_info",
    "timeline_info", "stay_info", "hotel_info", "meal_info"
  ]);
  const text = decodeHtmlText(blocks.join("\n"));
  const hotelMatch = text.match(/(?:숙소|호텔)\s*[:：]?\s*([^|\n]+?)(?=\s*(?:\||식사|조식|중식|석식|아침|점심|저녁|$))/);
  if (hotelMatch) extra.hotel = decodeHtmlText(hotelMatch[1]);
  const mealIndex = text.indexOf("식사");
  const mealText = mealIndex >= 0 ? text.slice(mealIndex + 2) : text;
  const meals = parseSecretTourMeals(/조식|중식|석식|아침|점심|저녁/.test(mealText) ? mealText : "");
  if (meals.length) extra.meals = meals;
  return extra;
}

function formatSecretTourScheduleTitleDate(value = "") {
  const text = decodeHtmlText(value);
  const match = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*\(([^)]+)\)/.exec(text);
  if (!match) return text;
  return `${Number(match[2])}/${String(Number(match[3])).padStart(2, "0")}(${match[4].trim()})`;
}

function extractSecretTourTimelineSchedule(html = "") {
  return extractElementsByClass(html, ["timeline_item", "timeline_vitem"]).map((element, index) => {
    const points = extractElementsByClass(element, ["scheduleBox"])
      .flatMap((scheduleBox) => extractTagTexts(scheduleBox, "li"));
    const rawText = decodeHtmlText(element);
    if (!rawText) return null;
    return {
      day: extractFirstClassText(element, ["timeline_bar_bullet", "timeline_title_main"]) || `${index + 1}일차`,
      dateText: formatSecretTourScheduleTitleDate(extractFirstClassText(element, ["timeline_title_sub"])),
      content: unique(points).join(", "),
      points: unique(points),
      rawText,
      extra: extractSecretTourScheduleExtra(element)
    };
  }).filter(Boolean);
}

function buildProductGolfSummaryFromHtml(html = "") {
  return buildGolfSummaryFromSchedule(extractSecretTourTimelineSchedule(html));
}

function readSecretTourScriptString(html = "", key = "") {
  const safeKey = String(key || "").replace(/[^a-z0-9_$]/gi, "");
  if (!safeKey) return "";
  const scriptText = [...String(html || "").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1] || "")
    .find((text) => text.includes("const oGoodsView") || text.includes("oGoodsView")) || "";
  const quoted = new RegExp(`${safeKey}\\s*(?::|=)\\s*(['\"])([\\s\\S]*?)\\1`).exec(scriptText);
  if (quoted) {
    return String(quoted[2] || "")
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\")
      .trim();
  }
  const raw = new RegExp(`${safeKey}\\s*(?::|=)\\s*(?:Number\\(\\s*)?['\"]?([^'\",)\\s}]+)`).exec(scriptText);
  return String(raw?.[1] || "").trim();
}

function normalizeDate(value = "") {
  const source = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return source;
  const digits = source.replace(/[^0-9]/g, "");
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : "";
}

function buildDetailRevision(snapshotBasis = {}) {
  return `gpd_${crypto.createHash("sha256").update(JSON.stringify(snapshotBasis)).digest("hex").slice(0, 24)}`;
}

function getSectionState(found, values = []) {
  if (!found) return "unavailable";
  return values.length ? "available" : "empty";
}

function buildPublicProductDetailSnapshot(html = "", product = {}, options = {}) {
  const goodSeq = String(product.goodSeq || product.erpProductId || "").trim();
  const eventSeq = String(product.eventSeq || product.erpEventSeq || "").trim();
  const generatedAt = String(options.generatedAt || product.generatedAt || new Date().toISOString());
  const boxes = extractSecretTourDetailBoxes(html);
  const includesBox = findSecretTourDetailBox(boxes, ["포함"], 0);
  const excludesBox = findSecretTourDetailBox(boxes, ["불포함"], 1);
  const notesBox = findSecretTourDetailBox(boxes, ["참고"], 2);
  const introBox = findSecretTourDetailBox(boxes, ["상품소개"], 3);
  const includes = extractSecretTourDetailList(includesBox?.content);
  const excludes = extractSecretTourDetailList(excludesBox?.content);
  const notes = extractSecretTourDetailList(notesBox?.content)
    .map((text) => ({ text, source: "secret-tour-goods-view" }));
  const schedule = extractSecretTourTimelineSchedule(html).map((item) => ({
    day: item.day,
    dateText: item.dateText || "",
    content: item.content || "",
    points: Array.isArray(item.points) ? item.points : [],
    rawText: item.rawText || "",
    extra: {
      hotel: item.extra?.hotel || "",
      meals: Array.isArray(item.extra?.meals) ? item.extra.meals : []
    }
  }));
  const slideContainers = extractElementsByClass(html, ["swiper-slide"]);
  const slides = unique(slideContainers.flatMap(extractImageUrls));
  const introImages = extractImageUrls(introBox?.content || "");
  const goodsImage = normalizePublicImageUrl(readSecretTourScriptString(html, "goodsImage"));
  const departureDate = normalizeDate(product.departureDate || readSecretTourScriptString(html, "startDay"));
  const returnDate = normalizeDate(product.returnDate || readSecretTourScriptString(html, "endDay") || departureDate);
  const packType = String(product.packType || product.productType || product.goodsType || "").trim();
  const sectionStatus = {
    includes: getSectionState(Boolean(includesBox), includes),
    excludes: getSectionState(Boolean(excludesBox), excludes),
    notes: getSectionState(Boolean(notesBox), notes),
    schedule: getSectionState(/\b(?:timeline_item|timeline_vitem)\b/.test(html), schedule),
    images: getSectionState(Boolean(slideContainers.length || introBox), [...slides, ...introImages])
  };
  const warnings = Object.entries(sectionStatus)
    .filter(([, state]) => state === "unavailable")
    .map(([section]) => `section.${section}.unavailable`);
  const detailStatus = warnings.length ? (warnings.length === Object.keys(sectionStatus).length ? "unavailable" : "partial") : "ready";
  const sourceUrl = `${SECRET_TOUR_ORIGIN}/goods/goods_view?goodSeq=${encodeURIComponent(goodSeq)}&eventSeq=${encodeURIComponent(eventSeq)}`;
  const basis = {
    goodSeq,
    eventSeq,
    title: String(product.title || readSecretTourScriptString(html, "eventNm") || "").trim(),
    detailTitleCopy: extractFirstClassText(html, ["detail_title_copy"]),
    goodDescription: readSecretTourScriptString(html, "goodDescription"),
    departureDate,
    returnDate,
    duration: String(product.duration || product.dayNightCnt || "").trim(),
    price: Math.max(0, Number(product.generalPrice || product.price || 0)),
    heroImage: goodsImage || normalizePublicImageUrl(product.image),
    detailStatus,
    sectionStatus,
    flight: {
      state: /골프팩|golf/i.test(packType) ? "not_required" : "unavailable",
      packType,
      airline: String(product.airline || "").trim(),
      departureAirport: String(product.departureAirport || product.airport || "").trim(),
      arrivalAirport: String(product.arrivalAirport || "").trim(),
      items: []
    },
    includes,
    excludes,
    notes,
    schedule,
    slides,
    introImages,
    sourceUrl,
    source: "secret-tour-goods-view",
    warnings
  };
  const goodTransportSeq = readSecretTourScriptString(html, "goodTransportSeq");
  return {
    schema: "secret-golf-join-product-detail-v1",
    generatedAt,
    detailRevision: buildDetailRevision(basis),
    goodSeq,
    eventSeq,
    erpProductId: goodSeq,
    erpEventSeq: eventSeq,
    ...(goodTransportSeq ? { goodTransportSeq } : {}),
    ...basis
  };
}

module.exports = {
  decodeHtmlText,
  extractSecretTourDetailBoxes,
  extractSecretTourDetailList,
  extractSecretTourTimelineSchedule,
  buildProductGolfSummaryFromHtml,
  buildPublicProductDetailSnapshot
};
