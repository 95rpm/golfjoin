const SHEET_NAME = "new_schedule_applications";

function doPost(e) {
  const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  const sheet = getOrCreateSheet_();
  const row = [
    payload.submittedAt || new Date().toISOString(),
    payload.source || "",
    payload.pageUrl || "",
    value_(payload, "applicant.name"),
    value_(payload, "applicant.gender"),
    value_(payload, "applicant.birthYear"),
    value_(payload, "applicant.ageDisplay"),
    value_(payload, "applicant.phone"),
    value_(payload, "applicant.profession"),
    value_(payload, "applicant.people"),
    value_(payload, "applicant.level"),
    join_(value_(payload, "applicant.styles")),
    value_(payload, "applicant.greeting"),
    value_(payload, "trip.region"),
    join_(value_(payload, "trip.regions")),
    value_(payload, "trip.productId"),
    value_(payload, "trip.productName"),
    value_(payload, "trip.startSummary"),
    value_(payload, "trip.endSummary"),
    value_(payload, "trip.tripSummary"),
    join_(value_(payload, "trip.departureDates")),
    join_(value_(payload, "trip.returnDates")),
    value_(payload, "trip.flexibleDays.startBefore"),
    value_(payload, "trip.flexibleDays.startAfter"),
    value_(payload, "trip.flexibleDays.endBefore"),
    value_(payload, "trip.flexibleDays.endAfter"),
    value_(payload, "agreements.required"),
    value_(payload, "agreements.marketing")
  ];

  LockService.getScriptLock().waitLock(30000);
  try {
    sheet.appendRow(row);
  } finally {
    LockService.getScriptLock().releaseLock();
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "submittedAt",
      "source",
      "pageUrl",
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
      "region",
      "regions",
      "productId",
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
      "marketingAgreed"
    ]);
  }
  return sheet;
}

function value_(object, path) {
  return String(path).split(".").reduce(function (current, key) {
    return current && current[key] !== undefined && current[key] !== null ? current[key] : "";
  }, object);
}

function join_(value) {
  return Array.isArray(value) ? value.join(", ") : value || "";
}
