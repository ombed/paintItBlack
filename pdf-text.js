/* חילוץ טקסט מ-PDF. PDF סרוק (תמונה בלבד) יחזיר טקסט ריק — וזה מדווח כלפי מעלה
   במפורש, כי כלי שמחזיר "לא נמצאו ממצאים" על מסמך סרוק הוא כלי מסוכן. */
const LIB = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs";
const WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs";

export async function pdfToText(buf){
  const pdfjs = await import(/* webpackIgnore: true */ LIB);
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  const doc = await pdfjs.getDocument({data:new Uint8Array(buf)}).promise;
  const out=[];
  for(let p=1; p<=doc.numPages; p++){
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // איחוד פריטים לשורות לפי מיקום אנכי, אחרת כל מילה נופלת לשורה משלה
    const rows=new Map();
    for(const it of tc.items){
      if(!it.str) continue;
      const y=Math.round(it.transform[5]);
      let best=null;
      for(const k of rows.keys()) if(Math.abs(k-y)<=2){best=k;break}
      const key = best===null?y:best;
      (rows.get(key) || rows.set(key,[]).get(key)).push(it);
    }
    [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([,items])=>{
      items.sort((a,b)=>a.transform[4]-b.transform[4]);
      const line=items.map(i=>i.str).join("").replace(/\s+/g," ").trim();
      if(line) out.push(line);
    });
    if(p<doc.numPages) out.push("");
  }
  const text=out.join("\n").trim();
  return {text, pages:doc.numPages, scanned:text.length < doc.numPages*40};
}
