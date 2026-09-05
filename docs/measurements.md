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
