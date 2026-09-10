/* Places by kind, and the reviewed taxonomy matched before distance.

   On the real session a neighbourhood came out as "[מקום א׳]" and a town
   could be swapped for any town at the right distance. Her decisions (Q11):
   a place keeps its kind (a neighbourhood gets a neighbourhood name, a
   street a street name, a moshav a moshav), a generic town is the fallback
   and a label never is; and the distance map matches on coarse attributes
   before distance, from a table she reviews. */
const fs = require("fs");
const path = require("path");
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— every town on the map is tagged, from the vocabulary —");
{
  const names = C.PLACES.map((p) => p.n);
  const missing = names.filter((n) => !C.ATLAS_TAGS[n]);
  ok(missing.length === 0, "untagged towns: " + missing.join(", "));
  const bad = [];
  for (const [n, raw] of Object.entries(C.ATLAS_TAGS)) {
    const t = raw.split("|");
    if (t.length !== C.ATLAS_KEYS.length) { bad.push(n + " (" + t.length + " fields)"); continue; }
    C.ATLAS_KEYS.forEach((k, i) => { if (!C.ATLAS_VOCAB[k].includes(t[i])) bad.push(n + ": " + k + "=" + t[i]); });
    if (!C.PLACE_BY[n]) bad.push(n + " is not on the map");
  }
  ok(bad.length === 0, "bad tags: " + bad.slice(0, 8).join("; "));
  const t = C.atlasTags("בני ברק");
  ok(t["דת"] === "חרדי" && t["סוג"] === "עיר", "atlasTags reads a row");
  ok(C.atlasTags("לא קיים")["דת"] === "לא ידוע", "an unknown town is explicitly unknown");
}

console.log("\n— the review document is in step with the engine file —");
{
  const doc = require("../scripts/build-atlas-doc.js");
  const want = doc.build(), have = fs.readFileSync(doc.OUT, "utf8").replace(/\r\n/g, "\n");
  ok(have === want, "docs/atlas-tags-he.md is stale; run: npm run build:atlas");
  ok(/\| בני ברק \| עיר \| יהודי \| חרדי \| גדול \|/.test(have), "the document lists a town with its tags");
}

console.log("\n— attributes before distance —");
{
  ok(C.atlasPenalty("בני ברק", "בית שמש") === 0, "two large haredi cities: no penalty");
  ok(C.atlasPenalty("בני ברק", "אלעד") > 0 && C.atlasPenalty("בני ברק", "אלעד") < C.atlasPenalty("בני ברק", "רמת גן"), "size differs less than religion");
  ok(C.atlasPenalty("בני ברק", "רמת גן") > 0, "haredi to secular: penalised");
  ok(C.atlasPenalty("אום אל-פחם", "חדרה") === Infinity, "arab to jewish: never");
  ok(C.atlasPenalty("נהלל", "עפולה") > C.atlasPenalty("נהלל", "כפר ויתקין"), "rural stays rural");
  ok(C.atlasDiff("בני ברק", "רמת גן").includes("דת"), "atlasDiff names the axis");
  // a haredi city and an arab town keep their character in the map
  const g = C.geoMap(["בני ברק", "אום אל-פחם", "חיפה"], 0);
  ok(!!g, "the map still finds a solution for a hard set");
  if (g) {
    const to = Object.fromEntries(g.map.map((m) => [m.from, m.to]));
    ok(C.atlasTags(to["בני ברק"])["דת"] === "חרדי", "בני ברק → a haredi city: " + to["בני ברק"]);
    ok(C.atlasTags(to["אום אל-פחם"])["אוכלוסייה"] === "ערבי", "אום אל-פחם → an arab town: " + to["אום אל-פחם"]);
    ok(g.map.every((m) => m.from !== m.to), "no town maps to itself");
    ok(typeof g.pen === "number", "the result carries its attribute cost");
  }
  // an ordinary set still maps with sensible distances
  const g2 = C.geoMap(["חיפה", "תל אביב", "באר שבע"], 0);
  ok(g2 && g2.err < 40, "a spread set keeps its distances roughly: err " + (g2 ? g2.err.toFixed(1) : "—"));
}

console.log("\n— a place keeps its kind —");
{
  ok(C.placeKind("גרה בשכונת הפרדס בעיר", "גרה בשכונת ".length) === "שכונה", "שכונת → שכונה");
  ok(C.placeKind("ברחוב הארזים 5", "ברחוב ".length) === "רחוב", "ברחוב → רחוב");
  ok(C.placeKind("עברו למושב ", "עברו למושב ".length) === "מושב", "למושב → מושב");
  ok(C.placeKind("קיבוץ ", 6) === "קיבוץ", "קיבוץ → קיבוץ");
  ok(C.placeKind("ליד כפר ", 8) === "כפר", "כפר → כפר");
  ok(C.placeKind("נסעו לחיפה", 6) === null, "no head word: null");

  const a = C.fakePlace("הפרדס", new Set(), new Set(), "שכונה");
  ok(a && C.NEIGHBORHOODS.includes(a), "a neighbourhood gets a neighbourhood name: " + a);
  ok(a === C.fakePlace("הפרדס", new Set(), new Set(), "שכונה"), "stable across runs");
  const s = C.fakePlace("הארזים", new Set(), new Set(), "רחוב");
  ok(s && C.STREETS.includes(s), "a street gets a street name: " + s);
  const m = C.fakePlace("בית חנן", new Set(), new Set(), "מושב");
  ok(m && C.atlasTags(m)["סוג"] === "מושב", "a moshav gets a moshav: " + m);
  const k = C.fakePlace("מגן", new Set(), new Set(), "קיבוץ");
  ok(k && C.atlasTags(k)["סוג"] === "קיבוץ", "a kibbutz gets a kibbutz: " + k);
  const c = C.fakePlace("ורדים", new Set(), new Set(), "כפר");
  ok(c && !/^כפר/.test(c) && c.length >= 2, "a כפר gets the tail of a כפר name: " + c);
  // the whole kind pool used up: a generic town, never a label
  const used = new Set(C.STREETS);
  const f = C.fakePlace("הארזים", used, new Set(), "רחוב");
  ok(f && !C.STREETS.includes(f) && !/^\[/.test(f), "pool exhausted → generic fallback, no label: " + f);
  ok(C.fakePlace("לוד", new Set(), new Set()) === C.fakePlace("לוד", new Set(), new Set(), null), "no kind is the old behaviour");
}

console.log("\n— end to end: the kind survives in the document —");
{
  const OPT = { on: new Set(["PLACES"]), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
  const text = "הילדה גרה בשכונת הפרדס. השכונה שקטה. הם עברו למושב בית חנן.";
  const eng = new C.Engine([{ value: "הפרדס", kind: "PLACE", replacement: "" }, { value: "בית חנן", kind: "PLACE", replacement: "" }], [], OPT, text);
  const hits = eng.detect(text).filter((h) => h.src === "list");
  const rep = Object.fromEntries(hits.map((h) => [h.base, eng.repFor(h)]));
  ok(C.NEIGHBORHOODS.includes(rep["הפרדס"].replace(/^ב/, "")) || C.NEIGHBORHOODS.includes(rep["הפרדס"]), "שכונת הפרדס → שכונת <neighbourhood>: " + rep["הפרדס"]);
  ok(rep["בית חנן"] && C.atlasTags(rep["בית חנן"].replace(/^ל/, ""))["סוג"] === "מושב" || (rep["בית חנן"] && C.atlasTags(rep["בית חנן"])["סוג"] === "מושב"), "מושב בית חנן → מושב <moshav>: " + rep["בית חנן"]);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
