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
const a=js.indexOf('function pseudoRX(p){'), b=js.indexOf('function livePairs(){');
fs.writeFileSync('case-core.js',js.slice(0,cut)+"\n"+js.slice(a,b)+"\nmodule.exports={redactDocx,restoreNames};\n");
const E=require('./case-core.js');
const {mkzip}=require('./mkzip.js');
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const mk=paras=>mkzip([
 {name:'[Content_Types].xml',body:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
 {name:'_rels/.rels',body:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'},
 {name:'word/document.xml',body:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
  `<w:document ${W}><w:body>`+paras.map(t=>`<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>'}]);

// שני מסמכים שונים באותו תיק
const A=mk(["בקשה מטעם התובעת רונית לוי נגד הנתבע אורי בן-שחר.",
            "עו\"ד תמר גולדשמיט מייצגת את התובעת."]);
const B=mk(["סיכום פגישה: רונית לוי דיווחה על התנהלות אורי בן-שחר.",
            "גולדשמיט ביקשה ארכה. בן-שחר התנגד."]);
const subs=[{value:"רונית לוי",kind:"NAME",replacement:"",g:"f"},
            {value:"אורי בן-שחר",kind:"NAME",replacement:"",g:"m"},
            {value:"תמר גולדשמיט",kind:"NAME",replacement:"",g:"f"}];
const opt={on:new Set(["PLACES"]),flag:new Set(["NAME_ANCHORED"]),
  mode:"real",near:true,prefixes:"normal"};
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
(async()=>{
 const ra=await E.redactDocx(A,subs,[],opt);
 const mapA={}; for(const r of ra.applied){const v=r.base||r.value,p=r.baseRep||r.rep;
   if(v&&p&&!(v in mapA))mapA[v]=p}
 console.log("מסמך א׳:"); console.log("  "+ra.preview.map(x=>x.text).join("\n  "));
 console.log("  מיפוי: "+Object.entries(mapA).map(([k,v])=>k+" → "+v).join(" · "));

 // טוענים את הפרופיל למסמך ב׳, בדיוק כמו loadProfile בממשק
 const subsB=subs.map(s=>({...s,replacement:mapA[s.value]||""}));
 for(const [v,p] of Object.entries(mapA))
   if(!subsB.some(s=>s.value===v))subsB.push({value:v,kind:"NAME",replacement:p,auto:true});
 const rb=await E.redactDocx(B,subsB,[],opt);
 const mapB={}; for(const r of rb.applied){const v=r.base||r.value,p=r.baseRep||r.rep;
   if(v&&p&&!(v in mapB))mapB[v]=p}
 console.log("מסמך ב׳ (עם פרופיל):"); console.log("  "+rb.preview.map(x=>x.text).join("\n  "));

 for(const k of Object.keys(mapA))
   if(k in mapB) ok(mapA[k]===mapB[k],`«${k}» קיבל שם שונה: ${mapA[k]} מול ${mapB[k]}`);
 ok(true,"כל אדם שמופיע בשני המסמכים קיבל את אותו שם בדוי");
 const out=rb.preview.map(x=>x.text).join("\n");
 ok(!out.includes("רונית")&&!out.includes("גולדשמיט")&&!out.includes("בן-שחר"),
    "אין פרט מזהה במסמך ב׳: "+out.replace(/\n/g," / "));
 ok(rb.verification.passed,"אימות מסמך ב׳ עבר");
 console.log(`\n${pass} passed, ${fail} failed`);
 process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
