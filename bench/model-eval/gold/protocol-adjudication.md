# `tests/protocol.txt`: adjudication of the blind key

The key in `protocol.json` was built from two independent blind passes (A and B, in
`bench/model-eval/out/protocol-annot-{A,B}.json`), both made before any model output was
seen. Every disagreement was then decided by reading the text against the guidelines in
PLAN.md 4.2. No model output was read at any step, the adjudication included.

## Text and offsets

- `text` is `tests/protocol.txt` with CRLF turned into LF: 7,983 characters, sha256
  `dcbceb5d8073e8545081d3f105a8f6b3d72d90e392e9b75004d7c09d27a27631`. That is the committed
  file. A Windows working copy is CRLF, so read the text from the key, not from the file.
- A keyed on the LF text; B keyed on the CRLF working copy. B's offsets were moved onto the
  LF text before comparing. After that, all 265 spans in both passes matched their surface
  exactly.
- Every span in the key was checked with `text.slice(s, e)`. The key was also scored against
  itself with `score-spans.js` (133/133 under `word-exact` and `overlap-typed`).

## Agreement (before adjudication)

| Measure | Value |
|---|---|
| Mentions, A / B | 132 / 133 |
| Exact span, same type | 121 (pairwise F1 0.913) |
| Exact span, any type | 121 |
| Overlap, same type (one-to-one) | 132 |
| Overlap, any type (one-to-one) | 132 (pairwise F1 0.996) |
| Words (1,410), label per word (PER/ORG/PLACE/O): raw agreement, Cohen's kappa | 0.989, κ 0.968 |
| Words, entity or not: raw agreement, Cohen's kappa | 0.989, κ 0.965 |
| `public` flag on the 50 ORG pairs matched by overlap | 46 agree, κ 0.840 |

- There were no type disagreements at all. Every overlapping pair had the same type.
- All 11 exact-span disagreements are about **where a span starts or ends**, never about
  whether there is an entity. There are three kinds:
  - the definite article (3 mentions);
  - the article after a conjunction (1);
  - a type word or tagline (7).
- The only mention keyed by one pass and not the other is B's university department (#15).
- Word-level kappa does not see prefix differences, because a prefix letter is inside the same
  word. The word-level differences come from the type words, the tagline and #15.
- Span F1 is the usual inter-annotator measure for span tasks. Cohen's kappa needs a count of
  agreed negatives, which span sets do not have, so it is given per word.

## Decisions

"A" and "B" give each pass's span, with the prefix it recorded in brackets. The public flag
is shown as `pub`.

| # | Surface in text | A | B | Decision | Reason |
|---|---|---|---|---|---|
| 1 | הוועדה המיוחדת לזכויות הילד (title line) | וועדה המיוחדת לזכויות הילד [ה] pub | הוועדה המיוחדת לזכויות הילד pub | **A** | A prefix letter is left out (4.2), and the article ה is one of them. Both passes already agreed on בוועדה למלחמה בעוני → וועדה…, בוועדת חוקה → וועדת חוקה and הסיירת מטכ"ל → סיירת מטכ"ל [ה]. So the same committee must not start one letter earlier when the article is written out. With one rule, a model that cuts the article is not scored against a model that keeps it. |
| 2 | הוועדה לזכויות הילד (line 2) | וועדה לזכויות הילד [ה] pub | הוועדה לזכויות הילד pub | **A** | Same as #1. |
| 3 | עמותת "אור שלום" (invitee list, טלי חלף) | עמותת "אור שלום" | אור שלום | **B** | The body's name is אור שלום. The quotes mark it, and the speakers use it alone: באור שלום, "ארבע עמותות – אור שלום, מט"ב…". עמותת is a type word, like a title, and is left out. This is unlike מכון סאמיט, where מכון is always said with the name and both passes kept it. |
| 4 | עמותת "אור שלום" (עמית דור) | עמותת "אור שלום" | אור שלום | **B** | Same as #3. |
| 5 | עמותת "אור שלום" (דלית וולברג) | עמותת "אור שלום" | אור שלום | **B** | Same as #3. |
| 6 | שחר - שירותי חברה רווחה משפחה (הלל שר) | the whole line | שחר | **B** | The name is שחר. The text calls it just שחר twice (מכון סאמיט, עמותת אור שלום ושחר; מכון סאמיט ושחר), and both passes keyed those as ORG. The words after the dash describe what it does. |
| 7 | שחר - שירותי חברה רווחה משפחה (עדינה שר) | the whole line | שחר | **B** | Same as #6. |
| 8 | במרכז למניעת אלימות במשפחה | מרכז למניעת אלימות במשפחה [ב] pub | same span, not pub | **A (public)** | These centres are a welfare-ministry service run by local social-services departments. They are the same kind of body as מחלקה לשירותים חברתיים and אגף הרווחה, which both passes marked public. The name is generic and not a private organisation. Borderline. |
| 9 | אוניברסיטת בן גוריון בנגב (invitee list) | not pub | pub | **A (not public)** | A "public body" here means an organ of the state or of local government: ministries and their units, the Knesset and its committees, government committees, municipalities and regional councils, the army. A university is an independent corporation, even when publicly funded. The product treats it the same way: `PUBLIC_ORG` in `engine/06-model.js` leaves universities out and gives them a pseudonym ("מוסד אקדמי"). |
| 10 | והמוקד לביטחון תזונתי | מוקד לביטחון תזונתי [וה] | המוקד לביטחון תזונתי [ו] | **A** | Same rule as #1. ו is a conjunction and ה is the article, and both are prefix letters. |
| 11 | הוועדה המיוחדת לזכויות הילד (opening speech) | וועדה המיוחדת לזכויות הילד [ה] pub | הוועדה המיוחדת לזכויות הילד pub | **A** | Same as #1. |
| 12 | עמותת אור שלום (the chair's list) | עמותת אור שלום | אור שלום | **B** | Same as #3. |
| 13 | לקופת חולים מכבי | קופת חולים מכבי [ל], not pub | same span [ל], pub | **A (not public)** | A health fund is a statutory non-profit, not a government organ (see #9). The product gives it a pseudonym too ("מוסד רפואי"). |
| 14 | עמותת אור שלום (דלית וולברג's speech) | עמותת אור שלום | אור שלום | **B** | Same as #3. |
| 15 | במחלקה לעבודה סוציאלית באוניברסיטת בן גוריון | not keyed (A treats it as generic) | מחלקה לעבודה סוציאלית [ב] pub | **Keyed, ORG, not public** | This is one particular department, the one at Ben-Gurion University. It is the same kind of mention as the named units both passes keyed: באגף לטיפול באדם עם מוגבלות שכלית, מחלקה לשירותים חברתיים, המוקד לביטחון תזונתי. It is not public, because it is part of a university (#9). |
| 16 | באוניברסיטת בן גוריון (נעמה לוין's speech) | not pub [ב] | pub [ב] | **A (not public)** | Same as #9. |

## The key

133 mentions: 71 PER, 51 ORG (24 of them `public: true`), 11 PLACE. Each mention is
`{s, e, type}`, plus:

- `public: true` on public bodies;
- `prefix` holding the prefix letters left outside the span, when there are any.

There is no `must` field. That field belongs to our own sets (FORMATS.md). So every mention
counts as gold for reading scores, and public bodies are counted like any other ORG.

The rules the key follows, as agreed by both passes or decided above:

- Titles and role words are outside the span.
- Every prefix letter, the article included, is outside the span and recorded.
- A ה that belongs to the name stays in (הרצלייה).
- Spans are flat. A body named after a place or person is one ORG (עיריית בת ים, לשכת נווה
  יעקב, ועדת סילמן).
- A first name used alone is PER.
- Nationality adjectives are not keyed.
- Generic references are not keyed: הוועדה, המשרד, הצבא, הבנק, שירותי הרווחה.

Before the key is used, the owner spot-checks 20% of it (PLAN.md 4.2). The borderline calls
to check first are #8 and #15, then שלוותה (keyed PLACE as a hospital; ORG is also a
defensible reading) and סיירת מטכ"ל (keyed ORG public, used as a metaphor).
