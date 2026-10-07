/* The site's own pages (site/: landing, sign-in, legal pages, admin), as one set. Each rule here
   holds on every page, so a new page or an edited footer cannot drift from the others:
   - Hebrew, right to left, a title, a viewport;
   - a strict Content-Security-Policy: scripts only from the site itself, nothing inline, and
     connections only to the site and the project's Supabase;
   - nothing loaded from another site (the "0 third-party requests" promise): every script,
     stylesheet, image and font is the site's own;
   - links out only to an allowed list;
   - one contact address everywhere (contact@inkognito.co.il; hello@ was left in four footers);
   - no draft placeholders left, and no draft label. */
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const SITE = path.join(__dirname, "..", "site");
const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
const CONTACT = "contact@inkognito.co.il";
// and the help page of each AI company, where the home page says how to turn training off (#training, 7.10.2026)
const OUT = ["https://github.com/ombed/inkognito", "https://mail.google.com", "https://outlook.live.com",
  "https://help.openai.com/en/articles/7730893-data-controls-in-chatgpt", "https://privacy.claude.com/en/articles/12109829-how-do-i-change-my-model-improvement-privacy-settings",
  "https://support.google.com/gemini/answer/13278892", "https://support.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-privacy-controls"];
const pages = fs.readdirSync(SITE).filter((f) => f.endsWith(".html"));
const scripts = fs.readdirSync(SITE).filter((f) => f.endsWith(".js"));

console.log("\n— every page —");
ok(pages.length >= 6, "the site has its pages (" + pages.join(", ") + ")");
for (const p of pages) {
  const h = fs.readFileSync(path.join(SITE, p), "utf8");
  ok(/<html lang="he" dir="rtl">/.test(h) && /<title>[^<]+<\/title>/.test(h) && /name="viewport"/.test(h), p + ": Hebrew, right to left, a title and a viewport");
  const csp = (h.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  const dir = (name) => (csp.match(new RegExp("(?:^|;\\s*)" + name + " ([^;]+)")) || [])[1] || "";
  ok(csp && dir("script-src") === "'self'", p + ": scripts only from the site, nothing inline (" + (dir("script-src") || "no policy") + ")");
  ok(["'self'", "'self' " + PROJECT].includes(dir("connect-src")), p + ": connects only to the site and the project (" + dir("connect-src") + ")");
  ok(/base-uri 'none'/.test(csp) && /default-src 'self'/.test(csp), p + ": default-src 'self' and base-uri 'none'");
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(h), p + ": no inline script");
  // a canonical link names the page's own address and loads nothing
  const loads = [...h.matchAll(/<(?:script|img|source|iframe)[^>]*\bsrc="([^"]+)"|<link(?![^>]*rel="canonical")[^>]*\bhref="([^"]+)"/g)].map((m) => m[1] || m[2]);
  // search engines: the four public pages are found under their one address; the rest stay out
  const canon = (h.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
  if (/^(index|privacy|terms|accessibility|security)\.html$/.test(p)) {
    ok(!/name="robots" content="noindex"/.test(h) && canon === "https://inkognito.co.il/" + (p === "index.html" ? "" : p.replace(".html", "")), p + ": indexable, under its one address (" + canon + ")");
  } else {
    ok(/name="robots" content="noindex"/.test(h) && !canon, p + ": kept out of search engines");
  }
  const foreign = loads.filter((u) => /^(https?:)?\/\//.test(u));
  ok(!foreign.length, p + ": loads nothing from another site" + (foreign.length ? ": " + foreign.join(", ") : ""));
  const links = [...h.matchAll(/<a[^>]*\bhref="(https?:[^"]+)"/g)].map((m) => m[1]);
  const odd = links.filter((u) => !OUT.some((o) => u === o || u.startsWith(o + "/")));
  ok(!odd.length, p + ": links out only to the allowed list" + (odd.length ? ": " + odd.join(", ") : ""));
  const mails = [...h.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0]);
  const wrong = [...new Set(mails.filter((m) => m !== CONTACT && !/@example\.co\.il$/.test(m)))];
  ok(!wrong.length, p + ": the one contact address" + (wrong.length ? ", not " + wrong.join(", ") : ""));
  // the design samples (6.10) say «[שם המפעיל]» and «[יישוב]» where the real pages name the operator
  ok(!/\[(?:להשלים|שם|מייל|כתובת|תאריך|טלפון|מחוז|יישוב)[^\]]*\]|טיוטה, ממתינה/.test(h), p + ": no placeholder or draft label left");
  if (!/^(login|admin)\.html$/.test(p)) {
    // relative, or from the root (404.html is served at any depth)
    ok(/href="\/?(?:index\.html)?#?privacy|href="\/?privacy\.html"/.test(h) && /href="\/?terms\.html"/.test(h) && /href="\/?accessibility\.html"/.test(h), p + ": the footer links the privacy policy, terms and accessibility statement");
  }
  // one book (the law-report design, 6.10): every public page has the home page's spine, and the
  // script that opens its menu on a phone; the owner's page keeps its own plain layout
  if (p !== "admin.html")
    ok(/<header class="spine" id="spine">/.test(h) && /<button class="menu-btn"[^>]*aria-controls="sheet"/.test(h) && /<script src="\/?landing\.js"><\/script>/.test(h), p + ": the home page's spine, with its phone menu and the script that opens it");
}

console.log("\n— one footer —");
/* Every page with the site's footer links what the home page's footer links, in its order, each to the
   same place: the 404 had 4 of the 6, without «אבטחה» and «הקוד ב־GitHub» (the live check of 6.10).
   An address is compared by where it leads, read from the page's own address (the 404 names them from
   the root), and a page by its address without .html, as Cloudflare serves it. */
const footLinks = (p) => {
  const nav = (fs.readFileSync(path.join(SITE, p), "utf8").match(/<footer class="foot">[\s\S]*?<nav[^>]*>([\s\S]*?)<\/nav>/) || [])[1];
  return nav === undefined ? null : [...nav.matchAll(/<a[^>]*\bhref="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(([, href, text]) => {
    const u = new URL(href, "https://inkognito.co.il/" + p);
    return text + " → " + (u.host === "inkognito.co.il" ? u.pathname.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "") + u.hash : u.href);
  });
};
const homeFoot = footLinks("index.html") || [];
ok(homeFoot.length >= 6, "the home page's footer links " + homeFoot.length + " places");
for (const p of pages.filter((f) => f !== "index.html")) {
  const f = footLinks(p);
  if (f) ok(f.join(" | ") === homeFoot.join(" | "), p + ": its footer links what the home page's does" + (f.join(" | ") === homeFoot.join(" | ") ? "" : ": " + f.join(" | ")));
}

console.log("\n— the way in —");
// sign-in is Google, or an email and a password (4.10); "sign up" opens the page on creating an account
const index = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
const signups = [...index.matchAll(/<a[^>]*\bhref="([^"]+)"[^>]*>להרשמה חינם<\/a>/g)].map((m) => m[1]);
ok(signups.length >= 3 && signups.every((h) => h === "login.html?mode=signup"), "every sign-up button opens on creating an account (" + signups.join(", ") + ")");
for (const p of ["index.html", "terms.html", "privacy.html"])
  ok(!/(?:כניסה|להיכנס)[^.]{0,60}קישור במייל|קישורי כניסה|קישור כניסה/.test(fs.readFileSync(path.join(SITE, p), "utf8")), p + ": promises no sign-in by an emailed link");

console.log("\n— every script —");
for (const s of scripts) {
  const js = fs.readFileSync(path.join(SITE, s), "utf8");
  const urls = [...js.matchAll(/https?:\/\/[^\s"'`)]+/g)].map((m) => m[0]).filter((u) => u !== PROJECT && !u.startsWith("http://www.w3.org/"));
  ok(!urls.length, s + ": names no other site" + (urls.length ? ": " + urls.join(", ") : ""));
  const mails = [...js.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0]).filter((m) => m !== CONTACT && !/example\.co\.il$/.test(m));
  ok(!mails.length, s + ": the one contact address" + (mails.length ? ", not " + mails.join(", ") : ""));
  ok(!/\.innerHTML\s*=(?!\s*'אפשר לשלוח שוב בעוד <span id="t" aria-hidden="true">' \+ WAIT)/.test(js), s + ": no innerHTML (text that may come from users is only ever set as text)");
  // a message that tells a person to write to the contact address lets them: the address is a link
  // to write to it (mailto), never set as plain text (the account panel's failed deletion was, 6.10)
  if (js.includes(CONTACT))
    ok(js.includes('"mailto:"') && !/\b(?:textContent|innerText)\s*[:=][^;\n]*contact@inkognito\.co\.il/.test(js), s + ": a message that names the contact address makes it a link to write to");
}

console.log("\n— the fonts —");
// the site serves its own fonts, under the SIL Open Font License, which travels with each family
const fontsCss = fs.readFileSync(path.join(SITE, "fonts", "fonts.css"), "utf8");
const families = [...new Set([...fontsCss.matchAll(/font-family: '([^']+)'/g)].map((m) => m[1]))];
ok(families.length >= 3, "the site's font families (" + families.join(", ") + ")");
for (const fam of families) {
  const lic = path.join(SITE, "fonts", fam.toLowerCase().replace(/ /g, "-") + "-LICENSE.txt");
  ok(fs.existsSync(lic) && /SIL Open Font License, Version 1\.1/.test(fs.readFileSync(lic, "utf8")), fam + ": its Open Font License sits beside its files");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
