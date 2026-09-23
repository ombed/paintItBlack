# Model evaluation: results as they come in

The plan and the decision rule are in [PLAN.md](PLAN.md); the file shapes are in [FORMATS.md](FORMATS.md).
Her documents appear here as counts only. Her entity ids stay in `private-bench/model-eval/`.

## Phase 1: harness

### Parity (run order 1): passes

`base-q8` through the model-eval loader (pinned revision, own cache, sha256 checked) and through
today's bench loader, the whole chain (`bench/lib.js` `runAll`, unchanged):

| Set | Loader | Scored | Found | Missed | Leaked | FP | Junk | Entities that differ |
|---|---|---|---|---|---|---|---|---|
| Synthetic (43 docs) | model-eval | 268 | 262 | 6 | 7 | 4 | 31 | 0 against the committed `bench/results.json` |
| Synthetic | today's | 268 | 262 | 6 | 7 | 4 | 31 | 0 against model-eval |
| Her 5 docs | model-eval | 33 | 32 | 1 | 3 | 3 | 79 | 0 against the committed baseline |
| Her 5 docs | today's | 33 | 32 | 1 | 3 | 3 | 79 | 0 against model-eval |

The plan's 81 junk for her documents predates the r5 name replacement. The committed baseline file
still lists the two suggestions that were that name. Both loaders now give 79, and they give the same
suggestions.

The harness's own predict path matches `modelSuggest` on 43 of 43 synthetic documents (`parity.js`).

### Noise band (run order 2)

Entities whose outcome flips between baseline runs that should agree. The rule does not blame a
candidate for these (PLAN.md section 1).

| Pair | Synthetic: entities (worse / better) | Hers: entities (worse / better) |
|---|---|---|
| q8, run twice (two loaders) | 0 (0 / 0) | 0 (0 / 0) |
| q8 against uint8 | 5 (6 flips worse / 1 better) | 2 (1 / 1) |

- **Node against Node is exact.** ONNX Runtime on the CPU gives the same result every run, so
  "run twice" adds nothing.
- **The whole band comes from uint8.** It is a different quantisation of the same weights.
- **uint8's totals:**
  - synthetic 268 / 260 / 8 / 9 / 5 / 30;
  - hers 33 / 32 / 1 / 2 / 4 / 86.
- The synthetic entities are listed in `bench/model-eval/noise-band.json` (invented names). Hers are
  in `private-bench/model-eval/noise-band.json`.
- Node against the browser is measured for the finalists only (PLAN.md, browser check).

To rerun:

```
node bench/model-eval/product.js --model=base-q8 --tag=a --against=baseline
node bench/model-eval/product.js --model=base-q8 --loader=today --tag=today --against=a
node bench/model-eval/product.js --model=base-uint8 --tag=a --against=base-q8:a
node bench/model-eval/noise.js base-q8:a base-q8:today base-uint8:a
```

## Tokenizer parity (PLAN.md 3.1): fails for every DictaBERT-family tokenizer, today's included

`tok-parity.js` compares transformers.js token ids with Python's `AutoTokenizer` on 50 fixed
invented sentences (`gold/tok-sentences.json`). transformers.js is read four ways: with the engine's
RegExp wrapper (the harness), after the page's `fixTokJSON` (the browser), as published, and
"faithful" (below).

| Tokenizer | Wrapper | Browser (`fixTokJSON`) | As published | Faithful |
|---|---|---|---|---|
| base-q8 (today's), base-uint8 | 6/50 | 6/50 | does not load | 50/50 |
| tiny-parse, iahlt-base, msperka-dicta, joint-base, parse-base | 6/50 | 6/50 | does not load | 50/50 |
| large-q8 | 5/50 | 5/50 | does not load | 50/50 |
| aleph, golem | 50/50 | 50/50 | 50/50 | 50/50 |

**The cause.**
- DictaBERT's pre-tokenizer ends in `\w+|\p{P}|[^\w\s]+`.
- In the Rust tokenizers library the models were trained with, `\w` covers Hebrew letters. In a
  JavaScript RegExp it covers ASCII only, even with the `u` flag.
- So in the product a Hebrew word falls through to `[^\w\s]+`, which also takes any punctuation
  after the word.
- The page's repair (`rxClean`) only fixes an escape that does not compile. It is not the cause.

**The effect on the text.**
- "שלישי." is one piece, so the full stop reaches the model as `##.`, a token it rarely saw in
  training.
- A hyphenated surname or a maqaf compound ("מלכה-אזולאי", "בן־יהודה") is one piece, so its second
  half reaches the model as continuation pieces.
- A leading bracket or quote is split off correctly either way.

**The fix.** `tokfix.js` writes `\w` and `\W` out as the Unicode classes (`\p{L}\p{M}\p{Nd}\p{Pc}`).
- It matches Python on 50 of 50 sentences for all ten tokenizers.
- It compiles without the wrapper.
- `load.js` takes `{ tok: "faithful" }`, and `product.js` takes `--tok=faithful`.

**The same model with the faithful tokenizer** (`base-q8`, whole chain):

| Set | Tokenizer | Scored | Found | Missed | Leaked | FP | Junk |
|---|---|---|---|---|---|---|---|
| Synthetic | product (today's) | 268 | 262 | 6 | 7 | 4 | 31 |
| Synthetic | faithful | 268 | 264 | 4 | 5 | 4 | 33 |
| Her 5 docs | product (today's) | 33 | 32 | 1 | 3 | 3 | 79 |
| Her 5 docs | faithful | 33 | 33 | 0 | 1 | 4 | 91 |

**Entity by entity against today's run.**
- **Synthetic: 4 entities better (7 changes: found, no longer leaking), 3 worse.**
  - Two of the worse are in the noise band.
  - The third, c3's "ברהאנה וורקנה", now leaks. The model still finds the full name, but no longer
    flags the surname standing alone after a full stop.
  - This is a model-level trade, not a bug in the rewrite. Under the rule's strict reading it
    blocks.
- **Hers: 2 entities better (3 changes), 1 worse.**
  - The worse is one more false positive, on an entity inside her noise band.
  - The better include the r3 bank name (O_FAKE_BANK), found and no longer leaking. That is the
    one leak of hers the plan said only a better model could close.

**What this means for the evaluation.**
- Every DictaBERT-family candidate has been read through the same wrong split, today's model
  included. So each is run both ways, product and faithful.
- "base-q8 with the faithful tokenizer" is a candidate in its own right: no download, same size,
  a change to the engine only.
- Shipping any of this is the owner's call at checkpoint 3.

## Smoke run (run order 3, checkpoint 1)

`smoke.js`: every deployable tier-1 model (q8) and, for the DictaBERT family, the same model with
the faithful tokenizer (`-ft`). Each runs on t1 and f1 (35 mentions), `protocol.txt` (133 mentions)
and the 33 known cases (plus 2 controls).
- **P / R / F2:** cleaned stage (the product's `nerClean` at 0.6), overlap-untyped.
- **Word-exact:** the raw spans at a 0.5 cut-off, where the span edge counts.
- **Known cases:** judged by their written pass rules on the cleaned stage.

These sets are small. The table shows each model loads, runs clean and is in a plausible range. It
decides nothing.

| Model | t1+f1 cleaned P / R / F2 | protocol cleaned P / R / F2 | protocol raw word-exact F2 @0.5 | Known cases | Health | ms per 1k words |
|---|---|---|---|---|---|---|
| base-q8 | 0.947 / 0.514 / 0.566 | 0.855 / 0.707 / 0.732 | 0.770 | 26/33 | ok, 22 entity tokens unplaced | 428 |
| base-q8-ft | 0.950 / 0.543 / 0.594 | 0.843 / 0.729 / 0.750 | 0.829 | 27/33 | ok, 22 entity tokens unplaced | 475 |
| hebert | not on disk | | | | | |
| tiny-parse | 0.909 / 0.571 / 0.617 | 0.678 / 0.759 / 0.742 | 0.758 | 28/33 | ok, 22 entity tokens unplaced | 80 |
| tiny-parse-ft | 0.905 / 0.543 / 0.590 | 0.549 / 0.759 / 0.705 | 0.796 | 28/33 | ok, 22 entity tokens unplaced | 85 |
| iahlt-base | 0.950 / 0.543 / 0.594 | 1.000 / 0.624 / 0.675 | 0.797 | 28/33 | ok, 22 entity tokens unplaced | 473 |
| iahlt-base-ft | 0.900 / 0.514 / 0.563 | 0.957 / 0.662 / 0.705 | 0.795 | 28/33 | ok, 22 entity tokens unplaced | 467 |
| msperka-dicta | 0.944 / 0.486 / 0.538 | 0.943 / 0.752 / 0.784 | 0.907 | 29/33 | ok, 22 entity tokens unplaced | 437 |
| msperka-dicta-ft | 0.944 / 0.486 / 0.538 | 0.960 / 0.714 / 0.753 | 0.931 | 29/33 | ok, 22 entity tokens unplaced | 471 |
| aleph | 0.950 / 0.543 / 0.594 | 0.895 / 0.767 / 0.789 | 0.838 | 28/33 | ok, 29 entity tokens unplaced | 487 |
| joint-base | 0.947 / 0.514 / 0.566 | 0.874 / 0.729 / 0.754 | 0.831 | 29/33 | ok, 22 entity tokens unplaced | 515 |
| joint-base-ft | 0.950 / 0.543 / 0.594 | 0.990 / 0.744 / 0.783 | 0.883 | 29/33 | ok, 22 entity tokens unplaced | 506 |
| parse-base | 0.947 / 0.514 / 0.566 | 0.876 / 0.744 / 0.767 | 0.895 | 29/33 | ok, 22 entity tokens unplaced | 506 |
| parse-base-ft | 0.952 / 0.571 / 0.621 | 0.888 / 0.714 / 0.743 | 0.889 | 29/33 | ok, 22 entity tokens unplaced | 531 |
| golem | 1.000 / 0.514 / 0.570 | 0.945 / 0.519 / 0.570 | 0.379 | 21/33 | ok | 845 |
| large-q8 | 0.952 / 0.571 / 0.621 | 0.748 / 0.692 / 0.702 | 0.776 | 26/33 | ok, 22 entity tokens unplaced | 1607 |
| large-q8-ft | 1.000 / 0.571 / 0.625 | 0.764 / 0.707 / 0.718 | 0.799 | 28/33 | ok, 22 entity tokens unplaced | 1761 |

- **Health:** every row passes, with no unmapped label, no chunk error and no chunk over 510 tokens.
  The unplaced entity tokens are the nikud and Latin-capital known cases, which the product cannot
  align today either.
- **hebert** is not downloaded yet. It is a reference row, not a shipping candidate.
- **What stands out** (small sets, so only as leads for the full run):
  - The faithful tokenizer raises today's model on every set.
  - msperka-dicta, joint-base and parse-base pass 29 of 33 known cases, against 26 for today's.
  - On protocol.txt, aleph, msperka-dicta and joint-base-ft lead on F2.
  - golem is weak on the transcript: recall 0.519, and 21 of 33 known cases.
  - large-q8 is 3.5× slower than today's model and not better.
  - tiny-parse is 5× faster, but less precise on protocol.txt.

To rerun: `node bench/model-eval/known-cases.js`, then `node bench/model-eval/smoke.js`.

**Checkpoint 1 decision (owner, 23.9):** all nine models go to the full run, each DictaBERT-family
one with both tokenizers (16 rows). The owner does not judge: Claude judges the model suggestions on
her documents (decision 2), and only counts leave the machine.

## Full run (run order 4) and checkpoint 2

`full.js` ran 16 rows. Each row covers the synthetic tune and test halves, `protocol.txt`, NEMO
test, BMC test 1, Knesset UD, the known cases, her gold set (model level, counts only) and the
whole chain on the synthetic set and hers (`product.js` through `wrap.js`, which is exact for
today's model). Every step ran. The comparison is `compare.js`. The finalists' intervals are at
97.5% (Bonferroni for two).

**Judging (decision 2):** 637 suggestions on her documents matched nothing in her key.
- 319 were a second span on a keyed name.
- Claude judged the other 318, plus 12 whole-chain values, by the key's own categories:
  - pseudonyms count as names;
  - banks and private organisations count as names;
  - insurers and public bodies are not names (the key's traps);
  - when unsure, not a name.
- Labels and her text stay in `private-bench/model-eval/judge/`.

**The table** (`decision.js`). The noise band is from run order 2. Her counts only.

| Model | Synthetic found / missed / leaked / fp | New leaks outside the band | Hers found / missed / leaked / fp | New leaks outside the band | 1. Safety | 2a. Held-out recall gain, untyped [interval] | 2b. Her model-only junk (today 4) | Known cases | MB | Node ms / 1k words |
|---|---|---|---|---|---|---|---|---|---|---|
| base-q8 (today) | 262 / 6 / 7 / 4 | – | 32 / 1 / 3 / 3 | – | – | – | 4 | 26/33 | 185 | 761 |
| parse-base-ft | 265 / 3 / 3 / 5 | 0 | 33 / 0 / 0 / 4 | 0 | PASS | +0.123 [0.100, 0.146] at 97.5% | 14 (FAIL) | 29/33 | 185 | 906 |
| tiny-parse-ft | 262 / 6 / 7 / 7 | 2 | 33 / 0 / 2 / 4 | 0 | FAIL | +0.116 [0.093, 0.139] at 95.0% | 30 (FAIL) | 28/33 | 45 | 114 |
| parse-base | 263 / 5 / 6 / 4 | 2 | 33 / 0 / 0 / 4 | 0 | FAIL | +0.111 [0.092, 0.130] at 95.0% | 6 (FAIL) | 29/33 | 185 | 882 |
| aleph | 264 / 4 / 4 / 6 | 1 | 33 / 0 / 3 / 4 | 1 | FAIL | +0.100 [0.079, 0.119] at 95.0% | 15 (FAIL) | 28/33 | 127 | 951 |
| msperka-dicta-ft | 261 / 7 / 9 / 4 | 5 | 33 / 0 / 1 / 4 | 0 | FAIL | +0.100 [0.078, 0.121] at 95.0% | 14 (FAIL) | 29/33 | 185 | 883 |
| tiny-parse | 264 / 4 / 4 / 6 | 1 | 31 / 2 / 2 / 5 | 2 | FAIL | +0.098 [0.079, 0.117] at 95.0% | 23 (FAIL) | 28/33 | 45 | 117 |
| joint-base-ft | 263 / 5 / 4 / 4 | 0 | 31 / 2 / 2 / 4 | 1 | FAIL | +0.091 [0.069, 0.113] at 97.5% | 12 (FAIL) | 29/33 | 185 | 881 |
| msperka-dicta | 261 / 7 / 9 / 4 | 5 | 33 / 0 / 1 / 4 | 0 | FAIL | +0.085 [0.062, 0.107] at 95.0% | 11 (FAIL) | 29/33 | 185 | 868 |
| base-q8-ft | 264 / 4 / 5 / 4 | 1 | 33 / 0 / 1 / 4 | 0 | FAIL | +0.078 [0.063, 0.096] at 95.0% | 12 (FAIL) | 27/33 | 185 | 770 |
| joint-base | 262 / 6 / 5 / 4 | 2 | 31 / 2 / 2 / 4 | 1 | FAIL | +0.076 [0.060, 0.093] at 95.0% | 5 (FAIL) | 29/33 | 185 | 874 |
| large-q8-ft | 264 / 4 / 4 / 6 | 1 | 30 / 3 / 5 / 3 | 2 | FAIL | +0.066 [0.049, 0.085] at 95.0% | 13 (FAIL) | 28/33 | 437 | 2824 |
| iahlt-base-ft | 265 / 3 / 4 / 6 | 1 | 33 / 0 / 1 / 5 | 0 | FAIL | +0.037 [0.015, 0.058] at 95.0% | 15 (FAIL) | 28/33 | 185 | 864 |
| iahlt-base | 263 / 5 / 8 / 4 | 5 | 32 / 1 / 2 / 4 | 0 | FAIL | +0.028 [0.008, 0.050] at 95.0% | 15 (FAIL) | 28/33 | 185 | 861 |
| large-q8 | 257 / 11 / 12 / 5 | 9 | 32 / 1 / 3 / 3 | 1 | FAIL | +0.005 [-0.010, 0.018] at 95.0% | 11 (FAIL) | 26/33 | 437 | 2829 |
| golem | 258 / 10 / 17 / 8 | 11 | 32 / 1 / 4 / 3 | 1 | FAIL | -0.382 [-0.419, -0.347] at 95.0% | 24 (FAIL) | 21/33 | 279 | 1512 |

- **Safety (rule 1):** only **parse-base-ft** has no new leak or miss outside the noise band on
  both sets, and its totals go down on both.
  - Synthetic: leaked 7 → 3, missed 6 → 3.
  - Hers: leaked 3 → 0, missed 1 → 0.
  - joint-base-ft opens one of her entities (a surname in speech).
  - base-q8-ft opens one synthetic surname (c3).
  - Every other row opens more.
- **Better reading (rule 2a):** parse-base-ft passes at 97.5%. Pooled untyped gain +0.123
  [0.100, 0.146], PER +0.073 [0.047, 0.101], raw at its tuned cut-off 0.30.
  - At the product's own stage (cleaned, 0.6) the gain is smaller:
    - BMC +0.099 [0.072, 0.126];
    - NEMO +0.066 [0.037, 0.103];
    - Knesset +0.042 (interval crosses 0);
    - protocol +0.008.
  - Precision is 1–4 points lower.
- **Her time (rule 2b):** every candidate fails. Today's model leaves 4 model-only junk
  suggestions on her five documents, and parse-base-ft leaves 14.
  - Her documents were produced with today's model, which biases this count toward it (PLAN.md,
    "what each set can prove").
  - Rule 2 needs (a) or (b), so parse-base-ft passes rule 2 on (a).
- **Budget (rule 3):** 185 MB, green. In Node it scans about 1.2× slower than today's model;
  the browser time is Phase 5.
- **Licence (rule 4):** CC-BY-4.0.
- **Browser (rule 5):** Phase 5.
- **Harness health:** the alignment losses are the same for today's model and every
  DictaBERT-family row, so `compare.js` now fails a row only for a loss beyond the baseline's.
  Only aleph fails.

**Found on the way (product bugs, not model choice):**
- **`nerAlign` loses its place after a word with nikud:** every later token in the sentence goes
  unplaced ("מִיקָה בת חמש, ומסרבת..."), so whatever the model finds there is dropped. It hits
  today's model too.
- **The tokenizer fix changes span edges** on two-letter names after a prefix letter (ו or ל
  before a two-letter name).
  - The whole chain absorbs this: parse-base-ft and base-q8-ft find 33 of 33 on her documents.
  - The model-level score on her documents does not. So her model-level numbers are not a
    decision input, as PLAN.md already says.
