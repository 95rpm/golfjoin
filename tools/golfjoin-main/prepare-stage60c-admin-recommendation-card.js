"use strict";

// Creates a narrow, immutable-asset release on top of the current v60b
// production package.  Do not substitute the larger source bundle here:
// production v60b is the JavaScript baseline and this release changes only
// the administrator-recommended, zero-participant card state.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const BASE = path.join(ROOT, "deploy/stage60c-admin-recommendation-card/admin-recommendation-card-20260904-v60c7");
const OUTPUT = path.join(ROOT, "deploy/stage60c-admin-recommendation-card/admin-recommendation-card-20260904-v60c8");
const BASE_HTML = path.join(BASE, "DEPLOY_golfjoin_main_admin_recommendation_card_D2A7E837.html");
const BASE_CSS = path.join(BASE, "UPLOAD_golfjoin-main_3389111A.css.gz");
const BASE_JS = path.join(BASE, "UPLOAD_golfjoin-main_AFCB60AB.js.br");

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sri = (value) => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;
const read = (file) => fs.readFileSync(file);
const record = (fileName, buffer, extra = {}) => ({ fileName, bytes: buffer.length, sha256: hash(buffer), ...extra });

const CSS_ADDITION = `
/* 여행지 검색·참여가능한 모임 캘린더: 참여자 없는 관리자 추천일정 */
.recommended-recruitment-head { display:flex; align-items:center; justify-content:flex-end; gap:5px; width:100%; min-height:19px; }
.recommended-recruitment-summary { display:grid; gap:5px; width:100%; }
.calendar-accordion-list .region-product-side { min-width:0; display:grid; justify-items:end; gap:5px; margin-right:5px; transform:translateY(-4px); }
.team-row.admin-recommended-empty-team .recommended-recruitment-head { justify-content:flex-start; }
`;

const RECRUITMENT_FUNCTION = [
  "function renderAdminRecommendedEmptyRecruitmentSummary(){return`",
  '        <div class="recommended-recruitment-summary" aria-label="멤버 모집 중, 첫 참여 혜택 적용">',
  '          <div class="recommended-recruitment-head">',
  '            <div class="monthly-card-participant-label">멤버 모집 중</div>',
  '            <span class="recommended-recruitment-new-badge">NEW</span>',
  '          </div>',
  '          <div class="recommended-recruitment-benefit">',
  '            <span class="recommended-recruitment-benefit-label">',
  '              <svg class="recommended-recruitment-gift-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">',
  '              <path d="M4 10.5h16v9.25a1.75 1.75 0 0 1-1.75 1.75H5.75A1.75 1.75 0 0 1 4 19.75V10.5Z" fill="#FFD84D" stroke="#F97316" stroke-width="1.6"/>',
  '              <path d="M3 7.5h18v3H3v-3Z" fill="#FFB020" stroke="#F97316" stroke-width="1.6" stroke-linejoin="round"/>',
  '              <path d="M12 7.5v14" stroke="#F97316" stroke-width="1.8" stroke-linecap="round"/>',
  '              <path d="M12 7.2C9.1 7.2 7.2 6.3 7.2 4.7c0-1.15.88-1.95 1.98-1.95 1.7 0 2.82 2.04 2.82 4.45ZM12 7.2c2.9 0 4.8-.9 4.8-2.5 0-1.15-.88-1.95-1.98-1.95-1.7 0-2.82 2.04-2.82 4.45Z" fill="#FFB020" stroke="#F97316" stroke-width="1.35" stroke-linejoin="round"/>',
  '              </svg>',
  '              <span class="recommended-recruitment-benefit-title">첫 참여 혜택</span>',
  '            </span>',
  '            <span class="recommended-recruitment-gift-badge">골프공 증정</span>',
  '          </div>',
  '        </div>',
  '      `}'
].join("\\n");

function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0 || text.indexOf(from, first + from.length) >= 0) throw new Error(`unexpected_${label}_match_count`);
  return `${text.slice(0, first)}${to}${text.slice(first + from.length)}`;
}

function replaceAssetReference(html, assetName, objectName, integrity) {
  const pattern = new RegExp(`https://storage\\.googleapis\\.com/golfjoin-bucket/web/home-assets/gha_[a-f0-9]+/${assetName.replace(".", "\\.")}("\\s+integrity=")[^"]+`, "g");
  if (!(html.match(pattern) || []).length) throw new Error(`missing_${assetName}_reference`);
  return html.replace(pattern, `https://storage.googleapis.com/golfjoin-bucket/${objectName}$1${integrity}`);
}

function patchJs(js) {
  if (!js.includes("admin-recommended-empty") || !js.includes("renderAdminRecommendedEmptyRecruitmentSummary")) throw new Error("v60c3_recruitment_card_missing");
  new vm.Script(js, { filename: "golfjoin-main.v60c4.js" });
  return js;
}

function buildTest(names, hashes, revision, cloudShell) {
  const htmlRead = cloudShell ? "" : `,deploy=file(${JSON.stringify(names.deployHtml)}),rollback=file(${JSON.stringify(names.rollbackHtml)})`;
  const htmlTest = cloudShell ? "" : `test("v60c8 배포 HTML은 새 불변 자산을 참조하고 v60c7로 복구한다",()=>{assert.equal(hash(deploy),${JSON.stringify(hashes.deploy)});assert.equal(hash(rollback),${JSON.stringify(hashes.rollback)});assert.match(deploy.toString("utf8"),/${revision}/);assert.match(rollback.toString("utf8"),/gha_0b878d80bb75e6fff6271648/)});`;
  return Buffer.from(`"use strict";\nconst assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm"),zlib=require("node:zlib");\nconst file=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex");\nconst css=zlib.gunzipSync(file(${JSON.stringify(names.css)})).toString("utf8"),js=zlib.brotliDecompressSync(file(${JSON.stringify(names.js)})).toString("utf8")${htmlRead};\ntest("v60c3 압축 자산의 해시와 JavaScript 문법이 유효하다",()=>{assert.equal(hash(file(${JSON.stringify(names.css)})),${JSON.stringify(hashes.css)});assert.equal(hash(file(${JSON.stringify(names.js)})),${JSON.stringify(hashes.js)});new vm.Script(js)});\ntest("v60c3 관리자 추천일정 카드의 모집·혜택 UI가 메인·여행지 검색·캘린더에 포함된다",()=>{["admin-recommended-empty-team","admin-recommended-empty","renderAdminRecommendedEmptyRecruitmentSummary","recommended-recruitment-summary","멤버 모집 중","첫 참여 혜택","골프공 증정"].forEach(v=>assert.ok(js.includes(v)));["recommended-recruitment-benefit","region-product-team.admin-recommended-empty","linear-gradient(100deg,#1677f6","linear-gradient(100deg,#ff9628"].forEach(v=>assert.ok(css.includes(v)))});\ntest("v60c3 기존 월례회 카드와 상품상세 PC 여백을 유지한다",()=>{assert.ok(js.includes("monthly-card-progress-track"));assert.match(css,/@media \\(min-width: 641px\\) \\{[\\s\\S]*?#detailModal #detailContent,[\\s\\S]*?padding-top: 20px !important;/)});\n${htmlTest}\n`, "utf8");
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const baseHtml = read(BASE_HTML);
  const baseCss = zlib.gunzipSync(read(BASE_CSS));
  const baseJs = zlib.brotliDecompressSync(read(BASE_JS));
  const css = Buffer.from(`${baseCss.toString("utf8").trimEnd()}\n${CSS_ADDITION}`, "utf8");
  const js = Buffer.from(patchJs(baseJs.toString("utf8")), "utf8");
  const cssGzip = zlib.gzipSync(css, { level: 9, mtime: 0 });
  const jsBrotli = zlib.brotliCompressSync(js, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
  const revision = `gha_${hash(Buffer.concat([css, Buffer.from("\n--v60c3--\n"), js])).slice(0, 24)}`;
  const cssObject = `web/home-assets/${revision}/golfjoin-main.css`;
  const jsObject = `web/home-assets/${revision}/golfjoin-main.js`;
  let deploy = baseHtml.toString("utf8");
  deploy = replaceAssetReference(deploy, "golfjoin-main.css", cssObject, sri(css));
  deploy = replaceAssetReference(deploy, "golfjoin-main.js", jsObject, sri(js));
  const deployBuffer = Buffer.from(deploy, "utf8");
  const names = {
    deployHtml: `DEPLOY_golfjoin_main_admin_recommendation_card_${hash(deployBuffer).slice(0, 8).toUpperCase()}.html`,
    rollbackHtml: `ROLLBACK_golfjoin_main_${hash(baseHtml).slice(0, 8).toUpperCase()}.html`,
    css: `UPLOAD_golfjoin-main_${hash(cssGzip).slice(0, 8).toUpperCase()}.css.gz`,
    js: `UPLOAD_golfjoin-main_${hash(jsBrotli).slice(0, 8).toUpperCase()}.js.br`,
    packageTest: "stage60c-admin-recommendation-card.test.js",
    cloudShellTest: "stage60c-admin-recommendation-card-cloudshell.test.js"
  };
  const hashes = { deploy: hash(deployBuffer), rollback: hash(baseHtml), css: hash(cssGzip), js: hash(jsBrotli) };
  const files = { deployHtml: deployBuffer, rollbackHtml: baseHtml, css: cssGzip, js: jsBrotli };
  files.packageTest = buildTest(names, hashes, revision, false);
  files.cloudShellTest = buildTest(names, hashes, revision, true);
  fs.mkdirSync(OUTPUT, { recursive: true });
  for (const [key, buffer] of Object.entries(files)) fs.writeFileSync(path.join(OUTPUT, names[key]), buffer, { flag: "wx" });
  const manifest = { schema: "golfjoin-stage60c3-admin-recommendation-card-v1", status: "ready-for-test", preparedAt: new Date().toISOString(), productionBaseline: "v60c1", assetRevision: revision, features: { emptyAdminRecommendedCard: "member-recruiting-new-and-first-participation-benefit", regionSearchAndCalendarCardsAligned: true, monthlyCardsPreserved: true, detailModalPaddingPreserved: true }, assets: { cssObjectName: cssObject, jsObjectName: jsObject }, names, files: { deployHtml: record(names.deployHtml, deployBuffer), rollbackHtml: record(names.rollbackHtml, baseHtml), css: record(names.css, cssGzip, { contentEncoding: "gzip", objectName: cssObject, logicalSri: sri(css) }), js: record(names.js, jsBrotli, { contentEncoding: "br", objectName: jsObject, logicalSri: sri(js) }), packageTest: record(names.packageTest, files.packageTest), cloudShellTest: record(names.cloudShellTest, files.cloudShellTest) } };
  const runbook = `# v60c3 관리자 추천일정 빈 카드 개선\n\n참여자 0명의 관리자 추천일정 카드에 빈 슬롯 대신 **멤버 모집 중 · NEW**와 **첫 참여 혜택 / 골프공 증정**을 표시합니다. 메인·여행지 검색·참여가능한 모임 캘린더에 같은 규칙을 적용하고, 월례회·참여자가 있는 카드는 기존 표시를 유지합니다. v60c1을 기준으로 한 좁은 변경입니다.\n\n## 1. Cloud Shell 업로드\n\n- ${names.css}\n- ${names.js}\n- ${names.cloudShellTest}\n\nERP 편집기에서 ${names.deployHtml} 파일의 전체 내용을 교체합니다.\n\n## 2. Cloud Shell 검증\n\n\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nnode --test ${names.cloudShellTest}\n\`\`\`\n\n## 3. GCS 불변 자산 업로드\n\n\`\`\`bash\ngcloud storage cp ${names.css} gs://golfjoin-bucket/${cssObject} --if-generation-match=0 --content-type="text/css; charset=utf-8" --content-encoding=gzip --cache-control="public, max-age=31536000, immutable"\ngcloud storage cp ${names.js} gs://golfjoin-bucket/${jsObject} --if-generation-match=0 --content-type="application/javascript; charset=utf-8" --content-encoding=br --cache-control="public, max-age=31536000, immutable"\ncurl -sSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/${cssObject}\ncurl -sSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/${jsObject}\n\`\`\`\n\n## 4. 운영 확인\n\n1. 메인·여행지 검색·참여가능한 모임 캘린더에서 추천일정 중 참여자 0명 카드는 빈 슬롯 없이 멤버 모집 중·NEW와 첫 참여 혜택을 표시합니다.\n2. 월례회 및 참여자가 있는 카드는 기존 참여현황·게이지를 유지합니다.\n3. PC 상품상세 모달 본문 상단 20px, 모바일 전체 너비 이미지를 다시 확인합니다.\n\n## 5. 복구\n\n문제가 생기면 ERP HTML을 ${names.rollbackHtml} 전체 내용으로 되돌리면 v60c1로 즉시 복구됩니다.\n`;
  fs.writeFileSync(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(OUTPUT, "RUNBOOK.md"), runbook, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ output: OUTPUT, revision, names }, null, 2)}\n`);
}

try { main(); } catch (error) { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; }
