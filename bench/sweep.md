# Parameter sweep

Model off, whole corpus at every point. Generated 2026-09-06. The shipped value is marked ◀. Junk is reported, not optimised for.

## nearShort — near-miss scan: single-word targets up to this length need a confusable pair or a weak letter

| value | leaks | missed | fp | junk | ms |
|---|---|---|---|---|---|
| off | 75 | 59 | 5 | 23 | 901 |
| 3 | 75 | 59 | 5 | 23 | 543 |
| 4 ◀ | 75 | 59 | 5 | 23 | 521 |
| 5 | 75 | 59 | 5 | 23 | 553 |
| 6 | 75 | 59 | 5 | 23 | 749 |
| all | 75 | 59 | 5 | 23 | 728 |

