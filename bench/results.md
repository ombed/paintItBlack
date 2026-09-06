# Benchmark results

37 documents, 282 keyed entities, model on (q8, same artifact as the browser). Generated 2026-09-06.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 10 | 0 | 0 | 0 |
| person: name that is also a common word (lexicon-aided) | 7 | 0 | 0 | 0 |
| person: title attached | 8 | 0 | 0 | 0 |
| person: same person, one clean and one corrupted spelling | 12 | 0 | 1 | 0 |
| person: name split across two runs mid-word | 3 | 0 | 0 | 0 |
| org: private body, must be redacted | 9 | 1 | 1 | 0 |
| place: town | 12 | 0 | 0 | 0 |
| trap: case numbers, dates, section references | – | – | – | 1 |
| trap: idiom or public title beside a same-word name | – | – | – | 1 |
| person: full name, surname alone, first name alone | 8 | 0 | 0 | 0 |
| person: only in prose, never before a speech verb | 7 | 0 | 0 | 0 |
| person: Ethiopian name | 8 | 0 | 0 | 0 |
| person: role word directly before, no colon | 6 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 0 | 0 |
| place: neighbourhood | 6 | 0 | 0 | 0 |
| person: two people sharing a surname | 10 | 0 | 0 | 0 |
| person: Russian name | 8 | 0 | 0 | 0 |
| person: nikud on one occurrence | 3 | 0 | 0 | 0 |
| person: once, only with a prefix letter (expected to fail) | 2 | 1 | 1 | 0 |
| person: name that reads like a body's | 3 | 0 | 0 | 0 |
| org: public body, must not be redacted | – | – | – | 0 |
| person: two people edit-distance 1 apart (must not merge) | 6 | 0 | 0 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 4 | 0 | 0 | 0 |
| person: hyphenated surname, elsewhere with a space | 5 | 0 | 0 | 0 |
| person: minor, first name only | 5 | 2 | 2 | 0 |
| place: street | 8 | 0 | 0 | 0 |
| trap: פלוני / פלונית | – | – | – | 0 |
| person: two-letter surname | 4 | 1 | 1 | 0 |
| person: minor introduced by הקטין / הקטינה | 7 | 0 | 0 | 0 |
| pii: ID number | 10 | 0 | 0 | 0 |
| pii: mobile phone | 10 | 0 | 0 | 0 |
| pii: date of birth | 6 | 0 | 0 | 0 |
| pii: email address | 6 | 0 | 0 | 0 |
| pii: bank account | 5 | 0 | 0 | 0 |
| pii: licence plate | 4 | 0 | 0 | 0 |
| person: party by role word and colon, first name only | 6 | 0 | 0 | 0 |
| person: name right after a discourse word (כאמור, משכך, לדבריה) | 3 | 0 | 0 | 0 |
| trap: form label with a colon (not a speaker) | – | – | – | 0 |
| trap: word ending in ת before a word starting with ז (not ת"ז) | – | – | – | 0 |
| trap: הח"מ before a verb (not a name) | – | – | – | 0 |
| trap: role word in any spelling (אפוטרופא, אפוטרופוס) | – | – | – | 0 |
| trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) | – | – | – | 2 |
| person: speaker written on a line of its own (no colon) | 5 | 0 | 0 | 0 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 25 | 1 | 1 | 0 |
| filing | 35 | 0 | 0 | 2 |
| transcript | 32 | 1 | 1 | 0 |
| welfare | 24 | 0 | 0 | 0 |
| medical | 15 | 2 | 2 | 0 |
| police | 21 | 0 | 0 | 0 |
| bank | 15 | 0 | 0 | 0 |
| chat | 20 | 0 | 0 | 0 |
| position | 13 | 0 | 0 | 2 |
| audio | 19 | 1 | 2 | 0 |

## Unlisted suggestions (match nothing in the key; one tap each) — 25 in total

Counted, not optimised for: the list is read, accept-all is not how the tool is used.

- **meeting** (3, 3 applied): סיכמנו [discover; פותח תור דיבור בתמלול] **applied** · מהבניין [suggest] **applied** · נוער [suggest] **applied**
- **filing** (6, 6 applied): נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ירושלים [model] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · תצהיר [discover; פסקה שכולה שם, ואחריה דיבור] **applied** · תצהירי [near+flagged] **applied** · עלי [flagged] **applied**
- **transcript** (3, 3 applied): במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · יו"ר [discover; פותח תור דיבור בתמלול] **applied**
- **medical** (5, 5 applied): המטופלת [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · הנבדק [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · קלינית [suggest] **applied**
- **police** (2, 2 applied): ראיתי רכב [suggest] **applied** · המתלוננת [discover; פותח תור דיבור בתמלול] **applied**
- **bank** (2, 2 applied): החשבון [discover; פותח תור דיבור בתמלול] **applied** · יתרה לסוף התקופה [discover; פותח תור דיבור בתמלול] **applied**
- **chat** (1, 1 applied): מהוועד [suggest] **applied**
- **position** (2, 2 applied): הבהרה [discover; פותח תור דיבור בתמלול] **applied** · משה [model] **applied**
- **audio** (1, 1 applied): ושניהם [suggest] **applied**

## Missed and leaked, by document

- m3 · person: once, only with a prefix letter · הילי: missed, **leaked**: הילי, בהילי
- t2 · person: minor, first name only · אופק: missed, **leaked**: אופק
- h3 · person: two-letter surname · איה נץ: missed, **leaked**: איה נץ
- h3 · org: private body, must be redacted · מכון שורשים: missed, **leaked**: מכון שורשים, שורשים
- a2 · person: same person, one clean and one corrupted spelling · אלמליח: found via suggest as «אתמול ואלמליך», **leaked**: אלמליח, אלמליך
- a2 · person: minor, first name only · אסיף: missed, **leaked**: אסיף

## Traps and public bodies touched

- f2 · trap: case numbers, dates, section references · סעיף 2: suggested as «ת"פ 4471-02-26 [flagged]»; altered: ת"פ 4471-02-26
- f2 · trap: idiom or public title beside a same-word name · בגיל 8: altered: עם שחר
- x1 · trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) · לשם: suggested as «קדימה [flagged]»; altered: קדימה
- x2 · trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) · אורה: suggested as «עלי [flagged]»; altered: עלי

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 214 | 9 | 0 |
| m2 | meeting | 159 | 13 | 0 |
| m3 | meeting | 102 | 6 | 0 |
| m4 | meeting | 145 | 9 | 3 |
| f1 | filing | 157 | 14 | 2 |
| f2 | filing | 192 | 16 | 1 |
| f3 | filing | 132 | 9 | 0 |
| f4 | filing | 141 | 11 | 3 |
| t1 | transcript | 132 | 8 | 0 |
| t2 | transcript | 131 | 12 | 1 |
| t3 | transcript | 133 | 11 | 1 |
| t4 | transcript | 117 | 13 | 1 |
| w1 | welfare | 112 | 4 | 0 |
| w2 | welfare | 138 | 5 | 0 |
| w3 | welfare | 124 | 6 | 0 |
| w4 | welfare | 98 | 5 | 0 |
| h1 | medical | 115 | 7 | 2 |
| h2 | medical | 122 | 4 | 0 |
| h3 | medical | 79 | 5 | 3 |
| p1 | police | 101 | 5 | 1 |
| p2 | police | 101 | 4 | 1 |
| p3 | police | 97 | 2 | 0 |
| p4 | police | 81 | 3 | 0 |
| b1 | bank | 100 | 7 | 2 |
| b2 | bank | 73 | 3 | 0 |
| b3 | bank | 67 | 3 | 0 |
| c1 | chat | 91 | 5 | 0 |
| c2 | chat | 112 | 5 | 1 |
| c3 | chat | 115 | 4 | 0 |
| c4 | chat | 116 | 5 | 0 |
| x1 | position | 180 | 8 | 2 |
| x2 | position | 122 | 5 | 0 |
| x3 | position | 113 | 4 | 0 |
| a1 | audio | 110 | 7 | 0 |
| a2 | audio | 100 | 6 | 0 |
| a3 | audio | 129 | 8 | 1 |
| a4 | audio | 83 | 7 | 0 |
