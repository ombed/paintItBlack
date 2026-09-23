/* What "new document" must forget (review H1).

   The leak shapes of one client's document rode out in the next client's package,
   because `leaks` was never reset: the reset listed the keys it cleared, and a key added
   later was simply not on the list. This reads the component's initial state and the
   reset out of index.html and requires every key to be either cleared by the reset or
   named below as belonging to the session, with the reason. A new state key fails here
   until someone decides which of the two it is. */
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// the object literal that starts at the first "{" at or after `from`
function literal(from) {
  let d = 0, i = src.indexOf("{", from), q = null;
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); continue; }
    if (c === "{" || c === "[" || c === "(") d++;
    if (c === "}" || c === "]" || c === ")") { d--; if (!d) return src.slice(start + 1, i); }
  }
  throw new Error("unterminated literal");
}
// top-level keys of an object literal body, shorthand included
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

const initAt = src.indexOf("state = {");
const resetAt = src.indexOf('this.setState({screen:"entry", res:null, err:"", fileErr:"", name:"", buf:null');
ok(initAt > 0 && resetAt > 0, "the initial state and the new-document reset are where this test looks for them");
const init = keysOf(literal(initAt)), reset = new Set(keysOf(literal(resetAt)));

// belongs to the session or the machine, not to the document
const SESSION = {
  theme: "her display choice", ready: "the engine is loaded", E: "the engine module",
  mode: "a setting", o: "her settings", nerOff: "the environment cannot run the model", nerHint: "the same",
  nerMsg: "progress text, rewritten by every scan", nerPct: "the same", nerBox: "the same", scanning: "the same", busyT: "the same",
  open: "which rail sections are open, set by every run", pane: "which pane is showing, set by every run",
  rvCopyLabel: "a button label", logCopyLabel: "a button label",
  feedbackMail: "where she sends packages", numStyle: "a setting",
};

console.log("\n— every state key is cleared by 'new document' or is named as the session's —");
ok(init.length >= 60, "the initial state was parsed: " + init.length + " keys");
for (const k of init) ok(reset.has(k) || k in SESSION, `"${k}" is neither reset by "new document" nor listed as session-scoped`);
for (const k of Object.keys(SESSION)) ok(init.includes(k) || k === "numStyle", `"${k}" is listed as session-scoped but is not a state key any more`);
// origBlocks is set when a file is read, not in the initial state, and holds the whole original text
for (const k of ["origBlocks", "leaks", "rvIn", "rvOut", "peoNotSame", "geoEdits", "rules", "allow", "caseName"]) ok(reset.has(k), `"${k}" holds one client's data and must be reset`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
