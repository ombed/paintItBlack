# Model exports

How the tier-1 candidates (PLAN.md sections 2 and 5.7) were turned into files that transformers.js
can load. Everything here was made on 2026-09-23 by `bench/model-eval/export.py`. The files live
outside the repo, in `C:/Users/Me/.vscode/paintItBlack/model-cache/<key>/`. Their sha256 and sizes
are in `registry.exports.json`.

## Running it

```
py -3 bench/model-eval/export.py download [key ...]   # pinned files only (about 4.8 GB for all)
py -3 bench/model-eval/export.py recipe-check          # re-export today's model, compare with the shipped q8
py -3 bench/model-eval/export.py export [key ...]      # refuses to run until recipe-check has passed
py -3 bench/model-eval/export.py agreement [key ...]   # q8 against its own fp32, on bench/corpus/*.txt
py -3 bench/model-eval/export.py registry              # writes registry.exports.json from model-cache/*/export.json
node tests/me_exports_t.js                             # registry shape, plus export.py's label and head helpers through py -3 (offline, about a second)
ME_EXPORT_FILES=1 node tests/me_exports_t.js           # also hashes every file on disk (about a minute)
```

On this PC the whole export takes about 10 minutes once the downloads are in. Each
`model-cache/<key>/` folder holds `config.json` (with `id2label`), `tokenizer.json`,
`tokenizer_config.json`, `special_tokens_map.json`, the vocab file, `onnx/model.onnx` (fp32),
`onnx/model_quantized.onnx` (q8), `export.json` (every number below) and `SOURCE_README.md` (the
model card at the pinned revision, kept for its licence and data claims).

## The recipe

### How each model is loaded

- **Pinned revision:** each model is pinned to a 40-hex revision. Downloads take top-level files only: config, `model.safetensors`, tokenizer files and README. Nothing else is fetched: no `optimizer.pt`, `scheduler.pt`, `checkpoint-*`, `runs/` or `training_args.bin` (a pickle), and no custom modelling `.py`.
- **Weight files:** every model has safetensors, so no `.bin` was opened. If one ever is, it goes through `torch.load(weights_only=True)`.
- **Stock classes only:** weights go into a stock `BertForTokenClassification` or `XLMRobertaForTokenClassification`, built from the config with `trust_remote_code=False`. `load_state_dict` must report **no missing keys and no unexpected keys** (only the `position_ids` buffer is ignored). For the multi-head models this is checked after the other heads are dropped, so a leftover `bert.*` weight stops the export instead of being dropped silently.
- **joint, parse and tiny-parse:** the checkpoint holds `bert.*` plus five heads. I read `BertForJointParsing.py` at the pinned revision (read only, never run). Its NER output is `self.classifier(dropout(bert(...)[0]))`, which is exactly the stock token-classification path, with the same key names (`classifier.weight`, `classifier.bias`, 27 × hidden). So the export keeps `bert.*` and `classifier.*` and drops the other heads: `cls` (MLM), `morph`, `prefix` and `syntax`. The config is rewritten to `BertForTokenClassification`, without `auto_map` or the `do_*` flags. `id2label` is the checkpoint's own 27-label BIO set, the same one today's model uses.
- **Attention:** set to `eager`, so the graph has plain Softmax attention like the shipped file.

### Export

- `torch.onnx.export(..., opset_version=14, dynamo=False)`: the TorchScript exporter, which is what produced the shipped graph.
- Inputs: `input_ids`, `attention_mask` and `token_type_ids`. XLM-R (golem) has no `token_type_ids`.
- Output: `logits`. Batch and sequence axes are dynamic.

### Logit check

PyTorch and ONNX Runtime are run on 20 Hebrew sentences I invented, stored in `export.py`. They cover court, meeting, letter and spoken styles, prefix letters, nikud and one Latin sentence. The largest absolute difference must be below 1e-3.

### Quantization: the same recipe as the shipped onnx-community q8

I read the shipped file (`onnx-community/dictabert-ner-ONNX`, `onnx/model_quantized.onnx`, 184,984,466 bytes, sha256 `fd7ac841…`) node by node:

| What | Shipped file |
|---|---|
| Producer | `onnx.quantize 0.1.0`, metadata `onnx.infer = onnxruntime.quant`, opset 14 |
| Mode | ORT **dynamic** quantization, `IntegerOps`: `DynamicQuantizeLinear` (49) → `MatMulInteger` (73) |
| MatMul weights | **int8**, **per channel** (a scale vector of 768, 3,072 or 27 per matrix), **symmetric** (zero point 0), **reduce_range** (values within −64…64, i.e. 7 bits) |
| Activations | uint8, computed at run time by `DynamicQuantizeLinear` |
| Embedding tables (word, position, token type) | `Gather` on a **uint8 per-tensor symmetric** table (zero point 128), then `DequantizeLinear` (3) |
| Not quantized | the attention `MatMul`s between activations (24): only MatMuls with a constant B |

That is transformers.js `scripts/quantize.py` in its `q8` mode: `ONNXQuantizer(per_channel=True, reduce_range=True, mode=IntegerOps, static=False, weight_qType=QInt8, activation_qType=QUInt8, op_types_to_quantize=<all IntegerOps types>, extra_options={EnableSubgraph: True, MatMulConstBOnly: True})`.

**One change is needed on today's ORT (1.29): `ActivationSymmetric=True`.** The ORT that made the shipped file quantized a `Gather`'s table with the *weight* symmetry, which gives zero point 128. ORT 1.29 uses the *activation* symmetry, whose default is asymmetric. My first recipe check therefore changed every embedding value: the zero points came out as 53, 56 and 114 instead of 128. Setting `ActivationSymmetric=True` restores the old behaviour. It does not affect anything else, because the activations are quantized at run time by `DynamicQuantizeLinear`, which ignores the option.

### Recipe check (today's model, `recipe-base`)

I re-exported `dicta-il/dictabert-ner@05ed61b` with this recipe and compared it with the shipped q8:

| Check | Result |
|---|---|
| Quantization parameters (every scale, zero point and quantized weight value of the 73 `MatMulInteger`s, 3 `Gather`s and 3 `DequantizeLinear`s: 228 tensors) | **identical, bit for bit** (largest scale difference 0.0; 0 quantized values differ) |
| Quantized op counts (`MatMulInteger`, `DynamicQuantizeLinear`, `DequantizeLinear`) | equal |
| Token labels on `bench/corpus/*.txt` (43 texts, 4,846 tokens, 510-token windows) | **4,837 / 4,846 = 99.81 %** (the gate is 99.5 %) |
| The same, counting only tokens that either file tags as an entity | 948 / 957 = 99.06 % |
| For scale: shipped q8 against my fp32 | 99.46 % of tokens, 97.31 % of entity tokens |

**What the remaining 9 tokens come from:** not the recipe, since the weights are identical. They come from the fp32 graph. The newer exporter writes the attention mask and scaling with different ops: the shipped file has `Where`, `Equal` and `Expand`, and 37 `Div`; mine has 49 `Div` and 324 `Constant` nodes. The float values that feed `DynamicQuantizeLinear` therefore differ in the last bits, and a few activations round to a different int8 step. That is a new-exporter effect, and every candidate gets it the same way.

## Per model

"q8 vs fp32" is the share of tokens (and of entity tokens) that keep the same argmax label after quantization. It is measured on the 43 synthetic corpus texts. It shows what 8-bit costs each model, which the plan's fp32 rows are meant to measure.

| Key | Source @ revision | Logit max diff | fp32 bytes | q8 bytes | q8 vs fp32: tokens / entity tokens | Labels |
|---|---|---|---|---|---|---|
| `recipe-base` (check only, not in the registry) | dicta-il/dictabert-ner @05ed61bc99437b13bc2bdef8154c52f8b44eaad6 | 1.6e-5 | 735,339,574 | 184,983,343 | 99.48 % / 97.42 % | BIO, 13 types |
| `joint-base` | dicta-il/dictabert-joint @3c3c27067bb73a45e99c36bd90b3b3dbc10fda12 | 1.2e-5 | 735,339,574 | 184,983,343 | 99.09 % / 95.34 % | BIO, 13 types |
| `parse-base` | dicta-il/dictabert-parse @37f4d6fd556766f15e955fe5bd0f16942b46853e | 1.2e-5 | 735,339,574 | 184,983,343 | 99.30 % / 96.02 % | BIO, 13 types |
| `tiny-parse` | dicta-il/dictabert-tiny-parse @8e97fcdcec347e1ef1b24d82c01d4fc73989ece8 | 1.7e-5 | 178,781,800 | 44,931,040 | 99.11 % / 94.28 % | BIO, 13 types |
| `iahlt-base` | iahlt/ner-baseline-dictabert-he @835ee823e4425639a4ee881382fad87e294d0974 | 1.1e-5 | 735,299,585 | 184,973,238 | 99.32 % / 97.17 % | IO (bare type names), 13 types |
| `msperka-dicta` | msperka/dictabert_ner @db09fbb80715f42876f8f4814d48765d96c87b42 | 1.8e-5 | 735,370,335 | 184,991,115 | 99.57 % / 97.72 % | BIOES, 9 types |
| `aleph` | msperka/aleph_bert-finetuned-ner @aa98849ee5c29139c1d96532502ed152bb72f831 | 9.8e-6 | 501,895,261 | 126,622,347 | 99.71 % / 98.58 % | BIOES, 9 types |
| `golem` | CordwainerSmith/GolemPII-v1 @5f2324a261001f1ca4f7f97bcabf2303a58487cd | 1.8e-5 | 1,110,140,294 | 278,701,529 | **94.93 % / 79.16 %** | BIO, 12 PII types |
| `large-q8` | dicta-il/dictabert-large-ner @ac70130828d5a6811c2dc451e2255424c96f0eb0 | 2.4e-5 | 1,736,218,525 | 436,857,304 | 99.65 % / 98.29 % | BIO, 13 types |

- Every export passed the logit check. The largest difference is 2.4e-5, well under the 1e-3 limit.
- On the 20 sentences, the PyTorch and ONNX fp32 argmax labels agree on every token, for every model.
- Every export loads and runs in transformers.js in Node, at both q8 and fp32, from `model-cache/` with `allowRemoteModels=false` and `bench/engine.js` loaded first (for the RegExp wrapper).
- `registry.exports.json` holds 16 entries: a `q8` and a `<key>-fp32` entry for each of the 8 candidates. Each entry has `source: "local"`, `localPath`, the sha256 and byte count of its own file, `labelScheme`, `labelMap` built from `id2label`, the tokenizer kind, the licence, `shippable` and `trainedOn`.
- Label maps: PER/PERS/FIRST_NAME/LAST_NAME → PER; ORG → ORG; GPE/LOC/FAC/CITY/STREET/POSTAL_CODE → PLACE; the types in `export.py`'s `DROP` list (ANG, DUC, EVE, WOA, INFORMAL, MISC, TIMEX, TTL, and golem's number, date and contact types) → `null` (dropped on purpose, the same as `base-q8` in `registry.json`, and listed in each entry's notes). A type in neither list stops `registry`, so a new name type can never become `null` by default.

Licences come from the cards at the pinned revision: CC-BY-4.0 for the dicta-il, iahlt and msperka/dictabert models; Apache-2.0 for aleph; MIT for golem. All are shippable.

Training data (`trainedOn`), from the cards:

| Key | What the card says |
|---|---|
| `msperka-dicta`, `aleph` | NEMO |
| `iahlt-base` | the IAHLT open NER dataset |
| `golem` | GolemGuard (synthetic) |
| `parse-base`, `tiny-parse` | Hebrew UD and NEMO, starting from the joint models |
| `joint-base` | Names no NER data. "NEMO plus IAHLT" is from the paper, and the entry's notes say so |
| `large-q8` | Unknown |

## Problems and things the other parts should know

1. **golem loses a lot to 8-bit.** Its q8 keeps only 79 % of its fp32 entity-token labels; the other models keep 94–99 %. On one test sentence, q8 dropped a LAST_NAME that fp32 found.
   - The recipe is the same for every model, as the plan requires, so this is golem's real cost at q8.
   - Its likely cause is the 250k-row XLM-R embedding table in per-tensor uint8, or activation ranges that 7-bit weights handle badly. I did not test either.
   - Judge golem on its fp32 row too. A golem q8 with a different recipe would be a separate, non-like-for-like row. I have not made one.
2. **golem's size:** 279 MB of q8 plus a 17 MB `tokenizer.json`, about 296 MB in total. That is amber under the plan's budget.
3. **large-q8's size:** 437 MB (417 MiB). That is amber, just under the 450 MB red line.
4. **Fixed padding in two tokenizer files.** iahlt's and golem's `tokenizer.json` pad every input to a fixed 512 tokens and truncate at 512. msperka and aleph truncate only.
   - transformers.js and `AutoTokenizer` ignore these settings.
   - The raw Python `tokenizers` library applies them. My first run fed those two models 512-token padded inputs with an all-ones mask, which is what made golem's logit difference look like 9e-4. `export.py` now calls `no_padding()` and `no_truncation()`.
   - **The tokenizer-parity check must do the same**, or it will compare against padded IDs.
   - The files are copied unchanged from the source repos.
5. **The candidates' tokenizers are not today's tokenizer**, even though all six DictaBERT-family ones share today's vocab exactly. Compared with today's `tokenizer.json`:
   - `tiny-parse`: identical.
   - `joint-base`, `parse-base`, `iahlt-base`, `msperka-dicta`:
     - The normalizer replaces characters outside Hebrew, ASCII and punctuation with the literal text `UNK`, which is then word-pieced. Today's tokenizer writes `[UNK]`.
     - The pre-tokenizer lacks the leading `\[UNK\]|` alternative.
     - So Arabic, Cyrillic and emoji become different tokens, and `nerAlign` may place them differently.
   - `large-q8`: the normalizer's character class reads `\u0000-\u200c` where today's reads `\u0000-\u007f`. So almost no foreign character is replaced at all.
   - The engine's RegExp wrapper was written for today's pattern and may rewrite these variants differently. The tokenizer-parity check (PLAN 3.1) should cover them with and without the wrapper.
   - `joint-base`'s `tokenizer_config.json` names `PreTrainedTokenizerFast`, not `BertTokenizer`, so transformers.js builds its generic tokenizer class. It does not emit `token_type_ids`, and transformers.js fills them with zeros, which is what the model expects. It loads and runs, but the parity check should include it.
6. **Labels that need an adapter:**
   - `iahlt-base` labels are bare type names (`PER`, not `I-PER`). The registry says `IO`, and the adapter must accept labels with no prefix.
   - `golem` splits FIRST_NAME and LAST_NAME. Adjacent ones must merge into one PER (PLAN 5.3).
7. **Exporter deprecation.** `torch.onnx.export(dynamo=False)` prints a deprecation warning in torch 2.14. It still works, but a future torch may remove it. The recipe check would catch a graph change.
8. **Downloads over xet stalled at 0 bytes on this machine.** `export.py` sets `HF_HUB_DISABLE_XET=1`, and plain HTTP downloaded about 4.8 GB in about 5 minutes. Windows has no symlinks here, so the HF cache stores full copies.
9. **Model cards:**
   - golem's card asks for a citation line wherever it is used.
   - CC-BY-4.0 needs attribution if any of these ships. `SOURCE_README.md` in each folder keeps the card as it was at the pinned revision.
