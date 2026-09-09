/* Scores the whole chain on the synthetic corpus, per category and per genre.
   The chain and the scoring live in lib.js; this is the command that writes
   results.md and results.json.

   --no-model skips the NER model and scores the deterministic layers alone.

   Private fixtures (bench/private.js): real documents kept in a sibling
   folder outside the repository. When present they are scored after the
   corpus on the same columns, and their report is written next to them,
   never here. CI never sees them; this file's committed outputs come from
   the corpus alone, so the gate baseline stays comparable. */
const fs = require("fs");
const path = require("path");
const E = require("./engine.js");
const { makeBench, loadModel, KEY } = require("./lib.js");
const PRIVATE = require("./private.js");

const NO_MODEL = process.argv.includes("--no-model");
const B = makeBench(E);

function report(title, docs, rows, unlisted, perDoc, meta) {
  const out = [];
  out.push(`# ${title}${NO_MODEL ? " (no model)" : ""}`, "", `${docs.length} documents, ${rows.length} keyed entities, model ${NO_MODEL ? "off" : "on (q8, same artifact as the browser)"}. Generated ${new Date().toISOString().slice(0, 10)}.`, "");
  out.push("## Per category", "", B.table(rows, "cat", "category", meta), "");
  out.push("## Per genre", "", B.table(rows, "genre", "genre", meta), "");
  const unl = {}; for (const u of unlisted) (unl[u.genre] = unl[u.genre] || []).push(u);
  out.push(`## Unlisted suggestions (match nothing in the key; one tap each) — ${unlisted.length} in total`, "",
    "Counted, not optimised for: the list is read, accept-all is not how the tool is used.", "");
  for (const gname of Object.keys(unl)) out.push(`- **${gname}** (${unl[gname].length}, ${unl[gname].filter((u) => u.applied).length} applied): ` + unl[gname].map((u) => `${u.value} [${u.sources.join("+")}${u.why ? "; " + u.why : ""}]${u.applied ? " **applied**" : ""}`).join(" · "));
  if (!unlisted.length) out.push("- none");
  out.push("", "## Missed and leaked, by document", "");
  for (const r of rows.filter((r) => r.found === false || r.leaked)) out.push(`- ${r.doc} · ${meta.categories[r.cat] || r.cat} · ${r.canonical}: ${r.found === false ? "missed" : "found via " + r.via.join("+") + " as «" + r.matched.join("», «") + "»"}${r.leaked ? ", **leaked**: " + r.leakedSurfaces.join(", ") : ""}`);
  out.push("", "## Traps and public bodies touched", "");
  for (const r of rows.filter((r) => r.found === null && r.fp)) out.push(`- ${r.doc} · ${meta.categories[r.cat] || r.cat} · ${r.canonical}: ${r.matched.length ? "suggested as «" + r.matched.join("», «") + "»" : ""}${r.leakedSurfaces.length ? (r.matched.length ? "; " : "") + r.leakedSurfaces.join(", ") : ""}`);
  out.push("", "## Timing", "", "| doc | genre | ms | rules confirmed | unlisted |", "|---|---|---|---|---|");
  for (const d of perDoc) out.push(`| ${d.id} | ${d.genre} | ${d.ms} | ${d.rules} | ${d.unlisted} |`);
  return out.join("\n") + "\n";
}

(async () => {
  const t0 = Date.now();
  const pipe = NO_MODEL ? null : await loadModel();
  if (pipe) console.log(`model loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // the corpus: committed outputs, the gate's input
  const { rows, unlisted, perDoc } = await B.runAll(pipe);
  const md = report("Benchmark results", KEY.docs, rows, unlisted, perDoc, KEY);
  fs.writeFileSync(path.join(__dirname, NO_MODEL ? "results-no-model.md" : "results.md"), md);
  fs.writeFileSync(path.join(__dirname, NO_MODEL ? "results-no-model.json" : "results.json"), JSON.stringify({ rows, unlisted, perDoc }, null, 1));
  console.log(md);

  // private fixtures: scored the same way, reported beside themselves
  const priv = PRIVATE.load();
  if (priv.docs.length) {
    const meta = { categories: { ...KEY.categories, ...priv.categories }, expectedFail: priv.expectedFail, exemptFromDisjoint: priv.exemptFromDisjoint };
    const P = await B.runAll(pipe, null, priv.docs);
    const pmd = report("Private fixtures", priv.docs, P.rows, P.unlisted, P.perDoc, meta);
    const stem = NO_MODEL ? "results-no-model" : "results";
    fs.writeFileSync(path.join(priv.dir, stem + ".md"), pmd);
    fs.writeFileSync(path.join(priv.dir, stem + ".json"), JSON.stringify({ rows: P.rows, unlisted: P.unlisted, perDoc: P.perDoc, totals: P.totals }, null, 1));
    console.log("\n" + "═".repeat(72) + "\nPRIVATE FIXTURES — " + priv.docs.length + " document(s) from " + priv.dir + "\n" + "═".repeat(72) + "\n");
    console.log(pmd);
  } else {
    console.log(`\n(no private fixtures at ${priv.dir})`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
