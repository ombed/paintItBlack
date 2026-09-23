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
