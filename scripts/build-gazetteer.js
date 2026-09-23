/* Builds engine/07-gazetteer.js from the government list of localities:
     node scripts/build-gazetteer.js path/to/localities.json

   Source: data.gov.il, dataset "רשימת יישובים" (resource
   5c78e9fa-c2e2-4771-93ff-7f400a12f7ba), public data. The file holds
   every locality name as the engine's GAZ list. The engine uses only the
   names of two words or more: findPlaces in engine/06-model.js skips every
   one-word entry, neither replacing nor flagging it, because on real
   documents they were almost all ordinary words (docs/measurements.md). This
   replaced the homograph-flagging rule of PLAN-v18 Q10. Names already in
   PLACES (the ones with coordinates, used for the distance-preserving map)
   are left out. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const src = process.argv[2];
if (!src) { console.error("usage: node scripts/build-gazetteer.js localities.json"); process.exit(2); }
const j = JSON.parse(fs.readFileSync(src, "utf8"));
const recs = j.result ? j.result.records : j;

// the coordinate list the engine already carries
const model = fs.readFileSync(path.join(ROOT, "engine", "06-model.js"), "utf8");
const placesLine = model.split(/\r?\n/).find((l) => l.startsWith("const PLACES=["));
const have = new Set([...placesLine.matchAll(/\["([^"]+)",/g)].map((m) => m[1]));

// "(שבט)", "(איחוד)", "(מאוחד)": a bracketed qualifier is not part of the name people write
const clean = (s) => String(s || "").replace(/\s*\([^)]*\)\s*$/u, "").replace(/\s+/g, " ").trim();
const names = new Set();
for (const r of recs) {
  const n = clean(r["שם_ישוב"]);
  if (!n || n.length < 2 || !/[א-ת]/.test(n)) continue;
  if (have.has(n)) continue;
  names.add(n);
}
const list = [...names].sort((a, b) => a.localeCompare(b, "he"));
const out = `/* ══════════ מאגר יישובים ══════════
   ${list.length} שמות יישובים מרשימת הלמ"ס (data.gov.il), בלי אלה שכבר ב-PLACES עם
   קואורדינטות. נבנה ב-scripts/build-gazetteer.js; לא לערוך ביד. הרשימה מלאה, אבל
   findPlaces (06-model.js) משתמש רק בשמות בני שתי מילים ומעלה; שם בן מילה אחת
   מכאן לא נתפס כלל. הנימוק והכלל המלא — שם. */
const GAZ=${JSON.stringify(list)};
const GAZ_RX=new RegExp("(?<![\\\\u0590-\\\\u05ff])(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?("+
  GAZ.slice().sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^\${}()|[\\]\\\\]/g,"\\\\$&")).join("|")+
  ")(?![\\\\u0590-\\\\u05ff])","gu");
`;
fs.writeFileSync(path.join(ROOT, "engine", "07-gazetteer.js"), out);
console.log(`engine/07-gazetteer.js: ${list.length} localities (${have.size} already in PLACES)`);
