/* עובד שירות: הופך את הכלי למותקן.
   אחרי ביקור אחד, גם הכלי עצמו וגם המודל יושבים במחשב שלה,
   והכל עובד בלי אינטרנט. */
const SHELL="hedact-shell-v1";
const FILES=["./","./index.html","./manifest.webmanifest"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())
      if(k.startsWith("hedact-shell-")&&k!==SHELL)await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;

  // ספריית המודל מה-CDN: שומרים עותק, אחרת אין אינטרנט ואין זיהוי
  if(u.hostname==="cdn.jsdelivr.net"){
    e.respondWith((async()=>{
      const c=await caches.open(SHELL);
      const hit=await c.match(e.request);
      if(hit)return hit;
      const res=await fetch(e.request);
      if(res.ok)c.put(e.request,res.clone());
      return res;
    })());
    return;
  }

  // משקלי המודל מנוהלים ע"י transformers.js במטמון משלו — לא נוגעים
  if(u.hostname.includes("huggingface.co"))return;

  // הכלי עצמו: מהמטמון קודם, ורענון ברקע כשיש רשת
  if(u.origin===location.origin){
    e.respondWith((async()=>{
      const c=await caches.open(SHELL);
      const hit=await c.match(e.request,{ignoreSearch:true});
      const net=fetch(e.request).then(res=>{
        if(res.ok)c.put(e.request,res.clone());
        return res;
      }).catch(()=>hit);
      return hit||net;
    })());
  }
});
