"use strict";

const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");

const TARGET_APPLICATION_ID = "nsa_2026-08-20T14-11-51-09-00-seq-30002183";
const TARGET_SCHEDULE_ID = "sch_nsa_2026-08-20T14-11-51-09-00-seq-30002183";
const DEFAULT_ENV_FILE = "/home/llno95ll/golfjoin-sheet-api.env.yaml";

function readArgument(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function readYamlValue(source, name) {
  const match = source.match(new RegExp(`^${name}:\\s*(.*)$`, "m"));
  if (!match) return "";
  const value = match[1].trim();
  if (value.length >= 2 && value[0] === value[value.length - 1] && ["\"", "'"].includes(value[0])) {
    return value.slice(1, -1);
  }
  return value;
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function rowToObject(headers, values) {
  return headers.reduce((object, header, index) => {
    object[header] = values[index] == null ? "" : values[index];
    return object;
  }, {});
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10));
}

function parsePositiveMoney(value) {
  const amount = Number(String(value == null ? "" : value).replace(/[^\d]/g, ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

function getQuoteAccessToken(row = {}) {
  const candidates = [row.quotePageUrl, row.quoteUrl, row.quotePdfUrl];
  for (const candidate of candidates) {
    try {
      const token = new URL(String(candidate || "")).searchParams.get("token") || "";
      if (/^[A-Za-z0-9_-]{40,100}$/.test(token)) return token;
    } catch (error) {
      // Try the next stored quote URL.
    }
  }
  return "";
}

function decryptQuoteBuffer(buffer, accessToken) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  const magic = Buffer.from("GJQ1", "ascii");
  const headerLength = magic.length + 12 + 16;
  if (source.length <= headerLength || !source.subarray(0, magic.length).equals(magic)) {
    throw new Error("Stored quote JSON is not a Golfjoin encrypted quote file.");
  }
  const ivStart = magic.length;
  const tagStart = ivStart + 12;
  const encryptedStart = tagStart + 16;
  const key = crypto.createHash("sha256").update(String(accessToken), "utf8").digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, source.subarray(ivStart, tagStart));
  decipher.setAuthTag(source.subarray(tagStart, encryptedStart));
  return Buffer.concat([decipher.update(source.subarray(encryptedStart)), decipher.final()]);
}

function readVerifiedQuoteUnitPrice(row, envSource) {
  const explicitUnitPrice = parsePositiveMoney(readArgument("--quote-unit-price", ""));
  if (explicitUnitPrice) {
    return { unitPrice: explicitUnitPrice, source: "explicit_cli" };
  }

  const objectName = String(row.quoteDataFileName || "").trim();
  const quoteId = String(row.quoteId || "").trim();
  const accessToken = getQuoteAccessToken(row);
  const bucketName = readYamlValue(envSource, "GOLFJOIN_PRODUCTS_BUCKET") || "golfjoin-bucket";
  if (!objectName || !/^quotes\/.+\/quote_[A-Za-z0-9_-]+\.json$/.test(objectName)) {
    throw new Error("Stored quote JSON object name could not be recovered. Re-run with --quote-unit-price=<verified amount>.");
  }
  if (!quoteId || !accessToken) {
    throw new Error("Stored quote access information could not be recovered. Re-run with --quote-unit-price=<verified amount>.");
  }

  let encrypted;
  try {
    console.error("[4/5] 암호화 견적 원본을 GCS에서 확인하고 있습니다...");
    encrypted = execFileSync("gcloud", ["storage", "cat", `gs://${bucketName}/${objectName}`], {
      encoding: null,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 30_000
    });
  } catch (error) {
    throw new Error(`Stored quote JSON download failed: ${error.message || error}`);
  }

  let quote;
  try {
    quote = JSON.parse(decryptQuoteBuffer(encrypted, accessToken).toString("utf8"));
  } catch (error) {
    throw new Error(`Stored quote JSON verification failed: ${error.message || error}`);
  }
  if (!quote || String(quote.quoteId || "") !== quoteId) {
    throw new Error("Stored quote JSON quoteId does not match the recovered sheet row.");
  }
  const unitPrice = parsePositiveMoney(quote.unitPrice);
  if (!unitPrice) throw new Error("Stored quote JSON has no valid unitPrice.");
  return { unitPrice, source: "encrypted_quote_json", quoteId, objectName };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const envFile = readArgument("--env-file", DEFAULT_ENV_FILE);
  const envSource = fs.readFileSync(envFile, "utf8");
  const spreadsheetId = readYamlValue(envSource, "GOOGLE_SHEET_ID");
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is not configured.");

  console.error("[1/5] Cloud Shell 인증과 프로젝트를 확인하고 있습니다...");
  const quotaProject = readArgument("--quota-project", "")
    || execFileSync("gcloud", ["config", "get-value", "project"], { encoding: "utf8", timeout: 20_000 }).trim();
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(quotaProject)) {
    throw new Error("A valid Google Cloud quota project is required. Use --quota-project=golfjoin-499602.");
  }

  const accessToken = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8", timeout: 20_000 }).trim();
  if (!accessToken) throw new Error("Google access token is empty.");
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Goog-User-Project": quotaProject
  };

  async function sheetsRequest(path, options = {}) {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}${path}`, {
      ...options,
      signal: AbortSignal.timeout(30_000),
      headers: { ...headers, ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `Sheets API ${response.status}`);
    return body;
  }

  async function readValues(rangeText) {
    const range = encodeURIComponent(rangeText);
    const result = await sheetsRequest(`/values/${range}?majorDimension=ROWS`);
    return Array.isArray(result.values) ? result.values : [];
  }

  async function readSheetHeaders(sheetName) {
    const values = await readValues(`${sheetName}!A1:ZZ1`);
    return values[0] || [];
  }

  async function findRowNumbers(sheetName, headers, keyHeader, keyValue) {
    const keyIndex = headers.indexOf(keyHeader);
    if (keyIndex < 0) throw new Error(`${sheetName} has no ${keyHeader} header.`);
    const keyColumn = columnName(keyIndex);
    const values = await readValues(`${sheetName}!${keyColumn}2:${keyColumn}`);
    const matches = [];
    values.forEach((row, index) => {
      if (String(row?.[0] || "") === String(keyValue)) matches.push(index + 2);
    });
    return matches;
  }

  async function readExactRow(sheetName, headers, rowNumber) {
    const endColumn = columnName(Math.max(0, headers.length - 1));
    const values = await readValues(`${sheetName}!A${rowNumber}:${endColumn}${rowNumber}`);
    return values[0] || [];
  }

  async function writeRow(sheetName, rowNumber, values) {
    const endColumn = columnName(values.length - 1);
    const range = encodeURIComponent(`${sheetName}!A${rowNumber}:${endColumn}${rowNumber}`);
    return sheetsRequest(`/values/${range}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [values] })
    });
  }

  const scheduleSheetName = "new_schedule_applications";
  console.error("[2/5] 생성 일정의 대상 행 1건을 찾고 있습니다...");
  const originalHeaders = await readSheetHeaders(scheduleSheetName);
  const scheduleIndex = originalHeaders.indexOf("scheduleId");
  if (scheduleIndex < 0) throw new Error("new_schedule_applications has no scheduleId header.");
  const candidateScheduleRows = await findRowNumbers(
    scheduleSheetName,
    originalHeaders,
    "applicationId",
    TARGET_APPLICATION_ID
  );
  let targetRowNumber = 0;
  let originalValues = [];
  for (const rowNumber of candidateScheduleRows) {
    const values = await readExactRow(scheduleSheetName, originalHeaders, rowNumber);
    if (String(values[scheduleIndex] || "") === TARGET_SCHEDULE_ID) {
      targetRowNumber = rowNumber;
      originalValues = values;
      break;
    }
  }
  if (!targetRowNumber) throw new Error("Target test schedule row was not found.");

  const currentRow = rowToObject(originalHeaders, originalValues);
  const looksCorrupted = !currentRow.productName
    && /^\d+$/.test(String(currentRow.productPrice || ""))
    && /^\d+$/.test(String(currentRow.packType || ""))
    && !isIsoDate(currentRow.departureDateFrom)
    && isIsoDate(currentRow.departureDateTo);
  const alreadyRepaired = Boolean(
    currentRow.productName
    && isIsoDate(currentRow.departureDateFrom)
    && isIsoDate(currentRow.returnDateTo)
    && Number(currentRow.quoteUnitPrice) > 0
  );
  if (alreadyRepaired) {
    console.log(JSON.stringify({ ok: true, unchanged: true, reason: "already_repaired", scheduleId: TARGET_SCHEDULE_ID }, null, 2));
    return;
  }
  if (!looksCorrupted) throw new Error("Target row does not match the guarded corruption signature; no changes were made.");

  console.error("[3/5] 연결된 참여 신청의 대상 행만 찾고 있습니다...");
  const joinHeaders = await readSheetHeaders("join_applications");
  const candidateJoinRows = await findRowNumbers(
    "join_applications",
    joinHeaders,
    "targetScheduleId",
    TARGET_SCHEDULE_ID
  );
  let canonicalJoinRow = null;
  for (const rowNumber of candidateJoinRows) {
    const row = rowToObject(joinHeaders, await readExactRow("join_applications", joinHeaders, rowNumber));
    if (String(row.productName || "").trim() && isIsoDate(row.departureDate) && isIsoDate(row.returnDate)) {
      canonicalJoinRow = row;
      break;
    }
  }
  if (!canonicalJoinRow) throw new Error("A canonical linked join application was not found; no changes were made.");

  const productFamilyIndex = originalHeaders.indexOf("productFamilyId");
  const productNameIndex = originalHeaders.indexOf("productName");
  if (productFamilyIndex <= productNameIndex) {
    throw new Error("The sheet no longer has the guarded legacy/appended header order; no changes were made.");
  }
  const contractHeaders = [...originalHeaders];
  contractHeaders.splice(productFamilyIndex, 1);
  contractHeaders.splice(productNameIndex, 0, "productFamilyId");
  const recoveredRow = rowToObject(contractHeaders, originalValues);
  const verifiedQuote = readVerifiedQuoteUnitPrice(recoveredRow, envSource);
  const quoteUnitPrice = verifiedQuote.unitPrice;
  const originalProductPrice = parsePositiveMoney(recoveredRow.productPrice);
  if (!originalProductPrice) throw new Error("Original product price recovery guard failed; no changes were made.");

  Object.assign(recoveredRow, {
    productName: String(canonicalJoinRow.productName).trim(),
    productPrice: String(originalProductPrice),
    departureDateFrom: String(canonicalJoinRow.departureDate).slice(0, 10),
    departureDateTo: String(canonicalJoinRow.departureDate).slice(0, 10),
    returnDateFrom: String(canonicalJoinRow.returnDate).slice(0, 10),
    returnDateTo: String(canonicalJoinRow.returnDate).slice(0, 10),
    participantStatus: "견적완료",
    quoteStatus: "sent",
    quoteUnitPrice: String(quoteUnitPrice),
    updatedAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("Z", "+09:00")
  });

  const nextHeaders = originalHeaders.includes("quoteUnitPrice")
    ? originalHeaders
    : [...originalHeaders, "quoteUnitPrice"];
  const nextValues = nextHeaders.map((header) => recoveredRow[header] == null ? "" : recoveredRow[header]);
  const summary = {
    ok: true,
    dryRun: !apply,
    applicationId: TARGET_APPLICATION_ID,
    scheduleId: TARGET_SCHEDULE_ID,
    productName: recoveredRow.productName,
    productPrice: recoveredRow.productPrice,
    quoteUnitPrice: recoveredRow.quoteUnitPrice,
    departureDate: recoveredRow.departureDateFrom,
    returnDate: recoveredRow.returnDateTo,
    participantStatus: recoveredRow.participantStatus,
    quoteStatus: recoveredRow.quoteStatus,
    quoteUnitPriceSource: verifiedQuote.source,
    quoteDataFileName: verifiedQuote.objectName || recoveredRow.quoteDataFileName || "",
    quoteMetadataPreserved: Boolean(recoveredRow.quoteId && recoveredRow.quoteNo && (recoveredRow.quotePageUrl || recoveredRow.quoteUrl))
  };
  console.error("[5/5] 복구 후보 검증을 완료했습니다.");
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log("Dry run only. Re-run with --apply after reviewing the values above.");
    return;
  }

  if (nextHeaders.length !== originalHeaders.length) {
    await writeRow(scheduleSheetName, 1, nextHeaders);
  }
  await writeRow(scheduleSheetName, targetRowNumber, nextValues);

  const summarySheetName = "schedule_participant_summary";
  const participantHeaders = await readSheetHeaders(summarySheetName);
  const participantRowNumbers = await findRowNumbers(
    summarySheetName,
    participantHeaders,
    "scheduleId",
    TARGET_SCHEDULE_ID
  );
  const participantRowNumber = participantRowNumbers[0] || 0;
  if (participantRowNumber) {
    const participantRow = rowToObject(
      participantHeaders,
      await readExactRow(summarySheetName, participantHeaders, participantRowNumber)
    );
    Object.assign(participantRow, {
      title: recoveredRow.productName,
      departureSummary: recoveredRow.departureDateFrom,
      returnSummary: recoveredRow.returnDateTo,
      tripSummary: recoveredRow.tripSummary,
      updatedAt: recoveredRow.updatedAt
    });
    await writeRow(summarySheetName, participantRowNumber, participantHeaders.map((header) => participantRow[header] == null ? "" : participantRow[header]));
  }
  console.log("Target schedule row and participant summary were repaired.");
}

main().catch((error) => {
  console.error(`Repair failed: ${error.message || error}`);
  process.exitCode = 1;
});
