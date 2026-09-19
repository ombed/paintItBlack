## What changes

<!-- One or two sentences a reviewer can read without the diff. -->

## Kind

<!-- Tick exactly one. The "pr" check reads this. -->
- [ ] Bug fix
- [ ] Not a bug fix (feature, docs, tests, release)

## For a bug fix: the class, not the instance

<!-- docs/QUALITY-PLAN.md, layer 6. A bug a user found is one member of a class.
     Fixing only her case leaves its siblings for the next session, so each bug fix
     closes with the three answers below. Leave them empty for "Not a bug fix". -->

### 1. The case that was hit

<!-- The test that fails without the fix: its file and name, e.g.
     e2e/quotes-tour.spec.js "a quoted name is replaced and shown in context". -->

### 2. The class

<!-- What the siblings share, and what now covers all of them: a shape suite
     (tests/shapes_t.js), a self-check rule (selfCheck in index.html), a journey
     disturbance (e2e/unruly.js), or a new one named here. -->

### 3. The probe

<!-- What was tried beyond her case before closing, and what it found, "nothing"
     included. The 31-shape probe for quoted names found footnote digits and glued
     numbers in the same pass. -->

## Tests

<!-- Node, lint, the no-model gate, the browser suite. Say what failed and why. -->
