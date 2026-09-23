# Public Hebrew gold sets: sources

The held-out sets of the model evaluation ([README.md](README.md)). The texts are **not** in this
repository: their licences do not clearly allow redistribution. They were downloaded on 2026-09-23
from the pinned commits below into `../public-bench/raw/` (beside the repository) and converted to
gold sets in `../public-bench/gold/` by `bench/model-eval/convert-public.js` (PLAN.md 4.3). Only
aggregate scores, and predictions that are offsets into these texts, are committed
(`data/full/`).

## 1. NEMO test (token-single, SPMRL version)

| | |
|---|---|
| Repo | https://github.com/OnlpLab/NEMO-Corpus |
| Commit | `38b10235a22998774311ab78a0078c8fb7dea57c` (main, 2026-09-23) |
| File used | `data/spmrl/gold/token-single_gold_test.bmes` -> `raw/nemo_spmrl_token-single_gold_test.bmes` |
| URL | https://raw.githubusercontent.com/OnlpLab/NEMO-Corpus/38b10235a22998774311ab78a0078c8fb7dea57c/data/spmrl/gold/token-single_gold_test.bmes |
| Also kept (not converted) | `data/spmrl/gold/morph_gold_test.bmes` -> `raw/nemo_spmrl_morph_gold_test.bmes`. Morpheme-level text is not what a model sees, so it is not a gold set. It is here for diagnosing prefix boundaries |
| sha256 | token `6c0ebd10170d1197121cad86243161e99a130d448b91dad89959c90e0dbffe30`, morph `22ed93858d1563915ab0c6a54dc2935a291bd660f9df6a8c5e4651bf228eca2a` |
| Licence | **Unclear.** The repo has no licence for the data. Only `guidelines/LICENSE` exists (CC-BY-4.0, copied to `raw/NEMO-Corpus.guidelines.LICENSE`). The underlying text is the Hebrew Treebank (Haaretz), which UD_Hebrew-HTB licenses as CC-BY-NC-SA-4.0. OK for measuring. Never redistribute |
| Citation | Bareket, Dan and Reut Tsarfaty (2021). Neural Modeling for Named Entities and Morphology (NEMO²). *TACL* 9:909–928. doi:10.1162/tacl_a_00404. Also cite the Hebrew Treebank: Sima'an et al. (2001), *Traitement Automatique des Langues* 42(2) |
| Content | Test split: 706 sentences, 12,619 tokens. BIOES labels, 9 OntoNotes types. Numbers match the README table: PER 267, ORG 408, GPE 195, LOC 41, FAC 11 |

## 2. BMC split 1 test

| | |
|---|---|
| Repo | https://github.com/OnlpLab/HebrewResources |
| Commit | `3213134010bb1e2c58b7ee3391e7b9c21d5b9209` (master). This file was last changed in `641aae980ba4deac9b49ea172a5384af5e9b9427` |
| File | `BMCNER/splits/bmc_split.test.1.bmes` -> `raw/bmc_split.test.1.bmes` |
| URL | https://raw.githubusercontent.com/OnlpLab/HebrewResources/3213134010bb1e2c58b7ee3391e7b9c21d5b9209/BMCNER/splits/bmc_split.test.1.bmes |
| sha256 | `1cf77333e605f9ec0a88a2210ca64d18581fa68385e2eb27ec7444e7d1c4c827` |
| Licence | **None stated** (no LICENSE in the repo or in BMCNER/). Measure only. Never redistribute |
| Citation | Ben-Mordecai, Naama (2005). *Hebrew Named Entity Recognition*. MSc thesis, Ben-Gurion University (advisor M. Elhadad), https://www.cs.bgu.ac.il/~elhadad/nlpproj/naama/. The splits are from Bareket and Tsarfaty (2020), arXiv:2007.15620 (NEMO²) |
| Content | One of three random 75/25 splits. Types: PER, LOC, ORG, DATE, TIME, MONEY, PERCENT (MISC was removed by the splitters). IOB was converted to BIOES. 824 sentences, 15,680 tokens |

## 3. Knesset UD (UD_Hebrew-IAHLTknesset), dev + test

| | |
|---|---|
| Repo | https://github.com/UniversalDependencies/UD_Hebrew-IAHLTknesset |
| Commit | `e05de104dff1fd424b937678020a2f3e6d8458a0` (master, 2026-05-06, release v2.18 per the README changelog; tag `r2.18` is `fdd48fe676a4798d04b75bd7401ad5a4d196aa73`) |
| Files | `he_iahltknesset-ud-dev.conllu`, `he_iahltknesset-ud-test.conllu` (same names in `raw/`), plus `LICENSE.txt` and `README.md` copied as `raw/UD_Hebrew-IAHLTknesset.*` |
| URL | https://raw.githubusercontent.com/UniversalDependencies/UD_Hebrew-IAHLTknesset/e05de104dff1fd424b937678020a2f3e6d8458a0/he_iahltknesset-ud-test.conllu (and `-dev`) |
| sha256 | dev `bea61498172719a6562a1a93e17c6c379ca44538b9337b5edb44ad2e86a6ecc4`, test `9f646c1af22f58ca404be2be92481b3395683dfcb6d8cc31dbb4a530a6d3bd55` |
| Licence | CC-BY-SA-4.0 |
| Citation | Zeldes, Amir, Nick Howell, Noam Ordan and Yifat Ben Moshe (2022). A Second Wave of UD Hebrew Treebanking and Cross-Domain Parsing. *EMNLP 2022*, 4331–4344. Also: Goldin, Howell, Ordan, Rabinovich and Wintner (2024), The Knesset Corpus, arXiv:2405.18115 |
| NER field | MISC `Entity=`, a bracket notation on syntactic words: `(PER` opens, `PER)` closes, `(PER)` is a single word. There is no nesting, and no Entity on multiword-token lines. Types: PER ORG GPE LOC FAC TTL TIMEX MISC EVE WOA DUC ANG |
| Content | dev: 253 sentences in 8 `newdoc`s. test: 268 sentences in 11 `newdoc`s. Together: **19** newdoc units. PLAN.md says "11", but that is the test file alone. **The `# newdoc id` lines are misplaced:** each file's first sentences (26 in dev, 37 in test) come before any newdoc line, and 68 sentences sit under another document's marker. Every `sent_id` is `<doc id>-<n>`, those prefixes give the same 19 ids, and each prefix is one contiguous run, so the converter takes the document from the `sent_id` prefix (an earlier build grouped by the newdoc lines and glued the start of a dev debate and a test debate into one 63-sentence doc called `doc`) |

### IAHLT NER overlap (used only to drop sentences)

| | |
|---|---|
| Repo | https://github.com/IAHLT/hebrew_named_entities_open_dataset |
| Commit | `3b6af664266e14b0e5dbe829cc907bc7ba43f8c5` (main, 2024-09-02) |
| File | `unique_hebrew_samples_no_duplicates.jsonl` -> `raw/iahlt_ner_unique_hebrew_samples_no_duplicates.jsonl`, sha256 `d8566a86eeffdb0db60bf9481aef398e01bedf07c204773bd36b4da963ab6cba` |
| Licence | Apache-2.0 (the repo licence) |
| Rule | A Knesset UD sentence is dropped when its `# text` equals an IAHLT sample's text (after NFC, nikud removal and space collapsing), or when it has 5+ words and appears inside a sample. **56 of 521 sentences are dropped** (23 dev, 33 test, all by exact match), not the 40 the plan estimated. Four documents lose all their sentences (45 of the 56; IAHLT took whole debates), so **15 docs** remain |

## Conversion (the same for every set)

- Raw files: the converter checks each file's sha256 against the values above and refuses a changed or unpinned file. It also refuses to write its output anywhere inside the repo.
- Labels: PER/PERS -> PER, ORG -> ORG, GPE/LOC/FAC -> PLACE. The types the sets use that we do not score (TTL, TIMEX, MISC, EVE, WOA, DUC, ANG, DATE, TIME, MONEY, PERCENT) are dropped after decoding. Any other type is refused, not silently dropped.
- Mentions cover whole surface tokens, so a prefix letter is part of the mention. That is how NEMO token-single draws them. Knesset UD mentions on syntactic words are widened to their surface tokens.
- Documents: Knesset UD by document, read from the `sent_id` prefix (see above). NEMO and BMC have no article boundaries, so each doc is a block of 20 consecutive sentences, and bootstrap intervals on them are optimistic. Sentences are joined with `\n`.
- Tokens -> text: the rule is written in full in each gold file's `detok` field and in `DETOK_RULE` in the converter. In short: tokens are separated by one space, closing punctuation attaches to the word before it, opening brackets attach to the word after it, straight quotes alternate between opening and closing, and a hyphen between two words is glued (ב-1990, תל-אביב) while an en dash is spaced. Geresh and gershayim inside a token are left alone. Check: the rule reproduces Knesset UD's own `# text` exactly for 499 of 521 sentences.

## Counts (public; may go into the plan's results)

| Set | Docs | Sentences | Words (tokens) | PER | ORG | PLACE | Source types dropped |
|---|---|---|---|---|---|---|---|
| nemo-test | 36 | 706 | 10,561 (12,619) | 267 | 408 | 247 (GPE 195, LOC 41, FAC 11) | WOA 6, DUC 3, ANG 1 |
| bmc-test1 | 42 | 824 | 13,280 (15,680) | 373 | 273 | 318 (LOC) | DATE 106, PERCENT 49, MONEY 38, TIME 7 |
| knesset-ud | 15 | 465 (521 before the drop) | 7,402 (8,743) | 65 | 125 | 74 (GPE 63, LOC 9, FAC 2) | TTL 74, MISC 14, TIMEX 9, EVE 3, WOA 3, DUC 2, ANG 1 |

"Words" counts tokens that contain a letter or a digit. "Tokens" also counts punctuation.

## Contamination (which shortlisted models trained on each set)

| Model key | nemo-test | bmc-test1 | knesset-ud | Evidence |
|---|---|---|---|---|
| `base-q8` / `base-fp32` / `base-uint8` (dicta-il/dictabert-ner) | **unknown** | unknown | unknown | The card documents no training data. The DictaBERT paper (arXiv:2308.16687) fine-tuned its NER experiment "on the NEMO dataset… 6,220 sentences (7,713 entities)". 7,713 is the total for train+dev+test, and the paper does not say this experiment is the released model |
| `large-q8` (dicta-il/dictabert-large-ner) | unknown | unknown | unknown | Same as base |
| `msperka-dicta` (msperka/dictabert_ner @db09fbb) | **trained on NEMO**. Test held out as documented: the card names `nemo_corpus` (HF `imvladikon/nemo_corpus`, splits train/validation/test) and reports validation scores only | no | no | HF card |
| `aleph` (msperka/aleph_bert-finetuned-ner @aa98849) | **trained on NEMO**. Test held out as documented (same card template: validation scores) | no | no | HF card |
| `joint-base` (dicta-il/dictabert-joint) | **trained on NEMO**. Whether test was held out is **unknown** | no | **possibly**. Trained on "35K sentences from the IAHLT UD corpus" (paper), which may include the Knesset UD text. The IAHLT NER overlap is dropped, but that does not rule this out | card, arXiv:2308.16687 |
| `parse-base` (dicta-il/dictabert-parse) | **trained on NEMO**. The card says "tuned on the Hebrew UD Treebank and NEMO corpora" (the HTB is NEMO's own text). Test holdout **unknown** | no | **possibly** (initialised from joint) | HF card |
| `tiny-parse` (dicta-il/dictabert-tiny-parse) | **trained on NEMO**, as parse. Test holdout unknown | no | **possibly** (initialised from tiny-joint) | HF card |
| `iahlt-base` (iahlt/ner-baseline-dictabert-he) | no | no | trained on IAHLT NER. The 56 overlapping sentences are dropped. The remaining Knesset UD text is not in that dataset | HF card links the IAHLT open dataset |
| `hebert` (onnx-community/heBERT_NER-ONNX, from avichr/heBERT_NER) | no | **trained on BMC**. Its split is not documented, so split-1 test may be in its training data. Not counted for it | no | HF card: "tested on … Ben Mordecai and Elhadad (2005)" |
| `golem` (CordwainerSmith/GolemPII-v1) | no | no | no | Synthetic templates |

The `contamination` array in each gold file lists the keys marked trained or possibly trained on that set: nemo-test `msperka-dicta, aleph, joint-base, parse-base, tiny-parse`; bmc-test1 `hebert`; knesset-ud `joint-base, parse-base, tiny-parse`. The baseline's status is unknown and is not listed.
