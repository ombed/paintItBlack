# Choosing the name-recognition model (September 2026)

This folder is the full record of how InKognito chose the model that suggests names, bodies and
places in the user's documents. It covers what was tried, how it was judged, what each decision was, and
all the data behind it. The work ran on 23–24 September 2026 and ended in **v56**.

| File | What it is |
|---|---|
| `README.md` (this file) | The story and the map. Start here |
| [PLAN.md](PLAN.md) | The plan and the decision rule, **fixed and committed before any model was run** |
| [RESULTS.md](RESULTS.md) | Every result as it came in, phase by phase, with the owner's decisions |
| [FORMATS.md](FORMATS.md) | The file formats of the gold sets, predictions and scores |
| [SOURCES.md](SOURCES.md) | Where the public test sets come from (commits, hashes, licences) |
| `data/` | Every run's output (described at the end) |
| `bench/model-eval/` | The harness that produced it. `bench/model-eval/EXPORTS.md` records how each model was converted |

## Why this was done

Until v55 the tool used `onnx-community/dictabert-ner-ONNX`. It had been picked for its size, not
measured against anything else. The owner asked for a real comparison of local models, with
precision, recall and F-scores on every case we knew of and on the real documents we had.

Three conditions held throughout:
- The model must run in the user's browser. No cloud service was considered.
- No fine-tuning. There is no safe training data.
- Real documents never leave the machine. Results on them are not published here.

## The short answer

**DictaBERT-parse's NER head, with a corrected tokenizer**, now runs in the tool (v56). It was the
only one of 16 configurations that passed the rule written in advance.

| Whole chain (model plus every other layer) | v55 (before) | v56 (after) |
|---|---|---|
| Synthetic set, 268 entities: found / missed / leaked | 262 / 6 / 7 | 266 / 2 / 2 |
| Held-out public sets, recall gain (raw spans, each model's tuned cut-off) | – | +0.123 [0.100, 0.146] at 97.5% |
| Download / browser scan time | 185 MB / 1.00× | 185 MB / 1.01× |

**How big a change is this?** A solid step, not a dramatic one.
- **What improved most:** leaks, the failure that matters most, dropped on every set. Every
  independent set pointed the same way.
- **The sets are small:** "7 → 2" on the synthetic set is five names.
- **The other layers already caught most names:** the v55 tool found 262 of the 268 synthetic entities.
- **The gain is smaller in the product:** at the product's own setting (cleaned names, cut-off
  0.6) recall rose by 0.10 on BMC and 0.07 on NEMO, not significantly on Knesset, and by about
  zero on the court protocol.
- **It costs the user some time:** more model-only false suggestions to dismiss.

The most valuable outcome may be the two bugs the evaluation found in how the tool fed text to
*any* model. Both are fixed in v56 (below).

## What was tried

Nine models, each run exactly as the tool would run it. The seven DictaBERT-family models were also
run a second time with the corrected tokenizer (`-ft`). That makes 16 rows.

| Key | Model | Download | Licence | Trained on | What happened |
|---|---|---|---|---|---|
| `base-q8` | onnx-community/dictabert-ner-ONNX (the v55 model) | 185 MB | CC-BY-4.0 | undocumented | The baseline everything was compared with |
| `parse-base` | dicta-il/dictabert-parse, NER head only | 185 MB | CC-BY-4.0 | NEMO + UD | **Chosen, with the tokenizer fix** |
| `joint-base` | dicta-il/dictabert-joint, NER head only | 185 MB | CC-BY-4.0 | NEMO + IAHLT | Close second. With the fix: no new synthetic leak, but a new leak on the private set |
| `tiny-parse` | dicta-il/dictabert-tiny-parse | 45 MB | CC-BY-4.0 | NEMO + UD | About 7× faster, but new leaks, and more false suggestions than the chosen model |
| `iahlt-base` | iahlt/ner-baseline-dictabert-he | 185 MB | CC-BY-4.0 | IAHLT | The smallest reading gain (+0.03), and new leaks |
| `msperka-dicta` | msperka/dictabert_ner | 185 MB | CC-BY-4.0 | NEMO | Good on the known cases, but 5 new synthetic leaks (neighbourhoods, a boarding school, a daycare) |
| `aleph` | msperka/aleph_bert-finetuned-ner | 127 MB | Apache-2.0 | NEMO | Strong reader (+0.10), but a new leak on each set |
| `golem` | CordwainerSmith/GolemPII-v1 (XLM-R) | 279 MB | MIT | synthetic PII templates | Weak on real speech and filings (recall −0.38) |
| `large-q8` | dicta-il/dictabert-large-ner, re-exported | 437 MB | CC-BY-4.0 | NEMO | 3.7× slower, and no better |

Reference rows, not candidates:
- `base-fp32` shows what 8-bit costs.
- `base-uint8` measures the baseline's own noise.
- `hebert` has no licence, so it could never ship. It was not run.

Every export is pinned by source commit and SHA-256 in `bench/model-eval/registry.exports.json`.
How each one was converted, and checked against the published q8 file, is in
`bench/model-eval/EXPORTS.md`.

## How it was judged

The rule was written in PLAN.md section 1 and committed before any candidate ran. A candidate
replaces the current model only if **all five** hold:

1. **No new leaks.**
   - On the synthetic set and on the private set of real documents, it must not leak or miss any must-redact entity
     that the current model catches.
   - The only exception is the current model's own noise band: entities that flip between two runs
     of it, between q8 and uint8, and between Node and the browser.
   - Total leaks and misses must not rise.
2. **A real benefit.** Either:
   - held-out recall significantly better (a paired bootstrap, 97.5% for the two finalists), with
     no set significantly worse; or
   - 25% fewer false suggestions on the private set.
3. **Fits the budget:** download size, browser time and memory.
4. **Licence** allows the user's use.
5. **The browser gives the same answers as Node**, within the current model's own drift.

**The test sets:**
- **Synthetic (43 documents).** Invented, in the user's genres. The v55 model was tuned on it, so it can
  only show a candidate is *not worse*.
- **A private set of real documents.** Already redacted by the tool. Used only for the safety and
  user-time checks; results not published.
- **Held out:** `protocol.txt` (a public Knesset protocol, keyed blind by two passes and
  adjudicated), NEMO test, BMC split 1, and Knesset UD (with the sentences IAHLT trained on
  removed). Only these can show a candidate is *better*.
- **The known cases:** 33 invented cases for every leak the tool has had, plus 2 controls.

**Privacy.** Every script that touches the private set prints and writes only what an allowlist lets
through (`bench/model-eval/privacy.js`). Its keys, predictions and judgements stay in the private
folder beside the repository. Model suggestions on it that matched nothing in its key were judged
one by one, on the machine, as the owner decided.

## What happened, in order

| Step | What | Decision |
|---|---|---|
| Phase 0 | The plan and the rule | The owner accepted the rule. Up to 250 MB with no questions; 250–450 MB only with the owner's OK; over 450 MB never |
| Phase 1 | Harness, **parity**, noise band | The harness reproduces the v55 tool exactly (0 entities different). The noise band comes entirely from uint8 |
| Discovery | **The tokenizer bug** (below) | Every DictaBERT-family model was then run both ways |
| Checkpoint 1 | Smoke table: every row loads, clean health | The owner kept all nine models |
| Phase 4 | Full run, 16 rows × 7 sets, the whole chain, the private set judged | – |
| Checkpoint 2 | The decision table ([RESULTS.md](RESULTS.md)) | The owner chose finalists parse-base-ft and base-q8-ft |
| Phase 5 | The finalists in the real page (Chromium, one thread) | Both gave exactly the Node result, at about the same speed |
| Checkpoint 3 | The rule as written: parse-base-ft passes all five; base-q8-ft is blocked on one synthetic surname | The owner chose **switch to parse-base-ft, hosted in the app's own site** (no Hugging Face account, no third party) |
| Phase 6 | v56 | The product's own bench reproduced the evaluation's numbers exactly before the second fix went in |

## The two bugs found on the way (both fixed in v56)

**1. The tokenizer split Hebrew differently from training.**
- DictaBERT's tokenizer pattern uses `\w`. In the Rust library the model was trained with, `\w`
  includes Hebrew letters. In JavaScript it is ASCII only.
- So the tool glued a Hebrew word to the punctuation after it ("שלישי." became one piece), and a
  hyphenated surname reached the model as one word.
- A parity check against Python on 50 fixed sentences matched on only 6. With the fix, all ten
  tokenizers match on 50.
- This affected the v55 model too, from the start. The fix alone improved it (base-q8-ft).

**2. A name with nikud made the tool lose its place.**
- The tokenizer strips nikud, so "מִיקָה" came back as "מיקה" and was not found where it stood.
  The alignment jumped to a later plain "מיקה", and every token in between went unplaced.
- In the synthetic set this lost the rest of a paragraph, and one name with it.
- Alignment now works on text normalised the way the tokenizer normalises it, and never jumps
  ahead.

A smaller finding: the v55 model gave slightly different answers in the browser than in Node (9
leaks against 7 on the synthetic set). The new model does not.

## Limits and what to watch

- **The sets are small,** so an improvement of 2 to 5 entities is real but narrow.
- **The private set is biased toward the old model.** It was made with it: every name it found
  had already been replaced.
- **The user-time cost is real on paper:** model-only false suggestions rose. Real use will show
  whether it costs time in practice.
- **At the product's own setting the gain is smaller** than the headline, as the table above says.

## Not done, and why

- **Fine-tuning:** no safe training data. Real documents are confidential.
- **Cloud models:** against the tool's promise that nothing leaves the user's computer.
- **Models over 450 MB:** too large for a one-time download on the user's machine. large-q8, at 437 MB,
  was measured, and it did not help.
- **hebert:** no licence.

## The data (`data/`)

Every run's output is here, so every number above can be checked or recomputed. File shapes are in
[FORMATS.md](FORMATS.md). RESULTS.md names these files by their working paths under
`bench/model-eval/out/`; they were copied here unchanged, with one later exception:

**Reworded on 10.10.2026.** Five synthetic documents (x1, x2, a1, a2, v1) and two known cases
(`v39-glued-full-name`, `v39-infinitive`) were reworded with new invented sentences that keep every keyed
name, trap and pattern they test. In `data/gold/`, `data/full/gold/` and the known cases, they carry the
new wording, rebuilt with the same scripts (every other document is byte for byte as before). In
`data/browser/` their recorded text and token words are withheld (`"withheld"` on the document); the
labels, scores and timings are as recorded. The tables above were computed on the earlier wording.

| Path | What |
|---|---|
| `data/full/decision.md` | The checkpoint 2 table: every row's safety, benefit, user-time counts, size and speed |
| `data/full/compare.md`, `data/full/compare-finalists.md` | The full comparison: the rule table, cut-offs, harness health, one table per set; the second at 97.5% for the finalists |
| `data/full/known.json` | Each row's known cases, pass or fail, with the reason buckets |
| `data/full/pred/<row>.<set>.{raw,cleaned}.json` | Every model-level prediction. Raw spans carry every score (threshold 0); cleaned is after the product's name cleaning. Offsets only, no text |
| `data/full/gold/` | The synthetic tune and test halves, the protocol key and the known cases |
| `data/product/<row>-<tag>.json` | The whole chain on the synthetic set, entity by entity (found, leaked, false positives, extra suggestions) |
| `data/browser/` | The real page: per-document time, names and raw chunk outputs, and `compare.md` (browser against Node) |
| `data/smoke/` | The checkpoint 1 smoke table and its predictions |
| `data/gold/` | The synthetic gold as built, with its report |
| `data/tok-parity.json` | Tokenizer parity: every tokenizer, four ways, 50 sentences |
| `data/protocol-annot-A.json`, `-B.json` | The two blind annotation passes behind the protocol key (adjudication: `bench/model-eval/gold/protocol-adjudication.md`) |

The tags in `data/product/`:
- `a`: the v55 model through the evaluation loader.
- `today`: the same model through the v55 bench loader.
- `wrapped`: the same model through the adapter (all three agree exactly).
- `faithful`: the v55 model with the tokenizer fix.
- `full` and `full-ft`: the full run, each model without and with the fix.
- `browser`: the page's outputs, replayed.
- `base-uint8-a`: the noise band.

**Not in the repository:**
- **The public sets' texts** (NEMO, BMC, Knesset UD). Their licences do not clearly allow
  redistribution. [SOURCES.md](SOURCES.md) gives the exact commits to download, and
  `bench/model-eval/convert-public.js` converts them. The predictions here index into those texts.
- **Anything from the private set of real documents,** including its results.
- **The model exports** (several GB). The registry pins each one by commit and hash, and
  `bench/model-eval/export.py` rebuilds them.

## Reproducing it

The texts and models live beside the repository: `../public-bench/`, `../model-cache/` and, for
the private set, `../private-bench/`.

```
py -3 bench/model-eval/export.py download         # the pinned source files
py -3 bench/model-eval/export.py export           # export, check against PyTorch, quantise
py -3 bench/model-eval/export.py registry         # registry.exports.json
node bench/model-eval/convert-public.js           # the public gold sets, from SOURCES.md
node bench/model-eval/gold-synth.js               # the synthetic gold
node bench/model-eval/known-cases.js              # the known cases
node bench/model-eval/tok-parity.js               # tokenizer parity against Python
node bench/model-eval/smoke.js                    # checkpoint 1
node bench/model-eval/full.js                     # every row on every set, the whole chain, compare
node bench/model-eval/decision.js --finalists=parse-base-ft,joint-base-ft
PIB_MODEL=parse-base-ft npx playwright test -c bench/model-eval/browser   # the real page
node bench/model-eval/browser/compare.js
```

Since v56, `bench/lib.js` loads the shipped model when it is given no key. Scripts that compared
against "today's" loader (`parity.js`, `product.js --loader=today`) now compare against v56. The v55
numbers are the ones recorded here.
