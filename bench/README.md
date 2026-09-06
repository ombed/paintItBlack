# Benchmark

A synthetic corpus with known ground truth, scored through the whole chain.
Re-run after every detection change; compare `results.md` in the diff.

    npm run bench            # regenerate the corpus, run the chain with the model, write results.md
    npm run bench:nomodel    # the deterministic layers alone, written to results-no-model.md (runs in CI)
    npm run gate             # compare results-no-model.json with baseline-no-model.json; report-only until GATE_BLOCKING=1
    node bench/sweep.js      # score every tunable at several values, write sweep.md (model on, ~10 minutes)
    node bench/spans.js      # characterise the model's span boundaries against the key, write spans.md
    node bench/from-leak.js report.json   # rebuild a document from a leak report and run the chain on it

## What makes it honest

**The key cannot drift.** `generate.js` and `corpus-more.js` compose each
document from entity objects and write `key.json` from those same objects
in the same pass. The generator then asserts that every recorded surface
form actually occurs in the text. Nothing is annotated after the fact.

**The tool has never seen the names — with one documented exception.** Since v18 the detector carries a list of 1,116 localities, and thirteen corpus place and org surfaces are in it. Town detection is a lexicon lookup by design, so this is marked rather than removed: `L_TOWN` hits are lexicon-aided in the same sense as `P_WORD`. What the corpus still measures honestly there is over-triggering, through `T_GAZWORD`.

**Every other name.** Every corpus name was probed against
every lexicon the detector carries: `FEM`, `MASC`, `WORDLIKE`, the fake-name
`POOL`, and `KNOWN_FIRST`, which unions them. Places are checked against
`PLACE_BY` as whole strings. The generator asserts this and refuses to
write a corpus that violates it. One category is exempt by design, "names
that are also common words": those names are mandated, they are in the
tool's word lists precisely because they are words, and the results mark
them lexicon-aided. PII surfaces (digits, addresses) are not names and are
not checked.

**The pipeline is scored, not the model.** `lib.js` runs the chain as the
product does, with the product's own option set read from the engine:
`discover` and the model suggest, every suggestion is confirmed (the
realistic case), the engine replaces, the near-miss scan and verification
run, every one-tap fix is accepted, the engine replaces again. The model is
the same q8 artifact the browser loads, run under Node through the engine's
own chunking, alignment and cleaning. `run.js` is the command; `lib.js` is
the library, so `sweep.js` can score patched engines side by side.

## Reading the columns

| column | meaning | cost |
|---|---|---|
| found | some surface form was surfaced somewhere, so she is asked | – |
| missed | surfaced nowhere | she is never asked |
| leaked | an identifying form survives in the final text | the failure the tool exists to prevent |
| false positives | a trap or public body was suggested or altered; or the two edit-distance-1 people were merged | one tap, or a corrupted sentence |

Leaked is counted even when it overlaps with missed, because they are
different questions. Matching is deliberately generous: a surfaced surname
counts as her being asked about the person.

"Unlisted suggestions" are values that match nothing in the key. Each costs
a tap. The count is reported in every table and **never optimised for**:
the list is read, accept-all is not how the tool is used, and a value tuned
against junk would trade recall for a user who does not exist. When a change
moves the junk count, the report says so and the decision is made on leaks.

## Corpus

Thirty documents in eight genres: meeting summaries, court filings, raw
transcripts, welfare reports, medical summaries, police statements, bank
letters, WhatsApp exports. 35 categories, each in at least three documents
so one lucky hit does not read as a pass. Two are marked expected to fail
by the design notes: a name mentioned once with a prefix letter only, and a
name that appears only in corrupted form. Six categories are PII that is
not a name (ID number, phone, email, bank account, plate, date of birth),
with valid check digits where the detector verifies them. The corpus is
committed under `corpus/` with a `.txt` beside each `.docx` for reading.

`engine.js` loads `redact-engine.js` into Node with its full export list;
`.engine.cjs` is its generated output and is ignored. `engine.js.load(patches)`
returns the same engine with textual patches applied, for the sweep.

## The gate

`gate.js` compares the deterministic run with `baseline-no-model.json` per
category and prints every category that got worse. It is report-only: the
CI step shows it, nothing fails. Once the numbers have held still for a few
runs, set `GATE_BLOCKING=1` in the workflow. Re-seed the baseline by copying
`results-no-model.json` over it when a change is meant to move the numbers.
