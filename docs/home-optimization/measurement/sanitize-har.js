'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REDACTED = '[REDACTED]';
const URL_VALUE_HEADER_NAMES = new Set([
  ':path',
  'referer',
  'referrer',
  'location',
  'content-location',
]);

const SENSITIVE_NAMES = new Set([
  'authorization',
  'cookie',
  'setcookie',
  'password',
  'passwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'writetoken',
  'admintoken',
  'xgolfjoinadmintoken',
  'memberkey',
  'memberseq',
  'memberid',
  'membermobile',
  'memberemail',
  'applicantmobile',
  'mobile',
  'phone',
  'email',
]);

function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveName(name) {
  const normalized = normalizeName(name);
  if (SENSITIVE_NAMES.has(normalized)) return true;
  return normalized.endsWith('token') || normalized.endsWith('password');
}

function redactUrl(value) {
  if (!value) return value;

  try {
    const source = String(value);
    const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(source);
    const url = new URL(source, 'https://har-sanitizer.invalid');
    for (const name of [...url.searchParams.keys()]) {
      if (isSensitiveName(name)) url.searchParams.set(name, REDACTED);
    }
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

function redactNameValueList(items, options = {}) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => ({
    ...item,
    value: isSensitiveName(item && item.name)
      ? REDACTED
      : (options.redactUrlValues && URL_VALUE_HEADER_NAMES.has(String(item && item.name).toLowerCase())
        ? redactUrl(item.value)
        : item.value),
  }));
}

function sanitizeEntry(entry) {
  const next = JSON.parse(JSON.stringify(entry));
  const request = next.request || {};
  const response = next.response || {};

  request.url = redactUrl(request.url);
  request.headers = redactNameValueList(request.headers, { redactUrlValues: true });
  request.queryString = redactNameValueList(request.queryString);
  request.cookies = [];

  if (request.postData) {
    request.postData = {
      mimeType: request.postData.mimeType || '',
      text: REDACTED,
      _sanitizedBodyRemoved: true,
    };
  }

  response.headers = redactNameValueList(response.headers, { redactUrlValues: true });
  response.cookies = [];

  if (response.content) {
    response.content = {
      size: response.content.size,
      compression: response.content.compression,
      mimeType: response.content.mimeType,
      _sanitizedTextRemoved: true,
    };
  }

  next.request = request;
  next.response = response;
  return next;
}

function sanitizeHar(input) {
  if (!input || !input.log || !Array.isArray(input.log.entries)) {
    throw new Error('Invalid HAR: log.entries array is required');
  }

  const output = JSON.parse(JSON.stringify(input));
  output.log.entries = input.log.entries.map(sanitizeEntry);
  output.log._sanitized = {
    createdAt: new Date().toISOString(),
    responseBodiesRemoved: true,
    requestBodiesRemoved: true,
    sensitiveQueryAndHeadersRedacted: true,
  };
  return output;
}

function main(argv) {
  const inputPath = argv[2];
  const outputPath = argv[3];

  if (!inputPath || !outputPath) {
    throw new Error('Usage: node sanitize-har.js <input.har> <output.sanitized.json>');
  }

  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedInput === resolvedOutput) {
    throw new Error('Input and output paths must be different');
  }

  const source = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
  const sanitized = sanitizeHar(source);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify({
    input: resolvedInput,
    output: resolvedOutput,
    entries: sanitized.log.entries.length,
  })}\n`);
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
  REDACTED,
  isSensitiveName,
  redactUrl,
  sanitizeHar,
};
