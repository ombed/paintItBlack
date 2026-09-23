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
