s=open('app.html',encoding='utf-8').read()
js=s.split('<script>',1)[1].rsplit('</script>',1)[0]
open('app.js','w',encoding='utf-8').write(js)
i=js.index('/* ══════════════════════════ ממשק ══════════════════════════ */')
a=js.index('function pseudoRX(p){'); b=js.index('function livePairs(){')
n1=js.index('const RX_NATIVE=RegExp;'); n2=js.index('let FETCH_HOOKED=false;')
g1=js.index('function nerAlign(text,toks,off){'); g2=js.index('async function nerRun(')
open('core.js','w',encoding='utf-8').write(js[:i]+"\n"+js[a:b]+"\n"+js[n1:n2]+"\n"+js[g1:g2]+"\nmodule.exports={norm,near1,findNear,restoreNames,fakeName,gender,origin,POOL,STOP,PLACE_BY,Engine,ckey,variants,hord,words,pseudoRX,hash32,discover,anchored,partName,ctxHTML,findPlaces,esc,GF,GM,bodyNames,nameish,VRB,COMMON,nerClean,nerChunks,PUBLIC_ORG,nerAlign,nerGroup,fixTokJSON,rxClean};\n")
