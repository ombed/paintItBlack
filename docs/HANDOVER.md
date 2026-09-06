# Handover — the night of 2026-09-05/06

Branch `night-1`, PR #8, one commit per item. Nothing merged; main is still v13.
Every commit left `npm test` green; the last one bumps to v14.

## What changed

**Sprint A, all six items.** CI runs lint, the Node suites, the browser
suite, the deterministic benchmark and the report-only gate on every PR
(`.github/workflows/test.yml`). `npm run bump <n>` writes the six version
sites and `tests/version_t.js` proves they agree. The design-canvas file is
generated from `index.html` (`npm run build:design`), so the two 1,700-line
twins are one source. The drifting reference engine and the Python
extractor are gone. LICENSE (MIT), CHANGELOG, tag `v13`, a Hebrew issue
template for leaks, `.gitattributes`, ASCII file names. The map libraries
load only when the map is opened.

**Sprint B, four of five.** The engine is edited as nine sections under
`engine/` and concatenated byte-for-byte into `redact-engine.js`
(`npm run build:engine`, checked by `tests/engine_t.js`). ESLint with
`no-undef` runs inside `npm test`; it found one real bug (a regex class in
the grouper had lost a backslash). `support.js` carries a provenance header
and `scripts/diff-runtime.js` fingerprints it. `page-logic.js` holds the
first DOM-free page logic with Node tests. Not done: the strings table
(item 11) and moving `groupsOf`/`mapView`/`buildReport` out of the class
(the rest of item 7). Both are mechanical; neither blocks anything.

**The three research items.** Each has a section in `docs/measurements.md`
and full tables in `bench/`.

1. *Parameter sweep* (`bench/sweep.md`). Two guesses were wrong by a
   little: the confidence floor is better at 0.6 than 0.7 (one leak fewer,
   no junk cost; 0.9 doubles leaks), and the shortest fragment swept alone
   is better at 2 than 3 (two-letter surnames were never swept at all).
   Both adopted. The verb layer was off whenever the model ran; on, it
   closes four leaks for five junk suggestions; adopted. Every near-miss
   parameter (confusable pairs, matres lectionis, lengths) is flat on this
   corpus: no value moves any column. That is not evidence they are right,
   it is evidence the corpus has too few transcription errors to test them.
2. *Span boundaries* (`bench/spans.md`). The four hypotheses were all
   wrong. Punctuation: 1 of 329 occurrences. Chunk edges: 1. Verbs: 0.
   Titles: benign. The real failure, 94 of 329, was the model labelling only
   the first sub-word of each word and the grouper treating the O on the
   continuation sub-word as a break, so "דסטה טספאיי" reached the list as
   "דס" and "טס". Fixed in the grouper: cut-inside-a-word 94 → 20, exact
   spans 159 → 228. That alone did not move the leak count, so the second
   approach went in alongside: hyphens stay inside a name, a trailing
   preposition is cut from a place, and the street name alone is swept once
   an address is replaced. Together the leak count fell 16 → 5, then 4 with
   the floor from the sweep.
3. *Surname length.* The threshold was 3: parts shorter than three letters
   never entered the uniformity sweep, so "כץ" leaked five times in a probe
   while "סבג" and "דהן" were fully handled (the older ≤3 word-like rule had
   already been lowered to 2 in PR #5). It is now 2, review-only for
   two-letter parts.

**Detection, beyond the research.** פלוני/אלמוני are never suggested; the
verb layer no longer glues a negation or preposition onto a name
("איוונוב ואינו"); the model output's trailing preposition is trimmed after
the public-body checks, not before (trimming before turned "משרד הרווחה"
into "הרווחה" and suggested it; that regression was caught by the bench and
reverted the same hour).

**Benchmark.** 12 → 30 documents, 3 → 8 genres, 114 → 215 keyed entities,
35 categories including six kinds of non-name PII with valid check digits.
The runner is a library (`bench/lib.js`) reading the product's own option
set from the engine, which exposed that the old bench ran a layer the
product had turned off. Junk is counted in every table and marked as not
optimised for. The gate is seeded and report-only.

**Profile durability.** The case profile is written to the browser after
every change, offered on the next visit by case name with a count and a
time, exportable under the case name, and leaving the check screen without
an export asks first. Two browser checks.

**Leak report.** Marking a missed name by hand on the check screen records
the shape of the miss: word count and lengths, prefix letter, hyphen,
classes of the words before and after, occurrence counts, whether a longer
or shorter form was already listed, and what each layer thought of that
span (discover, the model with boundary class, near-miss, suggestions).
Never the text; the report builder refuses any shape carrying three Hebrew
letters in a row. `bench/from-leak.js` rebuilds a synthetic document from
a report and runs the chain on it; on the two sample shapes it reproduced
one find and one miss. The issue template asks for the paste.

## What the numbers say now

Model on, product options, the 30-document corpus (`bench/results.md`):

| | start of night (12 docs) | start of night (30 docs, honest options) | now |
|---|---|---|---|
| leaked | 5 | 16 | 4 |
| missed | 3 | 9 | 4 |
| false positives | 1 | 3 | 2 |
| junk suggestions | 19 | 36 | 42 |

The four remaining leaks: the two expected-fail categories (a name seen
once behind a prefix letter; a name only ever misspelled), and two two-word
towns the gazetteer does not know ("בית זית", "בית אריה"). The two false
positives are bench artefacts of confirm-everything: a flagged case number
and the idiom "עם שחר" next to a person named שחר.

Real transcript (`npm run report`): PASS on all three facts; 1,643 ms with
the near-miss scan, 970 without. Node suites 210 assertions, browser 25
checks, lint clean.

## What I deliberately left

- **Strings table** and the rest of the page-logic extraction. Mechanical,
  no risk, no measurement to gain; a quiet afternoon.
- **Gazetteer.** Two of four leaks are towns missing from `PLACE_BY`. The
  bench cannot measure a gazetteer change honestly because its towns are
  chosen to be unknown; the lever is a bigger settlement list from the same
  atlas the map already loads, measured on real documents.
- **Near-miss parameters.** Unmeasurable until the corpus has documents
  with dense transcription errors. Keying `tests/protocol.txt` (46 real
  people, real errors) would be the honest instrument.
- **The gate stays report-only.** Flip `GATE_BLOCKING=1` in the workflow
  after two or three green runs on main.
- **LICENSE is MIT.** A one-line decision you may want to make differently;
  reversible by editing one file.
- **No third-party review of the corpus text.** The 18 new documents are
  synthetic Hebrew I wrote; a native reader should skim `bench/corpus/*.txt`
  for anything unnatural that could bias the model.

## The one thing I would do next

Key the real Knesset transcript as a benchmark document. It is the only
text in the repo with real transcription errors, real speaker turns and 46
real people, and it is exactly the kind of document that makes the
near-miss layer earn its keep. Until it is keyed, the confusable-pair table
and the matres lectionis rule are unmeasured, and the sweep says so in
every row.

## For the morning

1. Read `bench/results.md`, `bench/sweep.md`, `bench/spans.md`.
2. Merge #8, then check the live chip reads v14 and CI is green on main.
3. Decide on the LICENSE and on flipping the gate.
