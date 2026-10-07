/* A result that appears is said (the independent review of 6.10).

   The file's card on the entry screen appeared with no live region, and the notice, the tour's nudge
   and the people screen's note were live regions put on the screen together with their text, which a
   screen reader often does not announce: the region has to be there before what it says. This reads
   the template in index.html and requires that
     - no status region or aria-live region is itself conditional on an <sc-if>: it stays on its screen,
       and what it says comes and goes inside it (an alert may appear with its text: an alert is
       announced when it appears), except the regions listed below, each with the reason;
     - the file's card and the phone's question about the model, the notice, and the tour's nudge sit
       inside such a region;
     - each restore and each refused file puts its alert, and the restore its heading, back as a new
       element (a key that changes with each press), so the same words a second time are said again.
   e2e/live.spec.js, e2e/restore.spec.js and e2e/a11y.spec.js (M28) check the same in the browser. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = html.slice(html.indexOf('type="text/x-dc"'));
const doc = new JSDOM(html.slice(0, html.indexOf('<script type="text/x-dc"'))).window.document;
const LIVE = '[role="status"],[aria-live]';
const name = (el) => "<" + el.localName + [...el.attributes].filter((a) => /^(data-|role$|aria-)/.test(a.name)).map((a) => " " + a.name + (a.value ? `="${a.value}"` : "")).join("") + ">";

// a region that comes and goes with its screen part, for a reason
const EXEMPT = [
  ['[data-bar-text][role="status"]', "the work bar's status comes with the work screen; while an error stands in its place, that error is an alert"],
];

console.log("\n— a live region is on the screen before what it says —");
const live = [...doc.querySelectorAll(LIVE)];
ok(live.length >= 6, "the live regions were found: " + live.length);
for (const el of live) {
  const p = el.parentElement;
  const exempt = EXEMPT.some(([sel]) => el.matches(sel));
  ok(p.localName !== "sc-if" || exempt, `${name(el)} appears together with its text: it is the child of <sc-if value="${p.getAttribute("value")}">`);
}
for (const [sel] of EXEMPT) ok(doc.querySelector(sel), `${sel} is listed as an exception but is not in the page any more`);

console.log("\n— what was found appearing unsaid sits in a region —");
const inLive = (sel) => { const el = doc.querySelector(sel); return !!(el && el.parentElement && el.parentElement.closest(LIVE)); };
for (const [sel, what] of [["[data-pend]", "the loaded file's card"], ["[data-ner-ask]", "the phone's question about the model"], ["[data-notice]", "the notice"], ["[data-tour-nudge]", "the tour's nudge"]])
  ok(inLive(sel), `${what} (${sel}) sits inside a live region`);
for (const sel of ["[data-pend]", "[data-ner-ask]", "[data-notice]", "[data-tour-nudge]"]) {
  const el = doc.querySelector(sel);
  ok(el && !el.matches(LIVE), `${sel} is not a live region of its own inside one`);
}

console.log("\n— the same words again are said again —");
const rvErr = doc.querySelector('sc-if[value="{{ rvErr }}"] > [role="alert"]');
const rvHead = doc.querySelector("[data-rv-result]");
const fileErr = doc.querySelector("[data-file-err]");
ok(rvErr && rvErr.getAttribute("key") === "{{ rvKey }}", "the restore's alert is keyed by the press (rvKey)");
ok(rvHead && rvHead.getAttribute("key") === "{{ rvKey }}", "the restore's heading is keyed by the press (rvKey)");
ok(fileErr && fileErr.getAttribute("key") === "{{ fileErrKey }}", "the refused file's alert is keyed by the refusal (fileErrKey)");
ok(/onRvGo:this\.rvGo,/.test(app) && /rvGo = \(\) => \{\s*const S=this\.state, E=S\.E; this\._rvN=\(this\._rvN\|\|0\)\+1;/.test(app), "each press of «החזרת שמות» counts");
ok((app.split("\n").find((l) => l.includes("const bad=(m,code)=>")) || "").includes("this._fileErrN=(this._fileErrN||0)+1;"), "each refused file counts");
ok(/rvKey:"rv"\+\(this\._rvN\|\|0\)/.test(app) && /fileErrKey:"fe"\+\(this\._fileErrN\|\|0\)/.test(app), "the keys are made of the counts");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
