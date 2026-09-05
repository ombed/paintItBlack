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
fs.writeFileSync('gap-core.js',js.slice(0,cut)+"\nmodule.exports={redactDocx,discover,bodyNames,unzip,parseXML,TEXTPART,acceptTracked,flatten,TXT};\n");
const E=require('./gap-core.js');
const {mkzip}=require('./mkzip.js');
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const mk=ps=>mkzip([
 {name:'[Content_Types].xml',body:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
 {name:'_rels/.rels',body:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'},
 {name:'word/document.xml',body:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
  `<w:document ${W}><w:body>`+ps.map(t=>`<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`).join('')+`</w:body></w:document>`}]);

// מסמך בסגנון תמלול: כותרת קצרה, ואחריה נרטיב שבו השמות בפרוזה
const paras=[
 'בעניין: התובעת רונית לוי, ת"ז 123456782',
 'המפגש התקיים ביום שלישי. לוי הגיעה בשעה 9:00 ואמרה שהיא מותשת.',
 'לוי סיפרה שבעלה לשעבר לא העביר מזונות. רונית הוסיפה שהילדים סובלים.',
 'העובדת הסוציאלית ברקוביץ ציינה שהמשפחה מוכרת לרווחה.',
 'ברקוביץ המליצה על ליווי. לדברי ברקוביץ, המצב הידרדר בחודשים האחרונים.',
 'מנהלת בית הספר סיגלית אזולאי מסרה שהילדים נעדרו. אזולאי הוסיפה פרטים.',
 'בסיום נכחו לוי, ברקוביץ ואזולאי.',
];
const buf=mk(paras);
(async()=>{
 const files=await E.unzip(buf.slice(0));
 let blocks=[];
 for(const f of files) if(E.TEXTPART.test(f.name)){
   const d=E.parseXML(E.TXT.decode(f.data));E.acceptTracked(d);
   blocks=blocks.concat(E.flatten(d,f.name))}
 // ── הזרימה החדשה ──
 const cands=E.discover(blocks);
 const PEO=cands.filter(c=>c.conf==="high"&&c.value.includes(" "))
   .map(c=>({value:c.value,g:c.g}));
 console.log("המסמך מזכיר: רונית לוי, ברקוביץ, סיגלית אזולאי\n");
 console.log('מסך "מי בתיק" נפתח עם: '+(PEO.map(p=>p.value).join(", ")||"— ריק —"));
 console.log("(היא לוחצת «השחר» בלי להוסיף אף אחד)\n");
 const opt={on:new Set(["ISRAELI_ID","PLACES"]),flag:new Set(["NAME_ANCHORED"]),
   mode:"real",near:true,prefixes:"normal"};
 const r=await E.redactDocx(buf,PEO.map(p=>({value:p.value,kind:"NAME",replacement:"",g:p.g})),[],opt);
 console.log("──── הפלט ────");
 console.log(r.preview.map(b=>b.text).join("\n"));
 console.log("───────────────\n");
 const sug=r.verification.suggest||[];
 console.log("מה הכלי שואל אותה:");
 for(const x of sug)console.log(`   «${x.value}» — ${x.count}× · ${x.why}`);
 console.log("\nהבר התחתון: "+(!r.verification.passed?"אדום":
   sug.length?"כתום — שמות שאינם ברשימה":
   r.verification.complete?"ירוק":"כתום"));
 const out=r.preview.map(b=>b.text).join("\n");
 const missed=["ברקוביץ","סיגלית","אזולאי"].filter(n=>out.includes(n)&&!sug.some(s=>s.value.includes(n)));
 console.log("שמות שנשארו בלי שאף אחד יגיד לה: "+(missed.join(", ")||"אין"));

 console.log("\n(היא לוחצת «כן, זה שם» על שתי ההצעות)\n");
 const subs2=PEO.map(p=>({value:p.value,kind:"NAME",replacement:"",g:p.g}))
   .concat(sug.map(x=>({value:x.value,kind:"NAME",replacement:""})));
 const r2=await E.redactDocx(buf,subs2,[],opt);
 console.log("──── הפלט הסופי ────");
 console.log(r2.preview.map(b=>b.text).join("\n"));
 console.log("─────────────────────\n");
 const o2=r2.preview.map(b=>b.text).join("\n");
 const leak=["רונית","לוי","ברקוביץ","סיגלית","אזולאי"].filter(n=>o2.includes(n));
 console.log("פרטים מזהים שנשארו: "+(leak.join(", ")||"אין"));
 const s2=(r2.verification.suggest||[]).length, n2=(r2.verification.near||[]).length;
 console.log("שאלות פתוחות: "+(s2+n2||"אין"));
 console.log("הבר התחתון: "+(!r2.verification.passed?"אדום":r2.verification.complete?"ירוק ✓":"כתום"));
})().catch(e=>{console.error(e);process.exit(1)});
