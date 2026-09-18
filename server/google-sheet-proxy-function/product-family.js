"use strict";

const crypto = require("crypto");

const FAMILY_STATUS = Object.freeze({
  APPROVED: "approved",
  REVIEW_REQUIRED: "review_required",
  REVOKED: "revoked"
});

const REPRESENTATIVE_MODE = Object.freeze({
  LOWEST_PRICE: "lowest_price",
  MANUAL: "manual"
});

const TITLE_COUNTRIES = Object.freeze([
  "라오스", "말레이시아", "미얀마", "베트남", "브루나이", "인도네시아", "태국", "필리핀",
  "일본", "중국", "대만", "괌", "사이판", "제주", "한국"
]);

const TITLE_COUNTRY_ALIASES = Object.freeze({ "말레이지아": "말레이시아" });

function text(value = "") {
  return String(value == null ? "" : value).trim();
}

function normalizeGoodSeq(value = "") {
  const normalized = text(value);
  return /^\d+$/.test(normalized) ? normalized : "";
}

function normalizeRevision(value = 0) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function normalizeKeyText(value = "") {
  return text(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\[\](){}·|/,:;_\-]+/g, "");
}

function stripPackPrefix(value = "") {
  return text(value)
    .replace(/^\s*\[(?:항공팩|골프팩)[^\]]*\]\s*/i, "")
    .replace(/^\s*(?:항공팩|골프팩)\s*[-:·|]?\s*/i, "")
    .trim();
}

function getBaseTitle(value = "") {
  const title = stripPackPrefix(value);
  if (!title) return "";
  const durationMatch = /(\d+)\s*박\s*(\d+)\s*일/.exec(title);
  const base = durationMatch?.index > 0 ? title.slice(0, durationMatch.index) : title;
  return base
    .replace(/(?:19|20)\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/g, " ")
    .replace(/[\s·|/,:;\-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferDestinationFromTitle(value = "") {
  const parts = stripPackPrefix(value).split(/\s+/).filter(Boolean);
  const countryIndex = parts.findIndex((part) => TITLE_COUNTRIES.includes(part) || TITLE_COUNTRY_ALIASES[part]);
  if (countryIndex < 0) return { country: "", region: "" };
  return {
    country: TITLE_COUNTRY_ALIASES[parts[countryIndex]] || parts[countryIndex],
    region: text(parts[countryIndex + 1]).replace(/[()[\],]/g, "")
  };
}

function parseDuration(product = {}) {
  const source = [product.duration, product.dayNightCnt, product.title, product.productName]
    .map(text)
    .find((value) => /(\d+)\s*박\s*(\d+)\s*일/.test(value)) || "";
  const matched = /(\d+)\s*박\s*(\d+)\s*일/.exec(source);
  if (matched) {
    return {
      nights: Number(matched[1]),
      days: Number(matched[2]),
      label: `${Number(matched[1])}박 ${Number(matched[2])}일`
    };
  }
  const departureDate = text(product.departureDate);
  const returnDate = text(product.returnDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(departureDate) && /^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
    const start = Date.parse(`${departureDate}T00:00:00Z`);
    const end = Date.parse(`${returnDate}T00:00:00Z`);
    const nights = Math.round((end - start) / 86400000);
    if (nights >= 0 && nights <= 60) {
      return { nights, days: nights + 1, label: `${nights}박 ${nights + 1}일` };
    }
  }
  return { nights: 0, days: 0, label: "" };
}

function parseDeparturePatternFromTitle(value = "") {
  const title = text(value).normalize("NFKC");
  const durationMatch = /(\d+)\s*박\s*(\d+)\s*일/.exec(title);
  if (!durationMatch) {
    return { mode: "unknown", weekdays: [], label: "출발요일 확인 필요", status: "review_required" };
  }
  const tail = title.slice((durationMatch.index || 0) + durationMatch[0].length);
  const departureIndex = tail.indexOf("출발");
  if (departureIndex < 0) {
    return { mode: "daily", weekdays: [], label: "매일출발", status: "resolved" };
  }
  const weekdayText = tail.slice(0, departureIndex).trim();
  const matched = /^\s*[([{]?\s*([월화수목금토일](?:\s*[\/·,]\s*[월화수목금토일])*)\s*[)\]}]?\s*$/.exec(weekdayText);
  if (!matched) {
    return { mode: "unknown", weekdays: [], label: "출발요일 확인 필요", status: "review_required" };
  }
  const weekdays = [...new Set(matched[1].match(/[월화수목금토일]/g) || [])];
  if (!weekdays.length) {
    return { mode: "unknown", weekdays: [], label: "출발요일 확인 필요", status: "review_required" };
  }
  return {
    mode: "weekday",
    weekdays,
    label: `${weekdays.join("/")}출발`,
    status: "resolved"
  };
}

function getGolfScheduleDayLines(item = {}) {
  const points = Array.isArray(item?.points) ? item.points.map(text).filter(Boolean) : [];
  if (points.length) return [...new Set(points)];
  const content = text(item?.content);
  if (content) return [...new Set(content.split(/\s*,\s*|\s*\n\s*/).map(text).filter(Boolean))];
  const rawText = text(item?.rawText);
  return rawText ? [rawText] : [];
}

function analyzeGolfHoleLine(value = "") {
  const source = text(value).normalize("NFKC");
  const holes = [...source.matchAll(/(\d+)\s*(?:홀|H\b)/gi)]
    .map((match) => Number(match[1]))
    .filter((number) => Number.isFinite(number) && number > 0 && number <= 144);
  if (!holes.length) return null;
  if (/또는/.test(source) || /주중[\s\S]*\/[\s\S]*주말|주말[\s\S]*\/[\s\S]*주중/.test(source)) {
    return { minHoles: Math.min(...holes), maxHoles: Math.max(...holes), condition: "alternative" };
  }
  if (/보너스/.test(source)) {
    return { minHoles: holes[0], maxHoles: holes.reduce((sum, number) => sum + number, 0), condition: "optional_bonus" };
  }
  const total = holes.reduce((sum, number) => sum + number, 0);
  return { minHoles: total, maxHoles: total, condition: "fixed" };
}

function buildGolfSummaryFromSchedule(schedule = []) {
  const dayBreakdown = [];
  (Array.isArray(schedule) ? schedule : []).forEach((item, index) => {
    const lines = getGolfScheduleDayLines(item);
    const golfLines = lines.filter((line) => {
      if (/라운드|라운딩|\d+\s*(?:홀|H\b)/i.test(line)) return true;
      return /골프/i.test(line) && !/이동|출발|도착|중\s*한\s*곳/.test(line);
    });
    if (!golfLines.length) return;
    const uniqueLines = [...new Set(golfLines.map((line) => text(line).normalize("NFKC").replace(/\s+/g, " ")))];
    const analyses = uniqueLines.map(analyzeGolfHoleLine).filter(Boolean);
    const resolved = analyses.length > 0;
    dayBreakdown.push({
      day: index + 1,
      minHoles: resolved ? analyses.reduce((sum, item) => sum + item.minHoles, 0) : 0,
      maxHoles: resolved ? analyses.reduce((sum, item) => sum + item.maxHoles, 0) : 0,
      status: resolved ? "resolved" : "review_required",
      conditions: [...new Set(analyses.map((item) => item.condition).filter((condition) => condition !== "fixed"))]
    });
  });
  const golfDays = dayBreakdown.length;
  if (!golfDays) {
    return {
      golfDays: 0,
      minTotalHoles: 0,
      maxTotalHoles: 0,
      label: "",
      status: "empty",
      dayBreakdown: []
    };
  }
  const unresolved = dayBreakdown.some((item) => item.status !== "resolved");
  const minTotalHoles = dayBreakdown.reduce((sum, item) => sum + item.minHoles, 0);
  const maxTotalHoles = dayBreakdown.reduce((sum, item) => sum + item.maxHoles, 0);
  const holeLabel = unresolved
    ? "총 홀수 확인 필요"
    : minTotalHoles === maxTotalHoles
      ? `총 ${minTotalHoles}홀`
      : `총 ${minTotalHoles}~${maxTotalHoles}홀`;
  return {
    golfDays,
    minTotalHoles,
    maxTotalHoles,
    label: `골프 ${golfDays}일 · ${holeLabel}`,
    status: unresolved ? "review_required" : "resolved",
    dayBreakdown
  };
}

function inferPackType(product = {}) {
  const source = [
    product.packType,
    product.pack,
    product.productType,
    product.goodsType,
    product.goodDetailCdNm,
    product.title
  ].map(text).join(" ").toLowerCase();
  if (/항공팩|air\s*pack|airpack/.test(source)) return "air";
  if (/골프팩|golf\s*pack|golfpack/.test(source)) return "golf";
  return "golf";
}

function isAvailableProductEvent(product = {}, today = "") {
  const departureDate = text(product.departureDate);
  if (today && departureDate && departureDate < today) return false;
  const status = text(product.status).toLowerCase();
  return !/(마감|종료|판매중지|취소|closed|cancel)/.test(status);
}

function getProductRank(product = {}) {
  const price = Number(product.price || product.productPrice || product.lowestPrice || 0);
  const validPrice = Number.isFinite(price) && price > 0 ? price : Number.MAX_SAFE_INTEGER;
  return [
    validPrice,
    text(product.departureDate || product.earliestDepartureDate) || "9999-12-31",
    text(product.eventSeq || product.representativeEventSeq) || "999999999999"
  ];
}

function compareRank(left = {}, right = {}) {
  const a = getProductRank(left);
  const b = getProductRank(right);
  return a[0] - b[0] || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]);
}

function buildCandidateKey(product = {}) {
  return [
    product.packType,
    normalizeKeyText(product.country),
    normalizeKeyText(product.region),
    normalizeKeyText(product.baseTitle)
  ].join("|");
}

function buildProductCatalog(items = [], options = {}) {
  const today = text(options.today);
  const grouped = new Map();
  (Array.isArray(items) ? items : []).forEach((source) => {
    const goodSeq = normalizeGoodSeq(source?.goodSeq || source?.erpProductId || source?.productId);
    if (!goodSeq || !isAvailableProductEvent(source, today)) return;
    if (!grouped.has(goodSeq)) grouped.set(goodSeq, []);
    grouped.get(goodSeq).push(source);
  });
  return [...grouped.entries()].map(([goodSeq, events]) => {
    const sortedEvents = events.slice().sort(compareRank);
    const representative = sortedEvents[0] || {};
    const duration = parseDuration(representative);
    const title = text(representative.title || representative.productName || representative.goodName);
    const sourceProductTitle = text(representative.sourceProductTitle || representative.goodName || representative.goodNm || title);
    const inferredDestination = inferDestinationFromTitle(title);
    const product = {
      goodSeq,
      title,
      sourceProductTitle,
      baseTitle: getBaseTitle(title),
      packType: inferPackType(representative),
      country: text(representative.country || representative.countryName || representative.nation || inferredDestination.country),
      region: text(representative.region || representative.tourCity || representative.areaCdNm || inferredDestination.region),
      durationNights: duration.nights,
      durationDays: duration.days,
      durationLabel: duration.label,
      lowestPrice: Number(representative.price || representative.productPrice || 0) || 0,
      earliestDepartureDate: text(representative.departureDate),
      representativeEventSeq: text(representative.eventSeq || representative.erpEventSeq),
      sourceActive: true,
      eventCount: events.length
    };
    product.departurePattern = parseDeparturePatternFromTitle(sourceProductTitle);
    product.golfSummary = buildGolfSummaryFromSchedule(representative.schedule);
    product.candidateKey = buildCandidateKey(product);
    return product;
  }).sort((a, b) => a.goodSeq.localeCompare(b.goodSeq));
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function buildProductMaterialSignature(product = {}) {
  return stableHash({
    goodSeq: normalizeGoodSeq(product.goodSeq),
    candidateKey: text(product.candidateKey),
    durationNights: Number(product.durationNights || 0),
    durationDays: Number(product.durationDays || 0),
    title: text(product.title),
    sourceActive: product.sourceActive !== false
  });
}

function buildAnalysisRevision(catalog = [], sourceRevision = "") {
  const snapshot = (Array.isArray(catalog) ? catalog : []).map((product) => ({
    goodSeq: product.goodSeq,
    candidateKey: product.candidateKey,
    duration: product.durationLabel,
    departurePattern: product.departurePattern?.label || "",
    lowestPrice: product.lowestPrice,
    sourceActive: product.sourceActive
  }));
  return `pfa_${stableHash({ sourceRevision: text(sourceRevision), snapshot }).slice(0, 24)}`;
}

function selectLatestMasterRows(rows = []) {
  const latest = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const familyId = text(row?.familyId);
    if (!familyId) return;
    const current = latest.get(familyId);
    const revision = normalizeRevision(row.configRevision);
    const currentRevision = normalizeRevision(current?.configRevision);
    if (!current || revision > currentRevision || (revision === currentRevision && text(row.updatedAt) >= text(current.updatedAt))) {
      latest.set(familyId, { ...row, configRevision: revision });
    }
  });
  return latest;
}

function hydrateFamilyState(masterRows = [], memberRows = []) {
  const masters = selectLatestMasterRows(masterRows);
  const families = [...masters.values()].map((master) => {
    const configRevision = normalizeRevision(master.configRevision);
    const members = (Array.isArray(memberRows) ? memberRows : [])
      .filter((row) => text(row.familyId) === text(master.familyId) && normalizeRevision(row.configRevision) === configRevision)
      .map((row) => ({ ...row, goodSeq: normalizeGoodSeq(row.goodSeq), configRevision }))
      .filter((row) => row.goodSeq);
    return { ...master, configRevision, members };
  });
  return families.sort((a, b) => text(b.updatedAt).localeCompare(text(a.updatedAt)) || text(a.familyId).localeCompare(text(b.familyId)));
}

function getActiveMembershipMap(families = [], excludedFamilyId = "") {
  const membership = new Map();
  (Array.isArray(families) ? families : []).forEach((family) => {
    if (text(family.familyId) === text(excludedFamilyId) || text(family.status) === FAMILY_STATUS.REVOKED) return;
    (family.members || []).forEach((member) => {
      if (text(member.memberStatus || "active") !== "active") return;
      const goodSeq = normalizeGoodSeq(member.goodSeq);
      if (goodSeq) membership.set(goodSeq, text(family.familyId));
    });
  });
  return membership;
}

function buildCandidateAnalysis(catalog = [], families = []) {
  const membership = getActiveMembershipMap(families);
  const familyMap = new Map((Array.isArray(families) ? families : []).map((family) => [text(family.familyId), family]));
  const groups = new Map();
  (Array.isArray(catalog) ? catalog : []).forEach((product) => {
    const candidateKey = text(product?.candidateKey);
    const goodSeq = normalizeGoodSeq(product?.goodSeq);
    if (!candidateKey || !goodSeq || product?.sourceActive === false || !text(product?.durationLabel)) return;
    if (!groups.has(candidateKey)) groups.set(candidateKey, []);
    groups.get(candidateKey).push(product);
  });
  return [...groups.entries()].map(([candidateKey, products]) => {
    const sortedProducts = products.slice().sort((left, right) => (
      Number(left.durationDays || 0) - Number(right.durationDays || 0)
      || compareRank(left, right)
      || text(left.goodSeq).localeCompare(text(right.goodSeq))
    ));
    const durationKeys = new Set(sortedProducts.map((product) => `${Number(product.durationNights || 0)}|${Number(product.durationDays || 0)}`));
    if (sortedProducts.length < 2 || durationKeys.size < 2) return null;
    const familyIds = [...new Set(sortedProducts.map((product) => membership.get(normalizeGoodSeq(product.goodSeq))).filter(Boolean))];
    const assignedGoodSeqs = sortedProducts
      .filter((product) => membership.has(normalizeGoodSeq(product.goodSeq)))
      .map((product) => normalizeGoodSeq(product.goodSeq));
    const unassignedGoodSeqs = sortedProducts
      .filter((product) => !membership.has(normalizeGoodSeq(product.goodSeq)))
      .map((product) => normalizeGoodSeq(product.goodSeq));
    const hasReviewRequiredFamily = familyIds.some((familyId) => text(familyMap.get(familyId)?.status) === FAMILY_STATUS.REVIEW_REQUIRED);
    const status = hasReviewRequiredFamily
      ? FAMILY_STATUS.REVIEW_REQUIRED
      : familyIds.length && unassignedGoodSeqs.length
        ? "partial"
        : familyIds.length
          ? FAMILY_STATUS.APPROVED
          : "pending";
    return {
      candidateId: `pfc_${stableHash(candidateKey).slice(0, 20)}`,
      candidateKey,
      baseTitle: text(sortedProducts[0]?.baseTitle),
      packType: text(sortedProducts[0]?.packType),
      country: text(sortedProducts[0]?.country),
      region: text(sortedProducts[0]?.region),
      status,
      familyIds,
      assignedGoodSeqs,
      unassignedGoodSeqs,
      products: sortedProducts
    };
  }).filter(Boolean).sort((left, right) => (
    text(left.country).localeCompare(text(right.country), "ko")
    || text(left.region).localeCompare(text(right.region), "ko")
    || text(left.baseTitle).localeCompare(text(right.baseTitle), "ko")
  ));
}

function resolveRepresentativeFromProducts(family = {}, products = []) {
  const activeProducts = (Array.isArray(products) ? products : []).filter((product) => product?.sourceActive !== false);
  const preferredGoodSeq = normalizeGoodSeq(family.preferredGoodSeq);
  if (text(family.representativeMode) === REPRESENTATIVE_MODE.MANUAL
    && preferredGoodSeq
    && activeProducts.some((product) => normalizeGoodSeq(product.goodSeq) === preferredGoodSeq)) {
    return preferredGoodSeq;
  }
  return normalizeGoodSeq(activeProducts.slice().sort(compareRank)[0]?.goodSeq);
}

function analyzeFamilyAgainstCatalog(family = {}, catalog = []) {
  const catalogMap = new Map((Array.isArray(catalog) ? catalog : [])
    .map((product) => [normalizeGoodSeq(product?.goodSeq), product])
    .filter(([goodSeq]) => goodSeq));
  const reasons = new Set();
  const members = (Array.isArray(family.members) ? family.members : []).map((member) => {
    const goodSeq = normalizeGoodSeq(member.goodSeq);
    const product = catalogMap.get(goodSeq);
    if (!product || product.sourceActive === false) {
      if (text(member.memberStatus || "active") === "active") reasons.add("member_source_unavailable");
      return {
        ...member,
        goodSeq,
        sourceActive: false
      };
    }
    const nextSignature = buildProductMaterialSignature(product);
    const previousSignature = text(member.materialSignature);
    if (previousSignature && previousSignature !== nextSignature) reasons.add("member_material_changed");
    if (text(family.candidateKeySnapshot) && text(product.candidateKey) !== text(family.candidateKeySnapshot)) {
      reasons.add("candidate_key_changed");
    }
    return {
      ...member,
      goodSeq,
      durationNights: Number(product.durationNights || 0),
      durationDays: Number(product.durationDays || 0),
      sourceTitleSnapshot: text(product.title),
      materialSignature: nextSignature,
      sourceActive: true
    };
  }).filter((member) => member.goodSeq);
  const activeMembers = members.filter((member) => text(member.memberStatus || "active") === "active" && member.sourceActive !== false);
  const activeProducts = activeMembers.map((member) => catalogMap.get(member.goodSeq)).filter(Boolean);
  if (activeProducts.length < 2) reasons.add("active_members_insufficient");
  const candidateKeys = new Set(activeProducts.map((product) => text(product.candidateKey)).filter(Boolean));
  if (candidateKeys.size > 1) reasons.add("candidate_members_mismatch");
  const durationKeys = new Set(activeProducts.map((product) => `${Number(product.durationNights || 0)}|${Number(product.durationDays || 0)}`));
  if (activeProducts.length >= 2 && durationKeys.size < 2) reasons.add("member_durations_not_distinct");
  const preferredGoodSeq = normalizeGoodSeq(family.preferredGoodSeq);
  if (text(family.representativeMode) === REPRESENTATIVE_MODE.MANUAL
    && (!preferredGoodSeq || !activeProducts.some((product) => normalizeGoodSeq(product.goodSeq) === preferredGoodSeq))) {
    reasons.add("manual_representative_unavailable");
  }
  const resolvedRepresentativeGoodSeq = resolveRepresentativeFromProducts(family, activeProducts);
  return {
    familyId: text(family.familyId),
    reasons: [...reasons],
    requiresReview: reasons.size > 0,
    members,
    activeProducts,
    resolvedRepresentativeGoodSeq
  };
}

function reconcileFamilyWithCatalog(family = {}, catalog = []) {
  if (!text(family.familyId) || text(family.status) === FAMILY_STATUS.REVOKED) {
    return { changed: false, family, reasons: [], requiresReview: false };
  }
  const analysis = analyzeFamilyAgainstCatalog(family, catalog);
  const nextStatus = analysis.requiresReview || text(family.status) === FAMILY_STATUS.REVIEW_REQUIRED
    ? FAMILY_STATUS.REVIEW_REQUIRED
    : FAMILY_STATUS.APPROVED;
  const memberChanged = analysis.members.some((member, index) => {
    const previous = family.members?.[index] || {};
    return normalizeGoodSeq(previous.goodSeq) !== member.goodSeq
      || Number(previous.durationNights || 0) !== Number(member.durationNights || 0)
      || Number(previous.durationDays || 0) !== Number(member.durationDays || 0)
      || text(previous.sourceTitleSnapshot) !== text(member.sourceTitleSnapshot)
      || text(previous.materialSignature) !== text(member.materialSignature)
      || (text(previous.sourceActive).toUpperCase() !== "FALSE") !== (member.sourceActive !== false);
  });
  const changed = memberChanged
    || text(family.status) !== nextStatus
    || normalizeGoodSeq(family.resolvedRepresentativeGoodSeq) !== analysis.resolvedRepresentativeGoodSeq;
  return {
    changed,
    reasons: analysis.reasons,
    requiresReview: analysis.requiresReview,
    family: {
      ...family,
      status: nextStatus,
      resolvedRepresentativeGoodSeq: analysis.resolvedRepresentativeGoodSeq,
      members: analysis.members
    }
  };
}

function createValidationError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = 409;
  Object.assign(error, details);
  return error;
}

function validateFamilyAssignment(input = {}, context = {}) {
  const familyId = text(input.familyId);
  const memberGoodSeqs = [...new Set((Array.isArray(input.memberGoodSeqs) ? input.memberGoodSeqs : [])
    .map(normalizeGoodSeq)
    .filter(Boolean))];
  if (memberGoodSeqs.length < 2) {
    throw createValidationError("상품군에는 서로 다른 ERP 상품이 2개 이상 필요합니다.", "family_members_insufficient");
  }
  const catalog = Array.isArray(context.catalog) ? context.catalog : [];
  const catalogMap = new Map(catalog.map((product) => [normalizeGoodSeq(product.goodSeq), product]));
  const missingGoodSeqs = memberGoodSeqs.filter((goodSeq) => !catalogMap.get(goodSeq)?.sourceActive);
  if (missingGoodSeqs.length) {
    throw createValidationError("현재 상품 데이터에서 확인할 수 없는 ERP 상품이 포함되어 있습니다.", "family_member_missing", { missingGoodSeqs });
  }
  const products = memberGoodSeqs.map((goodSeq) => catalogMap.get(goodSeq));
  const durationKeys = new Set(products.map((product) => `${Number(product.durationNights || 0)}|${Number(product.durationDays || 0)}`));
  if (durationKeys.size < 2 || products.some((product) => !product.durationLabel)) {
    throw createValidationError("여행기간이 서로 다른 상품만 하나의 상품군으로 묶을 수 있습니다.", "family_duration_not_distinct");
  }
  const candidateKeys = new Set(products.map((product) => text(product.candidateKey)).filter(Boolean));
  if (candidateKeys.size !== 1) {
    throw createValidationError("서버 분석 기준이 다른 상품은 같은 상품군으로 승인할 수 없습니다.", "family_candidate_mismatch", {
      candidateKeys: [...candidateKeys]
    });
  }
  const membership = getActiveMembershipMap(context.families, familyId);
  const conflicts = memberGoodSeqs.filter((goodSeq) => membership.has(goodSeq)).map((goodSeq) => ({
    goodSeq,
    familyId: membership.get(goodSeq)
  }));
  if (conflicts.length) {
    throw createValidationError("이미 다른 상품군에 지정된 ERP 상품이 포함되어 있습니다.", "family_member_conflict", { conflicts });
  }
  const representativeMode = text(input.representativeMode) === REPRESENTATIVE_MODE.MANUAL
    ? REPRESENTATIVE_MODE.MANUAL
    : REPRESENTATIVE_MODE.LOWEST_PRICE;
  const preferredGoodSeq = normalizeGoodSeq(input.preferredGoodSeq);
  if (representativeMode === REPRESENTATIVE_MODE.MANUAL && (!preferredGoodSeq || !memberGoodSeqs.includes(preferredGoodSeq))) {
    throw createValidationError("직접 지정한 대표상품은 해당 상품군 구성원이어야 합니다.", "family_representative_invalid");
  }
  return {
    familyId,
    memberGoodSeqs,
    products,
    candidateKeySnapshot: [...candidateKeys][0] || "",
    representativeMode,
    preferredGoodSeq: representativeMode === REPRESENTATIVE_MODE.MANUAL ? preferredGoodSeq : ""
  };
}

function resolveRepresentative(validated = {}) {
  if (validated.representativeMode === REPRESENTATIVE_MODE.MANUAL) return validated.preferredGoodSeq;
  const sorted = (validated.products || []).slice().sort((a, b) => (
    Number(a.lowestPrice || Number.MAX_SAFE_INTEGER) - Number(b.lowestPrice || Number.MAX_SAFE_INTEGER)
    || text(a.earliestDepartureDate || "9999-12-31").localeCompare(text(b.earliestDepartureDate || "9999-12-31"))
    || text(a.goodSeq).localeCompare(text(b.goodSeq))
  ));
  return normalizeGoodSeq(sorted[0]?.goodSeq);
}

function buildPublishedFamilyCatalog(families = [], catalog = [], options = {}) {
  const catalogMap = new Map((Array.isArray(catalog) ? catalog : [])
    .map((product) => [normalizeGoodSeq(product?.goodSeq), product])
    .filter(([goodSeq, product]) => goodSeq && product?.sourceActive !== false));
  const familyIdByGoodSeq = {};
  const diagnostics = [];
  const publishedFamilies = [];

  (Array.isArray(families) ? families : [])
    .filter((family) => text(family?.status) === FAMILY_STATUS.APPROVED)
    .slice()
    .sort((left, right) => text(left.familyId).localeCompare(text(right.familyId)))
    .forEach((family) => {
      const familyId = text(family.familyId);
      const memberGoodSeqs = [...new Set((family.members || [])
        .filter((member) => text(member.memberStatus || "active") === "active"
          && String(member.sourceActive).toUpperCase() !== "FALSE")
        .map((member) => normalizeGoodSeq(member.goodSeq))
        .filter(Boolean))];
      const products = memberGoodSeqs.map((goodSeq) => catalogMap.get(goodSeq)).filter(Boolean);
      const reasons = [];
      if (!familyId) reasons.push("family_id_missing");
      if (products.length !== memberGoodSeqs.length) reasons.push("member_source_unavailable");
      if (products.length < 2) reasons.push("active_members_insufficient");
      const candidateKeys = new Set(products.map((product) => text(product.candidateKey)).filter(Boolean));
      if (candidateKeys.size !== 1) reasons.push("candidate_members_mismatch");
      const durationKeys = new Set(products.map((product) => `${Number(product.durationNights || 0)}|${Number(product.durationDays || 0)}`));
      if (products.length >= 2 && durationKeys.size < 2) reasons.push("member_durations_not_distinct");

      const representativeGoodSeq = resolveRepresentativeFromProducts(family, products);
      if (!representativeGoodSeq || !catalogMap.has(representativeGoodSeq)) reasons.push("representative_unavailable");
      if (reasons.length) {
        diagnostics.push({ familyId, status: "excluded", reasons: [...new Set(reasons)] });
        return;
      }

      const members = products.slice().sort((left, right) => (
        Number(left.durationDays || 0) - Number(right.durationDays || 0)
        || compareRank(left, right)
        || text(left.goodSeq).localeCompare(text(right.goodSeq))
      )).map((product) => ({
        goodSeq: normalizeGoodSeq(product.goodSeq),
        title: text(product.title),
        sourceProductTitle: text(product.sourceProductTitle || product.title),
        durationNights: Number(product.durationNights || 0),
        durationDays: Number(product.durationDays || 0),
        durationLabel: text(product.durationLabel),
        lowestPrice: Number(product.lowestPrice || 0),
        earliestDepartureDate: text(product.earliestDepartureDate),
        representativeEventSeq: text(product.representativeEventSeq),
        eventCount: Number(product.eventCount || 0),
        departurePattern: product.departurePattern || parseDeparturePatternFromTitle(product.sourceProductTitle || product.title),
        golfSummary: product.golfSummary || buildGolfSummaryFromSchedule([])
      }));

      members.forEach((member) => {
        const existingFamilyId = familyIdByGoodSeq[member.goodSeq];
        if (existingFamilyId && existingFamilyId !== familyId) {
          throw createValidationError(
            "An ERP product belongs to more than one approved product family.",
            "family_publish_member_conflict",
            { goodSeq: member.goodSeq, familyIds: [existingFamilyId, familyId] }
          );
        }
        familyIdByGoodSeq[member.goodSeq] = familyId;
      });

      const representative = members.find((member) => member.goodSeq === representativeGoodSeq);
      publishedFamilies.push({
        familyId,
        configRevision: normalizeRevision(family.configRevision),
        candidateKey: text(family.candidateKeySnapshot || candidateKeys.values().next().value),
        representativeMode: text(family.representativeMode) === REPRESENTATIVE_MODE.MANUAL
          ? REPRESENTATIVE_MODE.MANUAL
          : REPRESENTATIVE_MODE.LOWEST_PRICE,
        representativeGoodSeq,
        representative,
        members
      });
    });

  const sourceCatalogRevision = text(options.catalogRevision);
  const analysisRevision = text(options.analysisRevision);
  const revisionSnapshot = publishedFamilies.map((family) => ({
    familyId: family.familyId,
    configRevision: family.configRevision,
    candidateKey: family.candidateKey,
    representativeMode: family.representativeMode,
    representativeGoodSeq: family.representativeGoodSeq,
    members: family.members
  }));
  const publicationRevision = `pfc_${stableHash({ sourceCatalogRevision, analysisRevision, families: revisionSnapshot }).slice(0, 24)}`;

  return {
    schema: "golfjoin-product-family-catalog-v1",
    publicationRevision,
    generatedAt: text(options.generatedAt),
    sourceCatalogRevision,
    analysisRevision,
    familyCount: publishedFamilies.length,
    memberCount: Object.keys(familyIdByGoodSeq).length,
    families: publishedFamilies,
    familyIdByGoodSeq,
    diagnostics
  };
}

function buildProductFamilyManifest(publishedCatalog = {}, storageResult = {}, currentManifest = {}, options = {}) {
  const activePublicationRevision = text(publishedCatalog.publicationRevision);
  if (!/^pfc_[a-f0-9]{24}$/.test(activePublicationRevision)) {
    throw createValidationError(
      "Product family publication revision is invalid.",
      "product_family_manifest_revision_invalid"
    );
  }
  const activeCatalogObjectName = text(storageResult.objectName);
  const activeCatalogUrl = text(storageResult.url);
  if (!activeCatalogObjectName || !activeCatalogUrl) {
    throw createValidationError(
      "Product family catalog storage location is unavailable.",
      "product_family_manifest_storage_invalid"
    );
  }
  const currentActiveRevision = text(currentManifest.activePublicationRevision);
  const previousPublicationRevision = currentActiveRevision && currentActiveRevision !== activePublicationRevision
    ? currentActiveRevision
    : text(currentManifest.previousPublicationRevision);
  return {
    schema: "golfjoin-product-family-manifest-v1",
    activePublicationRevision,
    previousPublicationRevision,
    activeCatalogObjectName,
    activeCatalogUrl,
    sourceCatalogRevision: text(publishedCatalog.sourceCatalogRevision),
    analysisRevision: text(publishedCatalog.analysisRevision),
    familyCount: Number(publishedCatalog.familyCount || 0),
    memberCount: Number(publishedCatalog.memberCount || 0),
    publishedAt: text(options.publishedAt)
  };
}

function createFamilyId() {
  return `pf_${crypto.randomUUID().replace(/-/g, "")}`;
}

module.exports = {
  FAMILY_STATUS,
  REPRESENTATIVE_MODE,
  normalizeGoodSeq,
  normalizeRevision,
  getBaseTitle,
  parseDuration,
  parseDeparturePatternFromTitle,
  analyzeGolfHoleLine,
  buildGolfSummaryFromSchedule,
  buildCandidateKey,
  buildProductCatalog,
  buildProductMaterialSignature,
  buildAnalysisRevision,
  buildCandidateAnalysis,
  hydrateFamilyState,
  getActiveMembershipMap,
  analyzeFamilyAgainstCatalog,
  reconcileFamilyWithCatalog,
  validateFamilyAssignment,
  resolveRepresentative,
  buildPublishedFamilyCatalog,
  buildProductFamilyManifest,
  createFamilyId
};
