/* A saved case the screen can show (the independent review of 6.10). The import of a cases file checked
   only its outer fields and, per entry, v:1 and a name, and stored the entry as it was: an entry whose
   rules was an object, a number or true was saved, and from then on the entry screen did not render
   ("index.renderVals(): object is not iterable"), on every reload, until every case was deleted.

   profileOk in index.html is now the one check for every profile that comes in or is read back: a
   profile file («ייבוא פרופיל מקובץ»), every entry of a cases file and its last profile (one entry that
   fails refuses the whole file), and every read of a stored case (readCases, readLast, writeCase). It
   asks for every field the screen reads, of the type the tool writes, and lets a field be missing, as
   it is in older files. A check too strict would refuse her own cases, so it runs here on every shape
   the tool has written since profiles began, and on shapes it never wrote; whatever it accepts must be
   read without an error by profilePairs, profileCount (the saved-cases list), applyProfile (using a
   case) and mergeCase (saving to one). And every read of a stored case must go through it.
   e2e/case-store.spec.js checks the same in a browser. Every name here is invented. */
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
// comments may name anything; only code counts
const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

// a member of the component class, cut out of the page: from its line to the first "  }" that closes it
const member = (head) => {
  const m = code.match(new RegExp("\\n {2}" + head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?\\n {2}\\}"));
  return m ? m[0].trim() : null;
};
const asFunction = (head, name) => {
  const src = member(head);
  return src ? new Function("return ({" + src.replace(/^static /, "") + "})." + name + ";")() : null;
};

console.log("\n— profileOk and the readers are found in the page —");
const profileOk = asFunction("static profileOk(p, named){", "profileOk");
const profilePairs = asFunction("profilePairs(prof, max=3){", "profilePairs");
const profileCount = asFunction("profileCount(prof){", "profileCount");
const applyProfile = asFunction("applyProfile(prof){", "applyProfile");
const mergeCase = asFunction("mergeCase(prev, cur){", "mergeCase");
const mkRule = asFunction("mkRule({value, kind, replacement, auto, g, ...rest}){", "mkRule");
for (const [n, f] of Object.entries({ profileOk, profilePairs, profileCount, applyProfile, mergeCase, mkRule })) ok(typeof f === "function", n + " is found in index.html");
const check = profileOk || (() => false);

console.log("\n— every shape the tool has written is accepted —");
const RULE = { value: "מיכאל פלדמן", kind: "NAME", replacement: "יואב כרמי", auto: false, g: null };
// oldest first: the file «ייצוא לקובץ» wrote before profileObj (5.9.2026, no name and no date of change),
// a saved case from 6.9 (name, updated), then styles (v50), removed, and sent (today)
const FIRST = { v: 1, created: "2026-09-05T09:00:00.000Z", mode: "real", rules: [RULE], allow: [], map: { [RULE.value]: RULE.replacement } };
const NAMED = { ...FIRST, name: "פלדמן נ׳ גרוס", updated: "2026-09-06T09:00:00.000Z" };
const STYLES = { ...NAMED, styles: { num: "blank", date: "name" } };
const REMOVED = { ...STYLES, removed: ["אבנר שטרן"] };
const NOW = { ...REMOVED, sent: { [RULE.value]: ["יואב כרמי", "דני לוי"] } };
const CASES = {
  "a case of 6.9": NAMED, "a case of v50": STYLES, "a case with what was removed": REMOVED, "a case of today": NOW,
  "a rule with every field the tool sets": { ...NOW, rules: [{ value: "רחל פרידמן", kind: "NAME", replacement: "דנה כהן", auto: true, g: "f", sameAs: "רחל", pinned: true, style: "label", review: true }] },
  "a place rule from before mkRule, its substitute null": { ...NOW, rules: [{ value: "חיפה", kind: "PLACE", replacement: null, auto: false }] },
  "a rule with a value alone": { ...NOW, rules: [{ value: "יוסי כהן" }] },
  "a case whose list was emptied, its decisions kept": { ...NOW, rules: [], map: {}, allow: ["רונית לוי"], removed: ["אבנר שטרן"] },
  "a gender kept as m, and a style and a sameAs left null": { ...NOW, rules: [{ ...RULE, g: "m", style: null, sameAs: null }] },
};
for (const [what, p] of Object.entries(CASES)) {
  ok(check(p, true), what + " is accepted as a saved case");
  ok(check(p), what + " is accepted as a profile");
}
ok(check(FIRST), "a profile file of 5.9, without a name, is accepted as a profile");
ok(check({ ...NOW, name: "" }), "the last profile without a name is accepted as a profile");

console.log("\n— shapes the tool never writes are refused —");
const BAD = {
  "rules as an object": { ...NOW, rules: { [RULE.value]: RULE.replacement } },
  "rules as a number": { ...NOW, rules: 2 },
  "rules as true": { ...NOW, rules: true },
  "rules as null": { ...NOW, rules: null },
  "no rules": (({ rules, ...p }) => p)(NOW),
  "rules as an array of numbers": { ...NOW, rules: [1, 2] },
  "a rule as a pair of strings": { ...NOW, rules: [[RULE.value, RULE.replacement]] },
  "a rule null": { ...NOW, rules: [null] },
  "a rule pair with a non-string substitute": { ...NOW, rules: [{ ...RULE, replacement: 7 }] },
  "a rule pair with a non-string value": { ...NOW, rules: [{ ...RULE, value: { x: 1 } }] },
  "a rule without a value": { ...NOW, rules: [{ kind: "NAME", replacement: "יואב כרמי" }] },
  "a rule kind that is not a string": { ...NOW, rules: [{ ...RULE, kind: 1 }] },
  "a map pair with a non-string": { ...NOW, map: { [RULE.value]: { to: "יואב כרמי" } } },
  "map as an array": { ...NOW, map: [RULE.value] },
  "allow as a string": { ...NOW, allow: "רשימה" },
  "allow with a number": { ...NOW, allow: [5] },
  "removed as an object": { ...NOW, removed: { x: 1 } },
  "sent as a number": { ...NOW, sent: 3 },
  "sent with a number for a list": { ...NOW, sent: { [RULE.value]: 4 } },
  "styles as a string": { ...NOW, styles: "blank" },
  "mode as an object": { ...NOW, mode: { real: true } },
  "a date of change as a number": { ...NOW, updated: 5 },
  "a name that is a number": { ...NOW, name: 12 },
  "version 2": { ...NOW, v: 2 },
  "version \"1\"": { ...NOW, v: "1" },
};
for (const [what, p] of Object.entries(BAD)) {
  ok(!check(p, true), what + " is refused as a saved case");
  ok(!check(p), what + " is refused as a profile");
}
for (const x of [null, undefined, 0, 1, true, "", "x", [], [NOW], {}]) ok(!check(x) && !check(x, true), JSON.stringify(x) + " is refused");
ok(!check({ ...NOW, name: "" }, true), "a saved case without a name is refused");
ok(!check(FIRST, true), "a saved case with no name field is refused");

console.log("\n— whatever it accepts, the screen reads without an error —");
// every field and every rule field, set in turn to each of these values: profileOk answers true or false
// and never throws, and every shape it accepts goes through the readers of a stored case
const VALUES = [undefined, null, true, false, 0, 7, -1.5, "", "x", "שם", [], [1, 2], ["x"], [null], [["a", "b"]], [{}],
  [{ value: "x" }], [{ value: 5 }], [{ value: "x", replacement: 5 }], {}, { a: 1 }, { a: "x" }, { a: ["x"] }, { a: [1] }, { a: null },
  { num: "blank" }, { num: 1 }, { date: [] }];
const shapes = [];
for (const k of ["v", "name", "rules", "map", "allow", "removed", "sent", "styles", "mode", "created", "updated"])
  for (const x of VALUES) shapes.push({ ...NOW, [k]: x });
for (const k of ["value", "replacement", "kind", "style", "sameAs", "g", "auto", "pinned"])
  for (const x of VALUES) shapes.push({ ...NOW, rules: [{ ...RULE, [k]: x }, RULE] });
for (const x of VALUES) shapes.push({ ...NOW, map: { [RULE.value]: x } }, { ...NOW, sent: { [RULE.value]: x } }, { ...NOW, styles: { num: x, date: "name" } });
const threw = [], answered = [], accepted = [];
for (const p of shapes) {
  for (const named of [true, false]) {
    let r;
    try { r = check(p, named); } catch (e) { threw.push(JSON.stringify(p).slice(0, 120) + " " + e.message); continue; }
    if (typeof r !== "boolean") answered.push(JSON.stringify(p).slice(0, 120) + " → " + String(r));
    else if (r) accepted.push(p);
  }
}
ok(threw.length === 0, "profileOk never throws: " + threw.slice(0, 3).join(" · "));
ok(answered.length === 0, "profileOk answers true or false: " + answered.slice(0, 3).join(" · "));
ok(accepted.length > 40 && accepted.length < shapes.length * 2, "some shapes are accepted and some refused: " + accepted.length + " of " + shapes.length * 2);
// the component, as far as these readers use it
const component = () => {
  const c = { state: { E: { norm: (s) => String(s) }, mode: "real", o: { numStyle: "blank" }, res: null, screen: "entry", peo: [], err: "" },
    constructor: { BAD_PROFILE: "bad" }, pushHistory() {}, rerun() {} };
  c.setState = (o, cb) => { c.state = { ...c.state, ...(typeof o === "function" ? o(c.state) : o) }; if (cb) cb(); };
  c.mkRule = mkRule;
  return c;
};
const broke = [];
for (const p of accepted) {
  const show = JSON.stringify(p).slice(0, 140);
  try {
    const pairs = profilePairs(p, 3), n = profileCount(p);
    if (!Array.isArray(pairs) || pairs.some((x) => typeof x.v !== "string" || typeof x.rep !== "string") || typeof n !== "number") broke.push("list: " + show);
    // the list's line: how many values, and when it was changed
    void ((p.rules || []).length + " · " + new Date(p.updated || p.created).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }));
    const c = component();
    applyProfile.call(c, p);
    if (c.state.err) broke.push("applyProfile: " + c.state.err + " " + show);
    else if (!c.state.rules.every((r) => r && typeof r.value === "string" && (r.replacement == null || typeof r.replacement === "string"))) broke.push("applyProfile rules: " + show);
    mergeCase.call(component(), p, NOW);
    mergeCase.call(component(), NOW, p);
  } catch (e) { broke.push(e.message + " " + show); }
}
ok(broke.length === 0, "every accepted shape is listed, used and saved to without an error: " + broke.slice(0, 3).join(" · "));
// and the shapes refused include every one that breaks a reader
const breaks = [];
for (const p of shapes) {
  let bad = false;
  try { profilePairs(p, 3); profileCount(p); } catch (_) { bad = true; }
  if (bad && check(p, true)) breaks.push(JSON.stringify(p).slice(0, 120));
}
ok(breaks.length === 0, "no shape that breaks the saved-cases list is accepted: " + breaks.slice(0, 3).join(" · "));

console.log("\n— every read of a stored case goes through profileOk —");
const body = (name) => member(name + "(") || member(name + " = ") || "";
ok(/profileOk\(p,true\)/.test(body("readCases")), "readCases lists only the entries profileOk accepts as saved cases");
ok(/profileOk\(/.test(body("readLast")) && /\.rules\.length/.test(body("readLast")), "readLast offers the last profile only when profileOk accepts it and its list is not empty");
{
  const w = body("writeCase");
  ok(/profileOk\(prev,true\)/.test(w) && w.indexOf("profileOk(prev,true)") < w.indexOf("mergeCase("), "writeCase merges only into an entry profileOk accepts; any other is replaced, so the case is saved");
}
{
  const im = body("importCases"), first = im.indexOf("localStorage.setItem");
  ok(/profileOk\(p,true\)/.test(im) && im.indexOf("profileOk(p,true)") < first, "importCases checks every entry before it writes anything");
  ok(/profileOk\(file\.last\)/.test(im) && im.indexOf("profileOk(file.last)") < first, "importCases checks the last profile before it writes anything");
}
{
  const f = body("onProfFile");
  ok(/profileOk\(prof\)/.test(f) && f.indexOf("profileOk(prof)") < f.indexOf("applyProfile(prof)"), "a profile file is checked by profileOk before it is applied");
}
// the members of the component class, by position
const heads = [...code.matchAll(/\n {2}(?:static |async )?([A-Za-z_$][\w$]*)(?:\([^)\n]*\)\s*\{| = )/g)].map((m) => [m.index, m[1]]);
const memberAt = (i) => { let name = null; for (const [at, n] of heads) { if (at < i) name = n; else break; } return name; };
// a reader with its own half of the check (v:1 and a name) is how the entry screen came to throw
const partial = [...code.matchAll(/([\w.]+)\.v\s*[!=]==?\s*1\b/g)].filter((m) => memberAt(m.index) !== "profileOk" && m[1] !== "file")
  .map((m) => memberAt(m.index) + ": " + m[0]);
ok(partial.length === 0, "outside profileOk no profile's version is checked on its own (the cases file's own v aside): " + partial.join(" · "));
// in the app's script, every read of the browser's storage but the three display keys reads a case key
const app0 = code.indexOf('type="text/x-dc"');
const DISPLAY = /^localStorage\.getItem\("redact-(?:theme|intro-seen|tour-seen)"\)/;
const reads = [...code.matchAll(/localStorage\.getItem\(/g)].filter((m) => app0 > 0 && m.index > app0 && !DISPLAY.test(code.slice(m.index, m.index + 50)))
  .map((m) => memberAt(m.index));
const RAW = ["readCases", "readLast", "writeCase", "deleteCase", "importCases"];
ok(reads.length >= 7, "the reads of the case keys are found: " + reads.length);
ok(reads.every((n) => RAW.includes(n)), "a case key is read only in " + RAW.join(", ") + " (the last three only write the stored map back, or compare a name): " + reads.join(", "));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
