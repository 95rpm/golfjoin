const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Range {
  constructor(sheet, row, column, numRows, numColumns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getValues() {
    return Array.from({ length: this.numRows }, (_, rowOffset) => {
      const sourceRow = this.sheet.rows[this.row - 1 + rowOffset] || [];
      return Array.from({ length: this.numColumns }, (_, columnOffset) => sourceRow[this.column - 1 + columnOffset] || '');
    });
  }

  setValues(values) {
    values.forEach((rowValues, rowOffset) => {
      const rowIndex = this.row - 1 + rowOffset;
      this.sheet.rows[rowIndex] = this.sheet.rows[rowIndex] || [];
      rowValues.forEach((value, columnOffset) => {
        this.sheet.rows[rowIndex][this.column - 1 + columnOffset] = value;
      });
    });
  }

  clearContent() {
    for (let rowOffset = 0; rowOffset < this.numRows; rowOffset += 1) {
      const rowIndex = this.row - 1 + rowOffset;
      this.sheet.rows[rowIndex] = this.sheet.rows[rowIndex] || [];
      for (let columnOffset = 0; columnOffset < this.numColumns; columnOffset += 1) {
        this.sheet.rows[rowIndex][this.column - 1 + columnOffset] = '';
      }
    }
  }
}

class Sheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
  }

  getLastRow() {
    return this.rows.length;
  }

  getLastColumn() {
    return this.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }

  appendRow(row) {
    this.rows.push([...row]);
  }

  getRange(row, column, numRows, numColumns) {
    return new Range(this, row, column, numRows, numColumns);
  }

  getDataRange() {
    return new Range(this, 1, 1, this.getLastRow(), this.getLastColumn());
  }

  clearContents() {
    this.rows = [];
  }
}

class Spreadsheet {
  constructor() {
    this.sheets = new Map();
  }

  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }

  insertSheet(name) {
    const sheet = new Sheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

function createSandbox() {
  const spreadsheet = new Spreadsheet();
  const sandbox = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        return {
          text,
          mimeType: '',
          setMimeType(mimeType) {
            this.mimeType = mimeType;
            return this;
          },
        };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('doc/google-sheet-web-app.gs', 'utf8'), sandbox);
  return { sandbox, spreadsheet };
}

function appendObject(sheet, object) {
  const headers = sheet.rows[0];
  sheet.appendRow(headers.map((header) => object[header] || ''));
}

(function testDoGetReturnsOnlySafeBuilderRows() {
  const { sandbox, spreadsheet } = createSandbox();
  sandbox.setupGolfJoinSheets();
  const sheet = spreadsheet.getSheetByName('new_schedule_applications');

  appendObject(sheet, {
    applicationId: 'older',
    scheduleId: 'sch-older',
    submittedAt: '2026-05-01T00:00:00.000Z',
    source: 'new_schedule_builder',
    creatorName: '홍길동',
    creatorPhone: '01012345678',
    creatorBirthYear: '1980',
    creatorAgeDisplay: '40대',
    creatorStyles: '매너중시, 명랑골프',
    preferredGroupType: 'beginner',
    region: '다낭',
    regions: '다낭, 호이안',
    erpProductId: 'PKG-1',
    erpEventSeq: 'EVT-1',
    productName: '다낭 골프',
    departureDates: '2026-06-01, 2026-06-02',
    displayStatus: 'visible',
    status: 'open',
  });
  appendObject(sheet, {
    applicationId: 'hidden',
    submittedAt: '2026-05-02T00:00:00.000Z',
    source: 'new_schedule_builder',
    creatorName: '김숨김',
    displayStatus: 'hidden',
    status: 'open',
  });
  appendObject(sheet, {
    applicationId: 'other-source',
    submittedAt: '2026-05-03T00:00:00.000Z',
    source: 'legacy_import',
    creatorName: '이레거시',
    displayStatus: 'visible',
    status: 'open',
  });

  const response = sandbox.doGet({ parameter: { sheet: 'new_schedule_applications', source: 'new_schedule_builder', limit: '10' } });
  const body = JSON.parse(response.text);

  assert.equal(response.mimeType, 'application/json');
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].applicationId, 'older');
  assert.equal(body.items[0].applicant.name, '홍**');
  assert.equal(body.items[0].applicant.phone, '');
  assert.equal(body.items[0].applicant.birthYear, '');
  assert.deepEqual(body.items[0].applicant.styles, ['매너중시', '명랑골프']);
  assert.deepEqual(body.items[0].trip.regions, ['다낭', '호이안']);
  assert.equal(body.items[0].trip.erpEventSeq, 'EVT-1');
})();

(function testDoPostStoresPreferredGroupType() {
  const { sandbox, spreadsheet } = createSandbox();
  const payload = {
    source: 'new_schedule_builder',
    submittedAt: '2026-05-15T00:00:00.000Z',
    applicant: {
      name: '박테스트',
      phone: '01087654321',
      preferredGroupType: 'women',
      styles: ['사진도좋아요'],
    },
    trip: {
      region: '오키나와',
      productName: '오키나와 골프',
      departureDates: ['2026-07-01'],
    },
    agreements: { required: true, marketing: false },
  };

  const response = sandbox.doPost({ postData: { contents: JSON.stringify(payload) } });
  const body = JSON.parse(response.text);
  const sheet = spreadsheet.getSheetByName('new_schedule_applications');
  const headers = sheet.rows[0];
  const row = sheet.rows[1];

  assert.equal(body.ok, true);
  assert.equal(body.sheet, 'new_schedule_applications');
  assert.equal(row[headers.indexOf('preferredGroupType')], 'women');
  assert.equal(row[headers.indexOf('creatorStyles')], '사진도좋아요');
})();

console.log('google-sheet-web-app tests passed');
