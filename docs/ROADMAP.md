# paintItBlack — the step-up plan

> **מצב, 7.9.2026.** ספרינטים A ו-B הושלמו, וכך גם פריטי המחקר ורוב ספרינט C.
> ההחלטות שנגזרו מכאן, והמדידות שלהן, נמצאות ב-`docs/PLAN-v18.md`,
> `docs/measurements.md` ו-`CHANGELOG.md`. מה שנשאר פתוח מהמסמך הזה הוא בעיקר
> ספרינטים D ו-E: מסמך הדגמה, מחסנית ביטול, מעבר נגישות, עמוד פרטיות בתוך
> הכלי, CSP, והטמעת הספריות. הוא נשמר כרשימת ההמשך.

Written 2026-09-06 against main at v13 (PR #7 merged, live chip reads v13).
Everything below is grounded in the repo as it stands: file sizes, the
benchmark tables, the test harness, and what the deploy chain looks like today.

## Where the project is

| area | state today |
|---|---|
| product | static site, zero build, GitHub Pages; engine 1,797 lines, page 1,693 lines (one 950-line class, `renderVals` alone is 375 lines) |
| detection quality | bench: 114 keyed entities, 5 leaks, 1 false positive; 19 junk "also found" suggestions across 12 docs |
| tests | 180 Node assertions (12 suites) + 22 Playwright checks, all green; `npm run report` and `npm run bench` as measurement tools |
| process | branch → PR → merge by hand; version bumped in 6 places by hand; no CI, no branch protection, no tags, no changelog, no license |
| docs | README (deploy, version, network, acceptance), measurements.md, bench/README, tests/README (stale: says "need to adapt the suites", counts 225 assertions) |
| drift | `docs/reference/redact-engine.js` differs from the live engine by 97 lines; `design/*.dc.html` and `index.html` are hand-synced twins; README network table still lists React |
| runtime deps | d3 + topojson from unpkg on every load (the map is now hidden by default), transformers.js from jsdelivr, model from huggingface, fonts from Google |

## Principles that stay

- Zero build for the shipped site. No framework migration, no bundler, no server.
- Confirm-first: the model proposes, the user decides. Nothing auto-replaces silently.
- Recall over precision, but never at the cost of speed (bench keeps the ms column).
- The engine suites are not rewritten; they encode hard-found bugs.
- Every commit leaves `npm test` green; every deploy bumps the version everywhere.

## The plan, in order

### Sprint A — hygiene and automation (small PRs, one afternoon each)

1. **CI on every PR.** `.github/workflows/test.yml`: install, `npx playwright install chromium`, `npm test`, `npm run bench:nomodel`. Turn on branch protection on main so a red suite cannot merge. Done when a deliberately broken PR shows red.
2. **One-command version bump.** `npm run bump 14` edits the four sites in `index.html`, `V` in `sw.js`, the README table (with fresh line numbers) and the design twin. A unit check asserts all six agree, so a missed site is a test failure and not a stale cache on the client's phone.
3. **Kill the drift.**
   - Delete `docs/reference/redact-engine.js` (history keeps it) or regenerate it in CI; the suites already build from the live engine.
   - Generate `index.html` from the design file with a script (the diff is only the head), so there is one source instead of two 1,700-line twins kept in step by hand.
   - Delete `tests/extract.py`; rewrite `tests/README.md` to describe what actually runs (`build-fixtures.js`, 180 assertions, `npm test`).
   - Fix the README network table (no React; d3/topojson only when the map is shown).
4. **Repo furniture.** LICENSE (decide deliberately; a legal tool wants a clear one), CHANGELOG.md seeded from PRs #1–#7, a git tag per version (`v13` now), a Hebrew issue template with the questions that matter (what kind of document, which name was missed, screenshot of the card).
5. **ASCII file names.** The design file and the model-fixes spec have Hebrew file names that fight every shell and CI runner. Rename, keep the Hebrew title inside the file.
6. **Lazy map.** Load d3 and topojson only when the map toggle is pressed. Two CDN scripts and an integrity check disappear from every ordinary visit.

### Sprint B — code structure (makes everything after it cheaper)

7. **Extract the page logic.** Move the pure functions out of the component class into `page-logic.js` (ES module): `groupsOf`, `mapView`, `buildReport`, `cleanEntry`, profile read/write, `currentMap`, `mergeInto`, the section definitions. The class keeps state and handlers only. Those functions then get plain Node tests without jsdom slicing.
8. **Split the engine, keep the file.** `engine/` with `docx.js`, `detect.js`, `ner.js`, `verify.js`, `geo.js`; a 30-line script concatenates them into `redact-engine.js`. The shipped file and the fixture builder never notice. Done when the generated file diffs empty on the first run.
9. **Lint and type-check.** ESLint with `no-undef` and `tsc --checkJs` over JSDoc. The `TITLE_RX is not defined` incident that silently emptied every suggestion is exactly the class of bug these catch for free. Run in CI.
10. **Pin the vendored runtime.** `support.js` is a 1,911-line copy of dc-runtime with no version note. Record origin and version at the top; add a script that diffs against upstream.
11. **Strings table.** Every Hebrew UI string into one object at the top of the page script. The client can review and edit microcopy in one place; the audit spec can dump it for a wording pass.

### Sprint C — detection quality (the product's actual value)

Each item becomes an issue with the bench row that proves it.

12. **The five leaks.**
    - Street fragments (`הארזים`, `הנשיאים` after a street-and-number is replaced): when a street rule applies, cover the bare street word with the same replacement.
    - Two-word town (`בית זית`): pull multi-word settlements from the atlas gazetteer into PLACE detection.
    - Minor, first name only (`אופק`): anchor on the minor/child words before a name and widen KNOWN_FIRST.
    - Prefix-letter-only single occurrence (`בהילי`): in the near-miss scan, treat a prefix letter plus a listed name as that name. Currently "expected to fail"; decide whether it stays so.
13. **Suggestion precision.** 19 junk chips (`סיכמנו`, `המלצה`, `יו"ר`, `ועדה`, `נישאו`) each cost a tap. The speaker anchor needs a verb and label stop-list; the role-word anchor needs a nameish gate on prose. Target: junk halved with zero new misses.
14. **Non-name PII as bench positives.** ID numbers, phones, addresses, bank accounts, plates, emails, birth dates each get bench documents with ground truth, not only trap rows. Today only names are scored.
15. **Grow the corpus.** 12 to 30+ documents; new genres: welfare report, medical summary, police statement, bank statement, WhatsApp export. The PDF path has no bench at all; add PDF fixtures, including a scanned one to check the "no text" message.
16. **Recall gate in CI.** `bench:nomodel` compares leaks and misses to the committed results file; any increase fails the PR. The model-on bench stays a manual `npm run bench` because of the download.
17. **Model round two.** H1 and H3 are closed; the open question is a second NER model for ORG and PLACE, measured on the bench, not on the model's own scores. Confirm-first stays regardless of the outcome.

### Sprint D — UX round two

18. **Demo document.** A "try it on a sample" button on the entry screen, fed by a synthetic case file from the bench generator. First-time users see the whole flow before trusting their own file.
19. **Undo stack.** One undo for the last action on the check screen (allow, not-a-name, replacement edit, merge). Today each is reversible only by hand.
20. **Case memory.** Profiles are JSON download and upload. Store them in IndexedDB keyed by case and offer "same case as last time", so the same fake names carry across documents automatically. The `case.js` suite already tests the mapping; the UX does not use it.
21. **Compare view.** Source and redacted side by side with synced scroll on desktop; the toggle stays on phones.
22. **Accessibility pass.** Focus rings, `aria-label` on every icon button, dark-mode contrast on the warn and bad tokens, keyboard next/previous between marks (the index exists; expose it). Lighthouse accessibility of 95 or better as the gate.
23. **Model transparency.** Download progress with size, a "stored on this device" note once cached, a button to clear it. Phone users need to know what those 130 MB were.
24. **Share target.** `share_target` in the manifest so a docx from WhatsApp or Drive opens straight into the tool on Android.
25. **Redaction report.** `buildReport` exists; make it a first-class output with a stable layout the client can attach to a file.

### Sprint E — trust and privacy (the pitch for a legal tool)

26. **In-app privacy page.** The README network table, in Hebrew, one tap from the header. Says exactly which hosts are touched and that no request carries document text.
27. **CSP.** A Content-Security-Policy meta tag with `connect-src` limited to the four hosts and `script-src` to self plus the pinned CDNs. A Playwright check that the page still boots under it.
28. **Vendor the libraries.** d3, topojson and transformers.js served from the repo instead of CDNs; the model stays on huggingface because of size. Removes three third-party runtime dependencies from a privacy tool. Weigh repo size against the trust gain.
29. **Threat model doc.** `docs/SECURITY.md`: what a compromised CDN could do, what the service worker caches, why network-first, what is and is not stored locally.

### Ongoing

30. **Docs layout.** `docs/ARCHITECTURE.md` (discover, rules, apply, verify, suggest, with the confirm-first boundary drawn), `docs/TESTING.md` (merge tests/README and bench/README), `docs/DECISIONS.md` (short records: confirm-first, network-first SW, suites not rewritten, recall over precision).
31. **Issue-driven work.** Every bench leak and every client report becomes an issue; a milestone per version; CHANGELOG updated in the same PR as the bump.

## What I would not do

- Rewrite in React, Vue or Svelte, or add a bundler. The zero-build deploy is a feature for a one-person project.
- Move anything server-side. The whole trust story is "nothing leaves the browser".
- Rewrite the twelve engine suites, even for style.
- Chase the model's own F1. The bench scores the pipeline; that number is the one that matters.

## Suggested first PR

Sprint A items 1, 2 and 6 together: CI, the bump script, the lazy map. Small, mechanical, and every later PR benefits from the CI gate being in place.
