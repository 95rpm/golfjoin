'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { safeUrlLabel, summarizeTrace } = require('./analyze-trace');

function event(name, ts, options = {}) {
  return {
    name,
    ts,
    pid: options.pid ?? 1,
    tid: options.tid ?? 2,
    ph: options.ph || 'X',
    dur: options.dur || 0,
    args: options.args || {},
  };
}

test('민감 회원 쿼리를 출력하지 않고 API 이름만 남긴다', () => {
  const label = safeUrlLabel('https://example.cloudfunctions.net/golfjoin-sheet-api?sheet=join_applications&memberEmail=user%40example.com&memberMobile=01012345678');
  assert.equal(label, 'golfjoin-sheet-api?sheet=join_applications&member=1');
  assert.doesNotMatch(label, /user|01012345678|example\.com/);
});

test('일정 응답과 참여 API 사이 메인 스레드 작업을 요약한다', () => {
  const base = 1_000_000;
  const trace = {
    traceEvents: [
      event('thread_name', 0, { ph: 'M', args: { name: 'CrRendererMain' } }),
      event('ResourceSendRequest', base, { args: { data: { requestId: 'doc', url: 'https://www.secret-tour.com/event/plan_view?eventPlanSeq=3', requestMethod: 'GET' } } }),
      event('ResourceSendRequest', base + 1_000_000, { args: { data: { requestId: 'builder', url: 'https://x.cloudfunctions.net/golfjoin-sheet-api?sheet=new_schedule_applications&memberEmail=a%40b.com', requestMethod: 'GET' } } }),
      event('ResourceFinish', base + 1_500_000, { args: { data: { requestId: 'builder' } } }),
      event('RunTask', base + 1_500_000, { dur: 400_000 }),
      event('FunctionCall', base + 1_520_000, { dur: 300_000, args: { data: { functionName: 'mergeRows', url: 'https://www.secret-tour.com/event/plan_view?memberEmail=a%40b.com', lineNumber: 99, columnNumber: 4 } } }),
      event('ResourceSendRequest', base + 2_000_000, { args: { data: { requestId: 'join', url: 'https://x.cloudfunctions.net/golfjoin-sheet-api?sheet=join_applications&memberMobile=01012345678', requestMethod: 'GET' } } }),
    ],
  };
  const result = summarizeTrace(trace);
  assert.equal(result.golfjoinApiTimeline.length, 2);
  assert.equal(result.apiProcessingGap.durationMs, 500);
  assert.equal(result.apiProcessingGap.topFunctionCalls[0].functionName, 'mergeRows');
  assert.equal(result.apiProcessingGap.topFunctionCalls[0].script, 'www.secret-tour.com/event/plan_view');
  assert.equal(result.apiProcessingGap.topFunctionCalls[0].line, 100);
  assert.equal(result.apiProcessingGap.topFunctionCalls[0].column, 5);
  assert.equal(result.longTasks.count, 1);
  assert.equal(result.recordingLongTasks.count, 1);
  assert.equal(result.longTasks.tasks[0].eventBreakdownMs.RunTask, 400);
  assert.equal(result.longTasks.tasks[0].topFunctionCalls[0].functionName, 'mergeRows');
  assert.doesNotMatch(JSON.stringify(result), /a%40b|01012345678/);
});

test('traceEvents가 없으면 실패한다', () => {
  assert.throws(() => summarizeTrace({}), /traceEvents array/);
});

test('모바일 navigation의 LCP·CLS 세션 윈도우·INP 후보를 계산한다', () => {
  const base = 2_000_000;
  const trace = {
    traceEvents: [
      event('thread_name', 0, { ph: 'M', args: { name: 'CrRendererMain' } }),
      event('ResourceSendRequest', base, { args: { data: { requestId: 'doc', url: 'https://m.secret-tour.com/event/plan_view?eventPlanSeq=3', requestMethod: 'GET' } } }),
      event('largestContentfulPaint::Candidate', base + 1_000_000, { ph: 'R', args: { data: { candidateIndex: 1, isMainFrame: true, isOutermostMainFrame: true, size: 100, type: 'image', nodeName: 'IMG' } } }),
      event('largestContentfulPaint::Candidate', base + 2_000_000, { ph: 'R', args: { data: { candidateIndex: 2, isMainFrame: true, isOutermostMainFrame: true, size: 200, type: 'text', nodeName: "DIV class='hero-title'" } } }),
      event('LayoutShift', base + 2_100_000, { ph: 'I', args: { data: { is_main_frame: true, had_recent_input: false, weighted_score_delta: 0.1 } } }),
      event('LayoutShift', base + 2_600_000, { ph: 'I', args: { data: { is_main_frame: true, had_recent_input: false, weighted_score_delta: 0.05 } } }),
      event('LayoutShift', base + 4_000_000, { ph: 'I', args: { data: { is_main_frame: true, had_recent_input: false, weighted_score_delta: 0.2 } } }),
      event('LayoutShift', base + 4_100_000, { ph: 'I', args: { data: { is_main_frame: true, had_recent_input: true, weighted_score_delta: 0.9 } } }),
      event('EventTiming', base + 5_000_000, { ph: 'b', args: { data: { interactionId: 7, duration: 120, type: 'pointerdown' } } }),
      event('EventTiming', base + 5_010_000, { ph: 'b', args: { data: { interactionId: 7, duration: 180, type: 'click' } } }),
      event('EventTiming', base + 6_000_000, { ph: 'b', args: { data: { interactionId: 9, duration: 90, type: 'keydown' } } }),
    ],
  };

  const result = summarizeTrace(trace).webVitalsTrace;
  assert.equal(result.lcpMs, 2000);
  assert.equal(result.lcpSize, 200);
  assert.equal(result.lcpType, 'text');
  assert.equal(result.cls, 0.2);
  assert.equal(result.clsEligibleShiftCount, 3);
  assert.equal(result.clsSessionWindows.length, 2);
  assert.equal(result.inpCandidateMs, 180);
  assert.equal(result.inpInteractionCount, 2);
  assert.equal(result.inpCandidateType, 'click');
  assert.equal(result.interactions.length, 2);
});
