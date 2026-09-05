# Benchmark

A synthetic corpus with known ground truth, scored through the whole chain.
Re-run after every detection change; compare `results.md` in the diff.

    npm run bench            # regenerate the corpus, run the chain with the model, write results.md
    npm run bench:nomodel    # the deterministic layers alone, written to results-no-model.md

## What makes it honest

**The key cannot drift.** `generate.js` composes each document from entity
objects and writes `key.json` from those same objects in the same pass. It
then asserts that every recorded surface form actually occurs in the text.
Nothing is annotated after the fact.

**The tool has never seen the names.** Every corpus name was probed against
every lexicon the detector carries: `FEM`, `MASC`, `WORDLIKE`, the fake-name
`POOL`, and `KNOWN_FIRST`, which unions them. Places are checked against
`PLACE_BY` as whole strings. The generator asserts this and refuses to
write a corpus that violates it. One category is exempt by design, "names
that are also common words": those six names are mandated, they are in the
tool's word lists precisely because they are words, and the results mark
them lexicon-aided.

**The pipeline is scored, not the model.** The earlier 3/13 typo number
scored the model alone; the product is a chain. `run.js` runs it as the
product does: `discover` and the model suggest, every suggestion is
confirmed (the realistic case), the engine replaces, the near-miss scan and
verification run, every one-tap fix is accepted, the engine replaces again.
The model is the same q8 artifact the browser loads, run under Node through
the engine's own chunking, alignment and cleaning.

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
a tap, and under accept-all each one marked **applied** replaced real text
with a fake name. They are attributed to the anchor or layer that produced
them, so a regression in one source shows up by name.

## Corpus

Twelve documents in three genres she works with: meeting summaries, court
filings, raw transcripts. 27 categories, each in at least three documents
so one lucky hit does not read as a pass. Two are marked expected to fail
by the design notes: a name mentioned once with a prefix letter only, and a
name that appears only in corrupted form. The corpus is committed under
`corpus/` with a `.txt` beside each `.docx` for reading.

`engine.js` loads `redact-engine.js` into Node with its full export list;
`.engine.cjs` is its generated output and is ignored.
