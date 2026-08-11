"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(WORKSPACE_ROOT, "src/golfjoin-main");
const MANIFEST_PATH = path.join(SOURCE_ROOT, "source-manifest.json");
const INVENTORY_JSON_PATH = path.join(SOURCE_ROOT, "function-inventory.json");
const INVENTORY_MD_PATH = path.join(SOURCE_ROOT, "DEPENDENCY_INVENTORY.md");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function collectMatches(source, expression, mapper) {
  const matches = [];
  let match;
  expression.lastIndex = 0;
  while ((match = expression.exec(source)) !== null) {
    matches.push(mapper(match));
    if (match[0].length === 0) expression.lastIndex += 1;
  }
  return matches;
}

function collectScriptInventory(relativePath, source, lineOffset = 0) {
  const withLocation = (match, value) => ({
    ...value,
    source: relativePath,
    line: lineOffset + lineNumberAt(source, match.index)
  });
  const functions = collectMatches(
    source,
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
    (match) => withLocation(match, { name: match[1] })
  );
  const windowExports = collectMatches(
    source,
    /^\s*window\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/gm,
    (match) => withLocation(match, { name: match[1], assignedFrom: match[2] })
  );
  const eventListeners = collectMatches(
    source,
    /\b(window|document)\.addEventListener\(\s*["']([^"']+)["']/g,
    (match) => withLocation(match, { target: match[1], event: match[2] })
  );
  const customEvents = collectMatches(
    source,
    /new\s+CustomEvent\(\s*["']([^"']+)["']/g,
    (match) => withLocation(match, { event: match[1] })
  );
  return {
    path: relativePath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(Buffer.from(source, "utf8")),
    namedFunctions: functions,
    windowExports,
    eventListeners,
    customEvents
  };
}

function collectExecutableScriptSources(relativePath, source) {
  if (relativePath.endsWith(".js")) return [{ path: relativePath, source, lineOffset: 0 }];
  const scripts = [];
  const expression = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = expression.exec(source)) !== null) {
    scripts.push({
      path: `${relativePath}#inline-script-${scripts.length + 1}`,
      source: match[1],
      lineOffset: lineNumberAt(source, match.index + match[0].indexOf(match[1])) - 1
    });
  }
  return scripts;
}

function summarizeEventListeners(listeners) {
  const counts = new Map();
  listeners.forEach(({ target, event }) => {
    const key = `${target}:${event}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([key, count]) => {
      const separator = key.indexOf(":");
      return { target: key.slice(0, separator), event: key.slice(separator + 1), count };
    })
    .sort((left, right) => left.target.localeCompare(right.target) || left.event.localeCompare(right.event));
}

function buildInventory(manifest, readSource) {
  const scriptSources = manifest.sourceOrder.flatMap((relativePath) => (
    collectExecutableScriptSources(relativePath, readSource(relativePath))
  ));
  const modules = scriptSources.map(({ path: relativePath, source, lineOffset }) => (
    collectScriptInventory(relativePath, source, lineOffset)
  ));
  const namedFunctions = modules.flatMap((module) => module.namedFunctions);
  const windowExports = modules.flatMap((module) => module.windowExports);
  const eventListeners = modules.flatMap((module) => module.eventListeners);
  const customEvents = modules.flatMap((module) => module.customEvents);
  const assembled = Buffer.concat(manifest.sourceOrder.map((name) => Buffer.from(readSource(name), "utf8")));
  return {
    schemaVersion: 1,
    sourceSha256: sha256(assembled),
    sourceBytes: assembled.length,
    summary: {
      scriptModules: modules.length,
      namedFunctions: namedFunctions.length,
      uniqueNamedFunctions: new Set(namedFunctions.map(({ name }) => name)).size,
      windowExports: windowExports.length,
      uniqueWindowExports: new Set(windowExports.map(({ name }) => name)).size,
      staticEventListeners: eventListeners.length,
      customEventDispatches: customEvents.length
    },
    modules: modules.map((module) => ({
      path: module.path,
      bytes: module.bytes,
      sha256: module.sha256,
      namedFunctionCount: module.namedFunctions.length,
      windowExportCount: module.windowExports.length,
      eventListenerCount: module.eventListeners.length,
      customEventCount: module.customEvents.length
    })),
    namedFunctions,
    windowExports,
    eventListeners,
    eventListenerSummary: summarizeEventListeners(eventListeners),
    customEvents
  };
}

function markdownTableRow(values) {
  return `| ${values.map((value) => String(value).replaceAll("|", "\\|")).join(" | ")} |`;
}

function renderMarkdown(inventory) {
  const lines = [
    "# 골프조인 메인 의존성 목록",
    "",
    "이 문서는 기능별 파일 이동 중 전역 함수나 이벤트 연결을 놓치지 않기 위한 자동 생성 자료다. JavaScript를 실행하지 않고 이름과 정적 문자열만 읽으므로 회원정보나 API 응답은 포함하지 않는다.",
    "",
    `- 조립 소스 SHA-256: \`${inventory.sourceSha256}\``,
    `- 조립 소스 크기: ${inventory.sourceBytes.toLocaleString("en-US")} bytes`,
    `- 이름 있는 함수: ${inventory.summary.namedFunctions.toLocaleString("en-US")}개`,
    `- \`window\` 공개 대입: ${inventory.summary.windowExports}개, 고유 이름 ${inventory.summary.uniqueWindowExports}개`,
    `- 정적 window/document 이벤트 연결: ${inventory.summary.staticEventListeners}개`,
    "",
    "## 모듈 현황",
    "",
    "| 소스 | bytes | 함수 | window 공개 | 이벤트 연결 |",
    "|---|---:|---:|---:|---:|",
    ...inventory.modules.map((module) => markdownTableRow([
      `\`${module.path}\``, module.bytes, module.namedFunctionCount,
      module.windowExportCount, module.eventListenerCount
    ])),
    "",
    "## window 공개 목록",
    "",
    "HTML의 인라인 속성이나 다른 원사이트 코드가 부를 수 있으므로, 아래 이름은 이동 후에도 같은 시점에 공개되어야 한다.",
    "",
    "| 공개 이름 | 연결 함수 | 위치 |",
    "|---|---|---|",
    ...inventory.windowExports.map((entry) => markdownTableRow([
      `\`${entry.name}\``, `\`${entry.assignedFrom}\``, `\`${entry.source}:${entry.line}\``
    ])),
    "",
    "## 정적 이벤트 연결 요약",
    "",
    "| 대상 | 이벤트 | 연결 수 |",
    "|---|---|---:|",
    ...inventory.eventListenerSummary.map((entry) => markdownTableRow([
      `\`${entry.target}\``, `\`${entry.event}\``, entry.count
    ])),
    "",
    "## 사용 시 주의",
    "",
    "- 이 목록의 함수 수에는 중첩 함수도 포함된다. 실제 파일 이동 전에는 선언이 사용하는 상위 상태를 함께 확인한다.",
    "- 변수에 담긴 동적 이벤트 이름은 정적 이벤트 표에 포함되지 않는다.",
    "- 기능 파일을 옮긴 뒤에는 이 목록을 다시 생성하고 단일 HTML hash·E2E 결과를 함께 비교한다.",
    ""
  ];
  return lines.join("\n");
}

function generateInventory() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const readSource = (relativePath) => fs.readFileSync(path.join(SOURCE_ROOT, relativePath), "utf8");
  const inventory = buildInventory(manifest, readSource);
  fs.writeFileSync(INVENTORY_JSON_PATH, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  fs.writeFileSync(INVENTORY_MD_PATH, renderMarkdown(inventory), "utf8");
  return {
    json: path.relative(WORKSPACE_ROOT, INVENTORY_JSON_PATH).replaceAll("\\", "/"),
    markdown: path.relative(WORKSPACE_ROOT, INVENTORY_MD_PATH).replaceAll("\\", "/"),
    ...inventory.summary,
    sourceSha256: inventory.sourceSha256
  };
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(generateInventory(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildInventory,
  collectExecutableScriptSources,
  collectScriptInventory,
  renderMarkdown,
  summarizeEventListeners
};
