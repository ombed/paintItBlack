const xd=require('@xmldom/xmldom');
global.DOMParser=xd.DOMParser; global.XMLSerializer=xd.XMLSerializer;
{const p=new xd.DOMParser().parseFromString('<a><b/></a>','application/xml');
 for(const proto of [Object.getPrototypeOf(p.documentElement),Object.getPrototypeOf(p)]){
  if(!('children' in proto))Object.defineProperty(proto,'children',{get(){
    return Array.from(this.childNodes||[]).filter(n=>n.nodeType===1)}});
  if(!proto.querySelector)proto.querySelector=function(t){
    const l=this.getElementsByTagName(t);return l&&l.length?l[0]:null}}}
const zlib=require('zlib'),fs=require('fs');
global.__deflate=b=>new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate=b=>new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
let js=fs.readFileSync('app.html','utf8').split('<script>')[1].split('</script>')[0]
 .replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");','const inflate=async u8=>global.__inflate(u8);')
 .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");','const deflate=async u8=>global.__deflate(u8);');
const cut=js.indexOf('/* ══════════════════════════ ממשק ══════════════════════════ */');
fs.writeFileSync('real-core.js',js.slice(0,cut)+"\nmodule.exports={redactDocx,discover,unzip,parseXML,TEXTPART,acceptTracked,flatten,TXT};\n");
const E=require('./real-core.js');
const {mkzip}=require('./mkzip.js');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const paras=fs.readFileSync('protocol.txt','utf8').split(/\n+/).filter(x=>x.trim());
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const buf=mkzip([
 {name:'[Content_Types].xml',body:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
 {name:'_rels/.rels',body:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'},
 {name:'word/document.xml',body:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
  `<w:document ${W}><w:body>`+paras.map(t=>`<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`).join('')+`</w:body></w:document>`}]);
const words=paras.join(" ").split(/\s+/).length;
(async()=>{
 const files=await E.unzip(buf.slice(0));
 let blocks=[];
 for(const f of files) if(E.TEXTPART.test(f.name)){
   const d=E.parseXML(E.TXT.decode(f.data));E.acceptTracked(d);
   blocks=blocks.concat(E.flatten(d,f.name))}
 console.log(`מסמך: ${paras.length} פסקאות, ${words} מילים\n`);
 const cands=E.discover(blocks);
 const seed=cands.filter(c=>c.conf==="high"&&c.value.includes(" "));
 console.log('מסך "מי בתיק" נפתח עם '+seed.length+' שמות מהכותרת:');
 console.log('   '+(seed.map(c=>c.value).join(", ")||"—"));

 // התרחיש: היא מוסיפה את מי שהיא מזהה כמרכזי — כמו שהיא הייתה עושה ב-Ctrl+H
 const typed=["שלוה ליבוביץ","דליה לב שדה","אורלי לוי אבקסיס","יעקב מרגי",
   "גלית וינדפלד","הלל שר","עמית דור","דלית וולברג","טלי חלף","צפרא דוויק"];
 console.log(`\nהיא מקלידה ${typed.length} שמות (מי שהיא זוכרת מהדיון).\n`);
 const t0=Date.now();
 const opt={on:new Set(["ISRAELI_ID","PHONE_MOBILE","EMAIL","PLACES","ADDRESS_STREET"]),
   flag:new Set(["NAME_ANCHORED"]),mode:"real",near:true,prefixes:"normal"};
 const r=await E.redactDocx(buf,typed.map(v=>({value:v,kind:"NAME",replacement:""})),[],opt);
 const ms=Date.now()-t0;
 const near=r.verification.near||[], sug=r.verification.suggest||[];
 console.log(`⏱  ${ms} ms · ${r.applied.length} החלפות\n`);
 console.log("═══ שיבושי כתיב שנתפסו ═══");
 for(const x of near)console.log(`   «${x.value}»  ←  ${x.near.target}   [${x.conf}]  ${x.why}`);
 if(!near.length)console.log("   — אין —");
 console.log("\n═══ שמות שהיא לא רשמה ═══");
 for(const x of sug)console.log(`   «${x.value}»  ${x.count}×  ·  ${x.why}`);
 if(!sug.length)console.log("   — אין —");
 const nohit=r.flagged.filter(f=>f.src==="nohit");
 console.log("\n═══ שמות מהרשימה שלא נמצאו ═══");
 console.log("   "+(nohit.map(f=>f.value).join(", ")||"— כולם נמצאו —"));
 console.log("\n═══ בדיקות בטיחות ═══");
 const out=r.preview.map(b=>b.text).join("\n");
 console.log('   "שר הרווחה"/"מהשר" לא נהרס: '+(out.includes("מהשר")?"✓":"✗ נפגע"));
 console.log('   "שלווה" (הכתיב השני) עדיין בטקסט: '+(out.includes("שלווה")?"כן — מסומן לבדיקה":"לא"));
 const kid=["שליו","מישל","חגית"].filter(n=>sug.some(s=>s.value.split(/\s+/).includes(n)));
 console.log('   שמות שמופיעים רק בפרוזה שהוצעו: '+(kid.join(", ")||"— אף אחד —"));
 console.log('   הבר התחתון: '+(!r.verification.passed?"אדום":
   sug.length?"כתום — שמות שאינם ברשימה":near.length?"כתום — שיבושים":
   r.verification.complete?"ירוק":"כתום"));

 // שורה אחת בתחתית, כדי שיהיה קל לראות מתי משהו משתנה. שתי העובדות שהדוח
 // הזה מדגים: הכתיב השני של שלוה נתפס לבדיקה, ושם שמופיע רק בפרוזה הוצע.
 const twinFlagged=near.some(x=>x.value.includes("שלווה"));
 const proseSurfaced=kid.length>0;
 // הדוברים בתמלול ממלאים את הרשימה מראש: השמות שהיא הקלידה יושבים בכותרות התורים.
 const fold=x=>x.replace(/[-–־]/g," ").split(" ").filter(Boolean).join(" ");
 const typedFound=typed.filter(t=>seed.some(c=>fold(c.value)===fold(t))).length;
 const speakersPrefilled=typedFound>=typed.length-1;
 const verdict=(twinFlagged&&proseSurfaced&&speakersPrefilled)?"PASS":"FAIL";
 console.log(`
סיכום: ${verdict} — הכתיב השני «שלווה» ${twinFlagged?"נתפס לבדיקה":"לא נתפס"} · `+
   `שם מהפרוזה ${proseSurfaced?"הוצע ("+kid.join(", ")+")":"לא הוצע"} · `+
   `דוברים מולאו מראש ${typedFound}/${typed.length}`);
})().catch(e=>{console.error(e);process.exit(1)});
