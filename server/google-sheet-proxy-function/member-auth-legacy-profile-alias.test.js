"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function extractNamedFunction(source, name) {
  const signature = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`).exec(source);
  assert.ok(signature, `${name} not found`);
  const start = signature.index;
  const bodyStart = start + signature[0].lastIndexOf("{");
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} body is incomplete`);
}

const indexSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const functionSource = extractNamedFunction(indexSource, "bindVerifiedMemberIdentity");
const bindVerifiedMemberIdentity = Function(
  "asText",
  `"use strict"; ${functionSource}; return bindVerifiedMemberIdentity;`
)((value) => String(value == null ? "" : value).trim());

test("enforce read lookup uses only the signed memberSeq and memberId aliases", () => {
  const result = bindVerifiedMemberIdentity({
    memberSeq: "99999999",
    memberId: "attacker-id",
    memberMobile: "01099999999",
    memberEmail: "attacker@example.com",
    kakaoId: "999999"
  }, {
    memberSeq: "30002219",
    memberId: "test004"
  }, { readOnly: true });

  assert.deepEqual(result, {
    memberSeq: "30002219",
    memberKey: "seq:30002219",
    memberId: "test004"
  });
});

test("enforce write replaces an untrusted memberId with its signed alias", () => {
  const result = bindVerifiedMemberIdentity({
    source: "join_wish",
    memberId: "attacker-id",
    member: {
      memberSeq: "99999999",
      memberId: "attacker-id",
      memberName: "테스트"
    }
  }, {
    memberSeq: "30002219",
    memberId: "test004"
  }, { readOnly: false });

  assert.equal(result.memberSeq, "30002219");
  assert.equal(result.memberId, "test004");
  assert.equal(result.member.memberSeq, "30002219");
  assert.equal(result.member.memberId, "test004");
  assert.equal(result.member.memberName, "테스트");
});
