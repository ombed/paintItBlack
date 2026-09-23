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
