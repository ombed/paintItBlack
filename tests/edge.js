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
const d1=js.indexOf('const TITLE_RX='), d2=js.indexOf('function peoAdd(');
fs.writeFileSync('edge-core.js',js.slice(0,cut)+"\n"+js.slice(a,b)+"\n"+js.slice(d1,d2)+
 "\nmodule.exports={redactDocx,restoreNames,fakeName,norm,POOL,variants,cleanEntry};\n");
const E=require('./edge-core.js');
const {mkzip}=require('./mkzip.js');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const mk=ps=>mkzip([
 {name:'[Content_Types].xml',body:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
 {name:'_rels/.rels',body:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'},
 {name:'word/document.xml',body:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
  `<w:document ${W}><w:body>`+ps.map(t=>`<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`).join('')+`</w:body></w:document>`}]);
const OPT={on:new Set(["ISRAELI_ID","PLACES"]),flag:new Set(["NAME_ANCHORED"]),mode:"real",near:true,prefixes:"normal"};
const run=async(ps,names,opt)=>{
  // כמו במסך "מי בתיק": כל מחרוזת עוברת ניקוי תארים וזיהוי גוף
  const subs=names.map(v=>{if(typeof v!=="string")return v;
    const {v:val,kind}=E.cleanEntry(v);return {value:val,kind,replacement:""}});
  const r=await E.redactDocx(mk(ps),subs,[],opt||OPT);
  return {r,out:r.preview.map(b=>b.text).join("\n"),
    map:Object.fromEntries(r.applied.filter(x=>x.value&&x.rep).map(x=>[x.base||x.value,x.baseRep||x.rep]))};
};
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
const sec=t=>console.log("\n— "+t+" —");

(async()=>{
 sec("1. שם פרטי שהוא גם מילה");
 let r,rr;let {out,map}=await run(["התובע חיים כהן טען כי החיים שלו נהרסו.","בחיים לא ראיתי דבר כזה, אמר חיים.",
   "הנתבע גיל לוי הוא בגיל 42. גיל אישר את הדברים.","עמית דור הגיע עם עמיתים לעבודה. בדור הזה זה מקובל."],
   ["חיים כהן","גיל לוי","עמית דור"]);
 console.log("   "+out.replace(/\n/g,"\n   "));
 ok(out.includes("החיים שלו")||!out.includes("ה"+(map["חיים"]||"@")),"«החיים» (המילה) לא הפך ל«ה"+(map["חיים"]||"")+"»");
 ok(out.includes("בחיים לא"),"«בחיים» (המילה) שרד");
 ok(out.includes("בגיל 42"),"«בגיל 42» שרד");
 ok(out.includes("עמיתים"),"«עמיתים» שרד");
 ok(out.includes("בדור הזה"),"«בדור הזה» שרד");
 ok(!out.includes("חיים כהן")&&!out.includes("גיל לוי"),"השמות המלאים הוחלפו");

 sec("2. גוף שהוקלד כאדם — הדוגמה שלה");
 ({out,map}=await run(["התובעת שהתה במעון של עמותת פנים מאירות.","פנים מאירות סירבה למסור מסמכים."],["פנים מאירות"]));
 console.log("   פנים מאירות → "+(map["פנים מאירות"]||"?"));
 const org=map["פנים מאירות"]||"";
 ok(!E.POOL.he_f.includes(org.split(" ")[0])&&!E.POOL.he_m.includes(org.split(" ")[0]),
    "עמותה לא קיבלה שם של בן אדם: "+org);

 sec("3. תואר או תפקיד שהוקלדו יחד עם השם");
 ({out,map}=await run(["ב\"כ התובעת עו\"ד רונית לוי הגישה בקשה. רונית לוי חתמה.","משפחת אזולאי פנתה למחלקה. אזולאי סירבו."],
   ['עו"ד רונית לוי',"משפחת אזולאי"]));
 console.log("   "+out.replace(/\n/g,"\n   "));
 ok(!out.includes("רונית לוי"),'«עו"ד רונית לוי» כקלט מכסה גם «רונית לוי» בלי התואר');
 ok(!out.includes("אזולאי"),"«משפחת אזולאי» כקלט מכסה גם «אזולאי» לבד");
 ok(out.includes("ב\"כ התובעת ")&&!out.includes('עו"ד עו"ד'),"התואר נשאר בטקסט, לא הוחלף");
 ok(E.POOL.he_f.includes((map["רונית לוי"]||"").split(" ")[0]),"רונית קיבלה שם נשי למרות התואר: "+map["רונית לוי"]);
 ok((map["אזולאי"]||"").split(" ").length===1&&E.POOL.he_s.includes(map["אזולאי"]),"«אזולאי» לבד קיבל שם משפחה, לא שם פרטי: "+map["אזולאי"]);

 sec("4. אותו אדם הוקלד פעמיים בכתיב שונה");
 ({out,map}=await run(["שלוה ליבוביץ מסרה. שלווה ליבוביץ הוסיפה."],["שלוה ליבוביץ","שלווה ליבוביץ"]));
 console.log("   שלוה → "+map["שלוה ליבוביץ"]+"  |  שלווה → "+map["שלווה ליבוביץ"]);
 ok(map["שלוה ליבוביץ"]===map["שלווה ליבוביץ"],"שני הכתיבים קיבלו את אותו שם בדוי");

 sec("5. מקף מול רווח — כמו בפרוטוקול");
 ({out}=await run(["היו\"ר אורלי לוי-אבקסיס פתחה. חברת הכנסת אורלי לוי אבקסיס סיכמה. לוי–אבקסיס נעלה."],["אורלי לוי-אבקסיס"]));
 console.log("   "+out);
 ok(!out.includes("לוי אבקסיס")&&!out.includes("לוי-אבקסיס")&&!out.includes("לוי–אבקסיס"),"מקף, רווח וקו מפריד — כולם נתפסו");

 sec("6. ניקוד בשם");
 ({out}=await run(["הָעֵד רוֹנִית לֵוִי הֵעִידָה. רונית לוי חתמה."],["רונית לוי"]));
 console.log("   "+out);
 ok(!/רוֹנִית|רונית/.test(out),"שם מנוקד נתפס");

 sec("7. שם משולש");
 ({out,map}=await run(["דליה לב שדה מסרה. לב שדה הוסיפה. אלעד בן דוד נכח. בן דוד יצא."],["דליה לב שדה","אלעד בן דוד"]));
 console.log("   "+out+"\n   דליה לב שדה → "+map["דליה לב שדה"]+"  |  אלעד בן דוד → "+map["אלעד בן דוד"]);
 ok((map["דליה לב שדה"]||"").split(" ").length<=3,"שם בדוי סביר לשם משולש");
 ok(!out.includes("לב שדה")&&!out.includes("בן דוד"),"שם משפחה כפול לבד הוחלף");

 sec("8. החזרה כשהשם הבדוי הוא גם מילה");
 const pairs=[["דוד לוי","ציון כהן"],["רות מור","נגה ברנע"]];
 rr=E.restoreNames("ציון כהן טען. יש לתת ציון גבוה לעבודה. הנוגה בשמיים. נגה ברנע השיבה.",pairs);
 console.log("   "+rr.text);
 ok(rr.text.includes("דוד לוי")&&rr.text.includes("רות מור"),"השמות המלאים חזרו");
 ok(rr.text.includes("ציון גבוה"),"«ציון» כמילה לא הוחלף");

 sec("9. תשובת AI עם שם חדש שה-AI המציא");
 rr=E.restoreNames("סבטלנה אלמוג טענה, ועו\"ד משה שפירא השיב.",[["רונית לוי","סבטלנה אלמוג"]]);
 ok(rr.text.includes("משה שפירא"),"שם שה-AI המציא נשאר כמו שהוא");
 ok(rr.text.includes("רונית לוי"),"והשם האמיתי חזר");

 sec("10. פרופיל שכופה שם בדוי שקיים באמת במסמך הבא");
 ({out,map}=await run(["רונית לוי הגישה. העדה יעל רוזן אישרה. יעל רוזן חתמה."],
   [{value:"רונית לוי",kind:"NAME",replacement:"יעל רוזן"}]));
 console.log("   "+out);
 const both=(out.match(/יעל רוזן/g)||[]).length;
 ok(both<3,"לא נוצר בלבול בין רונית (שהפכה ליעל רוזן) לבין יעל רוזן האמיתית — נמצאו "+both+" מופעים");
 const flaggedAmb=(await run(["רונית לוי הגישה. העדה יעל רוזן אישרה."],[{value:"רונית לוי",kind:"NAME",replacement:"יעל רוזן"}])).r.flagged;
 ok(flaggedAmb.some(f=>/יעל רוזן|מופיע גם/.test(f.value+f.why)),"ההתנגשות סומנה לבדיקה");

 sec("11. שני אנשים שונים במרחק תו אחד");
 ({out}=await run(["רונית לוי תבעה את רונית לוין. לוין הכחישה. לוי עמדה על שלה."],["רונית לוי","רונית לוין"]));
 console.log("   "+out);
 ok(!out.includes("לוי ")&&!out.includes("לוין"),"שני האנשים הוחלפו");
 const m2=Object.entries((await run(["רונית לוי. רונית לוין."],["רונית לוי","רונית לוין"])).map);
 ok(new Set(m2.map(x=>x[1])).size===m2.length,"וקיבלו שמות בדויים שונים");

 sec("12. שם מפוצל בשבירת שורה או רווח כפול");
 ({out}=await run(["הגב'  רונית   לוי טענה.","רונית\u00a0לוי חתמה."],["רונית לוי"]));
 console.log("   "+out.replace(/\n/g," | "));
 ok(!/רונית\s+לוי/.test(out),"רווחים כפולים ורווח קשיח לא מפילים את ההתאמה");

 sec("13. גוף עם אות שימוש, ומה קורה בהחזרה");
 ({out,map}=await run(["התובעת שהתה בפנים מאירות. לפנים מאירות יש סניף בחיפה."],["פנים מאירות"]));
 console.log("   "+out);
 ok(!out.includes("פנים מאירות"),"גוף עם אות שימוש הוחלף");
 rr=E.restoreNames(out,[["פנים מאירות","[גוף א׳]"]]);
 ok(rr.text.includes("בפנים מאירות")&&rr.text.includes("לפנים מאירות"),"והתווית חוזרת לשם הגוף עם אות השימוש: "+rr.text);

 sec("14. שם שהיא הקלידה ולא מופיע במסמך בכלל");
 ({r,out}=await run(["הנתבע יוסי כהן חתם על ההסכם."],["רונית לוי","יוסי כהן"]));
 const zero=(r.flagged||[]).filter(f=>/לא נמצא|לא מופיע/.test(f.why||f.label||""));
 ok(zero.some(f=>f.value==="רונית לוי"),"הכלי מדווח ששם מהרשימה לא נמצא במסמך");

 sec("15. שם שהיא הקלידה מופיע במסמך רק בכתיב אחר");
 ({r,out}=await run(["הנתבעת רונת לוי חתמה. רונת לוי הוסיפה."],["רונית לוי"]));
 const nr=(r.verification.near||[]);
 console.log("   "+out+"   ← שיבושים: "+nr.map(x=>x.value).join(", "));
 ok(nr.some(x=>/רונת/.test(x.value)),"הכתיב במסמך הוצע כשיבוש של מה שהיא הקלידה");

 sec("16. ניקוד בגוף הטקסט — סורק הגוף וסורק השיבושים");
 ({r,out}=await run(["העובדת הסוציאלית בַּרְקוֹבִיץ ציינה שהמשפחה מוכרת.","ברקוביץ המליצה על ליווי."],["רונית לוי"]));
 const sg=(r.verification.suggest||[]).map(x=>x.value);
 console.log("   הצעות: "+(sg.join(", ")||"—"));
 ok(sg.some(x=>x.includes("ברקוביץ")),"שם מנוקד בפרוזה עדיין מוצע");

 sec("17. שם פרטי של אדם אחד = שם משפחה של אחר");
 ({out,r}=await run(["התובע שגיא לוי ועו\"ד יעל שגיא נפגשו. שגיא טען. לוי השיב."],["שגיא לוי","יעל שגיא"]));
 console.log("   "+out);
 ok(!out.includes("שגיא לוי")&&!out.includes("יעל שגיא"),"שני השמות המלאים הוחלפו");
 ok(r.flagged.some(f=>f.value==="שגיא"),"«שגיא» לבד — משותף לשניים — סומן לבדיקה ולא נוחש");

 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
