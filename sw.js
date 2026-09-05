/* עובד שירות: הופך את הכלי למותקן.
   אחרי ביקור אחד, גם הכלי וגם ספריית ההרצה יושבים במחשב, והכל
   עובד בלי אינטרנט.

   שים לב לאסטרטגיה: הכלי עצמו נטען קודם מהרשת ורק בנפילה מהמטמון.
   ההפך — מטמון קודם — נראה מהיר יותר, אבל אז כל עדכון מגיע רק
   בטעינה השנייה, וזו דרך בטוחה להריץ קוד ישן בלי לדעת. */
const V="hedact-v11";
const FILES=["./","./index.html","./manifest.webmanifest","./icon.svg",
  "./support.js","./redact-engine.js","./pdf-text.js","./text-to-docx.js"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(V)
    .then(c=>Promise.allSettled(FILES.map(f=>c.add(f))))
    .then(()=>self.skipWaiting()));
});

self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())
      if(k.startsWith("hedact-")&&k!==V)await caches.delete(k);
    await self.clients.claim();
  })());
});

// הודעה מהעמוד: לרוקן ולהתעדכן עכשיו
self.addEventListener("message",e=>{
  // העמוד שואל איזו גרסה מוגשת לו בפועל — כך מטמון ישן מסגיר את עצמו
  if(e.data==="version"&&e.source){e.source.postMessage({sw:V});return}
  if(e.data==="refresh")e.waitUntil((async()=>{
    for(const k of await caches.keys())
      if(k.startsWith("hedact-"))await caches.delete(k);
    await self.registration.update();
  })());
});

self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;

  // משקלי המודל מנוהלים ע"י transformers.js במטמון משלו — לא נוגעים
  if(u.hostname.includes("huggingface.co"))return;

  // ספריית ההרצה מה-CDN: מטמון קודם. היא נעולה לגרסה מדויקת בכתובת
  // ולכן לא משתנה מתחתינו.
  // גופנים מ-Google וספריית ההרצה: מטמון קודם, כדי שגם ללא רשת
  // הכלי ייראה כמו שצריך
  // unpkg מגיש את React ואת d3/topojson בכתובות נעולות-גרסה, ולכן אותו כלל.
  // בלי זה הכלי לא עולה בלי רשת גם אחרי ביקור מוצלח.
  if(u.hostname==="cdn.jsdelivr.net"||u.hostname==="unpkg.com"||
     u.hostname==="fonts.googleapis.com"||u.hostname==="fonts.gstatic.com"){
    e.respondWith((async()=>{
      const c=await caches.open(V);
      const hit=await c.match(e.request);
      if(hit)return hit;
      const res=await fetch(e.request);
      if(res.ok)c.put(e.request,res.clone());
      return res;
    })());
    return;
  }

  // הכלי עצמו: רשת קודם, מטמון כגיבוי כשאין רשת.
  // נוגעים במפורש רק בשמונת הקבצים שלנו. כל בקשה אחרת עוברת ישר לרשת:
  // עובד שירות שמושך אליו כל מה שבמקור שובר כל מה שיושב לידו.
  const MINE=/(?:^|\/)(?:index\.html|support\.js|redact-engine\.js|pdf-text\.js|text-to-docx\.js|manifest\.webmanifest|icon(?:-\d+)?\.(?:svg|png))$|\/$/;
  if(u.origin===location.origin&&MINE.test(u.pathname)){
    e.respondWith((async()=>{
      const c=await caches.open(V);
      try{
        const res=await fetch(e.request,{cache:"no-cache"});
        if(res&&res.ok)c.put(e.request,res.clone());
        return res;
      }catch(_){
        const hit=await c.match(e.request,{ignoreSearch:true});
        return hit||await c.match("./index.html")||Response.error();
      }
    })());
  }
});
