const {JSDOM}=require('jsdom');
const fs=require('fs');
const html=fs.readFileSync('app.html','utf8');
const errs=[],warns=[];
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,
  virtualConsole:new (require('jsdom').VirtualConsole)()
    .on("jsdomError",e=>errs.push(e.message))
    .on("error",m=>errs.push(String(m)))
    .on("warn",m=>warns.push(String(m)))
    .on("log",m=>warns.push("log: "+String(m)))});
setTimeout(()=>{
  const d=dom.window.document;
  const ids=["nearWrap","mseg","mnote","oNear","oPlaces","oAuto","cp","dl","cpTxt","aiWarn",
    "aiIn","aiGo","cpBack","list","fseg","cats","note","stat","vf","sheet","addV","addR",
    "addK","addBtn","peoWrap","peoIn","peoAdd","peoGo","peoProf","sugWrap","oNer","nerBox","nerMsg","nerBar","nerHint","mineWrap","geoWrap","caseFile","rvIn","rvGo","rvOut","toRv","s1","s2","s3","s4"];
  const missing=ids.filter(i=>!d.getElementById(i));
  console.log("elements missing:",missing.length?missing.join(", "):"none");
  console.log("mode note rendered:",JSON.stringify((d.getElementById("mnote").textContent||"").slice(0,40)));
  console.log("mode buttons:",[...d.querySelectorAll("#mseg button")].map(b=>b.textContent+(b.className.includes("on")?"*":"")).join(" | "));
  console.log("footer primary:",d.getElementById("cp").className,"| secondary:",d.getElementById("dl").className);
  console.log("ner hint (file://):",(d.getElementById("nerHint").textContent||"").slice(0,45));
  console.log("ner toggle disabled on file://:",d.getElementById("oNer").disabled);
  console.log("s2 heading:",d.querySelector("#s2 h1").textContent);
  console.log("rail order:",[...d.querySelectorAll("#pfind > .hd")].map(x=>x.textContent).join(" → "));
  console.log("errors:",errs.length?errs.join("\n"):"none");
  console.log("warnings:",warns.length?warns.join("\n"):"none");
  process.exit(errs.length?1:0);
},400);
