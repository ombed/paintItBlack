/* What a document leaves behind (review H1, and the independent review of 6.10).

   The leak shapes of one client's document rode out in the next client's package, because `leaks` was
   never reset: the reset listed the keys it cleared, and a key added later was simply not on the list.
   Then a document loaded after the back buttons found the last one's people, suggestions, places,
   decisions and scan: loading it had a list of its own, eight keys long, beside the fifty of «מסמך חדש»,
   so «מי בתיק» showed the first client's people and «המשך» applied them to the second.

   One reset now serves them all: docReset in index.html. This reads it, «מסמך חדש» and every place that
   puts a document in place out of index.html, and requires that
     - every state key the component sets is cleared by the reset, or named below as the session's, or
       as cleared by «מסמך חדש» alone, with the reason;
     - «מסמך חדש», the tour's start and end, and every setState that puts a document in place start from
       the reset; what «מסמך חדש» clears beside it is exactly the list below, so the two lists cannot
       drift apart again;
     - what an attached case keeps through a load is what the case stores (profileObj);
     - the instance fields that hold a document are cleared by the reset too. */
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const cls = src.slice(src.indexOf("class Component extends DCLogic"));

// the bracketed span that starts at the first `{` at or after `from` (in `text`), without its brackets
function literal(from, text = src) {
  let d = 0, i = text.indexOf("{", from), q = null;
  const start = i;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "/" && text[i + 1] === "/") { i = text.indexOf("\n", i); continue; }
    if (c === "{" || c === "[" || c === "(") d++;
    if (c === "}" || c === "]" || c === ")") { d--; if (!d) return text.slice(start + 1, i); }
  }
  throw new Error("unterminated literal");
}
// top-level keys of an object literal body, shorthand included; spreads are not keys
function keysOf(body) {
  const out = [], parts = []; let d = 0, q = null, cur = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) { cur += c; if (c === "\\") cur += body[++i]; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; cur += c; continue; }
    if (c === "/" && body[i + 1] === "/") { i = body.indexOf("\n", i); continue; }
    if ("{[(".includes(c)) d++;
    if ("}])".includes(c)) d--;
    if (c === "," && d === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  for (const p of parts) { const m = /^\s*([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(p); if (m) out.push(m[1]); }
  return out;
}
// the body of the method or arrow whose head ends with its opening brace; "" when it is not there
const bodyOf = (head) => { const at = cls.indexOf(head); return at < 0 ? "" : literal(at + head.length - 1, cls); };

// every state key the component sets: the initial state, and every setState({ … }) in the class
const init = keysOf(literal(src.indexOf("state = {")));
const set = new Set(init);
for (let at = cls.indexOf("setState({"); at >= 0; at = cls.indexOf("setState({", at + 1)) for (const k of keysOf(literal(at, cls))) set.add(k);

// the reset itself, and what a case that stays attached keeps through it
const resetBody = bodyOf("docReset(keepCase){");
const resetAt = resetBody.indexOf("const reset={");
const reset = new Set(resetAt >= 0 ? keysOf(literal(resetAt, resetBody)) : []);
const keeps = (/for\(const k of \[([^\]]*)\]\) delete reset\[k\]/.exec(resetBody) || [null, ""])[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
// what «מסמך חדש» clears beside the reset
const homeBody = bodyOf("onBackHome:()=>{");
const homeAt = homeBody.indexOf("this.setState({...this.docReset(false)");
const home = homeAt >= 0 ? keysOf(literal(homeAt, homeBody)) : [];

// belongs to the session or the machine, not to the document
const SESSION = {
  theme: "her display choice", ready: "the engine is loaded", E: "the engine module", narrow: "the window's width",
  mode: "a setting (a case brings its own)", o: "her settings (a case brings its number and date styles)",
  nerOff: "the environment cannot run the model", nerHint: "the same", nerHave: "the model is on this computer",
  nerMsg: "the model's download, which goes on in the background for the next document", nerPct: "the same", busyT: "rewritten by every wait",
  open: "which rail sections are open, set by every run", pane: "which pane is showing, set by every run",
  rvCopyLabel: "a button label", logCopyLabel: "a button label", engineFailed: "the engine did not load",
  intro: "the first visit's card", tour: "the tour, which starts and ends with the reset", tourSpot: "the tour's spotlight",
  settingsOpen: "her choice to show the settings", drag: "a file is being dragged over the page", showMap: "her choice to show the map",
  atlas: "the map data, loaded once", returnTo: "where the restore screen goes back to; with no document it falls back to the file screen",
  noticeUndo: "set with every notice; the notice itself is the document's",
};
// cleared by «מסמך חדש», and kept when the next document is loaded otherwise
const NEW_DOC_ONLY = {
  caseName: "«מסמך חדש» detaches the case (C3); a document loaded otherwise stays in the case that is attached",
  profile: "the same", profileDirty: "the same: the warning before leaving a case that was never exported",
  casesHidden: "the recent cases are offered again, since the case was detached",
  lastProfile: "the last profile is offered again, since the case was detached", cases: "read again for the same offer",
};

console.log("\n— every state key is cleared by the reset, by «מסמך חדש» alone, or is the session's —");
ok(init.length >= 60, "the initial state was parsed: " + init.length + " keys");
ok(set.size > init.length + 10, "the setState calls were parsed: " + set.size + " keys in all");
ok(reset.size >= 60, "docReset was found and parsed: " + reset.size + " keys");
for (const k of set) ok(reset.has(k) || k in NEW_DOC_ONLY || k in SESSION, `"${k}" is neither cleared by docReset nor listed as the session's or as «מסמך חדש»'s alone`);
for (const k of Object.keys(SESSION)) ok(set.has(k), `"${k}" is listed as the session's but is not a state key any more`);
for (const k of Object.keys(SESSION)) ok(!reset.has(k), `"${k}" is listed as the session's but the reset clears it`);
// origBlocks is set when a file is read, not in the initial state, and holds the whole original text
for (const k of ["origBlocks", "leaks", "rvIn", "rvOut", "peoNotSame", "geoEdits", "rules", "allow", "peo", "peoSug", "peoKept", "cands", "approved", "geo", "geoNames", "geoExtra", "notice", "popup"])
  ok(reset.has(k), `"${k}" holds one document's data and must be cleared by docReset`);

console.log("\n— «מסמך חדש» and every way to the next document start from the same reset —");
ok(homeAt >= 0, "«מסמך חדש» starts from docReset(false)");
ok(home.length > 0 && home.every((k) => k in NEW_DOC_ONLY), "«מסמך חדש» clears only the listed keys beside the reset: " + home.filter((k) => !(k in NEW_DOC_ONLY)).join(", "));
for (const k of Object.keys(NEW_DOC_ONLY)) ok(home.includes(k), `"${k}" is listed as cleared by «מסמך חדש», which does not clear it`);
for (const k of Object.keys(NEW_DOC_ONLY)) ok(!reset.has(k), `"${k}" is listed as «מסמך חדש»'s alone, but the reset clears it on every load`);
// each place that ends a document or loads one, by its head, and whether a case that is attached stays
const SITES = [
  ["load", "async load(f){", true], ["loadPdf", "async loadPdf(raw, f){", true], ["usePastedText", "usePastedText = async () => {", true],
  ["the tour's sample", "tourNext = async () => {", true], ["tourStart", "tourStart = async () => {", false], ["tourClose", "tourClose = () => {", false],
];
for (const [name, head, keep] of SITES) ok(bodyOf(head).includes(`this.setState({...this.docReset(${keep}),`), `${name} starts from docReset(${keep})`);
// and a document is put in place only through the reset: every setState that sets buf to a document spreads it
let docs = 0;
for (let at = cls.indexOf("setState({"); at >= 0; at = cls.indexOf("setState({", at + 1)) {
  const body = literal(at, cls);
  if (!keysOf(body).includes("buf")) continue;
  if (/(?:^|,)\s*buf\s*:\s*null\s*(?:,|$)/.test(body)) continue;
  docs++;
  ok(/^\s*\.\.\.this\.docReset\((true|false)\)/.test(body), "a setState puts a document in place without the reset: " + body.slice(0, 90).replace(/\s+/g, " "));
}
ok(docs >= 4, "the places that put a document in place were found: " + docs);
ok(!/this\.nextDoc\(/.test(src), "no second reset beside docReset");

console.log("\n— what an attached case keeps through a load is what the case stores —");
ok(keeps.join() === "rules,allow,removed,sent", "a case keeps its rules, allow list, removals and sent pseudonyms: " + keeps.join());
for (const k of keeps) ok(reset.has(k), `"${k}" is kept by a case and cleared without one, so the reset lists it`);
const prof = bodyOf("profileObj(){");
ok(/rules:this\.state\.rules/.test(prof) && /allow:this\.state\.allow/.test(prof), "profileObj stores the rules and the allow list");
ok(/removed:this\.removedNow\(\)/.test(prof) && /this\.state\.removed/.test(bodyOf("removedNow(){")), "profileObj stores the removals (removedNow)");
ok(/sent:this\.sentAll\(\)/.test(prof) && /this\.state\.sent/.test(bodyOf("sentAll(){")), "profileObj stores the sent pseudonyms (sentAll)");

/* The hosted service defines docEnd(how), which sends the finished document's usage log and its report of
   missed names; the session log's "new-doc" is where scripts/log-report.js splits documents. Both belong to
   the reset, so a document that ends is ended once, however the next one comes: a second call beside the
   reset («מסמך חדש» calling docEnd itself) would send the report twice and count the document twice. */
console.log("\n— a document ends once, in the reset —");
const count = (re) => (cls.match(re) || []).length;
ok(/if\(typeof this\.docEnd==="function"\) this\.docEnd\("new-doc"\);/.test(resetBody), "docReset calls the hosted service's docEnd when it exists");
ok(count(/docEnd\("new-doc"\)/g) === 1, 'docEnd("new-doc") is called in one place, the reset: ' + count(/docEnd\("new-doc"\)/g));
ok(/this\.log\.add\("new-doc",\{\}\)/.test(resetBody), 'docReset writes "new-doc" to the session log');
ok(count(/log\.add\("new-doc"/g) === 1, '"new-doc" is written in one place, the reset: ' + count(/log\.add\("new-doc"/g));

console.log("\n— the instance fields that hold a document are cleared with it —");
for (const f of ["this._undo=[]", "this._redo=[]", "this._modelFound=null", "this._lastScan=null", "this._scannedBuf=null", "this._goneAhead=null", "this._scan=(this._scan||0)+1"])
  ok(resetBody.includes(f), `docReset clears ${f.split(/[=(]/)[0]}`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
