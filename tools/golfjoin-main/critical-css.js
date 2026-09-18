"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const { buildExternalAssetBundle, sha256 } = require("./external-assets");
const { measure, mergeRanges } = require("./measure-stage13-coverage");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_OUTPUT_ROOT = path.join(WORKSPACE_ROOT, "dist/golfjoin-main/critical-css");
const DEFAULT_URL = "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1";
const GROUP_AT_RULE = /^@(media|supports|container|layer|scope|document)\b/i;
const KEYFRAMES_AT_RULE = /^@(?:-[a-z]+-)?keyframes\b/i;

function skipComment(source, index, end) {
  const close = source.indexOf("*/", index + 2);
  return close < 0 || close >= end ? end : close + 2;
}

function skipWhitespaceAndComments(source, index, end) {
  let cursor = index;
  while (cursor < end) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    if (source[cursor] === "/" && source[cursor + 1] === "*") {
      cursor = skipComment(source, cursor, end);
      continue;
    }
    break;
  }
  return cursor;
}

function findHeaderBoundary(source, start, end) {
  let quote = "";
  let parentheses = 0;
  let brackets = 0;
  for (let cursor = start; cursor < end; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      if (character === "\\") cursor += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "/" && source[cursor + 1] === "*") {
      cursor = skipComment(source, cursor, end) - 1;
      continue;
    }
    if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets = Math.max(0, brackets - 1);
    else if (!parentheses && !brackets && (character === "{" || character === ";")) {
      return { index: cursor, character };
    }
  }
  return null;
}

function findMatchingBrace(source, openIndex, end) {
  let depth = 1;
  let quote = "";
  for (let cursor = openIndex + 1; cursor < end; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      if (character === "\\") cursor += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "/" && source[cursor + 1] === "*") {
      cursor = skipComment(source, cursor, end) - 1;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (!depth) return cursor;
    }
  }
  throw new Error(`critical_css_unclosed_block:${openIndex}`);
}

function parseCssNodes(source, start = 0, end = source.length) {
  const nodes = [];
  let cursor = start;
  while (cursor < end) {
    cursor = skipWhitespaceAndComments(source, cursor, end);
    if (cursor >= end) break;
    const nodeStart = cursor;
    const boundary = findHeaderBoundary(source, cursor, end);
    if (!boundary) {
      if (source.slice(cursor, end).trim()) throw new Error(`critical_css_boundary_missing:${cursor}`);
      break;
    }
    if (boundary.character === ";") {
      const nodeEnd = boundary.index + 1;
      nodes.push({ type: "statement", start: nodeStart, end: nodeEnd });
      cursor = nodeEnd;
      continue;
    }
    const open = boundary.index;
    const close = findMatchingBrace(source, open, end);
    const nodeEnd = close + 1;
    const prelude = source.slice(nodeStart, open).trim();
    const grouping = GROUP_AT_RULE.test(prelude);
    const keyframes = KEYFRAMES_AT_RULE.test(prelude);
    nodes.push({
      type: grouping ? "group" : "rule",
      start: nodeStart,
      open,
      close,
      end: nodeEnd,
      prelude,
      keyframes,
      children: grouping ? parseCssNodes(source, open + 1, close) : []
    });
    cursor = nodeEnd;
  }
  return nodes;
}

function rangeIntersects(start, end, ranges) {
  return ranges.some((range) => range.start < end && range.end > start);
}

function renderCriticalNodes(source, nodes, ranges, options = {}) {
  const parts = [];
  for (const node of nodes) {
    if (node.type === "statement") {
      const statement = source.slice(node.start, node.end).trim();
      if (/^@(charset|import)\b/i.test(statement)) continue;
      if (rangeIntersects(node.start, node.end, ranges)) parts.push(statement);
      continue;
    }
    if (node.type === "group") {
      const children = renderCriticalNodes(source, node.children, ranges, options);
      if (children) parts.push(`${source.slice(node.start, node.open + 1)}${children}\n}`);
      continue;
    }
    if (rangeIntersects(node.start, node.end, ranges) || (options.includeAllKeyframes && node.keyframes)) {
      parts.push(source.slice(node.start, node.end).trim());
    }
  }
  return parts.filter(Boolean).join("\n");
}

function extractCriticalCss(source, ranges, options = {}) {
  const mergedRanges = mergeRanges(ranges);
  const nodes = parseCssNodes(source);
  const css = `${renderCriticalNodes(source, nodes, mergedRanges, {
    includeAllKeyframes: options.includeAllKeyframes !== false
  })}\n`;
  parseCssNodes(css);
  return {
    css,
    ranges: mergedRanges,
    bytes: Buffer.byteLength(css),
    gzipBytes: zlib.gzipSync(Buffer.from(css), { level: 9, mtime: 0 }).length,
    sha256: sha256(Buffer.from(css))
  };
}

function buildCriticalHtml(bundle, criticalCss) {
  const html = bundle.artifacts.html.buffer.toString("utf8");
  const css = bundle.publication.assets.css;
  const original = `<link rel="stylesheet" href="${css.url}" integrity="${css.logicalSri}" crossorigin="anonymous" onerror="handleGolfJoinExternalAssetFailure('css')">`;
  const replacement = `<style data-golfjoin-critical-css="${sha256(Buffer.from(criticalCss)).slice(0, 16)}">\n${criticalCss}</style>\n`
    + `<link rel="preload" as="style" href="${css.url}" integrity="${css.logicalSri}" crossorigin="anonymous" `
    + `onload="this.onload=null;this.rel='stylesheet';document.documentElement.setAttribute('data-golfjoin-full-css','loaded')" `
    + `onerror="handleGolfJoinExternalAssetFailure('css')">\n`
    + `<noscript><link rel="stylesheet" href="${css.url}" integrity="${css.logicalSri}" crossorigin="anonymous"></noscript>`;
  const occurrences = html.split(original).length - 1;
  if (occurrences !== 1) throw new Error(`critical_css_link_boundary_invalid:${occurrences}`);
  return Buffer.from(html.replace(original, replacement), "utf8");
}

function cssRangesFromMeasurements(measurements, cssUrl) {
  return mergeRanges(measurements.flatMap((measurement) => measurement.css
    .filter((entry) => entry.url === cssUrl)
    .flatMap((entry) => entry.ranges || [])));
}

function revisionForCriticalCss(fullRevision, criticalCss) {
  return `ghc_${crypto.createHash("sha256").update(fullRevision).update("\ncritical-css-v1\n").update(criticalCss).digest("hex").slice(0, 24)}`;
}

async function buildCriticalCssCandidate(options = {}) {
  const bundle = buildExternalAssetBundle({ contentEncoding: "gzip", generatedAt: options.generatedAt });
  const measurements = options.measurements || await Promise.all([
    measure({ url: options.url || DEFAULT_URL, waitMs: options.waitMs || 8000, includeRanges: true }),
    measure({ url: options.url || DEFAULT_URL, waitMs: options.waitMs || 8000, includeRanges: true, mobile: true })
  ]);
  const cssSource = bundle.artifacts.css.buffer.toString("utf8");
  const ranges = cssRangesFromMeasurements(measurements, bundle.publication.assets.css.url);
  if (!ranges.length) throw new Error("critical_css_coverage_empty");
  const critical = extractCriticalCss(cssSource, ranges);
  const candidateHtml = buildCriticalHtml(bundle, critical.css);
  const criticalRevision = revisionForCriticalCss(bundle.assetRevision, critical.css);
  return {
    criticalRevision,
    bundle,
    critical,
    candidateHtml,
    measurements,
    publication: {
      schema: "secret-golf-join-critical-css-candidate-v1",
      generatedAt: options.generatedAt || new Date().toISOString(),
      criticalRevision,
      fullAssetRevision: bundle.assetRevision,
      sourceHtmlSha256: bundle.publication.candidateHtmlSha256,
      candidateHtmlSha256: sha256(candidateHtml),
      candidateHtmlBytes: candidateHtml.length,
      candidateHtmlGzipBytes: zlib.gzipSync(candidateHtml, { level: 9, mtime: 0 }).length,
      rollbackHtmlSha256: bundle.publication.candidateHtmlSha256,
      rollbackHtmlBytes: bundle.artifacts.html.buffer.length,
      rollbackHtmlGzipBytes: zlib.gzipSync(bundle.artifacts.html.buffer, { level: 9, mtime: 0 }).length,
      criticalCssBytes: critical.bytes,
      criticalCssGzipBytes: critical.gzipBytes,
      criticalCssSha256: critical.sha256,
      criticalCssBudgetBytes: 30 * 1024,
      criticalCssBudgetPassed: critical.gzipBytes <= 30 * 1024,
      browserReadEnabled: false
    }
  };
}

function writeCriticalCssCandidate(candidate, outputRoot = DEFAULT_OUTPUT_ROOT) {
  const root = path.resolve(outputRoot, candidate.criticalRevision);
  const relative = path.relative(WORKSPACE_ROOT, root);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`critical_css_output_outside_workspace:${root}`);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "critical.css"), candidate.critical.css, "utf8");
  fs.writeFileSync(path.join(root, "golfjoin_main_critical_candidate.html"), candidate.candidateHtml);
  fs.writeFileSync(path.join(root, "golfjoin_main_gzip_rollback.html"), candidate.bundle.artifacts.html.buffer);
  fs.writeFileSync(path.join(root, "publication.json"), `${JSON.stringify(candidate.publication, null, 2)}\n`, "utf8");
  return root;
}

async function main() {
  const candidate = await buildCriticalCssCandidate();
  const outputRoot = writeCriticalCssCandidate(candidate);
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot, ...candidate.publication }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCriticalCssCandidate,
  buildCriticalHtml,
  cssRangesFromMeasurements,
  extractCriticalCss,
  findMatchingBrace,
  parseCssNodes,
  renderCriticalNodes,
  revisionForCriticalCss,
  writeCriticalCssCandidate
};
