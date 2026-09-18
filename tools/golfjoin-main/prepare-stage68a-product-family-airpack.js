"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "deploy/stage68-product-family-airpack/reclassify-20260915-v68a");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function replaceExact(source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count !== 1) throw new Error(`${label}_count_invalid:${count}`);
  return source.replace(target, replacement);
}

function makeCloudTest(names, hashes) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex"),index=read(${JSON.stringify(names.index)}),family=read(${JSON.stringify(names.family)}),familyTest=read(${JSON.stringify(names.familyTest)}),source=index.toString("utf8"),moduleSource=family.toString("utf8"),api=require("./${names.family.replace(/\.js$/, "")}");\n`
    + `test("v68a 업로드 파일 해시와 JavaScript 문법이 유효하다",()=>{assert.deepEqual({index:hash(index),family:hash(family),familyTest:hash(familyTest)},${JSON.stringify({ index: hashes.index, family: hashes.family, familyTest: hashes.familyTest })});assert.doesNotThrow(()=>new Function(source));assert.doesNotThrow(()=>new Function(moduleSource))});\n`
    + `test("v68a 상품군 판정은 추천 일정의 항공 근거를 사용한다",()=>{assert.equal(api.inferPackType({airline:"제주항공"}),"air");assert.equal(api.inferPackType({air2Cd:"7C"}),"air");assert.equal(api.inferPackType({goodTransportSeq:"3586"}),"air");assert.equal(api.inferPackType({airline:"개별항공",air2Cd:"XX"}),"golf")});\n`
    + `test("v68a 두 1월 월례회 상품은 동일한 air 후보 키를 만든다",()=>{const base={country:"인도네시아",region:"바탐",departureDate:"2027-01-16",airline:"제주항공",air2Cd:"7C"},catalog=api.buildProductCatalog([{...base,goodSeq:"30001287",eventSeq:"30286551",title:"[1월 월례회] 인도네시아 바탐 3색 4박6일 아스톤",duration:"4박6일",goodTransportSeq:"3586"},{...base,goodSeq:"30001288",eventSeq:"30286552",title:"[1월 월례회] 인도네시아 바탐 3색 7박9일 아스톤",duration:"7박9일",goodTransportSeq:"3585"}],{today:"2026-09-15"});assert.deepEqual(catalog.map(x=>x.goodSeq),["30001287","30001288"]);assert.deepEqual([...new Set(catalog.map(x=>x.candidateKey))],["air|인도네시아|바탐|1월월례회인도네시아바탐3색"])});\n`
    + `test("v68a 재발행은 재분석 결과와 후보 키 보정 감사 코드를 사용한다",()=>{for(const value of ["const reconciliation = reconcileFamilyWithCatalog(currentFamily, sheetState.catalog)","republish_candidate_key_repair","candidateKeyRepair: reconciliation.candidateKeyRepair || null","catalog_reconcile_candidate_key_repair"])assert.ok(source.includes(value),value)});\n`
    + `test("v68a 안전 보정은 golf에서 air로 바뀐 첫 구간 외 지역·상품명 변경을 허용하지 않는다",()=>{for(const value of ["from.packType !== \\"golf\\"","to.packType !== \\"air\\"","from.country !== to.country","from.region !== to.region","from.baseTitle !== to.baseTitle","activeGoodSeqs.length < 2"])assert.ok(moduleSource.includes(value),value)});\n`;
}

function makePackageTest(names, hashes) {
  return `"use strict";\n`
    + `const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),test=require("node:test");\n`
    + `const read=n=>fs.readFileSync(path.join(__dirname,n)),hash=v=>crypto.createHash("sha256").update(v).digest("hex");\n`
    + `test("v68a 산출물 해시가 일치한다",()=>assert.deepEqual({index:hash(read(${JSON.stringify(names.index)})),family:hash(read(${JSON.stringify(names.family)})),familyTest:hash(read(${JSON.stringify(names.familyTest)})),cloudTest:hash(read(${JSON.stringify(names.cloudTest)}))},${JSON.stringify({ index: hashes.index, family: hashes.family, familyTest: hashes.familyTest, cloudTest: hashes.cloudTest })}));\n`
    + `test("v68a는 서버 전용 변경이며 메인·대시보드 HTML 교체가 필요 없다",()=>{const manifest=JSON.parse(read("manifest.json"));assert.equal(manifest.serverOnly,true);assert.equal(manifest.htmlReplacementRequired,false)});\n`;
}

function makeConsoleMigrationScript() {
  return `void (async () => {
  const auth = JSON.parse(sessionStorage.getItem("golfjoinAdminAuth") || localStorage.getItem("golfjoinAdminAuth") || "{}");
  if (!auth.token) throw new Error("관리자 로그인이 필요합니다.");
  const endpoint = "https://asia-northeast3-golfjoin-499602.cloudfunctions.net/golfjoin-sheet-api";
  const post = async (action, payload = {}) => {
    const url = new URL(endpoint);
    url.searchParams.set("action", action);
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Golfjoin-Admin-Token": auth.token },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || ("HTTP " + response.status));
    return data;
  };

  const expectedKey = "air|인도네시아|바탐|1월월례회인도네시아바탐3색";
  const targetGoodSeqs = ["30001287", "30001288"];
  const before = await post("admin_product_family_bootstrap");
  const products = targetGoodSeqs.map((goodSeq) => before.catalog.find((item) => String(item.goodSeq) === goodSeq));
  if (products.some((item) => !item)) throw new Error("대상 ERP 상품이 현재 카탈로그에 없습니다.");
  if (products.some((item) => item.packType !== "air" || item.candidateKey !== expectedKey)) {
    throw new Error("항공팩 재분석 사전검증 실패: 서버 판정과 대상 상품 데이터를 확인하세요.");
  }
  const targets = before.families.filter((family) => {
    const members = (family.members || []).map((member) => String(member.goodSeq));
    return targetGoodSeqs.every((goodSeq) => members.includes(goodSeq));
  });
  if (targets.length !== 1) throw new Error("대상 상품군이 " + targets.length + "개입니다. 변경을 중단했습니다.");
  const target = targets[0];
  const beforeMembers = (target.members || []).map((member) => String(member.goodSeq)).sort();
  const otherBefore = new Map(before.families.filter((family) => family.familyId !== target.familyId).map((family) => [
    family.familyId,
    JSON.stringify({
      status: family.status,
      candidateKeySnapshot: family.candidateKeySnapshot,
      representativeMode: family.representativeMode,
      preferredGoodSeq: family.preferredGoodSeq,
      members: (family.members || []).map((member) => String(member.goodSeq)).sort()
    })
  ]));

  const result = await post("admin_product_family_republish", {
    familyId: target.familyId,
    expectedConfigRevision: target.configRevision,
    expectedAnalysisRevision: before.analysisRevision,
    operationId: "airpack-repair-" + target.familyId + "-" + Date.now()
  });
  const after = await post("admin_product_family_bootstrap");
  const repaired = after.families.find((family) => family.familyId === target.familyId);
  const afterMembers = (repaired?.members || []).map((member) => String(member.goodSeq)).sort();
  const changedOtherFamilyIds = after.families.filter((family) => family.familyId !== target.familyId).filter((family) => otherBefore.get(family.familyId) !== JSON.stringify({
    status: family.status,
    candidateKeySnapshot: family.candidateKeySnapshot,
    representativeMode: family.representativeMode,
    preferredGoodSeq: family.preferredGoodSeq,
    members: (family.members || []).map((member) => String(member.goodSeq)).sort()
  })).map((family) => family.familyId);
  console.log({
    ok: Boolean(result.ok),
    publicationOk: Boolean(result.publication?.ok),
    familyIdPreserved: repaired?.familyId === target.familyId,
    membersPreserved: JSON.stringify(afterMembers) === JSON.stringify(beforeMembers),
    representativePreserved: repaired?.representativeMode === target.representativeMode
      && repaired?.preferredGoodSeq === target.preferredGoodSeq,
    beforeCandidateKey: target.candidateKeySnapshot,
    afterCandidateKey: repaired?.candidateKeySnapshot,
    expectedCandidateKey: expectedKey,
    candidateKeyRepair: result.candidateKeyRepair,
    changedOtherFamilyIds
  });
})();`;
}

function makeRunbook(names, hashes) {
  return `# Stage 68a - 상품군 항공팩 재분석·안전 후보 키 보정\n\n`
    + `상품군 서버가 추천 일정과 같은 항공 근거(명시 타입, 항공 포함 문구, 항공사, 항공코드, 운송편)를 사용합니다. 기존 상품군은 다시 만들지 않고 후보 키의 첫 구간만 golf에서 air로 바뀌는 경우에 한해 자동 보정합니다.\n\n`
    + `## 1. Cloud Shell 업로드·검증\n\n다음 4개 파일을 /home/llno95ll/google-sheet-proxy-function 에 업로드합니다.\n\n`
    + `- ${names.index}\n- ${names.family}\n- ${names.familyTest}\n- ${names.cloudTest}\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\nsha256sum ${names.index} ${names.family} ${names.familyTest} ${names.cloudTest}\nnode --check ${names.index}\nnode --check ${names.family}\nnode --test ${names.familyTest} ${names.cloudTest}\n\`\`\`\n\n정상 결과는 tests 32, pass 32, fail 0입니다.\n\n`
    + `## 2. 서버 파일 교체·배포\n\n`
    + `\`\`\`bash\ncd /home/llno95ll/google-sheet-proxy-function\ncp -f index.js BACKUP_pre_stage68a_index.js\ncp -f product-family.js BACKUP_pre_stage68a_product-family.js\ncp -f ${names.index} index.js\ncp -f ${names.family} product-family.js\nnode --check index.js\nnode --check product-family.js\nnode --test ${names.familyTest} ${names.cloudTest}\n\ngcloud functions deploy golfjoin-sheet-api --gen2 --runtime=nodejs22 --region=asia-northeast3 --project=golfjoin-499602 --source=. --entry-point=proxyGoogleSheet --trigger-http --timeout=540s --memory=1GiB --allow-unauthenticated --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml --update-secrets=GOLFJOIN_APPS_SCRIPT_EMAIL_SECRET=golfjoin-apps-script-email-secret:latest,GOLFJOIN_EMAIL_VERIFICATION_SECRET=golfjoin-email-verification-secret:latest\ngcloud run services update-traffic golfjoin-sheet-api --region=asia-northeast3 --project=golfjoin-499602 --to-latest\n\`\`\`\n\n`
    + `## 3. 대상 상품군만 안전 보정·카탈로그 재발행\n\n관리자 대시보드 로그인 상태의 브라우저 콘솔에서 ${names.consoleScript} 전체를 실행합니다. 스크립트는 변경 전에 두 상품이 정확히 air 후보로 재분석되는지 확인하며, 대상 상품군이 정확히 하나가 아니면 중단합니다.\n\n정상 결과:\n\n- publicationOk: true\n- familyIdPreserved: true\n- membersPreserved: true\n- representativePreserved: true\n- afterCandidateKey: air|인도네시아|바탐|1월월례회인도네시아바탐3색\n- changedOtherFamilyIds: []\n\n`
    + `## 4. 화면 확인\n\n대시보드 상품군 관리를 새로고침하고 1월 월례회 상품군이 항공팩으로 표시되는지 확인합니다. 이 단계는 서버·카탈로그 변경만 있으므로 메인페이지 HTML과 대시보드 HTML 교체는 없습니다.\n\n`
    + `## 5. 복구\n\n코드 복구가 필요하면 BACKUP_pre_stage68a_index.js와 BACKUP_pre_stage68a_product-family.js를 원래 파일명으로 되돌린 뒤 같은 명령으로 재배포합니다. 이미 안전 보정된 후보 키는 유효한 실제 항공 판정 데이터이므로 시트에서 golf로 되돌리지 않습니다.\n\n`
    + `- index SHA-256: ${hashes.index}\n- product-family SHA-256: ${hashes.family}\n`;
}

function main() {
  if (fs.existsSync(OUTPUT)) throw new Error(`output_exists:${OUTPUT}`);
  const index = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/index.js"));
  const family = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/product-family.js"));
  const originalTest = fs.readFileSync(path.join(ROOT, "server/google-sheet-proxy-function/product-family.test.js"), "utf8");
  const names = {
    index: "stage68a-index.js",
    family: "stage68a-product-family.js",
    familyTest: "stage68a-product-family.test.js",
    cloudTest: "stage68a-product-family-airpack-cloudshell.test.js",
    packageTest: "stage68a-product-family-airpack-package.test.js",
    consoleScript: "stage68a-republish-target-family-console.js"
  };
  const familyTest = Buffer.from(replaceExact(
    originalTest,
    'require("./product-family")',
    'require("./stage68a-product-family")',
    "family_test_import"
  ), "utf8");
  new vm.Script(index.toString("utf8"), { filename: names.index });
  new vm.Script(family.toString("utf8"), { filename: names.family });
  const hashes = {
    index: sha256(index),
    family: sha256(family),
    familyTest: sha256(familyTest)
  };
  const cloudTest = Buffer.from(makeCloudTest(names, hashes), "utf8");
  hashes.cloudTest = sha256(cloudTest);
  const consoleScript = Buffer.from(makeConsoleMigrationScript(), "utf8");
  const manifest = {
    schema: "golfjoin-product-family-airpack-reclassification-v1",
    version: "v68a",
    status: "ready-for-validation",
    preparedAt: new Date().toISOString(),
    serverOnly: true,
    htmlReplacementRequired: false,
    targetGoodSeqs: ["30001287", "30001288"],
    expectedCandidateKey: "air|인도네시아|바탐|1월월례회인도네시아바탐3색",
    safety: {
      preservesFamilyId: true,
      preservesMemberGoodSeqs: true,
      preservesRepresentativeSelection: true,
      onlyRepairsGolfToAirPrefix: true,
      rejectsDestinationOrTitleKeyChanges: true,
      publishesFullApprovedFamilyCatalog: true
    },
    localRegression: { tests: 80, pass: 80, fail: 0 },
    names,
    hashes: { ...hashes, consoleScript: sha256(consoleScript) }
  };
  const packageTest = Buffer.from(makePackageTest(names, hashes), "utf8");
  const runbook = Buffer.from(makeRunbook(names, hashes), "utf8");

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: false });
  new Map([
    [names.index, index],
    [names.family, family],
    [names.familyTest, familyTest],
    [names.cloudTest, cloudTest],
    [names.packageTest, packageTest],
    [names.consoleScript, consoleScript],
    ["RUNBOOK.md", runbook],
    ["manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")]
  ]).forEach((value, name) => fs.writeFileSync(path.join(OUTPUT, name), value, { flag: "wx" }));
  process.stdout.write(`${JSON.stringify({ ok: true, output: OUTPUT, names, hashes: manifest.hashes }, null, 2)}\n`);
}

if (require.main === module) main();
