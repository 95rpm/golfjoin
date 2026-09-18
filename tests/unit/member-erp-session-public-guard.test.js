const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"),
  "utf8"
);

test("logged-out pages never probe protected Secret Tour member pages", () => {
  const start = source.indexOf("async function synchronizeJoinErpSession");
  const end = source.indexOf("async function getJoinCurrentMember", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);

  assert.match(block, /await waitForRenderedCookieDataReady\(\);/);
  assert.match(block, /const renderedCookieData = getRenderedCookieDataString\(\);/);
  assert.match(
    block,
    /if \(!renderedCookieData \|\| isJoinLoggedOutFromRenderedCookie\(renderedCookieData\)\) return before;/
  );
  assert.ok(
    block.indexOf("if (!renderedCookieData") < block.indexOf("const detail = await fetchJoinMemberDetail()"),
    "public guard must run before protected member detail fetch"
  );
});

test("member detail fetch does not follow an insecure login redirect", () => {
  const start = source.indexOf("async function fetchJoinMemberDetailPage");
  const end = source.indexOf("async function fetchJoinMemberDetail()", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);

  assert.match(block, /redirect: "manual"/);
  assert.match(block, /response\.type === "opaqueredirect"/);
  assert.match(block, /response\.status >= 300 && response\.status < 400/);
  assert.match(block, /return \{ sessionExpired: true \};/);
});

