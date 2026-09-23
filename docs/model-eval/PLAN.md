# Plan: choosing the Hebrew name model (NER) on evidence, not size

*Accepted by the owner on 2026-09-23. This file and the rule in section 1 were committed before any candidate was run.*

**Owner's decisions (2026-09-23), which override anything below that says otherwise:**
1. The section 1 rule is accepted as written, including that a "net safety gain" is blocked and decided by the owner at checkpoint 3.
2. **Claude judges** the model suggestions on her documents (section 4.4), not the owner. Her documents already passed her check and were already sent to AI models. Nothing from them leaves the machine: no repo, commit, PR, doc, artifact or memory. Reports are counts only. Identifying information she missed is removed from the local fixture; the one known case, a real name in r5, is replaced with an invented name of the same shape, so the leak test case keeps its shape.
3. Download ceiling: ≤ 250 MB without asking her; 250–450 MB only with the owner's OK and a first-run warning; > 450 MB not shipped.
4. `tests/protocol.txt` gets a blind key committed to the repo. NEMO, BMC and Knesset UD stay outside the repo in `paintItBlack/public-bench/`; only aggregate scores are committed.
5. Two corrections to the draft: a branch push does not deploy (only merges to `main` do); timing numbers here are from this PC, not her laptop.

## In short

- **Why we're doing this:** DictaBERT-base q8 (185 MB) was already in the first version of the tool, and it has never been compared with a different kind of model. The one test we ran (2026-09-05) tried three versions of this same model. It looked only at person names, used 71 mentions, and was decided by a gap of one name.
- **What we'll do:**
  - Run 12 tier-1 rows through one harness on this PC. That is today's model, 2 other versions of its file, and 9 other models.
  - Score each row two ways:
    - **Model level:** precision, recall, F1 and F2 for each type.
    - **Product level:** found, missed, leaked, false positives and junk, scored the way `bench/lib.js` does today.
  - Use four kinds of text: our synthetic set, her 5 documents (reported as counts only), public Knesset text, and three public Hebrew answer keys.
- **How we'll decide:** the rule in section 1 is written down before any number exists.
  - The rule is strict about safety. **The most likely result is that we keep today's model.** That's acceptable: if we keep it, we'll know why.
- **What it costs:**
  - About **7–9 working days** of my time.
  - About **2–4 hours** of yours. That covers three checkpoints plus judging model suggestions on her documents, in a tool that runs only on your screen. The judging range gets fixed after the smoke test.
  - Nothing is deployed. The work stays on a local branch, and the engine is not touched until you decide to switch.

**Correction to the research notes:** `tests/protocol.txt` is 14,247 bytes, not 14,247 words. That is about 1,430 words (8,048 characters). It is quick to annotate, but it is a small sample.

---

## 1. Goal and decision rule (fixed before measuring)

**What we're protecting:**
- **A missed name is a leak.** It can't be undone.
- **A false suggestion costs her a tap.** In the 16.9 session she overrode the tool 11–14 times per document and spent 80–85% of her time on the check screen. False suggestions are her biggest time cost, but they are never a legal risk.

**Today's numbers (model on):**

| Set | Scored | Found | Missed | Leaked | FP | Junk | Model-only junk |
|---|---|---|---|---|---|---|---|
| Synthetic (43 docs) | 268 | 262 | 6 | 7 | 4 | 31 | 2 |
| Her 5 docs | 33 | 32 | 1 | 3 | 3 | 81 | 27–29 (to be recomputed) |
| Model off (synthetic / hers) | | 210 / 26 | 58 / 7 | 74 / 9 | 4 / 1 | 29 / 54 | – |

**What each set can prove:**
- **Her documents are biased by how they were made.** The tool produced them with the model on, so every name the baseline found has already been replaced. What is left is pseudonyms plus what the baseline missed.
  - We use them only for the **safety** and **her-time** checks, never as evidence that a candidate reads Hebrew better.
  - Only one of her three leaks (the r3 bank name) is something a different model could fix.
- **The baseline was tuned on the synthetic set.** Its 0.6 floor, the `nerClean` rules and the corpus categories were all fitted to it. So the synthetic set can show a candidate is *not worse*.
- **Only `protocol.txt` and the public keys can show that a candidate is *better*.**

### The rule

A candidate replaces today's model only if **all five** hold:

1. **No new leaks.**
   - Before any candidate is judged, we measure the **baseline's own noise band**: the entities that flip between two Node runs, between Node and the browser, and between q8 and uint8.
   - On the synthetic set and her documents, a candidate must not leak or miss any must-redact entity that the baseline catches, apart from entities in that noise band.
   - Total leaks and total misses must not go up.
   - If a candidate closes more leaks than it opens, it still fails this rule. It is reported as "net safety gain, blocked", and you decide it explicitly at checkpoint 3, looking at each opened leak by category.
2. **A real benefit: at least one of (a) or (b).**
   - **(a) Better reading.** Look at recall with overlapping spans on the held-out sets (`protocol.txt`, Knesset UD, NEMO test, BMC split 1), with PER and untyped as the headline. The paired 95% interval of the gain over the baseline must be entirely above zero, and no single set may be significantly worse.
     - The synthetic test half counts only as a "not worse" check.
     - Significance is tested only for the ≤2 finalists, with 97.5% intervals (Bonferroni for two), so running ~11 candidates doesn't create a false winner.
   - **(b) Her time.** Model false positives on her documents fall by at least 25%, using the adjudicated counts from 4.4. At the same time, the paired interval for held-out recall must not be significantly negative. This replaces the draft's "1 percentage point" test, which was smaller than the noise.
3. **Fits the budget.** Scan time is given per 1,000 words, relative to today's model. Her documents run from 576 to 5,200 words. Today's model takes about 55 s on r3 with 1 thread, so a flat per-document limit would fail today's model too.

   | | Green | Amber (your explicit OK) | Red |
   |---|---|---|---|
   | Weights download | ≤ 250 MB | 250–450 MB, with a first-run warning | > 450 MB |
   | Browser scan, 1 thread, per 1k words (today about 10.5 s on this PC) | ≤ 1.3× today | ≤ 2× today | > 2×, unless a separate Worker-plus-threads project is taken on |
   | Peak tab memory | ≤ 1.5 GB | ≤ 2.2 GB | more |

   Her laptop is unknown (see open question 5). The 52 s she spent on the people screen was measured on **her** machine. The scan times are from **this** PC, so the two can't be compared directly.
4. **Licence clearly allows her use:** CC-BY-4.0, Apache-2.0 or MIT, with attribution. Models with no licence can be measured but can't ship.
5. **The browser gives the same answers as Node.** We first measure how far the baseline itself drifts between Node and the browser. A candidate may drift no more than that plus 1 on found and on leaked.

**Tie-break:** higher F2 wins. F2 is computed on the cleaned output, at each model's own chosen cut-off, pooled over the held-out sets. After that, the smaller model wins, then the faster one. A tie means we keep today's model.

The plan and this rule are committed to the branch in Phase 0, before any candidate is run.

---

## 2. Shortlist

Sizes are for the q8 file. "est." means estimated from the parameter count, not measured.

### Tier 1 (evaluate)

| Key | Model | Download | Licence | Labels | Notes |
|---|---|---|---|---|---|
| `base-q8` | onnx-community/dictabert-ner-ONNX @4f0aabf | 185 MB | CC-BY-4.0 | BIO, 13 types | Ships today. Training data not documented |
| `base-fp32` | same repo, fp32 | 735 MB | same | same | Reference only: shows what 8-bit costs |
| `base-uint8` | same repo, uint8 (a different file of the same size) | 185 MB | same | same | Measures quantization noise. Its effect is unknown, not assumed to be the same as q8 |
| `large-q8` | dicta-il/dictabert-large-ner, **re-exported** with the fixed recipe | ~416 MiB | CC-BY-4.0 | BIO, 13 | The scratch export used QUInt8, so it is not like-for-like and gets redone. Conditional on budget |
| `joint-base` | dicta-il/dictabert-joint, NER head only | ~185 MB (est.) | CC-BY-4.0 | BIO, 13 | Largest documented Hebrew NER training (NEMO plus IAHLT). Tokenizer to be diffed |
| `parse-base` | dicta-il/dictabert-parse, NER head only | ~185 MB (est.) | CC-BY-4.0 | BIO, 13 | Published NEMO F1: 83.8 |
| `tiny-parse` | dicta-il/dictabert-tiny-parse, NER head only | ~45 MB (est.) | CC-BY-4.0 | BIO, 13 | NEMO F1 80.3. Speed unmeasured: the paper's 1.46× was for tiny-joint with all its heads |
| `iahlt-base` | iahlt/ner-baseline-dictabert-he | ~185 MB (est.) | CC-BY-4.0 | IO, 13 | Only model that publishes P/R per type. Two adjacent names merge into one |
| `msperka-dicta` | msperka/dictabert_ner | ~185 MB (est.) | CC-BY-4.0 | BIOES, 9 | Trained on NEMO only |
| `hebert` | onnx-community/heBERT_NER-ONNX @16a6e78 | 110 MB | none on HF | `B_` tags only | Trained on BMC. **Measure only** (no licence) |
| `aleph` | msperka/aleph_bert-finetuned-ner | ~126 MB (est.) | Apache-2.0 | BIOES, 9 | Trained on NEMO. WordPiece tokenizer |
| `golem` | CordwainerSmith/GolemPII-v1 (XLM-R base) | ~279 MB (est.) + 17 MB tokenizer | MIT, plus a citation line | BIO PII, no ORG | Trained for this exact job, on synthetic templates. Amber on size |

We also score **each exported candidate at fp32 in Node** (the export produces fp32 anyway). That separates the model's quality from what quantization costs it.

### Configuration rows (cheap, tier 1)

- `base-q8` at chunk sizes of 400 and 1,200 characters.
- `base-q8` plus the old H2 idea: a second pass on normalized text (nikud stripped, Latin lower-cased). This targets the alignment losses described in 3.1.

### If time (only after checkpoint 2, and only if it could change the decision)

| Rows | Why |
|---|---|
| `base-fp16`, `base-q4f16` | Smaller or faster files. fp16 already loses 10% of tokens on WebGPU and fails on WASM |
| `large-fp16`, `tiny-joint`, `large-parse` | Complete the DictaBERT family grid |
| `abg`, `hero`, `xlmr-40` | Different encoders or data. No licence, so measure only |
| `xlmr-conll` | Control: shows how much Hebrew training matters |
| `gliner-multi`, `gliner-x-small`, `privacy-filter` | Zero-shot / PII models. Need custom decoders. No Hebrew evidence |
| `stanza` | External yardstick. Python, cannot ship |
| `union-*` | Baseline plus the best model from another family (ROADMAP 17) |

### Excluded

| Model | Why |
|---|---|
| Today's q4 / bnb4 | Larger than q8 |
| large fp32 | Fails to load in the browser |
| neodictabert, HalleluBERT | No NER head (the one HalleluBERT fine-tune is PERSON-only and unlicensed) |
| gliner_multi_pii | Recall .317 on the SPY legal set; no Hebrew |
| fastino gliner2 / 2.5 | Architecture not runnable; ≥480 MB; no Hebrew |
| OpenMed privacy-filter | 5.6 GB; no Hebrew |
| iahlt span-marker models | Not supported in transformers.js; needs morpheme-split input |
| jony6484 / ram-and-jony | No card, licence or data |
| shinrai-pii | Its own card: Hebrew recall 52.3 |
| rapido-ner | Hebrew is 0.5% of its training |
| piiranha | No Hebrew; NC-ND licence |
| Small LLMs (Qwen, DictaLM, Gemma, Phi) | No positions or scores; 0.5–3 GB |

---

## 3. Metrics

### 3.1 Model level

- **Stages:**
  - **raw:** after `nerAlign`/`nerGroup`, before `nerClean`;
  - **cleaned:** after `nerClean`.

  `nerClean` drops public bodies and role words, cuts trailing words, and turns 5+ word names into ORG. So on the **public sets the headline is raw**, and cleaned is shown only on our own sets. A candidate that wins raw but loses cleaned is labelled "needs its own cleaning", not "worse".
- **Unit:** a mention = (document, start, end, type).
- **Types:** PER, ORG and PLACE (GPE, LOC and FAC merged). Every other type is dropped from both the key and the predictions.
- **Headline across model families: PER-typed plus untyped overlap.** The answer keys draw ORG/GPE/LOC and title boundaries differently, so typed ORG and PLACE scores are secondary.
- **Matching:**
  - **word-exact:** both spans snapped to whole words, with a prefix letter counted as part of the word;
  - **overlap, typed** and **overlap, untyped:** one-to-one, largest overlap first.
- **Scores:** P, R, F1 and F2 (= 5PR/(4P+R)), micro-averaged and per type. Also:
  - entity-level recall on our own sets;
  - recall per synthetic `cat`;
  - trap rate (T_* and public bodies).
- **Added recall.** Recall on the gold mentions that the **model-off pipeline misses** (synthetic and `protocol.txt`). This is where a model actually matters.
- **Floor rows:** the model-off row is shown in every model-level table.
- **Paired diff against the baseline**, per gold mention: found by both / only baseline (a loss) / only candidate (a gain) / neither.
- **Harness health, which must pass before any score counts:**
  - unmapped labels = 0, apart from declared drops;
  - chunks over 510 tokens = 0;
  - per-chunk errors = 0;
  - **alignment failures on gold-entity tokens** below 0.5%. Measured on entity tokens only, because 0.5% of *all* tokens can hide many entities.

  Alignment failures are reported as **harness losses**, separate from model errors.
- **Tokenizer parity.** For each candidate, transformers.js token IDs must equal Python HF token IDs on 50 fixed sentences, with the global RegExp wrapper installed. Where the tokenizer loads without the wrapper, we check that too. The wrapper was written for DictaBERT and could rewrite other tokenizers' patterns without any error.

### 3.2 Product level

- `scoreDoc` unchanged.
- Added:
  - **model added value**: found(on) − found(off), and leaks closed;
  - **model-only junk**;
  - **junk per 1,000 words**;
  - the **per-entity diff against the baseline, keyed by `cat`**;
  - **adjudicated model false positives** on her documents (4.4).
- For the finalists, the bench also runs `foldEvidence`, `tokPieces` and `guardModel`. The bench skips these today, and they depend on the tokenizer, so skipping them would treat non-WordPiece models unevenly.

### 3.3 Span boundaries

`bench/spans.js`, generalised to any model: exact / glued-left / glued-right / cut-left / cut-right / none, plus kind mismatch and whether the span survives cleaning. **Glued spans are counted as a failure class in their own right** (the v39 incident).

### 3.4 Cost

| Measure | Rows |
|---|---|
| Download (weights + tokenizer), load time, Node scan per 1k words, Node memory, max tokens per chunk | all |
| **Scan time on the longest real document** (r3, 5,200 words), Node | all |
| Browser (1-thread WASM, and 4 threads): load, scan per 1k words, peak tab memory, longest main-thread block, token agreement with Node | finalists plus baseline |

### 3.5 Calibration

- **Cut-off sweep:** 0.30–0.95 in steps of 0.05, on saved raw predictions. Reported as a PR curve and average precision.
- **Reliability table:** the share correct in the bands the product already logs.
- **Cut-off per model:** the one with the highest F2 on the **synthetic tune half**, ties going to the lower value.
- **The baseline keeps 0.6 as its tuned value.** It is also shown at its tune-half optimum, so both are visible.

### 3.6 Uncertainty

- Paired bootstrap with 2,000 resamples, fixed seed.
- Resampling units:
  - synthetic: by document;
  - Knesset UD: by its `newdoc` documents (15 after the IAHLT overlap is dropped, 19 before; dev and test together);
  - NEMO/BMC: blocks of 20 sentences. The files mark no article boundaries, so we state that these intervals are optimistic.
- Her documents are reported per document, with no intervals.
- The baseline is run twice to confirm the runs repeat exactly.

### 3.7 Why F1 does not decide

- F1 weighs a leak and a tap the same.
- F1 ignores what the rule layers already catch.
- Overlap F1 counts a glued span as a hit.

F-scores decide which models earn a product run, and they explain why a model wins. **The switch itself follows the rule in section 1.**

---

## 4. Datasets

| Set | Size | Job | Contamination |
|---|---|---|---|
| Synthetic (`bench/key.json`), tune 24 / test 19 docs | 3,290 words, ~490 mentions | Cut-off tuning (tune half); "not worse" check and categories (test half) | The baseline's settings were tuned on the whole corpus, so it is not held out for the baseline |
| `tests/protocol.txt` | ~1,430 words, ~11 chunks | Held-out model-level score; exercises the multi-chunk path | None known |
| Known cases (4.5) | ~25 named cases, all made-up text | Pass or fail per model | None |
| NEMO test | PER 267, ORG 408, GPE 195, LOC 41, FAC 11 | Held-out, headline public score | msperka, aleph, joint and parse trained on NEMO; whether the test split was held out is **unknown** for joint and parse; the baseline is unknown |
| BMC split 1 test | PER 373, LOC 318, ORG 273 | Held-out public score | `hebert` trained on BMC (not counted for it) |
| Knesset UD dev+test, minus the 56 sentences also in IAHLT NER | 465 sentences, 7,402 words | Spoken register, closest to her transcripts | joint and parse **possibly** contaminated (trained on IAHLT UD) |
| Her fixtures r1–r5 | ~10,450 words, 33 must | Safety and her-time checks only; **counts only** | Created by the baseline itself (see section 1) |

**Not used for the decision:**
- **IAHLT NER data.** The baseline's labels match IAHLT's (inferred, not documented), and joint, parse and iahlt were trained on it. It could serve as a held-out set for msperka, aleph, hebert and golem, but it can't be compared fairly with the baseline, so it is an optional diagnostic at most.
- **UD IAHLTwiki.** 311 of its 393 test sentences are inside IAHLT.

### 4.1 Synthetic

- `gold-synth.js` builds a key with positions from the surfaces:
  - trap surfaces are removed first;
  - matches are whole words, longest first, with an optional prefix letter;
  - the known `f1` gap is added.
- Every candidate prediction that matches nothing in the key is judged once, and the judgement is reused for every model. I judge them; you spot-check 20.
- **Split, by genre:** the 1st, 3rd and so on in each genre go to tune (24 docs); the rest go to test (19 docs).

### 4.2 `protocol.txt`: blind rebuild

- **First pass:** I annotate every PER/ORG/PLACE mention with positions **before seeing any model output**.
- **Second pass:** only the disagreements with the models are re-checked.
- **You:** spot-check 20%.
- Guidelines:
  - titles and role words are left out;
  - the prefix letter is left out and recorded;
  - public bodies are ORG with a `public` flag.
- The key is committed, because the text is public.

### 4.3 Public keys

- Stored in `C:/Users/Me/.vscode/paintItBlack/public-bench/`, outside the repo. Only aggregate scores are committed.
- Tokens are converted to text using a written rule for spacing around punctuation, geresh and gershayim.
- Every report includes a contamination table.

### 4.4 Her documents: judging

- Claude judges every unmatched prediction on her documents (owner's decision 2): name / place / org / public body / noise / unsure, reading the local fixture.
- Judgements are saved under `private-bench/model-eval/`, keyed by fixture and position, never committed.
- Reports and commits carry counts per model and per judgement class only.
- The same judgement is reused for every model that makes the same prediction, so the judging is consistent across rows.
- The owner spot-checks a random 20 on request.

### 4.5 Known cases, as named tests

Each case is rebuilt with **made-up text**, keyed blind, and gets a pass or fail per model.

- **Leaks:**
  - the r3 bank pseudonym pattern (the one leak a better model could fix);
  - the r4 town spelling variants and the r5 two-letter name with a prefix, as **controls no model should fix**;
  - v28 (a name found at full confidence that leaked downstream);
  - v39 (a glued span that allow-listed a surname).
- **16.9 leak shape** (one word, 4 letters, many occurrences), in 20 variants. **Pass = an exact span, or a span cut only by a prefix letter. Glued = fail.** That session's failure was the span edge, not the coverage.
- **The five false-positive types:** a discourse word glued to a name, a role word, a verb read as a first name, a public body with a prefix letter, and a bare number read as ORG.
- **Nikud and Latin-capital names.**
- The `ner_t.js` text gets a blind key. Its current key is DictaBERT's own 27 spans, which favours DictaBERT.

### 4.6 Keeping tuning apart from judging

- The rule and the split are fixed in Phase 0.
- Cut-offs are tuned only on the synthetic tune half.
- No per-candidate changes to `nerClean`. Only declared adapters are allowed.
- The decision leans on the public sets and `protocol.txt`.

---

## 5. Harness

- All new code lives in `bench/model-eval/` on a **local** branch `model-eval`.
- `npm run bench` and its committed baselines stay untouched.
- The engine is untouched until checkpoint 3.

1. **Registry** (`registry.json`). One record per model: repo, 40-hex revision, dtype, file, sha256, bytes, source, label scheme and map, tokenizer kind, licence, contamination. Local exports go in `paintItBlack/model-cache/<key>/`.
2. **`loadModel(spec)`** in `bench/lib.js`:
   - the default is today's model;
   - a separate cache per model;
   - `localModelPath` for exports;
   - **stops if the sha256 doesn't match**;
   - loads `bench/engine.js` first (for the RegExp wrapper).
3. **Adapters.** They convert each model's labels and tokens into what `nerAlign`/`nerGroup` expect:
   - `_`→`-`, PERS→PER, FIRST/LAST_NAME→PER (adjacent ones merged), CITY/STREET/POSTAL_CODE→PLACE;
   - BIOES→BIO; IO and B_only: the first token of a run becomes B-; IOB1→BIO;
   - SentencePiece: pieces without `▁` become `##`.
   - Byte-level BPE and GLiNER get their own runners (if time only).
4. **Runner.**
   - Each chunk is wrapped in try/catch. Errors are counted, never echoed.
   - It saves raw rows. **Private predictions contain text (`rawOut`), so they go only under `private-bench/model-eval/`.**
   - It never writes `bench/results.*` or `private-bench/results*.json`, and never runs `generate.js`.
5. **Scorers.**
   - `score-spans.js` works from saved predictions.
   - The product level reuses `runDoc`/`scoreDoc` unchanged.
   - For the finalists, a bench mode adds `foldEvidence`, `tokPieces` and `guardModel`.
6. **`sweep-floor.js`, `compare.js`.** Section 1 of `compare.md` is the pass/fail table for each rule.
7. **Exports** (`export.py`, `py -3.14`):
   - download pinned revisions, skipping `optimizer.pt` and `checkpoint-*`;
   - for joint/parse, load `bert.*` + `classifier.*` into `BertForTokenClassification`, requiring no missing keys and no `trust_remote_code`;
   - check logits PyTorch vs ONNX, max abs diff below 1e-3;
   - opset 14, then int8 per-channel with reduce_range, the same as today's file.
   - **Recipe check:** re-export `dictabert-ner` with this recipe. It must agree with the onnx-community q8 on at least 99.5% of token labels.

**Order of runs:**
1. **parity:** `base-q8` must reproduce 262/6/7/4/31 and 32/1/3/3/81.
2. **noise band:** the baseline run twice, plus uint8.
3. **smoke:** `t1`, `f1` and `protocol.txt` on all tier-1 rows. All health checks and tokenizer parity must pass.
4. **full run.**

Compute time is under an hour. **Downloads come to about 5.8 GB**: about 50 minutes at 15 Mbit/s, about 3.5 hours at the slowest speed measured here (3.7 Mbit/s). They run in the background.

**Browser check (finalists only):** the scratch harness moves to `bench/model-eval/browser/`. It uses the vendored 4.2.0 bundle and the pinned WASM. It then runs the real page on the synthetic set, with the model served locally through a Playwright route.

**Engine changes (Phase 6, only if we switch):**
- one `NER_SPEC` replaces the scattered constants;
- `nerLabel()` handles every label scheme, and **unmapped labels are counted in `model-done`** instead of being dropped silently;
- the `dictabert` hard-coding is removed (`nerCached`, `nerMigrateCache` purges other repos, the "180MB" text);
- tests get new expectations;
- the model is hosted on your HF account, pinned by commit and sha256, with attribution.

---

## 6. Privacy and safety

- **Output is allowlist-only.** The private report writer and private console output print only:
  - numbers;
  - fixed label names and category IDs;
  - fixture folder names.

  Anything else is refused, whatever its script (Hebrew, Latin, digits in ID or phone shapes, emails, paths). A test covers this.
- **Exceptions and stack traces are wrapped** during private runs, because transformers.js and ORT errors can echo input.
- `compare.js` emits only **category-level counts** for private runs. The per-entity diff is keyed by `cat`, never by `canonical` or a surface form.
- Private predictions, judgements and hashes stay under `private-bench/`. Claude reads them to judge (decision 2); they never leave the machine.
- Private runs use `allowRemoteModels=false`, with every model already cached.
- For leak shapes, the harness opens **only `leak-report.json`** inside the zips (in memory). It never opens the redacted docx, the session logs or the case profile.
- **Models:** pinned revision plus sha256 on every load; no `trust_remote_code`; `.bin` files loaded with `weights_only=True`.
- **Public datasets** stay outside the repo.
- **Commits, PRs, logs and memory:** no client text. Every report is checked against the allowlist before it is committed.
- **Freeze:** the branch stays local and is not pushed until the freeze is lifted (`pages.yml` deploys the site). No merge, no deploy.
- **r5 held a real full name that she missed.** It is replaced in the local fixture with an invented name of the same shape (decision 2).

---

## 7. Schedule

| Phase | What | Me | You | Ends with |
|---|---|---|---|---|
| 0. Agree | Blocking questions answered; plan and rule committed | 0.5 h | 20 min | Rule fixed |
| 1. Harness | Registry, loader, adapters, runner, scorers, bootstrap, privacy allowlist, tests, parity, noise band | 2.5–3 days | – | Parity passes |
| 2. Answer keys | Synthetic key, `protocol.txt` blind key, known cases, public conversions, judging tool | 1.5–2 days | 15 min | Keys ready |
| 3. Models | 7 exports plus the large re-export, recipe check, logit and tokenizer parity; downloads in the background | 1 day | – | All load, sha recorded |
| **Checkpoint 1** | Smoke table, plus how many predictions you'll need to judge | 1 h | 10 min | Go, or drop models |
| 4. Full run | All sets, sweep, product runs, judging | 1 day | 1–2 h (range fixed at CP1) | `compare.md` |
| **Checkpoint 2** | Decision table | – | 20 min | Up to 2 finalists; any if-time rows |
| 5. Browser | Finalists: costs, agreement with Node, real page, fold and guard modelled | 0.5–1 day | – | Browser table |
| **Checkpoint 3** | Rule applied as written | – | 15 min | Switch or keep |
| 6. Switch only | Section 5 engine changes as a normal release, after the freeze | 1.5–2 days | review | Live |

**Total: about 7–9 working days before any switch.**

**Not in scope:**
- fine-tuning;
- cloud models;
- LLM extraction;
- deploy or merge during the freeze;
- engine edits before checkpoint 3;
- per-candidate changes to `nerClean`;
- IAHLT as a decision set;
- committing public datasets.

---

## 8. Risks and open questions

**Risks:**
- **Too little data.** Mitigation: the public sets, paired intervals, and "a tie keeps today's model".
- **The harness favours DictaBERT.** Mitigation: raw scores as the headline on public sets, cut-offs chosen per model, harness losses reported separately, tokenizer parity checks.
- **The rule is conservative** and will probably keep today's model. That is intended.
- **Node is not the browser.** Mitigation: the noise band and the browser check.
- **Licences:** hebert, abg, hero and xlmr-40 can be measured but not shipped.
- **Side findings for TRIAGE, out of scope here:**
  - nikud and Latin-capital names lose their token in `nerAlign`;
  - the 1.26 JS backend runs against the pinned 1.24 WASM;
  - the page blocks for about 11 s during a scan;
  - the bench skips some product steps (recorded; modelled only for the finalists).

**Open questions, asked one at a time:**

*Blocking Phase 0, in this order:*
1. Accept the section 1 rule, including that a "net safety gain" is decided by you rather than passed automatically? *Recommend: yes.*
2. Are you authorised to view r2–r5 (r5 holds a real full name), and will you do the judging in your own terminal? *Recommend: yes, you, locally.*
3. Largest first download without asking her? *Recommend: 250 MB; up to 450 MB with your OK and a warning.*
4. May I annotate `protocol.txt` and the public sets, and commit the protocol key? *Recommend: yes; NEMO, BMC and UD stay outside the repo.*

*Later:*

5. Her laptop model and RAM (ask the CSM once)?
6. Measure models with no licence? *Recommend: yes, marked "not shippable".*
7. Run the zero-shot rows only if no Hebrew-trained model beats the baseline?
8. Add the two-model union row?
9. Where does a winning export live? *Recommend: your HF account.*
10. If `large-q8` wins on leaks but not on speed, scope the Worker-plus-threads project?

---

**Critic points not taken up as written:**
- The leak-shape pass condition "exact or cut" was narrowed to "exact, or cut only by a prefix letter", because a deeper cut still leaves part of the name.
- The tokenizer check "with and without the wrapper" runs without the wrapper only where the tokenizer can load; DictaBERT's tokenizers fail without it.

Every other critic point was valid and has been applied.

Files:
- C:/Users/Me/.vscode/paintItBlack/repo-clone/bench/lib.js
- C:/Users/Me/.vscode/paintItBlack/repo-clone/bench/key.json
- C:/Users/Me/.vscode/paintItBlack/repo-clone/tests/protocol.txt
- C:/Users/Me/.vscode/paintItBlack/repo-clone/engine/06-model.js
- C:/Users/Me/.vscode/paintItBlack/repo-clone/engine/08-docx.js
- Scratchpad: C:/Users/Me/AppData/Local/Temp/claude/C--Users-Me--vscode-paintItBlack-----------------------/c1a52a80-c9eb-4a7c-9840-252699d0b1e2/scratchpad/ (`kn_test.conllu` has 11 `newdoc` markers; `nemo_test.bmes` and `bmc_test1.bmes` have none)