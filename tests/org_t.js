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
fs.writeFileSync('org-core.js',js.slice(0,cut)+"\n"+js.slice(a,b)+"\nmodule.exports={redactDocx,restoreNames};\n");
const E=require('./org-core.js');
const {mkzip}=require('./mkzip.js');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const mk=ps=>mkzip([
 {name:'[Content_Types].xml',body:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
 {name:'_rels/.rels',body:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'},
 {name:'word/document.xml',body:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
  `<w:document ${W}><w:body>`+ps.map(t=>`<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`).join('')+`</w:body></w:document>`}]);
const OPT={on:new Set(["PLACES"]),flag:new Set(["NAME_ANCHORED"]),mode:"real",near:true,prefixes:"normal"};
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
(async()=>{
 console.log("\n— סוג «גוף» מקצה לקצה, כפי שהמודל מציע אותו —");
 const ps=["התובעת שהתה במעון של עמותת פנים מאירות בחיפה.",
           "פנים מאירות סירבה. לפנים מאירות יש סניף. מפנים מאירות לא התקבלה תשובה.",
           "רונית לוי הגישה תלונה נגד פנים מארות."];
 const r=await E.redactDocx(mk(ps),[
   {value:"פנים מאירות",kind:"ORG",replacement:""},
   {value:"רונית לוי",kind:"NAME",replacement:""}],[],OPT);
 const out=r.preview.map(b=>b.text).join("\n");
 console.log("   "+out.replace(/\n/g,"\n   "));
 ok(!out.includes("פנים מאירות"),"כל מופעי הגוף הוחלפו");
 ok(/[בלמ]\[גוף/.test(out),"כולל אותיות שימוש: "+(out.match(/[בלמ]\[גוף[^\]]*\]/g)||[]).join(", "));
 const orgRep=(r.applied.find(x=>x.value==="פנים מאירות")||{}).rep;
 ok(/^\[גוף/.test(orgRep||""),"הגוף קיבל תווית גוף ולא שם של אדם: "+orgRep);
 const near=(r.verification.near||[]).map(x=>x.value);
 ok(near.some(x=>/מארות/.test(x)),"ושיבוש כתיב של גוף נתפס: "+(near.join(", ")||"—"));

 console.log("\n— החזרה של תווית גוף —");
 const back=E.restoreNames("לדעתי "+orgRep+" פעלה כדין, ול"+orgRep+" יש אחריות.",
   [["פנים מאירות",orgRep]]);
 console.log("   "+back.text);
 ok(back.text.includes("פנים מאירות")&&back.text.includes("לפנים מאירות"),
    "התווית חוזרת לשם הגוף, כולל אות שימוש");
 ok(!back.text.includes("גוף א"),"ולא נשארה תווית");

 console.log("\n— גוף ואדם לא מתערבבים —");
 ok((r.applied.find(x=>x.value==="רונית לוי")||{}).rep!==orgRep,"תחליפים שונים");

 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
