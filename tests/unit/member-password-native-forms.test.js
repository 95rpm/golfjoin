const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const markup = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/markup/20-main.html"),
  "utf8"
);
const memberScript = fs.readFileSync(
  path.join(root, "src/golfjoin-main/source/scripts/member/34-member-auth-profile-wishes.js"),
  "utf8"
);

test("all member password inputs belong to an explicit native form", () => {
  const expectedForms = {
    joinMemberLoginPassword: "joinMemberEmailLoginNativeForm",
    joinMemberResetPassword: "joinMemberResetPasswordNativeForm",
    joinMemberResetPasswordConfirm: "joinMemberResetPasswordNativeForm",
    joinMemberSignupPassword: "joinMemberSignupCredentialsNativeForm",
    joinMemberSignupPasswordConfirm: "joinMemberSignupCredentialsNativeForm",
  };

  for (const [inputId, formId] of Object.entries(expectedForms)) {
    assert.match(markup, new RegExp(`<form\\s+id=["']${formId}["']`));
    assert.match(
      markup,
      new RegExp(`<input[^>]+type=["']password["'][^>]+id=["']${inputId}["'][^>]+form=["']${formId}["']`)
    );
  }
});

test("login and password reset submit through one native submit event", () => {
  assert.match(
    markup,
    /<form id="joinMemberEmailLoginNativeForm" onsubmit="event\.preventDefault\(\); submitJoinMemberEmailLogin\(\);"><\/form>/
  );
  assert.match(
    markup,
    /<button type="submit" form="joinMemberEmailLoginNativeForm" class="join-member-login-button signup">로그인하기<\/button>/
  );
  assert.doesNotMatch(
    markup,
    /id="joinMemberLoginPassword"[^>]+onkeydown="[^"]*submitJoinMemberEmailLogin/
  );

  assert.match(
    markup,
    /<form id="joinMemberResetPasswordNativeForm" onsubmit="event\.preventDefault\(\); submitJoinMemberResetPassword\(\);">[\s\S]*?<input type="text" id="joinMemberResetUsername" name="username" autocomplete="username"[^>]+hidden>[\s\S]*?<\/form>/
  );
  assert.match(
    markup,
    /<button type="submit" form="joinMemberResetPasswordNativeForm" class="join-member-login-button signup">비밀번호 변경<\/button>/
  );
});

test("password reset form keeps its hidden username synchronized", () => {
  assert.match(
    memberScript,
    /const resetUsername = document\.getElementById\("joinMemberResetUsername"\);\s*if \(resetUsername\) resetUsername\.value = "";/
  );
  assert.match(
    memberScript,
    /const resetUsername = document\.getElementById\("joinMemberResetUsername"\);\s*if \(resetUsername\) resetUsername\.value = custId;/
  );
});
