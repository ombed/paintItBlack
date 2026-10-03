/* The hosted build's one change to the tool's page: app/index.html also loads the sign-in
   client, the project's config and cloud.js (from the site root, one level up), and may talk
   to the Supabase project. The public GitHub Pages tool is built without this and never
   loads any of them. e2e/cloud.spec.js runs the page this produces. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const supabaseVersion = () => JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", "@supabase", "supabase-js", "package.json"), "utf8")).version;
const PROJECT = (fs.readFileSync(path.join(ROOT, "site", "config.js"), "utf8").match(/url: "(https:\/\/[a-z0-9]+\.supabase\.co)"/) || [])[1];

function hostedApp(html) {
  if (!PROJECT) throw new Error("hosted: no project URL in site/config.js");
  const anchor = '<script src="./page-logic.js"></script>';
  const csp = /(<meta http-equiv="Content-Security-Policy" content="[^"]*connect-src 'self')/;
  if (!html.includes(anchor) || !csp.test(html)) throw new Error("hosted: app/index.html no longer has the places this inserts into");
  return html
    .replace(csp, "$1 " + PROJECT)
    .replace(anchor, `<script src="../vendor/supabase-${supabaseVersion()}.js"></script>\n<script src="../config.js"></script>\n<script src="../cloud.js"></script>\n` + anchor);
}

module.exports = { hostedApp, PROJECT };
