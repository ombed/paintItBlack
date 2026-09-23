# Benchmark results

43 documents, 332 keyed entities, model on (q8, same artifact as the browser). Generated 2026-09-23.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 10 | 0 | 0 | 0 |
| person: name that is also a common word (lexicon-aided) | 7 | 0 | 0 | 0 |
| person: title attached | 8 | 0 | 0 | 0 |
| person: same person, one clean and one corrupted spelling | 12 | 0 | 0 | 0 |
| person: name split across two runs mid-word | 3 | 0 | 0 | 0 |
| org: private body, must be redacted | 10 | 0 | 1 | 0 |
| place: town (lexicon-aided) | 12 | 1 | 0 | 0 |
| trap: case numbers, dates, section references | – | – | – | 1 |
| pii: full date (omitted by default) | 18 | 0 | 0 | 0 |
| trap: idiom or public title beside a same-word name | – | – | – | 1 |
| person: full name, surname alone, first name alone | 9 | 0 | 0 | 0 |
| person: only in prose, never before a speech verb | 7 | 0 | 0 | 0 |
| person: Ethiopian name | 8 | 0 | 0 | 0 |
| person: role word directly before, no colon | 6 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 0 | 0 |
| place: neighbourhood | 6 | 0 | 0 | 0 |
| person: two people sharing a surname | 10 | 0 | 0 | 0 |
| person: Russian name | 8 | 0 | 0 | 0 |
| person: nikud on one occurrence | 3 | 0 | 0 | 0 |
| person: once, only with a prefix letter (expected to fail) | 3 | 0 | 0 | 0 |
| person: name that reads like a body's | 3 | 0 | 0 | 0 |
| org: public body, must not be redacted | – | – | – | 0 |
| person: two people edit-distance 1 apart (must not merge) | 6 | 0 | 0 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 4 | 0 | 0 | 0 |
| person: hyphenated surname, elsewhere with a space | 5 | 0 | 0 | 0 |
| person: minor, first name only | 10 | 0 | 0 | 0 |
| place: street | 8 | 0 | 0 | 0 |
| trap: פלוני / פלונית | – | – | – | 0 |
| person: two-letter surname | 5 | 0 | 0 | 0 |
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
| trap: role word in any spelling (אפוטרופא, אפוטרופוס) | – | – | – | 1 |
| trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) | – | – | – | 2 |
| person: speaker written on a line of its own (no colon) | 5 | 0 | 0 | 0 |
| person: foreign first name only after a care or teaching role word, in child speech | 3 | 0 | 0 | 0 |
| person: everyday word as a first name, before a speech verb (lexicon-aided by design) (lexicon-aided) | 3 | 0 | 0 | 0 |
| channel: person only in the page header | 3 | 0 | 0 | 0 |
| channel: person only in a footnote | 3 | 0 | 0 | 0 |
| channel: person only in a picture's alt text | 2 | 1 | 1 | 0 |
| channel: person only in a comment and as its author (removed by design) | 3 | 0 | 0 | 0 |
| channel: person only in the file's properties (emptied by design) | 3 | 0 | 0 | 0 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 27 | 0 | 0 | 0 |
| filing | 39 | 0 | 0 | 2 |
| transcript | 33 | 0 | 0 | 0 |
| welfare | 27 | 0 | 0 | 0 |
| medical | 19 | 0 | 0 | 0 |
| police | 22 | 1 | 0 | 0 |
| bank | 18 | 0 | 1 | 0 |
| chat | 23 | 0 | 0 | 0 |
| position | 13 | 0 | 0 | 3 |
| audio | 20 | 0 | 0 | 0 |
| interview | 11 | 0 | 0 | 0 |
| structure | 14 | 1 | 1 | 0 |

## Unlisted suggestions (match nothing in the key; one tap each) — 33 in total

Counted, not optimised for: the list is read, accept-all is not how the tool is used.

- **meeting** (3, 2 applied): בקבוצה [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied** · גן [model+flagged] · נוער [suggest] **applied**
- **filing** (6, 6 applied): נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ירושלים [model] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · תצהיר [discover; פסקה שכולה שם, ואחריה דיבור] **applied** · תצהירי [near+flagged] **applied** · עלי [flagged] **applied**
- **transcript** (3, 3 applied): במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · יו"ר [discover; פותח תור דיבור בתמלול] **applied**
- **welfare** (1, 1 applied): לסדרי [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied**
- **medical** (6, 6 applied): המטופלת [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · מחלקת [model] **applied** · הנבדק [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · קלינית [suggest] **applied**
- **police** (3, 3 applied): ראיתי רכב [suggest] **applied** · המתלוננת [discover; פותח תור דיבור בתמלול] **applied** · תחנת גבעת [model] **applied**
- **bank** (2, 2 applied): החשבון [discover; פותח תור דיבור בתמלול] **applied** · יתרה לסוף התקופה [discover; פותח תור דיבור בתמלול] **applied**
- **chat** (1, 1 applied): בגן [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied**
- **position** (1, 1 applied): הבהרה [discover; פותח תור דיבור בתמלול] **applied**
- **audio** (1, 1 applied): ושניהם [suggest] **applied**
- **structure** (6, 6 applied): תסקיר שהוגש [discover; מופיע אחרי תפקיד ונקודתיים] **applied** · מתגורר [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · תסקיר שהוגש [discover; מופיע אחרי תפקיד ונקודתיים] **applied** · מתגורר [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · תסקיר שהוגש [discover; מופיע אחרי תפקיד ונקודתיים] **applied** · מתגורר [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied**

## Missed and leaked, by document

- p2 · place: town · גבעת עדה: missed
- b2 · org: private body, must be redacted · חברת קו הזהב הובלות: found via model+applied as «קו הזהב הובלות», **leaked**: קו הזהב
- s1 · channel: person only in a picture's alt text · שולמית אוזרבך: missed, **leaked**: שולמית אוזרבך

## Traps and public bodies touched

- f2 · trap: case numbers, dates, section references · סעיף 2: suggested as «ת"פ 4471-02-26 [flagged]»; altered: ת"פ 4471-02-26
- f2 · trap: idiom or public title beside a same-word name · בגיל 8: altered: עם שחר
- x1 · trap: role word in any spelling (אפוטרופא, אפוטרופוס) · אפוטרופא לדין: suggested as «לדין [model]»; altered: אפוטרופא לדין
- x1 · trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) · לשם: suggested as «קדימה [flagged]»; altered: קדימה
- x2 · trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) · אורה: suggested as «עלי [flagged]»; altered: עלי

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 332 | 9 | 1 |
| m2 | meeting | 190 | 12 | 1 |
| m3 | meeting | 127 | 7 | 0 |
| m4 | meeting | 192 | 9 | 1 |
| f1 | filing | 253 | 15 | 2 |
| f2 | filing | 314 | 16 | 1 |
| f3 | filing | 178 | 8 | 0 |
| f4 | filing | 195 | 11 | 3 |
| t1 | transcript | 163 | 8 | 0 |
| t2 | transcript | 165 | 13 | 1 |
| t3 | transcript | 179 | 11 | 1 |
| t4 | transcript | 151 | 12 | 1 |
| w1 | welfare | 130 | 4 | 0 |
| w2 | welfare | 108 | 5 | 0 |
| w3 | welfare | 148 | 6 | 0 |
| w4 | welfare | 136 | 6 | 1 |
| h1 | medical | 117 | 6 | 2 |
| h2 | medical | 113 | 5 | 1 |
| h3 | medical | 132 | 7 | 3 |
| p1 | police | 123 | 5 | 1 |
| p2 | police | 119 | 4 | 2 |
| p3 | police | 106 | 2 | 0 |
| p4 | police | 74 | 3 | 0 |
| b1 | bank | 111 | 6 | 2 |
| b2 | bank | 88 | 3 | 0 |
| b3 | bank | 92 | 3 | 0 |
| c1 | chat | 113 | 4 | 0 |
| c2 | chat | 130 | 5 | 1 |
| c3 | chat | 119 | 2 | 0 |
| c4 | chat | 118 | 5 | 0 |
| x1 | position | 176 | 8 | 1 |
| x2 | position | 132 | 6 | 0 |
| x3 | position | 120 | 5 | 0 |
| a1 | audio | 134 | 7 | 0 |
| a2 | audio | 118 | 7 | 0 |
| a3 | audio | 127 | 8 | 1 |
| a4 | audio | 117 | 6 | 0 |
| v1 | interview | 144 | 3 | 0 |
| v2 | interview | 123 | 5 | 0 |
| v3 | interview | 92 | 3 | 0 |
| s1 | structure | 137 | 4 | 2 |
| s2 | structure | 124 | 5 | 2 |
| s3 | structure | 119 | 5 | 2 |
