# Measurements

Decisions that were settled with data, recorded so nobody re-runs them.

## Model size and quantization, 2026-09-05

**Question.** Are the Hebrew NER model's misses a quantization problem (H1) or a capacity problem (H3)? The shipped model is `onnx-community/dictabert-ner-ONNX` at `dtype:"q8"`.

**Method.** `ner exp/ner_experiment.py` over three documents: the real Knesset transcript (`tests/protocol.txt`, 46 people), and two synthetic ones, a meeting summary and a court filing, with injected transcription typos. Same documents, same ground truth, three variants. Runs used native onnxruntime and PyTorch on CPU, not WebAssembly, so the speed column is comparable between rows and not to the browser.

| variant | PER recall | false positives | typo robustness | size | sec/1k words |
|---|---|---|---|---|---|
| base-q8 (ships) | 66/71 | 5 | 3/13 | 185 MB | 0.8 |
| base-fp32 | 66/71 | 7 | 3/13 | 735 MB | 4.1 |
| large-fp32 | 65/71 | 1 | 3/13 | 1736 MB | 12.5 |

**H1, rejected.** Quantization costs nothing. q8 and fp32 find the identical 66 of 71 people; q8 has fewer false positives and runs five times faster. There is no dtype change worth making.

**H3, rejected.** Large finds one fewer person than base and takes fifteen times longer than what ships. It does cut false positives from 5 to 1, but a false suggestion costs one tap and a missed name is the failure the tool exists to prevent, so recall is the measure that matters and large loses on it. The ONNX export was never done.

## Why the 3/13 typo number is misleading

All three variants score 3 of 13 on injected typos, and they miss the same ones: `אזולאי→אזולי`, `סבטלנה→סבתלנה`, `מזרחי→מיזרחי`. That looked like a structural weakness no model would fix, and it briefly pointed at H2, orthographic normalisation.

It measured the wrong layer. The harness scores the model alone: does it tag the corrupted token? In this product the model never has that job. Typos are handled by the near-miss scanner, which asks whether a token is edit-distance 1 from a name already confirmed, through a plausible Hebrew confusion. Run against that scanner, all three fail cases are caught: a dropped alef, ט↔ת, an inserted yod, which is exactly what it was built for.

So 3/13 is not a finding about model capacity. It is a finding that the harness measured the model in isolation while the product is a pipeline. H2 as specified, collapsing וו→ו and יי→י, would not have caught two of the three anyway; the confusions are phonetic, not spelling-fullness. H2 was dropped.

**Rule for future measurements.** Score the whole chain: model suggests → names confirmed → engine replaces → near-miss scan → verification. The benchmark under `bench/` does this. A number for the model alone is only meaningful as an input to that chain, never as a verdict on the product.

## The one hole that remains

A name that appears in the document only in its corrupted form, never cleanly. There is nothing to compare against, so neither the model nor the scanner catches it. This is unmeasured as of this writing; the benchmark includes a category for it.

## Parameter sweep, 2026-09-06

**Question.** Several numbers in the detection layer were set by feel: the model confidence floor (0.7), which letter pairs count as confusable and which insertions as matres lectionis in the near-miss scan, the shortest name fragment replaced alone, the prefix-peeling lengths. Which of them move leaks?

**Method.** `bench/sweep.js`: every parameter at several values, the whole 30-document corpus at each point, model on, product options. The engine is patched textually per point (`bench/engine.js` `load`), never edited. Full surface in `bench/sweep.md`.

| parameter | shipped | finding | decision |
|---|---|---|---|
| verb layer with the model | off | on: 4 fewer leaks, 4 fewer misses, +5 junk, no measurable time cost | **on** |
| confidence floor | 0.7 | 0.6 one leak fewer, 0.3–0.5 same as 0.6, 0.8 same as 0.7, 0.9 doubles leaks | **0.6** |
| shortest fragment swept alone | 3 | 2 same as 3; 4 adds six leaks | **2** (two-letter parts are review-only through the word-like rule) |
| fragment word-like length | 2 | 3 adds one leak | keep |
| prefix-letter forms | normal | safe: +4 leaks; off: +12 | keep |
| near-miss: target length, short-target rule, matres lectionis set, every confusable pair (leave-one-out) | various | flat: no value moves leaks, misses, fp or junk | keep; **the corpus does not exercise them** |
| single-word rule review length, peel length, discover stem length, whole-value rescan length | various | flat | keep |

**Reading.** Two of the guessed values were wrong by a little (0.7 → 0.6, 3 → 2) and the rest were either right or unmeasurable here. The near-miss parameters are unmeasurable because the corpus has three typo categories and they are all found by other layers first. To validate the confusable-pair table the corpus needs transcripts with dense transcription errors, or the real protocol (`tests/protocol.txt`) keyed; that is the next measurement to build.

## Span boundaries, 2026-09-06

**Question.** Five of twelve leaks on the first corpus came from the model's span quality. Where do the spans go wrong: punctuation, chunk edges, titles, verbs?

**Method.** `bench/spans.js`: every occurrence of every keyed person, org and place surface (329 after de-duplication) compared with the raw model spans after alignment and grouping, before cleaning. Full tables in `bench/spans.md`.

**Finding.** None of the four hypotheses. Across punctuation: 1 occurrence. At a chunk edge: 1. Before a speech verb: 0. After a title: benign, the title is correctly excluded. The dominant failure, 94 of 329, was the span ending inside a word: the model labels only the first sub-word of each word and returns the continuation sub-words (`##אן`, `##טה`) as O, and the grouper treated O as a break. "דסטה טספאיי" arrived as "דס" and "טס"; the word-boundary extension in the cleaner repaired each fragment to one word, so multi-word names reached the list as two separate single words.

**Fix and measure.** The grouper now keeps a continuation sub-word with the current entity regardless of its label. Cut-inside-a-word occurrences: 94 → 20; exact spans: 159 → 228; values surviving cleaning: 92 → 134. Leaks did not move on that change alone, because they came from other classes, so a second approach was added alongside rather than instead: hyphens inside a name stay in the span, a trailing preposition is cut from a place, and the street name alone is swept after an address is replaced. Together: leaks 16 → 5 on the 30-document corpus, then 4 with the floor from the sweep.

**What remains.** 37 mis-bounded spans carry a prefix letter the cleaner could not peel (the stem appears nowhere else and is unknown), and 26 misses are a prefixed single mention. That is the next span lever, and it is a lexicon question, not a boundary one.

## The surname length question, 2026-09-06

**Question.** "ליפשיץ" was replaced alone and "סבג" was not. Is there a length threshold, and is it right?

**Finding.** There was: the uniformity sweep marked any part of three letters or fewer as word-like (`p.length<=3`), which limits it to standalone occurrences with review, so "וסבג" and "לסבג" stayed in the text. Commit 507a0c5 (PR #5) lowered that to two. The threshold that remained is the sweep's entry rule, which drops parts shorter than a minimum outright: it was 3, so a two-letter surname ("כץ", "נץ") was never swept at all. A probe confirmed it: "סבג" and "דהן" alone and behind every prefix letter are replaced today; "כץ" leaked five times. The sweep put the minimum at 2 at no cost, and two-letter parts stay review-only through the word-like rule. So the number was 3, it was wrong for two-letter surnames, and it is now 2.

## A real filing, 2026-09-06

**Question.** The corpus is synthetic. What does the chain do on a real document?

**Method.** A client's position paper (`כתב עמדה מטעם האפוטרופא לדין`, 1,031 words), already de-identified by the client, run through the product chain locally with the model on. The file was not committed and is not quoted here; the shapes are.

**Finding.** No ID numbers, phones or digit runs remained. The two parties, introduced by role and colon, were found. But discover produced 23 candidates, of which 21 were not names, and 5 of those were high confidence and would have been auto-filled and replaced:

| anchor | what it matched | why |
|---|---|---|
| "right before ת"ז" (high) | three sentence fragments ending mid-word | a word ending in ת followed by a word starting with ז read as the label "ת ז"; the name pattern had no end boundary |
| speaker turn (high) | two form labels ("מועד אחרון לתגובה:") | two words made a single occurrence high |
| after a title, after "הח"מ", after "בפני" (medium) | twelve verbs and phrases | in a filing the parties are role words and "the undersigned" is the lawyer speaking; a name almost never follows |
| model | "כאמור גדעון", "משה אפטרופא", "אפוטרופא" | discourse word glued to the name; role word taken as a name |

**Fix and measure.** The ID anchor requires a whole label and a word-boundary end. A speaker is high only when it recurs. Every anchor rejects candidates containing a verb, a common word, a role word, a form label or a two-letter pronoun; bare "הח"מ" is no longer an anchor. The cleaner strips a leading discourse word and role words in any spelling. Three position papers with these traps joined the corpus (categories T_FORMLABEL, T_TZSPLIT, T_UNDERSIGNED, O_ROLEWORD, P_ROLE_COLON, P_AFTER_LEAD). On the document: candidates 23 → 2, replacements 95 → 28, no fragment replaced. On the corpus: junk suggestions 42 → 23, leaks unchanged at 4, the new position papers 13 found, 0 missed, 0 leaked.

**What remains on the document.** Two towns named in passing (the client left them), a verb the model reads as a first name because the same letters are a common name ("שמשה" as ש+משה), and the ambiguous town word "אזור", flagged for review as designed. All three are one tap each.
