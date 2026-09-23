# Reviewer brief — facts about this project

Written for an outside reviewer who has never seen this code. It states what
the product promises, how it is built, how it is measured, and what is off
limits. It is deliberately free of self-assessment: judging any of it is the
reviewer's job, and where this brief claims something is good, say so and
check it. The review's rules of engagement are in `docs/review/CHARTER.md`.

Written 2026-09-20, at v48.

## Corrections after the review (added 2026-09-20)

The review ran against this brief as it stood, so the text below is left as it was given. Four
things in it were wrong or incomplete, and the review proved each one:

- **Section 9, complexity.** The list names `bodyNames` (113) and `nerClean` (110) as the
  extremes. `redactDocx`, the function that decides what reaches the downloaded file, scores
  **155** and was missing: the measuring command hit a parse error on `engine/08-docx.js` and
  skipped the file without saying so. Inside `index.html`, which the linter does not read at
  all, `renderVals` scores **173**. Nested-deeper-than-4 is 49, not 47.
- **Section 6, integrity.** "One `integrity=` attribute" counted markup and missed the loader:
  five of the seven executable third-party loads carry a hash (React, ReactDOM, the Babel
  constant, d3, topojson). The two that do not are the two that see document text,
  `@huggingface/transformers` and `pdfjs-dist`, because a bare dynamic `import()` cannot carry
  one. `CHARTER.md` section 6.6 repeats the same mistake as "No Subresource Integrity".
- **Section 9, payload.** Babel is never fetched. It is reachable only through an import of a
  `.jsx` or `.tsx` URL, and the repository has none.
- **Section 9, API surface.** The engine has 83 exports, not 81.

Added 2026-09-23, with the documentation batch of the triage:

- **Section 9, complexity, now from a committed command.** `node scripts/complexity.js`
  measures the bundle, `page-logic.js`, `scripts/harvest-shapes.js` and the app script inside
  `index.html`, and fails on a file it cannot parse instead of skipping it
  (`tests/complexity_t.js`). At v53 it gives, highest first: `renderVals` 186 (index.html),
  `redactDocx` 184, `bodyNames` 113, `nerClean` 110, `showPeople` 73 (index.html), the engine
  class constructor 69, `selfCheck` 55 (index.html), `flatten` 51, `anchored` 49, `repFor` 48.
  35 functions above 12 in the linted files, 74 with `index.html`. These are v53 numbers; the
  review's 155 and 173 were v48's.

The review also found the brief too hard on itself in one place: about 88% of the comments state
the rule the code keeps, and none narrates a bug without it.

`docs/review/TRIAGE.md` is the answer to the findings themselves.

## 1. What the product is

A single-page browser tool that removes identifying details from Hebrew legal
and welfare documents, so a lawyer can paste the text into a general AI
assistant without sending her client's identity with it. She uploads a Word
file, the tool proposes what to hide, she corrects the proposals, and the tool
gives her back a redacted document, a clipboard copy for the AI, and a way to
put the real names back into the AI's answer.

One real user, a family lawyer, with real cases. Four real sessions so far,
logged. Everything runs in her browser.

## 2. Promises the product makes

These are the reasons the product exists. A defect against one of them is by
definition serious.

1. **No document text leaves the browser.** There is no server and no
   analytics. The tool is static files on GitHub Pages.
2. **What is sent to us is structural only.** The session log and the leak
   report carry event kinds, counts and codes. A guard in `page-logic.js`
   refuses any string with three Hebrew letters in a row, and the export
   throws rather than send text.
3. **Nothing identifying survives in the file she downloads.** Not only the
   visible text: also metadata, comments, tracked changes, headers, bookmarks,
   document variables, SmartArt and chart labels.
4. **Her decisions hold.** A name she corrected stays corrected across re-runs
   and across documents in the same case.
5. **Real client documents never enter this repository.** They live in a
   sibling folder, `../private-bench/`, which is outside the repo and
   git-ignored by location. Do not copy their contents anywhere.

## 3. How it is put together

| Path | Lines | What it is |
|---|---|---|
| `index.html` | 3,823 | The whole app: one class component, its template, and the UI logic. |
| `engine/*.js` | ~2,900 | The redaction engine in nine sections, edited here. |
| `redact-engine.js` | 3,032 | Generated: the sections concatenated. `npm run build:engine`. |
| `page-logic.js` | 143 | DOM-free page logic: the session log, the leak report, shape classification. |
| `support.js` | ~1,900 | **Vendored** runtime (`dc-runtime`), generated upstream. Not ours; out of scope. |
| `sw.js` | 81 | Service worker: caches the app shell and the model. |
| `text-to-docx.js`, `pdf-text.js` | ~200 | Writing a .docx for tests, reading text out of a PDF. |
| `scripts/*.js` | ~700 | Build, bump, site build, PR check, shape harvest, log report. |
| `tests/*.js` | — | Node suites, run by `tests/run.js`. |
| `e2e/*.spec.js` | — | Playwright suites against the real page. |
| `bench/` | — | The synthetic corpus, its key, the runner and the blocking gate. |

Build steps that generate files, all checked by tests: `build:engine`
(engine sections into `redact-engine.js`), `build:fixtures` (`tests/core.js`
and `tests/app.html` from the engine), `build:design`
(`design/redact.dc.html` from `index.html`), `scripts/build-site.js` (the 11
files that get published).

## 4. How a document flows through it

1. **Read.** Unzip the .docx, parse each XML part, flatten paragraphs into
   text blocks that remember which run each character came from.
2. **Propose.** Several layers each suggest values, and each proposal carries
   its source: the case profile, the document header, speaker labels in
   transcripts, the NER model, a body scan, patterns for numbers and dates,
   and near-spellings of names already known.
3. **She decides.** The people screen and the check screen. Her decisions are
   rules: replace with this pseudonym, don't replace, not a name, blank it.
4. **Apply.** Replacements are written back into the XML, with a consistency
   sweep for parts of names, then re-verified against the output file.
5. **Leave.** Download the redacted .docx, copy the text for the AI, restore
   real names into the AI's answer, or send us a package: the redacted file,
   the session log and the leak report.

## 5. The model

- `onnx-community/dictabert-ner-ONNX`, run in the browser by
  `@huggingface/transformers` 4.2.0 from jsDelivr. About 180 MB on first use,
  then cached by the service worker.
- It is not fine-tuned. Its output is cleaned by hand-written rules in
  `engine/06-model.js`: span growth to word boundaries, prefix-letter peeling,
  title stripping, and filters for verbs, stop words and role words.
- The model is optional. Everything works without it, less well.
- The engine rewrites the model's tokenizer JSON after it is fetched, to repair
  a regular expression the browser rejects, and it patches the copy already in
  the cache too (`nerFixRegExp`, `jsonRes` in `engine/08-docx.js`). If the
  rewrite produces invalid JSON, the original is used.

## 6. What the app loads from the network at runtime

Facts, listed because they belong to the privacy lens:

- `unpkg.com`: React 18.3.1, ReactDOM, Babel standalone 7.29.0, d3 7.9.0,
  topojson-client 3.1.0.
- `cdn.jsdelivr.net`: `@huggingface/transformers@4.2.0`, pdf.js 4.6.82,
  `world-atlas` country shapes.
- `fonts.googleapis.com` and `fonts.gstatic.com`.
- `huggingface.co`: the model weights.
- `index.html` contains no `Content-Security-Policy` and one `integrity=`
  attribute.
- The service worker caches the app shell and model requests, and serves from
  cache first.
- The only outbound paths in the app are these loads. There is no fetch to any
  endpoint of ours, and no analytics library of any kind. The package she sends
  travels by her own email client.
- Persistent state in her browser: `localStorage` keys `redact-cases` (the case
  profiles, which hold real names mapped to pseudonyms), `redact-profile-last`,
  `redact-theme`, `redact-intro-seen`, `redact-tour-seen`,
  `redact-feedback-mail`; and two Cache Storage buckets, the app shell and
  `transformers-cache` for the model.

## 7. How correctness is measured

- **Node suites**: 1,828 checks, `npm run test:unit`. Includes shape suites
  (a value written in 31 typographic shapes), Word-structure suites (a name in
  28 Word structures), engine behaviour, page logic, the PR-description check
  and the log report.
- **Browser suites**: 180 tests, `npm run test:browser`. Every test ends with
  the app's own self-check: overlays on target, no duplicate or punctuated
  cards, every listed value handled, no overflow, no unresolved placeholder.
  `e2e/unruly.spec.js` replays the main journeys with a misbehaving user.
- **Benchmark**: 40 synthetic documents we generate, `bench/`, keyed by hand
  in `bench/key.json`. `npm run bench:nomodel` and `npm run bench`. A blocking
  gate (`bench/gate.js`) fails CI if leaks or misses rise.
  Current, model off: 71 leaks, 55 missed, 4 false positives.
  Model on: about 6 leaks.
- **Private bench**: her five real documents in `../private-bench/`, scored by
  the same runner, results written beside the fixtures. Model on: 3 leaks
  across the five.
- **Shape harvest**: `npm run shapes` records the structural shape of each
  keyed occurrence in her documents and fails if a shape she has is not
  covered by our checks.
- **Session log**: `npm run log-report -- <package>` summarises a real
  session: minutes per screen, corrections and their causes, misses.

## 8. Process

- One branch per piece of work, a PR from `.github/pull_request_template.md`,
  CI (`test.yml`) plus a description check (`pr.yml`), merge, automatic Pages
  deploy, then a live check.
- Every deploy bumps the version with `npm run bump <n>`; six places must
  agree and a test proves it.
- `CHANGELOG.md` has an entry per version, in Hebrew, describing what changed
  and why.
- `docs/QUALITY-PLAN.md` is the current quality programme: seven layers, six
  done. `docs/PLAN-v18.md` records earlier settled decisions. `docs/ROADMAP.md`
  and `docs/HANDOVER.md` hold older plans. `docs/measurements.md` records
  experiments, such as the model quantization choice and a parameter sweep.

## 9. Measurements taken for this review

Not interpreted here. Commands are in the charter.

- **Duplication** (`jscpd`, 6 lines / 60 tokens): 4.35% of 14,883 lines, 70
  clones. Almost all of it is Playwright setup repeated across specs;
  `e2e/steps.spec.js` and `e2e/qa2-medium.spec.js` carry the most. One clone in
  the engine, between `04-nearmiss.js` and `05-bodynames.js`.
- **Complexity** (eslint, limit 12): 32 functions above the limit. The
  extremes are `bodyNames` at 113 and `nerClean` at 110, then `findNear` 35,
  `mergeSignals` 29, `nameish` 26. 47 places nested deeper than 4.
- **Engine API surface**: 81 exports, of which 9 are never mentioned outside
  the engine: `serXML`, `validID`, `ibanOK`, `luhn`, `WHYP`, `CANON`,
  `nerPersist`, `ORG_RX`, `likelyOrg`.
- **Comment language**: comments are almost entirely in Hebrew. In
  `index.html`, 299 of 305 comment lines; in `engine/08-docx.js`, 141 of 142.
  Many narrate the history of a bug rather than the rule the code now keeps.
- **Naming**: several suites are named after the release or QA round that
  produced them: `tests/r3_t.js`, `tests/r5_t.js`, `e2e/qa2.spec.js`,
  `e2e/qa2-medium.spec.js`, `e2e/r3.spec.js`.
- **Payload**: the published site is 11 files, 671 KB in total, of which
  `index.html` is 309 KB and `redact-engine.js` 240 KB. React, Babel, d3 and
  the fonts come from CDNs on top of that, and the model adds about 180 MB
  once.
- **Churn**, 218 commits since 2026-09-03, generated files excluded:
  `index.html` 100, `sw.js` 52, `engine/06-model.js` 27, `engine/08-docx.js`
  23, `engine/07-engine.js` 13. The files that change most and the functions
  with the highest complexity are largely the same files.

## 10. Things we already know

Listed so the review does not spend its effort rediscovering them. Saying
more about *why* one of these is or isn't a problem is still valuable.

- `index.html` is one 3,800-line file holding the whole app.
- The benchmark corpus is written by us and tuned against by us.
- The model is not fine-tuned for this domain.
- Three browser tests depend on downloading the real model and are unreliable
  on a slow connection: `model.spec.js`, `late-model.spec.js`,
  `filename.spec.js`.
- Hebrew comments and release-named tests, as measured above.
- No Content-Security-Policy.

## 11. How to run everything

From the repository root, with `npm ci` already done.

| Command | What it does | Time |
|---|---|---|
| `npm run lint` | ESLint over everything. | seconds |
| `npm run test:unit` | The Node suites. Rebuilds the fixtures first. | ~1 min |
| `npm run test:browser` | Playwright, 180 tests. Starts its own server on 4173. | ~5 min |
| `npm test` | Lint, Node, browser. | ~6 min |
| `npm run build:engine` | Rebuild `redact-engine.js` from `engine/*.js`. Required after editing the engine. | seconds |
| `npm run build:fixtures` | Rebuild `tests/core.js` and `tests/app.html`. | seconds |
| `npm run bench:nomodel` | The 40-document benchmark without the model. | ~1 min |
| `npm run bench` | The same with the real model. Downloads weights once. | ~5 min |
| `GATE_BLOCKING=1 node bench/gate.js` | The gate that CI runs. | seconds |
| `npm run shapes` | The shape harvest. Needs `../private-bench/`; prints structure only. | seconds |
| `npm run log-report -- <file>` | Summarise a session package or log. | seconds |
| `npx playwright test e2e/x.spec.js --reporter=line` | One browser suite. | varies |

Notes for anyone running these: a stale server on port 4173 is reused
silently; the three model-dependent browser tests fail on a slow connection;
the benchmark writes `bench/results*.json|md`, which are committed files, so
check them out again afterwards rather than committing churn.

## 12. Off limits

- **Do not read, copy or quote** anything under `../private-bench/`. Its
  existence and structure are described here; that is enough.
- **Do not modify the repository.** No edits, no commits, no branches, no
  deploys, no PR comments. The review reports; the maintainer fixes.
- **Do not install packages into the project.** Throwaway tools via `npx -y`
  are fine.
- **Do not send any document text, log or fixture anywhere.**
