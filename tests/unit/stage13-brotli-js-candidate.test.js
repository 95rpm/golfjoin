"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const {
  BROTLI_QUALITY,
  JAVASCRIPT_BUDGET_BYTES,
  buildBrotliCandidate,
  collectInlineHandlerNames,
  prepareBrotliPackage
} = require("../../tools/golfjoin-main/prepare-stage13-brotli-js");
const { sha256, sriSha256 } = require("../../tools/golfjoin-main/external-assets");

const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const TEST_ROOT = path.join(WORKSPACE_ROOT, ".tmp");

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function makeSourcePackage(t) {
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  const root = fs.mkdtempSync(path.join(TEST_ROOT, "stage13-brotli-js-"));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(TEST_ROOT));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const oldRevision = "gha_111111111111111111111111";
  const css = Buffer.from("body{color:#123}.card{display:block}\n", "utf8");
  const js = Buffer.from(
    "function addTogether(firstValue, secondValue) { return firstValue + secondValue; }\n"
      + "function switchFixtureTab(tabKey) { window.fixtureTab = tabKey; }\n"
      + "function setDynamicFixtureFilter(filterKey) { window.fixtureFilter = filterKey; }\n"
      + "window.dynamicFixtureMarkup = `<button onclick=\"setDynamicFixtureFilter('joined')\">joined</button>`;\n"
      + "window.stage13Result = addTogether(20, 22);\n"
      + "window.stage13Message = 'candidate-safe';\n",
    "utf8"
  );
  const cssGzip = zlib.gzipSync(css, { level: 9, mtime: 0 });
  const jsGzip = zlib.gzipSync(js, { level: 9, mtime: 0 });
  const cssSri = sriSha256(css);
  const jsSri = sriSha256(js);
  const cssUrl = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${oldRevision}/golfjoin-main.css`;
  const jsUrl = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${oldRevision}/golfjoin-main.js`;
  const html = Buffer.from(
    "<!doctype html><html><head>"
      + `<script>window.assetRevision=${JSON.stringify(oldRevision)};<\/script>`
      + "<style data-golfjoin-critical-css=\"fixture-critical\">\nbody{color:#123}\n</style>"
      + `<link rel=\"preload\" as=\"style\" href=\"${cssUrl}\" integrity=\"${cssSri}\">`
      + `<noscript><link rel=\"stylesheet\" href=\"${cssUrl}\" integrity=\"${cssSri}\"></noscript>`
      + "</head><body>fixture"
      + "<button id=\"fixtureTab\" onclick=\"switchFixtureTab('joined')\">joined</button>"
      + `<div data-asset-revision=\"${oldRevision}\"></div>`
      + `<script src=\"${jsUrl}\" integrity=\"${jsSri}\" crossorigin=\"anonymous\"></script>`
      + "</body></html>",
    "utf8"
  );
  const files = {
    deployHtml: record("DEPLOY_source.html", html),
    css: record("UPLOAD_source.css.gz", cssGzip, {
      logicalSha256: sha256(css),
      sri: cssSri,
      contentEncoding: "gzip"
    }),
    js: record("UPLOAD_source.js.gz", jsGzip, {
      logicalSha256: sha256(js),
      sri: jsSri,
      contentEncoding: "gzip"
    })
  };
  const manifest = {
    status: "production-deployed-verified",
    assetRevision: oldRevision,
    files
  };
  fs.writeFileSync(path.join(root, files.deployHtml.fileName), html);
  fs.writeFileSync(path.join(root, files.css.fileName), cssGzip);
  fs.writeFileSync(path.join(root, files.js.fileName), jsGzip);
  fs.writeFileSync(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, oldRevision, css, js, html };
}

test("운영 검증본을 바꾸지 않고 JS만 축소·Brotli 전송 후보로 만든다", async (t) => {
  const source = makeSourcePackage(t);
  const candidate = await buildBrotliCandidate({
    sourcePackage: source.root,
    generatedAt: "2026-08-13T18:00:00+09:00"
  });
  const candidateHtml = candidate.candidateHtml.toString("utf8");
  const decodedJs = zlib.brotliDecompressSync(candidate.jsBrotli);

  assert.equal(decodedJs.toString("utf8"), candidate.minifiedJs.toString("utf8"));
  assert.ok(candidate.minifiedJs.length > 0);
  assert.ok(candidate.jsBrotli.length <= JAVASCRIPT_BUDGET_BYTES);
  assert.equal(BROTLI_QUALITY, 11);
  assert.doesNotMatch(candidateHtml, new RegExp(source.oldRevision));
  assert.match(candidateHtml, new RegExp(candidate.assetRevision));
  assert.match(candidateHtml, new RegExp(candidate.assets.js.logicalSri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(candidateHtml, /<style data-golfjoin-critical-css="fixture-critical">\nbody\{color:#123\}\n<\/style>/);
  assert.equal(candidate.assets.css.contentEncoding, "gzip");
  assert.equal(candidate.assets.js.contentEncoding, "br");

  const originalSandbox = {};
  originalSandbox.window = originalSandbox;
  const candidateSandbox = {};
  candidateSandbox.window = candidateSandbox;
  const originalContext = vm.createContext(originalSandbox);
  const candidateContext = vm.createContext(candidateSandbox);
  new vm.Script(source.js.toString("utf8")).runInContext(originalContext);
  new vm.Script(`(function(){${candidate.minifiedJs.toString("utf8")}\n}).call(window);`).runInContext(candidateContext);
  assert.equal(candidateContext.stage13Result, originalContext.stage13Result);
  assert.equal(candidateContext.stage13Message, originalContext.stage13Message);
  assert.equal(typeof candidateContext.window.switchFixtureTab, "function");
  assert.equal(typeof candidateContext.window.setDynamicFixtureFilter, "function");
  candidateContext.window.switchFixtureTab("joined");
  candidateContext.window.setDynamicFixtureFilter("created");
  assert.equal(candidateContext.window.fixtureTab, "joined");
  assert.equal(candidateContext.window.fixtureFilter, "created");
  assert.deepEqual(candidate.inlineHandlerNames, ["setDynamicFixtureFilter", "switchFixtureTab"]);
});

test("정적 HTML과 동적 템플릿의 인라인 UI 함수를 함께 수집한다", () => {
  assert.deepEqual(
    collectInlineHandlerNames(
      '<button onclick="switchJoinMyTab(\'joined\')">참여중</button>',
      '`<button onclick="setMyJoinFilter(\'joined\')">참여중인 모임</button>`',
      '<button onclick="event.preventDefault(); location.reload()">새로고침</button>'
    ),
    ["preventDefault", "reload", "setMyJoinFilter", "switchJoinMyTab"]
  );
});

test("배포본·즉시 복구본·gzip CSS·Brotli JS와 감사용 논리 JS를 한 묶음으로 기록한다", async (t) => {
  const source = makeSourcePackage(t);
  const output = path.join(source.root, "output");
  const result = await prepareBrotliPackage({
    sourcePackage: source.root,
    output,
    generatedAt: "2026-08-13T18:00:00+09:00"
  });
  const manifest = result.manifest;
  const jsEncoded = fs.readFileSync(path.join(output, manifest.files.js.fileName));
  const auditJs = fs.readFileSync(path.join(output, manifest.files.auditJs.fileName));

  assert.equal(manifest.status, "ready-for-local-verification");
  assert.equal(manifest.sourceAssetRevision, source.oldRevision);
  assert.equal(manifest.javascriptBudgetPassed, true);
  assert.equal(manifest.delivery.css, "gzip");
  assert.equal(manifest.delivery.javascript, "br");
  assert.equal(manifest.minifier.version, "5.50.0");
  assert.equal(manifest.minifier.topLevel, false);
  assert.equal(manifest.minifier.inlineHandlerBridge, true);
  assert.deepEqual(manifest.minifier.inlineHandlerNames, ["setDynamicFixtureFilter", "switchFixtureTab"]);
  assert.equal(zlib.brotliDecompressSync(jsEncoded).toString("utf8"), auditJs.toString("utf8"));
  assert.equal(
    fs.readFileSync(path.join(output, manifest.files.rollbackHtml.fileName)).compare(source.html),
    0
  );
  assert.match(fs.readFileSync(path.join(output, "RUNBOOK.md"), "utf8"), /eventPlanSeq=18/);
  assert.match(fs.readFileSync(path.join(output, "RUNBOOK.md"), "utf8"), /content-encoding=br/);
});

test("운영 검증 완료 표시가 없는 패키지는 후보 입력으로 사용하지 않는다", async (t) => {
  const source = makeSourcePackage(t);
  const manifestPath = path.join(source.root, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.status = "ready-for-production";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await assert.rejects(
    () => buildBrotliCandidate({ sourcePackage: source.root }),
    /source_package_not_production_verified/
  );
});
