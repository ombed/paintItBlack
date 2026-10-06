/* The old address after the move to inkognito.co.il (the owner's decision, 6.10.2026). GitHub Pages
   serves the forward that scripts/build-forward.js writes, not the tool: a page that sends a visitor
   with nothing saved to inkognito.co.il and offers a visitor with saved cases one file of all of them,
   the same page as 404.html for old deep links, and a service worker that replaces the tool's and
   removes what it kept. This reads what the build writes. The page itself runs in e2e/moved.spec.js. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { FORWARD_FILES, build } = require("../scripts/build-forward.js");
const { lintPage } = require("../scripts/lint-page.js");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// the words the owner approved, verbatim
const TITLE = "אינקוגניטו: הכלי עבר לכתובת חדשה";
const TEXT = [
  "הכלי עבר לכתובת חדשה: inkognito.co.il. בכתובת החדשה עובדים עם חשבון (חינם).",
  "התיקים ששמרתם בדפדפן הזה לא עוברים לבד. כדי להעביר אותם, מורידים אותם כאן לקובץ, ואחרי ההרשמה בוחרים «ייבוא תיקים מקובץ».",
  "הקובץ מכיל את שמות הלקוחות שבתיקים: שמרו אותו כמו כל מסמך של תיק.",
];
const DOWNLOAD = "הורדת התיקים לקובץ", GO = "מעבר לאינקוגניטו", WORDMARK = "אינקוגניטו";
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

(async () => {
  console.log("\n— what the build writes —");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forward-t-"));
  const out = build(path.join(tmp, "site"));
  const got = fs.readdirSync(out).sort();
  ok(JSON.stringify(got) === JSON.stringify([".nojekyll", "404.html", "index.html", "sw.js"]), "the forward is index.html, 404.html, sw.js and .nojekyll: " + got.join(", "));
  ok(JSON.stringify([...FORWARD_FILES].sort()) === JSON.stringify(["404.html", "index.html", "sw.js"]), "FORWARD_FILES names the three files");
  for (const f of FORWARD_FILES) ok(fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(path.join(ROOT, "forward", f))), f + " is forward/" + f + " as committed");
  ok(fs.readFileSync(path.join(out, "404.html")).equals(fs.readFileSync(path.join(out, "index.html"))), "404.html is the same page, so an old deep link lands on it too");
  ok(fs.readFileSync(path.join(out, ".nojekyll"), "utf8") === "", ".nojekyll is empty");
  const page = fs.readFileSync(path.join(out, "index.html"), "utf8"), sw = fs.readFileSync(path.join(out, "sw.js"), "utf8");

  console.log("\n— the page: marker, noindex, canonical, the approved words —");
  ok(/^<!DOCTYPE html>\r?\n<html lang="he" dir="rtl">/.test(page), "Hebrew, right to left");
  ok(page.includes('<meta name="inkognito" content="moved">'), "carries the marker the deploy check reads");
  ok(page.includes('<meta name="robots" content="noindex">'), "asks not to be indexed");
  ok(page.includes('<link rel="canonical" href="https://inkognito.co.il/">'), "its canonical address is inkognito.co.il");
  ok(page.includes("<title>" + TITLE + "</title>"), "the title");
  const paras = [...page.matchAll(/<p>([^<]*)<\/p>/g)].map((m) => m[1]);
  ok(JSON.stringify(paras) === JSON.stringify(TEXT), "the three approved paragraphs, verbatim and in order: " + JSON.stringify(paras));
  ok(page.includes('<button type="button" id="download">' + DOWNLOAD + "</button>"), "the download button, in the approved words");
  ok(page.includes('<a id="go" href="https://inkognito.co.il/login?mode=signup">' + GO + "</a>"), "the link to sign up, in the approved words");
  ok(/<noscript>[\s\S]*<a href="https:\/\/inkognito\.co\.il\/">inkognito\.co\.il<\/a>[\s\S]*<\/noscript>/.test(page), "without script, a plain link to inkognito.co.il");
  // every word a visitor can see is one of these: no other text came in with the page
  const body = page.slice(page.indexOf("<body>")).replace(/<script>[\s\S]*?<\/script>/g, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  ok(body === [WORDMARK, ...TEXT, DOWNLOAD, GO, "inkognito.co.il"].join(" "), "the page says these words and no others: " + body);

  console.log("\n— nothing leaves the browser —");
  const urls = [...(page + sw).matchAll(/\bhttps?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]);
  const hosts = [...new Set(urls.map((u) => new URL(u).hostname))];
  ok(urls.length >= 3 && hosts.join() === "inkognito.co.il", "no address but inkognito.co.il: " + hosts.join(", "));
  ok([...page.matchAll(/\b(?:src|href)="([^"]*)"/g)].every((m) => m[1].startsWith("https://inkognito.co.il/") || m[1] === "data:,"), "every src and href is inkognito.co.il, or the empty icon");
  ok(!/@import|url\(|@font-face/.test(page), "no stylesheet, image or font is fetched from the CSS");
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const styles = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  ok(scripts.length === 1 && styles.length === 1 && !/<script\s[^>]*src=|<link\s[^>]*rel="stylesheet"/.test(page), "one inline script and one inline style, nothing loaded");
  const script = scripts[0] || "";
  ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\bimport\(|serviceWorker/.test(stripComments(script)), "the page's script sends nothing and registers nothing");

  console.log("\n— the policy: default-src 'none', and only the page's own script and style —");
  const csp = (page.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1] || "";
  const dir = Object.fromEntries(csp.split(";").map((s) => s.trim()).filter(Boolean).map((s) => { const [k, ...v] = s.split(/\s+/); return [k, v.join(" ")]; }));
  const hash = (s) => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";
  ok(dir["default-src"] === "'none'", "default-src 'none': " + csp);
  ok(dir["script-src"] === hash(script), "script-src is the hash of the inline script, and nothing else: " + dir["script-src"] + " ≠ " + hash(script));
  ok(dir["style-src"] === hash(styles[0] || ""), "style-src is the hash of the inline style, and nothing else: " + dir["style-src"] + " ≠ " + hash(styles[0] || ""));
  ok(dir["img-src"] === "data:", "img-src data: only, for the empty icon that keeps the browser from asking for favicon.ico");
  ok(Object.keys(dir).sort().join() === "base-uri,default-src,form-action,img-src,script-src,style-src", "no other source is allowed: " + Object.keys(dir).join(","));
  ok(dir["base-uri"] === "'none'" && dir["form-action"] === "'none'", "no base and no form target");
  ok(!/unsafe-/.test(csp), "nothing unsafe");
  ok(!/<[a-z][^>]*\s(?:on[a-z]+|style)=/i.test(page), "no inline handler or style attribute, which the policy would refuse");
  const lint = (await lintPage(page)).filter((p) => p.severity === 2);
  ok(lint.length === 0, "the inline script lints clean: " + JSON.stringify(lint.slice(0, 3)));

  console.log("\n— what the page reads, and what it does with nothing —");
  const code = stripComments(script);
  ok(code.includes('"redact-cases"') && code.includes('"redact-profile-last"') && !/redact-(?:cases|profile-last):/.test(code), "it reads the public tool's own keys, with no account suffix");
  ok(!/localStorage\.(?:setItem|removeItem|clear)\b/.test(code), "it never writes or removes anything saved");
  ok(code.includes('location.replace("https://inkognito.co.il/")'), "with nothing saved it replaces itself with inkognito.co.il");
  ok(/\{ inkognito: "cases", v: 1, exported, cases: cases \|\| \{\}, last \}/.test(code), "the file is the cases format: " + (code.match(/const file = [^;]*;/) || ["none"])[0]);
  ok(code.includes('a.download = "inkognito-cases-" + exported.slice(0, 10) + ".json";'), "named inkognito-cases-<YYYY-MM-DD>.json");
  ok(/new Blob\(\[JSON\.stringify\(file, null, 1\)\], \{ type: "application\/json" \}\)/.test(code), "built in the page, as JSON text (a Blob of a string is UTF-8)");
  // the tool reads the same format (index.html, importCases)
  const tool = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  ok(tool.includes('prof.inkognito==="cases"') && /importCases\(file\)\{[\s\S]*?file\.v!==1\|\|!obj\(file\.cases\)/.test(tool), "the tool's «ייבוא תיקים מקובץ» reads that format");

  console.log("\n— the worker that replaces the tool's —");
  const w = stripComments(sw);
  const at = (s) => w.indexOf(s);
  ok(/self\.addEventListener\("install", \(\) => self\.skipWaiting\(\)\);/.test(w), "install: it takes over at once");
  ok(at("self.clients.claim()") > 0, "activate: it claims the open windows");
  ok(/k\.startsWith\("hedact-"\) \|\| k === "transformers-cache"/.test(w) && at("caches.delete(k)") > 0, "it deletes the tool's caches (hedact-vNN) and the model's (transformers-cache)");
  ok(at("c.navigate(c.url)") > 0 && w.includes('matchAll({ type: "window" })'), "it sends every open window to its own address, where the moved page answers");
  // the address is in the worker's own scope, and the browser holds that navigation until activation ends:
  // awaited inside activate, it never ends (found on the first run of e2e/moved.spec.js)
  ok(!/await c\.navigate|await Promise\.\w+\([^)]*navigate/.test(w), "it does not wait for those navigations inside its own activation");
  ok(at("self.registration.unregister()") > 0, "and removes itself");
  ok(at("self.clients.claim()") < at("caches.delete(k)") && at("caches.delete(k)") < at("c.navigate(c.url)") && at("c.navigate(c.url)") < at("self.registration.unregister()"), "in that order: claim, delete, navigate, unregister");
  ok(/finally\s*\{\s*await self\.registration\.unregister\(\);/.test(w), "it removes itself even when a step before fails");
  ok(!/localStorage|indexedDB/.test(w), "it never touches localStorage: the saved cases stay");
  ok(!/addEventListener\("fetch"/.test(w), "it answers no request: everything goes to the network");

  console.log("\n— the build replaces only a folder it made, and checks its sources —");
  let rebuilt = true; try { build(out); } catch (_) { rebuilt = false; }
  ok(rebuilt, "its own output can be rebuilt in place");
  const toolBuilt = path.join(tmp, "tool");
  fs.mkdirSync(path.join(toolBuilt, "fonts"), { recursive: true });
  for (const f of [".nojekyll", "index.html", "support.js", "fonts/x.woff2"]) fs.writeFileSync(path.join(toolBuilt, f), "");
  let over = true; try { build(toolBuilt); } catch (_) { over = false; }
  ok(over && fs.readdirSync(toolBuilt).sort().join() === ".nojekyll,404.html,index.html,sw.js", "a folder build-site.js made is replaced");
  const foreign = path.join(tmp, "foreign");
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, "client-document.docx"), "x");
  let refused = false; try { build(foreign); } catch (_) { refused = true; }
  ok(refused && fs.existsSync(path.join(foreign, "client-document.docx")), "a folder it did not make is refused and left as it was");
  let dash = false; try { build(path.join(tmp, "--list")); } catch (_) { dash = true; }
  ok(dash && !fs.existsSync(path.join(tmp, "--list")), "a flag typed as a path is refused");
  const src = path.join(tmp, "src");
  fs.mkdirSync(src);
  for (const f of FORWARD_FILES) fs.copyFileSync(path.join(ROOT, "forward", f), path.join(src, f));
  fs.appendFileSync(path.join(src, "404.html"), "\n<!-- stale -->\n");
  let stale = false; try { build(path.join(tmp, "stale"), src); } catch (_) { stale = true; }
  ok(stale && !fs.existsSync(path.join(tmp, "stale")), "a 404.html that is not the page is refused");
  const cli = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-forward.js")], { cwd: tmp, encoding: "utf8" });
  ok(cli.status === 2 && /usage/.test(cli.stderr) && !fs.existsSync(path.join(tmp, "_site")), "without a folder it says how to run it and writes nothing");
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
