/* Characterises the model's span boundaries before anyone fixes them:
   node bench/spans.js

   For every keyed person, org and place surface in the corpus, every
   occurrence in the text is compared with the raw model spans that touch
   it (after alignment and B/I grouping, before nerClean) and with what
   survives cleaning. Each occurrence gets one of:

     exact        the span is the surface
     glued-left   the span starts earlier: a title, a prefix letter, the
                  previous word, or the end of the previous sentence
     glued-right  the span runs on into the next word, a verb, punctuation
     cut-left     the span starts inside the surface (first letters lost)
     cut-right    the span ends inside the surface
     none         no span touches the occurrence

   plus context flags: whether the boundary sits on punctuation, at a chunk
   edge, after a title, before a speech verb, or on a prefix letter. The
   table says which failure is common and where, and whether cleaning
   repairs it or the value that reaches the list is still wrong. */
const fs = require("fs");
const path = require("path");
const E = require("./engine.js");
const { makeBench, loadModel, KEY } = require("./lib.js");

const B = makeBench(E);
const strip = (s) => s.replace(/[֑-ׇ]/g, "");
const TITLE_WORDS = /(?:עו"ד|עו"ס|ד"ר|גב'|מר|משפחת|המבקשת|המבקש|הנתבע|התובעת|העד|הקטין|הקטינה|השופט|השופטת|יו"ר)$/;
const PFX = new Set(["מ", "ב", "ל", "ו", "ה", "ש", "כ"]);
const KINDMAP = { PER: "NAME", ORG: "ORG", LOC: "PLACE", GPE: "PLACE", FAC: "PLACE" };

(async () => {
  const pipe = await loadModel();
  const occ = [];
  for (const doc of KEY.docs) {
    const rawOut = [];
    const res = await B.runDoc(pipe, doc, rawOut);
    const text = res.text, plain = strip(text);
    const cleaned = new Set(res.model.map((m) => E.norm(m.value)));
    for (const e of doc.entities) {
      if (e.kind === "TRAP" || e.kind === "PII" || !e.must) continue;
      // every occurrence of every surface, then drop a short surface's
      // occurrence that sits inside a longer surface's occurrence: "אריאל"
      // inside "אריאל הורוביץ" is the full name's occurrence, not a bare one
      const found = [];
      for (const sf of e.surfaces) {
        const s0 = strip(sf); let from = 0;
        while (true) { const i = plain.indexOf(s0, from); if (i < 0) break; from = i + 1; found.push({ sf, i, j: i + s0.length }); }
      }
      const kept = found.filter((a) => !found.some((b) => b !== a && b.i <= a.i && b.j >= a.j && (b.j - b.i) > (a.j - a.i)));
      for (const { sf, i, j } of kept) {
        {
          const s0 = strip(sf);
          const spans = rawOut.filter((r) => r.s < j && r.e > i);
          const o = { doc: doc.id, genre: doc.genre, cat: e.cat, kind: e.kind, surface: sf, at: i, cls: "none", flags: [], span: "", type: "", score: 0, survives: false };
          if (spans.length) {
            const r = spans.sort((a, b) => (b.e - b.s) - (a.e - a.s))[0];
            o.span = text.slice(r.s, r.e); o.type = r.type; o.score = +r.score.toFixed(2);
            const left = r.s < i ? "glued-left" : r.s > i ? "cut-left" : "";
            const right = r.e > j ? "glued-right" : r.e < j ? "cut-right" : "";
            o.cls = left && right ? left + "+" + right : left || right || "exact";
            const before = text.slice(Math.max(0, r.s - 12), r.s), gluedL = text.slice(r.s, i), gluedR = text.slice(j, r.e);
            if (r.s < i) {
              if (/[.!?:;\n]/.test(gluedL)) o.flags.push("across-punctuation");
              if (TITLE_WORDS.test(gluedL.trim())) o.flags.push("title");
              if (gluedL.length === 1 && PFX.has(gluedL)) o.flags.push("prefix-letter");
              if (gluedL.trim() && !o.flags.length) o.flags.push("previous-word");
            }
            if (r.e > j) {
              if (/[.!?:;\n,]/.test(gluedR)) o.flags.push("across-punctuation");
              const nxt = gluedR.trim().split(/\s+/)[0] || "";
              if (E.VRB.has(nxt)) o.flags.push("verb");
              else if (nxt) o.flags.push("next-word");
            }
            if (Math.abs(r.s - r.chunkOff) <= 1 || Math.abs(r.e - (r.chunkOff + r.chunkLen)) <= 1) o.flags.push("chunk-edge");
            if (KINDMAP[r.type] && KINDMAP[r.type] !== e.kind) o.flags.push("kind:" + r.type);
          } else {
            const prev = text.slice(Math.max(0, i - 12), i);
            if (TITLE_WORDS.test(prev.trim())) o.flags.push("after-title");
            if (i > 0 && /[א-ת]/.test(text[i - 1])) o.flags.push("prefix-letter");
          }
          o.survives = cleaned.has(E.norm(sf)) || cleaned.has(E.norm(sf.replace(/^(עו"ד|עו"ס|ד"ר|גב'|מר|משפחת|המבקשת|הנתבע|התובעת|העד|הקטין|הקטינה) /, "")));
          occ.push(o);
        }
      }
    }
  }
  const count = (list, f) => { const m = {}; for (const o of list) { const k = f(o); m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const md = [`# Span boundaries`, "", `${occ.length} occurrences of keyed name, org and place surfaces across ${KEY.docs.length} documents; raw model spans after alignment and grouping, before cleaning. Generated ${new Date().toISOString().slice(0, 10)}.`, ""];
  md.push("## By boundary class", "", "| class | occurrences | value survives cleaning |", "|---|---|---|");
  for (const [k, n] of count(occ, (o) => o.cls)) md.push(`| ${k} | ${n} | ${occ.filter((o) => o.cls === k && o.survives).length} |`);
  md.push("", "## Context flags on the mis-bounded spans", "", "| flag | occurrences |", "|---|---|");
  for (const [k, n] of count(occ.filter((o) => o.cls !== "exact" && o.cls !== "none").flatMap((o) => o.flags.map((f) => ({ f }))), (o) => o.f)) md.push(`| ${k} | ${n} |`);
  md.push("", "## Context flags on the missed occurrences (no span)", "", "| flag | occurrences |", "|---|---|");
  for (const [k, n] of count(occ.filter((o) => o.cls === "none").flatMap((o) => (o.flags.length ? o.flags : ["(none)"]).map((f) => ({ f }))), (o) => o.f)) md.push(`| ${k} | ${n} |`);
  md.push("", "## By genre", "", "| genre | exact | glued | cut | none |", "|---|---|---|---|---|");
  for (const g of [...new Set(occ.map((o) => o.genre))]) { const L = occ.filter((o) => o.genre === g); md.push(`| ${g} | ${L.filter((o) => o.cls === "exact").length} | ${L.filter((o) => o.cls.includes("glued")).length} | ${L.filter((o) => o.cls.includes("cut")).length} | ${L.filter((o) => o.cls === "none").length} |`); }
  md.push("", "## By category (mis-bounded or missed only)", "", "| category | glued | cut | none | of |", "|---|---|---|---|---|");
  for (const c of [...new Set(occ.map((o) => o.cat))]) { const L = occ.filter((o) => o.cat === c); const bad = L.filter((o) => o.cls !== "exact"); if (!bad.length) continue; md.push(`| ${KEY.categories[c]} | ${L.filter((o) => o.cls.includes("glued")).length} | ${L.filter((o) => o.cls.includes("cut")).length} | ${L.filter((o) => o.cls === "none").length} | ${L.length} |`); }
  md.push("", "## Every mis-bounded span", "", "| doc | surface | class | flags | raw span | type | score | survives |", "|---|---|---|---|---|---|---|---|");
  for (const o of occ.filter((o) => o.cls !== "exact" && o.cls !== "none")) md.push(`| ${o.doc} | ${o.surface} | ${o.cls} | ${o.flags.join(", ")} | ${o.span.replace(/\n/g, "⏎").replace(/\|/g, "∣")} | ${o.type} | ${o.score} | ${o.survives ? "yes" : "no"} |`);
  md.push("", "## Every missed occurrence", "", "| doc | surface | flags |", "|---|---|---|");
  for (const o of occ.filter((o) => o.cls === "none")) md.push(`| ${o.doc} | ${o.surface} | ${o.flags.join(", ")} |`);
  fs.writeFileSync(path.join(__dirname, "spans.md"), md.join("\n") + "\n");
  fs.writeFileSync(path.join(__dirname, "spans.json"), JSON.stringify(occ, null, 1));
  console.log(md.slice(0, 40).join("\n"));
})().catch((e) => { console.error(e); process.exit(1); });
