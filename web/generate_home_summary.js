const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "golfjoin_local_data.json");
const outputPath = path.join(__dirname, "golfjoin_home_summary.json");
const prettyOutputPath = path.join(__dirname, "golfjoin_home_summary.pretty.json");
const today = new Date();
const startDate = process.argv[2] || today.toISOString().slice(0, 10);
const rangeDays = Number(process.argv[3] || 240);
const writePretty = process.argv.includes("--pretty");
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

const knownCountries = [
  "라오스", "말레이시아", "미얀마", "베트남", "브루나이", "인도네시아", "태국", "필리핀",
  "일본", "중국", "대만", "괌", "사이판", "제주"
];

function normalizeRegionKeyword(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[(),·/]/g, "").toLowerCase();
}

function inferCountry(item = {}, regionName = "") {
  const direct = [item.country, item.countryName, item.nation, item.productCountry, item.erpCountry]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  if (direct) return direct;
  const regionKey = normalizeRegionKeyword(regionName);
  const haystack = [item.title, item.productName, item.goodName, item.region, item.location]
    .map((value) => String(value || ""))
    .join(" ");
  return knownCountries.find((country) => haystack.includes(country) && normalizeRegionKeyword(country) !== regionKey) || "";
}

function buildDestinationSummary(items = []) {
  const countries = new Map();
  items.forEach((item) => {
    const regionName = String(item.region || item.city || item.area || item.location || "").split(",")[0]?.trim() || "";
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

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const sourceItems = Array.isArray(source.items) ? source.items : [];
const items = sourceItems
  .filter((item) => !item.departureDate || (item.departureDate >= startDate && item.departureDate <= endDate))
  .map(compactItem);

const payload = {
  schema: "secret-golf-join-home-summary-v1",
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: source.generatedAt || "",
  range: { startDate, endDate },
  sourceCount: sourceItems.length,
  count: items.length,
  items,
  destinations: buildDestinationSummary(items)
};

fs.writeFileSync(outputPath, JSON.stringify(payload));
if (writePretty) {
  fs.writeFileSync(prettyOutputPath, `${JSON.stringify(payload, null, 2)}\n`);
}
console.log(JSON.stringify({
  output: path.relative(process.cwd(), outputPath),
  prettyOutput: writePretty ? path.relative(process.cwd(), prettyOutputPath) : "",
  sourceCount: sourceItems.length,
  count: items.length,
  bytes: fs.statSync(outputPath).size,
  range: payload.range
}, null, 2));
