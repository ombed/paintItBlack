/* The hosted build's changes to the tool's page (app/index.html). The public GitHub Pages tool is
   built without any of this.
   1. It signs in: the page also loads the sign-in client, the project's config and cloud.js (from
      the site root, one level up), and may talk to the Supabase project.
   2. It asks no other site for anything. The tool loads React, ReactDOM and Babel from unpkg, d3
      and topojson from unpkg, and the world map's data and the AI runtime's WebAssembly from
      jsdelivr: each of those sees the visitor's address. Here the site serves them itself: the
      same package releases, checked byte for byte by the build against the hashes the tool
      already pins (scripts/build-hosted.js), handed to the tool through window.__resources
      (hosted-resources.js) or by address in the page, and the page's Content-Security-Policy
      names no other site but the project. The fonts are the tool's own files since v60 (fonts/,
      in the site's file list), so they come along with the rest.
   3. Its name: InKognito (אינקוגניטו). Since v60 the public tool carries it too, in the page's
      title, the header's wordmark and the install manifest; the build checks that it still does.
      On a phone the tool's header wraps, and the account button joins the name and the day/night
      button on its first row.
   4. What it says about sending: the public tool sends nothing by itself, and says so; the hosted
      one sends the usage log and the report on missed names at the end of each document, to
      whoever agreed (site/cloud.js). Its "send for review" box says that instead, and no longer
      suggests pasting the report into a public issue (review 5.10).
   e2e/cloud.spec.js and e2e/hosted-build.spec.js run the page this produces. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const pkgVersion = (name) => JSON.parse(read(path.join("node_modules", name, "package.json"))).version;
const supabaseVersion = () => pkgVersion("@supabase/supabase-js");
const PROJECT = (read("site/config.js").match(/url: "(https:\/\/[a-z0-9]+\.supabase\.co)"/) || [])[1];
const ORT_V = (read("redact-engine.js").match(/const ORT_V="([^"]+)"/) || [])[1];

/* The libraries the tool takes from other sites, and where the hosted site keeps its own copy.
   pin: where the tool's own hash for that file is (a Subresource Integrity sha384, or the engine's
   SHA-256 for the runtime), so the build can refuse a copy that is not the same file. */
const LIBS = [
  { url: "https://unpkg.com/react@18.3.1/umd/react.production.min.js", from: "node_modules/react/umd/react.production.min.js", to: "vendor/react-18.3.1.production.min.js", via: "resources",
    pin: () => (read("support.js").match(/REACT_SRI = "(sha384-[^"]+)"/) || [])[1] },
  { url: "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js", from: "node_modules/react-dom/umd/react-dom.production.min.js", to: "vendor/react-dom-18.3.1.production.min.js", via: "resources",
    pin: () => (read("support.js").match(/REACT_DOM_SRI = "(sha384-[^"]+)"/) || [])[1] },
  { url: "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js", from: "node_modules/@babel/standalone/babel.min.js", to: "vendor/babel-standalone-7.29.0.min.js", via: "resources",
    pin: () => (read("support.js").match(/BABEL_SRI = "(sha384-[^"]+)"/) || [])[1] },
  { url: "https://unpkg.com/d3@7.9.0/dist/d3.min.js", from: "node_modules/d3/dist/d3.min.js", to: "vendor/d3-7.9.0.min.js", via: "page",
    pin: () => (read("index.html").match(/d3@7\.9\.0\/dist\/d3\.min\.js","(sha384-[^"]+)"/) || [])[1] },
  { url: "https://unpkg.com/topojson-client@3.1.0/dist/topojson-client.min.js", from: "node_modules/topojson-client/dist/topojson-client.min.js", to: "vendor/topojson-client-3.1.0.min.js", via: "page",
    pin: () => (read("index.html").match(/topojson-client@3\.1\.0\/dist\/topojson-client\.min\.js","(sha384-[^"]+)"/) || [])[1] },
  // data, not code: the page fetches it without a pinned hash, as from the CDN
  { url: "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json", from: "node_modules/world-atlas/countries-110m.json", to: "vendor/world-atlas-2.0.2/countries-110m.json", via: "atlas", pin: () => null },
];
// the runtime's WebAssembly, at the version transformers.js runs (an npm alias pins it); the engine
// joins parts and checks the SHA-256 it pins (window.__resources.ort)
const ORT_FILES = ["ort-wasm-simd-threaded.asyncify", "ort-wasm-simd-threaded"];
const ortFrom = (name) => "node_modules/onnxruntime-web-1.24/dist/" + name + ".wasm";
const ortPin = (name) => (read("redact-engine.js").match(new RegExp('"' + name.replace(/\./g, "\\.") + '":"([^"]+)"')) || [])[1];
const ORT_DIR = () => "vendor/ort-" + ORT_V + "/";

// window.__resources for the hosted page: support.js loads React, ReactDOM and Babel from here,
// the atlas its data, and the engine the runtime's WebAssembly (parts: name -> how many)
function resourcesScript(ortParts) {
  const map = {};
  for (const l of LIBS) if (l.via === "resources") map[l.url] = "./" + l.to;
  map.atlas = "./" + LIBS.find((l) => l.via === "atlas").to;
  map.ort = { base: "./" + ORT_DIR(), parts: ortParts || {} };
  return "/* Generated by scripts/build-hosted.js: the hosted site serves the tool's libraries itself. */\n" +
    "window.__resources = Object.assign(window.__resources || {}, " + JSON.stringify(map, null, 1) + ");\n";
}

const NAME = "אינקוגניטו";
// the install manifest: the public tool's own, which names it InKognito too since v60
function hostedManifest(json) {
  const m = JSON.parse(json);
  if (m.name !== NAME || m.short_name !== NAME) throw new Error("hosted: manifest.webmanifest no longer names the tool " + NAME);
  return json;
}

const SENDING = [
  ["שום דבר לא נשלח מעצמו; את המסמך שולחים בנפרד, רק אם רוצים.", "אם מסכימים לשלוח יומן שימוש, הוא נשלח מעצמו בסוף כל מסמך, יחד עם דוח הדליפה, ואפשר לבטל בחלונית ״חשבון״. המסמך עצמו לא נשלח."],
  [" אפשר להדביק אותו ב-issue.", ""],
];

const THIRD = /https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)/;
/* On a phone (the tool's own breakpoint) the header wraps: the name and the day/night button share
   its first row, the steps and the text buttons go below. The account button's place goes on that
   first row too, beside the day/night button; without this it took a row of its own. 134px is the
   34px day/night button, the 74px place, two 8px gaps and some room. After the page's own styles,
   so it wins where both say !important. */
const SLOT_CSS = "<style>@media (max-width:1119px){header>[data-ink-account]{order:1}header>div:first-child{flex-basis:calc(100% - 134px)!important}}</style>";

function hostedApp(html) {
  if (!PROJECT) throw new Error("hosted: no project URL in site/config.js");
  const anchor = '<script src="./page-logic.js"></script>';
  const cspRe = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
  if (!html.includes(anchor) || !cspRe.test(html)) throw new Error("hosted: app/index.html no longer has the places this inserts into");
  let out = html;
  // the policy: no other site, and the project for connections
  out = out.replace(cspRe, (_, a, csp, z) => a + csp.split(";").map((d) => d.trim().split(/\s+/).filter((t) => !THIRD.test(t)).join(" "))
    .map((d) => (/^connect-src\b/.test(d) ? d + " " + PROJECT : d)).join("; ") + z);
  // the map's libraries and data, by address in the page (the data also through __resources);
  // the libraries' integrity attributes stay and still apply
  for (const l of LIBS.filter((x) => x.via === "page" || x.via === "atlas")) {
    if (!out.includes(l.url)) throw new Error("hosted: the page no longer loads " + l.url);
    out = out.split(l.url).join("./" + l.to);
  }
  // a place for the account button in the top bar, beside the day/night button (site/cloud.js fills it)
  const themeBtn = /(<button onClick="\{\{ onTheme \}\}"[^\n]*?<\/button>)(\s*<\/header>)/;
  if ((out.match(new RegExp(themeBtn.source, "g")) || []).length !== 1) throw new Error("hosted: the top bar's day/night button is no longer where it was");
  out = out.replace(themeBtn, '$1\n    <span data-ink-account aria-hidden="true" style="display:inline-block;flex:none;width:74px;height:34px"></span>$2');
  // the name: the page's own since v60, in both titles (the page's and the template's) and the wordmark
  if (out.split("<title>" + NAME + "</title>").length !== 3 || !out.includes("<span data-wordmark>" + NAME + "</span>"))
    throw new Error("hosted: the tool's name is no longer where it was");
  // what it says about sending
  for (const [from, to] of SENDING) {
    if (out.split(from).length !== 2) throw new Error("hosted: the send box's words are no longer where they were: " + from);
    out = out.replace(from, to);
  }
  out = out.replace(anchor, SLOT_CSS + `\n<script src="./hosted-resources.js"></script>\n<script src="../vendor/supabase-${supabaseVersion()}.js"></script>\n<script src="../config.js"></script>\n<script src="../cloud.js"></script>\n` + anchor);
  const left = out.match(new RegExp(THIRD.source + "[^\"'\\s)]*"));
  if (left) throw new Error("hosted: app/index.html still names another site: " + left[0]);
  return out;
}

module.exports = { hostedApp, hostedManifest, NAME, resourcesScript, PROJECT, LIBS, ORT_FILES, ORT_V, ortFrom, ortPin, ORT_DIR, SLOT_CSS };
