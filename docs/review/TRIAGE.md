# Triage of the outside review of 2026-09-20

The review ran against commit `9ccff03` (v48) under `docs/review/CHARTER.md`. It reported
2 Critical, 15 High, 32 Medium and 30 Low findings, each of which survived a refutation
pass. This file is the maintainer's answer: what was checked, what is fixed, what is
planned and in which order, and what needs a decision from the owner.

**How each finding was handled.** The reviewer warned that one false claim survived its own
refutation, so nothing is fixed on its say-so. Every finding fixed below was first
reproduced here, got a test that fails on the old code, and was fixed in its own commit.

## Fixed

| # | Finding | Where | Release |
|---|---|---|---|
| C1 | The leak report exported raw identifiers beside the marked name | `page-logic.js`: gap classes, paragraph-bound context, schema serialiser | v49 |
| C2 | A name only in a chart label, SmartArt or document variable was proposed by nothing | `engine/08-docx.js`: `readBlocks`, `stripHidden`, chart-label proposals | v49 |
| H1 | "New document" kept the previous client's leak shapes, restored text and more | `index.html` reset; `tests/state_t.js` accounts for every state key | v49 |
| H13 | The model-on benchmark was 14 engine commits stale | regenerated at v49: 248 found, 6 leaked, 4 false positives | v49 |
| H2 | A failed verification did not stop the download | `exportGuard` consults the verification, asks, then allows (owner's decision) | v50 |
| H3 | «מקור» showed the redacted text | brace-less `else` in `renderVals` | v50 |
| — | A Hebrew PDF line split by formatting came out reversed (a suspicion, confirmed), and `pdf-text.js` had no behavioural test (M11) | `pdf-text.js`, `e2e/pdf.spec.js` | v50 |
| H9, M10 | Pages deployed beside the tests, not after them; no live check, no rollback | `pages.yml` on `workflow_run`, a verify job, `live/vNN` tags, `docs/ROLLBACK.md` | #63 |
| M9 | `build-site.js` deleted whatever path it was given | it replaces only a folder it built | #63 |
| H4 | The browser self-check read "could not run" as "found nothing" | `selfCheckOf` in `e2e/base.js`: `no-hook`, `check-threw` | #64 |
| H5 | `decisions.spec.js` asserted nothing | asserts the state and the visible strip; fails on a mutant | #64 |
| H6, H7, M18, M19 | Five engine passes had no test | `tests/passes_t.js`, proven by `npm run mutants` | #64 |
| M7, L25 | The Node runner ignored exit codes and pinned no count | exit codes, `tests/floors.json`, `tests/runner_t.js` | #64 |
| H12 | The benchmark could not see a surviving two-letter surname | `bench/lib.js`, `tests/benchlib_t.js` | #64 |
| L1, M23, M24 | Three tests that could not fail | real assertions; the privacy guard requires git to have run | #64 |
| M8, L2, L3 | Tooling guards | dynamic imports in `site_t`, forward-only bump, the test server's path check | #64 |
| H11 | A removed name came back in the next document of the case | `removed` in the case profile; it returns only as a visible question (owner's decision) | v51 |
| H8 | «אל תחליף» on a place was overridden in seven prefix forms | `geoRemove` clears the rule; the allowance uses the rules' own prefix lists | v51 |
| M1 | "Delete case" left the name map in the browser | the mirror profile goes with the case | v51 |
| M3 | A model failure was invisible once she had moved on | a notice on the screen she is on | v51 |
| H10 | Field codes, table alt text and the page-one thumbnail were not walked | hidden blocks, link scrub in field codes, thumbnail dropped | v51 |
| L14 | Three files named three licences | PolyForm Shield 1.0.0, pinned by `tests/license_t.js` (owner's decision) | v51 |
| H15, L16–L18 | The brief and the charter were wrong in four places | a corrections section in `BRIEF.md` | v51 |
| M14 | Four places stated a gazetteer rule the code stopped keeping | comments in `06-model.js`, `07-gazetteer.js`, `build-gazetteer.js`; PLAN-v18 marks its rule superseded | v54 (pending) |
| M15 | `Q<n>` meant several numbering schemes | bare references name their source; a numbering note in PLAN-v18. Not `index.html` (see Batch E) | v54 (pending) |
| M13 | A partial sweep re-run rewrote the whole `bench/sweep.md` | `--only` merges, per-section provenance, `tests/sweep_t.js`; the last full sweep restored from git | v54 (pending) |
| M12 | `measurements.md` cited an instrument that is not in the repo | it says what can and cannot be reproduced, and traces the sweep table to its run | v54 (pending) |
| H15 | The complexity list had no command behind it | `scripts/complexity.js`, `tests/complexity_t.js`, pinned in the charter; v53 top ten in the brief | v54 (pending) |
| L16 | "Commands are in the charter"; the churn window | the charter lists the commands and the numbers with none | v54 (pending) |
| L17, L18 | Which CDN loads happen when; "No Subresource Integrity" in the charter | brief corrections; the charter states the five-of-seven | v54 (pending) |
| L22, L24 | "4 false positives" without the junk; 63% of the checks one matrix | brief corrections, with today's measured numbers | v54 (pending) |
| L11 | `bodyNames`' 3/2/1 scale and cutoff documented nowhere | a comment in `05-bodynames.js` | v54 (pending) |
| L13 | Stale counts and tolerance in `QUALITY-PLAN.md` | dated counts, 1.5 px | v54 (pending) |
| L15 | README prose pointed at a line number and a label that do not exist | names the string and «מודל זיהוי עברי מקומי» | v54 (pending) |
| L21 | `T_GAZWORD` prices the harmful gazetteer change lightly | measured and recorded in `measurements.md`: judge by the per-entity diff | v54 (pending) |
| Nits 2, 8, 9 | eight vs twelve; three restating comments; two scripts that crash opaquely | comments; `log-report.js` and `diff-runtime.js` with tests | v54 (pending) |
| M25 | A scan layer that threw read as "found nothing" (body scan, labels, model chunks) | `verification.incomplete`, a red bar and an export question; `tests/failopen_t.js` | v53 |
| H10 (rest) | WordArt, list-number text and style names were not walked | read and cleared; a last pass clears listed values from every unwalked XML part | v53 |
| M21, M22 | The leak report read engine names the browser did not have, and counted with its own matcher | the engine exports them; counts use the engine's NW, flex, variants | v53 |
| L7 | Three mutators skipped the undo history | each is a step | v53 |
| L12 | Two silent caps (spelling check, self-check log), and a twelve-suggestion cap on the body scan | both report; the body-scan cap is gone | v53 |
| Suspicions | Restore rewrote the inside of a longer number; a case's "פלוני א׳" collided with the open document's | whole-number boundary; `restorePairs` lets the document win | v53 |
| Suspicion | A scanned PDF with a printed header passed as text | pages judged by their own text; picture pages named | v53 |
| M20 | The benchmark measured body text only | the product's reader, the whole output file, three structure documents | v53 |
| L19, L4, M6, L10, L5, L20, L23 | Gate netted within a category; two flow assertions; PR check accepted a missing file; from-leak wrote into the corpus (and read "digits(9)" with a lost backslash); coverage measured no engine; lexicon-aided marker; trap canonicals | entity gate; ported; file must exist; temp folder, fixed regex, guard extended to bench/ and scripts/; command corrected; marker list; generator refuses | v53 |
| H14, M4, M2, L6 | Libraries that see the document came from a CDN unchecked; model unpinned; nothing evicted the model; log guard was a value filter | self-hosted (`scripts/vendor.js`), runtime WebAssembly checked by SHA-256, model pinned and verified, a CSP, "delete the model", a value schema | v53 |
| — | A file, pasted text or the tour started before the engine loaded did nothing | queued until it loads | v53 |
| M26–M32, L26–L30 | Accessibility (zoom, contrast, announcements, keyboard, direction, the tour, motion, names, states, selection, errors) | `e2e/a11y.spec.js` with axe; Escape does not end the tour, by the contract `e2e/unruly.spec.js` pins | v54 (pending) |
| M5 | `index.html` was linted by nothing | `scripts/lint-page.js`, `tests/lintpage_t.js` | v54 (pending) |
| QA 1 H1 | A pseudonym changed after copying did not restore | every pseudonym that left is remembered, by the case too | v54 (pending) |
| QA 1 M1 | A typed pseudonym that is another real person was replaced again | the sweep skips written pseudonyms | v54 (pending) |
| QA 1 M2 | Girls' names outside the lists got men's pseudonyms | the role word decides for a full name; short names ending in ה | v54 (pending) |
| Nit 3, M15 in index.html | A dated comment; bare Q references in the page | dated; qualified | v54 (pending) |
| Nit 4 | HANDOVER says MIT | the dated note at its top, with L14 | v51 |

**Looked at and deliberately left.** A finishing re-run closes an inline editor opened while it ran
(found by CI, not by the review). Her two real sessions show re-runs of 0.14–0.2 s, 0.42 s at most,
and no editor opened during one in 83 re-runs. Keeping the editor open would also leave its
preview stale. Not worth the risk before her session.

## Planned, in this order, after the client session

Nothing here is disputed. The order is by what it protects.

**Batch A — her results.** What is left of it: M25 (the body scan fails open), the rest of H10
(VML WordArt text, `styles.xml` and `numbering.xml`, which the review rated contrived for her
documents), and the suspicions about `restoreNames` on shifted dates and per-document placeholder
counters.

**Batch B — measurement.** What is left of it: M20 (the benchmark measures body text only), L19
(the gate nets within a category), L4 (two assertions of the old flow suite have no browser
counterpart), and M6 below.

**Batch C — supply chain.** M4 (pin the model revision), M2 (the service worker's purge
path is dead and nothing evicts `transformers-cache`), L6 (the session log's guard is a
value filter, like the leak report's was), and H14 below.

**Batch D — accessibility.** Done (v54).

**Batch E — decisions and documents.** What is left of it: nits 5, 6, 7 and 10.

**Batch F — structure.** M16 (engine sections share one namespace), M17 (the UI builds
rules field by field at 20 sites and knows 35 engine exports), L8, L9 (dead code). M21, M22 and
M5 are done.

**Found on the way, for the detection batch.** A surname that begins with ה (הורוביץ) is
never proposed by the body scan, by design, to keep definite nouns out; it needs a lexicon and
both benchmarks. A name only in a picture's alt text is proposed only when its first name is a
known one (the benchmark's names are disjoint from the lists, so it shows as 3 leaks there).

## Needs the owner's decision

1. **H14 — the two libraries that see the document are loaded without integrity.**
   `transformers.js` and `pdf.js` come in by bare `import()`, which Subresource Integrity
   cannot cover, and are cached first by the service worker. Options: self-host both next
   to the engine (about 1–2 MB plus the WebAssembly runtime, and we own updates), or keep
   the CDN and add a Content-Security-Policy with an explicit `connect-src`, which blocks
   exfiltration but not tampering. Recommendation: both, self-host first.
2. **M16 and M17 — how far to take the restructuring.** The reviewer's structural point is
   sound: C2 existed because there was no single reader to reconcile two copies at. The
   question is scale: a rule-object factory and a narrower engine interface are a few days;
   real modules for the engine sections are more. Recommendation: the factory and the
   interface now, modules only when a section next needs surgery.
3. **M6 — how strict the PR check should be.** It can be bypassed by ticking "not a bug
   fix". It can verify that the named test file exists; it cannot verify honesty.

## Decided by the owner on 2026-09-20

- **Before the client session:** everything that is tests or process, and small fixes to the app
  with a test that fails on the old code. Anything that touches detection leaves both benchmarks
  unchanged. The last deploy lands by the evening of 2026-09-21; after that only a rollback, and
  only for a blocker she reports (`docs/ROLLBACK.md`).
- **After it:** self-hosting the two libraries and a Content-Security-Policy (H14), the
  restructuring, accessibility, the documentation batch, and whether a failed verification
  should block the export outright instead of asking.
- **H11:** a removed name is remembered by the case, and comes back only as a visible question.
- **H2:** a failed verification asks, then allows. A hard block would lock her out where the
  tool cannot yet clear the value.
- **L14:** the licence is PolyForm Shield 1.0.0.
- **The date shift direction:** unchanged for now. After the session it becomes backwards, for
  new cases only, so that a case already sent to the AI stays consistent with itself.

## Rejected

None so far. The reviewer's own refutation pass had already removed 3 claims and reduced
25, and the claims it dropped are listed in its report.

## Corrections the review made to our own documents

`docs/review/BRIEF.md` was wrong or incomplete in four places, and the review said so:
the complexity list missed `redactDocx` (155) and `renderVals` (173) because the measuring
command hit a parse error and skipped the file; Babel is never fetched; five of seven
library loads do carry integrity hashes, through the loader; and the export count is 83.
The review also found the brief *too hard* on the comments: about 88% state the rule.
