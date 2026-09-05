# Benchmark results (no model)

12 documents, 114 keyed entities, model off. Generated 2026-09-05.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 4 | 2 | 2 | 0 |
| person: name that is also a common word (lexicon-aided) | 2 | 5 | 4 | 0 |
| person: title attached | 6 | 0 | 2 | 0 |
| person: same person, one clean and one corrupted spelling | 2 | 1 | 3 | 0 |
| person: name split across two runs mid-word | 1 | 2 | 2 | 0 |
| org: private body, must be redacted | 5 | 0 | 1 | 0 |
| place: town | 0 | 6 | 6 | 0 |
| trap: case numbers, dates, section references | – | – | – | 0 |
| trap: idiom or public title beside a same-word name | – | – | – | 2 |
| person: full name, surname alone, first name alone | 3 | 0 | 3 | 0 |
| person: only in prose, never before a speech verb | 3 | 0 | 0 | 0 |
| person: Ethiopian name | 1 | 3 | 3 | 0 |
| person: role word directly before, no colon | 5 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 2 | 0 |
| place: neighbourhood | 3 | 0 | 0 | 0 |
| person: two people sharing a surname | 6 | 0 | 1 | 0 |
| person: Russian name | 2 | 1 | 1 | 0 |
| person: nikud on one occurrence | 0 | 3 | 3 | 0 |
| person: once, only with a prefix letter (expected to fail) | 0 | 3 | 3 | 0 |
| person: name that reads like a body's | 0 | 3 | 3 | 0 |
| org: public body, must not be redacted | – | – | – | 2 |
| person: two people edit-distance 1 apart (must not merge) | 2 | 4 | 4 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 2 | 1 | 1 | 0 |
| person: hyphenated surname, elsewhere with a space | 1 | 2 | 2 | 0 |
| person: minor, first name only | 1 | 3 | 3 | 0 |
| place: street | 0 | 3 | 2 | 0 |
| trap: פלוני / פלונית | – | – | – | 1 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 15 | 11 | 15 | 0 |
| filing | 25 | 10 | 13 | 3 |
| transcript | 12 | 21 | 23 | 2 |

## Unlisted suggestions (match nothing in the key; one tap each)

- **meeting** (4, 4 applied): מהבניין [suggest] **applied** · נוער [suggest] **applied** · לבד [flagged] **applied** · אבל [flagged] **applied**
- **filing** (6, 3 applied): בי [discover+flagged; מופיע מיד לפני ת"ז] · נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · לדירה בשכונת [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · לקבוע מזונו [discover+flagged; מופיע מיד לפני ת"ז] · עלי [flagged]
- **transcript** (6, 6 applied): שר [discover; מופיע אחרי תואר] **applied** · ושר [flagged] **applied** · לי [discover; מופיע אחרי תואר] **applied** · במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · ועדה [flagged] **applied**

## Missed and leaked, by document

- m1 · person: name that is also a common word · חיים סבג: missed, **leaked**: חיים סבג, חיים
- m1 · person: title attached · יערה ליפשיץ: found via discover+suggest as «יערה ליפשיץ», «עו"ד יערה», **leaked**: ליפשיץ
- m1 · person: same person, one clean and one corrupted spelling · דסטה טספאיי: missed, **leaked**: דסטה טספאיי, תספאיי
- m1 · person: name split across two runs mid-word · עמיחי אלמגור: missed, **leaked**: עמיחי אלמגור
- m1 · place: town · נוף הגליל: missed, **leaked**: נוף הגליל
- m2 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged as «אריאל», **leaked**: הורוביץ
- m2 · org: private body, must be redacted · מעון גן הדובים: found via flagged as «מעון», **leaked**: מעון גן הדובים, גן הדובים
- m3 · person: two people sharing a surname · נמרוד רוזנטל: found via suggest as «ונמרוד רוזנטל», «מורן רוזנטל», **leaked**: רוזנטל
- m3 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- m3 · person: once, only with a prefix letter · הילי: missed, **leaked**: הילי, בהילי
- m3 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- m4 · person: two people edit-distance 1 apart (must not merge) · ינון אביתן: missed, **leaked**: ינון אביתן, אביתן
- m4 · person: hyphenated surname, elsewhere with a space · אלה בן-רביב: missed, **leaked**: אלה בן-רביב, בן רביב
- m4 · person: minor, first name only · אופק: missed, **leaked**: אופק
- m4 · place: street · רחוב הארזים 12: missed, **leaked**: הארזים
- f1 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged as «אריאל», **leaked**: הורוביץ
- f1 · person: same person, one clean and one corrupted spelling · נתנאל וייסמן: found via suggest as «ויסמן», **leaked**: נתנאל וייסמן
- f1 · place: town · בית זית: missed, **leaked**: בית זית
- f1 · place: street · רחוב התאנה 4: missed
- f2 · person: title attached · רויטל סבג: found via discover as «רויטל סבג», **leaked**: סבג
- f2 · person: Ethiopian name · אברה ברהנו: missed, **leaked**: אברה ברהנו, ברהנו
- f2 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- f3 · person: two people edit-distance 1 apart (must not merge) · מורן אביטן: missed, **leaked**: מורן אביטן, אביטן
- f3 · person: once, only with a prefix letter · רויטל: missed, **leaked**: רויטל, לרויטל
- f3 · place: town · מבוא חורון: missed, **leaked**: מבוא חורון
- f4 · person: Arabic name · עבד אל-האדי: missed, **leaked**: עבד אל-האדי
- f4 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- f4 · org: body whose name reads like a person's · שילה ואופק: found via flagged as «שילה», **leaked**: שילה ואופק
- f4 · place: street · שדרות הנשיאים 8: missed, **leaked**: הנשיאים
- t1 · person: name that is also a common word · דור רביב: missed, **leaked**: דור רביב, דור
- t1 · person: name that is also a common word · אלישע שר: missed
- t1 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged as «אריאל», **leaked**: הורוביץ
- t1 · person: Russian name · אנסטסיה קוזלוב: missed, **leaked**: אנסטסיה קוזלוב, קוזלוב
- t1 · place: town · אלון שבות: missed, **leaked**: אלון שבות
- t2 · person: Arabic name · אבו ריא: missed, **leaked**: אבו ריא
- t2 · person: same person, one clean and one corrupted spelling · דסטה טספאיי: found via suggest as «תספאיי», **leaked**: דסטה טספאיי
- t2 · person: hyphenated surname, elsewhere with a space · אלה בן-רביב: missed, **leaked**: אלה בן-רביב, בן רביב
- t2 · person: minor, first name only · אופק: missed, **leaked**: אופק
- t2 · person: once, only with a prefix letter · נהוראי: missed, **leaked**: נהוראי, ונהוראי
- t2 · place: town · גני יוחנן: missed, **leaked**: גני יוחנן
- t3 · person: name that is also a common word · ניר אסולין: missed, **leaked**: ניר אסולין, ניר
- t3 · person: name that is also a common word · אור בוזגלו: missed, **leaked**: אור בוזגלו, אור
- t3 · person: two people edit-distance 1 apart (must not merge) · מורן אביטן: missed, **leaked**: מורן אביטן, אביטן
- t3 · person: two people edit-distance 1 apart (must not merge) · ינון אביתן: missed, **leaked**: ינון אביתן, אביתן
- t3 · person: only in corrupted form, never cleanly · טיטו וורקו: missed, **leaked**: טיטו ווארקו
- t3 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- t3 · org: body whose name reads like a person's · שילה ואופק: found via flagged as «שילה», **leaked**: שילה ואופק
- t4 · person: Ethiopian name · מולו טגניה: missed, **leaked**: מולו טגניה, טגניה
- t4 · person: Ethiopian name · אברה ברהנו: missed, **leaked**: אברה ברהנו, ברהנו
- t4 · person: minor, first name only · עומרי: missed, **leaked**: עומרי
- t4 · person: name split across two runs mid-word · עמיחי אלמגור: missed, **leaked**: עמיחי אלמגור, אלמגור
- t4 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- t4 · place: town · הר אדר: missed, **leaked**: הר אדר

## Traps and public bodies touched

- f1 · org: public body, must not be redacted · המוסד לביטוח לאומי: suggested as «לביטוח לאומי»; altered in the output
- f2 · trap: idiom or public title beside a same-word name · בגיל 8: suggested as «שחר»; altered in the output
- f3 · org: public body, must not be redacted · משרד הרווחה: suggested as «הרווחה»; altered in the output
- t1 · trap: פלוני / פלונית · פלוני: suggested as «פלוני בדיון»; altered in the output
- t1 · trap: idiom or public title beside a same-word name · שר הרווחה: altered in the output

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 61 | 5 | 0 |
| m2 | meeting | 25 | 7 | 0 |
| m3 | meeting | 17 | 3 | 0 |
| m4 | meeting | 26 | 6 | 4 |
| f1 | filing | 36 | 12 | 2 |
| f2 | filing | 43 | 13 | 2 |
| f3 | filing | 22 | 6 | 0 |
| f4 | filing | 23 | 7 | 2 |
| t1 | transcript | 18 | 6 | 2 |
| t2 | transcript | 18 | 5 | 2 |
| t3 | transcript | 14 | 4 | 1 |
| t4 | transcript | 10 | 3 | 1 |
