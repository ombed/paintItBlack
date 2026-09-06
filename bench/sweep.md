# Parameter sweep

Model on, whole corpus at every point. Generated 2026-09-06. The shipped value is marked ◀. Junk is reported, not optimised for.

## body — verb layer (bodyNames) while the model runs

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 6 | 6 | 2 | 37 | 2823 |
| on ◀ | 4 | 4 | 2 | 42 | 2760 |

## min — model confidence floor

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 0.3 | 5 | 4 | 2 | 42 | 3057 |
| 0.4 | 5 | 4 | 2 | 42 | 3654 |
| 0.5 | 5 | 4 | 2 | 42 | 2954 |
| 0.6 ◀ | 4 | 4 | 2 | 42 | 3262 |
| 0.7 | 5 | 5 | 2 | 41 | 3603 |
| 0.8 | 5 | 5 | 2 | 41 | 3449 |
| 0.9 | 11 | 11 | 2 | 41 | 3106 |

## nearLen — near-miss scan: shortest target it looks for (letters)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 3 | 4 | 4 | 2 | 44 | 3004 |
| 4 ◀ | 4 | 4 | 2 | 42 | 3326 |
| 5 | 4 | 4 | 2 | 42 | 3278 |
| 6 | 4 | 4 | 2 | 42 | 3287 |

## nearShort — near-miss scan: single-word targets up to this length need a confusable pair or a weak letter

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 4 | 4 | 2 | 42 | 3155 |
| 3 | 4 | 4 | 2 | 42 | 2962 |
| 4 ◀ | 4 | 4 | 2 | 42 | 3559 |
| 5 | 4 | 4 | 2 | 42 | 2982 |
| 6 | 4 | 4 | 2 | 42 | 2948 |
| all | 4 | 4 | 2 | 42 | 2900 |

## weak — matres lectionis: letters whose insertion or deletion counts as a typo

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| none | 4 | 4 | 2 | 42 | 2901 |
| ו י | 4 | 4 | 2 | 42 | 3007 |
| א ה ו י ◀ | 4 | 4 | 2 | 42 | 2904 |
| א ה ו י + geresh | 4 | 4 | 2 | 42 | 2899 |

## homo — confusable letter pairs (leave one out; 'none' = no pairs)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| all ◀ | 4 | 4 | 2 | 42 | 2956 |
| none | 4 | 4 | 2 | 42 | 3087 |
| without א↔ה | 4 | 4 | 2 | 42 | 3184 |
| without א↔ע | 4 | 4 | 2 | 42 | 3381 |
| without ה↔ע | 4 | 4 | 2 | 42 | 3056 |
| without א↔י | 4 | 4 | 2 | 42 | 2990 |
| without כ↔ח | 4 | 4 | 2 | 42 | 2880 |
| without ק↔כ | 4 | 4 | 2 | 42 | 2981 |
| without ת↔ט | 4 | 4 | 2 | 42 | 2847 |
| without ס↔ש | 4 | 4 | 2 | 42 | 2939 |
| without ב↔ו | 4 | 4 | 2 | 42 | 2831 |
| without ז↔צ | 4 | 4 | 2 | 42 | 2830 |
| without ו↔י | 4 | 4 | 2 | 42 | 2791 |
| without ם↔מ | 4 | 4 | 2 | 42 | 2847 |
| without ן↔נ | 4 | 4 | 2 | 42 | 2865 |
| without ך↔כ | 4 | 4 | 2 | 42 | 2901 |
| without ף↔פ | 4 | 4 | 2 | 42 | 2856 |
| without ץ↔צ | 4 | 4 | 2 | 42 | 3002 |
| without ש↔ס | 4 | 4 | 2 | 42 | 2904 |
| without ד↔ת | 4 | 4 | 2 | 42 | 2901 |
| without ג↔ק | 4 | 4 | 2 | 42 | 2971 |
| without ל↔ר | 4 | 4 | 2 | 42 | 2929 |
| without ל↔נ | 4 | 4 | 2 | 42 | 2949 |
| without נ↔ר | 4 | 4 | 2 | 42 | 2902 |
| without מ↔נ | 4 | 4 | 2 | 42 | 2963 |
| without ב↔פ | 4 | 4 | 2 | 42 | 2958 |
| without ד↔ט | 4 | 4 | 2 | 42 | 3091 |
| without ג↔כ | 4 | 4 | 2 | 42 | 2965 |

## partMin — sweep: shortest name part replaced on its own (letters)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 2 ◀ | 4 | 4 | 2 | 42 | 2883 |
| 3 | 4 | 4 | 2 | 42 | 2978 |
| 4 | 10 | 4 | 1 | 42 | 2960 |

## wordyLen — sweep: parts up to this length count as words (standalone only, review)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 1 | 4 | 4 | 3 | 42 | 3001 |
| 2 ◀ | 4 | 4 | 2 | 42 | 3088 |
| 3 | 5 | 4 | 2 | 42 | 2869 |

## sweepMin — sweep: shortest whole replaced value rescanned (letters)

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 3 | 4 | 4 | 2 | 42 | 2890 |
| 4 ◀ | 4 | 4 | 2 | 42 | 3081 |
| 5 | 4 | 4 | 2 | 42 | 3075 |

## shortSingle — list rules: single-word names up to this length get prefixed forms only with review

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 4 | 4 | 2 | 42 | 3014 |
| 2 | 4 | 4 | 2 | 42 | 2985 |
| 3 ◀ | 4 | 4 | 2 | 42 | 3069 |
| 4 | 4 | 4 | 2 | 42 | 3590 |

## peelMin — model output: shortest word whose first letter may be peeled as a prefix

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 3 | 4 | 4 | 2 | 42 | 3169 |
| 4 ◀ | 4 | 4 | 2 | 42 | 3045 |
| 5 | 4 | 4 | 2 | 42 | 3190 |

## discoverStem — discover: shortest prefixed word that hints at a first name

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| 3 | 4 | 4 | 2 | 42 | 2948 |
| 4 ◀ | 4 | 4 | 2 | 42 | 2905 |
| 5 | 4 | 4 | 2 | 42 | 3022 |

## prefixes — list rules: prefix-letter forms generated

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 16 | 4 | 2 | 42 | 2677 |
| safe | 8 | 4 | 2 | 42 | 2837 |
| normal ◀ | 4 | 4 | 2 | 42 | 2703 |

