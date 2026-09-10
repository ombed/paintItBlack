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
/* למה שני שמות ברשימה עשויים להיות אותו אדם (Q12). האותות, כל אחד בשמו:
   כתיב מלא מול חסר או אות דומה במילה אחת ("שלוה"/"שלווה"), מקף מול רווח או
   סדר מילים שונה, שם פרטי לבדו מול השם המלא, שם משפחה לבדו מול השם המלא,
   וחלק מהשם המשולש. מחזיר רשימת סיבות; ריקה כשאין. ההצעה מוצגת, ולעולם
   אינה מתקבלת מעצמה: מיזוג הוא הקשה שלה על הכרטיס. */
function mergeSignals(a,b){
  const A=norm(String(a||"")).trim(), B=norm(String(b||"")).trim();
  if(!A||!B||A===B)return [];
  const aw=A.split(/[\s\-־–]+/).filter(Boolean), bw=B.split(/[\s\-־–]+/).filter(Boolean);
  const out=[];
  const sameW=(x,y)=>{if(x===y)return true;const r=near1(x,y);return !!r&&(r.k==="sub"?HOMO.has(r.p):WEAK.has(r.p))};
  if(aw.length===bw.length&&aw.length>=1){
    if(aw.every((w,k)=>w===bw[k])){ if(A!==B)out.push("מקף מול רווח"); }
    else if(aw.every((w,k)=>sameW(w,bw[k]))&&aw.some((w,k)=>w!==bw[k])&&aw.join("").length>=4)out.push("כתיב מלא מול חסר");
    else if(aw.length>=2&&[...aw].sort().join(" ")===[...bw].sort().join(" "))out.push("אותן מילים בסדר אחר");
  }
  const [s,l]=aw.length<bw.length?[aw,bw]:[bw,aw];
  if(s.length<l.length&&s.every(w=>w.length>=3)){
    if(s.length===1&&l[0]===s[0])out.push("שם פרטי לבדו");
    else if(s.length===1&&l[l.length-1]===s[0])out.push("שם משפחה לבדו");
    else if(s.every(w=>l.includes(w)))out.push("חלק מהשם המלא");
  }
  return out;
}
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

