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
fs.writeFileSync('perf-core.js',js.slice(0,cut)+"\nmodule.exports={redactDocx};\n");
const E=require('./perf-core.js');
const {mkzip}=require('./mkzip.js');

const first=["רונית","אורי","תמר","מיכל","דוד","שרה","יוסי","נעמי","אבי","רותי",
 "משה","חנה","יעקב","אסתר","דני","ליאת","גיל","ורד","עמית","סיגל","רן","טל","נטע","עידו","מאיה"];
const last=["לוי","בן-שחר","גולדשמיט","ברנע","כהן","מזרחי","פרץ","ביטון","דהן","שפירא",
 "אזולאי","פרידמן","רוזנברג","שטרן","אדלר","קליין","וייס","הראל","אלבז","ממן","נחמיאס",
 "יעקובי","קפלן","סלומון","דורון"];
const people=first.map((f,i)=>f+" "+last[i]);
const filler="בהתאם לאמור לעיל, ולאור המסמכים שצורפו לתיק בית המשפט, "+
 "ובשים לב לטענות שהועלו במסגרת הדיון שהתקיים במעמד הצדדים, ";
const paras=[];
for(let i=0;i<420;i++){
  const a=people[i%people.length], b=people[(i*7+3)%people.length];
  paras.push(`${filler}טען ${a} כי ${b} הפר את ההסכם מיום 12.3.2024, `+
    `וכי יש לחייבו בהוצאות. ת"ז 123456782, טלפון 052-4471938. `+
    `הדברים נאמרו בנוכחות עו"ד ${people[(i*3+1)%people.length]}.`);
}
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
 `<w:document ${W}><w:body>`+paras.map(t=>{const h=(t.length/2)|0;
  return `<w:p><w:r><w:t xml:space="preserve">${t.slice(0,h)}</w:t></w:r><w:r><w:t xml:space="preserve">${t.slice(h)}</w:t></w:r></w:p>`}).join('')+'</w:body></w:document>';
const buf=mkzip([
 {name:'[Content_Types].xml',body:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
 {name:'_rels/.rels',body:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'},
 {name:'word/document.xml',body:docXml}]);
const wc=paras.join(" ").split(/\s+/).length;
(async()=>{
 const subs=people.map(p=>({value:p,kind:"NAME",replacement:"",auto:true}));
 const opt={on:new Set(["EMAIL","PHONE_MOBILE","ISRAELI_ID","PLACES"]),
   flag:new Set(["NAME_ANCHORED"]),mode:"real",near:true,prefixes:"normal"};
 const t0=Date.now();
 const r=await E.redactDocx(buf,subs,[],opt);
 const t1=Date.now();
 const r2=await E.redactDocx(buf,subs,[],{...opt,near:false});
 const t2=Date.now();
 console.log(`מסמך: ${paras.length} פסקאות, ~${wc} מילים, ${subs.length} שמות`);
 console.log(`עם סריקת שיבושים: ${t1-t0} ms`);
 console.log(`בלי סריקת שיבושים: ${t2-t1} ms`);
 console.log(`עלות הסריקה: ${(t1-t0)-(t2-t1)} ms`);
 console.log(`הוחלפו ${r.applied.length} מופעים, אימות: ${r.verification.passed?"עבר":"נכשל"}`);
})().catch(e=>{console.error(e);process.exit(1)});
