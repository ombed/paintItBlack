---
name: session-triage
description: Triage the client's session package for paintItBlack (a zip holding session-log.json, maybe leak-report.json) into a plain summary for the owner and a ranked engineering list, without fixing anything. Use when her package arrives, or when asked what her session showed.
---

# Session triage

She is the one real user: a family lawyer. After each document she presses the package button and the owner forwards the zip. This routine turns packages into two things: a plain answer to "how did it go", and the three things costing her most, with evidence. It ends by recording the findings and **waiting for the owner's go**. Fixing is a separate step the owner starts.

**Privacy is the hard edge of every step.** Her documents are real client files. Everything you read, write, print or commit carries structure only: event codes, counts, minutes, shape fields. Keep packages where the owner put them and point the tools at that path. When any output could hold Hebrew (a file name, a path, from-leak's paragraphs), pipe it through `sed 's/[א-ת]/•/g'`. The redacted document inside a package can hold a name that leaked: leave it closed. `scripts/log-report.js` refuses to print Hebrew; if it throws "would carry text", that is an app bug in the log's guard: stop and report it as finding one.

Run every command from the repository checkout (`repo-clone`, or the worktree you are in).

## 1. Locate

The packages sit in a new folder under the sibling working folder `C:\Users\Me\.vscode\paintItBlack\עיצוב ממשק המשתמש מחדש\` (earlier ones: `use 15.9`, `use 16.9`). Names are `paintItBlack-package-<date>`, often with no extension and with a suffix she added ("first", "second"). The same folder holds `.docx` files, which are zips too: take only the package files.

Done when: you have the list of package paths, one per document she sent, and the owner has confirmed the folder if more than one new folder exists.

## 2. Read the logs

```
npm run log-report -- "<package>" ["<package>" ...]
```

Read every section for every package. The report's own terms:

- **Screens**: `entry`, `busy`, `people` (who is in the case), `places`, `work` (the check screen, where the minutes go).
- **Documents**: one log covers one page load. Several documents in one load are split at `new-doc`, each with minutes, corrections and share on `work`.
- **Corrections** (`allow` = "don't replace", `not-a-name`, `drop-rule`, `set-rep` = pseudonym changed, `set-style`, `merge`, `add-rule`), each by **source**. Source codes, combinable (`ms` = model and speaker): `m` model · `h` header · `s` speaker · `p` case profile · `t` typed by her · `b` body scan · `w` consistency sweep · `x` pattern (number, date) · `n` near spelling. A correction concentrated on one source names the layer to look at.
- **set-rep**: what she changed in a pseudonym (`part` first/last/whole, `gender`, `origin`, `style`, and what the pseudonym `was`).
- **Misses** (`miss`): names she added herself, and what each layer thought of them (model band and bounds, header, body-scan suggestion, near spelling).
- **Model**: time, cached or downloaded, found by type, the confidence bands of raw spans.
- **Runs** (v53): verification passed n/m, and which scans did not finish (`incomplete`: `body`, `labels`). Beneath: `model-partial` (chunks the model could not read), `pdf-image-pages`, `file-early`, `model-forget`.
- **Export asked** (v53): how often the download or copy asked first and why (open items, failed verification, incomplete scan), then what she chose (`anyway`, `show`).
- **Self-check** breaks, `self-check-full` (it stopped listing after 40 distinct breaks), **page errors**.
- **Other events**: anything the report has no line for. A new code here means the app logs something the report ignores: add a line for it (step 2a).
- **Leak report**: how many shapes the package carries. It covers only the document open when she packed; the log covers the whole page load.

`file-early` has a line in the report, but v53 does not log it (a file chosen before the engine loaded is queued silently). Its absence says nothing.

A log older than v53 has no Runs/Export lines; one older than v45 has no self-check. The report says so.

**2a. When the report falls short** (an event under Other that matters, a field you need that it does not break down): extend `scripts/log-report.js`, with a check in `tests/logreport_t.js` on synthetic events that fails on the old code. This is tooling, allowed before the go; the app itself is not.

Done when: for every package you can state minutes per document, share on `work`, corrections by kind and source, pseudonym changes by part/gender/origin, misses, model band picture, runs and export questions, self-check and page errors.

## 3. Compare with the baseline

The 16.9 session (v35, model on, one document per package), the last one with numbers:

| per document | 16.9 |
|---|---|
| minutes | 19.0 and 10.9 |
| share on `work` | 81% and 86% |
| all corrections | 38 and 42 |
| pseudonym changes (`set-rep`) | 14 and 15 |
| "don't replace" + "not a name" | 11 and 14 |
| style changes | 8 and 4 |
| names she added by hand | 3 per document |

Her cost then was overriding the tool's choices, not missed names. The v35 logs could not say why; v48+ logs can, so this is the first comparison that has causes.

Done when: every row has a new value per document, with the direction (better, worse, same) and the likely reason from step 2.

## 4. Reproduce the leaks

For each package with a leak report:

```
node bench/from-leak.js "<package>" | sed 's/[א-ת]/•/g'
node bench/from-leak.js "<package>" --model | sed 's/[א-ת]/•/g'
```

It reads `leak-report.json` from the zip in memory and rebuilds each shape as a synthetic paragraph with a made-up name. Per shape:

- **reproduced**: `NOT FOUND` or `leaked` on the synthetic document. The failure is in the shape's class, so the benchmark can hold it: a candidate category for `bench/corpus-more.js`. Note whether it reproduces without the model, with it, or both, and whether she had the model on (`modelUsed`).
- **not reproduced**: found on the synthetic document. Something the shape does not carry decided it (the real context words, document structure). Name which shape fields were closest to the edge (a `layers.model` score near a band boundary, `cut-left`/`glued-right` bounds, a prefix, `inList` with `listForm`).

A `refused` list in the report means the app's schema rejected a field: that is a finding in itself.

Done when: every shape of every leak report is classified, without and with the model.

## 5. Write two outputs

**For the owner**, who relays to a non-technical client manager: in the language the owner writes in, outcome first ("she spent X minutes per document, down from 19 and 11; most of it still on the check screen"), then what went wrong for her in plain words, then what we would do next. No codes, no layer names, no English jargon. Six sentences at most.

**For engineering**, in English: the **top three costs to her**, ranked by minutes or taps spent. Each has:

1. **Cost**: what she paid (minutes, count of corrections, a leak).
2. **Evidence**: the report lines, counts and codes behind it, per package.
3. **Class**: the class of failure, not the instance (the owner's rule: fix the class).
4. **Fix class**: the kind of change that removes the class, and the check that would fail on today's code.

Add below the three: leak classifications from step 4, and anything that broke (page errors, self-check breaks, a text refusal, an incomplete scan).

Neither output holds text from her documents: structure, counts and codes only, Hebrew masked.

Done when: both outputs are written in your reply, and every claim in them traces to a line from step 2 or 4.

## 6. Record, then stop

Add a section to `C:\Users\Me\.claude\projects\C--Users-Me--vscode-paintItBlack-----------------------\memory\client-sessions.md`: the session date and version, where the packages are, the per-document numbers against the baseline, the three costs, the leak classifications. Update its `description` and the `MEMORY.md` line if the headline changed. In `current-state.md`, replace "when her package arrives" with a pointer to the new findings.

Then stop. Report to the owner and wait for the go before any fix, branch or benchmark change. The deploy freeze in `current-state.md` still holds until the owner lifts it.

Done when: the memory note holds the findings and the owner has the two outputs.
