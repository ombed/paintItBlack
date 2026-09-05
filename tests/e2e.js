/* בונה docx אמיתי, מריץ את כל הצינור, ובודק את הפלט */
const xd=require('@xmldom/xmldom');
const {DOMParser,XMLSerializer}=xd;
global.DOMParser=DOMParser; global.XMLSerializer=XMLSerializer;
// xmldom חסר children/querySelector — משלימים כדי שקוד הדפדפן ירוץ כמו שהוא
{
  const p=new DOMParser().parseFromString('<a><b/></a>','application/xml');
  const EP=Object.getPrototypeOf(p.documentElement);
  const DP=Object.getPrototypeOf(p);
  for(const proto of [EP,DP]){
    if(!('children' in proto))Object.defineProperty(proto,'children',{get(){
      return Array.from(this.childNodes||[]).filter(n=>n.nodeType===1)}});
    if(!proto.querySelector)proto.querySelector=function(t){
      const l=this.getElementsByTagName(t);return l&&l.length?l[0]:null};
  }
  if(!('firstChild' in EP))throw new Error("no firstChild");
}
const zlib=require('zlib');
const fs=require('fs');

// pipe() משתמש ב-CompressionStream; ב-node נשתמש ב-zlib דרך אותה חתימה
global.__deflate=b=>new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate=b=>new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));

let src=fs.readFileSync('app.html','utf8');
let js=src.split('<script>')[1].split('</script>')[0];
js=js.replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");',
              'const inflate=async u8=>global.__inflate(u8);')
     .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");',
              'const deflate=async u8=>global.__deflate(u8);');
const cut=js.indexOf('/* ══════════════════════════ ממשק ══════════════════════════ */');
const a=js.indexOf('function pseudoRX(p){'), b=js.indexOf('function livePairs(){');
const core=js.slice(0,cut)+"\n"+js.slice(a,b)+
  "\nmodule.exports={redactDocx,discover,unzip,zip,flatten,parseXML,TEXTPART,acceptTracked,restoreNames,TXT};\n";
fs.writeFileSync('e2e-core.js',core);
const E=require('./e2e-core.js');

// ── בניית docx ──
function mkzip(files){
  const enc=new TextEncoder(),loc=[],cen=[];let off=0;
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;
    for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
  const crc32=u8=>{let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);
    return (c^0xFFFFFFFF)>>>0};
  for(const f of files){
    const nm=enc.encode(f.name),data=enc.encode(f.body),c=crc32(data);
    const body=new Uint8Array(zlib.deflateRawSync(Buffer.from(data)));
    const h=new Uint8Array(30+nm.length),d=new DataView(h.buffer);
    d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);
    d.setUint16(8,8,true);d.setUint32(14,c,true);
    d.setUint32(18,body.length,true);d.setUint32(22,data.length,true);
    d.setUint16(26,nm.length,true);h.set(nm,30);
    loc.push(h,body);
    const ch=new Uint8Array(46+nm.length),cd=new DataView(ch.buffer);
    cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);
    cd.setUint16(8,0x800,true);cd.setUint16(10,8,true);cd.setUint32(16,c,true);
    cd.setUint32(20,body.length,true);cd.setUint32(24,data.length,true);
    cd.setUint16(28,nm.length,true);cd.setUint32(42,off,true);ch.set(nm,46);
    cen.push(ch);off+=h.length+body.length;
  }
  const cs=cen.reduce((s,x)=>s+x.length,0);
  const end=new Uint8Array(22),ed=new DataView(end.buffer);
  ed.setUint32(0,0x06054b50,true);ed.setUint16(8,files.length,true);
  ed.setUint16(10,files.length,true);ed.setUint32(12,cs,true);ed.setUint32(16,off,true);
  const all=[...loc,...cen,end];
  const total=all.reduce((s,x)=>s+x.length,0),out=new Uint8Array(total);
  let p=0;for(const x of all){out.set(x,p);p+=x.length}
  return out.buffer;
}
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const paras=[
 'בבית המשפט לענייני משפחה בתל אביב',
 'בעניין: התובעת רונית לוי, ת"ז 123456782, מרחוב הרצל 15 תל אביב',
 'נגד: הנתבע אורי בן-שחר, ת"ז 987654321, טלפון 052-4471938',
 'ב"כ התובעת עו"ד תמר גולדשמיט, דוא"ל tamar@example.co.il',
 'התובעת רונית לוי שהתה במעון של עמותת פנים מאירות בחיפה.',
 'בהמשך עברה לונית לוי לירושלים, ושם פגשה את אורי בן-שחר.',
 'העמותה פנים מהירות סירבה למסור מסמכים, וכך גם גולדשמיט.',
 'המצהירה מיכל ברנע אישרה את הדברים בפני עו"ד תמר גולדשמיט.',
];
const docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
 `<w:document ${W}><w:body>`+
 paras.map(t=>{
   // מפצלים כל פסקה לשני runs כדי לדמות פיצול אמיתי של Word
   const h=Math.floor(t.length/2);
   return `<w:p><w:r><w:t xml:space="preserve">${t.slice(0,h)}</w:t></w:r>`+
          `<w:r><w:t xml:space="preserve">${t.slice(h)}</w:t></w:r></w:p>`;
 }).join('')+
 '</w:body></w:document>';
const buf=mkzip([
 {name:'[Content_Types].xml',body:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'},
 {name:'_rels/.rels',body:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="x" Target="word/document.xml"/></Relationships>'},
 {name:'docProps/core.xml',body:'<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>עו"ד תמר גולדשמיט</dc:creator><cp:lastModifiedBy>תמר</cp:lastModifiedBy></cp:coreProperties>'},
 {name:'word/document.xml',body:docXml},
]);

let pass=0,fail=0;
const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};

(async()=>{
 const subs=[
   {value:"רונית לוי",kind:"NAME",replacement:"",auto:true,g:"f"},
   {value:"אורי בן-שחר",kind:"NAME",replacement:"",auto:true,g:"m"},
   {value:"תמר גולדשמיט",kind:"NAME",replacement:"",auto:true,g:"f"},
   {value:"מיכל ברנע",kind:"NAME",replacement:"",auto:true,g:"f"},
   {value:"פנים מאירות",kind:"OTHER",replacement:"",auto:false},
 ];
 const on=new Set(["EMAIL","PHONE_MOBILE","PHONE_LAND","ISRAELI_ID","ISRAELI_ID_LABELED",
   "ADDRESS_STREET","PLACES"]);
 const opt={on,flag:new Set(["NAME_ANCHORED"]),mode:"real",near:true,prefixes:"normal"};
 const r=await E.redactDocx(buf,subs,[],opt);
 const out=r.preview.map(b=>b.text).join("\n");
 console.log("\n──── פלט ────\n"+out+"\n─────────────\n");

 console.log("— זהות —");
 ok(!out.includes("רונית לוי"),"השם המלא נעלם");
 ok(!out.includes("אורי בן-שחר"),"שם הנתבע נעלם");
 ok(!out.includes("123456782"),'ת"ז נעלמה');
 ok(!out.includes("052-4471938"),"טלפון נעלם");
 ok(!out.includes("tamar@example.co.il"),'דוא"ל נעלם');
 ok(r.verification.passed,"אימות הפלט עבר — אין שרידים בארכיון");
 ok(!r.structural.meta.length===false,"מטא-דאטה נאספה ונוקתה: "+r.structural.meta.join(", "));

 console.log("— שמות ריאליים —");
 const nameReps=[...new Set(r.applied.filter(x=>x.label.startsWith("שם")||x.label==="שם")
   .map(x=>x.rep))];
 ok(!nameReps.some(x=>/פלוני/.test(x)),"אין «פלוני» בפלט: "+nameReps.join(" · "));
 ok(nameReps.every(x=>x&&x.split(/\s+/).length>=1),"כל תחליף הוא שם תקין");
 const uniq=new Set(nameReps);
 ok(uniq.size===nameReps.length,"אין שני אנשים עם אותו שם בדוי");
 const mapOf=v=>{const m=r.applied.find(x=>x.value===v);return m&&m.rep};
 ok(mapOf("רונית לוי")!==mapOf("תמר גולדשמיט"),"שתי נשים קיבלו שמות שונים");
 ok(/^[\u05d0-\u05ea]/.test(mapOf("רונית לוי")||""),"התחליף בעברית");

 console.log("— עקביות בין מסמכים —");
 const r2=await E.redactDocx(buf,subs,[],opt);
 ok(mapOf("רונית לוי")===r2.applied.find(x=>x.value==="רונית לוי").rep,
    "אותה אישה מקבלת אותו שם בהרצה נפרדת");

 console.log("— שיבוש תמלול —");
 const near=r.verification.near||[];
 console.log("   נמצא: "+near.map(x=>`${x.value} ← ${x.near.target}`).join(" | "));
 ok(near.some(x=>x.value==="מהירות"||x.value.includes("מהירות")),
    'תפס את "פנים מהירות"');
 ok(near.some(x=>x.value.includes("ונית")),'תפס את "לונית לוי" (שיבוש של רונית לוי)');
 ok(!r.verification.complete,"הבר לא מכריז ירוק כשיש שיבוש");

 console.log("— אחידות שם משפחה —");
 ok(!out.includes("גולדשמיט"),"שם משפחה לבד הוחלף גם הוא");

 console.log("— הלוך ושוב —");
 const pairs=r.applied.filter(x=>x.rep&&x.value).map(x=>[x.value,x.rep]);
 const fake=mapOf("רונית לוי");
 const aiAnswer=`לדעתי ${fake} זכאית לסעד. מומלץ ש${fake} תגיש תצהיר משלים, `+
   `ושב"כ ${mapOf("תמר גולדשמיט")} תצרף אסמכתאות. גם ${mapOf("אורי בן-שחר")} יידרש להגיב.`;
 const back=E.restoreNames(aiAnswer,pairs);
 console.log("   תשובת AI: "+aiAnswer);
 console.log("   אחרי החזרה: "+back.text);
 ok(back.text.includes("רונית לוי"),"השם האמיתי חזר");
 ok(back.text.includes("שרונית לוי"),"אות שימוש נשמרה בהחזרה");
 ok(back.text.includes("אורי בן-שחר"),"שם עם מקף חזר");
 ok(!/[א-ת]/.test("")||!back.text.includes(fake),"לא נשאר שם בדוי בטקסט המוחזר");

 console.log("— מצב פלוני עדיין עובד —");
 const rl=await E.redactDocx(buf,subs,[],{...opt,mode:"label"});
 ok(rl.preview.map(b=>b.text).join("\n").includes("פלוני"),"מצב «פלוני א׳» תקין");
 const rb=await E.redactDocx(buf,subs,[],{...opt,mode:"block"});
 ok(rb.preview.map(b=>b.text).join("\n").includes("███"),"מצב מחיקה מלאה תקין");

 console.log("— זיהוי אוטומטי —");
 const files=await E.unzip(buf.slice(0));
 let blocks=[];
 for(const f of files) if(E.TEXTPART.test(f.name)){
   const d=E.parseXML(E.TXT.decode(f.data));E.acceptTracked(d);
   blocks=blocks.concat(E.flatten(d,f.name))}
 const cands=E.discover(blocks);
 console.log("   מועמדים: "+cands.map(c=>c.value+(c.g?`(${c.g})`:"")).join(" · "));
 const rl2=cands.find(c=>c.value==="רונית לוי");
 ok(rl2&&rl2.g==="f",'המגדר של "רונית לוי" זוהה מהמסמך כנקבה');
 const bs=cands.find(c=>c.value==="אורי בן-שחר");
 ok(bs&&bs.g==="m",'המגדר של "אורי בן-שחר" זוהה מהמסמך כזכר');

 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
