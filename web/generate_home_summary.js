const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "golfjoin_local_data.json");
const outputPath = path.join(__dirname, "golfjoin_home_summary.json");
const prettyOutputPath = path.join(__dirname, "golfjoin_home_summary.pretty.json");
const homeCardsOutputPath = path.join(__dirname, "golfjoin_home_cards.json");
const homeCardsPrettyOutputPath = path.join(__dirname, "golfjoin_home_cards.pretty.json");
const today = new Date();
const defaultStart = new Date(today);
defaultStart.setDate(defaultStart.getDate() + 7);
const positionalArgs = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const startDate = positionalArgs[0] || defaultStart.toISOString().slice(0, 10);
const rangeDays = Number(positionalArgs[1] || 240);
const writePretty = process.argv.includes("--pretty");
const cardsFromSummary = process.argv.includes("--cards-from-summary");
const homeCardsStartDate = String(
  process.argv.find((value) => value.startsWith("--cards-start="))?.split("=")[1]
  || defaultStart.toISOString().slice(0, 10)
);
const HOME_CARD_PRODUCT_DATE_LIMIT = 4;
const HOME_CARD_PRODUCT_DATE_GAP_DAYS = 7;
const end = new Date(`${startDate}T00:00:00`);
end.setDate(end.getDate() + Math.max(1, rangeDays));
const endDate = end.toISOString().slice(0, 10);

const keptFields = [
  "id",
  "source",
  "goodSeq",
  "eventSeq",
  "basePriceSeq",
  "title",
  "country",
  "countryName",
  "nation",
  "productCountry",
  "erpCountry",
  "region",
  "category",
  "departureDate",
  "returnDate",
  "date",
  "dayCnt",
  "dayNight",
  "duration",
  "dayNightCnt",
  "price",
  "airport",
  "departureAirport",
  "arrivalAirport",
  "airline",
  "badge",
  "badgeKind",
  "status",
  "priceDesc",
  "groupCd",
  "image",
  "emptySlots",
  "productType",
  "goodsType",
  "goodDetailCdNm",
  "airProductYn",
  "air2Cd",
  "air2CdNm",
  "air2Nm"
];

function compactItem(item) {
  return Object.fromEntries(
    keptFields
      .map((key) => [key, item[key]])
      .filter(([, value]) => value !== undefined && value !== "" && !(Array.isArray(value) && !value.length))
  );
}

function normalizePublicImageUrl(value = "") {
  const image = String(value || "").trim();
  if (!image) return "";
  if (image.startsWith("//")) return `https:${image}`;
  if (/^https?:\/\//i.test(image)) return image;
  return `https://www.secret-tour.com${image.startsWith("/") ? image : `/${image}`}`;
}

function collectDisplayRuleProductReferences(value, references = new Set(), parentKey = "") {
  if (Array.isArray(value)) {
    value.forEach((item) => collectDisplayRuleProductReferences(item, references, parentKey));
    return references;
  }
  if (!value || typeof value !== "object") return references;
  Object.entries(value).forEach(([key, item]) => {
    if (item && typeof item === "object") {
      collectDisplayRuleProductReferences(item, references, key);
      return;
    }
    if (!/(?:good|event|product|schedule)(?:seq|id|key)/i.test(key || parentKey)) return;
    const normalized = String(item || "").trim();
    if (normalized) references.add(normalized);
  });
  return references;
}

function buildHomeCardItems(items = [], displayRules = [], minDepartureDate = "") {
  const sortedItems = items.filter((item) => (
    !item.departureDate || !minDepartureDate || item.departureDate >= minDepartureDate
  )).sort((a, b) => {
    const dateCompare = String(a.departureDate || "9999-12-31").localeCompare(String(b.departureDate || "9999-12-31"));
    if (dateCompare) return dateCompare;
    return (Number(a.price) || Number.MAX_SAFE_INTEGER) - (Number(b.price) || Number.MAX_SAFE_INTEGER);
  });
  const productGroups = new Map();
  sortedItems.forEach((item, index) => {
    const key = String(item.goodSeq || item.productId || item.id || `item-${index}`).trim();
    if (!productGroups.has(key)) productGroups.set(key, []);
    productGroups.get(key).push(item);
  });
  const representatives = [...productGroups.values()].flatMap((groupItems) => {
    const selected = [];
    const selectedDates = new Set();
    let lastSelectedTime = NaN;
    groupItems.forEach((item) => {
      if (selected.length >= HOME_CARD_PRODUCT_DATE_LIMIT) return;
      const departureDate = String(item.departureDate || "").trim();
      if (!departureDate || selectedDates.has(departureDate)) return;
      const departureTime = new Date(`${departureDate}T00:00:00Z`).getTime();
      const hasEnoughGap = !Number.isFinite(lastSelectedTime)
        || !Number.isFinite(departureTime)
        || departureTime - lastSelectedTime >= HOME_CARD_PRODUCT_DATE_GAP_DAYS * 24 * 60 * 60 * 1000;
      if (!hasEnoughGap) return;
      selected.push(item);
      selectedDates.add(departureDate);
      lastSelectedTime = departureTime;
    });
    if (!selected.length && groupItems[0]) selected.push(groupItems[0]);
    return selected;
  });

  const referencedValues = collectDisplayRuleProductReferences(displayRules);
  const referencedItems = sortedItems.filter((item) => [
    item.id,
    item.eventSeq,
    item.scheduleId
  ].some((value) => referencedValues.has(String(value || "").trim())));

  const result = new Map();
  [...representatives, ...referencedItems].forEach((item) => {
    const key = [item.id, item.goodSeq, item.eventSeq].filter(Boolean).join(":");
    if (key) result.set(key, item);
  });
  return [...result.values()];
}

const knownCountries = [
  "라오스", "말레이시아", "미얀마", "베트남", "브루나이", "인도네시아", "태국", "필리핀",
  "일본", "중국", "대만", "괌", "사이판", "제주", "한국"
];
const countryAliases = {
  "말레이지아": "말레이시아"
};
const regionCountryMap = {
  "조호바루": "말레이시아",
  "코타키나발루": "말레이시아"
};

function inferCountryFromRegion(...regions) {
  for (const region of regions.map((value) => String(value || "").trim()).filter(Boolean)) {
    const key = region.split(",").map((part) => part.trim()).filter(Boolean)[0] || region;
    const country = regionCountryMap[key];
    if (country) return country;
  }
  return "";
}

function normalizeRegionKeyword(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[(),·/]/g, "").toLowerCase();
}

function parseSecretTourTitleDestination(...titles) {
  for (const title of titles.map((value) => String(value || "").trim()).filter(Boolean)) {
    const normalized = title
      .replace(/^\[[^\]]+\]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    const parts = normalized.split(" ").filter(Boolean);
    const countryIndex = parts.findIndex((part) => knownCountries.includes(part) || countryAliases[part]);
    if (countryIndex < 0) continue;
    const country = countryAliases[parts[countryIndex]] || parts[countryIndex];
    return {
      country,
      region: String(parts[countryIndex + 1] || "").trim().replace(/[()[\],]/g, "")
    };
  }
  return { country: "", region: "" };
}

function inferCountry(item = {}, regionName = "") {
  const direct = [item.country, item.countryName, item.nation, item.productCountry, item.erpCountry]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  if (direct) return direct;
  const parsed = parseSecretTourTitleDestination(item.title, item.productName, item.goodName);
  if (parsed.country) return parsed.country;
  const regionCountry = inferCountryFromRegion(regionName, item.region, item.city, item.area, item.location);
  if (regionCountry) return regionCountry;
  const regionKey = normalizeRegionKeyword(regionName);
  const haystack = [item.title, item.productName, item.goodName, item.region, item.location]
    .map((value) => String(value || ""))
    .join(" ");
  return knownCountries.find((country) => haystack.includes(country) && normalizeRegionKeyword(country) !== regionKey) || "";
}

function buildDestinationSummary(items = []) {
  const countries = new Map();
  items.forEach((item) => {
    const parsed = parseSecretTourTitleDestination(item.title, item.productName, item.goodName);
    const regionName = String(parsed.region || item.region || item.city || item.area || item.location || "").split(",")[0]?.trim() || "";
    const countryName = inferCountry(item, regionName);
    if (!regionName && !countryName) return;
    const countryDisplay = countryName || regionName;
    const countryKey = normalizeRegionKeyword(countryDisplay);
    if (!countryKey) return;
    if (!countries.has(countryKey)) {
      countries.set(countryKey, {
        name: countryDisplay,
        category: item.category || "",
        count: 0,
        earliestDepartureDate: "",
        regions: new Map()
      });
    }
    const country = countries.get(countryKey);
    country.count += 1;
    if (item.departureDate && (!country.earliestDepartureDate || item.departureDate < country.earliestDepartureDate)) {
      country.earliestDepartureDate = item.departureDate;
    }
    if (regionName && normalizeRegionKeyword(regionName) !== countryKey) {
      const regionKey = normalizeRegionKeyword(regionName);
      if (!country.regions.has(regionKey)) {
        country.regions.set(regionKey, { name: regionName, count: 0, earliestDepartureDate: "" });
      }
      const region = country.regions.get(regionKey);
      region.count += 1;
      if (item.departureDate && (!region.earliestDepartureDate || item.departureDate < region.earliestDepartureDate)) {
        region.earliestDepartureDate = item.departureDate;
      }
    }
  });
  return {
    countries: [...countries.values()].map((country) => ({
      name: country.name,
      category: country.category,
      count: country.count,
      earliestDepartureDate: country.earliestDepartureDate,
      regions: [...country.regions.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"))
    })).sort((a, b) => a.name.localeCompare(b.name, "ko"))
  };
}

const source = JSON.parse(fs.readFileSync(cardsFromSummary ? outputPath : inputPath, "utf8"));
const sourceItems = Array.isArray(source.items) ? source.items : [];
const productMetaByGoodSeq = source.productMetaByGoodSeq || {};
const compactAndEnrichItem = (item) => {
  const compact = compactItem(item);
  const goodSeq = String(item.goodSeq || item.erpProductId || "").trim();
  const savedImage = normalizePublicImageUrl(productMetaByGoodSeq?.[goodSeq]?.image);
  if (!compact.image && savedImage) compact.image = savedImage;
  return compact;
};
const items = cardsFromSummary
  ? sourceItems.map(compactAndEnrichItem)
  : sourceItems
    .filter((item) => !item.departureDate || (item.departureDate >= startDate && item.departureDate <= endDate))
    .map(compactAndEnrichItem);

const payload = cardsFromSummary ? source : {
  schema: "secret-golf-join-home-summary-v1",
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: source.generatedAt || "",
  range: { startDate, endDate },
  sourceCount: sourceItems.length,
  count: items.length,
  items,
  ...(Object.keys(productMetaByGoodSeq).length ? { productMetaByGoodSeq } : {}),
  destinations: buildDestinationSummary(items)
};

const homeCardItems = buildHomeCardItems(items, payload.homeBootstrapLight?.displayRules || [], homeCardsStartDate);
const homeCardImageCount = homeCardItems.filter((item) => String(item.image || "").trim()).length;
const homeCardsPayload = {
  schema: "secret-golf-join-home-cards-v1",
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: payload.generatedAt || payload.sourceGeneratedAt || "",
  range: { ...payload.range, startDate: homeCardsStartDate },
  sourceCount: payload.count,
  count: homeCardItems.length,
  items: homeCardItems,
  destinations: payload.destinations,
  ...(payload.productMetaByGoodSeq ? { productMetaByGoodSeq: payload.productMetaByGoodSeq } : {}),
  ...(payload.homeBootstrapLight ? { homeBootstrapLight: payload.homeBootstrapLight } : {})
};

if (!cardsFromSummary) fs.writeFileSync(outputPath, JSON.stringify(payload));
fs.writeFileSync(homeCardsOutputPath, JSON.stringify(homeCardsPayload));
if (writePretty) {
  fs.writeFileSync(prettyOutputPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(homeCardsPrettyOutputPath, `${JSON.stringify(homeCardsPayload, null, 2)}\n`);
}
console.log(JSON.stringify({
  output: path.relative(process.cwd(), outputPath),
  homeCardsOutput: path.relative(process.cwd(), homeCardsOutputPath),
  prettyOutput: writePretty ? path.relative(process.cwd(), prettyOutputPath) : "",
  sourceCount: sourceItems.length,
  count: items.length,
  bytes: fs.statSync(outputPath).size,
  homeCardsCount: homeCardItems.length,
  homeCardsImageCount: homeCardImageCount,
  homeCardsBytes: fs.statSync(homeCardsOutputPath).size,
  range: payload.range
}, null, 2));
