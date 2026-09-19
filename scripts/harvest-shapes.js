/* Shapes harvested from real documents (docs/QUALITY-PLAN.md, layer 4).

   Reads each private fixture (../private-bench/<key>/document.docx with its
   key.json) and records, for every occurrence of every keyed value, only the
   shape around it, never the text. The shape is:

     part       where in the file: body, header, footnote, comment, chart …
     container  table, text box, hyperlink, field result, content control, tracked change …
     runs       how many formatting runs the occurrence spans, and whether their formatting differs
     sep        a tab, line break, no-break space or no-break hyphen inside it
     inner      punctuation inside it (maqaf, geresh, quote)
     prefix     the prefix letters in front of it (at most two letters)
     before / after   the punctuation on each side, or start, space, digit, end
     attr / el  an attribute or a non-paragraph element that holds the value

   The same harvester then reads what our checks cover: the synthetic corpus
   (bench/corpus + bench/key.json), the typographic shapes (tests/shape-lib.js)
   and the Word structures (tests/structure-lib.js). A shape her documents have
   and our checks don't is reported and fails the run.

   Nothing here leaves the machine. The report is written next to the fixtures,
   and a guard refuses to print or write anything that holds three Hebrew
   letters in a row. Run it on every new client package:

       node scripts/harvest-shapes.js            (PRIVATE_BENCH overrides the folder)
*/
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { DOMParser } = require("@xmldom/xmldom");

const ROOT = path.resolve(__dirname, "..");
const PRIVATE = process.env.PRIVATE_BENCH ? path.resolve(process.env.PRIVATE_BENCH) : path.resolve(ROOT, "..", "private-bench");
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const HEB = /[א-ת]/;
const MARK = /[֑-ׇ]/;
const PREFIX = "בהולמכש";

// ── a small zip reader: the central directory, stored or deflated entries ──
function unzip(buf) {
  const b = Buffer.from(buf);
  let e = b.length - 22;
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip");
  const n = b.readUInt16LE(e + 10), cd = b.readUInt32LE(e + 16);
  const out = [];
  for (let i = 0, p = cd; i < n; i++) {
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), nl = b.readUInt16LE(p + 28), xl = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nl).toString("utf8");
    const lnl = b.readUInt16LE(off + 26), lxl = b.readUInt16LE(off + 28);
    const raw = b.slice(off + 30 + lnl + lxl, off + 30 + lnl + lxl + size);
    out.push({ name, data: method === 8 ? zlib.inflateRawSync(raw) : raw });
    p += 46 + nl + xl + cl;
  }
  return out;
}

function partKind(name) {
  const base = name.split("/").pop().replace(/\d+/g, "");
  if (name.startsWith("docProps/")) return "properties";
  if (name.includes("/glossary/")) return "glossary";
  if (name.includes("/diagrams/")) return "smartart";
  if (name.includes("/charts/")) return "chart";
  const k = { "document.xml": "body", "header.xml": "header", "footer.xml": "footer", "footnotes.xml": "footnote", "endnotes.xml": "endnote", "comments.xml": "comment", "settings.xml": "settings" }[base];
  return k || "other:" + base;
}

const CONTAINERS = { tc: "table", txbxContent: "text box", hyperlink: "hyperlink", sdtContent: "content control", fldSimple: "field", ins: "tracked insert", del: "tracked delete", moveTo: "tracked move", moveFrom: "tracked move", customXml: "custom xml", smartTag: "smart tag", comment: "comment" };
const SEPS = { tab: [" ", "tab"], br: [" ", "line break"], cr: [" ", "line break"], noBreakHyphen: ["-", "no-break hyphen"] };

const side = (c) => (c === undefined ? "edge" : /\s/.test(c) ? (c === " " || c === " " ? "no-break space" : "space") : /[0-9]/.test(c) ? "digit" : /[A-Za-z]/.test(c) ? "latin" : c);

// one paragraph: its characters, each with the run it came from and whether it is a separator
function paragraphChars(p) {
  const chars = [];
  let field = 0; // 0 outside, 1 instruction, 2 result
  const walk = (node, run) => {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const ln = c.localName;
      if (ln === "p" && c !== p) continue;
      if (ln === "fldChar") { const t = c.getAttribute("w:fldCharType"); field = t === "begin" ? 1 : t === "separate" ? 2 : 0; continue; }
      if (ln === "instrText") continue;
      const r = ln === "r" ? c : run;
      if (ln === "t" || ln === "delText") {
        for (const ch of c.textContent || "") chars.push({ ch, run: r, field: field === 2, el: c });
        continue;
      }
      if (SEPS[ln] && node.localName === "r") { chars.push({ ch: SEPS[ln][0], run: r, sep: SEPS[ln][1], el: c }); continue; }
      if (ln === "softHyphen" && node.localName === "r") { chars.push({ ch: "", run: r, sep: "soft hyphen", el: c }); continue; }
      walk(c, r);
    }
  };
  walk(p, null);
  return chars.filter((x) => x.ch !== "" || x.sep);
}

const rprOf = (run) => { if (!run) return ""; for (let c = run.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.localName === "rPr") return c.toString(); return ""; };
function containersOf(el) {
  const out = new Set();
  for (let a = el; a && a.nodeType === 1; a = a.parentNode) if (CONTAINERS[a.localName]) out.add(CONTAINERS[a.localName]);
  return out;
}

// every occurrence of every surface, as shapes
function harvest(files, surfaces) {
  const shapes = [];
  // longest first: a key that lists "לX" beside "X" means the whole of "לX", once
  const surf = [...new Set(surfaces.filter((s) => s && s.trim().length >= 2))].sort((a, b) => b.length - a.length);
  for (const f of files) {
    if (!/\.xml$/.test(f.name) || !/^(word|docProps)\//.test(f.name)) continue;
    const part = partKind(f.name);
    let doc;
    try { doc = new DOMParser({ onError() {} }).parseFromString(f.data.toString("utf8"), "application/xml"); } catch (_) { continue; }
    const all = Array.from(doc.getElementsByTagName("*"));
    // paragraphs, Word or DrawingML
    for (const p of all.filter((x) => x.localName === "p")) {
      const chars = paragraphChars(p).filter((x) => x.ch !== "");
      const soft = paragraphChars(p);
      const text = chars.map((x) => (x.ch === " " || x.ch === " " ? " " : x.ch)).join("");
      const taken = [];
      for (const s of surf) {
        let i = -1;
        while ((i = text.indexOf(s, i + 1)) >= 0) {
          const e = i + s.length;
          if (HEB.test(text[e] || "") || MARK.test(text[e] || "")) continue;
          let a = i, pre = "";
          while (a > 0 && pre.length < 2 && PREFIX.includes(text[a - 1])) { pre = text[a - 1] + pre; a--; }
          // two letters only in the pairs Hebrew writes (the engine's own list); "במ" before a short
          // name means the name is the tail of another word
          if (pre.length === 2 && !/^(?:ו[בהלמכ]|כש|מה|לכ)$/.test(pre)) { pre = pre.slice(1); a++; }
          if (HEB.test(text[a - 1] || "")) continue; // inside a longer word
          if (taken.some(([x, y]) => a < y && x < e)) continue; // part of a longer surface already counted
          taken.push([a, e]);
          const occ = chars.slice(i, e);
          const runs = [...new Set(occ.map((x) => x.run).filter(Boolean))];
          const conts = new Set();
          for (const x of occ) for (const c of containersOf(x.el)) conts.add(c);
          if (occ.some((x) => x.field)) conts.add("field result");
          const seps = new Set(occ.filter((x) => x.sep).map((x) => x.sep));
          for (const x of occ) if (x.ch === " " || x.ch === " ") seps.add("no-break space");
          const first = occ[0] && soft.indexOf(occ[0]), last = occ[occ.length - 1] && soft.indexOf(occ[occ.length - 1]);
          if (soft.slice(first, last + 1).some((x) => x.sep === "soft hyphen")) seps.add("soft hyphen");
          const inner = new Set(occ.map((x) => x.ch).filter((c) => !HEB.test(c) && !MARK.test(c) && !/\s/.test(c) && !occ.find((x) => x.ch === c && x.sep)));
          shapes.push({
            part, container: [...conts].sort(), runs: runs.length > 2 ? "3+" : String(runs.length || 1),
            formatting: new Set(runs.map(rprOf)).size > 1 ? "differs" : "same",
            sep: [...seps].sort(), inner: [...inner].sort(), prefix: pre, before: side(text[a - 1]), after: side(text[e]),
          });
        }
      }
    }
    // attributes and elements outside paragraphs
    for (const el of all) {
      for (const at of Array.from(el.attributes || [])) if (surf.some((s) => (at.value || "").includes(s) || (at.value || "").replace(/_/g, " ").includes(s))) shapes.push({ part, attr: `${el.localName}@${at.localName}` });
      let inP = false; for (let a = el.parentNode; a && a.nodeType === 1; a = a.parentNode) if (a.localName === "p") { inP = true; break; }
      if (inP || el.localName === "p") continue;
      const own = Array.from(el.childNodes || []).filter((c) => c.nodeType === 3).map((c) => c.data).join("");
      if (own && surf.some((s) => own.includes(s))) shapes.push({ part, element: el.localName });
    }
  }
  return shapes;
}

const DIMS = ["part", "container", "runs", "formatting", "sep", "inner", "prefix", "before", "after", "attr", "element"];
function values(shapes) {
  const v = Object.fromEntries(DIMS.map((d) => [d, new Map()]));
  for (const s of shapes) for (const d of DIMS) {
    if (!(d in s)) continue;
    for (const x of Array.isArray(s[d]) ? (s[d].length ? s[d] : ["none"]) : [s[d] === "" ? "none" : s[d]]) v[d].set(x, (v[d].get(x) || 0) + 1);
  }
  return v;
}

function guard(obj) {
  const s = JSON.stringify(obj);
  const leak = s.match(/[א-ת]{3,}/g);
  if (leak) throw new Error("the shape report would carry text; refusing");
  return s;
}

// ── what our checks cover ──
function covered() {
  const { mkzip } = require("../tests/mkzip.js");
  const { SHAPES } = require("../tests/shape-lib.js");
  const L = require("../tests/structure-lib.js");
  const shapes = [];
  // the synthetic corpus
  const key = require("../bench/key.json");
  for (const d of key.docs) {
    const file = path.join(ROOT, "bench", d.file);
    if (!fs.existsSync(file)) continue;
    shapes.push(...harvest(unzip(fs.readFileSync(file)), d.entities.flatMap((e) => e.surfaces || [e.canonical])));
  }
  // every typographic shape, as a one-run document
  for (const f of Object.values(SHAPES)) {
    for (const v of [L.NAME, "אלונים"]) {
      const body = f(v).split("\n").map((line) => L.P(L.R(line.replace(/&/g, "&amp;").replace(/</g, "&lt;")))).join("");
      shapes.push(...harvest(unzip(Buffer.from(mkzip([...L.base, { name: "word/document.xml", body: L.doc(body) }]))), [v]));
    }
  }
  // every Word structure
  for (const c of Object.values(L.S)) {
    shapes.push(...harvest(unzip(Buffer.from(mkzip([...L.base, { name: "word/document.xml", body: L.doc(c.body) }, ...(c.parts || [])]))), [L.NAME, "רחל", "פרידמן"]));
  }
  return shapes;
}

function fixtures() {
  if (!fs.existsSync(PRIVATE)) return [];
  const rel = path.relative(ROOT, PRIVATE);
  if (!(rel.startsWith("..") || path.isAbsolute(rel))) throw new Error("the private folder must be outside the repository");
  return fs.readdirSync(PRIVATE).filter((k) => fs.existsSync(path.join(PRIVATE, k, "key.json")) && fs.existsSync(path.join(PRIVATE, k, "document.docx"))).map((k) => {
    const key = JSON.parse(fs.readFileSync(path.join(PRIVATE, k, "key.json"), "utf8"));
    // a trap is a value that must stay; its shape says nothing about a leak
    const ents = (key.docs || []).flatMap((d) => d.entities || []).filter((e) => e.kind !== "TRAP");
    return { key: k, shapes: harvest(unzip(fs.readFileSync(path.join(PRIVATE, k, "document.docx"))), ents.flatMap((e) => e.surfaces || [e.canonical])) };
  });
}

function main() {
  const docs = fixtures();
  if (!docs.length) { console.log("no private fixtures here; nothing to harvest"); return; }
  const cov = values(covered());
  const report = { generated: new Date().toISOString().slice(0, 10), docs: [], uncovered: {} };
  const seen = values(docs.flatMap((d) => d.shapes));
  for (const d of docs) report.docs.push({ key: d.key.replace(/[א-ת]/g, ""), occurrences: d.shapes.length, values: Object.fromEntries(Object.entries(values(d.shapes)).map(([k, m]) => [k, Object.fromEntries(m)])) });
  for (const dim of DIMS) {
    const miss = [...seen[dim].keys()].filter((x) => !cov[dim].has(x));
    if (miss.length) report.uncovered[dim] = Object.fromEntries(miss.map((x) => [x, seen[dim].get(x)]));
  }
  guard(report);
  fs.writeFileSync(path.join(PRIVATE, "shapes-report.json"), JSON.stringify(report, null, 1));
  console.log(`harvested ${docs.reduce((n, d) => n + d.shapes.length, 0)} occurrences in ${docs.length} private documents\n`);
  for (const dim of DIMS) {
    if (!seen[dim].size) continue;
    const row = [...seen[dim].entries()].sort((a, b) => b[1] - a[1]).map(([x, n]) => `${JSON.stringify(x)}×${n}${cov[dim].has(x) ? "" : " ✗"}`).join("  ");
    console.log(`${dim.padEnd(10)} ${row}`);
  }
  const n = Object.values(report.uncovered).reduce((s, m) => s + Object.keys(m).length, 0);
  console.log(n ? `\n${n} shape value(s) her documents have and our checks don't (✗). Report: ${path.join(PRIVATE, "shapes-report.json")}` : "\nevery shape in her documents is covered by our checks");
  if (n) process.exitCode = 1;
}

module.exports = { harvest, values, unzip, guard, DIMS };
if (require.main === module) main();
