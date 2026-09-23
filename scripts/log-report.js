/* A one-page reading of her session log (npm run log-report -- <package.zip | session-log.json>).

   The log holds no text, only events with codes and counts (page-logic.js,
   sessionLog). This turns it into what we need to know before changing
   anything: where the minutes went, which corrections she made and what caused
   them, what she had to add herself and what each layer thought of it, how the
   model behaved, and what the in-session self-check saw.

   Sources (the src code on each correction, see logFacts in index.html):
     m model · h header · s speaker · p case profile · t she added it · b body scan ·
     w consistency sweep (part of a name) · x pattern (number, date) · n near spelling */
const fs = require("fs");
const path = require("path");

const SRC = { m: "model", h: "header", s: "speaker", p: "profile", t: "typed by her", b: "body scan", w: "sweep", x: "pattern", n: "near spelling", "-": "unknown" };

function readLog(file) {
  const buf = fs.readFileSync(file);
  // under four bytes readUInt32LE threw a bare RangeError (outside review, nit 9). No file
  // name in the message: hers may carry a client's name.
  if (buf.length < 4) throw new Error(`not a session log or a package: the file is ${buf.length} bytes`);
  if (buf.readUInt32LE(0) === 0x04034b50) {
    const { unzip } = require("./harvest-shapes.js");
    const f = unzip(buf).find((x) => /session-log\.json$/.test(x.name));
    if (!f) throw new Error("no session-log.json in the package");
    return JSON.parse(f.data.toString("utf8"));
  }
  return JSON.parse(buf.toString("utf8"));
}

const min = (ms) => (ms / 60000).toFixed(1);
const tally = (arr, key) => arr.reduce((m, e) => { let k = typeof key === "function" ? key(e) : e[key]; if (k === undefined || k === null) k = "?"; m[k] = (m[k] || 0) + 1; return m; }, {});
const fmt = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(" · ") || "—";
const srcName = (code) => (code || "-").split("").map((c) => SRC[c] || c).join("+");

function report(log) {
  const ev = log.events || [], out = [];
  const by = (name) => ev.filter((e) => e.ev === name);
  out.push(`paintItBlack ${log.v} · session of ${min(log.ms || 0)} min · ${ev.length} events`);

  // time per screen
  const scr = by("screen"); let last = 0, cur = "entry"; const t = {};
  for (const e of scr) { t[cur] = (t[cur] || 0) + (e.t - last); last = e.t; cur = e.to; }
  t[cur] = (t[cur] || 0) + ((log.ms || last) - last);
  out.push("", "Minutes per screen: " + Object.entries(t).map(([k, v]) => `${k} ${min(v)}`).join(" · "));

  // corrections and their causes
  const corr = ["allow", "not-a-name", "drop-rule", "set-rep", "set-style", "merge", "add-rule"];
  out.push("", "Corrections: " + fmt(Object.fromEntries(corr.map((c) => [c, by(c).length]).filter(([, n]) => n))));
  for (const c of ["allow", "not-a-name", "drop-rule", "set-style", "set-rep"]) {
    const x = by(c).filter((e) => "src" in e);
    if (!x.length) continue;
    out.push(`  ${c}: by source ${fmt(tally(x, (e) => srcName(e.src)))}`);
    out.push(`  ${" ".repeat(c.length)}  by kind ${fmt(tally(x, "kind"))} · waiting for review ${x.filter((e) => e.review).length}/${x.length} · model band ${fmt(tally(x, "band"))}`);
  }
  const reps = by("set-rep").filter((e) => "part" in e || "reset" in e);
  if (reps.length) {
    out.push(`  set-rep: what changed ${fmt(tally(reps, (e) => (e.reset ? "reset" : e.part)))}`);
    out.push(`           gender ${fmt(tally(reps, "gender"))} · origin ${fmt(tally(reps, "origin"))} · style ${fmt(tally(reps, "style"))} · the pseudonym was ${fmt(tally(reps, "was"))}`);
  }
  const opened = by("inline-open").length, acted = by("inline-act").length;
  if (opened) out.push(`  editor: opened ${opened}, acted ${acted}`);
  const ct = ev.filter((e) => corr.includes(e.ev)).map((e) => e.t), gaps = ct.slice(1).map((x, i) => x - ct[i]).sort((a, b) => a - b);
  if (gaps.length) out.push(`  seconds between corrections: median ${(gaps[gaps.length >> 1] / 1000).toFixed(0)}, longest ${(gaps[gaps.length - 1] / 1000).toFixed(0)}`);
  const styles = by("set-style");
  if (styles.length) out.push(`  set-style: to ${fmt(tally(styles, "style"))} · from ${fmt(tally(styles, "from"))}`);

  // what she had to add herself
  const miss = by("miss");
  if (miss.length) {
    out.push("", `Misses she added herself: ${miss.length}`);
    out.push(`  kind ${fmt(tally(miss, "kind"))} · words ${fmt(tally(miss, "words"))} · occurrences ${fmt(tally(miss, "occ"))}`);
    out.push(`  model saw it ${fmt(tally(miss, "model"))} · bounds ${fmt(tally(miss, "modelBounds"))}`);
    out.push(`  header layer ${miss.filter((e) => e.header).length} · body scan suggested ${miss.filter((e) => e.suggest).length} · near spelling ${miss.filter((e) => e.near).length}`);
    out.push(`  before ${fmt(tally(miss, "before"))} · after ${fmt(tally(miss, "after"))} · prefix ${miss.filter((e) => e.prefix).length} · hyphen ${miss.filter((e) => e.hyphen).length} · geresh ${miss.filter((e) => e.geresh).length}`);
  }

  // the model
  const md = by("model-done");
  for (const e of md) out.push("", `Model: ${(e.ms / 1000).toFixed(1)} s${e.cached ? " (cached)" : " (downloaded)"} · found ${e.found} (names ${e.names}, orgs ${e.orgs}, places ${e.places}, for review ${e.review}) · raw spans ${e.spans}: high ${e.high} · .8–.95 ${e.mid} · .6–.8 ${e.low} · below .6 ${e.below}`);
  if (!md.length && by("model-start").length) out.push("", "Model: started, no model-done event (older version, or it did not finish)");

  // the first run, by source
  const rs = by("run-src")[0];
  if (rs) out.push("", `First run: replaced ${rs.aList} from the list, ${rs.aSweep} by the sweep, ${rs.aPattern} by pattern; waiting ${rs.fReview} for review, ${rs.fNear} near spellings, ${rs.fNohit} listed but not found; rules ${rs.rules} (${rs.rulesAuto} automatic)`);

  // self-check
  const sc = by("self-check"), vn = +(String(log.v).match(/[0-9]+/) || [0])[0];
  if (vn && vn < 45) out.push("", `Self-check: not in ${log.v} (it arrived in v45)`);
  else out.push("", sc.length ? `Self-check: ${sc.length} broken rule(s): ${sc.map((e) => `${e.rule} on ${e.screen}×${e.n}`).join(" · ")}` : "Self-check: nothing broke");
  const pe = by("page-error");
  if (pe.length) out.push(`Page errors: ${fmt(tally(pe, (e) => e.name + " on " + e.screen))}`);
  if (by("self-check-off").length) out.push("  the self-check switched itself off (slow)");

  // everything else, so no event is invisible here
  const shown = new Set([...corr, "screen", "miss", "model-done", "run-src", "self-check", "self-check-off", "page-error", "inline-open", "inline-act"]);
  out.push("", "Other events: " + fmt(tally(ev.filter((e) => !shown.has(e.ev)), "ev")));
  const text = out.join("\n");
  if (/[א-ת]{3,}/.test(text)) throw new Error("the report would carry text; refusing");
  return text;
}

module.exports = { report, readLog };
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.log("usage: npm run log-report -- <package.zip | session-log.json> [...]"); process.exit(1); }
  for (const f of files) { console.log(`\n══ ${path.basename(f).replace(/[א-ת]/g, "")}`); console.log(report(readLog(f))); }
}
