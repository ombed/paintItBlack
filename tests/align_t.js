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
// טוקנים של צינור אמיתי מכסים את הטקסט לפי הסדר; טוקן שלא נמצא נמצא בין שכניו
const t4=[{word:"העובדת",entity:"O",score:0.9},{word:"לאנמצא",entity:"B-PER",score:0.9},{word:"הסוציאלית",entity:"O",score:0.9}];
C.nerAlign(T,t4,0);
ok(t4[1]._s===null&&t4[2]._s!==null&&T.slice(t4[2]._s,t4[2]._e)==="הסוציאלית","טוקן שלא נמצא בטקסט מדולג, והבא ממשיך");
ok(C.nerGroup([{word:"x",entity:"O",score:1,_s:0,_e:1}]).length===0,"תווית O אינה ישות");

// בדיקת המודלים (ספטמבר 2026): הטוקנייזר מסיר ניקוד ומקטין אותיות לטיניות, ולכן
// "מיקה" של "מִיקָה" לא נמצאה במקומה — ונמצאה בהופעה מאוחרת יותר ("ומיקה תתחיל"). היישור קפץ
// לשם, וכל טוקן שביניהם לא מוקם: בקורפוס, שאר הקטע כולו (m3, f4), וכל מה שהמודל מצא בו אבד.
console.log("\n— ניקוד, אותיות גדולות, וקפיצה קדימה —");
const tk=(ws)=>ws.map(w=>({word:w,entity:"O",score:0.9}));
{
  const N="מורן סיפרה שמיקה ועומרי מתקשים. מִיקָה בת חמש, ומסרבת ללכת לגן. ומיקה תתחיל טיפול בחודש הבא.";
  const t=tk(["מורן","סיפרה","שמיקה","ועומרי","מתקשים","##.","מיקה","בת","חמש","##,","ומסרבת","ללכת","לגן","##.","ומיקה","תתחיל","טיפול"]);
  C.nerAlign(N,t,0);
  const at=(i)=>t[i]._s==null?null:N.slice(t[i]._s,t[i]._e);
  ok(at(6)==="מִיקָה","שם מנוקד מוקם במקומו, עם הניקוד: "+at(6));
  ok(at(7)==="בת"&&at(8)==="חמש"&&at(12)==="לגן","והמילים שאחריו מוקמו: "+[7,8,12].map(at).join(" "));
  ok(t.every(x=>x._s!=null),"כל טוקן מוקם");
}
{
  const L="Daniel Katz signed for José García.";
  const t=tk(["daniel","katz","signed","for","jose","garcia","##."]);
  C.nerAlign(L,t,0);
  ok(t.map(x=>x._s==null?"-":L.slice(x._s,x._e)).join("|")==="Daniel|Katz|signed|for|José|García|.","אותיות גדולות ותווי הטעמה, כמו שהטוקנייזר מקטין ומסיר: "+t.map(x=>x._s==null?"-":L.slice(x._s,x._e)).join("|"));
}
{
  const J="שלום דנה ומה שלומך היום יא דנה";
  const t=tk(["שלום","[UNK]","ומה","שלומך"]);
  C.nerAlign(J,t,0);
  ok(t[1]._s==null&&J.slice(t[2]._s,t[2]._e)==="ומה","[UNK] אינו מוקם ואינו מזיז את היישור");
  // טוקן שאינו במקומו ויש לו הופעה רחוקה בהמשך: לוקחים אותה רק אם אינה מדלגת על מילים
  const t2=tk(["שלום","מירב","ומה","שלומך"]);
  const J2="שלום דנה ומה שלומך היום מירב";
  C.nerAlign(J2,t2,0);
  ok(t2[1]._s==null,"«מירב» מופיע רק בסוף: לא קופצים אליו");
  ok(J2.slice(t2[2]._s,t2[2]._e)==="ומה"&&J2.slice(t2[3]._s,t2[3]._e)==="שלומך","והמילים שאחריו נשארות במקומן");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
