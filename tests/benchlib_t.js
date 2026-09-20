/* The benchmark's own scorer (bench/lib.js), outside review H12. The instrument that says
   "no leak" has to be able to see one. It could not see a surviving surface shorter than
   three letters, and P_SUR2 is a category of two-letter surnames: with the full name
   replaced and the bare surname left in the text, the realistic shape with the model on,
   the entity scored clean. */
const { makeBench } = require("../bench/lib.js");
const E = require("../bench/engine.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const B = makeBench(E);
const doc = { id: "x1", genre: "welfare", entities: [{ cat: "P_SUR2", kind: "NAME", must: true, canonical: "ליעד כץ", surfaces: ["ליעד כץ", "כץ"] }] };
const score = (out) => B.scoreDoc(doc, { out: B.norm(out), surfaced: new Map(), applied: new Set(["ליעד כץ"]), near: [] }).rows[0];

console.log("\n— a two-letter surname left in the output is a leak —");
{
  const left = score("יעל כהן הגיעה לפגישה. אחר כך כץ ביקשה ארכה.");
  ok(left.leaked === true && left.leakedSurfaces.includes("כץ"), "the bare surname is seen: " + JSON.stringify(left.leakedSurfaces));
  const gone = score("יעל כהן הגיעה לפגישה. אחר כך כהן ביקשה ארכה.");
  ok(gone.leaked === false, "nothing left, nothing reported: " + JSON.stringify(gone.leakedSurfaces));
  const inside = score("יעל כהן הגיעה. המכתב נשלח לכץ ולפרקליטות.");
  // a stated limit, pinned so that changing it is a decision: with a prefix letter allowed, "מצח"
  // (forehead) would read as a leak of the surname "צח", so a short surface matches as a bare token only
  ok(!inside.leakedSurfaces.includes("כץ"), "a short surface behind a prefix letter is not counted");
  const word = score("יעל כהן הגיעה לפגישה. ההחלטה מחייבת התייחסות.");
  ok(word.leaked === false, "two letters inside a longer word are not a leak");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
