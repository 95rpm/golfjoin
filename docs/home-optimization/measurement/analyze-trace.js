'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function safeUrlLabel(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.hostname.includes('cloudfunctions.net') && url.pathname.endsWith('/golfjoin-sheet-api')) {
      const action = url.searchParams.get('action');
      const sheet = url.searchParams.get('sheet');
      const hasMember = ['memberKey', 'memberSeq', 'memberId', 'memberMobile', 'memberEmail']
        .some((name) => url.searchParams.has(name));
      if (action) return `golfjoin-sheet-api?action=${action}`;
      if (sheet) return `golfjoin-sheet-api?sheet=${sheet}${hasMember ? '&member=1' : ''}`;
      return 'golfjoin-sheet-api';
    }
    return `${url.hostname}${url.pathname}`;
  } catch {
    return 'invalid-url';
  }
}

function readTraceFile(inputPath) {
  const buffer = fs.readFileSync(inputPath);
  const text = inputPath.toLowerCase().endsWith('.gz')
    ? zlib.gunzipSync(buffer).toString('utf8')
    : buffer.toString('utf8');
  return JSON.parse(text);
}

function getTraceEvents(trace) {
  if (Array.isArray(trace)) return trace;
  if (trace && Array.isArray(trace.traceEvents)) return trace.traceEvents;
  throw new Error('Invalid trace: traceEvents array is required');
}

function eventData(event) {
  return event && event.args && (event.args.data || event.args) || {};
}

function findNavigationTimestamp(events) {
  const documentRequests = events
    .filter((event) => event.name === 'ResourceSendRequest')
    .map((event) => ({ event, data: eventData(event) }))
    .filter(({ data }) => {
      const label = safeUrlLabel(data.url);
      return ['www.secret-tour.com/event/plan_view', 'm.secret-tour.com/event/plan_view'].includes(label)
        && String(data.requestMethod || 'GET').toUpperCase() !== 'OPTIONS';
    })
    .sort((left, right) => numberOrZero(left.event.ts) - numberOrZero(right.event.ts));
  if (documentRequests.length) return numberOrZero(documentRequests[0].event.ts);

  const navigationStarts = events
    .filter((event) => event.name === 'navigationStart')
    .sort((left, right) => numberOrZero(left.ts) - numberOrZero(right.ts));
  if (navigationStarts.length) return numberOrZero(navigationStarts[0].ts);
  return Math.min(...events.map((event) => numberOrZero(event.ts)).filter((value) => value > 0));
}

function buildClsSessionWindows(layoutShifts, navigationTs) {
  const windows = [];
  layoutShifts
    .slice()
    .sort((left, right) => left.ts - right.ts)
    .forEach((shift) => {
      const previous = windows[windows.length - 1];
      const gapMs = previous ? (shift.ts - previous.endTs) / 1000 : Infinity;
      const windowDurationMs = previous ? (shift.ts - previous.startTs) / 1000 : Infinity;
      if (!previous || gapMs > 1000 || windowDurationMs > 5000) {
        windows.push({
          startTs: shift.ts,
          endTs: shift.ts,
          score: shift.score,
          shifts: 1,
        });
        return;
      }
      previous.endTs = shift.ts;
      previous.score += shift.score;
      previous.shifts += 1;
    });

  return windows.map((window) => ({
    startMs: (window.startTs - navigationTs) / 1000,
    endMs: (window.endTs - navigationTs) / 1000,
    score: window.score,
    shifts: window.shifts,
  }));
}

function analyzeTraceWebVitals(events, navigationTs) {
  const lcpCandidates = events
    .filter((event) => event.name === 'largestContentfulPaint::Candidate')
    .filter((event) => numberOrZero(event.ts) >= navigationTs)
    .map((event) => ({ event, data: eventData(event) }))
    .filter(({ data }) => data.isMainFrame !== false && data.isOutermostMainFrame !== false)
    .sort((left, right) => (
      numberOrZero(left.data.candidateIndex) - numberOrZero(right.data.candidateIndex)
      || numberOrZero(left.event.ts) - numberOrZero(right.event.ts)
    ));
  const finalLcp = lcpCandidates[lcpCandidates.length - 1] || null;

  const layoutShifts = events
    .filter((event) => event.name === 'LayoutShift')
    .filter((event) => numberOrZero(event.ts) >= navigationTs)
    .map((event) => ({ event, data: eventData(event) }))
    .filter(({ data }) => data.is_main_frame !== false && !data.had_recent_input)
    .map(({ event, data }) => ({
      ts: numberOrZero(event.ts),
      score: numberOrZero(data.weighted_score_delta || data.score),
    }))
    .filter((shift) => shift.score > 0);
  const clsWindows = buildClsSessionWindows(layoutShifts, navigationTs);
  const maxClsWindow = clsWindows
    .slice()
    .sort((left, right) => right.score - left.score)[0] || null;

  const interactionsById = new Map();
  events
    .filter((event) => event.name === 'EventTiming' && event.ph === 'b')
    .map((event) => ({ event, data: eventData(event) }))
    .filter(({ data }) => numberOrZero(data.interactionId) > 0 && numberOrZero(data.duration) > 0)
    .forEach(({ event, data }) => {
      const interactionId = numberOrZero(data.interactionId);
      const durationMs = numberOrZero(data.duration);
      const previous = interactionsById.get(interactionId);
      if (!previous || durationMs > previous.durationMs) {
        interactionsById.set(interactionId, {
          interactionId,
          durationMs,
          type: String(data.type || ''),
          startMs: (numberOrZero(event.ts) - navigationTs) / 1000,
        });
      }
    });
  const interactions = [...interactionsById.values()]
    .sort((left, right) => right.durationMs - left.durationMs);
  const inpIndex = interactions.length
    ? Math.min(interactions.length - 1, Math.floor(interactions.length / 50))
    : -1;
  const inpCandidate = inpIndex >= 0 ? interactions[inpIndex] : null;

  return {
    lcpMs: finalLcp ? (numberOrZero(finalLcp.event.ts) - navigationTs) / 1000 : null,
    lcpSize: finalLcp ? numberOrZero(finalLcp.data.size) : null,
    lcpType: finalLcp ? String(finalLcp.data.type || '') : null,
    lcpNodeName: finalLcp ? String(finalLcp.data.nodeName || '').slice(0, 160) : null,
    cls: maxClsWindow ? maxClsWindow.score : 0,
    clsEligibleShiftCount: layoutShifts.length,
    clsSessionWindows: clsWindows,
    inpCandidateMs: inpCandidate ? inpCandidate.durationMs : null,
    inpInteractionCount: interactions.length,
    inpCandidateType: inpCandidate ? inpCandidate.type : null,
    inpCandidateStartMs: inpCandidate ? inpCandidate.startMs : null,
    interactions: interactions.slice(0, 20),
    note: 'Chrome Performance trace lab metrics. INP candidate is null when the trace has no interactionId-bearing EventTiming event; field Core Web Vitals p75 requires real-user monitoring.',
  };
}

function findMainThread(events, navigationTs) {
  const names = new Map();
  events.filter((event) => event.ph === 'M' && event.name === 'thread_name').forEach((event) => {
    const name = String(event.args && event.args.name || '');
    names.set(`${event.pid}:${event.tid}`, name);
  });

  const candidates = [...names.entries()]
    .filter(([, name]) => name === 'CrRendererMain')
    .map(([key]) => {
      const [pid, tid] = key.split(':').map(Number);
      const taskDurationUs = events
        .filter((event) => event.pid === pid && event.tid === tid && event.name === 'RunTask')
        .filter((event) => numberOrZero(event.ts) >= navigationTs && numberOrZero(event.ts) <= navigationTs + 30_000_000)
        .reduce((sum, event) => sum + numberOrZero(event.dur), 0);
      return { pid, tid, taskDurationUs };
    })
    .sort((left, right) => right.taskDurationUs - left.taskDurationUs);
  return candidates[0] || null;
}

function buildNetworkTimeline(events, navigationTs) {
  const requests = new Map();
  events.forEach((event) => {
    if (!['ResourceSendRequest', 'ResourceReceiveResponse', 'ResourceFinish'].includes(event.name)) return;
    const data = eventData(event);
    const requestId = String(data.requestId || '');
    if (!requestId) return;
    const current = requests.get(requestId) || { requestId };
    if (event.name === 'ResourceSendRequest') {
      current.startTs = numberOrZero(event.ts);
      current.method = String(data.requestMethod || 'GET').toUpperCase();
      current.label = safeUrlLabel(data.url);
    } else if (event.name === 'ResourceReceiveResponse') {
      current.responseTs = numberOrZero(event.ts);
      current.status = numberOrZero(data.statusCode);
    } else if (event.name === 'ResourceFinish') {
      current.finishTs = numberOrZero(event.ts);
    }
    requests.set(requestId, current);
  });

  return [...requests.values()]
    .filter((request) => request.startTs && request.method !== 'OPTIONS')
    .map((request) => ({
      label: request.label || 'unknown-request',
      method: request.method,
      status: request.status || 0,
      startMs: (request.startTs - navigationTs) / 1000,
      responseMs: request.responseTs ? (request.responseTs - navigationTs) / 1000 : null,
      finishMs: request.finishTs ? (request.finishTs - navigationTs) / 1000 : null,
    }))
    .filter((request) => request.startMs >= -1000 && request.startMs <= 60_000)
    .sort((left, right) => left.startMs - right.startMs);
}

function clippedDurationMs(event, startUs, endUs) {
  const eventStart = numberOrZero(event.ts);
  const eventEnd = eventStart + numberOrZero(event.dur);
  const overlap = Math.max(0, Math.min(eventEnd, endUs) - Math.max(eventStart, startUs));
  return overlap / 1000;
}

function analyzeMainThreadGap(events, mainThread, navigationTs, gapStartMs, gapEndMs) {
  if (!mainThread || !Number.isFinite(gapStartMs) || !Number.isFinite(gapEndMs) || gapEndMs <= gapStartMs) {
    return null;
  }
  const startUs = navigationTs + gapStartMs * 1000;
  const endUs = navigationTs + gapEndMs * 1000;
  const mainEvents = events.filter((event) => (
    event.pid === mainThread.pid
    && event.tid === mainThread.tid
    && numberOrZero(event.dur) > 0
    && numberOrZero(event.ts) < endUs
    && numberOrZero(event.ts) + numberOrZero(event.dur) > startUs
  ));

  const namesToSummarize = new Set([
    'RunTask', 'FunctionCall', 'EvaluateScript', 'RunMicrotasks', 'FireIdleCallback',
    'TimerFire', 'EventDispatch', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint',
    'Commit', 'V8.Execute', 'MinorGC', 'MajorGC', 'BlinkGC.AtomicPhase',
  ]);
  const breakdown = {};
  const allEventBreakdown = {};
  mainEvents.forEach((event) => {
    allEventBreakdown[event.name] = (allEventBreakdown[event.name] || 0) + clippedDurationMs(event, startUs, endUs);
    if (!namesToSummarize.has(event.name)) return;
    breakdown[event.name] = (breakdown[event.name] || 0) + clippedDurationMs(event, startUs, endUs);
  });

  const tasks = mainEvents
    .filter((event) => event.name === 'RunTask')
    .map((event) => ({
      startMs: (numberOrZero(event.ts) - navigationTs) / 1000,
      durationMs: numberOrZero(event.dur) / 1000,
      overlapMs: clippedDurationMs(event, startUs, endUs),
    }))
    .sort((left, right) => right.overlapMs - left.overlapMs)
    .slice(0, 20);

  const functionTotals = new Map();
  mainEvents.filter((event) => event.name === 'FunctionCall').forEach((event) => {
    const data = eventData(event);
    const functionName = String(data.functionName || '(anonymous)').slice(0, 160);
    const script = data.url ? safeUrlLabel(data.url) : '';
    const line = Number.isFinite(Number(data.lineNumber)) ? Number(data.lineNumber) + 1 : null;
    const column = Number.isFinite(Number(data.columnNumber)) ? Number(data.columnNumber) + 1 : null;
    const key = `${functionName}|${script}|${line}|${column}`;
    const previous = functionTotals.get(key) || { functionName, script, line, column, durationMs: 0, calls: 0 };
    previous.durationMs += clippedDurationMs(event, startUs, endUs);
    previous.calls += 1;
    functionTotals.set(key, previous);
  });

  return {
    startMs: gapStartMs,
    endMs: gapEndMs,
    durationMs: gapEndMs - gapStartMs,
    eventBreakdownMs: Object.fromEntries(
      Object.entries(breakdown)
        .sort((left, right) => right[1] - left[1])
        .map(([name, durationMs]) => [name, durationMs])
    ),
    allEventBreakdownMs: Object.fromEntries(
      Object.entries(allEventBreakdown)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 30)
        .map(([name, durationMs]) => [name, durationMs])
    ),
    topTasks: tasks,
    topFunctionCalls: [...functionTotals.values()]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 20),
    topEvents: mainEvents
      .filter((event) => event.name !== 'RunTask')
      .map((event) => {
        const data = eventData(event);
        let detail = '';
        if (event.name === 'FunctionCall') {
          const functionName = String(data.functionName || '(anonymous)').slice(0, 160);
          const line = Number.isFinite(Number(data.lineNumber)) ? Number(data.lineNumber) + 1 : null;
          const column = Number.isFinite(Number(data.columnNumber)) ? Number(data.columnNumber) + 1 : null;
          detail = `${functionName}${line ? `@${line}:${column || 1}` : ''}`;
        }
        if (event.name === 'EvaluateScript' && data.url) detail = safeUrlLabel(data.url);
        if (event.name === 'EventDispatch') detail = String(data.type || '').slice(0, 80);
        return {
          name: event.name,
          detail,
          startMs: (numberOrZero(event.ts) - navigationTs) / 1000,
          durationMs: numberOrZero(event.dur) / 1000,
          overlapMs: clippedDurationMs(event, startUs, endUs),
        };
      })
      .filter((event) => event.overlapMs > 0)
      .sort((left, right) => right.overlapMs - left.overlapMs)
      .slice(0, 30),
  };
}

function summarizeTrace(trace) {
  const events = getTraceEvents(trace);
  const navigationTs = findNavigationTimestamp(events);
  if (!Number.isFinite(navigationTs)) throw new Error('Navigation timestamp was not found');
  const mainThread = findMainThread(events, navigationTs);
  const networkTimeline = buildNetworkTimeline(events, navigationTs);
  const golfjoinApiTimeline = networkTimeline.filter((request) => request.label.startsWith('golfjoin-sheet-api'));
  const builderRequests = golfjoinApiTimeline.filter((request) => request.label.includes('sheet=new_schedule_applications'));
  const joinRequest = golfjoinApiTimeline.find((request) => request.label.includes('sheet=join_applications'));
  const builderFinishMs = Math.max(...builderRequests.map((request) => request.finishMs || request.responseMs || request.startMs));
  const joinStartMs = joinRequest ? joinRequest.startMs : null;
  const apiProcessingGap = analyzeMainThreadGap(
    events,
    mainThread,
    navigationTs,
    builderFinishMs,
    joinStartMs,
  );

  const mainEvents = mainThread ? events.filter((event) => event.pid === mainThread.pid && event.tid === mainThread.tid) : [];
  const longTasks = mainEvents
    .filter((event) => event.name === 'RunTask' && numberOrZero(event.dur) >= 50_000)
    .filter((event) => numberOrZero(event.ts) >= navigationTs && numberOrZero(event.ts) <= navigationTs + 30_000_000)
    .map((event) => {
      const startMs = (numberOrZero(event.ts) - navigationTs) / 1000;
      const durationMs = numberOrZero(event.dur) / 1000;
      const detail = analyzeMainThreadGap(events, mainThread, navigationTs, startMs, startMs + durationMs);
      return {
        startMs,
        durationMs,
        eventBreakdownMs: detail && detail.allEventBreakdownMs || {},
        topFunctionCalls: detail && detail.topFunctionCalls || [],
        topEvents: detail && detail.topEvents || [],
      };
    })
    .sort((left, right) => left.startMs - right.startMs);

  const lcpCandidates = mainEvents
    .filter((event) => event.name === 'largestContentfulPaint::Candidate')
    .filter((event) => numberOrZero(event.ts) >= navigationTs)
    .map((event) => ({
      startMs: (numberOrZero(event.ts) - navigationTs) / 1000,
      size: numberOrZero(eventData(event).size),
    }));
  const layoutShifts = mainEvents
    .filter((event) => event.name === 'LayoutShift')
    .map((event) => eventData(event))
    .filter((data) => !data.had_recent_input);
  const webVitalsTrace = analyzeTraceWebVitals(events, navigationTs);
  const recordingLongTaskDurations = mainEvents
    .filter((event) => event.name === 'RunTask' && numberOrZero(event.dur) >= 50_000)
    .filter((event) => numberOrZero(event.ts) >= navigationTs)
    .map((event) => ({
      startMs: (numberOrZero(event.ts) - navigationTs) / 1000,
      durationMs: numberOrZero(event.dur) / 1000,
    }));

  return {
    events: events.length,
    mainThread: mainThread ? { pid: mainThread.pid, tid: mainThread.tid } : null,
    golfjoinApiTimeline,
    apiProcessingGap,
    longTasks: {
      count: longTasks.length,
      totalDurationMs: longTasks.reduce((sum, task) => sum + task.durationMs, 0),
      maxDurationMs: Math.max(0, ...longTasks.map((task) => task.durationMs)),
      tasks: longTasks,
    },
    recordingLongTasks: {
      count: recordingLongTaskDurations.length,
      totalDurationMs: recordingLongTaskDurations.reduce((sum, task) => sum + task.durationMs, 0),
      maxDurationMs: Math.max(0, ...recordingLongTaskDurations.map((task) => task.durationMs)),
      afterInitial30s: recordingLongTaskDurations
        .filter((task) => task.startMs > 30_000)
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 20),
    },
    webVitalsApproximation: {
      lcpMs: lcpCandidates.length ? lcpCandidates[lcpCandidates.length - 1].startMs : null,
      lcpSize: lcpCandidates.length ? lcpCandidates[lcpCandidates.length - 1].size : null,
      cls: layoutShifts.reduce((sum, data) => sum + numberOrZero(data.score), 0),
      note: 'Trace-derived approximation; INP requires an interaction trace.',
    },
    webVitalsTrace,
  };
}

function main(argv) {
  const inputPath = argv[2];
  const outputPath = argv[3];
  if (!inputPath || !outputPath) {
    throw new Error('Usage: node analyze-trace.js <trace.json[.gz]> <analysis.json>');
  }
  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);
  const report = summarizeTrace(readTraceFile(resolvedInput));
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ input: resolvedInput, output: resolvedOutput, events: report.events })}\n`);
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
  analyzeTraceWebVitals,
  safeUrlLabel,
  summarizeTrace,
};
