/* The complexity numbers the review brief quotes, from one committed command:
     node scripts/complexity.js [--top=10]

   The brief's first list was typed from an ad-hoc eslint run that hit a parse error on
   engine/08-docx.js and skipped the file without saying so, so the function that builds the
   downloaded file, redactDocx, was missing from it (outside review, H15). This measures the
   bundle, redact-engine.js, instead of the sections, and also the app's script block inside
   index.html, which the project linter does not read. A file that does not parse is an error
   here, not a silent skip.

   Scope: redact-engine.js, page-logic.js, scripts/harvest-shapes.js, and the text/x-dc
   script of index.html. Rules: eslint `complexity` above 12 and `max-depth` above 4. */
const fs = require("fs");
const path = require("path");
const { Linter } = require("eslint");

const ROOT = path.join(__dirname, "..");
const LIMIT = 12, DEPTH = 4;

// the app's logic is the body of a <script type="text/x-dc"> block, run by new Function
function appScript(html) {
  const open = html.indexOf('<script type="text/x-dc"');
  if (open < 0) throw new Error("index.html: no text/x-dc script block");
  const start = html.indexOf(">", open) + 1;
  const end = html.indexOf("</script>", start);
  return "(function(){\n" + html.slice(start, end) + "\n});";
}

function sources(root) {
  const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
  return [
    { file: "redact-engine.js", code: read("redact-engine.js"), sourceType: "module" },
    { file: "page-logic.js", code: read("page-logic.js"), sourceType: "script" },
    { file: "scripts/harvest-shapes.js", code: read("scripts/harvest-shapes.js"), sourceType: "commonjs" },
    { file: "index.html.app.js", code: appScript(read("index.html")), sourceType: "script" },
  ];
}

function measure(srcs) {
  const linter = new Linter({ configType: "flat" });
  const fns = [], deep = {};
  for (const s of srcs) {
    const msgs = linter.verify(s.code, [{
      languageOptions: { ecmaVersion: "latest", sourceType: s.sourceType },
      rules: { complexity: ["warn", LIMIT], "max-depth": ["warn", DEPTH] },
    }], { filename: s.file });
    const fatal = msgs.find((m) => m.fatal);
    if (fatal) throw new Error(`${s.file}: does not parse (${fatal.message}, line ${fatal.line})`);
    deep[s.file] = 0;
    for (const m of msgs) {
      if (m.ruleId === "max-depth") deep[s.file]++;
      if (m.ruleId !== "complexity") continue;
      const g = /^(.*) has a complexity of (\d+)/.exec(m.message);
      fns.push({ file: s.file, line: m.line, name: g ? g[1] : m.message, value: g ? Number(g[2]) : 0 });
    }
  }
  fns.sort((a, b) => b.value - a.value);
  return { fns, deep };
}

module.exports = { measure, sources, appScript, LIMIT, DEPTH };

if (require.main === module) {
  const top = Number((process.argv.find((a) => a.startsWith("--top=")) || "--top=10").slice(6));
  const { fns, deep } = measure(sources(ROOT));
  const files = Object.keys(deep);
  for (const f of files) {
    const n = fns.filter((x) => x.file === f).length;
    console.log(`${f}: ${n} functions above ${LIMIT}, ${deep[f]} places nested deeper than ${DEPTH}`);
  }
  const lint = fns.filter((x) => !x.file.startsWith("index.html"));
  console.log(`\nlinted files: ${lint.length} functions above ${LIMIT}; with index.html: ${fns.length}`);
  console.log(`\ntop ${top} by complexity:`);
  for (const x of fns.slice(0, top)) console.log(`  ${String(x.value).padStart(4)}  ${x.name}  (${x.file}:${x.line})`);
}
