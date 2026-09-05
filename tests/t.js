const C=require('./core.js');
let pass=0,fail=0;
const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m));};
const eq=(a,b,m)=>ok(a===b,`${m}\n     got: ${JSON.stringify(a)}\n     exp: ${JSON.stringify(b)}`);

console.log("\n— near1 —");
ok(C.near1("מהירות","מאירות"),"substitution א↔ה detected");
ok(C.near1("פנים מהירות","פנים מאירות"),"multi-word substitution");
ok(!C.near1("מאירות","מאירות"),"identical is not a near miss");
ok(C.near1("גולדשמיט","גולדשמידט"),"one char missing");
ok(!C.near1("כהן","לוי"),"unrelated words rejected");
ok(!C.near1("רוזנברג","גולדשטיין"),"length gap rejected");
ok(C.near1("כץ","כז"),"short substitution still structurally detected");

console.log("\n— findNear (her actual failure) —");
const blocks=[{part:"word/document.xml",text:
 "העמותה פנים מהירות הפעילה את המרכז. בהמשך פנתה גב' רונית לוי אל המנהל. "+
 "נכח גם מר אורי בן-שחר. הדוח הוגש לוועדה."}];
const targets=[
 {value:"פנים מאירות",norm:"פנים מאירות",words:2,rep:"ידיים חמות",kind:"OTHER"},
 {value:"רונית לוי",norm:"רונית לוי",words:2,rep:"מיכל ברנע",kind:"NAME"}];
const near=C.findNear(blocks,targets,new Set(["ידיים חמות","מיכל ברנע"]));
eq(near.length,1,"exactly one near miss found");
eq(near[0].value,"פנים מהירות","the transcription typo is the one caught");
eq(near[0].near.target,"פנים מאירות","typo is linked to its source name");
eq(near[0].near.rep,"ידיים חמות","one-tap fix carries the same replacement");
ok(near[0].conf==="high","homophone swap is high confidence");
ok(/א↔ה|ה↔א/.test(near[0].why),"explanation names the swapped letters: "+near[0].why);

console.log("\n— findNear does not fire on the replacement itself —");
const b2=[{part:"word/document.xml",text:"מיכל ברנע הגישה תצהיר. מיכל ברנע חתמה."}];
eq(C.findNear(b2,targets,new Set(["מיכל ברנע"])).length,0,"replaced text produces no noise");

console.log("\n— realistic names —");
const used=new Set(),forb=new Set();
const f1=C.fakeName("רונית לוי","f",used,forb);
const f2=C.fakeName("רונית לוי","f",new Set(),new Set());
eq(f1,f2,"same person gets same name across runs (deterministic)");
eq(f1.split(/\s+/).length,2,"two-word name stays two words");
ok(C.POOL.he_f.includes(f1.split(" ")[0]),"female name gets a female first name: "+f1);
const m1=C.fakeName("אורי בן-שחר","m",new Set(),new Set());
ok(C.POOL.he_m.includes(m1.split(" ")[0]),"male name gets a male first name: "+m1);
const a1=C.fakeName("מוחמד אבו-ראס",null,new Set(),new Set());
ok(C.POOL.ar_m.includes(a1.split(" ")[0]),"arabic name stays arabic: "+a1);
const s1=C.fakeName("גולדשמיט",null,new Set(),new Set());
eq(s1.split(/\s+/).length,1,"surname alone stays one word: "+s1);
ok(C.POOL.he_s.includes(s1),"surname alone maps to a surname, not a first name");
const s2=C.fakeName("תמר",null,new Set(),new Set());
ok(C.POOL.he_f.includes(s2),"first name alone maps to a first name: "+s2);

console.log("\n— invented names never collide with the real document —");
const forbidden=new Set(["מיכל","ברנע","יעל","שגב","כהן"]);
for(let i=0;i<80;i++){
  const v=C.fakeName("נבדק"+i+" נבדקי",null,new Set(),forbidden);
  if(v.split(/\s+/).some(w=>forbidden.has(w))){ok(false,"collision on "+v);break}
}
ok(true,"80 generated names avoided every word taken from the document");
const g=C.fakeName("רונית לוי",null,new Set(),new Set());
ok(!C.PLACE_BY[g.split(" ")[0]]&&!C.PLACE_BY[g.split(" ")[1]],"generated name is not a town");

console.log("\n— gender —");
eq(C.gender("רונית לוי",null),"f","known female first name");
eq(C.gender("אורי בן-שחר",null),"m","known male first name");
eq(C.gender("קוואסמה","f"),"f","document context beats name guessing");
eq(C.gender("שירלי מנדלבאום",null),"f","common female name outside the pool");
eq(C.gender("אורנה ביטון",null),"f","another female name outside the pool");
eq(C.gender("נועם ישראלי",null),"m","unisex name is not forced to female");

console.log("\n— restoreNames —");
const pairs=[["רונית לוי","מיכל ברנע"],["אורי בן-שחר","יואב פרידמן"]];
let r=C.restoreNames("מיכל ברנע טענה כי יואב פרידמן הפר את ההסכם.",pairs);
eq(r.text,"רונית לוי טענה כי אורי בן-שחר הפר את ההסכם.","plain restore");
eq(r.count,2,"counted both");
r=C.restoreNames("הבקשה של מיכל ברנע נדחתה, ולמיכל ברנע אין עילה.",pairs);
ok(r.text.includes("ולרונית לוי"),"prefix letter preserved: "+r.text);
r=C.restoreNames("גב' ברנע הופיעה בפני המותב.",pairs);
ok(r.text.includes("גב' לוי"),"AI shortened to surname only, still restored: "+r.text);
r=C.restoreNames("מיכל  ברנע חתמה.",pairs);
ok(r.text.startsWith("רונית לוי"),"double space between words tolerated");
r=C.restoreNames("פלוני א׳ ופלוני א' הם אותו אחד.",[["דוד כהן","פלוני א׳"]]);
eq(r.count,2,"geresh variants both matched (״׳״ vs ״'״)");
r=C.restoreNames("שום שם כאן.",pairs);
eq(r.missing.length,2,"reports pseudonyms the AI never used");
r=C.restoreNames("פלוני א׳ הגיע.",[["דוד כהן","פלוני א׳"],["רות לוי","פלוני א׳"]]);
eq(r.count,0,"ambiguous pseudonym is refused, not guessed");
eq(r.conflict.length,1,"and reported as a conflict");
r=C.restoreNames("ברנעים הגישו.",pairs);
eq(r.count,0,"does not match inside a longer word");
r=C.restoreNames("מיכל אמרה שהיא חתמה.",pairs);
ok(r.text.startsWith("רונית"),"AI used the first name only, still restored: "+r.text);

console.log("\n— partial restore stays safe —");
r=C.restoreNames("ברנע ופרידמן נפגשו.",pairs);
ok(r.text.includes("לוי")&&r.text.includes("בן-שחר"),"unique surnames restored: "+r.text);
r=C.restoreNames("האלמוג בים אדום.",[["דוד לוי","יואב אלמוג"]]);
ok(r.text.includes("האלמוג"),"word-like fake surname is never restored on its own");
r=C.restoreNames("כהן הגיע.",[["דוד לוי","יוסי כהן"],["רות מור","דנה כהן"]]);
ok(!r.text.includes("לוי")&&!r.text.includes("מור"),"shared surname is never guessed: "+r.text);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
