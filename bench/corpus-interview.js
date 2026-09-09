/* Three interview documents, added after a real session leaked a teacher's name.

   The genre the corpus did not have: a spoken conversation with a child,
   transcribed from a recording. Short turns, no speaker labels, questions
   answered with one word, names dropped in passing with no title beside
   them. Two leak shapes came out of the real document, and the generator
   wants every category in at least three documents, so each shape appears
   three times across these:

     P_ROLE_TEACHER  a foreign female first name that appears only after a
                     care or teaching role word ("למורה X", "הגננת X"), never
                     with a surname, never before a speech verb. The model
                     found the real one seven times at full confidence and it
                     left the tool anyway; the deterministic layers never saw it.

     P_WORD_VERB     a first name that is also an everyday word, standing
                     before a speech verb ("שלום אמר"). The verb layer rejected
                     it as a stop word, and the model does not tag it either.

   Invented text and invented people; nothing here is from the real file.
   The word-like names are by design known to the lexicons, like P_WORD. */
module.exports = function interview(Doc, C) {
  const docs = [];
  Object.assign(C, {
    P_ROLE_TEACHER: "person: foreign first name only after a care or teaching role word, in child speech",
    P_WORD_VERB: "person: everyday word as a first name, before a speech verb (lexicon-aided by design)",
  });

  {
    const d = new Doc("v1", "interview", "שיחה עם ילדה, תמלול מוקלט");
    const [t, tb] = d.ent("P_ROLE_TEACHER", "NAME", true, "אנטונינה", ["למורה אנטונינה", "אנטונינה"],
      "foreign first name, only after a role word, in child speech");
    const [k] = d.ent("P_MINOR", "NAME", true, "תהל", ["תהל"], "the child, first name only");
    const [w, wb] = d.ent("P_WORD_VERB", "NAME", true, "אור", ["אור אמרה", "אור"], "everyday word as a first name, before a speech verb");
    const [town] = d.ent("L_TOWN", "PLACE", true, "כפר האורנים", ["כפר האורנים"]);
    d.ent("T_NUMBERS", "TRAP", false, "כיתה ג", ["כיתה ג"]);
    d.p("מה זאת אומרת, זה לא נורא?")
     .p("מה?")
     .p("לא נורא שעברת בית ספר. את מסתדרת?")
     .p("כן.")
     .p(`אז מי המורה שלך עכשיו? אמרת לי בפעם הקודמת, ${k}, ושכחתי.`)
     .p(`${t}. כן, ${tb}.`)
     .p(`אה, ${tb}. זה שם יפה. והיא נחמדה אלייך?`)
     .p("כן. היא נותנת לנו שוקו בהפסקה.")
     .p(`ומי החברה שלך בכיתה? ${wb}?`)
     .p(`כן. ${w} שאני יכולה לשבת לידה. ${wb} גרה קרוב.`)
     .p("וואי, ממש מפנקים אתכם. ובכיתה ג יש עוד חברות?")
     .p("עוד לא. רק התחלתי.")
     .p(`ואיפה בית הספר, ב${town}? קרוב לבית של אבא?`)
     .p("לא, זה רחוק. אבא לוקח אותי באוטו.")
     .p(`טוב ${k}, אני שמחה בשבילך. נדבר עוד שבועיים.`)
     .p("בסדר.");
    docs.push(d);
  }

  {
    const d = new Doc("v2", "interview", "שיחה עם ילד, תמלול מוקלט");
    const [w, wb] = d.ent("P_WORD_VERB", "NAME", true, "שלום", ["שלום אמר", "שלום"],
      "an everyday word as a first name, before a speech verb");
    const [k] = d.ent("P_MINOR", "NAME", true, "איתן", ["איתן"], "the child, first name only");
    const [t, tb] = d.ent("P_ROLE_TEACHER", "NAME", true, "זינאידה", ["המטפלת זינאידה", "זינאידה"],
      "foreign first name, only after a care role word");
    const [fam, famb] = d.ent("P_FORMS", "NAME", true, "אלרואי קפלינסקי", ["אלרואי קפלינסקי", "קפלינסקי"], "the neighbour, full then surname");
    d.ent("T_NUMBERS", "TRAP", false, "יום שלישי", ["יום שלישי", "17:30"]);
    d.p(`${k}, ספר לי מה קרה בשבת.`)
     .p("היינו אצל השכנים.")
     .p("אצל מי?")
     .p(`אצל ${fam}. יש לו כלב.`)
     .p(`ומי עוד היה שם? ${wb} היה?`)
     .p(`כן. ${w} שהוא לא בא יותר. ${wb} תמיד מאחר.`)
     .p("למה הוא אמר את זה?")
     .p("לא יודע. הוא רב עם אבא.")
     .p(`ואצל ${t} היית השבוע?`)
     .p(`כן. ${tb} נתנה לי לצייר.`)
     .p(`טוב. ואת ${famb} אתה מכיר הרבה זמן?`)
     .p("מאז שעברנו. הוא בסדר.")
     .p("אז ביום שלישי בשעה 17:30 ניפגש שוב, בסדר?")
     .p("בסדר.");
    docs.push(d);
  }

  {
    const d = new Doc("v3", "interview", "שיחה עם ילדה בגן, תמלול מוקלט");
    const [t, tb] = d.ent("P_ROLE_TEACHER", "NAME", true, "לריסה", ["הגננת לריסה", "לריסה"],
      "foreign first name, only after הגננת");
    const [w, wb] = d.ent("P_WORD_VERB", "NAME", true, "אושר", ["אושר אמר", "אושר"], "everyday word as a first name, before a speech verb");
    const [k] = d.ent("P_MINOR", "NAME", true, "לינוי", ["לינוי"], "the child, first name only");
    d.ent("T_NUMBERS", "TRAP", false, "שעה שמונה", ["שעה שמונה", "8:00"]);
    d.p(`בוקר טוב ${k}. איך היה בגן היום?`)
     .p("טוב.")
     .p("מי הייתה איתכם היום?")
     .p(`${t}. ${tb} הייתה כל היום.`)
     .p("ובחצר, עם מי שיחקת?")
     .p(`עם ${wb}. ${w} שאני החברה שלו.`)
     .p("איזה יופי. ובשעה שמונה אבא הביא אותך?")
     .p("כן, ב-8:00.")
     .p(`תודה ${k}. נדבר שוב בשבוע הבא.`)
     .p("ביי.");
    docs.push(d);
  }

  return docs;
};
