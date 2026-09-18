const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const markup = fs.readFileSync(path.join(root, "src/golfjoin-main/source/markup/20-main.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/golfjoin-main/source/styles/10-main.css"), "utf8");
const memberScript = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"),
  "utf8"
);

test("password reset replaces the lookup fields with the standalone reset screen", () => {
  assert.equal((markup.match(/data-find-pw-lookup/g) || []).length, 4);
  assert.match(
    styles,
    /\.join-member-find-pw-form\.is-reset-mode > \[data-find-pw-lookup\]\s*\{\s*display: none !important;/
  );
  assert.match(
    memberScript,
    /document\.getElementById\("joinMemberFindPwForm"\)\?\.classList\.add\("is-reset-mode"\);/
  );
  assert.ok(
    (memberScript.match(/classList\.remove\("is-reset-mode"\)/g) || []).length >= 2,
    "opening and failure paths restore the lookup fields"
  );
});

test("password reset reuses signup typography without the result card chrome", () => {
  assert.match(markup, /class="join-member-signup-step-title">새로운 비밀번호를<br>입력해주세요<\/div>/);
  assert.match(
    markup,
    /class="join-member-signup-password-desc">영문, 숫자, 특수문자를 조합해서 8자 이상 입력해주세요\.<\/div>/
  );
  assert.match(markup, /class="join-member-email-label join-member-signup-password-title">새 비밀번호\*<\/div>/);
  assert.match(markup, /class="join-member-email-label join-member-signup-password-title">비밀번호 확인\*<\/div>/);
  assert.match(
    styles,
    /\.join-member-password-reset-panel\s*\{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?background: transparent;/
  );
});

