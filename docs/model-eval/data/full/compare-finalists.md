# Model comparison

Baseline `base-q8`. Finalists: `parse-base-ft`, `joint-base-ft`; intervals at 97.5% (paired bootstrap, 2000 resamples, seed 1).

## 1. The rule (PLAN.md section 1)

| Rule | aleph | base-q8-ft | golem | iahlt-base | iahlt-base-ft | joint-base | joint-base-ft | large-q8 | large-q8-ft | msperka-dicta | msperka-dicta-ft | parse-base | parse-base-ft | tiny-parse | tiny-parse-ft |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Harness health | FAIL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1. No new leaks | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 2. Real benefit | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PASS | PENDING | PENDING | PENDING | PENDING | PENDING | PASS | PENDING | PENDING |
|   2a. Better reading | n/a | n/a | n/a | n/a | n/a | n/a | PASS | n/a | n/a | n/a | n/a | n/a | PASS | n/a | n/a |
|   2b. Her time | PENDING | PENDING | FAIL | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 3. Budget | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 4. Licence | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 5. Browser = Node | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| **Verdict** | **FAIL** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** |

PENDING means an input is not available yet; it is never read as a pass. A net safety gain is decided by the owner at checkpoint 3.

### `aleph`

- Health: **FAIL**: 2 prediction file(s) lose 0.5% or more of gold-entity tokens in alignment, 0.5 points or more beyond the baseline on the same set
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 2 entities the baseline finds and this model misses, 18 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.100 [0.077, 0.122], PER +0.057 [0.020, 0.089] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 127 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: Apache-2.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `base-q8-ft`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 0 entities the baseline finds and this model misses, 15 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.078 [0.060, 0.098], PER +0.053 [0.033, 0.073] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `golem`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 23 entities the baseline finds and this model misses, 11 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped -0.382 [-0.425, -0.343], PER -0.138 [-0.191, -0.086] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **FAIL**: held-out recall significantly negative on bmc-test1, knesset-ud, nemo-test, protocol, the pooled held-out sets
- Rule 3: **PENDING**: download 279 MB, amber (owner's OK and a first-run warning); browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: MIT
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `iahlt-base`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 4 entities the baseline finds and this model misses, 15 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.028 [0.005, 0.052], PER +0.010 [-0.023, 0.044] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `iahlt-base-ft`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 2 entities the baseline finds and this model misses, 15 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.037 [0.011, 0.062], PER +0.019 [-0.013, 0.052] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `joint-base`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 5 entities the baseline finds and this model misses, 13 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.076 [0.057, 0.096], PER +0.050 [0.026, 0.075] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `joint-base-ft`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 2 entities the baseline finds and this model misses, 15 the other way
- Rule 2a: **PASS**: pooled gain untyped +0.091 [0.069, 0.113], PER +0.070 [0.043, 0.096] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `large-q8`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 14 entities the baseline finds and this model misses, 13 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.005 [-0.013, 0.020], PER -0.010 [-0.035, 0.014] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 437 MB, amber (owner's OK and a first-run warning); browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `large-q8-ft`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 2 entities the baseline finds and this model misses, 16 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.066 [0.046, 0.088], PER +0.043 [0.017, 0.071] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 437 MB, amber (owner's OK and a first-run warning); browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `msperka-dicta`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 0 entities the baseline finds and this model misses, 16 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.085 [0.059, 0.109], PER +0.067 [0.038, 0.096] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `msperka-dicta-ft`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 4 entities the baseline finds and this model misses, 16 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.100 [0.075, 0.124], PER +0.076 [0.049, 0.104] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `parse-base`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 3 entities the baseline finds and this model misses, 15 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.111 [0.089, 0.133], PER +0.061 [0.035, 0.086] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `parse-base-ft`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 0 entities the baseline finds and this model misses, 15 the other way
- Rule 2a: **PASS**: pooled gain untyped +0.123 [0.100, 0.146], PER +0.073 [0.047, 0.101] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 185 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `tiny-parse`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 3 entities the baseline finds and this model misses, 15 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.098 [0.076, 0.120], PER +0.043 [0.021, 0.066] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 45 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

### `tiny-parse-ft`

- Health: **PASS**: no unmapped labels, over-long chunks or chunk errors, and no alignment loss beyond the baseline's; 8 prediction file(s) share the baseline's own loss of 0.5% or more (the engine's, reported in the health table)
- Rule 1: **PENDING**: needs the product-level runs (found/missed/leaked per must entity) and the baseline noise band; model level, raw: 3 entities the baseline finds and this model misses, 17 the other way
- Rule 2a: **n/a**: not a finalist, so not tested (PLAN.md 1.2a); pooled gain untyped +0.116 [0.090, 0.141], PER +0.058 [0.035, 0.084] at 97.5% over bmc-test1, knesset-ud, nemo-test, protocol
- Rule 2b: **PENDING**: needs the adjudicated model false positives on her documents (PLAN.md 4.4); held-out recall is not significantly negative
- Rule 3: **PENDING**: download 45 MB, green; browser scan per 1k words and peak memory come from Phase 5
- Rule 4: **PASS**: CC-BY-4.0
- Rule 5: **PENDING**: browser drift vs Node is measured in Phase 5 (baseline drift first)

## Tie-break (placeholder until the finalists are known)

Higher F2 on the cleaned output, at each model's own cut-off, pooled over the held-out sets; then smaller, then faster. Cleaned predictions on the public sets are needed for it; raw F2 is in the set tables below.

## Cut-offs (tune half, overlap untyped)

| Model | Best-F2 cut-off | F2 there | AP | <.6 correct | .6-.8 | .8-.95 | >=.95 |
|---|---|---|---|---|---|---|---|
| aleph | 0.30 | 0.926 | 0.862 | 58.8% of 17 | 46.7% of 15 | 70.6% of 17 | 91.6% of 214 |
| base-q8 | 0.30 | 0.848 | 0.766 | 100.0% of 6 | 92.3% of 13 | 88.9% of 18 | 91.6% of 179 |
| base-q8-ft | 0.30 | 0.919 | 0.852 | 100.0% of 1 | 75.0% of 12 | 100.0% of 8 | 92.2% of 218 |
| golem | 0.40 | 0.736 | 0.662 | 66.7% of 27 | 84.1% of 44 | 93.5% of 46 | 94.6% of 74 |
| iahlt-base | 0.35 | 0.882 | 0.819 | 58.3% of 12 | 81.8% of 11 | 93.1% of 29 | 93.8% of 176 |
| iahlt-base-ft | 0.30 | 0.895 | 0.836 | 63.6% of 11 | 62.5% of 8 | 93.3% of 15 | 93.9% of 198 |
| joint-base | 0.30 | 0.878 | 0.829 | 75.0% of 12 | 87.0% of 23 | 81.4% of 43 | 96.0% of 149 |
| joint-base-ft | 0.40 | 0.918 | 0.866 | 90.9% of 11 | 72.7% of 22 | 91.2% of 34 | 94.7% of 170 |
| large-q8 | 0.30 | 0.748 | 0.649 | 66.7% of 9 | 87.1% of 31 | 100.0% of 22 | 89.9% of 129 |
| large-q8-ft | 0.50 | 0.878 | 0.801 | 42.9% of 7 | 78.9% of 19 | 84.6% of 26 | 91.8% of 183 |
| msperka-dicta | 0.30 | 0.919 | 0.846 | 69.2% of 26 | 85.0% of 20 | 97.1% of 70 | 90.7% of 129 |
| msperka-dicta-ft | 0.30 | 0.921 | 0.865 | 66.7% of 18 | 58.8% of 17 | 91.2% of 34 | 93.4% of 181 |
| parse-base | 0.30 | 0.896 | 0.828 | 100.0% of 4 | 100.0% of 12 | 66.7% of 12 | 92.6% of 203 |
| parse-base-ft | 0.30 | 0.937 | 0.874 | 80.0% of 5 | 80.0% of 10 | 94.1% of 17 | 92.9% of 211 |
| tiny-parse | 0.30 | 0.880 | 0.809 | 72.7% of 11 | 79.2% of 24 | 90.0% of 20 | 91.1% of 180 |
| tiny-parse-ft | 0.30 | 0.895 | 0.816 | 90.0% of 10 | 69.2% of 13 | 95.2% of 21 | 90.2% of 194 |

## Harness health

| Set | Model | Stage | Unmapped labels | Chunks over 510 | Chunk errors | Align fails on gold-entity tokens | Node scan ms per 1k words |
|---|---|---|---|---|---|---|---|
| bmc-test1 | aleph | cleaned | 0 | 0 | 0 | 25 (1.2%) | 951 |
| bmc-test1 | aleph | raw | 0 | 0 | 0 | 25 (1.2%) | 951 |
| bmc-test1 | base-q8-ft | cleaned | 0 | 0 | 0 | 33 (1.9%) | 770 |
| bmc-test1 | base-q8-ft | raw | 0 | 0 | 0 | 33 (1.9%) | 770 |
| bmc-test1 | base-q8 | cleaned | 0 | 0 | 0 | 33 (1.9%) | 761 |
| bmc-test1 | base-q8 | raw | 0 | 0 | 0 | 33 (1.9%) | 761 |
| bmc-test1 | golem | cleaned | 0 | 0 | 0 | 0 (0.0%) | 1512 |
| bmc-test1 | golem | raw | 0 | 0 | 0 | 0 (0.0%) | 1512 |
| bmc-test1 | iahlt-base-ft | cleaned | 0 | 0 | 0 | 33 (1.9%) | 864 |
| bmc-test1 | iahlt-base-ft | raw | 0 | 0 | 0 | 33 (1.9%) | 864 |
| bmc-test1 | iahlt-base | cleaned | 0 | 0 | 0 | 33 (1.9%) | 861 |
| bmc-test1 | iahlt-base | raw | 0 | 0 | 0 | 33 (1.9%) | 861 |
| bmc-test1 | joint-base-ft | cleaned | 0 | 0 | 0 | 33 (1.9%) | 881 |
| bmc-test1 | joint-base-ft | raw | 0 | 0 | 0 | 33 (1.9%) | 881 |
| bmc-test1 | joint-base | cleaned | 0 | 0 | 0 | 33 (1.9%) | 874 |
| bmc-test1 | joint-base | raw | 0 | 0 | 0 | 33 (1.9%) | 874 |
| bmc-test1 | large-q8-ft | cleaned | 0 | 0 | 0 | 33 (1.9%) | 2824 |
| bmc-test1 | large-q8-ft | raw | 0 | 0 | 0 | 33 (1.9%) | 2824 |
| bmc-test1 | large-q8 | cleaned | 0 | 0 | 0 | 33 (1.9%) | 2829 |
| bmc-test1 | large-q8 | raw | 0 | 0 | 0 | 33 (1.9%) | 2829 |
| bmc-test1 | msperka-dicta-ft | cleaned | 0 | 0 | 0 | 33 (1.9%) | 883 |
| bmc-test1 | msperka-dicta-ft | raw | 0 | 0 | 0 | 33 (1.9%) | 883 |
| bmc-test1 | msperka-dicta | cleaned | 0 | 0 | 0 | 33 (1.9%) | 868 |
| bmc-test1 | msperka-dicta | raw | 0 | 0 | 0 | 33 (1.9%) | 868 |
| bmc-test1 | parse-base-ft | cleaned | 0 | 0 | 0 | 33 (1.9%) | 906 |
| bmc-test1 | parse-base-ft | raw | 0 | 0 | 0 | 33 (1.9%) | 906 |
| bmc-test1 | parse-base | cleaned | 0 | 0 | 0 | 33 (1.9%) | 882 |
| bmc-test1 | parse-base | raw | 0 | 0 | 0 | 33 (1.9%) | 882 |
| bmc-test1 | tiny-parse-ft | cleaned | 0 | 0 | 0 | 33 (1.9%) | 114 |
| bmc-test1 | tiny-parse-ft | raw | 0 | 0 | 0 | 33 (1.9%) | 114 |
| bmc-test1 | tiny-parse | cleaned | 0 | 0 | 0 | 33 (1.9%) | 117 |
| bmc-test1 | tiny-parse | raw | 0 | 0 | 0 | 33 (1.9%) | 117 |
| knesset-ud | aleph | cleaned | 0 | 0 | 0 | 0 (0.0%) | 815 |
| knesset-ud | aleph | raw | 0 | 0 | 0 | 0 (0.0%) | 815 |
| knesset-ud | base-q8-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 752 |
| knesset-ud | base-q8-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 752 |
| knesset-ud | base-q8 | cleaned | 0 | 0 | 0 | 0 (0.0%) | 723 |
| knesset-ud | base-q8 | raw | 0 | 0 | 0 | 0 (0.0%) | 723 |
| knesset-ud | golem | cleaned | 0 | 0 | 0 | 0 (0.0%) | 1347 |
| knesset-ud | golem | raw | 0 | 0 | 0 | 0 (0.0%) | 1347 |
| knesset-ud | iahlt-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 789 |
| knesset-ud | iahlt-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 789 |
| knesset-ud | iahlt-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 785 |
| knesset-ud | iahlt-base | raw | 0 | 0 | 0 | 0 (0.0%) | 785 |
| knesset-ud | joint-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 801 |
| knesset-ud | joint-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 801 |
| knesset-ud | joint-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 790 |
| knesset-ud | joint-base | raw | 0 | 0 | 0 | 0 (0.0%) | 790 |
| knesset-ud | large-q8-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 2752 |
| knesset-ud | large-q8-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 2752 |
| knesset-ud | large-q8 | cleaned | 0 | 0 | 0 | 0 (0.0%) | 2708 |
| knesset-ud | large-q8 | raw | 0 | 0 | 0 | 0 (0.0%) | 2708 |
| knesset-ud | msperka-dicta-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 806 |
| knesset-ud | msperka-dicta-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 806 |
| knesset-ud | msperka-dicta | cleaned | 0 | 0 | 0 | 0 (0.0%) | 768 |
| knesset-ud | msperka-dicta | raw | 0 | 0 | 0 | 0 (0.0%) | 768 |
| knesset-ud | parse-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 817 |
| knesset-ud | parse-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 817 |
| knesset-ud | parse-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 773 |
| knesset-ud | parse-base | raw | 0 | 0 | 0 | 0 (0.0%) | 773 |
| knesset-ud | tiny-parse-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 92 |
| knesset-ud | tiny-parse-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 92 |
| knesset-ud | tiny-parse | cleaned | 0 | 0 | 0 | 0 (0.0%) | 107 |
| knesset-ud | tiny-parse | raw | 0 | 0 | 0 | 0 (0.0%) | 107 |
| known-cases | aleph | cleaned | 0 | 0 | 0 | 29 (10.4%) | 864 |
| known-cases | aleph | raw | 0 | 0 | 0 | 29 (10.4%) | 864 |
| known-cases | base-q8-ft | cleaned | 0 | 0 | 0 | 22 (8.7%) | 716 |
| known-cases | base-q8-ft | raw | 0 | 0 | 0 | 22 (8.7%) | 716 |
| known-cases | base-q8 | cleaned | 0 | 0 | 0 | 22 (8.7%) | 667 |
| known-cases | base-q8 | raw | 0 | 0 | 0 | 22 (8.7%) | 667 |
| known-cases | golem | cleaned | 0 | 0 | 0 | 0 (0.0%) | 1864 |
| known-cases | golem | raw | 0 | 0 | 0 | 0 (0.0%) | 1864 |
| known-cases | iahlt-base-ft | cleaned | 0 | 0 | 0 | 22 (8.7%) | 770 |
| known-cases | iahlt-base-ft | raw | 0 | 0 | 0 | 22 (8.7%) | 770 |
| known-cases | iahlt-base | cleaned | 0 | 0 | 0 | 22 (8.7%) | 787 |
| known-cases | iahlt-base | raw | 0 | 0 | 0 | 22 (8.7%) | 787 |
| known-cases | joint-base-ft | cleaned | 0 | 0 | 0 | 22 (8.7%) | 785 |
| known-cases | joint-base-ft | raw | 0 | 0 | 0 | 22 (8.7%) | 785 |
| known-cases | joint-base | cleaned | 0 | 0 | 0 | 22 (8.7%) | 788 |
| known-cases | joint-base | raw | 0 | 0 | 0 | 22 (8.7%) | 788 |
| known-cases | large-q8-ft | cleaned | 0 | 0 | 0 | 22 (8.7%) | 3533 |
| known-cases | large-q8-ft | raw | 0 | 0 | 0 | 22 (8.7%) | 3533 |
| known-cases | large-q8 | cleaned | 0 | 0 | 0 | 22 (8.7%) | 3289 |
| known-cases | large-q8 | raw | 0 | 0 | 0 | 22 (8.7%) | 3289 |
| known-cases | msperka-dicta-ft | cleaned | 0 | 0 | 0 | 22 (8.7%) | 778 |
| known-cases | msperka-dicta-ft | raw | 0 | 0 | 0 | 22 (8.7%) | 778 |
| known-cases | msperka-dicta | cleaned | 0 | 0 | 0 | 22 (8.7%) | 821 |
| known-cases | msperka-dicta | raw | 0 | 0 | 0 | 22 (8.7%) | 821 |
| known-cases | parse-base-ft | cleaned | 0 | 0 | 0 | 22 (8.7%) | 790 |
| known-cases | parse-base-ft | raw | 0 | 0 | 0 | 22 (8.7%) | 790 |
| known-cases | parse-base | cleaned | 0 | 0 | 0 | 22 (8.7%) | 803 |
| known-cases | parse-base | raw | 0 | 0 | 0 | 22 (8.7%) | 803 |
| known-cases | tiny-parse-ft | cleaned | 0 | 0 | 0 | 22 (8.7%) | 216 |
| known-cases | tiny-parse-ft | raw | 0 | 0 | 0 | 22 (8.7%) | 216 |
| known-cases | tiny-parse | cleaned | 0 | 0 | 0 | 22 (8.7%) | 162 |
| known-cases | tiny-parse | raw | 0 | 0 | 0 | 22 (8.7%) | 162 |
| nemo-test | aleph | cleaned | 0 | 0 | 0 | 0 (0.0%) | 1010 |
| nemo-test | aleph | raw | 0 | 0 | 0 | 0 (0.0%) | 1010 |
| nemo-test | base-q8-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 717 |
| nemo-test | base-q8-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 717 |
| nemo-test | base-q8 | cleaned | 0 | 0 | 0 | 0 (0.0%) | 777 |
| nemo-test | base-q8 | raw | 0 | 0 | 0 | 0 (0.0%) | 777 |
| nemo-test | golem | cleaned | 0 | 0 | 0 | 0 (0.0%) | 1566 |
| nemo-test | golem | raw | 0 | 0 | 0 | 0 (0.0%) | 1566 |
| nemo-test | iahlt-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 882 |
| nemo-test | iahlt-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 882 |
| nemo-test | iahlt-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 868 |
| nemo-test | iahlt-base | raw | 0 | 0 | 0 | 0 (0.0%) | 868 |
| nemo-test | joint-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 901 |
| nemo-test | joint-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 901 |
| nemo-test | joint-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 914 |
| nemo-test | joint-base | raw | 0 | 0 | 0 | 0 (0.0%) | 914 |
| nemo-test | large-q8-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 2885 |
| nemo-test | large-q8-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 2885 |
| nemo-test | large-q8 | cleaned | 0 | 0 | 0 | 0 (0.0%) | 2923 |
| nemo-test | large-q8 | raw | 0 | 0 | 0 | 0 (0.0%) | 2923 |
| nemo-test | msperka-dicta-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 879 |
| nemo-test | msperka-dicta-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 879 |
| nemo-test | msperka-dicta | cleaned | 0 | 0 | 0 | 0 (0.0%) | 889 |
| nemo-test | msperka-dicta | raw | 0 | 0 | 0 | 0 (0.0%) | 889 |
| nemo-test | parse-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 941 |
| nemo-test | parse-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 941 |
| nemo-test | parse-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 914 |
| nemo-test | parse-base | raw | 0 | 0 | 0 | 0 (0.0%) | 914 |
| nemo-test | tiny-parse-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 119 |
| nemo-test | tiny-parse-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 119 |
| nemo-test | tiny-parse | cleaned | 0 | 0 | 0 | 0 (0.0%) | 196 |
| nemo-test | tiny-parse | raw | 0 | 0 | 0 | 0 (0.0%) | 196 |
| protocol | aleph | cleaned | 0 | 0 | 0 | 0 (0.0%) | 634 |
| protocol | aleph | raw | 0 | 0 | 0 | 0 (0.0%) | 634 |
| protocol | base-q8-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 492 |
| protocol | base-q8-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 492 |
| protocol | base-q8 | cleaned | 0 | 0 | 0 | 0 (0.0%) | 443 |
| protocol | base-q8 | raw | 0 | 0 | 0 | 0 (0.0%) | 443 |
| protocol | golem | cleaned | 0 | 0 | 0 | 0 (0.0%) | 1161 |
| protocol | golem | raw | 0 | 0 | 0 | 0 (0.0%) | 1161 |
| protocol | iahlt-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 565 |
| protocol | iahlt-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 565 |
| protocol | iahlt-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 548 |
| protocol | iahlt-base | raw | 0 | 0 | 0 | 0 (0.0%) | 548 |
| protocol | joint-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 559 |
| protocol | joint-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 559 |
| protocol | joint-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 581 |
| protocol | joint-base | raw | 0 | 0 | 0 | 0 (0.0%) | 581 |
| protocol | large-q8-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 2680 |
| protocol | large-q8-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 2680 |
| protocol | large-q8 | cleaned | 0 | 0 | 0 | 0 (0.0%) | 2534 |
| protocol | large-q8 | raw | 0 | 0 | 0 | 0 (0.0%) | 2534 |
| protocol | msperka-dicta-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 566 |
| protocol | msperka-dicta-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 566 |
| protocol | msperka-dicta | cleaned | 0 | 0 | 0 | 0 (0.0%) | 569 |
| protocol | msperka-dicta | raw | 0 | 0 | 0 | 0 (0.0%) | 569 |
| protocol | parse-base-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 587 |
| protocol | parse-base-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 587 |
| protocol | parse-base | cleaned | 0 | 0 | 0 | 0 (0.0%) | 580 |
| protocol | parse-base | raw | 0 | 0 | 0 | 0 (0.0%) | 580 |
| protocol | tiny-parse-ft | cleaned | 0 | 0 | 0 | 0 (0.0%) | 155 |
| protocol | tiny-parse-ft | raw | 0 | 0 | 0 | 0 (0.0%) | 155 |
| protocol | tiny-parse | cleaned | 0 | 0 | 0 | 0 (0.0%) | 227 |
| protocol | tiny-parse | raw | 0 | 0 | 0 | 0 (0.0%) | 227 |
| synthetic-test | aleph | cleaned | 0 | 0 | 0 | 2 (0.4%) | 753 |
| synthetic-test | aleph | raw | 0 | 0 | 0 | 2 (0.4%) | 753 |
| synthetic-test | base-q8-ft | cleaned | 0 | 0 | 0 | 7 (1.4%) | 643 |
| synthetic-test | base-q8-ft | raw | 0 | 0 | 0 | 7 (1.4%) | 643 |
| synthetic-test | base-q8 | cleaned | 0 | 0 | 0 | 7 (1.4%) | 500 |
| synthetic-test | base-q8 | raw | 0 | 0 | 0 | 7 (1.4%) | 500 |
| synthetic-test | golem | cleaned | 0 | 0 | 0 | 0 (0.0%) | 1415 |
| synthetic-test | golem | raw | 0 | 0 | 0 | 0 (0.0%) | 1415 |
| synthetic-test | iahlt-base-ft | cleaned | 0 | 0 | 0 | 7 (1.4%) | 734 |
| synthetic-test | iahlt-base-ft | raw | 0 | 0 | 0 | 7 (1.4%) | 734 |
| synthetic-test | iahlt-base | cleaned | 0 | 0 | 0 | 7 (1.4%) | 668 |
| synthetic-test | iahlt-base | raw | 0 | 0 | 0 | 7 (1.4%) | 668 |
| synthetic-test | joint-base-ft | cleaned | 0 | 0 | 0 | 7 (1.4%) | 730 |
| synthetic-test | joint-base-ft | raw | 0 | 0 | 0 | 7 (1.4%) | 730 |
| synthetic-test | joint-base | cleaned | 0 | 0 | 0 | 7 (1.4%) | 701 |
| synthetic-test | joint-base | raw | 0 | 0 | 0 | 7 (1.4%) | 701 |
| synthetic-test | large-q8-ft | cleaned | 0 | 0 | 0 | 7 (1.4%) | 3151 |
| synthetic-test | large-q8-ft | raw | 0 | 0 | 0 | 7 (1.4%) | 3151 |
| synthetic-test | large-q8 | cleaned | 0 | 0 | 0 | 7 (1.4%) | 3121 |
| synthetic-test | large-q8 | raw | 0 | 0 | 0 | 7 (1.4%) | 3121 |
| synthetic-test | msperka-dicta-ft | cleaned | 0 | 0 | 0 | 7 (1.4%) | 670 |
| synthetic-test | msperka-dicta-ft | raw | 0 | 0 | 0 | 7 (1.4%) | 670 |
| synthetic-test | msperka-dicta | cleaned | 0 | 0 | 0 | 7 (1.4%) | 687 |
| synthetic-test | msperka-dicta | raw | 0 | 0 | 0 | 7 (1.4%) | 687 |
| synthetic-test | parse-base-ft | cleaned | 0 | 0 | 0 | 7 (1.4%) | 752 |
| synthetic-test | parse-base-ft | raw | 0 | 0 | 0 | 7 (1.4%) | 752 |
| synthetic-test | parse-base | cleaned | 0 | 0 | 0 | 7 (1.4%) | 705 |
| synthetic-test | parse-base | raw | 0 | 0 | 0 | 7 (1.4%) | 705 |
| synthetic-test | tiny-parse-ft | cleaned | 0 | 0 | 0 | 7 (1.4%) | 128 |
| synthetic-test | tiny-parse-ft | raw | 0 | 0 | 0 | 7 (1.4%) | 128 |
| synthetic-test | tiny-parse | cleaned | 0 | 0 | 0 | 7 (1.4%) | 147 |
| synthetic-test | tiny-parse | raw | 0 | 0 | 0 | 7 (1.4%) | 147 |
| synthetic-tune | aleph | cleaned | 0 | 0 | 0 | 9 (1.4%) | 756 |
| synthetic-tune | aleph | raw | 0 | 0 | 0 | 9 (1.4%) | 756 |
| synthetic-tune | base-q8-ft | cleaned | 0 | 0 | 0 | 8 (1.4%) | 787 |
| synthetic-tune | base-q8-ft | raw | 0 | 0 | 0 | 8 (1.4%) | 787 |
| synthetic-tune | base-q8 | cleaned | 0 | 0 | 0 | 8 (1.4%) | 506 |
| synthetic-tune | base-q8 | raw | 0 | 0 | 0 | 8 (1.4%) | 506 |
| synthetic-tune | golem | cleaned | 0 | 0 | 0 | 0 (0.0%) | 1469 |
| synthetic-tune | golem | raw | 0 | 0 | 0 | 0 (0.0%) | 1469 |
| synthetic-tune | iahlt-base-ft | cleaned | 0 | 0 | 0 | 8 (1.4%) | 851 |
| synthetic-tune | iahlt-base-ft | raw | 0 | 0 | 0 | 8 (1.4%) | 851 |
| synthetic-tune | iahlt-base | cleaned | 0 | 0 | 0 | 8 (1.4%) | 705 |
| synthetic-tune | iahlt-base | raw | 0 | 0 | 0 | 8 (1.4%) | 705 |
| synthetic-tune | joint-base-ft | cleaned | 0 | 0 | 0 | 8 (1.4%) | 823 |
| synthetic-tune | joint-base-ft | raw | 0 | 0 | 0 | 8 (1.4%) | 823 |
| synthetic-tune | joint-base | cleaned | 0 | 0 | 0 | 8 (1.4%) | 705 |
| synthetic-tune | joint-base | raw | 0 | 0 | 0 | 8 (1.4%) | 705 |
| synthetic-tune | large-q8-ft | cleaned | 0 | 0 | 0 | 8 (1.4%) | 3233 |
| synthetic-tune | large-q8-ft | raw | 0 | 0 | 0 | 8 (1.4%) | 3233 |
| synthetic-tune | large-q8 | cleaned | 0 | 0 | 0 | 8 (1.4%) | 3157 |
| synthetic-tune | large-q8 | raw | 0 | 0 | 0 | 8 (1.4%) | 3157 |
| synthetic-tune | msperka-dicta-ft | cleaned | 0 | 0 | 0 | 8 (1.4%) | 813 |
| synthetic-tune | msperka-dicta-ft | raw | 0 | 0 | 0 | 8 (1.4%) | 813 |
| synthetic-tune | msperka-dicta | cleaned | 0 | 0 | 0 | 8 (1.4%) | 691 |
| synthetic-tune | msperka-dicta | raw | 0 | 0 | 0 | 8 (1.4%) | 691 |
| synthetic-tune | parse-base-ft | cleaned | 0 | 0 | 0 | 8 (1.4%) | 869 |
| synthetic-tune | parse-base-ft | raw | 0 | 0 | 0 | 8 (1.4%) | 869 |
| synthetic-tune | parse-base | cleaned | 0 | 0 | 0 | 8 (1.4%) | 703 |
| synthetic-tune | parse-base | raw | 0 | 0 | 0 | 8 (1.4%) | 703 |
| synthetic-tune | tiny-parse-ft | cleaned | 0 | 0 | 0 | 8 (1.4%) | 232 |
| synthetic-tune | tiny-parse-ft | raw | 0 | 0 | 0 | 8 (1.4%) | 232 |
| synthetic-tune | tiny-parse | cleaned | 0 | 0 | 0 | 8 (1.4%) | 223 |
| synthetic-tune | tiny-parse | raw | 0 | 0 | 0 | 8 (1.4%) | 223 |

## bmc-test1 (held out)

42 documents; licence none stated; contamination: hebert.

Overlap untyped unless named. Lost/gained: must entities the baseline finds and this row misses, and the other way.

| Model | Stage | Cut-off | Gold | TP | FP | FN | P | R | R 95% | F1 | F2 | PER R | Word-exact F1 | Entity R | Traps hit | Added R | Lost / gained | R gain vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aleph | cleaned | – | 964 | 762 | 90 | 202 | 0.894 | 0.790 | [0.770, 0.812] | 0.839 | 0.809 | 0.920 | 0.757 | 0.790 | – | – | 39 / 92 | +0.055 [0.026, 0.083] |
| aleph | raw | 0.30 tune | 964 | 905 | 193 | 59 | 0.824 | 0.939 | [0.922, 0.953] | 0.878 | 0.913 | 0.952 | 0.785 | 0.939 | – | – | 19 / 114 | +0.099 [0.071, 0.126] |
| base-q8-ft | cleaned | – | 964 | 762 | 44 | 202 | 0.945 | 0.790 | [0.765, 0.815] | 0.861 | 0.817 | 0.909 | 0.793 | 0.790 | – | – | 10 / 63 | +0.055 [0.032, 0.078] |
| base-q8-ft | raw | 0.30 tune | 964 | 880 | 52 | 84 | 0.944 | 0.913 | [0.895, 0.931] | 0.928 | 0.919 | 0.928 | 0.851 | 0.913 | – | – | 4 / 74 | +0.073 [0.052, 0.093] |
| base-q8 | cleaned | – | 964 | 709 | 37 | 255 | 0.950 | 0.735 | [0.709, 0.761] | 0.829 | 0.770 | 0.853 | 0.754 | 0.735 | – | – | – | – |
| base-q8 | raw | 0.60 shipped | 964 | 810 | 37 | 154 | 0.956 | 0.840 | [0.817, 0.864] | 0.895 | 0.861 | 0.871 | 0.809 | 0.840 | – | – | – | – |
| base-q8 | raw | 0.30 tune | 964 | 836 | 47 | 128 | 0.947 | 0.867 | [0.845, 0.889] | 0.905 | 0.882 | 0.882 | 0.815 | 0.867 | – | – | – | – |
| golem | cleaned | – | 964 | 382 | 57 | 582 | 0.870 | 0.396 | [0.367, 0.427] | 0.545 | 0.445 | 0.673 | 0.366 | 0.396 | – | – | 377 / 50 | -0.339 [-0.386, -0.293] |
| golem | raw | 0.40 tune | 964 | 454 | 99 | 510 | 0.821 | 0.471 | [0.440, 0.504] | 0.599 | 0.515 | 0.756 | 0.382 | 0.471 | – | – | 408 / 52 | -0.369 [-0.413, -0.330] |
| iahlt-base-ft | cleaned | – | 964 | 715 | 44 | 249 | 0.942 | 0.742 | [0.711, 0.772] | 0.830 | 0.775 | 0.887 | 0.732 | 0.742 | – | – | 58 / 64 | +0.006 [-0.024, 0.036] |
| iahlt-base-ft | raw | 0.30 tune | 964 | 850 | 61 | 114 | 0.933 | 0.882 | [0.858, 0.903] | 0.907 | 0.892 | 0.925 | 0.796 | 0.882 | – | – | 42 / 82 | +0.041 [0.013, 0.070] |
| iahlt-base | cleaned | – | 964 | 706 | 47 | 258 | 0.938 | 0.732 | [0.706, 0.758] | 0.822 | 0.766 | 0.879 | 0.722 | 0.732 | – | – | 64 / 61 | -0.003 [-0.031, 0.026] |
| iahlt-base | raw | 0.35 tune | 964 | 841 | 61 | 123 | 0.932 | 0.872 | [0.849, 0.894] | 0.901 | 0.884 | 0.914 | 0.788 | 0.872 | – | – | 47 / 78 | +0.032 [0.005, 0.060] |
| joint-base-ft | cleaned | – | 964 | 765 | 45 | 199 | 0.944 | 0.794 | [0.766, 0.820] | 0.862 | 0.820 | 0.920 | 0.793 | 0.794 | – | – | 22 / 78 | +0.058 [0.031, 0.085] |
| joint-base-ft | raw | 0.40 tune | 964 | 894 | 69 | 70 | 0.928 | 0.927 | [0.906, 0.947] | 0.928 | 0.928 | 0.946 | 0.855 | 0.927 | – | – | 9 / 93 | +0.087 [0.062, 0.113] |
| joint-base | cleaned | – | 964 | 752 | 41 | 212 | 0.948 | 0.780 | [0.755, 0.803] | 0.856 | 0.809 | 0.890 | 0.772 | 0.780 | – | – | 25 / 68 | +0.045 [0.025, 0.067] |
| joint-base | raw | 0.30 tune | 964 | 889 | 59 | 75 | 0.938 | 0.922 | [0.900, 0.941] | 0.930 | 0.925 | 0.920 | 0.833 | 0.922 | – | – | 8 / 87 | +0.082 [0.061, 0.105] |
| large-q8-ft | cleaned | – | 964 | 749 | 53 | 215 | 0.934 | 0.777 | [0.753, 0.800] | 0.848 | 0.804 | 0.903 | 0.768 | 0.777 | – | – | 30 / 70 | +0.041 [0.014, 0.069] |
| large-q8-ft | raw | 0.50 tune | 964 | 866 | 71 | 98 | 0.924 | 0.898 | [0.877, 0.918] | 0.911 | 0.903 | 0.920 | 0.819 | 0.898 | – | – | 23 / 79 | +0.058 [0.032, 0.084] |
| large-q8 | cleaned | – | 964 | 678 | 37 | 286 | 0.948 | 0.703 | [0.676, 0.729] | 0.808 | 0.742 | 0.823 | 0.731 | 0.703 | – | – | 75 / 44 | -0.032 [-0.059, -0.006] |
| large-q8 | raw | 0.30 tune | 964 | 809 | 48 | 155 | 0.944 | 0.839 | [0.811, 0.865] | 0.889 | 0.858 | 0.850 | 0.789 | 0.839 | – | – | 54 / 53 | -0.001 [-0.027, 0.023] |
| msperka-dicta-ft | cleaned | – | 964 | 757 | 63 | 207 | 0.923 | 0.785 | [0.759, 0.809] | 0.849 | 0.809 | 0.928 | 0.794 | 0.785 | – | – | 48 / 96 | +0.050 [0.024, 0.076] |
| msperka-dicta-ft | raw | 0.30 tune | 964 | 917 | 105 | 47 | 0.897 | 0.951 | [0.931, 0.968] | 0.923 | 0.940 | 0.960 | 0.856 | 0.951 | – | – | 15 / 122 | +0.111 [0.085, 0.137] |
| msperka-dicta | cleaned | – | 964 | 738 | 54 | 226 | 0.932 | 0.766 | [0.741, 0.789] | 0.841 | 0.794 | 0.928 | 0.792 | 0.766 | – | – | 60 / 89 | +0.030 [0.006, 0.055] |
| msperka-dicta | raw | 0.30 tune | 964 | 907 | 97 | 57 | 0.903 | 0.941 | [0.922, 0.957] | 0.922 | 0.933 | 0.957 | 0.846 | 0.941 | – | – | 20 / 117 | +0.101 [0.075, 0.129] |
| parse-base-ft | cleaned | – | 964 | 804 | 67 | 160 | 0.923 | 0.834 | [0.812, 0.857] | 0.876 | 0.850 | 0.928 | 0.807 | 0.834 | – | – | 6 / 101 | +0.099 [0.072, 0.126] |
| parse-base-ft | raw | 0.30 tune | 964 | 929 | 90 | 35 | 0.912 | 0.964 | [0.948, 0.977] | 0.937 | 0.953 | 0.952 | 0.868 | 0.964 | – | – | 1 / 120 | +0.123 [0.097, 0.150] |
| parse-base | cleaned | – | 964 | 787 | 64 | 177 | 0.925 | 0.816 | [0.793, 0.839] | 0.867 | 0.836 | 0.898 | 0.786 | 0.816 | – | – | 13 / 91 | +0.081 [0.056, 0.106] |
| parse-base | raw | 0.30 tune | 964 | 920 | 78 | 44 | 0.922 | 0.954 | [0.937, 0.969] | 0.938 | 0.948 | 0.933 | 0.849 | 0.954 | – | – | 3 / 113 | +0.114 [0.090, 0.139] |
| tiny-parse-ft | cleaned | – | 964 | 772 | 74 | 192 | 0.913 | 0.801 | [0.776, 0.824] | 0.853 | 0.821 | 0.914 | 0.777 | 0.801 | – | – | 25 / 88 | +0.065 [0.041, 0.090] |
| tiny-parse-ft | raw | 0.30 tune | 964 | 903 | 116 | 61 | 0.886 | 0.937 | [0.916, 0.954] | 0.911 | 0.926 | 0.946 | 0.818 | 0.937 | – | – | 13 / 106 | +0.096 [0.069, 0.124] |
| tiny-parse | cleaned | – | 964 | 759 | 81 | 205 | 0.904 | 0.787 | [0.763, 0.810] | 0.841 | 0.808 | 0.901 | 0.758 | 0.787 | – | – | 31 / 81 | +0.052 [0.026, 0.076] |
| tiny-parse | raw | 0.30 tune | 964 | 890 | 110 | 74 | 0.890 | 0.923 | [0.902, 0.942] | 0.906 | 0.916 | 0.928 | 0.808 | 0.923 | – | – | 17 / 97 | +0.083 [0.058, 0.108] |

Per type, overlap typed (P / R / F2):

| Model | Stage | Cut-off | PER | ORG | PLACE |
|---|---|---|---|---|---|
| aleph | cleaned | – | 0.953 / 0.920 / 0.926 (n 373) | 0.721 / 0.568 / 0.593 (n 273) | 0.859 / 0.748 / 0.768 (n 318) |
| aleph | raw | 0.30 | 0.917 / 0.952 / 0.945 (n 373) | 0.623 / 0.824 / 0.774 (n 273) | 0.814 / 0.896 / 0.879 (n 318) |
| base-q8-ft | cleaned | – | 0.971 / 0.909 / 0.921 (n 373) | 0.804 / 0.527 / 0.566 (n 273) | 0.899 / 0.786 / 0.806 (n 318) |
| base-q8-ft | raw | 0.30 | 0.961 / 0.928 / 0.934 (n 373) | 0.827 / 0.755 / 0.768 (n 273) | 0.895 / 0.909 / 0.906 (n 318) |
| base-q8 | cleaned | – | 0.978 / 0.853 / 0.875 (n 373) | 0.786 / 0.458 / 0.500 (n 273) | 0.905 / 0.745 / 0.772 (n 318) |
| base-q8 | raw | 0.60 | 0.979 / 0.871 / 0.891 (n 373) | 0.814 / 0.659 / 0.685 (n 273) | 0.905 / 0.836 / 0.849 (n 318) |
| base-q8 | raw | 0.30 | 0.976 / 0.882 / 0.899 (n 373) | 0.802 / 0.696 / 0.715 (n 273) | 0.890 / 0.865 / 0.870 (n 318) |
| golem | cleaned | – | 0.738 / 0.673 / 0.685 (n 373) | 0.000 / 0.000 / 0.000 (n 273) | 0.687 / 0.214 / 0.248 (n 318) |
| golem | raw | 0.40 | 0.656 / 0.756 / 0.734 (n 373) | 0.000 / 0.000 / 0.000 (n 273) | 0.667 / 0.258 / 0.294 (n 318) |
| iahlt-base-ft | cleaned | – | 0.968 / 0.887 / 0.902 (n 373) | 0.800 / 0.484 / 0.525 (n 273) | 0.901 / 0.714 / 0.745 (n 318) |
| iahlt-base-ft | raw | 0.30 | 0.958 / 0.925 / 0.931 (n 373) | 0.836 / 0.729 / 0.748 (n 273) | 0.866 / 0.852 / 0.855 (n 318) |
| iahlt-base | cleaned | – | 0.976 / 0.879 / 0.897 (n 373) | 0.790 / 0.469 / 0.510 (n 273) | 0.871 / 0.698 / 0.727 (n 318) |
| iahlt-base | raw | 0.35 | 0.966 / 0.914 / 0.924 (n 373) | 0.820 / 0.718 / 0.736 (n 273) | 0.868 / 0.846 / 0.850 (n 318) |
| joint-base-ft | cleaned | – | 0.974 / 0.920 / 0.930 (n 373) | 0.800 / 0.527 / 0.566 (n 273) | 0.910 / 0.796 / 0.816 (n 318) |
| joint-base-ft | raw | 0.40 | 0.964 / 0.946 / 0.950 (n 373) | 0.791 / 0.777 / 0.779 (n 273) | 0.888 / 0.918 / 0.912 (n 318) |
| joint-base | cleaned | – | 0.979 / 0.890 / 0.907 (n 373) | 0.784 / 0.505 / 0.544 (n 273) | 0.903 / 0.789 / 0.810 (n 318) |
| joint-base | raw | 0.30 | 0.980 / 0.920 / 0.931 (n 373) | 0.809 / 0.777 / 0.783 (n 273) | 0.869 / 0.918 / 0.908 (n 318) |
| large-q8-ft | cleaned | – | 0.968 / 0.903 / 0.916 (n 373) | 0.735 / 0.498 / 0.532 (n 273) | 0.896 / 0.758 / 0.782 (n 318) |
| large-q8-ft | raw | 0.50 | 0.953 / 0.920 / 0.926 (n 373) | 0.759 / 0.725 / 0.732 (n 273) | 0.880 / 0.874 / 0.875 (n 318) |
| large-q8 | cleaned | – | 0.978 / 0.823 / 0.850 (n 373) | 0.756 / 0.465 / 0.504 (n 273) | 0.923 / 0.676 / 0.714 (n 318) |
| large-q8 | raw | 0.30 | 0.964 / 0.850 / 0.870 (n 373) | 0.778 / 0.692 / 0.708 (n 273) | 0.916 / 0.821 / 0.838 (n 318) |
| msperka-dicta-ft | cleaned | – | 0.966 / 0.928 / 0.935 (n 373) | 0.806 / 0.593 / 0.626 (n 273) | 0.897 / 0.736 / 0.763 (n 318) |
| msperka-dicta-ft | raw | 0.30 | 0.960 / 0.960 / 0.960 (n 373) | 0.759 / 0.886 / 0.858 (n 273) | 0.882 / 0.915 / 0.908 (n 318) |
| msperka-dicta | cleaned | – | 0.980 / 0.928 / 0.938 (n 373) | 0.825 / 0.553 / 0.592 (n 273) | 0.895 / 0.720 / 0.749 (n 318) |
| msperka-dicta | raw | 0.30 | 0.970 / 0.957 / 0.960 (n 373) | 0.775 / 0.883 / 0.859 (n 273) | 0.880 / 0.899 / 0.895 (n 318) |
| parse-base-ft | cleaned | – | 0.975 / 0.928 / 0.937 (n 373) | 0.765 / 0.619 / 0.644 (n 273) | 0.885 / 0.821 / 0.833 (n 318) |
| parse-base-ft | raw | 0.30 | 0.959 / 0.952 / 0.953 (n 373) | 0.765 / 0.872 / 0.848 (n 273) | 0.891 / 0.947 / 0.935 (n 318) |
| parse-base | cleaned | – | 0.977 / 0.898 / 0.913 (n 373) | 0.764 / 0.604 / 0.631 (n 273) | 0.873 / 0.802 / 0.815 (n 318) |
| parse-base | raw | 0.30 | 0.978 / 0.933 / 0.942 (n 373) | 0.779 / 0.850 / 0.835 (n 273) | 0.866 / 0.937 / 0.922 (n 318) |
| tiny-parse-ft | cleaned | – | 0.955 / 0.914 / 0.922 (n 373) | 0.773 / 0.575 / 0.606 (n 273) | 0.871 / 0.783 / 0.799 (n 318) |
| tiny-parse-ft | raw | 0.30 | 0.936 / 0.946 / 0.944 (n 373) | 0.735 / 0.791 / 0.779 (n 273) | 0.833 / 0.912 / 0.895 (n 318) |
| tiny-parse | cleaned | – | 0.963 / 0.901 / 0.913 (n 373) | 0.738 / 0.527 / 0.559 (n 273) | 0.831 / 0.774 / 0.784 (n 318) |
| tiny-parse | raw | 0.30 | 0.940 / 0.928 / 0.930 (n 373) | 0.731 / 0.766 / 0.758 (n 273) | 0.827 / 0.899 / 0.884 (n 318) |

## knesset-ud (held out)

15 documents; licence CC-BY-SA-4.0; contamination: joint-base, parse-base, tiny-parse.

Overlap untyped unless named. Lost/gained: must entities the baseline finds and this row misses, and the other way.

| Model | Stage | Cut-off | Gold | TP | FP | FN | P | R | R 95% | F1 | F2 | PER R | Word-exact F1 | Entity R | Traps hit | Added R | Lost / gained | R gain vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aleph | cleaned | – | 264 | 118 | 48 | 146 | 0.711 | 0.447 | [0.333, 0.584] | 0.549 | 0.483 | 0.769 | 0.470 | 0.447 | – | – | 23 / 18 | -0.019 [-0.046, 0.044] |
| aleph | raw | 0.30 tune | 264 | 222 | 51 | 42 | 0.813 | 0.841 | [0.765, 0.886] | 0.827 | 0.835 | 0.908 | 0.737 | 0.841 | – | – | 7 / 44 | +0.140 [0.077, 0.231] |
| base-q8-ft | cleaned | – | 264 | 130 | 21 | 134 | 0.861 | 0.492 | [0.333, 0.653] | 0.627 | 0.539 | 0.754 | 0.496 | 0.492 | – | – | 7 / 14 | +0.027 [-0.035, 0.086] |
| base-q8-ft | raw | 0.30 tune | 264 | 214 | 21 | 50 | 0.911 | 0.811 | [0.706, 0.887] | 0.858 | 0.829 | 0.923 | 0.745 | 0.811 | – | – | 0 / 29 | +0.110 [0.077, 0.148] |
| base-q8 | cleaned | – | 264 | 123 | 19 | 141 | 0.866 | 0.466 | [0.354, 0.585] | 0.606 | 0.513 | 0.723 | 0.483 | 0.466 | – | – | – | – |
| base-q8 | raw | 0.60 shipped | 264 | 185 | 15 | 79 | 0.925 | 0.701 | [0.602, 0.779] | 0.797 | 0.736 | 0.877 | 0.724 | 0.701 | – | – | – | – |
| base-q8 | raw | 0.30 tune | 264 | 194 | 15 | 70 | 0.928 | 0.735 | [0.644, 0.821] | 0.820 | 0.767 | 0.892 | 0.744 | 0.735 | – | – | – | – |
| golem | cleaned | – | 264 | 44 | 56 | 220 | 0.440 | 0.167 | [0.120, 0.233] | 0.242 | 0.190 | 0.554 | 0.187 | 0.167 | – | – | 84 / 5 | -0.299 [-0.403, -0.196] |
| golem | raw | 0.40 tune | 264 | 60 | 37 | 204 | 0.619 | 0.227 | [0.184, 0.314] | 0.332 | 0.260 | 0.769 | 0.249 | 0.227 | – | – | 132 / 7 | -0.473 [-0.605, -0.289] |
| iahlt-base-ft | cleaned | – | 264 | 129 | 18 | 135 | 0.878 | 0.489 | [0.336, 0.641] | 0.628 | 0.536 | 0.754 | 0.482 | 0.489 | – | – | 10 / 16 | +0.023 [-0.035, 0.083] |
| iahlt-base-ft | raw | 0.30 tune | 264 | 215 | 24 | 49 | 0.900 | 0.814 | [0.707, 0.898] | 0.855 | 0.830 | 0.892 | 0.751 | 0.814 | – | – | 4 / 34 | +0.114 [0.063, 0.180] |
| iahlt-base | cleaned | – | 264 | 129 | 14 | 135 | 0.902 | 0.489 | [0.340, 0.635] | 0.634 | 0.538 | 0.708 | 0.467 | 0.489 | – | – | 5 / 11 | +0.023 [-0.033, 0.071] |
| iahlt-base | raw | 0.35 tune | 264 | 212 | 19 | 52 | 0.918 | 0.803 | [0.708, 0.857] | 0.857 | 0.824 | 0.862 | 0.764 | 0.803 | – | – | 5 / 32 | +0.102 [0.041, 0.179] |
| joint-base-ft | cleaned | – | 264 | 130 | 21 | 134 | 0.861 | 0.492 | [0.330, 0.652] | 0.627 | 0.539 | 0.769 | 0.501 | 0.492 | – | – | 7 / 14 | +0.027 [-0.033, 0.080] |
| joint-base-ft | raw | 0.40 tune | 264 | 219 | 26 | 45 | 0.894 | 0.830 | [0.734, 0.900] | 0.861 | 0.842 | 0.923 | 0.750 | 0.830 | – | – | 0 / 34 | +0.129 [0.091, 0.190] |
| joint-base | cleaned | – | 264 | 121 | 23 | 143 | 0.840 | 0.458 | [0.329, 0.589] | 0.593 | 0.504 | 0.738 | 0.495 | 0.458 | – | – | 10 / 8 | -0.008 [-0.037, 0.020] |
| joint-base | raw | 0.30 tune | 264 | 212 | 22 | 52 | 0.906 | 0.803 | [0.740, 0.880] | 0.851 | 0.822 | 0.908 | 0.771 | 0.803 | – | – | 0 / 27 | +0.102 [0.067, 0.186] |
| large-q8-ft | cleaned | – | 264 | 139 | 21 | 125 | 0.869 | 0.527 | [0.389, 0.667] | 0.656 | 0.572 | 0.769 | 0.495 | 0.527 | – | – | 0 / 16 | +0.061 [0.014, 0.102] |
| large-q8-ft | raw | 0.50 tune | 264 | 221 | 17 | 43 | 0.929 | 0.837 | [0.737, 0.914] | 0.880 | 0.854 | 0.923 | 0.761 | 0.837 | – | – | 0 / 36 | +0.136 [0.094, 0.213] |
| large-q8 | cleaned | – | 264 | 107 | 20 | 157 | 0.843 | 0.405 | [0.285, 0.562] | 0.547 | 0.452 | 0.723 | 0.481 | 0.405 | – | – | 21 / 5 | -0.061 [-0.099, 0.024] |
| large-q8 | raw | 0.30 tune | 264 | 200 | 16 | 64 | 0.926 | 0.758 | [0.682, 0.842] | 0.833 | 0.786 | 0.892 | 0.758 | 0.758 | – | – | 6 / 21 | +0.057 [0.030, 0.130] |
| msperka-dicta-ft | cleaned | – | 264 | 113 | 23 | 151 | 0.831 | 0.428 | [0.295, 0.583] | 0.565 | 0.474 | 0.754 | 0.480 | 0.428 | – | – | 28 / 18 | -0.038 [-0.086, 0.056] |
| msperka-dicta-ft | raw | 0.30 tune | 264 | 212 | 31 | 52 | 0.872 | 0.803 | [0.745, 0.849] | 0.836 | 0.816 | 0.908 | 0.750 | 0.803 | – | – | 12 / 39 | +0.102 [0.042, 0.186] |
| msperka-dicta | cleaned | – | 264 | 110 | 14 | 154 | 0.887 | 0.417 | [0.273, 0.573] | 0.567 | 0.466 | 0.738 | 0.479 | 0.417 | – | – | 31 / 18 | -0.049 [-0.105, 0.044] |
| msperka-dicta | raw | 0.30 tune | 264 | 205 | 28 | 59 | 0.880 | 0.777 | [0.711, 0.873] | 0.825 | 0.795 | 0.908 | 0.736 | 0.777 | – | – | 17 / 37 | +0.076 [-0.029, 0.237] |
| parse-base-ft | cleaned | – | 264 | 134 | 29 | 130 | 0.822 | 0.508 | [0.345, 0.675] | 0.628 | 0.550 | 0.785 | 0.492 | 0.508 | – | – | 7 / 18 | +0.042 [-0.020, 0.105] |
| parse-base-ft | raw | 0.30 tune | 264 | 230 | 38 | 34 | 0.858 | 0.871 | [0.800, 0.935] | 0.865 | 0.869 | 0.923 | 0.756 | 0.871 | – | – | 0 / 45 | +0.170 [0.131, 0.258] |
| parse-base | cleaned | – | 264 | 129 | 27 | 135 | 0.827 | 0.489 | [0.322, 0.653] | 0.614 | 0.532 | 0.769 | 0.495 | 0.489 | – | – | 9 / 15 | +0.023 [-0.047, 0.087] |
| parse-base | raw | 0.30 tune | 264 | 225 | 29 | 39 | 0.886 | 0.852 | [0.792, 0.915] | 0.869 | 0.859 | 0.923 | 0.784 | 0.852 | – | – | 0 / 40 | +0.152 [0.110, 0.238] |
| tiny-parse-ft | cleaned | – | 264 | 122 | 20 | 142 | 0.859 | 0.462 | [0.320, 0.638] | 0.601 | 0.509 | 0.769 | 0.527 | 0.462 | – | – | 18 / 17 | -0.004 [-0.054, 0.101] |
| tiny-parse-ft | raw | 0.30 tune | 264 | 246 | 31 | 18 | 0.888 | 0.932 | [0.915, 0.951] | 0.909 | 0.923 | 0.923 | 0.839 | 0.932 | – | – | 1 / 62 | +0.231 [0.156, 0.335] |
| tiny-parse | cleaned | – | 264 | 119 | 20 | 145 | 0.856 | 0.451 | [0.322, 0.615] | 0.591 | 0.498 | 0.769 | 0.511 | 0.451 | – | – | 20 / 16 | -0.015 [-0.052, 0.077] |
| tiny-parse | raw | 0.30 tune | 264 | 241 | 29 | 23 | 0.893 | 0.913 | [0.889, 0.940] | 0.903 | 0.909 | 0.923 | 0.820 | 0.913 | – | – | 3 / 59 | +0.212 [0.148, 0.311] |

Per type, overlap typed (P / R / F2):

| Model | Stage | Cut-off | PER | ORG | PLACE |
|---|---|---|---|---|---|
| aleph | cleaned | – | 0.893 / 0.769 / 0.791 (n 65) | 0.470 / 0.248 / 0.274 (n 125) | 0.795 / 0.473 / 0.515 (n 74) |
| aleph | raw | 0.30 | 0.881 / 0.908 / 0.902 (n 65) | 0.733 / 0.768 / 0.761 (n 125) | 0.880 / 0.892 / 0.889 (n 74) |
| base-q8-ft | cleaned | – | 0.942 / 0.754 / 0.785 (n 65) | 0.689 / 0.248 / 0.284 (n 125) | 0.907 / 0.662 / 0.700 (n 74) |
| base-q8-ft | raw | 0.30 | 0.938 / 0.923 / 0.926 (n 65) | 0.871 / 0.704 / 0.732 (n 125) | 0.914 / 0.865 / 0.874 (n 74) |
| base-q8 | cleaned | – | 0.959 / 0.723 / 0.761 (n 65) | 0.682 / 0.240 / 0.276 (n 125) | 0.918 / 0.608 / 0.652 (n 74) |
| base-q8 | raw | 0.60 | 0.966 / 0.877 / 0.893 (n 65) | 0.884 / 0.608 / 0.648 (n 125) | 0.927 / 0.689 / 0.726 (n 74) |
| base-q8 | raw | 0.30 | 0.967 / 0.892 / 0.906 (n 65) | 0.890 / 0.648 / 0.685 (n 125) | 0.931 / 0.730 / 0.763 (n 74) |
| golem | cleaned | – | 0.383 / 0.554 / 0.508 (n 65) | 0.000 / 0.000 / 0.000 (n 125) | 1.000 / 0.081 / 0.099 (n 74) |
| golem | raw | 0.40 | 0.556 / 0.769 / 0.714 (n 65) | 0.000 / 0.000 / 0.000 (n 125) | 1.000 / 0.095 / 0.116 (n 74) |
| iahlt-base-ft | cleaned | – | 0.907 / 0.754 / 0.780 (n 65) | 0.763 / 0.232 / 0.270 (n 125) | 0.855 / 0.635 / 0.670 (n 74) |
| iahlt-base-ft | raw | 0.30 | 0.935 / 0.892 / 0.901 (n 65) | 0.854 / 0.704 / 0.730 (n 125) | 0.865 / 0.865 / 0.865 (n 74) |
| iahlt-base | cleaned | – | 0.939 / 0.708 / 0.744 (n 65) | 0.757 / 0.224 / 0.261 (n 125) | 0.912 / 0.703 / 0.737 (n 74) |
| iahlt-base | raw | 0.35 | 0.949 / 0.862 / 0.878 (n 65) | 0.871 / 0.704 / 0.732 (n 125) | 0.887 / 0.851 / 0.858 (n 74) |
| joint-base-ft | cleaned | – | 0.943 / 0.769 / 0.799 (n 65) | 0.674 / 0.248 / 0.284 (n 125) | 0.904 / 0.635 / 0.675 (n 74) |
| joint-base-ft | raw | 0.40 | 0.952 / 0.923 / 0.929 (n 65) | 0.830 / 0.744 / 0.760 (n 125) | 0.900 / 0.851 / 0.861 (n 74) |
| joint-base | cleaned | – | 0.923 / 0.738 / 0.769 (n 65) | 0.673 / 0.264 / 0.301 (n 125) | 0.884 / 0.514 / 0.560 (n 74) |
| joint-base | raw | 0.30 | 0.937 / 0.908 / 0.913 (n 65) | 0.852 / 0.736 / 0.757 (n 125) | 0.905 / 0.770 / 0.794 (n 74) |
| large-q8-ft | cleaned | – | 0.926 / 0.769 / 0.796 (n 65) | 0.696 / 0.256 / 0.293 (n 125) | 0.917 / 0.743 / 0.772 (n 74) |
| large-q8-ft | raw | 0.50 | 0.938 / 0.923 / 0.926 (n 65) | 0.903 / 0.744 / 0.771 (n 125) | 0.915 / 0.878 / 0.886 (n 74) |
| large-q8 | cleaned | – | 0.922 / 0.723 / 0.756 (n 65) | 0.644 / 0.232 / 0.266 (n 125) | 0.839 / 0.351 / 0.398 (n 74) |
| large-q8 | raw | 0.30 | 0.921 / 0.892 / 0.898 (n 65) | 0.885 / 0.680 / 0.713 (n 125) | 0.930 / 0.716 / 0.751 (n 74) |
| msperka-dicta-ft | cleaned | – | 0.925 / 0.754 / 0.783 (n 65) | 0.644 / 0.232 / 0.266 (n 125) | 0.842 / 0.432 / 0.479 (n 74) |
| msperka-dicta-ft | raw | 0.30 | 0.937 / 0.908 / 0.913 (n 65) | 0.817 / 0.752 / 0.764 (n 125) | 0.862 / 0.757 / 0.776 (n 74) |
| msperka-dicta | cleaned | – | 0.960 / 0.738 / 0.774 (n 65) | 0.738 / 0.248 / 0.286 (n 125) | 0.875 / 0.378 / 0.427 (n 74) |
| msperka-dicta | raw | 0.30 | 0.952 / 0.908 / 0.916 (n 65) | 0.804 / 0.688 / 0.708 (n 125) | 0.891 / 0.770 / 0.792 (n 74) |
| parse-base-ft | cleaned | – | 0.879 / 0.785 / 0.802 (n 65) | 0.694 / 0.272 / 0.310 (n 125) | 0.839 / 0.635 / 0.668 (n 74) |
| parse-base-ft | raw | 0.30 | 0.870 / 0.923 / 0.912 (n 65) | 0.837 / 0.824 / 0.827 (n 125) | 0.855 / 0.878 / 0.874 (n 74) |
| parse-base | cleaned | – | 0.893 / 0.769 / 0.791 (n 65) | 0.688 / 0.264 / 0.301 (n 125) | 0.827 / 0.581 / 0.618 (n 74) |
| parse-base | raw | 0.30 | 0.909 / 0.923 / 0.920 (n 65) | 0.861 / 0.840 / 0.844 (n 125) | 0.864 / 0.770 / 0.787 (n 74) |
| tiny-parse-ft | cleaned | – | 0.893 / 0.769 / 0.791 (n 65) | 0.791 / 0.272 / 0.313 (n 125) | 0.884 / 0.514 / 0.560 (n 74) |
| tiny-parse-ft | raw | 0.30 | 0.909 / 0.923 / 0.920 (n 65) | 0.869 / 0.952 / 0.934 (n 125) | 0.905 / 0.905 / 0.905 (n 74) |
| tiny-parse | cleaned | – | 0.909 / 0.769 / 0.794 (n 65) | 0.786 / 0.264 / 0.304 (n 125) | 0.833 / 0.473 / 0.518 (n 74) |
| tiny-parse | raw | 0.30 | 0.896 / 0.923 / 0.917 (n 65) | 0.905 / 0.912 / 0.911 (n 125) | 0.844 / 0.878 / 0.871 (n 74) |

## known-cases

35 documents; licence repo.

Overlap untyped unless named. Lost/gained: must entities the baseline finds and this row misses, and the other way.

| Model | Stage | Cut-off | Gold | TP | FP | FN | P | R | R 95% | F1 | F2 | PER R | Word-exact F1 | Entity R | Traps hit | Added R | Lost / gained | R gain vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aleph | cleaned | – | 150 | 135 | 11 | 15 | 0.925 | 0.900 | [0.805, 0.972] | 0.912 | 0.905 | 0.923 | 0.892 | 0.903 | 0/25 | – | 1 / 2 | +0.027 [-0.082, 0.134] |
| aleph | raw | 0.30 tune | 150 | 137 | 10 | 13 | 0.932 | 0.913 | [0.842, 0.970] | 0.923 | 0.917 | 0.888 | 0.875 | 0.968 | 5/25 | – | 0 / 3 | +0.140 [0.041, 0.260] |
| base-q8-ft | cleaned | – | 150 | 136 | 2 | 14 | 0.986 | 0.907 | [0.817, 0.979] | 0.944 | 0.921 | 0.867 | 0.889 | 0.903 | 0/25 | – | 0 / 1 | +0.033 [0.000, 0.118] |
| base-q8-ft | raw | 0.30 tune | 150 | 127 | 4 | 23 | 0.969 | 0.847 | [0.750, 0.931] | 0.904 | 0.869 | 0.818 | 0.868 | 0.903 | 4/25 | – | 0 / 1 | +0.073 [0.008, 0.159] |
| base-q8 | cleaned | – | 150 | 131 | 2 | 19 | 0.985 | 0.873 | [0.767, 0.962] | 0.926 | 0.894 | 0.832 | 0.869 | 0.871 | 0/25 | – | – | – |
| base-q8 | raw | 0.60 shipped | 150 | 116 | 5 | 34 | 0.959 | 0.773 | [0.644, 0.881] | 0.856 | 0.804 | 0.755 | 0.827 | 0.871 | 4/25 | – | – | – |
| base-q8 | raw | 0.30 tune | 150 | 119 | 5 | 31 | 0.960 | 0.793 | [0.671, 0.894] | 0.869 | 0.822 | 0.762 | 0.825 | 0.871 | 4/25 | – | – | – |
| golem | cleaned | – | 150 | 111 | 9 | 39 | 0.925 | 0.740 | [0.604, 0.872] | 0.822 | 0.771 | 0.741 | 0.741 | 0.806 | 1/25 | – | 3 / 1 | -0.133 [-0.279, 0.000] |
| golem | raw | 0.40 tune | 150 | 77 | 5 | 73 | 0.939 | 0.513 | [0.418, 0.609] | 0.664 | 0.565 | 0.497 | 0.560 | 0.903 | 1/25 | – | 2 / 3 | -0.260 [-0.422, -0.083] |
| iahlt-base-ft | cleaned | – | 150 | 139 | 4 | 11 | 0.972 | 0.927 | [0.850, 0.987] | 0.949 | 0.935 | 0.923 | 0.928 | 0.935 | 0/25 | – | 0 / 2 | +0.053 [0.000, 0.154] |
| iahlt-base-ft | raw | 0.30 tune | 150 | 140 | 6 | 10 | 0.959 | 0.933 | [0.864, 0.986] | 0.946 | 0.938 | 0.930 | 0.926 | 0.968 | 5/25 | – | 0 / 3 | +0.160 [0.052, 0.299] |
| iahlt-base | cleaned | – | 150 | 139 | 4 | 11 | 0.972 | 0.927 | [0.850, 0.987] | 0.949 | 0.935 | 0.923 | 0.928 | 0.935 | 0/25 | – | 0 / 2 | +0.053 [0.000, 0.154] |
| iahlt-base | raw | 0.35 tune | 150 | 134 | 7 | 16 | 0.950 | 0.893 | [0.815, 0.958] | 0.921 | 0.904 | 0.888 | 0.893 | 0.968 | 5/25 | – | 0 / 3 | +0.120 [0.013, 0.250] |
| joint-base-ft | cleaned | – | 150 | 142 | 4 | 8 | 0.973 | 0.947 | [0.879, 1.000] | 0.959 | 0.952 | 0.944 | 0.953 | 0.935 | 0/25 | – | 0 / 2 | +0.073 [0.000, 0.179] |
| joint-base-ft | raw | 0.40 tune | 150 | 139 | 4 | 11 | 0.972 | 0.927 | [0.850, 0.981] | 0.949 | 0.935 | 0.923 | 0.949 | 0.935 | 4/25 | – | 0 / 2 | +0.153 [0.053, 0.273] |
| joint-base | cleaned | – | 150 | 142 | 2 | 8 | 0.986 | 0.947 | [0.879, 1.000] | 0.966 | 0.954 | 0.944 | 0.959 | 0.935 | 0/25 | – | 0 / 2 | +0.073 [0.000, 0.179] |
| joint-base | raw | 0.30 tune | 150 | 136 | 4 | 14 | 0.971 | 0.907 | [0.818, 0.973] | 0.938 | 0.919 | 0.902 | 0.938 | 0.935 | 4/25 | – | 0 / 2 | +0.133 [0.036, 0.243] |
| large-q8-ft | cleaned | – | 150 | 137 | 2 | 13 | 0.986 | 0.913 | [0.832, 0.981] | 0.948 | 0.927 | 0.909 | 0.934 | 0.935 | 0/25 | – | 0 / 2 | +0.040 [-0.012, 0.109] |
| large-q8-ft | raw | 0.50 tune | 150 | 128 | 5 | 22 | 0.962 | 0.853 | [0.753, 0.936] | 0.905 | 0.873 | 0.846 | 0.876 | 0.935 | 4/25 | – | 0 / 2 | +0.080 [0.021, 0.159] |
| large-q8 | cleaned | – | 150 | 129 | 1 | 21 | 0.992 | 0.860 | [0.738, 0.950] | 0.921 | 0.884 | 0.818 | 0.871 | 0.871 | 0/25 | – | 1 / 1 | -0.013 [-0.116, 0.063] |
| large-q8 | raw | 0.30 tune | 150 | 108 | 4 | 42 | 0.964 | 0.720 | [0.590, 0.831] | 0.824 | 0.758 | 0.699 | 0.802 | 0.871 | 4/25 | – | 1 / 1 | -0.053 [-0.128, 0.024] |
| msperka-dicta-ft | cleaned | – | 150 | 138 | 4 | 12 | 0.972 | 0.920 | [0.832, 0.982] | 0.945 | 0.930 | 0.944 | 0.938 | 0.903 | 0/25 | – | 1 / 2 | +0.047 [-0.065, 0.161] |
| msperka-dicta-ft | raw | 0.30 tune | 150 | 142 | 6 | 8 | 0.959 | 0.947 | [0.884, 0.993] | 0.953 | 0.949 | 0.944 | 0.946 | 0.968 | 5/25 | – | 0 / 3 | +0.173 [0.059, 0.315] |
| msperka-dicta | cleaned | – | 150 | 138 | 4 | 12 | 0.972 | 0.920 | [0.832, 0.982] | 0.945 | 0.930 | 0.944 | 0.938 | 0.903 | 0/25 | – | 1 / 2 | +0.047 [-0.065, 0.161] |
| msperka-dicta | raw | 0.30 tune | 150 | 134 | 6 | 16 | 0.957 | 0.893 | [0.808, 0.965] | 0.924 | 0.905 | 0.888 | 0.917 | 0.968 | 5/25 | – | 0 / 3 | +0.120 [-0.006, 0.258] |
| parse-base-ft | cleaned | – | 150 | 140 | 10 | 10 | 0.933 | 0.933 | [0.860, 0.987] | 0.933 | 0.933 | 0.944 | 0.927 | 0.935 | 0/25 | – | 0 / 2 | +0.060 [-0.027, 0.166] |
| parse-base-ft | raw | 0.30 tune | 150 | 140 | 5 | 10 | 0.966 | 0.933 | [0.857, 0.987] | 0.949 | 0.940 | 0.923 | 0.942 | 0.935 | 5/25 | – | 0 / 2 | +0.160 [0.053, 0.286] |
| parse-base | cleaned | – | 150 | 142 | 4 | 8 | 0.973 | 0.947 | [0.879, 1.000] | 0.959 | 0.952 | 0.944 | 0.953 | 0.935 | 0/25 | – | 0 / 2 | +0.073 [0.000, 0.179] |
| parse-base | raw | 0.30 tune | 150 | 135 | 6 | 15 | 0.957 | 0.900 | [0.812, 0.968] | 0.928 | 0.911 | 0.895 | 0.928 | 0.935 | 6/25 | – | 0 / 2 | +0.127 [0.035, 0.234] |
| tiny-parse-ft | cleaned | – | 150 | 140 | 11 | 10 | 0.927 | 0.933 | [0.860, 0.987] | 0.930 | 0.932 | 0.909 | 0.890 | 0.935 | 1/25 | – | 0 / 2 | +0.060 [-0.027, 0.166] |
| tiny-parse-ft | raw | 0.30 tune | 150 | 136 | 8 | 14 | 0.944 | 0.907 | [0.824, 0.972] | 0.925 | 0.914 | 0.867 | 0.891 | 0.935 | 6/25 | – | 0 / 2 | +0.133 [0.047, 0.242] |
| tiny-parse | cleaned | – | 150 | 142 | 5 | 8 | 0.966 | 0.947 | [0.879, 1.000] | 0.956 | 0.950 | 0.909 | 0.916 | 0.935 | 1/25 | – | 0 / 2 | +0.073 [0.000, 0.179] |
| tiny-parse | raw | 0.30 tune | 150 | 126 | 8 | 24 | 0.940 | 0.840 | [0.736, 0.926] | 0.887 | 0.858 | 0.818 | 0.873 | 0.935 | 8/25 | – | 0 / 2 | +0.067 [-0.007, 0.145] |

Per type, overlap typed (P / R / F2):

| Model | Stage | Cut-off | PER | ORG | PLACE |
|---|---|---|---|---|---|
| aleph | cleaned | – | 0.971 / 0.923 / 0.932 (n 143) | 0.300 / 1.000 / 0.682 (n 3) | 0.000 / 0.000 / 0.000 (n 4) |
| aleph | raw | 0.30 | 0.992 / 0.888 / 0.907 (n 143) | 0.214 / 1.000 / 0.577 (n 3) | 0.800 / 1.000 / 0.952 (n 4) |
| base-q8-ft | cleaned | – | 0.984 / 0.867 / 0.888 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 0.444 / 1.000 / 0.800 (n 4) |
| base-q8-ft | raw | 0.30 | 1.000 / 0.818 / 0.849 (n 143) | 0.429 / 1.000 / 0.789 (n 3) | 0.571 / 1.000 / 0.870 (n 4) |
| base-q8 | cleaned | – | 0.983 / 0.832 / 0.859 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 0.444 / 1.000 / 0.800 (n 4) |
| base-q8 | raw | 0.60 | 1.000 / 0.755 / 0.794 (n 143) | 0.429 / 1.000 / 0.789 (n 3) | 0.667 / 1.000 / 0.909 (n 4) |
| base-q8 | raw | 0.30 | 1.000 / 0.762 / 0.800 (n 143) | 0.429 / 1.000 / 0.789 (n 3) | 0.500 / 1.000 / 0.833 (n 4) |
| golem | cleaned | – | 0.964 / 0.741 / 0.777 (n 143) | 0.000 / 0.000 / 0.000 (n 3) | 0.200 / 0.500 / 0.385 (n 4) |
| golem | raw | 0.40 | 0.947 / 0.497 / 0.549 (n 143) | 0.000 / 0.000 / 0.000 (n 3) | 0.143 / 0.250 / 0.217 (n 4) |
| iahlt-base-ft | cleaned | – | 0.971 / 0.923 / 0.932 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| iahlt-base-ft | raw | 0.30 | 0.993 / 0.930 / 0.942 (n 143) | 0.429 / 1.000 / 0.789 (n 3) | 0.800 / 1.000 / 0.952 (n 4) |
| iahlt-base | cleaned | – | 0.971 / 0.923 / 0.932 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| iahlt-base | raw | 0.35 | 0.992 / 0.888 / 0.907 (n 143) | 0.429 / 1.000 / 0.789 (n 3) | 0.667 / 1.000 / 0.909 (n 4) |
| joint-base-ft | cleaned | – | 0.971 / 0.944 / 0.949 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| joint-base-ft | raw | 0.40 | 1.000 / 0.923 / 0.938 (n 143) | 0.429 / 1.000 / 0.789 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| joint-base | cleaned | – | 0.985 / 0.944 / 0.952 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| joint-base | raw | 0.30 | 1.000 / 0.902 / 0.920 (n 143) | 0.429 / 1.000 / 0.789 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| large-q8-ft | cleaned | – | 0.985 / 0.909 / 0.923 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| large-q8-ft | raw | 0.50 | 0.992 / 0.846 / 0.872 (n 143) | 0.429 / 1.000 / 0.789 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| large-q8 | cleaned | – | 0.992 / 0.818 / 0.848 (n 143) | 0.375 / 1.000 / 0.750 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| large-q8 | raw | 0.30 | 1.000 / 0.699 / 0.744 (n 143) | 0.375 / 1.000 / 0.750 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| msperka-dicta-ft | cleaned | – | 0.971 / 0.944 / 0.949 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 0.000 / 0.000 / 0.000 (n 4) |
| msperka-dicta-ft | raw | 0.30 | 0.993 / 0.944 / 0.953 (n 143) | 0.375 / 1.000 / 0.750 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| msperka-dicta | cleaned | – | 0.971 / 0.944 / 0.949 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 0.000 / 0.000 / 0.000 (n 4) |
| msperka-dicta | raw | 0.30 | 0.992 / 0.888 / 0.907 (n 143) | 0.375 / 1.000 / 0.750 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| parse-base-ft | cleaned | – | 0.971 / 0.944 / 0.949 (n 143) | 0.333 / 1.000 / 0.714 (n 3) | 1.000 / 0.500 / 0.556 (n 4) |
| parse-base-ft | raw | 0.30 | 1.000 / 0.923 / 0.938 (n 143) | 0.333 / 1.000 / 0.714 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| parse-base | cleaned | – | 0.971 / 0.944 / 0.949 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 1.000 / 1.000 / 1.000 (n 4) |
| parse-base | raw | 0.30 | 1.000 / 0.895 / 0.914 (n 143) | 0.375 / 1.000 / 0.750 (n 3) | 0.800 / 1.000 / 0.952 (n 4) |
| tiny-parse-ft | cleaned | – | 0.956 / 0.909 / 0.918 (n 143) | 0.375 / 1.000 / 0.750 (n 3) | 0.286 / 0.500 / 0.435 (n 4) |
| tiny-parse-ft | raw | 0.30 | 0.984 / 0.867 / 0.888 (n 143) | 0.333 / 1.000 / 0.714 (n 3) | 0.444 / 1.000 / 0.800 (n 4) |
| tiny-parse | cleaned | – | 0.963 / 0.909 / 0.919 (n 143) | 1.000 / 1.000 / 1.000 (n 3) | 0.444 / 1.000 / 0.800 (n 4) |
| tiny-parse | raw | 0.30 | 0.992 / 0.818 / 0.848 (n 143) | 0.333 / 1.000 / 0.714 (n 3) | 0.571 / 1.000 / 0.870 (n 4) |

Recall per category (overlap untyped):

| Category | n | aleph cleaned | aleph raw 0.30 | base-q8-ft cleaned | base-q8-ft raw 0.30 | base-q8 cleaned | base-q8 raw 0.60 | base-q8 raw 0.30 | golem cleaned | golem raw 0.40 | iahlt-base-ft cleaned | iahlt-base-ft raw 0.30 | iahlt-base cleaned | iahlt-base raw 0.35 | joint-base-ft cleaned | joint-base-ft raw 0.40 | joint-base cleaned | joint-base raw 0.30 | large-q8-ft cleaned | large-q8-ft raw 0.50 | large-q8 cleaned | large-q8 raw 0.30 | msperka-dicta-ft cleaned | msperka-dicta-ft raw 0.30 | msperka-dicta cleaned | msperka-dicta raw 0.30 | parse-base-ft cleaned | parse-base-ft raw 0.30 | parse-base cleaned | parse-base raw 0.30 | tiny-parse-ft cleaned | tiny-parse-ft raw 0.30 | tiny-parse cleaned | tiny-parse raw 0.30 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| control | 7 | 3 (42.9%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 2 (28.6%) | 1 (14.3%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 6 (85.7%) | 7 (100.0%) | 6 (85.7%) | 5 (71.4%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 5 (71.4%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 5 (71.4%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) |
| false-positive | 4 | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) |
| leak | 17 | 15 (88.2%) | 17 (100.0%) | 12 (70.6%) | 14 (82.4%) | 12 (70.6%) | 13 (76.5%) | 13 (76.5%) | 15 (88.2%) | 9 (52.9%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 16 (94.1%) | 12 (70.6%) | 13 (76.5%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 17 (100.0%) | 15 (88.2%) | 17 (100.0%) |
| leak-16.9 | 109 | 106 (97.2%) | 104 (95.4%) | 106 (97.2%) | 99 (90.8%) | 101 (92.7%) | 89 (81.7%) | 92 (84.4%) | 87 (79.8%) | 55 (50.5%) | 106 (97.2%) | 106 (97.2%) | 106 (97.2%) | 100 (91.7%) | 109 (100.0%) | 108 (99.1%) | 109 (100.0%) | 105 (96.3%) | 105 (96.3%) | 98 (89.9%) | 100 (91.7%) | 83 (76.1%) | 109 (100.0%) | 108 (99.1%) | 109 (100.0%) | 100 (91.7%) | 109 (100.0%) | 109 (100.0%) | 109 (100.0%) | 104 (95.4%) | 109 (100.0%) | 105 (96.3%) | 109 (100.0%) | 95 (87.2%) |
| script | 13 | 7 (53.8%) | 5 (38.5%) | 7 (53.8%) | 3 (23.1%) | 7 (53.8%) | 3 (23.1%) | 3 (23.1%) | 3 (23.1%) | 8 (61.5%) | 7 (53.8%) | 6 (46.2%) | 7 (53.8%) | 6 (46.2%) | 7 (53.8%) | 3 (23.1%) | 7 (53.8%) | 3 (23.1%) | 7 (53.8%) | 3 (23.1%) | 7 (53.8%) | 3 (23.1%) | 7 (53.8%) | 6 (46.2%) | 7 (53.8%) | 6 (46.2%) | 7 (53.8%) | 3 (23.1%) | 7 (53.8%) | 3 (23.1%) | 7 (53.8%) | 3 (23.1%) | 7 (53.8%) | 3 (23.1%) |

## nemo-test (held out)

36 documents; licence no data licence stated (guidelines CC-BY-4.0; the underlying Hebrew Treebank text is CC-BY-NC-SA-4.0 in UD_Hebrew-HTB); contamination: msperka-dicta, aleph, joint-base, parse-base, tiny-parse.

Overlap untyped unless named. Lost/gained: must entities the baseline finds and this row misses, and the other way.

| Model | Stage | Cut-off | Gold | TP | FP | FN | P | R | R 95% | F1 | F2 | PER R | Word-exact F1 | Entity R | Traps hit | Added R | Lost / gained | R gain vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aleph | cleaned | – | 922 | 768 | 102 | 154 | 0.883 | 0.833 | [0.786, 0.871] | 0.857 | 0.842 | 0.820 | 0.779 | 0.833 | – | – | 33 / 68 | +0.038 [0.001, 0.083] |
| aleph | raw | 0.30 tune | 922 | 878 | 105 | 44 | 0.893 | 0.952 | [0.927, 0.970] | 0.922 | 0.940 | 0.925 | 0.839 | 0.952 | – | – | 22 / 98 | +0.082 [0.051, 0.125] |
| base-q8-ft | cleaned | – | 922 | 784 | 74 | 138 | 0.914 | 0.850 | [0.803, 0.890] | 0.881 | 0.862 | 0.865 | 0.826 | 0.850 | – | – | 8 / 59 | +0.055 [0.030, 0.090] |
| base-q8-ft | raw | 0.30 tune | 922 | 874 | 57 | 48 | 0.939 | 0.948 | [0.910, 0.975] | 0.943 | 0.946 | 0.959 | 0.893 | 0.948 | – | – | 2 / 74 | +0.078 [0.044, 0.123] |
| base-q8 | cleaned | – | 922 | 733 | 64 | 189 | 0.920 | 0.795 | [0.733, 0.845] | 0.853 | 0.817 | 0.824 | 0.809 | 0.795 | – | – | – | – |
| base-q8 | raw | 0.60 shipped | 922 | 802 | 35 | 120 | 0.958 | 0.870 | [0.816, 0.911] | 0.912 | 0.886 | 0.903 | 0.870 | 0.870 | – | – | – | – |
| base-q8 | raw | 0.30 tune | 922 | 821 | 39 | 101 | 0.955 | 0.890 | [0.841, 0.926] | 0.921 | 0.903 | 0.914 | 0.875 | 0.890 | – | – | – | – |
| golem | cleaned | – | 922 | 406 | 91 | 516 | 0.817 | 0.440 | [0.392, 0.488] | 0.572 | 0.485 | 0.618 | 0.268 | 0.440 | – | – | 373 / 46 | -0.355 [-0.422, -0.268] |
| golem | raw | 0.40 tune | 922 | 447 | 123 | 475 | 0.784 | 0.485 | [0.435, 0.531] | 0.599 | 0.525 | 0.715 | 0.265 | 0.485 | – | – | 394 / 39 | -0.385 [-0.449, -0.312] |
| iahlt-base-ft | cleaned | – | 922 | 714 | 85 | 208 | 0.894 | 0.774 | [0.711, 0.827] | 0.830 | 0.796 | 0.768 | 0.722 | 0.774 | – | – | 80 / 61 | -0.021 [-0.065, 0.024] |
| iahlt-base-ft | raw | 0.30 tune | 922 | 811 | 64 | 111 | 0.927 | 0.880 | [0.838, 0.915] | 0.903 | 0.889 | 0.873 | 0.781 | 0.880 | – | – | 63 / 72 | +0.010 [-0.033, 0.060] |
| iahlt-base | cleaned | – | 922 | 697 | 74 | 225 | 0.904 | 0.756 | [0.693, 0.808] | 0.823 | 0.782 | 0.753 | 0.714 | 0.756 | – | – | 86 / 50 | -0.039 [-0.079, 0.002] |
| iahlt-base | raw | 0.35 tune | 922 | 804 | 58 | 118 | 0.933 | 0.872 | [0.832, 0.905] | 0.901 | 0.884 | 0.861 | 0.763 | 0.872 | – | – | 61 / 63 | +0.002 [-0.036, 0.050] |
| joint-base-ft | cleaned | – | 922 | 781 | 59 | 141 | 0.930 | 0.847 | [0.793, 0.890] | 0.886 | 0.862 | 0.869 | 0.825 | 0.847 | – | – | 15 / 63 | +0.052 [0.019, 0.092] |
| joint-base-ft | raw | 0.40 tune | 922 | 878 | 68 | 44 | 0.928 | 0.952 | [0.920, 0.975] | 0.940 | 0.947 | 0.970 | 0.866 | 0.952 | – | – | 11 / 87 | +0.082 [0.045, 0.130] |
| joint-base | cleaned | – | 922 | 766 | 68 | 156 | 0.918 | 0.831 | [0.776, 0.872] | 0.872 | 0.847 | 0.850 | 0.804 | 0.831 | – | – | 24 / 57 | +0.036 [0.002, 0.074] |
| joint-base | raw | 0.30 tune | 922 | 857 | 57 | 65 | 0.938 | 0.930 | [0.895, 0.953] | 0.934 | 0.931 | 0.955 | 0.859 | 0.930 | – | – | 15 / 70 | +0.060 [0.028, 0.099] |
| large-q8-ft | cleaned | – | 922 | 777 | 67 | 145 | 0.921 | 0.843 | [0.788, 0.886] | 0.880 | 0.857 | 0.854 | 0.819 | 0.843 | – | – | 12 / 56 | +0.048 [0.021, 0.083] |
| large-q8-ft | raw | 0.50 tune | 922 | 853 | 59 | 69 | 0.935 | 0.925 | [0.886, 0.954] | 0.930 | 0.927 | 0.944 | 0.877 | 0.925 | – | – | 20 / 71 | +0.055 [0.024, 0.096] |
| large-q8 | cleaned | – | 922 | 704 | 68 | 218 | 0.912 | 0.764 | [0.686, 0.819] | 0.831 | 0.789 | 0.824 | 0.771 | 0.764 | – | – | 62 / 33 | -0.031 [-0.072, -0.003] |
| large-q8 | raw | 0.30 tune | 922 | 795 | 42 | 127 | 0.950 | 0.862 | [0.800, 0.907] | 0.904 | 0.878 | 0.910 | 0.830 | 0.862 | – | – | 48 / 41 | -0.008 [-0.036, 0.015] |
| msperka-dicta-ft | cleaned | – | 922 | 760 | 42 | 162 | 0.948 | 0.824 | [0.773, 0.863] | 0.882 | 0.846 | 0.858 | 0.829 | 0.824 | – | – | 38 / 65 | +0.029 [-0.002, 0.066] |
| msperka-dicta-ft | raw | 0.30 tune | 922 | 877 | 60 | 45 | 0.936 | 0.951 | [0.927, 0.970] | 0.944 | 0.948 | 0.970 | 0.881 | 0.951 | – | – | 23 / 98 | +0.081 [0.043, 0.132] |
| msperka-dicta | cleaned | – | 922 | 724 | 32 | 198 | 0.958 | 0.785 | [0.721, 0.834] | 0.863 | 0.815 | 0.835 | 0.800 | 0.785 | – | – | 57 / 48 | -0.010 [-0.050, 0.027] |
| msperka-dicta | raw | 0.30 tune | 922 | 860 | 62 | 62 | 0.933 | 0.933 | [0.895, 0.961] | 0.933 | 0.933 | 0.951 | 0.858 | 0.933 | – | – | 23 / 81 | +0.063 [0.031, 0.103] |
| parse-base-ft | cleaned | – | 922 | 794 | 62 | 128 | 0.928 | 0.861 | [0.818, 0.896] | 0.893 | 0.874 | 0.876 | 0.832 | 0.861 | – | – | 12 / 73 | +0.066 [0.037, 0.103] |
| parse-base-ft | raw | 0.30 tune | 922 | 901 | 65 | 21 | 0.933 | 0.977 | [0.959, 0.990] | 0.954 | 0.968 | 0.974 | 0.892 | 0.977 | – | – | 3 / 102 | +0.107 [0.067, 0.160] |
| parse-base | cleaned | – | 922 | 783 | 63 | 139 | 0.926 | 0.849 | [0.804, 0.887] | 0.886 | 0.863 | 0.854 | 0.824 | 0.849 | – | – | 11 / 61 | +0.054 [0.026, 0.089] |
| parse-base | raw | 0.30 tune | 922 | 886 | 52 | 36 | 0.945 | 0.961 | [0.933, 0.979] | 0.953 | 0.958 | 0.963 | 0.889 | 0.961 | – | – | 6 / 90 | +0.091 [0.057, 0.137] |
| tiny-parse-ft | cleaned | – | 922 | 786 | 100 | 136 | 0.887 | 0.852 | [0.808, 0.887] | 0.869 | 0.859 | 0.843 | 0.802 | 0.852 | – | – | 15 / 68 | +0.057 [0.026, 0.095] |
| tiny-parse-ft | raw | 0.30 tune | 922 | 894 | 85 | 28 | 0.913 | 0.970 | [0.945, 0.985] | 0.941 | 0.958 | 0.948 | 0.866 | 0.970 | – | – | 3 / 95 | +0.100 [0.062, 0.148] |
| tiny-parse | cleaned | – | 922 | 775 | 98 | 147 | 0.888 | 0.841 | [0.791, 0.877] | 0.864 | 0.850 | 0.835 | 0.784 | 0.841 | – | – | 19 / 61 | +0.046 [0.011, 0.085] |
| tiny-parse | raw | 0.30 tune | 922 | 874 | 84 | 48 | 0.912 | 0.948 | [0.914, 0.971] | 0.930 | 0.941 | 0.933 | 0.849 | 0.948 | – | – | 7 / 79 | +0.078 [0.049, 0.113] |

Per type, overlap typed (P / R / F2):

| Model | Stage | Cut-off | PER | ORG | PLACE |
|---|---|---|---|---|---|
| aleph | cleaned | – | 0.936 / 0.820 / 0.841 (n 267) | 0.777 / 0.777 / 0.777 (n 408) | 0.890 / 0.822 / 0.835 (n 247) |
| aleph | raw | 0.30 | 0.936 / 0.925 / 0.927 (n 267) | 0.785 / 0.912 / 0.883 (n 408) | 0.894 / 0.887 / 0.888 (n 247) |
| base-q8-ft | cleaned | – | 0.967 / 0.865 / 0.884 (n 267) | 0.907 / 0.792 / 0.812 (n 408) | 0.787 / 0.838 / 0.827 (n 247) |
| base-q8-ft | raw | 0.30 | 0.977 / 0.959 / 0.962 (n 267) | 0.905 / 0.909 / 0.908 (n 408) | 0.857 / 0.899 / 0.890 (n 247) |
| base-q8 | cleaned | – | 0.969 / 0.824 / 0.849 (n 267) | 0.926 / 0.765 / 0.792 (n 408) | 0.785 / 0.741 / 0.749 (n 247) |
| base-q8 | raw | 0.60 | 0.984 / 0.903 / 0.918 (n 267) | 0.934 / 0.863 / 0.876 (n 408) | 0.874 / 0.761 / 0.781 (n 247) |
| base-q8 | raw | 0.30 | 0.980 / 0.914 / 0.926 (n 267) | 0.930 / 0.875 / 0.885 (n 408) | 0.877 / 0.806 / 0.819 (n 247) |
| golem | cleaned | – | 0.491 / 0.618 / 0.588 (n 267) | 0.000 / 0.000 / 0.000 (n 408) | 0.484 / 0.316 / 0.339 (n 247) |
| golem | raw | 0.40 | 0.479 / 0.715 / 0.651 (n 267) | 0.000 / 0.000 / 0.000 (n 408) | 0.427 / 0.296 / 0.315 (n 247) |
| iahlt-base-ft | cleaned | – | 0.932 / 0.768 / 0.796 (n 267) | 0.880 / 0.718 / 0.746 (n 408) | 0.764 / 0.761 / 0.762 (n 247) |
| iahlt-base-ft | raw | 0.30 | 0.975 / 0.873 / 0.891 (n 267) | 0.870 / 0.833 / 0.840 (n 408) | 0.853 / 0.846 / 0.848 (n 247) |
| iahlt-base | cleaned | – | 0.935 / 0.753 / 0.783 (n 267) | 0.858 / 0.696 / 0.723 (n 408) | 0.782 / 0.713 / 0.725 (n 247) |
| iahlt-base | raw | 0.35 | 0.966 / 0.861 / 0.881 (n 267) | 0.862 / 0.824 / 0.831 (n 408) | 0.846 / 0.802 / 0.810 (n 247) |
| joint-base-ft | cleaned | – | 0.987 / 0.869 / 0.890 (n 267) | 0.902 / 0.767 / 0.791 (n 408) | 0.798 / 0.834 / 0.827 (n 247) |
| joint-base-ft | raw | 0.40 | 0.992 / 0.970 / 0.974 (n 267) | 0.879 / 0.892 / 0.890 (n 408) | 0.819 / 0.899 / 0.882 (n 247) |
| joint-base | cleaned | – | 0.987 / 0.850 / 0.874 (n 267) | 0.896 / 0.740 / 0.767 (n 408) | 0.760 / 0.822 / 0.809 (n 247) |
| joint-base | raw | 0.30 | 0.992 / 0.955 / 0.962 (n 267) | 0.886 / 0.875 / 0.877 (n 408) | 0.819 / 0.842 / 0.837 (n 247) |
| large-q8-ft | cleaned | – | 0.962 / 0.854 / 0.874 (n 267) | 0.907 / 0.792 / 0.812 (n 408) | 0.813 / 0.826 / 0.823 (n 247) |
| large-q8-ft | raw | 0.50 | 0.973 / 0.944 / 0.950 (n 267) | 0.888 / 0.890 / 0.889 (n 408) | 0.889 / 0.879 / 0.881 (n 247) |
| large-q8 | cleaned | – | 0.948 / 0.824 / 0.846 (n 267) | 0.910 / 0.694 / 0.728 (n 408) | 0.782 / 0.725 / 0.735 (n 247) |
| large-q8 | raw | 0.30 | 0.964 / 0.910 / 0.920 (n 267) | 0.909 / 0.809 / 0.827 (n 408) | 0.838 / 0.753 / 0.769 (n 247) |
| msperka-dicta-ft | cleaned | – | 0.970 / 0.858 / 0.878 (n 267) | 0.893 / 0.799 / 0.816 (n 408) | 0.910 / 0.741 / 0.770 (n 247) |
| msperka-dicta-ft | raw | 0.30 | 0.974 / 0.970 / 0.971 (n 267) | 0.873 / 0.926 / 0.915 (n 408) | 0.899 / 0.866 / 0.873 (n 247) |
| msperka-dicta | cleaned | – | 0.961 / 0.835 / 0.858 (n 267) | 0.916 / 0.779 / 0.803 (n 408) | 0.887 / 0.636 / 0.674 (n 247) |
| msperka-dicta | raw | 0.30 | 0.966 / 0.951 / 0.954 (n 267) | 0.848 / 0.917 / 0.902 (n 408) | 0.904 / 0.798 / 0.817 (n 247) |
| parse-base-ft | cleaned | – | 0.992 / 0.876 / 0.897 (n 267) | 0.893 / 0.794 / 0.812 (n 408) | 0.829 / 0.862 / 0.855 (n 247) |
| parse-base-ft | raw | 0.30 | 0.985 / 0.974 / 0.976 (n 267) | 0.883 / 0.944 / 0.931 (n 408) | 0.868 / 0.935 / 0.921 (n 247) |
| parse-base | cleaned | – | 0.996 / 0.854 / 0.879 (n 267) | 0.892 / 0.792 / 0.810 (n 408) | 0.804 / 0.830 / 0.825 (n 247) |
| parse-base | raw | 0.30 | 0.996 / 0.963 / 0.969 (n 267) | 0.906 / 0.946 / 0.938 (n 408) | 0.854 / 0.879 / 0.874 (n 247) |
| tiny-parse-ft | cleaned | – | 0.904 / 0.843 / 0.854 (n 267) | 0.857 / 0.809 / 0.818 (n 408) | 0.829 / 0.846 / 0.843 (n 247) |
| tiny-parse-ft | raw | 0.30 | 0.913 / 0.948 / 0.941 (n 267) | 0.869 / 0.961 / 0.941 (n 408) | 0.888 / 0.903 / 0.900 (n 247) |
| tiny-parse | cleaned | – | 0.903 / 0.835 / 0.848 (n 267) | 0.847 / 0.801 / 0.810 (n 408) | 0.838 / 0.814 / 0.818 (n 247) |
| tiny-parse | raw | 0.30 | 0.919 / 0.933 / 0.930 (n 267) | 0.867 / 0.944 / 0.927 (n 408) | 0.877 / 0.862 / 0.865 (n 247) |

## protocol (held out)

1 documents; licence public Knesset protocol.

Overlap untyped unless named. Lost/gained: must entities the baseline finds and this row misses, and the other way.

| Model | Stage | Cut-off | Gold | TP | FP | FN | P | R | R 95% | F1 | F2 | PER R | Word-exact F1 | Entity R | Traps hit | Added R | Lost / gained | R gain vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aleph | cleaned | – | 133 | 102 | 12 | 31 | 0.895 | 0.767 | [0.767, 0.767] | 0.826 | 0.789 | 0.859 | 0.696 | 0.767 | – | – | 2 / 10 | +0.060 [0.060, 0.060] |
| aleph | raw | 0.30 tune | 133 | 129 | 9 | 4 | 0.935 | 0.970 | [0.970, 0.970] | 0.952 | 0.963 | 0.972 | 0.827 | 0.970 | – | – | 1 / 21 | +0.150 [0.150, 0.150] |
| base-q8-ft | cleaned | – | 133 | 97 | 18 | 36 | 0.843 | 0.729 | [0.729, 0.729] | 0.782 | 0.750 | 0.817 | 0.710 | 0.729 | – | – | 1 / 4 | +0.023 [0.023, 0.023] |
| base-q8-ft | raw | 0.30 tune | 133 | 117 | 4 | 16 | 0.967 | 0.880 | [0.880, 0.880] | 0.921 | 0.896 | 0.915 | 0.858 | 0.880 | – | – | 0 / 8 | +0.060 [0.060, 0.060] |
| base-q8 | cleaned | – | 133 | 94 | 16 | 39 | 0.855 | 0.707 | [0.707, 0.707] | 0.774 | 0.732 | 0.831 | 0.691 | 0.707 | – | – | – | – |
| base-q8 | raw | 0.60 shipped | 133 | 109 | 5 | 24 | 0.956 | 0.820 | [0.820, 0.820] | 0.883 | 0.844 | 0.887 | 0.802 | 0.820 | – | – | – | – |
| base-q8 | raw | 0.30 tune | 133 | 115 | 7 | 18 | 0.943 | 0.865 | [0.865, 0.865] | 0.902 | 0.879 | 0.887 | 0.800 | 0.865 | – | – | – | – |
| golem | cleaned | – | 133 | 69 | 4 | 64 | 0.945 | 0.519 | [0.519, 0.519] | 0.670 | 0.570 | 0.732 | 0.466 | 0.519 | – | – | 28 / 3 | -0.188 [-0.188, -0.188] |
| golem | raw | 0.40 tune | 133 | 72 | 11 | 61 | 0.867 | 0.541 | [0.541, 0.541] | 0.667 | 0.585 | 0.789 | 0.435 | 0.541 | – | – | 41 / 4 | -0.278 [-0.278, -0.278] |
| iahlt-base-ft | cleaned | – | 133 | 88 | 4 | 45 | 0.957 | 0.662 | [0.662, 0.662] | 0.782 | 0.705 | 0.803 | 0.693 | 0.662 | – | – | 10 / 4 | -0.045 [-0.045, -0.045] |
| iahlt-base-ft | raw | 0.30 tune | 133 | 114 | 4 | 19 | 0.966 | 0.857 | [0.857, 0.857] | 0.908 | 0.877 | 0.915 | 0.821 | 0.857 | – | – | 7 / 12 | +0.038 [0.038, 0.038] |
| iahlt-base | cleaned | – | 133 | 83 | 0 | 50 | 1.000 | 0.624 | [0.624, 0.624] | 0.769 | 0.675 | 0.817 | 0.639 | 0.624 | – | – | 16 / 5 | -0.083 [-0.083, -0.083] |
| iahlt-base | raw | 0.35 tune | 133 | 114 | 1 | 19 | 0.991 | 0.857 | [0.857, 0.857] | 0.919 | 0.881 | 0.944 | 0.831 | 0.857 | – | – | 6 / 11 | +0.038 [0.038, 0.038] |
| joint-base-ft | cleaned | – | 133 | 99 | 1 | 34 | 0.990 | 0.744 | [0.744, 0.744] | 0.850 | 0.783 | 0.859 | 0.781 | 0.744 | – | – | 0 / 5 | +0.038 [0.038, 0.038] |
| joint-base-ft | raw | 0.40 tune | 133 | 123 | 4 | 10 | 0.969 | 0.925 | [0.925, 0.925] | 0.946 | 0.933 | 0.958 | 0.892 | 0.925 | – | – | 2 / 16 | +0.105 [0.105, 0.105] |
| joint-base | cleaned | – | 133 | 97 | 14 | 36 | 0.874 | 0.729 | [0.729, 0.729] | 0.795 | 0.754 | 0.859 | 0.721 | 0.729 | – | – | 0 / 3 | +0.023 [0.023, 0.023] |
| joint-base | raw | 0.30 tune | 133 | 122 | 4 | 11 | 0.968 | 0.917 | [0.917, 0.917] | 0.942 | 0.927 | 0.958 | 0.849 | 0.917 | – | – | 0 / 13 | +0.098 [0.098, 0.098] |
| large-q8-ft | cleaned | – | 133 | 94 | 29 | 39 | 0.764 | 0.707 | [0.707, 0.707] | 0.734 | 0.718 | 0.817 | 0.648 | 0.707 | – | – | 3 / 3 | +0.000 [0.000, 0.000] |
| large-q8-ft | raw | 0.50 tune | 133 | 117 | 2 | 16 | 0.983 | 0.880 | [0.880, 0.880] | 0.929 | 0.899 | 0.901 | 0.825 | 0.880 | – | – | 4 / 12 | +0.060 [0.060, 0.060] |
| large-q8 | cleaned | – | 133 | 92 | 31 | 41 | 0.748 | 0.692 | [0.692, 0.692] | 0.719 | 0.702 | 0.803 | 0.664 | 0.692 | – | – | 3 / 1 | -0.015 [-0.015, -0.015] |
| large-q8 | raw | 0.30 tune | 133 | 113 | 3 | 20 | 0.974 | 0.850 | [0.850, 0.850] | 0.908 | 0.872 | 0.845 | 0.811 | 0.850 | – | – | 5 / 9 | +0.030 [0.030, 0.030] |
| msperka-dicta-ft | cleaned | – | 133 | 95 | 4 | 38 | 0.960 | 0.714 | [0.714, 0.714] | 0.819 | 0.753 | 0.845 | 0.759 | 0.714 | – | – | 7 / 8 | +0.008 [0.008, 0.008] |
| msperka-dicta-ft | raw | 0.30 tune | 133 | 129 | 6 | 4 | 0.956 | 0.970 | [0.970, 0.970] | 0.963 | 0.967 | 0.972 | 0.925 | 0.970 | – | – | 2 / 22 | +0.150 [0.150, 0.150] |
| msperka-dicta | cleaned | – | 133 | 100 | 6 | 33 | 0.943 | 0.752 | [0.752, 0.752] | 0.837 | 0.784 | 0.845 | 0.770 | 0.752 | – | – | 2 / 8 | +0.045 [0.045, 0.045] |
| msperka-dicta | raw | 0.30 tune | 133 | 128 | 8 | 5 | 0.941 | 0.962 | [0.962, 0.962] | 0.952 | 0.958 | 0.958 | 0.907 | 0.962 | – | – | 1 / 20 | +0.143 [0.143, 0.143] |
| parse-base-ft | cleaned | – | 133 | 95 | 12 | 38 | 0.888 | 0.714 | [0.714, 0.714] | 0.792 | 0.743 | 0.859 | 0.700 | 0.714 | – | – | 6 / 7 | +0.008 [0.008, 0.008] |
| parse-base-ft | raw | 0.30 tune | 133 | 126 | 6 | 7 | 0.955 | 0.947 | [0.947, 0.947] | 0.951 | 0.949 | 0.958 | 0.891 | 0.947 | – | – | 1 / 18 | +0.128 [0.128, 0.128] |
| parse-base | cleaned | – | 133 | 99 | 14 | 34 | 0.876 | 0.744 | [0.744, 0.744] | 0.805 | 0.767 | 0.859 | 0.740 | 0.744 | – | – | 2 / 7 | +0.038 [0.038, 0.038] |
| parse-base | raw | 0.30 tune | 133 | 129 | 5 | 4 | 0.963 | 0.970 | [0.970, 0.970] | 0.966 | 0.968 | 0.958 | 0.891 | 0.970 | – | – | 0 / 20 | +0.150 [0.150, 0.150] |
| tiny-parse-ft | cleaned | – | 133 | 101 | 83 | 32 | 0.549 | 0.759 | [0.759, 0.759] | 0.637 | 0.705 | 0.831 | 0.530 | 0.759 | – | – | 2 / 9 | +0.053 [0.053, 0.053] |
| tiny-parse-ft | raw | 0.30 tune | 133 | 127 | 19 | 6 | 0.870 | 0.955 | [0.955, 0.955] | 0.910 | 0.937 | 0.915 | 0.789 | 0.955 | – | – | 1 / 19 | +0.135 [0.135, 0.135] |
| tiny-parse | cleaned | – | 133 | 101 | 48 | 32 | 0.678 | 0.759 | [0.759, 0.759] | 0.716 | 0.742 | 0.831 | 0.574 | 0.759 | – | – | 4 / 11 | +0.053 [0.053, 0.053] |
| tiny-parse | raw | 0.30 tune | 133 | 125 | 15 | 8 | 0.893 | 0.940 | [0.940, 0.940] | 0.916 | 0.930 | 0.901 | 0.747 | 0.940 | – | – | 3 / 19 | +0.120 [0.120, 0.120] |

Per type, overlap typed (P / R / F2):

| Model | Stage | Cut-off | PER | ORG | PLACE |
|---|---|---|---|---|---|
| aleph | cleaned | – | 0.803 / 0.859 / 0.847 (n 71) | 0.862 / 0.490 / 0.536 (n 51) | 1.000 / 0.818 / 0.849 (n 11) |
| aleph | raw | 0.30 | 0.908 / 0.972 / 0.958 (n 71) | 0.868 / 0.902 / 0.895 (n 51) | 1.000 / 0.818 / 0.849 (n 11) |
| base-q8-ft | cleaned | – | 0.935 / 0.817 / 0.838 (n 71) | 0.811 / 0.588 / 0.622 (n 51) | 0.563 / 0.818 / 0.750 (n 11) |
| base-q8-ft | raw | 0.30 | 0.970 / 0.915 / 0.926 (n 71) | 0.909 / 0.784 / 0.806 (n 51) | 0.900 / 0.818 / 0.833 (n 11) |
| base-q8 | cleaned | – | 0.922 / 0.831 / 0.848 (n 71) | 0.806 / 0.490 / 0.532 (n 51) | 0.467 / 0.636 / 0.593 (n 11) |
| base-q8 | raw | 0.60 | 0.940 / 0.887 / 0.897 (n 71) | 0.868 / 0.647 / 0.682 (n 51) | 0.778 / 0.636 / 0.660 (n 11) |
| base-q8 | raw | 0.30 | 0.900 / 0.887 / 0.890 (n 71) | 0.881 / 0.725 / 0.752 (n 51) | 0.800 / 0.727 / 0.741 (n 11) |
| golem | cleaned | – | 0.776 / 0.732 / 0.741 (n 71) | 0.000 / 0.000 / 0.000 (n 51) | 0.500 / 0.273 / 0.300 (n 11) |
| golem | raw | 0.40 | 0.789 / 0.789 / 0.789 (n 71) | 0.000 / 0.000 / 0.000 (n 51) | 0.333 / 0.364 / 0.357 (n 11) |
| iahlt-base-ft | cleaned | – | 1.000 / 0.803 / 0.836 (n 71) | 0.760 / 0.373 / 0.415 (n 51) | 0.900 / 0.818 / 0.833 (n 11) |
| iahlt-base-ft | raw | 0.30 | 1.000 / 0.915 / 0.931 (n 71) | 0.860 / 0.725 / 0.749 (n 51) | 0.900 / 0.818 / 0.833 (n 11) |
| iahlt-base | cleaned | – | 1.000 / 0.817 / 0.848 (n 71) | 0.909 / 0.196 / 0.233 (n 51) | 0.643 / 0.818 / 0.776 (n 11) |
| iahlt-base | raw | 0.35 | 1.000 / 0.944 / 0.954 (n 71) | 0.972 / 0.686 / 0.729 (n 51) | 0.750 / 0.818 / 0.804 (n 11) |
| joint-base-ft | cleaned | – | 1.000 / 0.859 / 0.884 (n 71) | 0.967 / 0.569 / 0.620 (n 51) | 1.000 / 0.818 / 0.849 (n 11) |
| joint-base-ft | raw | 0.40 | 1.000 / 0.958 / 0.966 (n 71) | 0.898 / 0.863 / 0.870 (n 51) | 1.000 / 0.909 / 0.926 (n 11) |
| joint-base | cleaned | – | 0.938 / 0.859 / 0.874 (n 71) | 0.867 / 0.510 / 0.556 (n 51) | 0.500 / 0.727 / 0.667 (n 11) |
| joint-base | raw | 0.30 | 0.944 / 0.958 / 0.955 (n 71) | 0.884 / 0.745 / 0.769 (n 51) | 0.818 / 0.818 / 0.818 (n 11) |
| large-q8-ft | cleaned | – | 0.892 / 0.817 / 0.831 (n 71) | 0.460 / 0.451 / 0.453 (n 51) | 1.000 / 0.727 / 0.769 (n 11) |
| large-q8-ft | raw | 0.50 | 0.914 / 0.901 / 0.904 (n 71) | 0.925 / 0.725 / 0.758 (n 51) | 0.889 / 0.727 / 0.755 (n 11) |
| large-q8 | cleaned | – | 0.826 / 0.803 / 0.807 (n 71) | 0.565 / 0.510 / 0.520 (n 51) | 1.000 / 0.727 / 0.769 (n 11) |
| large-q8 | raw | 0.30 | 0.938 / 0.845 / 0.862 (n 71) | 0.881 / 0.725 / 0.752 (n 51) | 0.800 / 0.727 / 0.741 (n 11) |
| msperka-dicta-ft | cleaned | – | 1.000 / 0.845 / 0.872 (n 71) | 0.833 / 0.490 / 0.534 (n 51) | 1.000 / 0.818 / 0.849 (n 11) |
| msperka-dicta-ft | raw | 0.30 | 1.000 / 0.972 / 0.977 (n 71) | 0.877 / 0.980 / 0.958 (n 51) | 1.000 / 0.818 / 0.849 (n 11) |
| msperka-dicta | cleaned | – | 0.938 / 0.845 / 0.862 (n 71) | 0.882 / 0.588 / 0.630 (n 51) | 1.000 / 0.727 / 0.769 (n 11) |
| msperka-dicta | raw | 0.30 | 0.971 / 0.958 / 0.960 (n 71) | 0.828 / 0.941 / 0.916 (n 51) | 1.000 / 0.727 / 0.769 (n 11) |
| parse-base-ft | cleaned | – | 0.984 / 0.859 / 0.882 (n 71) | 0.667 / 0.471 / 0.500 (n 51) | 1.000 / 0.818 / 0.849 (n 11) |
| parse-base-ft | raw | 0.30 | 0.986 / 0.958 / 0.963 (n 71) | 0.868 / 0.902 / 0.895 (n 51) | 0.900 / 0.818 / 0.833 (n 11) |
| parse-base | cleaned | – | 0.938 / 0.859 / 0.874 (n 71) | 0.879 / 0.569 / 0.612 (n 51) | 0.533 / 0.727 / 0.678 (n 11) |
| parse-base | raw | 0.30 | 0.971 / 0.958 / 0.960 (n 71) | 0.887 / 0.922 / 0.914 (n 51) | 0.818 / 0.818 / 0.818 (n 11) |
| tiny-parse-ft | cleaned | – | 0.602 / 0.831 / 0.772 (n 71) | 0.389 / 0.549 / 0.507 (n 51) | 0.500 / 0.636 / 0.603 (n 11) |
| tiny-parse-ft | raw | 0.30 | 0.878 / 0.915 / 0.908 (n 71) | 0.793 / 0.902 / 0.878 (n 51) | 0.571 / 0.727 / 0.690 (n 11) |
| tiny-parse | cleaned | – | 0.776 / 0.831 / 0.819 (n 71) | 0.718 / 0.549 / 0.576 (n 51) | 0.235 / 0.727 / 0.513 (n 11) |
| tiny-parse | raw | 0.30 | 0.889 / 0.901 / 0.899 (n 71) | 0.830 / 0.863 / 0.856 (n 51) | 0.533 / 0.727 / 0.678 (n 11) |

## synthetic-test

19 documents; licence repo.

Overlap untyped unless named. Lost/gained: must entities the baseline finds and this row misses, and the other way.

| Model | Stage | Cut-off | Gold | TP | FP | FN | P | R | R 95% | F1 | F2 | PER R | Word-exact F1 | Entity R | Traps hit | Added R | Lost / gained | R gain vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aleph | cleaned | – | 223 | 153 | 18 | 70 | 0.895 | 0.686 | [0.615, 0.766] | 0.777 | 0.720 | 0.661 | 0.624 | 0.915 | 1/35 | 81.3% of 75 | 2 / 6 | +0.058 [-0.009, 0.131] |
| aleph | raw | 0.30 tune | 223 | 209 | 29 | 14 | 0.878 | 0.937 | [0.844, 0.991] | 0.907 | 0.925 | 0.942 | 0.768 | 0.968 | 6/35 | 97.3% of 75 | 1 / 8 | +0.121 [0.052, 0.201] |
| base-q8-ft | cleaned | – | 223 | 145 | 12 | 78 | 0.924 | 0.650 | [0.593, 0.717] | 0.763 | 0.691 | 0.646 | 0.653 | 0.915 | 0/35 | 70.7% of 75 | 0 / 4 | +0.022 [-0.018, 0.075] |
| base-q8-ft | raw | 0.30 tune | 223 | 196 | 10 | 27 | 0.951 | 0.879 | [0.791, 0.945] | 0.914 | 0.893 | 0.899 | 0.802 | 0.957 | 4/35 | 89.3% of 75 | 0 / 6 | +0.063 [0.027, 0.103] |
| base-q8 | cleaned | – | 223 | 140 | 9 | 83 | 0.940 | 0.628 | [0.578, 0.677] | 0.753 | 0.672 | 0.614 | 0.629 | 0.872 | 0/35 | 65.3% of 75 | – | – |
| base-q8 | raw | 0.60 shipped | 223 | 182 | 7 | 41 | 0.963 | 0.816 | [0.725, 0.891] | 0.883 | 0.842 | 0.841 | 0.772 | 0.894 | 5/35 | 81.3% of 75 | – | – |
| base-q8 | raw | 0.30 tune | 223 | 187 | 7 | 36 | 0.964 | 0.839 | [0.751, 0.912] | 0.897 | 0.861 | 0.847 | 0.772 | 0.915 | 5/35 | 84.0% of 75 | – | – |
| golem | cleaned | – | 223 | 124 | 12 | 99 | 0.912 | 0.556 | [0.502, 0.610] | 0.691 | 0.603 | 0.571 | 0.540 | 0.787 | 1/35 | 56.0% of 75 | 12 / 4 | -0.072 [-0.153, 0.005] |
| golem | raw | 0.40 tune | 223 | 157 | 12 | 66 | 0.929 | 0.704 | [0.661, 0.746] | 0.801 | 0.740 | 0.741 | 0.658 | 0.851 | 1/35 | 60.0% of 75 | 8 / 4 | -0.112 [-0.174, -0.025] |
| iahlt-base-ft | cleaned | – | 223 | 146 | 10 | 77 | 0.936 | 0.655 | [0.576, 0.738] | 0.770 | 0.697 | 0.646 | 0.665 | 0.904 | 0/35 | 76.0% of 75 | 2 / 5 | +0.027 [-0.053, 0.115] |
| iahlt-base-ft | raw | 0.30 tune | 223 | 198 | 7 | 25 | 0.966 | 0.888 | [0.803, 0.949] | 0.925 | 0.902 | 0.894 | 0.818 | 0.957 | 5/35 | 92.0% of 75 | 0 / 6 | +0.072 [0.013, 0.147] |
| iahlt-base | cleaned | – | 223 | 143 | 10 | 80 | 0.935 | 0.641 | [0.581, 0.698] | 0.761 | 0.684 | 0.635 | 0.644 | 0.883 | 0/35 | 70.7% of 75 | 5 / 6 | +0.013 [-0.050, 0.081] |
| iahlt-base | raw | 0.35 tune | 223 | 190 | 7 | 33 | 0.964 | 0.852 | [0.774, 0.907] | 0.905 | 0.872 | 0.852 | 0.781 | 0.936 | 5/35 | 86.7% of 75 | 2 / 6 | +0.036 [-0.016, 0.094] |
| joint-base-ft | cleaned | – | 223 | 149 | 9 | 74 | 0.943 | 0.668 | [0.606, 0.734] | 0.782 | 0.710 | 0.672 | 0.672 | 0.915 | 0/35 | 74.7% of 75 | 1 / 5 | +0.040 [-0.022, 0.112] |
| joint-base-ft | raw | 0.40 tune | 223 | 201 | 11 | 22 | 0.948 | 0.901 | [0.813, 0.962] | 0.924 | 0.910 | 0.931 | 0.823 | 0.957 | 5/35 | 92.0% of 75 | 1 / 7 | +0.085 [0.032, 0.145] |
| joint-base | cleaned | – | 223 | 150 | 13 | 73 | 0.920 | 0.673 | [0.587, 0.748] | 0.777 | 0.711 | 0.646 | 0.632 | 0.894 | 0/35 | 81.3% of 75 | 3 / 5 | +0.045 [-0.040, 0.115] |
| joint-base | raw | 0.30 tune | 223 | 198 | 14 | 25 | 0.934 | 0.888 | [0.793, 0.958] | 0.910 | 0.897 | 0.899 | 0.791 | 0.936 | 5/35 | 92.0% of 75 | 2 / 6 | +0.072 [0.021, 0.125] |
| large-q8-ft | cleaned | – | 223 | 151 | 18 | 72 | 0.893 | 0.677 | [0.611, 0.748] | 0.770 | 0.712 | 0.651 | 0.638 | 0.915 | 1/35 | 77.3% of 75 | 1 / 5 | +0.049 [-0.028, 0.127] |
| large-q8-ft | raw | 0.50 tune | 223 | 195 | 12 | 28 | 0.942 | 0.874 | [0.788, 0.941] | 0.907 | 0.887 | 0.884 | 0.786 | 0.957 | 7/35 | 90.7% of 75 | 0 / 6 | +0.058 [0.009, 0.125] |
| large-q8 | cleaned | – | 223 | 138 | 21 | 85 | 0.868 | 0.619 | [0.546, 0.687] | 0.723 | 0.657 | 0.587 | 0.571 | 0.819 | 1/35 | 69.3% of 75 | 10 / 5 | -0.009 [-0.097, 0.075] |
| large-q8 | raw | 0.30 tune | 223 | 164 | 11 | 59 | 0.937 | 0.735 | [0.642, 0.817] | 0.824 | 0.769 | 0.720 | 0.678 | 0.872 | 5/35 | 77.3% of 75 | 8 / 6 | -0.081 [-0.159, -0.008] |
| msperka-dicta-ft | cleaned | – | 223 | 131 | 6 | 92 | 0.956 | 0.587 | [0.507, 0.672] | 0.728 | 0.637 | 0.646 | 0.678 | 0.840 | 0/35 | 64.0% of 75 | 8 / 5 | -0.040 [-0.133, 0.046] |
| msperka-dicta-ft | raw | 0.30 tune | 223 | 206 | 15 | 17 | 0.932 | 0.924 | [0.834, 0.983] | 0.928 | 0.925 | 0.952 | 0.833 | 0.968 | 4/35 | 97.3% of 75 | 0 / 7 | +0.108 [0.051, 0.183] |
| msperka-dicta | cleaned | – | 223 | 138 | 6 | 85 | 0.958 | 0.619 | [0.535, 0.704] | 0.752 | 0.666 | 0.672 | 0.681 | 0.862 | 0/35 | 70.7% of 75 | 7 / 6 | -0.009 [-0.100, 0.076] |
| msperka-dicta | raw | 0.30 tune | 223 | 204 | 12 | 19 | 0.944 | 0.915 | [0.826, 0.973] | 0.929 | 0.921 | 0.942 | 0.829 | 0.968 | 4/35 | 96.0% of 75 | 0 / 7 | +0.099 [0.037, 0.179] |
| parse-base-ft | cleaned | – | 223 | 146 | 17 | 77 | 0.896 | 0.655 | [0.576, 0.732] | 0.756 | 0.692 | 0.656 | 0.653 | 0.915 | 0/35 | 73.3% of 75 | 1 / 5 | +0.027 [-0.052, 0.112] |
| parse-base-ft | raw | 0.30 tune | 223 | 205 | 14 | 18 | 0.936 | 0.919 | [0.828, 0.976] | 0.928 | 0.923 | 0.937 | 0.814 | 0.968 | 6/35 | 93.3% of 75 | 0 / 7 | +0.103 [0.052, 0.167] |
| parse-base | cleaned | – | 223 | 151 | 12 | 72 | 0.926 | 0.677 | [0.590, 0.756] | 0.782 | 0.716 | 0.640 | 0.642 | 0.904 | 0/35 | 78.7% of 75 | 3 / 6 | +0.049 [-0.030, 0.122] |
| parse-base | raw | 0.30 tune | 223 | 201 | 12 | 22 | 0.944 | 0.901 | [0.812, 0.964] | 0.922 | 0.910 | 0.905 | 0.798 | 0.957 | 5/35 | 92.0% of 75 | 1 / 7 | +0.085 [0.044, 0.135] |
| tiny-parse-ft | cleaned | – | 223 | 150 | 18 | 73 | 0.893 | 0.673 | [0.612, 0.740] | 0.767 | 0.708 | 0.651 | 0.639 | 0.936 | 0/35 | 74.7% of 75 | 2 / 8 | +0.045 [-0.017, 0.117] |
| tiny-parse-ft | raw | 0.30 tune | 223 | 204 | 19 | 19 | 0.915 | 0.915 | [0.820, 0.981] | 0.915 | 0.915 | 0.921 | 0.776 | 0.979 | 5/35 | 94.7% of 75 | 0 / 8 | +0.099 [0.039, 0.174] |
| tiny-parse | cleaned | – | 223 | 144 | 18 | 79 | 0.889 | 0.646 | [0.585, 0.717] | 0.748 | 0.683 | 0.651 | 0.644 | 0.872 | 0/35 | 76.0% of 75 | 6 / 6 | +0.018 [-0.056, 0.102] |
| tiny-parse | raw | 0.30 tune | 223 | 199 | 18 | 24 | 0.917 | 0.892 | [0.801, 0.959] | 0.905 | 0.897 | 0.894 | 0.759 | 0.957 | 5/35 | 93.3% of 75 | 1 / 7 | +0.076 [0.017, 0.153] |

Per type, overlap typed (P / R / F2):

| Model | Stage | Cut-off | PER | ORG | PLACE |
|---|---|---|---|---|---|
| aleph | cleaned | – | 0.899 / 0.661 / 0.698 (n 189) | 0.286 / 0.286 / 0.286 (n 14) | 0.556 / 0.500 / 0.510 (n 20) |
| aleph | raw | 0.30 | 0.937 / 0.942 / 0.941 (n 189) | 0.174 / 0.286 / 0.253 (n 14) | 0.560 / 0.700 / 0.667 (n 20) |
| base-q8-ft | cleaned | – | 0.924 / 0.646 / 0.687 (n 189) | 1.000 / 0.071 / 0.088 (n 14) | 0.542 / 0.650 / 0.625 (n 20) |
| base-q8-ft | raw | 0.30 | 0.960 / 0.899 / 0.911 (n 189) | 0.500 / 0.286 / 0.313 (n 14) | 0.619 / 0.650 / 0.644 (n 20) |
| base-q8 | cleaned | – | 0.928 / 0.614 / 0.658 (n 189) | 0.500 / 0.143 / 0.167 (n 14) | 0.600 / 0.600 / 0.600 (n 20) |
| base-q8 | raw | 0.60 | 0.964 / 0.841 / 0.863 (n 189) | 0.167 / 0.071 / 0.081 (n 14) | 0.611 / 0.550 / 0.561 (n 20) |
| base-q8 | raw | 0.30 | 0.964 / 0.847 / 0.868 (n 189) | 0.375 / 0.214 / 0.234 (n 14) | 0.650 / 0.650 / 0.650 (n 20) |
| golem | cleaned | – | 0.915 / 0.571 / 0.618 (n 189) | 0.000 / 0.000 / 0.000 (n 14) | 0.500 / 0.450 / 0.459 (n 20) |
| golem | raw | 0.40 | 0.921 / 0.741 / 0.771 (n 189) | 0.000 / 0.000 / 0.000 (n 14) | 0.588 / 0.500 / 0.515 (n 20) |
| iahlt-base-ft | cleaned | – | 0.946 / 0.646 / 0.689 (n 189) | 0.286 / 0.143 / 0.159 (n 14) | 0.600 / 0.600 / 0.600 (n 20) |
| iahlt-base-ft | raw | 0.30 | 0.983 / 0.894 / 0.911 (n 189) | 0.400 / 0.286 / 0.303 (n 14) | 0.609 / 0.700 / 0.680 (n 20) |
| iahlt-base | cleaned | – | 0.945 / 0.635 / 0.680 (n 189) | 0.286 / 0.143 / 0.159 (n 14) | 0.632 / 0.600 / 0.606 (n 20) |
| iahlt-base | raw | 0.35 | 0.976 / 0.852 / 0.874 (n 189) | 0.300 / 0.214 / 0.227 (n 14) | 0.636 / 0.700 / 0.686 (n 20) |
| joint-base-ft | cleaned | – | 0.927 / 0.672 / 0.711 (n 189) | 0.800 / 0.286 / 0.328 (n 14) | 0.688 / 0.550 / 0.573 (n 20) |
| joint-base-ft | raw | 0.40 | 0.967 / 0.931 / 0.938 (n 189) | 0.400 / 0.286 / 0.303 (n 14) | 0.650 / 0.650 / 0.650 (n 20) |
| joint-base | cleaned | – | 0.953 / 0.646 / 0.690 (n 189) | 0.286 / 0.286 / 0.286 (n 14) | 0.476 / 0.500 / 0.495 (n 20) |
| joint-base | raw | 0.30 | 0.977 / 0.899 / 0.914 (n 189) | 0.308 / 0.286 / 0.290 (n 14) | 0.520 / 0.650 / 0.619 (n 20) |
| large-q8-ft | cleaned | – | 0.918 / 0.651 / 0.691 (n 189) | 0.083 / 0.071 / 0.074 (n 14) | 0.565 / 0.650 / 0.631 (n 20) |
| large-q8-ft | raw | 0.50 | 0.954 / 0.884 / 0.897 (n 189) | 0.200 / 0.143 / 0.152 (n 14) | 0.636 / 0.700 / 0.686 (n 20) |
| large-q8 | cleaned | – | 0.933 / 0.587 / 0.634 (n 189) | 0.143 / 0.143 / 0.143 (n 14) | 0.423 / 0.550 / 0.519 (n 20) |
| large-q8 | raw | 0.30 | 0.965 / 0.720 / 0.758 (n 189) | 0.091 / 0.071 / 0.075 (n 14) | 0.565 / 0.650 / 0.631 (n 20) |
| msperka-dicta-ft | cleaned | – | 0.961 / 0.646 / 0.691 (n 189) | 0.333 / 0.071 / 0.085 (n 14) | 1.000 / 0.350 / 0.402 (n 20) |
| msperka-dicta-ft | raw | 0.30 | 0.984 / 0.952 / 0.958 (n 189) | 0.368 / 0.500 / 0.467 (n 14) | 0.684 / 0.650 / 0.657 (n 20) |
| msperka-dicta | cleaned | – | 0.948 / 0.672 / 0.713 (n 189) | 0.333 / 0.071 / 0.085 (n 14) | 1.000 / 0.350 / 0.402 (n 20) |
| msperka-dicta | raw | 0.30 | 0.978 / 0.942 / 0.949 (n 189) | 0.400 / 0.429 / 0.423 (n 14) | 0.737 / 0.700 / 0.707 (n 20) |
| parse-base-ft | cleaned | – | 0.925 / 0.656 / 0.697 (n 189) | 0.500 / 0.357 / 0.379 (n 14) | 0.632 / 0.600 / 0.606 (n 20) |
| parse-base-ft | raw | 0.30 | 0.967 / 0.937 / 0.942 (n 189) | 0.429 / 0.429 / 0.429 (n 14) | 0.636 / 0.700 / 0.686 (n 20) |
| parse-base | cleaned | – | 0.960 / 0.640 / 0.686 (n 189) | 0.375 / 0.429 / 0.417 (n 14) | 0.619 / 0.650 / 0.644 (n 20) |
| parse-base | raw | 0.30 | 0.983 / 0.905 / 0.919 (n 189) | 0.417 / 0.357 / 0.368 (n 14) | 0.556 / 0.750 / 0.701 (n 20) |
| tiny-parse-ft | cleaned | – | 0.925 / 0.651 / 0.692 (n 189) | 0.333 / 0.143 / 0.161 (n 14) | 0.552 / 0.800 / 0.734 (n 20) |
| tiny-parse-ft | raw | 0.30 | 0.956 / 0.921 / 0.928 (n 189) | 0.273 / 0.214 / 0.224 (n 14) | 0.467 / 0.700 / 0.636 (n 20) |
| tiny-parse | cleaned | – | 0.932 / 0.651 / 0.693 (n 189) | 0.500 / 0.357 / 0.379 (n 14) | 0.500 / 0.500 / 0.500 (n 20) |
| tiny-parse | raw | 0.30 | 0.966 / 0.894 / 0.908 (n 189) | 0.250 / 0.214 / 0.221 (n 14) | 0.467 / 0.700 / 0.636 (n 20) |

Recall per category (overlap untyped):

| Category | n | aleph cleaned | aleph raw 0.30 | base-q8-ft cleaned | base-q8-ft raw 0.30 | base-q8 cleaned | base-q8 raw 0.60 | base-q8 raw 0.30 | golem cleaned | golem raw 0.40 | iahlt-base-ft cleaned | iahlt-base-ft raw 0.30 | iahlt-base cleaned | iahlt-base raw 0.35 | joint-base-ft cleaned | joint-base-ft raw 0.40 | joint-base cleaned | joint-base raw 0.30 | large-q8-ft cleaned | large-q8-ft raw 0.50 | large-q8 cleaned | large-q8 raw 0.30 | msperka-dicta-ft cleaned | msperka-dicta-ft raw 0.30 | msperka-dicta cleaned | msperka-dicta raw 0.30 | parse-base-ft cleaned | parse-base-ft raw 0.30 | parse-base cleaned | parse-base raw 0.30 | tiny-parse-ft cleaned | tiny-parse-ft raw 0.30 | tiny-parse cleaned | tiny-parse raw 0.30 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L_NEIGHBOURHOOD | 8 | 7 (87.5%) | 8 (100.0%) | 6 (75.0%) | 5 (62.5%) | 6 (75.0%) | 5 (62.5%) | 5 (62.5%) | 5 (62.5%) | 5 (62.5%) | 6 (75.0%) | 6 (75.0%) | 6 (75.0%) | 6 (75.0%) | 4 (50.0%) | 4 (50.0%) | 4 (50.0%) | 4 (50.0%) | 6 (75.0%) | 6 (75.0%) | 6 (75.0%) | 6 (75.0%) | 2 (25.0%) | 6 (75.0%) | 2 (25.0%) | 6 (75.0%) | 4 (50.0%) | 5 (62.5%) | 6 (75.0%) | 6 (75.0%) | 8 (100.0%) | 7 (87.5%) | 6 (75.0%) | 6 (75.0%) |
| L_STREET | 8 | 3 (37.5%) | 5 (62.5%) | 3 (37.5%) | 4 (50.0%) | 2 (25.0%) | 2 (25.0%) | 4 (50.0%) | 3 (37.5%) | 4 (50.0%) | 3 (37.5%) | 5 (62.5%) | 3 (37.5%) | 5 (62.5%) | 3 (37.5%) | 5 (62.5%) | 2 (25.0%) | 5 (62.5%) | 4 (50.0%) | 5 (62.5%) | 2 (25.0%) | 4 (50.0%) | 3 (37.5%) | 4 (50.0%) | 3 (37.5%) | 5 (62.5%) | 4 (50.0%) | 5 (62.5%) | 4 (50.0%) | 5 (62.5%) | 6 (75.0%) | 4 (50.0%) | 2 (25.0%) | 4 (50.0%) |
| L_TOWN | 4 | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 1 (25.0%) | 2 (50.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 3 (75.0%) | 3 (75.0%) | 3 (75.0%) | 4 (100.0%) | 3 (75.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 3 (75.0%) | 4 (100.0%) | 3 (75.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) |
| O_LOOKS_PERSON | 3 | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 1 (33.3%) | 2 (66.7%) | 1 (33.3%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 0 (0.0%) | 1 (33.3%) | 2 (66.7%) | 1 (33.3%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) |
| O_PRIVATE | 11 | 8 (72.7%) | 11 (100.0%) | 8 (72.7%) | 11 (100.0%) | 9 (81.8%) | 9 (81.8%) | 11 (100.0%) | 5 (45.5%) | 4 (36.4%) | 8 (72.7%) | 11 (100.0%) | 7 (63.6%) | 11 (100.0%) | 9 (81.8%) | 10 (90.9%) | 9 (81.8%) | 11 (100.0%) | 8 (72.7%) | 10 (90.9%) | 9 (81.8%) | 9 (81.8%) | 1 (9.1%) | 11 (100.0%) | 1 (9.1%) | 10 (90.9%) | 8 (72.7%) | 11 (100.0%) | 8 (72.7%) | 11 (100.0%) | 8 (72.7%) | 11 (100.0%) | 9 (81.8%) | 11 (100.0%) |
| P_AFTER_LEAD | 3 | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) |
| P_ARABIC | 22 | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 18 (81.8%) | 18 (81.8%) | 13 (59.1%) | 20 (90.9%) | 13 (59.1%) | 17 (77.3%) | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 17 (77.3%) | 11 (50.0%) | 13 (59.1%) | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 18 (81.8%) | 13 (59.1%) | 17 (77.3%) | 13 (59.1%) | 17 (77.3%) |
| P_CORRUPT_ONLY | 5 | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 3 (60.0%) | 2 (40.0%) | 4 (80.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 1 (20.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) | 1 (20.0%) | 3 (60.0%) |
| P_ED1_PAIR | 7 | 2 (28.6%) | 7 (100.0%) | 2 (28.6%) | 6 (85.7%) | 2 (28.6%) | 6 (85.7%) | 6 (85.7%) | 2 (28.6%) | 6 (85.7%) | 5 (71.4%) | 6 (85.7%) | 5 (71.4%) | 6 (85.7%) | 5 (71.4%) | 6 (85.7%) | 5 (71.4%) | 7 (100.0%) | 5 (71.4%) | 5 (71.4%) | 5 (71.4%) | 5 (71.4%) | 2 (28.6%) | 6 (85.7%) | 2 (28.6%) | 6 (85.7%) | 5 (71.4%) | 7 (100.0%) | 5 (71.4%) | 7 (100.0%) | 2 (28.6%) | 6 (85.7%) | 2 (28.6%) | 6 (85.7%) |
| P_ETHIOPIAN | 16 | 13 (81.3%) | 16 (100.0%) | 13 (81.3%) | 16 (100.0%) | 13 (81.3%) | 13 (81.3%) | 13 (81.3%) | 14 (87.5%) | 13 (81.3%) | 8 (50.0%) | 15 (93.8%) | 9 (56.3%) | 13 (81.3%) | 13 (81.3%) | 16 (100.0%) | 10 (62.5%) | 15 (93.8%) | 13 (81.3%) | 15 (93.8%) | 13 (81.3%) | 11 (68.8%) | 10 (62.5%) | 16 (100.0%) | 10 (62.5%) | 16 (100.0%) | 10 (62.5%) | 16 (100.0%) | 9 (56.3%) | 15 (93.8%) | 11 (68.8%) | 16 (100.0%) | 11 (68.8%) | 15 (93.8%) |
| P_FORMS | 24 | 10 (41.7%) | 22 (91.7%) | 6 (25.0%) | 22 (91.7%) | 6 (25.0%) | 22 (91.7%) | 22 (91.7%) | 8 (33.3%) | 20 (83.3%) | 8 (33.3%) | 22 (91.7%) | 8 (33.3%) | 21 (87.5%) | 6 (25.0%) | 22 (91.7%) | 11 (45.8%) | 23 (95.8%) | 10 (41.7%) | 24 (100.0%) | 10 (41.7%) | 21 (87.5%) | 6 (25.0%) | 24 (100.0%) | 6 (25.0%) | 23 (95.8%) | 6 (25.0%) | 22 (91.7%) | 10 (41.7%) | 23 (95.8%) | 6 (25.0%) | 24 (100.0%) | 10 (41.7%) | 23 (95.8%) |
| P_HYPHEN | 15 | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 9 (60.0%) | 8 (53.3%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 13 (86.7%) | 12 (80.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) | 15 (100.0%) |
| P_LOOKS_ORG | 2 | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) |
| P_MINOR | 10 | 7 (70.0%) | 10 (100.0%) | 6 (60.0%) | 8 (80.0%) | 3 (30.0%) | 6 (60.0%) | 6 (60.0%) | 7 (70.0%) | 7 (70.0%) | 7 (70.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 7 (70.0%) | 10 (100.0%) | 9 (90.0%) | 9 (90.0%) | 7 (70.0%) | 10 (100.0%) | 6 (60.0%) | 8 (80.0%) | 7 (70.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 7 (70.0%) | 10 (100.0%) | 9 (90.0%) | 9 (90.0%) | 8 (80.0%) | 10 (100.0%) | 8 (80.0%) | 10 (100.0%) |
| P_MINOR_ANCH | 12 | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 10 (83.3%) | 12 (100.0%) | 10 (83.3%) | 10 (83.3%) | 7 (58.3%) | 7 (58.3%) | 12 (100.0%) | 11 (91.7%) | 12 (100.0%) | 10 (83.3%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 11 (91.7%) | 12 (100.0%) | 9 (75.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 11 (91.7%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 11 (91.7%) | 12 (100.0%) | 11 (91.7%) |
| P_NIKUD | 3 | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 2 (66.7%) | 3 (100.0%) | 1 (33.3%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) |
| P_PREFIX_ONCE | 1 | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 0 (0.0%) | 0 (0.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 0 (0.0%) | 0 (0.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) |
| P_PROSE | 11 | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 9 (81.8%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 10 (90.9%) | 8 (72.7%) | 9 (81.8%) | 8 (72.7%) | 8 (72.7%) | 11 (100.0%) | 10 (90.9%) | 11 (100.0%) | 10 (90.9%) | 11 (100.0%) | 11 (100.0%) | 11 (100.0%) | 10 (90.9%) | 11 (100.0%) | 9 (81.8%) | 8 (72.7%) | 8 (72.7%) |
| P_ROLE_COLON | 2 | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 0 (0.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) |
| P_ROLE_NOCOLON | 2 | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) |
| P_ROLE_TEACHER | 2 | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 0 (0.0%) | 0 (0.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) |
| P_RUSSIAN | 7 | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 7 (100.0%) | 3 (42.9%) | 6 (85.7%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) | 3 (42.9%) | 7 (100.0%) |
| P_SHARED_SURNAME | 12 | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 11 (91.7%) | 12 (100.0%) | 5 (41.7%) | 10 (83.3%) | 4 (33.3%) | 11 (91.7%) | 4 (33.3%) | 11 (91.7%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) | 5 (41.7%) | 12 (100.0%) |
| P_SPEAKERLINE | 2 | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) |
| P_SPLITRUN | 2 | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) |
| P_TITLE | 6 | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 6 (100.0%) | 3 (50.0%) | 5 (83.3%) | 3 (50.0%) | 5 (83.3%) | 3 (50.0%) | 5 (83.3%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 5 (83.3%) | 4 (66.7%) | 5 (83.3%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) |
| P_TWO_SPELL | 14 | 13 (92.9%) | 14 (100.0%) | 10 (71.4%) | 11 (78.6%) | 8 (57.1%) | 9 (64.3%) | 9 (64.3%) | 6 (42.9%) | 7 (50.0%) | 12 (85.7%) | 13 (92.9%) | 9 (64.3%) | 10 (71.4%) | 11 (78.6%) | 12 (85.7%) | 10 (71.4%) | 11 (78.6%) | 10 (71.4%) | 11 (78.6%) | 9 (64.3%) | 10 (71.4%) | 12 (85.7%) | 14 (100.0%) | 14 (100.0%) | 14 (100.0%) | 11 (78.6%) | 12 (85.7%) | 10 (71.4%) | 11 (78.6%) | 12 (85.7%) | 13 (92.9%) | 12 (85.7%) | 13 (92.9%) |
| P_WORD | 3 | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 3 (100.0%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) |
| P_WORD_VERB | 3 | 0 (0.0%) | 3 (100.0%) | 0 (0.0%) | 1 (33.3%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 2 (66.7%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 3 (100.0%) | 0 (0.0%) | 3 (100.0%) | 0 (0.0%) | 3 (100.0%) | 0 (0.0%) | 1 (33.3%) | 0 (0.0%) | 3 (100.0%) | 0 (0.0%) | 2 (66.7%) |
| S_ALT | 1 | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) |
| S_FOOTNOTE | 1 | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) |
| S_HEADER | 1 | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 0 (0.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) |

## synthetic-tune

24 documents; licence repo.

Overlap untyped unless named. Lost/gained: must entities the baseline finds and this row misses, and the other way.

| Model | Stage | Cut-off | Gold | TP | FP | FN | P | R | R 95% | F1 | F2 | PER R | Word-exact F1 | Entity R | Traps hit | Added R | Lost / gained | R gain vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aleph | cleaned | – | 238 | 153 | 4 | 85 | 0.975 | 0.643 | [0.570, 0.721] | 0.775 | 0.690 | 0.646 | 0.699 | 0.890 | 2/65 | 59.8% of 97 | 6 / 8 | +0.046 [0.000, 0.098] |
| aleph | raw | 0.30 tune | 238 | 225 | 38 | 13 | 0.856 | 0.945 | [0.871, 0.992] | 0.898 | 0.926 | 0.947 | 0.814 | 0.972 | 17/65 | 94.8% of 97 | 1 / 10 | +0.139 [0.071, 0.226] |
| base-q8-ft | cleaned | – | 238 | 153 | 8 | 85 | 0.950 | 0.643 | [0.570, 0.725] | 0.767 | 0.687 | 0.636 | 0.722 | 0.936 | 1/65 | 59.8% of 97 | 0 / 7 | +0.046 [0.012, 0.094] |
| base-q8-ft | raw | 0.30 tune | 238 | 219 | 20 | 19 | 0.916 | 0.920 | [0.850, 0.968] | 0.918 | 0.919 | 0.923 | 0.872 | 0.972 | 17/65 | 91.8% of 97 | 0 / 9 | +0.113 [0.054, 0.197] |
| base-q8 | cleaned | – | 238 | 142 | 9 | 96 | 0.940 | 0.597 | [0.521, 0.671] | 0.730 | 0.644 | 0.598 | 0.684 | 0.872 | 1/65 | 57.7% of 97 | – | – |
| base-q8 | raw | 0.60 shipped | 238 | 192 | 18 | 46 | 0.914 | 0.807 | [0.724, 0.882] | 0.857 | 0.826 | 0.818 | 0.813 | 0.890 | 13/65 | 81.4% of 97 | – | – |
| base-q8 | raw | 0.30 tune | 238 | 198 | 18 | 40 | 0.917 | 0.832 | [0.759, 0.903] | 0.872 | 0.848 | 0.833 | 0.819 | 0.917 | 13/65 | 81.4% of 97 | – | – |
| golem | cleaned | – | 238 | 135 | 14 | 103 | 0.906 | 0.567 | [0.498, 0.641] | 0.698 | 0.613 | 0.603 | 0.584 | 0.761 | 2/65 | 59.8% of 97 | 18 / 6 | -0.029 [-0.114, 0.057] |
| golem | raw | 0.40 tune | 238 | 168 | 21 | 70 | 0.889 | 0.706 | [0.637, 0.773] | 0.787 | 0.736 | 0.746 | 0.665 | 0.817 | 4/65 | 73.2% of 97 | 15 / 7 | -0.101 [-0.209, 0.019] |
| iahlt-base-ft | cleaned | – | 238 | 150 | 4 | 88 | 0.974 | 0.630 | [0.530, 0.732] | 0.765 | 0.678 | 0.612 | 0.673 | 0.872 | 2/65 | 58.8% of 97 | 8 / 8 | +0.034 [-0.054, 0.111] |
| iahlt-base-ft | raw | 0.30 tune | 238 | 212 | 20 | 26 | 0.914 | 0.891 | [0.804, 0.957] | 0.902 | 0.895 | 0.890 | 0.830 | 0.954 | 15/65 | 88.7% of 97 | 2 / 9 | +0.084 [0.000, 0.178] |
| iahlt-base | cleaned | – | 238 | 150 | 2 | 88 | 0.987 | 0.630 | [0.535, 0.728] | 0.769 | 0.679 | 0.608 | 0.672 | 0.881 | 1/65 | 57.7% of 97 | 8 / 9 | +0.034 [-0.048, 0.113] |
| iahlt-base | raw | 0.35 tune | 238 | 208 | 19 | 30 | 0.916 | 0.874 | [0.794, 0.934] | 0.895 | 0.882 | 0.861 | 0.817 | 0.954 | 12/65 | 87.6% of 97 | 2 / 9 | +0.067 [0.000, 0.146] |
| joint-base-ft | cleaned | – | 238 | 155 | 6 | 83 | 0.963 | 0.651 | [0.570, 0.737] | 0.777 | 0.696 | 0.651 | 0.727 | 0.917 | 1/65 | 60.8% of 97 | 0 / 5 | +0.055 [0.010, 0.106] |
| joint-base-ft | raw | 0.40 tune | 238 | 218 | 18 | 20 | 0.924 | 0.916 | [0.844, 0.976] | 0.920 | 0.918 | 0.923 | 0.878 | 0.954 | 16/65 | 91.8% of 97 | 1 / 8 | +0.109 [0.053, 0.162] |
| joint-base | cleaned | – | 238 | 156 | 6 | 82 | 0.963 | 0.655 | [0.576, 0.747] | 0.780 | 0.700 | 0.646 | 0.700 | 0.890 | 1/65 | 66.0% of 97 | 3 / 5 | +0.059 [-0.026, 0.149] |
| joint-base | raw | 0.30 tune | 238 | 207 | 20 | 31 | 0.912 | 0.870 | [0.771, 0.955] | 0.890 | 0.878 | 0.866 | 0.839 | 0.927 | 14/65 | 88.7% of 97 | 3 / 7 | +0.063 [-0.004, 0.132] |
| large-q8-ft | cleaned | – | 238 | 156 | 15 | 82 | 0.912 | 0.655 | [0.578, 0.744] | 0.763 | 0.695 | 0.656 | 0.699 | 0.927 | 1/65 | 64.9% of 97 | 3 / 9 | +0.059 [-0.005, 0.126] |
| large-q8-ft | raw | 0.50 tune | 238 | 208 | 25 | 30 | 0.893 | 0.874 | [0.797, 0.942] | 0.883 | 0.878 | 0.871 | 0.828 | 0.963 | 15/65 | 87.6% of 97 | 2 / 10 | +0.067 [0.008, 0.144] |
| large-q8 | cleaned | – | 238 | 136 | 6 | 102 | 0.958 | 0.571 | [0.514, 0.629] | 0.716 | 0.622 | 0.531 | 0.637 | 0.872 | 1/65 | 52.6% of 97 | 7 / 7 | -0.025 [-0.107, 0.039] |
| large-q8 | raw | 0.30 tune | 238 | 171 | 20 | 67 | 0.895 | 0.718 | [0.642, 0.792] | 0.797 | 0.748 | 0.684 | 0.718 | 0.899 | 12/65 | 70.1% of 97 | 6 / 7 | -0.088 [-0.158, -0.026] |
| msperka-dicta-ft | cleaned | – | 238 | 144 | 3 | 94 | 0.980 | 0.605 | [0.530, 0.690] | 0.748 | 0.655 | 0.627 | 0.686 | 0.835 | 1/65 | 58.8% of 97 | 10 / 6 | +0.008 [-0.040, 0.066] |
| msperka-dicta-ft | raw | 0.30 tune | 238 | 221 | 27 | 17 | 0.891 | 0.929 | [0.856, 0.986] | 0.909 | 0.921 | 0.933 | 0.848 | 0.936 | 15/65 | 94.8% of 97 | 4 / 9 | +0.122 [0.038, 0.217] |
| msperka-dicta | cleaned | – | 238 | 143 | 3 | 95 | 0.979 | 0.601 | [0.527, 0.679] | 0.745 | 0.651 | 0.622 | 0.682 | 0.835 | 1/65 | 58.8% of 97 | 7 / 3 | +0.004 [-0.035, 0.048] |
| msperka-dicta | raw | 0.30 tune | 238 | 220 | 25 | 18 | 0.898 | 0.924 | [0.854, 0.986] | 0.911 | 0.919 | 0.914 | 0.849 | 0.972 | 13/65 | 94.8% of 97 | 0 / 9 | +0.118 [0.049, 0.201] |
| parse-base-ft | cleaned | – | 238 | 155 | 9 | 83 | 0.945 | 0.651 | [0.577, 0.732] | 0.771 | 0.694 | 0.641 | 0.731 | 0.936 | 3/65 | 60.8% of 97 | 1 / 8 | +0.055 [0.015, 0.103] |
| parse-base-ft | raw | 0.30 tune | 238 | 224 | 19 | 14 | 0.922 | 0.941 | [0.870, 0.991] | 0.931 | 0.937 | 0.947 | 0.890 | 0.963 | 16/65 | 94.8% of 97 | 0 / 8 | +0.134 [0.065, 0.220] |
| parse-base | cleaned | – | 238 | 146 | 4 | 92 | 0.973 | 0.613 | [0.527, 0.704] | 0.753 | 0.662 | 0.603 | 0.706 | 0.890 | 1/65 | 58.8% of 97 | 3 / 5 | +0.017 [-0.054, 0.078] |
| parse-base | raw | 0.30 tune | 238 | 212 | 19 | 26 | 0.918 | 0.891 | [0.799, 0.974] | 0.904 | 0.896 | 0.885 | 0.861 | 0.945 | 14/65 | 89.7% of 97 | 2 / 8 | +0.084 [0.015, 0.161] |
| tiny-parse-ft | cleaned | – | 238 | 152 | 10 | 86 | 0.938 | 0.639 | [0.565, 0.713] | 0.760 | 0.682 | 0.627 | 0.675 | 0.890 | 4/65 | 57.7% of 97 | 4 / 6 | +0.042 [-0.027, 0.101] |
| tiny-parse-ft | raw | 0.30 tune | 238 | 213 | 25 | 25 | 0.895 | 0.895 | [0.818, 0.957] | 0.895 | 0.895 | 0.900 | 0.815 | 0.945 | 17/65 | 88.7% of 97 | 3 / 9 | +0.088 [0.023, 0.165] |
| tiny-parse | cleaned | – | 238 | 156 | 10 | 82 | 0.940 | 0.655 | [0.585, 0.729] | 0.772 | 0.698 | 0.632 | 0.688 | 0.899 | 3/65 | 63.9% of 97 | 4 / 7 | +0.059 [-0.009, 0.127] |
| tiny-parse | raw | 0.30 tune | 238 | 209 | 26 | 29 | 0.889 | 0.878 | [0.803, 0.942] | 0.884 | 0.880 | 0.871 | 0.803 | 0.945 | 18/65 | 87.6% of 97 | 2 / 8 | +0.071 [0.022, 0.126] |

Per type, overlap typed (P / R / F2):

| Model | Stage | Cut-off | PER | ORG | PLACE |
|---|---|---|---|---|---|
| aleph | cleaned | – | 0.993 / 0.646 / 0.694 (n 209) | 0.667 / 0.500 / 0.526 (n 12) | 0.750 / 0.529 / 0.563 (n 17) |
| aleph | raw | 0.30 | 0.938 / 0.947 / 0.946 (n 209) | 0.226 / 0.583 / 0.443 (n 12) | 0.714 / 0.882 / 0.843 (n 17) |
| base-q8-ft | cleaned | – | 0.993 / 0.636 / 0.686 (n 209) | 1.000 / 0.417 / 0.472 (n 12) | 0.455 / 0.588 / 0.556 (n 17) |
| base-q8-ft | raw | 0.30 | 0.980 / 0.923 / 0.934 (n 209) | 0.286 / 0.500 / 0.435 (n 12) | 0.667 / 0.824 / 0.787 (n 17) |
| base-q8 | cleaned | – | 0.977 / 0.598 / 0.648 (n 209) | 0.500 / 0.250 / 0.278 (n 12) | 0.529 / 0.529 / 0.529 (n 17) |
| base-q8 | raw | 0.60 | 0.983 / 0.818 / 0.847 (n 209) | 0.200 / 0.333 / 0.294 (n 12) | 0.688 / 0.647 / 0.655 (n 17) |
| base-q8 | raw | 0.30 | 0.983 / 0.833 / 0.859 (n 209) | 0.238 / 0.417 / 0.362 (n 12) | 0.667 / 0.706 / 0.698 (n 17) |
| golem | cleaned | – | 0.940 / 0.603 / 0.649 (n 209) | 0.000 / 0.000 / 0.000 (n 12) | 0.467 / 0.412 / 0.422 (n 17) |
| golem | raw | 0.40 | 0.902 / 0.746 / 0.773 (n 209) | 0.000 / 0.000 / 0.000 (n 12) | 0.500 / 0.471 / 0.476 (n 17) |
| iahlt-base-ft | cleaned | – | 1.000 / 0.612 / 0.664 (n 209) | 1.000 / 0.583 / 0.636 (n 12) | 0.526 / 0.588 / 0.575 (n 17) |
| iahlt-base-ft | raw | 0.30 | 0.995 / 0.890 / 0.909 (n 209) | 0.333 / 0.583 / 0.507 (n 12) | 0.583 / 0.824 / 0.761 (n 17) |
| iahlt-base | cleaned | – | 1.000 / 0.608 / 0.659 (n 209) | 1.000 / 0.583 / 0.636 (n 12) | 0.611 / 0.647 / 0.640 (n 17) |
| iahlt-base | raw | 0.35 | 1.000 / 0.861 / 0.886 (n 209) | 0.381 / 0.667 / 0.580 (n 12) | 0.577 / 0.882 / 0.798 (n 17) |
| joint-base-ft | cleaned | – | 0.993 / 0.651 / 0.699 (n 209) | 1.000 / 0.500 / 0.556 (n 12) | 0.611 / 0.647 / 0.640 (n 17) |
| joint-base-ft | raw | 0.40 | 0.990 / 0.923 / 0.936 (n 209) | 0.375 / 0.750 / 0.625 (n 12) | 0.706 / 0.706 / 0.706 (n 17) |
| joint-base | cleaned | – | 1.000 / 0.646 / 0.695 (n 209) | 1.000 / 0.500 / 0.556 (n 12) | 0.476 / 0.588 / 0.562 (n 17) |
| joint-base | raw | 0.30 | 0.995 / 0.866 / 0.889 (n 209) | 0.385 / 0.833 / 0.676 (n 12) | 0.632 / 0.706 / 0.690 (n 17) |
| large-q8-ft | cleaned | – | 0.993 / 0.656 / 0.703 (n 209) | 0.429 / 0.250 / 0.273 (n 12) | 0.423 / 0.647 / 0.585 (n 17) |
| large-q8-ft | raw | 0.50 | 0.978 / 0.871 / 0.890 (n 209) | 0.167 / 0.333 / 0.278 (n 12) | 0.609 / 0.824 / 0.769 (n 17) |
| large-q8 | cleaned | – | 0.991 / 0.531 / 0.585 (n 209) | 0.364 / 0.333 / 0.339 (n 12) | 0.579 / 0.647 / 0.632 (n 17) |
| large-q8 | raw | 0.30 | 0.993 / 0.684 / 0.730 (n 209) | 0.154 / 0.333 / 0.270 (n 12) | 0.571 / 0.706 / 0.674 (n 17) |
| msperka-dicta-ft | cleaned | – | 0.992 / 0.627 / 0.677 (n 209) | 1.000 / 0.500 / 0.556 (n 12) | 0.444 / 0.235 / 0.260 (n 17) |
| msperka-dicta-ft | raw | 0.30 | 0.980 / 0.933 / 0.942 (n 209) | 0.345 / 0.833 / 0.649 (n 12) | 0.650 / 0.765 / 0.739 (n 17) |
| msperka-dicta | cleaned | – | 1.000 / 0.622 / 0.673 (n 209) | 0.750 / 0.500 / 0.536 (n 12) | 0.375 / 0.176 / 0.197 (n 17) |
| msperka-dicta | raw | 0.30 | 1.000 / 0.914 / 0.930 (n 209) | 0.300 / 0.750 / 0.577 (n 12) | 0.625 / 0.882 / 0.815 (n 17) |
| parse-base-ft | cleaned | – | 0.993 / 0.641 / 0.690 (n 209) | 0.727 / 0.667 / 0.678 (n 12) | 0.611 / 0.647 / 0.640 (n 17) |
| parse-base-ft | raw | 0.30 | 0.990 / 0.947 / 0.956 (n 209) | 0.385 / 0.833 / 0.676 (n 12) | 0.765 / 0.765 / 0.765 (n 17) |
| parse-base | cleaned | – | 1.000 / 0.603 / 0.655 (n 209) | 1.000 / 0.583 / 0.636 (n 12) | 0.529 / 0.529 / 0.529 (n 17) |
| parse-base | raw | 0.30 | 0.995 / 0.885 / 0.905 (n 209) | 0.400 / 0.833 / 0.685 (n 12) | 0.700 / 0.824 / 0.795 (n 17) |
| tiny-parse-ft | cleaned | – | 0.970 / 0.627 / 0.675 (n 209) | 1.000 / 0.500 / 0.556 (n 12) | 0.476 / 0.588 / 0.562 (n 17) |
| tiny-parse-ft | raw | 0.30 | 0.969 / 0.900 / 0.913 (n 209) | 0.263 / 0.417 / 0.373 (n 12) | 0.560 / 0.824 / 0.753 (n 17) |
| tiny-parse | cleaned | – | 0.978 / 0.632 / 0.680 (n 209) | 1.000 / 0.583 / 0.636 (n 12) | 0.458 / 0.647 / 0.598 (n 17) |
| tiny-parse | raw | 0.30 | 0.978 / 0.871 / 0.890 (n 209) | 0.292 / 0.583 / 0.486 (n 12) | 0.600 / 0.882 / 0.806 (n 17) |

Recall per category (overlap untyped):

| Category | n | aleph cleaned | aleph raw 0.30 | base-q8-ft cleaned | base-q8-ft raw 0.30 | base-q8 cleaned | base-q8 raw 0.60 | base-q8 raw 0.30 | golem cleaned | golem raw 0.40 | iahlt-base-ft cleaned | iahlt-base-ft raw 0.30 | iahlt-base cleaned | iahlt-base raw 0.35 | joint-base-ft cleaned | joint-base-ft raw 0.40 | joint-base cleaned | joint-base raw 0.30 | large-q8-ft cleaned | large-q8-ft raw 0.50 | large-q8 cleaned | large-q8 raw 0.30 | msperka-dicta-ft cleaned | msperka-dicta-ft raw 0.30 | msperka-dicta cleaned | msperka-dicta raw 0.30 | parse-base-ft cleaned | parse-base-ft raw 0.30 | parse-base cleaned | parse-base raw 0.30 | tiny-parse-ft cleaned | tiny-parse-ft raw 0.30 | tiny-parse cleaned | tiny-parse raw 0.30 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L_NEIGHBOURHOOD | 2 | 2 (100.0%) | 1 (50.0%) | 0 (0.0%) | 1 (50.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 1 (50.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 2 (100.0%) | 1 (50.0%) | 0 (0.0%) | 1 (50.0%) |
| L_STREET | 6 | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 5 (83.3%) | 3 (50.0%) | 5 (83.3%) | 5 (83.3%) | 2 (33.3%) | 3 (50.0%) | 2 (33.3%) | 5 (83.3%) | 2 (33.3%) | 6 (100.0%) | 3 (50.0%) | 4 (66.7%) | 2 (33.3%) | 4 (66.7%) | 3 (50.0%) | 5 (83.3%) | 3 (50.0%) | 4 (66.7%) | 3 (50.0%) | 5 (83.3%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 5 (83.3%) | 2 (33.3%) | 5 (83.3%) | 4 (66.7%) | 6 (100.0%) | 4 (66.7%) | 6 (100.0%) |
| L_TOWN | 9 | 5 (55.6%) | 9 (100.0%) | 7 (77.8%) | 8 (88.9%) | 7 (77.8%) | 7 (77.8%) | 8 (88.9%) | 5 (55.6%) | 5 (55.6%) | 8 (88.9%) | 9 (100.0%) | 9 (100.0%) | 9 (100.0%) | 8 (88.9%) | 8 (88.9%) | 8 (88.9%) | 8 (88.9%) | 8 (88.9%) | 8 (88.9%) | 8 (88.9%) | 8 (88.9%) | 1 (11.1%) | 8 (88.9%) | 0 (0.0%) | 9 (100.0%) | 8 (88.9%) | 8 (88.9%) | 7 (77.8%) | 9 (100.0%) | 5 (55.6%) | 8 (88.9%) | 8 (88.9%) | 9 (100.0%) |
| O_LOOKS_PERSON | 1 | 0 (0.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 0 (0.0%) | 0 (0.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) | 1 (100.0%) |
| O_PRIVATE | 11 | 8 (72.7%) | 10 (90.9%) | 8 (72.7%) | 9 (81.8%) | 4 (36.4%) | 5 (45.5%) | 7 (63.6%) | 2 (18.2%) | 2 (18.2%) | 9 (81.8%) | 9 (81.8%) | 9 (81.8%) | 9 (81.8%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 11 (100.0%) | 5 (45.5%) | 6 (54.5%) | 6 (54.5%) | 6 (54.5%) | 6 (54.5%) | 11 (100.0%) | 6 (54.5%) | 11 (100.0%) | 8 (72.7%) | 11 (100.0%) | 7 (63.6%) | 10 (90.9%) | 8 (72.7%) | 6 (54.5%) | 9 (81.8%) | 8 (72.7%) |
| P_AFTER_LEAD | 7 | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 6 (85.7%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 5 (71.4%) | 3 (42.9%) | 2 (28.6%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) |
| P_ARABIC | 6 | 2 (33.3%) | 6 (100.0%) | 2 (33.3%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 6 (100.0%) | 2 (33.3%) | 5 (83.3%) | 2 (33.3%) | 6 (100.0%) | 2 (33.3%) | 6 (100.0%) | 2 (33.3%) | 6 (100.0%) | 2 (33.3%) | 5 (83.3%) | 2 (33.3%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 2 (33.3%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 2 (33.3%) | 6 (100.0%) | 2 (33.3%) | 6 (100.0%) | 2 (33.3%) | 6 (100.0%) | 2 (33.3%) | 6 (100.0%) |
| P_CORRUPT_ONLY | 3 | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 2 (66.7%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) | 2 (66.7%) | 3 (100.0%) |
| P_ED1_PAIR | 11 | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 10 (90.9%) | 10 (90.9%) | 5 (45.5%) | 9 (81.8%) | 6 (54.5%) | 9 (81.8%) | 5 (45.5%) | 10 (90.9%) | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 8 (72.7%) | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 9 (81.8%) | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 8 (72.7%) | 4 (36.4%) | 10 (90.9%) | 4 (36.4%) | 9 (81.8%) |
| P_ETHIOPIAN | 6 | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 5 (83.3%) | 5 (83.3%) | 3 (50.0%) | 6 (100.0%) | 4 (66.7%) | 6 (100.0%) | 4 (66.7%) | 4 (66.7%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 4 (66.7%) | 6 (100.0%) | 3 (50.0%) | 4 (66.7%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) | 3 (50.0%) | 6 (100.0%) |
| P_FORMS | 11 | 3 (27.3%) | 10 (90.9%) | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 10 (90.9%) | 11 (100.0%) | 3 (27.3%) | 8 (72.7%) | 5 (45.5%) | 10 (90.9%) | 5 (45.5%) | 11 (100.0%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 10 (90.9%) | 4 (36.4%) | 10 (90.9%) | 4 (36.4%) | 10 (90.9%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 4 (36.4%) | 10 (90.9%) | 6 (54.5%) | 10 (90.9%) | 4 (36.4%) | 11 (100.0%) | 4 (36.4%) | 11 (100.0%) |
| P_LOOKS_ORG | 2 | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) |
| P_MINOR | 13 | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 12 (92.3%) | 13 (100.0%) | 11 (84.6%) | 11 (84.6%) | 11 (84.6%) | 9 (69.2%) | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 11 (84.6%) | 11 (84.6%) | 13 (100.0%) | 13 (100.0%) | 9 (69.2%) | 9 (69.2%) | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 13 (100.0%) | 11 (84.6%) | 11 (84.6%) | 11 (84.6%) | 11 (84.6%) | 11 (84.6%) | 10 (76.9%) |
| P_MINOR_ANCH | 10 | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 8 (80.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 9 (90.0%) | 10 (100.0%) | 9 (90.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) | 10 (100.0%) |
| P_NIKUD | 5 | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 3 (60.0%) | 1 (20.0%) | 1 (20.0%) | 2 (40.0%) | 2 (40.0%) | 2 (40.0%) | 2 (40.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 3 (60.0%) |
| P_PREFIX_ONCE | 2 | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) | 1 (50.0%) |
| P_PROSE | 7 | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 5 (71.4%) | 4 (57.1%) | 4 (57.1%) | 5 (71.4%) | 4 (57.1%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 6 (85.7%) | 5 (71.4%) | 4 (57.1%) | 3 (42.9%) | 1 (14.3%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 7 (100.0%) | 5 (71.4%) | 5 (71.4%) |
| P_ROLE_COLON | 4 | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 2 (50.0%) | 2 (50.0%) | 3 (75.0%) | 1 (25.0%) | 2 (50.0%) | 4 (100.0%) | 4 (100.0%) | 3 (75.0%) | 3 (75.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 3 (75.0%) | 3 (75.0%) | 4 (100.0%) | 4 (100.0%) | 3 (75.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 4 (100.0%) | 3 (75.0%) | 3 (75.0%) | 2 (50.0%) | 3 (75.0%) |
| P_ROLE_NOCOLON | 11 | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 11 (100.0%) | 7 (63.6%) | 8 (72.7%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 9 (81.8%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 8 (72.7%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) | 5 (45.5%) | 11 (100.0%) |
| P_ROLE_TEACHER | 5 | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 4 (80.0%) | 5 (100.0%) | 3 (60.0%) | 2 (40.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 3 (60.0%) | 5 (100.0%) | 5 (100.0%) | 2 (40.0%) | 2 (40.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 4 (80.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 4 (80.0%) | 5 (100.0%) | 5 (100.0%) | 2 (40.0%) | 2 (40.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 4 (80.0%) |
| P_RUSSIAN | 17 | 7 (41.2%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) | 14 (82.4%) | 6 (35.3%) | 15 (88.2%) | 6 (35.3%) | 13 (76.5%) | 6 (35.3%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) | 7 (41.2%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) | 5 (29.4%) | 13 (76.5%) | 5 (29.4%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) | 5 (29.4%) | 14 (82.4%) |
| P_SHARED_SURNAME | 14 | 7 (50.0%) | 12 (85.7%) | 6 (42.9%) | 12 (85.7%) | 6 (42.9%) | 11 (78.6%) | 11 (78.6%) | 8 (57.1%) | 13 (92.9%) | 3 (21.4%) | 9 (64.3%) | 3 (21.4%) | 9 (64.3%) | 6 (42.9%) | 12 (85.7%) | 6 (42.9%) | 12 (85.7%) | 6 (42.9%) | 12 (85.7%) | 6 (42.9%) | 11 (78.6%) | 6 (42.9%) | 12 (85.7%) | 6 (42.9%) | 12 (85.7%) | 6 (42.9%) | 12 (85.7%) | 6 (42.9%) | 12 (85.7%) | 7 (50.0%) | 12 (85.7%) | 7 (50.0%) | 11 (78.6%) |
| P_SPEAKERLINE | 3 | 1 (33.3%) | 2 (66.7%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 1 (33.3%) | 1 (33.3%) | 0 (0.0%) | 1 (33.3%) | 1 (33.3%) | 2 (66.7%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 0 (0.0%) | 0 (0.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) | 3 (100.0%) |
| P_SPLITRUN | 4 | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) | 2 (50.0%) | 4 (100.0%) |
| P_SUR2 | 17 | 6 (35.3%) | 17 (100.0%) | 6 (35.3%) | 17 (100.0%) | 5 (29.4%) | 13 (76.5%) | 13 (76.5%) | 12 (70.6%) | 10 (58.8%) | 6 (35.3%) | 16 (94.1%) | 6 (35.3%) | 16 (94.1%) | 7 (41.2%) | 15 (88.2%) | 13 (76.5%) | 15 (88.2%) | 11 (64.7%) | 14 (82.4%) | 6 (35.3%) | 10 (58.8%) | 6 (35.3%) | 17 (100.0%) | 6 (35.3%) | 17 (100.0%) | 6 (35.3%) | 17 (100.0%) | 6 (35.3%) | 17 (100.0%) | 8 (47.1%) | 17 (100.0%) | 11 (64.7%) | 16 (94.1%) |
| P_TITLE | 11 | 6 (54.5%) | 11 (100.0%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 10 (90.9%) | 10 (90.9%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 11 (100.0%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 11 (100.0%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 11 (100.0%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 11 (100.0%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 10 (90.9%) | 6 (54.5%) | 10 (90.9%) |
| P_TWO_SPELL | 12 | 12 (100.0%) | 12 (100.0%) | 11 (91.7%) | 11 (91.7%) | 11 (91.7%) | 11 (91.7%) | 11 (91.7%) | 9 (75.0%) | 10 (83.3%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 11 (91.7%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 11 (91.7%) | 11 (91.7%) | 10 (83.3%) | 11 (91.7%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 12 (100.0%) | 11 (91.7%) | 11 (91.7%) | 12 (100.0%) | 12 (100.0%) |
| P_WORD | 17 | 11 (64.7%) | 17 (100.0%) | 11 (64.7%) | 16 (94.1%) | 11 (64.7%) | 13 (76.5%) | 13 (76.5%) | 12 (70.6%) | 14 (82.4%) | 11 (64.7%) | 17 (100.0%) | 11 (64.7%) | 15 (88.2%) | 11 (64.7%) | 17 (100.0%) | 11 (64.7%) | 17 (100.0%) | 12 (70.6%) | 16 (94.1%) | 11 (64.7%) | 12 (70.6%) | 11 (64.7%) | 16 (94.1%) | 11 (64.7%) | 14 (82.4%) | 11 (64.7%) | 17 (100.0%) | 11 (64.7%) | 17 (100.0%) | 11 (64.7%) | 17 (100.0%) | 12 (70.6%) | 17 (100.0%) |
| P_WORD_VERB | 5 | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 4 (80.0%) | 2 (40.0%) | 1 (20.0%) | 1 (20.0%) | 2 (40.0%) | 1 (20.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 5 (100.0%) | 3 (60.0%) | 2 (40.0%) | 2 (40.0%) | 5 (100.0%) | 4 (80.0%) | 3 (60.0%) | 1 (20.0%) | 5 (100.0%) | 5 (100.0%) | 2 (40.0%) | 3 (60.0%) | 5 (100.0%) | 5 (100.0%) | 2 (40.0%) | 2 (40.0%) | 3 (60.0%) | 2 (40.0%) | 3 (60.0%) | 1 (20.0%) |
| S_ALT | 2 | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 0 (0.0%) | 1 (50.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) | 1 (50.0%) | 2 (100.0%) |
| S_FOOTNOTE | 2 | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) |
| S_HEADER | 2 | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) | 2 (100.0%) |

