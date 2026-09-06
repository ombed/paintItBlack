/* Turns a leak report into a reproduction:  node bench/from-leak.js report.json

   The report carries shapes, not text (see page-logic.js leakShape). For
   each shape this builds a synthetic paragraph with a made-up name of the
   same word count and letter lengths, the same prefix letter, and context
   words of the same classes before and after; then runs the deterministic
   chain on it and says whether the name is surfaced. A shape that
   reproduces here is a benchmark category waiting to be added to
   corpus-more.js; one that does not needs the model, so run with --model. */
const fs = require("fs");
const E = require("./engine.js");
const { makeBench, loadModel } = require("./lib.js");
const { mkzip } = require("../tests/mkzip.js");

const file = process.argv[2];
if (!file) { console.error("usage: node bench/from-leak.js <report.json> [--model]"); process.exit(2); }
const report = JSON.parse(fs.readFileSync(file, "utf8"));
const WITH_MODEL = process.argv.includes("--model");

// letters that are not in the tool's lexicons make a name of a given length
const LETTERS = "בגדזחטכלמנסעפצקרשת";
let seed = 7;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
function madeUpWord(len) {
  for (let tries = 0; tries < 50; tries++) {
    let w = ""; for (let i = 0; i < len; i++) w += LETTERS[Math.floor(rnd() * LETTERS.length)];
    w = w.replace(/[כמנפצ]$/, (c) => ({ "כ": "ך", "מ": "ם", "נ": "ן", "פ": "ף", "צ": "ץ" }[c]));
    if (!E.KNOWN_FIRST.has(w) && !E.COMMON.has(w) && !E.STOP.has(w)) return w;
  }
  return "קסטבר".slice(0, len);
}
const CONTEXT = {
  title: ["עו\"ד", "ד\"ר", "גב'", "מר", "הקטינה", "התובעת", "הנתבע"],
  verb: ["אמר", "ציין", "מסר", "טען", "ביקש", "הגיע"],
  prep: ["של", "עם", "אצל", "בעניין", "ליד"],
  kin: ["אמא של", "אחיה", "בעלה", "השכן"],
  common: ["הילד", "המשפחה", "הבית", "המסמך"],
  definite: ["הדיון", "הלשכה", "הפגישה"],
  prefixed: ["במשרד", "לבית", "מהעיר"],
  number: ["12", "2026", "3"],
  none: [""], other: ["לפגישה", "מאתמול"], "known-first-name": ["דנה", "יוסי"], latin: ["Zoom"],
};
const pick = (cls) => { const L = CONTEXT[cls] || CONTEXT.other; return L[Math.floor(rnd() * L.length)]; };

function docFor(shape, k) {
  const name = shape.lens.map(madeUpWord).join(shape.hyphen ? "-" : " ");
  const surface = (shape.prefix || "") + name;
  const before = pick(shape.before), after = pick(shape.after);
  const gapB = shape.gapBefore ? shape.gapBefore + " " : " ", gapA = shape.gapAfter ? shape.gapAfter + " " : " ";
  const line = `${before}${before ? gapB : ""}${surface}${gapA}${after} בהמשך היום.`.replace(/\s+/g, " ").trim();
  console.log(`   (made-up name «${name}», shown only here; the report never carried one)`);
  const paras = shape.doc && shape.doc.genre === "transcript"
    ? ["תמלול דיון", "השופטת: אנחנו בדיון.", line, "השופטת: תודה."]
    : ["סיכום", "נפגשנו היום לדיון בעניין המשפחה.", line, "סיכמנו פגישה נוספת בעוד חודש."];
  // extra bare or prefixed occurrences, as the shape counted them
  for (let i = 1; i < (shape.occurrences || 1); i++) paras.push(`${surface} הוזכר שוב בהמשך.`);
  for (let i = 0; i < (shape.otherForms || 0); i++) paras.push(`הדבר נמסר ל${name} בכתב.`);
  const body = paras.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`).join("");
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const buf = mkzip([
    { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>' },
    { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="x" Target="word/document.xml"/></Relationships>' },
    { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ' + W + "><w:body>" + body + "</w:body></w:document>" },
  ]);
  return { id: "leak" + (k + 1), genre: shape.doc ? shape.doc.genre : "prose", name, surface, paras, buf };
}

(async () => {
  const pipe = WITH_MODEL ? await loadModel() : null;
  const B = makeBench(E);
  for (const [k, shape] of (report.shapes || []).entries()) {
    const d = docFor(shape, k);
    fs.writeFileSync(`bench/corpus/.${d.id}.docx`, Buffer.from(d.buf));
    const doc = { id: d.id, genre: d.genre, file: `corpus/.${d.id}.docx`, entities: [{ cat: "LEAK", kind: shape.kind || "NAME", must: true, canonical: d.name, surfaces: [d.surface, d.name] }] };
    const res = await B.runDoc(pipe, doc);
    const sc = B.scoreDoc(doc, res);
    const row = sc.rows[0];
    console.log(`${d.id}: ${shape.words} word(s) ${shape.lens.join("+")}${shape.prefix ? " prefix " + shape.prefix : ""}, before=${shape.before} after=${shape.after} → ${row.found ? "found via " + row.via.join("+") : "NOT FOUND"}${row.leaked ? ", leaked" : ""}`);
    console.log("   " + d.paras.join(" | "));
    fs.unlinkSync(`bench/corpus/.${d.id}.docx`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
