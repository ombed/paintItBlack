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
    const count=(its,rx)=>(its.map(i=>i.str).join("").match(rx)||[]).length;
    const pageRtl=count(tc.items,/[א-ת]/g)>=count(tc.items,/[A-Za-z]/g);
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
      /* שורה עברית נקראת מימין לשמאל, ולכן הפריט הראשון שלה הוא הימני ביותר. מיון עולה לפי x
         הפך כל שורה עברית שפוצלה לכמה פריטים — מספיקה מילה מודגשת אחת — ו"האם רונית לוי
         מתגוררת בחיפה" יצא "מתגוררת בחיפה רונית לוי האם": שם שנחצה בין שני פריטים יצא הפוך ולא
         נמצא, בלי שום שגיאה (חשד מהביקורת, אושר בהרצה). הטקסט שבתוך כל פריט כבר בסדר קריאה. */
      // שורה בלי אותיות בכלל (מספרים בלבד) הולכת אחרי הכיוון של העמוד
      const he=count(items,/[א-ת]/g), la=count(items,/[A-Za-z]/g), rtl=he+la?he>=la:pageRtl;
      items.sort((a,b)=>rtl?b.transform[4]-a.transform[4]:a.transform[4]-b.transform[4]);
      const line=items.map(i=>i.str).join("").replace(/\s+/g," ").trim();
      if(line) out.push(line);
    });
    if(p<doc.numPages) out.push("");
  }
  const text=out.join("\n").trim();
  return {text, pages:doc.numPages, scanned:text.length < doc.numPages*40};
}
