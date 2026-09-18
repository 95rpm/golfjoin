"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const INDEX_PATH = path.resolve(__dirname, "index.js");

function extractFunction(source, functionName) {
  const start = source.indexOf(`async function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const bodyStart = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} body is incomplete`);
}

test("상품군 가용일은 gzip·불변·generation 조건으로 저장한다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const block = extractFunction(source, "publishGolfJoinFamilyAvailabilityArtifacts");
  assert.match(block, /assertDataContract\("familyAvailabilityV1", artifact\.payload\)/);
  assert.match(block, /zlib\.gzipSync/);
  assert.match(block, /contentEncoding:\s*"gzip"/);
  assert.match(block, /max-age=31536000, immutable/);
  assert.match(block, /ifGenerationMatch:\s*0/);
  assert.match(block, /file\.download\(\{ decompress: false \}\)/);
  assert.match(block, /remoteLogicalBuffer\.equals\(logicalBuffer\)/);
  assert.match(block, /family_availability_remote_verification_failed/);
});

test("상품군 catalog root를 바꾸기 전에 단일 가용일 객체를 먼저 발행한다", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const block = extractFunction(source, "publishProductFamilyCatalogSnapshotViaApi");
  const availabilityIndex = block.indexOf("publishGolfJoinFamilyAvailabilityArtifacts(publishedCatalog)");
  const manifestIndex = block.indexOf("switchProductFamilyManifestAtomically(");
  assert.ok(availabilityIndex >= 0);
  assert.ok(manifestIndex > availabilityIndex);
  assert.match(block, /browser fallback remains available/);
});
