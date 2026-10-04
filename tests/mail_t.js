/* The sign-in emails (supabase/templates/), pasted by hand into the Supabase dashboard. What the
   deliverability review (4.10) settled, held here so a later edit cannot drift from it:
   - a whole HTML document, Hebrew and right to left, its title the subject named in the comment
     (and the same subject in the runbook);
   - every link goes through {{ .RedirectTo }} with the token after the #: no address written in,
     least of all pages.dev, and the copy-this-link line is the button's own link;
   - the button's colour sits on the link too (some email programs drop the cell's colour, and
     white text on the white card reads as hidden text to spam filters);
   - nothing a filter or a reader could take for marketing or phishing: no tagline, no images, no
     scripts or web fonts, and no "type your password there" in the verification email. */
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const DIR = path.join(__dirname, "..", "supabase", "templates");
const runbook = fs.readFileSync(path.join(__dirname, "..", "docs", "INKOGNITO-LAUNCH.md"), "utf8");
const MAILS = { "confirm-signup.html": "&amp;type=signup", "reset-password.html": "&amp;type=recovery", "magic-link.html": "" };

for (const [name, type] of Object.entries(MAILS)) {
  console.log("\n— " + name + " —");
  const s = fs.readFileSync(path.join(DIR, name), "utf8");
  const subject = ((s.match(/Subject: ([^\n]+)/) || [])[1] || "").trim();
  const start = s.indexOf("<!DOCTYPE html>");
  const doc = start >= 0 ? s.slice(start) : "";
  ok(subject && start > s.indexOf("-->"), "the notes come first, then the document that is pasted");
  ok(/^<!DOCTYPE html>\n<html lang="he" dir="rtl">/.test(doc) && /<meta charset="utf-8">/.test(doc) && doc.trimEnd().endsWith("</html>"), "a whole document, Hebrew, right to left, UTF-8");
  ok(doc.includes("<title>" + subject + "</title>"), "its title is the subject (" + subject + ")");
  ok(runbook.includes("subject `" + subject + "`"), "the runbook gives the same subject");
  const hrefs = [...doc.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  const link = "{{ .RedirectTo }}#confirm={{ .TokenHash }}" + type;
  ok(hrefs.length === 1 && hrefs[0] === link, "one link, through {{ .RedirectTo }}, the token after the # (" + hrefs.join(", ") + ")");
  ok(doc.includes(">" + link + "</p>"), "the copy-this-link line is the button's own link");
  ok(!/https?:\/\//.test(doc.replace(/<!DOCTYPE[^>]*>/, "")) && !/pages\.dev|SiteURL|ConfirmationURL/.test(doc), "no address written in: no pages.dev, no SiteURL or ConfirmationURL");
  ok(/<a href="[^"]*" style="display:inline-block;background-color:#1F5B44;/.test(doc), "the button's colour is on the link itself");
  // classic Outlook (common in law offices) ignores the link's padding; comments are dropped by
  // Supabase's html/template, so no Outlook-only wrapper can do it
  ok(/<td align="center" bgcolor="#1F5B44" style="[^"]*mso-padding-alt:14px 32px;/.test(doc) && !/<!--/.test(doc), "the button keeps its size in classic Outlook, with no comment in the pasted part");
  ok(!/<img|<script|@font-face|<link /i.test(doc), "no images, scripts or web fonts");
  ok(!/השחרת מסמכים|\bAI\b/.test(doc), "no product tagline");
  ok(!/מקלידים את הסיסמה/.test(doc), "no line telling the reader to type the password");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
