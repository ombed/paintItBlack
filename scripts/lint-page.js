/* Lints the JavaScript inside index.html (outside review, M5).

     node scripts/lint-page.js        (part of npm run lint and npm test)

   index.html is the whole app, some 2,800 lines of logic, and `eslint .` reads no .html: an
   undefined name injected into selfCheck left the linter and every suite green. Each <script>
   body is linted here with the rules the engine gets. The app's own logic is the
   type="text/x-dc" block, which support.js evaluates as a function body with DCLogic,
   StreamableLogic and React in scope; the other inline scripts are plain page scripts.
   Each block is padded with blank lines so a reported line is a line of index.html. */
const fs = require("fs");
const path = require("path");
const { ESLint } = require("eslint");
const globals = require("globals");

const ROOT = path.join(__dirname, "..");
const config = require(path.join(ROOT, "eslint.config.js"));
const engineRules = (config.find((c) => (c.files || []).includes("redact-engine.js")) || {}).rules || {};

function blocks(html) {
  const out = [];
  const rx = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = rx.exec(html))) {
    const attrs = m[1];
    if (/\bsrc=/.test(attrs)) continue;
    const startLine = html.slice(0, m.index + m[0].indexOf(">") + 1).split("\n").length;
    const app = /type="text\/x-dc"/.test(attrs);
    out.push({ app, startLine, code: m[2] });
  }
  return out;
}

async function lintPage(html) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [{
      languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser, DCLogic: "readonly", StreamableLogic: "readonly", React: "readonly" } },
      rules: engineRules,
    }],
  });
  const problems = [];
  for (const b of blocks(html)) {
    // the app block is a function body: a top-level return is legal there
    const code = "\n".repeat(b.startLine - 1) + (b.app ? "(function(){" + b.code + "\n})();" : b.code);
    const [res] = await eslint.lintText(code, { filePath: "index.html.js" });
    for (const msg of res.messages) problems.push({ line: msg.line, rule: msg.ruleId, message: msg.message, severity: msg.severity });
  }
  return problems;
}

if (require.main === module) {
  lintPage(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")).then((p) => {
    const errors = p.filter((x) => x.severity === 2);
    for (const x of p) console.log(`index.html:${x.line}  ${x.severity === 2 ? "error" : "warn"}  ${x.message}  ${x.rule || ""}`);
    console.log(`lint-page: ${errors.length} error(s), ${p.length - errors.length} warning(s)`);
    process.exitCode = errors.length ? 1 : 0;
  }).catch((e) => { console.error(e); process.exitCode = 1; });
}
module.exports = { lintPage, blocks };
