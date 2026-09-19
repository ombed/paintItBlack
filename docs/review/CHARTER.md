# Review charter — rules of engagement

The companion to `docs/review/BRIEF.md`, which holds the facts. This file says
what the review is for, what counts as a finding, how findings are proved, and
what the reviewer hands back.

## 1. Goal

Two questions, in this order.

1. **Is the thing sound?** Does the code do what the product promises, and do
   the measurements that say so actually say so.
2. **Would a seasoned developer recognise intelligence here?** Are the
   decisions deliberate and visible, or arbitrary and undocumented.

The review does not rewrite the code. It reports, and the maintainer fixes.

## 2. Scope

**In:** `index.html`, `engine/*.js`, `page-logic.js`, `sw.js`, `text-to-docx.js`,
`pdf-text.js`, `scripts/*.js`, `tests/`, `e2e/`, `bench/`, `.github/workflows/`,
the docs under `docs/`, and the development process itself.

**Out:** `support.js` (vendored runtime), generated files (`redact-engine.js`,
`tests/core.js`, `tests/app.html`, `design/redact.dc.html` — review the
generators instead), `bench/corpus/*` content, `node_modules`, anything under
`../private-bench/`.

## 3. What counts as a finding

A finding names something that is wrong, risky or costly, with evidence. Each
one carries:

| Field | Meaning |
|---|---|
| **Severity** | Critical, High, Medium, Low. See below. |
| **Lens** | Which review lens produced it. |
| **Location** | `file:line`, or a named function, or the process step. |
| **Claim** | One sentence: what is wrong. |
| **Evidence** | What was run or read that proves it. A command and its output, a failing case, a quoted line. Not "this looks fragile". |
| **Impact** | What it costs: a leak, a wrong result, a slower session, an hour of future confusion. Concretely. |
| **Confidence** | 0–100. Below 80, do not report it as a finding; put it under "Suspicions" instead. |
| **Fix sketch** | A sentence or two. Not a patch. |

**Severity:**

- **Critical** — breaks one of the five promises in the brief. Identifying
  text can leave the tool, her decisions can be silently lost, or the app can
  destroy her work.
- **High** — a wrong result she would not notice, a real security or privacy
  weakness, or a measurement that is telling us something false.
- **Medium** — makes the product or the code materially worse: a slow path she
  will feel, a structure that will keep producing bugs, a test that passes for
  the wrong reason.
- **Low** — worth knowing, cheap to fix, no user-visible effect.

**Nits.** Small improvements that do not block anything are welcome but capped
at ten in total, listed separately, and never mixed into the findings table.
Anything CI or the linter already enforces is not worth reporting.

**Not findings.** Style preferences, naming taste, "consider extracting",
missing tests for code that is already covered, anything already listed in the
brief's section 10 unless the reviewer adds new evidence or a cause, and
speculative "could be a problem if" without a path to it happening.

**The bar for Critical and High:** the reviewer must be able to state the
sequence of events that produces the harm, and where possible show it with a
command, a test, or a document that triggers it.

## 4. Evidence and verification

1. **Run things.** The brief lists every command. A claim about behaviour must
   come from an execution, not from reading alone.
2. **Refutation pass.** Every Critical or High finding is re-checked by a
   separate pass whose job is to *kill* it: find the guard that already
   prevents it, the test that already covers it, or the reason it cannot
   happen. It is measured by how many findings it kills, not by how many it
   agrees with, and it is never run by the agent that produced the finding.
   A finding that survives is marked CONFIRMED. One that does not is dropped,
   with a line saying why in an appendix. Agreement between agents is not
   evidence: LLM reviewers have been observed to converge unanimously on
   defects that do not exist (see `SOURCES.md`).
2b. **Behaviour claims cite source.** A statement about what the code does
   needs a `file:line` citation and, where the claim is about a result, a
   reproducing input and the actual output. An inference from a name or a
   comment is not evidence.
2c. **Silence must be distinguishable from not looking.** Every checklist item
   gets a verdict: checked, not applicable, or defect. Every lens ends with an
   explicit list of what it examined and found healthy. For the 3,800-line app
   file, say which regions were read line by line and which were skimmed.
3. **Test strength, red-green.** For any test claimed to be weak: break the
   code it covers, confirm the test still passes, then restore. That is the
   proof. Mutation testing may be used for a broader answer. Note for it: the
   Node suites run against the generated `redact-engine.js`, so a mutant in
   `engine/*.js` only counts if the command rebuilds first —
   `node scripts/build-engine.js && node tests/build-fixtures.js && node tests/run.js`,
   which exits non-zero on any failure.
4. **No fabrication.** If something could not be verified, say so and mark the
   finding as a suspicion.

## 5. Lenses

Each lens is a separate pass with its own checklist. The checklists are in
section 6.

1. **Correctness of the engine** — Hebrew text handling, the redaction
   pipeline, the Word file, restore.
2. **Efficiency and redundancy** — duplicated logic, wasted work, repeated
   passes, dead code, the cost on a large document.
3. **Architecture and module depth** — module boundaries, interface width,
   information leakage, the single 3,800-line file, coupling between the
   engine and the UI.
4. **Test-suite strength** — do the tests fail when the code is wrong, what do
   they not cover, are they measuring behaviour or implementation.
5. **Measurement and benchmark validity** — is the benchmark measuring what we
   claim, does authoring it ourselves invalidate it, does the gate protect
   anything real.
6. **Privacy and security** — the five promises, the threat model of a
   browser-only app with third-party code and model weights, the session log
   and package.
7. **Accessibility and RTL** — keyboard, screen reader, contrast, zoom, and
   Hebrew right-to-left specifics.
8. **Decisions and documentation** — can a newcomer tell why each non-obvious
   thing is the way it is; are the comments rules or history.
9. **Process** — release flow, CI, the quality plan, how bugs get found and
   fixed, what the process itself systematically misses.

## 6. Checklists per lens

Each item is a question with a checkable answer. Sources and the fuller
versions are in `docs/review/SOURCES.md`.

### 6.1 Correctness of the engine

- Take one promise at a time from the brief's section 2 and try to break it
  with a document you construct.
- Hebrew specifics: prefix letters, the definite article, gershayim and geresh,
  maqaf, niqqud, final letters, mixed direction marks, numbers glued to labels.
  Is the boundary rule the same everywhere, or does each matcher have its own?
- Order of operations: what happens when two layers propose overlapping spans,
  when a replacement contains a value that another rule also matches, and when
  a pseudonym collides with a real name in the document.
- Idempotence: running the same document twice, and re-running after a
  decision, must give the same result.
- The Word file: every part that can carry text, and what happens to parts the
  engine does not understand.
- Restore: can it put back a name it never took out, or map two people onto
  one.
- Failure paths: a corrupt file, an empty document, a huge document, a model
  that never loads, a service worker serving a stale engine.

### 6.2 Efficiency and redundancy

- Fowler's smells, on the engine first: duplicated logic, long function, large
  class, long parameter list, primitive obsession, shotgun surgery, speculative
  generality, dead code.
- Repeated work: how many times is the document text flattened, normalised or
  scanned per run. What is O(n·m) and what is n and m in a real document.
- The same rule expressed twice in two places, so a fix has to be made twice.
  The two word-boundary definitions and the several prefix-letter lists are
  where to start.
- Dead exports and unused branches. The brief lists nine unused exports.
- Measure before claiming: time a real-size document, don't reason about it.

### 6.3 Architecture and module depth

- Ousterhout's red flags: shallow module, information leakage, temporal
  decomposition, overexposure, pass-through method, repetition, comment that
  repeats the code, non-obvious code.
- Where is complexity concentrated, and is that on purpose. Compare the
  complexity numbers in the brief with the churn numbers: a file that is both
  complex and changed constantly is the design problem.
- The interface between the engine and the UI: how wide is it, and how much
  does the UI need to know about the engine's internals to work.
- Would splitting `index.html` help, or just move the problem. Answer with the
  seams that exist, not with a preference.
- State: what is in component state, what is on the instance, what is in
  localStorage, and whether the same fact is stored twice.

### 6.4 Test-suite strength

- Pick the ten most important behaviours. For each, break the code and see
  whether a test fails. Report every behaviour where nothing failed.
- Tests that assert implementation rather than behaviour.
- Tests that cannot fail: no assertion, an assertion behind a condition that is
  never true, a poll that swallows the failure.
- Fixture drift: tests that run against generated copies of the engine, and
  what happens when the copy is stale.
- Flakiness: which tests depend on the network, timing or ordering, and whether
  a failure there would be noticed or shrugged off.
- Coverage of the paths that matter: the five promises, not the line count.

### 6.5 Measurement and benchmark validity

- Who wrote the benchmark, who tunes against it, and what that does to the
  numbers. Look for rules in the engine that exist only because of a benchmark
  case.
- **Provenance of every lexicon and pattern term.** If a name list the engine
  matches against is also the list the generator draws from, recall is high by
  construction. That is textbook leakage. Trace the terms.
- **How many times has this benchmark been scored?** Each re-use of the same
  holdout erodes how much the latest number means.
- **The freshness gap.** Compare the synthetic score with the score on the five
  real documents, which were produced by a different process. The gap is the
  measure of overfit.
- **Per entity type, not aggregate.** Recall and precision side by side, with
  false negatives listed one by one. In a redaction tool a miss is the only
  failure that matters, and an aggregate hides it.
- **Is there a negative set?** Near-miss strings that must not be redacted,
  which catch an engine that redacts everything and scores perfect recall.
- Is the key right: spot-check the annotations against the documents.
- Does the gate protect anything: what change would it catch, what change would
  it miss, and can it be satisfied by editing the baseline.
- Do the reported categories mean what their names say.
- The private bench: five redacted outputs, not originals. What does that
  invalidate.
- Does any number in `docs/measurements.md` still hold at v48.

### 6.6 Privacy and security

- Trace every path by which bytes could leave the browser. Prove the list is
  complete, don't assert it.
- The guard on the session log and the leak report: try to get text past it.
  Long Hebrew strings are refused, but what about two-letter words, Latin
  transliteration, numbers, file names, or a value in a field name.
- Third-party code: React, Babel, d3, topojson, pdf.js, transformers.js, fonts,
  and the model weights. No Subresource Integrity, no Content-Security-Policy.
  What is the worst case if one of those CDNs serves something else tomorrow,
  and what would it cost to prevent it.
- The service worker: what it caches, for how long, whether a poisoned entry
  can persist, and how a user would recover.
- The model tokenizer is patched after download. What if the patch is applied
  to something unexpected.
- **Does a failed or tampered model load fail closed?** If the weights do not
  arrive, or arrive changed, the tool must not quietly continue with the
  rule-only engine while the interface suggests a full scan happened.
- **Is the model pinned to a revision**, rather than a moving branch, and is
  there any integrity check on the weights at all?
- Note for the reviewer: `integrity` only covers `<script>` and `<link>`. The
  model library is loaded by a bare dynamic import, which integrity does not
  cover. Judge what that leaves open and what the alternatives cost.
- A Content-Security-Policy with an explicit `connect-src` is what would make
  exfiltration impossible rather than merely absent. Is its absence a decision
  or an omission?
- Data at rest in the browser: localStorage keys, case profiles, IndexedDB,
  and what "new document" and "delete case" actually remove.
- LINDDUN categories, one question each: linking, identifying, non-repudiation,
  detecting, data disclosure, unawareness, non-compliance.

### 6.7 Accessibility and RTL

- Keyboard only: can every decision be made without a mouse, including the
  marks in the document and the inline editor.
- Screen reader: are the marks, the counters and the notices announced.
- Contrast and 200% zoom, in both themes.
- Focus: visible, trapped where it should be, restored after an overlay closes.
- RTL specifics: mixed Hebrew and Latin, numbers inside Hebrew sentences,
  direction marks in her documents, and text selection across a replacement.
- Does the tour block assistive use.

### 6.8 Decisions and documentation

- Pick ten non-obvious lines of code. Can you tell why they are that way from
  the code and its comment alone.
- Comments: do they state the rule, or narrate the bug that produced it. The
  brief measures how many comments are in Hebrew.
- Are the decisions in `docs/` still true of the code, and can you find the
  reasoning behind the current design without reading the changelog.
- Names: do the test names say what they protect.
- What would a new maintainer misunderstand first.

### 6.9 Process

- The release flow: what can reach the live site without a test, and what
  would catch a bad deploy.
- The quality plan: is it aimed at the risks that actually materialise, or at
  the ones that are easy to test.
- The bug loop: bugs are found by the user, by QA rounds, by benchmarks, by the
  self-check. Which class does each of those systematically miss.
- Version and rollback: how would a bad version be taken back, and how would
  anyone know it is bad.
- What in this process depends on one agent remembering something.

## 7. Output

One file, `REVIEW.md`, written to the reviewer's own scratch directory, never
into the repository:

1. **Verdict**, ten lines. What is sound, what is not, and the single most
   important thing to change.
2. **Findings**, ranked by severity then confidence, in the table format of
   section 3.
3. **Suspicions** — below 80 confidence, one line each, so nothing is lost.
4. **Dropped in verification** — what failed the second pass, and why.
5. **Nits** — at most ten, one line each.
6. **What was checked and found healthy** — per lens, so the coverage of the
   review itself is visible, including which regions of the app file were read
   line by line.
7. **Checklist verdicts** — every item in section 6 with checked, not
   applicable, or defect.
8. **What was not checked**, and why.

## 8. Handling afterwards

The maintainer reproduces each finding, fixes one per commit with a test, and
answers the reviewer in three lists: fixed, rejected with the reason, needs the
user's decision. Anything that is not Critical waits until after the client
session on about 2026-09-22.

## 9. Conflict of interest

The brief was written by the same agent that wrote the code. Treat it as
evidence from an interested party: where it asserts a property, check it. If
the brief itself is misleading, that is a finding.
