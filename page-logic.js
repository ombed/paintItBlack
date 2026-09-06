/* Pure page logic that does not need the DOM: loaded by index.html as a
   plain script (window.PL) and by the Node tests with require(). The
   component class keeps state and handlers; what can be tested without a
   browser moves here.

   leakShape is the leak-report path. When a name gets through and she marks
   it herself, the document cannot be sent to us. What can be sent is the
   shape of the failure: how long the words were, what stood before and
   after, whether a prefix letter was attached, what each detection layer
   thought of that span. Never the text, never the name, never a fragment of
   either. bench/from-leak.js turns a shape back into a synthetic document
   that reproduces it. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PL = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const HEB = /[֐-׿]/;
  const PFX = new Set(["מ", "ב", "ל", "ו", "ה", "ש", "כ"]);
  const TITLE = /^(?:עו"ד|עוה"ד|עו״ד|ד"ר|ד״ר|דר'|פרופ'|מר|גב'|גברת|הגב'|הרב|השופט|השופטת|כב'|ח"כ|משפחת|הקטין|הקטינה|המנוח|המנוחה|התובע|התובעת|הנתבע|הנתבעת|המבקש|המבקשת|המשיב|המשיבה|העד|העדה|יו"ר|עו"ס)$/;
  const PREP = new Set(["של", "עם", "אל", "על", "ליד", "מול", "בין", "אצל", "לפני", "אחרי", "בעקבות", "לאחר", "כמו", "בשביל", "בגלל", "לגבי", "בעניין", "בפני"]);
  const KIN = new Set(["אמא", "אבא", "אם", "אב", "אח", "אחות", "בן", "בת", "סבא", "סבתא", "דוד", "דודה", "בעל", "אישה", "גרוש", "גרושה", "חבר", "חברה", "שכן", "שכנה", "אחיה", "אחיו", "אמה", "אמו", "אביה", "אביו"]);

  // one word of context, reduced to a class; the word itself is not kept
  function classify(w, E) {
    if (!w) return "none";
    const n = E.norm(w).trim();
    if (!n) return "none";
    if (!HEB.test(n)) return /\d/.test(n) ? "number" : "latin";
    if (TITLE.test(n)) return "title";
    if (E.VRB && E.VRB.has(n)) return "verb";
    if (PREP.has(n) || PREP.has(n.replace(/^ו/, ""))) return "prep";
    if (KIN.has(n) || KIN.has(n.replace(/^[בלמו]/, ""))) return "kin";
    if (E.COMMON && (E.COMMON.has(n) || E.COMMON.has(n.replace(/^[בהולמכש]/, "")))) return "common";
    if (E.KNOWN_FIRST && E.KNOWN_FIRST.has(n)) return "known-first-name";
    if (/^ה/.test(n)) return "definite";
    if (PFX.has(n[0]) && n.length >= 4) return "prefixed";
    return "other";
  }

  // rough genre from structure: speaker turns, numbered sections, prose
  function docShape(blocks, E) {
    const paras = blocks.map((b) => b.text).filter((t) => t && t.trim());
    const turns = paras.filter((t) => /^[^\n:]{1,40}:\s/.test(t)).length;
    const numbered = paras.filter((t) => /^\d+\.\s/.test(t)).length;
    const words = paras.reduce((n, t) => n + t.split(/\s+/).length, 0);
    const genre = turns >= Math.max(3, paras.length * 0.3) ? "transcript" : numbered >= 3 ? "filing" : /\[\d{1,2}\.\d{1,2}\.\d{2,4}, \d{1,2}:\d{2}\]/.test(paras[0] || "") ? "chat" : "prose";
    return { paragraphs: paras.length, words, speakerTurns: turns, numbered, genre };
  }

  /* blocks: the original document blocks; text: what she marked; ctx:
     {kind, version, modelUsed, cands (discover), nerRaw (model spans on the
     joined text), rules (the list at the time), near, suggest} */
  function leakShape(E, blocks, text, ctx) {
    ctx = ctx || {};
    const joined = blocks.map((b) => b.text).join("\n");
    const nj = E.norm(joined), nt = E.norm(text).trim();
    const words = nt.split(/\s+/).filter(Boolean);
    const shape = {
      v: ctx.version || "", when: new Date().toISOString(), kind: ctx.kind || "NAME",
      words: words.length, lens: words.map((w) => w.length),
      hyphen: /[-־]/.test(nt), geresh: /['"׳״]/.test(nt), nikud: /[֑-ׇ]/.test(text), digits: /\d/.test(nt),
      prefix: null, before: "none", after: "none", gapBefore: "", gapAfter: "",
      occurrences: 0, otherForms: 0, inList: false, listForm: null,
      layers: { discover: null, model: null, near: false, suggest: false },
      doc: docShape(blocks, E), modelUsed: !!ctx.modelUsed,
    };
    // occurrences of the exact surface, and of the stem behind a prefix letter
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const NW = "(?<![\\u0590-\\u05ff])", NWE = "(?![\\u0590-\\u05ff])";
    const all = [...nj.matchAll(new RegExp(NW + esc(nt) + NWE, "gu"))];
    shape.occurrences = all.length;
    const stem = PFX.has(nt[0]) && words.length === 1 && nt.length >= 4 ? nt.slice(1) : nt;
    if (stem !== nt) { shape.prefix = nt[0]; shape.stemOccurrences = [...nj.matchAll(new RegExp(NW + esc(stem) + NWE, "gu"))].length; }
    shape.otherForms = [...nj.matchAll(new RegExp(NW + "[בהולמכש]" + esc(stem) + NWE, "gu"))].length - (shape.prefix ? all.length : 0);
    // context classes at the first occurrence
    const first = all[0];
    if (first) {
      const i = first.index, j = i + nt.length;
      const before = nj.slice(Math.max(0, i - 40), i), after = nj.slice(j, j + 40);
      const bm = before.match(/([^\s]+)(\s*[^\s֐-׿]*\s*)$/), am = after.match(/^(\s*[^\s֐-׿]*\s*)([^\s]+)/);
      shape.before = classify(bm && bm[1], E); shape.gapBefore = bm ? bm[2].replace(/\s+/g, " ").trim() : "";
      shape.after = classify(am && am[2], E); shape.gapAfter = am ? am[1].replace(/\s+/g, " ").trim() : "";
      shape.atParagraphStart = i === 0 || nj[i - 1] === "\n";
      // what each layer thought of this span
      for (const c of ctx.cands || []) { const cn = E.norm(c.value).trim(); if (cn === nt || (cn.length >= 3 && (nt.includes(cn) || cn.includes(nt)))) { shape.layers.discover = { conf: c.conf || null, anchor: c.anchor || null, overlap: cn === nt ? "exact" : "partial" }; break; } }
      for (const r of ctx.nerRaw || []) { if (r.s < j && r.e > i) { shape.layers.model = { type: r.type, score: +(+r.score).toFixed(2), bounds: (r.s < i ? "glued-left " : r.s > i ? "cut-left " : "") + (r.e > j ? "glued-right" : r.e < j ? "cut-right" : "") || "exact" }; break; } }
      shape.layers.near = (ctx.near || []).some((x) => E.norm(x.value).trim() === nt);
      shape.layers.suggest = (ctx.suggest || []).some((x) => E.norm(x.value).trim() === nt);
    }
    for (const r of ctx.rules || []) {
      const rn = E.norm(r.value).trim();
      if (rn === nt) { shape.inList = true; shape.listForm = "same"; break; }
      if (rn.length >= 3 && (nt.includes(rn) || rn.includes(nt))) { shape.inList = true; shape.listForm = rn.split(/\s+/).length > words.length ? "longer" : "shorter"; break; }
    }
    return shape;
  }

  // the report she copies: shapes only; a guard refuses any shape that
  // still carries a letter sequence longer than two Hebrew characters
  function leakReport(shapes, extra) {
    const out = { tool: "paintItBlack", v: (extra && extra.version) || "", count: shapes.length, shapes };
    const s = JSON.stringify(out);
    const leak = s.match(/[֐-׿]{3,}/g);
    if (leak) throw new Error("leak report would carry text: " + leak.slice(0, 3).join(","));
    return JSON.stringify(out, null, 1);
  }

  return { classify, docShape, leakShape, leakReport };
});
