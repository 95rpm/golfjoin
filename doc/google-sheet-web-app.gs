const SHEET_NAMES = {
  NEW_SCHEDULE_APPLICATIONS: "new_schedule_applications",
  JOIN_APPLICATIONS: "join_applications",
  JOIN_MEMBER_PROFILES: "join_member_profiles",
  JOIN_REVIEWS: "join_reviews",
  JOIN_WISHES: "join_wishes",
  SCHEDULE_PARTICIPANT_SUMMARY: "schedule_participant_summary",
  PRODUCT_DISPLAY_RULES: "product_display_rules"
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
    "country",
    "region",
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
    "updatedAt"
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
    "airport",
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
    "participantStatus",
    "quoteStatus",
    "depositStatus",
    "balanceStatus",
    "refundStatus",
    "applicationStatus",
    "requiredAgreed",
    "marketingAgreed",
    "adminMemo",
    "updatedAt"
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
    "erpProductId",
    "erpEventSeq",
    "section",
    "isVisible",
    "isPinned",
    "displayOrder",
    "badgeType",
    "overrideTitle",
    "overrideImageUrl",
    "displayStartAt",
    "displayEndAt",
    "adminMemo",
    "updatedAt"
  ]
};

const TEXT_FORMAT_HEADERS = [
  "memberMobile",
  "applicantMobile",
  "creatorPhone",
  "participantPhones"
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
          : SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS;
  const headers = SHEET_HEADERS[sheetName];
  const row = headers.map(function (header) {
    return getPayloadColumnValue_(payload, header, sheetName);
  });

  LockService.getScriptLock().waitLock(30000);
  let writeResult = { action: "append" };
  try {
    writeResult = writeSheetRow_(sheetName, headers, row, payload);
    if (sheetName === SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS || value_(payload, "targetType") === "new_schedule") {
      refreshScheduleParticipantSummary_();
    }
  } finally {
    LockService.getScriptLock().releaseLock();
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sheet: sheetName, write: writeResult.action, row: writeResult.row }))
    .setMimeType(ContentService.MimeType.JSON);
}


function doGet(e) {
  const params = (e && e.parameter) || {};
  setupGolfJoinSheets();

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
      updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString()
  });
}

function setupGolfJoinSheets() {
  Object.keys(SHEET_HEADERS).forEach(function (sheetName) {
    ensureSheetHeaders_(sheetName, SHEET_HEADERS[sheetName]);
  });
}

function getOrCreateSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
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
      sheet.getRange(rowNumber, updatedAtIndex + 1).setValue(new Date().toISOString());
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
  const createdAt = row.createdAt || row.submittedAt || new Date().toISOString();
  const applicationId = row.applicationId || buildId_("nsa", createdAt, row.applicantMobile || row.phone || row.creatorPhone || rowIndex + 1);
  const scheduleId = row.scheduleId || buildId_("sch", applicationId);
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
    updatedAt: row.updatedAt || new Date().toISOString()
  };
  return aliases[header] !== undefined ? aliases[header] : row[header] || "";
}


function mapLegacyGenericRow_(row, header) {
  if (header === "country") return row.country || normalizeCountryName_(row.region);
  if (header === "region") return normalizeRegionName_(row.region);
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
    applicationStatus: row.applicationStatus || row.status,
    profileImageObjectName: row.profileImageObjectName || row.objectName,
    profileImageSize: row.profileImageSize || row.photoSize,
    isVisible: row.isVisible !== undefined ? row.isVisible : row.visible,
    isPinned: row.isPinned !== undefined ? row.isPinned : row.pinned,
    displayOrder: row.displayOrder || row.sortOrder,
    badgeType: row.badgeType || row.badgeKind,
    overrideTitle: row.overrideTitle || row.customTitle,
    overrideImageUrl: row.overrideImageUrl || row.customImage
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
  return getNewScheduleApplicationValue_(payload, header);
}

function getNewScheduleApplicationValue_(payload, header) {
  const createdAt = payload.createdAt || payload.submittedAt || new Date().toISOString();
  const applicationId = payload.applicationId || buildId_("nsa", createdAt, value_(payload, "applicant.phone"));
  const scheduleId = payload.scheduleId || buildId_("sch", applicationId);
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
    country: value_(payload, "trip.country") || normalizeCountryName_(value_(payload, "trip.region")) || normalizeCountryList_(value_(payload, "trip.regions")),
    region: normalizeRegionName_(value_(payload, "trip.region")),
    erpProductId: value_(payload, "trip.erpProductId") || value_(payload, "trip.productId"),
    erpEventSeq: value_(payload, "trip.erpEventSeq") || value_(payload, "trip.eventSeq"),
    productName: value_(payload, "trip.productName"),
    productPrice: value_(payload, "trip.productPrice") || payload.productPrice || payload.price,
    packType: value_(payload, "trip.packType") || payload.packType,
    packTypeName: value_(payload, "trip.packTypeName") || payload.packTypeName,
    tripSummary: value_(payload, "trip.tripSummary"),
    departureDateFrom: value_(payload, "trip.flexibleDays.startBefore") || firstListValue_(value_(payload, "trip.departureDates")) || value_(payload, "trip.startSummary"),
    departureDateTo: value_(payload, "trip.flexibleDays.startAfter") || lastListValue_(value_(payload, "trip.departureDates")) || value_(payload, "trip.startSummary"),
    returnDateFrom: value_(payload, "trip.flexibleDays.endBefore") || firstListValue_(value_(payload, "trip.returnDates")) || value_(payload, "trip.endSummary"),
    returnDateTo: value_(payload, "trip.flexibleDays.endAfter") || lastListValue_(value_(payload, "trip.returnDates")) || value_(payload, "trip.endSummary"),
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
    updatedAt: new Date().toISOString()
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinApplicationValue_(payload, header) {
  const createdAt = payload.createdAt || payload.submittedAt || new Date().toISOString();
  const applicationId = payload.applicationId || payload.joinApplyId || buildId_("join", createdAt, value_(payload, "applicant.phone"));
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
    erpProductId: payload.erpProductId || value_(payload, "product.erpProductId") || value_(payload, "product.productId"),
    erpEventSeq: payload.erpEventSeq || value_(payload, "product.erpEventSeq") || value_(payload, "product.eventSeq"),
    productName: value_(payload, "product.productName") || payload.productName,
    departureDate: value_(payload, "product.departureDate") || payload.departureDate,
    returnDate: value_(payload, "product.returnDate") || payload.returnDate,
    category: value_(payload, "product.category") || payload.category,
    country: value_(payload, "product.country") || payload.country || normalizeCountryName_(value_(payload, "product.region") || payload.region),
    region: normalizeRegionName_(value_(payload, "product.region") || payload.region),
    airport: value_(payload, "product.airport") || payload.airport,
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
    participantStatus: payload.participantStatus || value_(payload, "payment.participantStatus") || "신청",
    quoteStatus: payload.quoteStatus || value_(payload, "payment.quoteStatus") || "",
    depositStatus: payload.depositStatus || value_(payload, "payment.depositStatus") || "",
    balanceStatus: payload.balanceStatus || value_(payload, "payment.balanceStatus") || "",
    refundStatus: payload.refundStatus || value_(payload, "payment.refundStatus") || "",
    applicationStatus: payload.applicationStatus || payload.status || "confirmed",
    requiredAgreed: value_(payload, "agreements.required"),
    marketingAgreed: value_(payload, "agreements.marketing"),
    adminMemo: payload.adminMemo || "",
    updatedAt: new Date().toISOString()
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinMemberProfileValue_(payload, header) {
  const createdAt = payload.createdAt || payload.submittedAt || new Date().toISOString();
  const mobile = value_(payload, "member.memberMobile");
  const profileId = payload.profileId || buildId_("jmp", createdAt, value_(payload, "member.memberSeq") || value_(payload, "member.memberId") || mobile);
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
    updatedAt: new Date().toISOString()
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinReviewValue_(payload, header) {
  const createdAt = payload.createdAt || payload.submittedAt || new Date().toISOString();
  const reviewId = payload.reviewId || buildId_("jr", createdAt, value_(payload, "member.memberSeq") || value_(payload, "member.memberId") || value_(payload, "member.memberMobile"), value_(payload, "product.erpProductId") || payload.erpProductId || value_(payload, "product.productName"));
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
    country: value_(payload, "product.country") || payload.country || normalizeCountryName_(value_(payload, "product.region") || payload.region),
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
    updatedAt: new Date().toISOString()
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinWishValue_(payload, header) {
  const createdAt = payload.createdAt || payload.savedAt || new Date().toISOString();
  const targetType = payload.targetType || value_(payload, "target.type") || "product";
  const targetKey = payload.targetKey || value_(payload, "target.targetKey") || value_(payload, "target.key") || value_(payload, "product.erpProductId") || value_(payload, "product.productId") || payload.erpProductId || payload.goodSeq || "";
  const wishId = payload.wishId || buildId_("jw", value_(payload, "member.memberSeq") || value_(payload, "member.memberId") || value_(payload, "member.memberMobile"), targetType, targetKey);
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
    country: value_(payload, "product.country") || payload.country || normalizeCountryName_(value_(payload, "product.region") || payload.region),
    region: normalizeRegionName_(value_(payload, "product.region") || payload.region),
    imageUrl: value_(payload, "product.imageUrl") || payload.imageUrl,
    price: value_(payload, "product.price") || payload.price,
    status: payload.status || "active",
    adminMemo: payload.adminMemo || "",
    updatedAt: new Date().toISOString()
  };
  return values[header] !== undefined ? values[header] : "";
}

function refreshScheduleParticipantSummary_() {
  const summarySheet = ensureSheetHeaders_(SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY, SHEET_HEADERS[SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY]);
  const newScheduleRows = readSheetObjects_(SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS);
  const joinRows = readSheetObjects_(SHEET_NAMES.JOIN_APPLICATIONS);
  const headers = SHEET_HEADERS[SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY];

  const summaryRows = newScheduleRows.map(function (schedule) {
    const scheduleId = schedule.scheduleId;
    const relatedJoins = joinRows.filter(function (join) {
      return join.targetType === "new_schedule" && join.targetScheduleId === scheduleId;
    });
    const confirmedJoins = relatedJoins.filter(function (join) { return (join.applicationStatus || join.status) !== "cancelled"; });
    const cancelledJoins = relatedJoins.filter(function (join) { return (join.applicationStatus || join.status) === "cancelled"; });
    const pendingJoins = relatedJoins.filter(function (join) { return (join.applicationStatus || join.status) === "pending"; });
    const normalizedCreatorPeople = parsePeople_(schedule.applicantPeople || schedule.creatorPeople || "1");
    const normalizedJoinedPeople = confirmedJoins.reduce(function (sum, join) { return sum + parsePeople_(join.applicantPeople || join.people); }, 0);
    const rawConfirmedPeople = normalizedCreatorPeople + normalizedJoinedPeople;
    const capacity = 4;
    const confirmedPeople = Math.min(capacity, rawConfirmedPeople);
    const participants = [
      {
        name: schedule.applicantName || schedule.creatorName,
        phone: schedule.applicantMobile || schedule.creatorPhone,
        gender: schedule.applicantGender || schedule.creatorGender,
        age: schedule.applicantAgeBand || schedule.creatorAgeDisplay,
        level: schedule.applicantLevel || schedule.creatorLevel,
        styles: schedule.applicantStyles || schedule.creatorStyles,
        memberPreferences: schedule.applicantPreferredMembers || schedule.creatorMemberPreferences || schedule.creatorPreferredMemberComposition
      }
    ].concat(confirmedJoins.map(function (join) {
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
      sourceApplicationId: schedule.applicationId,
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
      updatedAt: new Date().toISOString()
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
  const start = String(from || "").trim();
  const end = String(to || "").trim();
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end || "";
}

function buildId_(prefix) {
  const parts = Array.prototype.slice.call(arguments, 1).join("-");
  const safe = String(parts || new Date().toISOString()).replace(/[^a-z0-9가-힣_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${prefix}_${safe}`;
}

function value_(object, path) {
  return String(path).split(".").reduce(function (current, key) {
    return current && current[key] !== undefined && current[key] !== null ? current[key] : "";
  }, object);
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
  if (memberSeq) {
    filtered = filtered.filter(function (row) { return String(row.memberSeq || "") === memberSeq; });
  } else if (memberId) {
    filtered = filtered.filter(function (row) { return String(row.memberId || "") === memberId; });
  } else if (memberMobile) {
    filtered = filtered.filter(function (row) {
      return normalizePhone_(row.memberMobile || row.applicantMobile || row.creatorPhone || row.phone || "") === memberMobile;
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
