# Benchmark results

12 documents, 114 keyed entities, model on (q8, same artifact as the browser). Generated 2026-09-05.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 6 | 0 | 0 | 0 |
| person: name that is also a common word (lexicon-aided) | 7 | 0 | 0 | 0 |
| person: title attached | 6 | 0 | 1 | 0 |
| person: same person, one clean and one corrupted spelling | 3 | 0 | 0 | 0 |
| person: name split across two runs mid-word | 3 | 0 | 0 | 0 |
| org: private body, must be redacted | 5 | 0 | 0 | 0 |
| place: town | 5 | 1 | 1 | 0 |
| trap: case numbers, dates, section references | – | – | – | 0 |
| trap: idiom or public title beside a same-word name | – | – | – | 1 |
| person: full name, surname alone, first name alone | 3 | 0 | 0 | 0 |
| person: only in prose, never before a speech verb | 3 | 0 | 0 | 0 |
| person: Ethiopian name | 4 | 0 | 1 | 0 |
| person: role word directly before, no colon | 5 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 0 | 0 |
| place: neighbourhood | 3 | 0 | 0 | 0 |
| person: two people sharing a surname | 6 | 0 | 0 | 0 |
| person: Russian name | 3 | 0 | 0 | 0 |
| person: nikud on one occurrence | 3 | 0 | 0 | 0 |
| person: once, only with a prefix letter (expected to fail) | 2 | 1 | 1 | 0 |
| person: name that reads like a body's | 3 | 0 | 0 | 0 |
| org: public body, must not be redacted | – | – | – | 0 |
| person: two people edit-distance 1 apart (must not merge) | 6 | 0 | 0 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 3 | 0 | 0 | 0 |
| person: hyphenated surname, elsewhere with a space | 3 | 0 | 0 | 0 |
| person: minor, first name only | 3 | 1 | 1 | 0 |
| place: street | 3 | 0 | 2 | 0 |
| trap: פלוני / פלונית | – | – | – | 0 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 25 | 1 | 2 | 0 |
| filing | 34 | 1 | 3 | 1 |
| transcript | 32 | 1 | 2 | 0 |

## Unlisted suggestions (match nothing in the key; one tap each)

- **meeting** (4, 4 applied): מהבניין [suggest] **applied** · נוער [suggest] **applied** · לבד [flagged] **applied** · אבל [flagged] **applied**
- **filing** (7, 5 applied): בי [discover+flagged; מופיע מיד לפני ת"ז] · נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · לדירה בשכונת [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · המבקשת [model] **applied** · לקבוע מזונו [discover+flagged; מופיע מיד לפני ת"ז] · עלי [flagged] **applied**
- **transcript** (5, 5 applied): שר [discover; מופיע אחרי תואר] **applied** · לי [discover; מופיע אחרי תואר] **applied** · במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · ועדה [flagged] **applied**

## Missed and leaked, by document

- m3 · person: once, only with a prefix letter · הילי: missed, **leaked**: הילי, בהילי
- m4 · place: street · רחוב הארזים 12: found via model+applied as «רחוב הארזים», **leaked**: הארזים
- f1 · place: town · בית זית: missed, **leaked**: בית זית
- f2 · person: title attached · רויטל סבג: found via discover+model+applied as «רויטל סבג», **leaked**: סבג
- f4 · place: street · שדרות הנשיאים 8: found via applied as «שדרות הנשיאים 8», **leaked**: הנשיאים
- t2 · person: minor, first name only · אופק: missed, **leaked**: אופק
- t4 · person: Ethiopian name · אברה ברהנו: found via model+applied as «אברה», **leaked**: ברהנו

## Traps and public bodies touched

- f2 · trap: idiom or public title beside a same-word name · בגיל 8: altered: עם שחר

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 187 | 11 | 0 |
| m2 | meeting | 153 | 13 | 0 |
| m3 | meeting | 104 | 6 | 0 |
| m4 | meeting | 147 | 12 | 4 |
| f1 | filing | 157 | 14 | 2 |
| f2 | filing | 178 | 19 | 3 |
| f3 | filing | 111 | 12 | 0 |
| f4 | filing | 190 | 11 | 2 |
| t1 | transcript | 115 | 9 | 1 |
| t2 | transcript | 114 | 15 | 2 |
| t3 | transcript | 120 | 11 | 1 |
| t4 | transcript | 114 | 11 | 1 |
