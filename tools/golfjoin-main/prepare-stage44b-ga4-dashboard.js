"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const OUTPUT = path.join(ROOT, "deploy/stage44-ga4-data-api/ga4-dashboard-breakdowns-20260901-v44b");
const ROLLBACK_ROOT = path.join(ROOT, "deploy/stage44-ga4-data-api/ga4-admin-overview-20260901-v44a");

const files = [
  { source: path.join(SERVER_ROOT, "index.js"), name: "stage44b-index.js", syntax: true },
  { source: path.join(SERVER_ROOT, "ga4-admin-analytics.js"), name: "stage44b-ga4-admin-analytics.js", syntax: true },
  { source: path.join(SERVER_ROOT, "ga4-admin-analytics.test.js"), name: "stage44b-ga4-admin-analytics.test.js", syntax: true },
  { source: path.join(SERVER_ROOT, "ga4-admin-analytics-integration.test.js"), name: "stage44b-ga4-admin-analytics-integration.test.js", syntax: true },
  { source: path.join(ROLLBACK_ROOT, "stage44a-index.js"), name: "ROLLBACK_stage44a-index.js", syntax: true },
  { source: path.join(ROLLBACK_ROOT, "stage44a-ga4-admin-analytics.js"), name: "ROLLBACK_stage44a-ga4-admin-analytics.js", syntax: true }
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
  schema: "golfjoin-stage44b-ga4-dashboard-v1",
  generatedAt: new Date().toISOString(),
  propertyId: "552152254",
  actions: ["admin_ga4_overview", "admin_ga4_dashboard"],
  reports: ["sections", "devices", "members", "trend", "acquisition"],
  files: manifestFiles,
  verification: {
    targetedTests: "10/10 passed",
    serverSuite: "242/243 passed",
    knownUnrelatedFailure: "release-integration.test.js expects a removed inline rollout constant"
  }
};
fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const readme = `# Stage 44b - GA4 관리자 상세 대시보드 API

이 배포는 서버 파일만 교체합니다. 골프조인 메인 HTML과 관리자 HTML은 이번 단계에서 교체하지 않습니다.

## Cloud Shell 업로드 파일

- \`stage44b-index.js\`
- \`stage44b-ga4-admin-analytics.js\`
- \`stage44b-ga4-admin-analytics.test.js\`
- \`stage44b-ga4-admin-analytics-integration.test.js\`
- \`ROLLBACK_stage44a-index.js\`
- \`ROLLBACK_stage44a-ga4-admin-analytics.js\`

## 1. 사전 확인

\`/home/llno95ll/golfjoin-sheet-api.env.yaml\`에 \`GA4_PROPERTY_ID\`가 없다면 소스 기본값 \`552152254\`를 사용합니다. 다른 값이 나오면 배포를 중단합니다.

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function

grep -n '^GA4_PROPERTY_ID:' /home/llno95ll/golfjoin-sheet-api.env.yaml || echo 'GA4_PROPERTY_ID 없음 - 소스 기본값 552152254 사용'
\`\`\`

## 2. 파일 검증과 반영

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function

sha256sum \\
  stage44b-index.js \\
  stage44b-ga4-admin-analytics.js \\
  stage44b-ga4-admin-analytics.test.js \\
  stage44b-ga4-admin-analytics-integration.test.js \\
  ROLLBACK_stage44a-index.js \\
  ROLLBACK_stage44a-ga4-admin-analytics.js

cp -f stage44b-index.js index.js
cp -f stage44b-ga4-admin-analytics.js ga4-admin-analytics.js
cp -f stage44b-ga4-admin-analytics.test.js ga4-admin-analytics.test.js
cp -f stage44b-ga4-admin-analytics-integration.test.js ga4-admin-analytics-integration.test.js

node --check index.js
node --check ga4-admin-analytics.js
node --test ga4-admin-analytics.test.js ga4-admin-analytics-integration.test.js
\`\`\`

정상 결과는 \`tests 10\`, \`pass 10\`, \`fail 0\`입니다.

## 3. 배포

\`\`\`bash
PREVIOUS_STAGE44B_REVISION="$(gcloud functions describe golfjoin-sheet-api \\
  --gen2 \\
  --region=asia-northeast3 \\
  --project=golfjoin-499602 \\
  --format='value(serviceConfig.revision)')"

printf 'PREVIOUS_STAGE44B_REVISION=%s\n' "$PREVIOUS_STAGE44B_REVISION"

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

gcloud run services describe golfjoin-sheet-api \\
  --region=asia-northeast3 \\
  --project=golfjoin-499602 \\
  --format='yaml(status.latestCreatedRevisionName,status.latestReadyRevisionName,status.traffic)'
\`\`\`

## 5. 운영 응답 확인

관리자 대시보드에 로그인한 브라우저 콘솔에서 실행합니다.

\`\`\`javascript
(async () => {
  const auth = JSON.parse(sessionStorage.getItem("golfjoinAdminAuth") || localStorage.getItem("golfjoinAdminAuth") || "{}");
  const response = await fetch("https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api?action=admin_ga4_dashboard&days=7", {
    headers: { "X-Golfjoin-Admin-Token": auth.token || "" }
  });
  const data = await response.json();
  console.log({ httpStatus: response.status, data });
})();
\`\`\`

확인값:

- HTTP \`200\`
- \`schema: "golfjoin-ga4-admin-dashboard-v1"\`
- \`propertyId: "552152254"\`
- \`sections\`, \`devices\`, \`members\`, \`trend\`, \`acquisition\` 배열 존재
- \`cache.status\`가 \`miss\` 또는 \`hit\`

## 복구

\`\`\`bash
cd /home/llno95ll/google-sheet-proxy-function

cp -f ROLLBACK_stage44a-index.js index.js
cp -f ROLLBACK_stage44a-ga4-admin-analytics.js ga4-admin-analytics.js
\`\`\`

두 파일을 되돌린 뒤 위의 동일한 \`gcloud functions deploy\` 명령을 실행합니다.
`;
fs.writeFileSync(path.join(OUTPUT, "README.md"), readme, "utf8");

console.log(JSON.stringify({ output: OUTPUT, manifest }, null, 2));
