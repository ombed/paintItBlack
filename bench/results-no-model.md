# Benchmark results (no model)

30 documents, 234 keyed entities, model off. Generated 2026-09-06.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 6 | 4 | 4 | 0 |
| person: name that is also a common word (lexicon-aided) | 6 | 1 | 1 | 0 |
| person: title attached | 7 | 1 | 1 | 0 |
| person: same person, one clean and one corrupted spelling | 3 | 2 | 5 | 0 |
| person: name split across two runs mid-word | 2 | 1 | 1 | 0 |
| org: private body, must be redacted | 9 | 1 | 2 | 0 |
| place: town | 1 | 10 | 10 | 0 |
| trap: case numbers, dates, section references | – | – | – | 1 |
| trap: idiom or public title beside a same-word name | – | – | – | 1 |
| person: full name, surname alone, first name alone | 7 | 0 | 3 | 0 |
| person: only in prose, never before a speech verb | 5 | 0 | 0 | 0 |
| person: Ethiopian name | 5 | 3 | 3 | 0 |
| person: role word directly before, no colon | 6 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 0 | 0 |
| place: neighbourhood | 6 | 0 | 0 | 0 |
| person: two people sharing a surname | 8 | 0 | 4 | 0 |
| person: Russian name | 6 | 2 | 2 | 0 |
| person: nikud on one occurrence | 0 | 3 | 3 | 0 |
| person: once, only with a prefix letter (expected to fail) | 0 | 3 | 3 | 0 |
| person: name that reads like a body's | 0 | 3 | 3 | 0 |
| org: public body, must not be redacted | – | – | – | 0 |
| person: two people edit-distance 1 apart (must not merge) | 2 | 4 | 4 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 2 | 1 | 1 | 0 |
| person: hyphenated surname, elsewhere with a space | 3 | 2 | 3 | 0 |
| person: minor, first name only | 1 | 5 | 5 | 0 |
| place: street | 7 | 0 | 0 | 0 |
| trap: פלוני / פלונית | – | – | – | 0 |
| person: two-letter surname | 1 | 4 | 4 | 0 |
| person: minor introduced by הקטין / הקטינה | 0 | 5 | 5 | 0 |
| pii: ID number | 10 | 0 | 0 | 0 |
| pii: mobile phone | 9 | 0 | 0 | 0 |
| pii: date of birth | 6 | 0 | 0 | 0 |
| pii: email address | 6 | 0 | 0 | 0 |
| pii: bank account | 5 | 0 | 0 | 0 |
| pii: licence plate | 4 | 0 | 0 | 0 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 16 | 10 | 13 | 0 |
| filing | 27 | 8 | 10 | 2 |
| transcript | 21 | 12 | 16 | 0 |
| welfare | 18 | 6 | 8 | 0 |
| medical | 12 | 5 | 5 | 0 |
| police | 17 | 4 | 4 | 0 |
| bank | 13 | 2 | 2 | 0 |
| chat | 12 | 8 | 9 | 0 |

## Unlisted suggestions (match nothing in the key; one tap each) — 41 in total

Counted, not optimised for: the list is read, accept-all is not how the tool is used.

- **meeting** (5, 5 applied): סיכמנו [discover; פותח תור דיבור בתמלול] **applied** · מהבניין [suggest] **applied** · נוער [suggest] **applied** · לבד [flagged] **applied** · אבל [flagged] **applied**
- **filing** (8, 6 applied): בי [discover+flagged; מופיע מיד לפני ת"ז] · נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · המבקשת [discover; פותח תור דיבור בתמלול] **applied** · לדירה בשכונת [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · המלצה [discover; פותח תור דיבור בתמלול] **applied** · לקבוע מזונו [discover+flagged; מופיע מיד לפני ת"ז] · עלי [flagged] **applied**
- **transcript** (6, 6 applied): שר [discover; מופיע אחרי תואר] **applied** · לי [discover; מופיע אחרי תואר] **applied** · במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · יו"ר [discover; פותח תור דיבור בתמלול] **applied** · ועדה [flagged] **applied**
- **welfare** (3, 3 applied): המלצה [discover; פותח תור דיבור בתמלול] **applied** · המלצה [discover; פותח תור דיבור בתמלול] **applied** · המלצה [discover; פותח תור דיבור בתמלול] **applied**
- **medical** (7, 7 applied): המטופלת [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · המלצה [discover; פותח תור דיבור בתמלול] **applied** · הנבדק [discover; פותח תור דיבור בתמלול] **applied** · פסיכולוגית קלינית [discover; מופיע באזור החתימה] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · הנוכחי [flagged] **applied**
- **police** (5, 4 applied): ראיתי רכב [suggest] **applied** · המתלוננת [discover; פותח תור דיבור בתמלול] **applied** · שאלה [discover; פותח תור דיבור בתמלול] **applied** · דו [discover+flagged; מופיע מיד לפני ת"ז] · המשך טיפול [discover; פותח תור דיבור בתמלול] **applied**
- **bank** (5, 4 applied): יתרה לסוף התקופה [discover; פותח תור דיבור בתמלול] **applied** · החשבון [discover; פותח תור דיבור בתמלול] **applied** · הנדון [discover; פותח תור דיבור בתמלול] **applied** · צו עיקול [flagged] **applied** · יתר [discover+flagged; מופיע מיד לפני ת"ז]
- **chat** (2, 2 applied): שצריך שוב [discover; מופיע אחרי תואר] **applied** · מהוועד [suggest] **applied**

## Missed and leaked, by document

- m1 · person: name that is also a common word · חיים סבג: missed, **leaked**: חיים סבג, חיים
- m1 · person: same person, one clean and one corrupted spelling · דסטה טספאיי: missed, **leaked**: דסטה טספאיי, תספאיי
- m1 · person: name split across two runs mid-word · עמיחי אלמגור: missed, **leaked**: עמיחי אלמגור
- m1 · place: town · נוף הגליל: missed, **leaked**: נוף הגליל
- m2 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- m2 · org: private body, must be redacted · מעון גן הדובים: found via flagged+applied as «מעון», **leaked**: גן הדובים
- m3 · person: two people sharing a surname · נמרוד רוזנטל: found via suggest+applied as «ונמרוד רוזנטל», «מורן רוזנטל», **leaked**: רוזנטל
- m3 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- m3 · person: once, only with a prefix letter · הילי: missed, **leaked**: הילי, בהילי
- m3 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- m4 · person: two people edit-distance 1 apart (must not merge) · ינון אביתן: missed, **leaked**: ינון אביתן, אביתן
- m4 · person: hyphenated surname, elsewhere with a space · אלה בן-רביב: missed, **leaked**: אלה בן-רביב, בן רביב
- m4 · person: minor, first name only · אופק: missed, **leaked**: אופק
- f1 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- f1 · person: same person, one clean and one corrupted spelling · נתנאל וייסמן: found via suggest+applied as «ויסמן», **leaked**: נתנאל וייסמן
- f1 · place: town · בית זית: missed, **leaked**: בית זית
- f2 · person: Ethiopian name · אברה ברהנו: missed, **leaked**: אברה ברהנו, ברהנו
- f2 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- f3 · person: two people edit-distance 1 apart (must not merge) · מורן אביטן: missed, **leaked**: מורן אביטן, אביטן
- f3 · person: once, only with a prefix letter · רויטל: missed, **leaked**: רויטל, לרויטל
- f3 · place: town · מבוא חורון: missed, **leaked**: מבוא חורון
- f4 · person: Arabic name · עבד אל-האדי: missed, **leaked**: עבד אל-האדי
- f4 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- t1 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- t1 · place: town · אלון שבות: missed, **leaked**: אלון שבות
- t2 · person: Arabic name · אבו ריא: missed, **leaked**: אבו ריא
- t2 · person: same person, one clean and one corrupted spelling · דסטה טספאיי: found via suggest+applied as «תספאיי», **leaked**: דסטה טספאיי
- t2 · person: hyphenated surname, elsewhere with a space · אלה בן-רביב: found via discover+applied as «אלה בן-רביב», **leaked**: בן רביב
- t2 · person: minor, first name only · אופק: missed, **leaked**: אופק
- t2 · person: once, only with a prefix letter · נהוראי: missed, **leaked**: נהוראי, ונהוראי
- t2 · place: town · גני יוחנן: missed, **leaked**: גני יוחנן
- t3 · person: two people edit-distance 1 apart (must not merge) · מורן אביטן: missed, **leaked**: מורן אביטן, אביטן
- t3 · person: two people edit-distance 1 apart (must not merge) · ינון אביתן: missed, **leaked**: ינון אביתן, אביתן
- t3 · person: only in corrupted form, never cleanly · טיטו וורקו: missed, **leaked**: טיטו ווארקו
- t3 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- t4 · person: two people sharing a surname · נמרוד רוזנטל: found via discover+suggest+applied as «נמרוד רוזנטל», «מורן רוזנטל», «רוזנטל», **leaked**: רוזנטל
- t4 · person: minor, first name only · עומרי: missed, **leaked**: עומרי
- t4 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- t4 · place: town · הר אדר: missed, **leaked**: הר אדר
- w1 · person: minor introduced by הקטין / הקטינה · אגם: missed, **leaked**: אגם, הקטינה אגם
- w1 · person: title attached · שיראל שטרית: missed, **leaked**: שיראל שטרית, עו"ס שיראל שטרית, שטרית
- w2 · person: minor introduced by הקטין / הקטינה · ניב: missed, **leaked**: ניב, הקטין ניב
- w2 · org: private body, must be redacted · פנימיית גבעת הרימון: missed, **leaked**: פנימיית גבעת הרימון, גבעת הרימון
- w3 · person: two-letter surname · מתן צח: missed, **leaked**: מתן צח
- w3 · person: two people sharing a surname · סלים מנסור: found via suggest+applied as «סלים מנסור», **leaked**: סלים
- w3 · person: two people sharing a surname · חנין מנסור: found via suggest+applied as «סלים מנסור», **leaked**: חנין מנסור, מנסור
- w4 · person: minor introduced by הקטין / הקטינה · ליה: missed, **leaked**: ליה, הקטינה ליה
- h1 · person: minor, first name only · אבישג: missed, **leaked**: אבישג
- h2 · place: town · צור יצחק: missed, **leaked**: צור יצחק
- h3 · person: Russian name · ולריה קוזנצוב: missed, **leaked**: ולריה קוזנצוב, קוזנצוב
- h3 · person: Ethiopian name · יונס גטהון: missed, **leaked**: יונס גטהון, גטהון
- h3 · person: two-letter surname · איה נץ: missed, **leaked**: איה נץ
- p1 · person: same person, one clean and one corrupted spelling · ארטיום מורוזוב: missed, **leaked**: ארטיום מורוזוב, מורוזב
- p2 · person: minor introduced by הקטין / הקטינה · לביא: missed, **leaked**: לביא, הקטין לביא
- p2 · place: town · גבעת עדה: missed, **leaked**: גבעת עדה
- p3 · person: two-letter surname · עלמה כץ: missed, **leaked**: עלמה כץ
- b2 · person: Arabic name · טהא עודה: missed, **leaked**: טהא עודה, עודה
- b3 · place: town · בית אריה: missed, **leaked**: בית אריה
- c1 · person: two-letter surname · מיקי צח: missed, **leaked**: מיקי צח
- c1 · person: minor, first name only · טרקה: missed, **leaked**: טרקה
- c1 · place: town · נופית: missed, **leaked**: נופית
- c2 · person: Arabic name · מייסא סרחאן: missed, **leaked**: מייסא סרחאן, סרחאן
- c2 · person: hyphenated surname, elsewhere with a space · ליעד בן-עמיאל: missed, **leaked**: ליעד בן-עמיאל, בן עמיאל
- c3 · person: Ethiopian name · ברהאנה וורקנה: missed, **leaked**: ברהאנה וורקנה, וורקנה
- c3 · person: minor introduced by הקטין / הקטינה · גפן: missed, **leaked**: גפן, הקטינה גפן
- c4 · person: Russian name · פולינה סמירנובה: missed, **leaked**: פולינה סמירנובה, סמירנובה
- c4 · person: same person, one clean and one corrupted spelling · קסאי אלמו: found via suggest+applied as «עלמו», **leaked**: קסאי אלמו

## Traps and public bodies touched

- f2 · trap: case numbers, dates, section references · סעיף 2: suggested as «ת"פ 4471-02-26 [flagged]»; altered: ת"פ 4471-02-26
- f2 · trap: idiom or public title beside a same-word name · בגיל 8: suggested as «שחר [suggest]»; altered: עם שחר

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 78 | 4 | 0 |
| m2 | meeting | 41 | 7 | 0 |
| m3 | meeting | 24 | 3 | 0 |
| m4 | meeting | 32 | 7 | 5 |
| f1 | filing | 50 | 11 | 2 |
| f2 | filing | 63 | 15 | 3 |
| f3 | filing | 26 | 6 | 1 |
| f4 | filing | 32 | 7 | 2 |
| t1 | transcript | 28 | 7 | 1 |
| t2 | transcript | 24 | 7 | 2 |
| t3 | transcript | 31 | 6 | 1 |
| t4 | transcript | 25 | 8 | 2 |
| w1 | welfare | 20 | 3 | 1 |
| w2 | welfare | 23 | 4 | 1 |
| w3 | welfare | 18 | 2 | 0 |
| w4 | welfare | 15 | 4 | 1 |
| h1 | medical | 23 | 6 | 2 |
| h2 | medical | 18 | 3 | 1 |
| h3 | medical | 18 | 5 | 4 |
| p1 | police | 17 | 2 | 1 |
| p2 | police | 17 | 2 | 1 |
| p3 | police | 12 | 2 | 1 |
| p4 | police | 28 | 5 | 2 |
| b1 | bank | 18 | 5 | 2 |
| b2 | bank | 15 | 4 | 2 |
| b3 | bank | 15 | 3 | 1 |
| c1 | chat | 9 | 1 | 0 |
| c2 | chat | 20 | 3 | 2 |
| c3 | chat | 7 | 1 | 0 |
| c4 | chat | 14 | 3 | 0 |
