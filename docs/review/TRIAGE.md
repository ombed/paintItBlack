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
| H2 | A failed verification did not stop the download | `exportGuard` consults the verification | PR open |
| H3 | «מקור» showed the redacted text | brace-less `else` in `renderVals` | PR open |
| — | A Hebrew PDF line split by formatting came out reversed (suspicion, now confirmed) and `pdf-text.js` had no behavioural test (M11) | `pdf-text.js`, `e2e/pdf.spec.js` | PR open |

## Planned, in this order, after the client session

Nothing here is disputed. The order is by what it protects.

**Batch A — her results.** Wrong or lost outcomes she could meet.
H8 («אל תחליף» on a place overridden for seven prefix forms, via `geoRemove`), H11 (a deleted
rule returns in the next document of the case), H10 (field codes, table alt text, extended
charts are partly done, the page-one thumbnail), M1 ("delete case" leaves the name map in
`redact-profile-last`), M3 (a model failure is invisible once she moved on), M25 (body scan
fails open), and the suspicions about `restoreNames` on shifted dates and per-document
placeholder counters.

**Batch B — tests that cannot fail, and process gates.** None of this touches the app.
H4 (the browser self-check turns "could not run" into "found nothing"), H5
(`decisions.spec.js` asserts nothing: `d+` for `\d+`), H6, H7, M18, M19 (leak-prevention
passes with no test: the name-part sweep, the `.rels` scrub, the anti-doubling guard,
`stripComments`, `stripRsid`), M7 (`tests/run.js` ignores exit codes and pins no count), M8,
M23, M24, L1, L2, L3, L4, L25, H12 (the benchmark cannot see a surviving two-letter
surname), L19, M20, M9 (`build-site.js` deletes whatever path it is given), H9 (Pages
deploys without waiting for the test workflow), M10 (no forced bump, no rollback, no
automated live check), M6.

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
3. **L14 — which licence.** `package.json` says ISC, `LICENSE` and the settled decision say
   PolyForm Shield 1.0.0, and the handover notes say MIT. Only the owner can say which.
4. **The date shift direction.** Every shifted date moves 30 to 400 days into the future, so
   a filing can show a hearing after the document's own date. Shift backwards, or both ways?
5. **M6 — how strict the PR check should be.** It can be bypassed by ticking "not a bug
   fix". It can verify that the named test file exists; it cannot verify honesty.

## Rejected

None so far. The reviewer's own refutation pass had already removed 3 claims and reduced
25, and the claims it dropped are listed in its report.

## Corrections the review made to our own documents

`docs/review/BRIEF.md` was wrong or incomplete in four places, and the review said so:
the complexity list missed `redactDocx` (155) and `renderVals` (173) because the measuring
command hit a parse error and skipped the file; Babel is never fetched; five of seven
library loads do carry integrity hashes, through the loader; and the export count is 83.
The review also found the brief *too hard* on the comments: about 88% state the rule.
