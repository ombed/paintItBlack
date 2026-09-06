# Span boundaries

387 occurrences of keyed name, org and place surfaces across 30 documents; raw model spans after alignment and grouping, before cleaning. Generated 2026-09-06.

## By boundary class

| class | occurrences | value survives cleaning |
|---|---|---|
| exact | 228 | 134 |
| none | 65 | 8 |
| glued-left | 40 | 14 |
| cut-left | 34 | 19 |
| cut-left+glued-right | 11 | 4 |
| glued-left+cut-right | 4 | 1 |
| cut-right | 3 | 0 |
| cut-left+cut-right | 1 | 0 |
| glued-right | 1 | 0 |

## Context flags on the mis-bounded spans

| flag | occurrences |
|---|---|
| prefix-letter | 37 |
| next-word | 12 |
| previous-word | 6 |
| kind:FAC | 5 |
| kind:GPE | 4 |
| kind:PER | 2 |
| across-punctuation | 1 |
| kind:ORG | 1 |

## Context flags on the missed occurrences (no span)

| flag | occurrences |
|---|---|
| (none) | 37 |
| prefix-letter | 26 |
| after-title | 2 |

## By genre

| genre | exact | glued | cut | none |
|---|---|---|---|---|
| meeting | 33 | 10 | 9 | 16 |
| filing | 39 | 11 | 12 | 14 |
| transcript | 51 | 17 | 15 | 14 |
| welfare | 30 | 7 | 7 | 6 |
| medical | 18 | 4 | 1 | 6 |
| police | 24 | 4 | 3 | 3 |
| bank | 11 | 1 | 2 | 0 |
| chat | 22 | 2 | 4 | 6 |

## By category (mis-bounded or missed only)

| category | glued | cut | none | of |
|---|---|---|---|---|
| person: Arabic name | 0 | 0 | 4 | 28 |
| person: name that is also a common word | 4 | 3 | 8 | 24 |
| person: title attached | 2 | 7 | 1 | 18 |
| person: same person, one clean and one corrupted spelling | 0 | 0 | 3 | 11 |
| org: private body, must be redacted | 7 | 9 | 4 | 22 |
| place: town | 8 | 0 | 1 | 11 |
| person: full name, surname alone, first name alone | 2 | 0 | 1 | 31 |
| person: only in prose, never before a speech verb | 1 | 0 | 1 | 14 |
| person: Ethiopian name | 0 | 5 | 4 | 22 |
| person: role word directly before, no colon | 2 | 6 | 0 | 13 |
| org: body whose name reads like a person's | 0 | 3 | 1 | 4 |
| place: neighbourhood | 0 | 4 | 5 | 10 |
| person: two people sharing a surname | 8 | 0 | 3 | 26 |
| person: Russian name | 1 | 0 | 3 | 24 |
| person: nikud on one occurrence | 4 | 4 | 6 | 16 |
| person: once, only with a prefix letter | 0 | 0 | 1 | 3 |
| person: name that reads like a body's | 0 | 0 | 1 | 3 |
| person: two people edit-distance 1 apart (must not merge) | 5 | 2 | 2 | 18 |
| person: only in corrupted form, never cleanly | 0 | 0 | 2 | 5 |
| person: hyphenated surname, elsewhere with a space | 3 | 1 | 0 | 15 |
| person: minor, first name only | 1 | 0 | 4 | 18 |
| place: street | 7 | 4 | 4 | 12 |
| person: two-letter surname | 1 | 0 | 4 | 17 |
| person: minor introduced by הקטין / הקטינה | 0 | 5 | 2 | 18 |

## Every mis-bounded span

| doc | surface | class | flags | raw span | type | score | survives |
|---|---|---|---|---|---|---|---|
| m1 | חיים סבג | glued-left | prefix-letter | שחיים סבג | PER | 1 | yes |
| m1 | עו"ד יערה ליפשיץ | cut-left |  | יערה ליפשיץ | PER | 1 | yes |
| m1 | עמותת שביל הלב | glued-left | previous-word | ממשרד עמותת שביל הלב | ORG | 1 | yes |
| m1 | שביל הלב | glued-left | prefix-letter, kind:GPE | משביל הלב | GPE | 0.51 | no |
| m1 | נוף הגליל | glued-left | prefix-letter | בנוף הגליל | GPE | 1 | no |
| m2 | מולו טגניה | cut-left |  | טגניה | PER | 1 | no |
| m2 | התובעת סיון נבון | cut-left |  | סיון נבון | PER | 1 | yes |
| m2 | מעון גן הדובים | cut-left | kind:FAC | הדובים | FAC | 0.92 | no |
| m2 | מעון שילה ואופק | cut-right | kind:FAC | מעון שילה | FAC | 0.99 | no |
| m2 | שילה ואופק | cut-left | kind:PER | ואופק | PER | 1 | no |
| m2 | שכונת נווה רם | cut-left |  | נווה רם | GPE | 1 | no |
| m3 | נמרוד רוזנטל | glued-left | prefix-letter | ונמרוד רוזנטל | PER | 1 | no |
| m3 | רוזנטל | glued-left | previous-word | מורן רוזנטל | PER | 1 | no |
| m3 | מיקה | cut-left+glued-right | next-word | מיקה | PER | 1 | yes |
| m3 | מִיקָה | cut-left+glued-right | next-word | מיקה | PER | 1 | no |
| m4 | אביתן | glued-left | prefix-letter | ואביתן | PER | 0.98 | no |
| m4 | רחוב הארזים 12 | glued-left | prefix-letter | ברחוב הארזים 12 | FAC | 0.56 | no |
| f1 | התובעת סיון נבון | cut-left |  | סיון נבון | PER | 1 | yes |
| f1 | הנתבע צור אסולין | cut-left |  | צור אסולין | PER | 1 | yes |
| f1 | עו"ד יערה ליפשיץ | cut-left |  | יערה ליפשיץ | PER | 1 | yes |
| f1 | בית ספר ניצני הגליל | cut-left |  | ניצני הגליל | ORG | 0.55 | no |
| f1 | רחוב התאנה 4 | glued-left | prefix-letter | מרחוב התאנה 4 | FAC | 0.94 | yes |
| f2 | רוזנטל | glued-left | previous-word | מורן רוזנטל | PER | 1 | no |
| f2 | רוזנטל | glued-left | prefix-letter | ורוזנטל | PER | 1 | no |
| f2 | ד"ר נתנאל גולן | cut-left |  | נתנאל גולן | PER | 1 | yes |
| f2 | גולן | glued-left | previous-word | שחר גולן | PER | 1 | no |
| f2 | גב' רויטל סבג | cut-left |  | רויטל סבג | PER | 1 | yes |
| f2 | סבג | glued-left | prefix-letter | וסבג | PER | 0.91 | no |
| f2 | שכונת גני אביב | cut-left |  | גני אביב | GPE | 1 | no |
| f3 | אביתן | glued-left | prefix-letter | ואביתן | PER | 0.97 | no |
| f3 | המבקשת אלה בן-רביב | glued-left+cut-right | across-punctuation, kind:ORG | לשכת הרווחה⏎המבקשת | ORG | 0.92 | yes |
| f3 | מבוא חורון | glued-left | prefix-letter | במבוא חורון | GPE | 1 | yes |
| f4 | גב' רויטל סבג | cut-left |  | רויטל סבג | PER | 1 | yes |
| f4 | מיקה | cut-left+glued-right | next-word | מיקה | PER | 1 | yes |
| f4 | מִיקָה | cut-left+glued-right | next-word | מיקה | PER | 1 | no |
| f4 | שדרות הנשיאים 8 | glued-left+cut-right | prefix-letter | בשדרות הנשיאים | FAC | 0.56 | no |
| t1 | הנתבע צור אסולין | cut-left |  | צור אסולין | PER | 1 | yes |
| t1 | אסולין | glued-left | prefix-letter | ואסולין | PER | 1 | no |
| t1 | אלון שבות | glued-left | prefix-letter | לאלון שבות | GPE | 1 | yes |
| t2 | אלה בן-רביב | cut-left |  | בן-רביב | PER | 0.95 | yes |
| t2 | בן רביב | glued-left | prefix-letter | שבן רביב | PER | 1 | no |
| t2 | בן רביב | glued-left | prefix-letter | ובן רביב | PER | 1 | no |
| t2 | מרפאת עין הכרמים | cut-left | kind:FAC | עין הכרמים | FAC | 0.86 | no |
| t2 | עין הכרמים | cut-left | kind:GPE | הכרמים | GPE | 0.9 | yes |
| t2 | גני יוחנן | glued-left | prefix-letter | מגני יוחנן | GPE | 1 | yes |
| t3 | ניר אסולין | cut-left+glued-right | next-word | ניר אסולין | PER | 1 | yes |
| t3 | ניר | cut-left+glued-right | next-word | ניר | PER | 0.96 | no |
| t3 | אור | cut-left+glued-right | next-word | אור | PER | 0.67 | no |
| t3 | אביטן | cut-left+glued-right | next-word | אביטן | PER | 1 | no |
| t3 | אביתן | glued-left | prefix-letter | ואביתן | PER | 0.98 | no |
| t3 | אביתן | cut-left+glued-right | next-word | אביתן | PER | 0.97 | no |
| t3 | עמותת שביל הלב | cut-left+glued-right | next-word | בעמותת שביל הלב | ORG | 0.94 | yes |
| t3 | שביל הלב | cut-left+glued-right | next-word | שביל הלב | ORG | 0.76 | no |
| t3 | שילה ואופק | cut-left+cut-right | kind:GPE | בשילה | GPE | 1 | no |
| t4 | נמרוד רוזנטל | glued-left | prefix-letter | ונמרוד רוזנטל | PER | 1 | yes |
| t4 | רוזנטל | glued-left | previous-word | מורן רוזנטל | PER | 1 | no |
| t4 | מולו טגניה | cut-left |  | טגניה | PER | 1 | no |
| t4 | מולו טגניה | cut-left |  | טגניה | PER | 0.98 | no |
| t4 | אברה ברהנו | cut-right |  | אברה | PER | 1 | no |
| t4 | עומרי | glued-right | next-word | עומרי גן | PER | 1 | no |
| t4 | הר אדר | glued-left | prefix-letter | בהר אדר | GPE | 1 | no |
| w1 | הקטינה אגם | cut-left |  | אגם | PER | 1 | yes |
| w1 | עו"ס שיראל שטרית | cut-left |  | שיראל שטרית | PER | 1 | yes |
| w1 | כפר האורנים | glued-left | prefix-letter | בכפר האורנים | GPE | 1 | yes |
| w2 | הקטין ניב | cut-left |  | ניב | PER | 1 | yes |
| w2 | פנימיית גבעת הרימון | cut-left |  | גבעת הרימון | ORG | 0.49 | no |
| w2 | גבעת הרימון | glued-left | prefix-letter, kind:FAC | מגבעת הרימון | FAC | 0.82 | yes |
| w2 | גבעת הרימון | glued-left | prefix-letter, kind:FAC | בגבעת הרימון | FAC | 0.81 | yes |
| w2 | שכונת נווה חן | cut-left |  | נווה חן | GPE | 0.99 | no |
| w3 | חנין מנסור | glued-left | prefix-letter | וחנין מנסור | PER | 1 | no |
| w3 | מנסור | glued-left | previous-word | סלים מנסור | PER | 0.94 | no |
| w4 | הקטינה ליה | cut-left |  | ליה | PER | 1 | yes |
| w4 | רחוב הגפן 3 | glued-left+cut-right | prefix-letter | ברחוב הגפן | FAC | 0.99 | no |
| w4 | אסיף | glued-left | prefix-letter | לאסיף | PER | 0.88 | yes |
| h1 | ד"ר אביתר יפרח | cut-left |  | אביתר יפרח | PER | 1 | yes |
| h1 | נוף הים | glued-left | prefix-letter, kind:GPE | בנוף הים | GPE | 1 | yes |
| h2 | כרים אבו-סרחאן | glued-left | prefix-letter | וכרים אבו-סרחאן | PER | 1 | no |
| h2 | צור יצחק | glued-left | prefix-letter | לצור יצחק | GPE | 1 | no |
| h3 | קוזנצוב | glued-left | prefix-letter | וקוזנצוב | PER | 0.82 | no |
| p1 | העד פיראס חטיב | cut-left |  | פיראס חטיב | PER | 1 | yes |
| p1 | רחוב הדקל 7 | glued-left | prefix-letter | ברחוב הדקל 7 | FAC | 0.99 | yes |
| p1 | הדקל | glued-left | prefix-letter | בהדקל | GPE | 1 | no |
| p2 | הקטין לביא | cut-left |  | לביא | PER | 1 | yes |
| p3 | עלמה כץ | glued-left | prefix-letter | לעלמה כץ | PER | 1 | no |
| p4 | מאזה טספה | cut-left |  | טספה | PER | 0.99 | no |
| p4 | עמנואל שוורץ | glued-left | prefix-letter | ועמנואל שוורץ | PER | 1 | yes |
| b1 | ברזילי | glued-left | prefix-letter | לברזילי | PER | 0.51 | no |
| b1 | שדרות הברוש 21 | cut-right |  | שדרות הברוש | FAC | 1 | no |
| b2 | חברת קו הזהב הובלות | cut-left |  | קו הזהב הובלות | ORG | 0.56 | no |
| c1 | נופית | glued-left | prefix-letter | בנופית | GPE | 0.93 | no |
| c2 | גן ילדים שלהבת | cut-left | kind:PER | שלהבת | PER | 0.87 | no |
| c3 | הקטינה גפן | cut-left |  | גפן | PER | 1 | yes |
| c3 | רחוב הנרקיס 9 | glued-left+cut-right | prefix-letter | ברחוב הנרקיס | FAC | 1 | no |
| c4 | שכונת כרם הזיתים | cut-left |  | כרם הזיתים | FAC | 0.62 | no |

## Every missed occurrence

| doc | surface | flags |
|---|---|---|
| m1 | חיים | prefix-letter |
| m1 | חיים |  |
| m1 | תספאיי | prefix-letter |
| m1 | שביל הלב | prefix-letter |
| m2 | הורוביץ | after-title |
| m3 | מורן | prefix-letter |
| m3 | רוזנטל | prefix-letter |
| m3 | איגור וולקוב | prefix-letter |
| m3 | וולקוב | prefix-letter |
| m3 | וולקוב | prefix-letter |
| m3 | מיקה |  |
| m3 | מִיקָה |  |
| m3 | בהילי | prefix-letter |
| m3 | עומרי גן | prefix-letter |
| m4 | אביטן | after-title |
| m4 | הארזים | prefix-letter |
| f1 | בית זית |  |
| f2 | שחר |  |
| f3 | אביתן |  |
| f3 | משפחת בוזגלו |  |
| f4 | מסאלחה | prefix-letter |
| f4 | ואיל שקור |  |
| f4 | שקור | prefix-letter |
| f4 | עבד אל-האדי | prefix-letter |
| f4 | יערה שפרינסק |  |
| f4 | שפרינסק | prefix-letter |
| f4 | מיקה |  |
| f4 | מִיקָה |  |
| f4 | שילה ואופק | prefix-letter |
| f4 | הנשיאים | prefix-letter |
| t1 | דור |  |
| t1 | דור | prefix-letter |
| t1 | דור |  |
| t1 | מר שר |  |
| t2 | תספאיי |  |
| t2 | אופק |  |
| t2 | אופק |  |
| t2 | אופק |  |
| t3 | אור | prefix-letter |
| t3 | מיקה |  |
| t3 | מִיקָה |  |
| t3 | שכונת הדקלים | prefix-letter |
| t3 | הדקלים | prefix-letter |
| t4 | ברהנו |  |
| w2 | מקונן |  |
| w3 | צח |  |
| w3 | סלים |  |
| w4 | ליה |  |
| w4 | ליה | prefix-letter |
| w4 | הגפן | prefix-letter |
| h3 | איה נץ | prefix-letter |
| h3 | נץ |  |
| h3 | נץ |  |
| h3 | מכון שורשים |  |
| h3 | שורשים |  |
| h3 | שורשים |  |
| p4 | טספה |  |
| p4 | שכונת הפרדס | prefix-letter |
| p4 | הפרדס |  |
| c1 | טרקה |  |
| c1 | צליל |  |
| c3 | וורקנה |  |
| c3 | הנרקיס | prefix-letter |
| c4 | עלמו |  |
| c4 | כרם הזיתים |  |
