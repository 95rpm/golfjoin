"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(
  ROOT,
  "deploy/stage34-hero-banner-management/dashboard-banner-grid-20260821-v34l"
);
const SOURCE = path.join(ROOT, "golfjoin_admin_dashboard.html");
const ROLLBACK = path.join(
  ROOT,
  "deploy/stage34-hero-banner-management/dashboard-hero-banners-20260821-v34j/DEPLOY_golfjoin_admin_dashboard_0FDC2D4B.html"
);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function describe(fileName, buffer) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer) };
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const deploy = fs.readFileSync(SOURCE);
  const rollback = fs.readFileSync(ROLLBACK);
  const deployName = `DEPLOY_golfjoin_admin_dashboard_${sha256(deploy).slice(0, 8).toUpperCase()}.html`;
  const rollbackName = `ROLLBACK_golfjoin_admin_dashboard_${sha256(rollback).slice(0, 8).toUpperCase()}.html`;
  const files = {
    [deployName]: describe(deployName, deploy),
    [rollbackName]: describe(rollbackName, rollback)
  };

  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, deployName), deploy);
  fs.writeFileSync(path.join(OUTPUT, rollbackName), rollback);
  fs.writeFileSync(path.join(OUTPUT, "MANIFEST.json"), `${JSON.stringify({
    schema: "golfjoin-dashboard-banner-grid-v1",
    createdAt: new Date().toISOString(),
    layout: { desktopColumns: 4, tabletColumns: 2, mobileColumns: 1 },
    files
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(OUTPUT, "README.md"), `# 대시보드 배너관리 4열 배포\n\n`
    + `- PC: 4열\n- 1180px 이하: 2열\n- 780px 이하: 1열\n\n`
    + `## 배포 파일\n\n- ${deployName}\n\n`
    + `## 즉시 복구 파일\n\n- ${rollbackName}\n`);
  process.stdout.write(`${JSON.stringify({ output: OUTPUT, files }, null, 2)}\n`);
}

main();
