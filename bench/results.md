# Benchmark results

30 documents, 234 keyed entities, model on (q8, same artifact as the browser). Generated 2026-09-06.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 10 | 0 | 0 | 0 |
| person: name that is also a common word (lexicon-aided) | 7 | 0 | 0 | 0 |
| person: title attached | 8 | 0 | 0 | 0 |
| person: same person, one clean and one corrupted spelling | 5 | 0 | 0 | 0 |
| person: name split across two runs mid-word | 3 | 0 | 0 | 0 |
| org: private body, must be redacted | 10 | 0 | 0 | 0 |
| place: town | 9 | 2 | 2 | 0 |
| trap: case numbers, dates, section references | – | – | – | 1 |
| trap: idiom or public title beside a same-word name | – | – | – | 1 |
| person: full name, surname alone, first name alone | 7 | 0 | 0 | 0 |
| person: only in prose, never before a speech verb | 5 | 0 | 0 | 0 |
| person: Ethiopian name | 8 | 0 | 0 | 0 |
| person: role word directly before, no colon | 6 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 0 | 0 |
| place: neighbourhood | 6 | 0 | 0 | 0 |
| person: two people sharing a surname | 8 | 0 | 0 | 0 |
| person: Russian name | 8 | 0 | 0 | 0 |
| person: nikud on one occurrence | 3 | 0 | 0 | 0 |
| person: once, only with a prefix letter (expected to fail) | 2 | 1 | 1 | 0 |
| person: name that reads like a body's | 3 | 0 | 0 | 0 |
| org: public body, must not be redacted | – | – | – | 0 |
| person: two people edit-distance 1 apart (must not merge) | 6 | 0 | 0 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 3 | 0 | 0 | 0 |
| person: hyphenated surname, elsewhere with a space | 5 | 0 | 0 | 0 |
| person: minor, first name only | 5 | 1 | 1 | 0 |
| place: street | 7 | 0 | 0 | 0 |
| trap: פלוני / פלונית | – | – | – | 0 |
| person: two-letter surname | 4 | 1 | 1 | 0 |
| person: minor introduced by הקטין / הקטינה | 5 | 0 | 0 | 0 |
| pii: ID number | 10 | 0 | 0 | 0 |
| pii: mobile phone | 9 | 0 | 0 | 0 |
| pii: date of birth | 6 | 0 | 0 | 0 |
| pii: email address | 6 | 0 | 0 | 0 |
| pii: bank account | 5 | 0 | 0 | 0 |
| pii: licence plate | 4 | 0 | 0 | 0 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 25 | 1 | 1 | 0 |
| filing | 34 | 1 | 1 | 2 |
| transcript | 32 | 1 | 1 | 0 |
| welfare | 24 | 0 | 0 | 0 |
| medical | 16 | 1 | 1 | 0 |
| police | 21 | 0 | 0 | 0 |
| bank | 14 | 1 | 1 | 0 |
| chat | 20 | 0 | 0 | 0 |

## Unlisted suggestions (match nothing in the key; one tap each) — 41 in total

Counted, not optimised for: the list is read, accept-all is not how the tool is used.

- **meeting** (5, 5 applied): סיכמנו [discover; פותח תור דיבור בתמלול] **applied** · מהבניין [suggest] **applied** · נוער [suggest] **applied** · לבד [flagged] **applied** · אבל [flagged] **applied**
- **filing** (8, 6 applied): בי [discover+flagged; מופיע מיד לפני ת"ז] · נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · המבקשת [discover+model; פותח תור דיבור בתמלול] **applied** · לדירה בשכונת [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · המלצה [discover; פותח תור דיבור בתמלול] **applied** · לקבוע מזונו [discover+flagged; מופיע מיד לפני ת"ז] · עלי [flagged] **applied**
- **transcript** (6, 6 applied): שר [discover; מופיע אחרי תואר] **applied** · לי [discover; מופיע אחרי תואר] **applied** · במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · יו"ר [discover; פותח תור דיבור בתמלול] **applied** · ועדה [flagged] **applied**
- **welfare** (3, 3 applied): המלצה [discover; פותח תור דיבור בתמלול] **applied** · המלצה [discover; פותח תור דיבור בתמלול] **applied** · המלצה [discover; פותח תור דיבור בתמלול] **applied**
- **medical** (7, 7 applied): המטופלת [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · המלצה [discover; פותח תור דיבור בתמלול] **applied** · הנבדק [discover; פותח תור דיבור בתמלול] **applied** · פסיכולוגית קלינית [discover; מופיע באזור החתימה] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · הנוכחי [flagged] **applied**
- **police** (5, 4 applied): ראיתי רכב [suggest] **applied** · המתלוננת [discover; פותח תור דיבור בתמלול] **applied** · שאלה [discover; פותח תור דיבור בתמלול] **applied** · דו [discover+flagged; מופיע מיד לפני ת"ז] · המשך טיפול [discover; פותח תור דיבור בתמלול] **applied**
- **bank** (5, 4 applied): יתרה לסוף התקופה [discover; פותח תור דיבור בתמלול] **applied** · החשבון [discover; פותח תור דיבור בתמלול] **applied** · הנדון [discover; פותח תור דיבור בתמלול] **applied** · צו עיקול [flagged] **applied** · יתר [discover+flagged; מופיע מיד לפני ת"ז]
- **chat** (2, 2 applied): שצריך שוב [discover; מופיע אחרי תואר] **applied** · מהוועד [suggest] **applied**

## Missed and leaked, by document

- m3 · person: once, only with a prefix letter · הילי: missed, **leaked**: הילי, בהילי
- f1 · place: town · בית זית: missed, **leaked**: בית זית
- t2 · person: minor, first name only · אופק: missed, **leaked**: אופק
- h3 · person: two-letter surname · איה נץ: missed, **leaked**: איה נץ
- b3 · place: town · בית אריה: missed, **leaked**: בית אריה

## Traps and public bodies touched

- f2 · trap: case numbers, dates, section references · סעיף 2: suggested as «ת"פ 4471-02-26 [flagged]»; altered: ת"פ 4471-02-26
- f2 · trap: idiom or public title beside a same-word name · בגיל 8: altered: עם שחר

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 163 | 9 | 0 |
| m2 | meeting | 109 | 13 | 0 |
| m3 | meeting | 82 | 6 | 0 |
| m4 | meeting | 120 | 11 | 5 |
| f1 | filing | 139 | 14 | 2 |
| f2 | filing | 179 | 18 | 3 |
| f3 | filing | 110 | 11 | 1 |
| f4 | filing | 126 | 10 | 2 |
| t1 | transcript | 112 | 9 | 1 |
| t2 | transcript | 106 | 13 | 2 |
| t3 | transcript | 103 | 11 | 1 |
| t4 | transcript | 107 | 14 | 2 |
| w1 | welfare | 78 | 5 | 1 |
| w2 | welfare | 76 | 6 | 1 |
| w3 | welfare | 83 | 6 | 0 |
| w4 | welfare | 82 | 7 | 1 |
| h1 | medical | 85 | 7 | 2 |
| h2 | medical | 103 | 5 | 1 |
| h3 | medical | 113 | 7 | 4 |
| p1 | police | 100 | 5 | 1 |
| p2 | police | 80 | 4 | 1 |
| p3 | police | 94 | 3 | 1 |
| p4 | police | 88 | 5 | 2 |
| b1 | bank | 87 | 7 | 2 |
| b2 | bank | 75 | 5 | 2 |
| b3 | bank | 67 | 3 | 1 |
| c1 | chat | 102 | 4 | 0 |
| c2 | chat | 120 | 6 | 2 |
| c3 | chat | 107 | 4 | 0 |
| c4 | chat | 104 | 5 | 0 |
