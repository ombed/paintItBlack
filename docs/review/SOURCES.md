# Sources behind the review checklists

Where the checks in `docs/review/CHARTER.md` come from. Items marked
**[unverified]** could not be confirmed against a primary source during the
research pass: the book or paper was paywalled, the PDF would not parse, or the
host blocked fetching. Treat those as leads, not authority. Researched
2026-09-20.

## Design and structure

- **John Ousterhout, *A Philosophy of Software Design***. The red flags used in
  lens 6.3: shallow module, information leakage, temporal decomposition,
  overexposure, pass-through method, repetition, special-general mixture,
  conjoined methods, comment repeats the code, vague name, non-obvious code.
  No free primary text; wording reconstructed from consistent summaries
  (https://notes.portebois.net/2021/03/04/13.html, https://sive.rs/book/PoSD).
  **[unverified against the book's own appendix]**
  - Useful tests: for information leakage, grep one format assumption and count
    the files that know it. For special-general mixture, check whether a
    general matcher names a specific entity type.
- **Google, "The Standard of Code Review" and "What to look for"**,
  https://google.github.io/eng-practices/review/reviewer/standard.html and
  .../looking-for.html. The standard is "definitely improves the overall code
  health", not perfection. Optional polish is prefixed "Nit:" and never blocks.
  Dimensions: design, functionality, complexity, tests, naming, comments,
  consistency, documentation, every line, context.
  - Adopted: findings are marked blocking or nit; the reviewer must say which
    regions of the 3,800-line app file were read line by line and which were
    skimmed.
- **Martin Fowler, *Refactoring*, 2nd ed.**, https://refactoring.com/catalog/.
  Smells used in lens 6.2: duplicated code, repeated switches, shotgun surgery,
  divergent change, long function, large class, speculative generality, mutable
  global data, comments compensating for unclear code. **[list wording
  unverified]**
  - Efficiency versions of the same smells: a regular expression rebuilt inside
    a loop, the document re-scanned once per rule, lexicon lookups by array
    scan instead of a Set or Map.

## Review method

- **Fagan inspection**, M. E. Fagan, IBM Systems Journal 15(3), 1976; overview
  at https://en.wikipedia.org/wiki/Fagan_inspection. Roles, phases, and the
  rule that the inspection logs defects only while fixes happen later.
  **[the 1976 paper itself was not fetched]**
  - Adopted: the reviewer never fixes. Also adopted: a checklist per risk class
    with an explicit "checked / not applicable / defect" verdict for every
    item, so coverage is systematic rather than opportunistic.
- **Bacchelli and Bird, "Expectations, Outcomes, and Challenges of Modern Code
  Review", ICSE 2013**,
  https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/ICSE202013-codereview.pdf.
  Defects are the stated motivation but a minority of comments; the dominant
  difficulty is understanding the code and the change. **[percentages from
  secondary summaries]**
  - Adopted: the brief exists at all because of this finding. Also: spend the
    budget on the few high-risk regions, and tally improvements separately from
    defects so the defect signal stays visible.
- **Anthropic, Claude Code code review**, https://code.claude.com/docs/en/code-review.
  Several agents each look for a different class, then a verification step
  checks candidates against actual behaviour to remove false positives.
  Findings are deduplicated and severity-ranked; the default focus is
  correctness, not formatting. Their suggested evidence bar is adopted almost
  verbatim: a claim about behaviour needs a `file:line` citation in the source,
  not an inference from naming.
- **Known failure modes of LLM reviewers.** High false-positive volume on real
  projects, and agreement across many agents on a vulnerability that does not
  exist. Sources: "Refute-or-Promote: An Adversarial Stage-Gated Multi-Agent
  Review Methodology", https://arxiv.org/abs/2604.19049; "Measuring and
  Exploiting Contextual Bias in LLM-Assisted Security Code Review",
  https://arxiv.org/abs/2603.18740. **[both unverified: the host blocked
  fetching]**
  - Adopted: a refutation pass that is scored on how many findings it kills,
    never run by the agent that produced the finding; a reproducing input
    required for every finding; and an explicit "no issues found in X"
    statement, so silence is distinguishable from not looking.

## Tests

- **Kent Beck, Test Desiderata**, https://testdesiderata.com/. Isolated,
  composable, deterministic, fast, writable, readable, behavioural,
  structure-insensitive, automated, specific, predictive, inspiring.
  - The ones that bite here: deterministic (the model and the network must be
    stubbed), structure-insensitive (assert on redacted output, not on internal
    span objects), specific (a benchmark aggregate tells you nothing) and
    predictive (do green tests actually imply no leak?).
- **StrykerJS**, https://stryker-mutator.io/docs/stryker-js/getting-started/
  and .../configuration/. Score is killed over killed plus survived; the report
  also buckets no-coverage and timeout. Default thresholds high 80, low 60.
  A generic `command` runner exists for suites that are not a framework, which
  is what this project has.
  - The valuable output is the list of survived mutants in the engine's offset
    arithmetic, word boundaries and lexicon matching, not the score.
  - Cost is roughly one suite run per mutant. Narrow `mutate` to one engine
    file first and use incremental mode. **[wall-clock cost unverified]**

## Measurement validity

- **Kapoor and Narayanan, "Leakage and the reproducibility crisis in
  machine-learning-based science", Patterns 4(9), 2023**,
  https://www.cell.com/patterns/fulltext/S2666-3899(23)00159-9. A taxonomy of
  eight leakage types across 294 affected papers.
  - Direct check here: is any lexicon or regular-expression term traceable to
    the benchmark's own generator? If the generator draws names from the same
    list the engine matches, recall is high by construction.
- **Goodhart's law**, https://en.wikipedia.org/wiki/Goodhart%27s_law. Check how
  many engine changes were made because a benchmark number moved.
- **Reusable holdout**, Dwork et al., Science 2015,
  https://www.science.org/doi/10.1126/science.aaa9375, and "The Ladder", Blum
  and Hardt, https://arxiv.org/abs/1502.04585. How often the same benchmark has
  been scored bounds how much the last number can be trusted.
- **Recht et al., "Do ImageNet Classifiers Generalize to ImageNet?"**,
  https://arxiv.org/abs/1902.10811. A fresh test set drawn by a different
  process is the measurement of overfit. Here that is the private bench.
- Concrete checks adopted: recall and precision per entity type rather than one
  aggregate; false negatives listed one by one, since in a redaction tool a
  miss is the only failure that matters; the benchmark frozen, versioned and
  hashed, with a record of which engine version was tuned against which
  version; a negative set of near-miss strings that must not be redacted.

## Privacy and the browser supply chain

- **LINDDUN**, https://linddun.org/threat-types/. Linking, identifying,
  non-repudiation, detecting, data disclosure, unawareness, unintervenability,
  non-compliance. The two that map least obviously here: *detecting*, where
  observable behaviour such as a request that happens only when an entity is
  found reveals content; and *non-compliance*, where the output looks redacted
  but the original text survives somewhere.
- **Subresource Integrity**,
  https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity.
  `integrity` with `crossorigin="anonymous"` covers cross-origin `<script>` and
  `<link>`. It does not cover a bare dynamic `import()`, which is how the model
  library is loaded here, so that path is not integrity-protected. Options are
  an import map with integrity, a `modulepreload` link, or self-hosting.
  **[whether an import map's integrity support covers this case is unverified]**
- **Content-Security-Policy.** An explicit `connect-src` and `script-src`
  allowlist is what makes exfiltration of document text impossible rather than
  merely absent. WebAssembly needs `wasm-unsafe-eval`.
- **transformers.js environment**,
  https://huggingface.co/docs/transformers.js/en/api/env. Browser cache is on
  by default, the cache key is `transformers-cache`, and weights come from the
  Hugging Face hub unless remote models are disabled.
  - Checks: is the model pinned to a revision rather than a moving branch; is
    there any integrity check on the weights; and does a failed or tampered
    model load **fail closed** rather than quietly falling back to the
    rule-only engine while the interface still claims a full scan.
- **Service worker.** No caching of unverified cross-origin responses; cache
  names keyed by version; a working update path so a poisoned entry cannot
  persist; and a way for the user to recover.

## Tools, with the exact commands

- Cyclomatic complexity:
  `npx eslint --no-config-lookup --config <flat-config> --rule '{"complexity":["error",{"max":15}]}' <files>`.
  The ESLint default limit is 20, https://eslint.org/docs/latest/rules/complexity.
- Cognitive complexity and near-duplicate functions: `eslint-plugin-sonarjs`,
  rules `sonarjs/cognitive-complexity` (default 15), `no-identical-functions`,
  `no-duplicate-string`,
  https://github.com/SonarSource/eslint-plugin-sonarjs.
- The app file is HTML, so plain ESLint skips it. Either use
  `eslint-plugin-html` configured in the flat config, or extract the script
  block to a temporary `.js` first. **[flag form for ESLint 9 unverified]**
- Duplication: `npx jscpd . --min-tokens 50 --reporters console,html --ignore "**/node_modules/**"`,
  https://github.com/kucherenko/jscpd.
- Dead code and unused exports: `npx knip`, https://knip.dev. It needs entry
  configuration and will not see the inline script in the app file.
- Dependencies: `npm audit --audit-level=high`, `npm outdated`. For a CDN asset
  compute the SRI value with
  `openssl dgst -sha384 -binary <file> | openssl base64 -A`.
- Coverage, as input to mutation testing: `npx c8 --reporter=text --exclude "node_modules/**" --include "tests/core.js" --include "tests/*-core.js" --include page-logic.js node tests/run.js`.
  The engine under test is `tests/core.js` and its siblings, each a copy of `redact-engine.js` built by
  `tests/build-fixtures.js`, and c8 excludes `tests/` by default: the bare `npx c8 node tests/run.js`
  measured `page-logic.js` and the scripts and no engine code at all (outside review, L5). Read the
  table per file; the summary counts each copy of the engine separately.
