"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_ROOT = path.join(
  ROOT,
  "deploy/stage30-member-auth-gate/legacy-profile-alias-20260821-v30b"
);
const SERVER_ROOT = path.join(ROOT, "server/google-sheet-proxy-function");

const sources = {
  index: path.join(SERVER_ROOT, "index.js"),
  memberSmsAuth: path.join(SERVER_ROOT, "member-sms-auth.js"),
  memberSmsAuthTest: path.join(SERVER_ROOT, "member-sms-auth.test.js"),
  legacyAliasTest: path.join(SERVER_ROOT, "member-auth-legacy-profile-alias.test.js")
};

const names = {
  index: "stage30b-index.js",
  memberSmsAuth: "stage30b-member-sms-auth.js",
  memberSmsAuthTest: "stage30b-member-sms-auth.test.js",
  legacyAliasTest: "stage30b-member-auth-legacy-profile-alias.test.js"
};

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function record(fileName, buffer) {
  return { fileName, bytes: buffer.length, sha256: sha256(buffer) };
}

function writeExclusive(fileName, buffer) {
  fs.writeFileSync(path.join(OUTPUT_ROOT, fileName), buffer, { flag: "wx" });
}

function assertCandidate(files) {
  Object.entries(files).forEach(([key, source]) => {
    new vm.Script(source.toString("utf8"), { filename: names[key] });
  });
  const auth = files.memberSmsAuth.toString("utf8");
  const index = files.index.toString("utf8");
  if (!/createMemberAccessToken\(\{ secret, memberSeq, memberId, nowMs/.test(auth)) {
    throw new Error("signed_member_id_access_token_missing");
  }
  if (!/memberId:\s*trustedMemberId/.test(auth)) {
    throw new Error("verified_member_id_claim_missing");
  }
  if (!/const memberId = asText\(identity\.memberId\)/.test(index)) {
    throw new Error("gate_trusted_member_id_binding_missing");
  }
  if (!/if \(memberId\) next\.memberId = memberId/.test(index)) {
    throw new Error("read_alias_binding_missing");
  }
}

function main() {
  if (fs.existsSync(OUTPUT_ROOT)) throw new Error(`output_already_exists:${OUTPUT_ROOT}`);
  const files = Object.fromEntries(
    Object.entries(sources).map(([key, fileName]) => [key, fs.readFileSync(fileName)])
  );
  assertCandidate(files);

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  Object.entries(names).forEach(([key, fileName]) => writeExclusive(fileName, files[key]));

  const runbook = Buffer.from([
    "# 30b단계 — Enforce 기존 일반회원 프로필 별칭 호환",
    "",
    "## 기능",
    "",
    "- SMS·카카오에서 서버가 확인한 memberId를 5분 서명 액세스 토큰에 포함한다.",
    "- Enforce 읽기는 클라이언트 식별자를 버리고 서명된 memberSeq와 memberId만 사용한다.",
    "- Enforce 쓰기는 클라이언트가 보낸 memberId를 서명된 값으로 덮어쓴다.",
    "- memberSeq가 비어 있고 memberId만 있는 기존 join_member_profiles도 안전하게 조회한다.",
    "",
    "## 전체 체크리스트",
    "",
    "- [ ] 네 후보 파일의 해시를 확인한다.",
    "- [ ] 현재 운영 트래픽이 Report 리비전 100%인지 확인한다.",
    "- [ ] 환경파일 GOLFJOIN_MEMBER_AUTH_GATE=report를 확인한다.",
    "- [ ] 네 후보 파일을 서버 파일명으로 교체한다.",
    "- [ ] 문법검사와 npm test를 통과한다.",
    "- [ ] Sheet API를 report 상태로 배포한다.",
    "- [ ] 일반회원 기존 프로필과 카카오회원 화면을 확인한다.",
    "- [ ] 배포 후 5분 이상 report를 유지해 기존 액세스 토큰을 만료시킨다.",
    "- [ ] Gate를 enforce로 바꿔 같은 소스를 재배포한다.",
    "- [ ] 무토큰 401, 일반회원, 카카오회원, 찜 쓰기를 검사한다.",
    "- [ ] 문제 시 저장한 Report 리비전으로 트래픽을 100% 복구한다.",
    "",
    "프런트 HTML·GCS 자산·Aligo API·Google Sheet 데이터는 변경하지 않는다.",
    ""
  ].join("\n"), "utf8");
  writeExclusive("RUNBOOK.md", runbook);

  const manifest = {
    schema: "golfjoin-stage30b-member-profile-alias-v1",
    status: "ready-for-cloud-shell-verification",
    preparedAt: new Date().toISOString(),
    serverOnly: true,
    browserAssetDeployRequired: false,
    aligoDeployRequired: false,
    sheetDataMigrationRequired: false,
    rollout: {
      firstGate: "report",
      accessTokenDrainSeconds: 300,
      finalGate: "enforce",
      rollback: "saved-report-revision-traffic"
    },
    files: {
      index: record(names.index, files.index),
      memberSmsAuth: record(names.memberSmsAuth, files.memberSmsAuth),
      memberSmsAuthTest: record(names.memberSmsAuthTest, files.memberSmsAuthTest),
      legacyAliasTest: record(names.legacyAliasTest, files.legacyAliasTest),
      runbook: record("RUNBOOK.md", runbook)
    }
  };
  writeExclusive("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot: OUTPUT_ROOT, manifest }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
}
