const C=require('./core.js');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
const T="העובדת הסוציאלית שלוה ליבוביץ ציינה כי מישל הגיעה לכוכב יאיר.";

console.log("\n— המצב שנכשל אצלו: בלי היסטים, עם תת-מילים —");
// כך transformers.js מחזיר בלי צבירה: טוקנים, ##תת-מילים, בלי start/end
const toks=[
 {word:"שלוה",entity:"B-PER",score:0.99},
 {word:"ליבו",entity:"I-PER",score:0.99},
 {word:"##ביץ",entity:"I-PER",score:0.98},
 {word:"ציינה",entity:"O",score:0.99},
 {word:"מישל",entity:"B-PER",score:0.97},
 {word:"לכוכב",entity:"B-GPE",score:0.95},
 {word:"יאיר",entity:"I-GPE",score:0.96},
];
C.nerAlign(T,toks,0);
ok(toks.every(t=>t._s!=null),"כל טוקן קיבל מיקום בטקסט");
const g=C.nerGroup(toks);
const span=x=>T.slice(x.s,x.e);
console.log("   ישויות: "+g.map(x=>`${span(x)}[${x.type}]`).join(", "));
ok(g.length===3,"שלוש ישויות, לא שבע");
ok(span(g[0])==="שלוה ליבוביץ","תת-מילים אוחו לשם מלא");
ok(g[0].type==="PER"&&g[2].type==="GPE","הסוגים נכונים");
ok(span(g[1])==="מישל","תווית B פותחת ישות חדשה");
ok(span(g[2])==="לכוכב יאיר","ישות רב-מילתית אוחתה");
const out=C.nerClean(g.map(x=>({type:x.type,score:x.score,s:x.s,e:x.e})),T);
console.log("   אחרי ניקוי: "+out.map(x=>`${x.value}[${x.kind}]`).join(", "));
ok(out.some(x=>x.value==="מישל"),"«מישל» שרד את כל השרשרת");
ok(out.some(x=>x.value==="כוכב יאיר"&&x.kind==="PLACE"),"ואות השימוש קולפה מ«לכוכב יאיר»");

console.log("\n— כשהצינור כן מחזיר היסטים —");
const t2=[{word:"מישל",entity_group:"PER",score:0.97,start:T.indexOf("מישל"),end:T.indexOf("מישל")+4}];
C.nerAlign(T,t2,0);
ok(t2[0]._s===T.indexOf("מישל"),"ההיסט של הצינור מועדף על היישור הידני");

console.log("\n— היסט בין קטעים —");
const t3=[{word:"מישל",entity:"B-PER",score:0.9}];
C.nerAlign("מישל הגיעה",t3,500);
ok(t3[0]._s===500,"מיקום בתוך קטע מתורגם למיקום במסמך");

console.log("\n— עמידות —");
const t4=[{word:"לאנמצא",entity:"B-PER",score:0.9},{word:"מישל",entity:"B-PER",score:0.9}];
C.nerAlign(T,t4,0);
ok(t4[0]._s===null&&t4[1]._s!==null,"טוקן שלא נמצא בטקסט מדולג, והבא ממשיך");
ok(C.nerGroup([{word:"x",entity:"O",score:1,_s:0,_e:1}]).length===0,"תווית O אינה ישות");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
