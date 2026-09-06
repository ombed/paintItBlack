# Parameter sweep

Model on, whole corpus at every point. Generated 2026-09-06. The shipped value is marked ◀. Junk is reported, not optimised for.

## body — verb layer (bodyNames) while the model runs

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 9 | 9 | 2 | 36 | 3009 |
| on ◀ | 5 | 5 | 2 | 41 | 6184 |

## min — model confidence floor

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 0.3 | 5 | 4 | 2 | 42 | 2990 |
| 0.4 | 5 | 4 | 2 | 42 | 3348 |
| 0.5 | 5 | 4 | 2 | 42 | 2949 |
| 0.6 | 4 | 4 | 2 | 42 | 2998 |
| 0.7 ◀ | 5 | 5 | 2 | 41 | 2854 |
| 0.8 | 5 | 5 | 2 | 41 | 2997 |
| 0.9 | 11 | 11 | 2 | 41 | 3410 |

## nearLen — near-miss scan: shortest target it looks for (letters)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 3 | 5 | 5 | 2 | 43 | 2874 |
| 4 ◀ | 5 | 5 | 2 | 41 | 2875 |
| 5 | 5 | 5 | 2 | 41 | 2915 |
| 6 | 5 | 5 | 2 | 41 | 3015 |

## nearShort — near-miss scan: single-word targets up to this length need a confusable pair or a weak letter

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 5 | 5 | 2 | 41 | 3571 |
| 3 | 5 | 5 | 2 | 41 | 3069 |
| 4 ◀ | 5 | 5 | 2 | 41 | 2988 |
| 5 | 5 | 5 | 2 | 41 | 3571 |
| 6 | 5 | 5 | 2 | 41 | 4968 |
| all | 5 | 5 | 2 | 41 | 3363 |

## weak — matres lectionis: letters whose insertion or deletion counts as a typo

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| none | 5 | 5 | 2 | 41 | 3162 |
| ו י | 5 | 5 | 2 | 41 | 2904 |
| א ה ו י ◀ | 5 | 5 | 2 | 41 | 2938 |
| א ה ו י + geresh | 5 | 5 | 2 | 41 | 2985 |

## homo — confusable letter pairs (leave one out; 'none' = no pairs)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| all ◀ | 5 | 5 | 2 | 41 | 2932 |
| none | 5 | 5 | 2 | 41 | 2966 |
| without א↔ה | 5 | 5 | 2 | 41 | 2971 |
| without א↔ע | 5 | 5 | 2 | 41 | 2800 |
| without ה↔ע | 5 | 5 | 2 | 41 | 2873 |
| without א↔י | 5 | 5 | 2 | 41 | 2993 |
| without כ↔ח | 5 | 5 | 2 | 41 | 3335 |
| without ק↔כ | 5 | 5 | 2 | 41 | 3244 |
| without ת↔ט | 5 | 5 | 2 | 41 | 3152 |
| without ס↔ש | 5 | 5 | 2 | 41 | 3201 |
| without ב↔ו | 5 | 5 | 2 | 41 | 3454 |
| without ז↔צ | 5 | 5 | 2 | 41 | 3399 |
| without ו↔י | 5 | 5 | 2 | 41 | 2914 |
| without ם↔מ | 5 | 5 | 2 | 41 | 2981 |
| without ן↔נ | 5 | 5 | 2 | 41 | 2821 |
| without ך↔כ | 5 | 5 | 2 | 41 | 2911 |
| without ף↔פ | 5 | 5 | 2 | 41 | 3060 |
| without ץ↔צ | 5 | 5 | 2 | 41 | 2967 |
| without ש↔ס | 5 | 5 | 2 | 41 | 2876 |
| without ד↔ת | 5 | 5 | 2 | 41 | 2850 |
| without ג↔ק | 5 | 5 | 2 | 41 | 2971 |
| without ל↔ר | 5 | 5 | 2 | 41 | 3122 |
| without ל↔נ | 5 | 5 | 2 | 41 | 3018 |
| without נ↔ר | 5 | 5 | 2 | 41 | 2920 |
| without מ↔נ | 5 | 5 | 2 | 41 | 2891 |
| without ב↔פ | 5 | 5 | 2 | 41 | 3038 |
| without ד↔ט | 5 | 5 | 2 | 41 | 2918 |
| without ג↔כ | 5 | 5 | 2 | 41 | 3048 |

## partMin — sweep: shortest name part replaced on its own (letters)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 2 | 5 | 5 | 2 | 41 | 2992 |
| 3 ◀ | 5 | 5 | 2 | 41 | 2964 |
| 4 | 11 | 5 | 1 | 41 | 3020 |

## wordyLen — sweep: parts up to this length count as words (standalone only, review)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 1 | 5 | 5 | 2 | 41 | 3103 |
| 2 ◀ | 5 | 5 | 2 | 41 | 2952 |
| 3 | 6 | 5 | 2 | 41 | 3131 |

## sweepMin — sweep: shortest whole replaced value rescanned (letters)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 3 | 5 | 5 | 2 | 41 | 2955 |
| 4 ◀ | 5 | 5 | 2 | 41 | 3036 |
| 5 | 5 | 5 | 2 | 41 | 3020 |

## shortSingle — list rules: single-word names up to this length get prefixed forms only with review

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 5 | 5 | 2 | 41 | 3051 |
| 2 | 5 | 5 | 2 | 41 | 3062 |
| 3 ◀ | 5 | 5 | 2 | 41 | 3757 |
| 4 | 5 | 5 | 2 | 41 | 3633 |

## peelMin — model output: shortest word whose first letter may be peeled as a prefix

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 3 | 5 | 5 | 2 | 41 | 3198 |
| 4 ◀ | 5 | 5 | 2 | 41 | 2960 |
| 5 | 5 | 5 | 2 | 41 | 2989 |

## discoverStem — discover: shortest prefixed word that hints at a first name

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 3 | 5 | 5 | 2 | 41 | 2967 |
| 4 ◀ | 5 | 5 | 2 | 41 | 2964 |
| 5 | 5 | 5 | 2 | 41 | 2947 |

## prefixes — list rules: prefix-letter forms generated

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 17 | 5 | 2 | 41 | 2651 |
| safe | 9 | 5 | 2 | 41 | 2699 |
| normal ◀ | 5 | 5 | 2 | 41 | 2853 |

