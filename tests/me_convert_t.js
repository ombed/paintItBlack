/* The public-set converter (bench/model-eval/convert-public.js, PLAN.md 4.3).

   NEMO, BMC and Knesset UD come as tokens; the models read text. Every score on them
   rests on this conversion putting each mention at the right characters, so each case
   pins the exact text and offsets. All words here are invented; no public data is read. */
const C = require("../bench/model-eval/convert-public.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const spans = (d) => d.mentions.map((m) => [m.s, m.e, m.type]);
const row = (id, form, misc = "_") => [id, form, "_", "_", "_", "_", "_", "_", "_", misc].join("\t");

console.log("\n— tokens to text, one rule for every set —");
eq(C.detok(["דני", "אמר", ",", "(", "שלום", ")", "."]).text, "דני אמר, (שלום).", "commas, brackets and the full stop hug their word");
eq(C.detok(["הוא", "קרא", '"', "ספר", "טוב", '"', "אתמול", '"', "כן", '"']).text, 'הוא קרא "ספר טוב" אתמול "כן"', "straight quotes alternate open and close");
eq(C.detok(["ב", "-", "1990", "גר", "בתל", "-", "אביב", "–", "סוף"]).text, "ב-1990 גר בתל-אביב – סוף", "a hyphen between words is glued, an en dash is spaced");
eq(C.detok(["אמר", "-", ",", "לא"]).text, "אמר -, לא", "a hyphen next to punctuation stays spaced");
eq(C.detok(["ב-", "2000", "ו", "ארה\"ב", "ג'ורג'"]).text, "ב-2000 ו ארה\"ב ג'ורג'", "a prefix ending in a hyphen joins the next word; geresh and gershayim stay inside");
eq(C.detok(["זה", "נגמר", "..."]).text, "זה נגמר...", "an ellipsis hugs the word before");
{
  const d = C.detok(["גלעד", ",", "ב", "-", "1990"]);
  eq([d.starts, d.ends], [[0, 4, 6, 7, 8], [4, 5, 7, 8, 12]], "each token's offsets are where it sits in the text");
}

console.log("\n— BIOES decoding —");
eq(C.decodeBioes(["B-PER", "I-PER", "E-PER", "O", "S-GPE"]), [{ i: 0, j: 3, type: "PER" }, { i: 4, j: 5, type: "GPE" }], "B-I-E and S");
{
  const st = {};
  eq(C.decodeBioes(["I-PER", "E-PER", "O", "B-ORG", "O", "E-LOC"], st),
    [{ i: 0, j: 2, type: "PER" }, { i: 3, j: 4, type: "ORG" }, { i: 5, j: 6, type: "LOC" }], "a broken sequence still yields its mentions");
  eq(st.repaired, 3, "and every repair is counted");
}
eq(C.decodeBioes(["B-ORG", "M-ORG", "E-ORG"]), [{ i: 0, j: 3, type: "ORG" }], "M counts as I (BMES)");
eq(["PER", "PERS", "ORG", "GPE", "LOC", "FAC", "TTL", "DATE", "WOA"].map(C.mapType),
  ["PER", "PER", "ORG", "PLACE", "PLACE", "PLACE", null, null, null], "the type map");

console.log("\n— a BMES file to gold docs —");
const bmes = [
  "גלעד B-PER", "כהנוביץ E-PER", "ביקר O", "ב O", "- O", "מגדלור S-GPE", "של O", "חברת B-ORG", "זוהרון E-ORG",
  "ב O", "- O", "2020 S-DATE", ". O", "",
  '" O', "רינה S-PERS", '" O', "אמרה O", ". O",
].join("\r\n");
{
  const r = C.convertBmes(bmes, { prefix: "t" });
  eq(r.docs.length, 1, "two sentences make one block of up to 20");
  const d = r.docs[0];
  eq(d.id, "t001", "block ids are numbered");
  eq(d.text, "גלעד כהנוביץ ביקר ב-מגדלור של חברת זוהרון ב-2020.\n\"רינה\" אמרה.", "the text, sentences joined with a newline");
  eq(spans(d), [[0, 12, "PER"], [20, 26, "PLACE"], [30, 41, "ORG"], [51, 55, "PER"]], "the mentions, with DATE dropped");
  eq(d.mentions.map((m) => d.text.slice(m.s, m.e)), ["גלעד כהנוביץ", "מגדלור", "חברת זוהרון", "רינה"], "and they cover exactly the names");
  eq(d.mentions.map((m) => m.orig), ["PER", "GPE", "ORG", "PERS"], "the source type is kept as orig");
  eq(r.stats.orig, { PER: 1, GPE: 1, ORG: 1, DATE: 1, PERS: 1 }, "source types are counted, dropped ones too");
  const r1 = C.convertBmes(bmes, { prefix: "t", block: 1 });
  eq(r1.docs.map((x) => x.id), ["t001", "t002"], "block size 1 gives one doc per sentence");
  eq(spans(r1.docs[1]), [[1, 5, "PER"]], "and offsets restart in each doc");
}

console.log("\n— a CoNLL-U file to gold docs —");
const conllu = [
  "# newdoc id = d1", "# sent_id = s1", '# text = היו"ר גלעד כהנוביץ ביקר בזוהרון-ים.',
  row(1, 'היו"ר', "Entity=(TTL)"), row(2, "גלעד", "Entity=(PER"), row(3, "כהנוביץ", "Entity=PER)"), row(4, "ביקר"),
  row("5-6", "בזוהרון", "SpaceAfter=No"), row(5, "ב"), row(6, "זוהרון", "Entity=(GPE"),
  row(7, "-", "SpaceAfter=No"), row(8, "ים", "Entity=GPE)|SpaceAfter=No"), row(9, "."), "",
  "# newdoc id = d2", "# sent_id = s2", "# text = שלום לכם.", row(1, "שלום"), row(2, "לכם", "SpaceAfter=No"), row(3, "."), "",
  "# sent_id = s3", "# text = תודה רבה לחברת זוהרון.", row(1, "תודה"), row(2, "רבה"),
  row("3-4", "לחברת"), row(3, "ל"), row(4, "חברת", "Entity=(ORG"), row(5, "זוהרון", "Entity=ORG)|SpaceAfter=No"), row(6, "."), "",
].join("\n");
{
  const s = C.readConllu(conllu);
  eq(s[0].tokens, ['היו"ר', "גלעד", "כהנוביץ", "ביקר", "בזוהרון", "-", "ים", "."], "surface tokens: the multiword form, not its parts");
  eq(s[0].spans, [{ i: 0, j: 1, type: "TTL" }, { i: 1, j: 3, type: "PER" }, { i: 4, j: 7, type: "GPE" }], "brackets on words become token spans");
  eq(s.map((x) => x.newdoc), ["d1", "d2", "d2"], "each sentence knows its newdoc");

  const r = C.convertConllu(conllu);
  eq(r.docs.map((d) => d.id), ["d1", "d2"], "docs are the newdoc units");
  eq(r.rebuilt, 3, "the rule rebuilds each '# text' exactly");
  const [d1, d2] = r.docs;
  eq(d1.text, 'היו"ר גלעד כהנוביץ ביקר בזוהרון-ים.', "the first doc's text");
  eq(spans(d1), [[6, 18, "PER"], [24, 34, "PLACE"]], "TTL dropped; the place widened to its whole token, prefix letter included");
  eq(d2.text, "שלום לכם.\nתודה רבה לחברת זוהרון.", "the second doc's text");
  eq(spans(d2), [[19, 31, "ORG"]], "an ORG starting inside a multiword token");
  eq(d2.text.slice(19, 31), "לחברת זוהרון", "covers the whole surface words");

  const dr = C.convertConllu(conllu, { seen: new Set([C.normText("שָׁלוֹם  לָכֶם.")]) });
  eq([dr.dropped, dr.total], [1, 3], "a sentence also in IAHLT is dropped, matched without nikud or extra spaces");
  eq(dr.docs[1].text, "תודה רבה לחברת זוהרון.", "the rest of its doc stays");
  eq(spans(dr.docs[1]), [[9, 21, "ORG"]], "with offsets from the new start");
  const hay = C.normText('משהו לפני היו"ר גלעד כהנוביץ ביקר בזוהרון-ים. ואחרי');
  const dh = C.convertConllu(conllu, { hay });
  eq([dh.dropped, dh.docs.map((d) => d.id)], [1, ["d2"]], "a 5-word sentence inside a longer sample is dropped, and an emptied doc goes");
  eq(C.convertConllu(conllu, { hay: "שלום לכם. ועוד" }).dropped, 0, "a short sentence inside a sample is kept (too common to mean overlap)");
}

console.log("\n— nesting, duplicates and the self-check —");
{
  const st = { orig: {}, duplicates: 0, nested: 0 };
  const d = C.makeDoc("x", "news", [{ tokens: ["בנק", "ישראל", "בירושלים"],
    spans: [{ i: 0, j: 2, type: "ORG" }, { i: 1, j: 2, type: "GPE" }, { i: 0, j: 2, type: "ORG" }, { i: 2, j: 3, type: "GPE" }] }], st);
  eq(spans(d), [[0, 9, "ORG"], [10, 18, "PLACE"]], "an inner mention goes, the outer one stays");
  eq([st.nested, st.duplicates], [1, 1], "and both are counted");
  let threw = false;
  try { C.selfCheck([{ id: "x", text: "אב גד", mentions: [{ s: 1, e: 3, type: "PER" }] }]); } catch (e) { threw = true; }
  ok(threw, "a mention that starts or ends on a space is refused");
  ok(/gershayim/.test(C.DETOK_RULE) && /\\n/.test(C.DETOK_RULE), "the rule is written down for the gold files");
}

console.log("\n— adversarial: offsets, refusals, guards —");
const throws = (f, re, m) => { let e = null; try { f(); } catch (x) { e = x; } ok(e && re.test(e.message), m + (e ? "" : " (did not throw)")); };
{
  // Offsets are UTF-16 code units: an emoji before a name moves it by two.
  const r = C.convertBmes(["😀 O", "רינה S-PER", ". O"].join("\n"));
  eq([r.docs[0].text, spans(r.docs[0])], ["😀 רינה.", [[3, 7, "PER"]]], "a surrogate pair counts as two code units");
  // A mention that includes its quotes, and one right after a glued hyphen.
  const q = C.convertBmes(['" B-ORG', "זוהרון I-ORG", '" E-ORG', "ב O", "- O", "מגדלור S-LOC"].join("\n"));
  eq(spans(q.docs[0]), [[0, 8, "ORG"], [11, 17, "PLACE"]], "a quoted ORG keeps its quotes; a place after ב- starts after the hyphen");
  eq(q.docs[0].text.slice(11, 17), "מגדלור", "and the hyphen is not inside it");
  // A mention on the first token of the second sentence of a block.
  const two = C.convertBmes(["אב O", "", "רינה S-PER"].join("\n"));
  eq([two.docs[0].text, spans(two.docs[0])], ["אב\nרינה", [[3, 7, "PER"]]], "the second sentence's offsets count the newline");
}
throws(() => C.mapType("PERSON"), /unmapped source type/, "an unknown type is refused, not silently dropped");
throws(() => C.convertBmes("רינה S-per"), /unmapped source type/, "and so is a lowercase one in a file");
throws(() => C.decodeBioes(["X-PER"]), /unknown label/, "an unknown prefix is refused");
{
  const st = {};
  eq(C.decodeBioes(["B-PER", "O", "E-PER"], st), [{ i: 0, j: 1, type: "PER" }, { i: 2, j: 3, type: "PER" }], "an O inside B..E splits it");
  eq(st.repaired, 2, "and both breaks are counted");
}
{
  // A mention ending on a word whose multiword token carries a suffix: widened to the whole token.
  const cu = ["# newdoc id = a", "# sent_id = 1", "# text = ראיתי את זוהרוני.", row(1, "ראיתי"), row(2, "את"),
    row("3-4", "זוהרוני", "SpaceAfter=No"), row(3, "זוהרון", "Entity=(PER)"), row(4, "שלי"), row(5, "."), "",
    "# sent_id = 2", "# text = בית זוהרון הגדול", row(1, "בית", "Entity=(ORG"), row(2, "זוהרון", "Entity=(GPE)"), row(3, "הגדול", "Entity=ORG)"), "",
    "# sent_id = 3", "# text = רק (סוגר", row(1, "רק", "Entity=PER)"), row(2, "סוגר", "Entity=(ORG"), ""].join("\n");
  const st = {};
  const s = C.readConllu(cu, st);
  eq(s[0].spans, [{ i: 2, j: 3, type: "PER" }], "a suffix pronoun in the token is inside the widened mention");
  eq(st.unmatchedBrackets, 2, "a close with no open and an open with no close are both counted");
  const r = C.convertConllu(cu);
  eq(spans(r.docs[0]), [[9, 16, "PER"], [18, 34, "ORG"]], "nested GPE inside ORG: the outer ORG stays");
  eq(r.stats.nested, 1, "and the nested one is counted");
  const again = ["# newdoc id = a", "# sent_id = 1", row(1, "אב"), "", "# newdoc id = b", "# sent_id = 2", row(1, "גד"), "",
    "# newdoc id = a", "# sent_id = 3", row(1, "דה"), ""].join("\n");
  throws(() => C.convertConllu(again), /newdoc id repeats/, "a newdoc id that returns after another doc is refused");
  // Knesset UD's shape: sentences before the first newdoc line, and a marker that sits
  // one sentence late. The sent_id prefix decides, and two files never share a doc.
  const late = ["# sent_id = a-1", row(1, "אב"), "", "# newdoc id = a", "# sent_id = a-2", row(1, "גד"), "",
    "# sent_id = b-1", row(1, "דה"), "", "# newdoc id = b", "# sent_id = b-2", row(1, "וז"), ""].join("\n");
  const other = ["# sent_id = c-1", row(1, "חט"), "", "# newdoc id = c", "# sent_id = c-2", row(1, "יכ"), ""].join("\n");
  const rl = C.convertConllu([late, other]);
  eq(rl.docs.map((d) => [d.id, d.text]), [["a", "אב\nגד"], ["b", "דה\nוז"], ["c", "חט\nיכ"]], "docs follow the sent_id prefix, not a misplaced newdoc line");
  eq([rl.docsBefore, rl.newdocDisagrees], [3, 1], "and the disagreeing sentences are counted");
}
throws(() => C.selfCheck([{ id: "x", text: "אבג דהו", mentions: [{ s: 0, e: 7, type: "ORG" }, { s: 4, e: 7, type: "PER" }] }]),
  /overlapping/, "overlapping mentions are refused");
{
  const buf = Buffer.from("אב O\n", "utf8");
  const sha = require("crypto").createHash("sha256").update(buf).digest("hex");
  let threw = false;
  try { C.checkSha("f.bmes", buf, { "f.bmes": sha }); } catch (e) { threw = true; }
  ok(!threw, "a raw file with its pinned sha256 is accepted");
  throws(() => C.checkSha("f.bmes", Buffer.from("אב B-PER\n", "utf8"), { "f.bmes": sha }), /sha256 mismatch/, "a changed raw file is refused");
  throws(() => C.checkSha("g.bmes", buf, { "f.bmes": sha }), /no pinned sha256/, "an unpinned raw file is refused");
  ok(Object.values(C.PINS).length === 5 && Object.values(C.PINS).every((h) => /^[0-9a-f]{64}$/.test(h)), "every raw file the converter reads is pinned");
}
{
  const path = require("path");
  const repo = path.resolve("/x/paintItBlack/repo-clone");
  throws(() => C.checkOutside(path.join(repo, "bench/model-eval/out/gold"), repo), /inside the repo/, "an output folder inside the repo is refused");
  throws(() => C.checkOutside(repo, repo), /inside the repo/, "and so is the repo itself");
  let threw = false;
  try { C.checkOutside(path.resolve("/x/paintItBlack/public-bench/gold"), repo); C.checkOutside(path.resolve("/x/paintItBlack/repo-clone2/gold"), repo); } catch (e) { threw = true; }
  ok(!threw, "a sibling folder is fine, even one whose name starts like the repo's");
  throws(() => C.checkOutside(path.resolve(__dirname, "..", "gold")), /inside the repo/, "the real repo is found from the converter's own place");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
