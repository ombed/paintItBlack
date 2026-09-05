# Claude Code task — Hebrew document redaction tool

## What this is

A browser-only tool that strips identifying details from Hebrew legal
documents (Word `.docx`) before a lawyer pastes them into an AI chat, and
puts the real names back into the AI's reply. **Nothing ever leaves the
user's machine** — parsing, detection, replacement, verification and
restore all run in the browser. There is no server-side compute.

Live at `https://ombed.github.io/paintItBlack/` (GitHub Pages, static only).

The user is a family-law attorney. Her documents come from **audio
transcription**, which means the same name often appears in two spellings.
That single fact drives most of the design.

## Architecture — do not change this

The tool deliberately does **not** rely on the NER model for correctness:

1. She types (or confirms) **who is in the case**. She knows this better
   than any model — it is her file.
2. A deterministic engine then covers **every form** of each confirmed
   name: full name, surname alone, first name alone, Hebrew prefix letters
   (ב/ל/מ/כ/ש/ו/ה), hyphen/space variants, nikud.
3. A near-miss scanner catches transcription typos of confirmed names
   (`שלוה` vs `שלווה`) using edit distance 1, restricted to plausible
   Hebrew confusions: homophone substitutions and matres-lectionis
   insertions/deletions.
4. Verification re-reads the output archive and proves the values are gone.
5. The NER model is a **suggestion layer only** — it decides what to *ask*,
   never what to *replace*. This is what makes it safe to use a model that
   misses ~10% of mentions.

**The model must never silently auto-replace anything.** If you find
yourself removing a confirmation step, stop.

---

## Task 1 — establish and verify the baseline

The repo currently holds a working vanilla build. A redesign from Claude
Design exists with a better visual language and extra features (PDF input,
paste-text input, redaction report, towns map, dark mode, step navigation).

The user is getting a corrected export from Claude Design and will drop it
in. When it lands:

1. Confirm the engine contains all four model fixes — search for
   `nerPrepTokenizer`, `jsonRes`, `RX_NATIVE`, `RAW_FETCH`. If any are
   missing, port them from `redact-engine.js` in this folder, which is the
   known-good version.
2. Confirm `rxBad` calls `new RX_NATIVE(...)`, **not** `new RegExp(...)`.
   If it calls the wrapped `RegExp`, the wrapper swallows the error, every
   pattern looks valid, and nothing gets fixed. This bug cost us a full
   debugging round.
3. Confirm the UI has the scan-generation guard (`this._scan`). Without it,
   uploading a second document mid-scan injects names from the first case
   into the second — a privacy bug in the wrong direction.
4. Grep the built HTML for `{{` and `<sc-if`. **Zero occurrences.** The
   previous Design export shipped 300 unrendered template placeholders that
   displayed as raw text on screen.

## Task 2 — set up the test suites

`tests/` contains 12 Node suites, 258 assertions, written against the
vanilla build. They currently extract the engine from `app.html` via
`extract.py`. **Adapt them to import the repo's engine module directly**
and wire them to `npm test`.

What they cover, roughly:

| suite | covers |
|---|---|
| `t.js` | typo scanner, fake-name generation, restore |
| `e2e.js` | full pipeline on a generated `.docx` |
| `edge.js` | names that are also words, orgs, titles, double spellings, nikud, triple names, profile collisions |
| `case.js` | same pseudonyms across two documents in one case |
| `org_t.js` | ORG kind end to end |
| `ner_t.js`, `align_t.js` | model output cleaning, truncation repair, prefix stripping, token alignment |
| `tok_t.js`, `diag_t.js` | tokenizer JSON repair, cache handling, failure paths |
| `race_t.js` | scan/user race conditions |
| `flow.js`, `theme_t.js`, `ui.js` | DOM wiring, dark mode |

`tests/protocol.txt` is a real Knesset committee transcript used as
realistic input. It contains a genuine transcription artifact — the same
person appears as both `שלוה ליבוביץ` and `שלווה` — which is the exact
failure mode the tool exists to catch. Keep it.

**Add what I could not:** a Playwright test that loads the built page in a
real browser, enables the model, drops a `.docx`, and asserts the console
shows `טוקנייזר: … JSON תקין ✓` followed by a `זיהוי:` line with a non-zero
entity count. Every hard bug in this project came from not being able to
run a real browser. Fix that first — it will pay for itself immediately.

## Task 3 — git workflow

- Work on a branch, never straight to `main`.
- Every commit must leave `npm test` green.
- Bump `BUILD` in the page and `V` in `sw.js` on every deploy. The visible
  build string is how we tell whether the browser is showing new code —
  three debugging rounds were wasted on stale cache before we added it.
- `sw.js` must stay **network-first for same-origin**. Cache-first serves
  stale code on the first load after every update. Model weights are
  managed by transformers.js in its own cache — do not touch
  `huggingface.co` requests in the service worker.
- After pushing, verify the live URL serves the new `BUILD` string.

## Acceptance checklist

1. Build string on screen updates after deploy without manually clearing cache
2. No `{{ }}` or `<sc-if>` visible anywhere
3. Model toggle on → drop a `.docx` → model loads with no console error
4. Console shows `טוקנייזר: … JSON תקין ✓` then `זיהוי: N chunks … M entities`
5. In that `זיהוי:` line, scanned-chars ≈ total-chars — a large gap means
   part of the document was never scanned
6. People list fills with names from the document
7. Swapping documents mid-scan does not leak names between them
8. Opened from `file://`, the tool explains the model is unavailable and
   everything else still works
9. `npm test` green

---

# Task 4 — separate experiment: is a bigger model worth it?

Run this **outside the app**, in a scratch folder. Do not wire anything
into the product until the numbers justify it.

## The question

We run `onnx-community/dictabert-ner-ONNX` (BERT-base) at `dtype:"q8"`.
Measured weaknesses on a real transcript:

- Missed 3 of 4 injected transcription typos (`אזולי`, `סבתלנה`, `מיזרחי`)
- Occasional misses on names mentioned once with a prefix letter

Three hypotheses, in increasing cost. **Test them in this order and stop
when the numbers stop justifying the next step.**

### H1 — quantization is the problem (free)

We run int8 in the browser; the reference run was fp32 in Python and did
noticeably better. Run the same document through `q8`, `fp16` and `fp32`
via transformers.js in Node and compare recall. If most of the gap is
quantization, the fix is a dtype change, not a new model.

### H2 — two passes beat one (cheap, targets the known weakness)

Run the model twice: once on the raw text, once on a normalised copy
(strip nikud, collapse `וו`→`ו`, `יי`→`י`), then map hits back to original
offsets and union the results. `אזולי` normalised resembles `אזולאי`.
Costs 2× inference, no training, no new model. Measure the recall gain and
the false-positive cost.

### H3 — BERT-large (real work)

`dicta-il/dictabert-large-ner` exists but **has no ONNX export** — only the
base model does. Convert it:

```
optimum-cli export onnx --model dicta-il/dictabert-large-ner --task token-classification out/
```

then quantize to int8 and test under transformers.js. For reference,
someone converted another Dicta large model and reached ~300MB quantized.

Two things to watch:

- **Its `tokenizer.json` will have the same `\"` bug.** The Rust regex
  engine accepts `\"`; JavaScript under the `u` flag does not. Apply the
  same `fixTokJSON` repair — see `redact-engine.js`.
- Download size and inference time roughly double. On an 18k-word document
  base already takes ~35s in-browser. If large pushes that past ~90s it is
  probably not worth it for this user, however good the accuracy.

## How to measure

`tests/protocol.txt` plus the ground-truth sets in the existing Python
harness the user has (`ner_experiment.py`). Report one table:

| variant | PER recall | false positives | typo robustness | size | sec/1k words |
|---|---|---|---|---|---|

Include `base-q8` as the baseline row so every number is a delta against
what ships today.

## What "better" means here

Recall matters far more than precision. A false suggestion costs one tap.
A missed name in a document sent to an AI chat is the failure this whole
tool exists to prevent. Weight accordingly — but do not silently trade
away speed: she will not wait three minutes for one document.
