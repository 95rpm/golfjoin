"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const LOCAL_HTML = fs.readFileSync(path.resolve(__dirname, "../../../dist/golfjoin-main/golfjoin_main.html"), "utf8");
const URLS = [
  process.env.GOLFJOIN_E2E_URL || "https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1",
  process.env.GOLFJOIN_E2E_MOBILE_URL || "https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1"
];
const FUNCTION_NAMES = [
  "lockDetailModalPageScroll",
  "unlockDetailModalPageScroll",
  "retryCurrentDetailProductLoad",
  "getGolfJoinPublicDetailSnapshotUrls",
  "hasGolfJoinPublicDetailPrivateField",
  "validateGolfJoinPublicDetailSnapshot",
  "loadGolfJoinPublicDetailSnapshot",
  "loadSecretTourGoodsDetail",
  "retryCurrentDetailFlightSchedule"
];

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "").replace(/\r\n/g, "\n")).digest("hex");
}

function extractEmbeddedHtml(shellHtml) {
  const marker = "<title>골프 조인 게시판</title>";
  const markerIndex = shellHtml.indexOf(marker);
  const startIndex = shellHtml.lastIndexOf("<!DOCTYPE html>", markerIndex);
  const closingIndex = shellHtml.indexOf("</html>", markerIndex);
  if (markerIndex < 0 || startIndex < 0 || closingIndex < 0) throw new Error("embedded_html_not_found");
  return shellHtml.slice(startIndex, closingIndex + "</html>".length);
}

function extractFunction(source, name) {
  const signature = `function ${name}(`;
  const signatureIndex = source.indexOf(signature);
  if (signatureIndex < 0 || source.indexOf(signature, signatureIndex + signature.length) >= 0) {
    throw new Error(`function_marker_invalid:${name}`);
  }
  const start = source.lastIndexOf("\n", signatureIndex) + 1;
  const braceStart = source.indexOf("{", signatureIndex + signature.length);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`function_end_not_found:${name}`);
}

async function main() {
  const localHashes = Object.fromEntries(FUNCTION_NAMES.map((name) => [name, sha256(extractFunction(LOCAL_HTML, name))]));
  const results = [];
  for (const url of URLS) {
    const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const embedded = extractEmbeddedHtml(await response.text());
    const functions = FUNCTION_NAMES.map((name) => {
      const deployedHash = sha256(extractFunction(embedded, name));
      return { name, matches: deployedHash === localHashes[name], deployedHash };
    });
    results.push({
      url,
      httpStatus: response.status,
      embeddedBytes: Buffer.byteLength(embedded),
      functionCount: functions.length,
      matchingFunctionCount: functions.filter((item) => item.matches).length,
      functions
    });
  }
  const summary = {
    localCandidateBytes: Buffer.byteLength(LOCAL_HTML),
    functionCount: FUNCTION_NAMES.length,
    deployments: results,
    valid: results.every((result) => result.matchingFunctionCount === FUNCTION_NAMES.length)
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.valid) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
