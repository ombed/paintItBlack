/* Transcribed audio: the shape of the documents she actually works on daily,
   and the one shape the corpus did not have.

   Her two real transcripts returned zero candidates from the deterministic
   layer. They are speech typed up from a recording, so there are no "NAME:"
   turns, no titles, no case header. The speaker is written on a line of its
   own, twice in a file, and the rest is continuous utterances. They also carry
   the thing the near-miss layer exists for and the corpus never had: real
   transcription errors, where the same person is typed two different ways.

   These four documents reproduce that shape with invented names. They are the
   instrument the parameter sweep asked for: until now every confusable-letter
   and matres-lectionis setting scored identically, because the corpus had
   three typo entities and other layers found them first. See
   docs/measurements.md, "Parameter sweep". */
module.exports = function audio(Doc, C) {
  const docs = [];

  // conversation about an estate, two speakers, dense typing errors
  {
    const d = new Doc("a1", "audio", "תמלול שיחה");
    const [sp] = d.ent("P_SPEAKERLINE", "NAME", true, "נופר", ["נופר"], "speaker written on a line of its own");
    const [t1, t2] = d.ent("P_TWO_SPELL", "NAME", true, "בוסקילה", ["בוסקילה", "בושקילה"], "ס typed as ש");
    const [t3, t4] = d.ent("P_TWO_SPELL", "NAME", true, "אביתר", ["אביתר", "אביטר"], "ת typed as ט");
    const [pr] = d.ent("P_PROSE", "NAME", true, "צליל", ["צליל"], "only in prose, never before a speech verb");
    d.ent("P_CORRUPT_ONLY", "NAME", true, "וסילייב", ["וסיליב"], "expected to fail: only the corrupted form appears");
    d.p(sp)
     .p("אתם שתהיו בריאים. איך זה קרה בכלל, אני לא מבינה עד היום.")
     .p(`${t1} השתלט על החשבון, וזה מה שהיה. הוא לא הסכים לדבר איתי בכלל.`)
     .p(`אמרתי לו, ${t3}, אתה לא יכול ככה. הוא אמר לי שזה לא ענייני.`)
     .p(`אחר כך ${t2} הביא את הניירות, וגם ${t4} חתם עליהם, וזהו.`)
     .p(`אצל ${pr} זה היה אחרת לגמרי. בשביל ${pr} זה היה פשוט יותר.`)
     .p("הבנתי. ומה עם הדירה? הדירה נשארה על שמו, לפי מה שאמרו לי.")
     .p("עורך הדין וסיליב טיפל בזה, ואני לא יודעת מה קרה שם.");
    docs.push(d);
  }
  // conversation in a ward, a name that also carries a prefix letter
  {
    const d = new Doc("a2", "audio", "תמלול שיחה");
    const [sp] = d.ent("P_SPEAKERLINE", "NAME", true, "שיראל", ["שיראל"], "speaker written on a line of its own");
    const [t1, t2] = d.ent("P_TWO_SPELL", "NAME", true, "מורוזוב", ["מורוזוב", "מורוזוו"], "ב typed as ו");
    const [t3, t4] = d.ent("P_TWO_SPELL", "NAME", true, "אלמליח", ["אלמליח", "אלמליך"], "ח typed as ך");
    const [f1, f2] = d.ent("P_FORMS", "NAME", true, "ולריה עודה", ["ולריה עודה", "עודה"]);
    const [mn] = d.ent("P_MINOR", "NAME", true, "אסיף", ["אסיף"], "minor, first name only");
    d.p(sp)
     .p("עכשיו היא רוצה להחזיר אותו הביתה, וזה לא הולך ככה.")
     .p(`${t1} אמר שהוא לא מוכן, ואני שמעתי את זה במו אוזניי.`)
     .p(`${t3} מהמחלקה כתבה דוח, ובדוח היא כתבה שהמצב לא השתנה.`)
     .p(`${t2} חזר על זה גם אתמול, ו${t4} אישרה שזה מה שנאמר.`)
     .p(`${f1} הגיעה בבוקר עם הילד. ${f2} ביקשה לדבר עם האחות.`)
     .p(`${mn} היה איתה כל הזמן, והוא לא אכל כלום מאז.`)
     .p("אני לא יודעת מה להגיד לך. זה מצב לא פשוט בכלל.");
    docs.push(d);
  }
  // a longer conversation, a matres-lectionis pair and a shared surname
  {
    const d = new Doc("a3", "audio", "תמלול שיחה מוקלטת");
    const [sp] = d.ent("P_SPEAKERLINE", "NAME", true, "טוהר", ["טוהר"], "speaker written on a line of its own");
    const [sp2] = d.ent("P_SPEAKERLINE", "NAME", true, "פיראס", ["פיראס"], "second speaker line, later in the file");
    const [t1, t2] = d.ent("P_TWO_SPELL", "NAME", true, "קוזנצוב", ["קוזנצוב", "קוזנצב"], "matres lectionis: the vav dropped");
    const [s1, s1b] = d.ent("P_SHARED_SURNAME", "NAME", true, "יונס אגבריה", ["יונס אגבריה", "יונס"]);
    const [s2, s2b] = d.ent("P_SHARED_SURNAME", "NAME", true, "סוהא אגבריה", ["סוהא אגבריה", "אגבריה"], "shares a surname with יונס");
    d.p(sp)
     .p("תגידי לי, מה קרה שם בסוף? אני שמעתי גרסה אחרת לגמרי.")
     .p(`${t1} סיפרה לי הכול, ואני האמנתי לה. היא לא הייתה משקרת בדבר כזה.`)
     .p(`${s1} ו${s2} הגיעו ביחד, ושניהם אמרו את אותו הדבר בדיוק.`)
     .p(`${s1b} דיבר ראשון, ואחר כך ${s2b} הוסיפה מה שהיא ראתה.`)
     .p(sp2)
     .p("אני לא הייתי שם, אבל מה שסיפרו לי מתאים למה שאת אומרת עכשיו.")
     .p(`${t2} התקשרה אליי אחר כך ובכתה בטלפון, וזה היה קשה לשמוע.`)
     .p("בסוף הכול הסתדר, אבל לקח לזה הרבה זמן ולא היה פשוט.");
    docs.push(d);
  }
  // a short call, a name typed with a swapped letter pair and a garbled place
  {
    const d = new Doc("a4", "audio", "תמלול שיחת טלפון");
    const [sp] = d.ent("P_SPEAKERLINE", "NAME", true, "ארטיום", ["ארטיום"], "speaker written on a line of its own");
    const [t1, t2] = d.ent("P_TWO_SPELL", "NAME", true, "תורגמן", ["תורגמן", "טורגמן"], "ת typed as ט");
    const [t3, t4] = d.ent("P_TWO_SPELL", "NAME", true, "מקונן", ["מקונן", "מכונן"], "ק typed as כ");
    const [pr] = d.ent("P_PROSE", "NAME", true, "ניב", ["ניב"], "only in prose, never before a speech verb");
    const [ph] = d.ent("I_PHONE", "PII", true, "052-8814903", ["052-8814903"]);
    d.p(sp)
     .p("שלום, אני מתקשר בעניין התיק. אפשר לדבר רגע?")
     .p(`${t1} השאיר לי הודעה אתמול, והמספר שהוא נתן הוא ${ph}.`)
     .p(`${t3} אמר לי שהוא כבר סידר את זה מול המשרד, ואני לא בטוח.`)
     .p(`בסוף ${t2} חזר אליי, ו${t4} כבר לא ענה לטלפון בכלל.`)
     .p(`בעניין של ${pr} עוד לא סגרנו כלום. אצל ${pr} זה תמיד לוקח זמן.`)
     .p("טוב, נדבר מחר. תודה רבה לך, ויום טוב.");
    docs.push(d);
  }

  Object.assign(C, {
    P_SPEAKERLINE: "person: speaker written on a line of its own (no colon)",
  });
  return docs;
};
