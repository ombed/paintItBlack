# Benchmark results (no model)

33 documents, 259 keyed entities, model off. Generated 2026-09-06.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 6 | 4 | 4 | 0 |
| person: name that is also a common word (lexicon-aided) | 6 | 1 | 1 | 0 |
| person: title attached | 7 | 1 | 1 | 0 |
| person: same person, one clean and one corrupted spelling | 3 | 2 | 5 | 0 |
| person: name split across two runs mid-word | 3 | 0 | 0 | 0 |
| org: private body, must be redacted | 8 | 2 | 3 | 0 |
| place: town | 11 | 1 | 1 | 0 |
| trap: case numbers, dates, section references | – | – | – | 1 |
| trap: idiom or public title beside a same-word name | – | – | – | 1 |
| person: full name, surname alone, first name alone | 7 | 0 | 3 | 0 |
| person: only in prose, never before a speech verb | 5 | 0 | 0 | 0 |
| person: Ethiopian name | 5 | 3 | 3 | 0 |
| person: role word directly before, no colon | 6 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 0 | 0 |
| place: neighbourhood | 6 | 0 | 0 | 0 |
| person: two people sharing a surname | 8 | 0 | 3 | 0 |
| person: Russian name | 6 | 2 | 2 | 0 |
| person: nikud on one occurrence | 0 | 3 | 3 | 0 |
| person: once, only with a prefix letter (expected to fail) | 0 | 3 | 3 | 0 |
| person: name that reads like a body's | 0 | 3 | 3 | 0 |
| org: public body, must not be redacted | – | – | – | 0 |
| person: two people edit-distance 1 apart (must not merge) | 6 | 0 | 4 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 2 | 1 | 1 | 0 |
| person: hyphenated surname, elsewhere with a space | 3 | 2 | 3 | 0 |
| person: minor, first name only | 1 | 5 | 5 | 0 |
| place: street | 8 | 0 | 0 | 0 |
| trap: פלוני / פלונית | – | – | – | 0 |
| person: two-letter surname | 3 | 2 | 2 | 0 |
| person: minor introduced by הקטין / הקטינה | 2 | 5 | 5 | 0 |
| pii: ID number | 10 | 0 | 0 | 0 |
| pii: mobile phone | 9 | 0 | 0 | 0 |
| pii: date of birth | 6 | 0 | 0 | 0 |
| pii: email address | 6 | 0 | 0 | 0 |
| pii: bank account | 5 | 0 | 0 | 0 |
| pii: licence plate | 4 | 0 | 0 | 0 |
| person: party by role word and colon, first name only | 6 | 0 | 0 | 0 |
| person: name right after a discourse word (כאמור, משכך, לדבריה) | 2 | 1 | 1 | 0 |
| trap: form label with a colon (not a speaker) | – | – | – | 0 |
| trap: word ending in ת before a word starting with ז (not ת"ז) | – | – | – | 0 |
| trap: הח"מ before a verb (not a name) | – | – | – | 0 |
| trap: role word in any spelling (אפוטרופא, אפוטרופוס) | – | – | – | 0 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 19 | 7 | 10 | 0 |
| filing | 30 | 5 | 8 | 2 |
| transcript | 25 | 8 | 13 | 0 |
| welfare | 19 | 5 | 7 | 0 |
| medical | 13 | 4 | 4 | 0 |
| police | 19 | 2 | 2 | 0 |
| bank | 13 | 2 | 2 | 0 |
| chat | 15 | 5 | 7 | 0 |
| position | 10 | 3 | 3 | 0 |

## Unlisted suggestions (match nothing in the key; one tap each) — 25 in total

Counted, not optimised for: the list is read, accept-all is not how the tool is used.

- **meeting** (3, 3 applied): סיכמנו [discover; פותח תור דיבור בתמלול] **applied** · מהבניין [suggest] **applied** · נוער [suggest] **applied**
- **filing** (4, 4 applied): נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · עלי [flagged] **applied** · קבועה [flagged] **applied**
- **transcript** (5, 5 applied): במרפאת עין [suggest] **applied** · מלאה [flagged] **applied** · חבר [flagged] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · יו"ר [discover; פותח תור דיבור בתמלול] **applied**
- **welfare** (2, 2 applied): סעד [flagged] **applied** · סעד [flagged] **applied**
- **medical** (6, 6 applied): המטופלת [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · הנבדק [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · קלינית [suggest] **applied** · הנוכחי [flagged] **applied**
- **police** (2, 2 applied): ראיתי רכב [suggest] **applied** · המתלוננת [discover; פותח תור דיבור בתמלול] **applied**
- **bank** (2, 2 applied): החשבון [discover; פותח תור דיבור בתמלול] **applied** · יתרה לסוף התקופה [discover; פותח תור דיבור בתמלול] **applied**
- **chat** (1, 1 applied): מהוועד [suggest] **applied**

## Missed and leaked, by document

- m1 · person: name that is also a common word · חיים סבג: missed, **leaked**: חיים סבג, חיים
- m1 · person: same person, one clean and one corrupted spelling · דסטה טספאיי: missed, **leaked**: דסטה טספאיי, תספאיי
- m2 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- m2 · org: private body, must be redacted · מעון גן הדובים: found via flagged+applied as «מעון», **leaked**: גן הדובים
- m3 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- m3 · person: once, only with a prefix letter · הילי: missed, **leaked**: הילי, בהילי
- m3 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- m4 · person: two people edit-distance 1 apart (must not merge) · ינון אביתן: found via applied as «ינון», **leaked**: אביתן
- m4 · person: hyphenated surname, elsewhere with a space · אלה בן-רביב: missed, **leaked**: אלה בן-רביב, בן רביב
- m4 · person: minor, first name only · אופק: missed, **leaked**: אופק
- f1 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- f1 · person: same person, one clean and one corrupted spelling · נתנאל וייסמן: found via suggest+applied as «ויסמן», **leaked**: נתנאל וייסמן
- f2 · person: Ethiopian name · אברה ברהנו: missed, **leaked**: אברה ברהנו, ברהנו
- f2 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- f3 · person: two people edit-distance 1 apart (must not merge) · מורן אביטן: found via applied as «מורן», **leaked**: אביטן
- f3 · person: once, only with a prefix letter · רויטל: missed, **leaked**: רויטל, לרויטל
- f4 · person: Arabic name · עבד אל-האדי: missed, **leaked**: עבד אל-האדי
- f4 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- t1 · person: full name, surname alone, first name alone · אריאל הורוביץ: found via flagged+applied as «אריאל», **leaked**: הורוביץ
- t2 · person: Arabic name · אבו ריא: missed, **leaked**: אבו ריא
- t2 · person: same person, one clean and one corrupted spelling · דסטה טספאיי: found via suggest+applied as «תספאיי», **leaked**: דסטה טספאיי
- t2 · person: hyphenated surname, elsewhere with a space · אלה בן-רביב: missed, **leaked**: אלה בן-רביב, בן רביב
- t2 · person: minor, first name only · אופק: missed, **leaked**: אופק
- t2 · person: once, only with a prefix letter · נהוראי: missed, **leaked**: נהוראי, ונהוראי
- t3 · person: two people edit-distance 1 apart (must not merge) · מורן אביטן: found via applied as «מורן», **leaked**: אביטן
- t3 · person: two people edit-distance 1 apart (must not merge) · ינון אביתן: found via applied as «ינון», **leaked**: אביתן
- t3 · person: only in corrupted form, never cleanly · טיטו וורקו: missed, **leaked**: טיטו ווארקו
- t3 · person: nikud on one occurrence · מיקה: missed, **leaked**: מיקה
- t4 · person: two people sharing a surname · נמרוד רוזנטל: found via discover+suggest+applied as «נמרוד רוזנטל», «מורן רוזנטל», «רוזנטל», **leaked**: רוזנטל
- t4 · person: minor, first name only · עומרי: missed, **leaked**: עומרי
- t4 · person: name that reads like a body's · עומרי גן: missed, **leaked**: עומרי גן
- w1 · person: minor introduced by הקטין / הקטינה · אגם: missed, **leaked**: אגם, הקטינה אגם
- w1 · person: title attached · שיראל שטרית: missed, **leaked**: שיראל שטרית, עו"ס שיראל שטרית, שטרית
- w2 · person: minor introduced by הקטין / הקטינה · ניב: missed, **leaked**: ניב, הקטין ניב
- w2 · org: private body, must be redacted · פנימיית גבעת הרימון: missed, **leaked**: פנימיית גבעת הרימון, גבעת הרימון
- w3 · person: two people sharing a surname · סלים מנסור: found via suggest+applied as «סלים מנסור», **leaked**: סלים
- w3 · person: two people sharing a surname · חנין מנסור: found via suggest+applied as «סלים מנסור», **leaked**: חנין מנסור, מנסור
- w4 · person: minor introduced by הקטין / הקטינה · ליה: missed, **leaked**: ליה, הקטינה ליה
- h1 · person: minor, first name only · אבישג: missed, **leaked**: אבישג
- h3 · person: Russian name · ולריה קוזנצוב: missed, **leaked**: ולריה קוזנצוב, קוזנצוב
- h3 · person: Ethiopian name · יונס גטהון: missed, **leaked**: יונס גטהון, גטהון
- h3 · person: two-letter surname · איה נץ: missed, **leaked**: איה נץ
- p1 · person: same person, one clean and one corrupted spelling · ארטיום מורוזוב: missed, **leaked**: ארטיום מורוזוב, מורוזב
- p2 · place: town · גבעת עדה: missed, **leaked**: גבעת עדה
- b2 · person: Arabic name · טהא עודה: missed, **leaked**: טהא עודה, עודה
- b2 · org: private body, must be redacted · חברת קו הזהב הובלות: missed, **leaked**: חברת קו הזהב הובלות, קו הזהב
- c1 · person: two-letter surname · מיקי צח: missed, **leaked**: מיקי צח
- c1 · person: minor, first name only · טרקה: missed, **leaked**: טרקה
- c2 · person: Arabic name · מייסא סרחאן: missed, **leaked**: מייסא סרחאן, סרחאן
- c2 · person: hyphenated surname, elsewhere with a space · ליעד בן-עמיאל: found via flagged+applied as «יעד», **leaked**: בן עמיאל
- c3 · person: Ethiopian name · ברהאנה וורקנה: missed, **leaked**: ברהאנה וורקנה, וורקנה
- c4 · person: Russian name · פולינה סמירנובה: missed, **leaked**: פולינה סמירנובה, סמירנובה
- c4 · person: same person, one clean and one corrupted spelling · קסאי אלמו: found via suggest+applied as «עלמו», **leaked**: קסאי אלמו
- x1 · person: minor introduced by הקטין / הקטינה · אביתר: missed, **leaked**: אביתר, האח אביתר
- x3 · person: name right after a discourse word (כאמור, משכך, לדבריה) · יונס: missed, **leaked**: יונס
- x3 · person: minor introduced by הקטין / הקטינה · מייסא: missed, **leaked**: מייסא, האחות מייסא

## Traps and public bodies touched

- f2 · trap: case numbers, dates, section references · סעיף 2: suggested as «ת"פ 4471-02-26 [flagged]»; altered: ת"פ 4471-02-26
- f2 · trap: idiom or public title beside a same-word name · בגיל 8: suggested as «שחר [suggest]»; altered: עם שחר

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 99 | 3 | 0 |
| m2 | meeting | 39 | 6 | 0 |
| m3 | meeting | 26 | 2 | 0 |
| m4 | meeting | 35 | 5 | 3 |
| f1 | filing | 43 | 10 | 1 |
| f2 | filing | 69 | 13 | 1 |
| f3 | filing | 29 | 5 | 0 |
| f4 | filing | 37 | 7 | 2 |
| t1 | transcript | 33 | 6 | 0 |
| t2 | transcript | 35 | 8 | 3 |
| t3 | transcript | 32 | 6 | 1 |
| t4 | transcript | 25 | 7 | 1 |
| w1 | welfare | 18 | 2 | 1 |
| w2 | welfare | 18 | 3 | 1 |
| w3 | welfare | 17 | 3 | 0 |
| w4 | welfare | 18 | 3 | 0 |
| h1 | medical | 25 | 6 | 2 |
| h2 | medical | 19 | 2 | 0 |
| h3 | medical | 20 | 4 | 4 |
| p1 | police | 19 | 2 | 1 |
| p2 | police | 15 | 2 | 1 |
| p3 | police | 10 | 1 | 0 |
| p4 | police | 17 | 3 | 0 |
| b1 | bank | 26 | 5 | 2 |
| b2 | bank | 11 | 1 | 0 |
| b3 | bank | 13 | 2 | 0 |
| c1 | chat | 10 | 1 | 0 |
| c2 | chat | 15 | 3 | 1 |
| c3 | chat | 11 | 2 | 0 |
| c4 | chat | 15 | 3 | 0 |
| x1 | position | 17 | 4 | 0 |
| x2 | position | 21 | 3 | 0 |
| x3 | position | 16 | 2 | 0 |
