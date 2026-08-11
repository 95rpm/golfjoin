'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { summarizeHar } = require('./analyze-har');

function entry(overrides = {}) {
  return {
    startedDateTime: '2026-08-05T00:00:00.000Z',
    time: 100,
    _resourceType: 'fetch',
    _priority: 'High',
    request: { method: 'GET', url: 'https://example.com/file.json' },
    response: { status: 200, _transferSize: 123 },
    timings: { wait: 80, receive: 10 },
    ...overrides,
  };
}

test('sanitized HAR의 페이지·전송량·API 타임라인을 요약한다', () => {
  const har = {
    log: {
      _sanitized: { responseBodiesRemoved: true },
      pages: [{
        title: 'https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1',
        startedDateTime: '2026-08-05T00:00:00.000Z',
        pageTimings: { onContentLoad: 200, onLoad: 400 },
      }],
      entries: [
        entry({
          request: { method: 'GET', url: 'https://asia-northeast3-example.cloudfunctions.net/golfjoin-sheet-api?action=home_stats' },
        }),
        entry({
          startedDateTime: '2026-08-05T00:00:00.100Z',
          time: 50,
          _resourceType: 'image',
          request: { method: 'GET', url: 'https://www.secret-tour.com/upload/secrettour/image/goods/main/30001104/image.jpg' },
          response: { status: 200, _transferSize: 456 },
          _initiator: { type: 'script', stack: { callFrames: [{ functionName: 'preloadMdPickCountryImages' }] } },
        }),
      ],
    },
  };

  const report = summarizeHar(har);
  assert.equal(report.entries, 2);
  assert.equal(report.totalTransferBytes, 579);
  assert.equal(report.page.onLoadMs, 400);
  assert.equal(report.golfjoinApiTimeline[0].label, 'golfjoin-sheet-api?action=home_stats');
  assert.equal(report.productImageTimeline[0].goodSeq, '30001104');
  assert.deepEqual(report.productImageTimeline[0].initiatorFunctions, ['preloadMdPickCountryImages']);
});

test('원본 HAR은 분석하지 않는다', () => {
  assert.throws(() => summarizeHar({ log: { entries: [entry()] } }), /unsanitized/);
});

