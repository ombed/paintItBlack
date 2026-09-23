/* The libraries the site serves itself (review H14): what vendor/ holds is exactly what the
   packages publish, at the versions the code names, and the pins in the engine agree with it.

   transformers.js and pdf.js are compared byte for byte with node_modules, which package-lock
   pins by integrity hash. The runtime's two loaders are not in node_modules at this version
   (transformers.js bundles an older runtime than the onnxruntime-web package it depends on), so
   their SHA-256 is pinned here; they were fetched from the version-pinned jsDelivr path, whose
   bytes jsDelivr serves from npm. The engine's ORT_V must be the runtime version bundled inside
   the vendored transformers.js, or the loader and the WebAssembly would come from two runtimes. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const read = (f) => fs.readFileSync(path.join(ROOT, f));
const hex = (b) => crypto.createHash("sha256").update(b).digest("hex");
const same = (a, b) => Buffer.compare(read(a), read(b)) === 0;
const version = (pkg) => JSON.parse(read(`node_modules/${pkg}/package.json`)).version;

const tv = version("@huggingface/transformers");
ok(fs.existsSync(path.join(ROOT, `vendor/transformers-${tv}.min.js`)), "vendor holds transformers " + tv + ", the installed version");
ok(same(`vendor/transformers-${tv}.min.js`, "node_modules/@huggingface/transformers/dist/transformers.min.js"), "and it is the package's own transformers.min.js, the file the CDN served");

const pv = version("pdfjs-dist");
for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"])
  ok(same(`vendor/pdfjs-${pv}/${f}`, `node_modules/pdfjs-dist/build/${f}`), `vendor/pdfjs-${pv}/${f} is the package's file`);

const eng = read("engine/08-docx.js").toString();
const ORT_V = (eng.match(/const ORT_V="([^"]+)"/) || [])[1];
ok(!!ORT_V && read(`vendor/transformers-${tv}.min.js`).toString().includes('"' + ORT_V + '"'), "the engine's runtime version " + ORT_V + " is the one bundled in transformers.js");
const LOADERS = {
  "ort-wasm-simd-threaded.asyncify.mjs": "4b90d459fc7b1c57b8744cfc8acda25930016f9cd8f264b33bd12f0c01b18bca",
  "ort-wasm-simd-threaded.mjs": "9a146339c46e225134267d699cc3ec752aee69ffe076a644ecf92a45a2b706f4",
};
for (const [f, h] of Object.entries(LOADERS)) ok(hex(read(`vendor/ort-${ORT_V}/${f}`)) === h, `vendor/ort-${ORT_V}/${f} is the pinned file`);
const wasmKeys = Object.keys(JSON.parse("{" + (eng.match(/const ORT_WASM=\{([^}]*)\}/) || ["", ""])[1] + "}"));
ok(wasmKeys.length === 2 && wasmKeys.every((k) => LOADERS[k + ".mjs"]), "every WebAssembly the engine pins has its loader in vendor: " + wasmKeys.join(", "));
ok(Object.values(JSON.parse("{" + (eng.match(/const ORT_WASM=\{([^}]*)\}/) || ["", ""])[1] + "}")).every((v) => /^[A-Za-z0-9+/]{43}=$/.test(v)), "and each has a SHA-256 in base64");

// the model is pinned to a commit and its weights to a hash, not to "main"
ok(/const NER_REV="[0-9a-f]{40}"/.test(eng), "the model revision is a commit, not a branch");
ok(/sha256:"[0-9a-f]{64}"/.test(eng), "the weights carry a SHA-256");
ok(!/resolve\/main\//.test(eng.replace(/rev==="main"/g, "")), "nothing loads from resolve/main");
// and nothing that sees the document is imported from a CDN any more
ok(!/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers/.test(eng), "transformers.js is not loaded from the CDN");
ok(!/cdn\.jsdelivr\.net\/npm\/pdfjs-dist/.test(read("pdf-text.js").toString()), "pdf.js is not loaded from the CDN");

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
