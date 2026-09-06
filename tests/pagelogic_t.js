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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
