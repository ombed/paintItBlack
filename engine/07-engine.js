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
        base=fakeName(canonical,this.gmap[canonical]||h.g,this.used,this.forbidden,this.firstish);
      else base = fam==="NAME" ? "פלוני "+hord(n) : `[${lab} ${hord(n)}]`;
    }
    this.map[k]??=base;
    return addPre(pre,base)}
}

