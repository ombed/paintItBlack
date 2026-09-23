/* page-logic.js without a browser. The leak report is the one that matters:
   it must describe a miss well enough to reproduce it, and carry no text. */
const PL = require("../page-logic.js");
const E = require("./core.js");

let pass = 0, fail = 0;
const ok = (what, c) => { if (c) pass++; else { fail++; console.log("  FAIL " + what); } };

const blocks = [
  { text: "פרוטוקול דיון", part: "body" },
  { text: "התובעת: רונית לוי, ת\"ז 123456782", part: "body" },
  { text: "הפסיכולוג איגור וולקוב ממליץ על הסדרי שהות. וולקוב ציין שפגש בהילי פעם אחת בלבד.", part: "body" },
  { text: "השופטת: הדיון נדחה. הקטינה אגם תישאר אצל האם.", part: "body" },
];
const cands = E.discover(blocks);

// a surname that only appears behind a prefix letter, once
const s1 = PL.leakShape(E, blocks, "בהילי", { kind: "NAME", version: "v14", cands, rules: [{ value: "רונית לוי" }] });
ok("prefix letter recorded", s1.prefix === "ב");
ok("one word of four letters after the prefix", s1.words === 1 && s1.lens[0] === 5);
ok("the stem never appears bare", s1.stemOccurrences === 0);
ok("the word before is classified, not kept", ["verb", "prefixed", "other"].includes(s1.before) && !JSON.stringify(s1).includes("פגש"));
ok("not in the list", s1.inList === false);
ok("genre is prose-ish", ["prose", "filing", "transcript"].includes(s1.doc.genre));

// a full name after a role word, present in the list as a longer form
const s2 = PL.leakShape(E, blocks, "וולקוב", { kind: "NAME", cands, rules: [{ value: "איגור וולקוב" }] });
ok("surname alone is a shorter form of a listed name", s2.inList && s2.listForm === "longer");
ok("occurrences counted", s2.occurrences === 2);
ok("discover's view matches what discover returned", !!s2.layers.discover === cands.some((c) => E.norm(c.value).includes("וולקוב")));

// a minor after הקטינה
const s3 = PL.leakShape(E, blocks, "אגם", { kind: "NAME", cands, rules: [] });
ok("title class before the minor", s3.before === "title");
ok("the word after is classified, not kept", typeof s3.after === "string" && s3.after !== "none" && !JSON.stringify(s3).includes("תישאר"));

// the report carries no text
let rep = null, threw = false;
try { rep = PL.leakReport([s1, s2, s3], { version: "v14" }); } catch (e) { threw = true; }
ok("report builds", !threw && rep);
ok("no Hebrew word in the report", rep && !/[֐-׿]{3,}/.test(rep));
ok("the name is not in the report", rep && !rep.includes("וולקוב") && !rep.includes("הילי") && !rep.includes("אגם"));
// a shape smuggling text is refused
threw = false; try { PL.leakReport([{ ...s1, note: "וולקוב" }]); } catch (e) { threw = true; }
ok("a shape carrying text is refused", threw);

// model spans feed the layers block
const s4 = PL.leakShape(E, blocks, "איגור וולקוב", { cands, nerRaw: [{ type: "PER", score: 0.93, s: blocks.slice(0, 2).map((b) => b.text).join("\n").length + 1 + "הפסיכולוג ".length, e: blocks.slice(0, 2).map((b) => b.text).join("\n").length + 1 + "הפסיכולוג איגור וול".length }] });
ok("model span bounds classified", s4.layers.model && s4.layers.model.bounds === "cut-right");

/* Review C1. The gap between the marked value and its neighbour was exported as the raw
   run of non-Hebrew characters, and the only guard looked for Hebrew. These lines have the
   shape of real corpus lines: an ID after the name, an email before it, an account number
   at the end of the previous paragraph. */
{
  const mark = (paras, v, ctx) => PL.leakShape(E, paras.map((t) => ({ part: "w", text: t })), v, ctx || { kind: "NAME", version: "v48" });
  const a = mark(["מרווה עבאס (205549611, ילידת 1990) נכחה."], "מרווה עבאס");
  ok("an ID after the name is a class", a.gapAfter === "digits(9)");
  const b = mark(["כתבו אל oleg.ivanov77@mail.ru. דניס וסילייב השיב."], "דניס וסילייב");
  ok("an email before the name is a class", b.gapBefore === "email");
  const c = mark(["מספר החשבון 5521907.", "אולג איוונוב חתם."], "אולג איוונוב");
  ok("the previous paragraph's tail is not context", c.gapBefore === "" && c.before === "none");
  const d = mark(["המורה, \"רחל פרידמן\", אמרה."], "רחל פרידמן");
  ok("punctuation from the short list is kept", d.gapBefore === "\"" && d.gapAfter === "\",");
  const e = mark(["ראו ABC-12/x רחל פרידמן כאן."], "רחל פרידמן");
  ok("anything else is a length, not characters", e.gapBefore === "mixed(8)");
  const rep = PL.leakReport([a, b, c, d, e], { version: "v48" });
  ok("no identifier reaches the report", !/205549611|oleg|ivanov|mail\.ru|5521907|ABC/.test(rep));
  ok("a clean report refuses nothing", JSON.parse(rep).refused === undefined);

  // the report is written from a schema: an unknown key does not leave, a wrong value is refused by name.
  // Hebrew text in a shape still makes the whole report refuse, as the older check above pins.
  const bad = JSON.parse(PL.leakReport([{ ...a, gapAfter: "(205549611,", kind: "rachel@x.com", note: "rachel friedman", lens: ["x"] }], { version: "<script>" }));
  ok("an unknown key does not leave", !("note" in bad.shapes[0]));
  ok("a value that does not fit is replaced", bad.shapes[0].gapAfter === "?" && bad.shapes[0].kind === "?" && bad.shapes[0].lens === "?");
  ok("and named, so the refusal is visible", ["shapes[0].kind", "shapes[0].lens", "shapes[0].gapAfter"].every((p) => bad.refused.includes(p)));
  ok("the version is checked too", bad.v === "");
  const model = mark(["רחל פרידמן אמרה."], "רחל פרידמן", { kind: "NAME", nerRaw: [{ type: "PER", score: 0.913, s: 0, e: 3 }] });
  ok("the model's bounds are codes with no stray space", model.layers.model.bounds === "cut-right" && JSON.parse(PL.leakReport([model])).refused === undefined);
}

/* Review M21 and M22. The suite above hands leakShape tests/core.js, which exports names the
   shipped engine does not: in the browser VRB, COMMON and KNOWN_FIRST were undefined, so
   every speech verb classified as "other". And page-logic.js re-implemented the word
   boundary and the prefix letters, so its counts differed from the engine's, and
   bench/from-leak.js rebuilt a different, easier document than the one that leaked.
   Here the engine is only what redact-engine.js exports, and the engine's own matcher is
   the oracle for the counts. */
{
  const fsx = require("fs"), pathx = require("path");
  const src = fsx.readFileSync(pathx.join(__dirname, "..", "redact-engine.js"), "utf8");
  const exported = new Set(src.match(/^export\s*\{([\s\S]*?)\}/m)[1].split(",").map((s) => s.trim()).filter(Boolean));
  const used = new Set([...fsx.readFileSync(pathx.join(__dirname, "..", "page-logic.js"), "utf8").matchAll(/\bE\.([A-Za-z_]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((k) => !exported.has(k));
  ok("every engine name page-logic.js reads is one the engine exports: missing " + missing.join(","), missing.length === 0);
  const REAL = Object.fromEntries(Object.entries(E).filter(([k]) => exported.has(k)));
  const say = [{ text: "פרוטוקול", part: "body" }, { text: "העדה אמרה רונית כהן הגיעה.", part: "body" }];
  ok("a speech verb before the name is a verb with the shipped engine", PL.leakShape(REAL, say, "רונית כהן", {}).before === "verb");
  const lines = ["פרוטוקול", "העדה רונית אמרה שלום.", '"רונית" חזרה.', "ורונית הוסיפה.", "ולרונית אין מה להוסיף.", "שרונית? לא.", "Xרונית כתובת.", "רונית."];
  const txt = lines.join("\n"), blk = lines.map((t) => ({ text: t, part: "body" }));
  const hits = new E.Engine([{ value: "רונית", kind: "NAME" }], [], { on: new Set(), flag: new Set(), mode: "real", prefixes: "normal" }, txt).detect(txt).filter((h) => h.base === "רונית");
  const bare = hits.filter((h) => E.norm(h.text).trim() === "רונית").length, pre = hits.length - bare;
  const sh = PL.leakShape(REAL, blk, "רונית", {});
  ok(`occurrences are the engine's: ${sh.occurrences} vs ${bare}`, sh.occurrences === bare);
  ok(`prefixed forms are the engine's, two-letter prefixes included: ${sh.otherForms} vs ${pre}`, sh.otherForms === pre);
}

// the session log keeps timings and counts, and refuses text
const L = PL.sessionLog("v18");
L.add("screen", { to: "people", from: "entry" });
L.add("add-rule", { origin: "mark", kind: "NAME", words: 2, name: "רונית לוי" });
L.add("rerun", { ms: 120, applied: 5, flagged: 1 });
const exp = L.export();
ok("log exports", typeof exp === "string" && JSON.parse(exp).events.length === 3);
ok("a text field is dropped, not exported", !exp.includes("רונית") && JSON.parse(exp).events[1].words === 2);
ok("a dropped field leaves its name, so the drop is visible", JSON.parse(exp).events[1].dropped === "name");
ok("no Hebrew word in the log", !/[֐-׿]{3,}/.test(exp));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
