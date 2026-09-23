/* The known cases (PLAN.md 4.5) as a gold set and as Word files:
   node bench/model-eval/known-cases.js

   bench/model-eval/gold/known-cases.json holds the cases, every one in invented
   text: the leaks the tool has had (r3, v28, v39 and the 16.9 shape in 20
   variants), the two leaks no model is expected to close (r4, r5, marked
   control), the five false-positive types, and names in nikud or Latin capitals.
   Each case says how a model passes it (passRules in the same file).

   This writes, under bench/model-eval/out/ (gitignored):
   - gold/known-cases.json, the cases as a gold set in the FORMATS.md shape, one
     doc per case, with the case's pass rule and control flag on the doc;
   - known-cases/<id>.docx, one paragraph per line of the case's text.
   Each .docx is read back with E.readBlocks, and the run stops if the text the
   product would hand the model differs from the case's text, because every
   offset in the key is into that text. */
const fs = require("fs");
const path = require("path");
const { mkzip } = require("../../tests/mkzip.js");
const { NS, P, R, base } = require("../../tests/structure-lib.js");

const SRC = path.join(__dirname, "gold", "known-cases.json");
const OUT = path.join(__dirname, "out");

const load = () => JSON.parse(fs.readFileSync(SRC, "utf8"));
const xmlText = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// one paragraph per line; no title paragraph, so the file's text is the case's text
function docxOf(text) {
  const body = text.split("\n").map((l) => P(l ? R(xmlText(l)) : "")).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${NS}><w:body>${body}</w:body></w:document>`;
  return mkzip([...base, { name: "word/document.xml", body: xml }]);
}

/* The cases as a gold set; surface and core stay on the mention for the scorers.
   FORMATS.md: all mentions of one entity share an ent. Every case keys one
   must entity (the full name, the surname alone and a spelling variant are the
   same person or town), so its must mentions share "<id>#must"; a case that
   ever keys two sets m.ent itself. Negatives are separate things, one per
   surface. */
const bare = (s) => String(s || "").replace(/[֑-ׇ]/g, "");
function goldSet(K) {
  return {
    name: "known-cases", source: "bench/model-eval/gold/known-cases.json", licence: K.licence || "repo", split: "all",
    passRules: K.passRules,
    docs: K.cases.map((c) => ({ id: c.id, genre: c.group, text: c.text, pass: c.pass, control: !!c.control, what: c.what,
      mentions: c.mentions.map((m) => ({ ...m, cat: c.group,
        ent: c.id + "#" + (m.ent ? m.ent : m.must ? "must" : bare(m.surface)) })) })),
  };
}

async function build(opts) {
  const o = opts || {};
  const K = o.cases || load();
  const outDir = o.out || OUT;
  const E = require("../engine.js");
  fs.mkdirSync(path.join(outDir, "gold"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "known-cases"), { recursive: true });
  const bad = [];
  for (const c of K.cases) {
    const buf = docxOf(c.text);
    const back = (await E.readBlocks(buf.slice(0))).map((b) => b.text).join("\n");
    if (back !== c.text) bad.push(c.id);
    fs.writeFileSync(path.join(outDir, "known-cases", c.id + ".docx"), Buffer.from(buf));
  }
  if (bad.length) throw new Error("the .docx text differs from the case text: " + bad.join(", "));
  const gold = goldSet(K);
  fs.writeFileSync(path.join(outDir, "gold", "known-cases.json"), JSON.stringify(gold, null, 1) + "\n");
  return { gold, outDir, n: K.cases.length };
}

module.exports = { load, docxOf, goldSet, build };

if (require.main === module) build().then((r) => {
  const ms = r.gold.docs.flatMap((d) => d.mentions);
  console.log(`${r.n} cases, ${ms.length} mentions (${ms.filter((m) => m.must).length} must, ${ms.filter((m) => !m.must).length} negatives), ${r.gold.docs.filter((d) => d.control).length} controls`);
  console.log("written to " + path.relative(path.join(__dirname, "..", ".."), r.outDir) + " (gold/known-cases.json, known-cases/*.docx)");
}).catch((e) => { console.error(e.message); process.exitCode = 1; });
