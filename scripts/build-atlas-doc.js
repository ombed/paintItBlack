/* Builds docs/atlas-tags-he.md from engine/06-atlas-tags.js:  node scripts/build-atlas-doc.js

   The engine file is the source of truth; the document is the review copy
   she reads and corrects. tests/atlas_t.js fails when the document is stale,
   so the two never drift. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "atlas-tags-he.md");

function load() {
  const src = fs.readFileSync(path.join(ROOT, "engine", "06-atlas-tags.js"), "utf8");
  const ctx = {};
  vm.runInNewContext(src + "\nthis.ATLAS_TAGS=ATLAS_TAGS;this.ATLAS_KEYS=ATLAS_KEYS;this.ATLAS_VOCAB=ATLAS_VOCAB;", ctx);
  return ctx;
}

function build() {
  const { ATLAS_TAGS, ATLAS_KEYS, ATLAS_VOCAB } = load();
  const names = Object.keys(ATLAS_TAGS);
  const byRegion = {};
  for (const n of names) {
    const t = ATLAS_TAGS[n].split("|");
    (byRegion[t[4]] = byRegion[t[4]] || []).push([n, t]);
  }
  const lines = [];
  lines.push("# מאפייני היישובים שבמפת המרחקים — טיוטה לבדיקה");
  lines.push("");
  lines.push("מסמך זה נבנה מ-`engine/06-atlas-tags.js` (`npm run build:atlas`), והוא העותק לקריאה ולתיקון.");
  lines.push("תיקון נכתב בקובץ המנוע, והמסמך נבנה מחדש; `tests/atlas_t.js` נופל כשהם לא תואמים.");
  lines.push("");
  lines.push("**למה זה קיים.** יישוב מוחלף ביישוב אחר תוך שמירה על המרחקים בין היישובים שבמסמך.");
  lines.push("עד כאן נשמרו רק המרחקים, ולכן עיר חרדית יכלה להפוך לקיבוץ וכפר ערבי לעיר יהודית.");
  lines.push("ההחלטה (Q11): **מאפיינים לפני מרחק**. אוכלוסייה שונה פסולה בכל מרחק; אחריה דת, עירוני מול כפרי, וגודל.");
  lines.push("");
  lines.push("**המילון.** תיוג גס ואובייקטיבי בלבד; «מעורב» ו«לא ידוע» הם ערכים מפורשים, לא ברירת מחדל.");
  lines.push("");
  lines.push("| ציר | ערכים |");
  lines.push("|---|---|");
  for (const k of ATLAS_KEYS) lines.push(`| ${k} | ${ATLAS_VOCAB[k].join(" · ")} |`);
  lines.push("");
  lines.push("גודל: גדול — מאה אלף תושבים ומעלה; בינוני — עשרים עד מאה אלף; קטן — פחות מעשרים אלף.");
  lines.push("");
  lines.push(`${names.length} יישובים. מה שנראה שגוי — לתקן בקובץ המנוע, שורה אחת ליישוב.`);
  lines.push("");
  const order = ATLAS_VOCAB["אזור"];
  for (const r of order) {
    const rows = byRegion[r] || [];
    if (!rows.length) continue;
    lines.push(`## ${r} (${rows.length})`);
    lines.push("");
    lines.push("| יישוב | סוג | אוכלוסייה | דת | גודל |");
    lines.push("|---|---|---|---|---|");
    for (const [n, t] of rows.sort((a, b) => a[0].localeCompare(b[0], "he")))
      lines.push(`| ${n} | ${t[0]} | ${t[1]} | ${t[2]} | ${t[3]} |`);
    lines.push("");
  }
  return lines.join("\n");
}

if (require.main === module) {
  fs.writeFileSync(OUT, build());
  console.log("wrote " + path.relative(ROOT, OUT));
}
module.exports = { build, load, OUT };
