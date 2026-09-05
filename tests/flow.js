const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
const errs=[];
const vc=new VirtualConsole().on("jsdomError",e=>errs.push(e.message)).on("error",m=>errs.push(String(m)));
const dom=new JSDOM(fs.readFileSync('app.html','utf8'),
  {runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
setTimeout(async()=>{
 const w=dom.window,d=w.document;
 let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
 const click=id=>d.getElementById(id).dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
 const type=(id,v)=>{d.getElementById(id).value=v};

 // מדמים הגעה למסך "מי בתיק" עם שם מהכותרת
 const ev=x=>w.eval(x);
 ev(`CANDS=[{value:"רונית לוי",conf:"high",g:"f",count:2,why:"",ctx:""},
          {value:"גולדשמיט",conf:"medium",g:null,count:1,why:"",ctx:""}]`);
 await ev("showPeople()");   // אסינכרוני עכשיו; בלי מודל מסיים מיד
 ok(d.getElementById("s2").classList.contains("on"),"עברנו למסך «מי בתיק»");
 ok(ev("PEO").length===1&&ev("PEO")[0].value==="רונית לוי",
    "רק שם מלא מהכותרת נכנס אוטומטית, לא «גולדשמיט» הבודד");
 ok(d.querySelector("#peoWrap .p").textContent.includes("מהכותרת"),"הצ'יפ מסומן כמקורו");

 type("peoIn","ברקוביץ"); click("peoAdd");
 ok(ev("PEO").length===2,"הוספה ידנית עובדת");
 ok(d.getElementById("peoIn").value==="","השדה מתנקה אחרי הוספה");

 type("peoIn","ברקוביץ"); click("peoAdd");
 ok(ev("PEO").length===2,"כפילות נחסמת");

 ev(`peoAdd("סיגלית אזולאי\\nדנה פרידמן, ח'טיב")`);
 ok(ev("PEO").length===5,"הדבקת רשימה מפצלת לשורות ולפסיקים: "+ev("PEO").map(p=>p.value).join(" | "));

 const btns=d.querySelectorAll("#peoWrap .p button[data-i]");
 btns[1].dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
 ok(ev("PEO").length===4&&!ev("PEO").some(p=>p.value==="ברקוביץ"),"מחיקת צ'יפ עובדת");

 ev("PEO=[];peoList()");
 ok(d.querySelector("#peoWrap .empty"),"מצב ריק מוצג");

 // המודל כבוי כברירת מחדל, וכיבוי נשאר כיבוי
 ok(!d.getElementById("oNer").checked,"«זיהוי חכם» כבוי כברירת מחדל");
 ok(d.getElementById("nerBox").style.display==="none","תיבת ההתקדמות מוסתרת כשהמודל כבוי");

 // כשהמודל דלוק אבל הטעינה נכשלת — נופלים חזרה בלי לשבור כלום
 d.getElementById("oNer").checked=true;
 ev("nerLoad=async()=>{throw new Error('הרשת חסומה')}");
 ev(`CANDS=[{value:"רונית לוי",conf:"high",g:"f",count:2,why:"",ctx:""}]`);
 await ev('showPeople([{part:"d",text:"רונית לוי הגישה בקשה."}])');
 ok(ev("PEO").length===1,"הרשימה מהכותרת שרדה את כשל הטעינה");
 ok(/לא נטען/.test(d.getElementById("peoNote").textContent),"והמשתמשת קיבלה הודעה מובנת");
 ok(d.getElementById("nerBox").style.display==="none","תיבת ההתקדמות נסגרה");
 ok(ev("NERUSED")===false,"NERUSED נשאר false — סורק הגוף עדיין ירוץ כרשת גיבוי");

 // ── שני המצבים: קובץ מקומי מול כתובת ──
 ev("nerEnv=()=>({local:true,canCache:false,canRun:false})");
 await ev("nerStatus()");
 ok(d.getElementById("oNer").disabled,"מקובץ מקומי המתג ננעל");
 ok(!d.getElementById("oNer").checked,"והמודל כבוי");
 ok(/לא יעבוד/.test(d.getElementById("nerHint").textContent),"ונאמר לה למה, בעברית");
 let threw=false;
 try{ await ev("nerLoad()") }catch(e){ threw=true }
 ok(threw,"וניסיון טעינה נכשל מיד במקום להוריד לשווא");

 ev("nerEnv=()=>({local:false,canCache:true,canRun:true})");
 ev("nerCached=async()=>true");
 await ev("nerStatus()");
 ok(!d.getElementById("oNer").disabled,"מכתובת המתג פתוח");
 ok(/כבר שמור/.test(d.getElementById("nerHint").textContent),"וכשהמודל במטמון — נאמר שאין הורדה");
 ev("nerCached=async()=>false");
 await ev("nerStatus()");
 ok(/180MB/.test(d.getElementById("nerHint").textContent),"וכשאינו — נאמר כמה יירד, פעם אחת");

 // ── תיקון ה-regex של הטוקנייזר ──
 ev("nerFixRegExp()");
 const pat=String.raw`\w*[א-ת]\"[א-ת]\w*|\w+|\p{P}|[^\w\s]+`;
 let built=true; try{ ev("new RegExp("+JSON.stringify(pat)+',"gu")') }catch(_){ built=false }
 ok(built,"תבנית הטוקנייזר של DictaBERT נבנית");
 ok(ev(`"עו\\"ד רונית לוי".match(new RegExp(${JSON.stringify(pat)},"gu")).join("|")`)==='עו"ד|רונית|לוי',
    "והיא מפרקת נכון ראשי תיבות עבריים");
 ok(ev(`new RegExp("\\\\d+","g").test("42")`),"regex תקין לא מושפע");
 let stillThrows=false; try{ ev(`new RegExp("(","g")`) }catch(_){ stillThrows=true }
 ok(stillThrows,"ותבנית שבורה באמת עדיין זורקת שגיאה");

 console.log(`\n${pass} passed, ${fail} failed`);
 console.log("errors:",errs.length?errs.join("\n"):"none");
 process.exit(fail||errs.length?1:0);
},400);
