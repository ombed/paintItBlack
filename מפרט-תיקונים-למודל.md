# מפרט תיקונים — כדי שהזיהוי החכם יעבוד

מסמך להעברה ל-Claude Design. מכיל את התיקונים המדויקים שגרמו למודל
הזיהוי העברי לעבוד, ואת מבנה הקבצים הנדרש לפריסה.

הקוד כאן **לא תיאור — הוא הקוד עצמו**. כדאי להעתיק אותו כמו שהוא.

---

## הרקע בשתי שורות

הכלי מחליף פרטים מזהים במסמך Word לפני שליחה לכלי AI, ומחזיר את
השמות האמיתיים לתשובה. שכבת הזיהוי מריצה מודל NER עברי
(`onnx-community/dictabert-ner-ONNX`) דרך transformers.js, **בדפדפן
של המשתמשת**. שום מסמך לא עוזב את המחשב.

בלי ארבעת התיקונים שלהלן המודל **לא נטען כלל**.

---

## תיקון 1 — הטוקנייזר של DictaBERT לא נבנה ב-JavaScript

**התסמין:** `SyntaxError: Invalid regular expression … Invalid escape`

**הסיבה:** `tokenizer.json` של DictaBERT מכיל תבנית לזיהוי ראשי תיבות
עבריים (`עו"ד`, `ת"ז`, `ביה"ס`) ובתוכה `\"`. זה escape חוקי במנוע
ה-regex של Rust שבו נבנה המודל, ו**לא חוקי ב-JavaScript תחת דגל `u`**.
אי-התאמה בין שני מנועי regex — לא באג במודל.

**הפתרון:** לתקן את קובץ הטוקנייזר לפני ש-transformers.js רואה אותו.

> ניסיון קודם עטף את `RegExp` הגלובלי. **זה לא עובד** — מודול שנטען
> מ-CDN לא בהכרח פותר את השם דרך המשתנה הגלובלי שלנו. חייבים לתקן
> את הנתון, לא את המנוע.

### קבועים תומכים

```js
const RX_NATIVE=RegExp;
const TOK_URL=()=>`https://huggingface.co/${NER_MODEL}/resolve/main/tokenizer.json`;
let RAW_FETCH=null;
```

**חשוב:** `rxBad` חייב לשאול את הבנאי המקורי:

```js
function rxBad(p){ try{new RX_NATIVE(p,"u");return false}catch(_){return true} }
```

אם הוא ישאל את `RegExp` הרגיל אחרי שנעטף, העטיפה תבלע את השגיאה,
כל תבנית תיראה תקינה, ו**שום דבר לא יתוקן**. זה באג שנפלתי עליו.

### fixTokJSON

```js
function fixTokJSON(txt){
  let j=null,repaired=false;
  try{j=JSON.parse(txt)}
  catch(e){
    // "תו מיותר אחרי סוף ה-JSON" — קורה כשנשמר גוף עם כותרות אורך
    // שלא תואמות לו. חותכים לסוגר האחרון ומנסים שוב.
    const k=txt.lastIndexOf("}");
    if(k>0){try{j=JSON.parse(txt.slice(0,k+1));repaired=true}catch(_){}}
    if(!j){console.warn("tokenizer.json לא ניתן לפענוח:",e.message);return txt}
    console.warn("tokenizer.json הכיל זנב מיותר —",txt.length-(k+1),"תווים נחתכו");
  }
  let n=0;
  (function walk(o){
    if(!o||typeof o!=="object")return;
    for(const k of Object.keys(o)){
      const v=o[k];
      if(typeof v==="string"){
        if((k==="Regex"||k==="pattern")&&rxBad(v)){
          const f=rxClean(v);
          if(!rxBad(f)){o[k]=f;n++}
        }
      } else walk(v);
    }
  })(j);
  if(n)console.log(`תוקנו ${n} תבניות בטוקנייזר`);
  if(!n&&!repaired)return txt;
  const out=JSON.stringify(j);
  // לא מחזירים משהו שלא נבדק — עדיף הקובץ המקורי מקובץ שבור
  try{JSON.parse(out)}catch(_){console.warn("התיקון יצא פגום, מחזירים מקור");return txt}
  return out;
}
```

---

## תיקון 2 — כותרות תגובה שגויות שברו את ה-JSON

**התסמין:** `Unexpected non-whitespace character after JSON at position 1891617`

**הסיבה:** בניית התגובה המתוקנת העתיקה את כותרות המקור
(`headers: res.headers`), כולל `Content-Length` ואולי `Content-Encoding`.
הכותרות מתארות את הגוף הישן; הגוף התחלף. התוצאה — JSON תקין ואחריו זנב.

**הפתרון:** תגובה נקייה, בלי כותרות מורשות.

```js
let jsonRes=body=>new Response(body,{status:200,statusText:"OK",
  headers:{"Content-Type":"application/json"}});
```

### nerFixCached — עם אימות בקריאה חוזרת

```js
async function nerFixCached(){
  let n=0;
  try{
    if(!nerEnv().canCache)return 0;
    const c=await caches.open(NER_CACHE);
    for(const req of await c.keys()){
      if(!/tokenizer\.json/.test(req.url))continue;
      const res=await c.match(req); if(!res)continue;
      let txt; try{txt=await res.clone().text()}catch(_){await c.delete(req);continue}
      const fixed=fixTokJSON(txt);
      if(fixed===txt)continue;
      await c.put(req,jsonRes(fixed));
      // אימות: קוראים בחזרה ומוודאים שזה באמת JSON תקין
      let ok=false;
      try{const back=await c.match(req); JSON.parse(await back.text()); ok=true}catch(_){}
      if(ok)n++;
      else{await c.delete(req);console.warn("העותק השמור נמחק; יירד מחדש מתוקן")}
    }
  }catch(e){console.warn("תיקון המטמון נכשל",e)}
  return n;
}
```

### nerHookFetch

```js
function nerHookFetch(){
  if(FETCH_HOOKED)return; FETCH_HOOKED=true;
  const orig=window.fetch.bind(window);
  RAW_FETCH=orig;
  window.fetch=async function(input,init){
    const res=await orig(input,init);
    try{
      const url=typeof input==="string"?input:(input&&input.url)||"";
      if(!/tokenizer\.json(\?|$)/.test(url)||!res.ok)return res;
      const txt=await res.clone().text();
      const fixed=fixTokJSON(txt);
      if(fixed===txt)return res;
      return jsonRes(fixed);
    }catch(e){console.warn("וו ה-fetch נכשל",e);return res}
  };
}
```

---

## תיקון 3 — הכנה מפורשת במקום ווים

ווים על `fetch` ועל המטמון עובדים, אבל אי אפשר לדעת אם הם רצו.
ההכנה המפורשת מורידה את הקובץ בעצמה, מדווחת על כל שלב, מתקנת,
מאמתת, ורק אז שמה במטמון. **זה מה שסגר את הבאג בפועל.**

```js
async function nerPrepTokenizer(report){
  const say=m=>{console.log("טוקנייזר: "+m); if(report)report(m)};
  const url=TOK_URL();
  const out={url,steps:[]};
  const step=(k,v)=>{out.steps.push(k+": "+v); say(k+": "+v)};
  if(!nerEnv().canCache){step("סביבה","אין מטמון — מדלגים");return out}
  const c=await caches.open(NER_CACHE);
  // כל עותק קיים חשוד; מוחקים ומתחילים נקי
  let dropped=0;
  for(const k of await c.keys())
    if(/tokenizer\.json/.test(k.url)){await c.delete(k);dropped++}
  step("עותקים ישנים שנמחקו",dropped);
  const f=RAW_FETCH||window.fetch.bind(window);
  const res=await f(url,{cache:"reload"});
  step("הורדה",res.status+" "+(res.ok?"תקין":"נכשל"));
  if(!res.ok)throw new Error("לא הצלחתי להוריד את קובץ הטוקנייזר ("+res.status+")");
  const txt=await res.text();
  step("אורך",txt.length+" תווים");
  // האם המקור בכלל תקין, ואם לא — איפה בדיוק
  try{JSON.parse(txt);step("המקור","JSON תקין")}
  catch(e){
    const m=/position (\d+)/.exec(e.message);
    const p=m?+m[1]:-1;
    step("המקור פגום",e.message.slice(0,60));
    if(p>=0)step("סביבת התקלה",JSON.stringify(txt.slice(Math.max(0,p-40),p+40)));
  }
  const fixed=fixTokJSON(txt);
  step("אחרי תיקון",fixed.length+" תווים"+(fixed===txt?" (ללא שינוי)":""));
  try{JSON.parse(fixed);step("התוצאה","JSON תקין")}
  catch(e){throw new Error("התיקון לא הצליח: "+e.message.slice(0,60))}
  await c.put(url,jsonRes(fixed));
  const back=await c.match(url);
  if(!back)throw new Error("הכתיבה למטמון נכשלה");
  const bt=await back.text();
  step("קריאה חוזרת",bt.length+" תווים");
  try{JSON.parse(bt);step("במטמון","JSON תקין ✓")}
  catch(e){
    await c.delete(url);
    throw new Error("מה שנשמר במטמון פגום: "+e.message.slice(0,60));
  }
  out.ok=true;
  return out;
}
```

### חיבור למסלול הטעינה

בתוך `nerLoad`, מיד לפני `await import(NER_LIB)`:

```js
    nerHookFetch();
    try{ await nerPrepTokenizer(); }
    catch(e){ console.warn("הכנת הטוקנייזר נכשלה",e); }
    const t=await import(/* webpackIgnore: true */ NER_LIB);
```

---

## תיקון 4 — מונה סריקות בממשק

**התסמין:** מסמך שני שהועלה בזמן סריקה של הראשון נדבק בשמות מהראשון.
שמות מתיק א׳ מופיעים ברשימה של תיק ב׳ — דליפה בכיוון ההפוך.

הנעילה בזמן סריקה (`scanning`) כבר קיימת בקוד. מה שחסר הוא מונה
שזורק תוצאה של מסמך נטוש. בתוך המחלקה:

```js
  // בכניסה לסריקה
  const my = this._scan = (this._scan||0) + 1;
  this.setState({nerBox:true, peoNote:"", scanning:true, nerMsg:"טוען את המודל…", nerPct:0});
  try{
    const found = await E.nerRun(blocks, pct=>{
      if(my!==this._scan) return;                    // עדכון התקדמות נטוש
      this.setState({nerMsg:`סורק את המסמך… ${Math.round(pct)}%`, nerPct:pct});
    });
    if(my!==this._scan) return;                      // תוצאה של מסמך שהוחלף
    const list=[...this.state.peo]; let added=0;
    // …
  }catch(e){
    if(my!==this._scan) return;                      // גם הודעת שגיאה נטושה
    // …
  }finally{
    if(my===this._scan) this.setState({scanning:false});   // רק הנוכחית משחררת
  }
```

---

## מה לא לשנות

`ctxHTML` בגרסה הקיימת מחזירה אובייקט מובנה `{pre,hit,post}` במקום
מחרוזת HTML. **זה נכון ל-React ועדיף.** לא להחליף.

---

## מבנה הקבצים לפריסה

ארבעה קבצים סטטיים באותה כתובת `https`:

```
index.html              הכלי
sw.js                   עובד שירות
manifest.webmanifest    כדי שניתן יהיה להתקין
icon.svg
```

**למה חייבים כתובת ולא קובץ מקומי:** דפדפנים מתייחסים ל-`file://`
כמקור אטום — אין Cache API, אין IndexedDB, ו-`import` דינמי נחסם
ב-CORS. מקובץ מקומי המודל לא רק שלא נשמר, הוא בכלל לא נטען.
הכלי מזהה את המצב ואומר את זה למשתמשת במקום להיכשל בשקט.

### sw.js — רשת קודם, לא מטמון קודם

```js
const V="hedact-v8";
// הכלי עצמו: רשת קודם, מטמון כגיבוי כשאין רשת.
// מטמון קודם נראה מהיר יותר, אבל אז כל עדכון מגיע רק בטעינה
// השנייה — דרך בטוחה להריץ קוד ישן בלי לדעת.
if(u.origin===location.origin){
  e.respondWith((async()=>{
    const c=await caches.open(V);
    try{
      const res=await fetch(e.request,{cache:"no-cache"});
      if(res&&res.ok)c.put(e.request,res.clone());
      return res;
    }catch(_){
      return (await c.match(e.request,{ignoreSearch:true}))||
             (await c.match("./index.html"))||Response.error();
    }
  })());
}
// משקלי המודל מנוהלים ע"י transformers.js במטמון משלו — לא לגעת
if(u.hostname.includes("huggingface.co"))return;
// ספריית ההרצה והגופנים: מטמון קודם, הם נעולים לגרסה בכתובת
if(u.hostname==="cdn.jsdelivr.net"||u.hostname==="fonts.googleapis.com"||
   u.hostname==="fonts.gstatic.com"){ /* cache-first */ }
```

### אחסון קבוע

לפני ההורדה, כדי שהדפדפן לא ימחק את המודל כשנגמר מקום:

```js
if(navigator.storage&&navigator.storage.persist&&
   !await navigator.storage.persisted()) await navigator.storage.persist();
```

---

## שני דברים שחוסכים סבבי דיבוג

**מספר גרסה גלוי** בתחתית המסך הראשון וגם ל-console. בלי זה בזבזנו
שלושה סבבים על מטמון ישן בלי לדעת.

**שורת אבחון** מ-`nerRun`:

```
זיהוי: 95 קטעים (74210/74350 תווים) · 312 חיזויים גולמיים ·
       0 עם היסט מהצינור · 47 ישויות · 21 אחרי סינון
```

יחס התווים הוא בדיקת השפיות: אם המספר הראשון קטן מהשני, חלק
מהמסמך לא נסרק.

---

## בדיקת קבלה

1. הגרסה למטה מתעדכנת אחרי העלאה (בלי לנקות מטמון ידנית)
2. `{{ }}` לא מופיעים על המסך — אף אחד מהם
3. "זיהוי חכם" דלוק → גרירת docx → המודל יורד ומסיים בלי שגיאה
4. בקונסול: `טוקנייזר: … JSON תקין ✓` ואחריו שורת `זיהוי:`
5. רשימת "מי בתיק" מתמלאת בשמות מהמסמך
6. החלפת מסמך באמצע סריקה — שמות מהראשון לא נכנסים לשני
7. מ-`file://` מופיעה הודעה מסודרת, ושאר הכלי עובד
