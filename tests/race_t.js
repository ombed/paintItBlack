const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const errs=[];const vc=new VirtualConsole().on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(fs.readFileSync('app.html','utf8'),{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
setTimeout(async()=>{
 const w=dom.window,d=w.document,ev=x=>w.eval(x);
 let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
 const blocks='[{part:"d",text:"רונית לוי הגישה בקשה."}]';

 console.log("\n— א. לחיצה על «השחר» בזמן שהמודל עדיין סורק —");
 ev(`CANDS=[]; RES=null; RAN=null;
     run=async(subs)=>{RAN=subs.map(s=>s.value)};
     nerEnv=()=>({local:false,canCache:true,canRun:true});
     nerCached=async()=>true;
     nerRun=async()=>{await new Promise(r=>setTimeout(r,120));
       return [{value:"ברקוביץ",kind:"NAME",n:3,score:.99}]}`);
 d.getElementById("oNer").checked=true;
 const scan=ev(`showPeople(${blocks})`);
 await new Promise(r=>setTimeout(r,20));            // הסריקה באמצע
 d.getElementById("peoGo").dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
 await scan; await new Promise(r=>setTimeout(r,30));
 const ran=ev("RAN");
 ok(ran===null,"לחיצה בזמן סריקה לא מריצה השחרה חלקית (רץ עם: "+JSON.stringify(ran)+")");
 ok(ev("PEO").some(p=>p.value==="ברקוביץ"),"והתוצאה של המודל כן נכנסה לרשימה");

 console.log("\n— ב. העלאת מסמך שני בזמן סריקה של הראשון —");
 ev(`PEO=[]; RAN=null;
     nerRun=async(b)=>{const t=b[0].text.includes("ראשון")?150:10;
       await new Promise(r=>setTimeout(r,t));
       return [{value:b[0].text.includes("ראשון")?"מהראשון":"מהשני",kind:"NAME",n:1,score:.9}]}`);
 const s1=ev(`showPeople([{part:"d",text:"מסמך ראשון"}])`);
 await new Promise(r=>setTimeout(r,20));
 const s2=ev(`showPeople([{part:"d",text:"מסמך שני"}])`);
 await Promise.all([s1,s2]); await new Promise(r=>setTimeout(r,60));
 const names=ev("PEO").map(p=>p.value);
 ok(!names.includes("מהראשון"),"תוצאות מהמסמך הנטוש לא מזהמות את החדש (יצא: "+JSON.stringify(names)+")");
 ok(names.includes("מהשני"),"ותוצאות המסמך הנוכחי כן נכנסו");

 console.log("\n— ג. כפתורים נעולים בזמן סריקה —");
 ev(`PEO=[]; nerRun=async()=>{await new Promise(r=>setTimeout(r,150));return []}`);
 const s3=ev(`showPeople(${blocks})`);
 await new Promise(r=>setTimeout(r,30));
 ok(d.getElementById("peoGo").disabled,"כפתור «השחר» נעול בזמן הסריקה");
 await s3; await new Promise(r=>setTimeout(r,20));
 ok(!d.getElementById("peoGo").disabled,"ומשוחרר בסיום");

 console.log("\nerrors: "+(errs.length?errs.join("\n"):"none"));
 console.log(`${pass} passed, ${fail} failed\n`);
 process.exit(fail||errs.length?1:0);
},400);
