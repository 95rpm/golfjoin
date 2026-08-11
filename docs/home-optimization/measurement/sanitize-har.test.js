'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { REDACTED, sanitizeHar } = require('./sanitize-har');

test('민감 쿼리·헤더·본문을 제거하고 성능 시간은 보존한다', () => {
  const source = {
    log: {
      version: '1.2',
      creator: { name: 'test', version: '1' },
      entries: [
        {
          startedDateTime: '2026-08-05T00:00:00.000Z',
          time: 123.45,
          timings: { blocked: 1, dns: 2, connect: 3, send: 4, wait: 100, receive: 13.45 },
          request: {
            method: 'GET',
            url: 'https://example.com/api?eventSeq=123&memberEmail=user%40example.com&memberMobile=01012345678',
            headers: [
              { name: 'Cookie', value: 'session=secret' },
              { name: 'Accept', value: 'application/json' },
              { name: ':path', value: '/api?eventSeq=123&memberEmail=user%40example.com&memberMobile=01012345678' },
              { name: 'Referer', value: 'https://example.com/page?memberKey=seq%3A123&tab=home' },
            ],
            queryString: [
              { name: 'eventSeq', value: '123' },
              { name: 'memberEmail', value: 'user@example.com' },
            ],
            cookies: [{ name: 'session', value: 'secret' }],
            postData: { mimeType: 'application/json', text: '{"name":"private"}' },
          },
          response: {
            status: 200,
            headers: [{ name: 'Set-Cookie', value: 'session=secret' }],
            cookies: [{ name: 'session', value: 'secret' }],
            content: { size: 99, mimeType: 'application/json', text: '{"email":"user@example.com"}' },
          },
        },
      ],
    },
  };

  const result = sanitizeHar(source);
  const entry = result.log.entries[0];
  const url = new URL(entry.request.url);

  assert.equal(url.searchParams.get('eventSeq'), '123');
  assert.equal(url.searchParams.get('memberEmail'), REDACTED);
  assert.equal(url.searchParams.get('memberMobile'), REDACTED);
  assert.equal(entry.request.headers[0].value, REDACTED);
  assert.equal(entry.request.headers[1].value, 'application/json');
  assert.equal(new URL(entry.request.headers[2].value, 'https://example.com').searchParams.get('memberEmail'), REDACTED);
  assert.equal(new URL(entry.request.headers[2].value, 'https://example.com').searchParams.get('memberMobile'), REDACTED);
  assert.equal(new URL(entry.request.headers[3].value).searchParams.get('memberKey'), REDACTED);
  assert.equal(entry.request.queryString[0].value, '123');
  assert.equal(entry.request.queryString[1].value, REDACTED);
  assert.deepEqual(entry.request.cookies, []);
  assert.equal(entry.request.postData.text, REDACTED);
  assert.equal(entry.response.headers[0].value, REDACTED);
  assert.deepEqual(entry.response.cookies, []);
  assert.equal(entry.response.content.text, undefined);
  assert.equal(entry.response.content._sanitizedTextRemoved, true);
  assert.equal(entry.time, 123.45);
  assert.equal(entry.timings.wait, 100);
});

test('HAR 구조가 아니면 실패한다', () => {
  assert.throws(() => sanitizeHar({}), /log\.entries/);
});
