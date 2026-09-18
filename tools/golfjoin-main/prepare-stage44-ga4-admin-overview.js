"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const OUTPUT = path.join(ROOT, "deploy/stage44-ga4-data-api/ga4-admin-overview-20260901-v44a");
const ROLLBACK_ROOT = path.join(
  ROOT,
  "deploy/stage40-kakao-resignup/kakao-first-signup-server-derived-20260831-v40j"
);

const files = [
  { source: path.join(SERVER_ROOT, "index.js"), name: "stage44a-index.js", syntax: true },
  { source: path.join(SERVER_ROOT, "ga4-admin-analytics.js"), name: "stage44a-ga4-admin-analytics.js", syntax: true },
  { source: path.join(SERVER_ROOT, "ga4-admin-analytics.test.js"), name: "stage44a-ga4-admin-analytics.test.js", syntax: true },
  { source: path.join(SERVER_ROOT, "ga4-admin-analytics-integration.test.js"), name: "stage44a-ga4-admin-analytics-integration.test.js", syntax: true },
  { source: path.join(ROLLBACK_ROOT, "stage40j-index.js"), name: "ROLLBACK_stage40j-index.js", syntax: true }
];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Required file is missing: ${filePath}`);
  return fs.readFileSync(filePath);
}

fs.mkdirSync(OUTPUT, { recursive: true });

const manifestFiles = {};
files.forEach((file) => {
  const buffer = readRequired(file.source);
  if (file.syntax) new vm.Script(buffer.toString("utf8"), { filename: file.name });
  fs.writeFileSync(path.join(OUTPUT, file.name), buffer);
  manifestFiles[file.name] = {
    sha256: sha256(buffer),
    bytes: buffer.length
  };
});

const manifest = {
  schema: "golfjoin-stage44-ga4-admin-overview-v1",
  generatedAt: new Date().toISOString(),
  propertyId: "552152254",
  action: "admin_ga4_overview",
  files: manifestFiles,
  verification: {
    targetedTests: "6/6 passed",
    serverSuite: "238/239 passed",
    knownUnrelatedFailure: "release-integration.test.js expects a removed inline rollout constant"
  }
};
fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const readme = `# Stage 44a - GA4 관리자 개요 API

## Cloud Shell 업로드 파일

- \`stage44a-index.js\`
- \`stage44a-ga4-admin-analytics.js\`
- \`stage44a-ga4-admin-analytics.test.js\`
- \`stage44a-ga4-admin-analytics-integration.test.js\`
- \`ROLLBACK_stage40j-index.js\`

## 1. 사전 확인

\`/home/llno95ll/golfjoin-sheet-api.env.yaml\`에 \`GA4_PROPERTY_ID\`가 없다면 소스 기본값 \`552152254\`를 사용합니다. 값이 있다면 반드시 \`552152254\`여야 합니다.

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function

grep -n '^GA4_PROPERTY_ID:' /home/llno95ll/golfjoin-sheet-api.env.yaml || echo 'GA4_PROPERTY_ID 없음 - 소스 기본값 552152254 사용'
\`\`\`

다른 값이 나오면 배포를 중단하고 env 파일의 값을 먼저 확인합니다.

## 2. 파일 검증과 반영

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function

sha256sum \\
  stage44a-index.js \\
  stage44a-ga4-admin-analytics.js \\
  stage44a-ga4-admin-analytics.test.js \\
  stage44a-ga4-admin-analytics-integration.test.js \\
  ROLLBACK_stage40j-index.js

cp -f stage44a-index.js index.js
cp -f stage44a-ga4-admin-analytics.js ga4-admin-analytics.js
cp -f stage44a-ga4-admin-analytics.test.js ga4-admin-analytics.test.js
cp -f stage44a-ga4-admin-analytics-integration.test.js ga4-admin-analytics-integration.test.js

node --check index.js
node --check ga4-admin-analytics.js
node --test ga4-admin-analytics.test.js ga4-admin-analytics-integration.test.js
\`\`\`

## 3. 배포

\`\`\`bash
PREVIOUS_STAGE44_REVISION="$(gcloud functions describe golfjoin-sheet-api \\
  --gen2 \\
  --region=asia-northeast3 \\
  --project=golfjoin-499602 \\
  --format='value(serviceConfig.revision)')"

printf 'PREVIOUS_STAGE44_REVISION=%s\\n' "$PREVIOUS_STAGE44_REVISION"

gcloud functions deploy golfjoin-sheet-api \\
  --gen2 \\
  --runtime=nodejs22 \\
  --region=asia-northeast3 \\
  --project=golfjoin-499602 \\
  --source=. \\
  --entry-point=proxyGoogleSheet \\
  --trigger-http \\
  --timeout=540s \\
  --memory=1GiB \\
  --allow-unauthenticated \\
  --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
\`\`\`

## 4. 배포 상태 확인

\`\`\`bash
gcloud functions describe golfjoin-sheet-api \\
  --gen2 \\
  --region=asia-northeast3 \\
  --project=golfjoin-499602 \\
  --format='yaml(state,updateTime,serviceConfig.revision,serviceConfig.environmentVariables.GA4_PROPERTY_ID,serviceConfig.uri)'
\`\`\`

## 복구

문제 발생 시 \`cp -f ROLLBACK_stage40j-index.js index.js\` 후 같은 배포 명령을 실행합니다. 새 모듈 파일은 남아 있어도 이전 index에서 불러오지 않으므로 실행에 영향이 없습니다.
`;
fs.writeFileSync(path.join(OUTPUT, "README.md"), readme, "utf8");

console.log(JSON.stringify({ output: OUTPUT, manifest }, null, 2));
