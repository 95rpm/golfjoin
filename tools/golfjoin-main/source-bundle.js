"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const MAIN_HTML_PATH = path.join(WORKSPACE_ROOT, "golfjoin_main.html");
const SOURCE_ROOT = path.join(WORKSPACE_ROOT, "src/golfjoin-main");
const MANIFEST_PATH = path.join(SOURCE_ROOT, "source-manifest.json");
const DEFAULT_OUTPUT_PATH = path.join(WORKSPACE_ROOT, "dist/golfjoin-main/golfjoin_main.html");

const SOURCE_ORDER = [
  "source/shell/00-preamble.html",
  "source/styles/10-main.css",
  "source/markup/20-main.html",
  "source/scripts/30-main.js",
  "source/shell/40-suffix.html"
];
const MAIN_SCRIPT_PATH = "source/scripts/30-main.js";
const DIAGNOSTICS_SCRIPT_PATHS = [
  "source/scripts/legacy/30-before-diagnostics.js",
  "source/scripts/performance/31-diagnostics.js",
  "source/scripts/legacy/32-after-diagnostics.js"
];
const AFTER_DIAGNOSTICS_SCRIPT_PATH = "source/scripts/legacy/32-after-diagnostics.js";
const LOADING_SCRIPT_PATHS = [
  "source/scripts/legacy/32-before-loading.js",
  "source/scripts/loading/33-loading-and-modal-layer.js",
  "source/scripts/legacy/34-after-loading.js"
];
const AFTER_LOADING_SCRIPT_PATH = "source/scripts/legacy/34-after-loading.js";
const MEMBER_HOME_DATA_SCRIPT_PATHS = [
  "source/scripts/member/34-member-auth-profile-wishes.js",
  "source/scripts/data/35-home-bootstrap.js",
  "source/scripts/legacy/36-after-home-bootstrap.js"
];
const AFTER_HOME_BOOTSTRAP_SCRIPT_PATH = "source/scripts/legacy/36-after-home-bootstrap.js";
const MEMBER_RESERVATION_SCRIPT_PATHS = [
  "source/scripts/member/36-member-reservations-deeplinks.js",
  "source/scripts/legacy/37-after-member-reservations.js"
];
const AFTER_MEMBER_RESERVATION_SCRIPT_PATH = "source/scripts/legacy/37-after-member-reservations.js";
const DETAIL_SECTION_BOOT_SCRIPT_PATHS = [
  "source/scripts/detail/37-detail-builder-calendar.js",
  "source/scripts/sections/38-home-sections.js",
  "source/scripts/detail/39-detail-actions-participants.js",
  "source/scripts/boot/40-initialize.js"
];
const STORE_SOURCE_RENAMES = [
  ["source/scripts/legacy/30-before-diagnostics.js", "source/scripts/store/30-state-and-presets.js"],
  ["source/scripts/legacy/32-before-loading.js", "source/scripts/store/32-runtime-state-and-guards.js"]
];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function assertWorkspacePath(targetPath) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(WORKSPACE_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`output_outside_workspace:${resolved}`);
  }
  return resolved;
}

function findLastOpeningTag(source, tagName) {
  const expression = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, "gi");
  let match;
  let lastMatch = null;
  while ((match = expression.exec(source)) !== null) lastMatch = match;
  return lastMatch;
}

function splitMainHtml(sourceBuffer) {
  const source = sourceBuffer.toString("utf8");
  const styleMatch = /<style(?:\s[^>]*)?>/i.exec(source);
  const scriptMatch = findLastOpeningTag(source, "script");
  if (!styleMatch || !scriptMatch) throw new Error("main_html_boundaries_not_found");

  const styleContentStart = styleMatch.index + styleMatch[0].length;
  const styleCloseStart = source.indexOf("</style>", styleContentStart);
  const scriptContentStart = scriptMatch.index + scriptMatch[0].length;
  const scriptCloseStart = source.indexOf("</script>", scriptContentStart);
  if (styleCloseStart < 0 || scriptCloseStart < 0 || scriptMatch.index <= styleCloseStart) {
    throw new Error("main_html_boundaries_invalid");
  }

  return [
    source.slice(0, styleContentStart),
    source.slice(styleContentStart, styleCloseStart),
    source.slice(styleCloseStart, scriptContentStart),
    source.slice(scriptContentStart, scriptCloseStart),
    source.slice(scriptCloseStart)
  ].map((part) => Buffer.from(part, "utf8"));
}

function splitMarkedRegion(sourceBuffer, startMarker, endMarker) {
  const source = sourceBuffer.toString("utf8");
  const markerStart = source.indexOf(startMarker);
  const markerEnd = source.indexOf(endMarker, markerStart + startMarker.length);
  if (markerStart < 0 || markerEnd < 0) throw new Error("marked_region_not_found");
  if (source.indexOf(startMarker, markerStart + startMarker.length) >= 0
    || source.indexOf(endMarker, markerEnd + endMarker.length) >= 0) {
    throw new Error("marked_region_not_unique");
  }
  const blockStart = source.lastIndexOf("\n", markerStart - 1) + 1;
  const lineEnd = source.indexOf("\n", markerEnd + endMarker.length);
  const blockEnd = lineEnd >= 0 ? lineEnd + 1 : source.length;
  return [
    source.slice(0, blockStart),
    source.slice(blockStart, blockEnd),
    source.slice(blockEnd)
  ].map((part) => Buffer.from(part, "utf8"));
}

function splitBetweenAnchors(sourceBuffer, startAnchor, endAnchor) {
  const source = sourceBuffer.toString("utf8");
  const startIndex = source.indexOf(startAnchor);
  const endIndex = source.indexOf(endAnchor, startIndex + startAnchor.length);
  if (startIndex < 0 || endIndex < 0) throw new Error("anchored_region_not_found");
  if (source.indexOf(startAnchor, startIndex + startAnchor.length) >= 0
    || source.indexOf(endAnchor, endIndex + endAnchor.length) >= 0) {
    throw new Error("anchored_region_not_unique");
  }
  const blockStart = source.lastIndexOf("\n", startIndex - 1) + 1;
  const blockEnd = source.lastIndexOf("\n", endIndex - 1) + 1;
  if (blockEnd <= blockStart) throw new Error("anchored_region_invalid");
  return [
    source.slice(0, blockStart),
    source.slice(blockStart, blockEnd),
    source.slice(blockEnd)
  ].map((part) => Buffer.from(part, "utf8"));
}

function splitAtAnchor(sourceBuffer, anchor) {
  const source = sourceBuffer.toString("utf8");
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error("split_anchor_not_found");
  if (source.indexOf(anchor, anchorIndex + anchor.length) >= 0) {
    throw new Error("split_anchor_not_unique");
  }
  const blockStart = source.lastIndexOf("\n", anchorIndex - 1) + 1;
  if (blockStart <= 0 || blockStart >= source.length) throw new Error("split_anchor_invalid");
  return [
    source.slice(0, blockStart),
    source.slice(blockStart)
  ].map((part) => Buffer.from(part, "utf8"));
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) throw new Error("source_manifest_not_found");
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!Array.isArray(manifest.sourceOrder) || !manifest.sourceOrder.length) {
    throw new Error("source_manifest_order_missing");
  }
  return manifest;
}

function assembleFromSource(manifest = readManifest()) {
  return Buffer.concat(manifest.sourceOrder.map((relativePath) => {
    const sourcePath = path.resolve(SOURCE_ROOT, relativePath);
    const relative = path.relative(SOURCE_ROOT, sourcePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`source_outside_root:${relativePath}`);
    }
    return fs.readFileSync(sourcePath);
  }));
}

function describeFragments(sourceOrder) {
  return sourceOrder.map((relativePath) => {
    const content = fs.readFileSync(path.join(SOURCE_ROOT, relativePath));
    return { path: relativePath, bytes: content.length, sha256: sha256(content) };
  });
}

function initializeSource() {
  if (fs.existsSync(MANIFEST_PATH) || SOURCE_ORDER.some((name) => fs.existsSync(path.join(SOURCE_ROOT, name)))) {
    throw new Error("source_already_initialized");
  }
  const current = fs.readFileSync(MAIN_HTML_PATH);
  const parts = splitMainHtml(current);
  SOURCE_ORDER.forEach((relativePath, index) => {
    const targetPath = path.join(SOURCE_ROOT, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, parts[index]);
  });
  const manifest = {
    schemaVersion: 1,
    baselineFile: "golfjoin_main.html",
    baselineSha256: sha256(current),
    baselineBytes: current.length,
    sourceOrder: SOURCE_ORDER,
    fragments: SOURCE_ORDER.map((relativePath, index) => ({
      path: relativePath,
      bytes: parts[index].length,
      sha256: sha256(parts[index])
    }))
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function migrateDiagnosticsModule() {
  const manifest = readManifest();
  const mainIndex = manifest.sourceOrder.indexOf(MAIN_SCRIPT_PATH);
  if (mainIndex < 0) throw new Error("diagnostics_source_already_migrated_or_missing");
  if (DIAGNOSTICS_SCRIPT_PATHS.some((name) => fs.existsSync(path.join(SOURCE_ROOT, name)))) {
    throw new Error("diagnostics_target_already_exists");
  }
  const beforeAssembly = assembleFromSource(manifest);
  const mainSource = fs.readFileSync(path.join(SOURCE_ROOT, MAIN_SCRIPT_PATH));
  const parts = splitMarkedRegion(
    mainSource,
    "// GOLFJOIN_DIAGNOSTICS_START",
    "// GOLFJOIN_DIAGNOSTICS_END"
  );
  DIAGNOSTICS_SCRIPT_PATHS.forEach((relativePath, index) => {
    const targetPath = path.join(SOURCE_ROOT, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, parts[index]);
  });
  const sourceOrder = manifest.sourceOrder.slice();
  sourceOrder.splice(mainIndex, 1, ...DIAGNOSTICS_SCRIPT_PATHS);
  const nextManifest = {
    ...manifest,
    sourceOrder,
    fragments: describeFragments(sourceOrder)
  };
  const afterAssembly = assembleFromSource(nextManifest);
  if (!afterAssembly.equals(beforeAssembly)) throw new Error("diagnostics_migration_changed_output");
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  fs.unlinkSync(path.join(SOURCE_ROOT, MAIN_SCRIPT_PATH));
  return {
    match: true,
    sha256: sha256(afterAssembly),
    bytes: afterAssembly.length,
    migrated: DIAGNOSTICS_SCRIPT_PATHS,
    sourceOrder
  };
}

function migrateLoadingModule() {
  const manifest = readManifest();
  const sourceIndex = manifest.sourceOrder.indexOf(AFTER_DIAGNOSTICS_SCRIPT_PATH);
  if (sourceIndex < 0) throw new Error("loading_source_already_migrated_or_missing");
  if (LOADING_SCRIPT_PATHS.some((name) => fs.existsSync(path.join(SOURCE_ROOT, name)))) {
    throw new Error("loading_target_already_exists");
  }
  const beforeAssembly = assembleFromSource(manifest);
  const source = fs.readFileSync(path.join(SOURCE_ROOT, AFTER_DIAGNOSTICS_SCRIPT_PATH));
  const parts = splitBetweenAnchors(
    source,
    "function hasOpenJoinFullscreenModal",
    "function getRenderedCookieDataString"
  );
  LOADING_SCRIPT_PATHS.forEach((relativePath, index) => {
    const targetPath = path.join(SOURCE_ROOT, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, parts[index]);
  });
  const sourceOrder = manifest.sourceOrder.slice();
  sourceOrder.splice(sourceIndex, 1, ...LOADING_SCRIPT_PATHS);
  const nextManifest = {
    ...manifest,
    sourceOrder,
    fragments: describeFragments(sourceOrder)
  };
  const afterAssembly = assembleFromSource(nextManifest);
  if (!afterAssembly.equals(beforeAssembly)) throw new Error("loading_migration_changed_output");
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  fs.unlinkSync(path.join(SOURCE_ROOT, AFTER_DIAGNOSTICS_SCRIPT_PATH));
  return {
    match: true,
    sha256: sha256(afterAssembly),
    bytes: afterAssembly.length,
    migrated: LOADING_SCRIPT_PATHS,
    sourceOrder
  };
}

function migrateMemberHomeDataModules() {
  const manifest = readManifest();
  const sourceIndex = manifest.sourceOrder.indexOf(AFTER_LOADING_SCRIPT_PATH);
  if (sourceIndex < 0) throw new Error("member_home_data_source_already_migrated_or_missing");
  if (MEMBER_HOME_DATA_SCRIPT_PATHS.some((name) => fs.existsSync(path.join(SOURCE_ROOT, name)))) {
    throw new Error("member_home_data_target_already_exists");
  }
  const beforeAssembly = assembleFromSource(manifest);
  const source = fs.readFileSync(path.join(SOURCE_ROOT, AFTER_LOADING_SCRIPT_PATH));
  if (!source.toString("utf8").trimStart().startsWith("function getRenderedCookieDataString")) {
    throw new Error("member_home_data_start_boundary_changed");
  }
  const parts = splitBetweenAnchors(
    source,
    "async function hydrateHomeBootstrapFromGoogleSheet",
    "async function handleJoinMyWishClick"
  );
  MEMBER_HOME_DATA_SCRIPT_PATHS.forEach((relativePath, index) => {
    const targetPath = path.join(SOURCE_ROOT, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, parts[index]);
  });
  const sourceOrder = manifest.sourceOrder.slice();
  sourceOrder.splice(sourceIndex, 1, ...MEMBER_HOME_DATA_SCRIPT_PATHS);
  const nextManifest = {
    ...manifest,
    sourceOrder,
    fragments: describeFragments(sourceOrder)
  };
  const afterAssembly = assembleFromSource(nextManifest);
  if (!afterAssembly.equals(beforeAssembly)) throw new Error("member_home_data_migration_changed_output");
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  fs.unlinkSync(path.join(SOURCE_ROOT, AFTER_LOADING_SCRIPT_PATH));
  return {
    match: true,
    sha256: sha256(afterAssembly),
    bytes: afterAssembly.length,
    migrated: MEMBER_HOME_DATA_SCRIPT_PATHS,
    sourceOrder
  };
}

function migrateMemberReservationModule() {
  const manifest = readManifest();
  const sourceIndex = manifest.sourceOrder.indexOf(AFTER_HOME_BOOTSTRAP_SCRIPT_PATH);
  if (sourceIndex < 0) throw new Error("member_reservation_source_already_migrated_or_missing");
  if (MEMBER_RESERVATION_SCRIPT_PATHS.some((name) => fs.existsSync(path.join(SOURCE_ROOT, name)))) {
    throw new Error("member_reservation_target_already_exists");
  }
  const beforeAssembly = assembleFromSource(manifest);
  const source = fs.readFileSync(path.join(SOURCE_ROOT, AFTER_HOME_BOOTSTRAP_SCRIPT_PATH));
  if (!source.toString("utf8").trimStart().startsWith("async function handleJoinMyWishClick")) {
    throw new Error("member_reservation_start_boundary_changed");
  }
  const parts = splitAtAnchor(source, "function findHeroOctoberMonthlyJoin");
  MEMBER_RESERVATION_SCRIPT_PATHS.forEach((relativePath, index) => {
    const targetPath = path.join(SOURCE_ROOT, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, parts[index]);
  });
  const sourceOrder = manifest.sourceOrder.slice();
  sourceOrder.splice(sourceIndex, 1, ...MEMBER_RESERVATION_SCRIPT_PATHS);
  const nextManifest = {
    ...manifest,
    sourceOrder,
    fragments: describeFragments(sourceOrder)
  };
  const afterAssembly = assembleFromSource(nextManifest);
  if (!afterAssembly.equals(beforeAssembly)) throw new Error("member_reservation_migration_changed_output");
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  fs.unlinkSync(path.join(SOURCE_ROOT, AFTER_HOME_BOOTSTRAP_SCRIPT_PATH));
  return {
    match: true,
    sha256: sha256(afterAssembly),
    bytes: afterAssembly.length,
    migrated: MEMBER_RESERVATION_SCRIPT_PATHS,
    sourceOrder
  };
}

function migrateDetailSectionBootModules() {
  const manifest = readManifest();
  const sourceIndex = manifest.sourceOrder.indexOf(AFTER_MEMBER_RESERVATION_SCRIPT_PATH);
  if (sourceIndex < 0) throw new Error("detail_section_boot_source_already_migrated_or_missing");
  if (DETAIL_SECTION_BOOT_SCRIPT_PATHS.some((name) => fs.existsSync(path.join(SOURCE_ROOT, name)))) {
    throw new Error("detail_section_boot_target_already_exists");
  }
  const beforeAssembly = assembleFromSource(manifest);
  const source = fs.readFileSync(path.join(SOURCE_ROOT, AFTER_MEMBER_RESERVATION_SCRIPT_PATH));
  if (!source.toString("utf8").trimStart().startsWith("function findHeroOctoberMonthlyJoin")) {
    throw new Error("detail_section_boot_start_boundary_changed");
  }
  const [detailBuilder, sectionTail] = splitAtAnchor(source, "function isLargeDesktopQuickLayout");
  const [homeSections, detailTail] = splitAtAnchor(sectionTail, "function renderDetailContent");
  const [detailActions, boot] = splitAtAnchor(detailTail, "async function initializeGolfJoinHome");
  const parts = [detailBuilder, homeSections, detailActions, boot];
  DETAIL_SECTION_BOOT_SCRIPT_PATHS.forEach((relativePath, index) => {
    const targetPath = path.join(SOURCE_ROOT, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, parts[index]);
  });
  const sourceOrder = manifest.sourceOrder.slice();
  sourceOrder.splice(sourceIndex, 1, ...DETAIL_SECTION_BOOT_SCRIPT_PATHS);
  const nextManifest = {
    ...manifest,
    sourceOrder,
    fragments: describeFragments(sourceOrder)
  };
  const afterAssembly = assembleFromSource(nextManifest);
  if (!afterAssembly.equals(beforeAssembly)) throw new Error("detail_section_boot_migration_changed_output");
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  fs.unlinkSync(path.join(SOURCE_ROOT, AFTER_MEMBER_RESERVATION_SCRIPT_PATH));
  return {
    match: true,
    sha256: sha256(afterAssembly),
    bytes: afterAssembly.length,
    migrated: DETAIL_SECTION_BOOT_SCRIPT_PATHS,
    sourceOrder
  };
}

function migrateStoreModules() {
  const manifest = readManifest();
  STORE_SOURCE_RENAMES.forEach(([sourcePath, targetPath]) => {
    if (!manifest.sourceOrder.includes(sourcePath)) {
      throw new Error(`store_source_already_migrated_or_missing:${sourcePath}`);
    }
    if (fs.existsSync(path.join(SOURCE_ROOT, targetPath))) {
      throw new Error(`store_target_already_exists:${targetPath}`);
    }
  });
  const beforeAssembly = assembleFromSource(manifest);
  STORE_SOURCE_RENAMES.forEach(([sourcePath, targetPath]) => {
    const target = path.join(SOURCE_ROOT, targetPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fs.readFileSync(path.join(SOURCE_ROOT, sourcePath)));
  });
  const sourceOrder = manifest.sourceOrder.map((relativePath) => {
    const rename = STORE_SOURCE_RENAMES.find(([sourcePath]) => sourcePath === relativePath);
    return rename ? rename[1] : relativePath;
  });
  const nextManifest = {
    ...manifest,
    sourceOrder,
    fragments: describeFragments(sourceOrder)
  };
  const afterAssembly = assembleFromSource(nextManifest);
  if (!afterAssembly.equals(beforeAssembly)) throw new Error("store_migration_changed_output");
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  STORE_SOURCE_RENAMES.forEach(([sourcePath]) => {
    fs.unlinkSync(path.join(SOURCE_ROOT, sourcePath));
  });
  return {
    match: true,
    sha256: sha256(afterAssembly),
    bytes: afterAssembly.length,
    migrated: STORE_SOURCE_RENAMES.map(([, targetPath]) => targetPath),
    sourceOrder
  };
}

function verifyCurrent() {
  const manifest = readManifest();
  const assembled = assembleFromSource(manifest);
  const current = fs.readFileSync(MAIN_HTML_PATH);
  return {
    match: assembled.equals(current),
    baselineSha256: manifest.baselineSha256,
    sourceSha256: sha256(assembled),
    currentSha256: sha256(current),
    sourceBytes: assembled.length,
    currentBytes: current.length
  };
}

function build(outputPath = DEFAULT_OUTPUT_PATH) {
  const resolvedOutput = assertWorkspacePath(outputPath);
  const assembled = assembleFromSource();
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, assembled);
  return {
    output: path.relative(WORKSPACE_ROOT, resolvedOutput).replaceAll("\\", "/"),
    bytes: assembled.length,
    sha256: sha256(assembled)
  };
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function main(argv) {
  const command = argv[2];
  if (command === "init") {
    printResult({ command, ...initializeSource() });
    return;
  }
  if (command === "verify") {
    const result = verifyCurrent();
    printResult({ command, ...result });
    if (!result.match) process.exitCode = 1;
    return;
  }
  if (command === "build") {
    const outputIndex = argv.indexOf("--output");
    const outputPath = outputIndex >= 0 ? argv[outputIndex + 1] : DEFAULT_OUTPUT_PATH;
    if (outputIndex >= 0 && !outputPath) throw new Error("build_output_missing");
    printResult({ command, ...build(outputPath) });
    return;
  }
  if (command === "migrate-diagnostics") {
    printResult({ command, ...migrateDiagnosticsModule() });
    return;
  }
  if (command === "migrate-loading") {
    printResult({ command, ...migrateLoadingModule() });
    return;
  }
  if (command === "migrate-member-home-data") {
    printResult({ command, ...migrateMemberHomeDataModules() });
    return;
  }
  if (command === "migrate-member-reservations") {
    printResult({ command, ...migrateMemberReservationModule() });
    return;
  }
  if (command === "migrate-detail-sections-boot") {
    printResult({ command, ...migrateDetailSectionBootModules() });
    return;
  }
  if (command === "migrate-store") {
    printResult({ command, ...migrateStoreModules() });
    return;
  }
  throw new Error("Usage: node tools/golfjoin-main/source-bundle.js <init|verify|build|migrate-diagnostics|migrate-loading|migrate-member-home-data|migrate-member-reservations|migrate-detail-sections-boot|migrate-store> [--output <workspace-path>]");
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  SOURCE_ORDER,
  assembleFromSource,
  assertWorkspacePath,
  build,
  initializeSource,
  migrateDiagnosticsModule,
  migrateDetailSectionBootModules,
  migrateLoadingModule,
  migrateMemberHomeDataModules,
  migrateMemberReservationModule,
  migrateStoreModules,
  sha256,
  splitAtAnchor,
  splitBetweenAnchors,
  splitMainHtml,
  splitMarkedRegion,
  verifyCurrent
};
