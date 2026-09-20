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

**Batch D — accessibility.** M26 (200% zoom collapses the document pane), M27 (control
borders at 1.3:1), M28 (nothing is announced), M29, M30, M31 (no `dir="auto"`, so English
AI answers render right-to-left), M32 (the tour and assistive use), L26–L30.

**Batch E — decisions and documents.** M14 (four places state a gazetteer rule the code
stopped keeping), M15 (`Q<n>` means three numbering schemes), M12, M13 (`bench/sweep.md`
destroyed by a partial re-run), L11–L18, L20–L24, H15 and the other corrections to
`docs/review/BRIEF.md`, the ten nits.

**Batch F — structure.** M16 (engine sections share one namespace), M17 (the UI builds
rules field by field at 20 sites and knows 35 engine exports), M21 and M22 (`page-logic.js`
re-implements `classify` and the word boundary, and both diverge from the engine in the
browser), M5 (`index.html` is linted by nothing), L8, L9 (dead code).

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
