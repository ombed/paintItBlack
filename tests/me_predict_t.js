/* The model-eval runner (bench/model-eval/predict.js), offline: a fake pipeline stands in
   for the model and returns hand-made token rows, so what is tested is the harness around
   it: chunk offsets, the adapter, the health counts, that a failing chunk never carries its
   text out, the cleaned stage, and that for a DictaBERT-shaped model the raw spans are the
   ones bench/lib.js modelSuggest groups (the live version of that check is parity.js). */
const E = require("../bench/engine.js");
const { makeBench } = require("../bench/lib.js");
const { predict, cleaned } = require("../bench/model-eval/predict.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const DICTA = { key: "fake", labelScheme: "BIO", tokenizer: "wordpiece",
  labelMap: { PER: "PER", ORG: "ORG", GPE: "PLACE", LOC: "PLACE", FAC: "PLACE", TIMEX: null } };

/* A pretend token classifier. lex: word -> label, or -> [[piece, label], ...] for a word the
   tokenizer splits. Words not listed are O. opt.boom: a word that makes the "model" throw
   with the chunk in the message, as ORT errors can. opt.drop: a word whose token comes back as
   [UNK], so it cannot be aligned. opt.strip: a word whose token comes back without its nikud, as
   the real tokenizer returns it (nerAlign places it since v56; before, it could not). opt.long:
   token count to report for any chunk containing that word. */
function fakePipe(lex, opt) {
  const o = opt || {};
  const calls = [];
  const split = (t) => t.match(/[֐-׿\w]+|[^\s]/gu) || [];
  const pipe = async (t, args) => {
    calls.push(args);
    if (o.boom && t.includes(o.boom)) throw new Error("ORT failed on input: " + t);
    const rows = [];
    let i = 1;
    for (const w of split(t)) {
      const v = lex[w];
      const parts = Array.isArray(v) ? v : [[w, v || "O"]];
      for (const [p, label] of parts) {
        const word = o.drop && w === o.drop ? "[UNK]" : o.strip && w === o.strip ? p.replace(/[֑-ׇ]/g, "") : p;
        rows.push({ entity: label, score: label === "O" ? 0.99 : (o.score || 0.95), index: i++, word });
      }
    }
    return rows;
  };
  pipe.tokenizer = { tokenize: (t) => (o.long && t.includes(o.long[0]) ? new Array(o.long[1]).fill("x") : split(t)) };
  pipe.calls = calls;
  return pipe;
}
const show = (text, spans) => spans.map((x) => text.slice(x.s, x.e) + "/" + x.type).join(" | ");

(async () => {
  console.log("\n— spans carry document offsets across chunks, and the pipeline sees ignore_labels: [] —");
  {
    const text = "דוד כהן הגיע לחיפה.\nאחר כך משה לוי יצא מבנק הפועלים.\nבסוף שוב דוד כהן.";
    const lex = { "דוד": "B-PER", "כהן": "I-PER", "לחיפה": "B-GPE", "משה": "B-PER", "לוי": "I-PER", "מבנק": "B-ORG", "הפועלים": "I-ORG" };
    const pipe = fakePipe(lex);
    const one = await predict(pipe, DICTA, text);
    const want = "דוד כהן/PER | לחיפה/PLACE | משה לוי/PER | מבנק הפועלים/ORG | דוד כהן/PER";
    ok(show(text, one.raw) === want, "default chunking: " + show(text, one.raw));
    ok(pipe.calls.every((a) => Array.isArray(a.ignore_labels) && a.ignore_labels.length === 0), "every call keeps the O tokens");
    const pipe40 = fakePipe(lex);
    const small = await predict(pipe40, DICTA, text, { chunk: 40 });
    ok(show(text, small.raw) === want, "chunk size 40 gives the same spans: " + show(text, small.raw));
    ok(pipe40.calls.length === E.nerChunks(text, 40).length && pipe40.calls.length > pipe.calls.length, "and really ran more chunks: " + pipe40.calls.length + " vs " + pipe.calls.length);
    ok(one.raw.every((r) => typeof r.score === "number" && r.score > 0), "each span keeps its score");
    ok(one.timing.words === 15 && typeof one.timing.scanMs === "number", "timing: words " + one.timing.words);
    const h = one.health;
    ok(h.unmappedLabels === 0 && h.chunksOver510 === 0 && h.chunkErrors === 0 && h.alignFailTokens === 0 && h.alignFailEntityTokens === 0, "clean health: " + JSON.stringify(h));
    ok(h.tokens > 0, "tokens counted: " + h.tokens);
  }

  console.log("\n— a failing chunk is counted, never echoed —");
  {
    const text = "דוד כהן הגיע.\nהסוד הגדול כאן.\nמשה לוי יצא.";
    const pipe = fakePipe({ "דוד": "B-PER", "כהן": "I-PER", "משה": "B-PER", "לוי": "I-PER" }, { boom: "הסוד" });
    const r = await predict(pipe, DICTA, text, { chunk: 15 });
    ok(r.health.chunkErrors === 1, "one chunk error: " + r.health.chunkErrors);
    ok(show(text, r.raw) === "דוד כהן/PER | משה לוי/PER", "the other chunks still ran: " + show(text, r.raw));
    ok(!JSON.stringify(r).includes("הסוד") && !JSON.stringify(r).includes("ORT"), "nothing of the error or its text is in the result");
  }

  console.log("\n— health: long chunks, unmapped labels, tokens that cannot be placed —");
  {
    const text = "דוד כהן פגש את רוֹנִית ביום שני.";
    const lex = { "דוד": "B-PER", "כהן": "I-PER", "רוֹנִית": "B-PER", "ביום": "B-TIMEX", "שני": "B-DATE" };
    const r = await predict(fakePipe(lex, { drop: "רוֹנִית", long: ["פגש", 600] }), DICTA, text,
      { gold: [{ s: text.indexOf("רוֹנִית"), e: text.indexOf("רוֹנִית") + 7 }] });
    ok(r.health.chunksOver510 === 1, "a chunk over 510 tokens is counted");
    ok(r.health.unmappedLabels === 1 && r.unmappedNames.join() === "DATE", "DATE has no mapping: counted; TIMEX is a declared drop: not");
    ok(r.health.alignFailTokens === 1, "the [UNK] token is an alignment failure: " + r.health.alignFailTokens);
    ok(r.health.alignFailEntityTokens === 1, "and it sits inside a gold mention");
    ok(r.health.entityTokens === 1, "the gold mention has one token, the failed one: entityTokens " + r.health.entityTokens);
    ok(show(text, r.raw) === "דוד כהן/PER", "the lost name is a harness loss, not a span: " + show(text, r.raw));
    const r2 = await predict(fakePipe(lex, { drop: "רוֹנִית" }), DICTA, text, { gold: [{ s: 0, e: 3 }] });
    ok(r2.health.alignFailTokens === 1 && r2.health.alignFailEntityTokens === 0, "a failure outside every gold mention is not an entity failure");
    ok(r2.health.entityTokens === 1, "a placed token inside a gold mention counts toward the share: " + r2.health.entityTokens);
    const r3 = await predict(fakePipe(lex), DICTA, text, { gold: [{ s: 0, e: 7 }] });
    ok(r3.health.entityTokens === 2 && r3.health.alignFailEntityTokens === 0, "two placed tokens in one mention: " + r3.health.entityTokens);
    // the tokenizer returns a name with nikud without it; since v56 nerAlign still finds it
    const r4 = await predict(fakePipe(lex, { strip: "רוֹנִית" }), DICTA, text, { gold: [{ s: text.indexOf("רוֹנִית"), e: text.indexOf("רוֹנִית") + 7 }] });
    ok(r4.health.alignFailTokens === 0 && show(text, r4.raw) === "דוד כהן/PER | רוֹנִית/PER", "a name with nikud is placed, nikud and all: " + show(text, r4.raw));
  }

  console.log("\n— the adapter runs in between: a BIOES model —");
  {
    const text = "דוד כהן ומשה";
    const spec = { labelScheme: "BIOES", tokenizer: "wordpiece", labelMap: { PER: "PER" } };
    const r = await predict(fakePipe({ "דוד": "B-PER", "כהן": "E-PER", "ומשה": "S-PER" }), spec, text);
    ok(show(text, r.raw) === "דוד כהן/PER | ומשה/PER", show(text, r.raw));
  }

  console.log("\n— raw spans are what bench/lib.js modelSuggest groups, types mapped —");
  {
    const B = makeBench(E);
    const blocks = [{ text: "העדה רונית אזולאי מירושלים העתיקה סיפרה." }, { text: "ביום ראשון פגשה את דסטה טספאיי במשרד עמותת שביל הלב." }];
    const text = blocks.map((b) => b.text).join("\n");
    const lex = { "רונית": "B-PER", "אזולאי": [["אזו", "I-PER"], ["##לאי", "O"]], "מירושלים": "B-GPE", "העתיקה": "I-LOC",
      "ביום": "B-TIMEX", "ראשון": "I-TIMEX", "דסטה": [["דס", "B-PER"], ["##טה", "O"]], "טספאיי": [["טס", "I-PER"], ["##פא", "O"], ["##יי", "O"]],
      "עמותת": "B-ORG", "שביל": "I-ORG", "הלב": "I-ORG", ".": "I-ORG" };
    const rawOut = [];
    await B.modelSuggest(fakePipe(lex), blocks, rawOut);
    const map = DICTA.labelMap;
    const want = rawOut.filter((x) => map[x.type]).map((x) => x.s + ":" + x.e + ":" + map[x.type]).join(" ");
    const r = await predict(fakePipe(lex), DICTA, text);
    const got = r.raw.map((x) => x.s + ":" + x.e + ":" + x.type).join(" ");
    ok(got === want, "same s/e/type\n    got  " + got + "\n    want " + want);
    ok(r.raw.length === 5, "five spans: " + show(text, r.raw));
  }

  console.log("\n— the same, on random DictaBERT-shaped outputs (dropped types, pieces, hyphens, nikud, lost tokens) —");
  {
    // seeded, so a failure is the same failure on every run
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const TYPES = ["PER", "ORG", "GPE", "LOC", "FAC", "TIMEX", "WOA"]; // WOA: not in DICTA's map
    const lbl = () => (rnd() < 0.35 ? "O" : pick(["B-", "I-"]) + pick(TYPES));
    const WORDS = ["דוד", "כהן", "בחיפה", "משה", "לוי", "בנק", "הפועלים", "תל", "אביב", "ביום", "שני"];
    const B = makeBench(E);
    let bad = 0, spansSeen = 0, first = "";
    for (let n = 0; n < 400; n++) {
      const rows = [];
      let text = "";
      for (let i = 0, k = 3 + Math.floor(rnd() * 8); i < k; i++) {
        const w = pick(WORDS), r = rnd();
        if (r < 0.15 && text) { text += "-"; rows.push(["-", lbl()]); }
        else if (r < 0.25 && text) { text += ", "; rows.push([",", lbl()]); }
        else if (text) text += " ";
        if (rnd() < 0.08) rows.push(["זזז", lbl()]); // a token nerAlign cannot place
        const nik = rnd() < 0.15; // a mark inside the word: the second piece lands one further on
        text += nik ? w.slice(0, 2) + "ִ" + w.slice(2) : w;
        if (nik || rnd() < 0.4) { rows.push([w.slice(0, 2), lbl()]); rows.push(["##" + w.slice(2), lbl()]); }
        else rows.push([w, lbl()]);
      }
      const mk = () => async () => rows.map(([word, entity], i) => ({ word, entity, score: 0.5 + i / 100, index: i + 1 }));
      const out = [];
      await B.modelSuggest(mk(), [{ text }], out);
      const map = DICTA.labelMap;
      const want = out.filter((x) => map[x.type]).map((x) => x.s + ":" + x.e + ":" + map[x.type] + ":" + x.score).join(" ");
      const got = (await predict(mk(), DICTA, text)).raw.map((x) => x.s + ":" + x.e + ":" + x.type + ":" + x.score).join(" ");
      spansSeen += out.length;
      if (got !== want && !bad++) first = JSON.stringify(rows) + "\n    got  " + got + "\n    want " + want;
    }
    ok(bad === 0, bad + " of 400 differ; first:\n    " + first);
    ok(spansSeen > 400, "and the cases really had spans: " + spansSeen);
  }

  console.log("\n— cleaned: nerClean's names, found wherever they occur as whole words —");
  {
    const text = "העדה רונית אזולאי הגיעה. אחר כך רוֹנִית אזולאי יצאה, ורונית אזולאית לא.";
    const raw = [{ s: 5, e: 17, type: "PER", score: 0.97 }];
    const c = cleaned(text, raw);
    ok(c.length === 2, "both occurrences, the one with nikud too: " + show(text, c));
    ok(c.every((x) => x.type === "PER" && x.score === 0.97), "NAME comes back as PER, with the score");
    ok(text.slice(c[1].s, c[1].e) === "רוֹנִית אזולאי", "offsets are into the original text: " + text.slice(c[1].s, c[1].e));
    ok(cleaned(text, [{ s: 5, e: 17, type: "PER", score: 0.5 }]).length === 0, "below the product's 0.6: nothing");
    ok(cleaned(text, [{ s: 5, e: 17, type: "PER", score: 0.5 }], { min: 0 }).length === 2, "a cut-off of 0 really is 0");
    // nerClean peels the prefix letter, and the product replaces the value with and without one
    // (E.variants): "בחיפה" is a hit, and its span is the name without the ב, as the gold keys it
    const t2 = "הם גרו בחיפה שנים. חיפה יפה בחורף.";
    const s = t2.indexOf("בחיפה");
    const p = cleaned(t2, [{ s, e: s + 5, type: "PLACE", score: 0.9 }]);
    ok(p.length === 2 && p.every((x) => t2.slice(x.s, x.e) === "חיפה" && x.type === "PLACE"), "PLACE comes back PLACE, found bare and after a prefix letter: " + show(t2, p));
    ok(p[0].s === s + 1, "the prefix letter is not part of the span");
  }

  console.log("\n— the loader: registry entries are checked, a wrong sha256 stops the load —");
  {
    const fs = require("fs"), os = require("os"), path = require("path");
    // a throwaway model cache, so the hub-row checks below never touch the real one
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), "me-cache-"));
    process.env.PIB_MODEL_CACHE = cache;
    const L = require("../bench/model-eval/load.js");
    ok(L.MODEL_CACHE === cache, "the loader uses the test's cache folder");
    const mine = L.readRegistry().filter((r) => r.registryFile === "registry.json");
    let bad = 0;
    for (const r of mine) { try { L.validate(r); } catch (_) { bad++; } }
    ok(mine.length === 4 && bad === 0, "the four hub rows validate: " + mine.length + " rows, " + bad + " bad");
    ok(L.getSpec("base-q8").sha256 === "fd7ac841768f11197e1d46ea6bbfe82d9cd9e21289be8761af63dbc996a32007", "base-q8 is the file the product pins");
    const wrongFile = { ...L.getSpec("base-q8"), file: "onnx/model.onnx" };
    let msg = "";
    try { L.validate(wrongFile); } catch (e) { msg = e.message; }
    ok(/dtype q8 loads onnx\/model_quantized\.onnx/.test(msg), "a file that is not the dtype's file is refused before any download");
    // a local "export" whose bytes are not the registry's: refused before transformers.js opens it
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "me-load-"));
    fs.mkdirSync(path.join(dir, "onnx"));
    fs.writeFileSync(path.join(dir, "onnx", "model_quantized.onnx"), "not a model");
    const spec = { key: "fake-export", source: "local", localPath: dir, dtype: "q8", file: "onnx/model_quantized.onnx",
      sha256: "0".repeat(64), labelScheme: "BIO", labelMap: { PER: "PER" }, tokenizer: "wordpiece" };
    msg = "";
    try { await L.loadModel(spec); } catch (e) { msg = e.message; }
    ok(/^sha256 mismatch for fake-export/.test(msg), "sha256 mismatch refuses: " + msg.slice(0, 40));
    ok(L.sha256File(path.join(dir, "onnx", "model_quantized.onnx")) === require("crypto").createHash("sha256").update("not a model").digest("hex"), "the hash is of the file on disk");
    fs.rmSync(dir, { recursive: true, force: true });

    // a hub row whose cached file was swapped: refused before transformers.js is asked for it
    const sha = (s) => require("crypto").createHash("sha256").update(s).digest("hex");
    const hub = { key: "fake-hub", source: "hub", repo: "nobody/fake-ner", revision: "a".repeat(40), dtype: "q8",
      file: "onnx/model_quantized.onnx", sha256: sha("the real bytes"), labelScheme: "BIO", labelMap: { PER: "PER" }, tokenizer: "wordpiece" };
    const hf = L.modelFile(hub);
    ok(hf === path.join(cache, "hf", "fake-hub", "nobody", "fake-ner", "a".repeat(40), "onnx", "model_quantized.onnx"), "each row has its own pinned cache path");
    fs.mkdirSync(path.dirname(hf), { recursive: true });
    fs.writeFileSync(hf, "tampered bytes");
    msg = "";
    try { await L.loadModel(hub, { offline: true }); } catch (e) { msg = e.message; }
    ok(/^sha256 mismatch for fake-hub/.test(msg), "a swapped hub file is refused: " + msg.slice(0, 40));
    // the right bytes but the wrong size in the registry: also refused
    fs.writeFileSync(hf, "the real bytes");
    msg = "";
    try { await L.loadModel({ ...hub, bytes: 3 }, { offline: true }); } catch (e) { msg = e.message; }
    ok(/^size mismatch for fake-hub/.test(msg), "a size that differs from the registry is refused: " + msg.slice(0, 40));
    // offline and not cached: refused, and nothing appears in the cache
    const gone = { ...hub, key: "fake-gone" };
    msg = "";
    try { await L.loadModel(gone, { offline: true }); } catch (e) { msg = e.message || "error"; }
    ok(msg !== "" && !fs.existsSync(L.modelFile(gone)), "offline, an uncached model is refused");
    for (const bad of [{ revision: "main" }, { sha256: "abc" }, { source: "web" }, { labelMap: { PER: "NAME" } }, { dtype: "q3" }]) {
      let threw = false;
      try { L.validate({ ...hub, ...bad }); } catch (_) { threw = true; }
      ok(threw, "validate refuses " + JSON.stringify(bad));
    }
    // two registry files that both define one key: an error, not a silent pick
    const rd = fs.mkdtempSync(path.join(os.tmpdir(), "me-reg-"));
    fs.writeFileSync(path.join(rd, "registry.json"), JSON.stringify([hub]));
    fs.writeFileSync(path.join(rd, "registry.exports.json"), JSON.stringify([{ ...hub, source: "local" }]));
    let dup = false;
    try { L.readRegistry(rd); } catch (e) { dup = /appears twice/.test(e.message); }
    ok(dup, "a key in both registry files is refused");
    fs.rmSync(rd, { recursive: true, force: true });
    fs.rmSync(cache, { recursive: true, force: true });
  }

  console.log("\n— run.js arguments: a typo never falls back to a default, private output stays private —");
  {
    const path = require("path");
    const R = require("../bench/model-eval/run.js");
    const bad = (argv) => { try { R.parseArgs(argv); return ""; } catch (e) { return e.usage ? "usage" : "other"; } };
    ok(bad(["--otu", "x"]) === "usage", "an unknown option is refused");
    ok(bad(["--out"]) === "usage" && bad(["--out", "--private"]) === "usage", "an option without its value is refused");
    const a = R.parseArgs(["--model=base-q8", "--set", "g.json", "--private", "--chunk", "400"]);
    ok(a.model === "base-q8" && a.set === "g.json" && a.chunk === "400" && a.flags.has("private"), "both --x v and --x=v forms");
    ok(R.inside(path.join(R.PRIVATE_OUT, "pred"), R.PRIVATE_OUT) && !R.inside(path.join(R.PRIVATE_OUT, "..", "results"), R.PRIVATE_OUT) &&
      !R.inside(R.PRIVATE_OUT + "-x", R.PRIVATE_OUT), "inside(): a sibling folder with the same prefix is outside");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
