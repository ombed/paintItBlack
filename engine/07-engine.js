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
      // ספרת ביקורת שאינה מתאימה אינה ראיה שזה איננו מזהה — היא ראיה שהוא הוקלד
      // לא נכון, או שהוא לא ישראלי. עד כאן מספר כזה נעלם לגמרי: לא הוחלף, לא סומן,
      // לא הופיע ברשימה, ולכן הגיע ל-AI כמו שהוא בלי שום סימן. תשע ספרות שנראות
      // כמו ת"ז הן החשד הכי מובהק שיש, ולכן הן עולות לבדיקה במקום להימחק.
      const bad=!!(p.v&&!p.v(m[0]));
      const g=p.g, s=g? m.index+m[0].indexOf(m[g]) : m.index, e=s+(g?m[g].length:m[0].length);
      if(g&&!m[g])continue; if(e<=s)continue;
      hits.push({s,e,type:p.n,label:p.l,text:text.slice(s,e),apply:bad?false:on.has(p.n),
        why:(WHYP[p.n]||"התאמה לדפוס מוכר")+(bad?" — אבל ספרת הביקורת אינה מתאימה. ייתכן שיבוש הקלדה, ולכן זה עולה לבדיקה":""),
        src:"pattern",prio:p.p,review:bad||undefined,
        conf:bad?"medium":(p.on?"high":"medium")});
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

// אזורי גיל: מספר קטן אחרי בן/בת/גיל או לפני שנה/שנים. בתוך אזור כזה שום דפוס
// מספרי אינו נתפס, גם כשמספרים מושמטים כברירת מחדל. הבטחה שניתנה בכתב ללקוחה.
function ageZones(n){
  const z=[]; let m;
  const a=/(?<![א-ת])(?:בן|בת|בני|בנות|גיל|בגיל|כבן|כבת)\s+(\d{1,3})(?![\d])/gu;
  while((m=a.exec(n))){const s=m.index+m[0].lastIndexOf(m[1]);z.push([s,s+m[1].length])}
  const b=/(?<![\d])(\d{1,3})\s+(?:שנה|שנים|שנתיים|וחצי)(?![א-ת])/gu;
  while((m=b.exec(n)))z.push([m.index,m.index+m[1].length]);
  return z}
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
    // מה המסמך אומר על מילה בודדת: אחרי "הקטין", "האם", "מר", "התובעת:" היא שם
    // פרטי, והמילה שלפניה מסגירה גם מגדר. זה מכריע שם פרטי מול שם משפחה בשם
    // בדוי, ותוקן כאן אחרי שמסמך אמיתי החליף "גדעון" בשם משפחה ו"נריה" בשם אישה.
    this.firstish=new Set();
    if(docText){
      const FCTX=/(?<![\u0590-\u05ff])(הקטינה|הילדה|הבת|האחות|האם|הסבתא|הדודה|גב'|הגב'|גברת|התובעת|הנתבעת|המבקשת|המשיבה|המנוחה|הפעוטה|התינוקת|הנערה|הקטין|הילד|הבן|האח|האב|הסבא|הדוד|מר|התובע|הנתבע|המבקש|המשיב|המנוח|הפעוט|התינוק|הנער)\s*:?\s+([\u05d0-\u05ea][\u05d0-\u05ea'"\u05f3\u05f4-]{1,14})(?![\u0590-\u05ff])/gu;
      const FEMCTX=new Set(["הקטינה","הילדה","הבת","האחות","האם","הסבתא","הדודה","גב'","הגב'","גברת","התובעת","הנתבעת","המבקשת","המשיבה","המנוחה","הפעוטה","התינוקת","הנערה"]);
      const nt=norm(docText); let m;
      while((m=FCTX.exec(nt))){ const w=m[2]; if(STOP.has(w)||COMMON.has(w)||VRB.has(w))continue; this.firstish.add(w);
        for(const s of subs) if(s.kind==="NAME"&&!this.gmap[s.value]&&norm(s.value).trim()===w) this.gmap[s.value]=FEMCTX.has(m[1])?"f":"m"; }
    }
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
      // שם קצר בן מילה אחת ("רון", "גל") — הצורות עם אות שימוש דומות מדי למילים
      // אחרות, אז הן דורשות אישור. אבל רק כשהשם באמת גם מילה: על כתב עמדה אמיתי
      // שכולו על קטינה בשם בן שלוש אותיות, "ליעל" ו"שיעל" סומנו לבדיקה עשר פעמים
      // במקום להיות מוחלפים, והשם נשאר בטקסט עד שהיא מטפלת בכל אחד מהם.
      const nv=norm(s.value).trim();
      const shortSingle = s.kind==="NAME" && nv.split(/\s+/).length===1 && nv.length<=3 &&
        (WORDLIKE.has(nv)||COMMON.has(nv)||this.forbidden.has("ה"+nv));
      for(const [v,pre] of variants(s.value,lvl,protect)){
        if(seen.has(v))continue; seen.add(v);
        this.rules.push({rx:new RegExp(NW+flex(v)+NWE,"gu"),base:s.value,
          kind:s.kind,rep:s.replacement,style:s.style||null,pre,auto:s.auto,soft:!!pre&&shortSingle});
      }
      // "עמותת שביל הלב" אושרה: גם "שביל הלב" לבדו הוא אותו גוף, כמו שם משפחה
      // לבדו אצל אדם. אחרת המופע הראשון מוחלף והשני נשאר בטקסט.
      if(s.kind==="ORG"){
        const hm=/^(עמותת|עמותה|מעון|מרפאת|מכון|קרן|מרכז|אגודת|חברת|בית ספר|בי"ס|ביה"ס|גן ילדים|פנימיית|ישיבת)\s+(.+)$/u.exec(s.value.trim());
        const rest=hm&&hm[2].trim();
        if(rest&&(rest.split(/\s+/).length>=2||rest.length>=5)&&!protect.has(rest))
          for(const [v,pre] of variants(rest,lvl,protect)){
            if(seen.has(v))continue; seen.add(v);
            this.rules.push({rx:new RegExp(NW+flex(v)+NWE,"gu"),base:s.value,kind:s.kind,rep:s.replacement,style:s.style||null,pre,auto:s.auto,soft:false});
          }
      }
    }
    this.rules.sort((a,b)=>b.rx.source.length-a.rx.source.length);
    // הרשימה הלבנה חייבת לתפוס גם צורות עם אות שימוש ("בתל אביב"),
    // אחרת "אל תחליף" נכשל בשקט על כל מילה עם ב/ל/מ/ה לפניה.
    this.allow=(allow||[]).map(a=>new RegExp(
      "(?<![\\u0590-\\u05ff])(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+
      flex(a)+NWE,"gu"));
    // הצורה המנורמלת של כל ערך מותר, באותו סדר, בשביל השער שב-detect
    this.allowN=(allow||[]).map(a=>norm(a).trim());
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
    const AGE=ageZones(n);
    // רשימת ההיתר תופסת גם צורות עם אות שימוש, ו-ש היא אות שימוש: "אל תחליף" על
    // "רון" היה חוסם גם את "שרון", שני אנשים. אם המילה המלאה עם האות היא בעצמה
    // ערך ברשימה, זה אינו "ש+רון" אלא "שרון", והאזור לא נפתח.
    const listed=this._listed||(this._listed=new Set(this.subs.map(s=>norm(s.value).trim()).filter(Boolean)));
    this.allow.forEach((rx,i)=>{rx.lastIndex=0;let m;
      const own=(this.allowN||[])[i]||"";
      while((m=rx.exec(n))){
        const tok=m[0].trim();
        // רק כשההרחבה נחתה על ערך אחר ברשימה; "שרון" שהותרה בעצמה נשארת מותרת
        if(tok!==own&&listed.has(tok))continue;
        zones.push([m.index,m.index+m[0].length])}});
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
          style:r.style||null,
          why:r.auto?"התגלה אוטומטית מההקשר":(r.pre?`מהרשימה שהגדרת, עם אות השימוש "${r.pre}" שנשמרה`:"מהרשימה שהגדרת"),
          review:!!r.pre,conf:"high"});
      }}
    for(const h of findPatterns(text,this.opt.on,this.opt.flag)){
      if(this.blocked(h.s,h.e,zones))continue;
      // גיל אינו מזהה, וההבטחה הייתה "הכול חוץ מגילאים": "בת 9", "בן 12", "גיל 7",
      // "3 שנים" — מספר בהקשר של גיל נשאר גם כשמספרים מושמטים. צר ומבוסס הקשר בלבד.
      if(this.blocked(h.s,h.e,AGE))continue;
      h.review=h.conf!=="high"; h.base=h.text; hits.push(h);
    }
    return resolve(hits)}
  /* מה נכנס במקום ערך: name (שם או יישוב בדוי), label (פלוני א׳ / [ת"ז א׳]),
     black (███), או blank — הערך נמחק נקי מהטקסט.

     עד כאן הבחירה הייתה גלובלית, ומספר מזהה תמיד קיבל תווית. היא ביקשה שמספרים
     ותאריכים פשוט ייעלמו, ושאדם מסוים ("אליעזר המתמלל") ייעלם גם הוא. הסדר:
     סגנון שנקבע על הכלל עצמו, ואם אין — ברירת המחדל לפי סוג מתוך האפשרויות
     (opt.styles, עם "*" לכל מה שאינו שם, גוף או מקום), ואם אין — המצב הגלובלי. */
  styleFor(h){
    if(h.style) return h.style;
    const fam=(CANON[h.type]||[h.type])[0];
    const st=this.opt.styles||{};
    const d=st[fam]||((fam==="NAME"||fam==="ORG"||fam==="PLACE")?null:st["*"]);
    if(d) return d;
    return this.opt.mode==="block"?"black":this.opt.mode==="label"?"label":"name";
  }
  repFor(h){
    const pre=h.pre||"";
    const style=this.styleFor(h);
    // מחיקה: גם אות השימוש הולכת, ומי שמדביק את הטקסט למקומו (applyReps) סוגר את הרווח
    if(style==="blank") return "";
    if(style==="black") return addPre(pre,"███");
    // המפתח לפי הערך הבסיסי, לא לפי הטקסט שנתפס — אחרת
    // "מאורי בן-שחר" מקבל כינוי אחר מ"אורי בן-שחר".
    const canonical=(h.base&&this.alias[h.base])||h.base||h.text;
    const k=ckey(h.type==="NAME_ANCHORED"?"NAME":h.type,canonical);
    let base=h.rep||this.map[k];
    if(!base){
      const [fam,lab]=CANON[h.type]||[h.type,h.label];
      const n=(this.cnt[fam]||0)+1;this.cnt[fam]=n;
      const real=style==="name";
      if(fam==="NAME"&&real)
        base=fakeName(canonical,this.gmap[canonical]||h.g,this.used,this.forbidden,this.firstish);
      // יישוב מקבל שם יישוב אמיתי, כמו ששם מקבל שם. מסך היישובים קודם כשהוא
      // מציע משהו, כי הוא שומר על המרחקים; זה מה שקורה לכל השאר, כולל מה שנגזר
      // ממילת יישוב ("מושב X", "שכונת Y"). מוסד רפואי, עסק או מוסד חינוך נשאר
      // תווית: שם יישוב במקומו היה משקר על סוג המקום.
      else if(real&&typeof fakePlace==="function"&&
              (h.type==="PLACE_CITY"||(h.type==="PLACE_VENUE"&&h.label==="יישוב")))
        base=fakePlace(canonical,this.used,this.forbidden)||`[${lab} ${hord(n)}]`;
      else base = fam==="NAME" ? "פלוני "+hord(n) : `[${lab} ${hord(n)}]`;
    }
    this.map[k]??=base;
    return addPre(pre,base)}
}

