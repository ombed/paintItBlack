/* The known-cases judge (bench/model-eval/known-score.js, PLAN.md 4.5): each pass rule, the
   buckets a failing mention falls in, and that controls count in no total. Invented text. */
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const { judge, render } = require("../bench/model-eval/known-score.js");
const KC = require("../bench/model-eval/known-cases.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const throws = (f, m) => { let t = false; try { f(); } catch (_) { t = true; } ok(t, m); };

// one invented case: text, the name's surface, the pass rule, and an optional recorded prefix
function one(id, text, surface, rule, extra) {
  const at = text.indexOf(surface);
  const m = Object.assign({ s: at, e: at + surface.length, type: "PER", must: true, surface }, extra || {});
  return { id, genre: "test", text, pass: rule, control: false, mentions: [m] };
}
const gold = (docs) => ({ name: "t", docs });
const preds = (map) => ({ model: "m", stage: "raw", docs: Object.entries(map).map(([id, spans]) => ({ id, spans })) });
const sp = (s, e, type, score) => ({ s, e, type: type || "PER", score: score == null ? 0.9 : score });

(() => {
  console.log("\n— exact-or-prefix-cut —");
  {
    const t = "אתמול דיברתי עם ולוי על הדירה.";
    const d = one("a", t, "לוי", "exact-or-prefix-cut", { prefix: "ו" });
    const s = d.mentions[0].s, e = d.mentions[0].e;
    const at = (spans) => judge(gold([d]), preds({ a: spans })).cases[0];
    let c = at([sp(s, e)]);
    ok(c.pass && c.buckets.exact === 1, "an exact span passes");
    c = at([sp(s - 1, e)]);
    ok(!c.pass && c.buckets["glued-prefix"] === 1, "a span glued only by the recorded prefix is glued-prefix, and fails");
    c = at([sp(s - 3, e)]);
    ok(!c.pass && c.buckets.glued === 1, "a span that starts a word earlier is glued");
    c = at([sp(s, e + 3)]);
    ok(!c.pass && c.buckets.glued === 1, "a span that runs into the next word is glued");
    c = at([sp(s, e - 1)]);
    ok(!c.pass && c.buckets.partial === 1, "a span short of the name is partial");
    c = at([]);
    ok(!c.pass && c.buckets.missed === 1, "no span: missed");
    c = at([sp(s - 1, e), sp(s, e)]);
    ok(c.pass && c.buckets.exact === 1, "a glued span beside an exact one: the exact one counts");
    c = at([sp(s, e, "ORG")]);
    ok(c.pass && c.kindMismatch === 1, "the kind is not checked, but a mismatch is counted");
  }
  {
    // a name whose first letter is itself a prefix letter: a span that leaves it out is a prefix-cut
    const t = "הגיעה אלינו בלומה אחרי הצהריים.";
    const d = one("b", t, "בלומה", "exact-or-prefix-cut");
    const s = d.mentions[0].s, e = d.mentions[0].e;
    const c = judge(gold([d]), preds({ b: [sp(s + 1, e)] })).cases[0];
    ok(c.pass && c.buckets["prefix-cut"] === 1, "a span cut only by a prefix letter passes");
    const t2 = "הגיעה אלינו דנה אחרי הצהריים.";
    const d2 = one("c", t2, "דנה", "exact-or-prefix-cut");
    const c2 = judge(gold([d2]), preds({ c: [sp(d2.mentions[0].s + 1, d2.mentions[0].e)] })).cases[0];
    ok(!c2.pass && c2.buckets.partial === 1, "a span cut by a letter that is not a prefix is partial");
    const c3 = judge(gold([d]), preds({ b: [sp(s + 2, e)] })).cases[0];
    ok(!c3.pass && c3.buckets.partial === 1, "cut by two letters is partial");
  }

  console.log("\n— covers-core —");
  {
    const t = "החשבון בבנק גבעת הדקל נסגר.";
    const d = one("k", t, "בנק גבעת הדקל", "covers-core", { type: "ORG", prefix: "ב" });
    const m = d.mentions[0];
    m.core = { s: t.indexOf("גבעת"), e: m.e };
    const at = (spans) => judge(gold([d]), preds({ k: spans })).cases[0];
    ok(at([sp(m.core.s, m.core.e, "ORG")]).pass, "a span over the core alone passes");
    ok(at([sp(m.s - 1, m.e, "ORG")]).pass, "a span over the mention and its recorded prefix passes");
    const g = at([sp(m.s - 3, m.e, "ORG")]);
    ok(!g.pass && g.buckets.glued === 1, "a span starting before the prefix is glued");
    const p = at([sp(m.s, m.core.s + 2, "ORG")]);
    ok(!p.pass && p.buckets.partial === 1, "a span short of the core is partial");
  }

  console.log("\n— negatives and no-span —");
  {
    const t = "בעצם יוסי אמר שהוא יבוא.";
    const at = t.indexOf("בעצם");
    const d = { id: "n", genre: "false-positive", text: t, pass: "no-span", control: false,
      mentions: [{ s: at, e: at + 4, type: "PER", must: false, surface: "בעצם" }] };
    ok(judge(gold([d]), preds({ n: [] })).cases[0].pass, "no span: passes");
    ok(judge(gold([d]), preds({ n: [sp(t.indexOf("יוסי"), t.indexOf("יוסי") + 4)] })).cases[0].pass, "a span elsewhere does not touch the negative");
    const hit = judge(gold([d]), preds({ n: [sp(at, at + 9)] })).cases[0];
    ok(!hit.pass && hit.negativeHits === 1, "a span over the negative fails the case");
    // an exact-or-prefix-cut case with a negative in it fails on the negative alone
    const t2 = "העו\"ד נועה כתבה למשרד.";
    const d2 = one("m", t2, "נועה", "exact-or-prefix-cut");
    d2.mentions.push({ s: 0, e: 5, type: "PER", must: false, surface: "העו\"ד" });
    const r = judge(gold([d2]), preds({ m: [sp(d2.mentions[0].s, d2.mentions[0].e), sp(0, 5)] })).cases[0];
    ok(!r.pass && r.ok === 1 && r.negativeHits === 1, "an exact name and a span on the role word: fails");
  }

  console.log("\n— threshold, controls, harness errors —");
  {
    const t = "פגשתי את רינה בשוק.";
    const d = one("t", t, "רינה", "exact-or-prefix-cut");
    const m = d.mentions[0];
    ok(judge(gold([d]), preds({ t: [sp(m.s, m.e, "PER", 0.4)] }), { threshold: 0.5 }).cases[0].buckets.missed === 1, "a span under the threshold is dropped");
    ok(judge(gold([d]), preds({ t: [{ s: m.s, e: m.e, type: "PER" }] }), { threshold: 0.9 }).cases[0].pass, "a span with no score (cleaned) is kept");
    const ctl = Object.assign(one("x", t, "רינה", "exact-or-prefix-cut"), { control: true });
    const J = judge(gold([d, ctl]), preds({ t: [], x: [] }));
    ok(J.totals.cases === 1 && J.controls.cases === 1 && J.totals.buckets.missed === 1, "a control is counted apart from the totals");
    throws(() => judge(gold([d]), preds({})), "a case with no predictions document is a harness error, not a pass");
    throws(() => judge(gold([d]), preds({ t: [sp(m.s, m.e, "GPE")] })), "an unmapped type is a harness error");
    throws(() => judge(gold([d]), preds({ t: [sp(0, 999)] })), "offsets outside the text are a harness error");
    throws(() => judge(gold([Object.assign({}, d, { pass: "close-enough" })]), preds({ t: [] })), "an unknown pass rule is a harness error");
    throws(() => judge(gold([d]), { docs: [{ id: "t", spans: [] }, { id: "t", spans: [] }] }), "a repeated predictions id is a harness error");
    ok(/0 of 1 cases pass/.test(render(J)) && /controls 0 of 1/.test(render(J)), "the summary line: " + render(J).split("\n")[0]);
  }

  console.log("\n— the real known-cases set —");
  {
    const G = KC.goldSet(KC.load());
    const perfect = { model: "m", stage: "raw", docs: G.docs.map((d) => ({ id: d.id, spans: d.mentions.filter((m) => m.must).map((m) => sp(m.s, m.e, m.type)) })) };
    const J = judge(G, perfect);
    ok(J.totals.passed === J.totals.cases && J.controls.passed === J.controls.cases, `the key itself as predictions passes every case (${J.totals.passed}/${J.totals.cases})`);
    const empty = { docs: G.docs.map((d) => ({ id: d.id, spans: [] })) };
    const E0 = judge(G, empty);
    const noSpan = G.docs.filter((d) => !d.control && d.pass === "no-span").length;
    ok(E0.totals.passed === noSpan, `no spans at all: only the no-span cases pass (${E0.totals.passed} of ${noSpan})`);
    ok(J.controls.cases === 2, "two controls (r4, r5)");

    // the command line, end to end, on invented files in a temp folder
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "me-known-"));
    try {
      fs.writeFileSync(path.join(dir, "g.json"), JSON.stringify(G));
      fs.writeFileSync(path.join(dir, "p.json"), JSON.stringify(perfect));
      const r = spawnSync(process.execPath, [path.join(__dirname, "..", "bench", "model-eval", "known-score.js"),
        "--gold=" + path.join(dir, "g.json"), "--pred=" + path.join(dir, "p.json"), "--out=" + path.join(dir, "k.json")], { encoding: "utf8" });
      ok(r.status === 0 && /cases pass/.test(r.stdout), "the command runs: " + (r.stderr || "").split("\n")[0]);
      const k = JSON.parse(fs.readFileSync(path.join(dir, "k.json"), "utf8"));
      ok(k.totals.passed === J.totals.passed, "and writes the same result");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
