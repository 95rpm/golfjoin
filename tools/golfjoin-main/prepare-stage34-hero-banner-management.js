"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const terser = require("terser");
const { buildExternalAssetBundle, sriSha256 } = require("./external-assets");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage34-hero-banner-management/dashboard-hero-banners-20260821-v34m");
const SOURCE_ROOT = path.join(ROOT, "src/golfjoin-main");
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "source-manifest.json");
const MAIN_ROLLBACK = path.join(ROOT, "deploy/stage34-hero-banner-management/dashboard-hero-banners-20260821-v34j/DEPLOY_golfjoin_main_banner_management_F6FE223D.html");
const MAIN_BASE = MAIN_ROLLBACK;
const DASHBOARD_ROLLBACK = path.join(ROOT, "deploy/stage33-quote-list-comma-preservation/quote-linebreak-only-20260821-v33/DEPLOY_golfjoin_admin_dashboard_E2FD6338.html");
const SERVER_ROLLBACK_BASE = path.join(ROOT, "deploy/stage30-member-auth-gate/legacy-profile-alias-ui-20260821-v30c/stage30c-index.js");
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");
const JAVASCRIPT_BUDGET = 205 * 1024;
const JAVASCRIPT_RESERVED_WORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "implements", "import", "in", "instanceof",
  "interface", "let", "new", "null", "package", "private", "protected", "public",
  "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "yield"
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function read(relativeOrAbsolute) {
  const target = path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.join(ROOT, relativeOrAbsolute);
  return fs.readFileSync(target);
}

function record(fileName, buffer, extra = {}) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer), ...extra };
}

function collectInlineHandlerNames(...sources) {
  const names = new Set();
  const attributePattern = /\bon[a-z]+\s*=\s*["']([\s\S]*?)["']/gi;
  const callPattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (const input of sources) {
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(String(input || "")))) {
      let callMatch;
      while ((callMatch = callPattern.exec(attributeMatch[1]))) {
        if (!JAVASCRIPT_RESERVED_WORDS.has(callMatch[1])) names.add(callMatch[1]);
      }
    }
  }
  return [...names].sort();
}

function buildInlineHandlerBridge(handlerNames = []) {
  return handlerNames.length
    ? `\n;/* golfjoin-inline-handler-bridge */${handlerNames.map((name) => `typeof ${name}==="function"&&(window[${JSON.stringify(name)}]=${name});`).join("")}\n`
    : "";
}

function replaceOnce(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count !== 1) throw new Error(`${label}_count_invalid:${count}`);
  return source.replace(target, replacement);
}

function buildServerRollback() {
  const source = read(SERVER_ROLLBACK_BASE).toString("utf8");
  return Buffer.from(replaceOnce(
    source,
    "asText(value).split(/[\\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 12)",
    "asText(value).split(/\\r?\\n/).map((item) => item.trim()).filter(Boolean).slice(0, 12)",
    "server_rollback_quote_split"
  ), "utf8");
}

async function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const manifest = JSON.parse(read(SOURCE_MANIFEST).toString("utf8"));
  const scriptPaths = manifest.sourceOrder.filter((value) => /^source\/scripts\/.+\.js$/.test(value));
  const rawJs = Buffer.concat(scriptPaths.map((relativePath) => read(path.join(SOURCE_ROOT, relativePath))));
  const markup = read(path.join(SOURCE_ROOT, "source/markup/20-main.html")).toString("utf8");
  const suffix = read(path.join(SOURCE_ROOT, "source/shell/40-suffix.html")).toString("utf8");
  const handlerNames = collectInlineHandlerNames(markup, suffix, rawJs.toString("utf8"));
  const bridged = `${rawJs.toString("utf8")}${buildInlineHandlerBridge(handlerNames)}`;
  new vm.Script(bridged, { filename: "golfjoin-main.stage34.source.js" });
  const minified = await terser.minify(bridged, {
    compress: { passes: 2, toplevel: false },
    mangle: { toplevel: false, reserved: handlerNames },
    format: { comments: false }
  });
  if (!minified.code) throw new Error("minified_javascript_empty");
  const js = Buffer.from(minified.code, "utf8");
  new vm.Script(js.toString("utf8"), { filename: "golfjoin-main.stage34.min.js" });

  const identity = buildExternalAssetBundle({ mainHtmlPath: MAIN_ROLLBACK });
  const css = identity.artifacts.css.buffer;
  const assetRevision = `gha_${sha256(Buffer.concat([
    css,
    Buffer.from("\n--golfjoin-asset-boundary--\n"),
    js,
    Buffer.from("\n--golfjoin-delivery-gzip-css-brotli-js-v1--\n")
  ])).slice(0, 24)}`;
  const cssObjectName = `web/home-assets/${assetRevision}/golfjoin-main.css`;
  const jsObjectName = `web/home-assets/${assetRevision}/golfjoin-main.js`;
  const baseUrl = `https://storage.googleapis.com/golfjoin-bucket/web/home-assets/${assetRevision}`;
  const oldRevision = identity.assetRevision;
  const baseHtml = read(MAIN_BASE).toString("utf8");
  const baseRevisionMatch = baseHtml.match(/gha_[a-f0-9]{24}/);
  const baseCssSriMatch = baseHtml.match(/golfjoin-main\.css" integrity="([^"]+)"/);
  const baseJsSriMatch = baseHtml.match(/golfjoin-main\.js" integrity="([^"]+)"/);
  if (!baseRevisionMatch || !baseCssSriMatch || !baseJsSriMatch) throw new Error("main_base_asset_reference_missing");
  let deployHtml = baseHtml.split(baseRevisionMatch[0]).join(assetRevision);
  deployHtml = deployHtml.split(baseCssSriMatch[1]).join(sriSha256(css));
  deployHtml = deployHtml.split(baseJsSriMatch[1]).join(sriSha256(js));
  const deployHtmlBuffer = Buffer.from(deployHtml, "utf8");
  const cssGzip = zlib.gzipSync(css, { level: 9, mtime: 0 });
  const jsBrotli = zlib.brotliCompressSync(js, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
    }
  });
  if (jsBrotli.length > JAVASCRIPT_BUDGET) {
    throw new Error(`javascript_budget_exceeded:${jsBrotli.length}`);
  }

  const dashboard = read("golfjoin_admin_dashboard.html");
  const dashboardRollback = read(DASHBOARD_ROLLBACK);
  const serverIndex = read(path.join(SERVER_ROOT, "index.js"));
  const heroModule = read(path.join(SERVER_ROOT, "hero-banners.js"));
  const heroTest = read(path.join(SERVER_ROOT, "hero-banners.test.js"));
  const heroIntegrationTest = read(path.join(SERVER_ROOT, "hero-banners-integration.test.js"));
  const serverRollback = buildServerRollback();
  const mainRollback = read(MAIN_ROLLBACK);

  const names = {
    mainDeploy: `DEPLOY_golfjoin_main_banner_management_${sha256(deployHtmlBuffer).slice(0, 8).toUpperCase()}.html`,
    mainRollback: `ROLLBACK_golfjoin_main_${sha256(mainRollback).slice(0, 8).toUpperCase()}.html`,
    dashboardDeploy: `DEPLOY_golfjoin_admin_dashboard_${sha256(dashboard).slice(0, 8).toUpperCase()}.html`,
    dashboardRollback: `ROLLBACK_golfjoin_admin_dashboard_${sha256(dashboardRollback).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${sha256(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${sha256(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    serverIndex: "stage34-index.js",
    serverModule: "stage34-hero-banners.js",
    serverTest: "stage34-hero-banners.test.js",
    serverIntegrationTest: "stage34-hero-banners-integration.test.js",
    serverRollback: "ROLLBACK_stage34-index.js"
  };

  fs.mkdirSync(OUTPUT, { recursive: true });
  const outputs = {
    [names.mainDeploy]: deployHtmlBuffer,
    [names.mainRollback]: mainRollback,
    [names.dashboardDeploy]: dashboard,
    [names.dashboardRollback]: dashboardRollback,
    [names.css]: cssGzip,
    [names.js]: jsBrotli,
    [names.serverIndex]: serverIndex,
    [names.serverModule]: heroModule,
    [names.serverTest]: heroTest,
    [names.serverIntegrationTest]: heroIntegrationTest,
    [names.serverRollback]: serverRollback
  };
  Object.entries(outputs).forEach(([name, buffer]) => fs.writeFileSync(path.join(OUTPUT, name), buffer, { flag: "wx" }));

  const files = Object.fromEntries(Object.entries(outputs).map(([name, buffer]) => [name, record(name, buffer)]));
  const packageManifest = {
    schema: "secret-golf-join-hero-banner-management-v1",
    status: "ready-for-test",
    preparedAt: new Date().toISOString(),
    assetRevision,
    javascriptBudget: { bytes: jsBrotli.length, limitBytes: JAVASCRIPT_BUDGET, passed: true },
    storage: {
      bucket: "golfjoin-bucket",
      manifestObjectName: "web/hero-banners/manifest.json",
      manifestPublicUrl: "https://storage.googleapis.com/golfjoin-bucket/web/hero-banners/manifest.json",
      cssObjectName,
      jsObjectName
    },
    features: {
      dashboardBannerMenu: true,
      imagePreview: true,
      imageUrlRegistration: true,
      linkRegistration: true,
      addDeleteReorder: true,
      generationConflictProtection: true,
      fiveSecondHeroSlider: true,
      staticFallbackBanners: true
    },
    files,
    names
  };

  const runbook = `# 34단계: 대시보드 배너관리 + 메인 Hero 동적 배너\n\n`
    + `## 전체 작업 순서\n\n`
    + `- [ ] 1. 서버 파일 4개를 Cloud Shell 작업 폴더에 업로드합니다.\n`
    + `- [ ] 2. 아래 해시 검사 후 서버 파일을 교체하고 전체 테스트를 실행합니다.\n`
    + `- [ ] 3. 현재 Cloud Run revision을 기록하고 Sheet API를 배포합니다.\n`
    + `- [ ] 4. 대시보드 HTML을 Firebase Hosting에 배포합니다.\n`
    + `- [ ] 5. CSS gzip·JS Brotli를 신규 GCS 불변 경로에 업로드합니다.\n`
    + `- [ ] 6. 29번 테스트 페이지 HTML을 교체합니다.\n`
    + `- [ ] 7. 대시보드 배너관리에서 기본 배너 2개와 빈 링크를 확인합니다.\n`
    + `- [ ] 8. 링크를 등록·수정하고 저장한 뒤 공개 manifest를 확인합니다.\n`
    + `- [ ] 9. PC·모바일 Hero 전환·클릭 링크·기본 기능을 회귀 검사합니다.\n`
    + `- [ ] 10. 모두 정상일 때 운영 이벤트 HTML을 같은 파일로 교체합니다.\n\n`
    + `## 1. 서버 파일 해시 확인·교체·검사\n\n`
    + `Cloud Shell의 \`/home/llno95ll/google-sheet-proxy-function\`에 다음 네 파일을 업로드합니다.\n\n`
    + `- \`${names.serverIndex}\`\n- \`${names.serverModule}\`\n- \`${names.serverTest}\`\n- \`${names.serverIntegrationTest}\`\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\n\nsha256sum ${names.serverIndex} ${names.serverModule} ${names.serverTest} ${names.serverIntegrationTest}\n\ncp -f ${names.serverIndex} index.js\ncp -f ${names.serverModule} hero-banners.js\ncp -f ${names.serverTest} hero-banners.test.js\ncp -f ${names.serverIntegrationTest} hero-banners-integration.test.js\n\nnode --check index.js\nnode --check hero-banners.js\nnpm test\n\nPREVIOUS_STAGE34_REVISION="$(gcloud functions describe golfjoin-sheet-api --gen2 --region=asia-northeast3 --project=golfjoin-499602 --format='value(serviceConfig.revision)')"\nprintf 'PREVIOUS_STAGE34_REVISION=%s\\n' "$PREVIOUS_STAGE34_REVISION"\n\ngcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml\n\`\`\`\n\n`
    + `## 2. 대시보드 배포\n\n`
    + `\`${names.dashboardDeploy}\`를 \`/home/llno95ll/golfjoin-admin-hosting\`에 업로드한 뒤 실행합니다.\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/golfjoin-admin-hosting\ncp -f ${names.dashboardDeploy} public/index.html\nsha256sum public/index.html\nfirebase deploy --only hosting --project dashboad-golfjoin-secrettour\n\`\`\`\n\n`
    + `## 3. 메인 자산 GCS 업로드\n\n`
    + `\`${names.css}\`, \`${names.js}\`를 서버 작업 폴더에 업로드한 뒤 실행합니다.\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ngcloud storage cp ${names.css} gs://golfjoin-bucket/${cssObjectName} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObjectName} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\n\`\`\`\n\n`
    + `## 4. 테스트 페이지와 운영 전환\n\n`
    + `- 테스트 HTML: \`${names.mainDeploy}\`\n`
    + `- 29번 테스트 페이지에서 PC·모바일을 먼저 확인합니다.\n`
    + `- 배너 추가, 삭제, 순서 이동, 이미지 URL, 연결 링크, 저장 후 새로고침을 확인합니다.\n`
    + `- 연결 링크가 없는 배너는 클릭 이동하지 않는지 확인합니다.\n`
    + `- 저장 실패 또는 manifest 조회 실패 시 기본 배너 두 장이 계속 보이는지 확인합니다.\n`
    + `- 정상일 때 운영 이벤트 페이지에 같은 HTML을 배포합니다.\n\n`
    + `## 즉시 복구\n\n`
    + `- 메인 HTML: \`${names.mainRollback}\`\n`
    + `- 대시보드 HTML: \`${names.dashboardRollback}\`\n`
    + `- 서버 파일: \`${names.serverRollback}\` 또는 기록한 \`$PREVIOUS_STAGE34_REVISION\`으로 트래픽 100% 복구\n`
    + `- 신규 GCS 자산과 배너 manifest는 삭제하지 않아도 기존 HTML·서버에서 읽지 않습니다.\n`
    + `- 회원 인증 Gate 값은 이번 작업에서 변경하지 않습니다. 기존 값을 그대로 유지합니다.\n\n`
    + `## 생성 결과\n\n`
    + `- Asset revision: \`${assetRevision}\`\n`
    + `- CSS URL: \`${baseUrl}/golfjoin-main.css\`\n`
    + `- JS URL: \`${baseUrl}/golfjoin-main.js\`\n`;

  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(packageManifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook, { flag: "wx" });
  console.log(JSON.stringify({ output: OUTPUT, assetRevision, files, javascriptBudget: packageManifest.javascriptBudget }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
