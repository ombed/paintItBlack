/* The synthetic gold key and the known cases (docs/model-eval/PLAN.md 4.1, 4.5).

   Every score in the model evaluation is counted against these offsets, so a
   position one letter off would move every model's numbers at once. Checked on
   small invented inputs first, then on the committed corpus and the committed
   known cases: offsets land on the surface, a prefix letter is outside the span
   and recorded, traps are negatives and shield the names inside them, and the
   tune/test split is fixed at 24/19. Offline: no model, no private data. */
const fs = require("fs");
const path = require("path");
const G = require("../bench/model-eval/gold-synth.js");
const KC = require("../bench/model-eval/known-cases.js");
const E = require("../bench/engine.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const NIK = /[֑-ׇ]/g;
const at = (text, m) => text.slice(m.s, m.e);
const ent = (kind, cat, must, canonical, surfaces) => ({ kind, cat, must, canonical, surfaces });

(async () => {
  console.log("\n— locate: offsets, prefixes, whole words —");
  {
    const text = "נפגשתי עם דנה כהן ועם בעלה. לדנה יש שני ילדים. כהנא אינו כהן. וכהן חתם.";
    const r = G.locate(text, [ent("NAME", "P_FORMS", true, "דנה כהן", ["דנה כהן", "דנה", "כהן"])], "d1");
    const got = r.mentions.map((m) => at(text, m));
    ok(JSON.stringify(got) === JSON.stringify(["דנה כהן", "דנה", "כהן", "כהן"]), "every occurrence, longest first, whole words: " + got.join(" | "));
    const pre = r.mentions.filter((m) => m.prefix);
    ok(pre.length === 2 && pre.every((m) => m.prefix === text.slice(m.s - m.prefix.length, m.s)), "a prefix is outside the span and recorded as written");
    ok(pre.some((m) => m.prefix === "ל") && pre.some((m) => m.prefix === "ו"), "ל and ו recorded: " + pre.map((m) => m.prefix).join(","));
    ok(!got.includes("כהנא") && r.mentions.every((m) => !/[א-ת]/.test(text[m.e] || "")), "no match inside a longer word (כהנא)");
    ok(r.mentions.every((m) => m.type === "PER" && m.must && m.ent === "d1#0" && m.cat === "P_FORMS"), "type, must, cat and ent carried");
    ok(r.unlocated.length === 0, "nothing unlocated");
  }
  {
    // two prefix letters, a hyphen/space variant, a name that starts with a prefix letter
    const text = "ולמיכל לוי-אבקסיס אין טענות. מיכל לוי אבקסיס חתמה. מרווה הגיעה, ולמרווה יש אח.";
    const r = G.locate(text, [ent("NAME", "P_HYPHEN", true, "מיכל לוי-אבקסיס", ["מיכל לוי-אבקסיס"]), ent("NAME", "P_ARABIC", true, "מרווה", ["מרווה"])], "d2");
    const got = r.mentions.map((m) => at(text, m) + (m.prefix ? "<" + m.prefix : ""));
    ok(JSON.stringify(got) === JSON.stringify(["מיכל לוי-אבקסיס<ול", "מיכל לוי אבקסיס", "מרווה", "מרווה<ול"]), "two-letter prefix, hyphen or space, a name starting with מ: " + got.join(" | "));
  }
  {
    // nikud on one occurrence: matched, and the span keeps the marks
    const text = "מִיקָה בת חמש. מיקה הולכת לגן, ולְמִיקָה יש אח.";
    const r = G.locate(text, [ent("NAME", "P_NIKUD", true, "מיקה", ["מיקה"])], "d3");
    ok(r.mentions.length === 3, "three occurrences with and without nikud: " + r.mentions.length);
    ok(r.mentions.every((m) => at(text, m).replace(NIK, "") === "מיקה"), "each span is the name with its own marks");
    ok(r.mentions[0].e === "מִיקָה".length, "the last letter's nikud is inside the span");
    ok(r.mentions[2].prefix && r.mentions[2].prefix.replace(NIK, "") === "ול", "a prefix with nikud is recorded");
  }

  console.log("\n— traps, public bodies, PII, titles —");
  {
    const text = "בחיים לא ראיתי דבר כזה, אמר חיים סבג לעו\"ד רינה גל. משרד הרווחה קיבל את ת\"ז 123456782. פלוני סירב.";
    const ents = [
      ent("NAME", "P_WORD", true, "חיים סבג", ["חיים סבג", "חיים"]),
      ent("NAME", "P_TITLE", true, "רינה גל", ["עו\"ד רינה גל"]),
      ent("TRAP", "T_IDIOM", false, "בחיים לא ראיתי", ["בחיים לא ראיתי"]),
      ent("TRAP", "T_PLONI", false, "פלוני", ["פלוני"]),
      ent("ORG", "O_PUBLIC", false, "משרד הרווחה", ["משרד הרווחה"]),
      ent("PII", "I_ID", true, "123456782", ["123456782"]),
    ];
    const r = G.locate(text, ents, "d4");
    const by = (t) => r.mentions.filter((m) => at(text, m) === t);
    ok(by("בחיים לא ראיתי").length === 1 && !by("בחיים לא ראיתי")[0].must, "a trap is a negative");
    ok(!r.mentions.some((m) => m.must && m.s < "בחיים לא ראיתי".length), "the name inside the trap's text is not a mention");
    ok(by("חיים סבג").length === 1 && by("חיים סבג")[0].must, "the real name after it is");
    ok(by("רינה גל").length === 1 && !by("רינה גל")[0].prefix, "the title is left out of the span; the ל before the title is not the name's prefix");
    ok(by("משרד הרווחה").length === 1 && !by("משרד הרווחה")[0].must && by("משרד הרווחה")[0].type === "ORG", "a public body is an ORG negative");
    ok(by("פלוני").length === 1 && !by("פלוני")[0].must, "פלוני is a negative");
    ok(!r.mentions.some((m) => /[0-9]/.test(at(text, m))), "PII is not NER gold");
    ok(r.mentions.every((m) => ["PER", "ORG", "PLACE"].includes(m.type)), "types are PER, ORG or PLACE only");
  }
  {
    ok(G.bareSurface("התובע:  נופר", "NAME", "נופר") === "נופר", "a role word and colon are left out");
    ok(G.bareSurface("אור אמרה", "NAME", "אור") === "אור", "a speech verb keyed as context is left out");
    ok(G.bareSurface("טיטו ווארקו", "NAME", "טיטו וורקו") === "טיטו ווארקו", "a corrupted spelling is kept whole");
    ok(G.bareSurface("בית ספר ניצני הגליל", "ORG", "בית ספר ניצני הגליל") === "בית ספר ניצני הגליל", "an org keeps its head word");
  }
  {
    // a first name alone, where the key lists only the full name, is still the person
    const text = "ויקטור סמירנוב הגיע. ויקטור ביקש להרחיב. לא נמצא: שמעון בר.";
    const r = G.locate(text, [ent("NAME", "P_SPLITRUN", true, "ויקטור סמירנוב", ["ויקטור סמירנוב"]), ent("NAME", "P_FORMS", true, "יוסף זך", ["יוסף זך"])], "d5");
    ok(r.mentions.length === 2 && r.mentions[1].derived && at(text, r.mentions[1]) === "ויקטור", "a derived name part is marked derived");
    ok(r.unlocated.length === 1 && r.unlocated[0].reason === "not found" && r.unlocated[0].surface === "יוסף זך", "a surface not in the text is reported, not guessed");
  }

  console.log("\n— adversarial: quotes, unmapped kinds, overlapping claims —");
  {
    // one prefix letter before a quote opens a quotation (the engine's NW rule): the name is there
    const text = 'היא כתבה ל"דנה" מכתב, ו"דנה" ענתה. קמ"דנה אינו שם. דנה שמחה.';
    const r = G.locate(text, [ent("NAME", "P_X", true, "דנה", ["דנה"])], "q1");
    ok(r.mentions.length === 3 && r.mentions.every((m) => at(text, m) === "דנה"), "a quoted name after a prefix letter is found: " + r.mentions.length + " of 3");
    ok(!r.mentions.some((m) => text.slice(m.s - 3, m.s) === 'קמ"'), "two letters before the quote are an acronym, not a quotation");
  }
  {
    const threw = (ents) => { try { G.locate("חיפה ופלוני.", ents, "q2"); return false; } catch (e) { return /no NER type/.test(e.message); } };
    ok(threw([ent("GPE", "L_X", true, "חיפה", ["חיפה"])]), "an entity kind with no NER type stops the build instead of vanishing");
    ok(threw([ent("TRAP", "T_NEW", false, "פלוני", ["פלוני"])]), "a trap category with no type stops the build instead of turning into PER");
  }
  {
    // a trap that overlaps a name without containing it costs a real occurrence: reported
    const text = "עם שחר גולן הגיע. שחר גולן חתם.";
    const r = G.locate(text, [ent("NAME", "P_WORD", true, "שחר גולן", ["שחר גולן"]), ent("TRAP", "T_IDIOM", false, "עם שחר", ["עם שחר"])], "q3");
    ok(r.partly.length === 1 && r.partly[0].s === 3 && r.partly[0].surface === "שחר גולן", "an occurrence lost to a partly overlapping trap is reported: " + r.partly.length);
    ok(r.mentions.filter((m) => m.must && at(text, m) === "שחר גולן").length === 1, "the other occurrence is still a mention");
  }

  console.log("\n— the split —");
  {
    const K = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bench", "key.json"), "utf8"));
    const a = G.split(K.docs), b = G.split(K.docs.slice().reverse());
    ok(a.tune.length === 24 && a.test.length === 19, `24 tune / 19 test: ${a.tune.length}/${a.test.length}`);
    ok(JSON.stringify(a.tune.slice().sort()) === JSON.stringify(b.tune.slice().sort()), "the split does not depend on the key's order");
    ok(a.tune.includes("m1") && a.test.includes("m2") && a.tune.includes("m3") && a.test.includes("m4"), "1st and 3rd of a genre to tune, 2nd and 4th to test");
    const g = G.split([{ id: "q10", genre: "x" }, { id: "q2", genre: "x" }, { id: "q1", genre: "x" }]);
    ok(JSON.stringify(g.tune.sort()) === JSON.stringify(["q1", "q10"]), "ids sort as numbers (q2 before q10): " + g.tune.join(","));
  }
  {
    const docs = [{ id: "z1", mentions: [{ must: true, ent: "z1#0" }, { must: true, ent: "z1#1" }, { must: false, ent: "z1#2" }] }];
    const ents = { "z1#0": { cat: "P_WORD", canonical: "א ב" }, "z1#1": { cat: "P_WORD", canonical: "ג ד" }, "z1#2": { cat: "O_PUBLIC", canonical: "ה" } };
    const rows = [{ doc: "z1", cat: "P_WORD", canonical: "א ב", found: false }, { doc: "z1", cat: "P_WORD", canonical: "ג ד", found: true }, { doc: "z1", cat: "O_PUBLIC", canonical: "ה", found: null }];
    const n = G.tagOffMissed(docs, rows, (id) => ents[id]);
    ok(n === 1 && docs[0].mentions[0].offMissed && !docs[0].mentions[1].offMissed && !docs[0].mentions[2].offMissed, "offMissed tags only the model-off pipeline's misses");
    // found by the model-off pipeline and still leaked: the model can add something there too
    const d2 = [{ id: "z2", mentions: [{ must: true, ent: "z2#0" }] }];
    const n2 = G.tagOffMissed(d2, [{ doc: "z2", cat: "P_FORMS", canonical: "ו ז", found: true, leaked: true }], () => ({ cat: "P_FORMS", canonical: "ו ז" }));
    ok(n2 === 1 && d2[0].mentions[0].offMissed, "a found but leaked entity is tagged offMissed too");
  }

  console.log("\n— the corpus gold, built from bench/key.json —");
  {
    const res = await G.build();
    const K = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bench", "key.json"), "utf8"));
    ok(res.tune.docs.length === 24 && res.test.docs.length === 19 && res.all.docs.length === 43, "24 / 19 / 43 docs");
    ok(res.tune.name === "synthetic-tune" && res.test.split === "test" && res.all.source === "bench/key.json", "set names and fields as in FORMATS.md");
    let bad = 0, overl = 0, badPfx = 0;
    const flat = (s) => s.replace(NIK, "").replace(/[\s-]+/g, " ");
    for (const d of res.all.docs) {
      const kd = K.docs.find((x) => x.id === d.id);
      ok(d.text === await G.docText(kd.file), "text is readBlocks joined with newlines: " + d.id);
      const ms = d.mentions;
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i];
        if (i && ms[i - 1].e > m.s) overl++;
        if (m.prefix && d.text.slice(m.s - m.prefix.length, m.s) !== m.prefix) badPfx++;
        if (m.gap) continue;
        const e = kd.entities[+m.ent.split("#")[1]];
        const cands = e.surfaces.map((s) => flat(G.bareSurface(s, e.kind, e.canonical))).concat(flat(e.canonical).split(" "));
        if (!cands.includes(flat(at(d.text, m)))) { bad++; if (bad < 4) console.log("    " + d.id + " " + at(d.text, m)); }
      }
    }
    ok(bad === 0, "every mention's text is one of its entity's surfaces: " + bad + " off");
    ok(overl === 0, "no two mentions overlap");
    ok(badPfx === 0, "every recorded prefix sits right before its mention");
    ok(res.report.unlocated.every((u) => u.reason !== "not found"), "every keyed surface located, apart from comments and file properties");
    ok(res.report.lostEntities.length === 0, "every entity has a mention");
    const neg = res.all.docs.flatMap((d) => d.mentions.filter((m) => !m.must));
    ok(neg.length > 0 && neg.every((m) => /^T_|^O_PUBLIC$|^O_ROLEWORD$|^L_PUBLIC$/.test(m.cat)), "negatives are traps and public bodies only");
    const allCats = new Set(res.all.docs.flatMap((d) => d.mentions.map((m) => m.cat)));
    ok(![...allCats].some((c) => /^I_/.test(c)), "no PII category in the gold");
    ok(res.all.docs.some((d) => d.mentions.some((m) => m.offMissed)), "some mentions are tagged offMissed");
    ok(res.all.docs.find((d) => d.id === "f1").mentions.some((m) => m.gap && at(res.all.docs.find((d) => d.id === "f1").text, m) === "ירושלים"), "the known f1 gap is added");
    ok(res.report.partlyClaimed.length === 0, "no keyed occurrence is lost to a partly overlapping claim: " + res.report.partlyClaimed.length);

    /* Independent of gold-synth's own regex: the product's matcher (E.NW, a prefix,
       E.flex, E.NWE) run over every keyed surface. Each of its occurrences must be
       covered by the gold, and each keyed gold mention must be one of its
       occurrences of the same entity, same start, same end give or take the last
       letter's nikud (which the gold keeps inside the span). */
    const PFX = "(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ|וש|שה|של|שב|שכ|שמ|בה)";
    let engOnly = 0, goldOnly = 0, engN = 0;
    for (const d of res.all.docs) {
      const kd = K.docs.find((x) => x.id === d.id);
      const nt = E.norm(d.text);
      const eng = [];
      kd.entities.forEach((e, i) => {
        if (e.kind === "PII") return;
        for (const raw of e.surfaces) {
          const rx = new RegExp(E.NW + "(" + PFX + ")?" + E.flex(G.bareSurface(raw, e.kind, e.canonical)) + E.NWE, "gu");
          for (const m of nt.matchAll(rx)) eng.push({ s: m.index + (m[1] || "").length, e: m.index + m[0].length, ent: d.id + "#" + i });
        }
      });
      engN += eng.length;
      for (const x of eng) if (!d.mentions.some((m) => m.s < x.e && m.e > x.s)) engOnly++;
      for (const m of d.mentions) {
        if (m.derived || m.gap) continue;
        if (!eng.some((x) => x.ent === m.ent && x.s === m.s && x.e <= m.e && !nt.slice(x.e, m.e).replace(/\u0000/g, ""))) goldOnly++;
      }
    }
    ok(engN > 500 && engOnly === 0, `every occurrence the product's matcher finds is in the gold: ${engOnly} of ${engN} missing`);
    ok(goldOnly === 0, "every keyed gold mention is an occurrence the product's matcher finds, same entity and edges: " + goldOnly + " off");
    const again = await G.build();
    ok(JSON.stringify(again.all) === JSON.stringify(res.all) && JSON.stringify(again.tune) === JSON.stringify(res.tune), "two builds give the same gold, byte for byte");
  }

  console.log("\n— the known cases —");
  {
    const K = KC.load();
    const ids = new Set();
    let bad = 0, pfx = 0, core = 0;
    for (const c of K.cases) {
      ok(!ids.has(c.id), "unique id " + c.id); ids.add(c.id);
      ok(K.passRules[c.pass], c.id + ": pass rule is defined: " + c.pass);
      ok(c.what && c.text && c.mentions.length, c.id + ": what, text and mentions");
      for (const m of c.mentions) {
        if (at(c.text, m) !== m.surface) bad++;
        if (!["PER", "ORG", "PLACE"].includes(m.type) || typeof m.must !== "boolean") bad++;
        if (m.prefix && c.text.slice(m.s - m.prefix.length, m.s) !== m.prefix) pfx++;
        if (/[א-ת]/.test(c.text[m.s - 1] || "") && !m.prefix) pfx++;
        if (/[א-תA-Za-z]/.test(c.text[m.e] || "")) bad++;
        if (m.core && !(m.core.s >= m.s && m.core.e <= m.e && m.core.e > m.core.s)) core++;
      }
      if (c.pass === "no-span") ok(c.mentions.every((m) => !m.must), c.id + ": a no-span case has negatives only");
      if (c.pass === "covers-core") ok(c.mentions.filter((m) => m.must).every((m) => m.core), c.id + ": covers-core mentions carry a core");
    }
    ok(bad === 0, "every mention's offsets land on its surface, at word ends: " + bad + " off");
    ok(pfx === 0, "a letter glued before a mention is always a recorded prefix");
    ok(core === 0, "every core lies inside its mention");
    const leak = K.cases.filter((c) => c.group === "leak-16.9");
    ok(leak.length === 20, "20 variants of the 16.9 shape: " + leak.length);
    ok(leak.every((c) => { const w = new Set(c.mentions.map((m) => m.surface)); const [n] = w; return w.size === 1 && n.length === 4 && !/\s/.test(n) && c.mentions.length >= 5; }),
      "each is one four-letter word, five times or more");
    ok(new Set(leak.map((c) => c.mentions[0].surface)).size === 20, "twenty different names");
    for (const g of ["false-positive", "script", "control", "leak"]) ok(K.cases.some((c) => c.group === g), "group present: " + g);
    ok(K.cases.filter((c) => c.control).map((c) => c.id).sort().join() === "r4-town-variants,r5-two-letter-prefix", "r4 and r5 are the controls");
    // the Word files hand the model exactly the case text
    for (const c of K.cases.slice(0, 40)) {
      const back = (await E.readBlocks(KC.docxOf(c.text))).map((b) => b.text).join("\n");
      ok(back === c.text, c.id + ": the .docx reads back as the case text");
    }
    const gs = KC.goldSet(K);
    ok(gs.docs.length === K.cases.length && gs.docs.every((d) => d.mentions.every((m) => m.cat && m.ent)), "the gold-set form carries cat and ent on every mention");
    // FORMATS.md: all mentions of one entity share an ent ("קרמי" is the same person as "יהונתן קרמי")
    ok(gs.docs.every((d) => new Set(d.mentions.filter((m) => m.must).map((m) => m.ent)).size <= 1), "a case's must mentions share one ent");
    ok(gs.docs.every((d) => d.mentions.filter((m) => !m.must).every((m) => !d.mentions.some((x) => x.must && x.ent === m.ent))), "a negative never shares an ent with the name");
    /* A name occurrence left out of the key would score a correct model as wrong:
       every whole-word occurrence of a must surface, and of each of its words,
       with or without a prefix, is inside some mention (the product's matcher). */
    let unkeyed = 0;
    for (const c of K.cases) {
      const nt = E.norm(c.text), forms = new Set();
      for (const m of c.mentions) if (m.must) {
        const s = m.surface.replace(NIK, ""); forms.add(s);
        if (c.pass !== "covers-core") for (const w of s.split(/\s+/)) if (w.length >= 2) forms.add(w);
      }
      for (const f of forms) for (const m of nt.matchAll(new RegExp(E.NW + "((?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?-?)" + E.flex(f) + E.NWE, "gu"))) {
        const s = m.index + m[1].length, e = m.index + m[0].length;
        if (!c.mentions.some((x) => x.s < e && x.e > s)) { unkeyed++; console.log("    unkeyed in " + c.id + " at " + s); }
      }
    }
    ok(unkeyed === 0, "every occurrence of a known case's name is keyed: " + unkeyed + " left out");
    // a case the key forgot must fail the check above: prove the check can fail
    {
      const c = { text: "רונה הגיעה. רונה הלכה.", mentions: [{ s: 0, e: 4, surface: "רונה", must: true }] };
      const nt = E.norm(c.text);
      const miss = [...nt.matchAll(new RegExp(E.NW + "()" + E.flex("רונה") + E.NWE, "gu"))].filter((m) => !c.mentions.some((x) => x.s < m.index + 4 && x.e > m.index)).length;
      ok(miss === 1, "the unkeyed-occurrence check catches a forgotten occurrence");
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
