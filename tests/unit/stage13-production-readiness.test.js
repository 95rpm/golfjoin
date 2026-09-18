"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyLocalPackage } = require("../../tools/golfjoin-main/verify-stage13-production");

test("13단계 운영 전환 패키지는 배포·복구·CSS·JS 해시와 안전장치를 모두 고정한다", () => {
  const result = verifyLocalPackage(undefined, { requireCurrentMain: false });
  assert.equal(result.ok, true);
  assert.equal(result.assetRevision, "gha_74b1bc7a8f3c58bfe927ac4f");
  assert.equal(result.files.deployHtml.sha256, "eeb447f90fe5be4f9c9ec195f307722d9f14071a76e0d2be2c7ea2667bd867b3");
  assert.equal(result.files.rollbackHtml.sha256, "ab80599c2e1ecea87d730e28a23f30bdd25670066cd763e4c678ef5340884e31");
  assert.equal(result.files.css.bytes, 853185);
  assert.equal(result.files.js.bytes, 1757171);
  assert.equal(result.files.js.sha256, "3855b14d941b2ee7f4e5685c80e6c2d1b75831e443ca825b881e578a46aebdfc");
  assert.equal(result.recoveryTargetMinutes, 5);
});
