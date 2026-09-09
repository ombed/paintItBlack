/* The second half of the corpus: five genres the first half did not have,
   two-letter surnames, minors introduced by the word הקטין, and the PII
   that is not a name: ID numbers, phones, emails, bank accounts, plates,
   dates of birth. Same rules as generate.js: every surface is embedded from
   the entity object, and every name is unknown to the tool's lexicons.

   PII surfaces are digits and addresses; the disjointness check skips them.
   The ID numbers are valid by check digit, because the detector verifies it. */
module.exports = function more(Doc, C) {
  const docs = [];
  const PUBLIC = ["בית המשפט לענייני משפחה", "משרד הרווחה", "המוסד לביטוח לאומי", "משרד הבריאות", "משטרת ישראל"];

  // a valid Israeli ID from an 8-digit stem
  const tz = (stem) => {
    const d = String(stem).padStart(8, "0"); let t = 0;
    for (let i = 0; i < 8; i++) { let n = +d[i] * (i % 2 ? 2 : 1); t += n < 10 ? n : n - 9; }
    return d + String((10 - (t % 10)) % 10);
  };
  const stamp = (d, h) => `[${d}, ${h}]`;

  // ── welfare reports ─────────────────────────────────────────────────────────
  {
    const d = new Doc("w1", "welfare", "תסקיר סעד");
    const [s2, s2b] = d.ent("P_SUR2", "NAME", true, "ליעד כץ", ["ליעד כץ", "כץ"], "two-letter surname");
    const [mn, mnb] = d.ent("P_MINOR_ANCH", "NAME", true, "אגם", ["הקטינה אגם", "אגם"], "minor introduced by הקטינה");
    const [t1, t1b] = d.ent("P_TITLE", "NAME", true, "שיראל שטרית", ['עו"ס שיראל שטרית', "שטרית"]);
    const [id] = d.ent("I_ID", "PII", true, tz(31427706), ['ת"ז ' + tz(31427706)]);
    const [ph] = d.ent("I_PHONE", "PII", true, "052-6613874", ["052-6613874"]);
    const [l1] = d.ent("L_TOWN", "PLACE", true, "כפר האורנים", ["כפר האורנים"]);
    d.ent("O_PUBLIC", "ORG", false, PUBLIC[1], [PUBLIC[1]]);
    d.ent("T_NUMBERS", "TRAP", false, "סעיף 3", ["סעיף 3"]);
    d.ent("I_DATE", "PII", true, "11.2.2026", ["11.2.2026"], "full date, omitted by default");
    d.p(`תסקיר סעד — ${PUBLIC[1]}, לשכת הרווחה`)
     .p(`בעניין ${mn}, בת ${s2}, ${id}. האב ${s2b} מתגורר ב${l1} ומספר הטלפון שלו ${ph}.`)
     .p(`${t1} ביקרה בבית ביום 11.2.2026. לדבריה ${mnb} משתפת פעולה, אך מסרבת לדבר על האב. ${s2b} טוען שהאם מסיתה נגדו.`)
     .p(`${t1b} ממליצה על הסדרי שהות מודרגים לפי סעיף 3 להסכם. ${mnb} תמשיך בטיפול רגשי. ${s2b} יעודכן בכתב.`)
     .p(`המלצה: ליווי של עו"ס משפחה במשך שישה חודשים, ודיווח חוזר ללשכה.`);
    docs.push(d);
  }
  {
    const d = new Doc("w2", "welfare", "תסקיר סעד");
    const [f1, f2, f3] = d.ent("P_FORMS", "NAME", true, "טוהר בוסקילה", ["טוהר בוסקילה", "בוסקילה", "טוהר"]);
    const [mn, mnb] = d.ent("P_MINOR_ANCH", "NAME", true, "ניב", ["הקטין ניב", "ניב"], "minor introduced by הקטין");
    const [dob] = d.ent("I_DOB", "PII", true, "3.4.2017", ["יליד 3.4.2017"]);
    const [et1, et1b] = d.ent("P_ETHIOPIAN", "NAME", true, "טסנש מקונן", ["טסנש מקונן", "מקונן"]);
    const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "פנימיית גבעת הרימון", ["פנימיית גבעת הרימון", "גבעת הרימון"]);
    const [nb] = d.ent("L_NEIGHBOURHOOD", "PLACE", true, "שכונת נווה חן", ["שכונת נווה חן"]);
    d.ent("T_PLONI", "TRAP", false, "פלוני", ["פלוני"]);
    d.p("תסקיר סעד — הסדרי שהות")
     .p(`${mn}, ${dob}, בנם של ${f1} ושל פלוני שאינו רשום. ${f2} מבקש משמורת מלאה.`)
     .p(`${et1}, המדריכה ב${o1}, מסרה כי ${mnb} מגיע נקי ומטופל. ${et1b} ציינה קושי בהתמדה בלימודים.`)
     .p(`${f3} מתגורר ב${nb}, במרחק הליכה מ${o1b}. ${mnb} מבקר אצלו בסופי שבוע.`)
     .p(`המלצה: המשך שהות ב${o1b} בימי חול, וסופי שבוע אצל ${f2}.`);
    docs.push(d);
  }
  {
    const d = new Doc("w3", "welfare", "דוח ביקור בית");
    const [a1, a1b] = d.ent("P_ARABIC", "NAME", true, "מרווה עבאס", ["מרווה עבאס", "עבאס"]);
    const [s2, s2b] = d.ent("P_SUR2", "NAME", true, "מתן צח", ["מתן צח", "צח"], "two-letter surname");
    const [sh1, sh1b] = d.ent("P_SHARED_SURNAME", "NAME", true, "סלים מנסור", ["סלים מנסור", "סלים"]);
    const [sh2, sh2b] = d.ent("P_SHARED_SURNAME", "NAME", true, "חנין מנסור", ["חנין מנסור", "מנסור"], "shares a surname with סלים");
    const [id] = d.ent("I_ID", "PII", true, tz(20554961), [tz(20554961)], "bare, unlabeled");
    const [ph] = d.ent("I_PHONE", "PII", true, "054-9920317", ["054-9920317"]);
    d.ent("O_PUBLIC", "ORG", false, PUBLIC[2], [PUBLIC[2]]);
    d.ent("T_NUMBERS", "TRAP", false, "סעיף 12", ["סעיף 12"]);
    d.ent("I_DATE", "PII", true, "7.7.2026", ["7.7.2026"], "full date, omitted by default");
    d.p("דוח ביקור בית — 7.7.2026")
     .p(`ביקרתי אצל ${a1} (${id}, טלפון ${ph}). ${a1b} גרה עם בן זוגה ${s2} ועם שני ילדיה.`)
     .p(`${sh1} ו${sh2}, ההורים של ${a1b}, מתגוררים בקומה מעל. ${sh1b} מסייע בהסעות, ${sh2b} שומרת על הילדים.`)
     .p(`${s2b} עובד במשמרות. לדברי ${a1b} הוא מעורב, אבל ${sh2b} מסרה תמונה אחרת. לפי סעיף 12 לנוהל יש לתעד.`)
     .p(`${PUBLIC[2]} משלם קצבת ילדים. ${s2b} מבקש שהקצבה תועבר אליו. סיכמנו ביקור נוסף בעוד חודש.`);
    docs.push(d);
  }
  {
    const d = new Doc("w4", "welfare", "חוות דעת");
    const [ru1, ru1b] = d.ent("P_RUSSIAN", "NAME", true, "אלינה פופוב", ["אלינה פופוב", "פופוב"]);
    const [mn, mnb] = d.ent("P_MINOR_ANCH", "NAME", true, "ליה", ["הקטינה ליה", "ליה"], "minor introduced by הקטינה");
    const [em] = d.ent("I_EMAIL", "PII", true, "alina.p1984@gmail.com", ["alina.p1984@gmail.com"]);
    const [bk] = d.ent("I_BANK", "PII", true, "חשבון 0418822", ["חשבון 0418822"]);
    const [st, stb] = d.ent("L_STREET", "PLACE", true, "רחוב הגפן 3", ["רחוב הגפן 3", "הגפן"]);
    const [pr] = d.ent("P_PROSE", "NAME", true, "אסיף", ["אסיף"], "never before a speech verb");
    d.ent("T_NUMBERS", "TRAP", false, "סעיף 8(א)", ["סעיף 8(א)"]);
    d.ent("I_DATE", "PII", true, "1.1.2026", ["1.1.2026"], "full date, omitted by default");
    d.p("חוות דעת — עו\"ס לסדרי דין")
     .p(`${ru1}, אמה של ${mn}, פנתה בדוא"ל ${em}. היא מתגוררת ב${st} מאז 1.1.2026.`)
     .p(`${ru1b} מבקשת שמזונות ${mnb} יועברו ל${bk} בבנק. במקרה של ${pr}, אחיה הגדול, ההסדר הקיים נשאר.`)
     .p(`${mnb} בת תשע. בשביל ${pr} ובשביל ${mnb} חשוב שהמעבר מ${stb} יהיה מתואם. לפי סעיף 8(א) לתקנות נדרשת חוות דעת משלימה.`)
     .p(`המלצה: הסדר קיים ל${pr}, והרחבה הדרגתית ל${mnb}. ${ru1b} תעדכן בכתב.`);
    docs.push(d);
  }

  // ── medical summaries ───────────────────────────────────────────────────────
  {
    const d = new Doc("h1", "medical", "סיכום ביקור");
    const [t1, t1b] = d.ent("P_TITLE", "NAME", true, "אביתר יפרח", ['ד"ר אביתר יפרח', "יפרח"]);
    const [mn] = d.ent("P_MINOR", "NAME", true, "אבישג", ["אבישג"], "minor, first name only");
    const [id] = d.ent("I_ID", "PII", true, tz(33812047), ['ת.ז. ' + tz(33812047)]);
    const [dob] = d.ent("I_DOB", "PII", true, "14.6.2019", ["ילידת 14.6.2019"]);
    const [ph] = d.ent("I_PHONE", "PII", true, "050-2278461", ["050-2278461"]);
    const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "מרפאת נוף הים", ["מרפאת נוף הים", "נוף הים"]);
    d.ent("O_PUBLIC", "ORG", false, PUBLIC[3], [PUBLIC[3]]);
    d.ent("T_NUMBERS", "TRAP", false, "2.3.2026", ["סעיף 4"]);
    d.ent("I_DATE", "PII", true, "2.3.2026", ["2.3.2026"], "full date, omitted by default");
    d.p(`${o1} — סיכום ביקור מיום 2.3.2026`)
     .p(`המטופלת: ${mn}, ${dob}, ${id}. ליווי: האם, טלפון ${ph}.`)
     .p(`${t1} בדק את ${mn} ומצא שיפור בתפקוד. ${t1b} ממליץ על המשך מעקב ב${o1b} אחת לחודש.`)
     .p(`לפי סעיף 4 לחוזר ${PUBLIC[3]}, הדיווח הועבר ללשכה. ${mn} תוזמן לבדיקה חוזרת.`)
     .p(`חתימה: ${t1b}, רופא ילדים.`);
    docs.push(d);
  }
  {
    const d = new Doc("h2", "medical", "סיכום אשפוז");
    const [f1, f2, f3] = d.ent("P_FORMS", "NAME", true, "יסמין אלמליח", ["יסמין אלמליח", "אלמליח", "יסמין"]);
    const [hy1, hy2] = d.ent("P_HYPHEN", "NAME", true, "כרים אבו-סרחאן", ["כרים אבו-סרחאן", "אבו סרחאן"]);
    const [id] = d.ent("I_ID", "PII", true, tz(28711309), ['ת"ז ' + tz(28711309)]);
    const [em] = d.ent("I_EMAIL", "PII", true, "yasmin.alm@walla.co.il", ["yasmin.alm@walla.co.il"]);
    const [l1] = d.ent("L_TOWN", "PLACE", true, "צור יצחק", ["צור יצחק"]);
    d.ent("T_NUMBERS", "TRAP", false, "18.8.2025", ["סעיף 2(ג)"]);
    d.ent("I_DATE", "PII", true, "18.8.2025", ["18.8.2025"], "full date, omitted by default");
    d.p("סיכום אשפוז — מחלקת ילדים")
     .p(`${f1}, ${id}, התקבלה ביום 18.8.2025. הורים: ${f2} ו${hy1}. דוא"ל לקשר: ${em}.`)
     .p(`${f3} התלוננה על כאבי בטן. ${hy2} מסר שהתלונות החלו אחרי המעבר ל${l1}.`)
     .p(`בבדיקה לא נמצא ממצא חריג. לפי סעיף 2(ג) לנוהל, ${f2} תוזמן למעקב. ${hy2} חתם על טופס השחרור.`)
     .p(`המלצה: מעקב רופא משפחה. ${f3} משוחררת במצב טוב.`);
    docs.push(d);
  }
  {
    const d = new Doc("h3", "medical", "חוות דעת פסיכולוגית");
    const [ru1, ru1b] = d.ent("P_RUSSIAN", "NAME", true, "ולריה קוזנצוב", ["ולריה קוזנצוב", "קוזנצוב"]);
    const [et1, et1b] = d.ent("P_ETHIOPIAN", "NAME", true, "יונס גטהון", ["יונס גטהון", "גטהון"]);
    const [s2, s2b] = d.ent("P_SUR2", "NAME", true, "איה נץ", ["איה נץ", "נץ"], "two-letter surname");
    const [dob] = d.ent("I_DOB", "PII", true, "9.11.2014", ["יליד 9.11.2014"]);
    const [ph] = d.ent("I_PHONE", "PII", true, "053-7761120", ["053-7761120"]);
    const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "מכון שורשים", ["מכון שורשים", "שורשים"]);
    d.ent("T_PLONI", "TRAP", false, "פלונית", ["פלונית"]);
    d.p(`${o1} — חוות דעת פסיכולוגית`)
     .p(`הנבדק: ${et1}, ${dob}. ההורים: ${ru1} (טלפון ${ph}) ו${s2}. פלונית, המורה, מסרה שאלון.`)
     .p(`${et1b} שיתף פעולה במבחנים. ${ru1b} תיארה קשיי שינה. ${s2b} מסר כי הילד רגוע אצלו.`)
     .p(`${s2b} ו${ru1b} חלוקים על המסגרת. ${et1b} מבטא רצון להישאר בבית הספר הנוכחי. ${o1b} ממליץ על טיפול דיאדי.`)
     .p(`חתימה: פסיכולוגית קלינית, ${o1b}.`);
    docs.push(d);
  }

  // ── police statements ───────────────────────────────────────────────────────
  {
    const d = new Doc("p1", "police", "הודעת עד");
    const [rn, rnb] = d.ent("P_ROLE_NOCOLON", "NAME", true, "פיראס חטיב", ["העד פיראס חטיב", "חטיב"]);
    const [ts1, ts2] = d.ent("P_TWO_SPELL", "NAME", true, "ארטיום מורוזוב", ["ארטיום מורוזוב", "מורוזב"], "second form drops a vav");
    const [id] = d.ent("I_ID", "PII", true, tz(30198822), ['ת"ז ' + tz(30198822)]);
    const [ph] = d.ent("I_PHONE", "PII", true, "052-3390047", ["052-3390047"]);
    const [pl] = d.ent("I_PLATE", "PII", true, "34-712-58", ["34-712-58"]);
    const [st, stb] = d.ent("L_STREET", "PLACE", true, "רחוב הדקל 7", ["רחוב הדקל 7", "הדקל"]);
    d.ent("O_PUBLIC", "ORG", false, PUBLIC[4], [PUBLIC[4]]);
    d.ent("T_NUMBERS", "TRAP", false, "תיק 4471/26", ["תיק 4471/26"]);
    d.ent("I_DATE", "PII", true, "23.5.2026", ["23.5.2026"], "full date, omitted by default");
    d.p(`${PUBLIC[4]} — הודעת עד, תיק 4471/26`)
     .p(`${rn}, ${id}, טלפון ${ph}, מוסר:`)
     .p(`ביום 23.5.2026 בשעה 21:30 ראיתי רכב מספר ${pl} חונה ב${st}. ${ts1} יצא מהרכב וצעק על אישה.`)
     .p(`אני מכיר את ${ts2} מהשכונה. הוא גר ב${stb} כבר שנים. ${rnb} מוסיף שהאישה ברחה לכיוון הגינה.`)
     .p(`זו הודעתי, ואני חותם עליה. ${rnb}.`);
    docs.push(d);
  }
  {
    const d = new Doc("p2", "police", "תלונה");
    const [a1, a1b] = d.ent("P_ARABIC", "NAME", true, "סוהא אגבריה", ["סוהא אגבריה", "אגבריה"]);
    const [mn, mnb] = d.ent("P_MINOR_ANCH", "NAME", true, "לביא", ["הקטין לביא", "לביא"], "minor introduced by הקטין");
    const [pl] = d.ent("I_PLATE", "PII", true, "718-44-201", ["718-44-201"]);
    const [id] = d.ent("I_ID", "PII", true, tz(27063158), ['ת"ז ' + tz(27063158)]);
    const [l1] = d.ent("L_TOWN", "PLACE", true, "גבעת עדה", ["גבעת עדה"]);
    d.ent("O_PUBLIC", "ORG", false, PUBLIC[4], [PUBLIC[4]]);
    d.ent("T_NUMBERS", "TRAP", false, "סעיף 192", ["סעיף 192"]);
    d.ent("I_DATE", "PII", true, "4.4.2026", ["4.4.2026"], "full date, omitted by default");
    d.p(`תלונה — תחנת ${l1}, ${PUBLIC[4]}`)
     .p(`המתלוננת: ${a1}, ${id}. בעניין ${mn}, בנה.`)
     .p(`${a1b} מוסרת כי ביום 4.4.2026 רכב מספר ${pl} עקב אחרי ${mnb} בדרכו מבית הספר. ${mnb} בן עשר.`)
     .p(`לפי סעיף 192 לחוק העונשין מדובר באיום. ${a1b} מבקשת שהמשטרה תאתר את בעל הרכב. ${mnb} מפחד לצאת מהבית.`)
     .p(`התלונה נרשמה. ${a1b} תוזמן להשלמת עדות.`);
    docs.push(d);
  }
  {
    const d = new Doc("p3", "police", "הודעת חשוד");
    const [ru1, ru1b] = d.ent("P_RUSSIAN", "NAME", true, "דניס וסילייב", ["דניס וסילייב", "וסילייב"]);
    const [s2, s2b] = d.ent("P_SUR2", "NAME", true, "עלמה כץ", ["עלמה כץ", "כץ"], "two-letter surname");
    const [ph] = d.ent("I_PHONE", "PII", true, "058-6104477", ["058-6104477"]);
    const [pl] = d.ent("I_PLATE", "PII", true, "92-118-34", ["92-118-34"]);
    const [em] = d.ent("I_EMAIL", "PII", true, "denis.v@outlook.com", ["denis.v@outlook.com"]);
    d.ent("T_NUMBERS", "TRAP", false, "תיק 118/26", ["תיק 118/26", "סעיף 2"]);
    d.p("הודעת חשוד — תיק 118/26")
     .p(`${ru1}, טלפון ${ph}, דוא"ל ${em}, נחקר באזהרה:`)
     .p(`שאלה: האם הרכב ${pl} שלך? תשובה: כן. שאלה: מה הקשר שלך ל${s2}? תשובה: ${s2b} היא גרושתי.`)
     .p(`${ru1b} מכחיש שאיים. לדבריו ${s2b} התקשרה אליו ראשונה. לפי סעיף 2 לתלונה, השיחה נמשכה עשר דקות.`)
     .p(`${ru1b} חתם על ההודעה. ${s2b} תוזמן לעימות.`);
    docs.push(d);
  }
  {
    const d = new Doc("p4", "police", "דוח פעולה");
    const [et1, et1b] = d.ent("P_ETHIOPIAN", "NAME", true, "מאזה טספה", ["מאזה טספה", "טספה"]);
    const [f1, f2, f3] = d.ent("P_FORMS", "NAME", true, "עמנואל שוורץ", ["עמנואל שוורץ", "שוורץ", "עמנואל"]);
    const [id] = d.ent("I_ID", "PII", true, tz(35540118), [tz(35540118)], "bare, unlabeled");
    const [dob] = d.ent("I_DOB", "PII", true, "21.12.1988", ["יליד 21.12.1988"]);
    const [nb, nb2] = d.ent("L_NEIGHBOURHOOD", "PLACE", true, "שכונת הפרדס", ["שכונת הפרדס", "הפרדס"]);
    d.ent("T_PLONI", "TRAP", false, "פלוני", ["פלוני"]);
    d.p("דוח פעולה")
     .p(`הגענו ל${nb} בעקבות קריאה. במקום ${et1} ו${f1}, ${dob}, ${id}.`)
     .p(`${et1b} מסרה כי ${f2} הגיע שיכור. ${f3} טען שפלוני זרק עליו אבן. ${et1b} הכחישה.`)
     .p(`${f2} הורחק מהמקום. ${nb2} שקטה בעת עזיבתנו. ${et1b} קיבלה מספר תיק.`)
     .p(`המשך טיפול: זימון ${f3} לחקירה.`);
    docs.push(d);
  }

  // ── bank statements and letters ─────────────────────────────────────────────
  {
    const d = new Doc("b1", "bank", "דף חשבון");
    const [f1, f2, f3] = d.ent("P_FORMS", "NAME", true, "ירדן ברזילי", ["ירדן ברזילי", "ברזילי", "ירדן"]);
    const [bk] = d.ent("I_BANK", "PII", true, "חשבון 5521907", ["חשבון 5521907"]);
    const [id] = d.ent("I_ID", "PII", true, tz(29917406), ['ת"ז ' + tz(29917406)]);
    const [em] = d.ent("I_EMAIL", "PII", true, "yarden.brz@gmail.com", ["yarden.brz@gmail.com"]);
    const [st] = d.ent("L_STREET", "PLACE", true, "שדרות הברוש 21", ["שדרות הברוש 21"]);
    d.ent("T_NUMBERS", "TRAP", false, "1,250.00", ["1,250.00"]);
    d.ent("I_DATE", "PII", true, "31.3.2026", ["31.3.2026"], "full date, omitted by default");
    d.p("דף חשבון — סניף 612")
     .p(`בעל החשבון: ${f1}, ${id}, ${st}. דוא"ל: ${em}. ${bk}.`)
     .p(`31.3.2026 — העברה ל${f2} 1,250.00 ש"ח. הערה: מזונות.`)
     .p(`${f3} ביקשה לעדכן את הכתובת. ${f2} תקבל אישור בדוא"ל.`)
     .p("יתרה לסוף התקופה: ראו נספח.");
    docs.push(d);
  }
  {
    const d = new Doc("b2", "bank", "מכתב מהבנק");
    const [a1, a1b] = d.ent("P_ARABIC", "NAME", true, "טהא עודה", ["טהא עודה", "עודה"]);
    const [bk] = d.ent("I_BANK", "PII", true, "חשבון 0093344", ["חשבון 0093344"]);
    const [dob] = d.ent("I_DOB", "PII", true, "5.5.1979", ["יליד 5.5.1979"]);
    const [id] = d.ent("I_ID", "PII", true, tz(24478315), ['ת.ז. ' + tz(24478315)]);
    const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "חברת קו הזהב הובלות", ["חברת קו הזהב הובלות", "קו הזהב"]);
    d.ent("T_NUMBERS", "TRAP", false, "12.6.2026", ["סעיף 5"]);
    d.ent("I_DATE", "PII", true, "12.6.2026", ["12.6.2026"], "full date, omitted by default");
    d.p("לכבוד")
     .p(`${a1}, ${dob}, ${id}`)
     .p(`הנדון: ${bk} — הודעה על עיקול`)
     .p(`ביום 12.6.2026 התקבל בסניף צו עיקול לטובת ${o1}. לפי סעיף 5 לצו, ${a1b} רשאי להגיש התנגדות.`)
     .p(`${o1b} טוענת לחוב בגין הובלה. ${a1b} מתבקש לפנות לסניף.`);
    docs.push(d);
  }
  {
    const d = new Doc("b3", "bank", "אישור יתרה");
    const [ru1, ru1b] = d.ent("P_RUSSIAN", "NAME", true, "אולג איוונוב", ["אולג איוונוב", "איוונוב"]);
    const [bk] = d.ent("I_BANK", "PII", true, "חשבון 7710265", ["חשבון 7710265"]);
    const [em] = d.ent("I_EMAIL", "PII", true, "oleg.ivanov77@mail.ru", ["oleg.ivanov77@mail.ru"]);
    const [ph] = d.ent("I_PHONE", "PII", true, "055-8823910", ["055-8823910"]);
    const [l1] = d.ent("L_TOWN", "PLACE", true, "בית אריה", ["בית אריה"]);
    d.ent("T_NUMBERS", "TRAP", false, "30.6.2026", ["42,000"]);
    d.ent("I_DATE", "PII", true, "30.6.2026", ["30.6.2026"], "full date, omitted by default");
    d.p("אישור יתרה ליום 30.6.2026")
     .p(`${ru1}, ${l1}. טלפון ${ph}, דוא"ל ${em}.`)
     .p(`${bk}: יתרת זכות 42,000 ש"ח. ${ru1b} ביקש את האישור לצורך הליך משפטי.`)
     .p(`האישור ניתן לבקשת ${ru1b} ואינו מהווה התחייבות.`);
    docs.push(d);
  }

  // ── WhatsApp exports ────────────────────────────────────────────────────────
  {
    const d = new Doc("c1", "chat", "ייצוא וואטסאפ");
    const [s2, s2b] = d.ent("P_SUR2", "NAME", true, "מיקי צח", ["מיקי צח", "צח"], "two-letter surname");
    const [mn] = d.ent("P_MINOR", "NAME", true, "טרקה", ["טרקה"], "minor, first name only");
    const [ph] = d.ent("I_PHONE", "PII", true, "052-7715803", ["052-7715803"]);
    const [l1] = d.ent("L_TOWN", "PLACE", true, "נופית", ["נופית"]);
    const [pr] = d.ent("P_PROSE", "NAME", true, "צליל", ["צליל"], "never before a speech verb");
    d.ent("T_NUMBERS", "TRAP", false, "12.3.2026", ["21:14"]);
    d.ent("I_DATE", "PII", true, "12.3.2026", ["12.3.2026"], "full date, omitted by default");
    d.p(`${stamp("12.3.2026", "21:14")} ${s2}: את לוקחת את ${mn} מחר?`)
     .p(`${stamp("12.3.2026", "21:15")} אמא: כן, ואת ${pr} גם. תשלח לי את המספר של המורה, ${ph}?`)
     .p(`${stamp("12.3.2026", "21:17")} ${s2}: שלחתי. ${s2b} לא יכול ביום חמישי, יש לו משמרת ב${l1}.`)
     .p(`${stamp("12.3.2026", "21:20")} אמא: בסדר. ${mn} ישן אצלי. בשביל ${pr} תביא את התיק.`);
    docs.push(d);
  }
  {
    const d = new Doc("c2", "chat", "ייצוא וואטסאפ");
    const [a1, a1b] = d.ent("P_ARABIC", "NAME", true, "מייסא סרחאן", ["מייסא סרחאן", "סרחאן"]);
    const [hy1, hy2] = d.ent("P_HYPHEN", "NAME", true, "ליעד בן-עמיאל", ["ליעד בן-עמיאל", "בן עמיאל"]);
    const [em] = d.ent("I_EMAIL", "PII", true, "maisa.s@gmail.com", ["maisa.s@gmail.com"]);
    const [id] = d.ent("I_ID", "PII", true, tz(31288874), ['ת"ז ' + tz(31288874)]);
    const [o1, o1b] = d.ent("O_PRIVATE", "ORG", true, "גן ילדים שלהבת", ["גן ילדים שלהבת", "שלהבת"]);
    d.ent("T_PLONI", "TRAP", false, "פלוני", ["פלוני"]);
    d.p(`${stamp("2.9.2026", "08:02")} ${a1}: הגננת ב${o1} ביקשה את ה${id} שלך לטופס.`)
     .p(`${stamp("2.9.2026", "08:05")} ${hy1}: תשלחי לה למייל שלי, ${em}. ${o1b} כבר קיבל את זה פעם.`)
     .p(`${stamp("2.9.2026", "08:06")} ${a1}: פלוני מהוועד אמר שצריך שוב. ${hy2} תחתום גם?`)
     .p(`${stamp("2.9.2026", "08:10")} ${hy1}: כן. ${a1b} תעדכני אותי כשזה מסודר.`);
    docs.push(d);
  }
  {
    const d = new Doc("c3", "chat", "ייצוא וואטסאפ");
    const [et1, et1b] = d.ent("P_ETHIOPIAN", "NAME", true, "ברהאנה וורקנה", ["ברהאנה וורקנה", "וורקנה"]);
    const [mn, mnb] = d.ent("P_MINOR_ANCH", "NAME", true, "גפן", ["הקטינה גפן", "גפן"], "minor introduced by הקטינה");
    const [ph] = d.ent("I_PHONE", "PII", true, "050-6650912", ["050-6650912"]);
    const [pl] = d.ent("I_PLATE", "PII", true, "45-903-16", ["45-903-16"]);
    const [st, stb] = d.ent("L_STREET", "PLACE", true, "רחוב הנרקיס 9", ["רחוב הנרקיס 9", "הנרקיס"]);
    d.ent("T_NUMBERS", "TRAP", false, "15.4.2026", ["17:40"]);
    d.ent("I_DATE", "PII", true, "15.4.2026", ["15.4.2026"], "full date, omitted by default");
    d.p(`${stamp("15.4.2026", "17:40")} ${et1}: ראיתי את הרכב שלך ${pl} ב${st}. ${mnb} הייתה שם?`)
     .p(`${stamp("15.4.2026", "17:42")} אבא: כן, לקחתי אותה מהחוג. תתקשרי ל${ph} אם יש בעיה.`)
     .p(`${stamp("15.4.2026", "17:45")} ${et1}: העו"ס כתבה על ${mn} בדוח. ${et1b} לא מסכימה שתישן ב${stb}.`)
     .p(`${stamp("15.4.2026", "17:50")} אבא: נדבר על זה בפגישה. ${mnb} רוצה להישאר.`);
    docs.push(d);
  }
  {
    const d = new Doc("c4", "chat", "ייצוא וואטסאפ");
    const [ru1, ru1b] = d.ent("P_RUSSIAN", "NAME", true, "פולינה סמירנובה", ["פולינה סמירנובה", "סמירנובה"]);
    const [ts1, ts2] = d.ent("P_TWO_SPELL", "NAME", true, "קסאי אלמו", ["קסאי אלמו", "עלמו"], "second form swaps א for ע");
    const [dob] = d.ent("I_DOB", "PII", true, "30.10.2016", ["ילידת 30.10.2016"]);
    const [bk] = d.ent("I_BANK", "PII", true, "חשבון 3306178", ["חשבון 3306178"]);
    const [nb, nb2] = d.ent("L_NEIGHBOURHOOD", "PLACE", true, "שכונת כרם הזיתים", ["שכונת כרם הזיתים", "כרם הזיתים"]);
    d.ent("T_NUMBERS", "TRAP", false, "800", ["800"]);
    d.ent("I_DATE", "PII", true, "20.2.2026", ["20.2.2026"], "full date, omitted by default");
    d.p(`${stamp("20.2.2026", "12:01")} ${ru1}: העברתי 800 ל${bk}. זה למזונות של הבת, ${dob}.`)
     .p(`${stamp("20.2.2026", "12:03")} ${ts1}: קיבלתי. ${ru1b} את זוכרת שהפגישה ב${nb}?`)
     .p(`${stamp("20.2.2026", "12:04")} ${ru1}: כן. ${ts2} כתב לי שהוא לא מגיע. ${nb2} רחוק לי.`)
     .p(`${stamp("20.2.2026", "12:06")} ${ts1}: אני אבוא. ${ru1b}, תביאי את האישור.`);
    docs.push(d);
  }

  // ── position papers: the shape of a real filing that broke the anchors ──
  // Parties by role and colon, form labels with colons, "the undersigned" before
  // verbs, a word ending in ת before a word starting with ז, a discourse word
  // before the minor's name, role words the model calls names.
  {
    const d = new Doc("x1", "position", "כתב עמדה");
    const [rn1] = d.ent("P_ROLE_COLON", "NAME", true, "נופר", ["נופר", "התובע:  נופר"], "party by role and colon, first name only");
    const [rn2] = d.ent("P_ROLE_COLON", "NAME", true, "טוהר", ["טוהר", "הנתבעת:  טוהר"], "party by role and colon, first name only");
    const [mn] = d.ent("P_AFTER_LEAD", "NAME", true, "ליעד", ["ליעד"], "minor, appears after כאמור / משכך and after הקטין");
    const [sib] = d.ent("P_MINOR_ANCH", "NAME", true, "אביתר", ["האח אביתר", "אביתר"], "sibling introduced by a kin word");
    const [l1] = d.ent("L_TOWN", "PLACE", true, "בית אריה", ["בית אריה"]);
    d.ent("T_FORMLABEL", "TRAP", false, "מועד אחרון לתגובה", ["מועד אחרון לתגובה", "מועד המצאת ההחלטה"], "form label with a colon is not a speaker");
    d.ent("T_TZSPLIT", "TRAP", false, "בהחלפת זמני", ["בהחלפת זמני", "שנקבעו ותחת זאת"], "a ת ending a word before a ז starting the next is not ת\"ז");
    d.ent("T_UNDERSIGNED", "TRAP", false, 'הח"מ סבורה', ['הח"מ סבורה', 'הח"מ להשיג', 'הח"מ עולה'], "the undersigned before a verb is not a name");
    d.ent("O_ROLEWORD", "TRAP", false, "אפוטרופא לדין", ["אפוטרופא לדין", "אפטרופא"], "a role word in any spelling is not a name");
    d.ent("T_GAZWORD", "TRAP", false, "לשם", ["לשם", "קדימה", "חבר", "מיטב"], "ordinary words that are also locality names");
    d.p("כתב עמדה מטעם האפוטרופא לדין")
     .p(`התובע:  ${rn1} .....(להלן: גם האב)`)
     .p("נ ג ד -")
     .p(`הנתבעת:  ${rn2}(להלן: גם האם)`)
     .p("מועד המצאת ההחלטה: ...........")
     .p("מועד אחרון לתגובה: ............")
     .p(`בעניין הקטין ${mn}, יליד 2015, המתגורר בבית האב ב${l1} יחד עם ${sib}, כאשר ${sib.split(" ").pop()} משרת שירות צבאי.`)
     .p(`כאמור ${mn} שיתף את הח"מ וציין כי מועדי השהות אינם קבועים. משכך ${mn} מבקש גמישות בהחלפת זמני השהות שלו עם האם.`)
     .p(`הח"מ סבורה כי פניות למשטרה אינן הדרך. כל ניסיונות הח"מ להשיג את האם לא צלחו. מהמידע שהובא בפני הח"מ עולה כי האם אינה מגיעה במועדים שנקבעו ותחת זאת נוצרו שינויים.`)
     .p(`יוזכר כי הח"מ גם שמשה אפטרופא לדין של הקטין ${mn} בהליך הקודם. האפוטרופא לדין ממליצה על הרחבת השהות אצל האב.`)
     .p("לשם הבהרה: האב ביקש להתקדם קדימה בהסדר, וחבר של המשפחה הציע לסייע. מיטב המאמצים הושקעו.");
    docs.push(d);
  }
  {
    const d = new Doc("x2", "position", "תגובת האפוטרופא לדין");
    const [rn1] = d.ent("P_ROLE_COLON", "NAME", true, "שיראל", ["שיראל", "המבקשת:  שיראל"], "party by role and colon, first name only");
    const [rn2] = d.ent("P_ROLE_COLON", "NAME", true, "לביא", ["לביא", "המשיב:  לביא"], "party by role and colon, first name only");
    const [mn] = d.ent("P_AFTER_LEAD", "NAME", true, "אגם", ["אגם"], "minor, appears after לדבריה / בנוסף and after הקטינה");
    const [st, stb] = d.ent("L_STREET", "PLACE", true, "רחוב הדקל 7", ["רחוב הדקל 7", "הדקל"]);
    d.ent("T_FORMLABEL", "TRAP", false, "הנדון", ["הנדון", "סימוכין", "מועד הדיון"], "form label with a colon is not a speaker");
    d.ent("T_TZSPLIT", "TRAP", false, "לעניין אכיפת זכויות", ["לעניין אכיפת זכויות", "בקשת זמנים"], "a ת ending a word before a ז starting the next is not ת\"ז");
    d.ent("T_UNDERSIGNED", "TRAP", false, 'הח"מ ממליצה', ['הח"מ ממליצה', 'הח"מ השאירה'], "the undersigned before a verb is not a name");
    d.ent("O_ROLEWORD", "TRAP", false, "האפוטרופוס לדין", ["האפוטרופוס לדין", "אפוטרופסית"], "a role word in any spelling is not a name");
    d.ent("T_GAZWORD", "TRAP", false, "אורה", ["אורה", "חוסן", "עלי", "גבעות"], "ordinary words that are also locality names");
    d.p("תגובת האפוטרופוס לדין")
     .p(`המבקשת:  ${rn1}`)
     .p(`המשיב:  ${rn2}`)
     .p("הנדון: הסדרי שהות")
     .p("סימוכין: החלטה מיום 3.3.2026")
     .p("מועד הדיון: ............")
     .p(`בעניין הקטינה ${mn}, המתגוררת עם האם ב${st}. לדבריה ${mn} מעדיפה להישאר ב${stb}. בנוסף ${mn} ביקשה שדבריה לא יובאו בפני מי מההורים.`)
     .p(`הח"מ ממליצה על השמעת הקטינה. הח"מ השאירה לאם הודעה אך האם לא השיבה. לעניין אכיפת זכויות ההורה, בקשת זמנים נוספים תידון בנפרד.`)
     .p(`הח"מ מונתה כאפוטרופסית לדין בהליך זה. האפוטרופוס לדין הקודם סיים את תפקידו.`)
     .p("אורה של תקווה עדיין קיימת, וחוסן המשפחה נבדק. עלי לציין כי גבעות הקושי לא נעלמו.");
    docs.push(d);
  }
  {
    const d = new Doc("x3", "position", "עמדת האפוטרופא לדין");
    const [rn1] = d.ent("P_ROLE_COLON", "NAME", true, "אלינה", ["אלינה", "התובעת:  אלינה"], "party by role and colon, first name only");
    const [rn2] = d.ent("P_ROLE_COLON", "NAME", true, "ארטיום", ["ארטיום", "הנתבע:  ארטיום"], "party by role and colon, first name only");
    const [mn] = d.ent("P_AFTER_LEAD", "NAME", true, "יונס", ["יונס"], "minor, appears after ואולם / יצוין and after הקטין");
    const [sib] = d.ent("P_MINOR_ANCH", "NAME", true, "מייסא", ["האחות מייסא", "מייסא"], "sibling introduced by a kin word");
    d.ent("T_FORMLABEL", "TRAP", false, "נושא", ["נושא", "מועד הגשה"], "form label with a colon is not a speaker");
    d.ent("T_TZSPLIT", "TRAP", false, "ברכישת זכויות", ["ברכישת זכויות", "הצעת זמנים"], "a ת ending a word before a ז starting the next is not ת\"ז");
    d.ent("T_UNDERSIGNED", "TRAP", false, 'הח"מ נפגשה', ['הח"מ נפגשה', 'הח"מ מציעה'], "the undersigned before a verb is not a name");
    d.ent("O_ROLEWORD", "TRAP", false, "אפוטרופוס לדין", ["אפוטרופוס לדין", "האפוטרופא"], "a role word in any spelling is not a name");
    d.ent("T_GAZWORD", "TRAP", false, "דברת", ["דברת", "שקף", "לשם"], "ordinary words that are also locality names");
    d.p("עמדת האפוטרופא לדין")
     .p(`התובעת:  ${rn1}`)
     .p(`הנתבע:  ${rn2}`)
     .p("נושא: משמורת")
     .p("מועד הגשה: ............")
     .p(`הח"מ נפגשה עם הקטין ${mn} פעמיים. ואולם ${mn} מסרב לדבר על האב. יצוין ${mn} מתגורר עם ${sib}, ו${sib.split(" ").pop()} מסייעת לו.`)
     .p(`הח"מ מציעה הסדר הדרגתי. ברכישת זכויות בדירה אין כדי לשנות את המסקנה, והצעת זמנים חדשה תוגש בנפרד.`)
     .p(`האפוטרופא ממליצה כי אפוטרופוס לדין ימשיך ללוות את ההליך.`)
     .p("דברת האם נרשמה בפרוטוקול. שקף ההסבר הוצג, ולשם הזהירות צורף נספח.");
    docs.push(d);
  }

  Object.assign(C, {
    P_ROLE_COLON: "person: party by role word and colon, first name only",
    P_AFTER_LEAD: "person: name right after a discourse word (כאמור, משכך, לדבריה)",
    T_FORMLABEL: "trap: form label with a colon (not a speaker)",
    T_TZSPLIT: "trap: word ending in ת before a word starting with ז (not ת\"ז)",
    T_UNDERSIGNED: "trap: הח\"מ before a verb (not a name)",
    O_ROLEWORD: "trap: role word in any spelling (אפוטרופא, אפוטרופוס)",
    T_GAZWORD: "trap: ordinary word that is also a locality name (קדימה, לשם, גבעות)",
    P_SUR2: "person: two-letter surname",
    P_MINOR_ANCH: "person: minor introduced by הקטין / הקטינה",
    I_ID: "pii: ID number",
    I_PHONE: "pii: mobile phone",
    I_EMAIL: "pii: email address",
    I_BANK: "pii: bank account",
    I_PLATE: "pii: licence plate",
    I_DATE: "pii: full date (omitted by default)",
    I_DOB: "pii: date of birth",
  });
  return docs;
};
