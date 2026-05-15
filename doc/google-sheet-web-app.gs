const SHEET_NAMES = {
  NEW_SCHEDULE_APPLICATIONS: "new_schedule_applications",
  JOIN_APPLICATIONS: "join_applications",
  SCHEDULE_PARTICIPANT_SUMMARY: "schedule_participant_summary",
  PRODUCT_DISPLAY_RULES: "product_display_rules"
};

const SHEET_HEADERS = {
  [SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS]: [
    "applicationId",
    "scheduleId",
    "submittedAt",
    "source",
    "pageUrl",
    "creatorName",
    "creatorGender",
    "creatorBirthYear",
    "creatorAgeDisplay",
    "creatorPhone",
    "creatorProfession",
    "creatorPeople",
    "creatorLevel",
    "creatorStyles",
    "creatorGreeting",
    "region",
    "regions",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "startSummary",
    "endSummary",
    "tripSummary",
    "departureDates",
    "returnDates",
    "startBefore",
    "startAfter",
    "endBefore",
    "endAfter",
    "requiredAgreed",
    "marketingAgreed",
    "approvalStatus",
    "displayStatus",
    "status",
    "linkedErpProductId",
    "adminMemo",
    "updatedAt"
  ],
  [SHEET_NAMES.JOIN_APPLICATIONS]: [
    "applicationId",
    "submittedAt",
    "source",
    "targetType",
    "targetScheduleId",
    "targetApplicationId",
    "erpProductId",
    "erpEventSeq",
    "productName",
    "departureDate",
    "returnDate",
    "category",
    "region",
    "airport",
    "name",
    "gender",
    "birthYear",
    "ageDisplay",
    "phone",
    "profession",
    "people",
    "level",
    "styles",
    "greeting",
    "status",
    "requiredAgreed",
    "marketingAgreed",
    "pageUrl",
    "adminMemo",
    "updatedAt"
  ],
  [SHEET_NAMES.SCHEDULE_PARTICIPANT_SUMMARY]: [
    "scheduleId",
    "sourceApplicationId",
    "title",
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
    "status",
    "approvalStatus",
    "displayStatus",
    "updatedAt"
  ],
  [SHEET_NAMES.PRODUCT_DISPLAY_RULES]: [
    "erpProductId",
    "erpEventSeq",
    "section",
    "visible",
    "pinned",
    "sortOrder",
    "badgeKind",
    "customTitle",
    "customImage",
    "displayStartAt",
    "displayEndAt",
    "adminMemo",
    "updatedAt"
  ]
};

function doPost(e) {
  const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  setupGolfJoinSheets();

  const source = payload.source || "new_schedule_builder";
  const sheetName = source === "join_apply"
    ? SHEET_NAMES.JOIN_APPLICATIONS
    : SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS;
  const headers = SHEET_HEADERS[sheetName];
  const row = headers.map(function (header) {
    return getPayloadColumnValue_(payload, header, sheetName);
  });

  LockService.getScriptLock().waitLock(30000);
  try {
    getOrCreateSheet_(sheetName).appendRow(row);
    if (sheetName === SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS || value_(payload, "targetType") === "new_schedule") {
      refreshScheduleParticipantSummary_();
    }
  } finally {
    LockService.getScriptLock().releaseLock();
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sheet: sheetName }))
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

function ensureSheetHeaders_(sheetName, headers) {
  const sheet = getOrCreateSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);

  if (lastRow === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].slice(0, headers.length);
  const matches = headers.every(function (header, index) {
    return currentHeaders[index] === header;
  });
  if (matches) return sheet;

  if (sheetName === SHEET_NAMES.NEW_SCHEDULE_APPLICATIONS) {
    migrateSheetToHeaders_(sheet, headers, mapLegacyNewScheduleRow_);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function migrateSheetToHeaders_(sheet, headers, mapper) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    sheet.appendRow(headers);
    return;
  }

  const oldHeaders = values[0].map(String);
  const migratedRows = values.slice(1).map(function (row, rowIndex) {
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
  const submittedAt = row.submittedAt || new Date().toISOString();
  const applicationId = row.applicationId || buildId_("nsa", submittedAt, row.phone || row.creatorPhone || rowIndex + 1);
  const scheduleId = row.scheduleId || buildId_("sch", applicationId);
  const aliases = {
    applicationId: applicationId,
    scheduleId: scheduleId,
    creatorName: row.creatorName || row.name,
    creatorGender: row.creatorGender || row.gender,
    creatorBirthYear: row.creatorBirthYear || row.birthYear,
    creatorAgeDisplay: row.creatorAgeDisplay || row.ageDisplay,
    creatorPhone: row.creatorPhone || row.phone,
    creatorProfession: row.creatorProfession || row.profession,
    creatorPeople: row.creatorPeople || row.people,
    creatorLevel: row.creatorLevel || row.level,
    creatorStyles: row.creatorStyles || row.styles,
    creatorGreeting: row.creatorGreeting || row.greeting,
    erpProductId: row.erpProductId || row.productId,
    erpEventSeq: row.erpEventSeq || row.eventSeq,
    approvalStatus: row.approvalStatus || "pending",
    displayStatus: row.displayStatus || "visible",
    status: row.status || "open",
    updatedAt: row.updatedAt || new Date().toISOString()
  };
  return aliases[header] !== undefined ? aliases[header] : row[header] || "";
}

function getPayloadColumnValue_(payload, header, sheetName) {
  if (sheetName === SHEET_NAMES.JOIN_APPLICATIONS) {
    return getJoinApplicationValue_(payload, header);
  }
  return getNewScheduleApplicationValue_(payload, header);
}

function getNewScheduleApplicationValue_(payload, header) {
  const submittedAt = payload.submittedAt || new Date().toISOString();
  const applicationId = payload.applicationId || buildId_("nsa", submittedAt, value_(payload, "applicant.phone"));
  const scheduleId = payload.scheduleId || buildId_("sch", applicationId);
  const values = {
    applicationId: applicationId,
    scheduleId: scheduleId,
    submittedAt: submittedAt,
    source: payload.source || "new_schedule_builder",
    pageUrl: payload.pageUrl || "",
    creatorName: value_(payload, "applicant.name"),
    creatorGender: value_(payload, "applicant.gender"),
    creatorBirthYear: value_(payload, "applicant.birthYear"),
    creatorAgeDisplay: value_(payload, "applicant.ageDisplay"),
    creatorPhone: value_(payload, "applicant.phone"),
    creatorProfession: value_(payload, "applicant.profession"),
    creatorPeople: value_(payload, "applicant.people"),
    creatorLevel: value_(payload, "applicant.level"),
    creatorStyles: join_(value_(payload, "applicant.styles")),
    creatorGreeting: value_(payload, "applicant.greeting"),
    region: value_(payload, "trip.region"),
    regions: join_(value_(payload, "trip.regions")),
    erpProductId: value_(payload, "trip.erpProductId") || value_(payload, "trip.productId"),
    erpEventSeq: value_(payload, "trip.erpEventSeq") || value_(payload, "trip.eventSeq"),
    productName: value_(payload, "trip.productName"),
    startSummary: value_(payload, "trip.startSummary"),
    endSummary: value_(payload, "trip.endSummary"),
    tripSummary: value_(payload, "trip.tripSummary"),
    departureDates: join_(value_(payload, "trip.departureDates")),
    returnDates: join_(value_(payload, "trip.returnDates")),
    startBefore: value_(payload, "trip.flexibleDays.startBefore"),
    startAfter: value_(payload, "trip.flexibleDays.startAfter"),
    endBefore: value_(payload, "trip.flexibleDays.endBefore"),
    endAfter: value_(payload, "trip.flexibleDays.endAfter"),
    requiredAgreed: value_(payload, "agreements.required"),
    marketingAgreed: value_(payload, "agreements.marketing"),
    approvalStatus: payload.approvalStatus || "pending",
    displayStatus: payload.displayStatus || "visible",
    status: payload.status || "open",
    linkedErpProductId: payload.linkedErpProductId || "",
    adminMemo: payload.adminMemo || "",
    updatedAt: new Date().toISOString()
  };
  return values[header] !== undefined ? values[header] : "";
}

function getJoinApplicationValue_(payload, header) {
  const submittedAt = payload.submittedAt || new Date().toISOString();
  const applicationId = payload.applicationId || payload.joinApplyId || buildId_("join", submittedAt, value_(payload, "applicant.phone"));
  const values = {
    applicationId: applicationId,
    submittedAt: submittedAt,
    source: payload.source || "join_apply",
    targetType: payload.targetType || value_(payload, "target.type") || "erp_product",
    targetScheduleId: payload.targetScheduleId || value_(payload, "target.scheduleId"),
    targetApplicationId: payload.targetApplicationId || value_(payload, "target.applicationId"),
    erpProductId: payload.erpProductId || value_(payload, "product.erpProductId") || value_(payload, "product.productId"),
    erpEventSeq: payload.erpEventSeq || value_(payload, "product.erpEventSeq") || value_(payload, "product.eventSeq"),
    productName: value_(payload, "product.productName") || payload.productName,
    departureDate: value_(payload, "product.departureDate") || payload.departureDate,
    returnDate: value_(payload, "product.returnDate") || payload.returnDate,
    category: value_(payload, "product.category") || payload.category,
    region: value_(payload, "product.region") || payload.region,
    airport: value_(payload, "product.airport") || payload.airport,
    name: value_(payload, "applicant.name"),
    gender: value_(payload, "applicant.gender"),
    birthYear: value_(payload, "applicant.birthYear"),
    ageDisplay: value_(payload, "applicant.ageDisplay"),
    phone: value_(payload, "applicant.phone"),
    profession: value_(payload, "applicant.profession"),
    people: value_(payload, "applicant.people"),
    level: value_(payload, "applicant.level"),
    styles: join_(value_(payload, "applicant.styles")),
    greeting: value_(payload, "applicant.greeting"),
    status: payload.status || "confirmed",
    requiredAgreed: value_(payload, "agreements.required"),
    marketingAgreed: value_(payload, "agreements.marketing"),
    pageUrl: payload.pageUrl || "",
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
    const confirmedJoins = relatedJoins.filter(function (join) { return join.status !== "cancelled"; });
    const cancelledJoins = relatedJoins.filter(function (join) { return join.status === "cancelled"; });
    const pendingJoins = relatedJoins.filter(function (join) { return join.status === "pending"; });
    const creatorPeople = parsePeople_(schedule.creatorPeople || "1명");
    const joinedPeople = confirmedJoins.reduce(function (sum, join) { return sum + parsePeople_(join.people); }, 0);
    const confirmedPeople = creatorPeople + joinedPeople;
    const capacity = Math.max(4, confirmedPeople);
    const participants = [
      {
        name: schedule.creatorName,
        phone: schedule.creatorPhone,
        gender: schedule.creatorGender,
        age: schedule.creatorAgeDisplay,
        level: schedule.creatorLevel,
        styles: schedule.creatorStyles
      }
    ].concat(confirmedJoins.map(function (join) {
      return {
        name: join.name,
        phone: join.phone,
        gender: join.gender,
        age: join.ageDisplay,
        level: join.level,
        styles: join.styles
      };
    }));
    const values = {
      scheduleId: scheduleId,
      sourceApplicationId: schedule.applicationId,
      title: schedule.productName || `${schedule.region || "새일정"} 맞춤 조인`,
      region: schedule.region,
      departureSummary: schedule.startSummary || schedule.departureDates,
      returnSummary: schedule.endSummary || schedule.returnDates,
      tripSummary: schedule.tripSummary,
      creatorName: schedule.creatorName,
      creatorPhone: schedule.creatorPhone,
      capacity: capacity,
      creatorPeople: creatorPeople,
      joinedPeople: joinedPeople,
      confirmedPeople: confirmedPeople,
      pendingPeople: pendingJoins.reduce(function (sum, join) { return sum + parsePeople_(join.people); }, 0),
      cancelledPeople: cancelledJoins.reduce(function (sum, join) { return sum + parsePeople_(join.people); }, 0),
      remainingSeats: Math.max(0, capacity - confirmedPeople),
      participantNames: participants.map(function (item) { return item.name; }).filter(Boolean).join(", "),
      participantPhones: participants.map(function (item) { return item.phone; }).filter(Boolean).join(", "),
      genderSummary: summarize_(participants.map(function (item) { return item.gender; })),
      ageSummary: summarize_(participants.map(function (item) { return item.age; })),
      levelSummary: summarize_(participants.map(function (item) { return item.level; })),
      styleSummary: summarize_(participants.flatMap(function (item) { return String(item.styles || "").split(",").map(function (style) { return style.trim(); }); })),
      status: schedule.status || "open",
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
  return values.slice(1).map(function (row) {
    return rowToObject_(headers, row);
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
  const since = params.since ? new Date(params.since).getTime() : 0;

  if (source) {
    filtered = filtered.filter(function (row) { return String(row.source || "") === source; });
  }
  if (status) {
    filtered = filtered.filter(function (row) { return String(row.status || "") === status; });
  }
  if (displayStatus) {
    filtered = filtered.filter(function (row) { return String(row.displayStatus || "") === displayStatus; });
  }
  if (approvalStatus) {
    filtered = filtered.filter(function (row) { return String(row.approvalStatus || "") === approvalStatus; });
  }
  if (since) {
    filtered = filtered.filter(function (row) {
      const updatedAt = new Date(row.updatedAt || row.submittedAt || 0).getTime();
      return updatedAt && updatedAt >= since;
    });
  }

  filtered = filtered.sort(function (a, b) {
    return new Date(b.updatedAt || b.submittedAt || 0).getTime() - new Date(a.updatedAt || a.submittedAt || 0).getTime();
  });

  const limit = parsePositiveInteger_(params.limit);
  return limit ? filtered.slice(0, limit) : filtered;
}

function normalizeRowForJson_(row) {
  return Object.keys(row).reduce(function (object, key) {
    object[key] = normalizeCellForJson_(row[key]);
    return object;
  }, {});
}

function normalizeCellForJson_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return value;
}

function parsePositiveInteger_(value) {
  const count = Number(String(value || "").replace(/\D/g, ""));
  return Number.isFinite(count) && count > 0 ? count : 0;
}
