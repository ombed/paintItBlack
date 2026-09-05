# Benchmark results

12 documents, 114 keyed entities, model on (q8, same artifact as the browser). Generated 2026-09-05.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 6 | 0 | 0 | 0 |
| person: name that is also a common word (lexicon-aided) | 7 | 0 | 0 | 0 |
| person: title attached | 6 | 0 | 2 | 0 |
| person: same person, one clean and one corrupted spelling | 3 | 0 | 0 | 0 |
| person: name split across two runs mid-word | 3 | 0 | 0 | 0 |
| org: private body, must be redacted | 5 | 0 | 1 | 0 |
| place: town | 5 | 1 | 2 | 0 |
| trap: case numbers, dates, section references | – | – | – | 0 |
| trap: idiom or public title beside a same-word name | – | – | – | 3 |
| person: full name, surname alone, first name alone | 3 | 0 | 0 | 0 |
| person: only in prose, never before a speech verb | 3 | 0 | 0 | 0 |
| person: Ethiopian name | 4 | 0 | 1 | 0 |
| person: role word directly before, no colon | 5 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 1 | 0 |
| place: neighbourhood | 3 | 0 | 0 | 0 |
| person: two people sharing a surname | 6 | 0 | 0 | 0 |
| person: Russian name | 3 | 0 | 0 | 0 |
| person: nikud on one occurrence | 3 | 0 | 1 | 0 |
| person: once, only with a prefix letter (expected to fail) | 2 | 1 | 1 | 0 |
| person: name that reads like a body's | 3 | 0 | 0 | 0 |
| org: public body, must not be redacted | – | – | – | 3 |
| person: two people edit-distance 1 apart (must not merge) | 6 | 0 | 0 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 3 | 0 | 0 | 0 |
| person: hyphenated surname, elsewhere with a space | 3 | 0 | 0 | 0 |
| person: minor, first name only | 3 | 1 | 1 | 0 |
| place: street | 1 | 2 | 2 | 0 |
| trap: פלוני / פלונית | – | – | – | 1 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 24 | 2 | 4 | 1 |
| filing | 33 | 2 | 4 | 3 |
| transcript | 32 | 1 | 4 | 3 |

## Unlisted suggestions (match nothing in the key; one tap each)

- **meeting** (5, 5 applied): להבחין [model] **applied** · מהבניין [suggest] **applied** · נוער [suggest] **applied** · לבד [flagged] **applied** · אבל [flagged] **applied**
- **filing** (7, 4 applied): בי [discover+flagged; מופיע מיד לפני ת"ז] · נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · לדירה בשכונת [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · לשכת הרווחה
המבקשת [model+flagged] **applied** · לקבוע מזונו [discover+flagged; מופיע מיד לפני ת"ז] · עלי [flagged]
- **transcript** (10, 10 applied): שר [discover; מופיע אחרי תואר] **applied** · אני [model] **applied** · ושר [flagged] **applied** · לי [discover; מופיע אחרי תואר] **applied** · במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · השופט [model] **applied** · תוזמן. טיטו [model] **applied** · לארח [model] **applied** · ועדה [flagged] **applied**

## Missed and leaked, by document

- m1 · person: title attached · יערה ליפשיץ: found via discover+model+suggest as «יערה ליפשיץ», «עו"ד יערה», **leaked**: ליפשיץ
- m1 · org: private body, must be redacted · עמותת שביל הלב: found via model+flagged as «משרד עמותת שביל הלב», «שביל», **leaked**: שביל הלב
- m3 · person: once, only with a prefix letter · הילי: missed, **leaked**: הילי, בהילי
- m4 · place: street · רחוב הארזים 12: missed, **leaked**: הארזים
- f1 · place: town · בית זית: missed, **leaked**: בית זית
- f2 · person: title attached · רויטל סבג: found via discover+model as «רויטל סבג», **leaked**: סבג
- f4 · org: body whose name reads like a person's · שילה ואופק: found via flagged as «שילה», **leaked**: שילה ואופק
- f4 · place: street · שדרות הנשיאים 8: missed, **leaked**: הנשיאים
- t1 · place: town · אלון שבות: found via model+flagged as «אלון שבות», **leaked**: אלון שבות
- t2 · person: minor, first name only · אופק: missed, **leaked**: אופק
- t3 · person: nikud on one occurrence · מיקה: found via model as «הילדה. מיקה», **leaked**: מיקה
- t4 · person: Ethiopian name · אברה ברהנו: found via model as «אברה», **leaked**: ברהנו

## Traps and public bodies touched

- m1 · trap: idiom or public title beside a same-word name · בחיים לא ראיתי: suggested as «בחיים»; altered in the output
- f1 · org: public body, must not be redacted · המוסד לביטוח לאומי: suggested as «לביטוח לאומי»; altered in the output
- f2 · trap: idiom or public title beside a same-word name · בגיל 8: altered in the output
- f3 · org: public body, must not be redacted · משרד הרווחה: suggested as «הרווחה»; altered in the output
- t1 · org: public body, must not be redacted · משרד הרווחה: suggested as «הרווחה»; altered in the output
- t1 · trap: פלוני / פלונית · פלוני: suggested as «פלוני בדיון»; altered in the output
- t1 · trap: idiom or public title beside a same-word name · שר הרווחה: suggested as «הרווחה»; altered in the output

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 146 | 14 | 0 |
| m2 | meeting | 88 | 14 | 0 |
| m3 | meeting | 71 | 6 | 0 |
| m4 | meeting | 97 | 12 | 5 |
| f1 | filing | 127 | 15 | 2 |
| f2 | filing | 138 | 17 | 2 |
| f3 | filing | 106 | 13 | 1 |
| f4 | filing | 116 | 12 | 2 |
| t1 | transcript | 111 | 15 | 3 |
| t2 | transcript | 86 | 16 | 2 |
| t3 | transcript | 107 | 13 | 3 |
| t4 | transcript | 91 | 13 | 2 |
