/* ══════════════════════════ עברית ══════════════════════════ */
const NM={"\u05f3":"'","\u05f4":'"',"\u2018":"'","\u2019":"'","\u201c":'"',"\u201d":'"',
  "\u05be":"-","\u2010":"-","\u2011":"-","\u2012":"-","\u2013":"-","\u2014":"-",
  "\u00a0":" ","\u2007":" ","\u202f":" "};
const ZAP=/[\u200e\u200f\u200b\u200c\u200d\u0591-\u05c7]/;
function norm(t){let o="";for(const c of t) o+= ZAP.test(c)?"\u0000":(NM[c]||c);return o}
/* גבול מילה. גרש וגרשיים הם חלק ממילה רק כשהם צמודים לאות משני צדדיהם (עו"ד, ג'ורג') או
   אחרי אות בסוף מילה (ברקוביץ'). מירכאה שפותחת מילה אחרי רווח היא פיסוק: עד כאן ה-" שלפני
   "אלונים" נחשבה חלק מהמילה, ושם במירכאות לא נמצא ולא הוחלף בכלל — דליפה שקטה. אות שימוש אחת
   לפני המירכאה (ש"אלונים", ב"אלונים") היא עדיין פתיחת ציטוט; שתי אותיות לפניה (עו"ד) — ראשי תיבות. */
// אות עברית צמודה לספרה היא גבול בשני הכיוונים: "פרידמן2" (מספר הערת שוליים שהודבק) הוא השם,
// ו"ת"ז034567891" או "ביום14.3.2026" (בלי רווח) הם המספר. אות ליד אות, וספרה ליד ספרה, אינן
// גבול — אחרת מספר של עשר ספרות היה נתפס כת"ז בתשע הראשונות. אות לטינית צמודה חוסמת תמיד.
const HB="\\u0590-\\u05ff",NW=`(?<![A-Za-z])(?!(?<=[${HB}])[${HB}])(?!(?<=[0-9])[0-9])(?<![${HB}A-Za-z0-9][${HB}A-Za-z0-9]")(?<![${HB}A-Za-z0-9]')`,NWE=`(?![A-Za-z])(?!(?<=[${HB}])[${HB}])(?!(?<=[0-9])[0-9])(?!['"][${HB}A-Za-z0-9])`;
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
// norm שומר אורך וממיר ניקוד ל-\0, ולכן תבנית שמרשה \0 בין אותיות תופסת
// "רוֹנִית" בלי לשבור את מיפוי המיקומים. רווח ומקף שקולים: "לוי-אבקסיס"
// ו"לוי אבקסיס" הם אותו אדם.
const flex=s=>[...norm(s)].map(c=>/[\s-]/.test(c)?"[\\s-]+":esc(c)).join("\u0000*");
const H=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
// ערכים בעברית מלאים בגרשיים (ת"ז, עו"ד) — אטריביוט חייב קידוד חזק יותר
const A=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const SING=["ה","ו","ב","ל","מ","כ","ש"];
const DBL=["וה","ול","וב","ומ","וכ","וש","שה","של","שב","שכ","שמ","כש","מה","לכ","בה"];
// protect: מחרוזות שאסור שווריאנט יתנגש בהן (שמות אחרים, יישובים)
function variants(name,lvl,protect){
  const out=[[name,""]]; if(lvl==="off") return out;
  const p=name.trim().split(/\s+/),head=p[0],tail=p.slice(1);
  if(!/^[\u05d0-\u05ea]/.test(head)) return out;
  const pre = lvl==="safe"?["ה","ו","ל","ב"]:SING.concat(DBL);
  const seen=new Set([name]);
  for(const x of pre){
    const v=[x+head].concat(tail).join(" ");
    if(seen.has(v))continue;
    // "רון" + ש = "שרון" — אדם אחר לגמרי. לא מייצרים התנגשות.
    if(protect&&protect.has(v))continue;
    seen.add(v);out.push([v,x]);
  }
  return out;
}
const MERGE=new Set(["ב","ל","כ","ה"]);
/* ב/ל/כ + ה' הידיעה מתמזגות ("ל+הבית" → "לבית"), אבל רק כשה-ה' היא ה' הידיעה. בשם
   יישוב או בשם של אדם היא חלק מהשם: "ברמת גן" → "ב"+"הרצליה" נתן "ברצליה" (L14 בביקורת
   השנייה), ו"להדס" היה נעשה "לדס". שם מוכר — יישוב, שם פרטי, שם מהמאגר — שומר את ה-ה'. */
function nameWithHe(rep){
  const r=norm(String(rep||"")).trim(), w=r.split(/\s+/)[0];
  return (typeof PLACE_BY!=="undefined"&&!!(PLACE_BY[r]||PLACE_BY[w]))||
    (typeof KNOWN_FIRST!=="undefined"&&KNOWN_FIRST.has(w))||
    (typeof POOL!=="undefined"&&Object.values(POOL).some(a=>a.includes(w)));
}
function addPre(pre,rep){ if(!pre)return rep; if(!rep)return pre;
  if(rep[0]==="ה"&&MERGE.has(pre[pre.length-1])&&!nameWithHe(rep)) return pre+rep.slice(1);
  return pre+rep}
/* תאריך מוזז (Q5 בגרסה 3). תאריך שנמחק הוציא מה-AI "חסר תאריך ההחלטה"; תווית לא
   נותנת לו לחשב פרקי זמן. לכן כל תאריך מלא במסמך זז באותו מספר ימים — ההיסט
   נגזר מהמסמך (30–400 יום) ולכן יציב בין הרצות, המרווחים והסדר נשמרים, וההחזרה
   מחזירה כל תאריך למקורו כמו שם. הפורמט נשמר: אותו מפריד, אותו רוחב שנה. */
/* שנה בשתי ספרות: 20xx עד עשר שנים קדימה, ואחרת 19xx. עד כאן תמיד 20xx, ותאריך לידה מוזז "8.10.95"
   שה-AI כתב "8.10.1995" או "8 באוקטובר 1995" נשאר מוזז בתשובה (ביקורת, 6.10). fakeDate ו-dateParts. */
function fullYear(s){
  const n=+s; if(String(s).length!==2)return n;
  return 2000+n<=new Date().getUTCFullYear()+10?2000+n:1900+n;
}
/* כל כתיב רגיל של תאריך, ומה שצריך כדי לכתוב תאריך מוזז באותו כתיב: "12.3.2026", "12-03-26",
   "2026-03-12", "12 במרץ 2026" (גם ל, בלי אות, פסיק, מרס), ובלי שנה — "12.3", "12 במרץ". עד כאן רק
   תאריך מספרי עם שנה היה תאריך, ו"12 במרץ 2026" או "ביום 12.3" הגיעו ל-AI אמיתיים (הבעלים, 9.10, בדוגמה
   שבדף הבית). תאריך בלי שנה נבדק מול שנה מעוברת, כדי ש-29.2 יהיה תאריך. null: אינו תאריך אמיתי. */
const DATE_MONTHS=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
// בלי שנה: שנה רגילה, ושנה מעוברת רק ל-29.2
const dateRefYear=p=>p.m===2&&p.d===29?2024:2025;
function parseDate(s){
  const t=norm(String(s||"")).replace(/\u0000/g,"").trim(), lead=x=>x.length===2&&x[0]==="0";
  let m,p=null;
  if((m=/^(\d{1,2})([./-])(\d{1,2})(?:\2(\d{4}|\d{2}))?$/.exec(t))&&(m[4]||m[2]!=="-"))
    p={d:+m[1],m:+m[3],y:m[4]?fullYear(m[4]):null,form:"num",sep:m[2],y2:!!m[4]&&m[4].length===2,pd:lead(m[1]),pm:lead(m[3])};
  else if((m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)))
    p={d:+m[3],m:+m[2],y:+m[1],form:"iso",pd:m[3].length===2,pm:m[2].length===2};
  else if((m=/^(\d{1,2})(\s+)([בל]?-?)(ינואר|פברואר|מר[ץס]|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?:(,?\s+)(\d{4}))?$/.exec(t)))
    p={d:+m[1],m:m[4]==="מרס"?3:DATE_MONTHS.indexOf(m[4])+1,y:m[6]?+m[6]:null,form:"words",sp:m[2],conn:m[3],yc:m[5]||"",mar:m[4]==="מרס"?"מרס":null};
  if(!p||p.d<1||p.d>31||p.m<1||p.m>12)return null;
  const c=new Date(Date.UTC(p.y??dateRefYear(p),p.m-1,p.d));
  return c.getUTCDate()===p.d&&c.getUTCMonth()===p.m-1?p:null;
}
function fakeDate(s,offDays){
  const p=parseDate(s);
  if(!p)return null;
  const t=new Date(Date.UTC(p.y??dateRefYear(p),p.m-1,p.d));
  t.setUTCDate(t.getUTCDate()+(offDays|0));
  const d=t.getUTCDate(), mo=t.getUTCMonth()+1, y=t.getUTCFullYear(), z=(n,pad)=>pad&&n<10?"0"+n:String(n);
  if(p.form==="iso")return `${y}-${z(mo,p.pm)}-${z(d,p.pd)}`;
  if(p.form==="words")return d+p.sp+p.conn+(mo===3&&p.mar?p.mar:DATE_MONTHS[mo-1])+(p.y==null?"":p.yc+y);
  const dm=z(d,p.pd)+p.sep+z(mo,p.pm);
  return p.y==null?dm:dm+p.sep+(p.y2?String(y%100).padStart(2,"0"):String(y));
}
function validID(s){const d=s.replace(/\D/g,"");if(!d||d.length>9)return false;
  if(/^0+$/.test(d)||/^(\d)\1+$/.test(d))return false;
  const p=d.padStart(9,"0");let t=0;
  for(let i=0;i<9;i++){let n=+p[i]*(i%2?2:1);t+=n<10?n:n-9}return t%10===0}
function ibanOK(s){
  const t=s.replace(/\s/g,"").toUpperCase();
  if(!/^IL\d{21}$/.test(t))return false;
  const r=t.slice(4)+t.slice(0,4);
  let m=0; for(const c of r){
    const v=/\d/.test(c)?c:String(c.charCodeAt(0)-55);
    for(const d of v) m=(m*10+ +d)%97;
  }
  return m===1;
}
function luhn(s){const d=s.replace(/\D/g,"");if(d.length<12||d.length>19)return false;
  let t=0,a=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];
    if(a){n*=2;if(n>9)n-=9}t+=n;a=!a}return t%10===0}
const G_ONE=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
const G_TEN=["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
const G_HUN=["","ק","ר","ש","ת"];
function hord(n){
  if(n<1||n>=500)return "\u200f"+n+"\u200f";
  let r=n,out=G_HUN[Math.floor(r/100)]||""; r%=100;
  if(r===15)out+="טו"; else if(r===16)out+="טז";
  else {out+=G_TEN[Math.floor(r/10)]; out+=G_ONE[r%10];}
  return out.length>1 ? out.slice(0,-1)+'"'+out.slice(-1) : out+"׳";
}
