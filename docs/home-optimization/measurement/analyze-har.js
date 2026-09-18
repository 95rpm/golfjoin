'use strict';

const fs = require('node:fs');
const path = require('node:path');

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function transferBytes(entry) {
  return Math.max(0, numberOrZero(entry && entry.response && entry.response._transferSize));
}

function safeUrlLabel(rawUrl) {
  const url = new URL(rawUrl);

  if (url.pathname.endsWith('/golfjoin-sheet-api')) {
    const action = url.searchParams.get('action');
    const sheet = url.searchParams.get('sheet');
    if (action) return `golfjoin-sheet-api?action=${action}`;
    if (sheet) {
      const memberScoped = url.searchParams.has('memberKey') ? '&member=1' : '';
      return `golfjoin-sheet-api?sheet=${sheet}${memberScoped}`;
    }
    return 'golfjoin-sheet-api';
  }

  if (/\/event\/getEvent(?:Tab|GoodsList)\.json$/.test(url.pathname)) {
    const eventPlanSeq = url.searchParams.get('eventPlanSeq');
    const tabSeq = url.searchParams.get('tabSeq');
    return `${url.host}${url.pathname}?eventPlanSeq=${eventPlanSeq || ''}${tabSeq ? `&tabSeq=${tabSeq}` : ''}`;
  }

  return `${url.host}${url.pathname}`;
}

function summarizeEntry(entry, baseTime) {
  const startMs = Date.parse(entry.startedDateTime) - baseTime;
  const durationMs = numberOrZero(entry.time);
  return {
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    waitMs: numberOrZero(entry.timings && entry.timings.wait),
    receiveMs: numberOrZero(entry.timings && entry.timings.receive),
    status: numberOrZero(entry.response && entry.response.status),
    transferBytes: transferBytes(entry),
    resourceType: entry._resourceType || 'other',
    priority: entry._priority || '',
    label: safeUrlLabel(entry.request.url),
  };
}

function summarizeHar(har) {
  if (!har || !har.log || !Array.isArray(har.log.entries)) {
    throw new Error('Invalid HAR: log.entries array is required');
  }
  if (!har.log._sanitized) {
    throw new Error('Refusing to analyze an unsanitized HAR');
  }

  const entries = har.log.entries;
  if (!entries.length) throw new Error('HAR contains no entries');

  const baseTime = Math.min(...entries.map((entry) => Date.parse(entry.startedDateTime)));
  const summaries = entries.map((entry) => summarizeEntry(entry, baseTime));
  const page = (har.log.pages || [])[0] || {};
  const statuses = {};
  const resourceTypes = {};

  entries.forEach((entry, index) => {
    const summary = summaries[index];
    statuses[summary.status] = (statuses[summary.status] || 0) + 1;
    const type = summary.resourceType;
    if (!resourceTypes[type]) resourceTypes[type] = { count: 0, transferBytes: 0, zeroTransferCount: 0 };
    resourceTypes[type].count += 1;
    resourceTypes[type].transferBytes += summary.transferBytes;
    if (summary.transferBytes === 0) resourceTypes[type].zeroTransferCount += 1;
  });

  const exactUrlCounts = new Map();
  entries.forEach((entry) => {
    const key = `${entry.request.method} ${entry.request.url}`;
    exactUrlCounts.set(key, (exactUrlCounts.get(key) || 0) + 1);
  });

  const duplicateRequestGroups = [...exactUrlCounts.values()].filter((count) => count > 1).length;
  const golfjoinApiTimeline = summaries.filter((summary, index) => {
    const url = new URL(entries[index].request.url);
    return url.pathname.endsWith('/golfjoin-sheet-api') && summary.resourceType === 'fetch';
  });

  const golfjoinStaticTimeline = summaries.filter((summary, index) => (
    entries[index].request.url.includes('storage.googleapis.com/golfjoin-bucket/web/')
  ));

  const productImageTimeline = summaries.map((summary, index) => ({ summary, entry: entries[index] }))
    .filter(({ entry }) => /\/upload\/secrettour\/image\/goods\/main\//.test(entry.request.url))
    .map(({ summary, entry }) => {
      const url = new URL(entry.request.url);
      const frames = (entry._initiator && entry._initiator.stack && entry._initiator.stack.callFrames) || [];
      return {
        ...summary,
        goodSeq: url.pathname.split('/').at(-2),
        initiatorType: (entry._initiator && entry._initiator.type) || '',
        initiatorFunctions: frames.map((frame) => frame.functionName).filter(Boolean).slice(0, 5),
      };
    });

  const originalPageRequests = summaries.filter((summary, index) => (
    /\/event\/getEvent(?:Tab|GoodsList)\.json$/.test(new URL(entries[index].request.url).pathname)
  ));

  return {
    page: {
      title: page.title || '',
      startedDateTime: page.startedDateTime || '',
      onContentLoadMs: numberOrZero(page.pageTimings && page.pageTimings.onContentLoad),
      onLoadMs: numberOrZero(page.pageTimings && page.pageTimings.onLoad),
    },
    entries: entries.length,
    wallSpanMs: Math.max(...summaries.map((summary) => summary.endMs)),
    totalTransferBytes: summaries.reduce((sum, summary) => sum + summary.transferBytes, 0),
    statuses,
    resourceTypes,
    duplicateRequestGroups,
    slowestRequests: summaries.slice().sort((a, b) => b.durationMs - a.durationMs).slice(0, 20),
    golfjoinStaticTimeline,
    golfjoinApiTimeline,
    productImageTimeline,
    originalPageRequests,
  };
}

function main(argv) {
  const inputPath = argv[2];
  const outputPath = argv[3];
  if (!inputPath) {
    throw new Error('Usage: node analyze-har.js <sanitized.har.json> [analysis.json]');
  }

  const resolvedInput = path.resolve(inputPath);
  const har = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
  const report = summarizeHar(har);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;

  if (outputPath) {
    const resolvedOutput = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    fs.writeFileSync(resolvedOutput, serialized, 'utf8');
    process.stdout.write(`${JSON.stringify({ input: resolvedInput, output: resolvedOutput, entries: report.entries })}\n`);
    return;
  }

  process.stdout.write(serialized);
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  safeUrlLabel,
  summarizeHar,
};

