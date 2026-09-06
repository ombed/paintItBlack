/* Lint for the things a test would only catch by accident: a name that is
   not defined anywhere (the TITLE_RX incident silently emptied every
   suggestion), a variable declared twice, a regex that lost a backslash.
   Style is not linted; the engine is dense on purpose. */
const globals = {
  browser: { window: "readonly", document: "readonly", navigator: "readonly", location: "readonly", localStorage: "readonly",
    fetch: "readonly", Blob: "readonly", URL: "readonly", TextEncoder: "readonly", TextDecoder: "readonly", DOMParser: "readonly",
    XMLSerializer: "readonly", CompressionStream: "readonly", DecompressionStream: "readonly", Response: "readonly",
    caches: "readonly", self: "readonly", clients: "readonly", console: "readonly", setTimeout: "readonly", clearTimeout: "readonly",
    matchMedia: "readonly", requestAnimationFrame: "readonly", DataTransfer: "readonly", ClipboardEvent: "readonly",
    Intl: "readonly", crypto: "readonly", performance: "readonly", FileReader: "readonly", history: "readonly",
    globalThis: "readonly", Promise: "readonly", Map: "readonly", Set: "readonly", Symbol: "readonly", RegExp: "writable",
    Uint8Array: "readonly", Uint32Array: "readonly", DataView: "readonly", ArrayBuffer: "readonly", Int32Array: "readonly", Float64Array: "readonly", Node: "readonly" },
  node: { require: "readonly", module: "writable", process: "readonly", __dirname: "readonly", console: "readonly",
    Buffer: "readonly", setTimeout: "readonly", clearTimeout: "readonly", globalThis: "readonly", global: "writable",
    TextEncoder: "readonly", TextDecoder: "readonly", URL: "readonly", Promise: "readonly", Map: "readonly", Set: "readonly",
    DataTransfer: "readonly", ClipboardEvent: "readonly", window: "readonly", document: "readonly", fetch: "readonly", Blob: "readonly",
    Uint8Array: "readonly", DataView: "readonly", ArrayBuffer: "readonly", RegExp: "writable", crypto: "readonly" },
};
const rules = {
  "no-undef": "error",
  "no-redeclare": "error",
  "no-dupe-keys": "error",
  "no-unreachable": "error",
  "no-useless-escape": "off",
  "no-empty": "off",
  "no-cond-assign": "off",
  "no-control-regex": "off",
  "no-misleading-character-class": "off",
  "no-unused-vars": "off",
  "no-prototype-builtins": "off",
  "no-fallthrough": "off",
  "no-inner-declarations": "off",
  "no-constant-condition": "off",
};
const js = require("@eslint/js");
module.exports = [
  // engine/ holds the sections that concatenate into redact-engine.js; the whole is linted, the parts are not modules
  { ignores: ["node_modules/**", "support.js", "engine/**", "tests/app.html", "tests/core.js", "tests/*-core.js", "bench/.engine*.cjs", "test-results/**", "playwright-report/**"] },
  { files: ["redact-engine.js", "pdf-text.js", "text-to-docx.js"], languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.browser }, rules: { ...js.configs.recommended.rules, ...rules } },
  { files: ["sw.js"], languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: globals.browser }, rules: { ...js.configs.recommended.rules, ...rules } },
  { files: ["bench/*.js", "scripts/*.js", "tests/run.js", "tests/build-fixtures.js", "tests/version_t.js", "tests/design_t.js", "e2e/*.js", "eslint.config.js", "playwright.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node, localStorage: "readonly", getComputedStyle: "readonly", innerWidth: "readonly" } },
    // the browser checks build a deliberately broken RegExp to prove the tokenizer repair
    rules: { ...js.configs.recommended.rules, ...rules, "no-invalid-regexp": "off" } },
];
