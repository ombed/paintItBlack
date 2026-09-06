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
  // "רחוב הארזים 12" הוחלף, ו"ההסעות מהארזים" נשאר בטקסט: שם הרחוב לבדו הוא
  // אותו מקום. כל כתובת, רחוב או שכונה שהוחלפו תורמים את המילים שאחרי סוג
  // הרחוב, ובלי המספר; כשהשם הוא גם מילה, רק כשעומד לבד ולבדיקה. חמש
  // מ-16 הדליפות בקורפוס היו בדיוק זה.
  const STREET_HEAD=/^(?:רחוב|רח'|שדרות|שד'|סמטת|סמטה|דרך|שכונת|כיכר|ככר|מעלה|נחל|משעול)\s+(.+?)(?:\s+\d.*)?$/u;
  for(const r of applied){
    const rp=r.baseRep||r.rep; if(!rp||rp==="███")continue;
    // הערך שנתפס עשוי לשאת אות שימוש ("ברחוב הגפן"); הבסיס של הכלל נקי ממנה
    const src=norm(r.base||r.value).trim();
    const m=STREET_HEAD.exec(src)||STREET_HEAD.exec(src.replace(/^[בהולמכש]/,"")); if(!m)continue;
    const nm=m[1].trim();
    if(nm.length<3||(nm in sweep)||STOP.has(nm)||PLACE_BY[nm]||norm(rp).includes(nm))continue;
    sweep[nm]={rep:rp,of:r.value,wordy:wordy(nm),place:true};
  }
  const regPart=(value,rp,label)=>{
    if(!rp||rp==="███")return;
    if(label&&!label.startsWith("שם"))return;
    const vw=norm(value).trim().split(/\s+/), rw=norm(rp).trim().split(/\s+/);
    if(vw.length<2)return;
    const real=opt.mode==="real";
    const add=(p,to)=>{
      // שתי אותיות ("כץ", "נץ") הן שם משפחה של ממש; הן נכנסות למעבר, ובגלל wordy
      // מוחלפות רק כשעומדות לבד ולבדיקה. הסריקה: 2 כמו 3, 4 מוסיף שש דליפות.
      if(!p||p.length<2||STOP.has(p)||PLACE_BY[p]||AMBIG.has(p))return;
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
          label:inf.of?(inf.place?"מקום (חלק)":"שם (חלק)"):"אחידות",part:partName(blk.part),
          why:inf.of?(inf.place
                ?(inf.wordy?`שם הרחוב מתוך «${inf.of}» — אבל גם מילה. הוחלף רק כשעומד לבד; ודאי שזה המקום`
                           :`שם הרחוב מתוך «${inf.of}» שכבר הוחלף, ומופיע כאן לבד`)
                :inf.wordy
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
  // גם ממצא שסומן לבדיקה הוא הופעה: שם קצר שמופיע רק עם אות שימוש ("והדס") מסומן
  // ולא מוחלף, וקודם דווח במקביל גם כ"לא מופיע במסמך הזה בכלל" — שתי אמירות סותרות
  // על אותו שם.
  const hitBases=new Set(applied.map(r=>norm(r.base||r.value).trim()));
  for(const r of flagged) if(r.src==="list"&&r.base) hitBases.add(norm(r.base).trim());
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
  // התמלולים שלה מסמנים דובר בשורה משל עצמה, בלי נקודתיים: פסקה שכולה שם ואחריה
  // פסקאות הדיבור. עוגן הדוברים דורש נקודתיים, ולכן על שני תמלולים אמיתיים
  // discover החזיר אפס מועמדים. פסקה קצרה בלי פיסוק בסוף, שאחריה פסקה של ממש, היא דובר.
  const extra=[];
  for(let bi=0;bi<blocks.length;bi++){
    const t=trimEdges(blocks[bi].text||""), w=t.split(/s+/).filter(Boolean);
    const nxt=blocks[bi+1]&&trimEdges(blocks[bi+1].text||"");
    if(!t||w.length>3||t.length>25||/[.,?!:;]$/.test(t))continue;
    if(!nxt||nxt.split(/s+/).length<4)continue;
    const c=cleanName(t); if(!c||!anchorOK(c))continue;
    if(!c.split(/s+/).every(x=>x.length>=2))continue;
    const s0=blocks[bi].text.indexOf(c); if(s0<0)continue;
    extra.push({b:blocks[bi],h:{text:c,s:s0,e:s0+c.length,why:"פסקה שכולה שם, ואחריה דיבור",anchor:"speakerline",g:null,role:null}});
  }
  for(const {b,h} of extra){
    const r=found[h.text]||(found[h.text]={count:0,why:new Set(),conf:"medium",ctx:"",role:null,g:null,gf:0,gm:0});
    r.count++;r.why.add(h.why);r.spk=(r.spk||0)+1; if(r.spk>=2)r.conf="high";
    if(!r.ctx)r.ctx=ctxHTML(b.text,h.s,h.e);
  }
  for(const b of blocks) for(const h of anchored(b.text)){
    const r=found[h.text]||(found[h.text]={count:0,why:new Set(),conf:"medium",ctx:"",role:null,g:null,gf:0,gm:0});
    r.count++;r.why.add(h.why);
    if(h.role&&!r.role)r.role=h.role;
    if(h.g==="f")r.gf++; if(h.g==="m")r.gm++;
    if(h.anchor==="bid"||h.anchor==="role")r.conf="high";
    // דובר שחוזר, או דובר בשם מלא, הוא אדם בוודאות. דובר יחיד במילה אחת נשאר
    // הצעה: "שאלה:" או "הערה:" נראים אותו דבר עד שחוזרים.
    // דובר הוא מי שחוזר: "מועד אחרון לתגובה:" הוא תווית של טופס, גם כשיש בה שתי מילים.
    // שתי מילים בפעם אחת היו "גבוה" ומולאו אוטומטית; עכשיו רק חזרה מעלה את הביטחון.
    if(h.anchor==="speaker"){r.spk=(r.spk||0)+1; if(r.spk>=2)r.conf="high";}
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
  // עותק שמור שנקרא כ-JSON תקין משמש כמו שהוא: 2.9MB פחות בכל ביקור, והשניות
  // הראשונות של כל סשן בקו איטי. רק עותק פגום נמחק ומוריד מחדש.
  const prior=await c.match(url);
  if(prior){
    try{ const pt=await prior.text(); JSON.parse(pt); step("במטמון","עותק תקין — בלי הורדה"); out.ok=true; out.cached=true; return out; }
    catch(_){ step("במטמון","עותק פגום — מוריד מחדש"); }
  }
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
          // לפי בייטים, לא ממוצע של קבצים: הקבצים הקטנים נגמרים מיד וממוצע
          // כזה קפץ ל-76% ואז זחל דרך קובץ המשקולות היחיד (130MB)
          seen[p.file]={loaded:p.loaded||0,total:p.total||0,pct:p.progress||0};
          const v=Object.values(seen), tot=v.reduce((a,b)=>a+b.total,0);
          const pct=tot?100*v.reduce((a,b)=>a+b.loaded,0)/tot:v.reduce((a,b)=>a+b.pct,0)/v.length;
          const mb=x=>(x/1048576).toFixed(0);
          nerSay(tot?`מוריד את המודל, פעם אחת בלבד: ${mb(v.reduce((a,b)=>a+b.loaded,0))} מתוך ${mb(tot)} MB`:`מוריד את המודל, פעם אחת בלבד… ${Math.round(pct)}%`,pct);
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
    const wtxt=String(t.word||t.token||t.text||"").replace(/^##/,"");
    // מקף צמוד בתוך שם ("בן-רביב", "אבו-סרחאן") שייך לשם; הקבוצה נמשכת
    // מעבר לו, ומקף שנשאר בסוף נחתך ב-trimEdges.
    if(/^[-־–]$/.test(wtxt)&&cur&&t._s<=cur.e){cur.e=t._e;continue}
    if(!/[֐-׿\w]/u.test(wtxt)){cur=null;continue}
    const raw=String(t.entity_group||t.entity||"");
    const type=raw.replace(/^[BI]-/,"");
    // המודל מתייג רק את תת-המילה הראשונה של כל מילה, וההמשכים ("##אן", "##טה")
    // חוזרים כ-O. תת-מילה שממשיכה את המילה של הישות הנוכחית שייכת לה בכל
    // מקרה: בלי זה "דסטה טספאיי" נשבר ל"דס" ול"טס", ההרחבה לגבול המילה מחזירה
    // שתי מילים נפרדות, והשם המלא לא מגיע לרשימה. זה היה הכשל השכיח ביותר
    // בגבולות המקטעים (94 מ-329 מופעים בקורפוס), לא פיסוק ולא קצה קטע.
    const sub=/^##/.test(String(t.word||t.token||t.text||""));
    if(sub&&cur&&t._s<=cur.e){cur.e=Math.max(cur.e,t._e);continue}
    if(!type||type==="O"){cur=null;continue}
    // תת-מילה ממשיכה את הישות; תווית B פותחת חדשה
    const cont=cur&&cur.type===type&&!/^B-/.test(raw)&&t._s<=cur.e+1;
    if(cont){cur.e=t._e;cur.score=Math.min(cur.score,+t.score)}
    else{cur={type,score:+t.score,s:t._s,e:t._e};out.push(cur)}
  }
  return out;
}
// הפלט הגולמי של הריצה האחרונה, לדוח הדליפה: מה המודל חשב על מקטע שפוספס
let NER_LAST=[];
function nerLast(){return NER_LAST}
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
  NER_LAST=ents.map(e=>({type:e.type,score:e.score,s:e.s,e:e.e}));
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


export {nerLast, crc32, unzip, zip, parseXML, serXML, TEXTPART, TXT, ENC, norm, esc, flex, H, A,
  variants, validID, ibanOK, luhn, hord, POOL, WORDLIKE, FEM, MASC, fakeName, near1, HOMO, WEAK,
  findNear, nameish, bodyNames, nerChunks, nerClean, PAT, WHYP, KINDS, KINDLBL, CANON, ckey,
  resolve, Engine, flatten, acceptTracked, stripComments, redactDocx, partName, ctxHTML, verify,
  discover, PLACES, PLACE_BY, geoMap, nerEnv, nerCached, nerPersist, nerLoad, nerRun,
  TITLE_RX, ORG_RX, likelyOrg, cleanEntry, trimEdges, pseudoRX, restoreNames, STOP};
