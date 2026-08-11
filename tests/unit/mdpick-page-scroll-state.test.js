"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MAIN_HTML_PATH = path.resolve(__dirname, "../../golfjoin_main.html");

function extractFunction(source, functionName) {
  const declaration = `async function ${functionName}`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration not found`);
  const parametersStart = source.indexOf("(", start);
  assert.notEqual(parametersStart, -1, `${functionName} parameters not found`);

  let parameterDepth = 0;
  let parameterQuote = "";
  let parameterEscaped = false;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    const character = source[index];
    if (parameterEscaped) {
      parameterEscaped = false;
      continue;
    }
    if (parameterQuote) {
      if (character === "\\") parameterEscaped = true;
      else if (character === parameterQuote) parameterQuote = "";
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      parameterQuote = character;
      continue;
    }
    if (character === "(") parameterDepth += 1;
    if (character === ")") {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parametersEnd = index;
        break;
      }
    }
  }
  assert.notEqual(parametersEnd, -1, `${functionName} parameters are incomplete`);
  const bodyStart = source.indexOf("{", parametersEnd);
  assert.notEqual(bodyStart, -1, `${functionName} body not found`);

  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${functionName} body is incomplete`);
}

test("MD PICK captures page scroll before availability loading and forwards the exact state", async () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = extractFunction(html, "openMdPickProductDetail");
  const events = [];
  const pageScrollState = { top: 684, left: 0 };
  const product = { id: "test-product", groupKey: "test-group", homeReferenceOnly: false };

  const sandbox = {
    capturePageScrollState() {
      events.push("capture");
      return pageScrollState;
    },
    getHomeProductSource() {
      events.push("products");
      return [product];
    },
    getProductGroupKey(item) {
      return item.groupKey;
    },
    async runJoinReadLoading(action, options) {
      events.push("read-loading");
      assert.equal(options.ownerKey, "mdpick-availability:test-group");
      return action();
    },
    async loadGolfJoinProductGroupAvailability(items) {
      events.push("availability");
      return items;
    },
    selectGolfJoinBookableProduct(items) {
      events.push("select");
      return items[0];
    },
    selectGolfJoinProductGroupRepresentative() {
      return null;
    },
    openBuilderAlert() {
      throw new Error("unexpected empty-product alert");
    },
    ensureExternalGolfJoinProductsLoaded() {
      events.push("external-products");
    },
    showMdPickDetailProduct(selectedProduct, groupKey, countryKey, options) {
      events.push("detail");
      assert.equal(selectedProduct, product);
      assert.equal(groupKey, "test-group");
      assert.equal(countryKey, "thailand");
      assert.equal(options.pageScrollState, pageScrollState);
      return "opened";
    }
  };

  vm.runInNewContext(`${source}; globalThis.openMdPickProductDetailForTest = openMdPickProductDetail;`, sandbox);
  const result = await sandbox.openMdPickProductDetailForTest("test-group", "thailand");

  assert.equal(result, "opened");
  assert.equal(events[0], "capture");
  assert.ok(events.includes("read-loading"));
  assert.ok(events.indexOf("capture") < events.indexOf("availability"));
  assert.ok(events.indexOf("capture") < events.indexOf("detail"));
});

test("MD PICK detail forwards the supplied page scroll state to the modal", () => {
  const html = fs.readFileSync(MAIN_HTML_PATH, "utf8");
  const source = extractFunction(html, "showMdPickDetailProduct");
  assert.match(source, /openModal\("detailModal",\s*\{\s*pageScrollState:\s*options\.pageScrollState\s*\}\)/);
});
