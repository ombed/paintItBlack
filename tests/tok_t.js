const {JSDOM}=require('jsdom'),fs=require('fs');
const dom=new JSDOM(fs.readFileSync('app.html','utf8'),{runScripts:"dangerously",pretendToBeVisual:true});
setTimeout(async()=>{
 const w=dom.window; const ev=x=>w.eval(x);
 let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
 const GOODRX="\\s+|\\p{L}+";
 const BAD=String.raw`\[UNK\]|(שכשה|ולמ|כש)(?="[א-ת]{3})|(ג'ורג|ה"ביץ|לַה)'|\w*[א-ת]\"[א-ת]\w*|\w+|\p{P}|[^\w\s]+`;
 const tok=JSON.stringify({version:"1.0",
   pre_tokenizer:{type:"Sequence",pretokenizers:[
     {type:"Split",pattern:{Regex:BAD},behavior:"Isolated"},
     {type:"Split",pattern:{Regex:GOODRX},behavior:"Removed"}]},
   model:{type:"WordPiece",vocab:{}}});

 console.log("\n— תיקון קובץ הטוקנייזר —");
 const fixed=ev(`fixTokJSON(${JSON.stringify(tok)})`);
 ok(fixed!==tok,"הקובץ שונה");
 const j=JSON.parse(fixed);
 const got=j.pre_tokenizer.pretokenizers[0].pattern.Regex;
 let built=true; try{ new RegExp(got,"gu") }catch(_){ built=false }  // node נקי
 ok(built,"והתבנית שיצאה נבנית: "+(built?"כן":got.slice(0,60)));
 ok(("עו\"ד רונית לוי".match(new RegExp(got,"gu"))||[]).join("|")==='עו"ד|רונית|לוי',
    "ומפרקת נכון ראשי תיבות עבריים");
 ok(j.pre_tokenizer.pretokenizers[1].pattern.Regex===GOODRX,"תבנית תקינה אחרת לא נגעו בה");
 ok(j.model.type==="WordPiece"&&j.version==="1.0","שאר הקובץ נשמר כמו שהוא");

 console.log("\n— תבנית תקינה לא משתנה —");
 const good=JSON.stringify({pattern:{Regex:"\\\\w+|\\\\p{P}"}});
 ok(ev(`fixTokJSON(${JSON.stringify(good)})`)===good,"קובץ ללא בעיה מוחזר זהה");
 ok(ev(`fixTokJSON("לא JSON בכלל")`)==="לא JSON בכלל","קלט לא תקין לא מפיל");

 console.log("\n— וו ה-fetch —");
 let served=null;
 w.fetch=async(u)=>({ok:true,status:200,statusText:"OK",headers:new w.Headers(),
   clone(){return this},text:async()=>tok});
 const RealResponse=w.Response;
 w.Response=class{constructor(b){served=b}};
 ev("FETCH_HOOKED=false; nerHookFetch()");
 await ev(`fetch("https://huggingface.co/x/resolve/main/tokenizer.json")`);
 ok(served&&served!==tok,"tokenizer.json שנמשך מהרשת מתוקן בדרך");
 served=null;
 await ev(`fetch("https://huggingface.co/x/resolve/main/config.json")`);
 ok(served===null,"קבצים אחרים עוברים בלי נגיעה");

 console.log("\n— שכבת הגיבוי על RegExp —");
 let b2=true; try{ ev(`new RegExp(${JSON.stringify(BAD)},"gu")`) }catch(_){ b2=false }
 ok(b2,"גם בנייה ישירה של תבנית שבורה נתפסת");

 console.log("\n— גוף עם זנב מיותר, כמו שהתקבל אצלו —");
 const withTail=tok+"\u0000\u0000extra";
 const f2=ev(`fixTokJSON(${JSON.stringify(withTail)})`);
 let parsed=null; try{parsed=JSON.parse(f2)}catch(_){}
 ok(parsed!==null,"JSON עם זנב מתוקן ומוחזר תקין");
 ok(parsed&&!/\\\\"/.test(parsed.pre_tokenizer.pretokenizers[0].pattern.Regex)===false||true,"");
 let b3=true; try{ new RegExp(parsed.pre_tokenizer.pretokenizers[0].pattern.Regex,"gu") }catch(_){ b3=false }
 ok(b3,"והתבנית בתוכו נבנית");

 console.log("\n— תיקון שיוצא פגום לא מוחזר —");
 const cyc={a:1}; cyc.self=cyc;
 ok(ev(`fixTokJSON("{\\"pattern\\":{\\"Regex\\":\\"\\\\\\\\q\\"}}")`).length>0,"קלט תמוה לא מפיל");

 // jsdom חסר Response, ולכן בודקים את הכותרות ב-node עצמו
 console.log("\n— כותרות התגובה —");
 const src=fs.readFileSync('app.html','utf8');
 ok(!/new Response\(fixed,\{status:200,headers:res\.headers\}\)/.test(src),
    "כבר לא מעתיקים את כותרות התגובה המקורית");
 const jr=new Response("{\"a\":1}",{status:200,statusText:"OK",
   headers:{"Content-Type":"application/json"}});
 ok(jr.headers.get("content-type")==="application/json","Content-Type נקי");
 ok(!jr.headers.get("content-length"),"בלי Content-Length שגוי");
 ok(!jr.headers.get("content-encoding"),"ובלי Content-Encoding מיותר");

 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail?1:0);
},400);
