# QA round: the brief

Layer 7 of `docs/QUALITY-PLAN.md`. Give everything below the line to a fresh agent
that can drive a browser (agent-browser, or Playwright from `node_modules`). It
needs nothing else: no earlier conversation, no private files.

---

You are running one exploratory QA round on paintItBlack, a browser-only tool
that replaces the names and identifying details in Hebrew legal documents with
invented ones, so the text can go to an AI and come back with the real names
restored. It has one user: a family lawyer. Three earlier QA rounds and every
automated test passed while she still found bugs, because the rounds walked the
straight path on clean documents. Your job is to use the tool the way she does
and find what breaks.

You do not change the repository. No edits, commits, branches, pushes or
deploys. You write one report to `qa-audit/<run-name>/report.md` in the checkout
(the folder is ignored by git, so it stays local). Scripts, screenshots and
downloads go beside it.

## 0. Read first (15 minutes at most)

- `docs/trial-guide-he.md`: what she was told the tool does, screen by screen.
  Every sentence there is a promise you can test.
- The top three entries of `CHANGELOG.md`: what changed recently. Recent change
  is where bugs are.
- `qa-audit/*/report.md` if present (earlier rounds; local only), otherwise skip.
  Everything filed there is fixed. A recurrence is a **regression**: file it
  with the old ID.
- `e2e/unruly.js` (the disturbance sequence), `e2e/base.js` (the checks run
  after every browser test) and `selfCheck()` in `index.html` (what the app
  checks about itself).

## 1. Setup

1. `npm ci`, then `netstat -ano | grep 4173`. If something already listens on
   4173, do not kill it: it may be another session's server, and it may be
   serving a different checkout. Stop and report that you could not run.
2. `node e2e/server.js` (in the background) serves the checkout on
   `http://127.0.0.1:4173/index.html`. Confirm the version chip at the foot of
   the page matches the top of `CHANGELOG.md`. Stop the server when you finish.
3. Use a fresh browser profile (a new Playwright context, or a new agent-browser
   session) for each document pair, so saved cases and settings from one pair do
   not leak into the next. Chromium stands in for Chrome and Edge.
4. Install these before the page loads, in every context:

```js
await context.addInitScript(() => {
  window.__PIB_TEST = true;                       // exposes window.__pib
  window.__csp = [];
  document.addEventListener("securitypolicyviolation",
    (e) => window.__csp.push(e.violatedDirective + " " + String(e.blockedURI).slice(0, 80)));
  window.__copied = [];                           // what "העתקה ל-AI" put on the clipboard
  const w = navigator.clipboard && navigator.clipboard.writeText.bind(navigator.clipboard);
  if (navigator.clipboard) navigator.clipboard.writeText = (t) => { window.__copied.push(t); return w ? w(t).catch(() => {}) : Promise.resolve(); };
});
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleLog.push(m.type() + ": " + m.text()); });
page.on("pageerror", (e) => consoleLog.push("pageerror: " + e.message));
```

5. **Harness tips.** While items wait for a decision, "העתקה ל-AI" and "הורדת
   Word" first ask, with "להעתיק בכל זאת" / "להוריד בכל זאת". Start
   `page.waitForEvent("download")` before the click and answer the question
   after it. `e2e/helpers.js` has `boot`, `upload`, `startScan` and `goOn`. The
   marks on the check screen are `[data-mark]`, with the original in `data-val`
   and the replacement as their text; a pending one has `data-badge="?"`.
6. **The model.** She works with the Hebrew model on. If the machine can reach
   huggingface.co, keep it on for at least one document pair (the first load
   downloads about 130 MB, once per profile). Otherwise, or to save time, turn it
   off in the entry settings, or serve the engine with `serveEngineWithStub`
   from `e2e/helpers.js`, which lets you choose what the model "finds". Say in
   the report which you used for each pair.

## 2. The probe: run it on every screen you reach

After every step and every disturbance, wait for animations to finish (see
`settle` in `e2e/unruly.js`), then record:

```js
const probe = () => page.evaluate(() => ({
  screen: window.__pib && window.__pib.state().screen,
  tour: !!(window.__pib && window.__pib.state().tour),
  check: window.__pib ? window.__pib.check(true) : [{ rule: "no-hook" }],   // must be []
  csp: window.__csp,                                                        // must be []
  dropped: window.__pib ? window.__pib.log().events.filter((e) => e.dropped).map((e) => e.ev + ":" + e.dropped) : [],  // must be []
  selfCheckEvents: window.__pib ? window.__pib.log().events.filter((e) => /^self-check/.test(e.ev)) : [],               // must be []
}));
```

plus the console errors, warnings and page errors since the last probe. Any
non-empty field is a lead. A missing hook is itself a finding: a check that
could not run must never read as "found nothing".

## 3. The persona

A fast, experienced family lawyer. Hebrew, right to left, Chrome or Edge on a
Windows laptop, a mouse and keyboard shortcuts. She does not read instructions
twice and she does not wait for things to finish before clicking. Her real
sessions (the 16.9 log) took 19 and 11 minutes per document, 80–85% of it on the
check screen. Per document she changed 14–15 pseudonyms, pressed "אל תחליף" or
"לא שם" 11–14 times, changed the style (name / blank / ███) 4–8 times, and
added only 3 names by hand. Her cost is overriding the tool, so that is where
you spend your time.

**Per document pair, one case, two documents in a row:**

1. Entry: choose the file. Try the pasted-text route on one document.
2. "מי בתיק": type a case name, add 3 names by hand (one pasted as two lines, one
   with a prefix letter, one with a geresh or gershayim), remove one, change one
   chip's kind, use ✂ on a two-word chip, answer an "אותו אדם?" pair, then
   "המשך" with "נמצאו גם" still open.
3. Places: "קבוצה אחרת", then "אל תחליף" on one town, edit one replacement.
4. Check screen, most of the session:
   - at least 10 pseudonym changes, mixing the card field and the in-place editor
     on a mark; include a female name for a man, a pseudonym that is another
     real name in the document, and an edit to the same person twice;
   - at least 8 "אל תחליף" / "לא שם", on cards, on single-form chips, and in
     the in-place editor;
   - at least 5 style changes (שם, ריק, ███, and back), on a name, an ID and
     a date;
   - select text in the document with the mouse and add it;
   - undo and redo (the buttons and Ctrl+Z) through at least 6 steps, including
     past a style change and a removal;
   - "‹ רשימת השמות", change the list, come back ("המשך" again): note what
     survived. Do it twice. Then re-run from "קובץ".
5. "העתקה ל-AI", then change one more pseudonym *after* copying.
6. "החזרת שמות מתשובת AI": paste two answers written from the copied text:
   - **Hebrew:** a paragraph that uses each pseudonym at least once, with prefix
     letters (ל, ו, ש, ב, מה), in quotes, and after a maqaf;
   - **English:** an English paragraph that keeps the Hebrew pseudonyms verbatim
     inside English sentences, plus one pseudonym transliterated into Latin
     letters. The Hebrew ones must come back. For the transliterated one the
     tool need not restore it, but it must not claim it did.
7. "הורדת Word", then "הורדת דוח השחרה" and "חבילת בדיקה + מייל" with the email
   field left empty.
8. "מסמך חדש", attach the same case ("שימוש בתיק הזה"), do the second document
   with a lighter pass (half the overrides), and download it too.

**Disturbances.** Spread these over the pair so each screen gets at least two:

- `disturb(page, label)` from `e2e/unruly.js` between steps (scrolling every
  pane, a narrower window, a click on empty space, a double-click, Tab and
  Escape, Back answered "stay");
- resize to 1280×720, 1920×1080 and 390×844 mid-task;
- 200% zoom: `page.evaluate(() => document.body.style.zoom = "2")` is not the
  same thing; use a 960×540 viewport with `deviceScaleFactor: 2` in a new
  context, or agent-browser's zoom, and say which;
- dark mode: `page.emulateMedia({ colorScheme: "dark" })`, and the theme toggle;
- slow network: a CDP session with `Network.emulateNetworkConditions` (for
  example 400 kbps, 400 ms latency) during the first load and the model
  download;
- reload in the middle of the check screen (answer the leave prompt both ways),
  and Back after the reload;
- a second tab on the same origin that opens the saved case and changes it
  while the first tab works.

## 4. The promises: check these every time, not only when something looks wrong

Keep a table per document of every real name, ID, phone, date and place you put
in the document, and what the tool showed as its replacement.

1. **Consistent across the case.** A person has one pseudonym in every form
   ("מרים", "למרים", "ומרים") in the check screen, the copied text and the Word
   file, and the same one in the second document of the case. Two people never
   share one.
2. **Nothing leaks from the file.** Unzip every downloaded .docx (and the docx
   inside the package zip) with `adm-zip` from `node_modules`. For each part,
   search the raw XML and the text with tags removed and direction marks
   (U+200E, U+200F, U+202A–U+202E) stripped, for every real value you did not
   deliberately keep: the full name, each word of three letters or more, and the
   ID and phone digits with and without separators. Also search the copied AI
   text, the report HTML, and the session log (which must hold no Hebrew word at
   all). A real value in any part is Critical unless you kept it on purpose.
3. **Restore puts names back.** Every pseudonym in the pasted answer comes back
   as the right real person, with the document's spelling. Two people are never
   merged, and no real name appears that the answer did not stand for.
4. **Your decisions stay.** A change you made is not undone by going back,
   re-running, reloading, undoing something else, or a second tab, unless the
   tool said so on screen.
5. **The trial guide is true.** When the screen disagrees with
   `docs/trial-guide-he.md`, note it.

## 5. Documents: synthetic only

Never open, copy or read anything under `../private-bench/`, the client folders,
or any document from a real case. Use only:

- `bench/corpus/*.docx` (invented cases; each `.txt` beside it is the text, and
  `bench/key.json` lists every entity);
- `e2e/fixtures/*`;
- documents you build: plain text through the tool's own writer (see `upload` in
  `e2e/helpers.js`), or real Word structure with `tests/mkzip.js` and
  `tests/structure-lib.js` (headers, footnotes, comments, text boxes, tracked
  changes, runs split mid-name).

Build each pair as two documents of one invented case: the same parties, a
lawyer, a child, a town or two, an ID, a phone, a date, an organisation. Give
them the typography real documents have: names in "…" and '…' quotes, gershayim
(עו"ד, תלה"מ), a geresh name (ברקוביץ׳), a maqaf, prefix letters, a footnote
digit glued to a name, a right-to-left mark before a name, a bold first name
and a plain surname, the same person by first name alone and by full name. Save
your generator script beside the report so every document can be rebuilt.

## 6. Severity

- **Critical**: breaks a promise. A real value in the output or the copied text,
  restore returning the wrong person, or her decisions or document lost without
  warning.
- **High**: a wrong result she would not notice, or a check that reports clean
  when it could not run.
- **Medium**: a result she would notice and have to work around, or a workflow
  that costs her real time.
- **Low**: cosmetic or cheap, no effect on the output.

## 7. Rules for a finding

- **Reproduce it twice** from a fresh context, by the written steps, before you
  file it. Something seen once goes under "Observations" with what you saw.
- **Name the class, not only the instance.** Say which rule broke and probe its
  siblings: other prefix letters, other quote styles, the other screen that
  does the same thing, the other kind of value. Say what you probed and what
  failed.
- **Suggest the test**: the file under `tests/` or `e2e/` it belongs in (an
  existing one by preference), and what it should assert.
- Check it is not already in the earlier reports or explained in the trial
  guide as intended behaviour.
- Harness artefacts (a download your tool could not capture, a headless
  clipboard refusal) are not app bugs. List them under "Evidence caveats".

## 8. Budget and stop conditions

- About 90 minutes of work in total, plus the write-up. Two document pairs is a
  full round; one pair with every disturbance is a minimum.
- Stop early and write up if: the app does not load or the self-check hook is
  missing; the port is taken; you would need a real document to go on; or you
  have filed a Critical. Write up a Critical as soon as it reproduces twice, then
  use what is left of the budget on its class.
- Past the budget, stop even if you are mid-probe. Say what you did not reach.

## 9. The report

`qa-audit/<run-name>/report.md`, in the form of the earlier rounds:

1. A header table: date, app URL and version chip, tooling, scope, fixtures,
   model on, off or stubbed per pair, and what you did not do.
2. Evidence caveats.
3. A summary table: count and IDs per severity (C1, H1, M1, L1…), and any
   regressions with their old IDs.
4. Each finding:

```markdown
### H1: <what she would see, in one line>

| Field | Value |
|---|---|
| **Severity** | high (why, in a few words) |
| **Category** | functional / data integrity / leak / restore / layout / a11y |
| **Where** | screen and control |
| **Reproduced** | twice, contexts `a` and `b` |
| **Evidence** | probe output, screenshot, unzip result |

**Steps** (from a fresh context, numbered, exact clicks and text typed)
**Expected** / **Actual**
**The class**: the rule that broke, the siblings probed, which failed.
**Suggested test**: `e2e/<file>.spec.js`, asserting …
**Why the tests missed it**: no test, weak assertion, or a test that holds still.
```

5. "Checked and clean": for each screen, which probes, promises and
   disturbances ran and found nothing. Silence must be distinguishable from not
   looking.
6. Observations: things seen once, and questions for the maintainer.
7. Files: the generator script, probe logs, screenshots, downloads.
