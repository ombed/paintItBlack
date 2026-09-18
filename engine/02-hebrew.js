/* ══════════════════════════ עברית ══════════════════════════ */
const NM={"\u05f3":"'","\u05f4":'"',"\u2018":"'","\u2019":"'","\u201c":'"',"\u201d":'"',
  "\u05be":"-","\u2010":"-","\u2011":"-","\u2012":"-","\u2013":"-","\u2014":"-",
  "\u00a0":" ","\u2007":" ","\u202f":" "};
const ZAP=/[\u200e\u200f\u200b\u200c\u200d\u0591-\u05c7]/;
function norm(t){let o="";for(const c of t) o+= ZAP.test(c)?"\u0000":(NM[c]||c);return o}
const HB="\\u0590-\\u05ff",NW=`(?<![${HB}A-Za-z0-9'"])`,NWE=`(?![${HB}A-Za-z0-9'"])`;
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
function fakeDate(s,offDays){
  const m=/^(\d{1,2})([./])(\d{1,2})\2(\d{4}|\d{2})$/.exec(String(s||"").trim());
  if(!m)return null;
  const d=+m[1], mo=+m[3], y2=m[4].length===2, y=y2?2000+ +m[4]:+m[4];
  if(d<1||d>31||mo<1||mo>12)return null;
  const t=new Date(Date.UTC(y,mo-1,d));
  if(t.getUTCDate()!==d||t.getUTCMonth()!==mo-1)return null;
  t.setUTCDate(t.getUTCDate()+(offDays|0));
  const yy=t.getUTCFullYear();
  const ys=y2?String(yy%100).padStart(2,"0"):String(yy);
  return `${t.getUTCDate()}${m[2]}${t.getUTCMonth()+1}${m[2]}${ys}`;
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
