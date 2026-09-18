"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const { sha256 } = require("../../tools/golfjoin-main/external-assets");
const { PACKAGE_ROOT, verifyInlineScripts } = require("../../tools/golfjoin-main/prepare-stage13-critical");

test("critical CSS 패키지는 현 운영 복구본·30KB 예산·성능 근거를 고정한다", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "manifest.json"), "utf8"));
  assert.equal(manifest.schema, "secret-golf-join-critical-css-deployment-v1");
  assert.equal(manifest.stagingEventPlanSeq, 18);
  assert.equal(manifest.productionEventPlanSeq, 3);
  assert.equal(manifest.requiresGcsUpload, false);
  assert.equal(manifest.browserReadEnabled, false);
  assert.ok(manifest.criticalCssGzipBytes <= manifest.criticalCssBudgetBytes);
  assert.ok(manifest.performance.pc.improvementPercent >= 15);
  assert.ok(manifest.performance.mobile.improvementPercent >= 15);
  assert.equal(manifest.performance.pageErrorCount, 0);

  for (const file of Object.values(manifest.files)) {
    const buffer = fs.readFileSync(path.join(PACKAGE_ROOT, file.fileName));
    assert.equal(buffer.length, file.bytes);
    assert.equal(sha256(buffer), file.sha256);
  }
  assert.equal(manifest.files.rollbackHtml.sha256, "36b1dc681bcbe3ede0d70e39d3766f88349c603a2003dc9fa9cada4f1d406bd3");
  const deploy = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.deployHtml.fileName));
  const auditCss = fs.readFileSync(path.join(PACKAGE_ROOT, manifest.files.auditCriticalCss.fileName));
  assert.equal(zlib.gzipSync(auditCss, { level: 9, mtime: 0 }).length, manifest.criticalCssGzipBytes);
  assert.equal(verifyInlineScripts(deploy.toString("utf8")), manifest.inlineScriptCount);
  assert.match(deploy.toString("utf8"), /rel="preload" as="style"/);
  assert.match(deploy.toString("utf8"), /<noscript><link rel="stylesheet"/);
});
