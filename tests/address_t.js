/* The tool speaks to its users in the plural (owner's decision, 5.10.2026).

   It was written for one client, so the tour and many messages said לחצי, הוסיפי, בדקי, ראי,
   and some buttons and notes said אל תחליף and אשר ידנית. Now that anyone can use it, every
   sentence addressed to the reader is plural: לחצו, הוסיפו, אל תחליפו, שלכם.
   This reads the text the tool ships, without comments, and fails on a second-person singular
   form. Each word below is one that only an address to the reader uses. The words that are
   also something else stay out of the list, so they can never fail it:
   - המשך is a label ("continue");
   - הוספת is a noun ("הוספת כולם", adding all);
   - ודאי means "certain";
   - כתבי appears in "כתבי בי-דין". */
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ROOT = path.join(__dirname, "..");
const H = "\\u0590-\\u05FF";
// everything whose text reaches the screen, the report or the downloaded package, and the issue form a
// user fills in to report a leak (it said «אם לחצת» until 6.10)
const FILES = ["index.html", "redact-engine.js", "page-logic.js", "pdf-text.js", "text-to-docx.js", "support.js", "sw.js", "manifest.webmanifest",
  ".github/ISSUE_TEMPLATE/leak.yml"];
// comments are for developers and may quote the old words; "//" after ":" is a URL, not a comment
const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
const SINGULAR = [
  "לחצי", "הוסיפי", "הקלידי", "העלי", "בדקי", "ראי", "בחרי", "סמני", "השאירי", "הדביקי", "גררי", "פתחי", "שמרי",
  "העתיקי", "המשיכי", "אשרי", "מחקי", "סגרי", "הורידי",
  "שלך", "לך", "בעצמך", "אותך", "עליך", "אליך", "ממך", "בשבילך",
  "שביקשת", "שסימנת", "שהקלדת", "שהגדרת", "שבחרת", "ציפית", "לחצת", "העלית",
  "אשר ידנית", "ודאי שזה",
];
const word = new RegExp("(?<![" + H + "])(" + SINGULAR.join("|") + ")(?![" + H + "])", "g");
// a singular "don't": אל and a future form whose last letter is not ו (אל תוך is "into")
const LETTER = "\\u05D0-\\u05EA", NOT_VAV = "\\u05D0-\\u05D4\\u05D6-\\u05EA";
const dont = new RegExp("(?<![" + H + "])אל (ת[" + LETTER + "]*[" + NOT_VAV + "])(?![" + H + "])", "g");

const found = [];
for (const f of FILES) {
  const file = path.join(ROOT, f);
  if (!fs.existsSync(file)) continue;
  const text = strip(fs.readFileSync(file, "utf8"));
  for (const m of text.matchAll(word)) found.push(f + ": " + m[1] + "  …" + text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, " "));
  for (const m of text.matchAll(dont)) if (m[1] !== "תוך") found.push(f + ": אל " + m[1] + "  …" + text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, " "));
}
ok(found.length === 0, "no sentence the tool ships speaks to one reader:\n    " + found.slice(0, 12).join("\n    "));

// the check itself must see these forms: a sample in each shape it looks for
const probe = (s) => !!strip(s).match(word) || [...strip(s).matchAll(dont)].some((m) => m[1] !== "תוך");
ok(probe('"עכשיו: לחצי על «המשך»."') && probe('">אל תחליף</button>') && probe('"מחכה להחלטה שלך"') && probe('"התחליף שהקלדת נשאר"'),
  "it catches a feminine command, a singular don't, a singular \"your\", a singular past");
ok(!probe('"הוספת כולם והמשך"') && !probe('"נכנס אל תוך הקובץ"') && !probe('">אל תחליפו</button>') && !probe('"כמעט ודאי"') && !probe("// לחצי, in a comment"),
  "and lets the look-alikes pass: a noun, \"into\", the plural, \"certain\", a comment");

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
