# The next phase — settled 2026-09-06

Decisions from the grilling session, in the order they were made, then the
work they imply. Nothing below is assumed; every line was asked and answered.
The lawyer's questionnaire (609 words, received the same day) fed rounds
three and four; its facts are summarised, never quoted with identifiers.

## What is settled

| # | question | decision |
|---|---|---|
| Q1 | who uses it | one lawyer now, on her own machine; built so a colleague on another machine, and later other lawyers via the public URL, need no redesign |
| Q2 | what "safe to send" means | names and numbers gone; places and organisations are her call, flagged but never blocking |
| Q3 | how real files reach testing | she sends cleaned files via you for now; a one-button send later (Q9) |
| Q6 | licence | PolyForm Shield 1.0.0: anyone may use it, including in a practice; nobody may sell it or build a competing product on it |
| Q7 | the recall gate | blocking now: a PR that increases leaks or misses in any benchmark category cannot merge until fixed or the baseline is updated in that PR |
| Q8 | what blocks the green bar | person names, ID numbers, phones, emails, bank accounts, plates, dates of birth, and street addresses with a number. Towns, neighbourhoods, private organisations and public bodies are flagged only |
| Q9 | one-button send | packages the cleaned document and the shape report into one file and opens her mail client with the address filled in; no server, nothing automatic |
| Q10 | gazetteer and transcript | full Israeli settlement list now, with homograph handling; the Knesset transcript is keyed only if her cleaned transcripts do not arrive within two weeks |
| Q11 | case profiles | the browser keeps a list of recent cases by name; the entry screen shows them; export and import stay for moving between machines |
| Q12 | the restore step | first-class: after "copy to AI" the bar offers "paste the answer", pre-loaded with this document's mapping. Three visible steps: redact, send, restore |
| Q13 | the model on first run | on by default, one-time-download message, deterministic result shown immediately while it loads; measure time-to-first-result; the reported loading problem is investigated below |
| Q14 | what the trial produces | she tries it alone and reports; plus the local session log (Q16) |
| Q15 | transcription errors | ask her for two or three cleaned transcripts with the typos left in; build the near-miss measurement from those |
| Q16 | session log | always on, local only, no text; exported by a button next to the leak report; nothing leaves the machine unless she exports |

## What the questionnaire changed

- She does this almost daily, on several documents in parallel: meeting
  summaries for herself and positions or motions for court. One profile slot
  was the wrong shape (Q11).
- The round trip is the job: strip, send to ChatGPT (sometimes Gemini), get
  rewritten text back, put the real names back. Restore was a side link;
  for her it is step three of every task (Q12).
- Her leaks come from transcription typos in text she transcribes from audio
  herself ("פנים מאירות" replaced, "פנים מהירות" left). The near-miss layer is
  the one that matters most to her, and her own cleaned transcripts are the
  right test material (Q15).
- Her acceptance test is speed: twenty minutes on a real case in the next
  two weeks, and she uses it again if it is efficient and fast (Q13, Q16).
- She uses Word find-and-replace today and finds inventing realistic
  replacement names the tiresome part. The fake-name generator is a feature
  she will notice.
- Files move by email and through the office document system, and only she
  does this work. No sync, no accounts (Q1, Q9).

## The homograph rule for the settlement list

Every town name that is also a common word, a first name in the tool's
lists, or a word that appears in the document with a prefix or the definite
article elsewhere ("באזור" next to "אזור") goes on the ambiguity list
automatically: it is flagged for her, never auto-replaced. The list stays a
data file, not code, so a wrong entry is a one-line fix.

## The work, in order

1. **Ship the decisions that are one file each.** PolyForm Shield in
   LICENSE. `GATE_BLOCKING=1` in the workflow. Bar logic per Q8.
2. **Case profiles as a list** (Q11), with a browser check that two cases
   keep separate fake names and switching is one tap.
3. **Restore as step three** (Q12): the bar after copy, the restore screen
   pre-loaded, the three steps visible on the check screen.
4. **Model loading** (Q13): fix what the live measurement shows, then a
   first-run message that says what is downloading and why, and the
   deterministic result on screen while it happens.
5. **Session log and mail package** (Q9, Q16): one export mechanism shared
   with the leak report; the mail button assembles the package.
6. **Settlement list with homograph handling** (Q10), measured on the
   benchmark: the two town leaks close, no new false positives.
7. **Her cleaned transcripts** (Q15): each becomes a benchmark document
   with its typos keyed; the near-miss sweep becomes measurable.
8. **The trial** (Q14): after 1 to 5 are live, she runs it; the log and her
   report decide the round after.

Items 1 to 5 are the trial's prerequisites and fit before her two weeks are
up. 6 and 7 run alongside as the files arrive.

## Loading measurement (live site, v17, fast office-grade connection)

| | first visit | second visit, same browser |
|---|---|---|
| page interactive | 3.8 s | 0.6 s |
| tokenizer (2.9 MB) downloaded and repaired | 4.4 s to 5.5 s | 1.0 s to 2.7 s, downloaded again |
| model weights (130 MB) | 6.3 s to 11.9 s | from cache |
| WASM runtime | 12.3 s | cached |
| names on screen | 15.3 s | 5.9 s |

Three things explain "loading is not working so good", none of them a
broken download:

1. **Nothing is shown until the model finishes.** The deterministic layers
   had the two parties within a second; the screen showed a spinner until
   second 15. On a slow line that is minutes of a spinner. Fix: fill the
   list from the deterministic layers at once, then add the model's names
   when they arrive, labelled as such (Q13).
2. **The percentage lies.** Progress is the average across files, and the
   small files hit 100% instantly, so the bar jumps to 76% and then crawls
   while the one 130 MB file loads. Fix: weight progress by bytes.
3. **The tokenizer is re-downloaded on every visit** (2.9 MB, by design:
   "every existing copy is suspect"). On a slow line that is the first
   several seconds of every session. Fix: reuse the cached repaired copy
   when it parses; re-download only when it does not.

Second-visit total of 5.9 s says the weight cache works; the trial's first
run is where the minutes go, and item 4 in the list above is the work.

## Status, end of the same day

| item | state |
|---|---|
| 1. licence, blocking gate, bar logic | done |
| 2. case list | done, `e2e/profile.spec.js` |
| 3. restore as step three | done, `e2e/steps.spec.js` |
| 4. loading: byte progress, tokenizer cache reuse, continue without waiting | done, `e2e/wait.spec.js` |
| 5. session log and mail package | done; the mail address is a field in the profile section, empty until she sets it |
| 6. settlement list with homograph handling | done: 1,116 localities, the two town leaks closed, no new false positives |
| 7. her cleaned transcripts | waiting on the files |
| 8. the trial | ready once #12 is merged and the chip reads v18 |

Benchmark after this round, model on, product options: 3 leaks (the two
expected-fail categories and one two-letter surname the model does not see),
2 false positives (bench artefacts), 28 junk suggestions.
