/* מנוע ההשחרה — הועבר כמו שהוא. אין כאן DOM. */
let nerSayFn=()=>{};
export const setNerSay=f=>{nerSayFn=f||(()=>{})};
const nerSay=(t,p)=>nerSayFn(t,p);
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;
  for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0}
async function pipe(u8,S,fmt){const s=new Blob([u8]).stream().pipeThrough(new S(fmt));
  return new Uint8Array(await new Response(s).arrayBuffer())}
const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");
const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");

async function unzip(buf){
  const dv=new DataView(buf),N=buf.byteLength;let e=-1;
  for(let i=N-22;i>=Math.max(0,N-66000);i--) if(dv.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0) throw new Error("הקובץ לא נראה כמו ‎.docx תקין");
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[];
  for(let i=0;i<n;i++){
    if(dv.getUint32(p,true)!==0x02014b50) throw new Error("מבנה הקובץ פגום");
    const meth=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),
      nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),
      lo=dv.getUint32(p+42,true);
    const name=new TextDecoder().decode(new Uint8Array(buf,p+46,nl));
    const lnl=dv.getUint16(lo+26,true),lel=dv.getUint16(lo+28,true);
    const raw=new Uint8Array(buf,lo+30+lnl+lel,cs);
    out.push({name,meth,raw});p+=46+nl+el+cl;
  }
  for(const f of out) f.data = f.meth===0 ? raw2(f.raw) : await inflate(f.raw);
  return out;
}
const raw2=u=>new Uint8Array(u);
async function zip(files){
  const enc=new TextEncoder(),loc=[],cen=[];let off=0;
  for(const f of files){
    const nm=enc.encode(f.name),c=crc32(f.data);
    let body,meth=8;
    try{body=await deflate(f.data); if(body.length>=f.data.length){body=f.data;meth=0}}
    catch(_){body=f.data;meth=0}
    const h=new Uint8Array(30+nm.length),d=new DataView(h.buffer);
    d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);
    d.setUint16(8,meth,true);d.setUint32(14,c,true);
    d.setUint32(18,body.length,true);d.setUint32(22,f.data.length,true);
    d.setUint16(26,nm.length,true);h.set(nm,30);
    loc.push(h,body);
    const ch=new Uint8Array(46+nm.length),cd=new DataView(ch.buffer);
    cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);
    cd.setUint16(8,0x800,true);cd.setUint16(10,meth,true);cd.setUint32(16,c,true);
    cd.setUint32(20,body.length,true);cd.setUint32(24,f.data.length,true);
    cd.setUint16(28,nm.length,true);cd.setUint32(42,off,true);ch.set(nm,46);
    cen.push(ch);off+=h.length+body.length;
  }
  const cs=cen.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array(22),ed=new DataView(end.buffer);
  ed.setUint32(0,0x06054b50,true);ed.setUint16(8,files.length,true);
  ed.setUint16(10,files.length,true);ed.setUint32(12,cs,true);ed.setUint32(16,off,true);
  return new Blob([...loc,...cen,end]);
}

/* ══════════════════════════ XML ══════════════════════════ */
const W="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XMLNS="http://www.w3.org/XML/1998/namespace";
const DEC='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const TXT=new TextDecoder(),ENC=new TextEncoder();
function rootTag(s){let i=0;
  while(i<s.length){const j=s.indexOf("<",i); if(j<0)return null;
    if(s[j+1]==="?"||s[j+1]==="!"){i=s.indexOf(">",j)+1;continue}
    let k=j+1,q=null;
    while(k<s.length){const c=s[k];
      if(q){if(c===q)q=null}else if(c==='"'||c==="'")q=c;else if(c===">")return s.slice(j,k+1);
      k++}
    return null}
  return null}
function parseXML(str){const d=new DOMParser().parseFromString(str,"application/xml");
  if(d.querySelector("parsererror")) throw new Error("XML פגום");return d}
function serXML(doc,orig){
  let out=new XMLSerializer().serializeToString(doc);
  const o=rootTag(orig),n=rootTag(out);
  if(o&&n&&!n.endsWith("/>")) out=o+out.slice(n.length);
  return DEC+out;
}
const TEXTPART=/^word\/(glossary\/)?(document\d*\.xml|header\d*\.xml|footer\d*\.xml|footnotes\.xml|endnotes\.xml)$/;
const DROP=["word/comments.xml","word/commentsExtended.xml","word/commentsIds.xml",
  "word/commentsExtensible.xml","word/people.xml","docProps/custom.xml","word/threadedComments.xml"];

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
function addPre(pre,rep){ if(!pre)return rep; if(!rep)return pre;
  if(rep[0]==="ה"&&MERGE.has(pre[pre.length-1])) return pre+rep.slice(1);
  return pre+rep}
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
/* ══════════ שמות חלופיים ריאליים ══════════
   הכינוי "פלוני א׳" מעביר את עומס החשיבה למשתמש: הוא עדיין צריך להחליט
   מה לכתוב כדי שהטקסט ייקרא. כאן נבחר שם אמיתי — נשמר המגדר, נשמר מספר
   המילים, ונשמר מוצא השם, כדי שהמשפט יישאר תקין דקדוקית וטבעי לקריאה.
   הבחירה דטרמיניסטית: אותו אדם יקבל את אותו שם גם במסמך הבא באותו תיק,
   גם בלי לטעון פרופיל. */
const POOL={
 he_f:["שירה","נועה","תמר","יעל","מיכל","רחל","אסתר","מרים","דנה","ליאת","אורית","סיגל",
  "איריס","ורד","גלית","מאיה","ענת","הילה","אביגיל","לימור","קרן","אפרת","אורלי","סמדר",
  "מירב","טליה","נעמי","שלומית","יהודית","רבקה","חנה","בתיה","אילנה","זהבה","פנינה",
  "אביבה","גילה","חוה","נורית","רותי","עינת","שירן","מוריה","תהילה","יפעת","הדס","נגה",
  "אלינור","רוני","שקד","עדן","נטלי","אנה","סבטלנה","אירינה","לודמילה","אולגה"],
 he_m:["אורי","יואב","איתי","נדב","רועי","גיא","אסף","ניר","עידו","אלון","יונתן","דור",
  "עמית","ליאור","אייל","ברק","זיו","יובל","ארז","גלעד","חיים","משה","יעקב","יוסף","דוד",
  "שמואל","אברהם","יצחק","מרדכי","נתן","שלמה","אליהו","בנימין","ראובן","שמעון","אשר",
  "דניאל","מיכאל","איתמר","עמרי","יהונתן","רותם","עידן","תומר","אמיר","נועם","אלירן",
  "שלומי","אבנר","מאיר","ציון","יגאל","בועז","אלכס","סרגיי","ולדימיר","דמיטרי"],
 he_s:["כהן","לוי","מזרחי","פרץ","ביטון","דהן","פרידמן","שפירא","אזולאי","אוחיון","גבאי",
  "אמסלם","חדד","עמר","בן-דוד","אשכנזי","טולדנו","סבן","אלמוג","ברקוביץ","רוזנברג",
  "גולדשטיין","וייס","קליין","שטרן","הרשקוביץ","זילברמן","אדלר","פלדמן","ברנשטיין",
  "גרינברג","לנדאו","שגב","ארבל","ברנע","גלעדי","אלבז","סויסה","ממן","אטיאס","בן-חמו",
  "נחמיאס","הראל","רוזן","שמעוני","בר-און","קרמר","וקנין","אבוטבול","מלמד","יעקובי",
  "פישר","קפלן","גורביץ","סלומון","נחום","דורון","אלקבץ","טל-שחר","בן-עמי","רווה"],
 ar_f:["פאטמה","עאישה","מריאם","נור","לילא","סמאח","רנא","הודא","אמל","סועאד","ראניה",
  "דלאל","נאדיה","סאלי","וורוד","הנאא","מנאל","ראידה","עביר","ג'ומאנה","סחר","ריהאם"],
 ar_m:["מוחמד","אחמד","עלי","חסן","חוסיין","מחמוד","ראמי","סמיר","ג'מאל","ח'אלד","יוסוף",
  "איברהים","מוסטפא","נביל","ואאל","זיאד","בילאל","טארק","עאדל","מאהר","פאדי","רמזי"],
 ar_s:["ח'טיב","מנצור","זועבי","סרסור","חמדאן","נאסר","סלימאן","דרוויש","עוואד","טאהא",
  "ג'בארין","אגבאריה","מסארווה","ותד","בדראן","שאהין","קאסם","זידאן","עבד אל-האדי",
  "אבו-ראס","אבו-סאלח","חלאילה","גנאים","עאזם","נסאר","דבור","סעדי","חוסארי"]};
const AR_HINT=new Set(["אבו","אל","עבד","בן-עלי","אבן"]);
/* שמות פרטיים שהם גם מילים. "חיים כהן" הוא אדם, אבל "החיים שלו נהרסו"
   היא מילה, ו"נתן" הוא פועל. חלק כזה של שם לא מוחלף עם אותיות שימוש,
   לא נבחר כשם בדוי, ולא מוחזר מתשובת AI כשהוא עומד לבד. */
const WORDLIKE=new Set(("חיים שלום אור גיל דור ברק שחר אביב עמית נועם טל רון "+
 "יובל גיא ורד שירה שיר מור פנינה מלכה תקווה אמונה שמחה אושר נחת ציון ניר "+
 "אלון ארז רותם עידן אמיר זיו אלמוג רווה הראל ארבל דורון נגה עדן שקד הדס "+
 "תהילה הילה קרן סיגל איריס נורית גילה זהבה חן שי בר לב שדה הר נחל דקל תמר "+
 "רימון אורן מאיר יפה טוב ברכה גאולה דוד דן נתן ברוך יונה רם ניצן עדי אמת "+
 "חסד רחמים צדק אלי יאיר ירון יריב ידיד יקיר יגאל יעל אילן אילה איל צבי "+
 "צביה זאב אריה דב נמר נחמה אורי אסף ידין רועי רוני לירון לירז נועה נעם "+
 "שלמה עמוס אביה אביחי אביטל אבנר אדיר אופיר אורית אלעד אליה אמונה גלית "+
 "דליה דפנה הדר חגי חגית טליה יהלי ליאור לילך מוריה מעיין נטע סתיו ספיר "+
 "עומר עופר עמרי ענבל ענת פז צופיה קשת רז רינה רננה שגב שגיא שחף שלו שני "+
 "תום תמיר").split(/\s+/));
const AR_NAMES=new Set([...POOL.ar_f,...POOL.ar_m,...POOL.ar_s,"מוחמד","אחמד","מחמד",
 "עומאר","סאלח","ג'מיל","נאדר","איאד","ריאד","סועאד","אימאן","ח'ליל","נעים","רימא"]);
const FEM=new Set(POOL.he_f.concat(POOL.ar_f,["שרון","דליה","נירית","מיטל","ליהי","סתיו",
 "שירלי","אורנה","אתי","ציפורה","נאוה","סימה","רוחמה","שושנה","לאה","דבורה","צילה",
 "פרידה","רוזה","קלרה","ויקטוריה","מרינה","ליאורה","תמי","הודיה","אביטל","מעיין",
 "ספיר","שירז","מיטל","אביגייל","רעות","שירלין","ברכה","גאולה","יעלה"]));
const MASC=new Set(POOL.he_m.concat(POOL.ar_m));
function origin(v){
  const w=v.split(/[\s-]+/);
  if(w.some(x=>AR_HINT.has(x)||AR_NAMES.has(x)))return "ar";
  if(/[ח'ג'ת'ד'ז']/.test(v)&&/'/.test(v))return "ar";
  return "he"}
// המגדר נקבע קודם כל לפי מה שכתוב במסמך ("הנתבעת", "גב'"), ורק אחר כך
// לפי השם עצמו. סיומת ה' היא ניחוש אחרון, לא כלל.
function gender(v,hint){
  if(hint==="f"||hint==="m")return hint;
  const first=v.trim().split(/\s+/)[0];
  if(FEM.has(first))return "f";
  if(MASC.has(first))return "m";
  if(/(?:ית|את|ה)$/.test(first)&&first.length>=4)return "f";
  return "m"}
function hash32(s){let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}
  return h>>>0}
function pickFrom(arr,seed,used,forbidden){
  const n=arr.length;
  for(let k=0;k<n;k++){
    const v=arr[(seed+k*7+((seed>>>8)%3))%n];
    if(used.has(v)||forbidden.has(v)||WORDLIKE.has(v))continue;
    if(typeof PLACE_BY!=="undefined"&&PLACE_BY[v])continue;
    if(STOP.has(v))continue;
    return v}
  return arr[seed%n]+" "+((seed%89)+11)}
// שם פרטי לבד או שם משפחה לבד — נשמר אותו סוג, אחרת "כהן" הופך ל"יעל"
// והמשפט "מר כהן טען" נשבר.
function fakeName(value,hint,used,forbidden){
  const org=origin(value), g=gender(value,hint);
  const parts=value.trim().split(/\s+/);
  const seed=hash32(norm(value).trim());
  const firsts=POOL[org+"_"+(g==="f"?"f":"m")], surs=POOL[org+"_s"];
  if(parts.length===1){
    const isFirst=FEM.has(parts[0])||MASC.has(parts[0]);
    const out=pickFrom(isFirst?firsts:surs,seed,used,forbidden);
    used.add(out);return out}
  const f=pickFrom(firsts,seed,used,forbidden); used.add(f);
  const s=pickFrom(surs,hash32("s"+norm(value)),used,forbidden); used.add(s);
  // "אלעד בן דוד" → "דניאל בן קפלן": המילית נשארת, כי היא חלק מהמבנה
  // ולא מהזהות. שם משפחה כפול אחר → שם משפחה בדוי אחד, פשוט יותר.
  const PARTS=new Set(["בן","בת","אבו","אל","דה","ואן","בר"]);
  const out=parts.length>2&&PARTS.has(parts[1])?f+" "+parts[1]+" "+s:f+" "+s;
  used.add(out);return out}

/* ══════════ שיבושי תמלול ══════════
   התקלה האמיתית: "פנים מאירות" הוקלד בתמלול כ"פנים מהירות", ולכן
   חיפוש-והחלפה פספס אותו והפרט המזהה יצא החוצה. אחרי ההחלפה סורקים את
   הפלט אחרי מילים שנמצאות במרחק עריכה של תו אחד משם שכבר הוחלף. */
const HOMO=new Set();
[["א","ה"],["א","ע"],["ה","ע"],["א","י"],["כ","ח"],["ק","כ"],["ת","ט"],["ס","ש"],
 ["ב","ו"],["ז","צ"],["ו","י"],["ם","מ"],["ן","נ"],["ך","כ"],["ף","פ"],["ץ","צ"],
 ["ש","ס"],["ד","ת"],["ג","ק"],["ל","ר"],["ל","נ"],["נ","ר"],["מ","נ"],
 ["ב","פ"],["ד","ט"],["ג","כ"]].forEach(([a,b])=>{HOMO.add(a+b);HOMO.add(b+a)});
function near1(a,b){
  const la=a.length,lb=b.length;
  if(Math.abs(la-lb)>1)return null;
  let i=0; while(i<la&&i<lb&&a[i]===b[i])i++;
  if(i===la&&i===lb)return null;
  let j=0; while(i+j<la&&i+j<lb&&a[la-1-j]===b[lb-1-j])j++;
  const ra=la-i-j, rb=lb-i-j;
  if(ra>1||rb>1||ra<0||rb<0)return null;
  if(ra===1&&rb===1)return {k:"sub",p:a[i]+b[i]};
  if(ra!==rb)return {k:"len",p:ra?a[i]:b[i]};
  return null}
// א/ה/ו/י הן אימות קריאה: כתיב מלא מול חסר הוא ההבדל הנפוץ ביותר
// בעברית, ולכן הוספה או השמטה שלהן היא שיבוש סביר. הוספת ש' אינה.
const WEAK=new Set(["א","ה","ו","י"]);
const WRX=/[\u0590-\u05ff][\u0590-\u05ff'"\u05f3\u05f4-]*/gu;
function words(t){const o=[];WRX.lastIndex=0;let m;
  while((m=WRX.exec(t)))o.push({w:m[0],s:m.index,e:m.index+m[0].length});return o}
function findNear(blocks,targets,banned){
  // הסף הקודם דרש חמש אותיות לשם בן מילה אחת, וכך חסם בדיוק את המקרה
  // שממנו התחלנו: "שלוה" מול "שלווה". ארבע אותיות זה שם.
  const tg=targets.filter(t=>t.norm.length>=4).slice(0,120);
  if(!tg.length)return [];
  const byK={}; for(const t of tg)(byK[t.words]=byK[t.words]||[]).push(t);
  const out=[],seen=new Set();
  const docTok=new Set();
  for(const blk of blocks)for(const w of (norm(blk.text).match(WRX)||[]))docTok.add(w);
  for(const blk of blocks){
    const n=norm(blk.text), tk=words(n);
    if(!tk.length)continue;
    for(const k of Object.keys(byK)){
      const K=+k; if(tk.length<K)continue;
      const list=byK[k];
      for(let i=0;i+K<=tk.length;i++){
        let cand=tk[i].w;
        for(let z=1;z<K;z++)cand+=" "+tk[i+z].w;
        const bare=cand.replace(/^[בהולמכש]/,"");
        for(const t of list){
          if(cand===t.norm||bare===t.norm)continue;
          // חילוף של אות שימוש בלבד אינו שיבוש: "בחיים" מול "שחיים" הוא אותו "חיים"
          // עם ב במקום ש, ו"בגיל" הוא "גיל" עם ב. בשני המקרים זו מילה (בחיים לא
          // ראיתי, בגיל 8), והצעה כאן משחיתה את המשפט אם היא מתקבלת.
          if(PFX.has(cand[0])&&PFX.has(t.norm[0])&&cand.slice(1)===t.norm.slice(1))continue;
          if(PFX.has(cand[0])&&cand.slice(1)===t.norm)continue;
          const r=near1(cand,t.norm)||near1(bare,t.norm);
          if(!r)continue;
          const s=tk[i].s,e=tk[i+K-1].e, raw=blk.text.slice(s,e);
          const nraw=norm(raw).trim();
          if(banned.has(nraw)||STOP.has(nraw))continue;
          // "אולי" רחוק תו אחד מ"אורלי" אבל הוא מילה, לא שיבוש של שם
          if(!cand.split(" ").every(w=>nameish(w,docTok)))continue;
          if(t.words===1&&t.norm.length<=4&&
             !(r.k==="sub"?HOMO.has(r.p):WEAK.has(r.p)))continue;
          const key=nraw+"|"+t.value;
          if(seen.has(key))continue; seen.add(key);
          const homo=r.k==="sub"&&HOMO.has(r.p);
          out.push({value:raw,label:"כמעט התאמה",part:partName(blk.part),
            ctx:ctxHTML(blk.text,s,e),review:true,src:"near",
            near:{target:t.value,rep:t.rep,kind:t.kind},
            conf:homo?"high":"medium",
            why:`נכתב כמעט כמו «${t.value}» שכבר הוחלף`+
              (homo?` — אותיות מתחלפות בתמלול (${r.p[0]}↔${r.p[1]})`:
                    (r.k==="sub"?` — תו אחד שונה (${r.p[0]}↔${r.p[1]})`:" — תו אחד חסר או עודף"))});
          break}}}}
  return out.sort((a,b)=>(a.conf==="high"?0:1)-(b.conf==="high"?0:1))}

/* ══════════ שמות בגוף הטקסט ══════════
   העוגנים המבניים ("עו״ד", "בפני", "ת״ז") חיים בפתיח של כתב טענות.
   מסמך שנולד מתמלול הוא נרטיב, ואין בו כמעט אף אחד מהם — ושם בדיוק
   יושבים השמות שהיא עלולה לשכוח. בעברית אין אותיות גדולות, ולכן
   הרמז החזק ביותר הוא מה שעומד לפני פועל שאדם עושה. */
const VRB=new Set(("אמר אמרה אמרו טען טענה טענו מסר מסרה מסרו ציין ציינה ציינו "+
 "הוסיף הוסיפה הוסיפו סיפר סיפרה סיפרו השיב השיבה השיבו ענה ענתה ענו העיד העידה "+
 "הצהיר הצהירה המליץ המליצה המליצו דיווח דיווחה דיווחו סירב סירבה סירבו ביקש ביקשה "+
 "ביקשו אישר אישרה אישרו הכחיש הכחישה חתם חתמה חתמו פנה פנתה פנו כתב כתבה שלח שלחה "+
 "הודיע הודיעה נכח נכחה נכחו הגיע הגיעה הגיעו הסביר הסבירה הבהיר הבהירה התנגד התנגדה "+
 "הסכים הסכימה הודה הודתה הגיש הגישה הגישו צירף צירפה העביר העבירה קיבל קיבלה "+
 "הופיע הופיעה הופיעו נשאל נשאלה עזב עזבה חזר חזרה התקשר התקשרה החליט החליטה "+
 "קבע קבעה הורה הורתה ראה ראתה שמע שמעה ידע ידעה נהג נהגה הכיר הכירה סיכם סיכמה "+
 "אומר אומרת טוען טוענת מוסר מוסרת מספר מספרת מבקש מבקשת מציין מציינת").split(" "));
const ATTR=new Set(("לדברי לטענת מפי בנוכחות לבקשת בהשתתפות באוזני "+
 "בהנחיית בליווי בהובלת מייצג מייצגת").split(" "));
/* ילדים לא מדברים במסמכים האלה — מדברים עליהם. הם מופיעים בשייכות
   ובמילות יחס: "במקרה של X", "בשביל X", "אמא של X". זו הקטגוריה הכי
   רגישה במסמך שלה, והיא בדיוק זו שאין לה אף פועל אמירה. */
const PREP=new Set(("בשביל עבור בזכות בעניין לגבי כלפי אצל אודות בנוגע "+
 "מטופל המטופלת").split(" "));
const KIN=new Set(("אמא אבא אמו אביו אמה אביה הורי הורים הורה בן בת בנו בתו "+
 "אח אחות אחיו אחותו משפחת משפחה ילדו ילדה טובתו טובתה מקרה עניינו עניינה "+
 "גיסתנו דודה דוד סבתא סבא אשתו בעלה גרושתו בת-זוגו").split(" "));
const CARE=new Set(("תמיכה תמיכת טיפול טיפולה ליווי עזרה סיוע מעקב קשר "+
 "פגישה מפגש דאגה אחריות השמה").split(" "));
const REL=new Set(["שהוא","שהיא","שהם","שהן","אשר"]);
const ROLE2=("עובדת סוציאלית|עובד סוציאלי|מנהלת בית הספר|מנהל בית הספר|"+
 "מנהלת המחלקה|מנהל המחלקה|יועצת חינוכית|קצינת מבחן|קצין מבחן|"+
 "פקידת סעד|פקיד סעד|אחראית משמרת").split("|");
const ROLE1=("מנהלת מנהל מטפלת מטפל רופאה רופא פסיכולוגית פסיכולוג פסיכיאטר "+
 "מורה גננת מפקחת מפקח אחות מדריכה מדריך יועצת יועץ שכנה שכן מזכירה מזכיר "+
 "חוקרת חוקר שוטרת שוטר קצינה קצין מאבטח נהגת נהג סייעת מרצה בלשית בלש "+
 "אפוטרופסית אפוטרופוס מגשרת מגשר").split(" ");
// מילים שכיחות שעלולות לעמוד לפני פועל ולהיראות כמו שם
const COMMON=new Set(("ילד ילדה ילדים ילדות אם אב אמא אבא הורה הורים בן בת בנים בנות "+
 "אח אחות אחים משפחה איש אישה אנשים גבר נער נערה תינוק תינוקת סבא סבתא דוד דודה "+
 "עד עדה עדים מטופל מטופלת לקוח לקוחה תלמיד תלמידה צוות ועדה גורם גורמים מוסד "+
 "מפגש פגישה דיון ישיבה שיחה טלפון מכתב מסמך מסמכים דוח דוחות תיק תיקים "+
 "בקשה תגובה החלטה פסק צו הודעה תלונה תביעה טענה טענות ראיה ראיות עדות "+
 "מצב מקרה עניין נושא דבר דברים זמן שעה יום ימים שבוע חודש שנה שנים "+
 "מקום בית בתים דירה חדר רחוב עיר כפר שכונה עבודה כסף סכום תשלום חוב "+
 "אמת שקר צדק חוק דין משפט זכות חובה סעיף פרק נספח מזונות משמורת הסדרי "+
 "בעל בעלה אשתו גרושה גרוש בת-זוג בן-זוג קטין קטינה רווחה חינוך בריאות "+
 "מרכז מעון פנימייה מחלקה יחידה שירות שירותים אגף סניף מרפאה מוקד "+
 "משיב משיבה מבקש מבקשת תובע תובעת נתבע נתבעת נאשם נאשמת מערער מערערת "+
 "עורר עוררת מצהיר מצהירה כוח באת בא צד צדדים מותב ערכאה מבקשים משיבים "+
 "סוציאלית סוציאלי חינוכית חינוכי משפטית משפטי רפואית רפואי "+
 "ארכה דחייה ערעור פשרה סעד הוצאות אגרה עיכוב הליך הליכים בורר גישור "+
 "סיום סיכום תחילה התחלה המשך מהלך מעמד נוכחות נסיבות שלב שלבים מועד "+
 "מסגרת עקבות רקע הקשר אופן פועל סמוך תום ראשית סופו אחרית עצם רגע "+
 "זאת אלה אלו הכל הכול חלק רוב מיעוט אחד אחת שני שתי שלוש ארבע "+
 "עבר הווה עתיד בוקר צהריים ערב לילה שבת ראשון שלישי רביעי חמישי "+
 "אולי כאילו ממש בדיוק באמת אפילו בכלל לגמרי בערך כמעט מאוד מאד ממילא "+
 "לפעמים תמיד אחרי לפני בתוך מתוך בגלל למרות בזמן כאשר אשר כדי בין "+
 "שלנו שלהם שלכם שלהן אותם אותנו אותה אותו אותן עצמו עצמה עצמנו עצמם "+
 "הרבה מעט יותר פחות כמו אבל ולכן לכן אולם אכן כמובן בהחלט בוודאי בטח "+
 "נכון גדול קטן חדש ישן אחרון כללי מיוחד חשוב קשה ברור פשוט מסוים שונה "+
 "כלומר למשל בנוסף יחד לבד שוב כבר עדיין פתאום מיד מהר קודם אחרת סתם "+
 "כולם כולנו כולם אנחנו אתם אתן הייתי היינו יהיה תהיה להיות עושה עושים "+
 "צריך צריכה צריכים רוצה רוצים יכול יכולה יכולים חושב חושבת אומרים "+
 "שניים שתיים שלושה שלוש ארבעה ארבע חמישה חמש שישה שש שבעה שבע "+
 "שמונה תשעה תשע עשרה עשרים שלושים ארבעים חמישים מאה אלף מיליון "+
 "שכלית שכלי נפשית נפשי פיזית פיזי מוגבלות מוגבלויות התפתחותי "+
 "שרות רכז רכזת מרכז מנחה מנחת מפקח מפקחת סמנכל מנכל יור ציר צירה "+
 "מקצועית מקצועי כלכלית כלכלי ארצית ארצי אזורית מחוזית ראשית בכירה בכיר "+
 "לנו לכם להם לכן לנו אלינו אליכם אליהם עלינו עליכם עליהם איתנו איתכם "+
 "קשר ישיבה ישיבת מכון עמותה עמותת ארגון איגוד לשכה לשכת אגודה "+
 "נפלאה נפלא מצוינת מצוין טובה נהדרת נהדר מדהים מדהימה נוספת נוסף "+
 "אחרת ראשונה אחרונה מרצה מלווה אחראית אחראי עצמאית עצמאי "+
 "איזו איזה ממנה ממנו מהם מהן אליה אליו בהם בהן כזה כזו כאלה "+
 "שלא שלו שלה שלי שהם שהן שזה שזו שיש שאין שאני שאתה שהוא שהיא "+
 "שכל שרק שעוד שכבר שגם שאם שאת שאנחנו שאפשר שצריך שיהיה שהיה "+
 "ולא ואם וגם וכן ומה וזה וכל ואת ואני ואנחנו לכן ממה במה כמה למה "+
 "מזה בזה לזה מכל בכל לכל ככה כשה כדי מאז ומאז ולכן ואז ואילו "+
 "אב אם בן בת אח אחות עד עדה ילד ילדה נער נערה גיל שם כתובת טלפון").split(/\s+/));
function tokall(t){const o=[];WRX.lastIndex=0;let m;
  while((m=WRX.exec(t)))o.push({w:m[0],s:m.index,e:m.index+m[0].length});return o}
function stems(w){
  const o=[w];
  if(PFX.has(w[0]))o.push(w.slice(1));
  if(PFX.has(w[0])&&PFX.has(w[1]))o.push(w.slice(2));
  return o}
function nameish(w,docTok){
  if(w.length<3||w.length>14)return false;
  if(PLACE_BY[w]||AMBIG.has(w))return false;
  if(ROLE1.includes(w))return false;
  // "שהילדה" הוא ש+ה+ילדה. בלי קילוף אותיות השימוש כל מילה מיודעת
  // בטקסט נראית כמו שם.
  for(const st of stems(w)){
    if(st.length>=2&&COMMON.has(st))return false;
    if(st.length<3)continue;
    if(STOP.has(st)||VRB.has(st)||ATTR.has(st))return false;
    if(PREP.has(st)||KIN.has(st)||CARE.has(st)||REL.has(st))return false;
    if(st!==w&&docTok.has("ה"+st))return false}
  if(w[0]==="ה"){const r=w.slice(1);
    if(r.length>=3&&docTok.has(r))return false;
    if(r.length<4)return false}
  if(docTok.has("ה"+w))return false;
  return true}
function bodyNames(blocks,known){
  const kn=new Set(); for(const k of known){const n=norm(k).trim();
    kn.add(n); for(const p of n.split(/\s+/))if(p.length>=3)kn.add(p)}
  const docTok=new Set();
  const toks=[];
  for(const b of blocks){const n=norm(b.text),t=tokall(n);
    for(const x of t)docTok.add(x.w);
    toks.push({b,n,t})}
  const sc=new Map();
  const bump=(key,pts,why,b,s,e,strong)=>{
    const g=sc.get(key)||{n:0,pts:0,why:new Set(),ctx:"",part:"",strong:false};
    g.n++; g.pts+=pts; if(why)g.why.add(why); if(strong)g.strong=true;
    if(!g.ctx&&b){g.ctx=ctxHTML(b.text,s,e);g.part=partName(b.part)}
    sc.set(key,g)};
  for(const {b,n,t} of toks){
    for(let i=0;i<t.length;i++){
      for(const len of [2,1]){
        if(i+len>t.length)continue;
        const raw=t.slice(i,i+len);
        // "המכתב אבד. אגבאריה" — שתי מילים משני משפטים אינן שם אחד,
        // ו"מזרחי וכהן" הם שני אנשים ברשימה, לא שם מלא.
        if(len>1){
          const gap=n.slice(raw[0].e,raw[1].s);
          if(/[.!?;:,()\n]/.test(gap))continue;
          if(PFX.has(raw[1].w[0])&&docTok.has(raw[1].w.slice(1)))continue;
        }
        // "מזרחי וכהן" — "וכהן" הוא אותו אדם כמו "כהן", לא מועמד נפרד
        const wds=raw.map(x=>
          PFX.has(x.w[0])&&docTok.has(x.w.slice(1))?x.w.slice(1):x.w);
        if(!wds.every(w=>nameish(w,docTok)))continue;
        const cand=wds.join(" ");
        if(kn.has(cand))continue;
        const s=raw[0].s,e=raw[len-1].e;
        let pts=0,strong=false;
        // בין "עובדת סוציאלית," ל"אוניברסיטת בן גוריון" יש פסיק — אלה שני
        // פריטים ברשימה, לא תפקיד ואחריו שם. כל בדיקת סמיכות חייבת רצף.
        const cln=(x,y)=>x&&y&&!/[,.;:()\[\]\n]/.test(n.slice(x.e,y.s));
        const nxt=cln(raw[len-1],t[i+len])&&t[i+len].w;
        const prv=cln(t[i-1],raw[0])&&i>0&&t[i-1].w;
        const prv2=prv&&cln(t[i-2],t[i-1])&&i>1&&t[i-2].w;
        // תואר בראש המועמד ("עו\"ד יערה") אינו שם, וגוף ציבורי ("לביטוח לאומי",
        // "המוסד לביטוח לאומי" עם המילה שלפניו) אינו פרט מזהה. שניהם הוצעו ואושרו,
        // והראשון גם דחק את החלפת שם המשפחה של "יערה ליפשיץ" בגלל "שם משותף".
        if(TITLE_RX.test(cand+" ")||[cand,prv&&prv+" "+cand,prv2&&prv&&prv2+" "+prv+" "+cand].filter(Boolean).some(x=>PUBLIC_ORG.test(x)||PUBLIC_ORG.test(x.replace(/^[בהולמכש]/,""))))continue;
        const hit=(p,w)=>{pts+=p;strong=true;return w};
        let why="";
        if(nxt&&VRB.has(nxt))why=hit(3,`עומד לפני «${nxt}»`);
        else if(prv&&ATTR.has(prv))why=hit(3,`בא אחרי «${prv}»`);
        else if(prv&&ROLE1.includes(prv))why=hit(3,`בא אחרי תפקיד «${prv}»`);
        else if(prv2&&ROLE2.some(r=>r===prv2+" "+prv))why=hit(3,`בא אחרי תפקיד «${prv2} ${prv}»`);
        // מדברים עליו, לא הוא מדבר
        else if(prv==="של"&&prv2&&KIN.has(prv2))why=hit(3,`בא אחרי «${prv2} של»`);
        else if(prv&&PREP.has(prv))why=hit(3,`בא אחרי «${prv}»`);
        else if(prv==="עם"&&len===2&&!wds.some(x=>docTok.has("ה"+x)))
          why=hit(3,"בא אחרי «עם»");
        // "אמא אומנת שלא תישבר, שהוא יישאר" — פסוקית זיקה מציגה אדם
        // כשהיא פותחת פסוקית או באה אחרי תואר, לא כשהיא תלויה במילה שכיחה.
        else if(t[i+len]&&REL.has(t[i+len].w)&&!wds.some(x=>VRB.has(x))&&
                !(prv&&COMMON.has(prv))&&
                /,/.test(n.slice(raw[len-1].e,t[i+len].s)))
          why=hit(3,`ואחריו «, ${t[i+len].w}» — תיאור של אדם`);
        else if(prv==="של"&&wds[0]!==raw[0].w)why=hit(2,"בא אחרי «של»");
        if(!why){
          for(let z=1;z<=2;z++){const b=t[i-z];
            if(b&&CARE.has(b.w)&&!/[,.;:\n]/.test(n.slice(b.e,raw[0].s))){
              why=hit(2,`בהקשר של «${b.w}»`);break}}
        }
        // אות שימוש בלי ה' הידיעה: "ולשליו", "במישל" — דפוס של שם פרטי,
        // כי שם עצם מיודע היה מופיע גם כ"השליו" איפשהו במסמך
        const st0=raw[0].w, stem=st0.slice(1);
        if(PFX.has(st0[0])&&st0.length>=4&&st0[1]!=="ה"&&
           !docTok.has("ה"+stem)&&nameish(stem,docTok)&&
           (docTok.has(stem)||[...PFX].some(q=>q!==st0[0]&&docTok.has(q+stem)))){
          pts+=2; if(!why)why="מופיע עם אות שימוש ובלי ה' הידיעה";
        }
        // סמיכות לשם מוכר היא רמז חלש: ברשימת מוזמנים מופרדת בפסיקים
        // היא מסמנת כל מילת תפקיד. לבדה היא לא מספיקה.
        if(prv&&(kn.has(prv)||kn.has(prv.replace(/^ו/,""))))pts+=1;
        if(nxt&&(kn.has(nxt)||kn.has(nxt.replace(/^ו/,""))))pts+=1;
        if(!pts)continue;
        bump(cand,pts,why||"מופיע ליד שם שכבר ידוע",b,s,e,strong);
        break}}}
  const out=[];
  for(const [value,g] of sc){
    if(!g.strong)continue;
    const total=g.pts+(g.n>=3?2:g.n>=2?1:0);
    if(total<3)continue;
    if(PUBLIC_ORG.test(value)||PUBLIC_ORG.test(value.replace(/^[בהולמכש]/,"")))continue;
    out.push({value,score:total,count:g.n,why:[...g.why].slice(0,2).join(" · "),
      ctx:g.ctx,part:g.part})}
  // "אזולאי" הוצע כי הוא חוזר, אבל במסמך כתוב "סיגלית אזולאי" — עדיף
  // להציע את השם המלא, אחרת השם הפרטי יישאר בטקסט.
  for(const o of out){
    if(o.value.includes(" "))continue;
    for(const {n,t} of toks){
      const i=t.findIndex((x,j)=>j>0&&x.w===o.value);
      if(i<1)continue;
      const p=t[i-1].w;
      // "המכתב אבד. אגבאריה אישרה" — שתי מילים משני משפטים אינן שם אחד
      if(/[.!?;:\n]/.test(n.slice(t[i-1].e,t[i].s)))continue;
      if(p[0]==="ה"||p.length<3||!nameish(p,docTok))continue;
      if(ROLE1.includes(p)||VRB.has(p)||kn.has(p))continue;
      o.value=p+" "+o.value; o.full=true; break}}
  const dedup=new Map();
  for(const o of out){const ex=dedup.get(o.value);
    if(!ex||o.score>ex.score)dedup.set(o.value,o)}
  const out2=[...dedup.values()];
  const full=out2.filter(x=>x.value.includes(" "))
    .flatMap(x=>x.value.split(" "));
  return out2.filter(x=>x.value.includes(" ")||!full.includes(x.value))
    .sort((a,b)=>b.score-a.score||b.count-a.count)}

/* ══════════ שכבת זיהוי: מודל עברי מקומי ══════════
   המודל מחליט על מה לשאול, לעולם לא מה להחליף. ההחלפה נשארת
   דטרמיניסטית ומבוססת על מה שהיא אישרה, וכך רף הכלי לא נקבע
   לפי דיוק של מודל.
   הפלט הגולמי דורש תיקון: המודל מקצץ תו בסוף כשיש אות שימוש
   בהתחלה ("במיש" במקום "במישל"), מחזיר תארים כישות נפרדת,
   ומסמן גם מוסדות ציבוריים שאין טעם להשחיר. */
const trimEdges=s=>(s||"").replace(/^[\s,.;:()\[\]"'\u05f3\u05f4-]+|[\s,.;:()\[\]"'\u05f3\u05f4-]+$/g,"").trim();
const PUBLIC_ORG=/^(?:בי?ת ה?משפט|שרת? ה|לשכת ה|בתי המשפט|משרד ה|הכנסת|ועד[תה]\s|הוועד[הת]|המוסד לביטוח|ביטוח לאומי|הביטוח הלאומי|משטרת ישראל|צה"ל|היועץ המשפטי|פרקליטות|רשות ה|המשרד ל|בנק ישראל|מס הכנסה)/u;
const NER_DROP=new Set(["מרח","מרח'","רח'","רחוב","שד'","ת.ז","ת\"ז","נ'","עמ'","סע'","בע\"מ","הנ\"ל"]);
const NER_HEADS=new Set(["עמותת","עמותה","מעון","מרפאת","מכון","קרן","מרכז","אגודת","חברת","לשכת","משרד","פנימיית","ישיבת","רחוב","שדרות","שכונת","סמטת","דרך","כיכר","ככר","מעלה","משעול","כפר","קרית","גני","נווה","מבוא"]);
const NER_KIND={PER:"NAME",ORG:"ORG",GPE:"PLACE",LOC:"PLACE",FAC:"PLACE"};
// זיהוי בלבד, לא ייצור: כאן מותר שיהיו שמות שכיחים שלא נרצה להמציא
const KNOWN_FIRST=new Set([...FEM,...MASC,...WORDLIKE,...POOL.he_f,...POOL.he_m,
 ...POOL.ar_f,...POOL.ar_m,"יוסי","מישל","בתיה","איתי","רמי","גלית","דלית","טלי","צפרא",
 "אתי","זיוה","ניצה","חנה","שלוה","שלווה","עדינה","הלל","דודו","אלמז","סמאח","מיה",
 "נעמה","אורית","שלומית","דליה","אריה","מרדכי","יחיאל","קארין","שמעון","יעקב","אורלי"]);
// חלוקה לקטעים: BERT מוגבל ל-512 טוקנים, וצריך לשמור היסטים מדויקים
// כדי לתקן גבולות אחר כך. שני כשלים אורבים כאן, ושניהם שקטים: קטע
// ארוך מדי נחתך ע"י המודל ומאבד את הזנב, וקטע קצר מדי מכפיל את מספר
// ההרצות — פסקה לכל קטע היא 423 הרצות למסמך אחד, כארבע דקות המתנה.
// לכן אורזים משפטים ופסקאות יחד עד המגבלה, וחותכים בכוח רק מה שבאמת
// ארוך מדי. הפריסה נעשית על הטקסט המקורי, כך שההיסטים נשארים נכונים.
function nerChunks(text,limit=800){
  const units=[];
  const hard=(s,e)=>{
    const OV=60; let i=s;
    while(i<e){
      let end=Math.min(i+limit,e);
      if(end<e){const sp=text.lastIndexOf(" ",end); if(sp>i+limit*0.5)end=sp}
      units.push([i,end,true]);
      if(end>=e)break;
      i=Math.max(end-OV,i+1);
      while(i<e&&text[i]!==" ")i++;
      i++;
    }
  };
  let cur=0;
  for(const para of text.split("\n")){
    let base=text.indexOf(para,cur);
    if(base<0)base=cur;          // לא אמור לקרות; לא נותנים להיסט להישבר
    cur=base+para.length+1;
    if(!para.trim())continue;
    let p=0;
    for(const part of para.split(/(?<=[.!?])\s+/)){
      if(!part.trim())continue;
      const i=para.indexOf(part,p); if(i<0)continue;
      const s=base+i,e=s+part.length; p=i+part.length;
      if(e-s>limit)hard(s,e); else units.push([s,e,false]);
    }
  }
  const out=[]; let ws=null,we=null;
  for(const [s,e,isHard] of units){
    if(isHard){
      if(ws!==null){out.push({t:text.slice(ws,we),off:ws});ws=null}
      out.push({t:text.slice(s,e),off:s}); continue;
    }
    if(ws===null){ws=s;we=e;continue}
    if(e-ws<=limit){we=e;continue}
    out.push({t:text.slice(ws,we),off:ws}); ws=s; we=e;
  }
  if(ws!==null)out.push({t:text.slice(ws,we),off:ws});
  return out}
function nerClean(ents,text,opt){
  const min=(opt&&opt.min)||0.7;
  const tok=new Set((norm(text).match(WRX)||[]));
  const seen=new Map();
  for(const e of ents){
    if(!NER_KIND[e.type]||e.score<min)continue;
    // ── תיקון הקיצוץ: מרחיבים כל קצה עד גבול מילה בטקסט המקורי ──
    let s=e.s,en=e.e;
    while(s>0&&/[\u0590-\u05ff]/.test(text[s-1]))s--;
    const endWas=en;
    while(en<text.length&&/[\u0590-\u05ff'"\u05f3\u05f4]/.test(text[en]))en++;
    // המודל מקצץ בסוף בדיוק כשהוא בלע אות שימוש בהתחלה. ההארכה בסוף
    // היא לכן העדות הטובה ביותר לכך שהאות הראשונה אינה חלק מהשם.
    const wasCut=en>endWas;
    let v=trimEdges(text.slice(s,en));
    if(!v||v.length<2)continue;
    // ── קילוף אות שימוש ──
    const w=v.split(/\s+/), f=norm(w[0]);
    if(PFX.has(f[0])&&f.length>=4){
      const stem=f.slice(1);
      const elsewhere=tok.has(stem)||[...PFX].some(q=>q!==f[0]&&tok.has(q+stem));
      // "לכוכב יאיר" מופיע פעם אחת ו"כוכב יאיר" לא — אבל מאגר היישובים
      // יודע שזה יישוב, וזו עדות טובה יותר מספירת הופעות
      const bare=[stem,...w.slice(1)].join(" ");
      const known=!!PLACE_BY[norm(bare)]||KNOWN_FIRST.has(stem);
      // "בעמותת שביל הלב", "ברחוב הארזים": כשהגזע הוא ראש של גוף או של מקום,
      // האות הראשונה היא אות שימוש גם בלי שהגזע מופיע במקום אחר.
      const headPeel=NER_HEADS.has(stem);
      if(wasCut||elsewhere||known||headPeel){
        w[0]=w[0].slice(w[0].length-f.length+1); v=trimEdges(w.join(" "));
      }
    }
    // פיסוק של סוף משפט אינו חלק משם. אם נשאר כזה בתוך המקטע, שומרים את
    // החלק שאחרי הפיסוק האחרון: שם שהמודל הדביק לו את סוף המשפט הקודם.
    if(/[.!?:;\n]/.test(v)){const parts=v.split(/[.!?:;\n]+/).map(x=>trimEdges(x)).filter(Boolean); v=parts.length?parts[parts.length-1]:"";}
    // מילה בודדת שהיא מילת עצירה, מילה נפוצה או פועל אינה שם: "אני", "השופט",
    // "לבד". בתמלול "אני" מסומן כשם שוב ושוב, וכל משפט בגוף ראשון נהרס.
    // תואר בתחילת המקטע אינו חלק מהשם: "עו\"ד יערה" הוא "יערה". בלי זה המקטע
    // המודבק מאושר כשם שני לצד "יערה ליפשיץ", ושם המשפחה לבדו נחשב משותף ולא מוחלף.
    if(v)v=trimEdges(v.replace(TITLE_RX,""));
    if(v&&!/s/.test(v)&&(STOP.has(v)||COMMON.has(v)||VRB.has(v)||STOP.has(norm(v))||COMMON.has(norm(v))))continue;
    if(!v||v.length<2||NER_DROP.has(v)||NER_DROP.has(norm(v)))continue;
    let kind=NER_KIND[e.type];
    // "שחר - שירותי חברה רווחה משפחה" סומן כאדם. שם עם מקף מפריד או
    // חמש מילים ומעלה הוא גוף, ושם בדוי של אדם שם היה מבלבל.
    if(kind==="NAME"&&(/\s[-\u2013]\s/.test(v)||v.split(/\s+/).length>4))kind="ORG";
    // ראש של גוף (עמותת, מעון, מרפאת…) באמצע המקטע: מה שלפניו הודבק מהמשפט,
    // "משרד עמותת שביל הלב". חותכים לפני הראש, אחרת הכלל תופס רק את הצורה המודבקת.
    if(kind==="ORG"){const m=/(?:^|\s)(עמותת|עמותה|מעון|מרפאת|מכון|קרן|מרכז|אגודת|חברת|בית ספר|בי"ס|ביה"ס|גן ילדים|פנימיית|ישיבת)\s/u.exec(v); if(m&&m.index>0)v=v.slice(m.index+1);}
    // גם כשהמודל תפס רק קטע: "הרווחה" מתוך "משרד הרווחה". בודקים את הקטע עם
    // עד שתי המילים שלפניו בטקסט המקורי, אחרת גוף ציבורי מוצע ומושחר.
    if(kind!=="NAME"){const back=text.slice(Math.max(0,s-40),s).split(/\s+/).filter(Boolean).slice(-2); const strip1=x=>x.replace(/^[בהולמכש]/,""); const c2=norm([...back,v].join(" ")), c1=norm([...back.slice(-1),v].join(" ")); if([c2,strip1(c2),c1,strip1(c1)].some(x=>PUBLIC_ORG.test(x)))continue;}
    // בית משפט ומשרד ממשלתי אינם פרט מזהה, ואין טעם להציע אותם
    if(kind!=="NAME"&&PUBLIC_ORG.test(norm(v).replace(/^[\u05d1\u05d4\u05d5\u05dc\u05de\u05db\u05e9]/,"")))continue;
    if(kind!=="NAME"&&PUBLIC_ORG.test(norm(v)))continue;
    const key=kind+"|"+norm(v);
    const g=seen.get(key)||{value:v,kind,score:0,n:0,s,e:en};
    g.n++; g.score=Math.max(g.score,e.score); seen.set(key,g);
  }
  // "רונית אזולאי" מכסה את "אזולאי" — לא מציעים את שניהם
  const all=[...seen.values()].sort((a,b)=>b.value.length-a.value.length);
  const keep=[];
  for(const x of all){
    const inside=keep.some(y=>y.kind===x.kind&&y.value!==x.value&&
      new RegExp(NW+esc(norm(x.value))+NWE,"u").test(norm(y.value)));
    if(!inside)keep.push(x);
  }
  return keep.sort((a,b)=>b.n-a.n||b.score-a.score)}

const STREET="(?:רחוב|רח'|שדרות|שד'|סמטת|סמטה|דרך|שכונת|כיכר|ככר|מעלה|נחל|משעול)";
const PAT=[
 ["EMAIL",'כתובת דוא"ל',`(?<![\\w.%+-])[\\w.%+-]+@[\\w.-]+\\.[A-Za-z\u05d0-\u05ea]{2,}`,0,null,0,1],
 ["PHONE_MOBILE","טלפון נייד",`${NW}(?:\\+?972[-\\s]?|0)5\\d[-\\s.]?\\d{3}[-\\s.]?\\d{4}${NWE}`,0,null,3,1],
 ["PHONE_LAND","טלפון קווי",`${NW}(?:\\+?972[-\\s]?|0)(?:[2-4689]|7\\d)[-\\s.]?\\d{3}[-\\s.]?\\d{4}${NWE}`,0,null,4,1],
 ["PHONE_TOLL","מספר חיוג","(?:\\*\\d{3,5}|1[-\\s]?[38]00[-\\s]?\\d{3}[-\\s]?\\d{3})",0,null,3,1],
 ["FAX","פקס","(?:פקס|פקסימיליה)[:\\s]*(\\+?\\d[\\d\\-\\s]{7,13}\\d)",1,null,3,1],
 ["ISRAELI_ID","תעודת זהות",`${NW}\\d{9}${NWE}`,0,validID,1,1],
 ["ISRAELI_ID_LABELED","תעודת זהות",`(?:ת\\.?\\s?ז\\.?|ת"ז|מ\\.?\\s?ז\\.?|תעודת\\s+זהות|מספר\\s+זהות|ח\\.?\\s?פ\\.?|ח"פ|ע"ר|ת\\.?\\s?ז\\.?\\s?מס')[:\\s.]*(\\d{5,9})`,1,null,0,1],
 ["CREDIT_CARD","כרטיס אשראי",`${NW}(?:\\d[ -]?){12,19}${NWE}`,0,luhn,1,1],
 ["IBAN","IBAN","\\bIL\\d{2}[\\d\\s]{19,23}\\b",0,ibanOK,1,1],
 ["PLATE","מספר רכב",`${NW}(?:\\d{2}-\\d{3}-\\d{2}|\\d{3}-\\d{2}-\\d{3})${NWE}`,0,null,2,1],
 ["ADDRESS_STREET","כתובת",`${STREET}\\s+[\u0590-\u05ff"'-]+(?:\\s+[\u0590-\u05ff"'-]+){0,3}\\s+\\d{1,4}(?:\\s?[\u05d0-\u05ea](?![\u0590-\u05ff]))?(?:\\s*[/\\\\]\\s*\\d{1,3}\\s?[\u05d0-\u05ea]?)?`,0,null,2,1],
 ["DOB","תאריך לידה","(?:יליד(?:ת|י)?|ת\\.?\\s?לידה|תאריך\\s+לידה)[:\\s-]*(\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4})",1,null,2,1],
 ["URL_PERSONAL","קישור אישי","https?://(?:www\\.)?(?:facebook|linkedin|instagram|twitter|x)\\.com/\\S+",0,null,2,1],
 ["ZIPCODE","מיקוד","(?:מיקוד|ת\\.?ד\\.?)[:\\s.]*(\\d{5,7})",1,null,3,1],
 ["ZIP_BARE","מיקוד",`${NW}\\d{7}${NWE}`,0,null,4,0],
 ["CASE_NUMBER","מספר תיק",'(?:ת"א|ת"פ|ע"א|בג"ץ|ה"פ|ת"ק|רע"א|ע"פ|תמ"ש|עמ"ש)\\s*\\d{1,6}[-/]\\d{1,2}[-/]\\d{2,4}',0,null,3,0],
 ["BANK_ACCOUNT","חשבון בנק","(?:חשבון|ח-ן)\\s*(?:מס'?|מספר)?[:\\s]*(\\d{2,3}[-/]\\d{3}[-/]\\d{4,9})",1,null,3,1],
 ["LAWYER_LIC","מספר רישיון עו\"ד","(?:מ\\.?\\s?ר\\.?|מספר\\s+רישיון|רישיון\\s+מס'?)[:\\s]*(\\d{4,7})",1,null,2,1],
 ["NOTARY","מספר נוטריון","(?:נוטריון|רישיון\\s+נוטריון)[^\\d]{0,12}(\\d{3,7})",1,null,3,1],
 ["PASSPORT","דרכון","(?:דרכון|passport)[:\\s.#]*([A-Z0-9]{6,9})",1,null,3,1],
 ["IP","כתובת IP","\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b",0,null,3,0],
].map(([n,l,r,g,v,p,on])=>({n,l,rx:new RegExp(r,"gu"),g,v,p,on:!!on}));

const WHYP={ISRAELI_ID:"תשע ספרות שעוברות בדיקת ספרת ביקורת",
 ISRAELI_ID_LABELED:"מספר שמופיע אחרי תווית זהות",CREDIT_CARD:"רצף ספרות שעובר בדיקת Luhn",
 EMAIL:'מבנה של כתובת דוא"ל',PHONE_MOBILE:"מבנה של מספר נייד ישראלי",
 PHONE_LAND:"מבנה של מספר קווי ישראלי",PHONE_TOLL:"מספר חיוג מיוחד",
 FAX:"מספר שמופיע אחרי המילה פקס",IBAN:"IBAN שעובר בדיקת mod-97",PLATE:"מבנה של מספר רישוי",
 ADDRESS_STREET:"מילת רחוב ואחריה שם ומספר בית",DOB:"תאריך שמופיע אחרי ציון לידה",
 ZIPCODE:"מספר שמופיע אחרי מיקוד",ZIP_BARE:"שבע ספרות בודדות — ייתכן מיקוד",
 CASE_NUMBER:"מבנה של מספר תיק",BANK_ACCOUNT:"מבנה של מספר חשבון",
 PASSPORT:"מזהה שמופיע אחרי המילה דרכון",
 IP:"מבנה של כתובת IP",URL_PERSONAL:"קישור לרשת חברתית"};

/* ── שמות לפי עוגן ── */
const TITLES=`עו"ד|עוה"ד|ד"ר|דר'|פרופ'|רו"ח|הרב|ח"כ|מר|גב'|גברת|כב'\\s*השופט(?:ת)?|השופט(?:ת)?|רשמ(?:ת)?|המצהיר(?:ה)?|הח"מ|העד(?:ה)?|ב"כ|מטעם`;
const ROLES="התובע(?:ת)?|הנתבע(?:ת)?|המבקש(?:ת)?|המשיב(?:ה)?|הנאשם(?:ת)?|המערער(?:ת)?|המנוח(?:ה)?";
const STOP=new Set(("בית המשפט משפט הדין דין המחוזי השלום העליון לענייני משפחה עבודה תעבורה "+
 "המדינה ישראל מדינת משרד המשרד החברה חברת בעמ העמותה הבנק בנק הצדדים הצד הסכם ההסכם "+
 "החוזה החוק התקנות כאמור לעיל להלן התביעה ההגנה הבקשה התגובה התצהיר הדיון מטעם באמצעות "+
 "לפי כפי אשר וכן ועוד וגם אצל בעניין בנוגע התובע הנתבע התובעת הנתבעת המבקש המשיב כבוד כב "+
 "הוועדה המחלקה הרשות העירייה המועצה ועדת מס הכנסה הביטוח הלאומי שלום רחוב דרך תעודת זהות "+
 "את של על עם אל כי גם אך או אם כל לא זה זו הוא היא הם הן אני אתה אנו יש אין היה הייתה האמת אמת בזאת בזה כאן שם שלי שלו שלה השופט השופטת הרשם הרשמת המותב כב הכבוד "+"מספר תאריך יום חודש שנה הדוח טען טענה הודיע הודיעה אמר אמרה מסר מסרה ציין ציינה "+
 "עוד עוהד דר פרופ רוח הרב מר גב גברת השופט השופטת הנוטריון נוטריון המצהיר המצהירה")
 .split(" ").concat(['בע"מ','הנ"ל']));
const NWD="[\u05d0-\u05ea][\u05d0-\u05ea'\"\u05f3\u05f4-]{1,14}";
const PART="בן|בת|בר|אבו|אל|דה|ואן|לה";
const NME=`${NWD}(?:\\s+(?:${PART})(?![\u05d0-\u05ea-]))?(?:\\s+${NWD})?`;
const BD="(?<![\\u0590-\\u05ff])";
const ANCH=[["title",`(?:${TITLES})[,\\s]+(${NME})`,"מופיע אחרי תואר"],
 ["hcm",`אני\\s+הח"מ[,\\s]+(${NME})`,'מופיע אחרי "אני הח"מ" בתצהיר'],
 ["warned",`(${NME})[,\\s]+(?=לאחר\\s+שהוזהרת)`,"מופיע לפני נוסח האזהרה בתצהיר"],
 ["repby",`(?:מיוצג(?:ת)?\\s+ע"?י|באמצעות\\s+ב"כ|ע"י\\s+ב"כ)[,\\s]+(?:(?:${TITLES})[,\\s]+)?(${NME})`,"מופיע אחרי ציון ייצוג"],
 ["deliver",`(?:מען|כתובת)\\s+להמצאת\\s+כתבי\\s+בי[- ]?דין[:\\s]*(${NME})`,"מופיע במען להמצאה"],
 ["sworn",`(?:אני\\s+הח"מ|הח"מ|אני\\s+הנני|אני\\s+החתומ(?:ה)?\\s+מטה)\\s*,?\\s*(${NME})`,
   "מופיע בפתיח התצהיר"],
 ["field",`(?:שם\\s+מלא|שם\\s+המצהיר(?:ה)?|שם\\s+העד(?:ה)?|שם\\s+הצד|שם)\\s*:\\s*(${NME})`,
   'מופיע אחרי שדה "שם:"'],
 ["idfield",`(?:מס'?\\s*זהות|מספר\\s+זהות|ת\\.?ז\\.?)\\s*:?[^\\n]{0,40}?\\b(${NME})\\s*$`,
   'מופיע בשורת זהות'],
 ["before",`${BD}(?:בפני|אישר(?:ה)?\\s+בפני|נחתם\\s+בפני|הופיע(?:ה)?\\s+בפני)\\s+(?:עו"ד\\s+)?(${NME})`,
   'מופיע אחרי "בפני"'],
 ["signed",`(?:בכבוד\\s+רב|ולראיה\\s+באתי\\s+על\\s+החתום|חתימה)\\s*[,:\\-–]?\\s*(${NME})`,
   "מופיע באזור החתימה"],
 // מילת תפקיד לפני שם. עם נקודתיים זו כותרת ("התובעת: רונית לוי") — כמעט ודאי,
 // ולכן ביטחון גבוה ומילוי אוטומטי. בלי נקודתיים, בגוף הטקסט ("התובעת רונית לוי"),
 // זה אות אמיתי אבל חלש יותר: "התובעת הגישה בקשה" נראה אותו דבר. לכן ביטחון בינוני,
 // כלומר הצעה שהמשתמשת מאשרת, לא מילוי אוטומטי.
 ["role",`(?:${ROLES})\\s*[:\\-–]\\s*(${NME})`,"מופיע אחרי תפקיד ונקודתיים"],
 ["rolep",`(?:${ROLES})\\s+(${NME})`,"מופיע אחרי מילת תפקיד בגוף הטקסט"],
 ["bid",`(${NME})\\s*,?\\s*(?=ת\\.?\\s?ז\\.?|ת"ז|תעודת\\s+זהות|ח\\.?\\s?פ\\.?)`,'מופיע מיד לפני ת"ז'],
 ["btw",`בין\\s+(${NME})\\s+(?:לבין|ל)`,'מופיע במבנה "בין X לבין Y"'],
 // תור דיבור בתמלול: פסקה שנפתחת בשם ואחריו נקודתיים. "דליה לב שדה: תודה רבה".
 // זה העוגן היחיד שיש לתמלול, ובלי המודל אין לו כמעט שום דבר אחר. תואר
 // לפני השם ("היו\"ר אורלי לוי") נבלע; "מוזמנים:" בלי טקסט אחריו לא נתפס.
 ["speaker",`^(?:(?:${TITLES}|היו"ר|היו״ר|יו"ר|יו״ר|השר|השרה)\\s+)?(${NWD}(?:\\s+${NWD}){0,2})\\s*:\\s`,"פותח תור דיבור בתמלול"],
 ["vs",`(${NME})\\s+נ'\\s+(${NME})`,"מופיע בכותרת תיק"]]
 .map(([k,r,w])=>({k,rx:new RegExp(r,"gu"),w}));
const PFX=new Set(["מ","ב","ל","ו","ה","ש","כ"]);
// סימני מגדר חייבים גבול מילה: בלי זה "תמר" מכיל "מר" והשם נקרא כזכר.
const GF=new RegExp(BD+"(?:גב'|גברת|השופטת|הרשמת|המצהירה|העדה|התובעת|הנתבעת|המבקשת|"+
  "המשיבה|הנאשמת|המערערת|המנוחה|ילידת|אשתו|גרושתו|בתו|אמו|הגב')"+NWE,"u");
const GM=new RegExp(BD+"(?:מר|השופט|הרשם|המצהיר|העד|התובע|הנתבע|המבקש|המשיב|הנאשם|"+
  "המערער|המנוח|יליד|בעלה|גרושה|בנו|אביו)"+NWE,"u");
function cleanName(raw){
  let w=raw.trim().split(/\s+/);
  const bad=x=>{const c=x.replace(/['"-]/g,"");
    return STOP.has(c)||(c.length>2&&PFX.has(c[0])&&STOP.has(c.slice(1)))};
  while(w.length&&bad(w[w.length-1]))w.pop();
  while(w.length&&bad(w[0]))w.shift();
  if(!w.length||w.length>3)return null;
  for(const x of w) if(bad(x)||x.replace(/['"-]/g,"").length<2)return null;
  return w.join(" ");
}
function anchored(text){
  const n=norm(text),out=[],seen=new Set();
  for(const a of ANCH){a.rx.lastIndex=0;let m;
    while((m=a.rx.exec(n))){
      for(let g=1;g<m.length;g++){
        if(!m[g])continue;
        const c=cleanName(m[g]); if(!c)continue;
        // "פלוני", "פלונית", "אלמוני" הם מציין-מקום של בית המשפט, לא שם. "פלוני בדיון"
        // נתפס כאן כשם ואז הוחלף, וההחלפה מחקה את המילה שנועדה להסתיר.
        if(["פלוני","פלונית","אלמוני","אלמונית"].includes(c.split(" ")[0]))continue;
        // העוגן הפרוזאי בלבד: מילת תפקיד באה גם לפני פועל ("התובעת הגישה בקשה").
        // מסננים פעלים ומילים נפוצות; לא nameish, שדוחה שמות כמו הדס.
        if(a.k==="rolep"&&c.split(/\s+/).some(w=>VRB.has(w)||COMMON.has(w)||STOP.has(w)))continue;
        let s=m.index+m[0].indexOf(m[g]); const o=m[g].indexOf(c); if(o>0)s+=o;
        const e=s+c.length,k=s+":"+e; if(seen.has(k))continue; seen.add(k);
        let role=null;
        if(a.k==="role"||a.k==="rolep"){
          const rm=/(התובע(?:ת)?|הנתבע(?:ת)?|המבקש(?:ת)?|המשיב(?:ה)?|הנאשם(?:ת)?|המערער(?:ת)?|המנוח(?:ה)?)/.exec(m[0]);
          if(rm)role=rm[1];
        }
        // המסמך עצמו מעיד על המגדר טוב יותר מכל ניחוש לפי השם
        const ctx0=n.slice(Math.max(0,m.index-26),s+c.length+26);
        const gh=GF.test(ctx0)?"f":GM.test(ctx0)?"m":null;
        out.push({s,e,type:"NAME_ANCHORED",label:"שם (לפי הקשר)",text:text.slice(s,e),
          why:a.w,anchor:a.k,src:"pattern",prio:2,conf:"medium",role,g:gh});
      }}}
  return out}

const PLACES=[["ירושלים",31.78,35.22],["תל אביב",32.08,34.78],["חיפה",32.82,34.99],["ראשון לציון",31.97,34.8],["פתח תקווה",32.09,34.89],["אשדוד",31.8,34.65],["נתניה",32.33,34.86],["באר שבע",31.25,34.79],["בני ברק",32.08,34.83],["חולון",32.02,34.77],["רמת גן",32.07,34.82],["אשקלון",31.67,34.57],["רחובות",31.89,34.81],["בת ים",32.02,34.75],["בית שמש",31.75,34.99],["כפר סבא",32.18,34.91],["הרצליה",32.16,34.84],["חדרה",32.44,34.92],["מודיעין",31.9,35.01],["נצרת",32.7,35.3],["לוד",31.95,34.89],["רמלה",31.93,34.87],["רעננה",32.18,34.87],["רהט",31.39,34.75],["הוד השרון",32.15,34.89],["גבעתיים",32.07,34.81],["קרית אתא",32.81,35.11],["נהריה",33.01,35.09],["קרית גת",31.61,34.77],["אום אל-פחם",32.52,35.15],["עפולה",32.61,35.29],["אילת",29.56,34.95],["טבריה",32.79,35.53],["עכו",32.93,35.08],["אלעד",32.05,34.95],["רמת השרון",32.15,34.84],["כרמיאל",32.92,35.3],["טירה",32.23,34.95],["יבנה",31.88,34.74],["טייבה",32.27,35.01],["קרית ביאליק",32.83,35.08],["קרית אונו",32.06,34.86],["נס ציונה",31.93,34.8],["מעלה אדומים",31.77,35.3],["ראש העין",32.09,34.95],["אור יהודה",32.03,34.85],["צפת",32.96,35.5],["דימונה",31.07,35.03],["טמרה",32.85,35.2],["סח'נין",32.86,35.3],["קרית מוצקין",32.84,35.08],["קרית ים",32.85,35.07],["יהוד",32.03,34.89],["נתיבות",31.42,34.59],["בית שאן",32.5,35.5],["אריאל",32.1,35.17],["מגדל העמק",32.67,35.24],["שפרעם",32.81,35.17],["אופקים",31.31,34.62],["קרית שמונה",33.21,35.57],["כפר יונה",32.32,34.93],["גבעת שמואל",32.07,34.85],["ירוחם",30.99,34.93],["שדרות",31.52,34.6],["זכרון יעקב",32.57,34.95],["בנימינה",32.51,34.95],["פרדס חנה",32.47,34.98],["קצרין",32.99,35.69],["מצפה רמון",30.61,34.8],["ערד",31.26,35.21],["מעלות",33.02,35.28],["בית דגן",32.0,34.83],["אזור",32.02,34.81],["גני תקווה",32.06,34.87],["כוכב יאיר",32.22,35.0],["שוהם",31.99,34.95],["להבים",31.37,34.82],["עומר",31.27,34.85],["מיתר",31.32,34.93],["כפר קאסם",32.11,34.98],["ג'לג'וליה",32.15,34.95],["קלנסווה",32.28,34.98],["באקה אל-גרביה",32.42,35.04],["דאלית אל-כרמל",32.7,35.05],["עוספיא",32.71,35.07],["יקנעם",32.66,35.11],["נשר",32.77,35.04],["טירת כרמל",32.76,34.97],["אור עקיבא",32.51,34.92],["חריש",32.46,35.05],["אפרת",31.65,35.15],["גבעת זאב",31.86,35.17],["קרני שומרון",32.17,35.1],["אלפי מנשה",32.17,35.02],["בית אל",31.94,35.22],["כפר תבור",32.69,35.42],["מג'אר",32.89,35.41],["ירכא",32.95,35.2],["כפר ורדים",33.0,35.28],["קרית טבעון",32.72,35.13],["עתלית",32.69,34.94],["כפר יאסיף",32.95,35.16],["אבו סנאן",32.95,35.17],["מזכרת בתיה",31.85,34.84],["גדרה",31.81,34.78],["קרית מלאכי",31.73,34.75],["גן יבנה",31.79,34.71],["באר יעקב",31.94,34.83],["בית ג'ן",32.96,35.38],["דבוריה",32.7,35.36],["כפר כנא",32.75,35.34],["אכסאל",32.68,35.33],["רכסים",32.74,35.1],["כפר קרע",32.51,35.05],["ערערה",32.49,35.09],["כאבול",32.87,35.19],["דיר אל-אסד",32.93,35.27],["מג'ד אל-כרום",32.92,35.25],["נחף",32.93,35.31],["ראמה",32.94,35.36],["עראבה",32.85,35.34],["דיר חנא",32.86,35.36],["מעיליא",33.02,35.26],["פקיעין",32.98,35.33],["חורפיש",33.02,35.34],["ראש פינה",32.97,35.54],["חצור הגלילית",32.98,35.54],["יסוד המעלה",33.06,35.6],["מטולה",33.28,35.58],["שלומי",33.07,35.14],["בועיינה",32.83,35.32],["כפר מנדא",32.81,35.26],["עילבון",32.83,35.39],["תמרה",32.85,35.2],["מבשרת ציון",31.8,35.15],["בית חורון",31.87,35.13],["צור הדסה",31.72,35.09],["קרית ענבים",31.81,35.12],["אבן יהודה",32.27,34.88],["תל מונד",32.25,34.92],["קדימה",32.28,34.91],["צורן",32.26,34.91],["פרדסיה",32.31,34.9],["בית יצחק",32.34,34.87],["עמק חפר",32.38,34.9],["כפר ויתקין",32.38,34.87],["נהלל",32.69,35.2],["רמת ישי",32.7,35.17],["מגידו",32.58,35.18],["עין השופט",32.6,35.1],["דליה",32.59,35.06],["כפר גלעדי",33.24,35.57],["דן",33.24,35.65],["חולתה",33.05,35.61],["עמיעד",32.93,35.51],["כורזים",32.91,35.56],["כנרת",32.72,35.57],["דגניה",32.71,35.58],["אשדות יעקב",32.65,35.58],["גשר",32.63,35.55],["מעלה גלבוע",32.48,35.42],["בית אלפא",32.52,35.43],["שדה אליהו",32.44,35.51],["טירת צבי",32.42,35.53],["נאות הכיכר",31.02,35.39],["עין גדי",31.46,35.39],["ערוער",31.15,34.98],["כסייפה",31.24,35.01],["תל שבע",31.25,34.85],["שגב שלום",31.19,34.84],["חורה",31.3,34.94],["לקיה",31.32,34.86],["משאבי שדה",31.02,34.79],["שדה בוקר",30.87,34.79],["רביבים",31.04,34.72],["צאלים",31.2,34.53],["אשלים",31.02,34.7],["יטבתה",29.88,35.06],["קטורה",29.97,35.07],["פארן",30.36,35.15],["חצבה",30.77,35.25],["עין יהב",30.65,35.24],["ניצנה",30.87,34.42],["אבשלום",31.23,34.3],["מגן",31.3,34.44],["נירים",31.34,34.39],["כפר עזה",31.48,34.53],["ניר עם",31.51,34.55],["יד מרדכי",31.59,34.55],["ניצן",31.72,34.61],["בית חנן",31.9,34.76],["רינתיה",32.02,34.94],["נחלים",32.05,34.92],["כפר סירקין",32.08,34.91],["גבעת חן",32.19,34.9],["בית ברל",32.2,34.92],["צופית",32.2,34.9],["נירית",32.13,35.0],["אלקנה",32.11,35.0],["עמנואל",32.16,35.13],["קרית ארבע",31.53,35.11],["כרמל",31.42,35.14],["מעון",31.4,35.1],["תקוע",31.65,35.24],["כפר אדומים",31.82,35.33],["ענתות",31.82,35.29],["כוכב השחר",31.97,35.34],["שילה",32.05,35.29],["עלי",32.06,35.29],["ברקן",32.11,35.11],["יקיר",32.13,35.11],["פדואל",32.05,35.05]].map(([n,a,o])=>({n,a,o}));
const PLACE_BY={}; PLACES.forEach(p=>PLACE_BY[p.n]=p);
// שמות יישוב שהם גם מילים עבריות רגילות — "באזור תל אביב" אינו העיר אזור
const AMBIG=new Set(["דן","מגן","כרמל","עלי","שילה","דליה","כנרת","ניצן","ראמה",
  "גשר","מעון","ענתות","תמרה","טמרה","אשלים","דגניה","נחף","טירה","ערד","לוד",
  "אזור","רחובות","מעלות","שדרות","אריאל","עומר","מיתר","ירוחם","נירית","אורן",
  "יבנה","גדרה","חורה","נשר","עתלית","ברקן","יקיר","כפר","ראש","עמק","מגידו",
  "כורזים","דבוריה","עילבון","צורן","קדימה","פרדסיה","חריש","אפרת","דן","מטולה"]);
const PLACE_RX=new RegExp(
  "(?<![\\u0590-\\u05ff])(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?("+
  PLACES.map(p=>p.n).sort((a,b)=>b.length-a.length)
    .map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+
  ")(?![\\u0590-\\u05ff])","gu");
const VENUE=[
 ["בית\\s+(?:ה)?ספר|ביה\"ס|בי\"ס|תיכון|חטיבת\\s+ביניים|אולפנת|ישיבת|גן\\s+ילדים","מוסד חינוך"],
 ["אוניברסיטת|מכללת|המכללה\\s+ל","מוסד אקדמי"],
 ["סופר|סופרמרקט|מרכול|מכולת|קניון|מרכז\\s+מסחרי","עסק"],
 ["בית\\s+(?:ה)?חולים|ביה\"ח|מרפאת|קופת\\s+חולים|מכון","מוסד רפואי"],
 ["מלון|בית\\s+מלון|מסעדת|בית\\s+קפה|פאב","עסק"],
 ["בנק|סניף|חברת|קבוצת|עמותת","גוף"],
 ["מתנ\"ס|מרכז\\s+קהילתי|בית\\s+כנסת|בית\\s+אבות|מועדון","מוסד"],
 ["מושב|קיבוץ|כפר|שכונת|היישוב|המושב|הקיבוץ|העיירה|אזור\\s+התעשייה","יישוב"],
 ["תחנת\\s+משטרת|משטרת|לשכת","גוף"],
].map(([a,l])=>({rx:new RegExp(`(?:${a})\\s+(${NME})`,"gu"),l}));
const PLACE_HEAD=new Set(PLACES.filter(p=>p.n.includes(" ")).map(p=>p.n.split(" ")[0]));
// "סופר יוחננוף באשדוד" — שם העסק נגמר לפני שם היישוב
function trimPlace(v){
  const w=v.split(/\s+/);
  while(w.length>1){
    const last=w[w.length-1], bare=last.replace(/^[בהולמכש]/,"");
    if(PLACE_BY[last]||PLACE_BY[bare]||PLACE_HEAD.has(bare)||PLACE_HEAD.has(last)||
       (w.length>2&&PLACE_BY[w.slice(-2).join(" ")])) w.pop();
    else break;
  }
  return w.join(" ");
}

function findPlaces(text){
  const n=norm(text),out=[],seen=new Set();
  PLACE_RX.lastIndex=0; let m;
  while((m=PLACE_RX.exec(n))){
    const nm=m[1], s=m.index+m[0].indexOf(nm), e=s+nm.length;
    const k=s+":"+e; if(seen.has(k))continue; seen.add(k);
    const risky=nm.length<=3||AMBIG.has(nm);
    out.push({s,e,type:"PLACE_CITY",label:"יישוב",text:text.slice(s,e),
      why:"שם יישוב מוכר"+(risky?" — אבל המילה דו-משמעית, אשר ידנית":""),
      apply:!risky,src:"pattern",prio:2,conf:risky?"medium":"high",
      review:risky,place:nm});
  }
  for(const v of VENUE){
    v.rx.lastIndex=0; let g;
    while((g=v.rx.exec(n))){
      let c=cleanName(g[1]); if(!c)continue;
      c=trimPlace(c); if(!c)continue;
      const raw=g[1];
      let s=g.index+g[0].indexOf(raw); const o=raw.indexOf(c); if(o>0)s+=o;
      const e=s+c.length, k=s+":"+e; if(seen.has(k))continue; seen.add(k);
      // "לשכת הרווחה": מילת המקום עם השם הם גוף ציבורי, ואין מה לסמן לבדיקה
      if(PUBLIC_ORG.test(norm(g[0]))||PUBLIC_ORG.test(norm(g[0]).replace(/^[בהולמכש]/,"")))continue;
      out.push({s,e,type:"PLACE_VENUE",label:v.l,text:text.slice(s,e),
        why:"מופיע אחרי מילה שמציינת מקום",apply:false,src:"pattern",
        prio:2,conf:"medium",review:true});
    }
  }
  return out;
}

/* ── מיפוי יישובים תוך שמירה על מרחקים ── */
const R2=Math.PI/180;
function hav(a1,o1,a2,o2){
  const dA=(a2-a1)*R2, dO=(o2-o1)*R2;
  const x=Math.sin(dA/2)**2+Math.cos(a1*R2)*Math.cos(a2*R2)*Math.sin(dO/2)**2;
  return 6371*2*Math.asin(Math.sqrt(x));
}
function geoMap(names,variant){
  const orig=names.map(n=>PLACE_BY[n]).filter(Boolean);
  if(orig.length<2)return null;
  const cA=orig.reduce((s,p)=>s+p.a,0)/orig.length;
  const cO=orig.reduce((s,p)=>s+p.o,0)/orig.length;
  const cosC=Math.cos(cA*R2);
  const offs=orig.map(p=>({x:(p.o-cO)*cosC,y:p.a-cA}));
  const block=new Set(names);
  const res=[];
  for(const anc of PLACES){
    for(let ang=0;ang<360;ang+=30){
      for(const mir of [1,-1]){
        const r=ang*R2, cs=Math.cos(r), sn=Math.sin(r);
        const used=new Set(block), pick=[]; let bad=false;
        for(const off of offs){
          const x=off.x*mir, y=off.y;
          const rx=x*cs-y*sn, ry=x*sn+y*cs;
          const tA=anc.a+ry, tO=anc.o+rx/Math.cos(anc.a*R2);
          let best=null,bd=1e9;
          for(const p of PLACES){
            if(used.has(p.n))continue;
            const d=hav(p.a,p.o,tA,tO);
            if(d<bd){bd=d;best=p}
          }
          if(!best||bd>20){bad=true;break}
          used.add(best.n); pick.push(best);
        }
        if(bad)continue;
        let err=0,c=0;
        for(let i=0;i<orig.length;i++)for(let j=i+1;j<orig.length;j++){
          const d0=hav(orig[i].a,orig[i].o,orig[j].a,orig[j].o);
          const d1=hav(pick[i].a,pick[i].o,pick[j].a,pick[j].o);
          err+=Math.abs(d0-d1); c++;
        }
        res.push({map:orig.map((o,i)=>({from:o.n,to:pick[i].n})),
                  err:c?err/c:0, anchor:anc.n});
      }
    }
  }
  if(!res.length)return null;
  res.sort((a,b)=>a.err-b.err);
  const uniq=[],seen=new Set();
  for(const r of res){
    const k=r.map.map(x=>x.to).join("|");
    if(seen.has(k))continue; seen.add(k); uniq.push(r);
    if(uniq.length>40)break;
  }
  return uniq[(variant||0)%uniq.length];
}

/* ══════════════════════════ מנוע ══════════════════════════ */
function findPatterns(text,on,flag){
  const n=norm(text),hits=[];
  if(on.has("NAME_ANCHORED")||flag.has("NAME_ANCHORED"))
    // העוגן הפרוזאי (rolep) מזין רק את ההצעות ב-discover, לא את ההשחרה: ניחוש
    // שגוי שם עולה הקשה אחת; כאן הוא היה דוחק החלפה אמיתית מאותם תווים.
    for(const h of anchored(text)){if(h.anchor==="rolep")continue;h.apply=on.has("NAME_ANCHORED");hits.push(h)}
  if(on.has("PLACES")||flag.has("PLACES"))
    for(const h of findPlaces(text)){
      if(!on.has("PLACES"))h.apply=false;
      if(h.type==="PLACE_VENUE")h.apply=false;   // שם מוסד תמיד לאישור
      hits.push(h)}
  for(const p of PAT){
    if(!on.has(p.n)&&!flag.has(p.n))continue;
    p.rx.lastIndex=0;let m;
    while((m=p.rx.exec(n))){
      if(m[0]==="")({},p.rx.lastIndex++);
      if(p.v&&!p.v(m[0]))continue;
      const g=p.g, s=g? m.index+m[0].indexOf(m[g]) : m.index, e=s+(g?m[g].length:m[0].length);
      if(g&&!m[g])continue; if(e<=s)continue;
      hits.push({s,e,type:p.n,label:p.l,text:text.slice(s,e),apply:on.has(p.n),
        why:WHYP[p.n]||"התאמה לדפוס מוכר",src:"pattern",prio:p.p,
        conf:p.on?"high":"medium"});
    }}
  return hits}

const KINDS=[["NAME","שם"],["ORG","גוף"],["ID",'ת"ז'],["PHONE","טלפון"],["ADDRESS","כתובת"],["PLACE","מקום"],["OTHER","אחר"]];
const KINDLBL=Object.fromEntries(KINDS);
const CANON={PLACE_CITY:["PLACE","יישוב"],PLACE_VENUE:["PLACE","מקום"],PLACE:["PLACE","מקום"],OTHER:["OTHER","פרט"],ORG:["ORG","גוף"],ID:["ID",'ת"ז'],ISRAELI_ID:["ID",'ת"ז'],ISRAELI_ID_LABELED:["ID",'ת"ז'],
 PHONE:["PHONE","טלפון"],PHONE_MOBILE:["PHONE","טלפון"],PHONE_LAND:["PHONE","טלפון"],
 PHONE_TOLL:["PHONE","טלפון"],FAX:["PHONE","פקס"],EMAIL:["EMAIL",'דוא"ל'],
 ADDRESS:["ADDRESS","כתובת"],ADDRESS_STREET:["ADDRESS","כתובת"],
 NAME:["NAME","שם"],NAME_ANCHORED:["NAME","שם"]};
function ckey(t,x){const f=(CANON[t]||[t])[0],v=norm(x).trim();
  if(f==="ID")return "ID|"+v.replace(/\D/g,"");
  if(f==="PHONE")return "PHONE|"+v.replace(/\D/g,"").slice(-9);
  if(f==="EMAIL")return "EMAIL|"+v.toLowerCase();
  return f+"|"+v}

function resolve(hits){
  const rk={list:0,pattern:1};
  hits.sort((a,b)=>a.s-b.s||rk[a.src]-rk[b.src]||(a.prio??5)-(b.prio??5)||(b.e-b.s)-(a.e-a.s));
  const out=[];let last=-1;
  for(const h of hits){ if(h.s>=last){out.push(h);last=h.e} }
  return out}

class Engine{
  constructor(subs,allow,opt,docText){
    subs=subs.map(x=>({...x}));
    this.opt=opt; this.subs=subs;
    // שם בדוי שכבר מופיע במסמך האמיתי הוא מלכודת: אי אפשר יהיה להחזיר
    // אותו, והוא ייראה כאילו הוא שייך למישהו. אוספים את כל מילות המסמך
    // ואוסרים עליהן.
    this.forbidden=new Set();
    if(docText)for(const w of (norm(docText).match(WRX)||[]))this.forbidden.add(w);
    this.gmap={}; for(const s of subs) if(s.g)this.gmap[s.value]=s.g;
    this.used=new Set();
    // פרופיל שכופה "יעל רוזן" על מישהי, כשיעל רוזן אמיתית מופיעה במסמך
    // הזה — שתי נשים היו מתמזגות לשם אחד. עדיף לשבור עקביות פעם אחת
    // ולומר את זה, מאשר לערבב שני אנשים.
    this.collided=[];
    const nd=docText?norm(docText):"";
    for(const s of subs){
      if(!s.replacement||!nd)continue;
      if(new RegExp(NW+flex(s.replacement)+NWE,"u").test(nd)){
        this.collided.push({value:s.value,rep:s.replacement});
        s.replacement="";
      }
    }
    this.rules=[];const seen=new Set();
    const protect=new Set(subs.map(x=>x.value));
    if(typeof PLACE_BY!=="undefined")Object.keys(PLACE_BY).forEach(n=>protect.add(n));
    for(const s of subs){
      // גם מקום שאישרה מקבל צורות עם אות שימוש: "במבוא חורון" הוא "מבוא חורון".
      // בלי זה יישוב שאינו במאגר מאושר, לא נמצא, ומדווח "לא מופיע במסמך".
      const lvl=(s.kind==="NAME"||s.kind==="ORG"||s.kind==="PLACE")?(opt.prefixes||"normal"):"off";
      // שם קצר בן מילה אחת ("רון", "גל") — הצורות עם אות שימוש
      // דומות מדי למילים אחרות, אז הן דורשות אישור ולא מוחלפות לבד.
      const shortSingle = s.kind==="NAME" &&
        s.value.trim().split(/\s+/).length===1 && s.value.trim().length<=3;
      for(const [v,pre] of variants(s.value,lvl,protect)){
        if(seen.has(v))continue; seen.add(v);
        this.rules.push({rx:new RegExp(NW+flex(v)+NWE,"gu"),base:s.value,
          kind:s.kind,rep:s.replacement,pre,auto:s.auto,soft:!!pre&&shortSingle});
      }
      // "עמותת שביל הלב" אושרה: גם "שביל הלב" לבדו הוא אותו גוף, כמו שם משפחה
      // לבדו אצל אדם. אחרת המופע הראשון מוחלף והשני נשאר בטקסט.
      if(s.kind==="ORG"){
        const hm=/^(עמותת|עמותה|מעון|מרפאת|מכון|קרן|מרכז|אגודת|חברת|בית ספר|בי"ס|ביה"ס|גן ילדים|פנימיית|ישיבת)\s+(.+)$/u.exec(s.value.trim());
        const rest=hm&&hm[2].trim();
        if(rest&&(rest.split(/\s+/).length>=2||rest.length>=5)&&!protect.has(rest))
          for(const [v,pre] of variants(rest,lvl,protect)){
            if(seen.has(v))continue; seen.add(v);
            this.rules.push({rx:new RegExp(NW+flex(v)+NWE,"gu"),base:s.value,kind:s.kind,rep:s.replacement,pre,auto:s.auto,soft:false});
          }
      }
    }
    this.rules.sort((a,b)=>b.rx.source.length-a.rx.source.length);
    // הרשימה הלבנה חייבת לתפוס גם צורות עם אות שימוש ("בתל אביב"),
    // אחרת "אל תחליף" נכשל בשקט על כל מילה עם ב/ל/מ/ה לפניה.
    this.allow=(allow||[]).map(a=>new RegExp(
      "(?<![\\u0590-\\u05ff])(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+
      flex(a)+NWE,"gu"));
    this.cnt={};this.map={};
    // "גולדשמיט" ו"תמר גולדשמיט" הם אותו אדם — אותו כינוי, לא שניים.
    const named=subs.filter(x=>x.kind==="NAME")
      .sort((a,b)=>b.value.length-a.value.length);
    this.alias={};
    for(const short of named){
      if(short.replacement)continue;
      const toks=short.value.trim().split(/\s+/);
      if(toks.length!==1)continue;
      const full=named.find(f=>f!==short&&f.value.split(/\s+/).length>1&&
        f.value.split(/\s+/).slice(-1)[0]===toks[0]);
      if(full)this.alias[short.value]=full.value;
    }
    // "שלוה ליבוביץ" ו"שלווה ליבוביץ" הוקלדו שניהם — זו אותה אישה.
    // כל מילה זהה או במרחק אות-קריאה אחת מהמקבילה שלה.
    const same=(a,b)=>{if(a===b)return true;const r=near1(a,b);
      return !!r&&(r.k==="sub"?HOMO.has(r.p):WEAK.has(r.p))};
    for(let i=0;i<named.length;i++)for(let j=i+1;j<named.length;j++){
      const A=named[i],B=named[j];
      if(A.replacement&&B.replacement)continue;
      const aw=norm(A.value).trim().split(/\s+/),bw=norm(B.value).trim().split(/\s+/);
      if(aw.length<2||aw.length!==bw.length)continue;
      if(aw.every((w,k)=>same(w,bw[k]))&&!this.alias[B.value]&&!this.alias[A.value]){
        const [keep,drop]=A.replacement?[A,B]:[B.replacement?B:A,B.replacement?A:B];
        this.alias[drop.value]=keep.value;
      }
    }
    for(const s of subs) if(s.replacement) this.map[ckey(s.kind,s.value)]??=s.replacement;
  }
  blocked(s,e,zones){return zones.some(([a,b])=>a<=s&&e<=b)}
  detect(text){
    const n=norm(text),zones=[];
    for(const rx of this.allow){rx.lastIndex=0;let m;
      while((m=rx.exec(n)))zones.push([m.index,m.index+m[0].length])}
    const hits=[];
    for(const r of this.rules){r.rx.lastIndex=0;let m;
      while((m=r.rx.exec(n))){
        const s=m.index,e=s+m[0].length;
        if(this.blocked(s,e,zones))continue;
        // שם בן מילה אחת ("שר", "גיל") שאחריו מילה שעושה ממנו תואר ציבורי:
        // "שר הרווחה" הוא התפקיד, לא האדם ששמו שר. בודקים את ההתאמה עם המילה הבאה.
        if(r.base.trim().split(" ").length===1){const nx=n.slice(e,e+30).trim().split(" ")[0]||""; const t2=(m[0]+" "+nx).trim(); if(PUBLIC_ORG.test(t2)||PUBLIC_ORG.test(t2.replace(/^[בהולמכש]/,"")))continue;}
        hits.push({s,e,type:r.kind,label:KINDLBL[r.kind]||r.kind,text:text.slice(s,e),
          apply:!r.soft,src:"list",prio:0,base:r.base,rep:r.rep,pre:r.pre,
          why:r.auto?"התגלה אוטומטית מההקשר":(r.pre?`מהרשימה שהגדרת, עם אות השימוש "${r.pre}" שנשמרה`:"מהרשימה שהגדרת"),
          review:!!r.pre,conf:"high"});
      }}
    for(const h of findPatterns(text,this.opt.on,this.opt.flag)){
      if(this.blocked(h.s,h.e,zones))continue;
      h.review=h.conf!=="high"; h.base=h.text; hits.push(h);
    }
    return resolve(hits)}
  repFor(h){
    const pre=h.pre||"";
    if(this.opt.mode==="block") return addPre(pre,"███");
    // המפתח לפי הערך הבסיסי, לא לפי הטקסט שנתפס — אחרת
    // "מאורי בן-שחר" מקבל כינוי אחר מ"אורי בן-שחר".
    const canonical=(h.base&&this.alias[h.base])||h.base||h.text;
    const k=ckey(h.type==="NAME_ANCHORED"?"NAME":h.type,canonical);
    let base=h.rep||this.map[k];
    if(!base){
      const [fam,lab]=CANON[h.type]||[h.type,h.label];
      const n=(this.cnt[fam]||0)+1;this.cnt[fam]=n;
      if(fam==="NAME"&&this.opt.mode==="real")
        base=fakeName(canonical,this.gmap[canonical]||h.g,this.used,this.forbidden);
      else base = fam==="NAME" ? "פלוני "+hord(n) : `[${lab} ${hord(n)}]`;
    }
    this.map[k]??=base;
    return addPre(pre,base)}
}

/* ══════════════════════════ DOCX ══════════════════════════ */
function ownText(p,out){
  for(const c of p.children){
    if(c.localName==="p")continue;
    if(c.localName==="t"||c.localName==="delText")out.push(c);
    ownText(c,out)}}
function flatten(doc,part){
  const out=[];
  for(const p of doc.getElementsByTagNameNS(W,"p")){
    const els=[];ownText(p,els);
    let pos=0;const spans=[];let txt="";
    for(const el of els){const t=el.textContent||"";if(!t)continue;
      spans.push({el,s:pos,e:pos+t.length,attr:null});txt+=t;pos+=t.length}
    if(txt)out.push({text:txt,spans,part});
  }
  for(const sel of ["docPr","cNvPr"])
    for(const el of doc.getElementsByTagName("*")){
      if(el.localName!==sel)continue;
      for(const a of ["descr","name"]){const v=el.getAttribute(a);
        if(v&&v.trim())out.push({text:v,spans:[{el,s:0,e:v.length,attr:a}],
          part:part+" (טקסט חלופי)"})}}
  return out}
function setSpan(sp,v){
  if(sp.attr)sp.el.setAttribute(sp.attr,v);
  else{sp.el.textContent=v; if(v!==v.trim())sp.el.setAttributeNS(XMLNS,"xml:space","preserve")}}
function applyReps(blk,reps){
  if(!reps.length)return 0;
  reps.sort((a,b)=>a[0]-b[0]);
  const cl=[];let last=-1;
  for(const r of reps) if(r[0]>=last){cl.push(r);last=r[1]}
  for(let i=cl.length-1;i>=0;i--){
    const [s,e,nw]=cl[i];
    const touched=blk.spans.filter(sp=>sp.s<e&&sp.e>s);
    if(!touched.length)continue;
    touched.forEach((sp,ix)=>{
      const t=sp.attr?sp.el.getAttribute(sp.attr):sp.el.textContent;
      const ls=Math.max(s,sp.s)-sp.s, le=Math.min(e,sp.e)-sp.s;
      setSpan(sp, ix===0 ? t.slice(0,ls)+nw+t.slice(le) : t.slice(0,ls)+t.slice(le));
    });}
  return cl.length}
function acceptTracked(doc){
  let ins=0,del=0,go=true;
  while(go){go=false;
    for(const el of Array.from(doc.getElementsByTagName("*"))){
      const ln=el.localName;
      if((ln==="del"||ln==="moveFrom")&&el.namespaceURI===W){el.remove();del++;go=true;break}
      if((ln==="ins"||ln==="moveTo")&&el.namespaceURI===W){
        const p=el.parentNode;while(el.firstChild)p.insertBefore(el.firstChild,el);
        el.remove();ins++;go=true;break}}}
  for(const el of Array.from(doc.getElementsByTagNameNS(W,"delText")))el.remove();
  return [ins,del]}
function stripComments(doc){
  let n=0;const t=["commentRangeStart","commentRangeEnd","commentReference","annotationRef"];
  for(const el of Array.from(doc.getElementsByTagName("*")))
    if(t.includes(el.localName)){el.remove();n++}
  for(const r of Array.from(doc.getElementsByTagNameNS(W,"r")))
    if(!r.children.length||Array.from(r.children).every(c=>c.localName==="rPr"))r.remove();
  return n}
function stripRsid(doc){let n=0;
  for(const el of doc.getElementsByTagName("*")){
    for(const a of Array.from(el.attributes))
      if(/rsid/i.test(a.name)){el.removeAttributeNode(a);n++}}
  for(const el of Array.from(doc.getElementsByTagName("*")))
    if(/^rsids?$/.test(el.localName)){el.remove();n++}
  return n}
const LEAK=/Target="(mailto:[^"]+|file:[^"]+|[A-Za-z]:\\[^"]+|\\\\[^"]+)"/g;

async function redactDocx(buf,subs,allow,opt){
  const files=await unzip(buf);
  const rep={ins:0,del:0,cm:0,rsid:0,dropped:[],meta:[],rels:[],sweep:0};
  let keep=files.filter(f=>{
    if(DROP.includes(f.name)||f.name.startsWith("customXml/")){rep.dropped.push(f.name);return false}
    return true});
  for(const f of keep){
    if(f.name.endsWith(".rels")||f.name==="[Content_Types].xml"){
      let s=TXT.decode(f.data);
      for(const d of rep.dropped){
        const b=d.split("/").pop().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        s=s.replace(new RegExp(`<Relationship[^>]*Target="[^"]*${b}"[^>]*/>`,"g"),"")
           .replace(new RegExp(`<Override[^>]*PartName="/${d.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"[^>]*/>`,"g"),"")}
      if(f.name.endsWith(".rels")){
        let m;LEAK.lastIndex=0;while((m=LEAK.exec(s)))rep.rels.push(m[1]);
        s=s.replace(LEAK,'Target="#"')}
      f.data=ENC.encode(s)}
    if(f.name==="docProps/core.xml"||f.name==="docProps/app.xml"){
      const o=TXT.decode(f.data),d=parseXML(o);
      for(const el of d.getElementsByTagName("*")){
        if(["creator","lastModifiedBy","title","subject","description","keywords",
            "category","Company","Manager","LastAuthor","Template","TitlesOfParts",
            "HeadingPairs","Application"].includes(el.localName)){
          if(el.textContent.trim())rep.meta.push(el.localName+"="+el.textContent.trim());
          el.textContent="";while(el.firstChild)el.removeChild(el.firstChild)}
        if(el.localName==="revision")el.textContent="1";
        if(["created","modified"].includes(el.localName))el.textContent="1970-01-01T00:00:00Z";
        if(["totaltime","lastprinted","hyperlinkbase","identifier","contentstatus"]
            .includes(el.localName.toLowerCase())){
          if(el.textContent.trim())rep.meta.push(el.localName+"="+el.textContent.trim());
          el.textContent=""}}
      f.data=ENC.encode(serXML(d,o))}
  }
  const docs=[];
  for(const f of keep){
    if(!TEXTPART.test(f.name))continue;
    const o=TXT.decode(f.data),d=parseXML(o);
    const [i,dl]=acceptTracked(d);rep.ins+=i;rep.del+=dl;
    rep.cm+=stripComments(d);rep.rsid+=stripRsid(d);
    docs.push({f,doc:d,orig:o});
  }
  const applied=[],flagged=[],secrets=[];
  let blocks=[];
  for(const dd of docs) blocks=blocks.concat(flatten(dd.doc,dd.f.name));
  const eng=new Engine(subs,allow,opt,blocks.map(b=>b.text).join("\n"));
  // ה-XML משתנה במקום, ולכן flatten אחרי ההחלפה מחזיר את הטקסט המושחר.
  // בלי צילום מראש, סורק הגוף מציע לה בחזרה את השמות הבדויים שהמצאנו.
  const ORIG=blocks.map(b=>({part:b.part,text:b.text}));
  for(const blk of blocks){
    const hits=eng.detect(blk.text);if(!hits.length)continue;
    const reps=[];
    for(const h of hits){
      const rec={value:h.text,label:h.label,part:partName(blk.part),why:h.why,
        ctx:ctxHTML(blk.text,h.s,h.e),review:!!h.review,src:h.src,base:h.base||undefined};
      if(h.apply){const nw=eng.repFor(h);rec.rep=nw;rec.baseRep=eng.map[ckey(h.type,h.text)]||nw;
        reps.push([h.s,h.e,nw]);applied.push(rec);secrets.push(h.text);
        if(h.base)secrets.push(h.base)}
      else flagged.push(rec)}
    applyReps(blk,reps)}
  // מעבר אחידות
  const sweep={};
  for(const r of applied){
    const v=norm(r.value).trim(), rp=r.baseRep||r.rep;
    // אם התחליף מכיל את הערך ("דוד" → "דוד א׳"), סריקה חוזרת
    // תתפוס את התחליף עצמו ותכפיל אותו.
    if(v.length>=4&&!(v in sweep)&&rp&&!norm(rp).includes(v))sweep[v]={rep:rp,of:null};
  }
  // "החלפתי את תמר גולדשמיט, ובטקסט נשאר גולדשמיט לבד" — זו הדליפה
  // הכי שקטה שיש, כי חיפוש-והחלפה על השם המלא לא נוגע בו. כאן כל חלק
  // של שם שהוחלף נסרק בנפרד, ורק כשהוא חד-משמעי: שם משפחה שמשותף
  // לשני אנשים במסמך לא מוחלף אלא מסומן לבדיקה.
  const partOf=new Map();
  const docTokAll=new Set();
  for(const b of ORIG)for(const w of (norm(b.text).match(WRX)||[]))docTokAll.add(w);
  // "בחיים" הוא המילה, לא הבן אדם. חלק של שם שהוא גם מילה, או שמופיע
  // במסמך עם ה' הידיעה, מוחלף רק כשהוא עומד לבד — בלי אותיות שימוש —
  // ומסומן לבדיקה.
  // שלוש אותיות לבדן אינן הופכות חלק של שם למילה: "סבג" ו"דהן" אינם מילים,
  // ובלי אות שימוש הם דולפים ("וסבג" נשאר בטקסט). מילה של ממש נתפסת ברשימות
  // ובצורת ה' הידיעה שבמסמך; שתי אותיות נשארות זהירות.
  const wordy=p=>WORDLIKE.has(p)||COMMON.has(p)||docTokAll.has("ה"+p)||p.length<=2;
  const regPart=(value,rp,label)=>{
    if(!rp||rp==="███")return;
    if(label&&!label.startsWith("שם"))return;
    const vw=norm(value).trim().split(/\s+/), rw=norm(rp).trim().split(/\s+/);
    if(vw.length<2)return;
    const real=opt.mode==="real";
    const add=(p,to)=>{
      if(!p||p.length<3||STOP.has(p)||PLACE_BY[p]||AMBIG.has(p))return;
      if(p in sweep||!to||norm(to).includes(p))return;
      const g=partOf.get(p)||{to:new Set(),of:new Set(),wordy:wordy(p)};
      g.to.add(to); g.of.add(value); partOf.set(p,g)};
    // שם פרטי → שם פרטי בדוי
    add(vw[0],real?rw[0]:rp);
    // שם המשפחה כולו ("לב שדה", "בן דוד") והמילה האחרונה לבד
    const sur=vw.slice(1).join(" "), rsur=real?rw.slice(1).join(" "):rp;
    add(sur,rsur);
    if(vw.length>2)add(vw[vw.length-1],real?rw[rw.length-1]:rp);
  };
  for(const r of applied) regPart(r.value,r.baseRep||r.rep,r.label);
  // גם שמות מהפרופיל שלא הופיעו במלואם במסמך הזה: סיכום פגישה מזכיר
  // "גולדשמיט" לבד, בלי "תמר גולדשמיט" בשום מקום, וזה עדיין אותה אישה.
  for(const s of subs) if(s.kind==="NAME")
    regPart(s.value,s.replacement||eng.map[ckey("NAME",s.value)],null);
  const partAmbig=[];
  for(const [p,g] of partOf){
    if(g.to.size>1){partAmbig.push({p,of:[...g.of]});continue}
    sweep[p]={rep:[...g.to][0],of:[...g.of][0],wordy:g.wordy};
  }
  let blocks2=[];for(const dd of docs)blocks2=blocks2.concat(flatten(dd.doc,dd.f.name));
  for(const blk of blocks2){
    const n=norm(blk.text),reps=[];
    const zones=[];
    for(const rx0 of eng.allow){rx0.lastIndex=0;let z;
      while((z=rx0.exec(n)))zones.push([z.index,z.index+z[0].length])}
    for(const [o,inf] of Object.entries(sweep)){
      if(!n.includes(o))continue;
      const nw=inf.rep;
      // חלק של שם מופיע בעברית עם אות שימוש ("לגולדשמיט"), ולכן
      // הסריקה חייבת לקלוט אותה ולהחזיר אותה לתחליף.
      const rx=inf.of&&!inf.wordy
        ? new RegExp(NW+"([בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+flex(o)+NWE,"gu")
        : new RegExp(NW+"()"+flex(o)+NWE,"gu");
      let m;
      while((m=rx.exec(n))){
        const s=m.index,e=s+m[0].length;
        if(zones.some(([a,b])=>a<=s&&e<=b))continue;
        const out=inf.of?addPre(m[1]||"",nw):nw;
        reps.push([s,e,out]);
        applied.push({value:blk.text.slice(s,e),
          label:inf.of?"שם (חלק)":"אחידות",part:partName(blk.part),
          why:inf.of?(inf.wordy
                ?`חלק מהשם «${inf.of}» — אבל גם מילה. הוחלף רק כשעומד לבד; ודאי שזה האדם`
                :`חלק מהשם «${inf.of}» שכבר הוחלף, ומופיע כאן לבד`)
                    :"אותו ערך זוהה במקום אחר במסמך, אז הוחלף גם כאן",
          ctx:ctxHTML(blk.text,s,e),review:!!inf.of,rep:out,baseRep:nw,base:o,src:"sweep"})}}
    rep.sweep+=applyReps(blk,reps)}
  for(const c of eng.collided){
    flagged.push({value:c.rep,label:"התנגשות פרופיל",part:"המסמך",review:true,src:"collide",
      why:`הפרופיל קבע ש«${c.value}» יהיה «${c.rep}», אבל «${c.rep}» הוא אדם אמיתי במסמך הזה. `+
          `ניתן שם בדוי אחר, ו«${c.rep}» האמיתי/ת עדיין בטקסט — הוסיפי אותו לרשימה`,
      ctx:""});
  }
  for(const pa of partAmbig){
    const hit=blocks2.find(b=>new RegExp(NW+esc(pa.p)+NWE,"u").test(norm(b.text)));
    if(!hit)continue;
    const nb=norm(hit.text), mm=new RegExp(NW+esc(pa.p)+NWE,"u").exec(nb);
    flagged.push({value:pa.p,label:"שם משותף",part:partName(hit.part),
      why:`מופיע לבד, ומשותף ליותר מאדם אחד (${pa.of.join(", ")}) — לא הוחלף אוטומטית`,
      ctx:ctxHTML(hit.text,mm.index,mm.index+pa.p.length),review:true,src:"partAmbig"});
  }
  for(const dd of docs) dd.f.data=ENC.encode(serXML(dd.doc,dd.orig));

  // תצוגה
  const origAll=blocks.map(b=>b.text).join("\n");
  const repVals={};
  for(const r of applied){ if(!r.rep)continue;
    (repVals[r.rep]=repVals[r.rep]||new Set()).add(r.value); }
  const ambiguous=new Set(Object.keys(repVals).filter(rp=>
    repVals[rp].size>1 || origAll.includes(rp)));
  const ids={};applied.forEach((r,i)=>{if(r.rep&&!(r.rep in ids))ids[r.rep]=i});
  const preview=[];
  let blocks3=[];for(const dd of docs)blocks3=blocks3.concat(flatten(dd.doc,dd.f.name));
  for(const blk of blocks3){
    const marks=[];
    for(const [rp,id] of Object.entries(ids)){
      if(!rp||!blk.text.includes(rp))continue;
      let i=0;while((i=blk.text.indexOf(rp,i))>=0){marks.push({s:i,e:i+rp.length,id,amb:ambiguous.has(rp)});i+=rp.length}}
    marks.sort((a,b)=>a.s-b.s);
    const kp=[];let last=-1;for(const m of marks)if(m.s>=last){kp.push(m);last=m.e}
    preview.push({part:partName(blk.part),text:blk.text,marks:kp});}

  // סריקת שיבושים על הפלט, לא על המקור: כל מה שדומה לשם שהוחלף ובכל זאת
  // שרד את ההחלפה — הוא בדיוק מה שהיה יוצא החוצה בלי שאף אחד ישים לב.
  let near=[];
  if(opt.near!==false){
    const tset=new Map();
    for(const r of applied){
      const base=r.base||r.value; if(!base)continue;
      if(r.label==="אחידות")continue;
      if(!["שם","יישוב","מקום","מוסד חינוך","מוסד אקדמי","מוסד רפואי","עסק","גוף","מוסד","כתובת","פרט"]
         .includes(r.label)&&!r.label.startsWith("שם")&&!r.label.startsWith("גוף"))continue;
      const nv=norm(base).trim();
      if(!tset.has(nv))tset.set(nv,{value:base,norm:nv,words:nv.split(/\s+/).length,
        rep:r.baseRep||r.rep,kind:"NAME"});
    }
    for(const [p,g] of partOf){
      if(g.to.size!==1||tset.has(p))continue;
      tset.set(p,{value:p,norm:p,words:1,rep:[...g.to][0],kind:"NAME"});
    }
    for(const s of subs){
      const nv=norm(s.value).trim();
      if(!tset.has(nv))tset.set(nv,{value:s.value,norm:nv,words:nv.split(/\s+/).length,
        rep:s.replacement||eng.map[ckey(s.kind,s.value)]||"",kind:s.kind});
    }
    const banned=new Set();
    for(const r of applied){if(r.rep){const nr=norm(r.rep).trim();banned.add(nr);
      for(const w of nr.split(/\s+/))banned.add(w)}}
    for(const t of tset.values())banned.add(t.norm);
    for(const a of (allow||[]))banned.add(norm(a).trim());
    let blocksN=[];for(const dd of docs)blocksN=blocksN.concat(flatten(dd.doc,dd.f.name));
    near=findNear(blocksN.filter(b=>!b.part.includes("טקסט חלופי")),
      [...tset.values()],banned);
    for(const nm of near)flagged.push(nm);
  }

  // שם מהרשימה שלא נמצא אפילו פעם אחת: או שהוא לא במסמך הזה, או שהוא
  // כתוב אחרת. שתיקה כאן משאירה אותה בטוחה שטופל.
  const hitBases=new Set(applied.map(r=>norm(r.base||r.value).trim()));
  const nearTargets=new Set(near.map(x=>norm(x.near.target).trim()));
  for(const s of subs){
    if(s.kind!=="NAME"&&s.kind!=="ORG"&&s.kind!=="PLACE")continue;
    const nv=norm(s.value).trim();
    if(hitBases.has(nv)||eng.alias[s.value])continue;
    const nearHit=near.find(x=>norm(x.near.target).trim()===nv);
    flagged.push({value:s.value,label:"לא נמצא",part:"המסמך",review:true,src:"nohit",ctx:"",
      why:nearHit?`לא מופיע במסמך בכתיב הזה, אבל נמצא «${nearHit.value}» — ראי למעלה`
                 :"לא מופיע במסמך הזה בכלל. אם זה שם מהתיק — בסדר; אם ציפית שיימצא, בדקי כתיב"});
  }
  const blob=await zip(keep);
  const outBuf=await blob.arrayBuffer();
  // שם שלא נמצא אינו דליפה — הוא מוצג ב«לבדיקה» אבל לא צובע את הבר
  const remaining=[...new Set(flagged.filter(r=>r.src!=="near"&&r.src!=="nohit").map(r=>r.value))];
  const ver=await verify(outBuf,secrets.concat(subs.flatMap(s=>
    s.kind==="NAME"?variants(s.value,opt.prefixes||"normal").map(v=>v[0]):[s.value])));
  ver.hadList=subs.length>0;
  ver.remaining=remaining;
  ver.near=near;
  // הרשת האחרונה: שם שהיא לא רשמה, שיושב בגוף הטקסט ולא נגענו בו.
  // לא מחליפים אותו מאחורי גבה — שואלים.
  let suggest=[];
  try{
    if(opt.body===false)throw {skip:1};
    const known=[...subs.map(s=>s.value),...(allow||[]),
      ...applied.map(r=>r.base||r.value),...applied.map(r=>r.baseRep||r.rep)];
    suggest=bodyNames(ORIG.filter(b=>!b.part.includes("טקסט חלופי")),known)
      .filter(x=>!near.some(nm=>norm(nm.value).trim()===norm(x.value).trim()))
      .slice(0,12);
  }catch(e){if(!e||!e.skip)console.warn("סריקת גוף הטקסט נכשלה",e)}
  ver.suggest=suggest;
  // ירוק רק כשאין דליפות, אין ממצאים פתוחים, ואין ערוץ שלא נותח
  ver.complete=ver.passed&&!remaining.length&&!ver.embedded.length&&
    !near.length&&!suggest.length;
  return {blob,applied,flagged,preview,structural:rep,verification:ver,map:eng.map};
}
const PARTN={"document.xml":"גוף המסמך","footnotes.xml":"הערות שוליים","endnotes.xml":"הערות סיום"};
function partName(p){
  const base=p.split(" (")[0].split("/").pop();
  const ex=p.includes("טקסט חלופי")?" · טקסט חלופי":"";
  if(PARTN[base])return PARTN[base]+ex;
  if(base.startsWith("header"))return "כותרת עליונה"+ex;
  if(base.startsWith("footer"))return "כותרת תחתונה"+ex;
  if(p.includes("glossary"))return "רכיבים מהירים"+ex;
  return base+ex}
function ctxHTML(t,s,e,w=55){
  const a=Math.max(0,s-w),b=Math.min(t.length,e+w);
  return {pre:(a>0?"…":"")+t.slice(a,s), hit:t.slice(s,e), post:t.slice(e,b)+(b<t.length?"…":"")}}

async function verify(buf,secrets){
  const files=await unzip(buf);
  const sec=[...new Set(secrets.filter(s=>s&&s.trim().length>=2))].map(s=>[s,norm(s)]);
  const leaks=[],emb=[];let n=0;
  for(const f of files){n++;
    if(/^word\/(embeddings|media)\//.test(f.name))emb.push(f.name);
    for(const enc of ["utf-8","utf-16le"]){
      let t;try{t=new TextDecoder(enc).decode(f.data)}catch(_){continue}
      const nt=norm(t);
      for(const [o,nv] of sec) if(nv&&nt.includes(nv))
        leaks.push({value:o,part:f.name});
    }}
  const uniq=[],seen=new Set();
  for(const l of leaks){const k=l.part+"|"+l.value;if(!seen.has(k)){seen.add(k);uniq.push(l)}}
  return {passed:!uniq.length,leaks:uniq,parts:n,embedded:emb}}

function discover(blocks){
  const found={};
  for(const b of blocks) for(const h of anchored(b.text)){
    const r=found[h.text]||(found[h.text]={count:0,why:new Set(),conf:"medium",ctx:"",role:null,g:null,gf:0,gm:0});
    r.count++;r.why.add(h.why);
    if(h.role&&!r.role)r.role=h.role;
    if(h.g==="f")r.gf++; if(h.g==="m")r.gm++;
    if(h.anchor==="bid"||h.anchor==="role")r.conf="high";
    // דובר שחוזר, או דובר בשם מלא, הוא אדם בוודאות. דובר יחיד במילה אחת נשאר
    // הצעה: "שאלה:" או "הערה:" נראים אותו דבר עד שחוזרים.
    if(h.anchor==="speaker"){r.spk=(r.spk||0)+1; if(r.spk>=2||h.text.includes(" "))r.conf="high";}
    if(!r.ctx)r.ctx=ctxHTML(b.text,h.s,h.e)}
  // "מאורי בן-שחר" הוא "אורי בן-שחר" עם אות שימוש — לא מועמד נפרד
  // אין איחוד אוטומטי לפי האות הראשונה: "שרון לוי" אינו "רון לוי"
  // עם אות שימוש, ומיזוג שגוי נותן לשני אנשים אותו כינוי.
  // צורות עם אות שימוש נתפסות ממילא דרך מנגנון הווריאנטים,
  // ואם באמת מדובר באותו אדם — יש בורר "זה אותו אחד" בממשק.
  const keys=Object.keys(found);
  return keys.map(value=>{
    const r=found[value];
    const toks=value.split(/\s+/);
    // שם משפחה לבד — מסומן ככינוי של השם המלא
    const full=toks.length===1?keys.find(x=>x!==value&&
      x.split(/\s+/).length>1&&x.split(/\s+/).slice(-1)[0]===toks[0]):null;
    return {value,count:r.count,conf:r.conf,why:[...r.why].join(" · "),
            ctx:r.ctx,aliasOf:full||null,role:r.role,speaker:!!r.spk,
            g:r.gf>r.gm?"f":r.gm>r.gf?"m":null};
  }).sort((a,b)=>(a.conf==="high"?0:1)-(b.conf==="high"?0:1)||b.count-a.count)}


const NER_CACHE="transformers-cache";
let nerEnv=function(){
  const local=location.protocol==="file:";
  return {local,
    canCache:!local&&typeof caches!=="undefined"&&!!window.isSecureContext,
    canRun:!local};
};
let nerCached=async function(){
  try{
    if(!nerEnv().canCache)return false;
    const c=await caches.open(NER_CACHE);
    const k=await c.keys();
    return k.some(r=>r.url.includes("dictabert")&&/\.onnx(_data)?$/.test(r.url));
  }catch(_){return false}
};
async function nerPersist(){
  try{
    if(!navigator.storage||!navigator.storage.persist)return null;
    if(await navigator.storage.persisted())return true;
    return await navigator.storage.persist();
  }catch(_){return null}
}
/* ── טעינת המודל בדפדפן ──
   המודל רץ אצלה במחשב. שום דבר לא נשלח לשום מקום — לא המסמך, לא הטקסט.
   מה שכן עובר ברשת הוא הורדת המודל עצמו, פעם אחת. */
const NER_LIB="https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";
const NER_MODEL="onnx-community/dictabert-ner-ONNX";
let NERP=null,NERSTATE="off";
/* tokenizer.json של DictaBERT מכיל \" — escape חוקי במנוע ה-regex של
   Rust, ולא חוקי ב-JavaScript תחת דגל u. בלי זה הטוקנייזר לא נבנה בכלל.

   ניסיון ראשון היה לעטוף את RegExp, אבל מודול מה-CDN לא בהכרח פותר את
   השם דרך המשתנה הגלובלי שלנו. לכן מתקנים את הנתון עצמו: את קובץ
   הטוקנייזר, גם בדרך מהרשת וגם עותק ששמור כבר במטמון. */
// הבנאי המקורי, לפני שאנחנו עוטפים אותו — אחרת בדיקת התקינות למטה
// תשאל בנאי סלחן ותקבל תמיד "תקין", ושום תבנית לא תתוקן.
const RX_NATIVE=RegExp;
const RX_OK=/[\^$\\.*+?()\[\]{}|\/dDsSwWbBnrtvfxucpPk0-9]/;
const rxClean=p=>String(p).replace(/\\(.)/gu,(m,c)=>RX_OK.test(c)?m:c);
function rxBad(p){ try{new RX_NATIVE(p,"u");return false}catch(_){return true} }
// מתקנים כל תבנית שלא נבנית, ורק אותה
function fixTokJSON(txt){
  let j=null,repaired=false;
  try{j=JSON.parse(txt)}
  catch(e){
    // "תו מיותר אחרי סוף ה-JSON" — קורה כשנשמר גוף עם כותרות אורך
    // שלא תואמות לו. חותכים לסוגר האחרון ומנסים שוב.
    const k=txt.lastIndexOf("}");
    if(k>0){try{j=JSON.parse(txt.slice(0,k+1));repaired=true}catch(_){}}
    if(!j){console.warn("tokenizer.json לא ניתן לפענוח:",e.message);return txt}
    console.warn("tokenizer.json הכיל זנב מיותר —",txt.length-(k+1),"תווים נחתכו");
  }
  let n=0;
  (function walk(o){
    if(!o||typeof o!=="object")return;
    for(const k of Object.keys(o)){
      const v=o[k];
      if(typeof v==="string"){
        if((k==="Regex"||k==="pattern")&&rxBad(v)){
          const f=rxClean(v);
          if(!rxBad(f)){o[k]=f;n++}
        }
      } else walk(v);
    }
  })(j);
  if(n)console.log(`תוקנו ${n} תבניות בטוקנייזר`);
  if(!n&&!repaired)return txt;
  const out=JSON.stringify(j);
  // לא מחזירים משהו שלא נבדק — עדיף הקובץ המקורי מקובץ שבור
  try{JSON.parse(out)}catch(_){console.warn("התיקון יצא פגום, מחזירים מקור");return txt}
  return out;
}
// עותק שכבר יושב במטמון לא עובר דרך fetch, ולכן מתקנים אותו במקום
let jsonRes=body=>new Response(body,{status:200,statusText:"OK",
  headers:{"Content-Type":"application/json"}});
const TOK_URL=()=>`https://huggingface.co/${NER_MODEL}/resolve/main/tokenizer.json`;
let RAW_FETCH=null;
async function nerFixCached(){
  let n=0;
  try{
    if(!nerEnv().canCache)return 0;
    const c=await caches.open(NER_CACHE);
    for(const req of await c.keys()){
      if(!/tokenizer\.json/.test(req.url))continue;
      const res=await c.match(req); if(!res)continue;
      let txt; try{txt=await res.clone().text()}catch(_){await c.delete(req);continue}
      const fixed=fixTokJSON(txt);
      if(fixed===txt)continue;
      await c.put(req,jsonRes(fixed));
      // אימות: קוראים בחזרה ומוודאים שזה באמת JSON תקין
      let ok=false;
      try{const back=await c.match(req); JSON.parse(await back.text()); ok=true}catch(_){}
      if(ok)n++;
      else{await c.delete(req);console.warn("העותק השמור נמחק; יירד מחדש מתוקן")}
    }
  }catch(e){console.warn("תיקון המטמון נכשל",e)}
  return n;
}
let FETCH_HOOKED=false;
function nerHookFetch(){
  if(FETCH_HOOKED)return; FETCH_HOOKED=true;
  const orig=window.fetch.bind(window);
  RAW_FETCH=orig;
  window.fetch=async function(input,init){
    const res=await orig(input,init);
    try{
      const url=typeof input==="string"?input:(input&&input.url)||"";
      if(!/tokenizer\.json(\?|$)/.test(url)||!res.ok)return res;
      const txt=await res.clone().text();
      const fixed=fixTokJSON(txt);
      if(fixed===txt)return res;
      return jsonRes(fixed);
    }catch(e){console.warn("וו ה-fetch נכשל",e);return res}
  };
}
// שכבת גיבוי: אם בכל זאת נבנית תבנית שבורה, לא ליפול עליה
function nerFixRegExp(){
  if(window.__nerRx)return; window.__nerRx=1;
  const Orig=RegExp;
  const P=function(p,f){
    try{return new Orig(p,f)}
    catch(err){
      if(!(err instanceof SyntaxError)||typeof p!=="string")throw err;
      return new Orig(rxClean(p),f);
    }
  };
  P.prototype=Orig.prototype; Object.setPrototypeOf(P,Orig);
  window.RegExp=P; globalThis.RegExp=P;
}
// העטיפה של RegExp מותקנת כאן, בזמן הערכת המודול. המודול נטען ב-import דינמי
// מתוך componentDidMount, כלומר אחרי ש-#dc-root כבר מחובר. מי שקורא את RegExp
// הגלובלי לפני שה-import הסתיים רואה את המקורי, לא את העטוף.
// זה לא מזיק בפועל, ונבדק: סקריפט האתחול ב-index.html לא בונה אף תבנית,
// support.js בונה שתיים פשוטות לפירוק התבנית, ושלוש התבניות שנבנות כאן לפני
// השורה הזו (GF, GM, PLACE_RX) תקינות תחת הדגל u — אחרת המודול לא היה נטען.
// בדיקת הדפדפן ב-e2e/flow.spec.js ממתינה ל-window.__nerRx לפני שהיא שואלת.
nerFixRegExp();
export async function nerPrepTokenizer(report){
  const say=m=>{console.log("טוקנייזר: "+m); if(report)report(m)};
  const url=TOK_URL();
  const out={url,steps:[]};
  const step=(k,v)=>{out.steps.push(k+": "+v); say(k+": "+v)};
  if(!nerEnv().canCache){step("סביבה","אין מטמון — מדלגים");return out}
  const c=await caches.open(NER_CACHE);
  // כל עותק קיים חשוד; מוחקים ומתחילים נקי
  let dropped=0;
  for(const k of await c.keys())
    if(/tokenizer\.json/.test(k.url)){await c.delete(k);dropped++}
  step("עותקים ישנים שנמחקו",dropped);
  const f=RAW_FETCH||window.fetch.bind(window);
  const res=await f(url,{cache:"reload"});
  step("הורדה",res.status+" "+(res.ok?"תקין":"נכשל"));
  if(!res.ok)throw new Error("לא הצלחתי להוריד את קובץ הטוקנייזר ("+res.status+")");
  const txt=await res.text();
  step("אורך",txt.length+" תווים");
  // האם המקור בכלל תקין, ואם לא — איפה בדיוק
  try{JSON.parse(txt);step("המקור","JSON תקין")}
  catch(e){
    const m=/position (\d+)/.exec(e.message);
    const p=m?+m[1]:-1;
    step("המקור פגום",e.message.slice(0,60));
    if(p>=0)step("סביבת התקלה",JSON.stringify(txt.slice(Math.max(0,p-40),p+40)));
  }
  const fixed=fixTokJSON(txt);
  step("אחרי תיקון",fixed.length+" תווים"+(fixed===txt?" (ללא שינוי)":""));
  try{JSON.parse(fixed);step("התוצאה","JSON תקין")}
  catch(e){throw new Error("התיקון לא הצליח: "+e.message.slice(0,60))}
  await c.put(url,jsonRes(fixed));
  const back=await c.match(url);
  if(!back)throw new Error("הכתיבה למטמון נכשלה");
  const bt=await back.text();
  step("קריאה חוזרת",bt.length+" תווים");
  try{JSON.parse(bt);step("במטמון","JSON תקין ✓")}
  catch(e){
    await c.delete(url);
    throw new Error("מה שנשמר במטמון פגום: "+e.message.slice(0,60));
  }
  out.ok=true;
  return out;
}
let nerLoad=async function(){
  if(NERP)return NERP;
  if(nerEnv().local)throw new Error("מקובץ מקומי אי אפשר לטעון את המודל");
  NERSTATE="loading";
  NERP=(async()=>{
    // בלי זה הדפדפן רשאי למחוק את המודל כשהמקום נגמר, והוא יירד שוב
    await nerPersist();
    nerHookFetch();
    try{ await nerPrepTokenizer(); }
    catch(e){ console.warn('הכנת הטוקנייזר נכשלה',e); }
    const t=await import(/* webpackIgnore: true */ NER_LIB);
    t.env.allowLocalModels=false;
    t.env.useBrowserCache=true;
    const seen={};
    const pipe=await t.pipeline("token-classification",NER_MODEL,{
      dtype:"q8",
      progress_callback:p=>{
        if(p.status==="progress"&&p.file){
          seen[p.file]=p.progress||0;
          const v=Object.values(seen), avg=v.reduce((a,b)=>a+b,0)/v.length;
          nerSay(`מוריד את המודל, פעם אחת בלבד… ${Math.round(avg)}%`,avg);
        } else if(p.status==="ready")nerSay("המודל מוכן.",null);
      }});
    NERSTATE="ready";
    return pipe;
  })().catch(e=>{NERP=null;NERSTATE="error";throw e});
  return NERP;
};
/* transformers.js לא בהכרח מחזיר היסטי מיקום ולא בהכרח מאחד תת-מילים,
   בניגוד לגרסה בפייתון. אם נסמוך על זה נקבל אפס תוצאות בלי שום שגיאה —
   וזה בדיוק סוג הכשל השקט שהכלי הזה לא יכול להרשות לעצמו.
   לכן: אם יש היסטים משתמשים בהם, ואם אין מיישרים את הטוקנים לטקסט לבד. */
function nerAlign(text,toks,off){
  let pos=0;
  for(const t of toks){
    if(t.start!=null&&t.end!=null){t._s=off+t.start;t._e=off+t.end;continue}
    const w=String(t.word||t.token||t.text||"").replace(/^##/,"").trim();
    if(!w){t._s=null;continue}
    const i=text.indexOf(w,pos);
    if(i<0){t._s=null;continue}
    t._s=off+i; t._e=off+i+w.length; pos=i+w.length;
  }
}
function nerGroup(toks){
  const out=[]; let cur=null;
  for(const t of toks){
    if(t._s==null){cur=null;continue}
    // סימן פיסוק אינו חלק משם, גם כשהמודל מדביק לו תווית I-. "הילדה. מיקה"
    // ו"השופטת: הורוביץ" נולדו מכאן: הנקודה קיבלה I-PER והשרשרת נמשכה.
    if(!/[֐-׿w]/u.test(String(t.word||t.token||t.text||"").replace(/^##/,""))){cur=null;continue}
    const raw=String(t.entity_group||t.entity||"");
    const type=raw.replace(/^[BI]-/,"");
    if(!type||type==="O"){cur=null;continue}
    // תת-מילה ממשיכה את הישות; תווית B פותחת חדשה
    const cont=cur&&cur.type===type&&!/^B-/.test(raw)&&t._s<=cur.e+1;
    if(cont){cur.e=t._e;cur.score=Math.min(cur.score,+t.score)}
    else{cur={type,score:+t.score,s:t._s,e:t._e};out.push(cur)}
  }
  return out;
}
async function nerRun(blocks,onProgress){
  const pipe=await nerLoad();
  const text=blocks.map(b=>b.text).join("\n");
  const parts=nerChunks(text);
  const ents=[]; let raw=0,withOff=0;
  for(let i=0;i<parts.length;i++){
    const {t,off}=parts[i];
    let res;
    try{res=await pipe(t,{ignore_labels:[]})}
    catch(e){console.warn("קטע נכשל",e);continue}
    if(!Array.isArray(res))res=res?[res]:[];
    if(!raw&&res.length)console.log("מבנה חיזוי גולמי:",JSON.stringify(res[0]));
    raw+=res.length;
    withOff+=res.filter(r=>r.start!=null).length;
    nerAlign(t,res,off);
    for(const g of nerGroup(res))ents.push({type:g.type,score:g.score,s:g.s,e:g.e});
    if(onProgress&&(i%8===0||i===parts.length-1)){
      onProgress((i+1)/parts.length*100);
      await new Promise(r=>setTimeout(r,0));
    }
  }
  const out=nerClean(ents,text);
  const chars=parts.reduce((a,p)=>a+p.t.length,0);
  console.log(`זיהוי: ${parts.length} קטעים (${chars}/${text.length} תווים) · `+
    `${raw} חיזויים גולמיים · ${withOff} עם היסט מהצינור · `+
    `${ents.length} ישויות · ${out.length} אחרי סינון`);
  if(!raw)console.log("⚠ המודל לא החזיר שום חיזוי — בדקי את מבנה הפלט למעלה");
  else if(!ents.length)console.log("⚠ חיזויים התקבלו אך לא הצליחו להתיישר לטקסט");
  return out;
}

const TITLE_RX=/^(?:עו"ד|עוה"ד|עו״ד|ד"ר|ד״ר|דר'|פרופ'|פרופ׳|פרופסור|מר|גב'|גב׳|גברת|הגב'|הגברת|הרב|הרבנית|השופט|השופטת|כב'|כבוד|ח"כ|ח״כ|חבר הכנסת|חברת הכנסת|סא"ל|רס"ן|אל"מ|משפחת|בני הזוג|הזוג|הקטין|הקטינה|המנוח|המנוחה|התובע|התובעת|הנתבע|הנתבעת|המבקש|המבקשת|המשיב|המשיבה|העד|העדה)\s+/u;
const ORG_RX=/^(?:עמותת|עמותה|מכון|חברת|חברה|בית ספר|בי"ס|ביה"ס|בית הספר|מרכז|אגודת|אגודה|קרן|מוסד|גן|מעון|פנימיית|פנימייה|ישיבת|ישיבה|קופת חולים|בנק|עיריית|מועצה|מועצת|משרד|לשכת|מרפאת|מרפאה|בית חולים|ביה"ח|מכללת|אוניברסיטת|תיכון|חטיבת)\b|\bבע"מ$/u;
// "פנים מאירות" בלי "עמותת" לפניו: שתי מילים ברבים, אף אחת אינה שם —
// זה גוף, לא אדם. שם בדוי של אדם במקום עמותה היה מבלבל את ה-AI.
function likelyOrg(v){
  const w=norm(v).split(/\s+/); if(w.length<2)return false;
  const isName=x=>FEM.has(x)||MASC.has(x)||POOL.he_s.includes(x)||AR_NAMES.has(x)||
    POOL.ar_s.includes(x)||/^(?:בן|בת|אבו|אל)-?/.test(x);
  if(w.some(isName))return false;
  return w.some(x=>/(?:ות|ים)$/.test(x)&&x.length>=4)||w.every(x=>COMMON.has(x));
}
function cleanEntry(raw){
  let v=trimEdges(raw).replace(/\s*\([^)]*\)\s*$/,"").trim(), note="";
  let m;while((m=TITLE_RX.exec(v))){v=v.slice(m[0].length).trim();note=`בלי «${m[0].trim()}»`}
  let kind="NAME";
  if(ORG_RX.test(v))kind="ORG";
  else if(likelyOrg(v)){kind="ORG";note="נראה כגוף — לחצי על הסמל אם זה אדם"}
  return {v:trimEdges(v),note,kind};
}

function pseudoRX(p){
  const pat=[...p].map(c=>/['\u05f3\u2019]/.test(c)?"['\u05f3\u2019]"
    :/["\u05f4\u201d]/.test(c)?'["\u05f4\u201d]'
    :/[-\u05be\u2013\s]/.test(c)?"[-\\u05be\\u2013\\s]+":esc(c)).join("");
  return new RegExp("(?<![\\u0590-\\u05ff])([בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+pat+
    "(?![\\u0590-\\u05ff])","gu");
}
// זוגות [שם אמיתי, כינוי]. מחזיר טקסט, כמה הוחזרו, ומה לא נמצא —
// כינוי שלא נמצא הוא לא בהכרח תקלה, אבל כדאי לדעת עליו.
function restoreNames(txt,pairs){
  const seen=new Map(), conflict=new Set();
  for(const [real,pseudo] of pairs){
    if(!real||!pseudo||pseudo==="███")continue;
    if(seen.has(pseudo)&&seen.get(pseudo)!==real)conflict.add(pseudo);
    else seen.set(pseudo,real);
  }
  for(const k of conflict)seen.delete(k);
  // התאמות חלקיות: "מיכל ברנע" → ה-AI כותב "ברנע". רק כשחלק השם ייחודי.
  const partial=new Map(), bad=new Set();
  for(const [pseudo,real] of seen){
    const pw=pseudo.split(/\s+/), rw=real.split(/\s+/);
    if(pw.length!==2||rw.length!==2)continue;
    for(const i of [0,1]){
      const k=pw[i];
      if(seen.has(k)||k.length<4||WORDLIKE.has(k)){bad.add(k);continue}
      if(partial.has(k)&&partial.get(k)!==rw[i])bad.add(k);
      else partial.set(k,rw[i]);
    }
  }
  for(const k of bad)partial.delete(k);
  const order=[...seen.entries()].sort((a,b)=>b[0].length-a[0].length)
    .concat([...partial.entries()].sort((a,b)=>b[0].length-a[0].length));
  let out=txt,n=0;const missing=[];
  for(const [pseudo,real] of order){
    let hit=0;
    out=out.replace(pseudoRX(pseudo),(m,pre)=>{hit++;return (pre||"")+real});
    if(hit)n+=hit; else if(seen.has(pseudo))missing.push(pseudo);
  }
  return {text:out,count:n,missing,conflict:[...conflict]};
}


export {crc32, unzip, zip, parseXML, serXML, TEXTPART, TXT, ENC, norm, esc, flex, H, A,
  variants, validID, ibanOK, luhn, hord, POOL, WORDLIKE, FEM, MASC, fakeName, near1, HOMO, WEAK,
  findNear, nameish, bodyNames, nerChunks, nerClean, PAT, WHYP, KINDS, KINDLBL, CANON, ckey,
  resolve, Engine, flatten, acceptTracked, stripComments, redactDocx, partName, ctxHTML, verify,
  discover, PLACES, PLACE_BY, geoMap, nerEnv, nerCached, nerPersist, nerLoad, nerRun,
  TITLE_RX, ORG_RX, likelyOrg, cleanEntry, trimEdges, pseudoRX, restoreNames, STOP};
