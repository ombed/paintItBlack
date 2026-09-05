const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const errs=[];const vc=new VirtualConsole().on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(fs.readFileSync('app.html','utf8'),{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
setTimeout(async()=>{
 const w=dom.window,d=w.document,ev=x=>w.eval(x);
 let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
 const BAD=String.raw`\[UNK\]|(שכשה|כש)(?="[א-ת]{3})|\w*[א-ת]\"[א-ת]\w*|\w+|\p{P}|[^\w\s]+`;
 const tok=JSON.stringify({pre_tokenizer:{type:"Split",pattern:{Regex:BAD}},model:{type:"WordPiece"}});
 const store=new Map();
 w.caches={open:async()=>({
   keys:async()=>[...store.keys()].map(u=>({url:u})),
   delete:async(k)=>store.delete(typeof k==="string"?k:k.url),
   match:async(k)=>{const u=typeof k==="string"?k:k.url;
     return store.has(u)?{text:async()=>store.get(u),clone(){return this}}:undefined},
   put:async(k,v)=>{store.set(typeof k==="string"?k:k.url,v.__body)}})};
 ev(`jsonRes=b=>({__body:b,text:async()=>b,clone(){return this}})`);
 ev(`nerEnv=()=>({local:false,canCache:true,canRun:true})`);

 console.log("\n— מסלול תקין —");
 ev(`RAW_FETCH=async()=>({ok:true,status:200,text:async()=>${JSON.stringify(tok)}})`);
 const r=await ev(`nerPrepTokenizer(()=>{})`);
 ok(r&&r.ok,"ההכנה הסתיימה באישור");
 const saved=store.get(ev("TOK_URL()"));
 ok(saved&&saved!==tok,"נשמר עותק מתוקן");
 let built=true; try{ new RegExp(JSON.parse(saved).pre_tokenizer.pattern.Regex,"gu") }catch(_){ built=false }
 ok(built,"והתבנית שבתוכו נבנית");
 ok(r.steps.some(x=>/קריאה חוזרת/.test(x))&&r.steps.some(x=>/JSON תקין ✓/.test(x)),
    "האימות בקריאה חוזרת רץ");

 console.log("\n— עותק שבור קיים במטמון —");
 store.set(ev("TOK_URL()"),"{\"broken\":1}xxxגרוטאה");
 const r2=await ev(`nerPrepTokenizer(()=>{})`);
 ok(r2.ok,"העותק השבור נמחק וההכנה הצליחה");
 ok(r2.steps.some(x=>/עותקים ישנים שנמחקו: 1/.test(x)),"והמחיקה דווחה");

 console.log("\n— הורדה נכשלת —");
 ev(`RAW_FETCH=async()=>({ok:false,status:404,text:async()=>""})`);
 let threw=false; try{ await ev(`nerPrepTokenizer(()=>{})`) }catch(e){ threw=true }
 ok(threw,"כשל הורדה מדווח ולא נבלע");

 console.log("\n— המקור עצמו פגום —");
 ev(`RAW_FETCH=async()=>({ok:true,status:200,text:async()=>${JSON.stringify(tok+"\u0000זנב")}})`);
 const r3=await ev(`nerPrepTokenizer(()=>{})`);
 ok(r3.ok,"זנב במקור מזוהה, נחתך, וההכנה מצליחה");
 ok(r3.steps.some(x=>/המקור פגום/.test(x)),"והמצב דווח: "+(r3.steps.find(x=>/המקור פגום/.test(x))||""));
 ok(r3.steps.some(x=>/סביבת התקלה/.test(x)),"עם התווים שסביב נקודת הכשל");

 console.log("\nerrors: "+(errs.length?errs.join("\n"):"none"));
 console.log(`${pass} passed, ${fail} failed\n`);
 process.exit(fail||errs.length?1:0);
},400);
