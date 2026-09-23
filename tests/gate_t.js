/* The recall gate compares entities, not category totals (outside review, L19). */
const { compare } = require("../bench/gate.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const row = (doc, canonical, o) => ({ doc, cat: "P_FORMS", canonical, found: true, leaked: false, fp: 0, ...o });

// one entity fixed, another in the same category broken: the totals do not move
const base = { rows: [row("a1", "רחל פרידמן", { leaked: true }), row("a1", "דנה כהן")] };
const cur = { rows: [row("a1", "רחל פרידמן"), row("a1", "דנה כהן", { leaked: true })] };
const g = compare(base, cur);
ok(g.a.leaked === g.b.leaked, "the totals are the same, as before: " + g.a.leaked + " → " + g.b.leaked);
ok(g.worse.some((l) => l.includes("דנה כהן") && l.includes("now leaks")), "and the newly leaking entity is named: " + JSON.stringify(g.worse));
ok(g.better.some((l) => l.includes("רחל פרידמן")), "and so is the fixed one");

const g2 = compare(base, { rows: [...base.rows, row("s1", "שם חדש", { found: false, leaked: true })] });
ok(!g2.worse.length && g2.added.length === 1, "an entity new to the corpus is reported, not blocking: " + JSON.stringify(g2));

const g3 = compare(base, { rows: [base.rows[0], row("a1", "דנה כהן", { found: false })] });
ok(g3.worse.some((l) => l.includes("now missed")), "a newly missed entity is worse");
const g4 = compare(base, { rows: [base.rows[0], row("a1", "דנה כהן", { fp: 1 })] });
ok(g4.worse.some((l) => l.includes("fp 0 → 1")), "a new false positive is worse");

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
