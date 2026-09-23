| Model | Chunks | Tokens with another label than Node | Largest score gap | Found browser / Node | Leaked browser / Node | Entities that differ | Rule 5 | ms per 1k words (vs today) | Peak MB (vs today) | Load ms |
|---|---|---|---|---|---|---|---|---|---|---|
| base-q8 | 43 | 13 of 4816 | 3.8e-1 | 261 / 262 | 9 / 7 | 3 | baseline | 10985 (1.00×) | 1735 (1.00×) | 6069 |
| base-q8-ft | 43 | 6 of 4805 | 2.8e-1 | 264 / 264 | 5 / 5 | 0 | PASS | 11160 (1.02×) | 1874 (1.08×) | 5548 |
| parse-base-ft | 43 | 15 of 4805 | 3.8e-1 | 265 / 265 | 3 / 3 | 0 | PASS | 11100 (1.01×) | 1871 (1.08×) | 5773 |
