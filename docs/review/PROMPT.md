# The prompt to give the reviewing session

Open a fresh Claude Code session in `C:\Users\Me\.vscode\paintItBlack\repo-clone`
and paste everything between the lines. Nothing else is needed: the brief and
the charter are in the repository.

---

I want a rigorous, adversarial review of this project: the code, the tests, the
measurements and the way it is developed. Use a workflow with parallel agents,
one per review lens, plus a verification pass. This is a read-only review: do
not edit, commit, branch, deploy, or comment on anything in the repository.

Read these two files first, in full:

- `docs/review/BRIEF.md` — what the product is, what it promises, how it is
  built, how it is measured, what is off limits.
- `docs/review/CHARTER.md` — the rules of this review: scope, what counts as a
  finding, severity, the evidence standard, the verification pass, the lens
  checklists, and the report format.

`docs/review/SOURCES.md` records where the checklists come from, with what is
and is not verified. Read it if you want the reasoning behind a check.

The brief was written by the agent that wrote the code. Treat it as testimony
from an interested party. Where it asserts a property, check the property. If
the brief is wrong or misleading anywhere, that is itself a finding.

Skills to use, each on the lens it serves. Invoke them by these names; if one is
not installed, say so in the report and continue without it.

- `superpowers:dispatching-parallel-agents` — one agent per lens.
- `mattpocock-skills:codebase-design` — architecture and module depth. State
  which definition of module depth you are using.
- `engineering:code-review` — correctness, general security, maintainability.
- `security-review` (built-in) — the privacy and security lens. Extend it with
  the supply-chain questions in the charter: third-party scripts from CDNs,
  Subresource Integrity, Content-Security-Policy, service-worker cache
  poisoning, model-weight integrity, and any channel by which document text
  could leave the browser.
- `design:accessibility-review` — accessibility, plus the right-to-left and
  Hebrew specifics in the charter.
- `mattpocock-skills:diagnosing-bugs`, phases 1–3 only — to build a failing
  case for any suspected defect. Do not apply its fixes.
- `superpowers:verification-before-completion` — no claim without fresh
  evidence from a command you ran.
- `engineering:tech-debt` — only at the end, to rank what you found.

Method:

1. Run each lens as its own agent, in parallel, with the lens checklist from
   the charter. Each returns findings in the charter's format, with evidence.
2. Then run a refutation pass whose only job is to kill every Critical and High
   finding: find the guard, the test, or the reason it cannot happen. Judge it
   by how many it kills, not by how many it confirms. Findings that survive are
   marked CONFIRMED. Findings that do not move to the "dropped in verification"
   section with the reason. Never let the agent that produced a finding verify
   it, and treat agreement between agents as worth nothing on its own.
3. Rank what survives and write the report.

Evidence rules: run the commands, read the output, quote it. A claim about what
the code does needs a `file:line` citation and, when it is a claim about a
result, an input that reproduces it and the output you actually got. An
inference from a name or a comment is not evidence. Give every finding a
confidence from 0 to 100 and report only those at 80 or above as findings;
everything below goes in the "Suspicions" list, one line each. Cap nits at ten
and keep them out of the findings table. Do not report style preferences, do
not report what the linter or CI already enforces, and do not report anything
already in the brief's "Things we already know" unless you add new evidence or
a cause.

Silence must be distinguishable from not looking. Give every checklist item a
verdict of checked, not applicable or defect. End every lens with what it
examined and found healthy. For `index.html`, say which regions you read line
by line and which you skimmed.

Two hard rules. Do not read or quote anything under `../private-bench/`; it
holds real client documents. Do not write anything into the repository: put the
report at `REVIEW.md` in your own scratch directory and give me its path.

Take the time this deserves. I would rather have twenty findings that are all
true than sixty of which half are noise.

---
