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

  /* What stands between the value and its neighbouring word, as a class. Up to three
     punctuation marks from a fixed list are kept as they are, because the shape of a
     failure often is its punctuation. Anything else, digits, Latin, an address, becomes a
     label with a length: "digits(9)", "email", "latin(12)", "mixed(7)". */
  const GAP_PUNCT = /^[,.;:!?()[\]"'׳״/–—-]{1,3}$/;
  function gapClass(raw) {
    const g = String(raw || "").replace(/\s+/g, "");
    if (!g) return "";
    if (GAP_PUNCT.test(g) && !/[׳״]{3}/.test(g)) return g;
    if (g.includes("@")) return "email";
    const digits = g.replace(/\D/g, "").length;
    if (digits && /^[\d\s()+.,/:-]+$/.test(g)) return "digits(" + digits + ")";
    if (!digits && /^[A-Za-z.,()'"-]+$/.test(g)) return "latin(" + g.length + ")";
    return "mixed(" + g.length + ")";
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
      // the context stays inside the paragraph: the 40 characters before a name at the start
      // of a paragraph used to be the tail of the previous one
      const ps = nj.lastIndexOf("\n", i - 1) + 1, pe = nj.indexOf("\n", j) < 0 ? nj.length : nj.indexOf("\n", j);
      const before = nj.slice(Math.max(ps, i - 40), i), after = nj.slice(j, Math.min(pe, j + 40));
      const bm = before.match(/([^\s]+)(\s*[^\s֐-׿]*\s*)$/), am = after.match(/^(\s*[^\s֐-׿]*\s*)([^\s]+)/);
      // the gap is reported as a class, never as the characters: it is a raw run of whatever
      // is not Hebrew, which is exactly where an ID number, a phone or an email sits
      shape.before = classify(bm && bm[1], E); shape.gapBefore = gapClass(bm && bm[2]);
      shape.after = classify(am && am[2], E); shape.gapAfter = gapClass(am && am[1]);
      shape.atParagraphStart = i === 0 || nj[i - 1] === "\n";
      // what each layer thought of this span
      for (const c of ctx.cands || []) { const cn = E.norm(c.value).trim(); if (cn === nt || (cn.length >= 3 && (nt.includes(cn) || cn.includes(nt)))) { shape.layers.discover = { conf: c.conf || null, anchor: c.anchor || null, overlap: cn === nt ? "exact" : "partial" }; break; } }
      for (const r of ctx.nerRaw || []) { if (r.s < j && r.e > i) { shape.layers.model = { type: r.type, score: +(+r.score).toFixed(2), bounds: ((r.s < i ? "glued-left " : r.s > i ? "cut-left " : "") + (r.e > j ? "glued-right" : r.e < j ? "cut-right" : "")).trim() || "exact" }; break; } }
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

  /* The report she copies, and may paste into a public issue. It is written field by
     field from a fixed schema: a key that is not listed here does not leave, and a value
     that does not fit its type is replaced by "?" and named in `refused`. The earlier
     version serialised the whole shape and looked for Hebrew afterwards, so a field
     holding digits or Latin — an ID number, a phone, an email — went out untouched. */
  const T = {
    bool: (v) => typeof v === "boolean",
    int: (v) => Number.isInteger(v) && v >= 0 && v < 1e7,
    ints: (v) => Array.isArray(v) && v.length <= 12 && v.every((x) => Number.isInteger(x) && x >= 0 && x < 200),
    score: (v) => typeof v === "number" && v >= 0 && v <= 1,
    version: (v) => typeof v === "string" && /^v?\d{0,4}$/.test(v),
    when: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v),
    code: (v) => typeof v === "string" && /^[A-Za-z][A-Za-z_-]{0,23}$/.test(v),
    codes: (v) => typeof v === "string" && /^[a-z]+(?:-[a-z]+)?(?: [a-z]+-[a-z]+)?$/.test(v) && v.length <= 24,
    prefix: (v) => v === null || (typeof v === "string" && /^[בהולמכש]$/.test(v)),
    gap: (v) => v === "" || (typeof v === "string" && (GAP_PUNCT.test(v) || /^(?:email|(?:digits|latin|mixed)\(\d{1,3}\))$/.test(v))),
    orNull: (f) => (v) => v === null || f(v),
  };
  const LEAK_SCHEMA = {
    v: T.version, when: T.when, kind: T.code, words: T.int, lens: T.ints,
    hyphen: T.bool, geresh: T.bool, nikud: T.bool, digits: T.bool,
    prefix: T.prefix, before: T.code, after: T.code, gapBefore: T.gap, gapAfter: T.gap,
    occurrences: T.int, stemOccurrences: T.int, otherForms: (v) => Number.isInteger(v) && Math.abs(v) < 1e7,
    inList: T.bool, listForm: T.orNull(T.code), atParagraphStart: T.bool, modelUsed: T.bool,
    layers: { discover: { conf: T.orNull(T.code), anchor: T.orNull(T.code), overlap: T.code },
      model: { type: T.code, score: T.score, bounds: T.codes }, near: T.bool, suggest: T.bool },
    doc: { paragraphs: T.int, words: T.int, speakerTurns: T.int, numbered: T.int, genre: T.code },
  };
  function pickBySchema(schema, obj, path, refused) {
    const out = {};
    for (const [k, rule] of Object.entries(schema)) {
      if (!obj || !(k in obj)) continue;
      const v = obj[k], at = path ? path + "." + k : k;
      if (typeof rule === "function") { if (rule(v)) out[k] = v; else { out[k] = "?"; refused.push(at); } }
      else out[k] = v === null ? null : (v && typeof v === "object") ? pickBySchema(rule, v, at, refused) : (refused.push(at), "?");
    }
    return out;
  }
  function leakReport(shapes, extra) {
    // text in a shape means something upstream is broken: refuse outright, as before, so she
    // sees an error instead of a report that quietly lost a field
    const raw = JSON.stringify(shapes || []).match(/[֐-׿]{3,}/g);
    if (raw) throw new Error("leak report would carry text: " + raw.length + " run(s)");
    const refused = [];
    const clean = (shapes || []).map((sh, i) => pickBySchema(LEAK_SCHEMA, sh, "shapes[" + i + "]", refused));
    const ver = extra && extra.version;
    const out = { tool: "paintItBlack", v: T.version(ver) ? ver : "", count: clean.length, shapes: clean };
    if (refused.length) out.refused = refused.slice(0, 20);
    const s = JSON.stringify(out);
    const leak = s.match(/[֐-׿]{3,}/g);
    if (leak) throw new Error("leak report would carry text: " + leak.slice(0, 3).join(","));
    return JSON.stringify(out, null, 1);
  }

  /* The session log (decision Q16 in docs/PLAN-v18.md): where did the minute
     go. Always on, local only, exported by a button next to the leak report.
     It records timings and events, never text: an event carries counts and
     kinds, and the same guard as the leak report refuses anything that looks
     like a Hebrew word. */
  function sessionLog(version) {
    const t0 = Date.now();
    const events = [];
    const log = {
      v: version || "", started: new Date(t0).toISOString(), events,
      at: () => Date.now() - t0,
      add(ev, data) {
        const d = {}, dropped = [];
        for (const [k, v] of Object.entries(data || {})) {
          if (typeof v === "number" || typeof v === "boolean") d[k] = v;
          else if (typeof v === "string" && !/[֐-׿]{3,}/.test(v) && v.length <= 24) d[k] = v;
          // a field the guard refuses leaves its name behind, so a drop is never silent
          else dropped.push(k);
        }
        if (dropped.length) d.dropped = dropped.join(",").slice(0, 60);
        events.push({ t: Date.now() - t0, ev, ...d });
        if (events.length > 2000) events.splice(0, events.length - 2000);
      },
      export() {
        const out = { tool: "paintItBlack", v: log.v, started: log.started, ms: Date.now() - t0, events };
        const s = JSON.stringify(out);
        const leak = s.match(/[֐-׿]{3,}/g);
        if (leak) throw new Error("session log would carry text: " + leak.slice(0, 3).join(","));
        return JSON.stringify(out, null, 1);
      },
    };
    return log;
  }

  return { classify, docShape, leakShape, leakReport, sessionLog };
});
