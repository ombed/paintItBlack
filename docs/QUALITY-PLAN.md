# Catching the small bugs before the client does

Written 2026-09-18, after the client found three bugs that three QA rounds and every test had missed. The bugs were a name inside quotation marks that was never replaced, a second card for the same word with a quote on it, and a tour spotlight that drifted on scroll and let a click outside it break the tour.

## Why they got through

Each miss has a cause that will produce more misses if nothing changes.

| Cause | What it hid |
|---|---|
| **Test documents are too clean.** The synthetic corpus writes names plainly. No test put a name in quotes, and neither did the QA documents. | Quoted names never matched: the word boundary counted `"` as a letter. A probe of 31 punctuation shapes found the same failure for single quotes, footnote digits and numbers glued to a label. |
| **Tests assert the happy path and hold still.** No test scrolled during the tour or clicked outside an overlay. | The spotlight lagged behind scrolling and ran off the screen on a phone. Clicks passed through the dimmed area. |
| **Checks are per bug, not per rule.** Each fix got a test for its own case. Nothing checks, on every run, the rules the product promises. | "A card title never carries punctuation" and "a listed value that is in the text is always found" were true in every test but false in her document. |
| **Real documents only reach us as reports.** Her files show shapes we never generate: quotation marks, footnotes, abbreviations, header blocks. | We learn about a shape only after it hurts her. |

## The layers

Each layer catches a different kind of miss. The first one is already in place.

### 1. Shape suites: every value in every shape real documents use

`tests/shapes_t.js` writes the same values in 31 shapes: every quote style, a prefix letter before the quote, brackets, dashes, maqaf, no-break spaces, direction marks, line breaks and tabs inside, footnote digits and bullets. For each shape it checks that the value is found, fully replaced, and shown in context, and that no suggested value carries punctuation at its edge. Numbers get the same treatment, with and without a space after their label. **Done: 221 checks. On the previous engine the same suite reports 62 failures.**

**1b, done.** Places now go through every shape, with and without a prefix letter, and all of them pass. The AI's answer goes through every shape plus markdown, titles and prefixes, and restore missed two: a fake name in gershayim and one after a maqaf. That was the same word-boundary class as the quoted names. `tests/structure_t.js` builds real .docx files with a name in 28 Word structures and reads every XML part of the output. It found ten ways a name left the tool, and all are fixed. They were: a tab, line break or non-breaking hyphen inside the name; content-control titles and tags; picture titles; document variables; bookmark names; SmartArt; chart labels; and tracked formatting changes. It also found that the final check could not see a name split across runs. The old engine fails 14 of its 66 checks. Still outside the scan: a chart's embedded workbook, which is reported as an unanalysed channel, and text inside images.

### 2. Invariants checked after every run, in every browser test

A shared automatic fixture asserts the product's promises on whatever screen the test ended on, so the 170 existing browser tests become checks of rules they were never written for:

- No card title starts or ends with punctuation, and no two cards are the same letters.
- Every listed value whose letters appear in the document has at least one occurrence to show, and is not reported as "not in the document".
- The spotlight, the inline editor and the tip sit within one pixel of what they point at.
- No horizontal overflow, no page error, no runtime warning in the console.

**Done.** The checks live in the app, in `selfCheck()` in index.html, so layer 5 can reuse them in real sessions. `e2e/base.js` runs them automatically after every passing browser test, once animations settle. All 166 browser tests pass under it. `e2e/selfcheck.spec.js` breaks each rule on purpose and expects it reported, so a check that never fires cannot pass for a clean app. Writing those tests found one real miss: a repeated speaker "דוד כהן" was never listed without the model, because "כהן" was read as כ plus the stop word "הן". A test opts out with the `no-self-check` annotation only when it leaves the page broken by design.

### 3. A misbehaving user

A helper that does what a real person does between the steps a test expects. It scrolls the page and each pane, resizes, clicks outside overlays, presses Escape, Tab and Back, and double-clicks. The main journeys (entry to restore, the tour, a second document in a case) run through it at a desktop, a laptop and a phone size, and the layer-2 invariants are checked after each disturbance.

**Done.** `e2e/unruly.js` holds the helper, `disturb(page, label, opts)`. It scrolls the page and every pane, narrows the window and restores it, clicks empty space, double-clicks a word, tabs, presses Escape, and presses Back and answers "stay" once a document is loaded. After each action it runs the layer-2 self-check, and the screen must still be the one the user was on. The sequence is fixed, so a failure reproduces from its label. `e2e/unruly.spec.js` runs the three journeys at 1440, 1280 and 390 px. On its first run it found one real bug: on a phone, a tooltip opened while the places screen rose into place stayed 3-5 px below its word. Back during the tour is left out on purpose, since the tour has no Back guard by design.

### 4. Shapes harvested from her real documents

A script reads the private fixtures and records only the shapes around each entity, never the text. Shapes means the punctuation before and after, the quote style, whether a formatting run splits it, and whether it sits in a table, header or footnote. It then checks that the synthetic corpus covers every shape seen. A shape she has and we don't generate fails the check. Every new client package is harvested the same way.

### 5. Self-checks in her sessions

The same invariants run inside the product and write a structural event to the session log when one breaks, with no text in it. Examples: "listed value not found although its letters are present", "card with edge punctuation", "overlay drift". They come back in her test package, so we see a break before she has to describe it.

**Done.** The in-session check is `runSelfCheck()` in index.html. It runs a second after the last change of screen, tour step, overlay, result or list, and after scrolling or resizing. It waits for finite animations and for a re-run in flight, so it never measures something mid-move. Each broken rule becomes one `self-check` event per screen, with the rule, the screen, a count and the time taken. A check slower than 200 ms three times switches itself off and logs `self-check-off`. On a synthetic 60,000-word document with 40 listed names it takes about 33 ms. `e2e/selfcheck.spec.js` shows that a clean session logs nothing, and that a break is logged once, with no text.

### 6. Fix the class, not the instance

Every reported bug closes with three things, written into the PR template:

1. A test for the case she hit.
2. The shape or invariant that covers its siblings.
3. A probe across those siblings before closing, as the 31-shape probe did for quotes, which found footnote digits and glued numbers in the same pass.

**Done, and checked rather than only written.** `.github/pull_request_template.md` asks for the three answers under a "Kind" choice. The `pr` workflow runs `scripts/check-pr.js` on the description and reruns whenever the description is edited, without rerunning the test suite. A PR must tick exactly one kind. A bug fix fails the check until the first answer names a test file under tests/ or e2e/ and the other two answers are not empty. The template's hints sit in HTML comments and do not count as answers. `tests/prcheck_t.js` builds every case from the real template, so the two cannot drift apart. The check can see that an answer is there, not whether it is good. That judgement stays with the reviewer.

### 7. A sharper brief for QA rounds

QA runs use documents with real typography, carry the layer-3 misbehaviour list, and report the layer-2 invariants on every screen they visit.

## Order

| Step | What | Effort | Status |
|---|---|---|---|
| 1 | Shape suite for names, organisations and numbers | — | done |
| 2 | Invariants after every browser test | about a day | done |
| 3 | Misbehaving-user helper on the main journeys | about a day | done |
| 6 | Class-not-instance rule in the PR template | an hour | done |
| 5 | Self-check events in the session log | half a day | done |
| 1b | Shape suite extended to places, restore and Word structure | about a day | done |
| 4 | Shape harvesting from the private fixtures | one to two days | next |
| 7 | Next QA round with the new brief | one round | |

## How we'll know it works

Count the bugs she reports per session, and for each, whether a layer should have caught it. A bug no layer covers means a missing layer, and that gets added here.
