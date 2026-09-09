# Benchmark results (no model)

40 documents, 296 keyed entities, model off. Generated 2026-09-09.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 6 | 4 | 4 | 0 |
| person: name that is also a common word (lexicon-aided) | 6 | 1 | 1 | 0 |
| person: title attached | 7 | 1 | 1 | 0 |
| person: same person, one clean and one corrupted spelling | 9 | 3 | 10 | 0 |
| person: name split across two runs mid-word | 2 | 1 | 1 | 0 |
| org: private body, must be redacted | 7 | 3 | 4 | 0 |
| place: town | 11 | 2 | 2 | 0 |
| trap: case numbers, dates, section references | – | – | – | 1 |
| trap: idiom or public title beside a same-word name | – | – | – | 1 |
| person: full name, surname alone, first name alone | 9 | 0 | 3 | 0 |
| person: only in prose, never before a speech verb | 7 | 0 | 0 | 0 |
| person: Ethiopian name | 5 | 3 | 3 | 0 |
| person: role word directly before, no colon | 6 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 0 | 0 |
| place: neighbourhood | 4 | 2 | 2 | 0 |
| person: two people sharing a surname | 10 | 0 | 5 | 0 |
| person: Russian name | 6 | 2 | 2 | 0 |
| person: nikud on one occurrence | 0 | 3 | 3 | 0 |
| person: once, only with a prefix letter (expected to fail) | 0 | 3 | 3 | 0 |
| person: name that reads like a body's | 0 | 3 | 3 | 0 |
| org: public body, must not be redacted | – | – | – | 0 |
| person: two people edit-distance 1 apart (must not merge) | 2 | 4 | 4 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 2 | 2 | 2 | 0 |
| person: hyphenated surname, elsewhere with a space | 2 | 3 | 3 | 0 |
| person: minor, first name only | 1 | 9 | 9 | 0 |
| place: street | 8 | 0 | 0 | 0 |
| trap: פלוני / פלונית | – | – | – | 0 |
| person: two-letter surname | 0 | 5 | 5 | 0 |
| person: minor introduced by הקטין / הקטינה | 6 | 1 | 1 | 0 |
| pii: ID number | 10 | 0 | 0 | 0 |
| pii: mobile phone | 10 | 0 | 0 | 0 |
| pii: date of birth | 6 | 0 | 0 | 0 |
| pii: email address | 6 | 0 | 0 | 0 |
| pii: bank account | 5 | 0 | 0 | 0 |
| pii: licence plate | 4 | 0 | 0 | 0 |
| person: party by role word and colon, first name only | 6 | 0 | 0 | 0 |
| person: name right after a discourse word (כאמור, משכך, לדבריה) | 3 | 0 | 1 | 0 |
| trap: form label with a colon (not a speaker) | – | – | – | 0 |
| trap: word ending in ת before a word starting with ז (not ת"ז) | – | – | – | 0 |
| trap: הח"מ before a verb (not a name) | – | – | – | 0 |
| trap: role word in any spelling (אפוטרופא, אפוטרופוס) | – | – | – | 0 |
| trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) | – | – | – | 2 |
| person: speaker written on a line of its own (no colon) | 5 | 0 | 0 | 0 |
| person: foreign first name only after a care or teaching role word, in child speech | 3 | 0 | 0 | 0 |
| person: everyday word as a first name, before a speech verb (lexicon-aided by design) (lexicon-aided) | 3 | 0 | 0 | 0 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 16 | 10 | 13 | 0 |
| filing | 29 | 6 | 8 | 2 |
| transcript | 23 | 10 | 13 | 0 |
| welfare | 19 | 5 | 7 | 0 |
| medical | 12 | 5 | 5 | 0 |
| police | 18 | 3 | 3 | 0 |
| bank | 13 | 2 | 2 | 0 |
| chat | 13 | 7 | 8 | 0 |
| position | 12 | 1 | 2 | 2 |
| audio | 17 | 3 | 8 | 0 |
| interview | 8 | 3 | 3 | 0 |

## Unlisted suggestions (match nothing in the key; one tap each) — 23 in total

Counted, not optimised for: the list is read, accept-all is not how the tool is used.

- **meeting** (2, 2 applied): בקבוצה [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied** · נוער [suggest] **applied**
- **filing** (5, 5 applied): נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · תצהיר [discover; פסקה שכולה שם, ואחריה דיבור] **applied** · תצהירי [near+flagged] **applied** · עלי [flagged] **applied**
- **transcript** (3, 3 applied): במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · יו"ר [discover; פותח תור דיבור בתמלול] **applied**
- **welfare** (1, 1 applied): לסדרי [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied**
- **medical** (5, 5 applied): המטופלת [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · הנבדק [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · קלינית [suggest] **applied**
- **police** (2, 2 applied): ראיתי רכב [suggest] **applied** · המתלוננת [discover; פותח תור דיבור בתמלול] **applied**
- **bank** (2, 2 applied): החשבון [discover; פותח תור דיבור בתמלול] **applied** · יתרה לסוף התקופה [discover; פותח תור דיבור בתמלול] **applied**
- **chat** (1, 1 applied): בגן [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied**
- **position** (1, 1 applied): הבהרה [discover; פותח תור דיבור בתמלול] **applied**
- **audio** (1, 1 applied): ושניהם [suggest] **applied**

## Missed and leaked, by document

- m1 · person: name that is also a common word · חיים סבג: missed, **leaked**: חיים סבג, חיים
- m1 · person: same person, one clean and one corrupted spelling · דסטה טספאיי: missed, **leaked**: דסטה טספאיי, תספאיי
- m1 · person: name split across two runs mid-word · עמיחי אלמגור: missed, **leaked**: עמיחי אלמגור
- m2 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- m2 · org: private body, must be redacted · מעון גן הדובים: found via flagged+applied as «מעון», **leaked**: גן הדובים
- m2 · place: neighbourhood · שכונת נווה רם: missed, **leaked**: שכונת נווה רם, נווה רם
- m3 · person: two people sharing a surname · נמרוד רוזנטל: found via suggest+applied as «ונמרוד רוזנטל», «מורן רוזנטל», **leaked**: רוזנטל
- m3 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- m3 · person: once, only with a prefix letter · הילי: missed, **leaked**: הילי, בהילי
- m3 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- m4 · person: two people edit-distance 1 apart (must not merge) · ינון אביתן: missed, **leaked**: ינון אביתן, אביתן
- m4 · person: hyphenated surname, elsewhere with a space · אלה בן-רביב: missed, **leaked**: אלה בן-רביב, בן רביב
- m4 · person: minor, first name only · אופק: missed, **leaked**: אופק
- f1 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- f1 · person: same person, one clean and one corrupted spelling · נתנאל וייסמן: found via suggest+applied as «ויסמן», **leaked**: נתנאל וייסמן
- f2 · person: Ethiopian name · אברה ברהנו: missed, **leaked**: אברה ברהנו, ברהנו
- f2 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- f3 · person: two people edit-distance 1 apart (must not merge) · מורן אביטן: missed, **leaked**: מורן אביטן, אביטן
- f3 · person: once, only with a prefix letter · רויטל: missed, **leaked**: רויטל, לרויטל
- f4 · person: Arabic name · עבד אל-האדי: missed, **leaked**: עבד אל-האדי
- f4 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- t1 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- t2 · person: Arabic name · אבו ריא: missed, **leaked**: אבו ריא
- t2 · person: same person, one clean and one corrupted spelling · דסטה טספאיי: found via suggest+applied as «תספאיי», **leaked**: דסטה טספאיי
- t2 · person: hyphenated surname, elsewhere with a space · אלה בן-רביב: missed, **leaked**: אלה בן-רביב, בן רביב
- t2 · person: minor, first name only · אופק: missed, **leaked**: אופק
- t2 · person: once, only with a prefix letter · נהוראי: missed, **leaked**: נהוראי, ונהוראי
- t3 · person: two people edit-distance 1 apart (must not merge) · מורן אביטן: missed, **leaked**: מורן אביטן, אביטן
- t3 · person: two people edit-distance 1 apart (must not merge) · ינון אביתן: missed, **leaked**: ינון אביתן, אביתן
- t3 · person: only in corrupted form, never cleanly · טיטו וורקו: missed, **leaked**: טיטו ווארקו
- t3 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- t4 · person: two people sharing a surname · נמרוד רוזנטל: found via discover+suggest+applied as «נמרוד רוזנטל», «מורן רוזנטל», «רוזנטל», **leaked**: רוזנטל
- t4 · person: minor, first name only · עומרי: missed, **leaked**: עומרי
- t4 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- w1 · person: two-letter surname · ליעד כץ: missed, **leaked**: ליעד כץ
- w1 · person: title attached · שיראל שטרית: missed, **leaked**: שיראל שטרית, עו"ס שיראל שטרית, שטרית
- w2 · org: private body, must be redacted · פנימיית גבעת הרימון: missed, **leaked**: פנימיית גבעת הרימון, גבעת הרימון
- w2 · place: neighbourhood · שכונת נווה חן: missed, **leaked**: שכונת נווה חן
- w3 · person: two-letter surname · מתן צח: missed, **leaked**: מתן צח
- w3 · person: two people sharing a surname · סלים מנסור: found via suggest+applied as «סלים מנסור», **leaked**: סלים
- w3 · person: two people sharing a surname · חנין מנסור: found via suggest+applied as «סלים מנסור», **leaked**: חנין מנסור, מנסור
- h1 · person: minor, first name only · אבישג: missed, **leaked**: אבישג
- h3 · person: Russian name · ולריה קוזנצוב: missed, **leaked**: ולריה קוזנצוב, קוזנצוב
- h3 · person: Ethiopian name · יונס גטהון: missed, **leaked**: יונס גטהון, גטהון
- h3 · person: two-letter surname · איה נץ: missed, **leaked**: איה נץ
- h3 · org: private body, must be redacted · מכון שורשים: missed, **leaked**: מכון שורשים, שורשים
- p1 · person: same person, one clean and one corrupted spelling · ארטיום מורוזוב: missed, **leaked**: ארטיום מורוזוב, מורוזב
- p2 · place: town · גבעת עדה: missed, **leaked**: גבעת עדה
- p3 · person: two-letter surname · עלמה כץ: missed, **leaked**: עלמה כץ
- b2 · person: Arabic name · טהא עודה: missed, **leaked**: טהא עודה, עודה
- b2 · org: private body, must be redacted · חברת קו הזהב הובלות: missed, **leaked**: חברת קו הזהב הובלות, קו הזהב
- c1 · person: two-letter surname · מיקי צח: missed, **leaked**: מיקי צח
- c1 · person: minor, first name only · טרקה: missed, **leaked**: טרקה
- c1 · place: town · נופית: missed, **leaked**: נופית
- c2 · person: Arabic name · מייסא סרחאן: missed, **leaked**: מייסא סרחאן, סרחאן
- c2 · person: hyphenated surname, elsewhere with a space · ליעד בן-עמיאל: missed, **leaked**: ליעד בן-עמיאל, בן עמיאל
- c3 · person: Ethiopian name · ברהאנה וורקנה: missed, **leaked**: ברהאנה וורקנה, וורקנה
- c4 · person: Russian name · פולינה סמירנובה: missed, **leaked**: פולינה סמירנובה, סמירנובה
- c4 · person: same person, one clean and one corrupted spelling · קסאי אלמו: found via suggest+applied as «עלמו», **leaked**: קסאי אלמו
- x1 · person: minor introduced by הקטין / הקטינה · אביתר: missed, **leaked**: אביתר, האח אביתר
- x3 · person: name right after a discourse word (כאמור, משכך, לדבריה) · יונס: found via discover+applied as «יונס פעמיים», **leaked**: יונס
- a1 · person: same person, one clean and one corrupted spelling · בוסקילה: missed, **leaked**: בוסקילה, בושקילה
- a1 · person: same person, one clean and one corrupted spelling · אביתר: found via suggest+applied as «אביטר», **leaked**: אביתר
- a1 · person: only in corrupted form, never cleanly · וסילייב: missed, **leaked**: וסיליב
- a2 · person: same person, one clean and one corrupted spelling · אלמליח: found via suggest as «אתמול ואלמליך», **leaked**: אלמליח, אלמליך
- a2 · person: minor, first name only · אסיף: missed, **leaked**: אסיף
- a3 · person: two people sharing a surname · סוהא אגבריה: found via suggest+applied as «וסוהא אגבריה», «יונס אגבריה», **leaked**: אגבריה
- a4 · person: same person, one clean and one corrupted spelling · תורגמן: found via suggest+applied as «בסוף טורגמן», **leaked**: תורגמן
- a4 · person: same person, one clean and one corrupted spelling · מקונן: found via suggest+applied as «מקונן», **leaked**: מכונן
- v1 · person: minor, first name only · תהל: missed, **leaked**: תהל
- v2 · person: minor, first name only · איתן: missed, **leaked**: איתן
- v3 · person: minor, first name only · לינוי: missed, **leaked**: לינוי

## Traps and public bodies touched

- f2 · trap: case numbers, dates, section references · סעיף 2: suggested as «ת"פ 4471-02-26 [flagged]»; altered: ת"פ 4471-02-26
- f2 · trap: idiom or public title beside a same-word name · בגיל 8: suggested as «שחר [suggest]»; altered: עם שחר
- x1 · trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) · לשם: suggested as «קדימה [flagged]»; altered: קדימה
- x2 · trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) · אורה: suggested as «עלי [flagged]»; altered: עלי

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 68 | 4 | 1 |
| m2 | meeting | 32 | 6 | 0 |
| m3 | meeting | 25 | 3 | 0 |
| m4 | meeting | 20 | 3 | 1 |
| f1 | filing | 40 | 10 | 1 |
| f2 | filing | 57 | 13 | 1 |
| f3 | filing | 22 | 5 | 0 |
| f4 | filing | 31 | 8 | 3 |
| t1 | transcript | 30 | 6 | 0 |
| t2 | transcript | 20 | 5 | 1 |
| t3 | transcript | 21 | 6 | 1 |
| t4 | transcript | 31 | 9 | 1 |
| w1 | welfare | 10 | 1 | 0 |
| w2 | welfare | 15 | 3 | 0 |
| w3 | welfare | 12 | 2 | 0 |
| w4 | welfare | 17 | 5 | 1 |
| h1 | medical | 21 | 6 | 2 |
| h2 | medical | 15 | 2 | 0 |
| h3 | medical | 13 | 3 | 3 |
| p1 | police | 20 | 2 | 1 |
| p2 | police | 14 | 3 | 1 |
| p3 | police | 9 | 1 | 0 |
| p4 | police | 14 | 3 | 0 |
| b1 | bank | 19 | 5 | 2 |
| b2 | bank | 7 | 1 | 0 |
| b3 | bank | 8 | 2 | 0 |
| c1 | chat | 8 | 1 | 0 |
| c2 | chat | 10 | 2 | 1 |
| c3 | chat | 9 | 2 | 0 |
| c4 | chat | 12 | 3 | 0 |
| x1 | position | 20 | 5 | 1 |
| x2 | position | 18 | 4 | 0 |
| x3 | position | 18 | 4 | 0 |
| a1 | audio | 16 | 3 | 0 |
| a2 | audio | 17 | 5 | 0 |
| a3 | audio | 23 | 7 | 1 |
| a4 | audio | 14 | 4 | 0 |
| v1 | interview | 14 | 2 | 0 |
| v2 | interview | 16 | 3 | 0 |
| v3 | interview | 10 | 2 | 0 |
