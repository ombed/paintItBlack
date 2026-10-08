/* The link preview image (site/og.png, 1200×630): what a shared link to the site shows in WhatsApp, mail and
   social apps (the gap review's step 4, 8.10). Drawn from the approved name, tagline and icon, in the site's
   own fonts and colours, by a headless browser. Run after either changes: node scripts/build-og.js */
const fs = require("fs"), path = require("path");
const { chromium } = require("@playwright/test");
const SITE = path.join(__dirname, "..", "site");
// the phone icon's drawing (512 px, the mask inside the safe zone on the same green): the tab icon is a small
// picture since the owner's finished icon (8.10), too small for this size
const icon = '<img width="240" height="240" alt="" style="border-radius:52px" src="data:image/png;base64,' + fs.readFileSync(path.join(__dirname, "..", "icon-512.png")).toString("base64") + '">';
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(SITE, "fonts", f)).toString("base64");
const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>
@font-face{font-family:F;font-weight:300 900;src:url(${font("FrankRuhlLibre-hebrew.woff2")}) format("woff2")}
@font-face{font-family:P;font-weight:500;src:url(${font("IBMPlexSansHebrew-500-hebrew.woff2")}) format("woff2")}
@font-face{font-family:P;font-weight:500;src:url(${font("IBMPlexSansHebrew-500-latin.woff2")}) format("woff2");unicode-range:U+0000-00FF}
html,body{margin:0}
body{width:1200px;height:630px;background:#1D3A2E;color:#EDE6CC;display:flex;align-items:center;gap:64px;padding:0 96px;box-sizing:border-box}
.name{font:900 116px/1 F,serif;margin:0 0 6px;display:inline-block;padding-bottom:14px;border-bottom:8px solid #B8892A}
.tag{font:500 46px/1.3 P,sans-serif;margin:30px 0 0}
.site{font:500 30px/1 P,sans-serif;margin:34px 0 0;opacity:.75;direction:ltr;text-align:right}
</style><body>${icon}<div><p class="name">אינקוגניטו</p><p class="tag">החלפת שמות במסמכים לפני AI</p><p class="site">inkognito.co.il</p></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(SITE, "og.png") });
  await b.close();
  console.log("wrote site/og.png");
})();
