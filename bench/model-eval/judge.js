/* Judging the model suggestions on her documents (PLAN.md decision 2 and 4.4): a suggestion
   that matches nothing in her key is either junk (a false positive) or a real name the key
   does not list. Claude judges them; nothing leaves private-bench.

     node bench/model-eval/judge.js collect     every unmatched cleaned-stage span of every row,
                                                merged by position -> private-bench/model-eval/judge/items.json
     node bench/model-eval/judge.js score       with judge/labels.json ({id: "name" | "not"}),
                                                each row's precision with the judged names counted
                                                -> judge/scores.json; the console gets counts only

   items.json carries her text (the span and a few words around it) and stays beside her
   documents. labels.json is written by the judge. */
const fs = require("fs");
const path = require("path");
const S = require("./score-spans.js");
const privacy = require("./privacy.js");

const PRIV = path.join(__dirname, "..", "..", "..", "private-bench", "model-eval");
const JUDGE = path.join(PRIV, "judge");
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

function preds() {
  const dir = path.join(PRIV, "pred");
  return fs.readdirSync(dir).filter((f) => /\.private\.cleaned\.json$/.test(f)).map((f) => read(path.join(dir, f)));
}

function collect() {
  const gold = read(path.join(PRIV, "gold", "private.json"));
  const byDoc = new Map(gold.docs.map((d) => [d.id, d]));
  const items = new Map();
  for (const p of preds()) {
    const M = S.match(gold, p, { match: "overlap-untyped" });
    for (const d of M.docs) {
      d.preds.forEach((sp, j) => {
        if (d.pm[j] >= 0 || d.predOnTrap[j]) return; // matched a key mention, or already a counted trap hit
        const k = `${d.id}:${sp.s}:${sp.e}`;
        if (!items.has(k)) {
          const text = byDoc.get(d.id).text;
          items.set(k, { id: "j" + (items.size + 1), doc: d.id, s: sp.s, e: sp.e, type: sp.type, text: text.slice(sp.s, sp.e),
            context: text.slice(Math.max(0, sp.s - 40), Math.min(text.length, sp.e + 40)).replace(/\s+/g, " "), models: [] });
        }
        items.get(k).models.push(p.model);
      });
    }
  }
  fs.mkdirSync(JUDGE, { recursive: true });
  const list = [...items.values()];
  fs.writeFileSync(path.join(JUDGE, "items.json"), JSON.stringify(list, null, 1) + "\n");
  privacy.safeLog("private", "labels", { count: list.length, models: new Set(list.flatMap((x) => x.models)).size });
}

function score() {
  const items = read(path.join(JUDGE, "items.json"));
  const labels = read(path.join(JUDGE, "labels.json"));
  const unjudged = items.filter((x) => !(x.id in labels)).length;
  const gold = read(path.join(PRIV, "gold", "private.json"));
  const byKey = new Map(items.map((x) => [`${x.doc}:${x.s}:${x.e}`, x]));
  const rows = [];
  for (const p of preds()) {
    const M = S.match(gold, p, { match: "overlap-untyped" });
    let tp = 0, fp = 0, named = 0, n = 0;
    for (const d of M.docs) {
      n += d.gold.length;
      d.preds.forEach((sp, j) => {
        if (d.pm[j] >= 0) { tp++; return; }
        const it = byKey.get(`${d.id}:${sp.s}:${sp.e}`);
        if (it && labels[it.id] === "name") named++; else fp++;
      });
    }
    const fn = n - tp;
    rows.push({ model: p.model, tp, named, fp, fn, p: (tp + named + fp) ? (tp + named) / (tp + named + fp) : 0, r: n ? tp / n : 0 });
  }
  fs.writeFileSync(path.join(JUDGE, "scores.json"), JSON.stringify({ unjudged, rows }, null, 1) + "\n");
  privacy.safeLog("private", "labels", "skip", { count: unjudged });
  for (const r of rows) privacy.safeLog("private", r.model, { tp: r.tp, added: r.named, fp: r.fp, fn: r.fn, p: +r.p.toFixed(3), r: +r.r.toFixed(3) });
}

if (require.main === module) {
  const cmd = process.argv[2];
  const run = cmd === "collect" ? collect : cmd === "score" ? score : null;
  if (!run) { console.error("usage: judge.js collect | score"); process.exitCode = 1; }
  else {
    try { privacy.wrapErrors(run); } catch (e) { console.error(privacy.sanitise(e).stack); process.exitCode = 1; }
  }
}
module.exports = { collect, score };
