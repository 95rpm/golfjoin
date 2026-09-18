const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sourcePath = path.resolve(
  __dirname,
  "../../src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"
);
const source = fs.readFileSync(sourcePath, "utf8");

function extractFunction(name) {
  const marker = `async function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} 함수를 찾을 수 없습니다.`);
  const signatureEnd = source.indexOf(") {", start);
  assert.notEqual(signatureEnd, -1, `${name} 함수 시그니처 끝을 찾을 수 없습니다.`);
  const bodyStart = source.indexOf("{", signatureEnd + 2);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} 함수 끝을 찾을 수 없습니다.`);
}

function createEnsureProfileReady(options = {}) {
  const functionSource = extractFunction("ensureJoinMemberProfileReady");
  const opened = [];
  const redirects = [];
  const alerts = [];
  let resolveRefresh;
  const refreshPromise = new Promise((resolve) => {
    resolveRefresh = resolve;
  });
  const cachedMember = {
    memberId: "testid001",
    profileComplete: false
  };
  const factory = new Function(
    "getJoinLoginState",
    "getJoinMemberWithCachedProfile",
    "getJoinCachedCurrentMember",
    "getRememberedJoinMemberProfileCompletion",
    "isJoinMemberProfileComplete",
    "isJoinTempAdminMember",
    "getJoinCurrentMember",
    "golfJoinSafeWarn",
    "alert",
    "redirectToJoinLogin",
    "openJoinMemberRequiredProfileForm",
    `return (${functionSource});`
  );
  const ensureProfileReady = factory(
    () => ({ member: cachedMember }),
    (member) => member,
    () => cachedMember,
    () => false,
    (member) => Boolean(member?.profileComplete),
    () => false,
    () => refreshPromise,
    () => {},
    (message) => alerts.push(message),
    (...args) => redirects.push(args),
    (...args) => opened.push(args)
  );
  return {
    alerts,
    ensureProfileReady,
    opened,
    redirects,
    resolveRefresh,
    refreshedMember: options.refreshedMember || { memberId: "testid001", profileComplete: true }
  };
}

test("캐시가 미완료여도 서버 프로필 재조회 전에는 추가정보 화면을 열지 않는다", async () => {
  const harness = createEnsureProfileReady();
  const pending = harness.ensureProfileReady("my-menu");

  await Promise.resolve();
  assert.equal(harness.opened.length, 0);

  harness.resolveRefresh(harness.refreshedMember);
  const result = await pending;

  assert.equal(result.profileComplete, true);
  assert.equal(harness.opened.length, 0);
  assert.equal(harness.redirects.length, 0);
  assert.equal(harness.alerts.length, 0);
});

test("서버 재조회 후에도 실제 미완료인 회원에게만 추가정보 화면을 연다", async () => {
  const refreshedMember = { memberId: "new-member", profileComplete: false };
  const harness = createEnsureProfileReady({ refreshedMember });
  const pending = harness.ensureProfileReady("my-menu", { source: "startup" });

  await Promise.resolve();
  assert.equal(harness.opened.length, 0);

  harness.resolveRefresh(refreshedMember);
  const result = await pending;

  assert.equal(result, null);
  assert.equal(harness.opened.length, 1);
  assert.deepEqual(harness.opened[0], [refreshedMember, "my-menu", { source: "startup" }]);
});
