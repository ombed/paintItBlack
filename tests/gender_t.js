/* A girl's pseudonym is a girl's name (QA round 1, M2).

   With "הקטינה ליה לוי / נויה אזולאי / תהל ברק / אגם שמיר", every girl whose first name the
   lists did not know got a man's pseudonym ("אליהו סויסה", "סרגיי אשכנזי"), and the copied text
   read "הקטינה בועז". Two causes: the context rule (the word before a name gives its gender)
   matched only a one-word value, so "ליה לוי" never took it; and gender() read every name it
   did not know as male, three-letter names ending in ה included. Invented names only. */
const E = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const OPT = { on: new Set(), flag: new Set(), mode: "real", prefixes: "normal" };
const repsOf = (names, text) => {
  const eng = new E.Engine(names.map((v) => ({ value: v, kind: "NAME" })), [], OPT, text);
  const out = {};
  for (const h of eng.detect(text)) if (h.apply !== false && !out[h.base || h.text]) out[h.base || h.text] = eng.repFor(h);
  return out;
};

// the context before the full name decides, for a name the lists do not know
{
  const girls = ["ליה לוי", "נויה אזולאי", "תהל ברק", "אגם שמיר"];
  const reps = repsOf(girls, girls.map((n) => "הקטינה " + n + " הגיעה לפגישה.").join("\n"));
  for (const n of girls) ok(E.gender(String(reps[n] || "").split(" ")[0]) === "f", `after הקטינה, ${n} gets a girl's pseudonym: ${reps[n]}`);
  const boys = ["אגם שמיר"];
  const rb = repsOf(boys, "הקטין אגם שמיר הגיע לפגישה.");
  ok(E.gender(String(rb["אגם שמיר"] || "").split(" ")[0]) === "m", `after הקטין, the same name gets a boy's pseudonym: ${rb["אגם שמיר"]}`);
}

// without context, a short name ending in ה reads as a girl's, like a longer one
ok(E.gender("ליה") === "f", "ליה is read as female");
ok(E.gender("מאיה") === "f" && E.gender("דוד") === "m" && E.gender("משה") === "m", "known names keep their gender");

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
