const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const errs=[];const vc=new VirtualConsole().on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(fs.readFileSync('app.html','utf8'),
  {runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:"https://x.test/"});
setTimeout(()=>{
 const w=dom.window,d=w.document;
 let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log("  ✗ "+m))};
 const css=[...d.querySelectorAll("style")].map(s=>s.textContent).join("\n");
 console.log("\n— שפה חזותית —");
 ok(/--bg:#F4F2ED/.test(css),"רקע נייר חם");
 ok(/--blue:#1F5B44/.test(css),"ירוק דיו במקום כחול מערכת");
 ok(/--serif:"Noto Serif Hebrew"/.test(css),"גופן סריף עברי למסמך");
 ok(/--sans:Rubik/.test(css),"Rubik לממשק");
 ok(/html\.dark\{/.test(css),"סט טוקנים למצב כהה");
 ok(d.querySelector('link[href*="Noto+Serif+Hebrew"]'),"הגופנים נטענים");
 ok(/--shadow/.test(css)&&/\.grp\{[^}]*box-shadow/.test(css),"כרטיסים מקבלים עומק");

 console.log("\n— מצב כהה —");
 const t=d.getElementById("thm");
 ok(t,"יש מתג");
 const before=d.documentElement.classList.contains("dark");
 t.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
 ok(d.documentElement.classList.contains("dark")!==before,"המתג מחליף מצב");
 ok(w.localStorage.getItem("hedact-theme")===(before?"light":"dark"),"והבחירה נשמרת");
 t.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
 ok(d.documentElement.classList.contains("dark")===before,"וחוזר");

 console.log("\n— כל המשתנים שבשימוש מוגדרים —");
 const used=new Set([...css.matchAll(/var\(--([a-z0-9-]+)\)/g)].map(m=>m[1]));
 const defd=new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m=>m[1]));
 const miss=[...used].filter(v=>!defd.has(v));
 ok(miss.length===0,"אין משתנה חסר: "+miss.join(", "));
 const darkBlk=css.slice(css.indexOf("html.dark{"),css.indexOf("}",css.indexOf("html.dark{")));
 const darkDef=new Set([...darkBlk.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m=>m[1]));
 const colorish=[...used].filter(v=>/bg|card|paper|label|ink|sep|fill|nav|blue|green|orange|red|gray|indigo|shadow/.test(v));
 const noDark=colorish.filter(v=>!darkDef.has(v));
 ok(noDark.length===0,"לכל צבע יש מקבילה כהה, חסרים: "+noDark.join(", "));

 console.log("\nerrors: "+(errs.length?errs.join("\n"):"none"));
 console.log(`${pass} passed, ${fail} failed\n`);
 process.exit(fail||errs.length?1:0);
},400);
