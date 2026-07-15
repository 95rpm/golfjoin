const SHEET_NAMES = {
  NEW_SCHEDULE_APPLICATIONS: "new_schedule_applications",
  JOIN_APPLICATIONS: "join_applications",
  JOIN_MEMBER_PROFILES: "join_member_profiles",
  JOIN_REVIEWS: "join_reviews",
  JOIN_WISHES: "join_wishes",
  SCHEDULE_PARTICIPANT_SUMMARY: "schedule_participant_summary",
  PRODUCT_DISPLAY_RULES: "recommended_schedules"
};

const LEGACY_SHEET_NAMES = {
  [SHEET_NAMES.PRODUCT_DISPLAY_RULES]: ["product_display_rules"]
};

const SHEET_HEADERS = {
  [SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS]: [
    "applicationId",
    "scheduleId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberChannel",
    "memberMobile",
    "memberEmail",
    "applicantName",
    "applicantGender",
    "applicantBirthYear",
    "applicantAgeBand",
    "applicantMobile",
    "applicantProfession",
    "applicantPeople",
    "applicantCompanions",
    "applicantLevel",
    "applicantStyles",
    "applicantPreferredMembers",
    "applicantGreeting",
    "applicantRoomType",
    "flightRequestType",
    "singleRoomSurcharge",
    "singleRoomSurchargeText",
    "singleRoomSurchargeStatus",
    "country",
    "region",
    "airline",
    "departureAirport",
    "arrivalAirport",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "productPrice",
    "packType",
    "packTypeName",
    "tripSummary",
    "departureDateFrom",
    "departureDateTo",
    "returnDateFrom",
    "returnDateTo",
    "participantStatus",
    "quoteStatus",
    "depositStatus",
    "balanceStatus",
    "refundStatus",
    "requiredAgreed",
    "marketingAgreed",
    "approvalStatus",
    "displayStatus",
    "applicationStatus",
    "adminMemo",
    "updatedAt",
    "memberKey",
    "kakaoId",
    "quoteId",
    "quoteNo",
    "quoteUrl",
    "quotePageUrl",
    "quotePdfUrl",
    "quoteFileName",
    "quoteGeneratedAt"
  ],
  [SHEET_NAMES.JOIN_APPLICATIONS]: [
    "applicationId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberChannel",
    "memberMobile",
    "memberEmail",
    "targetType",
    "targetScheduleId",
    "targetApplicationId",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "departureDate",
    "returnDate",
    "category",
    "country",
    "region",
    "airline",
    "departureAirport",
    "arrivalAirport",
    "applicantName",
    "applicantGender",
    "applicantBirthYear",
    "applicantAgeBand",
    "applicantMobile",
    "applicantProfession",
    "applicantPeople",
    "applicantCompanions",
    "applicantLevel",
    "applicantStyles",
    "applicantPreferredMembers",
    "applicantGreeting",
    "applicantRoomType",
    "flightRequestType",
    "singleRoomSurcharge",
    "singleRoomSurchargeText",
    "singleRoomSurchargeStatus",
    "participantStatus",
    "quoteStatus",
    "depositStatus",
    "balanceStatus",
    "refundStatus",
    "applicationStatus",
    "requiredAgreed",
    "marketingAgreed",
    "adminMemo",
    "updatedAt",
    "memberKey",
    "kakaoId",
    "targetJoinId",
    "targetProductKey",
    "quoteId",
    "quoteNo",
    "quoteUrl",
    "quotePageUrl",
    "quotePdfUrl",
    "quoteFileName",
    "quoteGeneratedAt"
  ],
  [SHEET_NAMES.JOIN_MEMBER_PROFILES]: [
    "profileId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberChannel",
    "memberMobile",
    "memberEmail",
    "birthYear",
    "gender",
    "profession",
    "level",
    "travelStyles",
    "profileImageUrl",
    "profileImageObjectName",
    "profileImageSize",
    "requiredAgreed",
    "marketingAgreed",
    "termsAgreedAt",
    "kakaoId",
    "kakaoNickname",
    "adminMemo",
    "updatedAt"
  ],
  [SHEET_NAMES.JOIN_REVIEWS]: [
    "reviewId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberMobile",
    "memberEmail",
    "targetType",
    "targetScheduleId",
    "targetApplicationId",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "departureDate",
    "returnDate",
    "country",
    "region",
    "rating",
    "tags",
    "reviewText",
    "photoName",
    "imageUrl",
    "thumbnailUrl",
    "imagesJson",
    "status",
    "adminMemo",
    "updatedAt"
  ],
  [SHEET_NAMES.JOIN_WISHES]: [
    "wishId",
    "createdAt",
    "source",
    "pageUrl",
    "memberSeq",
    "memberId",
    "memberName",
    "memberChannel",
    "memberMobile",
    "memberEmail",
    "targetType",
    "targetKey",
    "targetScheduleId",
    "targetApplicationId",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "departureDate",
    "returnDate",
    "category",
    "country",
    "region",
    "imageUrl",
    "price",
    "status",
    "adminMemo",
    "updatedAt"
  ],
  [SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY]: [
    "scheduleId",
    "sourceApplicationId",
    "title",
    "country",
    "region",
    "departureSummary",
    "returnSummary",
    "tripSummary",
    "creatorName",
    "creatorPhone",
    "capacity",
    "creatorPeople",
    "joinedPeople",
    "confirmedPeople",
    "pendingPeople",
    "cancelledPeople",
    "remainingSeats",
    "participantNames",
    "participantPhones",
    "genderSummary",
    "ageSummary",
    "levelSummary",
    "styleSummary",
    "memberPreferenceSummary",
    "status",
    "approvalStatus",
    "displayStatus",
    "updatedAt"
  ],
  [SHEET_NAMES.PRODUCT_DISPLAY_RULES]: [
    "recommendedScheduleId",
    "erpProductId",
    "erpEventSeq",
    "section",
    "isVisible",
    "isPinned",
    "displayOrder",
    "badgeType",
    "scheduleType",
    "scheduleLabel",
    "capacity",
    "maxPeople",
    "packType",
    "packTypeName",
    "overrideTitle",
    "overrideImageUrl",
    "country",
    "region",
    "airline",
    "departureAirport",
    "arrivalAirport",
    "productPrice",
    "displayStartAt",
    "displayEndAt",
    "tripSummary",
    "adminMemo",
    "updatedAt"
  ]
};

const TEXT_FORMAT_HEADERS = [
  "memberMobile",
  "applicantMobile",
  "creatorPhone",
  "participantPhones",
  "productPrice",
  "departureDateFrom",
  "departureDateTo",
  "returnDateFrom",
  "returnDateTo",
  "departureDate",
  "returnDate",
  "displayStartAt",
  "displayEndAt",
  "capacity",
  "maxPeople",
  "memberKey",
  "kakaoId",
  "targetJoinId",
  "targetProductKey",
  "quoteId",
  "quoteNo",
  "quoteUrl",
  "quotePageUrl",
  "quotePdfUrl",
  "quoteFileName",
  "quoteGeneratedAt"
];

const PHONE_VALUE_HEADERS = [
  "memberMobile",
  "applicantMobile",
  "creatorPhone"
];

const KNOWN_COUNTRY_NAMES = [
  "한국",
  "일본",
  "중국",
  "베트남",
  "태국",
  "라오스",
  "대만",
  "말레이시아",
  "인도네시아",
  "필리핀",
  "사이판",
  "괌"
];

function doPost(e) {
  const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  setupGolfJoinSheets();

  if (String(payload.action || "").toLowerCase() === "admin_status_update") {
    return handleAdminStatusUpdate_(payload);
  }

  const source = payload.source || "new_schedule_builder";
  const sheetName = source === "join_apply"
    ? SHEET_NAMES.JOIN_APPLICATIONS
    : source === "join_member_profile"
      ? SHEET_NAMES.JOIN_MEMBER_PROFILES
      : source === "join_review"
        ? SHEET_NAMES.JOIN_REVIEWS
        : source === "join_wish"
          ? SHEET_NAMES.JOIN_WISHES
          : source === "product_display_rule" || source === "recommended_schedule"
            ? SHEET_NAMES.PRODUCT_DISPLAY_RULES
          : SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS;
  const headers = SHEET_HEADERS[sheetName];
  const row = headers.map(function (header) {
    return getPayloadColumnValue_(payload, header, sheetName);
  });

  LockService.getScriptLock().waitLock(30000);
  let writeResult = { action: "append" };
  let capacityError = null;
  try {
    if (sheetName === SHEET_NAMES.JOIN_APPLICATIONS) {
      capacityError = getJoinApplicationCapacityError_(payload, row);
    }
    if (!capacityError) {
      writeResult = writeSheetRow_(sheetName, headers, row, payload);
      if (sheetName === SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS || sheetName === SHEET_NAMES.PRODUCT_DISPLAY_RULES || value_(payload, "targetType") === "new_schedule" || value_(payload, "targetType") === "recommended_schedule") {
        refreshScheduleParticipantSummary_();
      }
    }
  } finally {
    LockService.getScriptLock().releaseLock();
  }

  if (capacityError) return jsonOutput_(capacityError);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sheet: sheetName, write: writeResult.action, row: writeResult.row }))
    .setMimeType(ContentService.MimeType.JSON);
}


function doGet(e) {
  const params = (e && e.parameter) || {};
  setupGolfJoinSheets();

  if (String(params.action || "").toLowerCase() === "home_bootstrap") {
    return jsonOutput_(readHomeBootstrapPayload_(params));
  }

  if (String(params.action || "").toLowerCase() === "home_bootstrap_light") {
    return jsonOutput_(readHomeBootstrapLightPayload_(params));
  }

  if (String(params.action || "").toLowerCase() === "admin_bootstrap") {
    return jsonOutput_(readAdminBootstrapPayload_(params));
  }

  const sheetName = resolveReadSheetName_(params.sheet);
  const shouldRefreshSummary = !sheetName || sheetName === SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY || params.refreshSummary === "true";
  if (shouldRefreshSummary) {
    LockService.getScriptLock().waitLock(30000);
    try {
      refreshScheduleParticipantSummary_();
    } finally {
      LockService.getScriptLock().releaseLock();
    }
  }

  if (!sheetName) {
    const payload = {
      ok: true,
      updatedAt: nowKstISOString_(),
      sheets: {}
    };
    Object.keys(SHEET_HEADERS).forEach(function (name) {
      payload.sheets[name] = filterRowsForRequest_(readSheetObjects_(name), params).map(normalizeRowForJson_);
    });
    return jsonOutput_(payload);
  }

  const rows = filterRowsForRequest_(readSheetObjects_(sheetName), params).map(normalizeRowForJson_);
  return jsonOutput_({
    ok: true,
    sheet: sheetName,
    count: rows.length,
    rows: rows,
    items: rows,
    updatedAt: nowKstISOString_()
  });
}

function setupGolfJoinSheets() {
  Object.keys(SHEET_HEADERS).forEach(function (sheetName) {
    ensureSheetHeaders_(sheetName, SHEET_HEADERS[sheetName]);
  });
  repairNewScheduleValueFormatsOnce_();
}

function repairNewScheduleValueFormatsOnce_() {
  const propertyKey = "newScheduleValueFormatRepairV1";
  const properties = PropertiesService.getDocumentProperties();
  if (properties.getProperty(propertyKey) === "done") return;
  const sheet = getOrCreateSheet_(SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS);
  const headers = SHEET_HEADERS[SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS];
  if (sheet.getLastRow() < 2) {
    properties.setProperty(propertyKey, "done");
    return;
  }
  const priceIndex = headers.indexOf("productPrice");
  const dateHeaders = ["departureDateFrom", "departureDateTo", "returnDateFrom", "returnDateTo"];
  const dateIndexes = dateHeaders.map(function (header) { return headers.indexOf(header); }).filter(function (index) { return index !== -1; });
  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
  const rows = range.getValues();
  let changed = false;
  rows.forEach(function (row) {
    if (priceIndex !== -1) {
      const normalizedPrice = normalizePriceCell_(row[priceIndex]);
      if (String(row[priceIndex] || "") !== normalizedPrice) {
        row[priceIndex] = normalizedPrice;
        changed = true;
      }
    }
    dateIndexes.forEach(function (index) {
      const normalizedDate = formatDateCellAsISODate_(row[index]);
      if (String(row[index] || "") !== normalizedDate) {
        row[index] = normalizedDate;
        changed = true;
      }
    });
  });
  applyTextColumnFormats_(sheet, headers);
  if (changed) range.setValues(rows);
  properties.setProperty(propertyKey, "done");
}

function getOrCreateSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet) return sheet;
  const legacyNames = LEGACY_SHEET_NAMES[sheetName] || [];
  for (let index = 0; index < legacyNames.length; index += 1) {
    const legacySheet = spreadsheet.getSheetByName(legacyNames[index]);
    if (legacySheet) {
      legacySheet.setName(sheetName);
      return legacySheet;
    }
  }
  return spreadsheet.insertSheet(sheetName);
}

function writeSheetRow_(sheetName, headers, row, payload) {
  const sheet = getOrCreateSheet_(sheetName);
  if (String(payload.action || "").toLowerCase() !== "upsert") {
    appendSheetRow_(sheet, headers, row);
    return { action: "append", row: sheet.getLastRow() };
  }

  const keyField = String(payload.keyField || "").trim();
  const keyValue = String(payload.keyValue || "").trim();
  const keyIndex = headers.indexOf(keyField);
  if (!keyField || !keyValue || keyIndex === -1) {
    appendSheetRow_(sheet, headers, row);
    return { action: "append", row: sheet.getLastRow(), reason: "missing_upsert_key" };
  }

  const existingRowNumber = findSheetRowByKey_(sheet, keyIndex + 1, keyValue);
  if (!existingRowNumber) {
    appendSheetRow_(sheet, headers, row);
    return { action: "insert", row: sheet.getLastRow() };
  }

  const createdAtIndex = headers.indexOf("createdAt");
  if (createdAtIndex !== -1) {
    const existingCreatedAt = sheet.getRange(existingRowNumber, createdAtIndex + 1).getValue();
    if (existingCreatedAt) row[createdAtIndex] = existingCreatedAt;
  }
  writeSheetRowValues_(sheet, headers, existingRowNumber, row);
  return { action: "update", row: existingRowNumber };
}

function handleAdminStatusUpdate_(payload) {
  const sheetName = resolveReadSheetName_(payload.sheet);
  const allowedSheets = [SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS, SHEET_NAMES.JOIN_APPLICATIONS];
  if (allowedSheets.indexOf(sheetName) === -1) {
    return jsonOutput_({ ok: false, error: "sheet_not_allowed" });
  }
  const keyField = String(payload.keyField || "applicationId").trim();
  const keyValue = String(payload.keyValue || "").trim();
  const fields = payload.fields || {};
  const allowedFields = {
    participantStatus: true,
    quoteStatus: true,
    depositStatus: true,
    balanceStatus: true,
    refundStatus: true,
    applicationStatus: true,
    adminMemo: true
  };
  const headers = SHEET_HEADERS[sheetName];
  const keyIndex = headers.indexOf(keyField);
  if (!keyValue || keyIndex === -1) {
    return jsonOutput_({ ok: false, error: "missing_key" });
  }
  const sheet = getOrCreateSheet_(sheetName);
  const rowNumber = findSheetRowByKey_(sheet, keyIndex + 1, keyValue);
  if (!rowNumber) {
    return jsonOutput_({ ok: false, error: "row_not_found" });
  }

  LockService.getScriptLock().waitLock(30000);
  try {
    Object.keys(fields).forEach(function (field) {
      if (!allowedFields[field]) return;
      const columnIndex = headers.indexOf(field);
      if (columnIndex === -1) return;
      sheet.getRange(rowNumber, columnIndex + 1).setValue(fields[field]);
    });
    const updatedAtIndex = headers.indexOf("updatedAt");
    if (updatedAtIndex !== -1) {
      sheet.getRange(rowNumber, updatedAtIndex + 1).setValue(nowKstISOString_());
    }
    if (!payload.skipSummaryRefresh) {
      refreshScheduleParticipantSummary_();
    }
  } finally {
    LockService.getScriptLock().releaseLock();
  }

  return jsonOutput_({
    ok: true,
    sheet: sheetName,
    row: rowNumber,
    keyField: keyField,
    keyValue: keyValue
  });
}

function appendSheetRow_(sheet, headers, row) {
  const rowNumber = sheet.getLastRow() + 1;
  writeSheetRowValues_(sheet, headers, rowNumber, row);
}

function writeSheetRowValues_(sheet, headers, rowNumber, row) {
  applyTextColumnFormatsForRow_(sheet, headers, rowNumber);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
}

function findSheetRowByKey_(sheet, keyColumn, keyValue) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, keyColumn, lastRow - 1, 1).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || "").trim() === keyValue) {
      return index + 2;
    }
  }
  return 0;
}

function ensureSheetHeaders_(sheetName, headers) {
  const sheet = getOrCreateSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);

  if (lastRow === 0) {
    sheet.appendRow(headers);
    applyTextColumnFormats_(sheet, headers);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].slice(0, headers.length);
  const matches = headers.every(function (header, index) {
    return currentHeaders[index] === header;
  });
  if (matches) {
    applyTextColumnFormats_(sheet, headers);
    return sheet;
  }

  if (sheetName === SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS) {
    migrateSheetToHeaders_(sheet, headers, mapLegacyNewScheduleRow_);
  } else {
    migrateSheetToHeaders_(sheet, headers, mapLegacyGenericRow_);
  }
  applyTextColumnFormats_(sheet, headers);
  return sheet;
}

function applyTextColumnFormats_(sheet, headers) {
  TEXT_FORMAT_HEADERS.forEach(function (header) {
    const columnIndex = headers.indexOf(header);
    if (columnIndex === -1) return;
    sheet.getRange(1, columnIndex + 1, sheet.getMaxRows(), 1).setNumberFormat("@");
  });
}

function applyTextColumnFormatsForRow_(sheet, headers, rowNumber) {
  TEXT_FORMAT_HEADERS.forEach(function (header) {
    const columnIndex = headers.indexOf(header);
    if (columnIndex === -1) return;
    sheet.getRange(rowNumber, columnIndex + 1).setNumberFormat("@");
  });
}

function nowKstISOString_() {
  return Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd'T'HH:mm:ss'+09:00'");
}

function formatDateCellAsISODate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const text = String(value || "").trim();
  if (!text) return "";
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return text.split("~")[0].trim();
}

function getSheetSerialFromDate_(value) {
  const iso = formatDateCellAsISODate_(value);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const base = Date.UTC(1899, 11, 30);
  return String(Math.round((utc - base) / 86400000));
}

function normalizePriceCell_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return getSheetSerialFromDate_(value);
  }
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return getSheetSerialFromDate_(parsed);
  }
  return text.replace(/[^\d.-]/g, "");
}

function normalizePeopleText_(value, fallbackValue) {
  const values = Array.prototype.slice.call(arguments);
  for (let index = 0; index < values.length; index += 1) {
    const number = Number(String(values[index] || "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(number) && number > 0) {
      return String(Math.max(1, Math.min(200, Math.round(number))));
    }
  }
  return "";
}

function migrateSheetToHeaders_(sheet, headers, mapper) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    sheet.appendRow(headers);
    applyTextColumnFormats_(sheet, headers);
    return;
  }

  const oldHeaders = values[0].map(String);
  const migratedRows = values.slice(1).filter(function (row) {
    return !isHeaderRow_(row, headers) && !isEmptyRow_(row);
  }).map(function (row, rowIndex) {
    const object = rowToObject_(oldHeaders, row);
    return headers.map(function (header) {
      return mapper(object, header, rowIndex);
    });
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (migratedRows.length) {
    sheet.getRange(2, 1, migratedRows.length, headers.length).setValues(migratedRows);
  }
}

function mapLegacyNewScheduleRow_(row, header, rowIndex) {
  const createdAt = row.createdAt || row.submittedAt || nowKstISOString_();
  const applicationId = row.applicationId || buildId_("nsa", createdAt, row.memberSeq || row.memberId || row.applicantName || row.creatorName || rowIndex + 1);
  const scheduleId = row.scheduleId || buildId_("sch", applicationId);
  const memberKey = buildMemberKeyFromValues_({
    memberKey: row.memberKey,
    memberSeq: row.memberSeq,
    memberId: row.memberId,
    memberMobile: row.memberMobile || row.applicantMobile || row.creatorPhone || row.phone,
    memberEmail: row.memberEmail || row.email,
    kakaoId: row.kakaoId
  });
  if (header === "country") return row.country || normalizeCountryName_(row.region) || normalizeCountryName_(row.regions);
  if (header === "region") return normalizeRegionName_(row.region);
  const aliases = {
    applicationId: applicationId,
    scheduleId: scheduleId,
    createdAt: createdAt,
    applicantName: row.applicantName || row.creatorName || row.name,
    applicantGender: row.applicantGender || row.creatorGender || row.gender,
    applicantBirthYear: row.applicantBirthYear || row.creatorBirthYear || row.birthYear,
    applicantAgeBand: row.applicantAgeBand || row.creatorAgeDisplay || row.ageDisplay,
    applicantMobile: row.applicantMobile || row.creatorPhone || row.phone,
    applicantProfession: row.applicantProfession || row.creatorProfession || row.profession,
    applicantPeople: row.applicantPeople || row.creatorPeople || row.people,
    applicantCompanions: row.applicantCompanions || row.creatorCompanions || row.companions,
    applicantLevel: row.applicantLevel || row.creatorLevel || row.level,
    applicantStyles: row.applicantStyles || row.creatorStyles || row.styles,
    applicantPreferredMembers: row.applicantPreferredMembers || row.creatorPreferredMemberComposition || row.creatorMemberPreferences || row.preferredMemberComposition || row.memberPreferences,
    applicantGreeting: row.applicantGreeting || row.creatorGreeting || row.greeting,
    applicantRoomType: row.applicantRoomType || row.roomType || "2인1실",
    flightRequestType: row.flightRequestType || "",
    singleRoomSurcharge: row.singleRoomSurcharge || "",
    singleRoomSurchargeText: row.singleRoomSurchargeText || "",
    singleRoomSurchargeStatus: row.singleRoomSurchargeStatus || "",
    departureDateFrom: row.departureDateFrom || row.startBefore || row.departureDates || row.startSummary,
    departureDateTo: row.departureDateTo || row.startAfter || row.departureDates || row.startSummary,
    returnDateFrom: row.returnDateFrom || row.endBefore || row.returnDates || row.endSummary,
    returnDateTo: row.returnDateTo || row.endAfter || row.returnDates || row.endSummary,
    erpProductId: row.erpProductId || row.productId,
    erpEventSeq: row.erpEventSeq || row.eventSeq,
    productPrice: row.productPrice || row.price || row.tripPrice,
    approvalStatus: row.approvalStatus || "pending",
    displayStatus: row.displayStatus || "visible",
    applicationStatus: row.applicationStatus || row.status || "open",
    updatedAt: row.updatedAt || nowKstISOString_(),
    memberKey: memberKey,
    kakaoId: row.kakaoId || ""
  };
  return aliases[header] !== undefined ? aliases[header] : row[header] || "";
}


function mapLegacyGenericRow_(row, header) {
  if (header === "country") return row.country || normalizeCountryName_(row.region);
  if (header === "region") return normalizeRegionName_(row.region);
  const erpProductId = row.erpProductId || row.productId || row.goodSeq || "";
  const erpEventSeq = row.erpEventSeq || row.eventSeq || "";
  const memberKey = buildMemberKeyFromValues_({
    memberKey: row.memberKey,
    memberSeq: row.memberSeq,
    memberId: row.memberId,
    memberMobile: row.memberMobile || row.applicantMobile || row.creatorPhone || row.phone,
    memberEmail: row.memberEmail || row.email,
    kakaoId: row.kakaoId
  });
  const aliases = {
    createdAt: row.createdAt || row.submittedAt,
    applicantName: row.applicantName || row.name || row.creatorName,
    applicantGender: row.applicantGender || row.gender || row.creatorGender,
    applicantBirthYear: row.applicantBirthYear || row.birthYear || row.creatorBirthYear,
    applicantAgeBand: row.applicantAgeBand || row.ageDisplay || row.creatorAgeDisplay,
    applicantMobile: row.applicantMobile || row.phone || row.creatorPhone,
    applicantProfession: row.applicantProfession || row.profession || row.creatorProfession,
    applicantPeople: row.applicantPeople || row.people || row.creatorPeople,
    applicantCompanions: row.applicantCompanions || row.companions || row.creatorCompanions,
    applicantLevel: row.applicantLevel || row.level || row.creatorLevel,
    applicantStyles: row.applicantStyles || row.styles || row.creatorStyles,
    applicantPreferredMembers: row.applicantPreferredMembers || row.preferredMemberComposition || row.memberPreferences || row.creatorPreferredMemberComposition || row.creatorMemberPreferences,
    applicantGreeting: row.applicantGreeting || row.greeting || row.creatorGreeting,
    applicantRoomType: row.applicantRoomType || row.roomType || "2인1실",
    flightRequestType: row.flightRequestType || "",
    singleRoomSurcharge: row.singleRoomSurcharge || "",
    singleRoomSurchargeText: row.singleRoomSurchargeText || "",
    singleRoomSurchargeStatus: row.singleRoomSurchargeStatus || "",
    applicationStatus: row.applicationStatus || row.status,
    profileImageObjectName: row.profileImageObjectName || row.objectName,
    profileImageSize: row.profileImageSize || row.photoSize,
    isVisible: row.isVisible !== undefined ? row.isVisible : row.visible,
    isPinned: row.isPinned !== undefined ? row.isPinned : row.pinned,
    displayOrder: row.displayOrder || row.sortOrder,
    badgeType: row.badgeType || row.badgeKind,
    recommendedScheduleId: row.recommendedScheduleId || row.displayRuleId,
    overrideTitle: row.overrideTitle || row.customTitle,
    overrideImageUrl: row.overrideImageUrl || row.customImage,
    departureAirport: row.departureAirport,
    airline: row.airline || row.airlineName || row.airlineNm || row.air2Nm || row.air2CdNm,
    memberKey: memberKey,
    kakaoId: row.kakaoId || "",
    targetJoinId: row.targetJoinId || row.joinId || "",
    targetProductKey: row.targetProductKey || (erpProductId && erpEventSeq ? "erp:" + erpProductId + ":" + erpEventSeq : "")
  };
  return aliases[header] !== undefined ? aliases[header] : row[header] || "";
}

function getPayloadColumnValue_(payload, header, sheetName) {
  const value = getRawPayloadColumnValue_(payload, header, sheetName);
  if (PHONE_VALUE_HEADERS.indexOf(header) !== -1) return normalizePhone_(value);
  return value;
}

function getRawPayloadColumnValue_(payload, header, sheetName) {
  if (sheetName === SHEET_NAMES.JOIN_APPLICATIONS) {
    return getJoinApplicationValue_(payload, header);
  }
  if (sheetName === SHEET_NAMES.JOIN_MEMBER_PROFILES) {
    return getJoinMemberProfileValue_(payload, header);
  }
  if (sheetName === SHEET_NAMES.JOIN_REVIEWS) {
    return getJoinReviewValue_(payload, header);
  }
  if (sheetName === SHEET_NAMES.JOIN_WISHES) {
    return getJoinWishValue_(payload, header);
  }
  if (sheetName === SHEET_NAMES.PRODUCT_DISPLAY_RULES) {
    return getProductDisplayRuleValue_(payload, header);
  }
  return getNewScheduleApplicationValue_(payload, header);
}

function getProductDisplayRuleValue_(payload, header) {
  const updatedAt = nowKstISOString_();
  const erpProductId = value_(payload, "product.erpProductId") || payload.erpProductId || payload.goodSeq || "";
  const erpEventSeq = value_(payload, "product.erpEventSeq") || payload.erpEventSeq || payload.eventSeq || "";
  const recommendedScheduleId = payload.recommendedScheduleId || payload.displayRuleId || buildId_("rs", erpProductId, erpEventSeq, payload.section || "available_schedule");
  const normalizedCapacity = normalizePeopleText_(payload.capacity, payload.maxPeople);
  const normalizedMaxPeople = normalizePeopleText_(payload.maxPeople, payload.capacity);
  const values = {
    recommendedScheduleId: recommendedScheduleId,
    erpProductId: erpProductId,
    erpEventSeq: erpEventSeq,
    section: payload.section || "available_schedule",
    isVisible: payload.isVisible === false ? false : String(payload.isVisible || "true"),
    isPinned: payload.isPinned === true || String(payload.isPinned || "").toLowerCase() === "true",
    displayOrder: payload.displayOrder || 0,
    badgeType: payload.badgeType || "recommended",
    scheduleType: payload.scheduleType || "",
    scheduleLabel: payload.scheduleLabel || "",
    capacity: normalizedCapacity,
    maxPeople: normalizedMaxPeople,
    packType: payload.packType || value_(payload, "product.packType") || "",
    packTypeName: payload.packTypeName || value_(payload, "product.packTypeName") || "",
    overrideTitle: payload.overrideTitle || value_(payload, "product.productName") || "",
    overrideImageUrl: payload.overrideImageUrl || value_(payload, "product.imageUrl") || "",
    country: payload.country || value_(payload, "product.country") || normalizeCountryName_(payload.region || value_(payload, "product.region")),
    region: normalizeRegionName_(payload.region || value_(payload, "product.region")),
    airline: payload.airline || value_(payload, "product.airline") || value_(payload, "product.airlineName") || value_(payload, "product.airlineNm") || value_(payload, "product.air2Nm") || value_(payload, "product.air2CdNm") || "",
    departureAirport: payload.departureAirport || value_(payload, "product.departureAirport") || value_(payload, "product.airport") || "",
    arrivalAirport: payload.arrivalAirport || value_(payload, "product.arrivalAirport") || value_(payload, "product.region") || "",
    productPrice: normalizePriceCell_(payload.productPrice || payload.price || value_(payload, "product.price")),
    displayStartAt: formatDateCellAsISODate_(payload.displayStartAt || value_(payload, "product.departureDate") || ""),
    displayEndAt: formatDateCellAsISODate_(payload.displayEndAt || value_(payload, "product.returnDate") || payload.displayStartAt || value_(payload, "product.departureDate") || ""),
    tripSummary: payload.tripSummary || value_(payload, "product.tripSummary") || "",
    adminMemo: payload.adminMemo || "",
    updatedAt: updatedAt
  };
  return values[header] !== undefined ? values[header] : "";
}

function isActiveRecommendedScheduleRule_(rule) {
  const section = String(rule.section || "").trim() || "available_schedule";
  const visible = String(rule.isVisible === undefined || rule.isVisible === "" ? "true" : rule.isVisible).toLowerCase();
  const status = String(rule.status || "").toLowerCase();
  return section === "available_schedule" && visible !== "false" && visible !== "0" && visible !== "no" && status !== "cancelled" && status !== "hidden";
}

function buildRecommendedScheduleId_(rule) {
  const idSeed = rule.recommendedScheduleId || rule.displayRuleId || [rule.erpProductId, rule.erpEventSeq, rule.displayStartAt].filter(Boolean).join("-") || "rule";
  const safe = String(idSeed).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `admin-recommended-${safe || "rule"}`;
}

function buildRecommendedScheduleSummarySource_(rule) {
  const scheduleId = buildRecommendedScheduleId_(rule);
  return {
    scheduleId: scheduleId,
    sourceApplicationId: rule.recommendedScheduleId || rule.displayRuleId || "",
    applicationId: rule.recommendedScheduleId || rule.displayRuleId || "",
    productName: rule.overrideTitle || rule.productName || rule.erpProductId || "Recommended schedule",
    country: rule.country || "",
    region: rule.region || "",
    departureDateFrom: formatDateCellAsISODate_(rule.displayStartAt || ""),
    departureDateTo: formatDateCellAsISODate_(rule.displayStartAt || ""),
    returnDateFrom: formatDateCellAsISODate_(rule.displayEndAt || rule.displayStartAt || ""),
    returnDateTo: formatDateCellAsISODate_(rule.displayEndAt || rule.displayStartAt || ""),
    tripSummary: rule.tripSummary || "",
    packType: rule.packType || "",
    packTypeName: rule.packTypeName || "",
    applicantPeople: "0",
    creatorPeople: "0",
    capacity: rule.capacity || rule.maxPeople || "4",
    maxPeople: rule.maxPeople || rule.capacity || "4",
    scheduleType: rule.scheduleType || "",
    scheduleLabel: rule.scheduleLabel || "",
    status: "open",
    approvalStatus: "approved",
    displayStatus: "visible",
    erpProductId: rule.erpProductId || "",
    erpEventSeq: rule.erpEventSeq || "",
    isAdminRecommendedSchedule: true
  };
}

function getScheduleCapacity_(schedule) {
  const capacity = Number(String(schedule.capacity || schedule.maxPeople || "").replace(/\D/g, ""));
  return Number.isFinite(capacity) && capacity > 0 ? capacity : 4;
}

function isJoinApplicationForSchedule_(join, schedule) {
  const scheduleId = String(schedule.scheduleId || "").trim();
  const targetType = String(join.targetType || "").trim();
  const targetScheduleId = String(join.targetScheduleId || "").trim();
  if (targetScheduleId && targetScheduleId === scheduleId && (targetType === "new_schedule" || schedule.isAdminRecommendedSchedule)) {
    return true;
  }
  if (!schedule.isAdminRecommendedSchedule) return false;
  const productId = String(schedule.erpProductId || "").trim();
  const eventSeq = String(schedule.erpEventSeq || "").trim();
  const joinProductId = String(join.erpProductId || join.goodSeq || "").trim();
  const joinEventSeq = String(join.erpEventSeq || join.eventSeq || "").trim();
  const departureDate = String(schedule.departureDateFrom || "").trim();
  const joinDepartureDate = String(join.departureDate || "").trim();
  if (!productId || productId !== joinProductId) return false;
  if (eventSeq && joinEventSeq && eventSeq !== joinEventSeq) return false;
  if (departureDate && joinDepartureDate && departureDate !== joinDepartureDate) return false;
  return targetType !== "new_schedule";
}

function doScheduleIdsMatch_(schedule, scheduleId, applicationId) {
  const normalizedScheduleId = String(scheduleId || "").trim();
  const normalizedApplicationId = String(applicationId || "").trim();
  return Boolean(
    (normalizedScheduleId && (
      String(schedule.scheduleId || "").trim() === normalizedScheduleId
      || String(schedule.applicationId || "").trim() === normalizedScheduleId
      || String(schedule.sourceApplicationId || "").trim() === normalizedScheduleId
    ))
    || (normalizedApplicationId && (
      String(schedule.applicationId || "").trim() === normalizedApplicationId
      || String(schedule.sourceApplicationId || "").trim() === normalizedApplicationId
      || String(schedule.scheduleId || "").trim() === normalizedApplicationId
    ))
  );
}

function findJoinApplicationTargetSchedule_(joinRow, newSchedules, recommendedRows) {
  const recommendedSchedules = (recommendedRows || [])
    .filter(isActiveRecommendedScheduleRule_)
    .map(buildRecommendedScheduleSummarySource_);
  const targetType = String(joinRow.targetType || "").trim();
  const targetScheduleId = String(joinRow.targetScheduleId || "").trim();
  const targetApplicationId = String(joinRow.targetApplicationId || "").trim();
  const wantsRecommended = targetType === "recommended_schedule" || targetScheduleId.indexOf("admin-recommended-") === 0;
  const primarySchedules = wantsRecommended ? recommendedSchedules : newSchedules;
  const fallbackSchedules = wantsRecommended ? newSchedules : recommendedSchedules;
  return primarySchedules.find(function (schedule) { return doScheduleIdsMatch_(schedule, targetScheduleId, targetApplicationId); })
    || primarySchedules.find(function (schedule) { return isJoinApplicationForSchedule_(joinRow, schedule); })
    || fallbackSchedules.find(function (schedule) { return doScheduleIdsMatch_(schedule, targetScheduleId, targetApplicationId); })
    || fallbackSchedules.find(function (schedule) { return isJoinApplicationForSchedule_(joinRow, schedule); })
    || null;
}

function buildJoinCapacitySummary_(schedule, joinRows) {
  const relatedJoins = joinRows.filter(function (join) {
    return isJoinApplicationForSchedule_(join, schedule);
  });
  const confirmedJoins = relatedJoins.filter(function (join) {
    return (join.applicationStatus || join.status) !== "cancelled";
  });
  const creatorPeople = schedule.isAdminRecommendedSchedule ? 0 : parsePeople_(schedule.applicantPeople || schedule.creatorPeople || "1");
  const joinedPeople = confirmedJoins.reduce(function (sum, join) {
    return sum + parsePeople_(join.applicantPeople || join.people);
  }, 0);
  const capacity = getScheduleCapacity_(schedule);
  const confirmedPeople = Math.min(capacity, creatorPeople + joinedPeople);
  return {
    scheduleId: String(schedule.scheduleId || "").trim(),
    capacity: capacity,
    confirmedPeople: confirmedPeople,
    remainingSeats: Math.max(0, capacity - confirmedPeople)
  };
}

function getJoinApplicationCapacityError_(payload, row) {
  const headers = SHEET_HEADERS[SHEET_NAMES.JOIN_APPLICATIONS];
  const joinRow = rowToObject_(headers, row);
  const applicationId = String(joinRow.applicationId || payload.applicationId || payload.joinApplyId || "").trim();
  const joinRows = readSheetObjects_(SHEET_NAMES.JOIN_APPLICATIONS);
  const targetSchedule = findJoinApplicationTargetSchedule_(
    joinRow,
    readSheetObjects_(SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS),
    readSheetObjects_(SHEET_NAMES.PRODUCT_DISPLAY_RULES)
  );
  if (!targetSchedule) return null;
  const requestedPeople = parsePeople_(value_(payload, "applicant.people") || joinRow.applicantPeople || payload.applicantPeople || payload.people || "1");
  const capacityRows = joinRows.filter(function (join) {
    return String(join.applicationId || join.joinApplyId || "").trim() !== applicationId;
  });
  const summary = buildJoinCapacitySummary_(targetSchedule, capacityRows);
  if (requestedPeople <= Number(summary.remainingSeats || 0)) return null;
  return {
    ok: false,
    error: "join_schedule_full",
    code: "join_schedule_full",
    reason: "capacity_full",
    scheduleId: summary.scheduleId,
    targetScheduleId: String(joinRow.targetScheduleId || "").trim(),
    targetApplicationId: String(joinRow.targetApplicationId || "").trim(),
    remainingSeats: Number(summary.remainingSeats || 0),
    requestedPeople: requestedPeople,
    capacity: Number(summary.capacity || 0),
    confirmedPeople: Number(summary.confirmedPeople || 0)
  };
}

function getNewScheduleApplicationValue_(payload, header) {
  const createdAt = payload.createdAt || payload.submittedAt || nowKstISOString_();
  const applicationId = payload.applicationId || buildId_("nsa", createdAt, getPayloadMemberKey_(payload) || value_(payload, "member.memberSeq") || value_(payload, "member.memberId") || value_(payload, "member.memberName") || "member");
  const scheduleId = payload.scheduleId || buildId_("sch", applicationId);
  const packTypeValue = value_(payload, "trip.packType") || payload.packType;
  const packTypeNameValue = value_(payload, "trip.packTypeName") || payload.packTypeName;
  const rawAirlineValue = value_(payload, "trip.airline") || value_(payload, "product.airline") || value_(payload, "product.airlineName") || value_(payload, "product.airlineNm") || value_(payload, "product.air2Nm") || value_(payload, "product.air2CdNm");
  const rawDepartureAirportValue = value_(payload, "trip.departureAirport") || value_(payload, "product.departureAirport") || value_(payload, "product.airport");
  const isGolfPack = String(packTypeValue || "").toLowerCase() === "golf" || String(packTypeNameValue || "").indexOf("골프팩") >= 0;
  const values = {
    applicationId: applicationId,
    scheduleId: scheduleId,
    createdAt: createdAt,
    source: payload.source || "new_schedule_builder",
    pageUrl: payload.pageUrl || "",
    memberSeq: value_(payload, "member.memberSeq"),
    memberId: value_(payload, "member.memberId"),
    memberName: value_(payload, "member.memberName"),
    memberChannel: value_(payload, "member.memberChannel"),
    memberMobile: value_(payload, "member.memberMobile"),
    memberEmail: value_(payload, "member.memberEmail"),
    applicantName: value_(payload, "applicant.name"),
    applicantGender: value_(payload, "applicant.gender"),
    applicantBirthYear: value_(payload, "applicant.birthYear"),
    applicantAgeBand: value_(payload, "applicant.ageDisplay"),
    applicantMobile: value_(payload, "applicant.phone"),
    applicantProfession: value_(payload, "applicant.profession"),
    applicantPeople: value_(payload, "applicant.people"),
    applicantCompanions: stringifyCompanions_(value_(payload, "applicant.companions")),
    applicantLevel: value_(payload, "applicant.level"),
    applicantStyles: join_(value_(payload, "applicant.styles")),
    applicantPreferredMembers: join_(value_(payload, "applicant.preferredMemberComposition") || value_(payload, "applicant.memberPreferences")),
    applicantGreeting: value_(payload, "applicant.greeting"),
    applicantRoomType: value_(payload, "applicant.roomType") || "2인1실",
    flightRequestType: value_(payload, "applicant.flightRequestType"),
    singleRoomSurcharge: value_(payload, "applicant.singleRoomSurcharge"),
    singleRoomSurchargeText: value_(payload, "applicant.singleRoomSurchargeText"),
    singleRoomSurchargeStatus: value_(payload, "applicant.singleRoomSurchargeStatus"),
    country: value_(payload, "trip.country") || normalizeCountryName_(value_(payload, "trip.region")) || normalizeCountryList_(value_(payload, "trip.regions")),
    region: normalizeRegionName_(value_(payload, "trip.region")),
    airline: isGolfPack ? (rawAirlineValue || "개별항공") : rawAirlineValue,
    departureAirport: isGolfPack ? "" : rawDepartureAirportValue,
    arrivalAirport: value_(payload, "trip.arrivalAirport") || value_(payload, "product.arrivalAirport") || value_(payload, "product.region"),
    erpProductId: value_(payload, "trip.erpProductId") || value_(payload, "trip.productId"),
    erpEventSeq: value_(payload, "trip.erpEventSeq") || value_(payload, "trip.eventSeq"),
    productName: value_(payload, "trip.productName"),
    productPrice: normalizePriceCell_(value_(payload, "trip.productPrice") || payload.productPrice || payload.price),
    packType: packTypeValue,
    packTypeName: packTypeNameValue,
    tripSummary: value_(payload, "trip.tripSummary"),
    departureDateFrom: formatDateCellAsISODate_(value_(payload, "trip.flexibleDays.startBefore") || firstListValue_(value_(payload, "trip.departureDates")) || value_(payload, "trip.startSummary")),
    departureDateTo: formatDateCellAsISODate_(value_(payload, "trip.flexibleDays.startAfter") || lastListValue_(value_(payload, "trip.departureDates")) || value_(payload, "trip.startSummary")),
    returnDateFrom: formatDateCellAsISODate_(value_(payload, "trip.flexibleDays.endBefore") || firstListValue_(value_(payload, "trip.returnDates")) || value_(payload, "trip.endSummary")),
    returnDateTo: formatDateCellAsISODate_(value_(payload, "trip.flexibleDays.endAfter") || lastListValue_(value_(payload, "trip.returnDates")) || value_(payload, "trip.endSummary")),
    participantStatus: payload.participantStatus || value_(payload, "payment.participantStatus") || "신청",
    quoteStatus: payload.quoteStatus || value_(payload, "payment.quoteStatus") || "",
    depositStatus: payload.depositStatus || value_(payload, "payment.depositStatus") || "",
    balanceStatus: payload.balanceStatus || value_(payload, "payment.balanceStatus") || "",
    refundStatus: payload.refundStatus || value_(payload, "payment.refundStatus") || "",
    requiredAgreed: value_(payload, "agreements.required"),
    marketingAgreed: value_(payload, "agreements.marketing"),
    approvalStatus: payload.approvalStatus || "pending",
    displayStatus: payload.displayStatus || "visible",
    applicationStatus: payload.applicationStatus || payload.status || "open",
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString_(),
    memberKey: getPayloadMemberKey_(payload),
    kakaoId: value_(payload, "member.kakaoId") || value_(payload, "kakao.kakaoId") || payload.kakaoId
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinApplicationValue_(payload, header) {
  const createdAt = payload.createdAt || payload.submittedAt || nowKstISOString_();
  const applicationId = payload.applicationId || payload.joinApplyId || buildId_("join", createdAt, getPayloadMemberKey_(payload) || value_(payload, "member.memberSeq") || value_(payload, "member.memberId") || value_(payload, "member.memberName") || "member");
  const erpProductId = payload.erpProductId || value_(payload, "product.erpProductId") || value_(payload, "product.productId");
  const erpEventSeq = payload.erpEventSeq || value_(payload, "product.erpEventSeq") || value_(payload, "product.eventSeq");
  const targetJoinId = payload.targetJoinId || value_(payload, "target.joinId") || value_(payload, "join.id");
  const targetProductKey = payload.targetProductKey || value_(payload, "target.productKey") || (erpProductId && erpEventSeq ? "erp:" + erpProductId + ":" + erpEventSeq : "");
  const values = {
    applicationId: applicationId,
    createdAt: createdAt,
    source: payload.source || "join_apply",
    pageUrl: payload.pageUrl || "",
    memberSeq: value_(payload, "member.memberSeq"),
    memberId: value_(payload, "member.memberId"),
    memberName: value_(payload, "member.memberName"),
    memberChannel: value_(payload, "member.memberChannel"),
    memberMobile: value_(payload, "member.memberMobile"),
    memberEmail: value_(payload, "member.memberEmail"),
    targetType: payload.targetType || value_(payload, "target.type") || "erp_product",
    targetScheduleId: payload.targetScheduleId || value_(payload, "target.scheduleId"),
    targetApplicationId: payload.targetApplicationId || value_(payload, "target.applicationId"),
    erpProductId: erpProductId,
    erpEventSeq: erpEventSeq,
    productName: value_(payload, "product.productName") || payload.productName,
    departureDate: value_(payload, "product.departureDate") || payload.departureDate,
    returnDate: value_(payload, "product.returnDate") || payload.returnDate,
    category: value_(payload, "product.category") || payload.category,
    country: value_(payload, "product.country") || payload.country || normalizeCountryName_(value_(payload, "product.countryRegion") || value_(payload, "join.countryRegion") || value_(payload, "product.region") || payload.region),
    region: normalizeRegionName_(value_(payload, "product.region") || payload.region),
    airline: value_(payload, "product.airline") || value_(payload, "product.airlineName") || value_(payload, "product.airlineNm") || value_(payload, "product.air2Nm") || value_(payload, "product.air2CdNm"),
    departureAirport: value_(payload, "product.departureAirport") || payload.departureAirport,
    arrivalAirport: value_(payload, "product.arrivalAirport") || payload.arrivalAirport || value_(payload, "product.region"),
    applicantName: value_(payload, "applicant.name"),
    applicantGender: value_(payload, "applicant.gender"),
    applicantBirthYear: value_(payload, "applicant.birthYear"),
    applicantAgeBand: value_(payload, "applicant.ageDisplay"),
    applicantMobile: value_(payload, "applicant.phone"),
    applicantProfession: value_(payload, "applicant.profession"),
    applicantPeople: value_(payload, "applicant.people"),
    applicantCompanions: stringifyCompanions_(value_(payload, "applicant.companions")),
    applicantLevel: value_(payload, "applicant.level"),
    applicantStyles: join_(value_(payload, "applicant.styles")),
    applicantPreferredMembers: join_(value_(payload, "applicant.preferredMemberComposition") || value_(payload, "applicant.memberPreferences")),
    applicantGreeting: value_(payload, "applicant.greeting"),
    applicantRoomType: value_(payload, "applicant.roomType") || "2인1실",
    flightRequestType: value_(payload, "applicant.flightRequestType"),
    singleRoomSurcharge: value_(payload, "applicant.singleRoomSurcharge"),
    singleRoomSurchargeText: value_(payload, "applicant.singleRoomSurchargeText"),
    singleRoomSurchargeStatus: value_(payload, "applicant.singleRoomSurchargeStatus"),
    participantStatus: payload.participantStatus || value_(payload, "payment.participantStatus") || "신청",
    quoteStatus: payload.quoteStatus || value_(payload, "payment.quoteStatus") || "",
    depositStatus: payload.depositStatus || value_(payload, "payment.depositStatus") || "",
    balanceStatus: payload.balanceStatus || value_(payload, "payment.balanceStatus") || "",
    refundStatus: payload.refundStatus || value_(payload, "payment.refundStatus") || "",
    applicationStatus: payload.applicationStatus || payload.status || "confirmed",
    requiredAgreed: value_(payload, "agreements.required"),
    marketingAgreed: value_(payload, "agreements.marketing"),
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString_(),
    memberKey: getPayloadMemberKey_(payload),
    kakaoId: value_(payload, "member.kakaoId") || value_(payload, "kakao.kakaoId") || payload.kakaoId,
    targetJoinId: targetJoinId,
    targetProductKey: targetProductKey
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinMemberProfileValue_(payload, header) {
  const createdAt = payload.createdAt || payload.submittedAt || nowKstISOString_();
  const mobile = value_(payload, "member.memberMobile");
  const profileId = payload.profileId || buildId_("jmp", createdAt, value_(payload, "member.memberSeq") || value_(payload, "member.memberId") || value_(payload, "member.memberName") || "member");
  const values = {
    profileId: profileId,
    createdAt: createdAt,
    source: payload.source || "join_member_profile",
    pageUrl: payload.pageUrl || "",
    memberSeq: value_(payload, "member.memberSeq"),
    memberId: value_(payload, "member.memberId"),
    memberName: value_(payload, "member.memberName"),
    memberChannel: value_(payload, "member.memberChannel"),
    memberMobile: mobile,
    memberEmail: value_(payload, "member.memberEmail"),
    birthYear: value_(payload, "profile.birthYear"),
    gender: value_(payload, "profile.gender"),
    profession: value_(payload, "profile.profession"),
    level: value_(payload, "profile.level"),
    travelStyles: join_(value_(payload, "profile.travelStyles")),
    profileImageUrl: value_(payload, "profile.profileImageUrl"),
    profileImageObjectName: value_(payload, "profile.profileImageObjectName"),
    profileImageSize: value_(payload, "profile.profileImageSize"),
    requiredAgreed: value_(payload, "profile.requiredAgreed"),
    marketingAgreed: value_(payload, "profile.marketingAgreed"),
    termsAgreedAt: value_(payload, "profile.termsAgreedAt") || createdAt,
    kakaoId: value_(payload, "kakao.kakaoId"),
    kakaoNickname: value_(payload, "kakao.nickname"),
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString_()
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinReviewValue_(payload, header) {
  const createdAt = payload.createdAt || payload.submittedAt || nowKstISOString_();
  const reviewId = payload.reviewId || buildId_("jr", createdAt, value_(payload, "member.memberSeq") || value_(payload, "member.memberId") || value_(payload, "member.memberName") || "member", value_(payload, "product.erpProductId") || payload.erpProductId || value_(payload, "product.productName"));
  const values = {
    reviewId: reviewId,
    createdAt: createdAt,
    source: payload.source || "join_review",
    pageUrl: payload.pageUrl || "",
    memberSeq: value_(payload, "member.memberSeq"),
    memberId: value_(payload, "member.memberId"),
    memberName: value_(payload, "member.memberName"),
    memberMobile: value_(payload, "member.memberMobile"),
    memberEmail: value_(payload, "member.memberEmail"),
    targetType: payload.targetType || value_(payload, "target.type") || "erp_product",
    targetScheduleId: payload.targetScheduleId || value_(payload, "target.scheduleId"),
    targetApplicationId: payload.targetApplicationId || value_(payload, "target.applicationId"),
    erpProductId: payload.erpProductId || value_(payload, "product.erpProductId") || value_(payload, "product.productId"),
    erpEventSeq: payload.erpEventSeq || value_(payload, "product.erpEventSeq") || value_(payload, "product.eventSeq"),
    productName: value_(payload, "product.productName") || payload.productName,
    departureDate: value_(payload, "product.departureDate") || payload.departureDate,
    returnDate: value_(payload, "product.returnDate") || payload.returnDate,
    country: value_(payload, "product.country") || payload.country || normalizeCountryName_(value_(payload, "product.countryRegion") || value_(payload, "join.countryRegion") || value_(payload, "product.region") || payload.region),
    region: normalizeRegionName_(value_(payload, "product.region") || payload.region),
    rating: payload.rating || value_(payload, "review.rating"),
    tags: join_(payload.tags || value_(payload, "review.tags")),
    reviewText: payload.reviewText || value_(payload, "review.text"),
    photoName: payload.photoName || value_(payload, "review.photoName"),
    imageUrl: payload.imageUrl || value_(payload, "review.imageUrl"),
    thumbnailUrl: payload.thumbnailUrl || value_(payload, "review.thumbnailUrl"),
    imagesJson: payload.imagesJson || stringifyJsonArray_(value_(payload, "review.images")),
    status: payload.status || "visible",
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString_()
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinWishValue_(payload, header) {
  const createdAt = payload.createdAt || payload.savedAt || nowKstISOString_();
  const targetType = payload.targetType || value_(payload, "target.type") || "product";
  const targetKey = payload.targetKey || value_(payload, "target.targetKey") || value_(payload, "target.key") || value_(payload, "product.erpProductId") || value_(payload, "product.productId") || payload.erpProductId || payload.goodSeq || "";
  const wishId = payload.wishId || buildId_("jw", value_(payload, "member.memberSeq") || value_(payload, "member.memberId") || value_(payload, "member.memberName") || "member", targetType, targetKey);
  const values = {
    wishId: wishId,
    createdAt: createdAt,
    source: payload.source || "join_wish",
    pageUrl: payload.pageUrl || "",
    memberSeq: value_(payload, "member.memberSeq"),
    memberId: value_(payload, "member.memberId"),
    memberName: value_(payload, "member.memberName"),
    memberChannel: value_(payload, "member.memberChannel"),
    memberMobile: value_(payload, "member.memberMobile"),
    memberEmail: value_(payload, "member.memberEmail"),
    targetType: targetType,
    targetKey: targetKey,
    targetScheduleId: payload.targetScheduleId || value_(payload, "target.scheduleId"),
    targetApplicationId: payload.targetApplicationId || value_(payload, "target.applicationId"),
    erpProductId: payload.erpProductId || value_(payload, "product.erpProductId") || value_(payload, "product.productId"),
    erpEventSeq: payload.erpEventSeq || value_(payload, "product.erpEventSeq") || value_(payload, "product.eventSeq"),
    productName: value_(payload, "product.productName") || payload.productName,
    departureDate: value_(payload, "product.departureDate") || payload.departureDate,
    returnDate: value_(payload, "product.returnDate") || payload.returnDate,
    category: value_(payload, "product.category") || payload.category,
    country: value_(payload, "product.country") || payload.country || normalizeCountryName_(value_(payload, "product.countryRegion") || value_(payload, "join.countryRegion") || value_(payload, "product.region") || payload.region),
    region: normalizeRegionName_(value_(payload, "product.region") || payload.region),
    imageUrl: value_(payload, "product.imageUrl") || payload.imageUrl,
    price: value_(payload, "product.price") || payload.price,
    status: payload.status || "active",
    adminMemo: payload.adminMemo || "",
    updatedAt: nowKstISOString_()
  };
  return values[header] !== undefined ? values[header] : "";
}

function refreshScheduleParticipantSummary_() {
  const summarySheet = ensureSheetHeaders_(SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY, SHEET_HEADERS[SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY]);
  const newScheduleRows = readSheetObjects_(SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS);
  const joinRows = readSheetObjects_(SHEET_NAMES.JOIN_APPLICATIONS);
  const displayRuleRows = readSheetObjects_(SHEET_NAMES.PRODUCT_DISPLAY_RULES);
  const headers = SHEET_HEADERS[SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY];
  const recommendedScheduleRows = displayRuleRows
    .filter(isActiveRecommendedScheduleRule_)
    .map(buildRecommendedScheduleSummarySource_);
  const scheduleRows = newScheduleRows.concat(recommendedScheduleRows);

  const summaryRows = scheduleRows.map(function (schedule) {
    const scheduleId = schedule.scheduleId;
    const relatedJoins = joinRows.filter(function (join) {
      return isJoinApplicationForSchedule_(join, schedule);
    });
    const confirmedJoins = relatedJoins.filter(function (join) { return (join.applicationStatus || join.status) !== "cancelled"; });
    const cancelledJoins = relatedJoins.filter(function (join) { return (join.applicationStatus || join.status) === "cancelled"; });
    const pendingJoins = relatedJoins.filter(function (join) { return (join.applicationStatus || join.status) === "pending"; });
    const normalizedCreatorPeople = schedule.isAdminRecommendedSchedule ? 0 : parsePeople_(schedule.applicantPeople || schedule.creatorPeople || "1");
    const normalizedJoinedPeople = confirmedJoins.reduce(function (sum, join) { return sum + parsePeople_(join.applicantPeople || join.people); }, 0);
    const rawConfirmedPeople = normalizedCreatorPeople + normalizedJoinedPeople;
    const capacity = getScheduleCapacity_(schedule);
    const confirmedPeople = Math.min(capacity, rawConfirmedPeople);
    const creatorParticipants = normalizedCreatorPeople > 0 ? [
      {
        name: schedule.applicantName || schedule.creatorName,
        phone: schedule.applicantMobile || schedule.creatorPhone,
        gender: schedule.applicantGender || schedule.creatorGender,
        age: schedule.applicantAgeBand || schedule.creatorAgeDisplay,
        level: schedule.applicantLevel || schedule.creatorLevel,
        styles: schedule.applicantStyles || schedule.creatorStyles,
        memberPreferences: schedule.applicantPreferredMembers || schedule.creatorMemberPreferences || schedule.creatorPreferredMemberComposition
      }
    ] : [];
    const participants = creatorParticipants.concat(confirmedJoins.map(function (join) {
      return {
        name: join.applicantName || join.name,
        phone: join.applicantMobile || join.phone,
        gender: join.applicantGender || join.gender,
        age: join.applicantAgeBand || join.ageDisplay,
        level: join.applicantLevel || join.level,
        styles: join.applicantStyles || join.styles,
        memberPreferences: join.applicantPreferredMembers || join.memberPreferences || join.preferredMemberComposition
      };
    }));
    const values = {
      scheduleId: scheduleId,
      sourceApplicationId: schedule.applicationId || schedule.sourceApplicationId,
      title: schedule.productName || `${schedule.region || "새일정"} 맞춤 조인`,
      country: schedule.country || normalizeCountryName_(schedule.region),
      region: normalizeRegionName_(schedule.region),
      departureSummary: dateRangeSummary_(schedule.departureDateFrom, schedule.departureDateTo),
      returnSummary: dateRangeSummary_(schedule.returnDateFrom, schedule.returnDateTo),
      tripSummary: schedule.tripSummary,
      creatorName: schedule.applicantName || schedule.creatorName,
      creatorPhone: schedule.applicantMobile || schedule.creatorPhone,
      capacity: capacity,
      creatorPeople: normalizedCreatorPeople,
      joinedPeople: normalizedJoinedPeople,
      confirmedPeople: confirmedPeople,
      pendingPeople: pendingJoins.reduce(function (sum, join) { return sum + parsePeople_(join.applicantPeople || join.people); }, 0),
      cancelledPeople: cancelledJoins.reduce(function (sum, join) { return sum + parsePeople_(join.applicantPeople || join.people); }, 0),
      remainingSeats: Math.max(0, capacity - confirmedPeople),
      participantNames: participants.slice(0, capacity).map(function (item) { return item.name; }).filter(Boolean).join(", "),
      participantPhones: participants.slice(0, capacity).map(function (item) { return item.phone; }).filter(Boolean).join(", "),
      genderSummary: summarize_(participants.slice(0, capacity).map(function (item) { return item.gender; })),
      ageSummary: summarize_(participants.slice(0, capacity).map(function (item) { return item.age; })),
      levelSummary: summarize_(participants.slice(0, capacity).map(function (item) { return item.level; })),
      styleSummary: summarize_(participants.slice(0, capacity).flatMap(function (item) { return String(item.styles || "").split(",").map(function (style) { return style.trim(); }); })),
      memberPreferenceSummary: summarize_(participants.slice(0, capacity).flatMap(function (item) { return String(item.memberPreferences || "").split(",").map(function (preference) { return preference.trim(); }); })),
      status: schedule.applicationStatus || schedule.status || "open",
      approvalStatus: schedule.approvalStatus || "pending",
      displayStatus: schedule.displayStatus || "visible",
      updatedAt: nowKstISOString_()
    };
    return headers.map(function (header) { return values[header] !== undefined ? values[header] : ""; });
  });

  if (summarySheet.getLastRow() > 1) {
    summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn()).clearContent();
  }
  if (summaryRows.length) {
    summarySheet.getRange(2, 1, summaryRows.length, headers.length).setValues(summaryRows);
  }
}

function readSheetObjects_(sheetName) {
  const sheet = getOrCreateSheet_(sheetName);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(function (row) {
    return !isHeaderRow_(row, headers) && !isEmptyRow_(row);
  }).map(function (row) {
    return rowToObject_(headers, row);
  });
}

function isHeaderRow_(row, headers) {
  const headerCount = headers.filter(Boolean).length;
  const matchedCount = headers.reduce(function (count, header, index) {
    return count + (String(row[index] || "") === String(header || "") ? 1 : 0);
  }, 0);
  const firstCell = String(row[0] || "").trim();
  const knownHeaderFirstCells = ["applicationId", "profileId", "reviewId", "scheduleId", "erpProductId"];
  if (knownHeaderFirstCells.indexOf(firstCell) !== -1) return true;
  return headerCount > 0 && matchedCount >= Math.min(4, headerCount);
}

function isEmptyRow_(row) {
  return row.every(function (value) {
    return String(value || "").trim() === "";
  });
}

function rowToObject_(headers, row) {
  return headers.reduce(function (object, header, index) {
    object[header] = row[index];
    return object;
  }, {});
}

function parsePeople_(value) {
  const count = Number(String(value || "1").replace(/\D/g, ""));
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function summarize_(values) {
  const counts = values.filter(Boolean).reduce(function (summary, value) {
    summary[value] = (summary[value] || 0) + 1;
    return summary;
  }, {});
  return Object.keys(counts).map(function (key) {
    return `${key} ${counts[key]}`;
  }).join(" / ");
}

function dateRangeSummary_(from, to) {
  const start = formatDateCellAsISODate_(from);
  const end = formatDateCellAsISODate_(to);
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end || "";
}

function buildId_(prefix) {
  const parts = Array.prototype.slice.call(arguments, 1).map(function (part) {
    return scrubPrivateIdSeed_(part);
  }).join("-");
  const safe = String(parts || nowKstISOString_()).replace(/[^a-z0-9가-힣_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${prefix}_${safe}`;
}

function scrubPrivateIdSeed_(value) {
  const text = String(value || "");
  const digits = text.replace(/\D/g, "");
  if (/^010\d{8}$/.test(digits)) return "private";
  return text
    .replace(/010[-\s]?\d{4}[-\s]?\d{4}/g, "private")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "private");
}

function value_(object, path) {
  return String(path).split(".").reduce(function (current, key) {
    return current && current[key] !== undefined && current[key] !== null ? current[key] : "";
  }, object);
}

function buildMemberKeyFromValues_(values) {
  values = values || {};
  const existing = String(values.memberKey || "").trim();
  if (existing) return existing;
  const memberSeq = String(values.memberSeq || "").trim();
  if (memberSeq) return "seq:" + memberSeq;
  const memberId = String(values.memberId || "").trim().toLowerCase();
  if (memberId) return "id:" + memberId;
  const memberMobile = normalizePhone_(values.memberMobile || "");
  if (memberMobile) return "phone:" + memberMobile;
  const memberEmail = String(values.memberEmail || "").trim().toLowerCase();
  if (memberEmail) return "email:" + memberEmail;
  const kakaoId = String(values.kakaoId || "").trim();
  if (kakaoId) return "kakao:" + kakaoId;
  return "";
}

function getPayloadMemberKey_(payload) {
  return buildMemberKeyFromValues_({
    memberKey: payload.memberKey || value_(payload, "member.memberKey"),
    memberSeq: value_(payload, "member.memberSeq") || payload.memberSeq,
    memberId: value_(payload, "member.memberId") || payload.memberId,
    memberMobile: value_(payload, "member.memberMobile") || payload.memberMobile,
    memberEmail: value_(payload, "member.memberEmail") || payload.memberEmail,
    kakaoId: value_(payload, "member.kakaoId") || value_(payload, "kakao.kakaoId") || payload.kakaoId
  });
}

function join_(value) {
  return Array.isArray(value) ? value.join(", ") : value || "";
}

function normalizeRegionName_(value) {
  const parts = String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  if (parts.length >= 2) return parts[0] || "";
  const text = parts[0] || "";
  const country = getKnownCountryName_(text);
  return country && text !== country ? text.replace(country, "").trim() || text : text;
}

function normalizeCountryName_(value) {
  const parts = String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  return parts.length >= 2 ? parts.slice(1).join(", ") : getKnownCountryName_(parts[0] || "");
}

function getKnownCountryName_(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return KNOWN_COUNTRY_NAMES.find(function (country) {
    return text === country || text.indexOf(country + " ") === 0;
  }) || "";
}

function normalizeCountryList_(value) {
  const seen = {};
  return (Array.isArray(value) ? value : String(value || "").split("|"))
    .map(normalizeCountryName_)
    .filter(function (item) {
      if (!item || seen[item]) return false;
      seen[item] = true;
      return true;
    })
    .join(", ");
}

function normalizeRegionList_(value) {
  return (Array.isArray(value) ? value : String(value || "").split("|"))
    .map(normalizeRegionName_)
    .filter(Boolean)
    .join(", ");
}

function firstListValue_(value) {
  return Array.isArray(value) ? value[0] || "" : String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean)[0] || "";
}

function lastListValue_(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  return list.length ? list[list.length - 1] : "";
}

function stringifyJsonArray_(value) {
  if (!value) return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value || "");
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function resolveReadSheetName_(value) {
  const requested = String(value || "").trim();
  if (!requested || requested === "all") return "";
  const aliases = {
    new_schedule: SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS,
    new_schedule_applications: SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS,
    builder: SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS,
    join: SHEET_NAMES.JOIN_APPLICATIONS,
    join_applications: SHEET_NAMES.JOIN_APPLICATIONS,
    join_member_profile: SHEET_NAMES.JOIN_MEMBER_PROFILES,
    join_member_profiles: SHEET_NAMES.JOIN_MEMBER_PROFILES,
    member_profiles: SHEET_NAMES.JOIN_MEMBER_PROFILES,
    join_review: SHEET_NAMES.JOIN_REVIEWS,
    join_reviews: SHEET_NAMES.JOIN_REVIEWS,
    reviews: SHEET_NAMES.JOIN_REVIEWS,
    join_wish: SHEET_NAMES.JOIN_WISHES,
    join_wishes: SHEET_NAMES.JOIN_WISHES,
    wishes: SHEET_NAMES.JOIN_WISHES,
    schedule_participant_summary: SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY,
    summary: SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY,
    recommended_schedules: SHEET_NAMES.PRODUCT_DISPLAY_RULES,
    recommended_schedule: SHEET_NAMES.PRODUCT_DISPLAY_RULES,
    product_display_rules: SHEET_NAMES.PRODUCT_DISPLAY_RULES,
    display_rules: SHEET_NAMES.PRODUCT_DISPLAY_RULES
  };
  return aliases[requested] || (SHEET_HEADERS[requested] ? requested : SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS);
}

function filterRowsForRequest_(rows, params) {
  let filtered = rows;
  const source = String(params.source || "").trim();
  const status = String(params.status || "").trim();
  const displayStatus = String(params.displayStatus || "").trim();
  const approvalStatus = String(params.approvalStatus || "").trim();
  const memberSeq = String(params.memberSeq || "").trim();
  const memberId = String(params.memberId || "").trim();
  const memberMobile = normalizePhone_(params.memberMobile || params.phone || "");
  const memberEmail = String(params.memberEmail || params.email || "").trim();
  const kakaoId = String(params.kakaoId || "").trim();
  const memberKey = buildMemberKeyFromValues_({
    memberKey: params.memberKey,
    memberSeq: memberSeq,
    memberId: memberId,
    memberMobile: memberMobile,
    memberEmail: memberEmail,
    kakaoId: kakaoId
  });
  const scheduleId = String(params.scheduleId || params.targetScheduleId || "").trim();
  const erpProductId = String(params.erpProductId || params.productId || "").trim();
  const erpEventSeq = String(params.erpEventSeq || params.eventSeq || "").trim();
  const productName = String(params.productName || "").trim();
  const since = params.since ? new Date(params.since).getTime() : 0;

  if (source) {
    filtered = filtered.filter(function (row) { return String(row.source || "") === source; });
  }
  if (status) {
    filtered = filtered.filter(function (row) {
      return String(row.status || row.applicationStatus || "") === status;
    });
  }
  if (displayStatus) {
    filtered = filtered.filter(function (row) { return String(row.displayStatus || "") === displayStatus; });
  }
  if (approvalStatus) {
    filtered = filtered.filter(function (row) { return String(row.approvalStatus || "") === approvalStatus; });
  }
  if (memberKey || memberSeq || memberId || memberMobile || memberEmail || kakaoId) {
    filtered = filtered.filter(function (row) {
      const rowMemberSeq = String(row.memberSeq || "").trim();
      const rowMemberId = String(row.memberId || "").trim();
      const rowMemberMobile = normalizePhone_(row.memberMobile || row.applicantMobile || row.creatorPhone || row.phone || "");
      const rowMemberEmail = String(row.memberEmail || row.email || "").trim();
      const rowKakaoId = String(row.kakaoId || "").trim();
      const rowMemberKey = buildMemberKeyFromValues_({
        memberKey: row.memberKey,
        memberSeq: rowMemberSeq,
        memberId: rowMemberId,
        memberMobile: rowMemberMobile,
        memberEmail: rowMemberEmail,
        kakaoId: rowKakaoId
      });
      return Boolean(
        (memberKey && rowMemberKey && rowMemberKey === memberKey)
        || (memberSeq && rowMemberSeq && rowMemberSeq === memberSeq)
        || (memberId && rowMemberId && rowMemberId === memberId)
        || (memberMobile && rowMemberMobile && rowMemberMobile === memberMobile)
        || (memberEmail && rowMemberEmail && rowMemberEmail === memberEmail)
        || (kakaoId && rowKakaoId && rowKakaoId === kakaoId)
      );
    });
  }
  if (scheduleId) {
    filtered = filtered.filter(function (row) {
      return String(row.scheduleId || row.targetScheduleId || "") === scheduleId;
    });
  }
  if (erpProductId) {
    filtered = filtered.filter(function (row) {
      return String(row.erpProductId || row.productId || "") === erpProductId;
    });
  }
  if (erpEventSeq) {
    filtered = filtered.filter(function (row) {
      return String(row.erpEventSeq || row.eventSeq || "") === erpEventSeq;
    });
  }
  if (productName) {
    filtered = filtered.filter(function (row) {
      return String(row.productName || "").trim() === productName;
    });
  }
  if (since) {
    filtered = filtered.filter(function (row) {
      const updatedAt = new Date(row.updatedAt || row.createdAt || row.submittedAt || 0).getTime();
      return updatedAt && updatedAt >= since;
    });
  }

  filtered = filtered.sort(function (a, b) {
    return new Date(b.updatedAt || b.createdAt || b.submittedAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || a.submittedAt || 0).getTime();
  });

  const limit = parsePositiveInteger_(params.limit);
  return limit ? filtered.slice(0, limit) : filtered;
}

function readHomeBootstrapPayload_(params) {
  const newScheduleLimit = Math.min(Math.max(parsePositiveInteger_(params.newScheduleLimit) || 100, 1), 100);
  const joinApplicationLimit = Math.min(Math.max(parsePositiveInteger_(params.joinApplicationLimit) || 50, 1), 100);
  const reviewLimit = Math.min(Math.max(parsePositiveInteger_(params.reviewLimit) || 200, 1), 200);
  const wishLimit = Math.min(Math.max(parsePositiveInteger_(params.wishLimit) || 200, 1), 200);
  const memberSeq = String(params.memberSeq || "").trim();
  const memberId = String(params.memberId || "").trim();
  const memberMobile = normalizePhone_(params.memberMobile || params.phone || "");
  const canReadWishes = memberMobile && (memberSeq || memberId);

  return {
    ok: true,
    updatedAt: nowKstISOString_(),
    newSchedules: filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS), {
      source: "new_schedule_builder",
      limit: newScheduleLimit
    }).map(normalizeRowForJson_),
    joinApplications: filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.JOIN_APPLICATIONS), {
      source: "join_apply",
      limit: joinApplicationLimit
    }).map(normalizeRowForJson_),
    reviews: filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.JOIN_REVIEWS), {
      source: "join_review",
      status: "visible",
      limit: reviewLimit
    }).map(normalizeRowForJson_),
    displayRules: filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.PRODUCT_DISPLAY_RULES), {
      limit: 100
    }).filter(function (row) {
      return String(row.section || "") === "available_schedule" && String(row.isVisible || "true").toLowerCase() !== "false";
    }).map(normalizeRowForJson_),
    profileCount: countCompletedJoinMemberProfiles_(),
    visitorCount: 0,
    activeUserCount: 0,
    wishes: canReadWishes
      ? filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.JOIN_WISHES), {
        source: "join_wish",
        status: "active",
        memberSeq: memberSeq,
        memberId: memberId,
        memberMobile: memberMobile,
        limit: wishLimit
      }).map(normalizeRowForJson_)
      : []
  };
}

function readHomeBootstrapLightPayload_(params) {
  const newScheduleLimit = Math.min(Math.max(parsePositiveInteger_(params.newScheduleLimit) || 100, 1), 100);
  const joinApplicationLimit = Math.min(Math.max(parsePositiveInteger_(params.joinApplicationLimit) || 100, 1), 200);
  const newSchedules = filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS), {
    source: "new_schedule_builder",
    limit: newScheduleLimit
  });
  const joinApplications = filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.JOIN_APPLICATIONS), {
    source: "join_apply",
    limit: joinApplicationLimit
  });
  const displayRules = filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.PRODUCT_DISPLAY_RULES), {
    limit: 100
  }).filter(function (row) {
    return String(row.section || "") === "available_schedule" && String(row.isVisible || "true").toLowerCase() !== "false";
  });

  return {
    ok: true,
    serverTime: nowKstISOString_(),
    updatedAt: nowKstISOString_(),
    newScheduleSummaries: newSchedules.map(buildNewScheduleSummary_),
    participantSummaries: buildParticipantSummaries_(joinApplications),
    displayRules: displayRules.map(buildDisplayRuleSummary_),
    wishTargetKeys: [],
    memberBasic: {
      hasMember: false
    }
  };
}

function buildPreviewSeed_(row, fallback) {
  return [
    row.applicationId,
    row.scheduleId,
    row.memberSeq,
    row.memberId,
    row.applicantMobile,
    row.memberMobile,
    fallback
  ].filter(Boolean).join("-");
}

function buildParticipantPreview_(row, index) {
  return {
    displayName: row.applicantName || row.creatorName || row.memberName || row.name || "",
    gender: row.applicantGender || row.creatorGender || row.gender || "",
    ageDisplay: row.applicantAgeBand || row.creatorAgeDisplay || row.ageDisplay || "",
    profession: row.applicantProfession || row.creatorProfession || row.profession || "",
    level: row.applicantLevel || row.creatorLevel || row.level || "",
    styles: splitList_(row.applicantStyles || row.creatorStyles || row.styles),
    memberPreferences: splitList_(row.applicantPreferredMembers || row.creatorMemberPreferences || row.creatorPreferredMemberComposition || row.memberPreferences),
    iconSeed: buildPreviewSeed_(row, index),
    companionGroup: row.applicantPeople && parsePeople_(row.applicantPeople) > 1 ? String(row.applicationId || row.scheduleId || "") : ""
  };
}

function splitList_(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
}

function buildCompanionPreview_(row, companion, index) {
  return {
    displayName: companion.name || companion.displayName || `동반자${index + 1}`,
    gender: companion.gender || companion || row.applicantGender || "",
    ageDisplay: row.applicantAgeBand || "",
    profession: row.applicantProfession || "",
    level: row.applicantLevel || "",
    styles: splitList_(row.applicantStyles),
    memberPreferences: splitList_(row.applicantPreferredMembers),
    iconSeed: buildPreviewSeed_(row, `companion-${index}`),
    companionGroup: String(row.applicationId || row.scheduleId || "")
  };
}

function parseCompanionPreviews_(row) {
  const raw = row.applicantCompanions || row.creatorCompanions || "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) return parsed.map(function (item, index) { return buildCompanionPreview_(row, item || {}, index); });
  } catch (error) {
    // Fall back to comma-separated values.
  }
  return String(raw).split(",").map(function (gender, index) {
    return buildCompanionPreview_(row, { gender: gender.trim() }, index);
  }).filter(function (item) { return item.gender; });
}

function buildParticipantPreviewList_(row, maxCount) {
  const count = Math.max(1, parsePeople_(row.applicantPeople || row.creatorPeople || "1"));
  const previews = [buildParticipantPreview_(row, 0)].concat(parseCompanionPreviews_(row));
  return previews.slice(0, Math.min(maxCount || 4, count));
}

function getFirstDateFromRange_(from, to) {
  return formatDateCellAsISODate_(from || to || "");
}

function buildNewScheduleSummary_(row) {
  const people = parsePeople_(row.applicantPeople || row.creatorPeople || "1");
  const capacity = 4;
  const confirmedCount = Math.min(capacity, people);
  const departureDate = getFirstDateFromRange_(row.departureDateFrom, row.departureDateTo);
  const returnDate = getFirstDateFromRange_(row.returnDateFrom, row.returnDateTo) || departureDate;
  return {
    scheduleId: row.scheduleId || "",
    applicationId: row.applicationId || "",
    targetType: "new_schedule",
    memberSeq: row.memberSeq || "",
    memberId: row.memberId || "",
    memberName: row.memberName || row.applicantName || "",
    memberChannel: row.memberChannel || "",
    memberMobile: row.memberMobile || row.applicantMobile || "",
    memberEmail: row.memberEmail || "",
    erpProductId: row.erpProductId || "",
    erpEventSeq: row.erpEventSeq || "",
    title: row.productName || "",
    country: row.country || normalizeCountryName_(row.region),
    region: normalizeRegionName_(row.region),
    airline: row.airline || "",
    departureAirport: row.departureAirport || "",
    arrivalAirport: row.arrivalAirport || "",
    departureDate: departureDate,
    returnDate: returnDate,
    price: normalizePriceCell_(row.productPrice),
    image: row.imageUrl || "",
    packType: row.packType || "",
    packTypeName: row.packTypeName || "",
    flightIncluded: row.flightIncluded || "",
    roomType: row.applicantRoomType || row.roomType || "",
    flightRequestType: row.flightRequestType || "",
    singleRoomSurchargeText: row.singleRoomSurchargeText || "",
    creatorPreview: buildParticipantPreview_(row, "creator"),
    participantsPreview: buildParticipantPreviewList_(row, 4),
    confirmedCount: confirmedCount,
    remainingSlots: Math.max(0, capacity - confirmedCount),
    approvalStatus: row.approvalStatus || row.applicationStatus || row.status || "approved",
    displayStatus: row.displayStatus || "visible",
    sortOrder: row.sortOrder || row.displayOrder || "",
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || row.createdAt || "",
    shareUrl: row.shareUrl || row.pageUrl || ""
  };
}

function getParticipantSummaryTargetType_(row) {
  const targetType = String(row.targetType || "").trim();
  const targetScheduleId = String(row.targetScheduleId || "").trim();
  if (targetType === "recommended_schedule" || targetScheduleId.indexOf("admin-recommended-") === 0) return "recommended_schedule";
  return targetType;
}

function getParticipantSummaryKey_(row) {
  const targetType = getParticipantSummaryTargetType_(row);
  const targetScheduleId = String(row.targetScheduleId || "").trim();
  if (targetType === "recommended_schedule" && targetScheduleId) {
    return ["recommended_schedule", targetScheduleId, "", "", ""].join("|");
  }
  return [
    targetType,
    row.targetScheduleId || "",
    row.targetApplicationId || "",
    row.erpProductId || "",
    row.erpEventSeq || ""
  ].join("|");
}

function buildParticipantSummaries_(rows) {
  const groups = {};
  rows.forEach(function (row) {
    const key = getParticipantSummaryKey_(row);
    if (!groups[key]) {
      groups[key] = {
        targetType: getParticipantSummaryTargetType_(row),
        targetScheduleId: row.targetScheduleId || "",
        targetApplicationId: row.targetApplicationId || "",
        erpProductId: row.erpProductId || "",
        erpEventSeq: row.erpEventSeq || "",
        confirmedCount: 0,
        remainingSlots: 4,
        participantsPreview: [],
        lastAppliedAt: ""
      };
    }
    const count = Math.max(1, parsePeople_(row.applicantPeople || row.people || "1"));
    groups[key].confirmedCount = Math.min(4, groups[key].confirmedCount + count);
    groups[key].participantsPreview = groups[key].participantsPreview.concat(buildParticipantPreviewList_(row, count)).slice(0, 4);
    groups[key].remainingSlots = Math.max(0, 4 - groups[key].confirmedCount);
    const appliedAt = String(row.updatedAt || row.createdAt || "");
    if (appliedAt > String(groups[key].lastAppliedAt || "")) groups[key].lastAppliedAt = appliedAt;
  });
  return Object.keys(groups).map(function (key) { return groups[key]; });
}

function buildDisplayRuleSummary_(row) {
  return {
    recommendedScheduleId: row.recommendedScheduleId || row.displayRuleId || "",
    targetType: "recommended_schedule",
    targetId: row.recommendedScheduleId || row.displayRuleId || row.erpProductId || "",
    erpProductId: row.erpProductId || "",
    erpEventSeq: row.erpEventSeq || "",
    section: row.section || "",
    displayStatus: row.displayStatus || (String(row.isVisible || "true").toLowerCase() === "false" ? "hidden" : "visible"),
    approvalStatus: row.approvalStatus || "approved",
    isVisible: row.isVisible,
    isPinned: row.isPinned,
    sectionKey: row.section || "",
    sortOrder: row.displayOrder || "",
    displayOrder: row.displayOrder || "",
    badge: row.badgeType || "",
    badgeType: row.badgeType || "",
    scheduleType: row.scheduleType || "",
    scheduleLabel: row.scheduleLabel || "",
    capacity: row.capacity || row.maxPeople || "",
    maxPeople: row.maxPeople || row.capacity || "",
    packType: row.packType || "",
    packTypeName: row.packTypeName || "",
    overrideTitle: row.overrideTitle || "",
    overrideImageUrl: row.overrideImageUrl || "",
    country: row.country || "",
    region: row.region || "",
    airline: row.airline || "",
    departureAirport: row.departureAirport || "",
    arrivalAirport: row.arrivalAirport || "",
    productPrice: normalizePriceCell_(row.productPrice),
    price: normalizePriceCell_(row.productPrice),
    displayStartAt: formatDateCellAsISODate_(row.displayStartAt),
    displayEndAt: formatDateCellAsISODate_(row.displayEndAt),
    tripSummary: row.tripSummary || "",
    updatedAt: row.updatedAt || ""
  };
}

function buildWishTargetKey_(row) {
  const targetType = row.targetType || "product";
  const targetKey = row.targetKey || (targetType === "join_schedule"
    ? (row.targetScheduleId || row.scheduleId || "")
    : (row.erpProductId || row.goodSeq || row.productId || ""));
  return {
    targetType: targetType,
    targetKey: targetKey,
    targetScheduleId: row.targetScheduleId || "",
    targetApplicationId: row.targetApplicationId || "",
    erpProductId: row.erpProductId || "",
    erpEventSeq: row.erpEventSeq || "",
    status: row.status || "active",
    updatedAt: row.updatedAt || row.createdAt || ""
  };
}

function countCompletedJoinMemberProfiles_() {
  return readSheetObjects_(SHEET_NAMES.JOIN_MEMBER_PROFILES).filter(function (row) {
    return Boolean(
      String(row.gender || "").trim()
      && String(row.birthYear || "").trim()
      && String(row.level || "").trim()
      && String(row.travelStyles || row.styles || "").trim()
    );
  }).length;
}

function readAdminBootstrapPayload_(params) {
  const limit = Math.min(Math.max(parsePositiveInteger_(params.limit) || 1000, 1), 3000);
  if (params.refreshSummary === "true") {
    LockService.getScriptLock().waitLock(30000);
    try {
      refreshScheduleParticipantSummary_();
    } finally {
      LockService.getScriptLock().releaseLock();
    }
  }
  return {
    ok: true,
    updatedAt: nowKstISOString_(),
    builderRows: filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS), {
      limit: limit
    }).map(normalizeRowForJson_),
    joinRows: filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.JOIN_APPLICATIONS), {
      limit: limit
    }).map(normalizeRowForJson_),
    profileRows: filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.JOIN_MEMBER_PROFILES), {
      limit: limit
    }).map(normalizeRowForJson_),
    displayRuleRows: filterRowsForRequest_(readSheetObjects_(SHEET_NAMES.PRODUCT_DISPLAY_RULES), {
      limit: limit
    }).map(normalizeRowForJson_)
  };
}

function normalizePhone_(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^1[016789]\d{8}$/.test(digits)) return `0${digits}`;
  return digits;
}

function normalizeRowForJson_(row) {
  return Object.keys(row).reduce(function (object, key) {
    object[key] = normalizeCellForJson_(row[key], key);
    return object;
  }, {});
}

function normalizeCellForJson_(value, key) {
  if (key === "productPrice") {
    return normalizePriceCell_(value);
  }
  if ([
    "departureDateFrom",
    "departureDateTo",
    "returnDateFrom",
    "returnDateTo",
    "departureDate",
    "returnDate",
    "displayStartAt",
    "displayEndAt"
  ].indexOf(key) !== -1) {
    return formatDateCellAsISODate_(value);
  }
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (["memberMobile", "applicantMobile", "creatorPhone"].indexOf(key) !== -1) {
    return normalizePhone_(value);
  }
  return value;
}

function parsePositiveInteger_(value) {
  const count = Number(String(value || "").replace(/\D/g, ""));
  return Number.isFinite(count) && count > 0 ? count : 0;
}


function stringifyCompanions_(value) {
  if (!value) return "";
  return JSON.stringify(Array.isArray(value) ? value : [value]);
}
