/* Derives the design-canvas file from index.html:  node scripts/build-design.js

   index.html is the source of truth; design/redact.dc.html is a view of it
   for the Claude Design canvas. The two used to be edited in step by hand,
   1,700 lines each. Now one is generated from the other, and
   tests/design_t.js fails when the generated file is stale.

   What differs, and only this:
     - the page head (meta, manifest, icons, the boot overlay, the version
       script) is not in the canvas file; the theme <style> moves into the
       <helmet> instead
     - the version chip after </x-dc> is not in the canvas file
     - the canvas file carries a $preview size in data-props
     - the page lets tests point imports elsewhere through window.__resources;
       the canvas file imports the plain paths */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "design", "redact.dc.html");

function build(html) {
  const NL = html.includes("\r\n") ? "\r\n" : "\n";
  const cut = (s, from, to, what) => {
    const a = s.indexOf(from); if (a < 0) throw new Error("not found: " + what + " start");
    const b = s.indexOf(to, a); if (b < 0) throw new Error("not found: " + what + " end");
    return [a, b + to.length];
  };
  // the theme style: the <style> whose first rule is :root
  const [ts0, ts1] = cut(html, "<style>" + NL + ":root{", "</style>", "theme style");
  const theme = html.slice(ts0, ts1);
  // helmet inner: between <helmet> and the blank line before </helmet>
  const h0 = html.indexOf("<helmet>" + NL) + ("<helmet>" + NL).length;
  const h1 = html.indexOf(NL + "</helmet>", h0);
  if (h0 < 8 || h1 < 0) throw new Error("helmet not found");
  const helmetInner = html.slice(h0, h1).replace(/\r?\n+$/, "");
  // body: from </helmet> to the end, minus the version chip
  let body = html.slice(html.indexOf("</helmet>", h1));
  body = body.replace(/<\/x-dc>\r?\n<div id="ver">[^<]*<\/div>\r?\n/, "</x-dc>" + NL);
  if (body.includes('id="ver"')) throw new Error("version chip still present");
  body = body.replace('data-props="{&quot;accent&quot;',
    'data-props="{&quot;$preview&quot;:{&quot;width&quot;:1440,&quot;height&quot;:900},' + NL + '&quot;accent&quot;');
  body = body.replace(/\(window\.__resources && window\.__resources\.\w+\) \|\| /g, "");
  // no m flag: a multiline ^ in JS also matches after a bare \r and would eat the break before it
  body = body.replace(/\r?\n[ \t]*window\.__RE = E;(?=\r?\n)/, "");
  return ["<!DOCTYPE html>", "<html>", "<head>", '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<script src="./support.js"></script>', "</head>", "<body>", "<x-dc>", "<helmet>",
    helmetInner, theme, ""].join(NL) + body;
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const out = build(html);
if (require.main === module) {
  fs.writeFileSync(OUT, out);
  console.log("wrote design/redact.dc.html from index.html");
}
module.exports = { build, OUT };
