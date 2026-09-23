/* The baseline's noise band (bench/model-eval/noise.js): which entities flip between runs that
   should agree. Invented run files in a temp folder; no model. */
const fs = require("fs"), os = require("os"), path = require("path");
const { band } = require("../bench/model-eval/noise.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const throws = (f, m) => { let t = false; try { f(); } catch (_) { t = true; } ok(t, m); };

const r = (doc, cat, canonical, o) => Object.assign({ doc, cat, canonical, found: true, leaked: false, fp: 0 }, o || {});
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "me-noise-"));
const put = (name, rows) => fs.writeFileSync(path.join(dir, name + ".json"), JSON.stringify({ rows }));
try {
  const base = [r("d1", "P_X", "דנה"), r("d1", "L_TOWN", "גבעת עדה"), r("d2", "O_PRIVATE", "חברת הדקל", { leaked: true }), r("d3", "T_TRAP", "בעצם", { found: null })];
  put("m-a", base);
  put("m-b", base);
  put("u-a", [r("d1", "P_X", "דנה", { found: false }), r("d1", "L_TOWN", "גבעת עדה"), r("d2", "O_PRIVATE", "חברת הדקל"), r("d3", "T_TRAP", "בעצם", { found: null, fp: 1 })]);

  const same = band(dir, ["m:a", "m:b"]);
  ok(same.entities.length === 0 && same.pairs[0].entities === 0, "the same run twice: nothing in the band");

  const b = band(dir, ["m:a", "m:b", "u:a"]);
  ok(b.entities.join() === ["d1|P_X|דנה", "d2|O_PRIVATE|חברת הדקל", "d3|T_TRAP|בעצם"].join(), "a miss, a leak closed and a new fp are in the band: " + b.entities.join(" ; "));
  ok(!b.entities.includes("d1|L_TOWN|גבעת עדה"), "an entity that did not change is not");
  ok(b.pairs[1].worse === 2 && b.pairs[1].better === 1 && b.pairs[1].entities === 3, "per pair: worse 2, better 1, 3 entities");
  ok(b.base === "m:a", "the first run is the one the others are compared with");

  ok(band(dir, ["m:a", "x:a"]).missing === 1, "a run with no file is reported, not read as agreeing");
  throws(() => band(dir, ["m:a"]), "one run is not a band");
  throws(() => band(dir, ["m:a", "../u:a"]), "a run name is a model and a tag, not a path");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
